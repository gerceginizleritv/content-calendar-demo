# Slate — Yapılacaklar ve Değerlendirilenler

Bu dosya oturumlar arasında hafıza görevi görüyor. Claude'un hafızası
oturumlar arasında taşınmıyor; konuşulan ama yapılmayan işler burada
duruyor, neden ertelendiği de yazıyor ki aynı tartışma baştan yapılmasın.

---

## Nerede kaldık (3 Eylül 2026, gece — telefon)

**Bulut okunamayınca ekranda DEMO verisi kalıyordu.** Kullanıcı telefondan
hesabına girdi, kayıtları gelmedi. Koda bakınca çıkan gerçek kusur:
`afterSignIn` içindeki `catch` yalnızca birkaç saniyelik bir bildirim
gösteriyor, ekranda açılışta üretilen demo tohumu duruyordu. Kullanıcı
kendi verisinin kaybolduğunu sanıyor. Dahası: o hâldeyken bir kayda
dokunup kaydetseydi demo satırları `demo_cal_<uid>` anahtarına yazılıyor
ve `pushChanges` ile HESABINA gidiyordu.

Yapılan:
- Okuma başarısızsa ekran boşaltılıyor, kuyruk temizleniyor.
- Kırmızı bir şerit çıkıyor: ne olduğu + "hiçbir şey kaybolmadı,
  kayıtlar hesabında" + **Tekrar dene**.
- `save()` ve `pushChanges()` o hâlde hiçbir şey yazmıyor (iki ayrı kapı).
- Yeni kayıt girişi kapalı, sebebi düğmenin üstünde yazıyor.
- Şablon / fikir / script / tercih senkronu ETKİLENMİYOR — ayrı veri
  kümeleri, kendi hata yönetimleri var.
- Tekrar denenince kilit okuma başarılı olur olmaz kalkıyor. (İlk yazışımda
  kilidi en sonda kaldırmıştım; aradaki `save()` erken dönüyor ve hesabın
  yerel kopyası hiç yazılmıyordu. Kendi testim yakaladı.)

`bulut-hata.test.js` telefon boyutunda çalışıyor.

Kullanıcı "Buluta ulaşılamadı" dedi — yani okuma gerçekten başarısız.
Bunun üzerine şerit artık SEBEBİ ayırt ediyor:

- **ağ** (`fetch` patlıyor: "Failed to fetch"): "Bu cihaz buluta ulaşamadı"
  + içerik engelleyici / VPN / kurum ağı ihtimali. Telefonda en sık sebep.
- **oturum** (401/403 ya da JWT/expired): Slate **kendiliğinden bir kez
  `refreshSession()` deniyor** ve başarılıysa kullanıcı hiçbir şey
  görmüyor. Olmazsa "çıkıp yeniden gir" diyor.
- **sunucu** (RLS/izin vb.): "Sunucu isteği geri çevirdi".

Her üçünde de sunucunun KENDİ cümlesi küçük mono bir satırda yazıyor —
"bir şeyler ters gitti" ne kullanıcıya ne bize bir şey söylüyordu.
"Tekrar dene" önce oturumu tazeliyor, sonra yeniden okuyor.

**HÂLÂ BİLİNMİYOR:** kullanıcının telefonunda hangi cins hata olduğu.
Yeni şerit bunu kendisi söyleyecek; cevabı gelince buraya yazılacak.
Eğer "ağ" çıkarsa sıradaki adım muhtemelen içerik engelleyici; "oturum"
çıkıp tazeleme de olmuyorsa Supabase'in refresh token ayarlarına
bakılacak; "sunucu" çıkarsa RLS politikası.

---

## Nerede kaldık (3 Eylül 2026, gece)

**AI üretim yüzeyi yapıldı.** Zincirin tamamı artık modele gidiyor.

- **Script penceresinde "✨ AI ile yaz".** Bağlam: seçili proje (ad, tür,
  anahtar kelimeler, adres, notlar), o projenin fikirleri (birleşik
  kartların her parçası ayrı satır) ve script başlığı. Üretmeden önce
  mevcut metin bir kenara konuyor, "önceki hâle dön" onu geri getiriyor;
  dolu metnin üstüne sorulmadan yazılmıyor.
- **Kayıtta üç alan:** açıklama (vardı), video başlığı ve kapak yazısı
  (yeni). Bağlam: proje + o projenin SCRIPT'i + fikirleri + tür, platform,
  tarih. Önceki prompt yalnızca türü, platformu ve başlığı görüyordu —
  asıl kayıp oradaydı.
- Model çıktısı alana konmadan temizleniyor (tırnak, "Başlık:" öneki,
  markdown yıldızı; tek satırlık alanlarda ilk satır).
- Dayanak yoksa (başlık da proje de fikir de yok) istek HİÇ gitmiyor,
  sebebi yazıyor. Anahtar yoksa ayar ekranı açılıyor.
- `source` alanı artık 'ai' de olabiliyor ve doğru yazılıyor: anlık
  görüntüyü Drive ile AI paylaştığı için kaynak ayrı değişkende tutuluyor.

**Gemini anahtar biçimi.** Google artık AI Studio'dan `AQ.` ile başlayan
anahtarlar veriyor; yalnızca `AIza` kabul eden kontrol GEÇERLİ anahtarları
reddediyordu. İkisi de kabul ediliyor. Rehber metinleri ve yer tutucu da
güncellendi.

**Eskimiş iki test silindi/yenilendi:** `script.test.js` ve
`script-bulut.test.js` `10ac299`'da kalkan eski veri modelini (projeye
gömülü script, `scriptYaz`, `demo_scripts`) test ediyordu — bugünkü
değişikliklerin sebep olduğu bir kırılma değil. Yerlerine `script2` ve
`script-bulut2` yazıldı.

---

## Nerede kaldık (3 Eylül 2026)

Bugün düzeltilen üç şey:

1. **Takvimdeki proje filtresi.** Uzun listede ad aramak mümkün değildi;
   panelin en üstüne arama kutusu geldi (sekiz projeden azsa çıkmıyor,
   kısa listede yer kaplamasın diye). Her projenin kaç kaydı olduğu da
   listede yazıyor.
2. **Filtre panelindeki "yana kayma".** `.legend`'in tabanı
   `flex-wrap:wrap`; yüksekliği sınırlı bir SÜTUN'da wrap, sığmayan
   öğeleri **ikinci bir sütuna** atıyordu — panelin altında yatay
   kaydırma çubuğu çıkıyor, liste iki kolona bölünüyordu. Kullanıcı bunu
   "bitenler / devam edenler gibi ama anlamadım" diye tarif etti.
   `flex-wrap:nowrap` + `overflow-x:hidden`. Bu bütün filtre panellerini
   ilgilendiriyordu (tür, platform, durum, pazar).
3. **Kaydın proje bağı yüklemede düşüyordu — VERİ KAYBI.** Başka bir
   oturumdan gelen rapor doğru çıktı. İki ayrı eksik vardı:
   - `sanitizeEvent` içindeki `content` beyaz listesinde `projectId`
     yoktu; beyaz listede olmayan her alan sessizce düşüyor.
   - `fromRow` buluttaki ayrı `project_id` sütununu `content`'e geri
     yazmıyordu.
   Kaybı `projeleriGocur()` örtüyordu: aynı ADI taşıyan projeye yeniden
   bağlıyor. Proje adı (`content.concept`) boşsa ya da farklı yazılmışsa
   bağ gidiyordu — Projeler sayfası "0 kayıt" diyor, kayıt açılınca
   listenin **ilk projesi** seçili geliyor ve kaydedilince gerçek proje
   sessizce eziliyordu. Teşhis, düzeltmeden ÖNCE testle kanıtlandı
   (`proje-bagi.test.js`).

Ayrıca: uygulama içindeki tanıtım bloğu kaldırıldı (karşılama sayfası
maddesine bakın) ve **AI ayarları sol menüye taşındı** — o ekrana daha
önce yalnızca kayıt düzenlerken "AI ile taslak" düğmesinden ve yalnızca
anahtar YOKKEN gidilebiliyordu, kullanıcı ekranı bulamadı.

**Ders (yeni hata sınıfı):** beyaz listeyle temizlenen bir nesneye alan
eklerken beyaz listeyi güncellemek ZORUNLU; unutulursa alan sessizce
düşer ve kayıp, onu telafi eden başka bir mekanizma (burada ad
eşleştirme) yüzünden aylarca fark edilmeyebilir.

---

## Nerede kaldık (1 Eylül 2026, akşam)

**Lokasyon göçü TAMAMLANDI.** `sql/07`–`sql/11` sırayla çalıştırıldı.
Sonuç: 112 yayın kaydının 101'i projesine bağlandı, 43 lokasyon Slate
projesi oldu, sınır 100.000'e çıkarıldı. Geriye kalan 11 kayıt Slate'in
kendi demo kayıtları (İngilizce başlıklar, lokasyon bağı hiç yoktu) —
hata değil; kullanıcı isterse arayüzden silebilir.

Göç sırasında çıkan tek hata: `locations` tablosunda `user_id` sütunu
yok, kayıtlar çalışma alanına bağlı. `sql/11` düzeltildi, sahip
`workspaces.owner_id`'den okunuyor. Yerel test ortamı ile üretim şeması
arasındaki fark bu göçte üçüncü kez sürpriz oldu; bundan sonra şema
varsayımı yapmadan önce `information_schema`'ya bakılacak.

**Geri dönüş yolu açık:** `sql/09-geri-al.sql` duruyor, lokasyon
uygulaması (`lokasyon.html` ve kendi deposu) çalışır durumda. Kullanıcı
kararı: bir hafta sorunsuz gidene kadar eski sistem silinmeyecek.

**Fikir → Script zinciri kuruldu (1 Eylül gecesi).** Yol haritasının 02.
maddesi. Her projenin artık bir **Fikirler** listesi ve bir **Script**
alanı var; tabloda `FİKİR → SCRIPT` zinciri görünüyor. "Bu fikirlerden
script yaz" düğmesi bugün fikirleri iskelet olarak script alanına
yazıyor — AI kapısı açıldığında aynı yeri o dolduracak, arayüz
değişmeyecek.

İkisi de `project_scripts` tablosunda ama **ayrı zaman damgalarıyla**:
telefondan fikir eklerken masaüstünde yazılan scriptin geri alınmaması
için. Proje satırı script taşımıyor; ezme ihtimali yapısal olarak yok.

Sırada (yol haritasındaki sıra): **fikirden üret** (AI anahtarını
bekliyor) → **script'i caption üretimine bağlam olarak besleme** →
**Drive'dan getir** → Drive'a dışa aktarma.

**SIRADAKİ İŞ (kullanıcı listesi): Termin hatırlatmaları** (aşağıdaki bölüm). Kullanıcının
verdiği sıralamada 4. madde; 1, 2 ve 3 bitti (3'ün yerini birleştirme
aldı).

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

### Lokasyon uygulamasi Slate'e birlestiriliyor (karar: 1 Eylül 2026)
Kullanıcı kararı: iki ayrı uygulama yerine tek araç. Sebep: tüm
geliştirme Slate'te yapılıyor, her özellik iki kez yazılıyordu
(çoğaltma ve sürükle-bırak fiilen iki kez yazıldı).

**Bitti:** Slate kullanıcının bütün yayın kayıtlarını görüyor
(`workspace_id` filtresi kalktı), sınır hesaptan okunuyor
(`user_prefs.entry_limit/project_limit`), kayıtların eski platform
kodları Slate sözlüğüne çevrildi (`sql/08`), geri alma betiği var
(`sql/09`).

**Kapatılan üç veri kaybı riski** — taşımadan önce fark edilmeseydi
sessizce bozardı:
1. `toRow` `workspace_id` yazmıyordu → Slate'ten kaydedilen satır
   lokasyon uygulamasından görünmez olurdu (geri dönüş noktası giderdi).
2. `pullRemote` `deleted_at` süzmüyordu → orada silinen kayıt Slate'te
   diri görünürdü.
3. 63 kaydın platform kodu eskiydi ve türü boştu; Slate tanımadığını
   varsayılana çevirdiği için türleri/hesapları yanlış görünecekti.

**Ücretsiz planda Supabase yedeği YOK.** Yedek `sql/08`'in kendisi
alıyor: aynı veritabanında `calendar_events_yedek` kopya tablosu.
`create table if not exists` kritik — betik ikinci kez çalışırsa yedek
TAZELENMEMELİ, yoksa tek sağlam kopya çevrilmiş veriyle değişir.

**Sırada:** 43 lokasyon → Slate projeleri. Önce Slate'in proje
sayfasına lokasyon alanları eklenecek (ilçe, şehir, konu, format, izin,
script linki, Drive klasörü, saha notları, dikkat edilecekler) —
**isteğe bağlı ve katlanmış**: boşsa görünmüyor, üründe kalabalık
yapmıyor.

**İSTENMEDİ:** "Değişiklik Kaydı" (lokasyon uygulamasındaki hareket
günlüğü) Slate'e taşınmayacak — kullanıcı gerek olmadığını söyledi.

**Lokasyon uygulaması ne olacak:** değişmiyor, aynı satırları okumaya
devam ediyor, geri dönüş noktası olarak duruyor. Geliştirme yapılmayacak.

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

### Script alanına metin biçimlendirme (kullanıcı isteği, 2 Eylül 2026)
Kullanıcı: *"basit bir metin düzenleme aracı eklenebilir mi? Metin
boyutu, başlık, italik vs."* Karar: **şimdilik değil**, önce Drive'a geri
yazma bitecek.

**Sıra geldiğinde önerilen yol — düğme çubuğu + Markdown + önizleme,**
tam WYSIWYG değil. Sebep dört tane ve hepsi bu üründe zaten yaşanmış
şeylere dayanıyor:

1. **Depolanan şey düz metin kalıyor.** Bugün script `text` alanında düz
   metin; Drive'dan gelen de düz metin. WYSIWYG'e geçmek zengin metin
   (HTML) demek, o da Drive'a gidiş-dönüşte, aramada ve AI'a bağlam
   olarak beslemede ayrı ayrı dönüştürme demek.
2. **AI kapısı bu metni okuyacak.** Markdown'ı model doğrudan anlıyor;
   HTML gürültü.
3. **Arama basit kalıyor.** Fikir/script aramasında etiketleri temizleme
   derdi çıkmıyor.
4. **İş küçük.** Kalın/italik/başlık/liste düğmeleri seçili metnin
   etrafına işaret koyuyor, bir de "önizleme" sekmesi. WYSIWYG'de imleç
   yönetimi, yapıştırma temizliği ve geri alma baştan yazılır.

**Karar verilecek:** önizleme ayrı sekme mi, yan yana mı. Telefonda yan
yana sığmaz; muhtemelen sekme.

### "Bu nasıl çalışır" turu güncellenecek (kullanıcı kararı, 2 Eylül 2026)
Kullanıcı: *"proje çalışmamız için how to bölümünü update etmemiz
gerekecek. Şimdi yapmayacağız."*

**Neden gerekiyor:** tur (`TOUR_STEPS_I18N`, on adım) ürünün eski hâlini
anlatıyor. O yazıldığında Slate üç sekmeliydi ve iş projeyle başlıyordu.
Bugün beş sekme var ve **iş fikirle başlıyor**. Turda hiç geçmeyen ya da
yanlış anlatılan şeyler:

- **Fikirler** ve **Scriptler** diye iki sayfa var; ikisi de projeden
  bağımsız. Turun ikinci adımı hâlâ "Tek çekim, tüm prodüksiyon" diyerek
  işin projeyle başladığını anlatıyor.
- Zincir: fikir → script → proje → takvim. Menü sırası bunu anlatıyor
  ama tur anlatmıyor.
- Fikir kartlarını birleştirme/ayırma, tek parçayı sürükleyip çıkarma.
- Script yazınca "script" adımının kendiliğinden işaretlenmesi.
- Projelerde iptal işareti ve üstteki özet şeridi.
- Gün görünümü ve saat ızgarası (09:00–00:00).

**Not:** turdaki her adımın kendi SVG çizimi var (`TOUR_ART`); yeni
adımlar için de çizim gerekecek, yoksa aradaki adımlar boş görünür.

**Karar verilecek:** tur on adımdan uzun olmamalı. Yeni maddeler
eklenirken hangi eski adımların birleşeceği ya da düşeceği seçilecek —
"her özelliği anlat" listesi turu kimsenin okumadığı bir slayt gösterisi
yapar.

### Karşılama (landing) sayfası (kullanıcı kararı, 3 Eylül 2026)
Kullanıcı: *"Slate'e tıklayınca introlu bölüm geliyor. Bunu şimdilik
kaldır ama bir landing page yapacağız ilk giriş için."*

**Yapıldı:** uygulamanın içindeki tanıtım (`#pitch`, `#pitchBanner`,
"Slate nedir?" düğmesi) kapatıldı — `PITCH_ACIK = false`. Metinler ve
düzenek SİLİNMEDİ, karşılama sayfasında yeniden kullanılacak.

**Yapılacak:** ayrı bir `karsilama.html` (ya da `index.html` kök,
uygulama `app.html`). İçinde kullanılabilecek, halihazırda yazılmış ve
iki dilde duran metinler:

- `h1` — "Tek çekim on posta dönüşür. Slate onunu da tek panoda tutar."
- `h1_sub` — aynı çekimin Reel/Short/carousel/story olarak çıkması.
- `promise_tag` — "Planlama panosu — otomatik paylaşan bir araç değil."
  (Ziyaretçinin en olası yanlış varsayımını baştan kesen cümle; karşılama
  sayfasında da mutlaka bulunsun.)
- `banner_bold1` + `banner_rest` — "bu çalışan bir demo, hesapsız da
  çalışıyor, 100 kayıt sınırı".

**Karar verilecek:** karşılama sayfası ile uygulama aynı adreste mi
duracak (`/` tanıtım, `/app` uygulama) yoksa tanıtım kendi alan adında mı.
Bu, "Kendi alan adı" maddesiyle birlikte kararlaştırılmalı — ikisi aynı
karar.

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
