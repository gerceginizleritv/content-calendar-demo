# KURGU KARTI v1 — 11 Eylül 2026

**Gerçeğin İzleri / Tarihi Dedektif · Mustafa Bostancıoğlu**

Bu kart, marka kimliğinin **yalnızca kurguyu ilgilendiren** kısmıdır.
Tam belge: `content-calendar-demo/icerik/MARKA-KIMLIGI.md`.

> **Bu kartla çelişen eski bir kural varsa kart üstündür.**
> Kartta olmayan her şeyde `E:\CLAUDE VIDEOS` memory setindeki kurallar aynen geçerlidir —
> bu kart onları ezmez, yalnızca 6 yeni/değişen maddeyi taşır.

---

## 🆕 1. DAMGA — tam merkez, 1,6×, üç renk

**Kalıcı kural oldu.** (11 Eylül'e kadar yalnızca `014_YERALTI_CAMII/ILERLEME.md`
içinde proje notuydu; kural dosyası yoktu, bir sonraki videoda kaybolacaktı.)

- **Tam merkez.** Alt banda, köşeye, kenara konmaz.
- **`DAMGA_OLCEK = 1.6`**
- Üç renk: **KAYIT** altın `#F5C518` · **RİVAYET** kırmızı `#BD1F1D` ·
  **DOĞRULANAMIYOR** beyaz
- Reels'te `Rozet` **900 px sütun**, en fazla **iki dengeli satır**
- Damga ekrandayken **altyazı susar**
- Teslim öncesi `kontrol/damga_master.png` alınır, ortada olduğu **gözle** doğrulanır

---

## 🆕 2. DİKEY KAPAK — mor emekli, yatayın rengine geçti

**Kullanıcı kararı 11 Eylül:** *"youtube yatay görsellerimi esas al, dikeyleri buna uydur."*

| | Eski | **Yeni** |
|---|---|---|
| Yazı rengi | beyaz | **sarı `#FCDB00`** |
| Efekt | mor ışıma `#700D8A` | **siyah kontur** (kapak yüksekliğinin %5,5'i) |
| Son satır | yok | **`#F80000` bantta beyaz**, bant = kapağın %58'i |

**Geometri DEĞİŞMEDİ** — dikeyin kendi ölçüleri kalır (güvenli alana göre ölçülmüştü):
merkezde + alta yaslı (%95) · kapak yüksekliği = genişliğin %14,8'i ·
satır aralığı 1,50× · `takip=-0,035` · `bosluk=0,78` · 3 satırda kapak ×0,86

**Metin: üç satır, SON SATIR SORU.** 4 satır yasak.
`YER → TUHAF GERÇEK → SORU?`

`work/add_title.py` dikey stil sabitleri buna göre güncellenecek.

---

## 🆕 3. KAPAK PROMPTU — üç yasak

- ❌ **Görünüm tarifi yok.** Saç, sakal, yüz, yaş, kilo — tek kelime bile.
  Hepsi referans fotoğraftan. (Bu kural zaten vardı; marka belgesindeki promptlarda
  ihlal edilmişti, düzeltildi.)
- ❌ **Başlık metni prompta yazılmaz.** `add_title.py` basar.
- ❌ Uydurma görsel öğe yok (halka, çerçeve, parıltı…)
- ✅ **Arka plan belirgin şekilde yumuşak.** ← YENİ
  Gerekçe: vidIQ kapak puanlayıcısı üç kapağın üçünde de *"görüntü fazla
  kalabalık"* dedi (entropi 7,45 / 7,70 / 7,72). Mekân okunsun, özneyle yarışmasın.
- Yüz üst yarıda, alt üçte bir sade, düz siyah tişört, gülümseme yok
- **Her kapak dikey 1080×1920** — Facebook native video kapağı dahil

---

## 🆕 4. ÜÇ PERDE — videonun yapısı

**Kullanıcı kararı 11 Eylül.** Kurguda bilinmesi gereken:

```
1. PERDE  0:00–0:25   SAHADA, YÜZ     (0:00–0:03 nesne karesi, yüz yok)
2. PERDE  0:25–~10:00 SESLENDİRME     (evde kaydedilmiş dış ses)
3. PERDE  son ~45 sn  SAHADA, YÜZ     (çağrı + kapanış)
```

- **Geri dönüş karesi:** kapanıştan önce kadraja yeniden giriyor. Bu kare ayrı bir
  kurgu kalemi — atlanırsa 3. perde kopuk duruyor.
- Yüzün olduğu bölümlerde **kadraj kullanıcınındır** (taban ölçek 1.00) — mevcut kural.
- 1→2 geçişi: sahadaki son cümle açık uçla biter, seslendirme devralır. Araya
  "şimdi anlatayım" tarzı köprü konmaz.

---

## 🆕 5. İLK 20 SANİYE — kanalın tek öncelikli metriği

Ölçüm: izleyicinin **yarısından fazlası 17–21. saniyede** gidiyor, en iyi videoda bile.
Taban %43 → hedef %65 (yayından 7 gün sonra ölçülür).

Kurguda bunun karşılığı:
- **Jenerik 0:03'te DEĞİL, ~0:25'te** — hook bittikten sonra.
  *(Zaten `kanal-jenerigi.md` "GİRİŞ bölümünün sonuna" diyor — aynı şey, teyit edildi.)*
- **İlk 20 saniyede müzik yok ya da çok altta.** Hook'u sessizlik taşır.
- İlk 20 saniyede kanal tanıtımı, isim, format duyurusu **yok**.

---

## 🆕 6. İKİ PALET — karıştırma

| | Kod | Nerede |
|---|---|---|
| **EKRAN** kırmızı | `#BD1F1D` | damga, vurgu, jenerik zemini |
| **EKRAN** altın | `#F5C518` | KAYIT damgası, çizgi, sayaç |
| **KAPAK** sarı | `#FCDB00` | thumbnail başlık satırları |
| **KAPAK** kırmızı | `#F80000` | thumbnail soru bandı |

Bilerek farklı: kapak thumbnail ızgarasında yarışıyor, ekran videonun üstünde duruyor.

**Emekli:** `#700D8A` mor · `#B4302B` · `#C8A24A` · `#EFE6D4`
(son üçü Drive'daki eski kılavuzdandı, üretimde hiç kullanılmadı)

---

## ✅ DEĞİŞMEYENLER — bu kart bunlara dokunmuyor

Jenerik üretilmez (Zeyrek ham kaynağından, render sonrasına eklenir) ·
marka müziği leberch "Investigation", timeline'da 1.0 kazanç ·
SFX sentetik olamaz, araştırma sözlüğü (deklanşör, tık, saat) ·
kadraj kullanıcınındır · giriş/çıkışta hareket kullanıcıdansa dokunulmaz ·
üçlü kolaj video başına en fazla 2 · cross-cutting tek yer · jump cut yok ·
geçiş efektini kesmenin türü belirler · Türkçe büyük harf `toLocaleUpperCase("tr-TR")` ·
dikey güvenli alan (üst %13 alt %25 sağ %18 sol %5) · reels sinematik hat
(iddia→kanıt→KAYIT, özneyi takip eden kırpım, sürekli hafif zoom) ·
yazı yüzü örtmez · odak sürekliliği · ikincil hikâye hattı ·
AI klibinde TEMSİLİ CANLANDIRMA · reels 90–130 sn, 5 kesit, her biri kendi içinde tam

---

**Kart değişince sürüm artar ve sana "yeniden yapıştır" denir.**
v1 · 11 Eylül 2026
