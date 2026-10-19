// ══════════════════════════════════════════════════════════════════
// olcum-dene — GÖRÜNTÜLENME SONDASI (19 Ekim 2026)
// ══════════════════════════════════════════════════════════════════
// NE YAPIYOR
// Yayınlanmış gerçek gönderiler için insights uçlarını DENİYOR ve
// sonucu `olcum_denemesi` tablosuna yazıyor. Amaç tek: asıl toplayıcı
// yazılmadan önce hangi iznin ve hangi metrik adının GERÇEKTEN
// çalıştığını görmek.
//
// ⛔ SALT OKUR. Yalnızca GET isteği atıyor. Hiçbir kaydın durumunu
// değiştirmiyor, hiçbir yayın işlevini çağırmıyor, hiçbir gönderi
// oluşturmuyor. Tek yazdığı yer kendi deneme tablosu.
//
// ⛔ JETON HİÇBİR YERE YAZILMIYOR. Saklanan adres, access_token
// parametresi çıkarılmış hali. Hata metinleri de süzülüyor: Meta
// hata mesajlarının içinde jeton parçası dönebiliyor.
//
// ⚠ NEDEN ADAY LİSTESİ VAR. Metrik adları sürüme göre değişiyor
// (Instagram'da `plays` yeni sürümlerde `views` oldu) ve hangisinin
// geçerli olduğunu buradan bilemiyorum. Tahmin edip tek bir ada
// yaslanmak, Bölüm 4'teki "doğrulamadan sayı yazma" hatasının kod
// hali olurdu. Onun yerine hepsini deniyor, hangisi döndüyse onu
// kaydediyor. Asıl toplayıcı bu sonuca bakılarak yazılacak.
//
// ⚠ KAPSAM: KALICI İÇERİKLER. Kullanıcı 19 Ekim 2026'da seçti:
// reels + Threads. Hikâyeler DIŞARIDA -- insights'ları 24 saatte
// kayboluyor, yani ayrı bir sıklık ve ayrı bir kayıp riski demek.
// Onlar ikinci adımda.
// ══════════════════════════════════════════════════════════════════
const SURUM = '1.0.0';

const ayar = (ad: string) => (Deno.env.get(ad) ?? '').trim();

const SUPABASE_URL  = ayar('SUPABASE_URL');
const SERVIS        = ayar('SUPABASE_SERVICE_ROLE_KEY');
const WORKER_SECRET = ayar('STORY_WORKER_SECRET');
const PAGE_TOKEN    = ayar('META_PAGE_TOKEN');
const GRAF_TABANI   = (ayar('GRAF_TABANI') || 'https://graph.facebook.com/v21.0');
const THREADS_TABANI = (ayar('THREADS_TABANI') || 'https://graph.threads.net/v1.0');

const ZAMAN_ASIMI_MS = 15_000;
// Platform başına kaç gönderi denensin. Sonda için bir tane yeter:
// amaç istatistik değil, "izin var mı, alan adı ne" sorusu.
const PLATFORM_BASINA = 2;

// Jeton bir hata metninin içinde dönebiliyor. Hiçbir metin
// süzülmeden ne tabloya ne günlüğe gidiyor.
function temizle(s: string): string {
  let m = String(s ?? '');
  for (const jeton of [PAGE_TOKEN]) {
    if (jeton && jeton.length > 8) m = m.split(jeton).join('<jeton>');
  }
  m = m.replace(/access_token=[^&\s"']+/gi, 'access_token=<jeton>');
  return m.slice(0, 2000);
}

function json(govde: unknown, durum = 200): Response {
  return new Response(JSON.stringify(govde), {
    status: durum, headers: { 'Content-Type': 'application/json' }
  });
}

async function rest(yol: string, secenek: { method?: string; govde?: unknown } = {}) {
  const h = new Headers({
    apikey: SERVIS, Authorization: `Bearer ${SERVIS}`,
    'Content-Type': 'application/json'
  });
  const r = await fetch(`${SUPABASE_URL}/rest/v1${yol}`, {
    method: secenek.method || 'GET', headers: h,
    body: secenek.govde === undefined ? undefined : JSON.stringify(secenek.govde)
  });
  const metin = await r.text();
  let veri: any = null;
  try { veri = metin ? JSON.parse(metin) : null; } catch { veri = metin; }
  if (!r.ok) throw new Error(`REST ${r.status}: ${temizle(typeof veri === 'string' ? veri : JSON.stringify(veri))}`);
  return veri;
}

// ---- ADAY UÇLAR ------------------------------------------------------------
// Her aday: insan okunur bir ad, tam adres (jetonsuz) ve hangi jeton.
type Aday = { ad: string; adres: string; jeton: 'meta' | 'threads' };

function adaylar(platform: string, tur: string, id: string): Aday[] {
  const g = GRAF_TABANI.replace(/\/+$/, '');
  const t = THREADS_TABANI.replace(/\/+$/, '');
  const q = encodeURIComponent(id);

  if (platform === 'threads') {
    // Threads insights ayrı bir izin istiyor: threads_manage_insights.
    // İzin yoksa burada 403 görünecek -- sondanın asıl aradığı cevap bu.
    return [
      { ad: 'threads/insights', jeton: 'threads',
        adres: `${t}/${q}/insights?metric=views,likes,replies,reposts,quotes` },
      { ad: 'threads/insights-yalniz-views', jeton: 'threads',
        adres: `${t}/${q}/insights?metric=views` },
    ];
  }

  if (platform === 'instagram') {
    // `plays` eski, `views` yeni. Hangisinin geçerli olduğu sürüme
    // bağlı; ikisi de deneniyor ve hangisi dönerse o kaydediliyor.
    return [
      { ad: 'ig/insights-views', jeton: 'meta',
        adres: `${g}/${q}/insights?metric=views,reach,likes,comments,saved,shares` },
      { ad: 'ig/insights-plays', jeton: 'meta',
        adres: `${g}/${q}/insights?metric=plays,reach,likes,comments,saved` },
      { ad: 'ig/alanlar', jeton: 'meta',
        adres: `${g}/${q}?fields=id,media_type,permalink,like_count,comments_count` },
    ];
  }

  if (platform === 'facebook') {
    // Facebook reels'in external_id'si bir video kimliği. İki ayrı yol
    // var ve hangisinin bu kimlikle çalıştığı denenmeden bilinmiyor.
    return [
      { ad: 'fb/video-alanlar', jeton: 'meta',
        adres: `${g}/${q}?fields=id,permalink_url,views,post_views,length` },
      { ad: 'fb/video-insights', jeton: 'meta',
        adres: `${g}/${q}/video_insights?metric=total_video_views,total_video_impressions` },
      { ad: 'fb/post-insights', jeton: 'meta',
        adres: `${g}/${q}/insights?metric=post_impressions,post_video_views` },
    ];
  }

  return [];
}

// Dönen gövdeden metrik ADLARINI çıkarıyor. Aranan şey bu: değer
// bugün kaç olursa olsun, asıl toplayıcı alan adına göre yazılacak.
function alanAdlari(veri: any): string {
  const adlar: string[] = [];
  if (veri && Array.isArray(veri.data)) {
    for (const m of veri.data) {
      if (m && typeof m === 'object') {
        if (typeof m.name === 'string') adlar.push(m.name);
        else adlar.push(...Object.keys(m));
      }
    }
  } else if (veri && typeof veri === 'object') {
    adlar.push(...Object.keys(veri));
  }
  return [...new Set(adlar)].join(',');
}

async function jetonBul(tur: 'meta' | 'threads', userId: string): Promise<string> {
  if (tur === 'meta') return PAGE_TOKEN;
  const satir = await rest(
    `/threads_hesaplari?user_id=eq.${encodeURIComponent(userId)}&select=erisim_jetonu`);
  return (Array.isArray(satir) && satir[0]?.erisim_jetonu) || '';
}

async function dene(k: any, aday: Aday, jeton: string) {
  const satir: Record<string, unknown> = {
    kayit_id: String(k.id ?? ''), platform: String(k.platform ?? ''),
    tur: String(k.type ?? ''), external_id: String(k.external_id ?? ''),
    // ⛔ Saklanan adres jetonsuz: aşağıda jeton AYRI ekleniyor.
    adres: `${aday.ad}  ${aday.adres}`,
    basarili: false
  };

  if (!jeton) {
    satir.hata = 'jeton yok';
    await rest('/olcum_denemesi', { method: 'POST', govde: [satir] });
    return;
  }

  const ayrac = aday.adres.includes('?') ? '&' : '?';
  const tamAdres = `${aday.adres}${ayrac}access_token=${encodeURIComponent(jeton)}`;

  try {
    const r = await fetch(tamAdres, { signal: AbortSignal.timeout(ZAMAN_ASIMI_MS) });
    const metin = await r.text();
    let veri: any = null;
    try { veri = metin ? JSON.parse(metin) : null; } catch { veri = null; }

    satir.http_kodu = r.status;
    // ⚠ BAŞARILI = CEVAP GELDİ, "SAYI BÜYÜK" DEĞİL. Sıfır dönen bir
    // ölçüm de başarılı bir ölçümdür; ayrım korunuyor.
    satir.basarili = r.ok;
    satir.alanlar = r.ok ? alanAdlari(veri) : '';
    satir.ham = temizle(metin);
    if (!r.ok) satir.hata = temizle(veri?.error?.message || metin || `HTTP ${r.status}`);
  } catch (e) {
    satir.hata = temizle((e as Error).message);
  }

  await rest('/olcum_denemesi', { method: 'POST', govde: [satir] });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    return json({ ok: true, servis: 'olcum-dene', surum: SURUM, saltOkur: true });
  }
  if (req.method !== 'POST') return json({ ok: false, sebep: 'yalnız POST' }, 405);
  if (!WORKER_SECRET || req.headers.get('x-webhook-secret') !== WORKER_SECRET) {
    return json({ ok: false, sebep: 'yetkisiz' }, 401);
  }
  if (!SUPABASE_URL || !SERVIS) {
    return json({ ok: false, sebep: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok' }, 500);
  }

  // Kalıcı içerikler: reels + Threads. Hikâye YOK (yukarıdaki kapsam notu).
  const sorgu = '/calendar_events'
    + '?publish_state=eq.published'
    + '&external_id=not.is.null'
    + '&or=(type.eq.reels,platform.eq.threads)'
    + '&select=id,platform,type,external_id,user_id,publish_at'
    + '&order=publish_at.desc&limit=40';

  let kayitlar: any[] = [];
  try {
    kayitlar = await rest(sorgu) || [];
  } catch (e) {
    console.error('[olcum-dene] kayitlar okunamadi:', temizle((e as Error).message));
    return json({ ok: false, sebep: 'kayitlar okunamadi' }, 500);
  }

  // Platform başına en yeni birkaç kayıt: amaç istatistik değil, izin
  // ve alan adı sorusu.
  const sayac: Record<string, number> = {};
  const secilen = kayitlar.filter((k) => {
    const anahtar = `${k.platform}/${k.type}`;
    sayac[anahtar] = (sayac[anahtar] ?? 0) + 1;
    return sayac[anahtar] <= PLATFORM_BASINA;
  });

  let denenen = 0;
  for (const k of secilen) {
    const liste = adaylar(String(k.platform ?? ''), String(k.type ?? ''), String(k.external_id ?? ''));
    for (const aday of liste) {
      const jeton = await jetonBul(aday.jeton, String(k.user_id ?? ''));
      await dene(k, aday, jeton);
      denenen++;
    }
  }

  console.log('[olcum-dene] bitti, deneme sayisi:', denenen, 'kayit:', secilen.length);
  return json({ ok: true, surum: SURUM, kayit: secilen.length, deneme: denenen });
});
