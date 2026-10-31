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
//   TIKTOK_KAPSAMLAR      tiktok-baglan'da; onay gelince genişletilir
//
// Dağıtım:  supabase functions deploy story-yayin --no-verify-jwt
//
// ⚠ KAYNAK DEĞİŞTİYSE SURUM DA DEĞİŞMELİ. Alan "dağıtılan sürüm
// gerçekten yerine geçti mi" sorusuna cevap vermek için var; bir kez
// eski sürüm "doğrulandı" sanıldı çünkü eski ve yeni aynı cevabı
// veriyordu, ve sorun günlerce yanlış yerde arandı.
//
// 1.14.0 — TikTok doğrudan yayın yolu. `video.publish` kapsamı varsa
//          /v2/post/publish/video/init/ (post_info ile alt yazı ve
//          etiketler), yoksa eski taslak yolu. Gizlilik seviyesi
//          creator_info/query'nin verdiği listeden seçiliyor.
//
// 1.21.0 — Çift yayın kapısı kapatıldı (26 Ekim 2026'daki çift Facebook
//          reel'i). Reels'te boş liste artık tek başına "çıkmadı"
//          demiyor: ikinci tanık olarak kendi nesnemizin durumu
//          soruluyor (kapsayiciCikmisMi). Ayrıca "sonucu bilinmiyor"
//          hâli 30 dakikada bitiyor -- sonsuz erteleme yerine
//          başarısız + bildirim, YENİDEN YAYIN YOK.

// 1.22.0 — Anket seçeneği sınırı KARAKTERLE değil BAYTLA ölçülüyor.
//          27 Ekim 2026: "İstanbul Arkeoloji Müzesi" 25 karakter ama
//          27 bayt; Threads `#100/4279063 Invalid parameter` döndürdü
//          ve kayıt failed oldu. Seçenek kısaltılınca aynı anket dört
//          seçeneğiyle yayınlandı.

const SURUM = '1.22.0';
const UCLAR = ['GET / (servis bilgisi)', 'POST / (bir tur)'];

// ⚠ ORTAM DEĞİŞKENLERİ KIRPILIYOR.
// 28 Eylül 2026: TikTok anahtarı Supabase'e bir satır sonuyla birlikte
// yapıştırılmıştı; değer ekranda doğru görünüyordu, istek "geçersiz
// anahtar" ile dönüyordu ve sebebi hiçbir yerde yazmıyordu. Aynı kaza
// META_* değerlerinde de olabilir, olmadığını bilmiyoruz -- yalnızca
// bugün çalıştıklarını biliyoruz.
const ayar = (ad: string) => (Deno.env.get(ad) ?? '').trim();

const SUPABASE_URL   = ayar('SUPABASE_URL');
const SERVIS         = ayar('SUPABASE_SERVICE_ROLE_KEY');
const WORKER_SECRET  = ayar('STORY_WORKER_SECRET');
const PAGE_TOKEN     = ayar('META_PAGE_TOKEN');
const IG_USER_ID     = ayar('META_IG_USER_ID');
const pageId         = () => ayar('META_PAGE_ID');
const APP_ID         = ayar('META_APP_ID');
// ⚠ THREADS AYRI BIR UYGULAMADAN GELIYOR. Facebook/Instagram'in
// META_PAGE_TOKEN'i ile ILGISI YOK: Threads'in kendi uygulamasi,
// kendi jetonu var (16 Ekim 2026, "Shootboard Threads"). Ikisini
// karistirmak, calisan Facebook yayinini bozmak demek.
//
// ⚠ BU ARTIK TOHUM, CALISAN JETON DEGIL (sql/63).
// Jeton ~60 gunde oluyor ve yenilenen jeton BIR YERE YAZILMALI;
// Edge Function kendi ortam degiskenine yazamaz. O yuzden gercek
// jeton `threads_hesaplari` tablosunda duruyor -- TikTok ve
// YouTube'daki desenin aynisi.
//
// Buradaki deger yalnizca TABLODA SATIR YOKKEN kullaniliyor: ilk
// yayinda tabloya tohumlaniyor. Ondan sonra tablodaki yenileniyor,
// buradaki eskir ve bir daha okunmaz.
const THREADS_TOKEN  = ayar('THREADS_TOKEN');
// Sureye kac gun kala yenilensin. Son gune birakmak tehlikeli:
// yenileme penceresi kacarsa jeton KALICI oluyor ve tek care
// panelden elle yeni jeton almak.
const THREADS_YENILEME_GUN = 10;
const THREADS_TABANI = (ayar('THREADS_TABANI') || 'https://graph.threads.net/v1.0');
// ⚠ ZAMAN AŞIMI -- 16 EKIM 2026'DA EKLENDI, SEBEBI OLCULDU.
// Ilk gercek Threads yayininda "yayinla" cagrisi SESSIZCE sonucsuz
// kaldi: ne hata, ne log, ne kayit. Kapsayici Threads'te FINISHED
// halinde duruyordu, yani gorsel islenmisti ve patlayan tek sey son
// cagriydi. En olasi sebep askida kalan bir istek: fetch'in kendi
// zaman asimi YOK, isolate suresi dolunca oldurulüyor ve catch hic
// calismiyor -- yani hatanin izi de kalmiyor.
const THREADS_ZAMAN_ASIMI_MS = 20_000;
const APP_SECRET     = ayar('META_APP_SECRET');
const TIKTOK_KEY     = ayar('TIKTOK_CLIENT_KEY');
const TIKTOK_SECRET  = ayar('TIKTOK_CLIENT_SECRET');
// TikTok v2. Sondaki eğik çizgi ŞART: çizgisiz adreste yönlendirme
// yapılıyor ve POST gövdesi yönlendirmede düşüyor.
const TT_JETON  = 'https://open.tiktokapis.com/v2/oauth/token/';
const TT_INBOX  = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
const TT_DIREKT = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
const TT_KISI   = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
const TT_DURUM  = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
// Parça sınırları TikTok'un: en az 5 MB, en çok 64 MB; SON parça
// artanı da alarak 128 MB'a kadar taşabiliyor. 10 MB seçtik: 150 MB'lık
// bir reel 15 parça oluyor ve hiçbir an bellekte 10 MB'tan fazlası
// durmuyor.
const TT_PARCA  = 10 * 1024 * 1024;

const YOUTUBE_ID     = ayar('YOUTUBE_CLIENT_ID');
const YOUTUBE_SECRET = ayar('YOUTUBE_CLIENT_SECRET');
// ⛔ DENETİM ANAHTARI. Boşken worker YouTube'a GERÇEK kayıt yüklemiyor.
// Sebebi YOUTUBE bölümünün başında ve kısaca: denetimden geçmemiş bir
// projeden yüklenen video kalıcı olarak "özel"e kilitleniyor. Bu
// değişken bir ayar değil, bir ONAY: denetim onaylandığı gün elle
// tanımlanıyor.
//
// ⚠ İKİSİ DE İŞLEV, SABİT DEĞİL -- pageId() gibi. Sebep: değerleri
// yayının NE YAPACAĞINI belirliyor ve ikisinin de hem açık hem kapalı
// hali ölçülmek zorunda. Sabit olsalardı modül yüklenirken bir kez
// okunurdu ve testin ikinci hali hiç ölçülemezdi -- yani en tehlikeli
// iki ayarın yalnızca bir yüzü sınanmış olurdu.
const ytDenetim      = () => ayar('YOUTUBE_DENETIM_GECTI');
// 'private' | 'unlisted' | 'public'. Varsayılanın neden 'private'
// olduğu YOUTUBE bölümünün başında.
const ytGorunurluk   = () => (ayar('YOUTUBE_GORUNURLUK') || 'private');
// YouTube kategori kimliği. 27 = Education (Eğitim) -- kanalın yayında
// kullandığı bölüm (29 Eylül 2026'da Studio'dan doğrulandı). Önce 22
// (People & Blogs) yazıyordu ve bu benim koyduğum genel bir
// varsayılandı, kanalın seçimi değil: yüklenen her video yanlış bölüme
// düşerdi ve YouTube bunu hata saymaz, sessizce kabul eder.
const ytKategori     = () => (ayar('YOUTUBE_KATEGORI') || '27');
const YT_JETON  = 'https://oauth2.googleapis.com/token';
// ⚠ YÜKLEME ADRESİ ile VERİ ADRESİ AYRI. Yüklemede `/upload/` öneki
// var; önek olmadan istek 400 dönüyor ve hata "eksik gövde" diyor --
// sebebi hiçbir yerde yazmıyor.
const YT_YUKLE  = 'https://www.googleapis.com/upload/youtube/v3/videos';
// ⚠ PARÇA 256 KB'IN KATI OLMAK ZORUNDA (son parça hariç). Google
// artanı kabul etmiyor, oturumu bozuyor. 8 MB = 32 x 256 KB.
//
// ⚠ TIKTOK'UN FORMÜLÜ BURAYA UYMUYOR. TikTok parça sayısını
// floor(boyut/parça) ile istiyor ve son parça artanı yutuyor; Google
// öyle bir toplam beklemiyor, parçalar sırayla akıyor ve SON parça
// artan kadar oluyor -- yani ceil. İkisini karıştırmak, 8 MB'ın tam
// katı olmayan her dosyada yüklemenin son parçasını bozuyor ve bu
// yalnızca bazı dosyalarda görünüyor.
const YT_PARCA  = 8 * 1024 * 1024;

const RESEND_KEY     = ayar('RESEND_API_KEY');
const MAIL_FROM      = (ayar('MAIL_FROM') || 'Shootboard <hello@shootboard.app>');
const APP_URL        = (ayar('APP_URL') || 'https://shootboard.app/app.html');
const BILDIRIM_EPOSTA = ayar('STORY_BILDIRIM_EPOSTA');
const GRAF_TABANI    = (ayar('GRAF_TABANI') || 'https://graph.facebook.com/v21.0');

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
// BELİRSİZLİK TAVANI — Bölüm 8, üçüncü katman.
// "Yayın çağrısı yapıldı, sonucu bilinmiyor" hâli beş dakikada bir
// erteleniyor. 16 Ekim 2026'da Threads'te görüldü ki bu hâl SONSUZA
// KADAR sürebiliyor: ne yayın çıkıyor, ne hata e-postası gidiyor --
// yani Bölüm 9'un yasakladığı sessiz başarısızlığın tam kendisi.
//
// Bu süreden sonra kayıt BAŞARISIZ yazılıyor ve e-posta gidiyor.
// ⛔ KENDİLİĞİNDEN YENİDEN YAYINLANMIYOR: belirsizken ikinci kez
// yayınlamak, 26 Ekim'de Facebook'ta olanın aynısıdır -- kalıcı bir
// çift reel ve elle silme. Kararı kullanıcı veriyor.
const BELIRSIZ_TAVANI_MS = 30 * 60 * 1000;
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
  // TikTok'ta "son gönderiler" listesi yok; kendi publish_id'siyle
  // sorulan ayrı bir durum ucu var.
  if (pf === 'tiktok') return await tiktokCikmisMi(k);
  // Threads'te de "son gönderiler" listesi var; kendi uçlarıyla
  // sorulan ayrı bir yol gerekiyor (threadsCikmisMi).
  if (pf === 'threads') return await threadsCikmisMi(k, cagriAni);
  // YouTube'da da liste yok; sürdürülebilir yükleme oturumunun
  // kendisine soruluyor (youtubeCikmisMi'nin başında).
  if (pf === 'youtube') return await youtubeCikmisMi(k);
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
  // ⚠ REELS'TE BOŞ LİSTE "ÇIKMADI" DEMEK DEĞİL — 27 EKİM 2026'DAN BERİ
  // HİÇBİR SÜREDE DEĞİL.
  //
  // Story 24 saatlik ve /stories anında güncelleniyor; yeni çıkmış bir
  // story listede olmak zorunda. /media ve /video_reels için aynı
  // kesinlik YOK.
  //
  // 26 Ekim 2026: aynı Facebook reel'i 10:01'de ve 10:12'de iki kez
  // yayınlandı. İlki çıkmıştı. Onbir dakika sonra kurtarma turu
  // /video_reels'e sordu, listede BULAMADI ve o günkü iki dakikalık
  // "taze" penceresi çoktan geçtiği için "çıkmadı" dedi -- yeniden
  // yayınladı. Kalıcı bir reel elle silinmek zorunda kaldı.
  //
  // ⛔ O PENCEREYİ BÜYÜTMEK ÇÖZÜM DEĞİL. Belirsizlik yaşlandıkça
  // azalmıyor: listede neden görünmediğini bilmiyoruz ve beklemek
  // bunu öğretmiyor. Pencere ne kadar olsa, bir gün onun da dışına
  // düşen bir vaka çıkar -- 26 Ekim'de olan tam buydu.
  //
  // Artık İKİNCİ BİR TANIK soruluyor: kendi nesnemizin durumu. Desen
  // Threads'te 16 Ekim'den beri çalışıyor, aynısı buraya taşındı.
  // ⚠ SIRA ÖNEMLİ, TERSİ ÇİFT YAYIN ÜRETİR: önce liste, yalnızca
  // liste OKUNDU ve BOŞ iken nesnenin durumu karar veriyor.
  //
  // Asimetri hâlâ aynı: yanlış "çıkmadı" KALICI bir çift reel demek,
  // yanlış "bilmiyorum" ise yalnızca gecikme -- ve o gecikme artık
  // sonsuz değil, BELIRSIZ_TAVANI_MS dolunca e-posta gidiyor.
  if (reel) return await kapsayiciCikmisMi(k, pf);
  // Story'de liste YETKİLİ: /stories 24 saatliktir ve anında
  // güncellenir, yeni çıkmış bir story orada olmak zorunda.
  return { biliniyor: true, id: '' };
}

// ══════════════════════════════════════════════════════════════════
// İKİNCİ TANIK: KENDİ NESNEMİZİN DURUMU — Bölüm 8, reels
// ══════════════════════════════════════════════════════════════════
// Liste taraması "profilde yeni bir şey var mı" diye soruyor; bu ise
// "BİZİM yüklediğimiz şey yayınlandı mı" diye soruyor. İkincisi çok
// daha dar ve çok daha güvenilir: publish_ref elimizde.
//
//   Instagram  publish_ref = konteyner kimliği
//              GET /{konteyner}?fields=status_code
//              PUBLISHED = "kapsayıcının medya nesnesi yayınlandı"
//              (belgelenmiş beş değerden biri; ötekiler FINISHED,
//               IN_PROGRESS, ERROR, EXPIRED)
//
//   Facebook   publish_ref = video_id (upload_phase=start döndürüyor)
//              GET /{video_id}?fields=status
//              status.publishing_phase.publish_status = published |
//              not_published
//
// ⚠ FACEBOOK ALANI GARANTİ DEĞİL, BİLEREK BÖYLE YAZILDI. Bu alanlar
// Meta'nın Video API belgesinde duruyor ama video_reels ucunun kendi
// referansında geçmiyor. Yani boş dönebilir -- ve dönerse zararsız:
// tanınmayan her cevap "bilmiyorum" sayılıyor, ASLA "çıkmadı". Yani
// bu fonksiyon kesinliği yalnızca ARTIRABİLİR, çift yayın üretemez.
async function kapsayiciCikmisMi(k: any, pf: string): Promise<{ biliniyor: boolean; id: string }> {
  const ref = String(k.publish_ref ?? '');
  // İz yoksa sorulacak nesne de yok.
  // ⚠ BU SATIRA BUGÜN ERİŞİLMİYOR ve bilerek duruyor: tek çağıran
  // Bölüm 8 ve orası `k.publish_ref && k.publish_called_at` kapısının
  // arkasında. Yani mutasyon testi bu satırı öldürmez -- gap burada
  // yazılı olsun diye not edildi. threadsCikmisMi'de de aynı koruma
  // var; ikinci bir çağıran eklenirse hazır olması gerekiyor.
  if (!ref) return { biliniyor: false, id: '' };
  const alan = pf === 'facebook' ? 'status' : 'status_code';
  let veri: any;
  try {
    veri = await graf(`/${ref}`, { alan: { fields: alan } });
  } catch (e) {
    // SORULAMADI ≠ ÇIKMADI.
    console.warn('[story] kapsayıcı durumu sorulamadı:', siniflandir(e).mesaj);
    return { biliniyor: false, id: '' };
  }
  if (pf === 'facebook') {
    const y = String(veri?.status?.publishing_phase?.publish_status ?? '');
    // Gerçek gönderi kimliğini bilmiyoruz; video kimliği iz olarak
    // yeterli -- yayın yolundaki seçimin aynısı.
    if (y === 'published') return { biliniyor: true, id: ref };
    if (y === 'not_published') return { biliniyor: true, id: '' };
    console.warn('[story] FB video durumu okunamadı (publish_status yok) — emin değiliz');
    return { biliniyor: false, id: '' };
  }
  const kod = String(veri?.status_code ?? '');
  if (kod === 'PUBLISHED') return { biliniyor: true, id: ref };
  // FINISHED = "yayınlanmaya hazır", yani YAYINLANMADI. ERROR ve
  // EXPIRED de yayınlanmış değil. Üçü de KESİN cevap: yeniden yayın
  // güvenli.
  if (kod === 'FINISHED' || kod === 'ERROR' || kod === 'EXPIRED') {
    return { biliniyor: true, id: '' };
  }
  // IN_PROGRESS ya da tanınmayan: cevap yok.
  return { biliniyor: false, id: '' };
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
// 29 Eylül 2026: `shorts` eklendi. reelMi'yi genişletmedim -- reelMi
// Instagram/Facebook yollarında "konteynere REELS yaz" demek, shorts
// oraya hiç girmiyor (aşağıdaki tür/platform kontrolü kesiyor).
const shortMi = (k: any) => String(k?.type ?? 'story') === 'shorts';

// ══════════════════════════════════════════════════════════════════
// TÜR TABLOSU — TEK YER
// ══════════════════════════════════════════════════════════════════
// Üç şey burada duruyor ve üçü de daha önce koda dağılmıştı:
//
//   platformlar  Bu türün GİDEBİLECEĞİ platformlar. Kuyruk platformu
//                süzmüyor (sql/50, sql/53): süzgeç burada.
//   ad           Cümle içinde geçen kelime ("başlıksız reel").
//   tekil        Bildirim konusundaki tek gönderi ("Reel yayınlanamadı").
//   buyuk        Türün adı ("Tür: Reels").
//                Üçü ayrı duruyor çünkü Türkçede biri ötekinin yerine
//                geçmiyor: "Reels yayınlanamadı" bozuk, "Tür: Reel"
//                eksik. Tek alan yapmak ikisinden birini bozardı.
//   kalici       Gönderi kalıcı mı? Story 24 saatlik, reel ve Short
//                kalıcı -- hata bildiriminin tonu buna bakıyor.
//
// ⚠ BURAYA BİR TÜR EKLEMEK YETMEZ: sql/53'ün başındaki dört yer
// listesi geçerli. Ama buradan EKSİK kalan bir tür kuyruğa düşse
// bile YAYINLANMIYOR, erteleniyor -- yani eksiklik sessiz değil.
const TURLER: Record<string, { ad: string; tekil: string; buyuk: string; platformlar: string[]; kalici: boolean }> = {
  // ⚠ story'nin tiktok'ta olması tuhaf görünüyor ama gerçek: TikTok'ta
  // "story" diye bir biçim yok, kayıt taslağa video olarak düşüyor.
  // Kümeden çıkarmak, bugün çalışan kayıtları durdurmak olurdu.
  story:  { ad: 'story', tekil: 'Story', buyuk: 'Story',  platformlar: ['instagram', 'facebook', 'tiktok'], kalici: false },
  reels:  { ad: 'reel',  tekil: 'Reel',  buyuk: 'Reels',  platformlar: ['instagram', 'facebook', 'tiktok'], kalici: true  },
  // Shorts YALNIZCA YouTube. Instagram'a düşen bir shorts kaydı,
  // reelMi false döndüğü için STORY olarak çıkardı -- 24 saatte
  // kaybolan, kimsenin sebebini anlamadığı bir yayın.
  shorts: { ad: 'Short', tekil: 'Short', buyuk: 'Shorts', platformlar: ['youtube'], kalici: true  },
  // ⚠ text_post YALNIZCA THREADS. Metin (+istege bagli gorsel)
  // tasiyor; story/reels gibi video degil. Baska bir platforma dusen
  // bir text_post kaydi asagidaki platform kontrolunde ERTELENIYOR --
  // yoksa Instagram'a dusen bir metin postu story olarak cikardi.
  //
  // ⚠ TUR UYDURULMADI. Takvimde text_post ZATEN vardi (CAL_TYPES,
  // "Metin Postu"). Yeni bir tur eklemek arayuze, cevirilere ve
  // MCP'ye dokunmak demekti; mevcut turu kullanmak hepsini atladi.
  text_post: { ad: 'metin postu', tekil: 'Metin postu', buyuk: 'Metin Postu',
               platformlar: ['threads'], kalici: true },
  // ⚠ ANKET YALNIZCA THREADS. Tur veri modelinde 2 Eylul'den beri var
  // (eski Facebook anketlerinden kaldi) ama yayin hatti YOKTU. Yalnizca
  // threads yaziliyor: Facebook'un anket ucu bu worker'da hic yok ve
  // platformu buraya yazmak, olmayan bir yolu varmis gibi gostermek
  // olurdu. 16 Ekim 2026'da kullanici da "sadece threads icin" dedi.
  poll: { ad: 'anket', tekil: 'Anket', buyuk: 'Anket',
          platformlar: ['threads'], kalici: true }
};
// Metinler için: tanınmayan tür 'story' gibi ANLATILIYOR (yayın yolu
// bu değil -- onu kaydiYayinla'daki kontrol kesiyor).
const turBilgi = (k: any) => TURLER[String(k?.type ?? 'story')] ?? TURLER.story;
const turAdi = (k: any) => turBilgi(k).ad;

// ⛔ `content.youtubeDeneme` KALDIRILDI (30 Eylül 2026).
// Denetim kapısında bir kaçış deliğiydi: bayrağı taşıyan kayıt kapıyı
// geçip yükleniyordu. Başvuru için gereken tek deneme yüklemesi
// yapıldı, yani delik işini bitirmişti -- ama açık kaldığı sürece
// takvimdeki BİR kayda yanlışlıkla yazılması gerçek bir videoyu
// kalıcı olarak "özel"e gömmeye yetiyordu. Üstelik bayrak MCP'den
// görünmüyor: açık olsaydı kimse fark edemezdi.
//
// Artık kapının tek anahtarı YOUTUBE_DENETIM_GECTI. Bayrağı taşıyan
// eski kayıtlar da artık geçemiyor; alan sessizce yok sayılıyor.

// Reels alt yazısı kaydın kendi içeriğinden geliyor -- Shootboard'da
// zaten yazılmış olan metin. Instagram sınırı 2200 karakter; fazlası
// konteyneri reddettiriyor, o yüzden BURADA kırpılıyor: yayın anında
// öğrenmek, kayıt anında öğrenmekten pahalı.
// Facebook reel'inin BASLIGI. Instagram'in boyle bir alani yok; orada
// tek metin caption. Facebook'un `video_reels` ucu `title` kabul ediyor
// ve Shootboard kaydinda `shortTitle` bu is icin zaten dolu duruyordu --
// hicbir yere gonderilmiyordu (27 Eylul 2026'da farkedildi).
//
// Bos gecilirse alan HIC gonderilmiyor: bos bir title yazmak, hic
// yazmamaktan farkli davraniyor olabilir ve Facebook'un varsayilanini
// bozmak istemiyoruz.
//
// ⚠ 100 KARAKTER DOGRULANMIS BIR SINIR DEGIL, KASITLI OLARAK DUSUK.
// Graph belgeleri `title` icin bir uzunluk siniri YAZMIYOR (27 Eylul
// 2026'da arandi, bulunamadi). Alanin kabul edildigi kesin -- Meta'nin
// kendi Postman koleksiyonu finish cagrisinda title gonderiyor -- ama
// tavani bilinmiyor.
//
// Sinir asilirsa hata FINISH cagrisinda doner, yani dosya yuklendikten
// SONRA: yayin basarisiz olur. Bu yuzden tahmini bir tavana guvenmek
// yerine, pratikte HIC tetiklenmeyecek bir tavan konuyor -- kayittaki
// shortTitle degerleri 40-50 karakter. Gercek sinir ogrenilirse
// yukseltilebilir; dusuk kalmasinin bedeli yok.
function kisaBaslik(k: any): string {
  const c = (k?.content && typeof k.content === 'object') ? k.content : {};
  return String(c.shortTitle ?? '').trim().slice(0, 100);
}
// ⚠ TAVAN PARAMETRE, SABİT DEĞİL. Instagram 2200 karakter kabul
// ediyor, YouTube açıklaması 5000. İkinci bir kopya yazmak yerine
// tavanı çağıran veriyor: kopya olsaydı biri etiket kırpma kuralını
// öğrenir, öteki öğrenmezdi.
function altYazi(k: any, tavan = 2200): string {
  const c = (k?.content && typeof k.content === 'object') ? k.content : {};
  const metin = String(c.caption ?? '').trim();
  const etiketler = String(c.hashtags ?? '').trim();
  if (!etiketler) return metin.slice(0, tavan);

  // ⚠ ETİKETLER AYRI ALANDA DURUYOR ve 27 Eylül 2026'ya kadar hiçbir
  // yayına girmiyordu: burası yalnızca `caption` okuyordu. İlk gerçek
  // reel'de görüldü -- gönderi çıktı, etiketler yoktu, hiçbir yerde
  // hata görünmedi. Kullanıcı o kaydı elle düzeltti; sonraki on iki
  // kayıt aynı şekilde çıkacaktı.
  const parcalar = etiketler.split(/[\s,]+/).filter(Boolean);

  // Kullanıcı etiketleri alt yazının içine elle yazmışsa tekrar
  // eklemiyoruz -- 27 Eylül'de tam olarak bunu yapmıştı.
  if (parcalar[0] && metin.includes(parcalar[0])) return metin.slice(0, tavan);

  // ⚠ SINIRI ETİKETİN ORTASINDAN KESMİYORUZ. Düz `slice(0, 2200)`
  // "#arkeolo" gibi bir yarım etiket bırakır; Instagram onu geçerli
  // bir etiket sayar ve gönderi alâkasız bir akışa düşer.
  let cikti = metin;
  for (const p of parcalar) {
    const aday = cikti ? cikti + (cikti === metin ? '\n\n' : ' ') + p : p;
    if (aday.length > tavan) break;
    cikti = aday;
  }
  return cikti;
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
const YAYINLANABILIR = ['instagram', 'facebook', 'tiktok', 'youtube', 'threads'];

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
  // ⚠ TÜR VE PLATFORM BİRBİRİNE UYMAK ZORUNDA.
  // Kuyruk türü süzüyor, platformu süzmüyor; ikisinin UYUMUNU hiçbir
  // yer süzmüyordu. Instagram'a düşen bir `shorts` kaydı aşağıdaki
  // yolda Instagram'a giderdi ve `reelMi` false döndüğü için STORY
  // olarak çıkardı: 24 saatte kaybolan, hiçbir yerde hata vermeyen
  // bir yayın. En pahalı hata türü bu.
  //
  // ERTELEME, hata değil: kayıt bozuk değil, platformu yanlış -- ve
  // kullanıcı düzelttiği an kendiliğinden akıyor. Deneme hakkı da
  // harcanmıyor, yoksa kullanıcı düzeltmeyi yetiştirse bile kayıt üç
  // hakkını tüketmiş olurdu.
  const tb = TURLER[String(k.type ?? 'story')];
  if (!tb) {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: `'${String(k.type ?? '')}' türü worker'da tanımlı değil; kayıt bekliyor. `
             + 'Şimdilik elle yayınla.' });
    return 'tur-taninmiyor';
  }
  if (!tb.platformlar.includes(pf)) {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: `${tb.buyuk} ${pf} platformuna yayınlanamıyor `
             + `(${tb.buyuk} için: ${tb.platformlar.join(', ')}). `
             + 'Kaydın platformunu düzelt ya da elle yayınla.' });
    return 'tur-platform-uyusmuyor';
  }
  if (pf === 'youtube' && (!YOUTUBE_ID || !YOUTUBE_SECRET)) {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: 'YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET tanımlı değil; YouTube yüklemesi yapılamıyor.' });
    return 'yapilandirma-eksik';
  }
  // ⛔ DENETİM KAPISI — sebebi youtubeYayinla'nın başında.
  // Denetimden geçmemiş bir projeden yüklenen video KALICI olarak
  // "özel"e kilitleniyor. Yani denetim onaylanmadan yüklemek, videoyu
  // yayınlamak değil GÖMMEK demek.
  //
  // ⚠ İSTİSNA YOK. 30 Eylül 2026'ya kadar `content.youtubeDeneme`
  // bayrağı bu kapıyı açıyordu; kaldırıldı. Kapının tek anahtarı
  // YOUTUBE_DENETIM_GECTI ve o da yalnızca Supabase gizli ayarından
  // geliyor -- takvimdeki hiçbir kayıt kapıyı kendi başına açamaz.
  if (pf === 'youtube' && !ytDenetim()) {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 720,
      p_sebep: 'YouTube API denetimi henüz onaylanmadı. Şimdi yüklenen video KALICI olarak '
             + '"özel" kalır (Studio\'dan bile herkese açık yapılamıyor), o yüzden kayıt '
             + 'bekletiliyor. Onay geldiğinde YOUTUBE_DENETIM_GECTI tanımlanacak.' });
    return 'youtube-denetim-bekliyor';
  }
  if (pf === 'tiktok' && (!TIKTOK_KEY || !TIKTOK_SECRET)) {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: 'TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET tanımlı değil; TikTok yüklemesi yapılamıyor.' });
    return 'yapilandirma-eksik';
  }
  // ⚠ THREADS'TE BURADA KONTROL YOK, BİLEREK (sql/63).
  // Diğer platformlarda ayar ortam değişkeninde duruyor ve burada
  // bakmak doğru. Threads'te gerçek jeton TABLODA; ortamdaki yalnızca
  // bir tohum ve ilk yayından sonra eskiyor. Burada ortama bakmak,
  // tabloda geçerli jeton dururken yayını durdurmak olurdu.
  // Kontrol threadsYayinla'nın başında, jetonu okuyan yerde.
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
  // ⚠ THREADS GÖNDERİSİ DOSYASIZ OLABİLİR — tek istisna budur.
  // Story ve reels dosyasız anlamsız, o yüzden aşağıdaki dal onları
  // kalıcı hataya götürüyor. Threads'te metin TEK BAŞINA bir gönderi;
  // bu istisna olmasaydı her metin gönderisi "Medya bağlı değil"
  // deyip e-posta gönderirdi. Metin de yoksa aşağıda ayrıca
  // yakalanıyor (threadsYayinla).
  const metinYeter = pf === 'threads';
  if (!k.media_url && !metinYeter) {
    // ⚠ "DOSYA HENÜZ YOK" ARTIK NORMAL BİR DURUM OLABİLİYOR.
    // sql/56'dan beri YouTube kayıtları dosya hazır olur olmaz
    // yükleniyor; yani kaydı bugün girip dosyayı yarın atman mümkün.
    // Eskisi gibi KALICI hata yazmak, o kaydı yakmak olurdu: dosyayı
    // sonradan atsan bile bir daha denenmezdi.
    //
    // ⚠ YAYIN SAATİ GEÇTİYSE YİNE KALICI. O an son şans: dosyasız
    // kalmış bir kayıt sessizce beklemeye devam etmemeli, hata verip
    // e-posta göndermeli (Bölüm 9: sessiz başarısızlık yasak).
    //
    // sql/56'nın kuyruğu bu kayıtları zaten süzüyor -- bu satır SQL
    // henüz çalıştırılmamışken (dağıtım sırası) tek koruma.
    const an = Date.parse(String(k.publish_at ?? '')) || 0;
    if (an > Date.now()) {
      await rpc('story_ertele', { p_id: k.id, p_dakika: 60,
        p_sebep: 'Dosya henüz yüklenmemiş; yayın saatine kadar bekleniyor. '
               + 'Bilgisayarındaki yükleyiciyi çalıştırman yeterli.' });
      return 'medya-bekleniyor';
    }
    await kaliciHata(k, 'Medya bağlı değil: mediaUrl boş.');
    return 'medyasiz';
  }

  // ---- Katman 3: çöküş izi -------------------------------------------------
  // publish_called_at DOLU ise yayın çağrısı yapıldı ve sonucu bilinmiyor.
  if (k.publish_ref && k.publish_called_at) {
    const { biliniyor, id } = await cikmisMi(k, k.publish_called_at);
    if (!biliniyor) {
      // ⚠ BELİRSİZLİK SONSUZA KADAR SÜRMEZ — 27 EKİM 2026.
      // Burası o güne kadar koşulsuz beş dakika erteliyordu. Cevap hiç
      // gelmezse kayıt sonsuza kadar ertelenirdi: ne yayın, ne
      // e-posta. 16 Ekim'de Threads'te tam bu yaşandı.
      const cagri = Date.parse(String(k.publish_called_at ?? '')) || 0;
      if (cagri && Date.now() - cagri >= BELIRSIZ_TAVANI_MS) {
        const dk = Math.round(BELIRSIZ_TAVANI_MS / 60000);
        // ⛔ KENDİLİĞİNDEN YENİDEN YAYINLANMIYOR. Mesaj kullanıcıya ne
        // yapacağını söylüyor, çünkü kararı o veriyor.
        await kaliciHata(k, `Yayın çağrısı ${pf}'a gönderildi ama sonucu `
          + `${dk} dakikadır doğrulanamadı. Çift yayın olmasın diye kendiliğinden `
          + `tekrar denenmedi. ${pf} hesabını aç ve bak: gönderi ORADAYSA bu kaydı `
          + `elle "yayınlandı" işaretle; ORADA DEĞİLSE elle yayınla.`);
        return 'kurtarma-belirsiz-tavan';
      }
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

  if (pf === 'tiktok')  return await tiktokYayinla(k);
  if (pf === 'youtube') return await youtubeYayinla(k, bitis);
  if (pf === 'threads') return await threadsYayinla(k);

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
// THREADS — 16 Ekim 2026
// ══════════════════════════════════════════════════════════════════
// Akış Instagram'ınkiyle AYNI İSKELET: kapsayıcı yarat, sonra yayınla.
// Dosyayı Threads KENDİSİ çekiyor, biz yalnızca adresi veriyoruz --
// yani Facebook'taki gibi baytları taşımıyoruz, R2 adresi yetiyor.
//
// ⚠ AYRI UYGULAMA, AYRI JETON, AYRI TABAN ADRES.
// Facebook/Instagram graph.facebook.com'a gidiyor ve META_PAGE_TOKEN
// kullanıyor; Threads graph.threads.net'e gidiyor ve THREADS_TOKEN
// kullanıyor. Uygulamalar da ayrı (16 Ekim 2026'da "Shootboard
// Threads" diye yeni bir uygulama kuruldu). Bu ayrım KASITLI: Live
// olan Facebook uygulamamıza dokunmadan Threads denenebilsin diye.
//
// ⚠ METİN TEK BAŞINA GÖNDERİ OLABİLİYOR. Story ve reels dosyasız
// anlamsız; Threads'te değil. kaydiYayinla'daki medya kontrolünde
// bunun istisnası var.
//
// ⛔ KAPSAYICI HAZIR OLMADAN YAYINLANMIYOR. Görselde işlenme birkaç
// saniye sürüyor ve erken yapılan yayın çağrısı hata veriyor. Durum
// soruluyor, hazır olmadan beklenip tekrar bakılıyor.
// ══════════════════════════════════════════════════════════════════
// THREADS JETONU — tabloda durur, kendi kendine yenilenir (sql/63)
// ══════════════════════════════════════════════════════════════════
// ⛔ YENİLEME PENCERESİ KAÇIRILIRSA GERİ DÖNÜŞ YOK. Jeton en erken 24
// saatlik olunca yenilenebiliyor, en geç süresi dolmadan. 60 gün
// yenilenmeden geçerse jeton KALICI ölüyor; tek çare paneldeki
// üreticiden yenisini alıp sql/63 satırını elle güncellemek.
// O yüzden süreye THREADS_YENILEME_GUN kala yenileniyor.
//
// ⚠ AYRI YENİLEME JETONU YOK. Threads erişim jetonunun KENDİSİYLE
// yeniliyor. TikTok ve Google'da ayrı bir yenileme jetonu var; burada
// olmaması eksiklik değil, Threads öyle çalışıyor.
type ThHesap = { jeton: string; bitis: number };

// Butun Threads cagrilari BURADAN geciyor. Askida kalan bir istek
// 20 saniyede kesiliyor; cagiran hatayi gorup siniflandirabiliyor.
async function threadsFetch(adres: string, secenek: RequestInit = {}): Promise<Response> {
  return await fetch(adres, { ...secenek, signal: AbortSignal.timeout(THREADS_ZAMAN_ASIMI_MS) });
}

async function threadsJetonu(k: any): Promise<ThHesap | null> {
  let satirlar: any = null;
  try {
    satirlar = await rest(`/threads_hesaplari?user_id=eq.${k.user_id}&select=*&limit=1`);
  } catch (e) {
    // sql/63 henüz çalıştırılmamış olabilir (dağıtım sırası). Tablo
    // yoksa ortamdaki tohumla devam ediyoruz: yayın durmuyor, yalnızca
    // yenileme yapılmıyor.
    console.warn('[story] threads_hesaplari okunamadi (sql/63 calistirildi mi?):',
      temizle((e as Error).message));
    return THREADS_TOKEN ? { jeton: THREADS_TOKEN, bitis: 0 } : null;
  }
  const h = Array.isArray(satirlar) ? satirlar[0] : null;

  // ---- Tohumlama: tabloda satır yok ----------------------------------------
  // Ortamdaki jeton BİR KEZ tabloya yazılıyor. Bitiş tarihini Threads
  // söylemiyor (panelden alınan jetonun yaşını bilmiyoruz), o yüzden
  // TEMKİNLİ davranıp 30 gün varsayıyoruz: gerçek süre 60 ise erken
  // yenileriz (zararsız), 35 ise yine de yetişiriz.
  if (!h) {
    if (!THREADS_TOKEN) return null;
    const varsayilanBitis = new Date(Date.now() + 30 * 86400_000).toISOString();
    try {
      await rest('/threads_hesaplari', {
        method: 'POST',
        govde: { user_id: k.user_id, erisim_jetonu: THREADS_TOKEN,
                 erisim_bitis: varsayilanBitis }
      });
      console.log('[story] threads jetonu tabloya tohumlandi');
    } catch (e) {
      console.warn('[story] threads tohumlama yazilamadi:', temizle((e as Error).message));
    }
    return { jeton: THREADS_TOKEN, bitis: Date.parse(varsayilanBitis) };
  }

  const jeton = String(h.erisim_jetonu || '');
  const bitis = Date.parse(String(h.erisim_bitis ?? '')) || 0;
  if (!jeton) return null;

  // Daha vakit varsa dokunma.
  if (bitis > Date.now() + THREADS_YENILEME_GUN * 86400_000) return { jeton, bitis };

  // ⚠ GÜNDE BİR DENEME. Worker dakikada bir koşuyor; yenileme
  // başarısızsa her turda tekrar denemek Meta'yı dövmek olurdu ve
  // hata satırı sürekli üstüne yazılırdı.
  const sonDeneme = Date.parse(String(h.son_yenileme ?? '')) || 0;
  if (sonDeneme && Date.now() - sonDeneme < 86400_000) return { jeton, bitis };

  return await threadsJetonTazele(k, jeton, bitis);
}

async function threadsJetonTazele(k: any, jeton: string, bitis: number): Promise<ThHesap | null> {
  const simdi = new Date().toISOString();
  let v: any = null;
  let sebep = '';
  try {
    const adres = `${THREADS_TABANI.replace(/\/v1\.0$/, '')}/refresh_access_token`
      + `?grant_type=th_refresh_token&access_token=${encodeURIComponent(jeton)}`;
    const r = await threadsFetch(adres);
    v = await r.json().catch(() => null);
    if (!r.ok || !v?.access_token) {
      sebep = String(v?.error?.message ?? `HTTP ${r.status}`);
    }
  } catch (e) {
    sebep = temizle((e as Error).message);
  }

  if (sebep) {
    // ⚠ YENİLEME BAŞARISIZ ≠ YAYIN DURUR. Jetonun süresi henüz
    // dolmadıysa eldeki jetonla devam ediyoruz; yarın yine denenecek.
    // Sebep satıra yazılıyor, yoksa yayın gerçekten durduğunda kimse
    // neden durduğunu bilemezdi (Bölüm 9: sessiz başarısızlık yasak).
    await rest(`/threads_hesaplari?user_id=eq.${k.user_id}`, {
      method: 'PATCH',
      govde: { son_yenileme: simdi, son_hata: `Jeton yenilenemedi (${sebep}).`,
               son_hata_zamani: simdi }
    }).catch(() => {});
    console.warn('[story] threads jetonu yenilenemedi:', sebep);
    return bitis > Date.now() ? { jeton, bitis } : null;
  }

  const yeni = String(v.access_token);
  // expires_in saniye cinsinden geliyor; gelmezse 60 gün varsayılıyor.
  const sure = Number(v.expires_in ?? 60 * 86400) * 1000;
  const yeniBitis = Date.now() + sure;
  await rest(`/threads_hesaplari?user_id=eq.${k.user_id}`, {
    method: 'PATCH',
    govde: { erisim_jetonu: yeni,
             erisim_bitis: new Date(yeniBitis).toISOString(),
             son_yenileme: simdi, guncelleme: simdi,
             son_hata: null, son_hata_zamani: null }
  });
  console.log('[story] threads jetonu yenilendi, yeni bitis:',
    new Date(yeniBitis).toISOString());
  return { jeton: yeni, bitis: yeniBitis };
}

async function threadsDurum(kapsayici: string, jeton: string): Promise<string> {
  try {
    const adres = `${THREADS_TABANI}/${kapsayici}`
      + `?fields=status,error_message&access_token=${encodeURIComponent(jeton)}`;
    const r = await threadsFetch(adres);
    const c = await r.json().catch(() => ({}));
    if (!r.ok) return '';
    if (c?.error_message) {
      console.warn('[story] threads kapsayici hatasi:', temizle(String(c.error_message)));
    }
    return String(c?.status ?? '');
  } catch (e) {
    // SORULAMADI ≠ HAZIR DEĞİL. Boş dönüyoruz; çağıran bekliyor.
    console.warn('[story] threads durum sorulamadi:', temizle((e as Error).message));
    return '';
  }
}

async function threadsCagir(yol: string, alan: Record<string, string>, jeton: string): Promise<any> {
  const govde = new URLSearchParams({ ...alan, access_token: jeton });
  let r: Response;
  try {
    r = await threadsFetch(`${THREADS_TABANI}${yol}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: govde.toString()
    });
  } catch (e) {
    // ⚠ CEVAP GELMEDI ≠ CAGRI YAPILMADI. Yayin cagrisinda bu ayrim
    // hayati: ustteki kurtarma katmani "cikti mi" diye soracak, biz
    // burada "bilmiyorum" diyoruz. Gecici hata (kod 0) olarak
    // isaretleniyor, kalici degil.
    throw new GrafHata(0, null, null,
      'threads cevap vermedi: ' + temizle((e as Error).message));
  }
  const metin = await r.text();
  let cevap: any = {};
  try { cevap = JSON.parse(metin); } catch { cevap = { ham: metin.slice(0, 300) }; }
  if (!r.ok) {
    const h = cevap?.error ?? {};
    throw new GrafHata(r.status, h.code ?? null, h.error_subcode ?? null,
      String(h.message ?? temizle(metin).slice(0, 300)));
  }
  return cevap;
}

// Çöküş sonrası: yayın çağrısı yapıldı mı, sonucu ne? Instagram ve
// Facebook'taki mantığın aynısı -- son gönderilere bakıp çağrı anından
// SONRA çıkmış bir gönderi var mı diye soruyoruz.
//
// ⚠ SORULAMADI ≠ ÇIKMADI. Ayrımı korumak şart: "çıkmadı" sayarsak
// tekrar yayınlarız ve Threads gönderisi profilde KALICI durur.
async function threadsCikmisMi(k: any, cagriAni: string): Promise<{ biliniyor: boolean; id: string }> {
  const an = Date.parse(cagriAni) || 0;
  if (!an) return { biliniyor: false, id: '' };
  // ⚠ JETON TABLODAN. Ortamdaki eskimiş olabilir ve eski jetonla
  // sorulan "çıktı mı" sorusu yetki hatası döner -- yani "bilinmiyor".
  // Bilinmeyen cevap beş dakika gecikme demek, yanlış "çıkmadı"
  // cevabıysa ÇİFT GÖNDERİ.
  const hesap = await threadsJetonu(k);
  if (!hesap) return { biliniyor: false, id: '' };

  // ---- BİRİNCİ TANIK: profildeki son gönderiler --------------------
  // Çağrı anından sonra çıkmış bir gönderi varsa yayın OLMUŞ demektir;
  // bundan daha doğrudan kanıt yok.
  let veri: any = null;
  let okundu = false;
  try {
    const adres = `${THREADS_TABANI}/me/threads`
      + `?fields=id,timestamp&limit=10&access_token=${encodeURIComponent(hesap.jeton)}`;
    const r = await threadsFetch(adres);
    if (!r.ok) {
      console.warn('[story] threads son gonderiler okunamadi:', r.status);
    } else {
      veri = await r.json();
      okundu = true;
    }
  } catch (e) {
    console.warn('[story] threads son gonderiler okunamadi:', temizle((e as Error).message));
  }
  // Saat farkı ve Meta'nın kendi damgası için iki dakikalık pay --
  // Instagram yolundaki eşiğin aynısı.
  const esik = an - 120_000;
  for (const m of (veri?.data ?? [])) {
    const t = Date.parse(String(m?.timestamp ?? ''));
    if (t && t >= esik) return { biliniyor: true, id: String(m.id) };
  }
  // Liste HİÇ okunamadıysa ikinci tanığa gitmenin anlamı yok: tek
  // başına kalan bir tanıkla "çıkmadı" demek istemiyoruz.
  if (!okundu) return { biliniyor: false, id: '' };

  // ---- İKİNCİ TANIK: kapsayıcının durumu --------------------------
  // ⚠ BU BÖLÜM 16 EKIM 2026'DA EKLENDİ, SEBEBİ BİR KİLİTTİ.
  // O güne kadar burada "boş liste çıkmadı demek değil" diyip
  // `bilinmiyor` dönülüyordu. Doğruydu, ama TEK BAŞINA yetersizdi:
  // yayın çağrısı gerçekten patladığında bu soru hiçbir zaman kesin
  // cevap vermiyor, kayıt beş dakikada bir sonsuza kadar erteleniyor
  // ve ne yayın çıkıyor, ne hata e-postası gidiyor. İlk gerçek Threads
  // yayınında tam bu oldu.
  //
  // Threads kapsayıcının durumunu söylüyor ve 'PUBLISHED' ile
  // 'FINISHED' ayrımı tam bizim sorumuzun cevabı: biri çıktı, öbürü
  // çıkmaya hazır ama çıkmadı demek.
  //
  // ⚠ SIRA ÖNEMLİ, TERSİ ÇİFT GÖNDERİ ÜRETİR. Önce liste soruluyor;
  // kapsayıcı durumu yalnızca liste OKUNDU ve içinde yeni gönderi YOK
  // iken karar veriyor. İki tanık birbirini doğruluyor. Tek başına
  // 'FINISHED'e güvenmek, Meta durumu geç güncellerse çıkmış bir
  // gönderiyi "çıkmadı" saymak olurdu -- ve o gönderi profilde KALICI.
  const kapsayici = String(k.publish_ref ?? '');
  if (!kapsayici) return { biliniyor: false, id: '' };
  const durum = await threadsDurum(kapsayici, hesap.jeton);
  // Kapsayıcı yayınlanmış ama liste henüz göstermiyor: gönderi var.
  // Gerçek gönderi kimliğini bilmiyoruz, kapsayıcı kimliği iz olarak
  // yeterli -- yayın yolundaki `kimlik || kapsayici` ile aynı seçim.
  if (durum === 'PUBLISHED') return { biliniyor: true, id: kapsayici };
  // Hazır/hatalı/süresi geçmiş: hiçbiri yayınlanmış değil. Liste de
  // boş geldiğine göre KESİN çıkmadı; çağıran yeniden yayınlayabilir.
  if (durum === 'FINISHED' || durum === 'ERROR' || durum === 'EXPIRED') {
    return { biliniyor: true, id: '' };
  }
  // IN_PROGRESS ya da sorulamadı: cevap yok, beklemeye devam.
  return { biliniyor: false, id: '' };
}

// ══════════════════════════════════════════════════════════════════
// ANKET SECENEKLERI — 16 Ekim 2026
// ══════════════════════════════════════════════════════════════════
// Meta'nin sinirlari (belgeden okundu, uydurulmadi):
//   · 2-4 secenek, her biri 1-25 karakter
//   · YALNIZCA metin gonderisine takilabiliyor (gorselli ankete izin yok)
//   https://developers.facebook.com/documentation/threads/create-posts/polls
//
// ⚠ SINIRLAR UC YERDE OLCULUYOR: burada (yayin ani), app.html'de (kayit
// ani) ve MCP'de (asistan yazarken). Ucu de gerekli: arayuzden gecen
// bir kayit MCP'den gelmemis olabilir, MCP'den gelen kayit arayuzden
// gecmemis olabilir, ve ikisi de atlanirsa hata YAYIN ANINDA ciksin --
// sessiz kalmasin.
const ANKET_EN_AZ = 2;
const ANKET_EN_COK = 4;
const ANKET_SECENEK_TAVAN = 25;

// ⚠ SINIR KARAKTERLE DEGIL BAYTLA OLCULUYOR — 27 EKIM 2026.
// O gun bir anket `#100/4279063 Invalid parameter` ile reddedildi.
// Suclu seçenek: "İstanbul Arkeoloji Müzesi" -- 25 KARAKTER (yani
// belgedeki sınırın tam üstünde, asmiyor) ama 27 BAYT, cunku Turkce
// `İ` ve `ü` ikiser bayt tutuyor. Tek degisken degistirildi (secenek
// kisaltildi), anket ayni gun dort secenegiyle yayinlandi.
//
// Yani Meta'nin 25'i baytla sayiyor. Bayt olcusu karakter olcusunu
// zaten kapsiyor (bayt >= karakter), o yuzden TEK kontrol yetiyor.
//
// ⚠ Bu TEK DENEYE dayaniyor. Alt kod 4279063'un ne demek oldugu
// Meta'nin belgesinde de ucuncu taraflarda da YOK. Baska bir sebep
// cikarsa bu yorum duzeltilsin.
const anketBayt = (s: string) => new TextEncoder().encode(s).length;

function anketSecenekleri(k: any): string[] {
  const c = (k?.content && typeof k.content === 'object') ? k.content : {};
  const ham = Array.isArray(c.anketSecenekler) ? c.anketSecenekler : [];
  // Bos satirlar atiliyor: arayuzde dort kutu var, kullanici ikisini
  // doldurup otekileri bos birakabiliyor.
  return ham.map((x: any) => String(x ?? '').trim()).filter(Boolean);
}

async function threadsYayinla(k: any): Promise<string> {
  // ⚠ JETON TABLODAN, ORTAMDAN DEĞİL. Süreye az kalmışsa burada
  // yenileniyor; ortamdaki tohum ilk yayından sonra eskir.
  const hesap = await threadsJetonu(k);
  if (!hesap) {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: 'Threads jetonu yok ya da süresi dolmuş. Meta panelinden yeni jeton '
             + 'alıp THREADS_TOKEN olarak tanımla; kayıt bekliyor.' });
    return 'jeton-yok';
  }

  // Threads metin sınırı 500. Instagram'da 2200'de kırpıyoruz; burada
  // da kırpmak doğru, çünkü sınırı aşan gövde kapsayıcıyı reddettirir
  // ve bunu YAYIN ANINDA öğrenmek, kayıt anında öğrenmekten pahalı.
  const metin = altYazi(k, 500);
  const gorsel = String(k.media_url ?? '');

  if (!metin && !gorsel) {
    // Ne metin ne görsel: gönderilecek bir şey yok. Kalıcı, çünkü
    // kendiliğinden düzelmez -- kullanıcı kaydı doldurmalı.
    await kaliciHata(k, 'Threads gönderisi boş: ne metin ne görsel var.');
    return 'bos-gonderi';
  }

  const alan: Record<string, string> = gorsel
    ? { media_type: 'IMAGE', image_url: gorsel }
    : { media_type: 'TEXT' };
  if (metin) alan.text = metin;

  // ---- ANKET ---------------------------------------------------------------
  const secenekler = anketSecenekleri(k);
  if (String(k.type ?? '') === 'poll') {
    // ⛔ GORSELLI ANKET OLMUYOR. Gorseli sessizce atmak da olmaz:
    // kullanici onu oraya bilerek koymus ve hangisinden vazgectigini
    // BIZ secemeyiz. Kalici hata + e-posta, karar kullanicinin.
    if (gorsel) {
      await kaliciHata(k, 'Anket yalnızca metin gönderisine eklenebiliyor (Threads kuralı), '
        + 'bu kayda ise görsel bağlı. Görseli kaldır ya da türü Metin postu yap.');
      return 'anket-gorselli';
    }
    if (secenekler.length < ANKET_EN_AZ || secenekler.length > ANKET_EN_COK) {
      await kaliciHata(k, `Ankette ${ANKET_EN_AZ}-${ANKET_EN_COK} seçenek olmalı; `
        + `bu kayıtta ${secenekler.length} var.`);
      return 'anket-sayi';
    }
    // ⚠ UZUN SECENEK KISALTILMIYOR. Sınırı asani kirpmak anketin
    // SORUSUNU degistirir ("Rivayet mi, kayit mi" -> "Rivayet mi, kay");
    // kullanici neyi oyladigini bilmez. Kalici hata, kirpma yok.
    const uzun = secenekler.find((x) => anketBayt(x) > ANKET_SECENEK_TAVAN);
    if (uzun) {
      // Mesaj BAYT demiyor: kullanici yazilimci degil. Soyledigi sey
      // "kac harf fazla" ve "neden" -- Turkce harfler iki yer tutuyor.
      const bayt = anketBayt(uzun);
      await kaliciHata(k, `Anket seçeneği çok uzun (Threads kuralı): `
        + `"${temizle(uzun).slice(0, 40)}". Bu seçenek ${bayt - ANKET_SECENEK_TAVAN} birim fazla — `
        + `Threads ${ANKET_SECENEK_TAVAN} birim kabul ediyor ve Türkçe harfler (ç ğ ı İ ö ş ü) `
        + `iki birim sayılıyor. Seçeneği kısalt.`);
      return 'anket-uzun';
    }
    const anahtarlar = ['option_a', 'option_b', 'option_c', 'option_d'];
    const anket: Record<string, string> = {};
    secenekler.forEach((x, i) => { anket[anahtarlar[i]] = x; });
    alan.poll_attachment = JSON.stringify(anket);
  } else if (secenekler.length) {
    // Tur anket degil ama secenekler yazili: anket GITMIYOR. Sessiz
    // kalmak, kullanicinin yazdigi seceneklerin nereye gittigini
    // sormasina yol acardi.
    console.warn('[story] anket secenekleri var ama tur anket degil, anket gonderilmiyor:',
      k.id, String(k.type ?? '?'));
  }

  const c = await threadsCagir('/me/threads', alan, hesap.jeton);
  const kapsayici = String(c?.id ?? '');
  if (!kapsayici) throw new GrafHata(0, null, null, 'Threads kapsayıcı kimliği dönmedi');
  await rpc('story_iz_konteyner', { p_id: k.id, p_ref: kapsayici });

  // Görselde işlenme bekleniyor. Metin gönderisinde de kısa bir pay
  // bırakılıyor: hazır olmadan yapılan yayın çağrısı hata veriyor.
  const tur = gorsel ? 10 : 3;
  for (let i = 0; i < tur; i++) {
    const d = await threadsDurum(kapsayici, hesap.jeton);
    if (d === 'FINISHED') break;
    if (d === 'ERROR') {
      await kaliciHata(k, 'Threads kapsayıcıyı işleyemedi (görsel adresine ulaşamamış olabilir).');
      return 'kapsayici-hata';
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  // ⚠ İZ, YAYINLAYAN ÇAĞRIDAN HEMEN ÖNCE. Kapsayıcı yaratmak
  // yayınlamıyor, o yüzden oradaki bir çöküş çift gönderi üretemez.
  await rpc('story_iz_yayin_cagrisi', { p_id: k.id });
  const y = await threadsCagir('/me/threads_publish', { creation_id: kapsayici }, hesap.jeton);
  const kimlik = String(y?.id ?? '');
  await rpc('story_yayinlandi', { p_id: k.id, p_external_id: kimlik || kapsayici });
  return 'yayinlandi';
}

// ══════════════════════════════════════════════════════════════════
// ANKETİN CEVABI — 24 saat sonra, anketin ALTINA yanıt (16 Ekim 2026)
// ══════════════════════════════════════════════════════════════════
// NEDEN. Kanalın iddiası "rivayet değil, kayıt". Soruyu sorup cevabı
// vermemek o iddianın tersi. Cevap, hiç oy gelmese de gidiyor.
//
// NASIL. Threads'te "dizi" diye bir şey yok; zincir YANIT üzerinden
// kuruluyor: kapsayıcıya `reply_to_id` verildiğinde gönderi o
// gönderinin altına düşüyor. Kendi gönderimize yanıt yazmak için ek
// izin gerekmiyor.
// https://developers.facebook.com/documentation/threads/retrieve-and-manage-replies/create-replies
//
// ⛔ CEVAP AYRI BİR TAKVİM KAYDI DEĞİL: anketin kendi içinde
// (`content.anketCevap`). Tek tik, iki gönderi. Ayrı kayıt olsaydı her
// anket için ikinci bir tik gerekirdi ve biri açılmazsa cevap sessizce
// düşerdi.
//
// ⚠ KUYRUĞA YAZAN YER BURASI DEĞİL, sql/65'teki
// `threads_yanit_kuyruga_al`. Worker yayın anında satır yazsaydı, bu
// işten ÖNCE yayınlanmış anketlerin ve cevabı sonradan yazılan
// anketlerin cevabı hiç gitmezdi.
const YANIT_BASINA = 3;

// Çöküş sonrası: yanıt çağrısı yapıldı, sonucu bilinmiyor. Burada ana
// yayın yolundan DAHA İYİ bir kanıt var: kendi gönderimizin
// yanıtlarını listeleyebiliyoruz, yani "çıktı mı" sorusunun kesin
// cevabı alınabiliyor.
async function yanitCikmisMi(y: any, jeton: string): Promise<{ biliniyor: boolean; id: string }> {
  const an = Date.parse(String(y.cagri_ani ?? '')) || 0;
  if (!an) return { biliniyor: false, id: '' };
  let veri: any = null;
  try {
    const adres = `${THREADS_TABANI}/${encodeURIComponent(String(y.ana_gonderi_id))}/replies`
      + `?fields=id,text,timestamp&limit=25&access_token=${encodeURIComponent(jeton)}`;
    const r = await threadsFetch(adres);
    if (!r.ok) {
      console.warn('[story] threads yanitlar okunamadi:', r.status);
      return { biliniyor: false, id: '' };
    }
    veri = await r.json();
  } catch (e) {
    console.warn('[story] threads yanitlar okunamadi:', temizle((e as Error).message));
    return { biliniyor: false, id: '' };
  }
  // Saat farkı için iki dakikalık pay -- ana yoldaki eşiğin aynısı.
  const esik = an - 120_000;
  const bizim = String(y.metin ?? '').trim().slice(0, 40);
  for (const m of (veri?.data ?? [])) {
    const t = Date.parse(String(m?.timestamp ?? ''));
    const metin = String(m?.text ?? '');
    // İKİ TANIK: zaman damgası VE metnin kendisi. Yalnızca zamana
    // bakmak, o anda gelen BAŞKA birinin yanıtını bizim sanmak olurdu
    // -- ve cevabımız hiç gitmezdi.
    if (t && t >= esik && (!bizim || metin.startsWith(bizim))) {
      return { biliniyor: true, id: String(m.id ?? '') };
    }
  }
  // ⚠ LİSTE OKUNDU VE BİZİM YANIT YOK: kesin çıkmadı. Ana yayın
  // yolunda bu kesinlik yoktu (profil listesi gecikebiliyor) ve bir
  // kayıt sonsuza kadar kilitlenmişti; burada gönderinin KENDİ
  // yanıtlarına bakıyoruz, gecikme payı da bırakılmış durumda.
  return { biliniyor: true, id: '' };
}

async function yanitiGonder(y: any): Promise<string> {
  const hesap = await threadsJetonu({ user_id: y.user_id });
  if (!hesap) {
    await rpc('threads_yanit_ertele', { p_id: y.id, p_dakika: 180,
      p_sebep: 'Threads jetonu yok ya da süresi dolmuş; cevap bekliyor.' });
    return 'jeton-yok';
  }
  // Threads metin sınırı 500 -- yayın yolundaki tavanın aynısı.
  const metin = String(y.metin ?? '').trim().slice(0, 500);
  if (!metin) {
    await rpc('threads_yanit_hata', { p_id: y.id, p_hata: 'Cevap metni boş.', p_kalici: true });
    return 'bos-cevap';
  }
  // ⛔ HEDEFİ OLMAYAN YANIT ATILMIYOR. `reply_to_id` olmadan atılan bir
  // dizi parçası, profilde BAĞIMSIZ BİR GÖNDERİ olarak çıkar ve geri
  // alınamaz -- zincirin ortasındaki cümle tek başına, bağlamsız
  // durur. sql/66'da `ana_gonderi_id` NOT NULL'dan çıktı (dizinin 2.
  // parçası kuyruğa girerken hedefi henüz yok); bu satır o güvenlik
  // ağının yerine geçiyor.
  const hedef = String(y.ana_gonderi_id ?? '').trim();
  if (!hedef) {
    await rpc('threads_yanit_hata', { p_id: y.id,
      p_hata: 'Yanıtın altına yazılacağı gönderi bilinmiyor; zincir kurulamadı.', p_kalici: true });
    return 'hedef-yok';
  }

  // ---- Çöküş izi -----------------------------------------------------------
  if (y.cagri_ani) {
    const { biliniyor, id } = await yanitCikmisMi(y, hesap.jeton);
    if (!biliniyor) {
      await rpc('threads_yanit_ertele', { p_id: y.id, p_dakika: 5,
        p_sebep: 'Yanıt çağrısının sonucu bilinmiyor; çift yanıt olmasın diye bekleniyor.' });
      return 'kurtarma-belirsiz';
    }
    if (id) {
      await rpc('threads_yanit_bitti', { p_id: y.id, p_gonderi_id: id });
      return 'kurtarildi-yanitta';
    }
    console.log('[story] yanıt çağrısı sonuçsuz kalmış, çıkmamış — tekrar gönderiliyor', y.id);
  }

  try {
    const c = await threadsCagir('/me/threads',
      { media_type: 'TEXT', text: metin, reply_to_id: hedef }, hesap.jeton);
    const kapsayici = String(c?.id ?? '');
    if (!kapsayici) throw new GrafHata(0, null, null, 'Threads kapsayıcı kimliği dönmedi');
    // Metin yanıtında işlenme kısa; yine de hazır olmadan yayınlamak
    // hata veriyor.
    for (let i = 0; i < 3; i++) {
      const d = await threadsDurum(kapsayici, hesap.jeton);
      if (d === 'FINISHED') break;
      if (d === 'ERROR') {
        await rpc('threads_yanit_hata', { p_id: y.id,
          p_hata: 'Threads kapsayıcıyı işleyemedi (yanıt).', p_kalici: true });
        return 'kapsayici-hata';
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    // ⚠ İZ, YAYINLAYAN ÇAĞRIDAN HEMEN ÖNCE.
    await rpc('threads_yanit_iz', { p_id: y.id });
    const r = await threadsCagir('/me/threads_publish', { creation_id: kapsayici }, hesap.jeton);
    await rpc('threads_yanit_bitti', { p_id: y.id, p_gonderi_id: String(r?.id ?? kapsayici) });
    // Hangi parça gitti: teşhis anında "bir yanıt gitti" hiçbir şey
    // anlatmıyor. tur/sira sql/66'da dönüş sütunlarına eklendi.
    console.log('[story] yanıt gitti', String(y.kayit_id ?? '?'),
      String(y.tur ?? 'cevap'), String(y.sira ?? 0));
    return String(y.tur ?? '') === 'dizi' ? 'dizi-parcasi' : 'yanitlandi';
  } catch (e) {
    const { kova, mesaj } = siniflandir(e);
    // Loga da yazılıyor -- 16 Ekim dersi: veritabanındaki mesajın
    // üstüne yazılabiliyor, logdaki kalıyor.
    console.error('[story] yanıt hatası', y.id, String(y.kayit_id ?? '?'), kova, temizle(mesaj));
    await rpc('threads_yanit_hata', { p_id: y.id, p_hata: mesaj, p_kalici: kova === 'kalici' });
    return kova === 'kalici' ? 'yanit-kalici-hata' : 'yanit-gecici-hata';
  }
}

async function yanitlariIsle(bitis: number): Promise<Record<string, number>> {
  const sonuc: Record<string, number> = {};
  let liste: any[] = [];
  try {
    const asili = Number(await rpc('threads_yanit_asili_topla', { p_dakika: 10 })) || 0;
    if (asili) console.log('[story]', asili, 'asılı yanıt kuyruğa geri alındı');
    const eklenen = Number(await rpc('threads_yanit_kuyruga_al', {})) || 0;
    if (eklenen) console.log('[story]', eklenen, 'anket cevabı kuyruğa alındı');
    const r = await rpc('threads_yanit_al', { p_limit: YANIT_BASINA });
    liste = Array.isArray(r) ? r : [];
  } catch (e) {
    // sql/65 henüz çalıştırılmamış olabilir (dağıtım sırası): tur
    // devam etsin, story yayını bundan etkilenmesin.
    console.warn('[story] yanıt kuyruğu çağrılamadı (sql/65 çalıştırıldı mı?):',
      temizle((e as Error).message));
    return sonuc;
  }
  // ⚠ ZİNCİR AYNI TURDA İLERLİYOR. Dizinin 2. parçası, 1. parça
  // yayınlanmadan kuyruktan ALINMIYOR (sql/66'daki sıra şartı) -- yani
  // tek geçişte yalnızca bir parça giderdi ve beş parçalı bir dizi beş
  // dakikaya yayılırdı. Okuyan kişi için zincirin arası açılmış olur.
  // O yüzden parça gittikçe kuyruk yeniden soruluyor.
  for (let gecis = 0; gecis < 5 && liste.length; gecis++) {
    for (const y of liste) {
      if (Date.now() > bitis - 15_000) {
        await rpc('threads_yanit_ertele', { p_id: y.id, p_dakika: 0,
          p_sebep: 'Tur bütçesi doldu, sıradaki turda.' });
        sonuc['yanit-butce-bitti'] = (sonuc['yanit-butce-bitti'] ?? 0) + 1;
        continue;
      }
      const s = await yanitiGonder(y);
      sonuc[s] = (sonuc[s] ?? 0) + 1;
    }
    if (Date.now() > bitis - 20_000) break;
    try {
      const r = await rpc('threads_yanit_al', { p_limit: YANIT_BASINA });
      liste = Array.isArray(r) ? r : [];
    } catch { liste = []; }
  }
  return sonuc;
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
// ══════════════════════════════════════════════════════════════════
// TIKTOK — İKİ YOL
// ══════════════════════════════════════════════════════════════════
// Hesapta `video.publish` kapsamı varsa DOĞRUDAN YAYIN, yoksa taslak.
// Karar tiktokYayinla içinde, kapsam listesine bakılarak veriliyor.
//
// ⛔ TASLAK YOLU YAYIN DEĞİL, TESLİMDİR.
// Kullanılan uç `/v2/post/publish/inbox/video/init/`: video kullanıcının
// TikTok GELEN KUTUSUNA taslak olarak düşüyor, paylaşmayı kullanıcı
// yapıyor. Doğrudan yayın (`video.publish`) TikTok denetiminden geçmiş
// uygulamalara açık; denetimsiz istemcinin gönderileri "yalnız ben"
// görünürlüğüne kilitleniyor.
//
// ⚠ TASLAK METİN TAŞIMIYOR. Bu ucun gövdesinde alt yazı alanı YOK
// (`post_info` yalnızca doğrudan yayın ucunda). Yani `content.caption`
// ve etiketler TikTok'a GİTMİYOR; kullanıcı uygulamada yazıyor.
// Instagram ve Facebook'ta gidiyor -- aradaki farkı bilmeyen biri
// "TikTok'ta alt yazım nerede" diye kodda arar, o yüzden burada yazıyor.

// Kullanıcının jetonu. Süresi dolmuşsa yenileyip saklıyor.
// ⚠ JETONLA BIRLIKTE KAPSAMLAR DA DONUYOR. Dogrudan yayin karari
// `video.publish` kapsaminin GERCEKTEN verilmis olmasina bagli ve bu
// bilgi yalnizca burada okunan satirda var. Ayri bir sorgu yazmak,
// ayni satiri iki kez cekmek olurdu.
type TTHesap = { jeton: string; kapsamlar: string[] };
async function tiktokJetonu(k: any): Promise<TTHesap | null> {
  const satirlar = await rest(
    `/tiktok_hesaplari?user_id=eq.${k.user_id}&select=*&limit=1`);
  const h = Array.isArray(satirlar) ? satirlar[0] : null;
  if (!h) return null;
  const kapsamlar = Array.isArray(h.kapsamlar) ? h.kapsamlar.map(String) : [];

  // 60 saniyelik pay: yükleme uzun sürüyor, tam sınırda başlayan bir
  // aktarım ortasında jeton ölürse parçalar yarıda kalır.
  const bitis = Date.parse(String(h.erisim_bitis ?? '')) || 0;
  if (bitis > Date.now() + 60_000) return { jeton: String(h.erisim_jetonu || ''), kapsamlar };

  if (!h.yenileme_jetonu) return null;
  const govde = new URLSearchParams({
    client_key: TIKTOK_KEY, client_secret: TIKTOK_SECRET,
    grant_type: 'refresh_token', refresh_token: String(h.yenileme_jetonu)
  });
  const r = await fetch(TT_JETON, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: govde.toString()
  });
  const v = await r.json().catch(() => null);
  if (!r.ok || !v?.access_token) return null;

  const simdi = Date.now();
  await rest(`/tiktok_hesaplari?user_id=eq.${k.user_id}`, {
    method: 'PATCH',
    govde: {
      erisim_jetonu:   String(v.access_token),
      erisim_bitis:    new Date(simdi + Number(v.expires_in ?? 86400) * 1000).toISOString(),
      // Yenileme jetonu da dönüyor; dönmezse eskisi duruyor.
      yenileme_jetonu: String(v.refresh_token ?? h.yenileme_jetonu),
      guncelleme:      new Date(simdi).toISOString()
    }
  });
  return { jeton: String(v.access_token), kapsamlar };
}

// Çöküş izi kurtarması. IG/FB'de "son gönderiler" listesine bakılıyor;
// TikTok'ta öyle bir liste yok, ama başlatma bize bir publish_id veriyor
// ve durumu sorulabiliyor.
async function tiktokCikmisMi(k: any): Promise<{ biliniyor: boolean; id: string }> {
  if (!k.publish_ref) return { biliniyor: true, id: '' };
  const hesap = await tiktokJetonu(k);
  if (!hesap?.jeton) return { biliniyor: false, id: '' };
  try {
    const r = await fetch(TT_DURUM, {
      method: 'POST',
      headers: { authorization: `Bearer ${hesap.jeton}`, 'content-type': 'application/json' },
      body: JSON.stringify({ publish_id: String(k.publish_ref) })
    });
    const v = await r.json().catch(() => null);
    if (!r.ok) return { biliniyor: false, id: '' };
    const durum = String(v?.data?.status ?? '');
    // Taslağa düşmüş sayılan durumlar. FAILED ise çıkmamış demektir ve
    // yeniden denenebilir; ötekiler "hâlâ işleniyor" -- o zaman BİLMİYORUZ
    // ve beklemek, ikinci kez yüklemekten iyidir.
    if (durum === 'SEND_TO_USER_INBOX' || durum === 'PUBLISH_COMPLETE') {
      return { biliniyor: true, id: String(k.publish_ref) };
    }
    if (durum === 'FAILED') return { biliniyor: true, id: '' };
    return { biliniyor: false, id: '' };
  } catch {
    return { biliniyor: false, id: '' };
  }
}

// ──────────────────────────────────────────────────────────────────
// DOGRUDAN YAYIN: TikTok'un O HESAPTA neye izin verdigi.
//
// ⚠ BU SORGU ATLANAMAZ. `privacy_level`, creator_info'nun dondurdugu
// `privacy_level_options` listesinden SECILMEK ZORUNDA; listede olmayan
// bir deger gonderilirse init reddediliyor. Yani dogru gizlilik
// seviyesini kod bilemez, TikTok soyler.
//
// Ayni cevap yorum/duet/dikis kisitlarini da tasiyor: kullanici hesap
// ayarlarindan yorumu kapattiysa `disable_comment: false` gondermek
// hata. Kendi varsayilanimizi dayatmak yerine hesabin dediğini
// yansitiyoruz.
async function tiktokKisiBilgisi(jeton: string): Promise<any | null> {
  try {
    const r = await fetch(TT_KISI, {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`,
                 'content-type': 'application/json; charset=UTF-8' }
    });
    const v = await r.json().catch(() => null);
    if (!r.ok) return null;
    return v?.data ?? null;
  } catch {
    return null;
  }
}

// TikTok'un verdigi listeden gizlilik seviyesi. SIRA TERCIH SIRASI:
// en genisten en dara. Denetim gecmemis bir istemcide liste yalnizca
// SELF_ONLY iceriyor ve kod kendiliginden ona dusuyor -- yani denetim
// onaylandiginda BURADA HICBIR SEY DEGISMIYOR, liste genisliyor ve
// yayin herkese acik olmaya basliyor.
const TT_GIZLILIK_SIRASI = ['PUBLIC_TO_EVERYONE', 'FOLLOWER_OF_CREATOR',
                            'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'];
function tiktokGizlilik(secenekler: unknown): string {
  const liste = Array.isArray(secenekler) ? secenekler.map(String) : [];
  for (const tercih of TT_GIZLILIK_SIRASI) {
    if (liste.includes(tercih)) return tercih;
  }
  // Liste bos ya da taninmayan degerler: en dar olani. Genis bir
  // varsayilan, kullanicinin gormedigi bir videoyu herkese acardi.
  return 'SELF_ONLY';
}

// ⚠ ALT YAZI TAVANI DOGRULANMIS DEGIL. TikTok belgeleri `title` icin
// "the video caption" diyor, uzunluk yazmiyor (12 Ekim 2026'da arandi).
// Ucuncu taraf kilavuzlar 90 ile 4000 arasinda celisiyor. Uygulamanin
// kendisi 2200 kabul ediyor, o yuzden tavan o: asilirsa hata init'te
// doner (dosya yuklenmeden), yani bedeli ucuz ve mesaji gorunur.
const TT_BASLIK = 2200;

// Parcali yukleme. IKI YOL DA AYNI: taslak ucu da dogrudan yayin ucu da
// ayni upload_url'i veriyor. Tek kopya duruyor ki biri duzelirse oteki
// de duzelsin.
async function tiktokParcalariYukle(k: any, adres: string, boyut: number,
                                    parca: number, adet: number): Promise<void> {
  // ⚠ DOSYA BELLEĞE ALINMIYOR. R2'den Range ile okunup ayni anda
  // TikTok'a veriliyor. 150 MB'lik bir reel'i bellege almak Edge
  // Function'i oldururdu.
  for (let i = 0; i < adet; i++) {
    const basBayt = i * parca;
    const sonBayt = (i === adet - 1) ? boyut - 1 : (basBayt + parca - 1);
    const medya = await fetch(String(k.media_url), {
      headers: { range: `bytes=${basBayt}-${sonBayt}` }
    });
    if (!medya.ok || !medya.body) {
      throw new GrafHata(medya.status, null, null,
        `Medya parçası alınamadı (${basBayt}-${sonBayt}); adres ${medya.status} döndürdü.`);
    }
    const y = await fetch(adres, {
      method: 'PUT',
      headers: {
        'content-type': String(k.media_mime || 'video/mp4'),
        'content-length': String(sonBayt - basBayt + 1),
        'content-range': `bytes ${basBayt}-${sonBayt}/${boyut}`
      },
      body: medya.body,
      ...({ duplex: 'half' } as any)
    });
    if (!y.ok) {
      const metin = await y.text().catch(() => '');
      throw new GrafHata(y.status, null, null,
        `TikTok parça ${i + 1}/${adet} yüklenemedi: ` + temizle(metin).slice(0, 200));
    }
  }
}

async function tiktokYayinla(k: any): Promise<string> {
  const hesap = await tiktokJetonu(k);
  const jeton = hesap?.jeton || '';
  if (!jeton) {
    // HATA DEĞİL ERTELEME: kullanıcı hesabını bağlamamış ya da yetkiyi
    // geri almış olabilir. Bağladığı gün elle hiçbir şey yapmadan akar.
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: 'TikTok hesabı bağlı değil (ya da yetki yenilenemedi). '
             + 'shootboard.app/tiktok.html adresinden bağla.' });
    return 'tiktok-bagli-degil';
  }

  const boyut = Number(k.media_bytes) || 0;
  if (!boyut) {
    await kaliciHata(k, 'Dosya boyutu bilinmiyor; TikTok video_size istiyor.');
    return 'boyut-yok';
  }

  // ⚠ PARÇA SAYISI TikTok'un FORMÜLÜYLE: floor(boyut / parça).
  // Kendi hesabımızı yapıp yuvarlasaydık son parça ya eksik ya fazla
  // olurdu; TikTok toplamı bu formülle doğruluyor.
  const parca = boyut <= TT_PARCA ? boyut : TT_PARCA;
  const adet  = boyut <= TT_PARCA ? 1 : Math.floor(boyut / TT_PARCA);
  const kaynak = { source: 'FILE_UPLOAD', video_size: boyut,
                   chunk_size: parca, total_chunk_count: adet };

  // ══════════════════════════════════════════════════════════════
  // HANGİ YOL: doğrudan yayın mı, taslak mı
  //
  // ⚠ KARAR HESABIN VERDİĞİ İZİNDEN, AYARDAN DEĞİL. `video.publish`
  // kapsamı gerçekten verilmemişse doğrudan yayın ucu 401/403 döner ve
  // yayın o gün kaçar. Kapsam listesi bağlanma anında saklanıyor
  // (tiktok_hesaplari.kapsamlar), kontrol bedava.
  //
  // Yani TikTok denetimi onaylanıp kullanıcı hesabı yeniden
  // bağladığında kod KENDİLİĞİNDEN doğrudan yayına geçiyor; burada
  // değiştirilecek bir şey yok.
  // ══════════════════════════════════════════════════════════════
  const dogrudan = (hesap?.kapsamlar || []).includes('video.publish');

  if (!dogrudan) {
    // ── TASLAĞA BIRAKMA (bugünkü yol) ──────────────────────────────
    // ⚠ TASLAK METİN TAŞIMIYOR: bu ucun gövdesinde `post_info` YOK.
    // Alt yazı ve etiketler TikTok'a GİTMİYOR, kullanıcı uygulamada
    // yazıyor. Doğrudan yayına geçince gidiyor.
    const bas = await fetch(TT_INBOX, {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`,
                 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ source_info: kaynak })
    });
    const basV = await bas.json().catch(() => null);
    const adres     = String(basV?.data?.upload_url ?? '');
    const publishId = String(basV?.data?.publish_id ?? '');
    if (!bas.ok || !adres || !publishId) {
      throw new GrafHata(bas.status, null, null,
        'TikTok yükleme başlatılamadı: ' + temizle(JSON.stringify(basV ?? {})).slice(0, 300));
    }
    await rpc('story_iz_konteyner', { p_id: k.id, p_ref: publishId });
    await tiktokParcalariYukle(k, adres, boyut, parca, adet);
    await rpc('story_iz_yayin_cagrisi', { p_id: k.id });
    await rpc('story_yayinlandi', { p_id: k.id, p_external_id: publishId });
    return 'taslaga-birakildi';
  }

  // ── DOĞRUDAN YAYIN ───────────────────────────────────────────────
  const bilgi = await tiktokKisiBilgisi(jeton);
  if (!bilgi) {
    // ERTELEME: creator_info geçici olarak da düşebiliyor. Bu sorgu
    // olmadan gizlilik seviyesi seçilemez, tahmin etmek init'i
    // reddettirir.
    await rpc('story_ertele', { p_id: k.id, p_dakika: 30,
      p_sebep: 'TikTok hesap bilgisi (creator_info) alınamadı; '
             + 'gizlilik seviyesi onsuz seçilemiyor.' });
    return 'tiktok-bilgi-yok';
  }

  // ⚠ SÜRE TAVANI BURADA DENETLENMİYOR, çünkü denetleyecek veri YOK:
  // kayıtta videonun süresi tutulmuyor (media_bytes var, süre yok).
  // creator_info `max_video_post_duration_sec` döndürüyor ama
  // karşılaştıracak ikinci sayı olmadan o değer işe yaramaz.
  // Tavan aşılırsa TikTok yükleme sonrası hata döndürür ve mesaj
  // lastError'a düşer. Olmayan bir alana bakan bir `if` yazmak, hiç
  // çalışmayan ama kontrol varmış izlenimi veren bir satır olurdu.

  const govde = {
    source_info: kaynak,
    post_info: {
      title: altYazi(k, TT_BASLIK),
      privacy_level: tiktokGizlilik(bilgi.privacy_level_options),
      // ⚠ HESABIN AYARI AYNEN YANSITILIYOR. Kullanıcı yorumu hesap
      // ayarından kapattıysa `false` göndermek hata döndürüyor.
      disable_comment: bilgi.comment_disabled === true,
      disable_duet:    bilgi.duet_disabled    === true,
      disable_stitch:  bilgi.stitch_disabled  === true
    }
  };

  const bas = await fetch(TT_DIREKT, {
    method: 'POST',
    headers: { authorization: `Bearer ${jeton}`,
               'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(govde)
  });
  const basV = await bas.json().catch(() => null);

  // ⚠ DENETİM KAPISI, ANLAŞILIR MESAJLA.
  // Denetimden geçmemiş bir istemci HERKESE AÇIK bir hesaba doğrudan
  // yayın yapamıyor; TikTok 403 ve bu kodu döndürüyor. Ham JSON yerine
  // ne yapılacağını yazıyoruz -- bu hata aylarca görülebilir.
  const hataKodu = String(basV?.error?.code ?? '');
  if (hataKodu === 'unaudited_client_can_only_post_to_private_accounts') {
    await rpc('story_ertele', { p_id: k.id, p_dakika: 720,
      p_sebep: 'TikTok uygulama denetimi henüz onaylanmadı. Denetimsiz '
             + 'istemci, herkese açık bir hesaba doğrudan yayın yapamıyor. '
             + 'Onay gelene kadar bu videoyu elle at.' });
    return 'tiktok-denetim-yok';
  }

  const adres     = String(basV?.data?.upload_url ?? '');
  const publishId = String(basV?.data?.publish_id ?? '');
  if (!bas.ok || !adres || !publishId) {
    throw new GrafHata(bas.status, null, null,
      'TikTok doğrudan yayın başlatılamadı: ' + temizle(JSON.stringify(basV ?? {})).slice(0, 300));
  }
  await rpc('story_iz_konteyner', { p_id: k.id, p_ref: publishId });
  await tiktokParcalariYukle(k, adres, boyut, parca, adet);
  await rpc('story_iz_yayin_cagrisi', { p_id: k.id });
  await rpc('story_yayinlandi', { p_id: k.id, p_external_id: publishId });
  return 'dogrudan-yayinlandi';
}

// ══════════════════════════════════════════════════════════════════
// YOUTUBE SHORTS — YÜKLEME
// ══════════════════════════════════════════════════════════════════
// ⛔ EN ÖNEMLİ ŞEY: DENETİMDEN ÖNCE YÜKLENEN VİDEO GÖMÜLÜYOR.
//
// YouTube, API denetiminden (YouTube API Services Compliance Audit)
// geçmemiş bir Google Cloud projesinden `videos.insert` ile yüklenen
// her videoyu "özel"e kilitliyor. İstekte `privacyStatus: 'public'`
// yazsak da fark etmiyor ve kilit GERİ ALINAMIYOR: video Studio'dan
// bile herkese açık yapılamıyor. Yani denetim onaylanmadan yüklemek,
// videoyu yayınlamak değil ÇÖPE ATMAK.
//
// Bu yüzden kaydiYayinla'da bir kapı var: `YOUTUBE_DENETIM_GECTI`
// tanımlı değilse YouTube kayıtları ERTELENİYOR. İSTİSNASIZ.
//
// 30 Eylül 2026'ya kadar bir istisna vardı: `content.youtubeDeneme`
// bayrağını taşıyan kayıt kapıyı geçiyordu. Başvuru için gereken
// deneme yüklemesi yapıldıktan sonra kullanıcı deliğin tamamen
// kapanmasını istedi -- açık kalan bir kaçış yolu, er ya da geç
// yanlış kayda yazılır ve o video geri alınamaz şekilde gömülür.
//
// DOĞRU SIRA:
//   1. Hesabı bağla (shootboard.app/youtube.html)
//   2. Denetim başvurusunu yap
//   3. Onay gelince YOUTUBE_DENETIM_GECTI=1 tanımla
//   4. Kayıtlar akmaya başlar
//
// ⚠ Onay gelmeden bir yükleme denemek gerekirse YOUTUBE_DENETIM_GECTI
// geçici olarak tanımlanır ve hemen geri alınır. Bu bilinçli: kapıyı
// açmak Supabase paneline girmeyi gerektiriyor, bir takvim kaydına
// alan yazmayı değil.
//
// ══════════════════════════════════════════════════════════════════
// GÖRÜNÜRLÜK: 'private' VARSAYILAN VE BU BİLİNÇLİ
// ══════════════════════════════════════════════════════════════════
// Denetim onaylandıktan sonra bile varsayılan 'private'. Değiştirmek
// için `YOUTUBE_GORUNURLUK=public` tanımlanıyor. Sebep: bu hattaki
// her şey (dosya, başlık, açıklama) otomatik geliyor ve bir kez
// herkese açık çıkan video geri alınamıyor -- izlenmesi, bildirim
// gitmesi, indirilmesi geri alınamıyor. Özel çıkan bir videoyu
// herkese açık yapmak ise tek tık.
//
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// ⚠ KAPAK (cover_url) YOUTUBE'A GİTMİYOR — BİLEREK
// ══════════════════════════════════════════════════════════════════
// Reels kaydının kapağı Instagram'a gidiyor; Shorts'ta GİTMİYOR ve
// bunun iki sebebi var:
//   1. YouTube'da kapak ayrı bir çağrı (thumbnails.set), yüklemenin
//      parçası değil.
//   2. Özel kapak yalnızca DOĞRULANMIŞ kanallarda çalışıyor; kanal
//      doğrulanmamışsa çağrı hata veriyor.
// Shorts akışı zaten videodan kare kullanıyor, yani kaybın pratik
// bedeli yok. Burada yazıyor ki biri `cover_url` dolu bir Shorts
// kaydına bakıp "kapağım neden çıkmadı" diye kodda aramasın.
//
// ⚠ ÇOCUKLARA YÖNELİK BEYANI
// ══════════════════════════════════════════════════════════════════
// `selfDeclaredMadeForKids` bir ayar değil, HUKUKİ BİR BEYAN (COPPA).
// Varsayılan `false` -- kanal yetişkinlere yönelik tarih/arkeoloji
// içeriği üretiyor. Bir kayıt için değiştirilmesi gerekirse
// content.madeForKids = true.
//
// ══════════════════════════════════════════════════════════════════
// SÜRDÜRÜLEBİLİR YÜKLEME (resumable) — ÇÖKÜŞ İZİ NASIL ÇALIŞIYOR
// ══════════════════════════════════════════════════════════════════
// Google iki adım istiyor: önce üstverilerle bir OTURUM açılıyor
// (cevabın `Location` başlığında oturum adresi geliyor), sonra dosya
// o adrese parça parça PUT ediliyor.
//
// publish_ref  = oturum adresi (video kimliği DEĞİL -- kimlik ancak
//                son parçadan sonra geliyor)
// publish_called_at = SON parçadan hemen önce
//
// Yani iz varken publish_called_at boşsa son parça hiç başlamamış ve
// HİÇBİR video oluşmamış olabilir: baştan başlamak güvenli. Doluysa
// sonuç bilinmiyor ve oturum adresine sorulabiliyor (youtubeCikmisMi).
// TikTok'taki mantığın aynısı, farklı bir uçla.

// Kullanıcının jetonu. Süresi dolmuşsa yenileyip saklıyor.
//
// ⚠ GOOGLE ERİŞİM JETONU BİR SAAT YAŞIYOR (TikTok'ta 24 saat), yani
// bu yenileme neredeyse her yüklemede çalışacak. TikTok'ta ayda bir
// çalışan bir yol burada günde yirmi kez çalışıyor: hatası da o
// sıklıkta görünür, sessiz kalmaz.
async function youtubeJetonu(k: any): Promise<string | null> {
  const satirlar = await rest(
    `/youtube_hesaplari?user_id=eq.${k.user_id}&select=*&limit=1`);
  const h = Array.isArray(satirlar) ? satirlar[0] : null;
  if (!h) return null;

  // 60 saniyelik pay: yükleme uzun sürüyor, tam sınırda başlayan bir
  // aktarım ortasında jeton ölürse parçalar yarıda kalır.
  const bitis = Date.parse(String(h.erisim_bitis ?? '')) || 0;
  if (bitis > Date.now() + 60_000) return String(h.erisim_jetonu || '');

  if (!h.yenileme_jetonu) return null;
  const govde = new URLSearchParams({
    client_id: YOUTUBE_ID, client_secret: YOUTUBE_SECRET,
    grant_type: 'refresh_token', refresh_token: String(h.yenileme_jetonu)
  });
  const r = await fetch(YT_JETON, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: govde.toString()
  });
  const v = await r.json().catch(() => null);
  if (!r.ok || !v?.access_token) {
    // ⚠ SEBEBİ SATIRA YAZIYORUZ. En olası sebep `invalid_grant` ve o
    // tek bir şey demek: yenileme jetonu iptal edilmiş. İzin ekranı
    // "Testing" durumuna alındıysa Google jetonları YEDİ GÜNDE iptal
    // ediyor (sql/52'nin başında). Bu satır olmadan kullanıcı yalnızca
    // "YouTube hesabı bağlı değil" görürdü -- oysa bağlıydı.
    const sebep = String(v?.error ?? `HTTP ${r.status}`);
    await rest(`/youtube_hesaplari?user_id=eq.${k.user_id}`, {
      method: 'PATCH',
      govde: {
        son_hata: `Jeton yenilenemedi (${sebep}). Yeniden bağlanmak gerekiyor.`,
        son_hata_zamani: new Date().toISOString()
      }
    }).catch(() => {});
    return null;
  }

  const simdi = Date.now();
  await rest(`/youtube_hesaplari?user_id=eq.${k.user_id}`, {
    method: 'PATCH',
    govde: {
      erisim_jetonu:   String(v.access_token),
      erisim_bitis:    new Date(simdi + Number(v.expires_in ?? 3600) * 1000).toISOString(),
      // ⚠ BU SATIR TikTok'takiyle AYNI ve `??` dalı burada KURAL,
      // orada istisna: Google yenileme cevabında yeni bir yenileme
      // jetonu göndermiyor, yani her seferinde eski değer yazılıyor.
      // TikTok gönderiyor ve oradaki satır çoğunlukla yeni değeri
      // yazıyor. Aynı satır, iki farklı sebeple doğru -- ve ayrışmasın
      // diye aynı bırakıldı.
      yenileme_jetonu: String(v.refresh_token ?? h.yenileme_jetonu),
      guncelleme:      new Date(simdi).toISOString(),
      son_hata:        null,
      son_hata_zamani: null
    }
  });
  return String(v.access_token);
}

// YouTube başlığı. 100 karakter sınırı Google'ın.
//
// ⚠ `<` VE `>` BAŞLIĞI REDDETTİRİYOR (invalidVideoMetadata) ve hata
// yükleme BİTTİKTEN sonra dönüyor -- yani dosya gitmiş, video yok.
// O yüzden burada atılıyorlar.
function youtubeBaslik(k: any): string {
  const c = (k?.content && typeof k.content === 'object') ? k.content : {};
  const ham = String(c.videoTitle ?? '').trim() || String(k?.title ?? '').trim();
  return ham.replace(/[<>]/g, '').slice(0, 100).trim();
}

// Etiketler. Alanda `#arkeoloji` biçiminde duruyorlar; YouTube
// `tags` dizisinde `#` İSTEMİYOR (etiketin parçası sayıyor).
// Açıklamadaki `#` ise KALIYOR: ilk üçü başlığın üstünde görünüyor ve
// Shorts'ta keşfi onlar taşıyor.
//
// Toplam 500 karakter sınırı var ve aşılırsa istek reddediliyor.
function youtubeEtiketleri(k: any): string[] {
  const c = (k?.content && typeof k.content === 'object') ? k.content : {};
  const ham = String(c.hashtags ?? '').trim();
  if (!ham) return [];
  const cikti: string[] = [];
  let toplam = 0;
  for (const p of ham.split(/[\s,]+/)) {
    const e = p.replace(/^#+/, '').trim();
    if (!e) continue;
    // Boşluk içeren etiket YouTube'da tırnaklanıyor ve iki karakter
    // daha yer tutuyor; bizimkiler tek kelime ama hesap yine de
    // gerçekçi kalsın.
    const yer = e.length + 1;
    if (toplam + yer > 500) break;
    toplam += yer;
    cikti.push(e);
  }
  return cikti;
}

function youtubeUstveri(k: any): Record<string, unknown> {
  const c = (k?.content && typeof k.content === 'object') ? k.content : {};
  return {
    snippet: {
      title: youtubeBaslik(k),
      // YouTube açıklaması 5000 karakter. Etiketleri açıklamaya da
      // ekleyen mantık altYazi'da ve TEK YER: Instagram ile aynı
      // kurallar, yalnızca tavan farklı.
      description: altYazi(k, 5000),
      tags: youtubeEtiketleri(k),
      // Zorunlu alan. Varsayılan 27 (Eğitim); kayıt bazında
      // content.youtubeCategory ile değiştirilebiliyor.
      categoryId: String(c.youtubeCategory ?? ytKategori())
    },
    status: ytDurum(k)
  };
}

// ══════════════════════════════════════════════════════════════════
// GÖRÜNÜRLÜK VE ZAMANLAMA — AYRILAMAZ İKİLİ
// ══════════════════════════════════════════════════════════════════
// ⛔ EN SESSİZ TUZAK: `publishAt`, `privacyStatus` 'private' DEĞİLSE
// YOK SAYILIYOR -- ve YouTube bunu HATA SAYMIYOR. Yani "zamanladım"
// sanıp `privacyStatus: 'public'` ile gönderirsen video ZAMANLANMAZ,
// yüklendiği an herkese açık çıkar. Hiçbir yerde uyarı yok.
//
// Bu yüzden ikisini ayrı ayrı hesaplayan iki satır YOK: tek işlev
// ikisini birden döndürüyor ve `publishAt` yazan her dal aynı anda
// `privacyStatus: 'private'` yazıyor.
//
// KARAR TABLOSU:
//   görünürlük 'public' + yayın anı GELECEKTE
//       -> private + publishAt   (YouTube o saatte herkese açıyor)
//   görünürlük 'public' + yayın anı GEÇMİŞTE
//       -> public                (zamanlanacak bir şey kalmamış;
//                                 geçmiş bir publishAt istek hatası)
//   görünürlük 'private' / 'unlisted'
//       -> olduğu gibi           (zamanlama YouTube'da yalnızca
//                                 "herkese açığa çevir" demek)
function ytDurum(k: any): Record<string, unknown> {
  const c = (k?.content && typeof k.content === 'object') ? k.content : {};
  const ortak = {
    // ⚠ HUKUKİ BEYAN, ayar değil (COPPA). Varsayılan false: kanal
    // yetişkinlere yönelik tarih/arkeoloji içeriği üretiyor.
    selfDeclaredMadeForKids: c.madeForKids === true,
    embeddable: true
  };
  const gorunurluk = ytGorunurluk();
  const an = Date.parse(String(k?.publish_at ?? '')) || 0;
  // ⚠ BİR DAKİKALIK PAY. Yayın anına saniyeler kala yüklenen bir video
  // için publishAt yazmak, isteğin Google'a vardığı anda o saatin
  // GEÇMİŞTE kalması demek olabilir -- ve geçmiş bir publishAt isteği
  // reddettiriyor (yükleme bittikten SONRA).
  if (gorunurluk === 'public' && an > Date.now() + 60_000) {
    return { ...ortak, privacyStatus: 'private', publishAt: new Date(an).toISOString() };
  }
  return { ...ortak, privacyStatus: gorunurluk };
}

// Çöküş izi kurtarması. IG/FB'de "son gönderiler" listesine bakılıyor,
// TikTok'ta publish_id sorulyor; burada OTURUMUN KENDİSİ soruluyor.
//
// ⚠ SORGU BİR PUT: gövdesi boş, `Content-Range: bytes */<boyut>`.
// Google 308 dönerse yükleme yarım (Range başlığı nereye kadar
// geldiğini söylüyor); 200/201 dönerse yükleme BİTMİŞ ve gövdede
// videonun kimliği var.
//
// ⚠ 308 BİR YÖNLENDİRME DEĞİL (burada). fetch, Location başlığı
// olmayan bir 308'i olduğu gibi döndürüyor; Google bu cevapta
// Location göndermiyor, Range gönderiyor. `redirect: 'manual'`
// gerekmiyor -- ve gerekseydi cevabın gövdesi okunamazdı.
async function youtubeCikmisMi(k: any): Promise<{ biliniyor: boolean; id: string }> {
  if (!k.publish_ref) return { biliniyor: true, id: '' };
  const jeton = await youtubeJetonu(k);
  if (!jeton) return { biliniyor: false, id: '' };
  const boyut = Number(k.media_bytes) || 0;
  if (!boyut) return { biliniyor: false, id: '' };
  try {
    const r = await fetch(String(k.publish_ref), {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${jeton}`,
        'content-length': '0',
        'content-range': `bytes */${boyut}`
      }
    });
    if (r.status === 308) {
      // Oturum yaşıyor ama yükleme bitmemiş: hiçbir video oluşmadı.
      // ÇIKMADI demek güvenli, baştan yüklenebilir.
      await r.body?.cancel();
      return { biliniyor: true, id: '' };
    }
    if (r.ok || r.status === 201) {
      const v = await r.json().catch(() => null);
      const id = String(v?.id ?? '');
      // Kimlik okunamadıysa BİLMİYORUZ. "Bitti ama kimliği yok"
      // diyerek yayınlandı saymak, izlenemeyen bir kayıt bırakırdı.
      return id ? { biliniyor: true, id } : { biliniyor: false, id: '' };
    }
    // 404/410: oturum düşmüş. Oturum düşmesi videonun oluşmadığını
    // GÖSTERMİYOR (tamamlanmış bir oturum da bir gün sonra düşer),
    // o yüzden bilmiyoruz.
    await r.body?.cancel();
    return { biliniyor: false, id: '' };
  } catch {
    return { biliniyor: false, id: '' };
  }
}

// ══════════════════════════════════════════════════════════════════
// GOOGLE HATALARININ TRİYAJI
// ══════════════════════════════════════════════════════════════════
// ⚠ NEDEN AYRI BİR İŞLEV: siniflandir() Meta'nın hata KODLARINA bakıyor
// (#4, #190, #2207xxx). Google öyle kodlar vermiyor, `reason` adlı bir
// dizge veriyor. YouTube hatalarını siniflandir()'a bırakmak hepsini
// "geçici" kovasına atardı: kalıcı bir hata üç denemeyi yakar, kota
// hatası ise kaydı büsbütün 'failed' yapar.
//
// ⛔ KOTA BURADA CİDDİ BİR ŞEY. YouTube'un günlük varsayılan kotası
// 10.000 birim ve `videos.insert` TEK BAŞINA 1600 birim: yani GÜNDE
// ALTI YÜKLEME. Kota hatasını "geçici hata" saymak, yedinci kaydı üç
// denemede yakıp başarısız işaretlemek demekti -- oysa yapılacak tek
// şey yarını beklemek. (Kota Pasifik saatiyle geceyarısı sıfırlanıyor.)
const YT_KOTA = ['quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded'];
// Tekrar denemenin HİÇBİR ŞEY değiştirmediği sebepler: kaydı ya da
// kanalı düzeltmek gerekiyor.
const YT_KALICI = [
  'invalidVideoMetadata', 'invalidTitle', 'invalidDescription', 'invalidTags',
  'invalidCategoryId', 'invalidFilename', 'invalidRecordingDetails',
  'mediaBodyRequired', 'youtubeSignupRequired', 'forbidden', 'unauthorized',
  'failedPrecondition', 'uploadLimitExceeded'
];

function ytSebep(metin: string): string {
  try {
    const v = JSON.parse(metin);
    return String(v?.error?.errors?.[0]?.reason ?? v?.error?.status ?? '');
  } catch { return ''; }
}

// Dönen değer: 'kota' | 'kalici' | 'gecici'. Çağıran buna göre
// erteliyor, kalıcı hata yazıyor ya da GrafHata fırlatıyor.
async function youtubeHatasi(k: any, durum: number, metin: string, nere: string): Promise<string> {
  const sebep = ytSebep(metin);
  const ozet = `YouTube ${nere} (${durum}${sebep ? ' / ' + sebep : ''}): `
             + temizle(metin).slice(0, 200);
  if (YT_KOTA.includes(sebep) || durum === 429) {
    // ERTELEME, hata değil: deneme hakkı geri veriliyor. Üç saat,
    // çünkü kota gün içinde sıfırlanmıyor ama daha kısa bir aralık
    // boşuna istek atmaktan öte bir şey yapmıyor.
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: 'YouTube günlük yükleme kotası doldu (günde ~6 yükleme). '
             + 'Kota Pasifik saatiyle geceyarısı sıfırlanıyor; kayıt bekliyor.' });
    return 'kota';
  }
  if (YT_KALICI.includes(sebep) || (durum >= 400 && durum < 500 && durum !== 408)) {
    await kaliciHata(k, ozet);
    return 'kalici';
  }
  // 5xx, ağ, bilinmeyen: tekrar denenebilir.
  throw new GrafHata(durum, null, null, ozet);
}

async function youtubeYayinla(k: any, bitis: number): Promise<string> {
  const jeton = await youtubeJetonu(k);
  if (!jeton) {
    // HATA DEĞİL ERTELEME: kullanıcı hesabını bağlamamış ya da yetkiyi
    // geri almış olabilir. Bağladığı gün elle hiçbir şey yapmadan akar.
    await rpc('story_ertele', { p_id: k.id, p_dakika: 180,
      p_sebep: 'YouTube hesabı bağlı değil (ya da yetki yenilenemedi). '
             + 'shootboard.app/youtube.html adresinden bağla.' });
    return 'youtube-bagli-degil';
  }

  if (!String(k.media_mime ?? '').startsWith('video/')) {
    await kaliciHata(k, `Shorts yalnızca video olabilir; bağlı dosya ${k.media_mime || 'bilinmeyen tür'}.`);
    return 'shorts-video-degil';
  }
  const baslik = youtubeBaslik(k);
  if (!baslik) {
    // Başlık YouTube'da ZORUNLU ve boş başlıkla istek reddediliyor --
    // ama reddi yükleme bittikten sonra öğrenirdik. Kalıcı hata:
    // kullanıcı kayda başlık yazmadıkça tekrar denemek işe yaramaz.
    await kaliciHata(k, 'YouTube başlığı boş: kayıttaki "Video başlığı" alanını doldur.');
    return 'baslik-yok';
  }
  const boyut = Number(k.media_bytes) || 0;
  if (!boyut) {
    await kaliciHata(k, 'Dosya boyutu bilinmiyor; YouTube oturumu boyutla açılıyor.');
    return 'boyut-yok';
  }

  // İz var ama yayın çağrısı yok: son parça hiç başlamamış, hiçbir
  // video oluşmamış. Baştan başlamak güvenli ve yarım oturumu
  // kurtarmaya çalışmaktan basit. (facebookYayinla'daki kararın aynısı.)
  if (k.publish_ref && !k.publish_called_at) {
    console.log('[story]', k.id, 'yarım kalmış YouTube oturumu — baştan');
    await izTemizle(k.id);
  }

  // ---- 1. Oturumu aç -------------------------------------------------------
  const ustveri = youtubeUstveri(k);
  const bas = await fetch(`${YT_YUKLE}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${jeton}`,
      'content-type': 'application/json; charset=UTF-8',
      // Bu iki başlık OLMADAN Google oturumu açıyor ama parça
      // doğrulamasını yapamıyor ve son parçada 400 dönüyor.
      'x-upload-content-length': String(boyut),
      'x-upload-content-type': String(k.media_mime || 'video/mp4')
    },
    body: JSON.stringify(ustveri)
  });
  if (!bas.ok) {
    const metin = await bas.text().catch(() => '');
    // Triyaj: kota ise erteleme, 4xx ise kalıcı, gerisi fırlatılıyor.
    return 'oturum-' + await youtubeHatasi(k, bas.status, metin, 'oturumu açılamadı');
  }
  await bas.body?.cancel();
  const oturum = bas.headers.get('location') ?? '';
  if (!oturum) {
    throw new GrafHata(bas.status, null, null,
      'YouTube oturum adresi (Location) gelmedi; yükleme başlatılamadı.');
  }
  await rpc('story_iz_konteyner', { p_id: k.id, p_ref: oturum });

  // ---- 2. Parçalar ---------------------------------------------------------
  // ⚠ DOSYA BELLEĞE ALINMIYOR. R2'den Range ile okunup aynı anda
  // Google'a veriliyor -- TikTok yolundaki desenin aynısı.
  //
  // ⚠ PARÇA SAYISI ceil, floor DEĞİL. TT_PARCA'nın yanındaki not:
  // TikTok floor istiyor ve son parçaya artanı yükletiyor, Google
  // sıradaki parçayı bekliyor ve son parça artan kadar. Buraya
  // TikTok'un formülünü kopyalamak, 8 MB'ın tam katı OLMAYAN her
  // dosyanın son baytlarını hiç göndermemek demekti.
  const adet = Math.ceil(boyut / YT_PARCA);
  let videoId = '';
  for (let i = 0; i < adet; i++) {
    const basBayt = i * YT_PARCA;
    const sonBayt = Math.min(basBayt + YT_PARCA, boyut) - 1;
    const sonParca = (i === adet - 1);

    // ⚠ BÜTÇE ORTADA DA KONTROL EDİLİYOR, YALNIZCA BAŞTA DEĞİL.
    // Tur döngüsü kaydı almadan önce bütçeye bakıyor ama 15 parçalık
    // bir yükleme başladıktan sonra bir daha bakan yoktu: bütçe
    // dolduğunda Edge Function ÖLDÜRÜLÜYOR, kayıt 'in_progress'
    // kalıyor ve story_asili_topla onu on dakika sonra kurtarıyor.
    // Kendimiz bırakmak aynı işi görünüyor ama bir farkla: kullanıcı
    // SEBEBİNİ görüyor.
    //
    // ⚠ BU KONTROL PARÇA ÇAĞRISINDAN ÖNCE: sonrasına konsaydı
    // story_iz_yayin_cagrisi yazılmış olurdu ve bir sonraki tur
    // "yayın çağrısı yapıldı, sonucu bilinmiyor" sanırdı.
    //
    // ⚠ BIRAKINCA YÜKLEME BAŞTAN BAŞLIYOR -- kaldığı yerden DEVAM
    // ETMİYOR. Google'ın protokolü devam ettirmeye izin veriyor
    // (oturuma sorulan 308 cevabı `Range` başlığında nereye kadar
    // geldiğini söylüyor), ama o yol YAZILMADI: bugünkü dosyalar
    // (30-120 MB) tek turda bitiyor ve hiç çalışmayan bir kurtarma
    // yolu, sessizce bozulan bir yol demek. Bir dosya gerçekten
    // buraya takılırsa doğru çözüm devam ettirmektir; mesaj o yüzden
    // dosya boyutunu söylüyor.
    if (Date.now() > bitis - 10_000) {
      const mb = Math.round(boyut / 1048576);
      await rpc('story_ertele', { p_id: k.id, p_dakika: 0,
        p_sebep: `Tur bütçesi ${i + 1}/${adet}. parçada doldu; yükleme sıradaki turda `
               + `BAŞTAN denenecek. Dosya ${mb} MB -- her turda aynı yere geliyorsa `
               + 'dosyayı küçültmek gerekiyor.' });
      return 'yukleme-butce-bitti';
    }

    const medya = await fetch(String(k.media_url), {
      headers: { range: `bytes=${basBayt}-${sonBayt}` }
    });
    if (!medya.ok || !medya.body) {
      throw new GrafHata(medya.status, null, null,
        `Medya parçası alınamadı (${basBayt}-${sonBayt}); adres ${medya.status} döndürdü.`);
    }

    // ⚠ ÇÖKÜŞ İZİ: yayınlayan çağrı SON parça. Ondan önce işaretliyoruz,
    // çünkü işaretlemeden sonra çöken worker "çağrı yapıldı mı"
    // sorusuna yanlış cevap verirdi -- ve o cevap ikinci bir yükleme
    // demekti.
    if (sonParca) await rpc('story_iz_yayin_cagrisi', { p_id: k.id });

    const y = await fetch(oturum, {
      method: 'PUT',
      headers: {
        'content-type': String(k.media_mime || 'video/mp4'),
        'content-length': String(sonBayt - basBayt + 1),
        'content-range': `bytes ${basBayt}-${sonBayt}/${boyut}`
      },
      body: medya.body,
      ...({ duplex: 'half' } as any)
    });

    if (!sonParca) {
      // Ara parçaların BEKLENEN cevabı 308. 200 dönerse yükleme
      // bitmiş sayılıyor ve bu bizim hesabımızın bozuk olduğunu
      // söylüyor: sessiz geçmek yerine hata veriyoruz.
      if (y.status !== 308) {
        const metin = await y.text().catch(() => '');
        throw new GrafHata(y.status, null, null,
          `YouTube parça ${i + 1}/${adet} beklenmeyen cevap verdi (${y.status}): `
          + temizle(metin).slice(0, 200));
      }
      await y.body?.cancel();
      continue;
    }

    if (!y.ok && y.status !== 201) {
      const metin = await y.text().catch(() => '');
      // ⚠ BURADA DOSYA ZATEN GİTTİ. Yine de triyaj gerekli: kalıcı bir
      // üstveri reddini geçici sayıp üç kez daha yüklemek, 114 MB'ı üç
      // kez boşa göndermek demek.
      return 'son-parca-' + await youtubeHatasi(k, y.status, metin, 'son parça yüklenemedi');
    }
    const v = await y.json().catch(() => null);
    videoId = String(v?.id ?? '');
  }

  if (!videoId) {
    // Yükleme bitti ama kimlik gelmedi. KALICI HATA DEĞİL: kayıt
    // ertelenirse bir sonraki tur çöküş izinden (youtubeCikmisMi)
    // kimliği sorup bulabiliyor. "Yayınlandı" demek ise izlenemeyen
    // bir kayıt bırakırdı.
    await rpc('story_ertele', { p_id: k.id, p_dakika: 2,
      p_sebep: 'YouTube yükleme bitti ama video kimliği gelmedi; kimlik sorulacak.' });
    return 'kimlik-gelmedi';
  }

  await rpc('story_yayinlandi', { p_id: k.id, p_external_id: videoId });
  return 'yuklendi';
}

// ══════════════════════════════════════════════════════════════════
// FACEBOOK REEL KAPAGI — EN İYİ ÇABA, YAYINI ASLA RİSKE ATMAZ
// ══════════════════════════════════════════════════════════════════
// ⛔ NEDEN AYRI BİR ÇAĞRI: `video_reels` finish çağrısı kapak ALMIYOR.
// Meta'nın kendi örnek koleksiyonu (fbsamples/Facebook-Reels-Publishing-
// API-Postman-Collection) finish aşamasında yalnızca şunları listeliyor:
// access_token, video_id, upload_phase, video_state, description, title.
// Kapak alanı yok. Instagram'da `cover_url` var, Facebook'ta yok --
// aradaki fark bu, ve 30 Eylül 2026'ya kadar Facebook reels'ları
// kapaksız çıkıyordu: kapak dosyası R2'de üretilmiş hâlde duruyor,
// Facebook videodan rastgele bir kare seçiyordu.
//
// ⚠ DÖNMEYEN SÖZ: bu işlev HİÇ FIRLATMIYOR. Sebebi tek cümle:
// KAPAKSIZ ÇIKAN REEL, ÇIKMAYAN REEL'DEN İYİDİR. Kapak çağrısı
// başarısız olursa yayın devam ediyor; hata yalnızca günlüğe yazılıyor.
// Bunu bir `kaliciHata`ya bağlamak, kozmetik bir eksik yüzünden
// yayınlanabilecek bir gönderiyi çöpe atmak olurdu.
//
// ⚠ FINISH'TEN ÖNCE ÇAĞRILIYOR. Kapak yayın anında yerinde olsun ki
// ilk gösterimden itibaren doğru kare görünsün; sonradan eklenen kapak
// ilk dalga izlenmeyi kurtarmıyor.
//
// ⚠ DOĞRULANMADI: bu ucun reels için çalıştığını Meta belgelemiyor ve
// bu ortamdan deneyemedim (graph.facebook.com'a erişim ve Sayfa jetonu
// burada yok). Çalışmazsa davranış bugünküyle AYNI kalıyor -- kapaksız
// yayın. O yüzden denemenin bedeli yok, kazancı var.
async function fbReelKapagi(videoId: string, kapakAdresi: string): Promise<boolean> {
  try {
    const g = await fetch(kapakAdresi);
    // ⚠ `g.body`'ye BAKMIYORUZ. Medya akıtma yolundan kopyalanan bir
    // `!g.body` kontrolü buraya konmuştu ve yanlıştı: kapağı akıtmıyoruz,
    // tamamını belleğe alıyoruz (bir JPEG, birkaç yüz KB). Response.body
    // bazı yanıtlarda null olabiliyor, arrayBuffer() ise yine baytları
    // veriyor -- yani o kontrol çalışan kapakları eliyordu.
    if (!g.ok) { console.log('[story] kapak alinamadi', g.status, kapakAdresi); return false; }
    const bayt = await g.arrayBuffer();
    if (!bayt || bayt.byteLength === 0) { console.log('[story] kapak bos', kapakAdresi); return false; }
    const govde = new FormData();
    // `source`: ham görsel. `is_preferred`: Facebook'un kendi seçtiği
    // kareyi DEĞİL bunu kullanmasını söylüyor -- yazılmazsa yüklenen
    // görsel yalnızca aday listesine giriyor ve hiç seçilmeyebiliyor.
    govde.append('source', new Blob([bayt], { type: g.headers.get('content-type') || 'image/jpeg' }), 'kapak.jpg');
    govde.append('is_preferred', 'true');
    govde.append('access_token', PAGE_TOKEN);
    await grafFormla(`/${videoId}/thumbnails`, govde);
    return true;
  } catch (e) {
    // Yutuluyor -- ama SESSİZ DEĞİL: günlükte sebebi duruyor.
    console.log('[story] FB kapagi konulamadi (yayin devam ediyor):', (e as Error).message);
    return false;
  }
}

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
      const baslik = kisaBaslik(k);
      if (baslik) bitisAlanlari.title = baslik;
      // Kapak varsa finish'ten ÖNCE deniyoruz; basarisizligi yayini
      // durdurmuyor (fbReelKapagi hic firlatmiyor).
      if (k.cover_url) await fbReelKapagi(videoId, String(k.cover_url));
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
    // ⚠ LOGA DA YAZILIYOR -- 16 EKIM 2026.
    // Hata o güne kadar YALNIZCA last_error'a yazılıyordu. Threads'in
    // ilk gerçek yayını patladığında bir sonraki tur aynı satırın
    // üstüne "sonucu bilinmiyor" yazdı ve ASIL HATA MESAJI YOK OLDU:
    // logda tek bir iz bile kalmadığı için teşhis, Threads'e elle
    // sorulan kapsayıcı durumuyla yapılmak zorunda kaldı.
    // Veritabanı son durumu tutuyor, log ise OLAN BİTENİ -- ikisi
    // birbirinin yerine geçmiyor.
    console.error('[story] hata', k.id, String(k.platform ?? '?'),
      String(k.type ?? '?'), kova, temizle(mesaj));
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
  // ⚠ TikTok ve YouTube 28-29 Eylül 2026'da EKLENDİ ve bu tablo
  // eksik kalmıştı: bildirim "Platform: tiktok" diyordu. Küçük bir
  // çirkinlik ama aynı sınıftan bir hata -- tablo bir yerde, platform
  // listesi başka yerde.
  const pfAd = ({ instagram: 'Instagram', facebook: 'Facebook',
                  tiktok: 'TikTok', youtube: 'YouTube' } as Record<string, string>)[
                 String(k.platform || '')] || String(k.platform || '?');
  // ⚠ ACELE AYNI DEĞİL. Story 24 saatlik: kaçan gün geri gelmiyor,
  // o yüzden "bugün elle yayınla" demek doğru. Reel ve Short kalıcı:
  // aynı cümle gereksiz bir telaş yaratır ve yarın yayınlamak da olur.
  const tb = turBilgi(k);
  const kapanis = tb.kalici
    ? `${tb.tekil} kalıcı bir gönderi; acelesi yok ama elle de yayınlayabilirsin.`
    : 'Story 24 saatlik; bugünü kaçırmamak için elle yayınlamak isteyebilirsin.';
  await epostaGonder(alici, `Shootboard · ${tb.tekil} yayınlanamadı`,
    `${ne} yayınlanamadı.\n\n`
    + `Tür      : ${tb.buyuk}\n`
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
  // ⚠ ANKET CEVAPLARI YAYINLARDAN SONRA. Yayın saatinde olmak zorunda
  // olan iş yayın; bir cevabın beş dakika gecikmesi kimsenin
  // umurunda değil, kaçan bir story ise geri gelmiyor.
  const yanitSonuc = await yanitlariIsle(bitis);
  for (const [a, v] of Object.entries(yanitSonuc)) sonuc[a] = (sonuc[a] ?? 0) + v;
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
        app_kimlik: !!(APP_ID && APP_SECRET), resend: !!RESEND_KEY, secret: !!WORKER_SECRET,
        // TikTok anahtarları BAŞKA bir fonksiyonda (tiktok-baglan) da
        // okunuyor; Supabase'de gizli değişkenler projeye bağlı, yani
        // ikisi de aynı havuzdan okuyor. Ama "okuyor olmalı" ile
        // "okuyor" farklı şeyler -- dağıtımdan sonra bakılabilsin.
        tiktok_key: !!TIKTOK_KEY, tiktok_secret: !!TIKTOK_SECRET,
        youtube_id: !!YOUTUBE_ID, youtube_secret: !!YOUTUBE_SECRET,
        // ⚠ YALNIZCA TOHUMUN TANIMLI OLUP OLMADIGI. Calisan jeton
        // tabloda (threads_hesaplari) ve oraya bakmak icin user_id
        // gerekiyor -- GET'te kullanici yok. Yani `true` gormek
        // "Threads calisiyor" demek DEGIL, "ilk tohum var" demek.
        // Ilk yayindan sonra gercek jeton tablodan geliyor.
        threads_token: !!THREADS_TOKEN,
        // ⛔ BU İKİSİ DEĞER GÖSTERİYOR ve bilerek: ikisi de gizli
        // değil, ikisi de yayının NE YAPACAĞINI belirliyor. Denetim
        // kapısı kapalıyken YouTube kayıtları yüklenmiyor; görünürlük
        // 'public' ise yayın geri alınamaz. Dağıtımdan sonra
        // bakılabilmesi, yanlış bir yüklemeden ucuz.
        youtube_denetim: !!ytDenetim(),
        youtube_gorunurluk: ytGorunurluk()
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
