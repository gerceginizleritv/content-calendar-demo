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
