# yonetim — yönetim alanının veri ucu

`yonetim.html` sayfasının verisini verir ve fiyat / vergi
değişikliklerini yazar. Sayfa veritabanına **doğrudan hiç dokunmuyor**.

⛔ **Neden böyle.** Promptun 2. güvenlik maddesi: *"Yönetim sayfasını
gizlemek güvenlik DEĞİLDİR."* Sayfayı gizlemek yalnızca gürültüyü
azaltır. Asıl koruma şu: her istek burada, **sunucuda**, "bu istek
sahibinden mi geliyor" diye denetlenir. Yönetim HTML'inde gizli hiçbir
şey yok — sayfanın tamamı okunsa bile içinde veri yok.

⛔ **Salt okunur varsayılan.** Veri değiştiren her işlem gövdede
`onay: true` ister. Onaysız gelen istek reddedilir.

⛔ **Kullanıcı içeriği gösterilmiyor.** Kayıt başlıkları, açıklamalar,
scriptler okunmuyor — yalnızca sayılıyor.

## Uçlar

| `islem` | Ne | Yazar mı |
|---|---|---|
| `ozet` | abonelik ve ödeme sayıları, kontenjan | hayır |
| `hesaplar` | e-posta, kayıt, son giriş, plan | hayır |
| `odemeler` | son 500 ödeme | hayır |
| `fiyatlar` | planlar, fiyatlar, limitler, vergi | hayır |
| `denetim` | son 200 denetim kaydı | hayır |
| `matris` | planlar, özellik matrisi, sayı sınırları | hayır |
| `fiyat-degistir` | fiyat yazar | ⛔ `onay: true` |
| `vergi-kaydet` | vergi oranı yazar | ⛔ `onay: true` |
| `ozellik-degistir` | bir planın bir özelliğini açar/kapatır | ⛔ `onay: true` |
| `limit-degistir` | bir planın bir sayı sınırını yazar | ⛔ `onay: true` |

### Matris uçları (YAPILACAKLAR 67)

⛔ **Geçerli özellik adlarının listesi burada YAZILI DEĞİL.**
`ozellik-degistir` "satır varsa değiştir, yoksa reddet" diyor
(`satir_yok`). Böylece liste tek yerde kalıyor: `sql/76`'daki check
kısıtı ve tohum satırları. Yeni bir özellik **SQL ile** açılıyor,
panelden değil — kod ile matris aynı anda değişsin diye.

⛔ **Sütunlar sunucuda seçilmiyor.** `matris` bütün planları
döndürüyor; hangisinin sütun olacağına **sayfa** karar veriyor
(`visible === true`). Kullanıcının kararı "yalnızca satıştaki
planlar" ve o karar `plans.visible` sütununda zaten yazıyor; burada
bir daha yazmak iki kopya demek olurdu.

⛔ **`null` = SINIRSIZ, `0` = HİÇ.** `limit-degistir` alanın ya tam
sayı ya da **açıkça `null`** olmasını şart koşuyor; boş metin,
`undefined` ve `NaN` reddediliyor (`gecersiz_deger`). Panelde boş
bırakılan bir kutu sessizce `0`'a dönüşmesin diye — `sql/69` bu
ikisinin karıştırılmasının ücretli kullanıcıyı hiçbir şey yapamaz
hâle getirdiğini yazıyor.

⚠ `enabled` yalnızca `true` ya da `false` kabul ediyor. `"0"`, `""`,
`undefined` JavaScript'te sessizce `false`'a dönüşür; burada
reddediliyorlar ki paneldeki bir hata **görünür** olsun.

⚠ Değer zaten aynıysa yazma yapılmıyor ve denetim kaydı da
düşmüyor; cevap `{ ok: true, degisiklik: false }`.

### Sunucu denetimleri (`fiyat-degistir`)

Promptun şartı. Tarayıcıdan gelen değere güvenilmiyor:

- eksi fiyat → reddedilir
- ücretli planda sıfır → reddedilir
- yıllık toplam, 12 × aylıktan pahalı → reddedilir
- **beş kattan büyük ya da beşte birden küçük değişim** → `409` döner
  ve `buyuk_degisim_onay: true` ile **ikinci onay** ister
  (yanlışlıkla bir sıfır fazla yazmaya karşı)

## Kurulum

### 1. Tablolar

Supabase panel → **SQL Editor** → **New query** →
`sql/69-fiyat-ve-yonetim.sql` dosyasının **tamamını** yapıştır → **Run**.

### 2. Fonksiyon

**Panelden:** **Edge Functions** → **Deploy a new function** →
**Via Editor**. Ad kutusuna birebir `yonetim` yaz. Editördeki örnek
kodu sil, bu klasördeki `index.ts`'nin tamamını yapıştır, **Deploy**.

⚠ **Verify JWT AÇIK olmalı.** (`olcum-dene`'nin tersi.) Orada çağıran
`pg_cron`'du; burada çağıran kullanıcının kendisi ve kimliği oturum
jetonundan okunuyor.

### 3. Gizli ayar

**Gerekmiyor.** `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` Supabase
tarafından kendiliğinden tanımlı.

⛔ Servis anahtarı **yalnızca burada**. Depoya, `app.html`'e, hiçbir
sohbete yazılmaz.

## Doğrulama — "çalışıyor" değil, "başkası göremiyor"

Promptun 13. maddesi: her tablo **üç kimlikle** denenecek.

| Kim | Beklenen |
|---|---|
| Sahip (giriş yapmış) | veri **gelir** |
| Başka bir hesap | `403 yetkisiz` |
| Hesapsız / jetonsuz | `403 yetkisiz` |

⛔ Üçünde de aynı cevap veriliyor: *"burada bir yönetim ucu var ama sen
giremezsin"* bilgisi bile verilmiyor.

### Onay kapısı

Onaysız değiştirme isteği → `400 onay_gerekli`. Denenecek.

## ⚠ Açık iş: hız sınırı kararlı değil

Promptun 10. maddesi hız sınırı istiyor. Buradaki sınır **örnek
başına** çalışıyor: Edge Function birden çok örnekte koşabilir ve her
örneğin kendi sayacı olur.

Yani bu **kötüye kullanımı yavaşlatan bir engel**, kararlı bir üst
sınır **değil**. "Yaptım" demiyoruz.

Kararlı sınır için veritabanı tarafında bir sayaç tablosu gerekiyor;
ayrı bir SQL dosyasıyla eklenecek. O yapılana kadar bu madde
**tamamlanmış sayılmaz**.

## ⚠ Açık iş: iki adımlı doğrulama

Promptun 4. maddesi yöneticiye iki adımlı doğrulama (MFA) zorunlu
kılıyor. Bu fonksiyon oturumun geçerli olduğunu doğruluyor ama
**MFA'nın açık olup olmadığını denetlemiyor**.

Supabase Auth'un MFA'sı projede açıldıktan sonra burada jetonun
`aal2` seviyesinde olduğu da denetlenecek. O yapılana kadar bu madde
**tamamlanmış sayılmaz**.

## ⚠ Kişisel veri

`hesaplar` ucu e-posta ve son giriş zamanı döndürüyor. Bu **kişisel
veri işlemektir** ve canlıya çıkmadan önce `privacy.html` /
`privacy` (EN) metinlerine yazılmalı. Tasarım belgesi, Bölüm 0.
