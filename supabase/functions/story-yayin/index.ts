// Shootboard otomatik story yayını — worker (Supabase Edge Function).
//
// Şartname: "Shootboard Otomatik Story Yayını · Meta Graph API v21.0",
// Bölüm 3 (token sağlığı), 4 (zamanlayıcı), 5 (Instagram yayını),
// 7 (kota), 8 (tekrarsızlık), 9 (hata yönetimi).
//
// Dakikada bir pg_cron tarafından çağrılıyor (sql/43). Kuyruktaki
// story'leri alır, Instagram'a yayınlar, sonucu kaydeder.
//
// ══════════════════════════════════════════════════════════════════
// ⛔ BU DOSYA `uploaded` ALANINA YAZMIYOR
// ══════════════════════════════════════════════════════════════════
// Şartname Bölüm 1. `uploaded` KULLANICININ işareti ("bunu portala
// yükledim"), `publish_state` SİSTEMİN durumu. Bu kural bir veri
// kaybından doğdu ve burada bir söz değil, bir yapı: worker
// calendar_events'i hiç UPDATE etmiyor. Yalnızca sql/41 ve sql/42'deki
// security definer fonksiyonlarını çağırıyor ve o fonksiyonlar
// uploaded'a erişmiyor -- erişemiyor. İyi niyete bırakılan bir kural
// bir gün birinin ekleyeceği tek satırla bozulur; erişilemeyen bir
// sütun bozulmaz.
//
// ══════════════════════════════════════════════════════════════════
// GİZLİ AYARLAR  (Supabase → Edge Functions → Secrets)
// ══════════════════════════════════════════════════════════════════
//   STORY_WORKER_SECRET   pg_cron'un x-webhook-secret başlığında
//                         yolladığı uzun rastgele metin. Uyuşmazsa
//                         istek reddedilir. Bu uç JWT doğrulamıyor
//                         (cron kullanıcı oturumu taşımaz).
//   META_PAGE_TOKEN       Süresiz sayfa token'ı (Bölüm 3, 3. adım)
//   META_IG_USER_ID       Instagram iş hesabının Graph kimliği
//   META_PAGE_ID          Facebook sayfasının kimliği (sayfa story'si için)
//   META_APP_ID           /debug_token için (token sağlık işi)
//   META_APP_SECRET       /debug_token için
//   RESEND_API_KEY        Bildirim e-postası (Bölüm 9: sessiz
//                         başarısızlık YASAK)
//   MAIL_FROM             isteğe bağlı
//   APP_URL               isteğe bağlı
//   STORY_BILDIRIM_EPOSTA isteğe bağlı; token uyarısı için. Boşsa
//                         kuyrukta kaydı olan hesabın e-postası.
//   GRAF_TABANI           isteğe bağlı; testte sahte Graph adresi
//   STORY_BUTCE_MS        isteğe bağlı; tek çağrının süre bütçesi
//   STORY_YOKLAMA_MS      isteğe bağlı; konteyner yoklama aralığı
//
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından
// otomatik veriliyor, elle tanımlanmıyor.
//
// Dağıtım:  supabase functions deploy story-yayin --no-verify-jwt

const SURUM = '1.5.0';
const UCLAR = ['GET / (servis bilgisi)', 'POST / (bir tur)'];

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SERVIS         = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WORKER_SECRET  = Deno.env.get('STORY_WORKER_SECRET') ?? '';
const PAGE_TOKEN     = Deno.env.get('META_PAGE_TOKEN') ?? '';
const IG_USER_ID     = Deno.env.get('META_IG_USER_ID') ?? '';
const pageId         = () => Deno.env.get('META_PAGE_ID') ?? '';
const APP_ID         = Deno.env.get('META_APP_ID') ?? '';
const APP_SECRET     = Deno.env.get('META_APP_SECRET') ?? '';
const RESEND_KEY     = Deno.env.get('RESEND_API_KEY') ?? '';
const MAIL_FROM      = Deno.env.get('MAIL_FROM') ?? 'Shootboard <hello@shootboard.app>';
const APP_URL        = Deno.env.get('APP_URL') ?? 'https://shootboard.app/app.html';
const BILDIRIM_EPOSTA = Deno.env.get('STORY_BILDIRIM_EPOSTA') ?? '';
const GRAF_TABANI    = Deno.env.get('GRAF_TABANI') ?? 'https://graph.facebook.com/v21.0';

const sayi = (ad: string, varsayilan: number) => {
  const n = Number(Deno.env.get(ad) ?? '');
  return Number.isFinite(n) && n > 0 ? n : varsayilan;
};
// Edge Function'ın kendi duvar saati sınırının altında kalan bir bütçe.
// Bütçe dolunca iş YARIDA BIRAKILMIYOR, ertelenip bir sonraki tura
// devrediliyor -- iz satırda durduğu için kaldığı yerden devam ediyor.
const butceMs    = () => sayi('STORY_BUTCE_MS', 110_000);
const YOKLAMA_MS = sayi('STORY_YOKLAMA_MS', 5_000);
// Bölüm 5: "Üst sınır koy: 120 saniye sonra başarısız say."
const KONTEYNER_TAVANI_MS = 120_000;
// REELS AYRI BİR TAVAN İSTİYOR. Story genelde 15 saniyelik bir klip;
// reel 60-90 saniye olabiliyor ve Instagram'ın işlemesi dakikalar
// sürüyor. 120 saniyeyi reels'e de uygulamak, hazır olmak üzere olan
// her videoyu "hazır olmadı" diye düşürmek demekti.
//
// Bu tavan turun bütçesinden BAĞIMSIZ: bütçe dolunca kayıt erteleniyor
// ve bir sonraki tur AYNI konteyneri kaldığı yerden yokluyor (aşağıda,
// 'butce-bitti'). Yani on dakika beklemek on dakika meşgul olmak
// değil; yalnızca konteyneri düşürmeden önce tanınan süre.
const REELS_KONTEYNER_TAVANI_MS = 10 * 60 * 1000;
// Bir turda en fazla kaç kayıt. Bölüm 4'teki LIMIT 10 kuyruk sorgusu
// için; burada süre bütçesi zaten sınırlıyor, düşük tutmak gecikmeyi
// azaltıyor.
const TUR_BASINA = 5;
// Token sağlığı her turda sorulmuyor: dakikada bir çağrı × günde 1440.
const TOKEN_KONTROL_ARALIGI_MS = 6 * 60 * 60 * 1000;
const UYARI_ARALIGI_MS = 24 * 60 * 60 * 1000;

function json(govde: unknown, durum = 200): Response {
  return new Response(JSON.stringify(govde), {
    status: durum, headers: { 'Content-Type': 'application/json' }
  });
}
const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));
// Zamanın TEK kaynağı. `new Date()` ile `Date.now()` iki ayrı okuma:
// testte saat sabitlendiğinde ikisi birbirini tutmuyor ve "6 saatte bir
// kontrol et" gibi kararlar sessizce her turda tetikleniyordu. Üretimde
// fark etmiyor; farkı olmayan şeyi iki türlü yazmanın da anlamı yok.
const simdi = () => new Date(Date.now()).toISOString();

// ══════════════════════════════════════════════════════════════════
// TOKEN HİÇBİR YERE SIZMASIN
// ══════════════════════════════════════════════════════════════════
// Şartname Bölüm 3: "Log'a asla düşmez, hata mesajına asla girmez."
// Graph bazen hatalı isteği olduğu gibi geri yazıyor ve o metin
// last_error'a, oradan da bildirim e-postasına gidiyor. Buradan geçen
// her metin önce temizleniyor.
function temizle(metin: string): string {
  let s = String(metin ?? '');
  for (const gizli of [PAGE_TOKEN, APP_SECRET, SERVIS]) {
    if (gizli && gizli.length > 8) s = s.split(gizli).join('***');
  }
  // access_token=... biçimindeki her şey, değeri tanımasak bile.
  return s.replace(/access_token=[^&\s"']+/gi, 'access_token=***');
}

// ---- Supabase --------------------------------------------------------------
async function rest(yol: string, secenek: { method?: string; govde?: unknown; prefer?: string } = {}) {
  const h = new Headers({
    'apikey': SERVIS, 'Authorization': `Bearer ${SERVIS}`, 'Content-Type': 'application/json'
  });
  if (secenek.prefer) h.set('Prefer', secenek.prefer);
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
// Durum geçişleri YALNIZCA bu fonksiyonlarla yapılıyor (yukarıdaki ⛔).
const rpc = (ad: string, args: Record<string, unknown>) =>
  rest(`/rpc/${ad}`, { method: 'POST', govde: args });

async function durumOku(anahtar: string): Promise<any> {
  const satir = await rest(`/sistem_durumu?anahtar=eq.${encodeURIComponent(anahtar)}&select=veri`);
  return (Array.isArray(satir) && satir[0]?.veri) || {};
}
async function durumYaz(anahtar: string, veri: unknown) {
  await rest('/sistem_durumu', {
    method: 'POST', govde: [{ anahtar, veri, updated_at: simdi() }],
    prefer: 'resolution=merge-duplicates'
  });
}

// ---- Graph API -------------------------------------------------------------
class GrafHata extends Error {
  kod: number | null; altKod: number | null; durum: number;
  constructor(durum: number, kod: number | null, altKod: number | null, mesaj: string) {
    super(temizle(mesaj));
    this.durum = durum; this.kod = kod; this.altKod = altKod;
  }
}
// Ağ hatası da GrafHata'ya çevriliyor: sınıflandırma tek yerde olsun.
async function graf(yol: string, secenek: { method?: string; alan?: Record<string, string> } = {}) {
  const alan = { ...(secenek.alan || {}), access_token: PAGE_TOKEN };
  const adres = new URL(GRAF_TABANI.replace(/\/+$/, '') + yol);
  let govde: string | undefined;
  if ((secenek.method || 'GET') === 'GET') {
    for (const [k, v] of Object.entries(alan)) adres.searchParams.set(k, v);
  } else {
    govde = new URLSearchParams(alan).toString();
  }
  let r: Response;
  try {
    r = await fetch(adres.toString(), {
      method: secenek.method || 'GET', body: govde,
      headers: govde === undefined ? undefined : { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  } catch (e) {
    // Ağ kesintisi: geçici sayılıyor (Bölüm 9, "timeout / 5xx").
    throw new GrafHata(0, null, null, 'ağa ulaşılamadı: ' + (e as Error).message);
  }
  const metin = await r.text();
  let veri: any = null;
  try { veri = metin ? JSON.parse(metin) : null; } catch { veri = { ham: metin }; }
  if (!r.ok || veri?.error) {
    const h = veri?.error || {};
    throw new GrafHata(r.status, h.code ?? null, h.error_subcode ?? null,
      h.message || `HTTP ${r.status}`);
  }
  return veri;
}

// ══════════════════════════════════════════════════════════════════
// HATA SINIFLANDIRMASI — Bölüm 9
// ══════════════════════════════════════════════════════════════════
// Üç kova var ve farkları önemli:
//   'kalici'  → hemen 'failed', bildirim. Tekrar denemek işe yaramaz.
//   'gecici'  → tekrar dene, deneme hakkı harcanır (1dk→5dk→15dk).
//   'kota'    → tekrar dene ama DENEME HAKKI HARCANMAZ. Bu bir hata
//               değil, bir bekleme; üç kez kota dolu olan bir kayıt
//               denemelerini tüketip 'failed' olmamalı.
type Kova = 'kalici' | 'gecici' | 'kota';
function siniflandir(e: unknown): { kova: Kova; mesaj: string } {
  if (!(e instanceof GrafHata)) return { kova: 'gecici', mesaj: temizle(String((e as Error)?.message ?? e)) };
  const mesaj = `#${e.kod ?? '?'}${e.altKod ? '/' + e.altKod : ''} ${e.message}`;
  // Kota ve hız sınırı.
  if (e.kod === 4 || e.kod === 17 || e.kod === 32 || e.kod === 341 || e.kod === 613) {
    return { kova: 'kota', mesaj };
  }
  // Token, izin, geçersiz parametre: kurulum sorunu, tekrar denemek
  // aynı sonucu verir.
  if (e.kod === 190 || e.kod === 200 || e.kod === 100 || e.kod === 10 || e.kod === 3 || e.kod === 803) {
    return { kova: 'kalici', mesaj };
  }
  // 2207xxx alt kodları medya formatı reddi (Bölüm 9: "medya formatı
  // reddedildi → kalıcı"). Render'ı düzeltmeden tekrar denemek boşuna.
  if (e.altKod && e.altKod >= 2207000 && e.altKod < 2208000) return { kova: 'kalici', mesaj };
  // #2 geçici sunucu, 5xx, ağ: tekrar dene.
  return { kova: 'gecici', mesaj };
}

// ---- bildirim --------------------------------------------------------------
// Bölüm 9: "⛔ SESSİZ BAŞARISIZLIK YASAK." Story 24 saatlik; kaçan gün
// geri gelmez. E-posta gidemiyorsa bile log'a düşüyor.
async function epostaGonder(alici: string, konu: string, govde: string) {
  if (!RESEND_KEY || !alici) {
    console.warn('[story] bildirim GÖNDERİLEMEDİ (RESEND_API_KEY ya da alıcı yok):', konu);
    return false;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [alici], subject: konu, text: govde })
  });
  if (!r.ok) { console.error('[story] Resend', r.status, temizle(await r.text())); return false; }
  return true;
}
// auth.users PostgREST'e açık değil; Admin API'den okunuyor.
async function hesapEpostasi(uid: string): Promise<string> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
      headers: { 'apikey': SERVIS, 'Authorization': `Bearer ${SERVIS}` }
    });
    if (!r.ok) return '';
    const u = await r.json();
    return String(u?.email ?? '');
  } catch { return ''; }
}

// ══════════════════════════════════════════════════════════════════
// TOKEN SAĞLIĞI — Bölüm 3
// ══════════════════════════════════════════════════════════════════
// "Bu olmazsa sistem 60. günde sessizce durur ve kimse fark etmez."
//
// Kontrol turun BAŞINDA, kuyruk ALINMADAN önce yapılıyor. Sebebi
// Bölüm 3 ile Bölüm 9 arasındaki gerilim: Bölüm 9 #190'ı kalıcı hata
// sayıyor, ama token süresi dolduğunda kuyruktaki HER kayıt #190 alır
// ve hepsi tek turda 'failed' olur. Bölüm 3 ise "autoPublish'li tüm
// kayıtlar beklemeye alınır" diyor. İkisi ancak şöyle uzlaşıyor:
// token ölüyse kuyruk HİÇ ALINMIYOR. Kayıtlar 'pending' kalıyor,
// deneme hakları duruyor, kullanıcı uyarılıyor. Token yenilenince
// kaldıkları yerden devam ediyorlar. Yayın sırasında gelen bir #190
// hâlâ kalıcı -- orada token geçerli ama başka bir şey eksik demektir.
async function tokenSagligi(zorla = false): Promise<{ gecerli: boolean; sebep: string }> {
  if (!PAGE_TOKEN) return { gecerli: false, sebep: 'META_PAGE_TOKEN tanımlı değil' };
  // Uygulama kimliği yoksa sorgulanamıyor. Yayını ENGELLEMİYOR:
  // eksik bir teşhis aracı yüzünden story kaçırmak daha kötü.
  if (!APP_ID || !APP_SECRET) {
    console.warn('[story] META_APP_ID/META_APP_SECRET yok — token sağlık kontrolü yapılamıyor');
    return { gecerli: true, sebep: '' };
  }
  const durum = await durumOku('meta_token');
  const son = Date.parse(durum.son_kontrol ?? '') || 0;
  if (!zorla && Date.now() - son < TOKEN_KONTROL_ARALIGI_MS) {
    return { gecerli: durum.gecerli !== false, sebep: durum.sebep ?? '' };
  }

  let veri: any;
  try {
    const adres = new URL(GRAF_TABANI.replace(/\/+$/, '') + '/debug_token');
    adres.searchParams.set('input_token', PAGE_TOKEN);
    adres.searchParams.set('access_token', `${APP_ID}|${APP_SECRET}`);
    const r = await fetch(adres.toString());
    veri = await r.json();
  } catch (e) {
    // Kontrol edilemedi ≠ token bozuk. Eski sonuç korunuyor.
    console.warn('[story] debug_token okunamadı:', temizle((e as Error).message));
    return { gecerli: durum.gecerli !== false, sebep: durum.sebep ?? '' };
  }

  const d = veri?.data ?? {};
  const gecerli = d.is_valid === true;
  // Sayfa token'ı süresiz: expires_at 0 geliyor. 0'ı "bugün doluyor"
  // sanmamak gerekiyor.
  const bitis = Number(d.expires_at ?? 0) * 1000;
  const yakin = bitis > 0 && bitis - Date.now() < 7 * 24 * 60 * 60 * 1000;
  const sebep = gecerli ? '' : temizle(String(veri?.data?.error?.message ?? 'token geçersiz'));

  const yeni: any = { ...durum, son_kontrol: simdi(), gecerli, sebep, expires_at: d.expires_at ?? 0 };

  const tur = !gecerli ? 'gecersiz' : yakin ? 'yaklasiyor' : '';
  if (tur) {
    const sonUyari = Date.parse(durum.son_uyari ?? '') || 0;
    const ayniTur = durum.son_uyari_tur === tur;
    // Aynı uyarı günde birden fazla gitmiyor; TÜR DEĞİŞİRSE hemen
    // gidiyor ("yaklaşıyor" iken "geçersiz" olduysa beklemek olmaz.)
    if (!ayniTur || Date.now() - sonUyari > UYARI_ARALIGI_MS) {
      const alici = BILDIRIM_EPOSTA || await kuyrukSahibiEpostasi();
      const ok = await epostaGonder(alici,
        tur === 'gecersiz' ? 'Shootboard · Instagram bağlantısı koptu' : 'Shootboard · Instagram token süresi doluyor',
        tur === 'gecersiz'
          ? 'Instagram erişim token\'ı geçersiz.\n\n'
            + 'Otomatik story yayını DURDURULDU. Bekleyen kayıtlar silinmedi, '
            + 'başarısız da sayılmadı: token yenilenince kaldıkları yerden yayınlanacaklar.\n\n'
            + (sebep ? 'Meta\'nın söylediği: ' + sebep + '\n\n' : '')
            + 'Yapılacak: Meta uygulamasından yeni bir sayfa token\'ı alıp '
            + 'META_PAGE_TOKEN gizli ayarını güncelle.\n'
          : 'Instagram erişim token\'ının süresi 7 günden az kaldı.\n\n'
            + 'Bitiş: ' + (bitis ? new Date(bitis).toISOString() : 'bilinmiyor') + '\n\n'
            + 'Süre dolduğunda otomatik story yayını durur. Şimdi yenilersen kesinti olmaz.\n');
      if (ok) { yeni.son_uyari = simdi(); yeni.son_uyari_tur = tur; }
    }
  } else {
    yeni.son_uyari = null; yeni.son_uyari_tur = null;
  }
  await durumYaz('meta_token', yeni);
  return { gecerli, sebep };
}

// Token uyarısı kuyruk alınmadan gidiyor, yani elde kayıt yok.
// Uyarılacak kişi: otomatik yayını açık olan hesap.
async function kuyrukSahibiEpostasi(): Promise<string> {
  try {
    const satir = await rest('/calendar_events?type=eq.story&auto_publish=is.true&deleted_at=is.null&select=user_id&limit=1');
    const uid = Array.isArray(satir) && satir[0]?.user_id;
    return uid ? await hesapEpostasi(uid) : '';
  } catch { return ''; }
}

// ══════════════════════════════════════════════════════════════════
// KOTA — Bölüm 7
// ══════════════════════════════════════════════════════════════════
// "HER YAYINDAN ÖNCE OKU." Reels ve story aynı kovadan sayılıyor.
async function kotaDolu(): Promise<{ dolu: boolean; not: string }> {
  try {
    const veri = await graf(`/${IG_USER_ID}/content_publishing_limit`, { alan: { fields: 'config,quota_usage' } });
    const d = (veri?.data && veri.data[0]) || veri || {};
    const toplam = Number(d?.config?.quota_total ?? 25);
    const kullanim = Number(d?.quota_usage ?? 0);
    // "quota_usage >= quota_total - 1 → YAYINLAMA". Bir kişilik pay
    // bırakılıyor: sınıra tam oturmak Meta tarafında yarış yaratıyor.
    if (kullanim >= toplam - 1) return { dolu: true, not: `kota ${kullanim}/${toplam}` };
    return { dolu: false, not: `kota ${kullanim}/${toplam}` };
  } catch (e) {
    const { kova, mesaj } = siniflandir(e);
    // Token/izin sorunuysa yayın da patlayacak, çağıran sınıflandırsın.
    if (kova === 'kalici') throw e;
    // Geçici bir aksaklık yüzünden 24 saatlik bir story kaçırmak
    // olmaz: yayına devam ediliyor. Kota gerçekten doluysa yayın
    // çağrısı #4/#17/#32 döndürür ve o zaten erteleme kovasında.
    console.warn('[story] kota okunamadı, yayına devam:', mesaj);
    return { dolu: false, not: 'kota okunamadı' };
  }
}

// ══════════════════════════════════════════════════════════════════
// ÇÖKÜŞ SONRASI KURTARMA — Bölüm 8, üçüncü katman
// ══════════════════════════════════════════════════════════════════
// Bölüm 11'in 10. maddesi: "Worker'ı yayın çağrısının ortasında öldür
// → çift yayın var mı". Öldürülen worker kaydı 'in_progress' bırakır;
// bir sonraki tur onu tekrar alır. publish_called_at doluysa yayın
// çağrısı YAPILMIŞTI ve sonucu bilinmiyor.
//
// Tek doğru kaynak Instagram'ın kendisi: /stories son 24 saatin
// yayındaki story'lerini veriyor ve biz dakikalar içindeyiz. Çağrının
// yapıldığı andan itibaren (küçük bir pay ile) bir story varsa, o
// bizim story'mizdir.
//
// Sorgulanamıyorsa YAYINLANMIYOR. Bilmemek, ikinci kez yayınlamaktan
// iyidir: çift story geri alınamaz, gecikmiş story alınabilir.
async function cikmisMi(k: any, cagriAni: string): Promise<{ biliniyor: boolean; id: string }> {
  const pf = String(k.platform || 'instagram');
  const reel = reelMi(k);
  // Her platformun VE her türün kendi listesi var. Yanlış listeye
  // bakmak "çıkmamış" cevabı üretir ve o cevap yeniden yayın demek:
  // bir reel story listesinde asla görünmez.
  const uc = pf === 'facebook'
    ? (reel ? `/${pageId()}/video_reels` : `/${pageId()}/stories`)
    : (reel ? `/${IG_USER_ID}/media`     : `/${IG_USER_ID}/stories`);
  const alan  = pf === 'facebook' ? 'id,creation_time' : 'id,timestamp';
  let veri: any;
  try {
    veri = await graf(uc, { alan: { fields: alan } });
  } catch (e) {
    // SORULAMADI ≠ ÇIKMADI. Ayrımı korumak şart: "çıkmadı" sayarsak
    // tekrar yayınlarız ve çift story geri alınamaz.
    console.warn('[story]', uc, 'okunamadı:', siniflandir(e).mesaj);
    return { biliniyor: false, id: '' };
  }
  const an = Date.parse(cagriAni) || 0;
  if (!an) return { biliniyor: false, id: '' };
  // Saat farkı ve Meta'nın kendi damgası için iki dakikalık pay.
  const esik = an - 120_000;
  for (const m of (veri?.data ?? [])) {
    // creation_time saniye de gelebiliyor, ISO da.
    const ham = m?.timestamp ?? m?.creation_time ?? '';
    const t = typeof ham === 'number' ? ham * 1000 : Date.parse(String(ham));
    if (t && t >= esik) return { biliniyor: true, id: String(m.id) };
  }
  // ⚠ REELS'TE BOŞ LİSTE "ÇIKMADI" DEMEK DEĞİL — HENÜZ.
  // Story 24 saatlik ve /stories anında güncelleniyor; yeni çıkmış bir
  // story listede olmak zorunda. /media için aynı kesinlik yok: yeni
  // yayınlanan bir reel listeye birkaç saniye geç düşebiliyor.
  //
  // Asimetri burada karar veriyor. Yanlış "çıkmadı" cevabı YENİDEN
  // YAYIN demek ve bir reel profilde KALICI duruyor -- elle silmek
  // gerekir. Yanlış "bilmiyorum" cevabı ise yalnızca beş dakika
  // gecikme. O yüzden çağrının üstünden iki dakika geçmediyse boş
  // liste "bilmiyorum" sayılıyor; sonraki denemede /media çoktan
  // güncellenmiş olur.
  if (reel && Date.now() - an < 120_000) {
    console.warn('[story]', uc, 'boş döndü ama çağrı henüz taze — emin değiliz');
    return { biliniyor: false, id: '' };
  }
  // Liste geldi ve o pencerede hiçbir şey yok: çıkmamış.
  return { biliniyor: true, id: '' };
}

// Graph'a FormData ile POST. Fotoğraf yüklemede alanlar arasında url
// var ve graf()'ın urlencoded gövdesi bunun için yeterli olsa da,
// Meta'nın /photos ucu multipart bekliyor.
async function grafFormla(yol: string, govde: FormData) {
  const adres = GRAF_TABANI.replace(/\/+$/, '') + yol;
  let r: Response;
  try {
    r = await fetch(adres, { method: 'POST', body: govde });
  } catch (e) {
    throw new GrafHata(0, null, null, 'ağa ulaşılamadı: ' + (e as Error).message);
  }
  const metin = await r.text();
  let veri: any = null;
  try { veri = metin ? JSON.parse(metin) : null; } catch { veri = { ham: metin }; }
  if (!r.ok || veri?.error) {
    const h = veri?.error || {};
    throw new GrafHata(r.status, h.code ?? null, h.error_subcode ?? null, h.message || `HTTP ${r.status}`);
  }
  return veri;
}

// Konteyner izini sil. story_iz_konteyner'a boş kimlik vermek "artık
// böyle bir konteyner yok" demek; publish_called_at da sıfırlanıyor.
// Bunu ayrı bir fonksiyon yapmak kasıtlı: izi temizlemeyi unutmak
// sessiz bir tuzak ve bir kez kurulmuştu.
const izTemizle = (id: string) => rpc('story_iz_konteyner', { p_id: id, p_ref: null });

// ══════════════════════════════════════════════════════════════════
// TÜR: STORY MÜ REELS Mİ — Bölüm 5b
// ══════════════════════════════════════════════════════════════════
// Kuyruk sql/50'den beri `type` döndürüyor. Alan YOKSA story sayılıyor
// ve bu bilinçli: worker sql/50 çalıştırılmadan önce de yayında
// olabilir, o zaman kuyruk `type` vermez ve gelen her kayıt zaten
// story'dir. Yani eksik alan, yanlış davranış değil ESKİ davranış.
const reelMi = (k: any) => String(k?.type ?? 'story') === 'reels';
// Kullanıcıya gösterilecek kelime. Bildirim ve hata metinleri "story"
// diyordu; bir reel için yanlış olurdu.
const turAdi = (k: any) => (reelMi(k) ? 'reel' : 'story');

// Reels alt yazısı kaydın kendi içeriğinden geliyor -- Shootboard'da
// zaten yazılmış olan metin. Instagram sınırı 2200 karakter; fazlası
// konteyneri reddettiriyor, o yüzden BURADA kırpılıyor: yayın anında
// öğrenmek, kayıt anında öğrenmekten pahalı.
function altYazi(k: any): string {
  const c = (k?.content && typeof k.content === 'object') ? k.content : {};
  return String(c.caption ?? '').slice(0, 2200);
}
// Reel hem Reels sekmesinde hem profil akışında görünsün mü?
// VARSAYILAN AÇIK: üreticilerin çoğu ikisini de istiyor ve kapalı bir
// varsayılan "reel'im akışta yok" diye fark edilmeyen bir kayıp olurdu.
// Kayıt bazında kapatılabiliyor (content.shareToFeed === false).
const paylasimAkista = (k: any) =>
  !(k?.content && typeof k.content === 'object' && k.content.shareToFeed === false);

// ⚠ INSTAGRAM KONTEYNERİNİN ALANLARI — TEK YERDE.
// Bu alanlar İKİ yerden yaratılıyor: sıradan yayın (instagramYayinla)
// ve turun başındaki önden yaratma (konteynerleriHazirla). Ayrı ayrı
// yazılsalardı biri reels'i öğrenir, öteki story sanmaya devam ederdi
// -- ve önden yaratılan konteyner yayında KULLANILDIĞI için kazanan
// yanlış olan olurdu. Bu depoda "aynı liste iki yerde" hatası birkaç
// kez yaşandı; burada baştan tek kopya.
function igKonteynerAlanlari(k: any): Record<string, string> {
  const video = String(k.media_mime ?? '').startsWith('video/');
  if (!reelMi(k)) {
    const alan: Record<string, string> = { media_type: 'STORIES' };
    alan[video ? 'video_url' : 'image_url'] = String(k.media_url);
    return alan;
  }
  // REELS her zaman video. (Fotoğraf gelirse yayın yoluna hiç
  // girmiyor; kontrol instagramYayinla'nın başında.)
  const alan: Record<string, string> = {
    media_type: 'REELS',
    video_url: String(k.media_url),
    share_to_feed: paylasimAkista(k) ? 'true' : 'false'
  };
  const yazi = altYazi(k);
  if (yazi) alan.caption = yazi;
  // KAPAK İSTEĞE BAĞLI. Yoksa alan hiç gönderilmiyor ve Instagram
  // videodan kendi karesini seçiyor. Kapaksız çıkan bir reel,
  // çıkmayan bir reel'den iyidir.
  if (k.cover_url) alan.cover_url = String(k.cover_url);
  return alan;
}

// ══════════════════════════════════════════════════════════════════
// TEK KAYDIN YAYINI — Bölüm 5
// ══════════════════════════════════════════════════════════════════
// Yayınlayabildiğimiz platformlar. İkisi TAMAMEN FARKLI akışlar ve
// şartname Bölüm 6 bunları ortaklaştırmamayı özellikle söylüyor:
// Instagram dosyayı adresten ÇEKİYOR, Facebook dosyayı bize
// YÜKLETİYOR. Ortak olan yalnızca ön kontroller ve çöküş izi.
const YAYINLANABILIR = ['instagram', 'facebook'];

async function kaydiYayinla(k: any, bitis: number): Promise<string> {
  // ⚠ PLATFORM, HER ŞEYDEN ÖNCE.
  // Shootboard'da her sosyal medya AYRI kayıt. Kuyruk `type = 'story'`
  // süzüyor, platform süzmüyor -- yani hangi platforma gideceğini
  // burada okumak zorundayız. Bu kontrol olmasaydı Facebook için
  // planlanmış bir kayıt Instagram'a yayınlanırdı ve hiçbir yerde hata
  // görünmezdi.
  const pf = String(k.platform || 'instagram');
  if (!YAYINLANABILIR.includes(pf)) {
    // Hata değil ERTELEME: kayıt bozuk değil, o platform henüz yok.
    // Deneme hakkı harcanmıyor; desteği geldiği gün elle hiçbir şey
    // yapılmadan yayınlanmaya başlıyor.
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: `${pf} yayını henüz kurulmadı; kayıt bekliyor. Şimdilik elle yayınla.` });
    return 'platform-desteklenmiyor';
  }
  if (pf === 'facebook' && !pageId()) {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: 'META_PAGE_ID tanımlı değil; Facebook yayını yapılamıyor.' });
    return 'yapilandirma-eksik';
  }
  // Katman 2: external_id dolu ise bu kayıt zaten yayınlanmış.
  if (k.external_id) {
    await rpc('story_yayinlandi', { p_id: k.id, p_external_id: k.external_id });
    return 'zaten-yayinda';
  }
  if (!k.media_url) {
    await kaliciHata(k, 'Medya bağlı değil: mediaUrl boş.');
    return 'medyasiz';
  }

  // ---- Katman 3: çöküş izi -------------------------------------------------
  // publish_called_at DOLU ise yayın çağrısı yapıldı ve sonucu bilinmiyor.
  if (k.publish_ref && k.publish_called_at) {
    const { biliniyor, id } = await cikmisMi(k, k.publish_called_at);
    if (!biliniyor) {
      await rpc('story_ertele', { p_id: k.id, p_dakika: 5,
        p_sebep: `Yayın çağrısının sonucu bilinmiyor; ${pf} sorulamadı. Çift yayın olmasın diye bekleniyor.` });
      return 'kurtarma-belirsiz';
    }
    if (id) {
      await rpc('story_yayinlandi', { p_id: k.id, p_external_id: id });
      return 'kurtarildi-yayinda';
    }
    console.log('[story]', k.id, 'yayın çağrısı sonuçsuz kalmış, çıkmamış — tekrar yayınlanıyor');
  }

  // ---- Seri: önceki parça çıkmadan bu parça çıkmaz (sql/48) ----------------
  // Çok parçalı story'ler birbirini takip ediyor. 1/2 hiç çıkmazsa
  // 2/2'nin tek başına çıkması, hiç çıkmamasından kötü: izleyici
  // eksik olanı değil, ANLAMSIZ olanı görüyor.
  //
  // Seriyi dosya adı söylüyor: <kök>_k<N>.<uzantı>. Aynı kök + aynı
  // platform = aynı seri. Ayrıntı ve sınırlar sql/48'in başında.
  const seri = await seriOncekiParca(k.id);
  if (seri) {
    if (seri.durum === 'basarisiz') {
      // Kalıcı: önceki parça 'failed' olmuş, kendiliğinden düzelmez.
      // kaliciHata bildirimi de gönderiyor -- kullanıcı ikisini de
      // elle yayınlamak isteyebilir, story 24 saatlik.
      await kaliciHata(k, `Önceki parça yayınlanamadı (${seri.parca}); `
        + `bu parça tek başına yayınlanmadı.`);
      return 'seri-kirildi';
    }
    // Geçici: önceki parça henüz çıkmadı (kota, tekrar denemesi,
    // sırası gelmedi). HATA DEĞİL -- ertelemede deneme hakkı geri
    // veriliyor, yoksa bekleyen parça üç turda hakkını tüketirdi.
    await rpc('story_ertele', { p_id: k.id, p_dakika: 1,
      p_sebep: `Önceki parça (${seri.parca}) henüz yayınlanmadı; sırası bekleniyor.` });
    return 'seri-bekliyor';
  }

  return pf === 'facebook'
    ? await facebookYayinla(k)
    : await instagramYayinla(k, bitis);
}

// Önünde duran, henüz yayınlanmamış parça. sql/48 çalıştırılmamışsa
// fonksiyon yoktur: tur DURMUYOR, koruma o tur çalışmıyor. Sessiz
// kalmıyor ama -- günlüğe düşüyor, çünkü "koruma var sanıp korumasız
// yayınlamak" en kötü ihtimal.
async function seriOncekiParca(id: string): Promise<{ durum: string; parca: string } | null> {
  try {
    const y = await rpc('story_seri_onceki', { p_id: id });
    const s = Array.isArray(y) ? y[0] : y;
    return s && s.durum ? { durum: String(s.durum), parca: String(s.parca ?? '') } : null;
  } catch (e) {
    console.warn('[story] seri kontrolü yapılamadı (sql/48 çalıştırıldı mı?):',
      temizle((e as Error).message));
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
// INSTAGRAM — Bölüm 5
// ══════════════════════════════════════════════════════════════════
// İki adımlı: konteyner yarat, hazır olunca yayınla. Dosyayı Instagram
// KENDİSİ çekiyor, biz yalnızca adresi veriyoruz.
async function instagramYayinla(k: any, bitis: number): Promise<string> {
  // ---- Kota (Bölüm 7) — yalnızca Instagram ---------------------------------
  // Facebook sayfa story'sinin ayrı kotası var ve şartname "pratikte
  // sorun çıkarmıyor" diyor; content_publishing_limit ucu da IG hesabına
  // ait, sayfaya değil.
  const kota = await kotaDolu();
  if (kota.dolu) {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 60, p_sebep: kota.not + ' — dolu, bir saat sonra tekrar denenecek.' });
    return 'kota-ertelendi';
  }

  // ---- Reels VİDEO olmak zorunda -------------------------------------------
  // Kalıcı hata: fotoğrafı reel yapmanın yolu yok ve tekrar denemek
  // dosyayı videoya çevirmiyor.
  if (reelMi(k) && !String(k.media_mime ?? '').startsWith('video/')) {
    await kaliciHata(k, `Reels yalnızca video olabilir; bağlı dosya ${k.media_mime || 'bilinmeyen tür'}.`);
    return 'reels-video-degil';
  }

  // ---- Adım 1: konteyner ---------------------------------------------------
  let konteyner: string = k.publish_ref || '';
  // Konteynerin yaşı NEREDEN sayılıyor: elde hazır bir konteyner varsa
  // sql/42'deki publish_ref_at damgasından, yenisi yaratılıyorsa
  // şimdiden. Şartnamedeki "120 saniye" sınırı ancak böyle anlamlı:
  // süre bellekte tutulsaydı worker her kesildiğinde sıfırlanır ve
  // tavan hiç dolmazdı.
  let refAn = Date.parse(k.publish_ref_at ?? '') || 0;
  if (!konteyner) {
    const y = await graf(`/${IG_USER_ID}/media`, { method: 'POST', alan: igKonteynerAlanlari(k) });
    konteyner = String(y?.id ?? '');
    if (!konteyner) throw new GrafHata(0, null, null, 'konteyner kimliği dönmedi');
    await rpc('story_iz_konteyner', { p_id: k.id, p_ref: konteyner });
    refAn = Date.now();
  }
  if (!refAn) refAn = Date.now();
  // Tavan türe göre: reels'in işlenmesi dakikalar sürebiliyor.
  const konteynerSon = refAn + (reelMi(k) ? REELS_KONTEYNER_TAVANI_MS : KONTEYNER_TAVANI_MS);

  // ---- Adım 2: hazır olana kadar yokla ------------------------------------
  while (true) {
    const d = await graf(`/${konteyner}`, { alan: { fields: 'status_code,status' } });
    const kod = String(d?.status_code ?? '');
    if (kod === 'FINISHED') break;
    if (kod === 'ERROR') {
      // Bölüm 5: "ERROR → başarısız, status alanını lastError'a yaz."
      // Neredeyse her zaman medya sorunudur; tekrar denemek render'ı
      // düzeltmez ve kullanıcının elle yayınlama şansını da yer.
      await kaliciHata(k, 'Instagram medyayı işleyemedi: ' + temizle(String(d?.status ?? 'ERROR')));
      return 'medya-reddedildi';
    }
    if (kod === 'EXPIRED') {
      await izTemizle(k.id);
      await rpc('story_basarisiz', { p_id: k.id, p_hata: 'Konteyner süresi doldu, baştan denenecek.', p_kalici: false });
      return 'konteyner-dustu';
    }
    // Tavan mı doldu, tur bütçesi mi? İkisinin cevabı ZIT.
    if (Date.now() + YOKLAMA_MS >= konteynerSon) {
      // İZ TEMİZLENMEK ZORUNDA. Temizlenmezse bir sonraki deneme aynı
      // konteynerle başlar, yaşı zaten 120 saniyeyi aşmıştır ve anında
      // yine başarısız olur -- üç deneme birkaç dakikada tükenir.
      await izTemizle(k.id);
      const saniye = Math.round((reelMi(k) ? REELS_KONTEYNER_TAVANI_MS : KONTEYNER_TAVANI_MS) / 1000);
      await rpc('story_basarisiz', { p_id: k.id, p_hata: `Medya ${saniye} saniyede hazır olmadı.`, p_kalici: false });
      return 'konteyner-zaman-asimi';
    }
    if (Date.now() + YOKLAMA_MS >= bitis - 5_000) {
      // Tur bütçesi bitti, tavan dolmadı. HATA DEĞİL: erteleniyor,
      // deneme hakkı geri veriliyor, bir sonraki tur AYNI konteyneri
      // kaldığı yerden yokluyor.
      // p_dakika 0 = "bekleme yok, sıradaki turda al" (sql/47). 1
      // yazsaydık retry_after dakika ortasına düşer, bir sonraki turu
      // ıskalar ve "bir dakika" pratikte ikiye çıkardı.
      await rpc('story_ertele', { p_id: k.id, p_dakika: 0, p_sebep: 'Medya hâlâ işleniyor; bir sonraki turda devam.' });
      return 'butce-bitti';
    }
    await bekle(YOKLAMA_MS);
  }

  // ---- Adım 3: yayınla -----------------------------------------------------
  // ⚠ SIRA ÖNEMLİ. İz önce yazılıyor, yayın sonra çağrılıyor. Ters
  // olsaydı tam aradaki çöküş hiçbir iz bırakmaz ve üçüncü katman
  // (Bölüm 8) hiç çalışmazdı -- çift yayın kapısı orada açılır.
  await rpc('story_iz_yayin_cagrisi', { p_id: k.id });
  const y = await graf(`/${IG_USER_ID}/media_publish`, { method: 'POST', alan: { creation_id: konteyner } });
  await rpc('story_yayinlandi', { p_id: k.id, p_external_id: String(y?.id ?? '') });
  return 'yayinlandi';
}

// ══════════════════════════════════════════════════════════════════
// FACEBOOK SAYFA STORY'Sİ — Bölüm 6
// ══════════════════════════════════════════════════════════════════
// ⚠ Şartname: "TAMAMEN FARKLI BİR AKIŞ. Instagram koduyla
// ortaklaştırmaya çalışma." Haklı, çünkü fark tek satırlık değil:
//
//   Instagram  dosyayı ADRESTEN ÇEKİYOR    -> biz sadece url veriyoruz
//   Facebook   dosyayı BİZE YÜKLETİYOR     -> baytları biz taşıyoruz
//
// Yani Facebook yolunda dosya R2'den bu fonksiyonun içinden geçip
// Meta'ya gidiyor. Belleğe ALINMIYOR, akıtılıyor: 100 MB'lık bir
// videoyu Edge Function'ın belleğine koymak sınırı zorlar.
//
// VİDEO üç aşama: start -> upload -> finish
// FOTOĞRAF iki aşama: photos(published=false) -> photo_stories
//
// İZ NE TUTUYOR
//   publish_ref = video_id (ya da photo_id)
//   publish_called_at = YAYINLAYAN çağrıdan hemen önce
//                       (video'da finish, fotoğrafta photo_stories)
// Yükleme yayınlamıyor, o yüzden yükleme sırasındaki bir çöküş çift
// yayın üretemez. İz varken publish_called_at boşsa BAŞTAN başlıyoruz:
// hiçbir şey çıkmış olamaz ve yeni bir video_id almak, yarım kalmış
// bir yüklemeyi kurtarmaya çalışmaktan basit ve güvenli.
async function facebookYayinla(k: any): Promise<string> {
  const video = String(k.media_mime ?? '').startsWith('video/');
  if (reelMi(k) && !video) {
    await kaliciHata(k, `Reels yalnızca video olabilir; bağlı dosya ${k.media_mime || 'bilinmeyen tür'}.`);
    return 'reels-video-degil';
  }
  if (k.publish_ref && !k.publish_called_at) {
    console.log('[story]', k.id, 'yarım kalmış Facebook yüklemesi — baştan');
    await izTemizle(k.id);
  }

  // ---- Medyayı R2'den al ---------------------------------------------------
  let medya: Response;
  try {
    medya = await fetch(String(k.media_url));
  } catch (e) {
    throw new GrafHata(0, null, null, 'medya adresine ulaşılamadı: ' + (e as Error).message);
  }
  if (!medya.ok || !medya.body) {
    // Adres bozuksa bu kalıcı: dosya yerine gelene kadar tekrar denemek
    // üç hakkı tüketmekten başka işe yaramaz.
    await kaliciHata(k, `Medya adresi ${medya.status} döndürdü; Facebook'a yüklenemez.`);
    return 'medya-alinamadi';
  }
  const boyut = Number(k.media_bytes) || Number(medya.headers.get('content-length')) || 0;
  if (!boyut) {
    medya.body.cancel();
    await kaliciHata(k, 'Dosya boyutu bilinmiyor; Facebook yüklemesi file_size istiyor.');
    return 'boyut-yok';
  }

  if (video) {
    // ⚠ UC TÜRE GÖRE. İskelet aynı (start -> rupload -> finish) ama
    // Facebook story'si ile reel'i AYRI kaynaklar: video_stories bir
    // reel üretmiyor, video_reels de bir story. Tek satırlık bir fark
    // gibi duruyor, sonucu tamamen farklı bir gönderi.
    const reel = reelMi(k);
    const uc = reel ? `/${pageId()}/video_reels` : `/${pageId()}/video_stories`;

    // AŞAMA 1 — başlat
    const bas = await graf(uc, { method: 'POST', alan: { upload_phase: 'start' } });
    const videoId = String(bas?.video_id ?? '');
    const yuklemeAdresi = String(bas?.upload_url ?? '');
    if (!videoId || !yuklemeAdresi) {
      medya.body.cancel();
      throw new GrafHata(0, null, null, uc + ' start beklenen alanları döndürmedi');
    }
    await rpc('story_iz_konteyner', { p_id: k.id, p_ref: videoId });

    // AŞAMA 2 — dosyayı yükle. Gövde AKITILIYOR.
    const yanit = await fetch(yuklemeAdresi, {
      method: 'POST',
      headers: { 'Authorization': `OAuth ${PAGE_TOKEN}`, 'offset': '0', 'file_size': String(boyut) },
      body: medya.body,
      // Deno akıtılan gövdede bunu istiyor; olmazsa gövdeyi belleğe alır.
      ...({ duplex: 'half' } as any)
    });
    const metin = await yanit.text();
    if (!yanit.ok) {
      throw new GrafHata(yanit.status, null, null, 'video yüklenemedi: ' + temizle(metin).slice(0, 300));
    }

    // AŞAMA 3 — bitir. YAYINLAYAN ÇAĞRI BU, iz ondan önce yazılıyor.
    const bitisAlanlari: Record<string, string> = { upload_phase: 'finish', video_id: videoId };
    if (reel) {
      // video_state ZORUNLU: yazılmazsa reel TASLAK olarak kalıyor ve
      // hiçbir yerde hata görünmüyor -- kullanıcı yayınlandı sanıyor.
      bitisAlanlari.video_state = 'PUBLISHED';
      const yazi = altYazi(k);
      if (yazi) bitisAlanlari.description = yazi;
    }
    await rpc('story_iz_yayin_cagrisi', { p_id: k.id });
    const bit = await graf(uc, { method: 'POST', alan: bitisAlanlari });
    await rpc('story_yayinlandi', { p_id: k.id, p_external_id: String(bit?.post_id ?? bit?.id ?? videoId) });
    return 'yayinlandi';
  }

  // ---- FOTOĞRAF: iki aşama -------------------------------------------------
  // published=false ile yüklenen fotoğraf sayfada GÖRÜNMÜYOR; yalnızca
  // story'ye malzeme oluyor. Bu yüzden bu adım bir yayın değil ve
  // çöküş izi de burada "yayın çağrıldı" demiyor.
  const govde = new FormData();
  govde.append('url', String(k.media_url));
  govde.append('published', 'false');
  govde.append('access_token', PAGE_TOKEN);
  medya.body.cancel();
  const foto = await grafFormla(`/${pageId()}/photos`, govde);
  const fotoId = String(foto?.id ?? '');
  if (!fotoId) throw new GrafHata(0, null, null, 'photos beklenen id dönmedi');
  await rpc('story_iz_konteyner', { p_id: k.id, p_ref: fotoId });

  await rpc('story_iz_yayin_cagrisi', { p_id: k.id });
  const y = await graf(`/${pageId()}/photo_stories`, { method: 'POST', alan: { photo_id: fotoId } });
  await rpc('story_yayinlandi', { p_id: k.id, p_external_id: String(y?.post_id ?? y?.id ?? fotoId) });
  return 'yayinlandi';
}

// ⛔ KALICI HATA = BİLDİRİM. Bölüm 9: "SESSİZ BAŞARISIZLIK YASAK."
//
// Bu yardımcı bir kolaylık değil, bir düzeltme. Akışın İÇİNDE kalıcı
// olarak başarısız olan yollar (medya bağlı değil, Instagram medyayı
// reddetti, medya adresi ölü) doğrudan story_basarisiz çağırıp normal
// dönüyordu -- bildirim ise yalnızca kaydiIsle'nin catch bloğundaydı.
// Yani en kesin başarısızlıklar, kullanıcıya haber verilmeyen tek
// başarısızlıklardı. Story 24 saatlik; kaçan gün geri gelmez.
async function kaliciHata(k: any, mesaj: string): Promise<void> {
  await rpc('story_basarisiz', { p_id: k.id, p_hata: mesaj, p_kalici: true });
  await basarisizBildir(k, mesaj);
}

// Kayıt başına hata sarmalı: sınıflandır, doğru geçişi çağır, gerekirse
// bildir. Bir kaydın hatası öbür kayıtları durdurmuyor.
async function kaydiIsle(k: any, bitis: number): Promise<string> {
  try {
    return await kaydiYayinla(k, bitis);
  } catch (e) {
    const { kova, mesaj } = siniflandir(e);
    if (kova === 'kota') {
      await rpc('story_ertele', { p_id: k.id, p_dakika: 60, p_sebep: mesaj });
      return 'kota-ertelendi';
    }
    const kalici = kova === 'kalici';
    await rpc('story_basarisiz', { p_id: k.id, p_hata: mesaj, p_kalici: kalici });
    // Bölüm 9: 'failed' olduğu an bildirim. Geçici hatada henüz
    // 'failed' değil -- üçüncü denemede olacak.
    if (kalici || Number(k.attempt_count ?? 0) >= 3) await basarisizBildir(k, mesaj);
    return kalici ? 'kalici-hata' : 'gecici-hata';
  }
}

async function basarisizBildir(k: any, mesaj: string) {
  const alici = await hesapEpostasi(k.user_id);
  const ne = k.title ? `"${k.title}"` : `başlıksız ${turAdi(k)}`;
  // PLATFORM KAYITTAN OKUNUYOR, sabit yazılmıyor. Sabitti ve ilk
  // gerçek Facebook denemesinde bildirim "Platform: Instagram" dedi --
  // yani hatayı okuyan kişi yanlış yerde arardı. Şartname Bölüm 9
  // bildirimde "hangi kayıt, hangi platform" istiyor; platformu
  // uydurmak bilgi vermemekten kötü.
  const pfAd = ({ instagram: 'Instagram', facebook: 'Facebook' } as Record<string, string>)[
                 String(k.platform || '')] || String(k.platform || '?');
  // ⚠ ACELE AYNI DEĞİL. Story 24 saatlik: kaçan gün geri gelmiyor,
  // o yüzden "bugün elle yayınla" demek doğru. Reel kalıcı: aynı
  // cümle gereksiz bir telaş yaratır ve yarın yayınlamak da olur.
  const reel = reelMi(k);
  const kapanis = reel
    ? 'Reel kalıcı bir gönderi; acelesi yok ama elle de yayınlayabilirsin.'
    : 'Story 24 saatlik; bugünü kaçırmamak için elle yayınlamak isteyebilirsin.';
  await epostaGonder(alici, `Shootboard · ${reel ? 'Reel' : 'Story'} yayınlanamadı`,
    `${ne} yayınlanamadı.\n\n`
    + `Tür      : ${reel ? 'Reels' : 'Story'}\n`
    + `Platform : ${pfAd}\n`
    + `Zaman    : ${k.publish_at ?? '-'}\n`
    + `Hata     : ${temizle(mesaj)}\n\n`
    + kapanis + `\n`
    + `Kayıt: ${APP_URL}\n`);
}

// ══════════════════════════════════════════════════════════════════
// KONTEYNERLERİ ÖNDEN YARAT — parçalar arka arkaya çıksın diye
// ══════════════════════════════════════════════════════════════════
// SORUN. Instagram videoyu kendisi indirip işliyor ve bu bir dakikayı
// aşabiliyor. Kayıtlar uçtan uca sırayla işlenirse bu beklemeler
// TOPLANIYOR. 22 Eylül 2026'da iki parçalı bir story'de ölçtük:
//
//   13:45:00  tur başladı
//   13:46:41  1/2 yayında   (~100 sn'nin neredeyse tamamı bekleme)
//   13:48:58  2/2 yayında   -> aradaki fark 2 dk 17 sn
//
// Oysa parçalar birbirini takip ediyor; araya iki dakika girmesi
// içeriği bozuyor.
//
// ÇÖZÜM. Konteyner yaratmak yayınlamak DEĞİL -- Meta'ya "şu adresteki
// videoyu işlemeye başla" demek. O yüzden turun en başında hepsi için
// birden yaratılabiliyor. 1. parça yayınlanırken 2. parçanın işlenmesi
// çoktan başlamış oluyor: beklemeler toplanmak yerine ÜST ÜSTE
// biniyor ve ikinci yayın birkaç saniye sonra çıkıyor.
//
// ⚠ YAYIN SIRASI BURADA DEĞİŞMİYOR. Aşağıdaki tur döngüsü listeyi yine
// baştan sona, sql/46'nın verdiği sırayla (publish_at, media_name, id)
// yayınlıyor. 2. parçanın konteyneri önce hazır olsa bile 1. parça
// yayınlanmadan sıra ona gelmiyor.
//
// ⚠ ÇÖKÜŞ İZİ BOZULMUYOR. story_iz_konteyner publish_ref'i yazıp
// publish_called_at'i boşaltıyor; Bölüm 8'in okuduğu "iz var, çağrı
// yok -> hiçbir şey çıkmış olamaz" durumu aynen korunuyor. İzi olan
// kayıtlar (elde konteyner ya da kurtarma durumu) zaten eleniyor.
async function konteynerleriHazirla(liste: any[], bitis: number): Promise<number> {
  const adaylar = liste.filter((k) =>
       String(k.platform || 'instagram') === 'instagram'
    && !k.external_id      // zaten yayında
    && !k.publish_ref      // elde konteyner var ya da kurtarma izi var
    && k.media_url
    // Video olmayan bir reel zaten yayınlanamıyor; burada konteyner
    // yaratmak boşuna istek olurdu. Kalıcı hatayı asıl yol veriyor.
    && !(reelMi(k) && !String(k.media_mime ?? '').startsWith('video/')));
  // Tek kayıt varsa üst üste binecek bir şey yok: boşuna istek atma.
  if (adaylar.length < 2) return 0;

  // Kota doluysa hiç başlama. Konteyner yaratmak kotayı harcamıyor ama
  // yayın yapılamayacağı için hepsi boşa gider ve süresi dolar.
  const kota = await kotaDolu();
  if (kota.dolu) return 0;

  let n = 0;
  for (const k of adaylar) {
    // Bütçenin son saniyelerinde yeni istek açmıyoruz.
    if (Date.now() > bitis - 20_000) break;
    try {
      // Alanlar TEK YERDEN: igKonteynerAlanlari. Burada ikinci bir
      // kopya olsaydı, önden yaratılan konteyner yayında kullanıldığı
      // için kazanan o kopya olurdu.
      const y = await graf(`/${IG_USER_ID}/media`, { method: 'POST', alan: igKonteynerAlanlari(k) });
      const konteyner = String(y?.id ?? '');
      if (!konteyner) continue;
      await rpc('story_iz_konteyner', { p_id: k.id, p_ref: konteyner });
      // Bellekteki kayıt da güncelleniyor, yoksa instagramYayinla
      // birazdan İKİNCİ bir konteyner yaratır.
      k.publish_ref = konteyner;
      k.publish_ref_at = simdi();
      n++;
    } catch (e) {
      // ⚠ HATA YUTULUYOR -- ama kaybolmuyor. Burada sınıflandırma
      // YAPMIYORUZ: kaydın kendi sırası geldiğinde instagramYayinla
      // aynı isteği yeniden deneyecek ve hata kaydiIsle'nin
      // try/catch'ine düşüp doğru kovaya girecek (kalıcı / geçici /
      // kota ayrımı, bildirim, deneme sayısı). Aynı mantığı iki yerde
      // yazmak, iki yerde ayrışması demek olurdu.
      console.warn('[story] önden konteyner yaratılamadı', k.id, temizle((e as Error).message));
    }
  }
  return n;
}

// ══════════════════════════════════════════════════════════════════
// BİR TUR
// ══════════════════════════════════════════════════════════════════
async function tur(): Promise<Record<string, unknown>> {
  const bitis = Date.now() + butceMs();

  const token = await tokenSagligi();
  if (!token.gecerli) {
    // Kuyruk ALINMIYOR. Yukarıdaki tokenSagligi() yorumu bunun neden
    // böyle olduğunu anlatıyor.
    return { ok: true, durakladi: 'token', sebep: token.sebep, alinan: 0 };
  }
  if (!IG_USER_ID) return { ok: false, durakladi: 'yapilandirma', sebep: 'META_IG_USER_ID tanımlı değil', alinan: 0 };

  // ÖNCE asılı kalanlar geri alınıyor, SONRA kuyruk. Çöken bir worker
  // kaydı 'in_progress' bırakıyor ve kuyruk sorgusu yalnızca 'pending'
  // arıyor; bu çağrı olmadan çöken kayıt bir daha hiç işlenmez ve
  // Bölüm 8'in kurtarma katmanının çalışacağı an hiç gelmez.
  let asili = 0;
  try {
    asili = Number(await rpc('story_asili_topla', { p_dakika: 10 })) || 0;
    if (asili) console.log('[story]', asili, 'asılı kayıt kuyruğa geri alındı');
  } catch (e) {
    // sql/42 henüz çalıştırılmamış olabilir: tur devam etsin.
    console.warn('[story] story_asili_topla çağrılamadı:', temizle((e as Error).message));
  }

  const kayitlar = await rpc('story_kuyruk_al', { p_limit: TUR_BASINA });
  const liste = Array.isArray(kayitlar) ? kayitlar : [];
  const sonuc: Record<string, number> = {};

  // Yayından ÖNCE: bu turdaki Instagram kayıtlarının konteynerlerini
  // hep birlikte yarat. Sıra değişmiyor, yalnızca beklemeler üst üste
  // biniyor. Ayrıntı fonksiyonun başında.
  const ondenHazir = await konteynerleriHazirla(liste, bitis);
  if (ondenHazir) sonuc['konteyner-onden'] = ondenHazir;
  for (const k of liste) {
    // Kalan süre bir yayını taşımıyorsa BAŞLAMA: yarıda kalan kayıt
    // 'in_progress' kalır ve bir sonraki tura kadar kilitlenir.
    if (Date.now() > bitis - 15_000) {
      await rpc('story_ertele', { p_id: k.id, p_dakika: 0, p_sebep: 'Tur bütçesi doldu, sıradaki turda.' });
      sonuc['butce-bitti'] = (sonuc['butce-bitti'] ?? 0) + 1;
      continue;
    }
    const s = await kaydiIsle(k, bitis);
    sonuc[s] = (sonuc[s] ?? 0) + 1;
  }
  return { ok: true, asili, alinan: liste.length, sonuc };
}

Deno.serve(async (req: Request) => {
  // GET dağıtımı doğrulamak için: panelden yapıştırılan sürümün
  // gerçekten yerine geçtiği başka türlü anlaşılmıyor. (Bir kez eski
  // sürüm "doğrulandı" sanıldı ve sorun günlerce yanlış yerde arandı.)
  if (req.method === 'GET') {
    return json({ ok: true, servis: 'shootboard-story-yayin', surum: SURUM, uclar: UCLAR,
      yapilandirma: {
        // Değerler DEĞİL, yalnızca tanımlı olup olmadıkları.
        page_token: !!PAGE_TOKEN, ig_user_id: !!IG_USER_ID, page_id: !!pageId(),
        app_kimlik: !!(APP_ID && APP_SECRET), resend: !!RESEND_KEY, secret: !!WORKER_SECRET
      } });
  }
  if (req.method !== 'POST') return json({ ok: false, sebep: 'yalnızca POST' }, 405);
  if (!WORKER_SECRET || req.headers.get('x-webhook-secret') !== WORKER_SECRET) {
    return json({ ok: false, sebep: 'gizli anahtar uyuşmuyor' }, 401);
  }
  if (!SUPABASE_URL || !SERVIS) return json({ ok: false, sebep: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok' }, 500);
  try {
    return json(await tur());
  } catch (e) {
    console.error('[story] tur patladı:', temizle(String((e as Error)?.stack ?? e)));
    return json({ ok: false, sebep: temizle(String((e as Error)?.message ?? e)) }, 500);
  }
});
