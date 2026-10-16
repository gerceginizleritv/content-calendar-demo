# YouTube API denetim başvurusu — ne beyan ettik

**16 Ekim 2026'da gönderildi.** Kanıt: gönderim sonrası ekranda
"Your email has been sent — Thank you for submitting the YouTube API
Services Form." yazdı.
Form: <https://support.google.com/youtube/contact/yt_api_form>

Bu dosya bir özet değil, bir **kayıt**. Üç işi var:

1. Denetim ekibi soru sorduğunda ne dediğimizi tam olarak bilmek.
2. **Periyodik yeniden denetimde** aynı beyanları tekrar edebilmek --
   YouTube bunu bir kez değil, aralıklarla yapıyor.
3. Başvurunun GERÇEKTEN gönderildiğini kanıtlamak. Aşağıya bak.

---

## ⚠ 29 EYLÜL BAŞVURUSU GİTMEMİŞ

Bu dosya önceden "29 Eylül 2026'da gönderildi" diyordu. 16 Ekim'de
anlaşıldı ki **o başvurunun hiçbir izi yok**: ne onay e-postası, ne
Google'dan bir dönüş, ne de kullanıcının hatırladığı bir gönderim.
Gmail'de `in:anywhere` ile (çöp ve spam dahil) 25 Eylül - 6 Ekim arası
Google'dan gelen her şey tarandı, hiçbir şey çıkmadı.

YouTube denetiminin **durum sayfası yok** -- takip edilebilecek bir
panel yok, Google yalnızca e-posta ile dönüyor. Yani e-posta yoksa
elde hiçbir şey yok. Bu dosyadaki "gönderildi" satırı bizim kendi
yazdığımız bir cümleydi, kanıt değildi; üç hafta boyunca "cevap
bekliyoruz" sanıldı.

**Kural: bundan sonra gönderim tarihi yazılırken kanıtı da yazılacak.**
Aynı hata ikinci kez yapılmasın diye bu bölüm duruyor.

---

## ⛔ SÜREGELEN YÜKÜMLÜLÜK — EN ÖNEMLİ KISIM

Başvuruda şu kutu işaretlendi ve bu bir söz:

> *Developer Policies: I acknowledge that it is my responsibility to stay up to
> date on changes to the Developer Policies that may impact my use of the Data
> API, and that **I will notify YouTube of any changes to my stated use case and
> seek approval for such changes prior to continued use**.*

Yani aşağıdakilerden **herhangi biri** değişirse, devam etmeden önce YouTube'a
haber verip onay almak gerekiyor:

| Değişiklik | Neden bildirim gerektiriyor |
|---|---|
| Yeni bir API metodu çağırmak | Beyanımız "videos.insert tek metot" |
| Okuma kapsamı eklemek (`youtube.readonly` vb.) | Beyanımız "hiç veri okumuyoruz" |
| Uzun form video eklemek (`type = 'video'`) | Beyan ettiğimiz kullanım senaryosu Shorts yüklemesi |
| Ücretli plana geçmek | Beyanımız "Free service (we do not charge users)" |
| Ölçeğin ciddi büyümesi | Beyanımız "fewer than 1,000 requests per day" |

⚠ Bunların ilk ikisini kod tarafında `testler/baglantilar.test.js` zaten
engelliyor (okuma kapsamı eklenemez, okuma ucu çağrılamaz). Üçüncüsü
`supabase/functions/mcp/index.ts` içinde bilerek dışarıda bırakıldı. Ama
testler teknik bir kilit; buradaki söz **hukuki** ve testi değiştiren kişi bu
dosyayı da okumalı.

---

## Beyan edilenler

| Alan | Değer |
|---|---|
| Başvuru türü | Compliance audit (ek kota İSTENMEDİ) |
| Başvuran | Şahıs — Independent Developer / Sole Proprietor |
| Kategori | Creator Tools and Services |
| Kullanım senaryosu | Video Uploading & Account Management |
| Hedef kitle | Individual Content Creators |
| Gelir modeli | Free service (we do not charge users) |
| Google Cloud proje no | 505142582656 |
| API Client Name | Shootboard |
| Primary Access URL | https://shootboard.app |
| Privacy Policy | https://shootboard.app/privacy.html (bölüm 7b) |
| Terms of Service | https://shootboard.app/sartlar.html |
| Herkese açık mı | Evet |
| Kapsam | `https://www.googleapis.com/auth/youtube.upload` — yalnızca bu |
| Kullanılan uç | `videos.insert` — yalnızca bu |
| Beklenen hacim | Fewer than 1,000 requests per day |
| İstenen kota | No change / Default quota (10.000 birim/gün) |

## Başvurunun gerekçesi

Kota değil **uyum**. Denetimden geçmemiş bir projeden yüklenen video kalıcı
olarak "özel"e kilitleniyor ve sonradan herkese açık yapılamıyor. Bu, planlı
yüklemeyi işe yaramaz hâle getiriyor: yayın saati için yüklenen bir video hiçbir
zaman görünür olamıyor.

## Gönderilen kanıtlar

| Kanıt | Kaynak |
|---|---|
| Privacy Policy | `privacy.html` → "7b. YouTube in particular" |
| Homepage | `shootboard.app` tam sayfa (Privacy bağlantısı + YouTube rozeti) |
| Terms of Service | `sartlar.html` İngilizce bölüm |
| OAuth Flow | İzin ekranı + kapsam + bağlantıyı kesme, tek dosyada |
| Upload Interface | Shorts kaydının otomatik yayın paneli |
| Architecture Diagram | `denetim/shootboard-architecture-diagram.png` |
| User Flow Diagram | `denetim/shootboard-user-flow-diagram.png` |

Diyagramların kaynağı `denetim/mimari.html` ve `denetim/akis.html`;
`node denetim/uret.js` ikisini de yeniden üretiyor. Yeniden denetimde güncel
hâli istendiğinde sıfırdan çizmek gerekmesin diye duruyorlar.

### 16 Ekim 2026'da yüklenen dosya

Form "CONDITIONAL EVIDENCE for Project #1" alanında **tek bir dosya**
istiyor (JPEG/PNG ya da PDF). Bizim kullanım senaryomuz iki şey
gerektiriyor -- (a) OAuth akışı ve (b) yükleme arayüzü -- o yüzden
hepsi tek PDF'te birleştirildi:

`denetim/shootboard-oauth-and-upload-evidence.pdf` (6 sayfa)

| Sayfa | Ne gösteriyor |
|---|---|
| 1 | Shootboard bağlantı sayfası, bağlanmadan önce |
| 2 | Google izin ekranı (uygulama henüz doğrulanmamış) |
| 3 | Google Hesabı → verilen kapsam ("Manage your YouTube videos") + "Tüm erişimi kaldır" |
| 4 | Bağlandı onayı; denetimden önce videoların private kilitlendiğini söyleyen metin |
| 5 | Uygulama içinden iptal: "Bağlantıyı kes" |
| 6 | Yükleme arayüzü: Shorts kaydı, otomatik yayın tiki açık |

⚠ Arayüz Türkçe. Her sayfanın üstündeki açıklama İngilizce ve Türkçe
etiketlerin karşılığını veriyor -- denetim ekibi Türkçe bilmek zorunda
kalmasın.

Hesap seçme ekranı **bilerek konmadı**: formun istediği üç şeyden
(consent / scopes / revocation) hiçbirini göstermiyor ve içinde
kullanıcının ilgisiz e-posta adresleri görünüyor.

PDF'i üreten betik: `denetim/kanit-pdf.py`. Yeniden denetimde ekran
görüntülerini yenileyip betiği koşturmak yeter.

### Kota alanı (16 Ekim 2026)

Form iki zorunlu alan sordu:

- **Total Per Day Quota:** `10000` -- varsayılan günlük kota. Artış
  İSTENMEDİ; bu sayı "mevcut kota yetiyor" demek.
- **Detailed Justification:** kota artışı istenmediği, tek uç
  (`videos.insert`), tek kapsam (`youtube.upload`), günde ~1 yükleme,
  hiçbir okuma yapılmadığı ve başvurunun sebebi (denetimsiz projede
  videoların kalıcı private kilitlenmesi) yazıldı.

### Uç seçimi (16 Ekim 2026)

Formdaki uzun uç listesinden **yalnızca `youtube.videos.insert`**
işaretlendi. Koddan doğrulandı: `supabase/functions/` altında çağrılan
tek Google ucu `https://www.googleapis.com/upload/youtube/v3/videos`.

⛔ `youtube.thumbnails.set` İŞARETLENMEDİ ve bu kasıtlı: kapak
YouTube'a gönderilmiyor (gerekçesi `story-yayin/index.ts` içinde
yazılı -- kapak ayrı bir çağrı ve yalnızca doğrulanmış kanallarda
çalışıyor). `youtube.captions.*` da işaretlenmedi: YouTube'da
"caption" altyazı DOSYASI demek; bizim gönderdiğimiz metin
`videos.insert` gövdesindeki `description`.

## Onay geldiğinde yapılacak

1. Supabase → Edge Functions → Secrets → `YOUTUBE_DENETIM_GECTI` = `1`
   Bu tanımlanana kadar worker gerçek kayıtları yüklemiyor, erteliyor.
2. Herkese açık yayın isteniyorsa ayrıca `YOUTUBE_GORUNURLUK` = `public`.
   ⚠ İkisi bilerek ayrı: bu hatta dosya da başlık da açıklama da otomatik
   geliyor ve herkese açık çıkan bir video geri alınamıyor.
3. Denetimden ÖNCE yüklenmiş deneme videoları kalıcı olarak özel kalır;
   Studio'dan silinebilirler.
