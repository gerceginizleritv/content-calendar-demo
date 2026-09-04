# Shootboard (eski adı Slate) — Yapılacaklar ve Değerlendirilenler

Bu dosya oturumlar arasında hafıza görevi görüyor. Claude'un hafızası
oturumlar arasında taşınmıyor; konuşulan ama yapılmayan işler burada
duruyor, neden ertelendiği de yazıyor ki aynı tartışma baştan yapılmasın.

---

## Nerede kaldık (3 Eylül 2026, gece — yeniden adlandırma ve alan adı)

**Ürünün adı Slate → Shootboard.** Sebep: pazar araştırması (`docs/pazar-arastirmasi.md`)
"Slate" adının içerik üretimi kategorisinde başka bir şirket tarafından
kullanıldığını gösterdi. Aday isimler DNS ön kontrolüyle elendi; kullanıcı
Shootboard'u seçti. TÜRKPATENT taramasında birebir ya da ayırt edilemeyecek
kadar benzer marka çıkmadı; 9 ve 42. sınıflarda "shoot90" (Shoot90 Bilişim,
aktif yazılım şirketi) ve "shootid" (42) yayın döneminde itiraz edebilecek
markalar olarak not edildi. Savunma: aynı sınıflarda "shoot" ile başlayan
yedi marka yıllardır yan yana, kelime zayıf unsur.

**Marka tescili ERTELENDİ (kullanıcı kararı, maliyet):** ilk gelirle birlikte,
EPATS'tan kendisi, önce yalnızca 42. sınıf; 9 ayrı başvuruyla sonra; EUIPO
ancak AB müşterisi olunca; USPTO ancak ABD geliri olunca. Tescilsiz dönemde
tarihli kullanım kanıtı klasörü tutulacak (alan adı kaydı, ilk duyuru,
paylaşımlar, faturalar). Ürün adında ™ kullanılabilir, ® kullanılamaz.

**shootboard.app Cloudflare'den alındı (3 Eylül 2026); DNS A ve www CNAME
kayıtları girildi.** Bu birleştirmede yapılanlar:
- Kullanıcıya görünen bütün "Slate" metinleri Shootboard oldu: karşılama
  sayfası (index.html, çizimdeki "SLATE · SCRIPT" etiketi dahil), uygulama
  (app.html), privacy.html, manifest.json, sw.js bildirim başlığı. Türkçe
  ekler ünlü uyumuna göre çevrildi (Slate'e → Shootboard'a, Slate'in →
  Shootboard'un, Slate'te → Shootboard'da).
- Depo köküne `CNAME` dosyası eklendi: `shootboard.app`.
- DEĞİŞMEYENLER, bilerek: localStorage anahtarları (`demo_*`,
  `slate_giris_donus`), service worker önbellek adı (`slate-v1`), bildirim
  etiketi (`slate-termin`), Supabase tablo ve sütun adları, ICS takvim
  adları, GoatCounter site kodu (`slate-demo`), kod tanımlayıcıları
  (`SLATE_ISARET`), gelen/kayitlar.json. Bunları değiştirmek veri
  kaybettirir, önbelleği ya da ölçümü koparır.

**Kullanıcının yapacakları (kod dışı), birleştirmeden sonra:**
1. GitHub → Settings → Pages → Custom domain: shootboard.app; DNS kontrolü
   geçince "Enforce HTTPS". CNAME main'e girince eski github.io adresi yeni
   alan adına yönlenir; sertifika gelene kadar site kısa süre açılmayabilir.
2. Supabase → Authentication → URL Configuration: Site URL
   https://shootboard.app; Redirect URLs listesine https://shootboard.app/**
   (eski github.io adresi geçiş süresince kalsın). Giriş `redirectTo:
   location.href` kullanıyor, yani liste şart.
3. Google Cloud → OAuth istemcisi (DRIVE_CLIENT_ID) → Authorized JavaScript
   origins: https://shootboard.app; yoksa Drive getir/yaz yeni adreste
   çalışmaz.
4. İsteğe bağlı: GoatCounter'da yeni site kodu; GitHub hesap düzeyinde alan
   adı doğrulaması (TXT kaydı) ele geçirmeye karşı.

---

## İçerik çalışması sohbetten (3 Eylül 2026)

İçerik işleri (kayıt ekleme, yayın paketi) artık bu sohbet üzerinden de
yürüyor. Eski lokasyon uygulamasında kayıtlar dosyanın içindeydi, Claude
dosyayı düzenliyordu. Slate'te veri Supabase'de ve sohbetin oturum anahtarı
yok; bu ortamdan `supabase.co` adresine ağ da kapalı (vekil 403 veriyor).

**Çözüm: gelen kutusu.** Kayıtlar `gelen/kayitlar.json` dosyasına yazılıyor.
Slate, giriş yapılmış açılışta (afterSignIn'in sonunda, kayıtlar ve
projeler geldikten sonra) dosyayı `cache:'no-store'` ile okuyor, hesapta
olmayan kayıtları kullanıcının oturumuyla buluta yazıyor ve toast gösteriyor.

- Alınan kimlikler **`user_prefs.prefs.gelen_alinan`** defterinde. Tabloya
  bakılsaydı kullanıcının Slate'te sildiği kayıt her açılışta geri gelirdi;
  tarayıcı deposunda olsaydı ikinci cihaz bir daha alırdı. Bu yüzden
  `tercihPush` artık prefs'i `tercihPrefsYap()` ile kuruyor (dil + defter);
  eskiden `{lang}` yazıp defteri silerdi.
- Defter okunamadıysa (`gelenDefterHazir` false) kutu HİÇ işlenmiyor: çift
  kopya, bir açılış gecikmesinden kötü. `tercihSenkron` artık sözü tutulup
  gelen kutusundan önce bekleniyor.
- `proje` alanı proje ADI; tam ad, yoksa baş harfleriyle eşleşiyor
  ("Nuruosmaniye" → "Nuruosmaniye Camii"). Kimlik desene uymayan kayıt
  atlanıyor (yoksa sanitize yeni kimlik üretir, defter tutmaz).
- Anonim modda çalışmıyor: demo verisine karışmasın.
- Kutuda duran kayıt: **Nuruosmaniye** uzun video, YouTube **18 Eylül 2026
  20:00** + Facebook paylaşımı **21:00**. Paket Drive'daki script v1'den.
- Yayına çıkması için dal main'e alınmalı (GitHub Pages). Headless testte
  (`scratchpad/gelen.test.js`) iki kayıt alınıyor, ikinci koşum 0,
  silinmiş kayıt geri gelmiyor.

`sql/19` betiği bu yüzden kaldırıldı; aynı kayıt kutuda, kimlik aynı
(`ev_nuruosmaniye_yt_20260918`), betik koşulmuş olsa bile çift oluşmaz.

Kaynak: yayın paketi biçimi için `lokasyon.html` içindeki Zeyrek / Rumeli
Hisarı kayıtları örnek alındı (hook → madde listesi → "Rivayet değil,
kayıt." → kaynaklar → hesaplar → hashtagler; Facebook'ta kısa hook +
"🎬 TAM BELGESELİ İZLEMEK İÇİN" + "Sayfamda Abonelikler açık").

---

## Test takımı — koşum düzeni ve emekliye ayrılanlar (3 Eylül 2026)

**Testler bir kusur ortaya çıkardı (düzeltildi):** Takvimden "+ yeni proje"
seçip platform seçmeyi unutan kişi "En az bir platform seç" uyarısını
alıyordu — ama proje ÇOKTAN oluşmuştu. Vazgeçince geride adı sorulmuş, boşa
düşmüş bir proje kalıyordu. Sebep sıraydı: `secilenProjeyiCoz()` projeyi
kuruyor, platform/tür doğrulaması ondan SONRA geliyordu. Doğrulama öne
alındı. Teşhis, düzeltmeden önceki yapıda testle kanıtlandı
(`yeniproje-bos.test.js`: düzeltmeden önce 0 → 1 proje, sonra 0 → 0).

**Ders:** Yan etkisi olan bir adımı (kayıt oluşturma, ad sorma) doğrulamadan
önce çalıştırma. Doğrulama başarısız olunca geri alınacak bir şey kalmasın.


Testler `index.html` yerine artık **`app.html`**'e bakıyor. Koşum düzeni tek
tip DEĞİL; koşturucu her teste beklediğini vermeli:

| Tip | argv | Örnek |
|---|---|---|
| fikstür/ekran görüntüsü dizini | `argv[2]` = dizin | `node arama.test.js .` |
| port | `argv[2]` = port (varsayılan 8098) | `node proje-arama.test.js` |
| tam adres | `argv[2]` = URL (varsayılan app.html) | `node sayfa-hafiza.test.js` |
| lokasyon testleri | `argv[2]` = dizin, `argv[3]` = port | `node lok-klon.test.js . 8099` |

Sunucular: **8098** = depo kökü (Slate), **8099** = lokasyon uygulaması
(`lokasyon.html`'in `index.html` adıyla sunulduğu bir sembolik bağ dizini),
**8097** = eski Slate anlık görüntüsü (`eski/`).

**Emekliye ayrılanlar** (kod değil, testin kendisi eskimişti — gerekçeleri
`scratchpad/emekli/NEDEN.md` dosyasında):
- `win.test.js` — takvimin eski 42 günlük sabit penceresini doğruluyordu;
  uygulama gerçek ay penceresine geçti (`ay.test.js` sınıyor).
- `fikir.test.js` — fikirlerin projeler tablosundan açılan bir pencerede
  yaşadığı eski mimariyi sınıyordu; fikirler kendi sayfasına taşındı
  (`akis`, `kart`, `parca`, `parca-surukle`, `fikir-secim`, `sc-fikir-ekle`
  testleri geçiyor).
- `donusum.test.js` — koşulamıyor: lokasyon uygulamasının özgün yedek
  dosyasını istiyor, o dosya artık yok. Göç bir kez yapıldı ve doğrulandı.
- `push.onceki.test.js` — GEÇMESİ BEKLENMİYOR. Eski yapıdaki veri kaybını
  kanıtlıyor, teşhisin kaydı olarak duruyor.

**Tazelenen testler** (iddiaları eskimişti):
- `push.test.js` — `pushChanges` artık bulut koruma bayrağını okuyor.
- `ai-tarif.test.js` — yer tutucudaki örnek kelime sayısını sabitlemişti.
- `dokunmatik.test.js` — hafta görünümü saat ızgarasına dönüştü; gün
  hücreleriyle sürükleme ay görünümünde sınanıyor (saat ızgarasını
  `saat.test.js` sınıyor).

**Ders:** Bir test düşünce önce "kod mu bozuldu, test mi eskidi" sorusunu
sor. Bu turda düşen 16 testin **hiçbiri** üründe bir bozulma değildi:
koşum düzeni, taşınan dosya adı ya da eskimiş iddia.

---

## Nerede kaldık (3 Eylül 2026, gece — karşılama sayfası)

**DİKKAT — dosya adları değişti.** Uygulama artık `index.html` DEĞİL,
**`app.html`**. `index.html` karşılama (tanıtım) sayfası. CRLF satır sonu
kuralı bundan sonra **`app.html`** için geçerli; `index.html` (karşılama)
diğer sayfalar gibi LF.

Yapılanlar: `/` adresine karşılama sayfası kondu (bkz. "Karşılama sayfası
— YAPILDI"), giriş orada gerçekten çalışıyor, dil (varsayılan İngilizce)
ve tema düğmeleri eklendi, tüm metinlerin kontrastı ölçülüp düzeltildi.

Sırada bekleyenler: termin hatırlatmaları, script alanına metin
biçimlendirme, kendi alan adı.

---

## Nerede kaldık (3 Eylül 2026, akşam — tur ve fikir seçimi)

**Fikir → script akışı düzeltildi.** Fikirlerin yanındaki ✨ düğmesi
"bu fikri AI ile yaz" gibi okunuyordu; oysa doğru akış şu: kullanıcı
script'e girecek fikirleri SEÇİYOR, ne istediğini altta bir cümleyle
söylüyor. Artık her fikrin bir seçim kutusu var, "tümünü seç" bağlantısı
ve tarif kutusunun yanında "N fikir seçili — script bunların üzerine
kurulacak" notu. Seçilen fikirler prompt'a MALZEME olarak giriyor
("must be BUILT ON these ideas"); hiç seçilmezse eskisi gibi hepsi arka
plan bağlamı oluyor. Proje değişince ve yeni pencerede seçim sıfırlanıyor.

**Tur baştan yazıldı** — ayrıntısı "Bu nasıl çalışır turu — YAPILDI"
maddesinde.

---

## Nerede kaldık (3 Eylül 2026, gece — AI çalıştı)

**AI script yazma ÇALIŞIYOR.** Kullanıcı ilk scriptini üretti. Sonrasında
gelen istekler ve düzeltmeler:

- **Kelime sayacı.** Karakterin yanında kelime de yazıyor: video süresi
  kelimeyle hesaplanıyor ve AI'dan uzunluk istendiğinde tutup tutmadığı
  ancak böyle görünüyor. (400 kelime istenmiş, 346 gelmişti.)
- **Uzunluk ALT SINIR sayılıyor.** Tarifte kelime sayısı geçiyorsa modele
  "bunu hedef değil taban say, üstüne çık, erken bitirme" deniyor.
  Modeller kelime sayamıyor; bu yüzden hedef yerine taban vermek daha iyi
  sonuç veriyor.
- **Fikirden doğrudan script.** Script penceresindeki fikir şeridinde her
  fikrin yanında ✨ düğmesi var: tarif kutusunu o fikirle doldurup üretimi
  başlatıyor. Birleşik kartın bütün parçaları tarife giriyor. Tarif
  görünür kalıyor — kullanıcı düzenleyip tekrar çalıştırabiliyor.
- **Pencereden çıkmadan fikir ekleme.** Fikir şeridinin altında bir kutu
  ve "+ Ekle". Fikir seçili projeye bağlanıyor ve Fikirler sayfasında da
  anında görünüyor (aynı kayıt). Şerit artık proje seçiliyse fikir olmasa
  da görünüyor ve AÇIK açılıyor — kapalıyken ekleme kutusu görünmüyordu.

**CSS tuzağı ÜÇÜNCÜ kez:** `@media(min-width:701px){ .fold{margin-bottom:0} }`
tek sınıfla yazılan her boşluğu eziyor. Fikirler kutusu ile Drive şeridi
bu yüzden bitişik görünüyordu. `.fold.sc-ideas` (iki sınıf) gerekiyor.
Aynı tuzağa `.modal` / `.modal-lg` ve `.modal` / `.sc-modal` çiftlerinde
de düşülmüştü. **Kural: bu dosyada tek sınıflı bir kuralı ezmek isteyen
her yeni kural iki sınıfla yazılmalı.**

Alçak ekranda (≤780px) pencere yine kaymaya başlıyordu: yardımcı metin ve
boşluklar kısılıyor, yazma alanı korunuyor.

---

## Nerede kaldık (3 Eylül 2026, gece — AI modelleri)

Kullanıcının kendi teşhis çıktısı tabloyu tamamladı:

```
gemini-3.7-flash   15 sn'de yanıt yok
gemini-3.6-flash   yoğun / 15 sn'de yanıt yok
gemini-2.5-flash   "no longer available to new users"
```

Yani ağ ve anahtar sağlam, üç modelin üçü de ayrı sebeplerle çalışmıyordu.

- **Model listesi artık ANAHTARA açık olanlardan süzülüyor.** Üretimden
  önce `GET /v1beta/models` bir kez alınıyor (kullanıcıda 0.3 sn) ve
  adaylar ona göre eleniyor. Kapatılmış bir modele istek göndermek hem
  süre yiyor hem anlamsız hata gösteriyordu. Liste alınamazsa sabit
  listeyle devam ediliyor — teşhis uğruna üretim durmuyor.
- **Sabit adaylar güncellendi:** 3.7-flash → 3.6-flash → 3.5-flash →
  **3.5-flash-lite**. Sonuncusu küçük ve hızlı; yoğun saatlerde ayakta
  kalan genelde o oluyor.
- **Sabit adayların hiçbiri açık değilse** listeden bir flash modeli
  seçiliyor (`aiListedenAday`); görsel/ses/gömme modelleri eleniyor.
- **"Model kapalı" hatası artık denemeyi DURDURMUYOR.** `aiModelKapali()`
  404 ve "no longer available / not found" mesajlarını tanıyor ve
  sıradaki modele geçiyor. Kullanıcının gördüğü hata tam olarak buydu:
  2.5-flash kapalı diye bütün deneme orada bitiyordu.
- **Teşhis listesi tasarımı düzeltildi.** Model adı ile sonuç yan yanaydı;
  Google'ın uzun hata cümlesi sıkışmayınca model adını eziyor, ad harf
  harf alt alta düşüyordu. Satırlar artık alt alta.
- **AI ekranı:** anahtar kayıtlıyken rehber kapalı başlıyor (anahtar
  kutusu ve test sonucu kaydırmadan görünsün), ve ekran her açılışta
  önceki test sonuçlarını temizliyor.

**Ders:** sağlayıcının model kimlikleri kalıcı değil. Sabit bir liste tek
başına yetmiyor; adaylar çalışma anında anahtarın gördüğü listeye göre
süzülmeli ve "bu model yok" hatası bir sonraki adaya geçmeyi engellememeli.

---

## Nerede kaldık (3 Eylül 2026, akşam)

**Teşhis sonucu:** kullanıcının "Bağlantıyı test et" çıktısı → *0.3 sn,
50 model*. Yani ağ da anahtar da kusursuz; takılan tek şey
`generateContent`. Bunun üzerine:

- **Test artık model model deniyor.** Model listesi geldikten sonra her
  aday model tek kelimelik bir istekle deneniyor ve satır satır sonuç
  yazıyor: çalışıyor (n sn) / Google'ın hata cümlesi / "bu anahtara açık
  değil" (listede yoksa hiç denenmiyor) / "15 sn'de yanıt yok".
- **Çalışan model hatırlanıyor** (`aiCalisanModel`) ve yazma ONDAN
  başlıyor. Tıkalı bir modeli her seferinde baştan denemek dakikalar
  yiyordu.

**Script penceresinde AI tarifi ayrı alana taşındı** (kullanıcı isteği).
Tek kutu varken kullanıcı "1800 kelimelik bir script yaz" diye tarif
yazınca o metin scriptin kendisi gibi duruyordu — prompt mu script mi
belli olmuyordu. Artık:
- `#sc_aiBrief` — kesikli çerçeveli, script kutusundan görsel olarak ayrı.
- Tarif prompt'un EN BAŞINA giriyor; uzunluk/ton/hedef kitle söylenmişse
  "tam uygula" deniyor. Proje ve fikirler bağlam olarak altında.
- Tarif yoksa eski davranış (proje + fikir + başlık bağlamı) sürüyor.
- Enter doğrudan yazdırıyor. Yeni pencerede tarif sıfırlanıyor.

**Script penceresi yerleşimi.** Pencerenin kendisi kayıyordu; uzun bir
scriptte Kaydet'i bulmak için en alta inmek gerekiyordu. Artık pencere
ekrana sığıyor, kayan tek şey metin kutusu. İki CSS tuzağı:
- `.modal-lg` ile `.modal` aynı özgüllükte ve `.modal` daha sonra
  tanımlı — 600px'lik sınır genişliği eziyordu. `.modal.modal-lg`.
- `height:100%` şart; yalnızca `max-height` verilince pencere içeriğe
  göre kalıyor ve metin kutusu büyüyecek boş alan bulamıyor.
Genişlik 1040px. `sc-yerlesim.test.js` üç ekran boyunda ölçüyor.

---

## Nerede kaldık (3 Eylül 2026, öğleden sonra)

Kullanıcı: anahtar kayıtlı görünüyor, ✨ AI ile yaz istek gönderiyor ve
sayaç sayıyor — ama **90 saniyede iki modelden de cevap gelmiyor**.
Daha önce aynı anahtarla Google'ın kendi "high demand" hatası gelmişti,
yani ağ yolu AÇIK. Yapılanlar:

- **Üçüncü model, bir önceki nesilden:** `gemini-2.5-flash`. Yeni
  modeller serbest katmanda yoğunken çalışan bir seçenek kalsın diye.
  `AI_MODELLER` artık nesne listesi (`{ad, dusunme}`) — eski nesil
  `thinkingLevel`'i tanımıyor, gönderilirse isteği geri çevirir, o yüzden
  her model kendi ayarını taşıyor.
- **"Bağlantıyı test et" düğmesi** (AI ekranında). `GET /v1beta/models`
  çağırıyor: küçük ve hızlı bir istek. Dönerse ağ da anahtar da sağlam
  demektir ve geriye tek ihtimal kalır — modelin yoğunluğu. Sonuç kaç
  saniye sürdüğünü ve kaç model listelendiğini yazıyor. "Sorun bende mi
  Google'da mı" sorusunu tahminle değil ölçümle cevaplıyor.

**Sıradaki adım (cevap beklenen):** kullanıcı bu testi çalıştıracak.
- Test HIZLI dönerse → ağ ve anahtar sağlam, sorun model kapasitesi;
  `gemini-2.5-flash` yedeği devrede olduğu için yazma çalışmalı.
- Test de takılırsa → sorun bu cihazın Google'a çıkışında; o zaman ağ
  tarafına bakılacak (telefondaki Supabase sorunuyla ortak bir sebep
  olabilir).

---

## Nerede kaldık (3 Eylül 2026, öğle)

Kullanıcı: *"kayıt etti mi etmedi mi bilmiyorum? Scripti de yazmadı, hiçbir
ilerleme yok."* İkisi de gerçek kusurdu:

1. **Anahtar kayıtlı mı belli değildi.** `openAiSettings()` kutuyu
   boşaltıyordu, tek ipucu "Anahtarı sil" düğmesinin varlığıydı. Artık
   ekranın tepesinde durum kutusu var: yeşil ✅ "Bu cihazda bir anahtar
   kayıtlı …wxyz" (son 4 hane) ya da "Kayıtlı anahtar yok". Kaydetme ve
   silme sonrası hemen tazeleniyor.
2. **Üretim sırasında hiçbir ilerleme görünmüyordu.** Sadece düğme metni
   değişiyordu. Artık durum satırında **geçen saniye sayıyor** ("Yazıyor…
   12 sn") — script, başlık, kısa başlık, açıklama, hepsinde.
3. **Süre modeller arasında bölünüyor.** Önceki halde her modele ayrı
   süre düşüyordu: iki model × 90 sn = 3 dakikaya kadar sessizlik. Artık
   `toplamSure` bir bütçe; son modele kalanın tamamı veriliyor.
4. **Hiç istek gitmeden "model yoğun" deniyordu.** Bütçe 2 sn'nin altına
   düşerse döngü hiç dönmüyor, sonra da genel "yoğun" hatası fırlıyordu —
   Google'a hiç sorulmadan Google suçlanıyordu. İlk model artık HER ZAMAN
   deneniyor; hiç deneme yapılmadıysa "yoğun" değil zaman aşımı deniyor.
   (Kendi testim yakaladı.)

---

## Nerede kaldık (3 Eylül 2026, sabah)

**"Anahtar deneniyor…" ekranda çakılı kaldı.** `callGemini`'de zaman aşımı
yoktu: istek asılı kalırsa `fetch` hiç dönmüyor, düğme sonsuza kadar
kilitli kalıyor ve kullanıcı neyi beklediğini bilmiyordu.

- `AbortController` + zaman aşımı: üretimde 45 sn, anahtar denemesinde
  20 sn.
- Zaman aşımı ve "ağa hiç çıkılamadı" ayrı ayrı anlatılıyor; ikisi de
  içerik engelleyici / VPN ihtimalini söylüyor.
- Bu iki hata BİZİM cümlemiz, `err.yerel = true` ile işaretleniyor:
  "Google'ın söylediği: …" diye sunulmuyor, çünkü Google hiçbir şey
  söylemedi.
- Anahtar kaydedildikten sonra `runAiDraft()` **yalnızca kayıt penceresi
  açıksa** çalışıyor. Sol menüden girildiğinde kayıt penceresi kapalı:
  üretim görünmez bir alana yazıyor, durum mesajı da görünmüyordu. Onun
  yerine "Anahtar kaydedildi, ✨ AI düğmeleri hazır" bildirimi.

**Doğrulandı (2026-09-03):** `gemini-3.7-flash` geçerli ve güncel model
kimliği (13 Ağustos 2026'da çıktı). `AQ.` ön ekli yeni AI Studio
anahtarları native uç noktada `x-goog-api-key` başlığıyla ÇALIŞIYOR —
sorun çıkardıkları yer OpenAI-uyumlu uç nokta ve `Authorization: Bearer`.
Slate zaten doğru yolu kullanıyor.

**ASIL SEBEP: düşünme seviyesi.** Kullanıcı "VPN kullanmıyorum" deyince
zaman aşımının ağ kaynaklı olmadığı anlaşıldı. `gemini-3.7-flash`
varsayılan olarak **`thinkingLevel: MEDIUM`** ile çalışıyor; "Tek
kelimeyle cevap ver: test" gibi bir istek bile onlarca saniye sürebiliyor
ve 20 saniyelik anahtar denemesi zaman aşımına düşüyordu. Ağ değil, model
gecikmesi.

- İsteklerde artık `generationConfig.thinkingConfig.thinkingLevel = 'low'`
  gidiyor. Bu üründe üretilen şey açıklama, başlık ve script — derin akıl
  yürütme değil, hız gerekiyor. (`MINIMAL` bu modelde geçersiz, doğrulama
  hatası veriyor.)
- Anahtar denemesi ayrıca `maxOutputTokens: 32` ile sınırlı: cevabın
  içeriği önemli değil, 200 dönmesi anahtarın çalıştığını kanıtlıyor.
- Süreler yükseltildi: deneme 45 sn, üretim 60 sn, script 90 sn.
- Deneme sırasında **geçen saniye ekranda sayıyor** ("Anahtar deneniyor…
  12 sn") ve zaman aşımı mesajı kaç saniye beklendiğini yazıyor. "Donmuş
  mu, yavaş mı" belirsizliği kalktı.

**Ders:** yeni bir modele geçerken varsayılan gecikme davranışı da
kontrol edilecek. Model kimliğinin doğru olması yetmiyor.

**Sonra çıkan gerçek hata:** *"This model is currently experiencing high
demand."* Anahtar sağlammış, model yoğunmuş. Yapılan:

- **Yedek model.** `AI_MODELLER = ['gemini-3.7-flash','gemini-3.6-flash']`.
  İlki yoğunsa ikincisi deneniyor; ikisi de `thinkingLevel` destekliyor.
- **Geçici hata ayrımı.** 503 / "high demand" → *yoğun*; 429 /
  RESOURCE_EXHAUSTED → *kota*. İkisi de "anahtar bozuk" DEĞİL. Geçersiz
  anahtar (400/401) yedek modeli hiç denemiyor — boşuna istek yok.
- **Yoğunluk yüzünden çalışan bir anahtar reddedilmiyor.** Eskiden Google
  meşgul olduğu için anahtar kaydedilmiyordu ve kullanıcı hiçbir zaman
  ilerleyemezdi. Artık kaydediliyor ve durum dürüstçe söyleniyor:
  "Anahtar kaydedildi, model şu an yoğun, birkaç dakika sonra dene."

**İlke:** sağlayıcının geçici sorunu ile kullanıcının hatası birbirinden
ayrılmalı. Birincisi kullanıcıyı asla kilitlememeli.

**Sonra: düşük düşünme + 32 jetonla bile 45 sn'de yanıt gelmedi.** Yani
Google tarafı o sırada gerçekten sıkışıktı (aynı anahtar birkaç dakika
önce "high demand" almıştı). Yapılanlar:

- Zaman aşımı da geçici sayılıyor: bir model asılı kalırsa öteki
  deneniyor. (Ağ hatasında denenmiyor — adres ikisi için de aynı.)
- Anahtar denemesi süresi 25 sn'ye indi (düşük düşünme + 32 jeton ile
  saniyeler sürmeli).
- **"Denemeden kaydet"** düğmesi: hata GERÇEKTEN anahtarla ilgili
  değilse çıkıyor ve anahtarı canlı deneme olmadan kaydediyor.
  `aiAnahtarSuclu()` ayrımı yapıyor — Google açıkça "API key not valid"
  derse düğme çıkmıyor. Google'ın kötü bir günü kullanıcının çıkmazı
  olmamalı.

### Bekleyenler popup'ı (kullanıcı isteği, 3 Eylül 2026)
- Başlık artık yapışkan bir şerit (`.modal-head`) ve sağ üstünde **×**
  var: uzun listede kapatmak için en alta kadar kaydırmak gerekiyordu.
  `top:-26px` şart — `top:0` başlığı modalin iç boşluğu kadar aşağı
  kenetliyor.
- Kapatıldıktan sonra **kendiliğinden bir daha açılmıyor**. İşaret
  `sessionStorage`'da: sayfa yenilense de çıkmıyor, sekme kapanıp
  yeniden açıldığında (gerçekten yeniden başlatınca) tekrar çıkıyor.
  `localStorage` olsaydı bir daha hiç görünmez, listenin varlık sebebi
  ortadan kalkardı.
- Kapatma yollarının hepsi aynı kapıdan geçiyor: ×, Kapat, dışarı
  tıklama, Escape.
- `data-i18n-title` ve `data-i18n-aria` desteği eklendi: metni olmayan
  düğmeler anlamını bu özniteliklerde taşıyor.

---



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

Sıralama **deneme sürecine** göre. Kullanıcı kararı (3 Eylül 2026):
*"Bugün yani 0'ıncı günde ürünü satmayı planlamıyorum. Amaç ilk önce
kullanıcılara ürünü denettirmek, bu nedenle bir deneme süreci başlayacak."*
Pazar araştırması raporunun (2 Eylül 2026, bölüm 10) maddeleri bu listeye
katıldı; rapor "satılabilirlik" sırasına göre yazılmıştı, burada
"denenebilirlik" sırasına çevrildi. Raporun kendi öncelik etiketi her
maddenin sonunda parantez içinde duruyor.

### KAPI 1 — Deneyici gelmeden önce olması gerekenler

1. **Supabase'i ücretsiz katmandan çıkarmak** (rapor: Öncelik 1)
   Ücretsiz projede YEDEK YOK ve bir hafta hareketsizlikte proje duruyor.
   Denemeyi baltalayan madde bu: on gün sonra dönen deneyicinin verisi
   donmuş olur. Aylık 25 dolar, kurulumu bir saat. **Para almadan önce
   değil, deneyici gelmeden önce.**

2. **Testleri depoya almak** (rapor: Öncelik 1)
   Bugün 83 test var ve HİÇBİRİ depoda değil — hepsi oturumla silinen
   geçici bir klasörde. Bugün o testler iki gerçek kusur yakaladı (boş
   proje, ızgara taşması). Oturum kapanınca bu ağ yok oluyor. Yarım gün.
   Raporun gerekçesi: *"satılan üründe geri dönüşü olmayan hatalar (veri
   kaybı) iki kez yaşanmış."*

3. **Hesabı kendi kendine silme** (rapor: Öncelik 1)
   Bugün silme e-posta ile. Deneyici "verimi geri alamıyorum" hissine
   kapılmamalı; KVKK/GDPR için de gerekli. Yarım gün. Kodda yok
   (3 Eylül 2026'da doğrulandı).

4. **Kullanım şartları + veri işleme + iade politikası** (rapor: Öncelik 1)
   `privacy.html` var, şartlar yok. Deneme sürecinde bile "verim ne
   olacak" sorusunun yazılı cevabı olmalı. 1 gün.

5. **Mobilde takvimin katlanması** (rapor: Öncelik 1)
   İlk kayıt kaydırmadan görünmeli. Kodda `.cal-day.collapsed` ve telefon
   medya sorgusu VAR; gerçek telefonda doğrulanmalı. Yarım gün.

6. **Barındırmayı taşımak — Cloudflare Pages / Netlify** (rapor: Öncelik 1)
   GitHub Pages ticari SaaS'a izin vermiyor. Ücretsiz denemede henüz
   ticari satış yok, o yüzden 0. gün için ACİL DEĞİL; ama kendi alan adı
   ve HTTPS de aynı taşımayla geliyor, ikisini birlikte yapmak mantıklı.
   Yarım gün.

0. **Gelen kutusu çoklu kullanıcıya hazır değil — DENEME ENGELİ**
   (3 Eylül 2026, başka bir oturumun eklediği özellik)
   `gelenKutusunuIsle()` `if(!session) return;` ile korunuyor, yani
   ziyaretçiye gitmiyor. Ama **giriş yapan HERKESE** gidiyor: deneme
   kullanıcısı hesabını açtığında `gelen/kayitlar.json` içindeki
   Nuruosmaniye kayıtları onun takvimine yazılıyor. Deneyiciye başkasının
   içerik planını göndermek, denemenin ilk beş dakikasını bozar.

   **Önerilen çözüm — e-posta GÖMÜLMEYECEK.** Hesap sınırının çözüldüğü
   yolu izle: `user_prefs.prefs` içine `gelen_kutusu: true` bayrağı,
   yalnızca sahibin hesabında açık. Kod bayrağa bakar. Böylece kaynağa
   e-posta ya da kullanıcı kimliği gömülmez (1 Eylül'de konan kural).
   Alternatif ve daha temizi: kutuyu dosyadan veritabanına taşımak —
   hedef kullanıcı başına bir satır. Daha fazla iş.

### KAPI 2 — Denemeyi kazanan özellikler

7. **Termin hatırlatmaları — SIRADAKİ İŞ** (rapor: Öncelik 2)
   Ayrıntılı tasarım aşağıda kendi bölümünde. Raporun gerekçesi:
   *"ürünü 'arada bir açılan pano' olmaktan çıkarıp günlük alışkanlığa
   çeviren özellik bu."* Deneme sürecinde en çok işe yarayacak madde,
   çünkü kullanıcıyı geri getiriyor.

8. **Hazır proje şablonları** (rapor: Öncelik 2)
   "Belgesel bölümü", "haftalık vlog", "ürün lansmanı", "etkinlik çekimi"
   gibi yedi adımı ve paylaşım setini önceden dolduran şablonlar. Boş
   uygulama sorununu çözer — deneyicinin ilk beş dakikası bu.

9. **İçe aktarma — CSV / Google Sheets / Notion** (rapor: Öncelik 2)
   Deneyicinin çoğu bugün bir tabloda çalışıyor; elini boşaltmadan
   geçemezse denemez. Kodda hiç yok.

10. **Paylaşılabilir salt okunur takvim bağlantısı** (rapor: Öncelik 2)
    Kurgucuya/müşteriye plan göstermek. Ekip özelliklerinin en ucuz ilk
    adımı ve deneyiciyi başkasına gösterten şey. Kodda hiç yok.

11. **Service worker** (rapor: Öncelik 2)
    Çevrimdışı açılış + bildirim altyapısı. 7. maddenin tarayıcı
    bildirimi bacağı buna dayanıyor, o yüzden onunla birlikte gelecek.
    `sw.js` yok.

12. **Script alanına metin biçimlendirme** (kullanıcı isteği, 2 Eylül)
    Düğme çubuğu + Markdown + önizleme. Gerekçesi aşağıda kendi bölümünde.

### KAPI 3 — Para almaya geçerken

13. **Yeniden adlandırma + kendi alan adı** (rapor: Öncelik 1)
    "Slate" adı aynı kategoride kullanılıyor; marka ve arama görünürlüğü
    riski. 1-2 gün. **Not:** hafızada bu madde "TÜM İŞ BİTİNCE" diye
    duruyordu, rapor ise "para almadan önce zorunlu" diyor. Çelişki değil,
    farklı hedefe bakıyorlar — deneme için ad yeterli, satış için değil.

14. **Fiyat sayfası + bekleme listesi** (rapor: Öncelik 1)
    Karşılama sayfası yapıldı (3 Eylül), fiyat ve bekleme listesi yok.

15. **Ödeme — Paddle veya Lemon Squeezy** (rapor: Öncelik 1)
    Merchant of record; KDV ve fatura onlarda. Türkiye'den satıcı
    uygunluğu raporun 9. bölümünde. 2-3 gün.

16. **Ücretli pakette AI'yı ürünün karşılaması** (rapor: Öncelik 2)
    Bugün kullanıcı kendi Gemini anahtarını giriyor. Rapor bunu *"teknik
    olmayan üreticinin en büyük terk noktası"* diyor. Ücretli kullanıcı
    için Supabase Edge Function arkasında ürünün kendi anahtarı.
    **Deneme sürecinde ölçülecek:** kaç deneyici anahtar adımında
    düşüyor? Cevap buysa bu madde KAPI 2'ye taşınır.

### KAPI 4 — Talep kanıtlanınca

17. **YouTube Data API ile "yayınlandı mı" otomatik işaretleme**
    (rapor: Öncelik 3) Yalnızca okuma; yayın yapmadan platformu dinlemenin
    ucuz yolu. Hafızada hiç yoktu, rapordan geldi.
18. **Roller ve yetkilendirme** — şema hazır, kullanılmıyor (rapor: Öncelik 3)
19. **Google Places adres tamamlama** — sunucu tarafı anahtar gerekiyor
    (rapor: Öncelik 3)
20. **Üçüncü ve sonraki diller** (rapor: Öncelik 3) — ayrıntılı gerekçe
    "Ertelenenler" bölümünde; boyut engel değil, bakım maliyeti engel.

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

### "Bu nasıl çalışır" turu — YAPILDI (3 Eylül 2026)
Tur baştan yazıldı. On adım, her biri BİR ÖZELLİK: başlık + ne işe
yaradığını anlatan bir paragraf + üç madde.

1. Fikirden yayına giden yol (zincir ve sıranın zorunlu olmadığı)
2. Fikirler: kart duvarı, birleştirme, parça çıkarma
3. Scriptler: bağımsız kayıt, Drive'dan getir / Drive'a yaz
4. AI ile yaz: kendi Gemini anahtarı, fikir seçimi, tarif alanı
5. Projeler: yedi adım, özet şeridi, biten/iptal
6. Terminler: adım başına tarih, geciken kırmızı
7. Takvim: iki bağımsız etiket, görünümler, saat dilimi
8. Kayıt penceresi: alanlar, ✨ AI düğmeleri, çoğaltma
9. Şablonlar: kapanış metni ve platform istisnası
10. Bulut: her cihazda aynı plan, bekleyenler listesi

Yapısal değişiklikler:
- Metinler artık `TOUR_STEPS_I18N` içinde (başlık + gövde + maddeler bir
  arada); ayrı `tourN_body` anahtarları kaldırıldı.
- Pencere script penceresi gibi: `.modal.tour-modal` ekrana sığıyor,
  kayan tek şey ortadaki içerik, başlık ve düğmeler sabit. Genişlik
  1040px, çizim 560px'e kadar.
- **Gövde metni artık `--text`.** Önceki hâlde `--text-dim` idi ve koyu
  zeminde okunmuyordu. Maddeler sol kenarı vurgulu kartlar hâlinde.
- Sağ üstte kapatma × eklendi.
- **Çizimler ikinci kez, çok daha yüksek işçilikle yeniden çizildi**
  (kullanıcı: "cheesy ve cheap duruyor" — haklıydı). Sahne 460x180'den
  **900x340**'a çıktı, `.tour-visual svg` en fazla 720px.
  Üç katmanlı derinlik: zemin degradesi, kartlarda üst-alt degrade ve
  altlarında `feDropShadow`. Vurgulu kartın arkasında hafif bir hare var.
  Ortak yardımcı küme: `TV.sahne/kart/baslik/mono/yazi/satir/tik/bos/
  pil/kutu/isaretli/isaretsiz/yildiz`. Her sahnenin kendi `defs` kimliği
  (`zg1`, `kg1`, `dr1`, `mk1` …) — tek sahne render edildiği için
  çakışma yok ama numaralandırmak ileride kırılmayı önlüyor.
- **Seçenek kararı (3 Eylül):** kullanıcıya üç yol sunuldu — (A) ürünün
  gerçek ekran görüntüleri, (B) yeniden çizim, (C) yapay zekâ görselleri.
  **B seçildi.** C'nin reddedilme sebepleri kayıt için: üretilen
  görsellerde yazı bozuk çıkıyor, tema takip etmiyor, ürünü göstermiyor
  ve on görsel 3–5 MB tutuyor. Gemini ile örnek üretilemedi (anahtar
  kullanıcıda ve paylaşılması istenmedi).
- Yakalanan iki hata: zincir çizgisi kartların ARKASINDA kaldığı için
  görünmüyordu (aradaki boşluklara kartların üstüne kısa oklar kondu);
  `.tour-icerik` kısa adımlarda yukarı yapışıyordu
  (`justify-content:safe center` — "safe" olmadan uzun adımda üst
  kırpılıyor).
- `tur2.test.js` on adımı iki dilde ve üç ekran boyunda geziyor;
  kontrastı hesaplanan renkten ölçüyor.

### Termin hatırlatmaları — SIRADAKİ İŞ (karar tazelendi: 3 Eylül 2026)

**3 Eylül 2026 — kullanıcı iki şey netleştirdi:**

1. **İki kanal BİRBİRİNDEN BAĞIMSIZ açılıp kapanacak.** *"Kullanıcı hem
   tarayıcı hem de takvim bildirimlerini açıp kapatabilmeli."* Yani tek
   bir "hatırlatmalar açık" düğmesi değil; takvim ve tarayıcı ayrı ayrı.
2. **Takvim bağlantısı sonradan kaldırılabilecek.** *"Dilerse takvime
   ekleyebilir ya da ekledikten bir süre sonra kaldırabilir."* Bu, 1
   Eylül'de yazılan şartın aynısı ve iki mekanizma da gerekli (aşağıda).

**Açık karar kapandı:** hatırlatma zamanı da kullanıcıya bırakılıyor, üç
ayrı anahtar olarak: *bir gün önce*, *termin günü*, *geciktiğinde*.
Varsayılan: bir gün önce + geciktiğinde açık, termin günü kapalı.

**Uygulama sırası — neyin sunucu gerektirdiği önemli:**

| Parça | Sunucu gerekiyor mu | Kim yapar |
|---|---|---|
| Ayarlar arayüzü (kanal + zaman anahtarları), `user_prefs`'e yazma | Hayır | Claude |
| `.ics` DOSYASI indirme ("takvime ekle") | Hayır | Claude |
| Service worker + bildirim izni + uygulama açılırken bildirim | Hayır | Claude |
| Canlı takvim ABONELİĞİ (webcal adresi, kendiliğinden güncellenen) | **Evet** — Edge Function | Claude yazar, KULLANICI kurar |
| Uygulama kapalıyken zamanlanmış bildirim (push) | **Evet** — Edge Function + zamanlanmış görev + VAPID | Claude yazar, KULLANICI kurar |

**Dosya ile abonelik arasındaki fark, kullanıcının şartı açısından
kritik:** indirilen `.ics` dosyası Google Takvim'e ayrı ayrı olay olarak
girer, kaldırmak için kullanıcının o olayları TEK TEK silmesi gerekir.
Abonelik ise tek kalemde iptal edilir. Yani dosya bir başlangıç, asıl
istenen abonelik. İkisi birlikte sunulacak, arayüzde farkı yazacak.

**DÜZELTME (3 Eylül 2026): Edge Function GEREKMİYOR.** Supabase Storage
dosyayı doğru `Content-Type` ile herkese açık bir adresten sunuyor. Uygulama
`.ics` metnini üretip Storage'a yazıyor, adres sabit kalıyor, terminler
değişince dosya güncelleniyor (`saveProjects()` tek kapı). İptal = dosyayı
sil + jetonu yenile. Kurulum tek SQL betiği: `sql/19-takvim-abonelik.sql`.
Sunucu tarafı kod yok. Aşağıdaki eski gerekçe neden REST ve Pages'ın
yetmediğini anlatıyor, o kısım geçerli:

**Neden Edge Function şart:** Google Takvim aboneliği, `text/calendar`
döndüren ve başlık (header) istemeyen bir adres istiyor. Supabase'in
hazır REST arayüzü JSON döndürüyor ve `apikey` başlığı istiyor; GitHub
Pages ise statik. Üçüncü bir yol yok.

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

### Kendi alan adı (karar tazelendi: 3 Eylül 2026 — KAPI 3)
1 Eylül'de "tüm iş bitince" denmişti. Pazar araştırması bunu "para
almadan önce zorunlu" diyor. İkisi çelişmiyor: DENEME için mevcut adres
yeterli, SATIŞ için değil. Barındırma taşımasıyla (KAPI 1, madde 6)
birlikte yapılacak — aynı iş.
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

---

## Ertelenenler (sebebiyle)

### Çok dillilik (ertelendi: 3 Eylül 2026)
Bugün iki dil var (en, tr), 273 anahtar, ikisi de eksiksiz. Altyapı çok
dilli: `LANG_NAMES`'e bir kod eklenince menüye kendiliğinden düşüyor.
Lokasyon uygulamasında üçüncü dil (ru) zaten çalışıyor.

**Erteleme sebebi (3 Eylül 2026):** Kullanıcı boyut maliyetini sordu,
ölçüldü ve mesele boyut çıkmadı — dil başına ~32 KB ham / ~11 KB
indirilen; 4 dil daha eklense sayfa 144 KB'den ~188 KB'ye çıkar,
açılışta fark edilmez. Sınır ~8-10 dil: orada dilleri ayrı dosyalara
alıp yalnızca seçileni indirmek gerekir, o da tek dosyalık yapıyı bozar.
Asıl maliyet **bakım**: her yeni özellik altı dilde birden yazılır.
Kullanıcı bunun üzerine erteledi.

**Önceki karar (1 Eylül 2026):** Ürün hâlâ hızla değişiyor; şimdi çeviri
yapılırsa her yeni özellik altı dilde birden güncellenmek zorunda kalır. Diller özellikler
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

### Karşılama sayfası — YAPILDI (3 Eylül 2026)
Kullanıcı: *"giren kişi ne olduğunu anlamadan direkt olarak demo sayfasına
geliyor... profesyonel bir web sitesi gibi görünsün. Özellikleri tıkladıkça
detayları anlatan yere gitsin. Mutlaka sayfada login bölümü olsun."*

**Adresler değişti — EN ÖNEMLİ NOKTA:**
- `/` (yani `index.html`) artık **karşılama sayfası**.
- Uygulama **`app.html`** adresine taşındı (`git mv`, CRLF korundu).
- `manifest.json` → `start_url: ./app.html` (telefona eklenen kısayol
  uygulamayı açsın, tanıtım sayfasını değil).
- `privacy.html` içindeki "Slate'e dön" bağlantıları `app.html`'e döndü.

**Giriş nasıl çalışıyor (Supabase ayarına DOKUNULMADI):**
Karşılama sayfası uygulamayla aynı Supabase projesini ve aynı publishable
anahtarı kullanıyor. Google ve e-posta linki için dönüş adresi HER ZAMAN
karşılama sayfasının kendisi (`location.origin + location.pathname`).
Sebep: Supabase'de izin verilen dönüş adresi listesine yeni bir satır
eklemek gerekmesin — site kökü zaten izinliydi. Giriş tamamlanınca sayfa
oturumu görüp `app.html`'e geçiriyor.

İki yönlendirme kapısı var, çünkü tek başına ikisi de yetmiyor:
1. Adres çubuğunda `access_token` / `code` varsa (e-posta linki, başka
   cihazdan da gelinebilir),
2. `sessionStorage['slate_giris_donus']` bayrağı varsa (giriş bu sayfadan
   başlatılmıştı; bazı akışlarda adres çubuğu temiz dönüyor).

Oturumu açık olan biri `/` adresine normal yolla girerse **zorla
yönlendirilmiyor** — tanıtımı okuyabilsin diye giriş kutusunun yerinde
"Slate'e git" ve "Çıkış yap" görünüyor.

**Dil:** Varsayılan **İngilizce** (kullanıcı kararı). Sayfanın HTML'i
İngilizce yazıldı; JavaScript çalışmazsa da okunur bir sayfa kalıyor.
Türkçe sözlük `METIN.tr` içinde, `data-i18n` / `data-i18n-html` /
`data-i18n-attr` nitelikleriyle uygulanıyor. Dil seçimi uygulamayla AYNI
anahtarda (`demo_ui_language`), tema da aynı anahtarda (`demo_theme`) —
iki sayfa arasında seçim taşınıyor.

**Okunabilirlik (kullanıcı şikâyeti: "yazıların bazılarının renkleri arka
plan ile çok karışıyor"):** İki ölçüm testi yazıldı — biri HTML metinleri,
biri SVG `<text>` etiketleri için (SVG'de renk `color` değil `fill`'den
geliyor, ilk test onları kaçırıyordu). Bulunanlar:
- `--solgun` #5B6B7F → #4C5C70 (4.85:1 → 6.1:1).
- 11 piksellik mono etiketlerin ağırlığı 500/600'e çıkarıldı.
- Kart numaraları (`.dizin-no`) #8B9AAB idi — 2.9:1. Vurgu mavisine alındı.
- **Mini takvimdeki kayıtlar:** 9,5 piksellik beyaz yazı platform renginin
  ÜSTÜNDE duruyordu (TikTok'ta 4.4:1, koyu temada daha kötü). Renk artık
  zemin değil, solda 3 piksellik şerit; yazı normal metin renginde.
- Açık temada uyarı ve platform renkleri koyulaştırıldı (#C63A31 → #B03329
  gibi), tonlu zeminler .16 → .12 opaklığa indirildi.
Sonuç: dört durumda da (açık/koyu × EN/TR) eşiğin altında kalan metin yok.

**Kahraman panosu da canlı (kullanıcı isteği):** Kayıtlar panoya sırayla
düşüyor, biri kalkıp başka güne taşınıyor (hedef gün önce işaretleniyor),
ikisi yayınlandı tikini alıyor. 13 saniyelik döngü.

Bunu yaparken **eskiden beri duran bir yerleşim hatası** ortaya çıktı:
`.izgara`'nın sütunları düz `1fr` idi. Düz `1fr`, sütunun en küçük boyutunu
İÇERİĞE bağlıyor; uzun bir kayıt adı bütün ızgarayı genişletiyordu ve son
sütun panonun `overflow:hidden`'ı altında kesiliyordu — sayfa yatay
kaymadığı için testler bunu görmüyordu. Üç yerden düzeltildi:
`grid-template-columns:repeat(7,minmax(0,1fr))`, hücreye `min-width:0`,
kayıt kutusuna `min-width:0;overflow:hidden`. Kayıt adları da hücreye
sığacak şekilde kısaltıldı (platform rengi zaten nereye gideceğini
söylüyor). `izgara.test.js` bunu dört ekran boyutunda sınıyor.

**Ders:** Kontrastı gözle değil ölçerek doğrula, ve SVG metnini ayrı ölç —
`getComputedStyle(el).color` SVG `<text>` için gerçek rengi vermiyor.

**Testler:** `karsilama.test.js` (52 kontrol: varsayılan dil, dil değişimi
ve geri dönüş, ortak dil/tema anahtarı, tema ilk boyamada, dokuz özellik
bağlantısı, app.html bağlantıları, e-posta linki, Google, açık oturum,
girişten dönüşte yönlendirme, bulut yüklenemezse, üç ekran boyutunda yatay
taşma), `kontrast.test.js`, `kontrast-svg.test.js`.

**Sırada bu sayfa için:** kendi alan adı alınınca Supabase'deki Site URL
kontrol edilecek; şimdilik bir şey yapmak gerekmiyor.

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
