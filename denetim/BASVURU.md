# YouTube API denetim başvurusu — ne beyan ettik

29 Eylül 2026'da gönderildi.
Form: <https://support.google.com/youtube/contact/yt_api_form>

Bu dosya bir özet değil, bir **kayıt**. İki işi var:

1. Denetim ekibi soru sorduğunda ne dediğimizi tam olarak bilmek.
2. **Periyodik yeniden denetimde** aynı beyanları tekrar edebilmek --
   YouTube bunu bir kez değil, aralıklarla yapıyor.

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

## Onay geldiğinde yapılacak

1. Supabase → Edge Functions → Secrets → `YOUTUBE_DENETIM_GECTI` = `1`
   Bu tanımlanana kadar worker gerçek kayıtları yüklemiyor, erteliyor.
2. Herkese açık yayın isteniyorsa ayrıca `YOUTUBE_GORUNURLUK` = `public`.
   ⚠ İkisi bilerek ayrı: bu hatta dosya da başlık da açıklama da otomatik
   geliyor ve herkese açık çıkan bir video geri alınamıyor.
3. Denetimden ÖNCE yüklenmiş deneme videoları kalıcı olarak özel kalır;
   Studio'dan silinebilirler.
