# Ana sayfadaki fotoğrafların künyesi

**13 Kasım 2026.** Fotoğraflar Unsplash ve Pexels API'leri üzerinden
arandı, seçildi ve indirildi. Her iki lisans da ticari kullanıma izin
veriyor ve kaynak göstermeyi **zorunlu tutmuyor** — künye yine de
tutuluyor.

⛔ **Bu kişiler müşterimiz ya da kullanıcımız DEĞİLDİR.** Sayfada
hiçbirinin altında isim, alıntı ya da "kullanıcımız" yazmıyor ve
yazılmayacak. Ücretli kullanıcımız yok; olmayanı varmış gibi
göstermek olurdu.

---

## ⛔ İLK SEÇİM YANLIŞTI — hedef kitle hatası

İlk arama `filmmaker`, `videographer`, `cinema camera` terimleriyle
yapıldı ve omuz rigi taşıyan **profesyonel sinemacılar** geldi.
Kullanıcı düzeltti (13 Kasım 2026, kendi sözleriyle):

> *"Bizim hedefimizdekiler profesyonel çekim yapan kameramanlar
> değil. Video içerik üreticileri. Cep telefonu, aksiyon kamera vs
> gibi portable ürünler ile içerik üreten kişiler."*

`MARKA.md` zaten bunu söylüyordu: *"Tek başına çalışan içerik
üreticisi. Çekimi de kurguyu da paylaşımı da kendisi yapan kişi."*
"Video" kelimesi beni profesyonel sete götürdü; marka belgesini
yeniden okumadan arama yaptım.

**Bundan sonra aranacak terimler:** `smartphone gimbal`,
`content creator filming with phone`, `vlogger smartphone tripod`,
`action camera`, `phone tripod sunset`.

⛔ **Aranmayacak:** `filmmaker`, `cinematographer`, `film crew`,
`professional video camera`, `shoulder rig`.

---

| Dosya | Kaynak | Fotoğrafçı | Ne gösteriyor |
|---|---|---|---|
| `saha.webp` | pexels | Amar  Preciado | Young woman using a smartphone on a stabilizer for video r |
| `altin-saat.webp` | pexels | Matheus Bertelli | A smartphone is mounted on a tripod capturing the vast gol |
| `masa.webp` | pexels | Mizuno K | Woman adjusting smartphone on tripod with laptop setup for |

**Kaynak sayfalar**

- `saha.webp` — https://www.pexels.com/photo/a-woman-using-smartphone-13698292/
- `altin-saat.webp` — https://www.pexels.com/photo/smartphone-on-tripod-with-field-behind-19923053/
- `masa.webp` — https://www.pexels.com/photo/woman-using-smart-phone-on-tripod-and-a-laptop-computer-13929362/

## Kırpma ve boyut

Üçü de merkezden kör kırpılmadı: CDN'in `crop=entropy` seçeneğiyle en
bilgi yoğun bölge seçildi, sonra `webp`'e çevrildi.

| Dosya | Boyut | Ağırlık |
|---|---|---|
| `saha.webp` | 2400×1029 (21:9) | 145 KB |
| `altin-saat.webp` | 1600×1200 (4:3) | 42 KB |
| `masa.webp` | 2400×1029 (21:9) | 95 KB |

⚠ **21:9 bantların alt-sol köşesine beyaz başlık biniyor.** Üstünde
koyu bir geçiş katmanı var ama fotoğraf değiştirilirse başlığın hâlâ
okunduğuna BAKILMALI — renk kontrastı testi yazıyı fotoğrafa karşı
ölçmüyor, yalnızca düz zeminlere karşı ölçüyor.

---

## Kahraman görseli — ÜRETİLMİŞTİR (13 Kasım 2026)

`kahraman-tr.webp` · `kahraman-en.webp` — 2400×1343, ~124 KB

⛔ **Bu bir fotoğraf değildir, gerçek bir kişi değildir.** Higgsfield
üzerinden GPT Image 2.6 ile üretildi. Sayfada bu kişiye isim, alıntı
ya da "kullanıcımız" denmiyor ve denmeyecek.

**Sitede bu görselin üretilmiş olduğu yazmıyor — KULLANICI BÖYLE
KARAR VERDİ** (13 Kasım 2026, kendi sözleriyle: *"yazmaya gerek
yok"*). Soruldu, cevaplandı; tekrar açmaya gerek yok.

⛔ Karar şunu DEĞİŞTİRMİYOR: bu kişiye sayfada isim, alıntı ya da
"kullanıcımız" denmez. Üretilmiş olduğunu yazmamak başka şey, var
olmayan bir müşteriyi varmış gibi göstermek başka şey.

**Telefonun ekranındaki görüntü ÜRETİLMEDİ.** Yapay zekâya ekran boş
olarak ürettirildi (düz gri dikdörtgen), uygulamanın **gerçek** ekran
görüntüsü sonradan perspektifiyle yerleştirildi. Sebebi: yapay zekâya
"ekranda Shootboard görünsün" denseydi sahte bir arayüz çizerdi —
olmayan bir ürünü göstermek olurdu.

**Üretim istemi (özet):** sonbahar sokağında duran içerik üreticisi,
bir elinde avuç içi gimbal kamera, diğerinde ekranı BOŞ telefon,
arkasında turuncu/mor/yeşil/camgöbeği boyalı duvar, 16:9. Yasaklananlar:
omuz rigi, sinema kamerası, çekim ekibi, stüdyo ışığı, marka logosu,
ekranda yazı/arayüz.

**Eleme ölçütleri** (dört kare üretildi, biri seçildi): eller doğru mu,
telefon ekranı düz ve boş mu, kamera avuç içi kalmış mı, yüz "yapay
zekâ yüzü" olmuş mu.

**Montaj:** ekran görüntüsü hedef dörtgenin oranına kırpıldı (ezilmesin
diye), ImageMagick `-distort Perspective` ile yerleştirildi, sonra
sahneye uyduruldu (0,4 bulanıklık · %4 karartma).

⚠ **KÖŞELER YUVARLAK OLMALI ve dörtgen CAMIN GERÇEK KENARINA oturmalı.**
İlk montajda ikisi de yanlıştı: köşeler keskindi ve dörtgen camın
içinde kalıyordu (üstte 17, solda 8 piksel). Sonuç: telefonun koyu
çerçevesi kayboluyor, kenar çizgisi silinince ekran telefonun İÇİNDE
değil elin ÜSTÜNDE duruyormuş gibi görünüyordu — kullanıcı
*"kızın parmakları app'in arkasında kalmış gibi"* diye bildirdi.

Ölçülen değerler (2 kat ölçekte, 2688×1504 tuvalde):
- camın kenarları: x 1482–1728, y 449–966
- köşe yarıçapı: ~30 piksel → kaynak ekran görüntüsünde **160 piksel**

**SON YÖNTEM — kullanıcının tarif ettiği, 14 Kasım 2026.**
Kullanıcının kendi sözleriyle: *"telefon ekranının tamamını chrome key
ile boya ve boyadığın yeri kızın parmakları yok olmayacak şekilde sil.
Sonra app görselini alta bu görseli üste koy."* Yani KATMAN SIRASI
ters: fotoğraf ÜSTTE, uygulama ALTTA, ekranın olduğu yer fotoğrafta
DELİK.

Uygulaması (chroma key'e gerek yok, çünkü ekranın grisi zaten neredeyse
saf):
1. Özgün fotoğrafta ekranın düz grisi bulunuyor:
   `min(r,g,b) > 140` ve `max-min < 26`, cömert bir dörtgenin içinde.
2. Bu maske uygulamanın alfası ile çarpılıyor; kenarı 1 piksel
   yumuşatılıyor (tırtık olmasın).
3. Uygulama YALNIZCA maskenin içine çiziliyor.

Sonuç: çerçeve, yuvarlak köşeler, parmaklar ve cam yansımaları
kendiliğinden ÜSTTE kalıyor — tek tek maskelemeye gerek yok. Köşeleri
elle yuvarlamaya da gerek kalmıyor; maske camın gerçek şeklini zaten
taşıyor.

⚠ **Bu fotoğrafta parmaklar camın üstüne taşmıyor** (ölçüldü: dörtgenin
yalnızca %3,5'i gri değil, o da köşeler ve kenar yansımaları). Yani
"parmak ekranın üstünde" etkisi istenirse FOTOĞRAFIN KENDİSİNDE öyle
olmalı; montajla sonradan eklenemez — eklenirse uydurma olur.

⚠ Köşeleri gözle değil ÖLÇEREK bulmak gerekiyor: parlak gri maskesi
çerçevedeki yansımayı da sayıyor, o yüzden ilk ölçümüm camı olduğundan
geniş gösterdi. Doğru yol, orta satırdaki piksel değerlerini tek tek
okuyup koyu çerçeve ile gri ekranın sınırını bulmak.

---

## Uygulama ekran görüntüleri — TARİF

`uygulama-tablet-tr/en.webp` · `uygulama-telefon-tr/en.webp`

⚠ **13 Kasım 2026'dan önce bu görüntülerin nasıl alındığı hiçbir yerde
yazmıyordu.** Yenisini almak gerektiğinde tarif yoktu. Artık burada:

1. Yerel sunucu: depo kökünde `python3 -m http.server 8098`
2. Playwright ile `app.html` açılır. Ölçüler:
   - tablet : 1024×768, deviceScaleFactor 2 → 2048×1536
   - telefon: 440×950, deviceScaleFactor 3 → 1320×2850
3. `localStorage.demo_ui_language` açılıştan ÖNCE `tr` ya da `en`
   yazılır (`addInitScript`).
4. Tur ekranı `#tourSkip` ile atlanır, sonra birkaç kez `Escape`
   (açılan pencereler kapansın).
5. `#tabCalendar`'a basılır, `#ornekSeritX` ile örnek şeridi kapatılır.
6. Ekran görüntüsü alınır, `-quality 82` ile webp'e çevrilir.

⚠ **TELEFON GENİŞLİĞİ 440 PİKSELDEN AZ OLMASIN.** 390'da üst
çubuktaki "Shootboard" yazısı "Shoot..." diye kırpılıyor; Türkçe
arayüzde "Giriş yap" düğmesi daha geniş olduğu için 420 de yetmiyor.
Kullanıcı bunu canlı görselde fark etti. Ölçülen eşikler: İngilizce
420, Türkçe 440.

⚠ **DÖRT GÖRSEL DE DİLİ İZLİYOR.** `index.html` içindeki `dilUygula`
üçünün de kaynağını değiştiriyor (kahraman, tablet, telefon).
İngilizce siteye giren kişi Türkçe uygulama görmemeli.
