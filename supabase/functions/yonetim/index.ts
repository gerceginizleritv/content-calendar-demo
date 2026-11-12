// Shootboard yönetim ucu — Supabase Edge Function.
//
// NE YAPAR. Yönetim sayfasının (yonetim.html) verisini verir ve fiyat /
// vergi değişikliklerini yazar. Sayfanın kendisi veritabanına DOĞRUDAN
// hiç dokunmuyor; her şey buradan geçiyor.
//
// ⛔ NEDEN BÖYLE. Promptun 2. güvenlik maddesi: "Yönetim sayfasını
// gizlemek güvenlik DEĞİLDİR." Sayfayı gizlemek yalnızca gürültüyü
// azaltır. Asıl koruma şu: her istek burada, SUNUCUDA, "bu istek
// sahibinden mi geliyor" diye denetlenir. Yönetim HTML'inde gizli
// hiçbir şey yok — sayfanın tamamı okunsa bile içinde veri yok.
//
// ⛔ SALT OKUNUR VARSAYILAN. Veri değiştiren her işlem (fiyat, vergi)
// gövdede `onay: true` ister. Onaysız gelen değiştirme isteği
// REDDEDİLİR. Promptun 9. maddesi.
//
// ⛔ DENETİM KAYDI. Değiştiren her işlem admin_audit'e yazılır: kim,
// ne zaman, eski değer, yeni değer. O tabloda silme ve değiştirme
// yetkisi hiç kimsede yok (sql/69).
//
// ⛔ KULLANICI İÇERİĞİ GÖSTERİLMİYOR. Promptun şartı: kayıt başlıkları,
// açıklamalar, scriptler yönetim alanında görünmez. Bu fonksiyon
// calendar_events, scripts, ideas tablolarından İÇERİK okumuyor;
// yalnızca SAYIYOR.
//
// ---- Kimlik ---------------------------------------------------------
// Çağıran taraf GERÇEK bir Supabase oturumu. Authorization başlığındaki
// jeton `/auth/v1/user` ile doğrulanıyor, çıkan kullanıcı kimliği
// `yonetici` tablosunda aranıyor. Tarayıcıdan gelen hiçbir "ben
// yöneticiyim" bilgisine güvenilmiyor.
//
// ⚠ Panel ayarında **Verify JWT AÇIK** olmalı (olcum-dene'nin tersi):
// orada çağıran pg_cron'du, burada çağıran kullanıcının kendisi.
//
// ---- Anahtarlar -----------------------------------------------------
// Gizli ayar GEREKMEZ: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY
// Supabase tarafından kendiliğinden tanımlı. ⛔ Servis anahtarı
// YALNIZCA burada; depoya, app.html'e, hiçbir sohbete yazılmıyor.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVIS_ANAHTARI = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const BASLIKLAR = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function cevap(kod: number, govde: unknown) {
  return new Response(JSON.stringify(govde), { status: kod, headers: BASLIKLAR });
}
function hata(kod: number, mesaj: string) {
  return cevap(kod, { hata: mesaj });
}

// Servis anahtarıyla PostgREST çağrısı. RLS'i atlıyor — bu yüzden
// yetki denetimi YUKARIDA, bu fonksiyona girmeden yapılıyor.
async function db(yol: string, secenek: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${yol}`, {
    ...secenek,
    headers: {
      apikey: SERVIS_ANAHTARI,
      Authorization: `Bearer ${SERVIS_ANAHTARI}`,
      'Content-Type': 'application/json',
      ...(secenek.headers ?? {}),
    },
  });
  const metin = await r.text();
  if (!r.ok) throw new Error(`db ${r.status}: ${metin.slice(0, 200)}`);
  return metin ? JSON.parse(metin) : null;
}

// ---- Hız sınırı ------------------------------------------------------
// ⚠ DÜRÜSTÇE: bu sınır ÖRNEK BAŞINA. Edge Function birden çok örnekte
// koşabilir ve her örneğin kendi sayacı olur; yani kararlı bir üst sınır
// DEĞİL, kötüye kullanımı yavaşlatan bir engel. Kararlı sınır için
// veritabanı tarafında bir sayaç tablosu gerekiyor — README'de açık iş
// olarak yazılı. Burada "yaptım" demiyoruz.
const sayac = new Map<string, { adet: number; pencere: number }>();
function hizSiniriAsildi(kim: string, limit = 60, pencereMs = 60_000) {
  const simdi = Date.now();
  const v = sayac.get(kim);
  if (!v || simdi - v.pencere > pencereMs) {
    sayac.set(kim, { adet: 1, pencere: simdi });
    return false;
  }
  v.adet += 1;
  return v.adet > limit;
}

// ---- Kimlik doğrulama -----------------------------------------------
async function yoneticiyiCoz(istek: Request): Promise<string | null> {
  const basl = istek.headers.get('authorization') ?? '';
  if (!basl.toLowerCase().startsWith('bearer ')) return null;

  // Jetonu Supabase'e doğrulatıyoruz. Kendimiz çözmüyoruz: imza
  // doğrulamasını elle yazmak, yanlış yazıldığında sessizce herkesi
  // içeri alan türden bir hata.
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVIS_ANAHTARI, Authorization: basl },
  });
  if (!r.ok) return null;
  const kullanici = await r.json();
  const kim = kullanici?.id;
  if (!kim) return null;

  // ⛔ Yönetici listesi tarayıcıdan değişmez: tabloda yazma politikası
  // yok (sql/69). Burada yalnızca OKUNUYOR.
  const satir = await db(`/yonetici?user_id=eq.${encodeURIComponent(kim)}&select=user_id`);
  return Array.isArray(satir) && satir.length ? kim : null;
}

async function denetimeYaz(actor: string, action: string, target: string,
                           eski: unknown, yeni: unknown) {
  await db('/admin_audit', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ actor, action, target, old_value: eski, new_value: yeni }),
  });
}

// ---- İşlemler --------------------------------------------------------

// Özet: yalnızca SAYILAR. İçerik yok.
async function ozet() {
  const say = async (yol: string) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1${yol}`, {
      method: 'HEAD',
      headers: {
        apikey: SERVIS_ANAHTARI,
        Authorization: `Bearer ${SERVIS_ANAHTARI}`,
        Prefer: 'count=exact',
      },
    });
    const aralik = r.headers.get('content-range') ?? '';
    const n = Number(aralik.split('/')[1]);
    return Number.isFinite(n) ? n : 0;
  };
  const kontenjan = await db('/founding_seats?id=eq.true&select=quota,sold,open');
  return {
    abonelik_toplam: await say('/subscriptions?select=user_id'),
    abonelik_aktif: await say('/subscriptions?status=eq.active&select=user_id'),
    odeme_toplam: await say('/payments?select=id'),
    odeme_basarili: await say('/payments?status=eq.paid&select=id'),
    kontenjan: Array.isArray(kontenjan) ? kontenjan[0] ?? null : null,
  };
}

// Hesaplar: e-posta, son giriş, plan. ⛔ İÇERİK YOK.
// ⚠ Bu KİŞİSEL VERİ. Canlıya çıkmadan önce gizlilik metnine yazılmalı
// (tasarım belgesi, Bölüm 0).
async function hesaplar() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SERVIS_ANAHTARI, Authorization: `Bearer ${SERVIS_ANAHTARI}` },
  });
  if (!r.ok) throw new Error(`auth ${r.status}`);
  const d = await r.json();
  const kullanicilar = Array.isArray(d?.users) ? d.users : [];
  const abonelikler = await db('/subscriptions?select=user_id,plan_key,status');
  const plan = new Map<string, { plan_key: string; status: string }>(
    (abonelikler ?? []).map((x: any) => [x.user_id, x]),
  );
  return kullanicilar.map((u: any) => ({
    id: u.id,
    eposta: u.email ?? '',
    kayit: u.created_at ?? null,
    son_giris: u.last_sign_in_at ?? null,
    plan: plan.get(u.id)?.plan_key ?? 'starter',
    durum: plan.get(u.id)?.status ?? null,
  }));
}

async function odemeler() {
  return await db('/payments?select=id,user_id,plan_key,amount_minor,currency,' +
                  'billing_country,yurt_ici,status,provider,provider_ref,created_at' +
                  '&order=created_at.desc&limit=500');
}

async function fiyatlar() {
  return {
    planlar: await db('/plans?select=key,visible,badge,sort&order=sort'),
    fiyatlar: await db('/plan_prices?select=plan_key,currency,period,amount_minor,active' +
                       '&order=plan_key,currency,period'),
    limitler: await db('/plan_limits?select=plan_key,limit_key,limit_value&order=plan_key'),
    vergi: await db('/tax_settings?select=region,rate_bp,price_includes_tax,' +
                    'tax_id_required,valid_from&order=region,valid_from.desc'),
  };
}

// ⛔ Değiştiren işlem. `onay: true` şart.
async function fiyatDegistir(actor: string, g: any) {
  const { plan_key, currency, period, amount_minor } = g ?? {};
  if (typeof plan_key !== 'string' || typeof currency !== 'string' ||
      typeof period !== 'string' || !Number.isInteger(amount_minor)) {
    return hata(400, 'eksik_alan');
  }
  // ⛔ Sunucu denetimi. Promptun şartı: eksi fiyat, ücretli planda sıfır,
  // yıllık toplamın 12 x aylıktan pahalı olması, bir seferde çok büyük
  // değişim -- uyar ve ikinci onay iste.
  if (amount_minor < 0) return hata(400, 'eksi_fiyat');
  if (amount_minor === 0 && plan_key !== 'starter') return hata(400, 'ucretli_planda_sifir');

  const mevcut = await db(
    `/plan_prices?plan_key=eq.${encodeURIComponent(plan_key)}` +
    `&currency=eq.${encodeURIComponent(currency)}` +
    `&period=eq.${encodeURIComponent(period)}&select=amount_minor`);
  const eski = Array.isArray(mevcut) && mevcut.length ? mevcut[0].amount_minor : null;

  // Yıllık, 12 x aylıktan pahalı olmamalı.
  if (period === 'yearly') {
    const aylik = await db(
      `/plan_prices?plan_key=eq.${encodeURIComponent(plan_key)}` +
      `&currency=eq.${encodeURIComponent(currency)}&period=eq.monthly&select=amount_minor`);
    const a = Array.isArray(aylik) && aylik.length ? aylik[0].amount_minor : null;
    if (a && amount_minor > a * 12) return hata(400, 'yillik_aylikatan_pahali');
  }

  // Bir seferde çok büyük değişim: yanlışlıkla bir sıfır fazla.
  // ⛔ İKİNCİ ONAY ister. `buyuk_degisim_onay` gelmeden yazılmaz.
  if (eski !== null && eski > 0) {
    const kat = amount_minor / eski;
    if ((kat >= 5 || kat <= 0.2) && g.buyuk_degisim_onay !== true) {
      return cevap(409, {
        hata: 'buyuk_degisim',
        eski_minor: eski,
        yeni_minor: amount_minor,
        // Sayfa bunu kullanıcıya gösterip ikinci onayı isteyecek.
        aciklama: 'Fiyat çok büyük oranda değişiyor. İkinci onay gerekiyor.',
      });
    }
  }

  await db('/plan_prices', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ plan_key, currency, period, amount_minor }),
  });
  // price_history'ye trigger kendiliğinden yazıyor (sql/69). Denetim
  // kaydı ayrı: oraya KİMİN yaptığı ve hangi ekrandan geldiği giriyor.
  await denetimeYaz(actor, 'fiyat_degistir',
                    `${plan_key}/${currency}/${period}`,
                    { amount_minor: eski }, { amount_minor });
  return cevap(200, { ok: true, eski_minor: eski, yeni_minor: amount_minor });
}

// ⛔ Değiştiren işlem. Vergi oranı kullanıcıdan gelir; biz sayıyı
// uydurmuyoruz (tasarım belgesi: "kutuyu hazırlıyorum, içine yazılacak
// sayıyı değil").
async function vergiKaydet(actor: string, g: any) {
  const { region, rate_bp, price_includes_tax, tax_id_required, valid_from } = g ?? {};
  if (typeof region !== 'string' || !region.trim()) return hata(400, 'bolge_eksik');
  if (!Number.isInteger(rate_bp) || rate_bp < 0 || rate_bp > 10000) return hata(400, 'oran_gecersiz');

  const eski = await db(`/tax_settings?region=eq.${encodeURIComponent(region)}` +
                        `&select=rate_bp,price_includes_tax,valid_from` +
                        `&order=valid_from.desc&limit=1`);
  await db('/tax_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      region: region.trim(),
      rate_bp,
      price_includes_tax: price_includes_tax !== false,
      tax_id_required: tax_id_required === true,
      valid_from: valid_from || new Date().toISOString().slice(0, 10),
    }),
  });
  await denetimeYaz(actor, 'vergi_kaydet', region,
                    Array.isArray(eski) ? eski[0] ?? null : null,
                    { rate_bp, price_includes_tax, tax_id_required });
  return cevap(200, { ok: true });
}

async function denetim() {
  return await db('/admin_audit?select=id,actor,action,target,old_value,new_value,created_at' +
                  '&order=created_at.desc&limit=200');
}

// ---- Giriş noktası ---------------------------------------------------
Deno.serve(async (istek) => {
  if (istek.method === 'OPTIONS') return new Response(null, { headers: BASLIKLAR });
  if (istek.method !== 'POST') return hata(405, 'yalnizca_post');
  if (!SUPABASE_URL || !SERVIS_ANAHTARI) return hata(500, 'config');

  let actor: string | null = null;
  try {
    actor = await yoneticiyiCoz(istek);
  } catch {
    actor = null;
  }
  // ⛔ TEK CEVAP. Yönetici olmayan ile var olmayan uç arasında fark
  // yaratmıyoruz: "burada bir yönetim ucu var ama sen giremezsin"
  // bilgisini de vermiyoruz.
  if (!actor) return hata(403, 'yetkisiz');

  if (hizSiniriAsildi(actor)) return hata(429, 'cok_fazla_istek');

  let govde: any = {};
  try {
    govde = await istek.json();
  } catch {
    return hata(400, 'gecersiz_govde');
  }
  const islem = String(govde?.islem ?? '');

  try {
    switch (islem) {
      // --- Salt okunur ---
      case 'ozet':      return cevap(200, await ozet());
      case 'hesaplar':  return cevap(200, await hesaplar());
      case 'odemeler':  return cevap(200, await odemeler());
      case 'fiyatlar':  return cevap(200, await fiyatlar());
      case 'denetim':   return cevap(200, await denetim());

      // --- Değiştiren: onay şart ---
      case 'fiyat-degistir':
        if (govde?.onay !== true) return hata(400, 'onay_gerekli');
        return await fiyatDegistir(actor, govde);
      case 'vergi-kaydet':
        if (govde?.onay !== true) return hata(400, 'onay_gerekli');
        return await vergiKaydet(actor, govde);

      default:
        return hata(400, 'bilinmeyen_islem');
    }
  } catch (e) {
    // Hata metni dışarı sızdırılmıyor: tablo adı, sütun adı ve sorgu
    // parçası saldırgana bilgi verir.
    console.error('[yonetim]', islem, e);
    return hata(500, 'sunucu_hatasi');
  }
});
