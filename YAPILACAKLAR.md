# Slate — Yapılacaklar ve Değerlendirilenler

Bu dosya oturumlar arasında hafıza görevi görüyor. Claude'un hafızası
oturumlar arasında taşınmıyor; konuşulan ama yapılmayan işler burada
duruyor, neden ertelendiği de yazıyor ki aynı tartışma baştan yapılmasın.

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

**SIRADAKİ İŞ: Termin hatırlatmaları** (aşağıdaki bölüm). Kullanıcının
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
