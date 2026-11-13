# Ana sayfa için fotoğraf listesi

**13 Kasım 2026.** Kullanıcı kararı: *"Stok fotoğraf alacağım"* + *"Baştan tasarla"*.

Yeni ana sayfa `index-yeni.html` olarak hazır. İçinde **üç fotoğraf yuvası**
var. Yuvalar şu anda ne istendiğini kendi üstünde yazıyor — boş gri kutu
bırakmadım, çünkü o neyin eksik olduğunu kimseye söylemezdi.

⛔ **ÖNEMLİ — bu fotoğraflar müşteri ya da kullanıcı DEĞİLDİR.**
Hiçbirinin altına isim, alıntı ya da "kullanıcımız" yazılmayacak. Henüz
ücretli kullanıcımız yok; olmayan müşteriyi varmış gibi göstermek olur.
Bunlar işin ne olduğunu anlatan görseller, referans değil.

---

## Nereden alacaksın

**Bedava ve lisans sorunu olmayan iki yer:**

| Site | Adres | Not |
|---|---|---|
| Unsplash | `unsplash.com` | Hesap gerekmez, indir-kullan |
| Pexels | `pexels.com` | Hesap gerekmez, indir-kullan |

İkisi de ticari kullanıma izin veriyor ve kaynak göstermek zorunlu değil.
Ücretli bir siteden (Getty, Adobe Stock) alacaksan lisans **senin adına**
olmalı — ben senin yerine telifli görsel indirip depoya koyamam.

---

## Adım adım ne yapacaksın

**Adım 1.** `unsplash.com` adresine git.

**Adım 2.** Aşağıdaki tabloda yazan **arama kelimesini** arama kutusuna
yaz. Kelimeler İngilizce, çünkü bu siteler Türkçe aramada az sonuç
veriyor.

**Adım 3.** Beğendiğin fotoğrafı aç, sağ üstteki **Download** düğmesine
bas. Açılan listede **en büyük boyutu** seç (tabloda yazan asgari
genişlikten küçük olmasın).

**Adım 4.** İnen dosyanın adını tabloda yazan ada çevir. Üçünün adı
**tam olarak** şöyle olmalı:

- `saha.jpg`
- `altin-saat.jpg`
- `masa.jpg`

**Adım 5.** Üç dosyayı bana yolla (sohbete sürükleyip bırak). Ben
`gorseller/` klasörüne koyup yayınlayacağım.

**Ne göreceksin:** Dosyalar yerine konduğunda yuvadaki yazı kendiliğinden
kalkıyor ve fotoğraf oraya oturuyor. Sayfanın HTML'ine dokunmak
gerekmiyor — bu iş zaten koda yazılı.

---

## Üç fotoğraf

### 1 · `saha.jpg` — Sahada çekim

| | |
|---|---|
| **Nerede durur** | "Tek çekim, on paylaşım" bölümünün hemen altında, sayfayı baştan sona kesen geniş bant |
| **Oran** | Yatay, çok geniş (21:9) |
| **Asgari genişlik** | 2400 piksel |
| **Arama kelimesi** | `filmmaker outdoors`, `camera tripod field`, `videographer shooting outside` |

**Ne göstermeli:** Dışarıda çekim yapan biri. Kamera, tripod, gün ışığı.

**Yüz görünmek zorunda değil** — eller, omuz, kameranın arkası yeter.
Hatta yüzsüz olanı tercih et: sayfadaki kişi "bizim müşterimiz" gibi
durmasın.

⚠ Bandın alt kısmına beyaz bir başlık biniyor ("Çekim sahada olur. Plan
cebinde durur."). O yüzden **alt-sol köşesi sakin** olan bir fotoğraf
seç — orada yüz ya da yoğun detay olmasın, yazı okunmaz.

---

### 2 · `altin-saat.jpg` — Altın saat

| | |
|---|---|
| **Nerede durur** | Amber (turuncu-sarı) bölümde, sağ tarafta kart içinde |
| **Oran** | Yatay 4:3 |
| **Asgari genişlik** | 1600 piksel |
| **Arama kelimesi** | `golden hour filming`, `sunset camera silhouette`, `golden hour videographer` |

**Ne göstermeli:** Gün batımına yakın saatte dışarıda çekim. Sıcak
turuncu ışık. Silüet olabilir.

⚠ Bu fotoğraf **amber zeminin üstünde** duruyor. Fotoğrafın kendisi de
turuncuysa iyi olur — bölümle aynı dünyadan görünür. Mavi ya da soğuk
tonlu bir fotoğraf o blokta yabancı durur.

---

### 3 · `masa.jpg` — Masa başında planlama

| | |
|---|---|
| **Nerede durur** | Telefon bölümünden sonra, sayfayı kesen geniş bant |
| **Oran** | Yatay, çok geniş (21:9) |
| **Asgari genişlik** | 2400 piksel |
| **Arama kelimesi** | `creative desk notebook laptop`, `content planning desk`, `editing desk coffee` |

**Ne göstermeli:** Çalışan bir masa. Dizüstü ya da tablet, not defteri,
kahve, eller.

⛔ **Steril kurumsal ofis fotoğrafı ALMA.** `MARKA.md` açıkça
*"kurumsal SaaS değil"* diyor. Takım toplantısı, beyaz tahta, takım
elbise, cam duvarlı toplantı odası — hiçbiri bu marka değil. Dağınık
ama çalışan bir masa doğru olan.

⚠ Bunun da **alt-sol köşesine** beyaz başlık biniyor ("Hafta başında on
dakika."). Orası sakin olsun.

---

## Seçerken dikkat edilecek üç şey

1. **Işık yönü.** Üçü de aynı sayfada arka arkaya görünüyor. Hepsi sıcak
   ışıklı olursa sayfa bütün durur; biri stüdyo beyazı, biri gün batımı,
   biri mavi olursa dağınık görünür. **Sıcak tonu tercih et.**

2. **Telefon/bilgisayar ekranı görünen fotoğraflardan kaçın.** Ekranda
   başka bir uygulama görünüyorsa, bizim ürünümüz sanılır. Uygulamanın
   gerçek ekran görüntüleri zaten sayfada var.

3. **Çok "stok" duran fotoğrafları eleme.** Kameraya gülümseyen,
   poz veren, parmakla bir şey gösteren kadrajlar — senin şikâyetin olan
   "yapay görünüyor" hissini stok fotoğraf da üretebiliyor. İş yapan
   eller, hareket hâlinde bir an, kadrajın kenarından giren bir kol
   daha gerçek duruyor.

---

## Sonradan konuşulacak (bugün yapılmadı)

- **Kendi çekim fotoğrafların.** Sen zaten video üreticisisin; sette ve
  sahada kendi fotoğrafların var. Stok fotoğraftan **her zaman** daha
  iyi durur ve rakip kopyalayamaz. Stokla başlayıp sonra kendi
  fotoğraflarınla değiştirmek en iyi yol olur.
- **Fotoğraf boyutu.** 2400 piksellik JPEG'ler 500 KB'ı aşabiliyor.
  Dosyalar geldiğinde `webp`'e çevirip küçülteceğim; sayfanın telefonda
  hızlı açılması için gerekli. Bu benim işim, sen ham dosyayı yolla.
