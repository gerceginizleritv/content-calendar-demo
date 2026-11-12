# Aşama 5 — Plan listesi (çekilecek planlar)

**Tasarım belgesi · 12 Kasım 2026 · kod yazılmadan önce**

Bu belge onaylanmadan koda geçilmiyor. Her bölümün sonunda **ne
ölçüleceği** yazıyor; "olmuştur" denmeyecek.

---

## 0. Bu belgeyi yazarken bulunanlar

İki şey, işin şeklini değiştirdi. İkisi de belge yazılmadan önce
koddan çıkarıldı.

### ⚠ "Shot list" adı ZATEN KULLANIMDA — hem de tam bu iş için

Proje penceresinde, "Saha detayları" katının içinde şu an bir alan
duruyor:

| | |
|---|---|
| İngilizce etiketi | **"Shot list"** |
| Türkçe etiketi | **"Sahada çekilecekler"** |
| Ne | 4000 karakterlik serbest metin kutusu |
| Nerede | `app.html:4187` · alan kimliği `pe_shotList` |
| Veride | `p.shotList`, `sanitizeProject` 4000'e kırpıyor (`app.html:9424`) |
| Bulutta | `shot_list` sütunu (`app.html:13027`, `13043`) |

Yani plan listesinin **yapısız hâli zaten var.** Kullanıcıya ilk
anlattığım ad çakışması ("Shot list vs Shot checklist") eksikti;
gerçek çakışma üçlüydü.

**Sonuç:** Aşama 5 sıfırdan bir ekleme değil, **var olan bir alanın
yapılı hâline geçiş**. Yani bir **göç** işi ve belgenin en riskli
bölümü o.

### ✔ Script işareti ZATEN ÇALIŞIYOR

Kullanıcı "script içine işaret koy" seçeneğini seçti. Yeni bir şey
icat etmek gerekmiyor: `scOnizlemeHtml` script metnindeki
`^(#{1,6})\s+(.*)$` satırlarını `<h2>`…`<h6>` olarak çiziyor
(`app.html:21181` civarı). Kullanıcı script'e `## Giriş` yazdığında
önizlemede zaten başlık görüyor.

Plan listesi **o başlıkları okuyacak**. Yeni bir biçim, yeni bir
öğretme yükü yok.

---

## 1. Alınan kararlar

Hepsi kullanıcının, 12 Kasım 2026.

| Konu | Karar |
|---|---|
| Aşama 0 (platform başına etiket) | **İptal** — ayrı belgede |
| Eski serbest metin alanı | **Yerini alsın, yazılar taşınsın** |
| Adlar | Götürülecekler = **Kit & prep**, planlar = **Shot list** |
| Script bağlantısı | **Script içine işaret** (`## Başlık`) |
| AI taslak üretme | **Bu aşamada yok** — AI turuna |

### Adlar, üç şey için

| | Türkçe | İngilizce bugün | İngilizce olacak |
|---|---|---|---|
| Çekime götürülecekler | Çekim listesi | Shot checklist | **Kit & prep** |
| Çekilecek planlar (yeni) | **Plan listesi** | — | **Shot list** |
| Eski serbest metin | Sahada çekilecekler | Shot list | *(alan kalkıyor)* |

⛔ **Türkçe hiçbir ad değişmiyor.**

---

## 2. Veri

### Alanlar

Kullanıcının verdiği belgeden, birebir:

| Alan | Durum | Örnek |
|---|---|---|
| `metin` — açıklama, tek satır | Zorunlu | "Tiyatronun en üst sırasından geniş plan" |
| `tur` | Zorunlu | konuşma · ek görüntü · ekran kaydı · fotoğraf |
| `mekanId` | Zorunlu | mevcut mekanlardan |
| `bolum` — script işareti | Zorunlu | `## Giriş` |
| `cekildi` | Zorunlu | işaret |
| `olmazsaOlmaz` | İsteğe bağlı | |
| `not` | İsteğe bağlı | "EKSİK: ..." notu da buraya |
| `dikey` | İsteğe bağlı | |

⛔ **Bilerek YOK:** lens, kare hızı, açı, kamera hareketi, sahne
numarası, süre tahmini. Bunlar ekip için; tek kişilik üreticiye yük.
Profesyonel araçlarda çekim başına 10-14 alan var — belgenin kendi
gerekçesi bu.

### Nerede duracak

`checklist` ile **aynı kalıp**: projeye ait, tek sütunda JSON.

```
p.plans = [{ id, metin, tur, mekanId, bolum, cekildi,
             olmazsaOlmaz, not, dikey }]
```

Sebep: çekim listesi tam bu yoldan geçti (`sql/37`) ve çalışıyor.
Yeni bir tablo açmak, yeni bir yabancı anahtar ve yeni bir silme
davranışı demek.

### ⚠ Geçmesi gereken YEDİ yol

Aşama 2'de ölçüldü: **`sanitizeEvent` tanımadığı alanı sessizce
düşürüyor.** Proje tarafında da aynı tuzak var. Yeni alan şu yedi
yerden **ayrı ayrı** geçmeli ve her biri **ayrı ölçülmeli**:

1. `sanitizeProject` — beyaz liste
2. `projToRow` — buluta giden satır
3. `projFromRow` — buluttan gelen satır
4. **Sütun kalkanı** — `projPlanSutunu`, `projSatirPlansiz()`.
   `sql/37`'nin `projListeSutunu` kalkanının aynısı: SQL
   çalıştırılmadıysa liste **tarayıcıda kalır, kaybolmaz**; sütun
   açılınca ilk kayıtta gider.
5. Yedek alma / geri yükleme
6. Dışa aktarma
7. MCP araçları

⛔ **MCP'de silme aracı yok** — bu kural plan listesi için de geçerli.
Plan yalnızca kullanıcı, uygulamanın içinden siler.

### SQL

`sql/69-plan-listesi.sql` — bir sonraki numara (son dosya `sql/68`).
Başına, dosyanın kendi kuralı gereği, hangi dosyanın neyi geri
aldığı yazılacak.

⛔ **Ben çalıştırmıyorum.** Kullanıcıya adım adım verilecek: hangi
ekran, hangi menü, yapıştırılacak metnin tamamı, ne göreceği, farklı
görürse ne yapacağı.

---

## 3. GÖÇ — belgenin en riskli bölümü

Mevcut kullanıcıların `shotList` kutusunda yazı olabilir.

### Kural: kayıp yok

⛔ **`shotList` alanı ve `shot_list` sütunu SİLİNMİYOR.** Metin orada
durmaya devam ediyor. Göç yanlış giderse geri dönülecek yer var.
Kullanıcının seçtiği şey buydu.

### Nasıl

1. Projede `shotList` dolu **ve** `plans` boşsa, proje penceresinde
   bir satır belirir: *"Sahada çekilecekler kutunda N satır var.
   Plana çevireyim mi?"*
2. **Onaylamadan hiçbir şey çevrilmiyor.** (CLAUDE.md Bölüm 2.)
3. Onaylanınca her satır bir plan olur: `metin` = satır,
   `tur`/`mekanId`/`bolum` **boş**, `cekildi` **false**.
4. Kaç satırın çevrildiği yazılır.
5. Eski kutu, içindeki metinle birlikte **salt okunur** olarak kalır
   ve "bu metin plana çevrildi" diye işaretlenir.

### Boş alanlar sorun mu

Hayır, ama görünmeli. `tur`, `mekanId` ve `bolum` zorunlu alanlar —
göçten gelen planlarda boşlar. Liste onları **"tamamlanmayı
bekliyor"** diye gösterecek; kullanıcı doldurana kadar öyle durur.
Zorla doldurtmak göçü bir forma çevirirdi.

### Ne ölçülecek

- Dolu `shotList` + boş `plans` → satır beliriyor
- **Onaylanmadan hiçbir şey değişmiyor** (bayt bayt)
- Onaylanınca satır sayısı = plan sayısı
- `shotList` metni **değişmeden duruyor**
- `plans` dolu olan projede satır bir daha belirmiyor
- Boş satırlar ve yalnızca boşluk içeren satırlar plana dönmüyor

---

## 4. İki görünüm, tek liste

Belgenin kendi ayrımı:

| Ne zaman | Sıra |
|---|---|
| **Yazarken** | Script sırasına göre — `bolum` başlıklarının script'teki sırası |
| **Sette** | Mekana göre, **çekilmeyenler üstte** |

Tek veri, iki sıralama. Görünüm seçimi **oturumluk**; kalıcı
kaydedilmiyor (sayfa hafızasının bugünkü kuralı).

`bolum` boş olan planlar script sırasında **en sonda** durur —
düşürülmez. Göçten gelen planlar da öyle.

### Ne ölçülecek

- İki görünümde de **aynı planlar** var, yalnızca sıra değişiyor
- Sette görünümünde çekilmeyenler üstte
- `bolum` boş olanlar script sırasında sonda, kaybolmuyor
- Script'e yeni bir `##` başlığı eklenince sıra kendiliğinden
  güncelleniyor

---

## 5. Script işareti — bağ nasıl tutulacak

`bolum` alanı **başlık metninin kendisini** tutar (`"Giriş"`),
sırasını değil. Kullanıcının kararı buydu ve sebebi şu: paragraf
sırası tutulsaydı araya bir paragraf eklenince bütün bağlar
**sessizce** kayardı.

### Başlık silinirse ya da adı değişirse

Plan **kaybolmuyor**. `bolum` değeri duruyor ama script'te karşılığı
yok; liste onu *"script'te böyle bir bölüm yok"* diye gösteriyor ve
kullanıcı yeniden bağlayabiliyor. Sessizce boşaltmak, kullanıcının
yazdığını silmek olurdu.

### Aynı başlık iki kez geçerse

İlki. Ve liste bunu söylüyor — sessizce ilkini seçmek yanlış bölümü
göstermenin sessiz hâli olurdu.

### Ne ölçülecek

- Script'te `## Giriş` varken plana bağlanıyor
- Başlık **silinince** plan duruyor, "bölüm yok" diyor
- Başlığın **adı değişince** plan duruyor, "bölüm yok" diyor
- Aynı başlık iki kez geçince ilki seçiliyor ve uyarı çıkıyor
- Script metni hiç `##` içermiyorsa bölüm seçici boş ama çalışıyor

---

## 6. Mekan başına hatırlatmalar

Tek dokunuşla eklenen sekiz plan, belgeden birebir:

geniş plan · orta plan · yakın plan (eller, ayrıntı) · geliş ya da
ayrılış · kameraya konuşma · 30 saniye ortam sesi · kapak fotoğrafı ·
dikey sürüm

Hazır setlerin (Aşama 1) kalıbı: dokununca o mekana bağlı sekiz plan
düşer, `tur` ve `bolum` boş. **Aynı metin ikinci kez eklenmiyor.**

### Ne ölçülecek

- İki dilde sekiz madde, birebir aynı sayıda
- Dokununca sekizi de o mekana bağlı giriyor
- İkinci dokunuşta tekrar eklenmiyor
- Kullanıcının kendi planlarına dokunulmuyor

---

## 7. Bugün sayfası ve "mekandan ayrılırken"

### "Çekimden önce eksik" bölümüne yeni satır

`bugunOzeti`'de eksikler şu an dört şeye bakıyor (`app.html:9970`
civarı): script · yer · liste · kayıt. Beşincisi eklenecek:
**plan listesi yok**.

Gidilecek yer `BUGUN_EKSIK_YOL`'a bir satır: plan listesini açar.

⚠ Eksikler **yalnızca yaklaşan çekimlere** bakıyor. Kodun kendi
yorumu sebebini yazıyor: her projenin eksiğini saymak listeyi hiç
bitmeyen bir iş listesine çevirir ve o liste okunmaz. Yeni satır da
aynı kurala uyacak.

### Mekandan ayrılırken uyarı

⚠ **Böyle bir an yok.** Uygulamada "mekandan ayrıldım" diye bir
olay, bir düğme ya da konum takibi yok — arandı, bulunamadı.

İki seçenek var ve **karar kullanıcının**:

- **(a)** Sette görünümünde, o mekanın bütün planları için bir
  *"Bu mekanda işim bitti"* düğmesi. Basınca çekilmemiş **olmazsa
  olmaz** varsa uyarı çıkar.
- **(b)** Hiç yapılmaz. Liste zaten çekilmeyenleri üstte gösteriyor.

Konum takibi **önerilmiyor**: izin ister, pil yer, ve kullanıcının
nerede olduğunu saklamak bu uygulamanın işi değil.

### Ne ölçülecek

- Plan listesi boş olan yaklaşan çekimde satır beliriyor
- Satır plan listesini açıyor
- Plan listesi doluyken satır yok
- Uzak bir çekimin eksiği listeye girmiyor

---

## 8. Aşama 3'ten devreden iş

Işık bilgisi çekim tarihine göre yapıldı (`8ce4627`) ama belgedeki
**üçüncü yer** yapılamadı: *"plan listesinin sette görünümü"*. O
liste yoktu. Şimdi doğuyor.

Sette görünümünün başına, o mekanın o günkü ışığı: doğuş, batış, iki
altın saat, mavi saat.

⛔ **Aynı kurallar:** ağ çağrısı yok, saat dilimi mekanın **kayıtlı**
alanından; dilim yoksa **satır hiç yazılmıyor**. Tarayıcının dilimine
düşmek başka ülkedeki bir mekan için sessizce yanlış saat göstermek
olurdu.

`isikHtml(lat, lon, tz, genis, ymd)` zaten tarih alıyor — yeni kod
gerekmiyor, çağrı yeter.

---

## 9. Ad değişikliğinin dokunduğu yerler

Grep ile çıkarıldı. **Hiçbir test İngilizce adı okumuyor.**

| Dosya | Satır | Şu an | Olacak |
|---|---|---|---|
| `app.html` | 4455 | `<h2>Shot checklist</h2>` | Kit & prep |
| `app.html` | 6446 | `cl_title: "Shot checklist"` | `"Kit & prep"` |
| `app.html` | 6121 | `bugun_eksik_liste: "no shot checklist"` | `"no kit & prep list"` |
| `app.html` | 6422 | `pe_shotlist: "Shot list"` | *(alan kalkıyor)* |
| `guide.html` | 187, 372 | "The shot checklist" | The kit & prep list |
| `MARKA.md` | 103 | sözlük satırı | + "shot list" satırı |

⛔ **Değişmeyecekler:** Türkçe metinlerin hiçbiri · bölüm kimliği
`cekim-listesi` (iki kılavuzda da; `kilavuz.test.js` "bölüm
kimlikleri birebir aynı" diye ölçüyor) · öğe kimlikleri · testler.

**Eski kullanıcı nereye bakacak:** İngilizce ad değişiyor, **yer ve
düğme değişmiyor** — aynı proje penceresi, aynı düğme. Türkçe kullanan
hiçbir şey fark etmeyecek. Plan listesi ise yeni bir yer; eski
serbest metin kutusunun durduğu yerde açılacak ki alışkanlık bozulmasın.

---

## 10. Sıra ve her adımın ölçüsü

Her adım ayrı onay, ayrı ölçüm, ayrı commit.

| | İş | Risk |
|---|---|---|
| 1 | Veri + yedi geçiş yolu + sütun kalkanı + SQL | **Yüksek** — sessiz kayıp ailesi |
| 2 | **Göç** (onaylı, geri dönülebilir) | **Yüksek** — kullanıcı verisi |
| 3 | Liste ekranı, alanlar, iki görünüm | Orta |
| 4 | Script işareti bağı | Orta — bağ kopma hâlleri |
| 5 | Mekan başına sekiz hatırlatma | Düşük |
| 6 | Bugün sayfası eksiği | Düşük |
| 7 | Işık (Aşama 3'ten devir) | Düşük |
| 8 | Ad değişikliği + kılavuz + MARKA.md | Düşük — ama metin önce gösterilir |

Her adımdan sonra: 11 genişlikte yatay taşma yok · dokunma hedefi
≥44 px · en küçük yazı ≥11 px · kontrast ≥4,5 · iki dil · iki tema ·
sayfa hatası 0 · **tam tur yeşil**.

---

## 11. Cevap bekleyen tek soru

**Bölüm 7:** "mekandan ayrılırken uyarı" — (a) *"Bu mekanda işim
bitti"* düğmesi mi, (b) hiç yapılmasın mı?

Geri kalan her şey karara bağlanmış durumda.
