// Shootboard — TikTok hesap bağlama
//
// ══════════════════════════════════════════════════════════════════
// NE İŞE YARIYOR
// ══════════════════════════════════════════════════════════════════
// Kullanıcı shootboard.app'te "TikTok'u bağla" dediğinde TikTok'un
// yetkilendirme sayfasına gidiyor, dönüşte tarayıcı `tiktok.html`
// sayfasına bir `code` ile düşüyor. Bu fonksiyon o `code`u kalıcı
// jetona çeviriyor ve jetonu VERİTABANINA yazıyor.
//
// ⛔ BU İŞ TARAYICIDA YAPILAMAZ ve bu bir tercih değil:
// jeton takası `client_secret` istiyor. Statik bir sayfaya sır
// gömmek, sırrı herkese dağıtmak demek. O yüzden sayfa yalnızca
// `code`u buraya iletiyor; secret bu fonksiyonun ortamında duruyor
// ve cevapta da dönmüyor.
//
// ══════════════════════════════════════════════════════════════════
// UÇLAR
// ══════════════════════════════════════════════════════════════════
//   GET  /  -> servis bilgisi (dağıtım doğrulanabilsin)
//   POST /  -> { code, redirect_uri } + Authorization: Bearer <supabase jwt>
//   POST /?kes=1 -> bağlantıyı kes
//
// Dağıtım adı ile URL adresi Supabase'de AYRI şeyler olabiliyor;
// `hosgeldin` fonksiyonu `/functions/v1/hyper-worker` adresine
// düşmüştü ve bu bir kez 404 yedirmişti. Dağıttıktan sonra GET ucunu
// açıp `surum` alanını gör.

const SURUM = '1.1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVIS       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON         = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const CLIENT_KEY   = Deno.env.get('TIKTOK_CLIENT_KEY') ?? '';
const CLIENT_SECRET= Deno.env.get('TIKTOK_CLIENT_SECRET') ?? '';

// TikTok v2. Sonundaki eğik çizgi ŞART: TikTok çizgisiz adreste
// yönlendirme yapıyor ve POST gövdesi yönlendirmede düşüyor.
const JETON_UCU = 'https://open.tiktokapis.com/v2/oauth/token/';
const BILGI_UCU = 'https://open.tiktokapis.com/v2/user/info/';

function json(govde: unknown, durum = 200): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Sayfa shootboard.app'te, fonksiyon supabase.co'da: tarayıcı
      // bunu çapraz kaynak sayıyor ve ön kontrol (OPTIONS) atıyor.
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, GET, OPTIONS'
    }
  });
}

// ⚠ HATA METİNLERİ KULLANICIYA GİDİYOR.
// TikTok'un cevabını olduğu gibi yansıtmak jetonu da yansıtabilir --
// hata gövdesinde `access_token` dönen uçlar var. Bu yüzden dışarı
// yalnızca TikTok'un hata KODU ve açıklaması çıkıyor.
function tiktokHatasi(veri: any): string {
  const k = String(veri?.error ?? veri?.error_code ?? 'bilinmeyen');
  const a = String(veri?.error_description ?? veri?.message ?? '');
  return a ? `${k}: ${a}` : k;
}

async function rest(yol: string, secenek: { method?: string; govde?: unknown; prefer?: string } = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${yol}`, {
    method: secenek.method ?? 'GET',
    headers: {
      apikey: SERVIS,
      authorization: `Bearer ${SERVIS}`,
      'content-type': 'application/json',
      ...(secenek.prefer ? { prefer: secenek.prefer } : {})
    },
    ...(secenek.govde === undefined ? {} : { body: JSON.stringify(secenek.govde) })
  });
  const metin = await r.text();
  let veri: any = null;
  try { veri = metin ? JSON.parse(metin) : null; } catch { veri = metin; }
  if (!r.ok) throw new Error(`postgrest ${r.status}: ${String(metin).slice(0, 200)}`);
  return veri;
}

// Oturumu DOĞRULUYORUZ, kullanıcının söylediğine inanmıyoruz.
// Gövdeden gelen bir user_id'ye güvenseydik, herhangi biri başkasının
// hesabına TikTok bağlayabilirdi.
async function kullaniciyiCoz(jwt: string): Promise<{ id: string } | null> {
  if (!jwt) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON || SERVIS, authorization: `Bearer ${jwt}` }
  });
  if (!r.ok) return null;
  const v = await r.json().catch(() => null);
  return v?.id ? { id: String(v.id) } : null;
}

async function jetonAl(code: string, redirectUri: string) {
  // application/x-www-form-urlencoded: bu uç JSON kabul etmiyor.
  const govde = new URLSearchParams({
    client_key: CLIENT_KEY,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  });
  const r = await fetch(JETON_UCU, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: govde.toString()
  });
  const veri = await r.json().catch(() => null);
  if (!r.ok || !veri?.access_token) {
    throw new Error('TikTok jetonu alınamadı -- ' + tiktokHatasi(veri));
  }
  return veri;
}

// Görünen ad SADECE ekranda "@filanca olarak bağlı" yazabilmek için.
// Alınamazsa bağlantı BOZULMUYOR: isim boş kalır, yükleme çalışır.
async function kullaniciAdi(erisimJetonu: string): Promise<string> {
  try {
    const r = await fetch(`${BILGI_UCU}?fields=open_id,display_name`, {
      headers: { authorization: `Bearer ${erisimJetonu}` }
    });
    if (!r.ok) return '';
    const v = await r.json().catch(() => null);
    return String(v?.data?.user?.display_name ?? '');
  } catch {
    return '';
  }
}

Deno.serve(async (istek: Request) => {
  if (istek.method === 'OPTIONS') return json({ ok: true });

  if (istek.method === 'GET') {
    return json({
      ok: true, servis: 'shootboard-tiktok-baglan', surum: SURUM,
      uclar: ['GET / (servis bilgisi)', 'POST / (code -> jeton)', 'POST /?kes=1 (baglantiyi kes)'],
      // ⚠ client_key AÇIKÇA DÖNÜYOR ve bu doğru: bu değer zaten
      // yetkilendirme adresinin sorgu dizgesinde, kullanıcının adres
      // çubuğunda görünüyor. OAuth'ta gizli olan client_SECRET.
      //
      // Sayfaya gömmek yerine buradan vermenin sebebi: sandbox'tan
      // production'a geçerken yalnızca gizli değişken değişecek, kod
      // değişmeyecek. Anahtarı sayfaya yazsaydık o geçişte
      // "sandbox anahtarıyla production'a bağlanmaya çalışmak" gibi
      // sessiz bir hata mümkün olurdu.
      client_key: CLIENT_KEY,
      // Hangi izinleri istiyoruz. Sayfa bunu adres kurarken kullanıyor;
      // TEK YER olsun diye burada duruyor.
      kapsamlar: 'user.info.basic,video.upload',
      // ⚠ Yalnızca "tanımlı mı" bilgisi. Değerin kendisi asla.
      yapilandirma: {
        supabase:      !!SUPABASE_URL,
        servis_anahtari: !!SERVIS,
        anon_anahtari:   !!ANON,
        client_key:    !!CLIENT_KEY,
        client_secret: !!CLIENT_SECRET
      }
    });
  }

  if (istek.method !== 'POST') return json({ ok: false, sebep: 'yalnizca POST' }, 405);
  if (!SUPABASE_URL || !SERVIS) return json({ ok: false, sebep: 'SUPABASE_URL / SERVICE_ROLE yok' }, 500);
  if (!CLIENT_KEY || !CLIENT_SECRET) {
    return json({ ok: false, sebep: 'TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET tanimli degil' }, 500);
  }

  const yetki = istek.headers.get('authorization') ?? '';
  const jwt = yetki.toLowerCase().startsWith('bearer ') ? yetki.slice(7).trim() : '';
  const kisi = await kullaniciyiCoz(jwt);
  if (!kisi) return json({ ok: false, sebep: 'Oturum dogrulanamadi' }, 401);

  const adres = new URL(istek.url);
  if (adres.searchParams.get('kes') === '1') {
    await rest(`/tiktok_hesaplari?user_id=eq.${kisi.id}`, { method: 'DELETE' });
    return json({ ok: true, bagli: false });
  }

  const govde = await istek.json().catch(() => null);
  const code = String(govde?.code ?? '').trim();
  const redirectUri = String(govde?.redirect_uri ?? '').trim();
  if (!code) return json({ ok: false, sebep: 'code yok' }, 400);
  if (!redirectUri) return json({ ok: false, sebep: 'redirect_uri yok' }, 400);

  let jeton: any;
  try {
    jeton = await jetonAl(code, redirectUri);
  } catch (e) {
    return json({ ok: false, sebep: (e as Error).message }, 400);
  }

  const simdi = Date.now();
  const ad = await kullaniciAdi(String(jeton.access_token));

  // upsert: kişi başına tek satır. Yeniden bağlarsa üstüne yazılıyor,
  // ikinci bir satır birikmiyor.
  await rest('/tiktok_hesaplari?on_conflict=user_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    govde: [{
      user_id:         kisi.id,
      open_id:         String(jeton.open_id ?? ''),
      kullanici_adi:   ad,
      erisim_jetonu:   String(jeton.access_token),
      erisim_bitis:    new Date(simdi + Number(jeton.expires_in ?? 86400) * 1000).toISOString(),
      yenileme_jetonu: String(jeton.refresh_token ?? ''),
      yenileme_bitis:  jeton.refresh_expires_in
        ? new Date(simdi + Number(jeton.refresh_expires_in) * 1000).toISOString()
        : null,
      kapsamlar:       String(jeton.scope ?? '').split(/[,\s]+/).filter(Boolean),
      guncelleme:      new Date(simdi).toISOString(),
      son_hata:        null,
      son_hata_zamani: null
    }]
  });

  // ⛔ Cevapta jeton YOK. Tarayıcının bilmesi gereken tek şey bağlandığı.
  return json({ ok: true, bagli: true, kullanici_adi: ad });
});
