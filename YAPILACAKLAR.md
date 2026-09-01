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

### Google Drive bağlantısı ve yapay zekânın eksik bağlamı (1 Eylül 2026)

**Kullanıcının koyduğu sorun:** Yapay zekâ başlık/açıklama üretecekse
içeriğin ne olduğunu bilmesi lazım. Peki içerik nereden gelecek?

#### Önce teşhis: bugün AI'ya bağlam GİTMİYOR

`buildDraftPrompt` (`index.html:4976`) modele yalnızca üç şey
gönderiyor: içerik türü, platform ve başlık alanına yazılan metin.
Videonun ne anlattığını bilmiyor. Çıkan taslağın jenerik olmasının
sebebi anahtar ya da model değil, **bağlam yokluğu**. Yapay zekâ
katmanının değeri bu doldurulmadan düşük kalır — önce bu çözülmeli,
prompt'u güzelleştirmek değil.

Not: "ücretsiz yapay zekâ" sorusunun cevabı zaten yukarıdaki anahtar
maddesinde: kullanıcı kendi Gemini anahtarını giriyor, Google AI Studio
kredi kartsız veriyor, yani **kullanıcı için ücretsiz**. Yeni bir karar
gerekmiyor.

#### Drive, sosyal medyanın AKSİNE, ucuz

Yayın entegrasyonunda "sunucu şart, doğrulama şart, token sorumluluğu"
diyen gerekçelerin hiçbiri burada geçerli değil — tek şartla:
**`drive.file` kapsamı** kullanılacak.

* **Google Picker** tarayıcıda çalışıyor; kullanıcı dosyayı kendi
  Drive'ından kendi eliyle seçiyor.
* `drive.file` **hassas olmayan** kapsam: uygulama yalnızca kullanıcının
  seçtiği ya da kendi oluşturduğu dosyaları görür. `drive.readonly` ve
  tam `drive` için zorunlu olan pahalı güvenlik denetimini
  İSTEMİYOR. Google geliştiricileri bilerek bu yola itiyor.
* Google Identity Services'in tarayıcı token akışı **client secret
  istemiyor** → **Supabase Edge Function bile gerekmiyor.**
* Drive API ücretsiz, kotası geniş.

Ayrıca ürünün gizlilik vaadiyle örtüşüyor: uygulama kullanıcının
Drive'ını göremez, yalnızca parmağıyla gösterdiği dosyayı görür.

Doğrulama linkleri:
`developers.google.com/workspace/drive/api/guides/api-specific-auth` ve
`.../oauth2/production-readiness/restricted-scope-verification`.

#### İki yön eşit değil

| Yön | Değer | Zorluk |
|---|---|---|
| Script'i Drive'dan ÇEK | Yüksek — AI'ın eksik bağlamını tam olarak bu doldurur | Düşük (Google Docs `files.export` ile düz metin) |
| Hazır içeriği Drive'a YÜKLE | Düşük | Orta-yüksek (büyük video, resumable upload) |

**Yükleme tarafında karar: Slate yükleyici olmayacak, BAĞLAYICI olacak.**
Kullanıcı dosyayı zaten Drive'a koyuyor; Picker'la seçsin, Slate kaydın
içine dosya kimliğini/bağlantısını iliştirsin. Kaydın yanında "script",
"kurgu", "kapak" tek tıkla açılsın. %10 iş, %90 fayda. Kayıt şemasına
dosya bağlantısı alanı gerekir (bugün YOK).

#### Neden bu iş önemli — ürün tezine oturuyor

Ortaya çıkan zincir: Drive'daki script → Slate okur → AI'ya bağlam
verir → başlık, açıklama, hashtag, kapak promptu üretir → yayın modunda
tek ekranda kopyalanır.

Bunu Buffer/Later yapamaz, çünkü senin scriptini bilmiyorlar. "Asıl fark
yayının ÖNCESİNDE" tezinin en somut hâli bu. Üstelik "iki yere aynı şeyi
yazma" sorununu öbür uçtan da azaltıyor: içerik elle girilmek yerine
kendiliğinden geliyor.

**Maliyet:** 2000 kelimelik script ≈ 2.700 token. Haiku 4.5 ile
($1 / $5 per 1M) taslak başına yarım kuruşun altında; kullanıcının kendi
Gemini anahtarıyla sıfır.

#### Bilinen sınırlar (tasarlarken hesaba katılacak)

* Tarayıcı token'ı ~1 saatlik ve **yenileme token'ı yok** — kullanıcı her
  oturumda bir kez izin verir. Arayüz bunu doğal göstermeli.
* `drive.file` yalnızca seçilmiş dosyayı görür; "tüm Drive'ımı tara"
  diyen bir özellik TASARLANAMAZ (ve tasarlanmamalı).
* Çok uzun script'lerde metnin tamamı gönderilmemeli; sınır konmalı.

#### Sıra

1. Kayda **Drive dosyası bağlama** (Picker + `drive.file`) — dosya adı ve
   bağlantı kayıtta dursun. Tek başına bile faydalı.
2. Bağlı Google Docs'u **düz metin olarak okuma** (`files.export`).
3. `buildDraftPrompt`'u okunan script'le **besleme** — asıl kazanç burada.
4. Yüklemeye şimdilik girilmeyecek.

### Projeler ve script — boşluğun asıl yeri (1 Eylül 2026)

**Kullanıcının koyduğu sorun:** Projeler havada kalıyor, özellikle script
kısmı. Kullanıcı projeye fikrini düz metin yazabilmeli; oradan AI ile
scriptini Slate İÇİNDE hazırlayabilmeli. Slate video/görsel post etmenin
ötesinde bir araç olacaksa uçtan uca çalışmalı.

**Kodda doğrulandı:** `PROJ_STEPS` (`index.html:2405`) şöyle:
`['script','filmed','audio','edited','approved','package','published']`.
Yani **birinci adımın adı zaten `script`** — ama sadece bir onay kutusu
ve bir termin tarihi. Proje "script yazılmalıydı, geç kaldın" diyor,
kırmızıya boyuyor, ama **scriptin kendisi hiçbir yerde durmuyor.**
Havada kalma hissinin kaynağı tam olarak burası: sistem işi takip
ediyor, işi barındırmıyor.

`sanitizeProject` bugün `notes` (2000 karakter) ve `keywords` (200)
tutuyor. Yani "fikir alanı" yarı yarıya VAR. Ama 2000 karakter ≈ 300
kelime: bir fikre yeter, bir script'e yetmez (2000 kelimelik script
≈ 12.000 karakter).

#### Karar: iki ayrı alan, tek alan değil

* `notes` — fikir, brief, aklına geleni yaz. Kısa kalır.
* `script` — uzun metin, çalışma alanı. YENİ alan, ayrı sınır.

`notes`'u şişirip ikisini tek alana yüklemek yanlış: biri girdi, öbürü
çıktı; biri kısa kalmalı, öbürü büyüyecek.

#### Kurulacak zincir

fikir (`notes`) → AI script üretir → script Slate'te düzenlenir →
`script` adımı KENDİLİĞİNDEN işaretlenir → aynı script caption/başlık
üretiminin bağlamı olur (bkz. bir üstteki Drive/AI maddesi) →
gerekirse Drive'a dışa aktarılır.

Buradaki küçük ama önemli ayrıntı: script yazıldığında adımın kendi
kendine işaretlenmesi. "Uçtan uca"yı gerçek hissettiren şey daha fazla
form değil, bir adımın çıktısının bir sonrakinin girdisi olması.

#### Drive'ın yönü DEĞİŞTİ

Bir üstteki maddede "Drive'dan ÇEK, yükleme yapma" yazmıştı. Script
Slate'te yazılıyorsa birincil akış tersine dönüyor:

* **Dışa aktarma (Drive'a yaz)** artık anlamlı. `drive.file` kapsamı
  uygulamanın KENDİ oluşturduğu dosyalara izin veriyor, yani düz metni
  Google Doc'a çevirip yazmak ucuz.
* **Ama tek kişilik kullanımda faydası az** — script zaten Slate'te ve
  telefonda. Değeri, Slate'i OLMAYAN ikinci bir kişi (kurgucu,
  seslendiren, kameraman) script'e ihtiyaç duyduğunda ortaya çıkıyor.
  Dışa aktarma bu gerekçeyle yapılacak, refleksle değil.
* **İçe aktarma (Drive'dan oku)** ölmedi: hâlihazırda Docs'ta yazan
  kullanıcı için giriş yolu olarak kalıyor.

#### Prompt'u KULLANICIYA yazdırmayacağız (karar)

Kullanıcının "AI için prompt bile yazabilsin" fikrine karşı sav: prompt
yazması gereken kullanıcı ChatGPT'ye gider — orada daha iyisini bedava
yapar. Slate'in üstünlüğü, ChatGPT'ye ANLATILMASI GEREKEN şeyi zaten
biliyor olması: proje adı, proje türü (`PROJ_TYPES`: outdoor/venue/
studio/vlog/review/desk), anahtar kelimeler, platform, içerik türü
(shorts mı uzun mu), dil, termin, ve kullanıcının geçmiş
caption'ları/şablonları (ses tonu için).

**Yani prompt'u Slate kuracak.** İleri kullanıcı için "prompt'u düzenle"
açılır bir alan olabilir, ama ASLA ön kapı olmayacak.

#### Kapsam uyarısı — "uçtan uca"nın sınırı

Yön doğru, ama harfiyen alınırsa Slate daha kötü bir Notion + daha kötü
bir ChatGPT + daha kötü bir Buffer olur. Uçtan ucu gerçek yapan şey her
aşamaya SAHİP olmak değil, **zincirin kopmaması** — her aşamanın
çıktısının bir sonrakinin girdisi olması, arada yeniden yazılmaması.

Script bu yüzden en yüksek kaldıraçlı halka: aşağıdaki bütün alanları
besleyen tek çıktı o. Kurgu, thumbnail üretimi, video barındırma
aşamaları BAĞLANACAK, içeri alınmayacak.

#### Script nereden gelirse gelsin AYNI ALANA düşer (kullanıcı kararı)

Üç giriş kapısı var ve üçü de eşit meşru:

1. **Drive'dan getir** — kullanıcı fikrini/scriptini zaten Docs'a yazmış.
2. **Doğrudan yaz** — Slate'in içinde elle.
3. **Fikirden üret** — `notes`'a fikrini yazar, AI script'i üretir.

**Kural: üçü de tek bir `script` alanına yazar.** Kapılar o kutunun
üstündeki üç düğmeden ibaret. Havada kalmamasının sebebi bu — script'in
yaşadığı tek bir yer var, oraya nasıl geldiği ayrı bir mesele.

Kaynak `scriptSource` olarak saklanacak (`drive` / `manual` / `ai`):
ucuz, ve arayüzü doğru davrandırıyor — Drive'dan geldiyse "dosyayı
yeniden getir" ve belgeye bağlantı, AI ürettiyse "yeniden üret" ve
"önceki hâle dön". Elle düzeltildikten sonra karışık hâle gelir; davranış
kaynağa KİLİTLENMEYECEK, düğmeler açık kalır.

**Drive kopya olacak, canlı bağlantı DEĞİL.** İki yönlü senkron tuzak:
çakışma çözümü gerekir ve bu ekip zaten iki kez veri kaybetti. "Drive'dan
getir" o anda metni kopyalar, biter. Belge sonradan değişirse kullanıcı
düğmeye tekrar basar, üzerine yazmadan önce sorulur. Arka planda
kendiliğinden senkron YOK.

#### Mühendislik notu — üç düzenleme, üçü de ŞİMDİ yapılmalı

Bunlar engel değil; sonradan eklenmesi acı veren, baştan yapılması küçük
olan üç karar. Kullanıcı haklı: değişiklik yapılacaksa düzenleme ona göre
kurulmalı.

**1. Telefon bilgisayardaki scripti ezmesin.**
Senkron bugün projeyi SATIR SATIR gönderiyor (`projToRow`,
`index.html:2743`) ve satırın tamamını yazıyor. Yani: bilgisayarda
scripti yazdın; sonra telefondan aynı projeyi açıp sadece termin
tarihini değiştirdin — telefon projenin TAMAMINI gönderir, içinde kendi
eski/boş script kopyasıyla. Script geri gider.

Bugün bu önemsiz, çünkü projedeki her şey kısa ve yeniden yazılabilir.
Script değil.

Çözüm, şablonlarda zaten kullanılan yöntem: **script'e KENDİ zaman
damgası** (`script_updated_at`), projeninkinden ayrı. Damgası daha yeni
olan kazanır. Script'e dokunmamış telefonun damgası eski kalacağı için
üzerine yazamaz. Ayrıca script yalnızca gerçekten değiştiyse gönderilir.

Not: `projects` senkronu `caption_templates`'ten zaten daha güvenli —
kullanıcı başına tek satır değil, proje başına satır ve "kirli" işareti
var. Yani buradaki risk şablonlardaki kadar geniş değil; tehlike "boş
dolunun üzerine yazar" değil, **"eski dolunun üzerine yazar"**. Damga
bunu kapatıyor.

**2. "Yeniden üret" iki saatlik emeği silmesin.**
Kullanıcı AI'dan script aldı, sonra elle uzun uzun düzeltti, sonra
(belki yanlışlıkla) "yeniden üret"e bastı. Yeni metin eskinin üstüne
yazar ve geri dönüş yok. Çözüm bir satır: üretmeden önce mevcut hâli bir
kenara koy, ekranda "önceki hâle dön" dursun.

**3. Tarayıcı hafızası sessizce dolar.**
Her şey bugün tarayıcının hafızasında (localStorage), sınırı ~5 MB.
Caption'lar küçük olduğu için hiç sorun çıkmadı. Script büyük: 100 proje
× ~12.000 karakter ≈ 1,2 MB. Tek başına patlatmaz ama sınıra yaklaşır —
ve localStorage dolduğunda **hata gösterip durmaz, sessizce yazmaz**;
kullanıcı kaydettim sanır. Çözüm: script'in asıl yeri bulut olacak,
tarayıcı emniyet ağı olarak kopyayı tutacak (altyapı hazır, `projects`
tablosu zaten senkron), ve script alanına üst sınır konacak (~40.000
karakter ≈ 6.000 kelime; gerçek script'in çok üstünde, ama yanlışlıkla
yapıştırılan bir kitap bütçeyi yemesin).

**İşin boyutu küçük:** `projects` tablosuna bir `script` sütunu (+
`script_updated_at`), `projToRow` ve `projFromRow`'a birer satır,
`sanitizeProject`'e bir alan. Senkron altyapısı olduğu gibi çalışıyor.

#### Maliyet

Bir script üretimi ≈ 2.700 çıktı token'ı. Haiku 4.5 ile ($5/1M çıktı)
script başına ~1,5 kuruş; kullanıcının kendi Gemini anahtarıyla sıfır.
Caption üretiminden pahalı ama hâlâ önemsiz.

#### Sıra

1. Projeye `script` alanı (uzun metin) + düzenleme alanı. AI olmadan da
   faydalı: script'in duracağı bir yer olur.
2. Boş-üzerine-yazmaz koruması + AI öncesi anlık kopya.
3. `notes` + proje bilgilerinden Slate'in kurduğu prompt ile AI script
   üretimi.
4. Script yazılınca `script` adımının kendiliğinden işaretlenmesi.
5. Script'i caption/başlık üretimine bağlam olarak besleme.
6. Drive'a dışa aktarma — ekip gerekçesi doğrulandığında.

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
