# Fiyatlandırma, ödeme duvarı ve yönetim alanı

**Tasarım belgesi · 12 Kasım 2026 · KOD YOK**

Bu belge onaylanmadan koda geçilmiyor. Promptun kuralı: *"ÖNCE PLAN,
SONRA KOD."* Her güvenlik maddesi için **nasıl sağlanacak** ve
**nasıl doğrulanacak** yazılı.

Önceki adım: `tasarim/ozellik-denetimi.md` — hangi özellik var, hangi
yok, kanıtıyla.

---

## 0. Dürüst olmam gereken dört şey

### ⛔ "%100 güvenli, hack edilemez" yoktur

Böyle bir sistem yok. Hiçbir metne yazılmayacak. Yapılabilecek olan
katmanları kurmak ve her katmanın **hangi riske karşı** olduğunu
yazmaktır. Bölüm 6 tam olarak bunu yapıyor: her madde için saldırı,
önlem ve ölçüm.

### MARKA.md bugün yalan olacak

Satır 111: *"Ücretsiz. Şu an para alınmıyor, fiyat sayfası yok."*
Bu iş o cümleyi yanlış yapar. Güncellenecekler: `MARKA.md`,
`sartlar.html`, `privacy.html` ve İngilizceleri, `kilavuz.html` /
`guide.html`. **Metinler yazılmadan önce kullanıcıya gösterilecek**
(Aşama 3).

### Kişisel veri

"Kim girdi, ne kullandı" kaydı ve konuma göre para birimi seçmek
**kişisel veri işlemektir**. Gizlilik metnine yazılmadan yapılmaz.
⛔ **Hukuki metnin doğruluğunu garanti edemem; bir hukukçuya
gösterilmeli.**

### Vergi ve fatura

Fatura, KDV ve yurt dışı satış vergisi konusunda **kesin
konuşmuyorum**. KDV dahil mi gösterileceği (soru 7) benim
cevaplayabileceğim bir soru değil — **mali müşavire sorulmalı.**

---

## 1. Bu belgenin kapsamadığı şeyler

⛔ **Otomatik yayın satılmıyor.** Hiçbir planda, fiyatlandırma
sayfasında ya da ödeme duvarında otomatik paylaşım, hesap bağlama ya
da istatistik vaat edilmiyor. Bayrak arkasındaki otomatik yayın
paneli olduğu gibi kalıyor. (Promptun kuralı + kullanıcının
12 Kasım kararı: *"otomatik yayın hiç kimseye açık olmayacak."*)

⛔ **Çalışan yayın sistemine dokunulmuyor.** `story-yayin`, kuyruk ve
`pc/` betikleri hiç değişmiyor. Bu işin tamamı **ayrı tablolarda,
ayrı fonksiyonlarda**.

⛔ **`uploaded` sütununa yazan kod yok.**

---

## 2. Veri — yeni tablolar

Hepsi yeni; var olan hiçbir tablo değişmiyor. (Tek istisna:
`user_prefs`'e kota sütunları eklemek yerine **ayrı** bir tablo
kuruluyor — sebebi Bölüm 6, madde 7.)

### 2.1 `plans` — planlar

| Sütun | Ne |
|---|---|
| `key` | `starter` · `creator_pro` · `studio` · `founding` |
| `visible` | planı gizle/göster |
| `badge` | `recommended` ya da boş — "En Popüler" **değil**, sebebi aşağıda |
| `sort` | sıralama |

⚠ **"En Popüler" yazılmıyor.** Henüz ücretli kullanıcı yok; MARKA.md
doğrulanmamış iddiayı yasaklıyor. Yerine **"Önerilen"**. (Soru 12 —
kullanıcı farklı isterse değişir.)

### 2.2 `plan_prices` — fiyatlar

Her **plan × para birimi × dönem** için **ayrı satır**:

| Sütun | Ne |
|---|---|
| `plan_key` | |
| `currency` | `USD` · `TRY` |
| `period` | `monthly` · `yearly` · `once` |
| `amount_minor` | **kuruş/cent olarak tam sayı** — ondalık sayı kullanılmıyor |
| `active` | |

⛔ **TRY, USD'den kurla HESAPLANMAZ.** İki ayrı satır, iki ayrı kutu.
Promptun şartı.

⛔ **Para birimi `amount_minor` olarak tam sayı tutulur.** Ondalık
sayıyla para tutmak klasik bir hata: 0,1 + 0,2 ≠ 0,3. 9 USD → 900.

**Başlangıç değerleri** (kullanıcıdan, 11 Kasım 2026 — köşeli
parantezliler kesinleşmemiş, canlıya geçmeden teyit alınacak):

| Plan | USD aylık | USD yıllık (aylık) | TRY aylık | TRY yıllık (aylık) |
|---|---|---|---|---|
| Starter | 0 | 0 | 0 | 0 |
| Creator Pro | 9 | 7 (toplam 84) | 320 | 250 (toplam 3.000) |
| Studio | 29 | 24 (toplam 288) | 1.050 | 850 (toplam 10.200) |
| Kurucu Üye | 69 tek seferlik | — | 2.450 tek seferlik | — |

⚠ **İndirim yüzdesi sabit yazılmıyor; sayfa fiyatlardan hesaplıyor.**
Kullanıcının söylediği **%22 yalnızca Creator Pro'da tutuyor**:

| | | |
|---|---|---|
| Creator Pro USD | 9 → 7 | ≈ %22 |
| Creator Pro TRY | 320 → 250 | ≈ %22 |
| Studio USD | 29 → 24 | ≈ **%17** |
| Studio TRY | 1.050 → 850 | ≈ **%19** |

### 2.3 `plan_limits` — limitler

| Sütun | Ne | Başlangıç |
|---|---|---|
| `plan_key` | | |
| `limit_key` | `projects` · `sets` · `scripts` · `ideas` · `kit_items` · `team_users` | |
| `limit_value` | `null` = sınırsız | Starter: 2 proje, 1 set · Studio: 5 kullanıcı |

⛔ **Koda gömülü hiçbir limit kalmıyor.** Bugün gömülü olanlar
(`SET_MAX=20`, `SCRIPT_ADET=300`, `FIKIR_ADET=500`, `IHTIYAC_MAX=300`)
bu tablodan okunacak.

### 2.4 `price_history` — fiyat geçmişi

Her değişiklik: tarih, kim, eski değer, yeni değer. ⛔ **Eski fiyat
silinmez.**

### 2.5 `subscriptions` — abonelikler

| Sütun | Ne |
|---|---|
| `user_id` | |
| `plan_key` | |
| `status` | `active` · `past_due` · `canceled` · `lifetime` |
| `period` | |
| `current_period_end` | |
| `provider` · `provider_ref` | hangi sağlayıcı, oradaki kimlik |
| `price_snapshot` | ⛔ **alındığı andaki plan, fiyat ve para biriminin KOPYASI** |

⛔ **Fiyat kopyası şart.** Sonradan fiyat değişse de eski abonelik ve
faturalar değişmez. Promptun şartı.

### 2.6 `payments` — ödemeler

tarih · plan · tutar (`amount_minor`) · para birimi · **yurt içi /
yurt dışı** · durum (`paid`/`refunded`/`failed`) · sağlayıcı ·
sağlayıcıdaki işlem no · `idempotency_key`.

⚠ **Yurt içi/yurt dışı ayrımı sağlayıcının verdiği fatura
ülkesinden** gelecek — tarayıcı dilinden ya da IP'den değil. Ödeme
olmadan bu bilgi **yok**; kullanıcının 12 Kasım kararı da buydu.

### 2.7 `founding_seats` — Kurucu Üye kontenjanı

⛔ **Sayaç GERÇEK olmalı.** Promptun şartı: *"sunucuda sayılır, aynı
anda gelen iki alımda 201. satılmaz, dolunca kart kendiliğinden
kapanır."*

**Nasıl sağlanacak:** kontenjan tek satırda tutulur ve satış anında
`update ... where sold < quota` ile **atomik** artırılır; etkilenen
satır sayısı 0 ise satış reddedilir. Yarış durumu veritabanı
kilidiyle çözülür, uygulama katmanında sayılmaz.

**Nasıl doğrulanacak:** testte aynı anda 2 istek (`Promise.all`),
kontenjan 1 iken → biri başarılı, biri reddedilmiş olmalı.

### 2.8 `admin_audit` — denetim kaydı

Yönetimde yapılan **her iş**: kim, ne zaman, ne yaptı, eski ve yeni
değer. ⛔ **Silinemez** — `delete` ve `update` yetkisi hiç kimsede
yok (RLS + `revoke`).

### 2.9 `usage_counters` — kullanım sayıları

⛔ **Yalnızca SAYI.** Kullanıcıların kayıt içeriği (başlıklar,
açıklamalar, scriptler) yönetim alanında **gösterilmez** —
promptun şartı.

⚠ Ne tutulacağı ve ne kadar saklanacağı **soru 10** — cevaplanmadan
bu tablo kurulmaz.

---

## 3. Sunucu tarafı — Edge Function'lar

Üçü yeni, var olanlara dokunulmuyor.

| Fonksiyon | Ne yapar |
|---|---|
| `odeme-baslat` | Tutarı ve planı **sunucuda fiyat tablosundan** belirler, sağlayıcıda oturum açar, sağlayıcının kendi sayfasına yönlendirir |
| `odeme-bildirim` | Sağlayıcının webhook'u. **İmza doğrulanır**, aynı bildirim iki kez işlenmez |
| `yonetim` | Yönetim okuma/yazma. Her istekte "bu istek sahibinden mi" denetlenir |

⛔ **Kart bilgisi bize hiç değmez.** Ödeme sağlayıcının kendi
sayfasında alınır. Kart numarası ne bizim tarayıcı kodumuzdan ne
sunucumuzdan geçer.

⛔ **Servis anahtarı ve sağlayıcının gizli anahtarı yalnızca
sunucuda, gizli değişkende.** Depoya, `app.html`'e, bu sohbete
yazılmaz. Kullanıcıya nereye gireceği adım adım tarif edilecek.

---

## 4. Sayfalar

| Sayfa | Dosya | Kim görür |
|---|---|---|
| Fiyatlandırma | `fiyatlar.html` / `pricing.html` | herkes |
| Yönetim | `yonetim.html` | yalnızca sahip |

⛔ **Yönetim ayrı dosyada, `app.html`'in içinde değil.** Sebep:
`app.html` zaten 1,27 MB ve herkesin tarayıcısına iniyor; yönetim
kodunun orada durmasının bir sebebi yok. **Ama asıl koruma bu
değil** — asıl koruma Bölüm 6, madde 2.

**Yönetim ekranları** (promptun önerisi, belgede netleşti):
Özet · Hesaplar · Kullanım · Ödemeler · Fiyatlar · Faturalar ·
Denetim kaydı.

⛔ **Yönetim varsayılan SALT OKUNUR.** Veri değiştiren her işlem
(fiyat, iade, plan, hesap kapatma) ayrı onay ister.

---

## 5. Ödeme duvarı

| Kural | Nasıl |
|---|---|
| Sürtünmesiz başlangıç | Değişmiyor — hesapsız kullanım korunuyor |
| Sınırda duvar | 3. proje ya da 2. sette pencere açılır, Creator Pro teklif edilir |
| Senkron tetikleyici | "Buluta kaydet" → hesap açma + ödeme |
| Kapatılabilir | ⛔ Pencere **kapatılabilir**, veriyi rehin almaz, var olan projeler **erişilebilir** kalır |
| Yalancı aciliyet | ⛔ **Yok.** "Son 3 kişi" gibi bir şey yazılmaz |

### ⛔ Veri taşıma — bugün bir boşluk var

Özellik denetiminde ölçüldü: giriş anında her veri türü **farklı**
davranıyor.

| Veri | Bugün | Kanıt |
|---|---|---|
| Kayıtlar | ✅ onay sorularak taşınıyor | `app.html:23244` civarı |
| Projeler | ⚠ **sessizce** taşınıyor | `app.html:9452` |
| Mekanlar | ❌ **taşınmıyor** | `app.html:13194` |
| Fikirler | ❌ **taşınmıyor** | `app.html:13445` |
| Scriptler | ❌ **taşınmıyor** | `app.html:13446` |
| Kütüphane / setler | ❓ doğrulanmadı | — |

Promptun 4. kuralı *"HİÇBİR KAYIP OLMADAN"* diyor. **Para alınmadan
önce kapatılması gereken bir boşluk** — çünkü duvarın teklifi tam
olarak "hesap aç, verin gelsin".

**Nasıl doğrulanacak:** taşımadan önce ve sonra proje, kayıt, mekan,
set sayıları **eşit** olmalı; taşıma yarıda kalırsa tarayıcıdaki veri
**silinmemiş** olmalı. İkisi de ölçülecek.

---

## 6. Güvenlik — her madde: nasıl sağlanacak, nasıl doğrulanacak

Promptun 13 maddesi, birebir.

### 1 · Kart bilgisi bize hiç değmez

**Nasıl:** ödeme sağlayıcının kendi sayfasında/penceresinde alınır.
Bizim hiçbir formumuzda kart alanı yok.
**Doğrulama:** depoda kart alanı araması (`card`, `cvv`, `pan`) → 0
sonuç. Ağ kaydında bizim sunucumuza giden isteklerde kart alanı yok.

### 2 · Yetki sunucuda denetlenir

**Nasıl:** her yönetim verisi Edge Function üzerinden, istekteki
oturumun sahibe ait olduğu **sunucuda** doğrulandıktan sonra verilir.
Satır düzeyi güvenlik (RLS) ikinci katman.
⛔ **Yönetim HTML'inde gizli hiçbir şey yok** — sayfayı gizlemek
güvenlik değildir.
**Doğrulama:** başka bir hesapla ve hesapsız olarak aynı uca istek →
**boş/reddedilmiş** dönmeli. "Çalışıyor" değil, "başkası göremiyor"
ölçülür.

### 3 · Yönetici tek hesap

**Nasıl:** sahibin kullanıcı kimliği **sunucuda**, gizli değişkende
ya da yalnızca sunucunun okuyabildiği bir tabloda. ⛔ **Yönetici
listesi tarayıcıdan değişmez.**
**Doğrulama:** başka bir hesapla yönetim ucu → reddedilir.

### 4 · İki adımlı doğrulama

**Nasıl:** Supabase Auth'un MFA desteği. ⚠ Bunun bu projede nasıl
açılacağını **Supabase'in kendi belgesinden doğrulayacağım**;
ezbere adım yazmayacağım.
**Doğrulama:** MFA açıkken ikinci adım atlanırsa yönetim ucu
reddedilir.

### 5 · Anahtarlar yalnızca sunucuda

**Nasıl:** gizli değişken. ⛔ Depoya, `app.html`'e, bu sohbete
yazılmaz.
**Doğrulama:** depoda anahtar deseni araması → 0 sonuç.
`app.html`'de sağlayıcı gizli anahtarı → 0 sonuç.

### 6 · "Ödendi" yalnızca imzalı bildirimden

**Nasıl:** webhook imzası doğrulanır. Aynı bildirim iki kez gelirse
ikincisi işlenmez (`idempotency_key` üzerinde tekil dizin).
**Doğrulama:** imzasız/yanlış imzalı istek → reddedilir. Aynı
bildirim iki kez → ikinci kez **hiçbir şey değişmez**.

### 7 · Tutar ve plan sunucuda belirlenir

**Nasıl:** `odeme-baslat` fiyatı **fiyat tablosundan** okur.
Tarayıcıdan gelen fiyata ve para birimine **güvenilmez**.
**Doğrulama:** değiştirilmiş fiyatla istek → sunucu kendi fiyatını
kullanır.

⚠ **Bugünkü kota buna uymuyor.** `sql/07` kendi başında yazıyor:
*"Kullanıcı kendi satırını düzenleyebilir... Para işin içine
girdiğinde sınırın veritabanı tarafından DAYATILMASI gerekir."*
Bu yüzden kotalar `user_prefs`'e değil **ayrı bir tabloya** yazılıyor
ve o tabloya kullanıcının `update` yetkisi **hiç yok**.
**Doğrulama:** kullanıcı kendi plan satırını değiştirmeyi dener →
reddedilir.

### 8 · Her iş denetim kaydına

**Nasıl:** `admin_audit`, yalnızca `insert`. **Doğrulama:** silme ve
değiştirme denemesi → reddedilir.

### 9 · Yönetim varsayılan salt okunur

**Nasıl:** veri değiştiren her işlem ayrı onay penceresi.
Kaydetmeden önce özet: *"Creator Pro · TRY · aylık: 320 → 350.
Yalnızca yeni alımlar için. Onaylıyor musun?"*
**Doğrulama:** onaysız istek → reddedilir.

### 10 · Hız sınırı

**Nasıl:** giriş denemeleri ve yönetim uçları sayılır, eşik aşılınca
reddedilir. **Doğrulama:** eşik üstü istek → reddedilir.

### 11 · En az veri

**Nasıl:** `usage_counters`'da yalnızca sayı. Saklama süresi
**soru 10**'a bağlı; gizlilik metnine yazılacak.

### 12 · Yönetim sayfası arama motorlarına kapalı

**Nasıl:** `noindex` + `robots.txt`; ana uygulamadan bağlantı yok.
⚠ **Bu güvenlik değil, gürültü azaltma** — asıl koruma madde 2.

### 13 · Her tablo için kim okur, kim yazar

**Nasıl:** her yeni tablo için RLS politikası tek tek yazılır.
**Doğrulama:** her tablo **üç kimlikle** denenir — başka bir hesap,
hesapsız, yönetici. Ölçü *"çalışıyor"* değil, ⛔ ***"başkası
GÖREMİYOR / DEĞİŞTİREMİYOR"***.

| Tablo | Herkes okur | Sahibi okur | Yönetici okur | Kim yazar |
|---|---|---|---|---|
| `plans`, `plan_prices`, `plan_limits` | ✅ | ✅ | ✅ | yalnızca sunucu |
| `price_history` | ❌ | ❌ | ✅ | yalnızca sunucu |
| `subscriptions` | ❌ | kendi satırı | ✅ | yalnızca sunucu |
| `payments` | ❌ | kendi satırı | ✅ | yalnızca sunucu |
| `founding_seats` | kalan adet | — | ✅ | yalnızca sunucu |
| `admin_audit` | ❌ | ❌ | ✅ | yalnızca sunucu (`insert`) |
| `usage_counters` | ❌ | ❌ | ✅ | yalnızca sunucu |

---

## 7. SQL ve dağıtım

- Yeni dosyalar `sql/` altında **sıradaki numarayla**. Son dosya
  `sql/68`. ⚠ Aşama 5 (plan listesi) belgesi de `sql/69`'u işaret
  ediyor — **hangisi önce yapılırsa o alır**, ötekinin belgesi
  güncellenir.
- Her dosyanın başına **hangi dosyanın neyi geri aldığı** yazılır
  (CLAUDE.md Bölüm 6).
- Veri değiştiren SQL **her zaman iki adım**: önce aynı `where` ile
  `select`, onaylanınca `update` (CLAUDE.md Bölüm 2).
- ⛔ **SQL'i ve Edge Function'ı ben çalıştırmıyorum/dağıtmıyorum.**
  Kullanıcıya adım adım tarif edilir; çalıştırdığını söyleyince
  **veriden doğrulanır**.
- ⛔ Önce sağlayıcının **TEST/sandbox** modunda kurulur, uçtan uca
  denenir. Canlı mod **ayrı bir adım, ayrı bir onay**.

---

## 8. Aşama sırası

Promptun sırası, her biri ayrı onay:

| | Aşama | Durum |
|---|---|---|
| 1 | Özellik kontrol tablosu | ✅ **bitti** — `tasarim/ozellik-denetimi.md` |
| 2 | Tasarım belgesi + güvenlik karşılıkları | ✅ **bu belge** |
| 3 | Metinler: MARKA.md, şartlar, gizlilik | önce gösterilecek |
| 4 | Tablolar ve yetki kuralları (SQL) + "başkası göremiyor" testi | |
| 5 | Yönetim alanı, salt okunur: hesaplar | |
| 6 | Fiyat tablosu + yönetimde "Fiyatlar" ekranı | |
| 7 | Ödeme, TEST modunda, uçtan uca | ⛔ **sağlayıcı seçilmeden olmaz** |
| 8 | Fiyatlandırma sayfası | ⛔ **soru 1 cevaplanmadan olmaz** |
| 9 | Ödeme duvarı + veri taşıma (kayıp yok ölçümü) | |
| 10 | Kullanım kaydı | ⛔ **soru 10 cevaplanmadan olmaz** |
| 11 | Fatura programı bağlantısı | ⛔ **soru 9 cevaplanmadan olmaz** |
| 12 | Canlıya geçiş | ayrı onay, ayrı kontrol listesi |

### Cevap beklemeden yapılabilecekler

**4, 5, 6** — tablolar, yetki kuralları, yönetimin salt okunur hâli
ve fiyat ekranı. Fiyatlar başlangıç değeri olarak girilir, sonra
yönetimden değiştirilir. Sağlayıcı seçimi bu üçünü **etkilemiyor**,
çünkü `payments` tablosu sağlayıcıdan bağımsız (`provider`,
`provider_ref` alanları).

**9'un yarısı** — veri taşıma boşluğunun kapatılması. Bu zaten
bugünkü bir eksik; ödemeden bağımsız yapılabilir ve yapılmalı.

### ⛔ Gerçekten tıkalı olanlar

| Ne | Neden | Hangi soru |
|---|---|---|
| Ödeme kodu | Sağlayıcı seçilmedi; kodun şekli ona bağlı | 8 |
| Fiyatlandırma sayfasının içeriği | Studio'nun beşte dördü yok — ne yazılacağı kararın | 1 |
| Kullanım kaydı | Ne tutulacağı ve ne kadar saklanacağı | 10 |
| Fatura bağlantısı | Hangi program | 9 |
| KDV gösterimi | Mali müşavir sorusu | 7 |

---

## 9. Cevap bekleyen sorular

Promptun 14 sorusu. Kullanıcı *"şimdiden yap"* dedi; **cevap
gerektirmeyenler yapılıyor**, aşağıdakiler cevaplanmadan
yapılamıyor — uydurmak gerekirdi.

| # | Soru | Neyi tıkıyor |
|---|---|---|
| 1 | YOK çıkan özellikler: önce yapılsın mı, plan o madde olmadan mı çıksın, Studio sonraya mı kalsın | Aşama 8 |
| 2 | Bugün ücretsiz bulut kullanan hesaplar ne olacak | Aşama 9 |
| 3 | "100 kayıt" sınırı kalkıp yerine "2 proje / 1 set" mi geliyor? Salt-okunur bağlantı yalnızca Studio'ya mı taşınıyor | Aşama 6, 9 |
| 4 | TRY fiyatını kim alabilir | Aşama 8 |
| 5 | Fiyat değişince mevcut aboneler eski fiyatta mı kalsın | Aşama 6 (varsayılan: kalır) |
| 6 | Kurucu Üye: 200 dolunca ne görünsün, iade kuralı, "ömür boyu" neyi kapsıyor | Aşama 7 |
| 7 | Fiyatlar KDV dahil mi | ⛔ mali müşavir |
| 8 | Ödeme sağlayıcısı (yurt içi + yurt dışı). Şirket durumu başvuruyu etkiliyor | Aşama 7 |
| 9 | Fatura/muhasebe programı | Aşama 11 |
| 10 | Kullanım kaydında ne tutulsun, ne kadar saklansın | Aşama 10 |
| 11 | Ekranlar önce çizilsin mi, bugünkü görünüş kurallarıyla mı tasarlansın | Aşama 5, 8 |
| 12 | Plan etiketi: "En Popüler" mi "Önerilen" mi | Aşama 8 (öneri: Önerilen) |
| 13 | **Hazır setler çelişkisi** | aşağıda |
| 14 | 12 Kasım'da gelen yeni özellikler hangi planda | Aşama 6, 8 |

### ⚠ Soru 13 — hazır setler çelişkisi gerçek

Ücretsiz planda **"en fazla 1 set"** sınırı var. Ama 12 Kasım'da
uygulamaya **sekiz hazır set** eklendi (`b7f3dc9`, canlıda).

Hazır setler sınıra sayılırsa ücretsiz kullanıcı **ilk dakikada**
duvara çarpar.

**Önerim:** hazır setler **sayılmaz**; yalnızca kullanıcının **kendi
kaydettiği** setler sayılır. Zaten öyle kurulmuş: hazır setler
`ihtiyacSetleri`'ne yazılmıyor, 20'lik kotadan yemiyor —
`hazir-setler.test.js` bunu ölçüyor ("kullanıcının kendi setleri
DEĞİŞMİYOR"). Yani teknik olarak ayrım **zaten var**.

Karar yine de kullanıcının.
