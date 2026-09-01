# Slate — Yapılacaklar ve Değerlendirilenler

Bu dosya oturumlar arasında hafıza görevi görüyor. Claude'un hafızası
oturumlar arasında taşınmıyor; konuşulan ama yapılmayan işler burada
duruyor, neden ertelendiği de yazıyor ki aynı tartışma baştan yapılmasın.

---

## Nerede kaldık (1 Eylül 2026)

**Bitti:** Projeler sayfası (üretim takibi, termin tarihleri, tür/adres,
harita bağlantısı), takvim tablo görünümü, sürükle-bırak, açıklama
şablonları ve bunların buluta senkronu, projelerin buluta senkronu, kayıt
çoğaltma, saat dilimi.

**Sırada:** aşağıdaki maddeler. Kullanıcının başta istediği beş
özellikten dördü bitti; kalan tek madde roller/yetkilendirme ve o
bilerek ertelendi (sebebi aşağıda).

---

## Sırada

### Yayın entegrasyonu ve "iki yere aynı şeyi yazma" sorunu (1 Eylül 2026)

**Kullanıcının koyduğu sorun:** Slate süreci baştan aşağı yönetiyor,
sadece yayın anına gelince iş manuel oluyor. Kullanıcı caption'ı Slate'e
yazıyor, sonra aynı metni Studio'ya / Instagram'a bir daha yazıyor. "İki
yere aynı şeyi yapıyor" hissi. Bugün kullanıcının kendi takibine çok
faydası var ama satılacak bir üründe bu his bir itiraz.

#### Önce mükerrerliğin gerçek boyutu

Slate'teki verinin çoğunun platformda karşılığı YOK: proje, adım termin
tarihleri, lokasyon, üretim durumu, aynı çekimin Reels/Shorts/uzun
varyantları, takvim. Bunlar hiçbir yere ikinci kez girilmiyor.
Mükerrer olan tek şey **yayın anındaki metin bloğu** (başlık, açıklama,
etiket, kapak notu). Yani sorun gerçek ama dar: bir alan grubu, bir an.

Ayrıca bu acı **tek kişilik** iş akışına özgü. Planlayan ile yayınlayan
farklı kişiyse (ajans, ekip) mükerrerlik yok — Slate zaten brief'in
kendisi. Acıyı en çok tek başına çalışan çekiyor; ve pazarın büyük kısmı
da o. İkisi birden doğru.

#### Yayın eklemek sorunu çözer mi — dikkat

Buffer, Later, Metricool, Publer, Hootsuite hepsi yayın yapıyor. Slate
yayın eklerse **onların yaptığı işi daha kötü yapan bir araç** olur ve
bugünkü "hesaplarına bağlanmıyoruz, izin ekranı yok, bozulacak bağlantı
yok" vaadini (`index.html:1761` / `:2046`) de kaybeder.

Slate'in onlarda OLMAYAN tarafı yayının **öncesi**: fikir → çekim → ses →
kurgu → hazır. Adım terminleri, lokasyon, proje, çoğaltma. O araçlar
varlık zaten üretilmiş noktadan başlıyor. Kullanıcının "kendi takibime
çok faydası var" dediği kısım tam olarak bu ve rakiplerde yok.

**Bu yüzden yön şu:** Slate yayıncı olmaya çalışmayacak. Çözülecek olan
mükerrerlik değil, **devir anı** — yeniden yazmak yerine tek hareketle
aktarmak.

#### Platform gerçeği (araştırıldı, 1 Eylül 2026)

Kullanıcının sorduğu tam senaryo — "video hariç alanları önden gönder" —
hiçbir platformda böyle çalışmıyor. Metadata-only taslak diye bir şey yok.

* **YouTube:** en iyi aday. Video kaydı ancak dosya yüklenince doğuyor;
  ama kullanıcı Studio'dan özel olarak yükledikten sonra `videos.update`
  (başlık/açıklama/etiket), `thumbnails.set` (kapak) ve
  `status.publishAt` (yayın saati) ile üstüne yazılabiliyor. Kota günde
  10.000 birim: update 50, thumbnail 50, ama `videos.insert` **1600**
  (≈ günde 6 yükleme, tüm kullanıcılar ortak havuzdan). Hassas kapsam →
  Google doğrulaması şart, doğrulanmadan 100 kullanıcı sınırı.
* **Facebook Sayfa:** çalışıyor, zamanlanmış yayın destekli
  (`scheduled_publish_time`). App review gerekiyor.
* **Instagram / Threads:** sadece Business/Creator hesap, kişisel hesap
  hiç olmaz. Medya **herkese açık URL'den** çekiliyor, dosya
  gönderilemiyor (yani bir barındırma gerekir). **API'de zamanlama yok**,
  yayın anında oluyor; sıraya alma bizim işimiz olurdu.
* **TikTok:** "inbox/taslak" modu akışa yakın (Slate gönderir, kullanıcı
  uygulamada onaylar) ama video dosyası yine şart. Doğrudan yayın için
  TikTok denetimi.
* **LinkedIn:** post atmak partner onayı istiyor (Community Management
  API), küçük ürüne pratikte kapalı.
* **X:** yazma erişimi ücretli katmanda.
* **Pinterest:** v5 pin oluşturma var, üretim erişimi inceleme istiyor.

**Mimari engel:** Slate'in sunucusu yok; OAuth `client_secret`'ı ve
kullanıcı token'ı tarayıcıda duramaz. Supabase Edge Function şart — ve
orada duracak şey bir API anahtarı değil, **müşterinin hesabına post
atma yetkisi**. Sızarsa birinin kanalına başkası video yükler. Google
Places anahtarı saklamaktan bambaşka bir sorumluluk sınıfı. Üstüne
token'lar süreli (Meta'nınki ~60 gün); kullanıcı şifresini değiştirse
bağlantı **sessizce** kopar ve destek talebi olarak geri döner.

#### Karar: kademeli, ve önce ölç

**Kademe 0 — Yayın modu (önce bu yapılacak, bir günlük iş).**
Yayın anında tek ekran: o platformun sorduğu alanlar, o platformun
sorduğu sırada, her birinin yanında kopyala düğmesi (`.copy-btn`
altyapısı `index.html:4547`'de zaten var), üstte "hepsini kopyala" ve
Studio'ya / uygulamaya doğrudan bağlantı. Mükerrerliği kaldırmaz ama
acısını kaldırır: yeniden yazmak yerine 20 saniyede üç kopyala. Hiçbir
vaadi bozmaz, hiçbir denetimden geçmez.

**Kademe 1 — Webhook çıkışı (küçük iş, uyum yükü sıfır).**
Kayıt kaydedilirken isteğe bağlı webhook. Kullanıcı kendi
Make/Zapier/n8n hesabını bağlar; OAuth'u ve sorumluluğu o taşır. Biz tek
bir HTTP isteği yazarız, sekiz platform denetiminden geçmeyiz. Slate
kullanıcının mevcut yığınının **üstü** olur, yerine geçmeye çalışmaz.

**Kademe 2 — Sadece YouTube gerçek entegrasyon.**
Değeri en yüksek, kotası en ucuz, akışı en oturmuş olan orada. Supabase
Edge Function + Google doğrulaması. Bir hafta sorunsuz döndükten sonra
ikinci platforma bakılır. Sekizini birden yapmaya kalkışmak yok.

**Kademe 2'ye geçmeden ÖNCE ölçülecek (sahte kapı).**
`trackOnce('funnel/...')` altyapısı zaten var. Yayın modu ekranına
"Hesabıma gönder" düğmesi konur; basana "yakında, haber vereyim mi"
denir ve tıklama sayılır. Aylarca OAuth yazmadan önce kullanıcının bunu
gerçekten isteyip istemediği bu şekilde öğrenilir. Kullanıcı Kademe 0'la
yetiniyorsa Kademe 2 hiç yazılmaz.

**Konumlandırma notu:** Kademe 2 yapılırsa turdaki "hesaplarına
bağlanmıyoruz" metni de düşer. O metin bugün bir satış argümanı; bilerek
feda edilmeli, kazara değil.

### Lokasyon uygulamasına Slate özelliklerini taşı — TAŞIMADAN ÖNCE
İki dosya karşılaştırıldı (1 Eylül 2026). Lokasyon uygulamasında ZATEN
var: takvim tablo görünümü, çoklu platform seçimi, saat dilimi, hafta
görünümü, aranabilir lokasyon listesi, güne tıklayarak kayıt ekleme.

Slate'te olup onda OLMAYAN beş şey:
1. **Sürükle-bırak** (takvimde kaydı başka güne taşıma) — yok.
2. **Kayıt çoğaltma** (aynı çekimin Reels/Shorts/uzun sürümleri) — yok.
3. **Açıklama şablonları** — yok. Aynı Supabase projesini kullandıkları
   için `caption_templates` tablosu hazır; aynı satırı paylaşabilirler
   (aynı kişi, aynı hesaplar) — bu bir avantaj, karar verilmeli.
4. **Adım termin tarihleri + gecikince kırmızı** — yok. Lokasyonun
   adımları var (script/çekim/ses/kurgu/yayın) ama tarihleri yok;
   `locations` tablosuna `deadlines jsonb` sütunu gerekir.
5. **Kompakt üretim tablosu** (satır = lokasyon, sütun = adım) — yok;
   bugün yalnızca kart ve liste görünümü var.

Sıra önerisi: 2 → 1 → 3 → 4 → 5 (risksizden büyüğe).

### Lokasyon uygulamasını kendi adresine taşı
Yeni sürüm `content-calendar-demo/lokasyon.html` adresinde deneme
kopyası olarak duruyor. Onay gelince `lokasyon-takip` deposunun üzerine
yazılacak, turuncu şerit kalkacak. Geri dönüş noktası: `github-surumu`
dalı. GitHub token'ı geçiş bir hafta sorunsuz geçene kadar silinmemeli.

### Yapay zekâ bağlantısı
Metin taslağı için Claude (kod iskeleti var), görsel için Gemini (yeni
iş). Bu ortamdan ikisinin de sunucusuna çıkılamıyor, yani yazılan kod
burada test edilemiyor; ilk denemeyi kullanıcı yapacak.

### Yapay zekâ — kullanıcının kendi anahtarı (karar: 1 Eylül 2026)
**Ücretsiz AI katmanları araştırıldı, ÜRÜNÜN ÇEKİRDEĞİNE KONMAYACAK.**
NVIDIA (build.nvidia.com), Groq, Cerebras, Mistral, Cloudflare, OpenRouter
ve Google AI Studio'nun ücretsiz katmanları var. Satılacak bir üründe üç
duvara çarpıyorlar:

1. **Şartlar:** çoğu "deneme / kişisel kullanım" için; bir ürünün içine
   koyup satmak açıkça yasak olabiliyor. Kullanmadan önce o servisin
   şartları okunmalı.
2. **Tek kova:** ücretsiz sınır ANAHTAR başına. Tek anahtar koyulursa
   bütün kullanıcılar aynı sınırı paylaşır; on kullanıcıda hepsi birden
   tıkanır.
3. **Veri:** bazıları girdiyi eğitimde kullanıyor. Slate'in ekranda yazan
   gizlilik vaadi ("anahtarını da yazdıklarını da görmeyiz") bozulur.

Ek teknik engel: Slate'in sunucusu yok, istek doğrudan tarayıcıdan
gidiyor. Her sağlayıcı tarayıcıdan doğrudan çağrılmaya izin vermiyor
(Anthropic özel bir başlık istiyor, kodda var). İzin vermeyen sağlayıcı
için araya Supabase fonksiyonu gerekir — o da anahtarı BİZİM ödediğimiz
anahtar yapar.

**Maliyet gerçeği:** Bir caption taslağı çok küçük bir istek. Claude'un
en ucuz modeliyle bir dolara ~500 taslak düşüyor. Ücretsiz katmanın
riskini bu tasarruf için almak mantıksız.

**Karar:** Bugünkü tasarım korunuyor — kullanıcı kendi anahtarını girer,
anahtar yalnızca kendi tarayıcısında durur. Ücretli pakette anahtar
Supabase fonksiyonunun arkasına konur, parasını ürün öder, pakete yazılır.

**Kodda hazır olan:** `aiSettingsOverlay` penceresi, `callClaude`,
`callGemini`, `buildDraftPrompt`, caption alanının yanındaki "AI ile
Taslak" düğmesi, anahtarı silme düğmesi. Anahtar `demo_ai_settings`
altında, tarayıcıya özel.

**Düzeltilecek (küçük):** `callClaude` model adı tarihli yazılmış
(`claude-haiku-4-5-20251001`); doğrusu tarihsiz `claude-haiku-4-5`.

**YAPILACAK — anahtarı kullanıcıya nasıl girdireceğiz:**
1. **Sorma anı doğru, korunacak:** anahtar kayıt sırasında değil,
   kullanıcı ilk kez "AI ile Taslak" düğmesine bastığında isteniyor.
   Değeri gördüğü an soruluyor.
2. **Varsayılan sağlayıcı Gemini olacak.** Google AI Studio kredi kartı
   istemeden, Google hesabıyla ücretsiz anahtar veriyor; Anthropic'te
   fatura kurmak gerekiyor. Ücretsiz yolu varsayılan yapmak dönüşümü
   artırır. Claude ikinci seçenek olarak kalır.
3. **Pencerede 3 adımlık resimli yönerge:** "API anahtarı" kelimesi
   teknik olmayan kullanıcıya hiçbir şey ifade etmiyor. Adım adım
   anlatılacak: bağlantıya git → Google ile gir → "Create API key" →
   kopyala → buraya yapıştır.
4. **Anahtar kaydedilirken DOĞRULANACAK.** Şu an doğrulama yok; yanlış
   anahtar giren bunu ancak taslak isterken ham bir hata mesajıyla
   anlıyor. Kaydette küçük bir deneme isteği atılıp "çalışıyor" ya da
   sade Türkçe hata gösterilecek.
5. **Telefonda yapıştırma kolaylığı:** anahtar uzun; geniş alan,
   yapıştır düğmesi.
6. **"Bu cihaza özel" açıkça yazılacak.** Anahtar tarayıcıda duruyor;
   telefonda ayrıca girilmesi gerekiyor. **Anahtar BULUTA
   TAŞINMAYACAK** — kullanıcıların API anahtarlarını veritabanımızda
   tutmak hem sorumluluk hem de "anahtarını görmeyiz" vaadinin ihlali.
7. **İkinci bir kapı:** bugün pencereye yalnızca taslak düğmesinden
   ulaşılıyor. Ayarlara/"Daha fazla" bölümüne de bir giriş konacak ki
   kullanıcı anahtarını kayıt açmadan değiştirip silebilsin.

### Termin hatırlatmaları — iki kanal (kullanıcı kararı, 1 Eylül 2026)
Bugün uyarı yalnızca sayfa AÇIKKEN var: geciken adım kırmızı, üstte şerit.
Kullanıcı bakmıyorken haber göndermek için tarayıcının dışında zamanlanmış
bir iş gerekiyor; Supabase bunu yapabiliyor, ayrı sunucu gerekmiyor.

**Yapılacak 1 — Takvim aboneliği (ICS).**
Kullanıcının terminleri bir takvim adresi olarak yayınlanıyor; kullanıcı
bu adresi telefonunun takvimine bir kez ekliyor, hatırlatmayı telefonun
kendisi yapıyor. Zamanlayıcı gerekmez, mesaj başına maliyet yoktur,
iPhone/Android/Outlook hepsinde çalışır. Gecikme payı birkaç saat —
termin için sorun değil.

*Kullanıcının şartı:* takvime bir kez eklendikten sonra SİLİNEBİLMELİ.
İki ayrı şey ve ikisi de gerekli:
1. Telefonun takvim uygulamasından abonelikten çıkmak (kullanıcı kendi
   yapar; bizim tarafta hiçbir şey bozulmaz).
2. Slate'ten bağlantıyı İPTAL etmek — adresteki gizli anahtar
   yenilenince eski adres ölür. Adres paylaşılmış ya da sızmışsa tek
   çare bu. Arayüzde "Bağlantıyı yenile / iptal et" düğmesi olacak.

Teknik not: kişiye özel içerik ürettiği için bu adres GitHub Pages'ta
duramaz, Supabase Edge Function olacak.

**Yapılacak 2 — Tarayıcı bildirimi.**
Bilgisayarda ve Android'de sorunsuz. iPhone'da kullanıcının Slate'i ana
ekrana eklemesi ŞART, yoksa bildirim gelmez — arayüzde bunu söylemek
gerekiyor. `manifest.json` zaten var; eksik olan service worker dosyası
ve gönderim tarafı (Supabase zamanlanmış görevi). Mesaj başına maliyet
sıfır.

**Karar verilecek:** hatırlatma ne zaman gitsin — termin günü mü, bir gün
önce mi, geciktiğinde mi? Kullanıcı kanal ve zaman seçebilmeli. Küçük
ama sonradan eklemesi can sıkıcı.

**İSTENMEDİ (şimdilik):** e-posta, SMS, WhatsApp. E-posta kendi alan adı
alınınca yeniden değerlendirilebilir. SMS ve WhatsApp'ın mesaj başına
gerçek maliyeti var — ücretsiz pakette zarar yazar, ücretli pakete
saklanmalı. WhatsApp ayrıca Meta iş doğrulaması + önceden onaylı şablon
istiyor, kurulumu haftalar sürer. Resmî olmayan WhatsApp kütüphaneleri
KULLANILMAYACAK: kurallara aykırı, numara kapatılır.

### Kendi alan adı — TÜM İŞ BİTİNCE (kullanıcı kararı, 1 Eylül 2026)
Kullanıcı alan adını işler tamamlandıktan sonra alacak.

**Önemli:** Alan adı almak "kendi sunucumu kurmam gerekecek" demek
DEĞİL. Slate duran dosyalardan oluşuyor (tek HTML + ikonlar); GitHub
Pages ücretsiz olarak kendi alan adını kabul ediyor, HTTPS sertifikası
da ücretsiz geliyor. Yapılacak tek şey alan adı sağlayıcısında DNS
kaydı. Supabase zaten kendi adresinde duruyor, taşınmıyor.

Sunucu tarafı iş gerektiğinde (zamanlanmış hatırlatma, ICS adresi,
gizli anahtar tutmak) Supabase Edge Functions kullanılıyor — yine kendi
sunucu yok.

Taşınma DÜŞÜNÜLEBİLİR ama zorunlu değil: Cloudflare Pages / Netlify /
Vercel de ücretsiz katmanda kendi alan adını alır ve yönlendirme,
başlık ayarı gibi konularda GitHub Pages'tan esnektir. GitHub Pages'ın
bilinen iki sınırı: ücretsiz planda depo herkese açık olmalı, ve sunucu
tarafı kod çalıştırılamaz.

### Çok dillilik — ÖNCE ÖZELLİKLER OTURSUN (kullanıcı kararı, 1 Eylül 2026)
Bugün iki dil var (en, tr), 273 anahtar, ikisi de eksiksiz. Altyapı çok
dilli: `LANG_NAMES`'e bir kod eklenince menüye kendiliğinden düşüyor.
Lokasyon uygulamasında üçüncü dil (ru) zaten çalışıyor.

**Karar:** Ürün hâlâ hızla değişiyor; şimdi çeviri yapılırsa her yeni
özellik altı dilde birden güncellenmek zorunda kalır. Diller özellikler
oturduktan SONRA.

**Dil eklemeden önce yapılması gereken:** Kodda 8 yerde
`currentLang === 'tr' ? 'tr-TR' : 'en-US'` yazıyor (tarih biçimi,
sıralama, büyük/küçük harf). Üçüncü dil eklenirse arayüz çevrilir ama
tarihler Amerikan biçiminde kalır ve sıralama bozulur — sessizce, hata
vermeden. Tek seferlik bir locale eşlemesi bunu kalıcı çözer.

**Kapsam dışı:** Sağ-sol yazılan diller (Arapça, İbranice) sadece çeviri
değil, tüm arayüzün aynalanması demek. Ayrı ve büyük iş.

**Hedef:** 5–6 dil (en, tr + es, pt-BR, de, fr gibi). Örnek demo
içerikleri de çevrilmeli, yoksa çevrilmiş arayüzde İngilizce caption'lar
görünür.

---

## Ertelenenler (sebebiyle)

### Roller ve yetkilendirme (salt okunur / sınırlı kullanıcı)
Arayüz değil güvenlik işi: kimin neyi göreceği veritabanı seviyesinde
kurallanmalı, davet akışı ve e-posta gerekiyor. Yanlış yapılırsa birinin
verisi başkasına görünür.

Veritabanı şeması bunu zaten öngörüyor: `workspaces` ve
`workspace_members` tabloları roller (owner / editor / viewer) ile
kurulu, sadece kullanılmıyor. Yani hiçbir şey engellenmiş değil.

**Neden bekliyor:** Bugün davet edilecek gerçek bir ikinci kullanıcı
yok. Kimsenin kullanmadığı bir yetki sistemini test etmek yerine, gerçek
bir ikinci kullanıcı çıktığında neye ihtiyacı olduğunu görerek yapmak
daha doğru.

### Adres otomatik tamamlama (Google Places)
Adres alanına yazarken gerçek mekan/adres önerileri düşsün, seçilince
tam adres ve koordinat gelsin. Harita bağlantısı tahmini değil gerçek
noktayı göstersin.

**Yapılabilir, ama satılacak bir üründe üç şartı var:**

1. **Anahtar sunucuda durmalı.** Sayfaya konursa herkes görür; "sadece
   şu adresten çalışsın" kısıtı başka siteleri engeller ama kendi
   sitendeki kötüye kullanımı engellemez. Çözüm: Supabase Edge Function
   aracılığıyla çağırmak — anahtar hiç tarayıcıya inmez, kullanıcı
   başına sınır konabilir, tekrar eden sorgular önbelleğe alınabilir.
2. **Demoda kapalı, ücretli pakette açık.** Herkese açık demoda her
   aramanın faturası ürün sahibine yazılır. Gerçek maliyeti olduğu için
   doğal bir paket sınırı: satılabilir bir madde.
3. **Saklama şartları.** Google, Places'ten gelen verinin saklanmasına
   sınır koyuyor; adres kendi veritabanımıza yazılacağı için şartların
   okunması gerekiyor. Mapbox / Geoapify / LocationIQ gibi servislerin
   saklama şartları daha rahat ve fiyatları daha öngörülebilir, ama
   işletme adı aramada Google kadar iyi değiller.

**Neden bekliyor:** Ürünün çekirdeği değil. Ödeme, hesap ve paket yapısı
oturmadan eklenirse geri alınması gerekir.

Not: Google fiyatlandırması değişkendir; karar anında güncel fiyata
bakılmalı, tahminle fiyat kurulmamalı. "Oturum" (session token) mantığı
doğru kurulursa kullanıcı başına maliyet küçük kalır.

---

## Yapıldı — kararın gerekçesiyle birlikte

### Şablonları buluta taşı — YAPILDI (1 Eylül 2026)
Tablo: `caption_templates`, kullanıcı başına TEK satır (`user_id` birincil
anahtar). Kurulum betiği depoda: `sql/05-sablonlar.sql`. Supabase panelinde
SQL Editor'e yapıştırılıp çalıştırılıyor; tekrar çalıştırılabilir.

Çakışma kuralı: **daha yeni olan kazanır**. `sablon.updatedAt` damgasını
istemci yazıyor (sunucu saati değil), böylece çevrimdışı yapılan bir
değişiklik sonradan bağlanan eski bir cihaz tarafından ezilmiyor.

**Tek istisna:** boş bir bulut kaydı, dolu bir yerel kaydın üzerine asla
yazamıyor — damgası daha yeni olsa bile. Sebebi: bu alanda iki kez veri
kaybı yaşandı (aşağıda), ve eskimiş bir şablon kaybolmuş bir şablondan
ucuzdur. Bunun bedeli: "hepsini sil" işlemi cihazlar arasına yayılmıyor.
Bilinçli tercih; değiştirilecekse önce silme niyetini ayrı bir alanla
(örn. `cleared_at`) taşımak gerekir.

**Geçmişte yaşanan iki veri kaybı — aynı kökten:**

1. Veri açılışta oturum çözülmeden okunuyordu: anahtar o an anonim
   anahtardı, kaydetme ise girişten sonra hesabın anahtarına yazıyordu.
   Okuma bir daha oraya bakmadığı için girişliyken girilen her şey
   yenilemede yok görünüyordu.
2. `sablonAfterSignIn()` çağrısı `afterSignIn` içinde, bulut okumasından
   SONRA duruyordu. `pullRemote()` bir kez hata verince (ağ, RLS, zaman
   aşımı) catch bloğu yutuyor ve şablonlar hiç yüklenmiyordu — kullanıcı
   "şablonlarım silinmiş" diye bildirdi. Veri yerinde duruyordu, ekrana
   hiç gelmiyordu. Beteri: sonra yazılan tek bir harf, boş hâli hesabın
   anahtarına kaydedip gerçekten siliyordu.

Alınan üç önlem (2026-09-01):
* Şablon yüklemesi buluttan bağımsız, `afterSignIn`'in EN BAŞINDA.
* `saveSablon()` boş hâli dolu kaydın üzerine yazacaksa önce
  `<anahtar>_yedek`'e kopyalıyor.
* Açılışta aktif anahtar boşsa `sablonAdaylari()` yedeğe ve anonim
  anahtara bakıp en dolu kopyayı geri getiriyor. Tarama YALNIZCA kendi
  anahtarlarına bakar — başka bir hesabın anahtarı asla okunmaz, ortak
  bilgisayarda çıkan kişinin şablonları sonrakinin ekranında kalmasın.

Aynı tuzağa düşmemek için: **oturum durumu değiştiğinde veriyi yeniden
oku, ve yerel veriyi asla bulut çağrısının başarısına bağlama.**
Yerel depo artık tek kopya değil, yine de emniyet ağı olarak duruyor.
