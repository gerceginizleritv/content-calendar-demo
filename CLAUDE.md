# Shootboard — Claude için çalışma kuralları

Bu dosya her oturumda okunur. Buradaki kurallar kullanıcının kendi
sözleriyle koyduğu kurallardır; sohbet hafızası taşınmadığı için
yazılı olmadıkları sürece unutuluyorlar.

---

## 1. HER İŞİ ADIM ADIM ANLAT

> *"bana yapacaklarımı her zaman adım adım anlatarak ver"*
> — kullanıcı, defalarca. 12 Ekim 2026'da kurala yazılması istendi.

Kullanıcı yazılımcı değil. Bir dosyayı nereye koyacağını, bir SQL'in
neresini kopyalayacağını, bir ekranda hangi düğmeye basacağını
**bilmiyor ve bilmek zorunda da değil.** "sql/58'i çalıştır" bir
talimat değildir.

**Her çıktıda, iş yaptıracak her yerde:**

- **Numaralı adımlar.** "Adım 1", "Adım 2". Sırayı bozacak bir şey
  varsa (önce şunu sil, sonra şunu aç) sebebini bir cümleyle söyle.
- **Nereye gideceği.** Hangi program, hangi menü, hangi düğme.
  "Supabase → SQL Editor", "sol menü → Yayın", "PowerShell'de".
- **Tam olarak yapıştıracağı metin.** Kod bloğu halinde, kesilmeden.
  Bir SQL dosyasının "bir kısmını" çalıştırmasını isteme — ya tamamını
  yapıştıracak şekilde ver, ya da çalıştırılacak parçayı ayrı bir blok
  olarak yaz.
- **Ne göreceği.** Beklenen çıktıyı yaz: "`UPDATE 66` demeli",
  "0 satır gelmeli", "üçü de OK demeli". Beklenenden farklıysa ne
  yapacağını da yaz: "**dur, bana yaz**".
- **Örnek çıktıyı KOD BLOĞUNA KOYMA** eğer komut değilse. Bir kez
  örnek çıktı kod bloğuna konuldu, kullanıcı onu komut sanıp
  çalıştırdı. Örnek çıktılar düz metin ya da tablo olarak verilsin.

**Çok satırlı yapıştırma kırılgandır.** PowerShell'e çok satırlı
here-string (`@'...'@`) yapıştırmak sessizce yarıda kalabiliyor —
12 Ekim 2026'da tam bu oldu, dosya hiç oluşmadı ve iki tur boşa gitti.
Mümkünse **tek satırlık** komut ver; olmuyorsa dosyayı depoya koyup
indirmesini sağla.

---

## 2. BİR ŞEY DÜZELTMEDEN ÖNCE ONAY AL

> *"bir şey düzelteceksen önce onay al"*

Özellikle **veriye** dokunan her şeyde. Değişikliği yapmadan önce:
ne değişecek, kaç kayıt, neden, geri alınabilir mi — söyle, onay bekle.

Veri değiştiren SQL **her zaman iki adım**: önce aynı `where` ile bir
`select` (kaç satır etkilenecek görünsün), onaylanınca `update`.

---

## 3. DEĞİŞTİRİLEMEZ KURALLAR

- ⛔ **Hiçbir kod `uploaded` sütununa yazmaz.** O kullanıcının kendi
  işareti; sistemin durumu `publish_state`. (Şartname Bölüm 1.)
- ⛔ **MCP sunucusunda silme aracı yok.** Kaydı yalnızca kullanıcı,
  uygulamanın içinden siler.
- ⛔ **MCP erişimi yalnızca `bostancioglum@gmail.com` hesabına.**
  Başka hiçbir kullanıcıya tanımlanmaz.
- ⛔ **Bu sohbete gerçek anahtar, token ya da şifre yazılmaz.**
- ⛔ **Geçmiş tarihli yayın yapılmaz.**
- ⛔ **YouTube'a onay gelene kadar hiçbir şey gitmez**
  (`YOUTUBE_DENETIM_GECTI` tanımlanana kadar kapı kapalı).

---

## 4. DOĞRULA, VARSAYMA

Kullanıcı bir SQL çalıştırdığını söylediğinde **veriden doğrula**
(`shootboard_list_entries`), "muhtemelen olmuştur" deme. Supabase bir
`UPDATE` için "Success. No rows returned" yazar — bu başarı mesajıdır,
sıfır satır demek değildir; kullanıcıya da bunu hatırlat.

Fiyat, ürün, menü adı gibi doğrulayamadığın şeyleri **uydurma**.
Bir kez powerline fiyatları uydurup yanlış çıktı. Bilmiyorsan
"buradan erişemiyorum, sen bak" de.

---

## 5. OTOMATİK YAYIN POLİTİKASI

Tek yer: `pc/story-yukle.py` → `OTOMATIK_YAYIN`.

| | |
|---|---|
| instagram/story | açık |
| facebook/story | açık |
| instagram/reels | açık |
| facebook/reels | kapalı (deney sürüyor, 12 Ekim 2026) |
| tiktok/reels | kapalı (`video.publish` onayı yok) |
| youtube/shorts | kapalı (denetim kapısı) |

Tabloda olmayan çift kapalı sayılır. Ayrıntı: `YAPILACAKLAR.md`.

**İki ayrı kapı var, ikisini birden kontrol et:**
1. Kaydın `auto_publish` sütunu
2. `story_kuyruk_al` içindeki kuyruk şartları (sql/56 / sql/58)

12 Ekim 2026'da bu atlandı: kaydın tiki açıldı ama kuyruktaki
`and not (e.platform = 'facebook' and e.type = 'reels')` satırı
görülmedi, yayın gitmeyecekti.

---

## 6. SQL DOSYALARI — YENİDEN KOŞTURMA TUZAKLARI

Numaralı dosyalar birikimli değil; bazıları eski işlevleri yeniden
yaratıyor ve **yeni bir dosyanın işini sessizce geri alıyor.**

- `sql/54` — yeniden koşturulursa sql/55 ve sql/56 geri alınır.
- `sql/56` — yeniden koşturulursa facebook+reels dışlaması geri gelir
  (= sql/58'in işini geri alır). Deneyi kapatmanın yolu da budur.
- `sql/57` — `story_yayin_turleri()`'ne `grant`. Kaldırılırsa uygulama
  kaydedemez (42501). 10 Ekim 2026'da canlıya uygulandı.

Her dosyanın başında hangi dosyanın neyi geri aldığı yazılı; yeni bir
dosya eklerken aynı uyarıyı yaz.
