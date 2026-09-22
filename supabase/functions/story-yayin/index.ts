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

const SURUM = '1.1.0';
const UCLAR = ['GET / (servis bilgisi)', 'POST / (bir tur)'];

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SERVIS         = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WORKER_SECRET  = Deno.env.get('STORY_WORKER_SECRET') ?? '';
const PAGE_TOKEN     = Deno.env.get('META_PAGE_TOKEN') ?? '';
const IG_USER_ID     = Deno.env.get('META_IG_USER_ID') ?? '';
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
async function cikmisMi(cagriAni: string): Promise<{ biliniyor: boolean; id: string }> {
  let veri: any;
  try {
    veri = await graf(`/${IG_USER_ID}/stories`, { alan: { fields: 'id,timestamp' } });
  } catch (e) {
    console.warn('[story] /stories okunamadı:', siniflandir(e).mesaj);
    return { biliniyor: false, id: '' };
  }
  const an = Date.parse(cagriAni) || 0;
  if (!an) return { biliniyor: false, id: '' };
  // Saat farkı ve Meta'nın kendi damgası için iki dakikalık pay.
  const esik = an - 120_000;
  for (const m of (veri?.data ?? [])) {
    const t = Date.parse(m?.timestamp ?? '');
    if (t && t >= esik) return { biliniyor: true, id: String(m.id) };
  }
  // Liste geldi ve o pencerede hiçbir şey yok: çıkmamış. Story 24
  // saat duruyor, yeni çıkmış bir story listede olmak ZORUNDA.
  return { biliniyor: true, id: '' };
}

// Konteyner izini sil. story_iz_konteyner'a boş kimlik vermek "artık
// böyle bir konteyner yok" demek; publish_called_at da sıfırlanıyor.
// Bunu ayrı bir fonksiyon yapmak kasıtlı: izi temizlemeyi unutmak
// sessiz bir tuzak ve bir kez kurulmuştu.
const izTemizle = (id: string) => rpc('story_iz_konteyner', { p_id: id, p_ref: null });

// ══════════════════════════════════════════════════════════════════
// TEK KAYDIN YAYINI — Bölüm 5
// ══════════════════════════════════════════════════════════════════
// Bugün yayınlayabildiğimiz platformlar. Şartname Bölüm 6 (Facebook
// sayfa story'si) kullanıcı kararıyla ertelendi ve TAMAMEN FARKLI bir
// akış: Instagram dosyayı URL'den çekiyor, Facebook dosyayı yükletiyor.
const YAYINLANABILIR = ['instagram'];

async function kaydiYayinla(k: any, bitis: number): Promise<string> {
  // ⚠ PLATFORM KONTROLÜ, HER ŞEYDEN ÖNCE.
  // Shootboard'da her sosyal medya AYRI kayıt. Kuyruk `type = 'story'`
  // süzüyor, platform süzmüyor -- yani Facebook için planlanmış bir
  // kayıt da buraya gelir. Bu kontrol olmasaydı o kayıt INSTAGRAM'A
  // yayınlanırdı: kullanıcının Facebook'a koyduğu story, Instagram'da
  // ikinci kez çıkar ve hiçbir yerde hata görünmezdi.
  //
  // Hata değil ERTELEME: kayıt bozuk değil, sıra henüz gelmedi. Deneme
  // hakkı harcanmıyor, sebep last_error'da görünüyor, ve Facebook
  // desteği geldiği gün bu kayıtlar elle hiçbir şey yapılmadan
  // yayınlanmaya başlıyor.
  const pf = String(k.platform || 'instagram');
  if (!YAYINLANABILIR.includes(pf)) {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: `${pf} yayını henüz kurulmadı; kayıt bekliyor. Şimdilik elle yayınla.` });
    return 'platform-desteklenmiyor';
  }
  // Katman 2: external_id dolu ise bu kayıt zaten yayınlanmış.
  if (k.external_id) {
    await rpc('story_yayinlandi', { p_id: k.id, p_external_id: k.external_id });
    return 'zaten-yayinda';
  }
  if (!k.media_url) {
    await rpc('story_basarisiz', { p_id: k.id, p_hata: 'Medya bağlı değil: mediaUrl boş.', p_kalici: true });
    return 'medyasiz';
  }

  // ---- Katman 3: çöküş izi -------------------------------------------------
  let konteyner: string = k.publish_ref || '';
  if (konteyner && k.publish_called_at) {
    const { biliniyor, id } = await cikmisMi(k.publish_called_at);
    if (!biliniyor) {
      await rpc('story_ertele', { p_id: k.id, p_dakika: 5,
        p_sebep: 'Yayın çağrısının sonucu bilinmiyor; Instagram sorulamadı. Çift yayın olmasın diye bekleniyor.' });
      return 'kurtarma-belirsiz';
    }
    if (id) {
      await rpc('story_yayinlandi', { p_id: k.id, p_external_id: id });
      return 'kurtarildi-yayinda';
    }
    // Çıkmamış. Konteyner hâlâ geçerliyse aynısıyla devam edilecek.
    console.log('[story]', k.id, 'yayın çağrısı sonuçsuz kalmış, çıkmamış — tekrar yayınlanıyor');
  }

  // ---- Kota (Bölüm 7) ------------------------------------------------------
  const kota = await kotaDolu();
  if (kota.dolu) {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 60, p_sebep: kota.not + ' — dolu, bir saat sonra tekrar denenecek.' });
    return 'kota-ertelendi';
  }

  // ---- Adım 1: konteyner ---------------------------------------------------
  const video = String(k.media_mime ?? '').startsWith('video/');
  // Konteynerin yaşı NEREDEN sayılıyor: elde hazır bir konteyner varsa
  // sql/42'deki publish_ref_at damgasından, yenisi yaratılıyorsa
  // şimdiden. Bu ayrım şartnamedeki "120 saniye" sınırının tek anlamlı
  // okunuşu: süre bellekte tutulsaydı worker her kesildiğinde sıfırlanır
  // ve tavan hiç dolmazdı.
  let refAn = Date.parse(k.publish_ref_at ?? '') || 0;
  if (!konteyner) {
    const alan: Record<string, string> = { media_type: 'STORIES' };
    alan[video ? 'video_url' : 'image_url'] = String(k.media_url);
    const y = await graf(`/${IG_USER_ID}/media`, { method: 'POST', alan });
    konteyner = String(y?.id ?? '');
    if (!konteyner) throw new GrafHata(0, null, null, 'konteyner kimliği dönmedi');
    await rpc('story_iz_konteyner', { p_id: k.id, p_ref: konteyner });
    refAn = Date.now();
  }
  if (!refAn) refAn = Date.now();
  const konteynerSon = refAn + KONTEYNER_TAVANI_MS;

  // ---- Adım 2: hazır olana kadar yokla ------------------------------------
  while (true) {
    const d = await graf(`/${konteyner}`, { alan: { fields: 'status_code,status' } });
    const kod = String(d?.status_code ?? '');
    if (kod === 'FINISHED') break;
    if (kod === 'ERROR') {
      // Bölüm 5: "ERROR → başarısız, status alanını lastError'a yaz."
      // Neredeyse her zaman medya sorunudur; tekrar denemek render'ı
      // düzeltmez ve kullanıcının elle yayınlama şansını da yer.
      await rpc('story_basarisiz', { p_id: k.id,
        p_hata: 'Instagram medyayı işleyemedi: ' + temizle(String(d?.status ?? 'ERROR')), p_kalici: true });
      return 'medya-reddedildi';
    }
    if (kod === 'EXPIRED') {
      // Konteyner 24 saatte düşmüş; bu kimlikle bir daha iş yapılamaz.
      await izTemizle(k.id);
      await rpc('story_basarisiz', { p_id: k.id, p_hata: 'Konteyner süresi doldu, baştan denenecek.', p_kalici: false });
      return 'konteyner-dustu';
    }
    // Tavan mı doldu, tur bütçesi mi? İkisinin cevabı ZIT.
    if (Date.now() + YOKLAMA_MS >= konteynerSon) {
      // İZ TEMİZLENMEK ZORUNDA. Temizlenmezse bir sonraki deneme aynı
      // konteynerle başlar, yaşı zaten 120 saniyeyi aşmıştır ve anında
      // yine başarısız olur -- üç deneme birkaç dakikada tükenir ve
      // kullanıcı hiç gerçek bir tekrar denemesi görmez.
      await izTemizle(k.id);
      await rpc('story_basarisiz', { p_id: k.id, p_hata: 'Medya 120 saniyede hazır olmadı.', p_kalici: false });
      return 'konteyner-zaman-asimi';
    }
    if (Date.now() + YOKLAMA_MS >= bitis - 5_000) {
      // Tur bütçesi bitti, tavan dolmadı. Bu bir HATA DEĞİL: erteleniyor,
      // deneme hakkı geri veriliyor ve bir sonraki tur AYNI konteyneri
      // kaldığı yerden yokluyor -- tavan da kaldığı yerden sayıyor.
      await rpc('story_ertele', { p_id: k.id, p_dakika: 1, p_sebep: 'Medya hâlâ işleniyor; bir sonraki turda devam.' });
      return 'butce-bitti';
    }
    await bekle(YOKLAMA_MS);
  }

  // ---- Adım 3: yayınla -----------------------------------------------------
  // ⚠ SIRA ÖNEMLİ. İz önce yazılıyor, yayın sonra çağrılıyor. Ters
  // olsaydı tam aradaki çöküş hiçbir iz bırakmaz ve üçüncü katman
  // (Bölüm 8) hiç çalışmazdı -- yani çift yayın kapısı burada açılır.
  await rpc('story_iz_yayin_cagrisi', { p_id: k.id });
  const y = await graf(`/${IG_USER_ID}/media_publish`, { method: 'POST', alan: { creation_id: konteyner } });
  const medyaId = String(y?.id ?? '');
  await rpc('story_yayinlandi', { p_id: k.id, p_external_id: medyaId });
  return 'yayinlandi';
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
  const ne = k.title ? `"${k.title}"` : 'başlıksız story';
  await epostaGonder(alici, 'Shootboard · Story yayınlanamadı',
    `${ne} yayınlanamadı.\n\n`
    + `Platform : Instagram\n`
    + `Zaman    : ${k.publish_at ?? '-'}\n`
    + `Hata     : ${temizle(mesaj)}\n\n`
    + `Story 24 saatlik; bugünü kaçırmamak için elle yayınlamak isteyebilirsin.\n`
    + `Kayıt: ${APP_URL}\n`);
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
  for (const k of liste) {
    // Kalan süre bir yayını taşımıyorsa BAŞLAMA: yarıda kalan kayıt
    // 'in_progress' kalır ve bir sonraki tura kadar kilitlenir.
    if (Date.now() > bitis - 15_000) {
      await rpc('story_ertele', { p_id: k.id, p_dakika: 1, p_sebep: 'Tur bütçesi doldu, sıradaki turda.' });
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
        page_token: !!PAGE_TOKEN, ig_user_id: !!IG_USER_ID,
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
