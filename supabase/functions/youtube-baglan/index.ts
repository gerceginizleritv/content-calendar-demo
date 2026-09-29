// Shootboard — YouTube hesap bağlama
//
// ══════════════════════════════════════════════════════════════════
// tiktok-baglan İLE AYNI DESEN
// ══════════════════════════════════════════════════════════════════
// `code`u jetona çeviriyor ve jetonu VERİTABANINA yazıyor. Takas
// client_secret istediği için tarayıcıda yapılamaz; sayfa yalnızca
// `code`u buraya iletiyor. Gerekçenin tamamı tiktok-baglan'ın başında.
//
// ══════════════════════════════════════════════════════════════════
// GOOGLE'A ÖZGÜ ÜÇ ŞEY
// ══════════════════════════════════════════════════════════════════
//  1. `access_type=offline` OLMADAN yenileme jetonu GELMİYOR. Gelmezse
//     erişim jetonu bir saat sonra ölür ve hat durur -- hata da
//     "yetkisiz" der, sebebi görünmez.
//  2. `prompt=consent` olmadan, kullanıcı daha önce izin verdiyse
//     Google yenileme jetonunu BİR DAHA VERMİYOR. Yeniden bağlanma
//     senaryosunda elimiz boş kalır.
//  3. Erişim jetonu bir saat yaşıyor (TikTok'ta 24 saat). Worker her
//     yüklemede süreyi kontrol edip yeniliyor.

const SURUM = '1.0.0';

const ayar = (ad: string) => (Deno.env.get(ad) ?? '').trim();

const SUPABASE_URL  = ayar('SUPABASE_URL');
const SERVIS        = ayar('SUPABASE_SERVICE_ROLE_KEY');
const ANON          = ayar('SUPABASE_ANON_KEY');
const CLIENT_ID     = ayar('YOUTUBE_CLIENT_ID');
const CLIENT_SECRET = ayar('YOUTUBE_CLIENT_SECRET');

const JETON_UCU  = 'https://oauth2.googleapis.com/token';
const KANAL_UCU  = 'https://www.googleapis.com/youtube/v3/channels';
const KAPSAM     = 'https://www.googleapis.com/auth/youtube.upload';

function json(govde: unknown, durum = 200): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, GET, OPTIONS'
    }
  });
}

// Google hata gövdesinde jeton döndürebiliyor; dışarı yalnızca kod ve
// açıklama çıkıyor.
function googleHatasi(veri: any): string {
  const k = String(veri?.error ?? 'bilinmeyen');
  const a = String(veri?.error_description ?? veri?.error?.message ?? '');
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

// Oturum DOĞRULANIYOR. Gövdeden gelen bir user_id'ye güvenseydik
// herhangi biri başkasının hesabına YouTube bağlayabilirdi.
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
  const govde = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
  const r = await fetch(JETON_UCU, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: govde.toString()
  });
  const veri = await r.json().catch(() => null);
  if (!r.ok || !veri?.access_token) {
    throw new Error('Google jetonu alınamadı -- ' + googleHatasi(veri));
  }
  // ⚠ YENİLEME JETONU YOKSA BAĞLANTI İŞE YARAMAZ.
  // Erişim jetonu bir saat sonra ölür ve yükleme sessizce durur. Bunu
  // BURADA yakalamak, yayın gününde yakalamaktan iyidir.
  if (!veri.refresh_token) {
    throw new Error('Google yenileme jetonu vermedi. Bu genellikle hesabın '
      + 'uygulamaya daha önce izin vermesinden olur: Google Hesabı > '
      + 'Güvenlik > Üçüncü taraf uygulamalar altından Shootboard erişimini '
      + 'kaldırıp yeniden bağla.');
  }
  return veri;
}

// Kanal adı SADECE ekranda göstermek için. Alınamazsa bağlantı
// BOZULMUYOR: ad boş kalır, yükleme çalışır.
async function kanalBilgisi(erisimJetonu: string): Promise<{ id: string; ad: string }> {
  try {
    const r = await fetch(`${KANAL_UCU}?part=snippet&mine=true`, {
      headers: { authorization: `Bearer ${erisimJetonu}` }
    });
    if (!r.ok) return { id: '', ad: '' };
    const v = await r.json().catch(() => null);
    const k = v?.items?.[0];
    return { id: String(k?.id ?? ''), ad: String(k?.snippet?.title ?? '') };
  } catch {
    return { id: '', ad: '' };
  }
}

Deno.serve(async (istek: Request) => {
  if (istek.method === 'OPTIONS') return json({ ok: true });

  if (istek.method === 'GET') {
    return json({
      ok: true, servis: 'shootboard-youtube-baglan', surum: SURUM,
      uclar: ['GET / (servis bilgisi)', 'POST / (code -> jeton)', 'POST /?kes=1 (baglantiyi kes)'],
      // client_id AÇIKÇA dönüyor: zaten yetkilendirme adresinin sorgu
      // dizgesinde, kullanıcının adres çubuğunda görünüyor. Gizli olan
      // client_SECRET ve o hiçbir yerde dönmüyor.
      client_id: CLIENT_ID,
      kapsamlar: KAPSAM,
      yapilandirma: {
        supabase:        !!SUPABASE_URL,
        servis_anahtari: !!SERVIS,
        anon_anahtari:   !!ANON,
        client_id:       !!CLIENT_ID,
        client_secret:   !!CLIENT_SECRET
      }
    });
  }

  if (istek.method !== 'POST') return json({ ok: false, sebep: 'yalnizca POST' }, 405);
  if (!SUPABASE_URL || !SERVIS) return json({ ok: false, sebep: 'SUPABASE_URL / SERVICE_ROLE yok' }, 500);
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json({ ok: false, sebep: 'YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET tanimli degil' }, 500);
  }

  const yetki = istek.headers.get('authorization') ?? '';
  const jwt = yetki.toLowerCase().startsWith('bearer ') ? yetki.slice(7).trim() : '';
  const kisi = await kullaniciyiCoz(jwt);
  if (!kisi) return json({ ok: false, sebep: 'Oturum dogrulanamadi' }, 401);

  const adres = new URL(istek.url);
  if (adres.searchParams.get('kes') === '1') {
    await rest(`/youtube_hesaplari?user_id=eq.${kisi.id}`, { method: 'DELETE' });
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
  const kanal = await kanalBilgisi(String(jeton.access_token));

  await rest('/youtube_hesaplari?on_conflict=user_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    govde: [{
      user_id:         kisi.id,
      kanal_id:        kanal.id,
      kanal_adi:       kanal.ad,
      erisim_jetonu:   String(jeton.access_token),
      erisim_bitis:    new Date(simdi + Number(jeton.expires_in ?? 3600) * 1000).toISOString(),
      yenileme_jetonu: String(jeton.refresh_token),
      kapsamlar:       String(jeton.scope ?? '').split(/\s+/).filter(Boolean),
      guncelleme:      new Date(simdi).toISOString(),
      son_hata:        null,
      son_hata_zamani: null
    }]
  });

  // ⛔ Cevapta jeton YOK.
  return json({ ok: true, bagli: true, kanal_adi: kanal.ad });
});
