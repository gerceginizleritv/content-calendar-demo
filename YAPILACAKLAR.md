# Shootboard (eski adı Slate) — Yapılacaklar ve Değerlendirilenler

Bu dosya oturumlar arasında hafıza görevi görüyor. Claude'un hafızası
oturumlar arasında taşınmıyor; konuşulan ama yapılmayan işler burada
duruyor, neden ertelendiği de yazıyor ki aynı tartışma baştan yapılmasın.

---

# ÇALIŞMA SIRASI — kullanıcı onayladı (16 Kasım 2026)

Araştırma sohbeti 39 maddelik bir liste gönderdi. Durum **koddan ve
git geçmişinden** doğrulandı (hafızadan işaretlenmedi; geçmiş tam,
607 commit, kesik değil). Kullanıcı aşağıdaki sırayı onayladı.

⚠ **Her maddenin KENDİ prompt'undaki kurallar aynen geçerli**: önce
plan, sorular, aşama onayları. Bu sıra o kuralları kaldırmaz.
⚠ **PROMPT YOK** olan maddeyi tek satırdan tasarlama — sırası gelince
dur ve kullanıcıya söyle.
⚠ **KARAR BEKLİYOR** olanı atla, sırası gelince sor.
⚠ Bir madde bitince bu listeyi güncelle ve kullanıcıya tek satırla
haber ver.

## ⚡ TEST KOŞUSU — ARTIK İKİ KOŞUCU VAR (16 Kasım 2026)

Kullanıcı söyledi: *"Çok fazla bekleme süreci harcıyorum."* Ölçüldü ve
çözüldü.

| Koşucu | Ne yapar | Süre (210 test) |
|---|---|---|
| `testler/kosu.sh` | Tek sıra. **Dokunulmadı**, bilinen kapı. | **27 dk 50 sn** |
| `testler/hizli.sh` | 3 işçi paralel + 3 zamana duyarlı test sonda tek sıra | **10 dk 43 sn** |

İkisi de aynı testleri aynı argümanlarla koşuyor; ikisi de aynı gün
**210/210** verdi. `hizli.sh` **2,6 kat** hızlı.

**Çalışma düzeni:**
1. Geliştirme sırasında yalnızca etkilenen testler:
   `bash testler/hizli.sh <ad> <ad>` → **2-4 dakika.**
2. `main`'e göndermeden önce tam kapı: `bash testler/hizli.sh` →
   **~11 dakika.**

⛔ **Zamana duyarlı üç test paralel koşmaz** (`ai-gorunur`,
`gezinme-tavani`, `hatirlatma`); `hizli.sh` içindeki `SERI` listesinde
ve sonda tek sıra koşuyorlar. Sebep 27 Ekim 2026: aynı commit'in iki
CI koşusunda iki test **yalnızca zaman aşımından** kırmızı yanmıştı,
kod doğruydu, koşucu ~4 kat yavaştı. Bir test paralelde **rastgele**
kırmızı yanmaya başlarsa önce o listeye ekle — ⛔ testi zayıflatma.

⚠ `testler/sureler.txt` koşu sürelerini tutuyor; uzun testler önce
başlasın diye. Tam koşudan sonra değişmiş görünmesi normaldir.

## Sıra

### 1 · Bugünün yarım işleri  ⬜ SIRADA
- ✅ **Mekân kartları sabit yükseklik** (16 Kasım 2026, canlıda).
  Ölçüldü: kartlar 189-495 piksel arasındaydı, fark 233. Izgarada tek
  bir uzun kart bütün satırı geriyordu. Kart artık `--mk-kart-h:362px`;
  başlık iki satır, adres bir satır, föy kalan yeri dolduruyor.
  Ayrıca çift "Devamı" düğmesi hatası kapatıldı (föyden ~25 piksel
  çalıyordu). Test: `mekan-kart-olcu.test.js`, 17 kontrol.
- ✅ **Push `fiyatlar.html`'e eklendi** (16 Kasım 2026, iki dilde).
  **Creator Pro'da** — kullanıcı seçti. Gerekçe: push buluta bağımlı,
  hatırlatmayı sunucu gönderiyor ve terminleri bilmesi gerekiyor;
  hesapsız kullanıcının terminleri sunucuya hiç ulaşmıyor, yani
  Starter'ın "hesapsız çalışır" tanımıyla bağdaşmıyor. "Bulut" satırı
  zaten Creator Pro'daydı.
  Eklenme şartı sağlandı: o gün canlıda uçtan uca doğrulandı.
- ✅ **Hatırlatma tercihinin cihazlar arası senkronu** — **YAPILMIŞTI,
  liste güncellenmemişti** (17 Kasım 2026'da doğrulandı).
  ⚠ Bu maddeyi "yapılacak" diye okuyup baştan yazmaya kalkmak boş
  emek olurdu; önce koda bakıldı. Bekçi: `hatirlatma-senkron.test.js`,
  **7 iddia**, hepsi geçiyor:

  | Ölçü | Durum |
  |---|---|
  | Niyet buluta yazılıyor (`prefs.reminders`) | ✅ |
  | Buluttan **açık** gelince o cihazda da açılıyor | ✅ |
  | Buluttan **kapalı** gelince kapanıyor | ✅ |
  | Eski satırda alan yoksa yereldeki değer korunuyor | ✅ |
  | İzin beklerken "izin ver" düğmesi görünüyor | ✅ |
  | İzin beklerken **sebebi iki dilde** yazıyor | ✅ |
  | Anahtar kapalıyken ne düğme ne metin var | ✅ |

  ⛔ **Maddenin bir yarısı BİLEREK yapılmadı — kullanıcı kararı
  bekliyor.** Madde *"yeni cihazda uygulama kendiliğinden izin
  istesin"* diyor. Yapılmadı; sebebi `app.html`'deki yorumda yazılı:
  bildirim izni isteği tarayıcılar tarafından **kullanıcı
  etkileşimine cevaben** olmak üzere şartlanıyor, açılışta sormak
  sessizce reddedilebiliyor ve kullanıcıya saldırgan geliyor.
  Bugünkü davranış: yeni cihazda anahtar **açık** geliyor ve
  "Bildirimlere izin ver" düğmesi **sebebiyle birlikte** orada
  bekliyor — tek dokunuş kalıyor.
  ✅ **KULLANICI "DENENSİN" DEDİ — YAPILDI (17 Kasım 2026).**
  `otoIzinIste()` eklendi (`app.html`, `bildirimIzniIste`'nin altında).
  İki yerden çağrılıyor: açılışta (`acilistaBildirim`) ve niyet
  buluttan gelince (`hatirlatmaBuluttan`).

  **Beş kapı — hepsi testli:**

  | Durum | Davranış |
  |---|---|
  | Niyet kapalı | sorulmuyor |
  | İzin zaten verilmiş | sorulmuyor (gereksiz) |
  | İzin reddedilmiş | sorulmuyor (sormak hiçbir şey yapmaz) |
  | iOS, ana ekrana eklenmemiş | sorulmuyor (web push zaten çalışmıyor) |
  | Niyet açık + izin bekliyor | **cihaz başına BİR KEZ** soruluyor |

  ⛔ **İstek EK BİR ŞANS, tek yol değil.** "Bildirimlere izin ver"
  düğmesi yerinde kaldı. Gerekçe silinmedi çünkü hâlâ geçerli: MDN
  isteğin kullanıcı etkileşimine cevaben olmasını yazıyor, yani istek
  sessizce reddedilebilir. Reddedilirse kullanıcı yolu kapanmıyor.

  ⛔ **"Soruldu" işareti BULUTA YAZILMIYOR** (`demo_izin_soruldu`,
  yerelde). Sebebi: "sordum mu" cihaza ait bir olgu, niyet değil.
  Buluta yazılsaydı yeni cihazda "zaten soruldu" sanılır ve maddenin
  istediği şey — yeni cihazda sorulması — hiç olmazdı. Test bunu
  ayrıca ölçüyor.

  ⚠ İşaret `await`'ten **önce** konuyor: iki çağrı üst üste düşerse
  (açılış + buluttan niyet) iki pencere açılmasın.

  Bekçi: `hatirlatma-senkron.test.js` **16 iddia** (7 eskisi + 9
  yenisi), hepsi geçiyor. **İki mutasyonla kanıtlandı:** işaret
  kontrolü kaldırılınca iki iddia düştü; işaret `await`'ten sonraya
  alınınca yalnızca "üst üste" iddiası düştü — yani her iddia kendi
  şeyini ölçüyor.

  ⛔ **ÖLÇÜLEMEYEN KISIM — DOĞRULAMA KULLANICIDA.** Bu depoda yalnızca
  Chromium kurulu (Firefox ve WebKit yok, `playwright install`
  çalıştırılmadı) ve **headless tarayıcıda izin penceresi diye bir şey
  yok**. Yani "gerçek tarayıcı dokunuşsuz isteği gösterir mi"
  sorusu buradan **cevaplanamaz**.

  Chromium'da ölçülen tek şey (17 Kasım 2026): dokunuşsuz istek
  **hata fırlatmıyor** ve dokunuşlu istekle **aynı** sonucu veriyor
  (varsayılan bağlamda ikisi de `default`, izin verilmiş bağlamda
  ikisi de `granted`). Bu, "uygulamayı bozmaz" demek; "pencere
  görünür" demek **değil**.

  ⚠ Test de bunu ölçmüyor ve ölçtüğünü iddia etmiyor; ölçtüğü şey
  `otoIzinIste()`in ne zaman sorduğu, ne zaman sustuğu ve kaç kez
  sorduğu. Gerçek tarayıcı davranışı kullanıcının kendi cihazında
  doğrulanacak; adımlar kullanıcıya verildi.
- ✅ **Türkçe-only dize denetimi BİTTİ** (16 Kasım 2026).
  Tarama yorumlar elenerek yeniden yapıldı (ilk denemede CSS
  yorumlarındaki örnekler sayılıyordu). Sözlük blokları dışında
  **128** eşleşme çıktı, hepsi sınıflandırıldı:

  | Kaç | Ne | Durum |
  |---|---|---|
  | ~80 | Mekân adı çözümleme sözcükleri (`ören yeri`, `manastır`, `sarnıç`…) | **Veri**, arayüz değil — Türkçe kalmalı |
  | ~40 | Tur içeriği (`Fikirden yayına giden yol`…) | **İki dilli** — `tr: [` bir DİZİ, ilk aramam yalnızca nesneleri yakalıyordu |
  | 5 | İçe aktarma sütun ipuçları (`gün`, `tür`, `başlık`) | **Veri**, İngilizceleriyle birlikte duruyor (`'tarih','date','gün','day'`) |
  | 3 | Dil adları (`Türkçe`, `Français`) | Doğru — dil adı kendi dilinde yazılır |
  | 3 | Demo/örnek metin | Kullanıcının göreceği içerik değil |
  | ~11 | Kurulum tarifinin `tr ? … : …` şubeleri | İngilizcesi karşı şubede |
  | **3** | **`"boş yanıt"`** | ⛔ **GERÇEK HATA — düzeltildi** |

  ⛔ **Bulunan hata:** `"boş yanıt"` üç yerde, **çevrilmiş iki metnin
  ortasına** sabit Türkçe olarak gömülmüştü. İngilizce kullanan kişi
  *"Could not reach the API: boş yanıt — check your key…"* görüyordu.
  `ai_error_empty` anahtarı eklendi (iki dilde), üç kullanım da ona
  çevrildi.

### 2 · Çekim setleri (hepsi aynı ekran)
- ✅ **9.** Menü adı **"Malzeme" → "Çekim Setleri"** (16 Kasım 2026,
  `main`'de). İngilizcesi **"Shoot kits"**, dar ekran kısa biçimi
  **"Set" / "Kit"** (öteki sekmelerin kalıbı: Fikir, Mekan, Proje —
  tekil ve kısa). 15 yerde: menü (iki dil, iki biçim), HTML yedek
  metni, ilk-adım turunun menü sırası cümlesi (iki dil), kılavuz
  (`kilavuz.html` + `guide.html`, ikisinde de iki yer),
  `KONTROL-EDILECEKLER.md`, iki kod yorumu.

  ⛔ **BU RENAME BİR BOZULMA ÇIKARDI, bekçi test yakaladı.** Ad tek
  kelimeden iki kelimeye çıkınca **701-980 piksel** arasında sekme
  etiketi **iki satıra sardı**: 768 pikselde etiket 87 piksel istiyor,
  düğmenin iç genişliği 84. Sekme etiketinde `white-space:nowrap`
  **yok**, yani fazlalık kırpılmıyor — **sarıyor** ve o sekme çubuğu
  bozuyor. 700 ve altında yazı küçüldüğü için, 980 üstünde yer olduğu
  için sarmıyordu; 1024 üstünde şerit dikey, orada hiç sorun yok.

  Düzeltme (kullanıcı onayıyla): kısa ada geçiş **560 yerine 1023**
  kırılma noktasına taşındı — yani şerit yataya döndüğü anda. Yeni
  kırılma noktası açılmadı. Yan faydası: "Şablonlar" ve "Mekanlar" da
  o aralıkta dolguya taşıyordu, onlar da düzeldi.

  Test: `testler/sekme-adi.test.js`, **218 kontrol**, 15 genişlik ×
  2 dil. İki mutasyonla kanıtlandı. ⚠ Bu bekçi **sekiz dilde de**
  koşacak (41. madde) — metin uzaması tam bu şekilde görünür.
- ✅ **9b.** `MARKA.md` sözlüğüne **menü adı** eklendi (17 Kasım 2026).
  Satır: **Çekim Setleri** · kullanma: Malzeme, Ekipman · EN *Shoot kits*,
  dar ekranda **Set** / *Kit*. Adlar `app.html`'deki `tab_kit` /
  `tab_kit_k` anahtarlarından okundu, hafızadan yazılmadı.
  `set` satırı (kütüphaneden kaydedilmiş malzeme grubu) olduğu gibi
  duruyor: o **kavram**, yenisi **menü adı** — ikisi ayrı şey.
- ✅ **40.** **Sözlük parite testi** (16 Kasım 2026, `main`'de).
  `testler/sozluk-paritesi.test.js`, **52 kontrol**.

  Uygulamanın **kendi içinden** okuyor (dosyayı ayrıştırmıyor —
  ayrıştırma sahte güven verir, değişken adı değişince sessizce boş
  tarar). Yedi sözlük çiftinin tamamı: `LANG` · `TYPE_NAMES` ·
  `TYPE_LABELS` · `STATUS_LABELS` · `ORNEK_METIN` ·
  `TOUR_STEPS_I18N` (dizi) · `KUR_SEMA_METIN`.

  Her dil `en` ile karşılaştırılıyor (`en` referans, çünkü `t()` eksik
  anahtarda ona düşüyor). Altı boyut: **eksik** anahtar · **fazla**
  anahtar (yazım hatası) · **tür** uyuşmazlığı (metin/fonksiyon) ·
  fonksiyon **aritesi** · **boş** metin · **dizi boyu**.

  ⛔ **DİL LİSTESİ SABİT YAZILMADI.** Test `Object.keys(LANG)` ile
  hangi diller varsa onları geziyor. **41. madde altı dil ekleyince
  bu test onları kendiliğinden kapsayacak** — tek satır değişiklik
  gerekmiyor. (41'in 9. şartı böylece baştan karşılandı.)

  Beş mutasyonla kanıtlandı: anahtar silindi · fazla anahtar eklendi ·
  fonksiyon düz metne çevrildi · metin boşaltıldı · arite değiştirildi.
  **Beşi de doğru kontrol tarafından** kırmızı yandı.

  ⚠ **Test bir şey buldu, incelendi, hata DEĞİLDİ:** `ai_drafted_prefix`
  Türkçe'de boş. `app.html:21289` cümleyi üç parçadan kuruyor —
  İngilizce *"Drafted with "* + Gemini + *". Feel free to edit it."*,
  Türkçe *""* + Gemini + *" ile taslak hazırlandı…"*. Türkçe'de fiil
  sonda, yani önek **meşru olarak** boş. Test zayıflatılmadı; sebebi
  yazılı ayrı bir `BOS_OLABILIR` listesi açıldı. ⚠ 41. madde o listeyi
  büyütecek (Almanca ve Rusça'da da edat/fiil yeri farklı); her ekleme
  ayrı satır ve ayrı sebep ister — "hepsini serbest bırak" diye genel
  bir kural YAZILMAZ, yoksa kazara boş kalan etiket görünmez.
- ✅ **6.** Sekiz hazır set (16 Kasım 2026). Setler 12 Kasım'da
  kodlanmıştı; açık kalan tek şey adlardı. Kullanıcı sekiz adın
  tamamını gözden geçirdi ve **"adlar doğru"** dedi — değişiklik yok.
  Tablo yukarıdaki "(b) Çanta ve Yapılacaklar" bölümünde.
- ✅ **7.** **Sete tek düğmeyle madde ekleme** (16 Kasım 2026).
  Öncesinde var olan bir sete madde eklemenin tek yolu seti **aynı
  adla baştan yaratmaktı** (`setYap` aynı adlı seti siliyor): üç adım
  ve adı yeniden yazmak.

  Artık kütüphane sayfasında madde(ler)i işaretle → set çipindeki
  **"+"** düğmesine bas. Kullanıcının seçtiği tasarım (a):
  - **"+" yalnızca** kütüphane sayfasında ve **yalnızca bir şey
    işaretliyken** çıkıyor. Pencerede çoklu seçim yok (orada tıklamak
    maddeyi doğrudan listeye atıyor).
  - **Hazır set çipinde de "+" var:** basınca o set **senin setlerine
    kopyalanıyor.** Hazır setler kodun içinde metin, herkeste aynı ve
    üzerine yazılamaz; düzenlenecek olan o kopya.
  - Aynı adlı setin varsa kopyalama **üstüne yazmıyor, birleştiriyor**
    — kendi eklediğin maddeler kaybolmasın.
  - Hazır setten **yalnızca `canta` maddeleri** kopyalanıyor. Set
    "benim malzemem" demek; *"30 saniye oda sesi kaydet"* bir iş.

  ⚠ `stopPropagation` şart: "+" çipin içinde ve çipin kendi tıklaması
  seti **açıyor** (seçimi değiştiriyor). Durdurulmasaydı kullanıcı
  eklediği anda seçimini kaybederdi — test bunu ölçüyor.
- ✅ **8.** **Maddeye not alanı** (16 Kasım 2026). Kullanıcının şartı
  gereği **önce rapor verildi**, sonra kod yazıldı.

  Rapordan çıkan bulgu: not alanı **çekim listesi maddesinde zaten
  vardı** (`listeMaddeTemizle` → `not`, 200 karakter, "+ not"
  düğmesi), ama **sete kaydedince kayboluyordu** — set yapısı
  `maddeler: [düz metin]` idi. *"Powerbank — çantanın yan cebinde"*
  notunu yazıp seti kaydedince not gidiyordu.

  Yapılan: set yapısı `[{metin, not}]` oldu; `setYap` notları
  topluyor, `setiListeyeEkle` listeye **geri yazıyor**.

  ⛔ **GÖÇ — bu değişikliğin en tehlikeli yanı.** `setTemizle` **her
  okuma yolunda** duruyor (`readSetler` ve `setlerBuluttan`). Eski düz
  metin biçimini kabul etmeseydi kullanıcının kayıtlı setleri **hem
  tarayıcıdan hem buluttan sessizce silinirdi** — ekranda hiçbir şey
  patlamadan. İki biçim de kabul ediliyor ve o satır **kaldırılmaz**.

  **Test:** `testler/set-not-ekle.test.js`, **16 kontrol**. Dört
  mutasyonla kanıtlandı: göç kapatıldı · `stopPropagation` silindi ·
  not geri yazılmadı · hazır setten "yap" da kopyalandı — dördü de
  **doğru** kontrolden kırmızı yandı.
  ⚠ Mutasyon denemesi testin **kendi hatasını da** buldu: iki iddia
  aynı şeyi ölçüyordu, ayrıştırıldı.
- ✅ **10.** Set önerisi (çekim tarihi girilince) — **BİTTİ (17 Kasım 2026).**
  ⚠ **EŞLEŞME TABLOSU GELDİ** (kullanıcı, 16 Kasım 2026). İki durum:
  **işaretli** (pencere açılınca seçili gelir) ve **işaretsiz**
  (listede durur, kullanıcı isterse işaretler).

  | Proje türü | İşaretli | İşaretsiz |
  |---|---|---|
  | Dış çekim | Dış çekim | Konuşmalı çekim, Telefonla çekim |
  | Mekan çekimi | Dış çekim | Konuşmalı çekim, Telefonla çekim |
  | Stüdyo | Konuşmalı çekim | Telefonla çekim |
  | Vlog | **Konuşmalı çekim + Dış çekim** | Telefonla çekim |
  | Ürün inceleme | Konuşmalı çekim | Telefonla çekim |
  | Masabaşı / grafik | *(hiçbiri)* | *(hiçbiri)* |
  | Diğer | *(hiçbiri)* | Dış çekim, Konuşmalı çekim, Telefonla çekim |

  ⛔ **"Telefonla çekim" hiçbir türde işaretli GELMEZ** — bir tür
  değil, cihaz seçimi. ⛔ **"Uçuş günü" ve "Soğuk ve ıslak" türe
  BAĞLANMAZ**: biri kullanıcının kendi seçimi, öteki havaya göre
  (11. madde). ⛔ Zaten eklenmiş set yeniden önerilmez; reddedilen
  öneri aynı proje için yeniden sorulmaz.

  **Koddan doğrulananlar (16 Kasım 2026):**
  - ✅ **"Konuşmalı çekim" gerçekten ses/mikrofon ağırlıklı** —
    `app.html:8560`: iki mikrofon (asıl + yedek), kulaklık, taze
    mikrofon pili, alıcı + yedek kaydedici, 30 saniye oda sesi.
    Stüdyo ve Ürün inceleme eşlemesi bu varsayıma dayanıyordu;
    **varsayım doğru.**
  - ✅ Proje türleri **yedi tane** ve adları tabloyla aynı
    (`PROJ_TYPES`, `app.html:10148`).
  - ⛔ **Pencere bugün HİÇ YOK.** 10. madde henüz yapılmadı; yani
    "birden fazla işaretli set gösterebiliyor mu" sorusunun cevabı
    *hayır, çünkü pencere yok*. Bu eşleşme **pencereyle birlikte**
    baştan çok-seçimli kurulacak; ara çözüme gerek yok.
  - ⛔ **Genel setler (Önceki akşam / Kayda basmadan / Çekimden
    sonra) bugün HİÇBİR türe önerilmiyor** — öneri mekanizması yok.
    Yani "Masabaşı'nda önerilmesin" şartı kendiliğinden sağlanıyor;
    pencere kurulurken o türde hiçbir set önerilmeyecek.

  ---

  ✅ **YAPILDI. Kullanıcının dört kurulum kararı (17 Kasım 2026):**

  | Soru | Karar |
  |---|---|
  | Görünüm | **Proje sayfasının içinde bölüm** — açılır pencere değil |
  | Tetik | **Çekim tarihi ilk kez girildiğinde** |
  | Üç genel set | Her türde **tiksiz** listede |
  | Masabaşı / grafik | Öneri **hiç çıkmıyor** |

  "Görünüm" sorusu önemliydi: 50. maddede bütün pencereler sayfaya
  çevrildi (*"pop up çok küçük"*). Yeni bir pencere açmak o işi geri
  alırdı, bu yüzden soruldu.

  **Nasıl kuruldu:**

  - ⛔ **Eşleşme sıraya göre değil, SABİT ANAHTARA göre.** Sekiz setin
    her birine iki dilde aynı anahtar eklendi (`k: 'dis'` gibi).
    Sıraya güvenmek bu deponun tekrarlayan hatası olurdu: biri
    sözlüğü düzenleyip setleri yer değiştirince eşleşme **sessizce**
    bozulur ve kimse görmez.
  - ⛔ **`sanitizeProject` beyaz listesine `setOneri` alanı eklendi**
    (`soruldu` + `eklenen`). Eklenmese her okumada sessizce silinirdi:
    öneri her açılışta yeniden çıkar, eklenmiş set yeniden önerilirdi.
    `fikirTemizle`/`setTemizle` ailesinin bilinen tuzağı.
  - `listeMaddeEkle` **yeniden yazılmadı, kullanıldı**: aynı metni iki
    kez eklememe, `LISTE_MAX` sınırı ve kaydetme onun içinde.
  - "Ekle"ye basınca **form önce kaydediliyor** — yeni projede henüz
    kayıt yok ve girilen ad/tür/tarih kaybolmasın. Aynı desen "Çekim
    listesi" düğmesinde de var.
  - Bölüm **açıkken** tür değişirse listesi tazeleniyor (türü sonradan
    düzelten kullanıcı yanlış setleri görmesin). ⚠ Bu yeni bir tetik
    değil; kapalı bölümü açmıyor.
  - Yedi sözlük anahtarı iki dilde (`so_title`, `so_not`, `so_madde`,
    `so_ekle`, `so_sonra`, `so_bos`, `so_eklendi`). Parite testi geçti.

  **Bekçi:** `testler/set-onerisi.test.js`, **29 iddia**. Yedi türün
  hepsi kullanıcının tablosuyla tek tek karşılaştırılıyor; üç yasak
  ayrıca ölçülüyor (telefon hiçbir türde tikli değil · uçuş ve soğuk
  hiçbir türde yok · genel setler hep tiksiz).

  **Üç mutasyonla kanıtlandı:** vlog eşleşmesi bozulunca, `desk`
  tabloya eklenince ve beyaz listeden alan çıkarılınca ilgili iddialar
  düştü.

  ⛔ **MUTASYON BİR TEST HATASI YAKALADI — kayda geçsin.** `desk`
  mutasyonunda "Masabaşı'nda hiç açılmıyor" iddiası **yine geçti**.
  Sebep: test yeni projeyi `openProjectEdit(null)` ile açıyordu, ama
  o fonksiyon başında `if(!p) return;` taşıyor — yani null ile
  **hiçbir şey yapmıyor.** Form önceki projede kalıyordu ve ölçü
  `desk`'e değil ona bakıyordu. Doğru kapı `openProjectNew()`.
  Düzeltildi; ayrıca iddia artık **ölçünün doğru şeye baktığını da
  kanıtlıyor** (`duzenlenenProje` null mı, öneri `desk` türüne mi
  bakıyor). Sebep testin içine yazıldı.
  ⚠ Ders: yeşil bir test, yanlış sebeple yeşil olabilir. Mutasyon
  denemesi olmasa bu görülmezdi.

  ---

  ⛔ **KULLANICI CANLIDA İKİ EKSİK BULDU (17 Kasım 2026) — İKİSİ DE
  DÜZELTİLDİ.** Kullanıcının sözleri:

  > *"Proje açtım, tür olarak Vlog seçtim, çekim tarihi alanına bir
  > tarih girdim, altta bazı setler çıktı, ekle dedim, projeyi
  > kaydettim ama projeyi geri açınca bunların hiç biri
  > görünmüyordu."*

  **1. KÖK SEBEP — benim hatam, ve veri kaybı DEĞİL.** `projeyiKaydet()`
  sonunda `closeProjectEdit()` çağırıyor (`app.html` ~16182), yani
  **proje sayfasını kapatıyor.** "Ekle" düğmesinde onu çağırdığım için
  kullanıcı basınca sayfa kapanıyor, proje listesi geri geliyordu; form
  da "yeni proje" sanmaya devam ediyordu (`duzenlenenProje` null), bu
  yüzden "Kaydet"e basınca yeni-proje soruları çıkıyordu.

  Ölçüldü: veri **yerindeydi** — 17 madde, `setOneri` kayıtlı, etiket
  `0/17`, Çekim listesi 17 satır. Kullanıcı onları **göremiyordu**,
  çünkü maddeler Çekim listesi bölümünün içinde ve o bölüm kapalıydı.

  Çözüm: eklendikten sonra `cekimListesiAc(pr.id)` çağrılıyor — proje
  sayfası **geri açılıyor** ve çekim listesi bölümü **gösteriliyor**.
  Kullanıcı bıraktığı yerde kalıyor ve eklediğini **hemen görüyor**.
  `uyari()` penceresi kaldırıldı: üstüne bir pencere daha açmak yerine
  sonuç doğrudan görünüyor.

  **2. SETİN İÇİ GÖRÜNÜYOR, MADDE ÇIKARILABİLİYOR.** Kullanıcının
  sözleri:

  > *"Bu altta eklenen setler set olarak ekleniyor ama kullanıcı bu
  > setlerin içerisinde ne gibi araçlar var ne yok bunu ezberlemez,
  > ezberlemek zorunda da değil. Bu setlerin içerikleri de mutlaka
  > görünüyor olmalı. Hatta bu setlerin içerisinde yer alan bazı
  > araçları da dilerse çıkarabilmeli. İlla her vlogda hep aynı
  > araçları kullanması gerekmiyor."*

  Öneri satırları artık `▾` ile **açılıyor**: maddeler metinleriyle
  görünüyor, her maddenin **kendi tiki** var ve varsayılan tikli
  geliyor. Tikten çıkarılan madde çekim listesine **hiç girmiyor**.
  Sayı etiketi bunu yazıyor: `9 madde` → `8 / 9 madde`.
  ⚠ Madde tiki değişince bölüm **yeniden çizilmiyor**, yalnızca sayı
  etiketi tazeleniyor — yeniden çizmek tıklanan kutudan odağı kaçırır
  ve klavyeyle gezen kullanıcı yerini kaybeder. Test bunu da ölçüyor.

  **Bekçi büyüdü:** `set-onerisi.test.js` **35 iddia** (29 + 6).
  İçlerinde bir **gerileme bekçisi** var: "Ekle" proje sayfasını
  kapatmıyor · düzenlenen proje doğru · çekim listesi açılıyor.
  **Mutasyonla kanıtlandı:** hata geri konulunca o iki iddia düştü.

  ⚠ Bu, **49. maddenin öneri bölümüne düşen yarısıdır.** 49 hâlâ açık:
  kullanıcının *kendi* setlerinden madde çıkarma ve Çekim listesi
  ekranındaki set yönetimi ayrı iş.

  ⛔ **İKİNCİ TUR — KULLANICI AYNI ŞEYİ BİR DAHA SÖYLEDİ
  (17 Kasım 2026).** İlk sürümde içerikler **kapalı** başlıyordu ve
  işaret `▾` idi. Kullanıcı ekran görüntüleriyle bildirdi:

  > *"Burada gelen setlerin içerikleri yine detaylı olarak
  > görünmüyor. İlk liste tavsiyesi geldiğinde setlerin içeriği de
  > altında yer almalı. Ekle dedikten sonra kapanabilir. Hatta
  > setlerin yanında + ve − olsun, bu listeler kapatılsın açılsın."*

  Yapıldı: içerikler **açık başlıyor**, işaretler **`+` / `−`**.
  İki dilde iki yeni anahtar (`so_goster`, `so_gizle`).

  ⚠ **Ölçüldü:** Vlog'da altı set, **52 madde satırı**, bölüm
  **1716 piksel** (masaüstü 900 piksel ekran) / **1869 piksel**
  (telefon). Yani öneri bölümü yaklaşık iki ekran uzunluğunda ve
  "Tikli setleri ekle" düğmesine ulaşmak için kaydırmak gerekiyor.
  Yana kayma yok. Kullanıcı istediği için böyle bırakıldı; rahatsız
  ederse seçenek şu: **yalnızca tikli setler açık başlasın**, tiksiz
  olanlar `+` ile açılsın (Vlog'da 52 yerine ~18 satır).

  ⚠ **Kullanıcı eski sürümü denemişti.** Birinci ekran görüntüsündeki
  *"17 madde çekim listesine eklendi"* penceresi `db619a1`'de
  kaldırılmıştı; üçüncü görüntüdeki *"Çekim listesi 0/17"* ise
  maddelerin **yerinde olduğunun** kanıtıydı. Bildirilen "kayboldu"
  gerçekte "görünmüyordu" idi ve düzeltmesi `main`'e henüz gitmemişti.
- ⬜ **11.** Havaya göre set önerisi — ⚠ **TASARIMDAN SONRAYA ALINDI**
- ⬜ **12.** Zamanlama (set doğru günde öne çıkar) — ⚠ **TASARIMDAN
  SONRAYA ALINDI**

### 2b · TASARIM — ÖNE ALINDI (kullanıcı, 17 Kasım 2026)  ⬜ SIRADA

> *"evet tasarım işlerini öne al"* — kullanıcı, 17 Kasım 2026.

Sebebi: bunlar kullanıcının **ekranda gördüğü** şeyler. 11 ve 12
(hava, zamanlama) bu bölümün arkasına geçti.

⚠ **Madde gövdeleri aşağıda, kendi yerlerinde duruyor** (43–48);
burada yalnızca sıra var. Numaralar değişmedi — değiştirmek sohbetteki
ve commit'lerdeki atıfları kırardı.

**Sıra ve gerekçesi:**

⛔ **BU SIRA BİTTİ — 18 Kasım 2026 itibarıyla altısından beşi
kapandı.** Tablo kayıt için duruyor; sıradaki iş için aşağıdaki
"kalan" satırına bak.

| # | İş | Durum |
|---|---|---|
| **46** | Favicon aileleri ayrışmış | ✅ **BİTTİ** (17 Kasım) |
| **45** | Ana sayfa kahraman boşluğu | ✅ **BİTTİ** (17 Kasım) |
| **47 + 48** | Üst menü birliği **+** dil sürekliliği | ✅ **BİTTİ** (18 Kasım) |
| **43** | Mekânlar: fotoğraflı liste görünümü | ✅ **BİTTİ** (18 Kasım) |
| **44** | Fiyatlar sayfası | ⏳ **Kısmen** — aşağıya bak |

**44'ün bugünkü hâli:**

| Parça | Durum |
|---|---|
| 44.1–44.2 EUR + para birimleri veriden | ✅ BİTTİ (18 Kasım) |
| 44.4 Aylık/Yıllık kalıyor | ✅ Karar verildi |
| 44.5 Kutular eşit ölçüde | ✅ BİTTİ (18 Kasım) |
| 44.7 Yıllık indirim rozeti (üç yerde) | ✅ BİTTİ (18 Kasım) |
| 44.6 "Neler dahil" özeti | ❌ **YAPILMAYACAK** — kullanıcı: *"kısa özete gerek yok, karşılaştırma listesi öncesindeydi bu"* |
| 44.3 Ülkeye göre para birimi, düğmesiz | ⏸ **CLOUDFLARE'E BAĞLI** (kullanıcı kararı) |

⛔ **47 ve 48 NEDEN BİRLİKTE.** 48. madde zaten yazıyor: dil
bağlantısının tek satırlık düzeltmesi var ama *"asıl sorun çözülmeden
yapılırsa **dördüncü bir yama** olur"*. Üst menüyü birleştirmek (47)
dil bağlantılarını da kapsıyor — menü her sayfada aynı olacaksa dil
seçicisi de aynı olacak. İkisini ayrı yapmak aynı dosyalara iki kez
dokunmak ve ikinci seferde birincisini bozmak demek.
⚠ 48'in ayrıca **41'den (altı dil) önce bitmesi şart** — orada yazılı.

### 3 · Sınırlar
- ⬜ **52.** **Fikirlere öncelik** (kullanıcı kararı, 16 Kasım 2026).
  Üç düzey, adlar kesin: **1 Çok Öncelikli · 2 Orta Öncelik ·
  3 Düşük Öncelik** (EN: High / Medium / Low priority).
  **İsteğe bağlı** — seçmeden kaydetmek engellenmez, varsayılan düzey
  atanmaz; "önceliksiz" ayrı bir durumdur, "düşük" değildir.
  **Yalnızca Creator Pro.** Süzme olacak (1/2/3/önceliksiz).
  Birleşmede **büyük öncelik kazanır** (1+2→1, 2+3→2, 2+2→2;
  öncelikli + önceliksiz → öncelikli). **Projeye dönüşünce öncelik
  biter** — projeye öncelik alanı EKLENMEZ. **AI, İçe Aktar ve MCP
  ile gelen fikirler önceliksiz** gelir. Mevcut fikirlere dokunulmaz.
  **Paylaşımda görünmez.**

  ⛔ **KODDAN DOĞRULANDI — VERİ KAYBI RİSKİ GERÇEK.**
  `fikirTemizle` (`app.html:14643`) beyaz listeli bir nesne kuruyor;
  **listede olmayan alan sessizce DÜŞER.** Yani `priority` alanı
  temizleyiciye eklenmezse yedekten geri yükleme, bulut eşitleme ve
  eski sürümle açık kalmış ikinci bir sekme onu **siler**. Aynı tuzak
  `setTemizle`'de vardı (8. madde) ve orada iki biçim birden kabul
  edilerek çözüldü — burada da **test yazılacak**.

  ⚠ Renk için ilke: **yeni renk yok.** Üç düzey uygulamanın var olan
  değişkenlerine bağlanacak — `--accent` / `--amber` / `--text-dim` —
  böylece palet işi (C grubu) ne zaman yapılırsa yapılsın öncelik
  renkleri kendiliğinden uyar. ⛔ `--red` **kullanılmayacak**:
  uygulamada hata ve gecikme demek. ⚠ Yalnızca renge dayanılmayacak
  (turuncu ve sarı renk körlüğünde yakın): rakam + dolu nokta
  (1 ●●● · 2 ●●○ · 3 ●○○) ve ekran okuyucu için düzeyin adı.
  ⚠ Açık temada **ikinci yüzey** üstünde 1. ve 2. düzey 4.5
  kontrastın altına düşüyor — işaret ana yüzeyde dursun. Kontrastlar
  uygulanmadan **ölçülecek** (Bölüm 4).

- ⬜ **53.** **Çoklu hesap: platform başına en fazla 2** (kullanıcı
  kararı, 16 Kasım 2026). Starter 1, Creator Pro 2. Bugünkü
  `HESAP_ADET = 60` toplam sınırı bunun yerine geçer.
  Takvim kutusuna hesabın **kısa adı** yalnızca o platformda iki
  hesap varsa eklenecek. Süzgeç kalır, varsayılan "tüm hesaplar".
  ⛔ **Mevcut veriye dokunulmaz:** 2'den fazla hesabı olanın
  hesapları silinmez, kayıt bağları kopmaz; yalnızca yenisi eklenemez.
  ⚠ `MARKA.md`: bu bir **bağlantı değil ETİKET** — "hesaplarına
  bağlanır" anlamına gelen metin yazılmaz.

  ⛔ **ÖNCE ŞU HATA: "Hangi hesaba?" alanı çıkmıyor.**
  Kullanıcı canlıda ikinci bir Instagram hesabı ekledi, Yeni Giriş'te
  Instagram'ı işaretledi, alan **çıkmadı**.
  **Koddan doğrulandı:**

  | Ne | Sonuç |
  |---|---|
  | Özellik canlıda mı | **Evet** — `main` ile çalışma dalı aynı |
  | Alan ne zaman çıkıyor | `hesapSeritGerekir(p)` = o platformda **1'den fazla** hesap (`app.html:14476`) |
  | Tazeleme bağlı mı | **Evet** — `platformChecks` değişince `modalHesapTazele` koşuyor (`app.html:20016`) |
  | **Şüpheli** | `hesapPlatformDoldur` (`app.html:24020`) seçiciye **boş seçenek koymuyor**; varsayılan `CAL_SM_PLATFORMS[0]` = **YouTube** |

  ✅ **ÇÖZÜLDÜ — HATA DEĞİLMİŞ** (kullanıcı ekran görüntüsü gönderdi,
  16 Kasım 2026). Listede **tek hesap** var: *BOSVALAB · Instagram*.
  Alanın şartı iki hesap; Instagram'da bir hesap olduğu için alan
  **doğru davranıp** çıkmamış. İkinci hesap hiç eklenmemiş.

  ⚠ **Önceki tahminim ("platform YouTube'a düşmüştür") YANLIŞTI.**
  Hesap doğru biçimde Instagram'da kayıtlı. Tahmin yazılmıştı,
  ekran görüntüsü çürüttü — Bölüm 4'ün tekrarı.

  ⛔ **ASIL BULGU: ENTER TUŞU HİÇBİR ŞEY YAPMIYOR.** Formdaki
  alanlarda Enter'a basmak kaydetmiyor; kaydeden tek şey "Ekle"
  düğmesi (`hs_kaydet`, `app.html:24148`). Düğme `type="button"` ve
  etrafında `<form>` yok, yani **Enter sessizce yutuluyor** — ne
  kayıt oluşuyor ne uyarı çıkıyor. Alanları doldurup Enter'a basan
  kullanıcı hesabın eklendiğini sanıyor. Kullanıcının yaşadığı şeyin
  en olası sebebi bu.

  ⚠ İkinci bulgu: ad alanı zorunlu (`hesapKaydet` boş adda uyarı
  veriyor, o kısım doğru) ama **hangi alanın zorunlu olduğu basmadan
  önce belli değil.**

  ⚠ Üçüncü bulgu: pencerenin açıklaması (`hs_intro`) *"Aynı
  platformda birden çok hesabın varsa buraya ekle"* diyor ama
  **alanın ancak İKİ hesapta görüneceğini söylemiyor.** Tek hesaplı
  kullanıcı kayıt ekranında neden seçim çıkmadığını anlayamıyor.

  **ÜÇÜ DE YAPILACAK** (kullanıcı onayı, 16 Kasım 2026 —
  *"Üçünü de yapılacaklara ekle"*). Üçü bir arada yapılacak, çünkü
  üçü de aynı pencereyi (Hesaplar) düzeltiyor:

  - ⬜ **53a. Enter kaydedecek.** Hesap formundaki alanlarda Enter
    "Ekle" ile aynı işi yapacak. `hs_kaydet` `type="button"` olduğu ve
    etrafında `<form>` bulunmadığı için Enter bugün sessizce yutuluyor.
    ⚠ Alanları bir `<form>` içine almak **sayfayı yenileyebilir**;
    yenilenme kaydı kaybeder. Ya `submit` olayında `preventDefault()`
    çağrılacak, ya da form olmadan alanlara `keydown` dinleyicisi
    konacak. Bekçi test: alanları doldur, Enter'a bas, hesabın
    listeye düştüğünü ölç (bugün düşmüyor).
  - ⬜ **53b. Alanın iki hesapta göründüğü yazacak.** `hs_intro`
    metni "Aynı platformda **iki** hesabın olduğunda kayıt ekranında
    hangi hesap olduğunu seçebilirsin" gibi şartı söyleyen bir cümle
    olacak. Tek hesaplı kullanıcı neden seçim çıkmadığını anlayacak.
  - ⬜ **53c. Zorunlu alan basmadan önce belli olacak.** Ad alanı
    zorunlu (`hesapKaydet` boş adda uyarı veriyor, o kısım doğru) ama
    bu, "Ekle"ye basılmadan önce görünmüyor. Alan zorunlu olduğunu
    gösterecek (etikette işaret + `required`).

  ⛔ **Üçü de HER DİLDE** (Bölüm 7). 53b yeni bir arayüz dizesi, 53c
  etiketi değiştiriyor: ikisi de her dilin sözlüğüne girecek.
  `testler/sozluk-paritesi.test.js` eksik anahtarı yakalar.

- ⬜ **54.** ⛔ **KENDİ SETLERİNİ VE KENDİ ÇEKİM TÜRÜNÜ KUR —
  CREATOR PRO.** Kullanıcı istedi (17 Kasım 2026), kendi sözleriyle:

  > *"Bu hazır setleri de kullanıcı kendi isteğine göre bazı araçları
  > çıkarıp ya da ekleyip kişiselleştirmek isteyebilir, kendi setini
  > yaratmak yerine. Bunu da ayarlar içerisinde bir yerde ona
  > kişiselleştirme ve hangi tip videoya atamak istiyorsa düzenleme
  > arayüzü vermeliyiz. Belki de bizim default video tipleri haricinde
  > kendi bir tip eklemek isteyecek, mesela 2 kişinin karşılıklı
  > konuştuğu podcast gibi. Bu ve benzer şeyleri kişiselleştirip kayıt
  > edip sürekli kullanabilmeli. Bu Creator Pro planda yer alacak bir
  > özellik olacak."*

  **Üç ayrı iş var, sırası da bu:**

  | # | İş |
  |---|---|
  | 54a | Hazır setin **kendi kopyanı** düzenleyebilme (araç çıkar / ekle) |
  | 54b | Bir seti **hangi çekim türüne** öneri olarak atayacağını seçme |
  | 54c | **Kendi çekim türünü** ekleme (örn. "Podcast — iki kişi") |

  **Koddan doğrulanan tuzaklar — sırası gelince bunlara dikkat:**

  - ⛔ **`sanitizeProject` kendi türünü SESSİZCE SİLER.** Bugün
    `type: PROJ_TYPES.indexOf(raw.type) !== -1 ? raw.type : 'other'`
    yazıyor (`app.html`). Kullanıcının eklediği tür bu listede
    olmadığı için her okumada **`'other'`a düşer** ve kullanıcı
    "türüm kayboldu" der. Beyaz liste genişletilmeden 54c yapılamaz.
  - ⛔ Hazır setler **kodun içinde metin** (`t('hset')`) ve herkeste
    aynı; üzerine yazılamaz. 7. madde bunun yolunu zaten kurmuştu:
    "+" basınca **kendi kopyan** çıkıyor. 54a o kopyanın üstüne
    kurulacak, hazır setler bozulmadan kalacak.
  - ⛔ Set anahtarları (`k`) **eşleşme tablosunun** (`SET_ONERI`)
    kimliği. Kullanıcının kendi setinin de bir anahtarı olacak ve
    **hazır setlerinkiyle çakışmamalı.**
  - ⚠ Tür ekleme şunlara dokunuyor: tür açılır listesi, `SET_ONERI`
    eşleşmesi, `adresGerekir(tür)`, `TYPE_NAMES` / `TYPE_LABELS`
    sözlükleri. Sırası gelince tek tek çıkarılacak.
  - ⛔ **Bölüm 7: her dilde.** Kullanıcının yazdığı set/tür adı
    **veri**, çevrilmez; ama arayüz dizeleri her dile girer.

  ⚠ **Creator Pro'ya ait.** `fiyatlar.html`'deki plan karşılaştırmasına
  da satır eklenecek — ⛔ **44. madde (fiyatlar sayfası) bundan ÖNCE
  bitmeli**, yoksa satır iki kez yazılır.

  ⚠ Bu madde **49** ile aynı aileden (set yönetimi: içi görünsün,
  madde çıkarılsın). 49 bitmeden 54a'ya başlanmaz.

- ✅ **55.** ⛔ **ÇEKİM LİSTESİ EKRANI, EKLEME EKRANIYLA AYNI DİLİ
  KONUŞSUN.** — **BİTTİ (17 Kasım 2026).** Kullanıcı bildirdi (17 Kasım 2026, ekran görüntüsüyle),
  kendi sözleriyle:

  > *"Ekleme yapıldıktan sonra Çekim Listesine tıkladım, liste açık ve
  > bir önceki eklediğim alandan farklı olarak geliyor. Burası da tıpkı
  > ekleme alanındaki gibi ana başlığın altında tikli liste olarak
  > gelmeli, altında not alanları bulunmalı. Bu ekran kullanıcının
  > kafasını karıştırıyor, farklı bir liste gibi geliyor."*

  **İstediği akış, kendi sıralamasıyla:**

  1. Kullanıcı listeleri ekledi ve kaydetti.
  2. Sonra proje içine girer; **çekim listesine tıklamadan**, başlığın
     altında eklediği listeleri **`+` işaretli** olarak, bir önceki
     sayfadakinin aynısı biçiminde görür.
  3. `+`'ya tıklar, listeler açılır; düzenlemek isterse tikleri
     kaldırır, notu varsa ilgili yere yazar.
  4. İşi bitince kaydeder, kapatır.

  ⛔ **KÖK ENGEL — koddan doğrulandı (17 Kasım 2026).** Çekim listesi
  maddeleri **hangi setten geldiklerini KAYDETMİYOR.**
  `listeMaddeTemizle` beyaz listesinde yalnızca `kaynak` var
  (`elle` · `kutuphane` · `mekan` · `canta` · `yap`) ve
  `listeMaddeEkle(x[1], 'canta'|'yap')` çağrısı set adını geçmiyor.
  Ekran da bu yüzden **kaynağa göre** grupluyor — ekrandaki "ÇANTA" ve
  "YAP" başlıkları o. Set başlığı altında gruplamak için her maddeye
  **set anahtarı** yazılmalı.

  **Bunun getirdikleri:**

  - ⛔ Yeni alan `listeMaddeTemizle` **beyaz listesine** eklenmeli,
    yoksa her okumada sessizce silinir. (`setOneri` alanında 17 Kasım'da
    aynı tuzak yaşandı; `fikirTemizle`/`setTemizle` ailesi.)
  - ⚠ **Bugün eklenmiş maddelerde set anahtarı YOK.** Onlar
    gruplanamaz; "set dışı" bir bölümde durmalı, kaybolmamalı.
    ⛔ Eski maddeyi silmek ya da zorla bir sete atamak **veri kaybı**
    sayılır — kullanıcının elle eklediği maddeler de o kovada.
  - ⚠ Not alanı zaten var (`+ not`, 8. madde) ama **set başlığı altında
    değil**; yeni düzende maddenin altına girecek.
  - ⚠ `+` / `−` davranışı öneri bölümüyle **aynı** olmalı — kullanıcının
    şikâyeti tam olarak "farklı bir alan gibi görünüyor".

  ⚠ Bu madde **49** ve **54** ile aynı aileden. 49'un öneri bölümüne
  düşen yarısı 10. maddede yapıldı; bu madde aynı dili **çekim listesi
  ekranına** taşıyor.

  ---

  ✅ **YAPILDI.**

  - Maddeler artık **hangi setten geldiklerini kaydediyor** (`set`
    alanı, `listeMaddeTemizle` beyaz listesinde).
  - Çekim listesi **set adıyla** gruplanıyor; set anahtarı olmayan
    maddeler eski kaynak başlıkları altında duruyor — **zorla
    atanmıyor, kaybolmuyor.**
  - Gruplar **kapalı** başlıyor, işaret **`+`**; açılınca `−` oluyor.
    Her maddenin tiki ve **not alanı** var. Öneri bölümüyle aynı dil.
  - Projeye girince **liste doluysa bölüm kendiliğinden açılıyor** —
    kullanıcının şartı *"çekim listesine bile tıklamadan"*. Boş
    projede açılmıyor. Açılış sayfayı aşağı **kaydırmıyor**.

  ⛔ **YOLDA ESKİDEN BERİ VAR OLAN BİR KUSUR BULUNDU VE DÜZELTİLDİ.**
  `closeProjectEdit` çekim listesi bölümünü kapatmıyordu. Ölçüldü:
  dolu "A" projesinden çıkıp **boş "B"** projesine girince bölüm
  **"A dolu" başlığıyla ve A'nın iki grubuyla açık** kalıyordu.
  Kullanıcı başka bir projenin çekim listesini kendi projesi sanırdı.
  Bu madde bölümü kendiliğinden açmaya başlayınca görünür hale geldi.

  **Bekçi:** `testler/liste-duzeni.test.js`, **15 iddia**.
  **Üç mutasyonla kanıtlandı:** beyaz listeden `set` çıkarılınca
  başlıklar `["Çanta","Yap"]`a döndü (kullanıcının gördüğü hatanın
  kendisi), kendiliğinden açılma kaldırılınca ve bölüm kapanması
  kaldırılınca ilgili iddialar düştü.

  ⚠ **İKİ TEST HATAMI MUTASYON YAKALADI, ikisi de yazıldı:**
  1. Grupları bir döngüde açıyordum; her tıklama bölümü yeniden
     çizdiği için sonraki ögeler **belgede değildi**. Test "ekranda
     10, listede 19" dedi — uygulama değil, test yanılıyordu.
  2. "Bölüm kendiliğinden açılıyor" iddiası **yanlış sebeple**
     geçiyordu: bölüm zaten ekleme akışından açık kalıyordu. Artık
     iddia önce "kapandı mı"yı kanıtlıyor.
  Ayrıca ölçüm dayanıklı hale getirildi: bölüm hiç açılmazsa test
  çökmek yerine **sebebi söyleyen** bir iddiayla düşüyor.

  ⛔ **ÜÇÜNCÜ TUR — SATIRIN KENDİSİ.** Kullanıcı aynı şeyi üçüncü kez
  bildirdi (17 Kasım 2026, iki ekran görüntüsünü yan yana koyarak):

  > *"Burası kullanıcının kafasını karıştırıyor. İkinci ekran
  > görüntüsünde seçim alanı TEMİZ; aynı şekilde birincisi de olsun,
  > kullanıcı her iki tarafta da AYNI şeyi görür. Sadece artık seçim
  > yaptıktan sonraki alanda bunlar + / − ile kapalı olarak gelir,
  > o kadar."*

  **Haklıydı ve eksik yapmıştım:** ilk iki turda yalnızca
  **gruplamayı** aynı yapmıştım, **satırın kendisini** değil.
  Ölçülen fark:

  | | Öneri (temiz) | Çekim listesi (kart) |
  |---|---|---|
  | Çerçeve | yok | 1 px |
  | Zemin | yok | `var(--bg)` |
  | Dolgu | `4px 0` | `9px 10px` |
  | Alt boşluk | 0 | 7 px |
  | Yazı | 13 px | 13,5 px |
  | **Yükseklik** | **26 px** | **41,5 px** |

  Kart kabuğu kaldırıldı; ölçüm sonrası **26'ya karşı 27 piksel**.

  ⚠ **"+ not" metnin ALTINDAN YANINA alındı.** Altta dururken satır
  41,5 kalıyordu; asıl yükseklik farkı oydu. Not yine bir dokunuş
  uzakta: basılınca kutu **altta, tam genişlikte** açılıyor (ölçüldü).

  ⚠ **Parmak hedefi KÜÇÜLMEDİ.** Kutu 26 → 18 piksel ama tıklanabilir
  alan görünmez bir katmanla 40 pikselde tutuldu. *"Küçük bir kutuya
  nişan almak sahada zor"* dersi kodda zaten yazılıydı; görünüş uğruna
  çöpe atılmadı. Test kutunun 14 px uzağının hâlâ tıklanabildiğini
  ölçüyor.

  ⚠ **Kapsam `#cl_liste` ile sınırlı.** `.cl-satir` ve `.cl-kutu`
  **Çekim Setleri** sayfasında da kullanılıyor (`#ihs_liste`); sınıfı
  global değiştirmek kullanıcının görmediği bir ekranı da değiştirirdi.

  Bekçi **20 iddiaya** çıktı: iki ekranın çerçevesi, zemini, dolgusu,
  satır aralığı, yazı boyu ve yüksekliği **karşılaştırılarak** ölçülüyor
  — "benzettim" demek yetmiyor. **Mutasyonla kanıtlandı:** kart
  görünümü geri konunca iki iddia düştü (yükseklik 39'a karşı 26).

  ---

  ⛔ **DÖRDÜNCÜ TUR — İKİ AYRI KUSUR (17 Kasım 2026).**

  **A. Ayrı "Tikli setleri ekle" düğmesi kaldırıldı.** Kullanıcı:

  > *"Bu tuş burada gereksiz bir hal alıyor. Burada zaten kullanıcı bir
  > proje içerisinde ve projede bu alan haricinde de yaptığı her şeyi
  > ilk ekranda en altta yer alan PROJE OLUŞTUR tuşu ile kayıt
  > edecek."*

  Haklı. Seçim artık projenin **kendi Kaydet / + Proje oluştur**
  tuşuyla kaydediliyor (`projeyiKaydet` içinde). "Şimdi değil" de
  kalktı: tik koymazsanız zaten bir şey eklenmiyor.
  ⚠ Bölüm **kapalıysa** dokunulmuyor — kullanıcının görmediği bir şeyi
  kaydetmek olurdu.
  Ölçüldü: tikten çıkarılan araçla birlikte 17 yerine **16** madde
  kaydedildi, çıkarılan araç listede yok.

  **B. Hazır setler şeridindeki `+` çalışmıyordu — aslında çalışıyordu,
  ama görünmez bir iş yapıyordu.** Kullanıcı: *"hazır setleri hiçbir
  şekilde ekleyemiyorum, yanlarındaki + işareti çalışmıyor."*

  ÖLÇÜLDÜ: `+` seti **"kendi setlerim"e kopyalıyordu** (`+` sonrası
  kendi set sayısı 0→1, çekim listesi 0'da kaldı). Geri bildirimi
  yazdığı öge `ih_topluNot` — **İhtiyaç kütüphanesi penceresinde**, ve
  çekim listesi açıkken o pencere kapalı. Yani sıfır geri bildirim.
  ⛔ Üstelik `id="ih_not"` diye bir öge depoda **hiç yok**; `ihNot`
  çağrılarının bir kısmı zaten hiçbir yere yazmıyordu.

  Çekim listesinin içinde `+` doğal olarak **"bu listeye ekle"**
  demek — öyle oldu. **"Setlerime kopyala" kaybolmadı**: `▾` ile
  açılan önizleme panelinde **adıyla** duruyor, yani ne yaptığı belli.

  Bekçiler: `set-onerisi` **43 iddia** (ayrı ekleme düğmesi yok +
  seçim kaydedilince uygulanıyor), `liste-duzeni` **22 iddia**
  (`+` listeye ekliyor, kendi setlerime dokunmuyor, kopyalama düğmesi
  adıyla duruyor ve çalışıyor). **Mutasyonla kanıtlandı.**

  ⚠ **Üç test hatamı daha ölçüm yakaladı, üçü de yazıldı:**
  1. Kaydet projeyi kaydedip **sayfayı kapatıyor** (normal davranış);
     testler düğmeye bastıktan sonra sayfada kalmayı bekliyordu.
     Projeye geri girilerek ölçülüyor — kullanıcının akışı da bu.
  2. Geri girince bölüm **kapalı gruplarla** açılıyor; ölçüm satır
     arıyordu ve bulamıyordu. Önce bir grup açılıyor.
  3. `elementFromPoint` yalnızca **ekrandaki** noktaları görüyor; tik
     kutusu `y=1147`'deydi, pencere 900 yüksekliğinde. "Parmak hedefi
     küçüldü" diyen ölçü **uygulama değil kendisi** yanılıyordu.
     Kutu önce görüntüye getiriliyor.

  **C. Çekim listesindeki tikin anlamı değişti — BİTTİ.**
  Kullanıcı kararı (17 Kasım 2026):

  > *"Hepsi TİKLİ gelsin, tikten çıkarmak maddeyi LİSTEDEN çıkarsın."*

  Şikâyet şuydu: *"kullanıcı burada listede yer alan araçları
  işaretlerse bu sefer onları silmiş oluyor. Bu büyük bir
  karışıklık!"* — iki ayrı silme yolu (tik + `×`) ve iki ayrı tik
  anlamı (öneride "ekle", listede "bitti") aynı ekranda duruyordu.

  Artık tek anlam var: **tik = "bu madde listede"**. Kalkanlar:
  satır sonundaki `×`, "İşaretleri temizle" düğmesi, `bitti/toplam`
  sayacı (hem bölüm sayacı, hem grup başlığı, hem proje satırındaki
  çip artık sadece madde sayısı yazıyor: `17 madde`).
  ⚠ `bitti` alanı **kayıtta duruyor**, yalnızca arayüzden kalktı —
  sahadaki "topladım" işaretlemesi geri gelecekse tek satır.

  Ölçüldü (proje sayfası, 17 maddelik liste): sayaç `17 madde`,
  tiksiz satır **0**, `×` düğmesi **0**, "İşaretleri temizle" **yok**;
  bir tik kaldırılınca madde 17→**16**, ekrandan gitti, listede yok.

  Bekçiler, üçü de **mutasyonla kanıtlandı**:
  `cekim-listesi` (tik → anında tarayıcıya yazılan çıkarma · hepsi
  tikli · ikinci silme yolu yok · çip madde sayısı),
  `liste-duzeni` **22 iddia** (tikten çıkarmak satırı düşürüyor, grup
  sayacı tazeleniyor, grup **açık** kalıyor),
  `hazir-setler` (setten gelen maddelerin hepsi tikli).
  Mutasyonlar: (1) tik çıkarmasın → 3 + 1 iddia düştü, (2) kutular
  tiksiz çizilsin → üç testin üçü de düştü, (3) `×` geri gelsin →
  "ikinci silme yolu yok" düştü.

  ⛔ **ÖLÇÜM YERİNE ÖNCE ÇÖKME GELDİ — SEBEBİ YAZILDI.**
  B'nin ilk hali sayfayı hiç açtırmadı: `missing ) after argument
  list`. Sebep, satır şablonunun **içine** yazdığım HTML yorumunda
  **ters tırnak** kullanmam — şablon dizesi (`` ` ``) orada bitiyor.
  Yorum artık düz tırnakla yazılı ve kuralı kendi içinde söylüyor.
  Ders: `app.html`'de şablon dizesinin içindeki yoruma ters tırnak
  yazılmaz.

  ⚠ **İKİNCİ TUZAK: "koşu bitti" bildirimi koşunun bitişi değildi.**
  `nohup bash hizli.sh &` kabuğu **hemen** dönüyor; arka plan görevi
  "exit 0" diye haber verdi, oysa testler henüz başlamıştı.
  `ciktilar/*.kod` dosyaları da bir önceki koşudan **kalmıştı** —
  "217 test, hiç hata yok" diye okunuyordu. Dosya saatlerine bakmak
  yakaladı. Bundan sonra: koşu bitişi `.kod` dosyalarının **saatiyle**
  doğrulanacak, bildirimle değil.

  ⛔ **TAM KOŞU İKİ TEST DÜŞÜRDÜ — ikisi de GERÇEK bulgu çıktı.**

  1. **`cekim-listesi` düştü: elle eklenen madde görünmüyordu.**
     Gruplar kapalı başladığı için, yeni eklenen madde **yeni bir
     gruba** düşünce ekranda hiç görünmüyordu — kullanıcı "eklenmedi"
     sanardı. Düzeltildi: `listeMaddeEkle` eklediği maddenin grubunu
     **açıyor**. Bu bir test uyarlaması değil, **kusur düzeltmesi**.

  2. **`hazir-setler` düştü: "Çanta" / "Yap" ayrımı kayboluyordu.**
     O ayrım gerekçesiyle yazılmıştı: *"götürülecek şey ile yapılacak
     iş ayrı başlıklarda; ikisi karışırsa çantayı toplarken 'oda sesi
     kaydet' maddesinin yanında durur."* Set başlığına geçerken onu
     sessizce kaybetmek yanlış olurdu. **İki düzey kuruldu:** üst
     başlık **setin adı**, içinde **Çanta / Yap alt başlıkları**.
     Test iki düzeyi birden ölçecek şekilde yeniden yönlendirildi ve
     **güçlendi**: artık set başlığının da dille değiştiğini ölçüyor.

  ⚠ **Açılma durumu niyete göre:** bölüm **kendiliğinden** açıldıysa
  (projeye giriş) gruplar **kapalı** — kullanıcının istediği özet.
  Kullanıcı "Çekim listesi"ne **bilerek** bastıysa hepsi **açık** —
  sahada her grubu tek tek açtırmak angarya olurdu, eski davranış da
  buydu.

  ⚠ Grup anahtarını üreten mantık **tek yere** toplandı
  (`listeGrupAnahtari`): çizim, açma ve yeni madde ekleme üçü de ona
  bakıyor. Üç ayrı yerde yazılsaydı biri değişince ötekiler sessizce
  ayrışırdı — bu deponun tekrarlayan hatası.

  **Önerilen üç küçük düzeltme — kullanıcı onayı bekliyor:**
  1. Alanlarda **Enter kaydetsin** ("Ekle" ile aynı).
  2. Pencereye tek cümle: *"Bir platformda **iki** hesabın olduğunda,
     kayıt açarken hangisine gideceğini sorarız."*
  3. Ad alanının zorunlu olduğu basmadan önce belli olsun.
  ⚠ Bu senaryoyu kapsayan test yok; yazılacak.

- ⬜ **51.** **MEKÂNLARA TÜR ALANI + çekim türüne göre süzme.**
  Kullanıcı 16 Kasım 2026'da ekran görüntüsüyle sordu: *"Masabaşı
  çekimde neden altta mekanlar çıkıyor? Çekim türüne göre gelmesi
  gerekmiyor mu bu mekanların?"* — sonra eşlemenin tamamını verdi.

  **Bugünkü durum doğrulandı — yarısı zaten türe bağlı, yarısı değil:**

  | Alan | Türe bağlı mı | Nerede |
  |---|---|---|
  | **Adres kutusu** | ✅ evet | `adresAlaniniTazele` (`app.html:13787`) |
  | **Mekân seçicisi** | ⛔ **hayır** | Her türde açık — "Masabaşı / grafik" projesinde de bütün mekânlar listeleniyor |

  ⛔ **ASIL ENGEL: MEKÂN KAYDINDA TÜR ALANI YOK.** `mekanTemizle`
  (`app.html:14090`) şu alanları tutuyor: ad, şehir, ilçe, adres,
  izin, dikkat, notlar, haritalar/drive/görsel bağlantısı, koordinat,
  ülke, saat dilimi, kaynak. **Kategori/tür yok.** Yani "sadece
  stüdyo adresleri gelsin" demek **yeni bir alan** demek.

  **Kullanıcının verdiği eşleme (16 Kasım 2026):**

  | Proje türü | Hangi mekânlar gelecek |
  |---|---|
  | Dış çekim | hepsi (ya da "dış mekân" türündekiler) |
  | Mekan çekimi | hepsi (ya da "mekân" türündekiler) |
  | **Stüdyo** | **yalnızca "stüdyo" türündekiler** — *"kullanıcı bir yerde mekanlar arasına stüdyo adresi girebilir; stüdyo seçerse sadece stüdyo adresleri gelir"* |
  | Vlog | ⚠ **SORULACAK** — cevaplanmadı |
  | **Ürün inceleme** | **hiçbiri** — *"mekanların gelmesine gerek yok"* |
  | **Masabaşı / grafik** | **hiçbiri** — *"mekanlara gerek yok"* |
  | **Diğer** | **yalnızca "diğer" türündekiler** — *"diğer diye bir yer eklerse kullanıcı, o zaman gelmesi lazım"* |

  **Bunun gerektirdikleri (sırası gelince adım adım yazılacak):**
  1. `mekanTemizle`'ye **tür alanı** + geçerli değer listesi.
     ⚠ Beyaz listede olmayan alan **sessizce düşüyor** — bu deponun
     yazılı dersi (koordinat alanları aynı tuzağa düşmüştü).
  2. ⛔ **Supabase'de yeni sütun** gerekiyor: `mekanRowYap`
     (`app.html:14122`) sütunları tek tek yazıyor. Yani **kullanıcının
     çalıştıracağı bir SQL dosyası** olacak.
     ⚠ Depoda bunun kalıbı var: `mekanFotoSutunu` ve
     `mekanKonumSutunlari` bayrakları, sütun yoksa **false'a düşüp**
     kaydı bütünüyle engellememek için. Yeni alan da aynı kalıbı
     izleyecek — SQL çalıştırılmadan uygulama bozulmayacak.
  3. Mekân ekleme/düzenleme ekranında tür seçici (iki dilde, Bölüm 7).
  4. Var olan mekânların türü **boş** kalacak; boş tür "hepsinde
     görünür" mü sayılacak yoksa "hiçbirinde" mi — ⚠ **sorulacak.**
     (Boş = görünmez seçilirse kullanıcının bugünkü mekânları
     projelerde **birden kaybolur**; bu yüzden varsayılan "görünür"
     olmalı gibi duruyor.)
  5. Proje türü değişince seçili mekânların bağına ne olacak —
     ⚠ **sorulacak** (silinecek mi, sessizce duracak mı).

  ⚠ Mekân seçiliyken adres kutusunun gizlenme kuralı **bozulmayacak**;
  o yazılı bir karar (iki adres kutusu "hangisi geçerli" sorusunu
  doğuruyordu).
  ⚠ Bekçi test: her proje türü için **hangi mekânların listelendiğini**
  ölçen bir test — eşleme tablosu koda gömülü kalmasın.

- ⬜ **49.** ⛔ **SET YÖNETİMİ: İÇİ GÖRÜNMÜYOR, MADDE ÇIKARILAMIYOR.**
  Kullanıcı 16 Kasım 2026'da 7. maddeyi denedi ve iki eksik buldu:

  > *"Tıkladığım setler geldi ama içlerini daha önce herhangi bir
  > yerde göremediğim için hangisini hangi çekime ekleyeceğimi
  > bilemiyorum. Ayrıca buraya ekledim ama buradan geri de
  > çıkaramıyorum — yani + var ama − yok."*

  **İkisi de doğrulandı:**

  | Eksik | Bugünkü durum |
  |---|---|
  | Setin içi görünmüyor | Çip yalnızca **ad + sayı** gösteriyor (`.hset-cip`). İçindeki maddeleri görmenin hiçbir yolu yok — set ancak **eklendikten sonra** ne olduğu anlaşılıyor |
  | Madde çıkarılamıyor | Setten **tek madde silme yok**. Tek yol `setiSil` ile **setin tamamını** silmek |

  ⚠ **İkinci eksik 7. maddeyle BEN getirdim:** "+" eklendi, karşılığı
  olan "−" eklenmedi. Ekleme kolaylaştı, geri alma aynı kaldı
  (seti baştan yaratmak). Asimetri.

  Yapılacak: setin içi **eklemeden önce** görünsün (çipe basınca
  açılan önizleme ya da satır), ve her maddenin yanında **çıkarma**
  olsun. ⚠ Hazır setler kodun içinde metin ve herkeste aynı —
  onlardan madde çıkarmak **kendi kopyanı** yaratmak demek
  (7. madde bu yolu zaten kurdu).
  ⚠ Bölüm 7: metinler iki dilde. Bekçi test: eklenen madde **geri
  çıkarılabiliyor mu** ölçülecek.

  ⚠ **17 Kasım 2026 — BU MADDENİN BİR YARISI 10. MADDEDE YAPILDI.**
  Set önerisi bölümünde setin içi `▾` ile açılıyor, her maddenin kendi
  tiki var ve tikten çıkarılan madde eklenmiyor. Kullanıcı aynı şeyi
  oradan bir daha istedi. **Bu madde yine açık:** kullanıcının *kendi*
  setlerinden madde çıkarma ve Çekim listesi ekranındaki set yönetimi
  hâlâ yapılmadı.

- ✅ **50.** ⛔ **PROJE DÜZENLEME POP-UP DEĞİL SAYFA OLSUN.** — **BİTTİ (16 Kasım 2026).**
  Kullanıcı 16 Kasım 2026'da ekran görüntüsüyle bildirdi:
  *"Bu ekran pop-up gibi bir ekranda açıldığı için burada yönetmek de
  zor. Herhangi bir projeyi tıklayıp açtığımızda pop-up da değil tıpkı
  bir sayfa gibi açılması lazım!"*

  **Doğrulandı:** `app.html:4596` — proje düzenleme bir
  `overlay` + `modal` çifti (`projectEditOverlay`). Ve çekim listesi
  **bu pencerenin içinden** yine bir pop-up olarak açılıyor
  (`cekimListesiOverlay`) — yani **pop-up içinde pop-up.**
  Ekran görüntüsünde pencere; ad, tür, tarih, mekân arama, saha
  detayları, iptal kutusu, fikirler, scriptler, çekim listesi ve adım
  termin tarihleri — **hepsi tek bir dar kutuya** sığdırılmış.

  ⛔ **GERİ DÖNÜŞ YOK — kullanıcı 16 Kasım'da ikinci kez bildirdi:**
  *"Bu pop-up içerisinde çekim listesine tıkladığımda yeni pop-up
  çıkıyor, sonra geri dönmek istersem dönemiyorum."*

  **Akış koddan çıkarıldı:**

  | Adım | Ne oluyor | Nerede |
  |---|---|---|
  | 1 | *Projeyi düzenle* penceresi açık | `projectEditOverlay` |
  | 2 | "Çekim listesi" satırına basılıyor | `pe_liste` (`app.html:15759`) |
  | 3 | Form **önce kaydediliyor** ve düzenleme penceresi kapanıyor | `projeyiKaydet()` |
  | 4 | Çekim listesi **ayrı bir pencere** olarak açılıyor | `cekimListesiAc` |
  | 5 | Kapatınca `renderProjects()` çalışıyor → **proje tablosu** | `cekimListesiKapat` (`app.html:10814`) |

  ✅ İyi yanı: 3. adımda form kaydedildiği için **veri kaybı yok.**
  ⛔ Kötü yanı: 5. adımda "projeye geri dön" diye bir şey **yok**.
  Kullanıcı tabloya düşüyor ve projeyi listeden yeniden bulup açmak
  zorunda kalıyor. İki pencere bir **yığın** oluşturmuyor.

  Bu tam olarak **gerçek sayfa + tarayıcı geri tuşunun** çözdüğü şey.

  ⚠ Depoda toplam **22 ayrı overlay** var; hepsi değişmeyecek.
  Bu madde **proje düzenlemeyi** (ve içinden açılan çekim listesini)
  kendi sayfasına taşıyor. Sırası gelince kullanıcıya sorulacak:
  1. Geri dönüş nasıl olacak — tarayıcının geri tuşu çalışsın mı,
     yani adres değişsin mi.
  2. Çekim listesi o sayfanın **içinde bir bölüm** mü olacak, yoksa
     ayrı bir sayfa mı.
  3. Telefonda düzen ne olacak.
  ⚠ Bu madde **47 (üst menü birliği)** ve **48 (dil sürekliliği)** ile
  aynı aileden: üçü de "sayfa" kavramına dokunuyor. Sırası gelince
  birlikte planlanacak.

  ---

  ✅ **YAPILDI — beş parça, hepsi ölçüldü (16 Kasım 2026).**
  Kullanıcı kapsamı iki kez genişletti: önce scriptler
  (*"scriptler sayfasında da durum aynı pop up çıkıyor"*), sonra
  takvim girişi (*"takvim de yeni giriş ya da girilmiş olan herhangi
  bir girişi düzenlemenin de bu şekilde pop up yerine arkadaki takvim
  görüntüsünün gitmesi... çünkü bu pop up çok küçük yine"*).

  | Parça | Ne oldu |
  |---|---|
  | 1 | Proje düzenleme sayfa oldu; liste gizleniyor, adres `#/proje/<id>` |
  | 2 | Çekim listesi **ayrı pencere değil**, proje sayfasının içinde bölüm — kapatınca projede kalınıyor |
  | 3 | Scriptler sayfa oldu, adres `#/script/<id>` |
  | 4 | Takvim girişi sayfa oldu, adres `#/kayit/<id>` |
  | 5 | "Kaydet" şeridi yapışkan; sayfa kipinde kutu genişliği düzleşti |

  **Yukarıdaki üç soru uygulamayla cevaplandı:**
  1. Geri dönüş **tarayıcının geri tuşuyla** — adres değişiyor.
     Sekme değiştirme `replaceState` (geçmişi kirletmiyor), kayıt
     açma `pushState`.
  2. Çekim listesi proje sayfasının **içinde bölüm**.
  3. Telefonda da aynı sayfa düzeni; yapışkan "Kaydet" şeridi
     özellikle telefon için.

  ⛔ **Cerrahi yöntem — bir daha aynısını yap.** Ögenin `id`'si ve
  `open` sınıfı KORUNDU, yalnızca `overlay` sınıfı düştü. Böylece
  23 test dosyasındaki ~40 iddia yerinde kaldı, ve gövde kilidini
  kuran üç `.overlay.open` sorgusu bu üç ögeyi artık bulmuyor —
  sayfanın arkasında donduracak bir şey olmadığı için doğrusu bu.

  **Yol boyunca düzeltilen beş test** (hiçbiri gevşetilmedi):
  `bugun-sayfa`, `giris-donus`, `dokunmatik`, `sc-yerlesim`,
  `mobil-kayma`. Son ikisinde ölçüler **açılır pencere tasarımını**
  ölçüyordu; arkalarındaki gerçek güvenceye yeniden yönlendirildi ve
  `mobil-kayma`'ya sayfa kipinin kendi şartı **eklendi** (çıkışta
  takvim bıraktığı yere dönüyor — bunu hiçbir test ölçmüyordu).

  ⚠ **Yapışkan şeritte öğrenilen CSS kuralı.** Şerit `position:sticky`
  alıyordu ama hiç tutunmuyordu. Sebep: `.modal.sc-modal`
  `overflow:hidden` yazıyor ve **bir eksen gizliyken öbür eksenin
  `visible`'ı tarayıcı tarafından zorla `auto`ya çevriliyor.** Kutu
  kendi kaydırma kabı kalınca yapışkan şerit pencereye değil kutunun
  hiç kaymayan iç alanına tutunmaya çalışıyordu. İki ekseni birlikte
  açmak gerekti.

  Tam koşu: **214 test, hepsi geçti.** `main` → `8e450e6`.
- ✅ **48. BİTTİ (18 Kasım 2026).** ⛔ **DİL SÜREKLİLİĞİ — SİTENİN
  TAMAMINDA TEK DAVRANIŞ.**

  Sayfalar `/tr/` ve `/en/` ağacında üretiliyor; düz adresler
  yönlendiriciye dönüştü (`uret/yonlendirici.js`), sıralama
  `?lang=` → hafıza → tarayıcı dili → varsayılan. Sayfanın kendi
  dili `window.SAYFA_DILI` ile `<head>`'e çivileniyor, hafıza
  adresin dilini **ezmiyor**.

  ⚠ Yol boyunca iki gerçek gerileme yakalandı: dil açılır listesi
  çizilmiş ama **bağlanmamıştı** (seçmek sayfayı değiştirmiyordu),
  ve Almanca tarayıcı **Türkçe** sayfaya düşüyordu (`YABANCI='en'`
  eklendi, x-default ona bağlandı).

  Bekçi: `testler/uretilen-sayfalar.test.js` (**95 iddia**) +
  `dil-varsayilan.test.js`.

  ⬇ Maddenin özgün hâli kayıt için duruyor:
  ⚠ **41. maddeden (altı dil) ÖNCE bitmek zorunda.** Kullanıcı
  16 Kasım 2026'da söyledi: *"Kullanıcı sitenin herhangi bir yerinde
  hangi dili seçiyorsa o dil ile açılmalı tüm sayfalar. Daha sonra
  dil değişimi yaparsa seçtiği dil ile devamlılık olmalı. Bu nedenle
  senin tüm bu dil karmaşasını diğer diller sisteme girmeden çözmen
  lazım."*

  **BULUNAN HATA — doğrulandı, canlıda:** İngilizce ana sayfanın en
  altındaki *"Put your next shoot on the board…"* bölümünde
  **"user guide"** düğmesine basınca **Türkçe kılavuz** açılıyor.
  Sebebi kesin: `index.html:1305` dil değişince kılavuz bağlantılarını
  düzeltiyor ama seçicisi yalnızca `#dipKilavuz` ve `.ust-nav`
  içindekileri kapsıyor. **Satır 1082'deki son bölüm düğmesi
  (`son_cta2`) hiçbirine girmiyor** ve `kilavuz.html` olarak kalıyor.
  ⚠ Tek satırlık düzeltmesi var, ama aşağıdaki asıl sorun
  çözülmeden yapılırsa **dördüncü bir yama** olur.

  **ASIL SORUN: aynı işi yapan ÜÇ AYRI MEKANİZMA var.**

  | Sayfa | Dili nasıl taşıyor | Sorunu |
  |---|---|---|
  | `index.html` | `localStorage['demo_ui_language']` + her bağlantıyı **tek tek yeniden yazma** (`:1305`) | Seçici eksik kalınca bağlantı yanlış dile gider — **şu an öyle** |
  | `fiyatlar.html` | Adresteki `?lang=tr` | Bağlantıyı kuran taraf eklemeyi unutursa tarayıcı diline düşer |
  | `kilavuz.html` / `guide.html` | **Ayrı dosya**, aralarında düz bağlantı | Dil seçici yok; "English" diye tek bir bağlantı var |
  | `app.html` | `LANG` + bulutta `prefs.lang` | Tek düzgün olan bu |

  ⛔ **Altı dil gelince bu üç mekanizma sekiz dille çarpılır.**
  `kilavuz.html`/`guide.html` kalıbı sekiz ayrı dosya demek ve
  aralarındaki bağlantı sayısı 8×7'ye çıkar. Bugün **iki** dille bile
  bir bağlantı kaçmış durumda.

  **Yapılacak:** tek bir dil kaynağı ve tek bir bağlantı kuralı.
  ⚠ Tasarımı sırası gelince kullanıcıya sunulacak; en az şu üçü
  kararlaştırılacak:
  1. Dil hafızası nerede duracak (bugün `localStorage` +
     `prefs.lang`, ikisi 13 Kasım'da zaten bir kez ayrışmıştı).
  2. Sayfalar arası nasıl taşınacak (adres mi, hafıza mı, ikisi mi) —
     ⚠ arama motoru için her dilin **kendi adresi** olmalı.
  3. Kılavuz sekiz ayrı dosya mı kalacak, yoksa tek dosya + sözlük mü.

  ⚠ **Bekçi test şart** (Bölüm 7'deki kalıp): depodaki her yayın
  sayfasında, her dilde, **dil değiştirip** bütün iç bağlantıların
  o dile gittiğini ölçen bir test. Listeyi elle yazmayan, sayfaları
  kendi bulan cinsten — yoksa dördüncü bağlantı yine kaçar.
- ⬜ **44.** **Fiyatlar sayfası — EUR, bölgeye göre para birimi, eşit
  kutu, özet satırı.** Kullanıcı 16 Kasım 2026'da istedi.

  ✅ **ÖNCE İYİ HABER — panel → sayfa zinciri ZATEN KURULU.**
  Kullanıcı *"admin panelinden gireceğim fiyat fiyatlar sayfasında
  görünecek şekilde design edeceksin"* dedi; koddan doğrulandı,
  bugün zaten öyle çalışıyor:

  | Halka | Nerede |
  |---|---|
  | Panel fiyatı yazıyor | `yonetim.html:376-448` → `plan_prices.amount_minor` |
  | Her değişiklik geçmişe düşüyor | `sql/69:255` trigger → `price_history` |
  | Tablo herkese **açık okunur** | `sql/69:390` `for select using (true)` |
  | Sayfa tablodan okuyup çiziyor | `fiyatlar.html:490` `plan_prices` → `fiyatBul()` |

  Yani ekrandaki "320 TL" şu an bile panelden geliyor. **Yeniden
  kurulacak bir şey yok**; aşağıdakiler onun üstüne ekleniyor.

  **Yapılacaklar:**

  1. ⛔ **EUR — SQL gerekiyor, ENGEL BURADA.** `sql/69:129` şöyle
     yazıyor: `check (currency in ('USD','TRY'))`. Yani **EUR bugün
     veritabanına GİRMİYOR**, panel de yazamaz. Yeni bir SQL dosyası
     kısıtı güncelleyecek ve EUR satırlarını açacak.
     ⚠ SQL'i **kullanıcı çalıştırır**, adım adım yazılacak
     (Bölüm 1). ⚠ `sql/69` yeniden koşturulursa kısıt geri gelir —
     yeni dosyanın başına bu uyarı yazılacak (Bölüm 6).
  2. ✅ **BİTTİ (18 Kasım 2026) — EUR AÇILDI.**
     ⚠ **KARAR DEĞİŞTİ, sessizce üzerine yazılmadı.** Bu madde
     önce *"rakamlar çevrilmeyecek, TRY ve EUR ayrı rakamlar"*
     diyordu. Kullanıcı 18 Kasım 2026'da şunu söyledi:

     > *"Fiyatlar sayfası için USD ne kadar ise EURO o kadar olsun.
     > Admin panelinde hangi fiyatı kullanabileceğimiz ve ne kadar
     > olacağını arka planda ben yazabileyim."*

     Yani **EUR = USD rakamı** (kur hesabı yok), **TRY ayrı kalıyor**.

     | Ne | Nerede |
     |---|---|
     | Kısıt genişletildi, EUR satırları USD'den kopyalandı | `sql/73-euro.sql` ⚠ **kullanıcı çalıştırır** |
     | Para birimi listesi artık **veriden** | `kaynak/fiyatlar.html` → `paraBirimleri()` |
     | EUR'nun kendi simgesi (€) | aynı dosya → `paraYaz()` |
     | Panelde `active` kapatılırsa düğme de kaybolur | aynı dosya |

     ⛔ Düğmeler eskiden **elle** yazılıydı (TRY, USD); üçüncüsü de
     elle yazılsaydı yarın dördüncüsü yine yazılacaktı. Artık kodda
     para birimi listesi **yok**.

     Bekçi: `testler/fiyat-para-birimi.test.js`, **9 iddia**, üç
     mutasyonla kanıtlandı.

     ⬜ Panelde para biriminin **açık/kapalı** anahtarı ayrı bir
     madde oldu: **60.** Kullanıcı 18 Kasım 2026'da *"ok yapılacaklar
     ekle sonra yaparız"* dedi.

     ✅ **SQL ÇALIŞTIRILDI VE DOĞRULANDI (18 Kasım 2026).**
     Kullanıcı *"ok sql tamam"* dedi; veritabanından okunarak
     doğrulandı (Bölüm 4 — "muhtemelen olmuştur" denmedi):
     18 satır, üç para birimi. **EUR karşılığı olmayan USD satırı
     yok, USD'den farklı EUR satırı yok.**

     | plan · dönem | TRY | USD | EUR |
     |---|---|---|---|
     | creator_pro · monthly | 32.000 | 900 | 900 |
     | creator_pro · yearly | 300.000 | 8.400 | 8.400 |
     | founding · once | 245.000 | 6.900 | 6.900 |
     | starter · monthly | 0 | 0 | 0 |
     | studio · monthly | 105.000 | 2.900 | 2.900 |
     | studio · yearly | 1.020.000 | 28.800 | 28.800 |
  3. ⏸ **Para birimi ÜLKEYE göre — KARAR VERİLDİ, CLOUDFLARE'E
     BAĞLANDI (18 Kasım 2026).** Bu madde önce "bölgeye göre
     varsayılan para birimi" diyordu; kullanıcı istediği şeyi
     **büyüttü**. Kendi sözleriyle:

     > *"ama unutma yapılacaklar da kişinin girdiği ülkeye göre para
     > birimi çıkması lazım. Çünkü buradaki fiyatların tamamı
     > birbirinden farklı"*
     >
     > *"kullanıcı hangi ülkeden giriyorsa sadece o fiyatları görmeli
     > — hatta burada farklı para birimi tuşları çıkmamalı. Yani
     > kullanıcı para birimini kendi değiştirememeli"*

     Yani iş artık "doğru para birimiyle **aç**" değil, "yalnızca o
     para birimi **olsun**": düğmeler kalkacak, seçim elden alınacak.
     Gerekçesi kullanıcının kendi gerekçesi ve doğrulanmış: aylık
     creator_pro TRY'de 320 TL, USD'de 9 dolar, EUR'da 9 euro —
     bunlar birbirinin çevirisi değil (tablo yukarıda, 44.2).

     **KARAR: Cloudflare taşımasını bekleyip BİR KEREDE yapılacak.**
     Kullanıcı üç seçenek arasından bunu seçti. Yani fiyat sayfasının
     para birimi seçicisine **o güne kadar dokunulmayacak**; bugün
     TRY/USD/EUR düğmeleri görünmeye devam ediyor ve bu bir eksik
     değil, **verilmiş bir karar**. ⛔ Bir sonraki oturumda "düğmeler
     hâlâ duruyor" diye hata olarak bildirme.

     **NEDEN BUGÜN YAPILAMIYOR — iki ayrı sebep, ikisi de ölçüldü:**

     | İstenen | Bugünkü durum |
     |---|---|
     | Düğme çıkmasın, tek para birimi görünsün | Yapılabilirdi |
     | Doğru ülkenin fiyatı açılsın | Ancak **tahminle** (saat dilimi) |
     | Kullanıcı diğerlerini **göremesin** | ⛔ **Yapılamaz** |

     1. Site GitHub Pages'te **durağan**. Ziyaretçi sayfayı açtığında
        bizim hiçbir kodumuz koşmuyor; dosyalar olduğu gibi veriliyor.
        Ülkeyi ancak **tarayıcının içinde** tahmin edebiliriz (saat
        dilimi ya da `navigator.language` bölge eki) — ve tarayıcıda
        olan her şeyi ziyaretçi değiştirebilir. Yani bu bir
        **varsayılan** olurdu, **kilit** olmazdı.
     2. ⛔ **Daha önemlisi: fiyat tablosu HERKESE AÇIK OKUNUR.**
        `sql/69:390` → `create policy plan_prices_oku ... using (true)`.
        18 satırın **tamamı** şu an bile tarayıcıya geliyor; sayfa
        sadece bir kısmını çiziyor. **Düğmeyi kaldırmak fiyatları
        ekrandan kaldırır, VERİDEN kaldırmaz.** Bu yüzden "kilitledim"
        denmeyecek — denirse yanlış söylenmiş olur (Bölüm 4).

     **CLOUDFLARE'DEN SONRA NE DEĞİŞİYOR:** sayfa sunulurken kendi
     kodumuz koşabiliyor ve Cloudflare ziyaretçinin ülkesini kendisi
     söylüyor — dışarıya ek istek gitmiyor, ziyaretçinin adresi başka
     bir şirkete verilmiyor (üçüncü taraf servis seçeneği bu yüzden
     elendi; gizlilik/şartlar sayfalarına her dilde ekleme de
     gerekmiyor). O zaman ülke tarayıcı ayarıyla değiştirilemez hale
     geliyor.
     ⚠ **Ama kilit tek başına bununla tamamlanmıyor:** fiyat verisinin
     de filtreli gelmesi gerekiyor, yoksa (2) numaralı sebep yerinde
     kalır. Sırası geldiğinde çözülecek iki parça: (a) ülkeyi kenarda
     okumak, (b) sayfaya yalnızca o ülkenin satırlarını göndermek.
     ⛔ Bunun bugünkü Supabase altyapısıyla mümkün olup olmadığı
     **ARAŞTIRILMADI** — kullanıcı araştırma seçeneğini seçmedi.
     Sırası gelince araştırılacak, **uydurulmayacak.**

     ⚠ **BİR KEZ SÖYLENDİ, KARAR KULLANICININ:** düğme hiç olmazsa
     yurt dışındaki bir Türk ya da Türkiye'deki bir yabancı yanlış
     para birimini görür ve düzeltemez. Kullanıcı bunu bilerek seçti.

     ⛔ **BUNA DAHİL: TÜRKÇE SAYFADA DOLAR ÇIKIYOR — BUGÜN CANLIDA
     VAR, ÖLÇÜLDÜ (18 Kasım 2026).** Ayrı ve tek satırlık bir
     yanlışlık; "şimdi mi düzeltelim, Cloudflare'e mi kalsın" diye
     soruldu.

     ✅ **KULLANICI KARAR VERDİ (18 Kasım 2026): CLOUDFLARE'E KALSIN.**
     Kendi sözleriyle: *"cloudflare e kalsın"* · *"buna dahil et"*.
     Yani bu **ayrı bir açık madde değil**, 44.3'ün parçası ve
     Cloudflare işi yapılırken birlikte çözülecek.

     ⛔ **BİR DAHA SORMA, AYRI OLARAK DÜZELTME.** Bir sonraki
     oturumda "Türkçe sayfada dolar çıkıyor" diye **hata olarak
     bildirme** ve "tek satır, hemen düzeltelim" diye **teklif
     etme** — karar verilmiş durumda.

     | Satır | Ne yapıyor |
     |---|---|
     | `kaynak/fiyatlar.html:396` | `const trMi = /^tr\b/i.test(navigator.language)` |
     | `kaynak/fiyatlar.html:413` | `dil` → **`window.SAYFA_DILI` önce** ✅ düzeltilmiş |
     | `kaynak/fiyatlar.html:414` | `let para = trMi ? 'TRY' : 'USD'` ⛔ **düzeltilmemiş** |

     Yani **dil** sayfanın kendi dilinden geliyor ama **para birimi**
     hâlâ tarayıcı dilinden. Sonuç: tarayıcısı Türkçe olmayan biri
     **Türkçe sayfada dolar fiyatı** görüyor.
     Ölçüldü: `/tr/fiyatlar/` açıldı, seçili para birimi **USD** çıktı
     (tarayıcı dili `en-US`). Yani sayfa "299 TL" demesi gerekirken
     "$9" diyor.

     **CLOUDFLARE İŞİ YAPILIRKEN BU DA ÇÖZÜLECEK — ne yapılacağı:**
     `para` artık tarayıcı diline bakmayacak. Cloudflare ülkeyi
     söylediğinde para birimi **ülkeden** gelecek; ülke bilinmiyorsa
     düşülecek değer tarayıcı dili değil **sayfanın kendi dili**
     olacak (`dil === 'tr' ? 'TRY' : 'USD'`) — yani Türkçe sayfa hiçbir
     koşulda dolar göstermeyecek.
     ⚠ 44.3'ün bekçi testi bunu da ölçecek: **Türkçe sayfada seçili
     para birimi TRY**, tarayıcı dili ne olursa olsun. Bugünkü arıza
     tam bu iddiayla yakalanırdı ve yoktu.

  **📏 44.5/44.6/44.7 İÇİN ÖLÇÜLEN SAYILAR (18 Kasım 2026).**
  Tasarıma başlamadan önce ölçüldü, uydurulmadı:

  | Genişlik | Starter | Creator Pro | Fark |
  |---|---|---|---|
  | 1280 (masaüstü) | 499,2 px | 575,2 px | **76,0 px** |
  | 900 (tablet) | 477,7 px | 577,7 px | **100,0 px** |
  | 390 (telefon) | 500,8 px | 600,8 px | **100,0 px** |

  ⛔ **44.7'DEKİ "İNDİRİM SIFIR ÇIKAR" NOTU ARTIK GEÇERSİZ.**
  Kullanıcı panelden fiyatları değiştirmiş; veriden okunan bugünkü
  rakamlar (görünen planlar: `starter`, `creator_pro`):

  | Para | Aylık | Yıllık | Yıllık ÷ 12 | İndirim |
  |---|---|---|---|---|
  | TRY | 299 | 2.999 | 249,92 | **%16** |
  | USD | 9 | 98 | 8,17 | **%9** |
  | EUR | 9 | 89 | 7,42 | **%18** |

  Sayfa bugün `#indirim`'de *"Yıllık ödemede %9 kadar daha ucuz."*
  yazıyor — USD seçili olduğu için. Yani rozetin gösterecek **gerçek
  bir sayısı var** ve sayı para birimine göre değişiyor; tasarım
  rakamı sabit yazmayacak.
  4. ✅ **Aylık/Yıllık KALIYOR** (kullanıcı 16 Kasım'da onayladı).
     Yalnızca **TRY/USD çifti** kalkacak: para birimi artık otomatik.
  5. ✅ **BİTTİ (18 Kasım 2026) — kutular aynı ölçüde.**
     Ölçüldü, sebep tek satırdı:

     | Genişlik | Önce | Sonra |
     |---|---|---|
     | 1280 | 499,2 / 575,2 px (**76 px fark**) | 575,2 / 575,2 |
     | 900 | 477,7 / 577,7 px (**100 px**) | 577,7 / 577,7 |
     | 900 (İngilizce) | **124 px fark** | eşit |

     Kök sebep: `.kartlar{align-items:start}` ızgaranın kartları
     **germesini** engelliyordu. ⚠ `.kart ul{flex:1}` zaten düğmeyi
     kartın dibine itmek için yazılmıştı — yani kart gerilmek üzere
     tasarlanmış, ızgara izin vermiyormuş. Satır kalktı; düğmeler
     artık iki kartta da dipten **29 px**.

     ⚠ Telefonda (390px) ızgara **tek sütuna** iniyor; orada alt alta
     duran kartların boyu farklı olabilir ve bu normal.

     Bekçi: `testler/fiyat-kart-olcu.test.js`, **13 iddia**. Test
     satırları **kendisi buluyor** (aynı üst kenar = aynı satır),
     plan listesi ya da genişlik eşiği yazmıyor — yarın üçüncü plan
     görünür olursa kendiliğinden girer (Bölüm 7'nin bekçi kuralı).
     ⛔ Yuvarlamıyor: alt piksel ölçülüyor, eşik 0,5 px.
  6. ❌ **KAPANDI — YAPILMAYACAK (18 Kasım 2026, kullanıcı kararı).**

     Soruldu: *"kısa özet" kartlardaki madde listesinden farklı bir
     şey mi, yoksa madde zaten karşılanmış mı?*
     Kullanıcı: *"kısa özete gerek yok karşılaştırma listesi
     öncesindeydi bu"*

     Yani bu madde **karşılaştırma listesi (28. madde) ortaya
     çıkmadan önce** yazılmış; o liste ve kartlardaki madde listesi
     (Starter 4, Creator Pro 6 madde) işi zaten görüyor.

     ⛔ **BİR DAHA AÇMA.** Gelecek bir oturum "fiyata dahil olanların
     özeti eksik" diye **bildirmesin** ve kartlara fazladan bir özet
     satırı **eklemesin** — var olanın üstüne konulacak bir özet
     sayfayı kalabalıklaştırır ve kullanıcı bunu istemedi.

     ✅ Maddenin ikinci yarısı (*"o satır eklenirken kutu ölçüsü de
     düzeltilecek"*) **44.5'te bitti**, bu kararı beklemedi.
  7. ✅ **BİTTİ (18 Kasım 2026) — yıllık indirim oranı üç yerde,
     tasarlanmış bir öğe olarak.**

     | Nerede | Ne yazıyor | Ne zaman |
     |---|---|---|
     | Başlıktaki cümlenin içinde | `Yıllık ödemede [%16] kadar daha ucuz.` | indirim varsa |
     | Kartta, yıllık fiyatın yanında | `%16 İNDİRİM` / `16% OFF` | **yalnızca yıllık seçiliyken** |

     ⛔ **ÜÇÜNCÜ YER KALDIRILDI (aynı gün, kullanıcı geri aldı).**
     16 Kasım'da *"aynı oran Yıllık düğmesinin yanında da yazacak"*
     denmişti; yapıldı, kullanıcı gördü ve bildirdi:

     > *"üst bölümde aylık yıllık seçimlerinde üst bölümde yıllık
     > yanında %16 indirim yazıyor ama o sürekli orada zaten o
     > bölümde altta duran 'Yıllık ödemede %16 kadar daha ucuz.'
     > mevcut"*

     Haklı: hap sürekli oradaydı ve hemen altındaki cümle aynı şeyi
     söylüyordu. Kaldırıldı.
     ⛔ **GERİ EKLENMEYECEK** — kullanıcı söylemedikçe. Bekçi iddia:
     *"oran dönem seçicinin yanında TEKRAR ETMİYOR"*.

     ⛔ **KUTU ARTIK AYLIK/YILLIK ARASINDA ESNEMİYOR.** Kullanıcı iki
     ekran görüntüsüyle bildirdi: *"ss2'de indirim satırı gelince
     yıllık plana kutular hafif bir esniyor."* Ölçüldü:

     | | Aylık | Yıllık | Esneme |
     |---|---|---|---|
     | `.fiyat-alt` | 20 px | 25,6 px | +5,6 |
     | Kart (1280) | 575,2 | 580,8 | **5,6 px** |
     | Kart (900) | 577,7 | 583,3 | **5,6 px** |

     ⚠ **Çözüm sabit piksel DEĞİL:** rozetin kendisi aylıkta da
     yerinde duruyor, yalnızca `visibility:hidden`. Böylece ayrılan
     yer rozetin kendi stilinden geliyor — yarın puntosu ya da
     dolgusu değişirse yer kendiliğinden uyar. Elle yazılmış bir
     `25.6px` olsaydı o gün sessizce yanlış olurdu.
     ⚠ `display:none` olmaz: yer kaplamaz, esneme geri gelirdi.
     ⚠ Yalnızca indirim VARSA yer ayrılıyor; yoksa boş yer de yok.
     Ölçüldü: esneme üç genişlikte de **0,0 px**.

     **Tasarım — üçü de aynı aile:** lime hap (`--jel-lime` #C8F24B)
     üstünde koyu yazı, IBM Plex Mono, büyük harf, harf aralığı.
     ⚠ Renk keyfi değil: `marka.css` bu renk için *"üstüne KOYU
     yazı: 14.06"* diyor — yani **zemin** rengi. Ölçüldü, kontrast
     **14,06** (WCAG AA eşiği 4,5).
     ⚠ Turuncu ÖNERİLEN rozetinden **kasten ayrı renk**: biri
     tavsiye, öteki para. Aynı renk olsalar tek sinyal gibi okunurdu.
     Ölçüler bağlama göre: düğme yanı 12,5px · cümle içi 13px ·
     kart içi 11px.

     **Başlıktaki cümle büyüdü:** 14px → **17px**, rengi lime'dan
     kreme döndü (lime artık hapta). Kullanıcının *"çok küçük"*
     şikâyeti buydu.

     ⚠ **Hangi oran nerede:** başlık ve düğme **görünen planların
     EN KÜÇÜK** oranını yazıyor (*"...kadar"* = en fazla bu kadar),
     böylece hiçbir plan için abartılmış olmuyor. **Kart kendi
     oranını** yazıyor, çünkü o kartta duran rakam o planın kendi
     rakamı. Bugün tek planın yıllık fiyatı olduğu için ikisi aynı
     çıkıyor. ⚠ Kullanıcı *"aynı oran"* demişti; ikisi ayrışırsa
     doğru olan karttaki olduğu için böyle kuruldu — **itiraz
     ederse değişir.**

     ⛔ **İNDİRİM YOKSA HİÇBİR YERDE ROZET YOK.** "%0 indirim"
     yazmak gürültü, hatta yanıltıcı olurdu.

     Bekçi: `testler/fiyat-indirim-rozeti.test.js`, **16 iddia**.
     Altı mutasyonla kanıtlandı: oran sabit yazılınca 6 iddia düşer,
     kart rozeti dönem gözetmeyince 2, indirim 0'ken rozet çıkınca 2,
     İngilizce sözlüğe girmeyince 1, **yer tutucu kaldırılınca 2**
     (esneme geri gelir), **dönem seçicinin yanına hap konulunca 2**.
     ⛔ **DÖRDÜNCÜ MUTASYON ÖNCE YAKALANMADI** — iddia yanlış nedenle
     yeşildi: iki dilin dizelerini karşılaştırıyordu, oysa `yuzde`
     biçimi zaten farklı (`%30` ve `30%`), yani İngilizce hiç
     çevrilmese bile dizeler eşit çıkmıyordu. Artık sayı ve `%`
     atılıp **sözcük** karşılaştırılıyor. Mutasyon olmasa bu boş
     bekçi fark edilmeyecekti.

  7b. ⬜ **ESKİ MADDE (kayıt için).** Kullanıcı 16 Kasım 2026'da
     ekran görüntüsüyle istedi: kartta yıllık fiyatın yazdığı yere
     *"%35 indirim"* gibi **tasarlanmış, dikkat çekici** bir öğe
     gelecek (kendi fontu ve görseli), **ve aynı oran "Yıllık"
     düğmesinin yanında da yazacak.**

     ✅ **Hesap ZATEN VAR, sabit yazılmıyor:** `fiyatlar.html:439-447`
     her planın `yearly ÷ 12` değerini `monthly` ile karşılaştırıyor
     ve **görünen planlar arasındaki EN KÜÇÜK** indirimi yazıyor
     (hiçbir plan için abartılmasın diye). Bugün bu oran yalnızca
     başlıktaki tek cümlede görünüyor (`#indirim`), kartta değil.
     Yani iş **hesap yazmak değil, o sayıyı doğru yerlere taşıyıp
     tasarlamak**.

     ⛔ **DİKKAT — BUGÜNKÜ RAKAMLARLA İNDİRİM SIFIR.** Kullanıcının
     gönderdiği ekranda Creator Pro **250 TL/ay** ve **yıllık 3.000 TL**:
     250 × 12 = 3.000, yani **hiç indirim yok**. Rozet otomatik
     hesaplandığı için bugün **%0** çıkar ve görünmez. Oranın
     görünmesi için yıllık fiyatın panelden daha düşük girilmesi
     gerekiyor — rakamı **kullanıcı** verecek (Bölüm 4).
     ⚠ Tasarım, indirim **sıfır ya da yokken** rozetin ne olacağını da
     çözecek: gizlenecek mi, yoksa başka bir şey mi yazacak.
     ✅ Kullanıcı 16 Kasım'da söyledi: **"önemli değil, placeholder
     olsun; düzenlemeyi yapınca ona göre çalışır."** Yani %0 çıkması
     işi durdurmuyor, tasarım rakamdan bağımsız kurulacak.

     ⚠ **BAŞLIKTAKİ CÜMLE DE BÜYÜYECEK.** Kullanıcı 16 Kasım'da ekran
     görüntüsüyle işaretledi: başlıktaki *"Yıllık ödemede %22 kadar
     daha ucuz."* satırı (`fiyatlar.html` → `#indirim`) **çok küçük**.
     Bugün `.hint` benzeri küçük punto ile çiziliyor; para kazandıran
     cümlenin düğmelerden sonra kaybolmaması gerekiyor. Karttaki rozet
     ve "Yıllık" düğmesinin yanındaki oranla **aynı tasarım ailesinden**
     olacak — üçü birden tek seferde çözülecek.
  8. ⚠ **Bölüm 7 gereği her dilde**: `fiyatlar.html` kendi sözlüğünü
     taşıyor (42 anahtar), 41. madde ile altı dile çıkacak.

- ✅ **45.** **Ana sayfa kahraman bölümü: geniş ekranda ortada büyük
  turuncu boşluk.** — **BİTTİ (17 Kasım 2026).** Kullanıcı 16 Kasım 2026'da yüksek çözünürlüklü
  geniş ekranda gördü: yazılar sola dayanmış, yazı bloğu ile
  fotoğraftaki kişi arasında kocaman boş turuncu alan kalıyor.
  İstenen: **yazılar kahramana daha yakın** dursun.
  ⚠ Çözüm dar ekranı bozmamalı; `index.html`'de kahraman düzeni
  birkaç kırılma noktasına bakıyor. Ölçerek yapılacak (9. maddede
  olduğu gibi: önce ölç, sonra iddia yaz).

  ---

  ✅ **ÖNCE ÖLÇÜLDÜ.** Yazının bitişi ile fotoğraftaki telefonun
  başlangıcı arasındaki aralık:

  | Ekran | Önce | Sonra |
  |---|---|---|
  | 1280 | −105 px | −105 px |
  | 1920 | −54 px | −136 px |
  | **2560** | **+381 px (%14,9)** | −136 px |
  | **3440** | **+979 px (%28,5)** | −136 px |

  **Kök sebep:** yazı sol kenara `clamp(24px,6vw,96px)` ile
  **çivilenmişti**, fotoğraf ise sağa yaslı ve `min(100%,1800px)`'de
  duruyor. Ekran 1800'ü geçince fotoğraf sağa kaçıyor, yazı yerinde
  kalıyor ve araları sınırsız açılıyor.

  **Çözüm — iki değişken.** `--foto-sol: max(0px, calc(100% - 1800px))`
  ve `--foto-gen: min(100%,1800px)`. Yazının sol boşluğu *ve* turuncu
  katmanın kırılma noktaları artık **fotoğrafın sol kenarına** göre
  hesaplanıyor. Sütun genişliği de `min(32vw,576px)` — 576, fotoğraf
  genişliğinin %32'si. Böylece kompozisyon **ölçekten bağımsız**:
  1920'den yukarısında aralık sabit −136 px.

  ⛔ **Turuncu katman da taşınmak ZORUNDAYDI.** Kırılma noktaları ekran
  yüzdesi olarak kalsaydı, sağa kayan yazı turuncunun dışına düşerdi;
  CSS yorumunda yazılı tuzak bu (*"kontrast 2,26'ya iniyordu"*).

  ⛔ **MEVCUT KONTRAST TESTİ BU GENİŞLİKLERİ ÖLÇMÜYORDU** — yalnızca
  **1280 pikselde** koşuyor (`kontrast.test.js:54`). Yani değiştirdiğim
  aralığın hiç bekçisi yoktu.

  **Yeni bekçi:** `testler/kahraman-genis.test.js`, **11 iddia**,
  1280 / 1920 / 2560 / 3440'ta.
  ⛔ Zemin **hesaplanmıyor, ÖLÇÜLÜYOR**: sayfanın ekran görüntüsü
  tuvale çizilip **piksel okunuyor**, sonra yazı rengiyle arasındaki
  **kontrast oranı** WCAG formülüyle hesaplanıyor. CSS'ten hesaplamak
  CSS'i ikinci kez yazmak olurdu — kendi kendini doğrulayan test
  hiçbir şey kanıtlamaz.
  ⚠ Tek dikey nokta yetmiyor (fotoğrafın rengi dikeyde değişiyor):
  yazı bloğu boyunca **beş nokta**, her birinde yazının sağ ucu.

  **Üç mutasyonla kanıtlandı:**
  1. Yazı yine sol kenara çivilendi → aralık `2560→+624`, `3440→+1504`
     oldu, üç iddia düştü.
  2. Turuncu katman yine ekran yüzdesi yapıldı → **yakalanmadı**, ve
     bu **doğru**: o noktalarda fotoğrafın kendisi zaten turuncu, yani
     o değişiklik görünen zemini bozmuyor. Katman daha dar kadrajlar
     için sigorta olarak duruyor.
  3. Yazı sütunu `min(60vw,1200px)` yapılıp mor sütunun üstüne taşındı
     → dört genişlikte de düştü, ölçülen oranlar **1,0 · 1,67 · 2,26**
     — CSS yorumundaki sayıyla birebir aynı.

  ⛔ **İKİNCİ TUR — AŞIRI DÜZELTMİŞİM (17 Kasım 2026).** Yazıyı
  fotoğrafa bağlayınca bu sefer **solda** kocaman boş turuncu kaldı.
  Kullanıcı ekran görüntüsüyle bildirdi: *"yazılar tıpkı yeşil alanda
  olduğu gibi o hizalamada olmalı."*

  **Doğru ölçü:** yazı, sayfanın **standart sütununda** başlasın —
  ortalanmış 1180 piksellik kap + 32 iç boşluk. Yeşil bölüm, fiyat
  bölümü ve diğer bölümler zaten orada.

  | Ekran | Standart sütun | Yazı (sonra) | Turuncu biter |
  |---|---|---|---|
  | 1280 | 82 | 82–492 | 549 |
  | 1600 | 242 | 242–754 | 799 |
  | 1920 | 402 | 402–978 | 1023 |
  | 2560 | 722 | 722–1298 | 1536 |
  | 3440 | 1162 | 1162–1738 | 2416 |

  Turuncu katman da **gerektiği yerde uzadı** (`max()` ile iki şartın
  büyüğü): hem fotoğrafın kendi turuncusuyla hizalı kalıyor hem de
  yazının tamamını örtüyor. 1600–1920 arasında ikincisi belirleyici.

  ⛔ **ÖLÇÜMÜMDE İKİ HATA BULDUM, ikisi de yazıldı:**
  1. Telefonun yerini fotoğraf genişliğinin %29,8'i diye
     **hesaplıyordum**. `object-fit:cover` yatayda da kırpıyor, yani o
     oranın ekranda karşılığı yok. Piksel ölçümü gerçeği gösterdi:
     fotoğrafın turuncusu her genişlikte **%43,2'de** bitiyor.
  2. İlk piksel taraması **yazının koyu harflerine** çarpıp duruyordu,
     yani turuncunun bittiği yeri değil yazının başladığı yeri
     ölçüyordu. Yazı gizlenerek yeniden ölçüldü.

  ⚠ Testteki iki eski iddia (*"aralık büyümüyor"*, *"boşluk
  açılmıyor"*) **kaldırıldı**: yanlış modele dayanıyorlardı ve
  kullanıcının yeni kararıyla çelişiyorlardı (ortalanmış sütun geniş
  ekranda zaten boşluk bırakır). Güvence kaybolmadı, yer değiştirdi:
  yazı **standart sütunda başlıyor** ve **turuncunun içinde**
  bitiyor — ikisi de ölçülüyor, ikincisi 24 piksel kenar payıyla.

- ✅ **45b.** **Üst menüdeki "Ücretsiz başla" düğmesi dil tuşlarıyla
  aynı boyda** (kullanıcı isteği, 17 Kasım 2026): *"sanki alt tarafta
  bulunan koyu bandın dışına çıkıyor gibi... bir miktar küçülebilir ve
  yanında yer alan dil tuşları büyüklüğüne gelebilir."*

  ⚠ **ÖLÇÜLDÜ — düğme bandın dışına TAŞMIYORDU.** Bandın altı 63,
  düğmenin altı 54,6: 8,4 piksel **içeride**. Ama dil tuşlarından
  iriydi (**47,2**'ye karşı **44**, yazı 14,5'e karşı 12) ve turuncusu
  hemen altındaki kahraman turuncusuyla aynı olduğu için göz ikisini
  birleştirip "taşmış" diye okuyor. Kullanıcının teşhisi değil ama
  çözümü doğruydu.

  `.dug-sm` ölçüleri `.dil-dug` ile eşitlendi: `min-height:44px`,
  dikey dolgu 9, köşe 9, yazı 13. Ölçüm sonrası ikisi de **üst 9,
  alt 53, yükseklik 44**.
  ⚠ Yatay dolgu 16'da bırakıldı (dil tuşunda 12): etiket "Ücretsiz
  başla", tek harflik TR/EN değil.
  ⚠ `dug-sm` yalnızca bu tek düğmede kullanılıyor — başka bir yer
  etkilenmedi.
  ⚠ 44 piksel **dokunma hedefi korundu**; test ayrıca onu da ölçüyor.

- ✅ **46. BİTTİ (17 Kasım 2026).** **Favicon aileleri ayrışmış.** Kullanıcı sekmelerde
  gördü: `fiyatlar.html` ile `index.html` farklı ikon gösteriyor.
  **Koddan doğrulandı, iki ayrı sebep var:**

  | Bulgu | Ayrıntı |
  |---|---|
  | `index.html` **tek başına** yalnızca `favicon.svg` yüklüyor | Öteki yedi sayfa `favicon.svg` + `favicon.ico` yüklüyor |
  | `favicon.svg` **13 Kasım** tarihli | `favicon.ico`, `favicon-32x32.png`, `favicon-16x16.png`, `apple-touch-icon.png` hepsi **16 Kasım** — yani SVG, ailenin geri kalanından **üç gün eski** |

  ⚠ Bu deponun tekrarlayan hatası: ikon ailesi daha önce de ayrışmıştı
  (13 Kasım kaydı). Düzeltilince **bekçi test** yazılacak: her yayın
  sayfası aynı ikon kümesini yüklesin ve dosyalar aynı kaynaktan
  üretilmiş olsun.

  ---

  ✅ **BİTTİ (17 Kasım 2026). ⛔ MADDENİN KENDİSİ EKSİK YAZILMIŞTI.**
  Madde *"`index.html` tek başına, öteki yedi sayfa svg+ico"* diyordu.
  Ölçüldü: **15 sayfa, YEDİ farklı kalıp** —

  | Kalıp | Sayfalar |
  |---|---|
  | Hiç ikon yok | `aktar` · `tiktok` · `youtube` |
  | Yalnızca svg | `index` · `yonetim` |
  | svg + ico | `fiyatlar` · `guide` · `kilavuz` · `paylas` · `privacy` · `sartlar` |
  | svg + 32 | `deneme` |
  | svg + 32 + apple | `index-eski` |
  | **svg yok**, ico+32+16+apple | `lokasyon` |
  | Tam küme (5) | `app` |

  **İkinci sebep de doğrulandı ve kök nedeni bulundu.** `7c7224b`
  (15 Kasım) commit'inin adı *"Logo ailesi tek kaynağa getirildi"*:
  ICO/PNG/apple/PWA ikonları **`logo-koyu.svg`'den yeniden üretilmiş**,
  ama `favicon.svg` 13 Kasım'da kalmış. Yani sekme ikonu **koyu
  gövdeli** (`logo.svg` sürümü), raster aile **açık gövdeli**
  (`logo-koyu.svg` sürümü) — iki ayrı çizim.

  **Yapılanlar:**

  - 14 Shootboard sayfası artık **aynı beş satırlık** ikon bloğunu
    taşıyor (`app.html`'inki kanonik alındı).
  - `favicon.svg` tek kaynaktan yeniden yazıldı: geometri
    `logo-koyu.svg` ile **birebir aynı**, renkler `prefers-color-scheme`
    ile gövdeyi izliyor — açık temada koyu gövde, koyu temada açık
    gövde. **Ölçüldü** (Chromium, beş dolgunun hepsi iki temada).
    Desteklemeyen tarayıcı `:root` varsayılanına düşer: eski davranış.
  - ⛔ **Yolda bir hata yaptım ve test onu yakalıyor:** `favicon.svg`'nin
    yorumuna **çift tire** yazdım; XML yorumunda yasak olduğu için
    dosya ayrıştırılamaz hâle geldi ve ikon **hiç çizilmezdi**.
    Ölçümle görüldü (`rectSayisi: 0`). Bekçi artık bunu da ölçüyor.

  **Bekçi:** `testler/ikon-ailesi.test.js`, **8 iddia**.
  ⛔ Sayfa listesi **tutmuyor** — kök dizindeki her `.html`'i kendi
  buluyor, yeni sayfa kendiliğinden kapsama giriyor (Bölüm 7 kuralı).
  Ölçtükleri: her Shootboard sayfası aynı kümeyi yüklüyor · dosyalar
  diskte var · `favicon.svg` geçerli XML · üç SVG **aynı geometri** ·
  iki tema birlikte taşınıyor.
  **Üç mutasyonla kanıtlandı:** bir sayfadan ikon silinince, geometri
  değişince ve yoruma çift tire konunca ilgili iddialar düştü.

  ⚠ **İKİ SORU KULLANICIDA — cevap gelene kadar dokunulmadı:**
  1. **`lokasyon.html`** içinde *"Shootboard"* **hiç geçmiyor**
     (kullanıcının kendi kanalına ait saha dosyası). Bugün Shootboard
     ICO/PNG'lerini taşıyor ama SVG'si yok. Shootboard ikonu mu alsın,
     kendi ikonu mu olsun, yoksa hiç mi? **Kapsam dışı bırakıldı.**
     ⚠ Ayrım kendi kendini denetliyor: sayfa bir gün Shootboard markalı
     olursa teste girer ve ikonsuzsa düşer.
  2. **`index-eski.html`** eski ana sayfa ve **hiçbir sayfa ona
     bağlanmıyor**. Dursun mu, silinsin mi? Şimdilik duruyor ve ikon
     kümesini aldı.

- ✅ **47. BİTTİ (18 Kasım 2026).** **Üst menü her sayfada aynı olsun.**

  Menü artık elle yazılmıyor: `uret/ust-menu.js` üretiyor ve her
  sayfaya aynısı giriyor. Kayma iki ayrı sebepten geliyordu ve
  ikisi de ölçüldü: `.ust-sag`'ın sol kenarı ana sayfada sabit,
  ötekilerde `auto` idi (**125 px**); çağrı düğmesinin ölçüsü ana
  sayfada 13px/44px, ötekilerde 14,5px/42px idi (**14 px**).
  İkisi de üretilen `<style>` bloğunda birleştirildi.

  Bekçi: `testler/ust-menu-birligi.test.js` (**8 iddia**) +
  `uretilen-sayfalar.test.js` içindeki kayma ölçüsü — ⛔ o ölçü
  18 Kasım'da **alt piksele** çevrildi (yuvarlama uçurumu), iki
  mutasyonla kanıtlandı: 119 px ve **1 px** hâlâ yakalanıyor.

  ⬇ Maddenin özgün hâli kayıt için duruyor:

  Kullanıcı
  16 Kasım 2026'da bildirdi: *"ana sayfadan kılavuz sayfasına geçince
  üst menüler neden farklı? Kılavuz sayfasına geçince Başla tuşu
  falan yok oluyor."* **Koddan doğrulandı — üç ayrı üst menü var:**

  | Sayfa | Menü | Sağ taraf |
  |---|---|---|
  | `index.html` | Nasıl çalışır · Neler var · Ne değildir · Fiyatlar · Kılavuz | **TR/EN düğmeleri** + **"Ücretsiz başla"** |
  | `fiyatlar.html` | Ana sayfa · Fiyatlar · Kılavuz | — |
  | `kilavuz.html` | Ana sayfa · Fiyatlar · Kılavuz | "English" **bağlantısı** + "Uygulamayı aç →" — **ne dil düğmesi ne CTA** |

  İstenen: hepsi **ana sayfadaki gibi** olsun.
  ⚠ Dikkat: `kilavuz.html`/`guide.html` dili **ayrı dosyayla**
  değiştiriyor (düğmeyle değil), `fiyatlar.html` ise `?lang` ile.
  Tek bir üst menüye geçerken bu üç davranış birleştirilecek.
  ⛔ **41. madde ile doğrudan bağlantılı:** altı yeni dil gelince
  dil seçimi sekiz dile çıkıyor; iki düğme (TR/EN) yetmeyecek,
  uygulamadaki gibi bir **açılır liste** gerekecek. Bu madde o
  karardan önce bitirilirse iki kez yapılır. ⚠ Sırası gelince
  kullanıcıya bu bağlantı hatırlatılacak.
  ⚠ Düzeltilince **bekçi test**: her yayın sayfasının üst menüsü
  aynı bağlantı kümesini ve CTA'yı taşısın (Bölüm 7).
- ✅ **43. BİTTİ (18 Kasım 2026).** **Mekânlar sayfasına fotoğraflı
  liste görünümü + görünüm değiştirme tuşu.**

  ✅ **AÇIK NOKTA KAPANDI:** aşağıdaki *"sırası gelince sorulacak"*
  sorusu soruldu. Kullanıcı: *"yoksa benzer yeni bir tuş oluştur."*
  Yani ekran görüntüsündeki iki-ikonlu çift bu depoda olmadığı için
  **yeni bir tuş** yapıldı — tahmin edilmedi, soruldu.

  | Ne | Nerede |
  |---|---|
  | İki ikonlu görünüm tuşu | `app.html` → `IKON_IZGARA` / `IKON_SATIR`, `.gorunum-sec` |
  | Telefonda dokunma hedefi 44px | `.gs-dug` |
  | Satır görünümü | `renderMekanlar` içinde `.mk-satir` dalı |
  | Seçim hatırlanıyor | `demo_mk_gorunum` (takvimdeki kalıbın aynısı) |
  | İki dilde etiket | `mk_view_cards` / `mk_view_list` (Bölüm 7) |

  ⚠ Yol boyunca üç ölçüm hatası çıktı ve üçü de **ölçülerek**
  bulundu: satırlar yan yana diziliyordu (ID özgüllüğü — `#mk_list`
  `.mk-liste`'yi yeniyordu), baş harfler 1280×800'ü dolduruyordu
  (`position:relative` eksikti), telefonda 31px taşma vardı.

  Bekçi: `testler/mekan-gorunum.test.js`, **12 iddia**.

  ⬇ Maddenin özgün hâli kayıt için duruyor:

  Kullanıcı 16 Kasım 2026'da istedi: *"places /
  mekanlar sayfasında yine fotoğraflı görünümlü liste görünümü
  eklenecek. Üst bölüme liste ve diğer görünüm türü için eklediğime
  benzer bir tuş ekle, görünümler arasında geçiş yapabilsin."*

  Bugün mekânlar yalnızca **kart ızgarası** olarak çiziliyor
  (`renderMekanlar`, `.mk-kart`, sabit `--mk-kart-h:362px`). İkinci
  bir görünüm yok.

  ⚠ **SIRASI GELİNCE SORULACAK — ad uydurulmayacak:** Kullanıcı
  "eklediğime benzer bir tuş" dedi ve iki ikonlu (liste / ızgara) bir
  ekran görüntüsü gönderdi. **O tuş bu depoda yok.** Depodaki tek
  benzer şey `app.html:4454` `.view-toggle` — takvim sayfasında, beş
  **yazılı** düğme (Month/Week/Day/Table/Sheet). `lokasyon.html:1014`
  `.cal-view-toggle` de üç yazılı düğme. İkisi de ekran
  görüntüsündeki iki-ikonlu çift değil. Hangisini kastettiği
  **sorulacak**, tahmin edilmeyecek.

  Yapılacaklar (sırası gelince planlanacak):
  - İkinci görünüm: her mekân **bir satır**, solda fotoğraf küçük
    resmi, yanında ad/adres/rozetler.
  - Üst bölümde görünüm değiştirme tuşu; seçim **hatırlansın**
    (takvimdeki görünüm `localStorage`'da saklanıyor, aynı kalıp).
  - ⚠ `mekan-kart-olcu.test.js` kart görünümünün sabit yüksekliğini
    ölçüyor; yeni görünüm o testi bozmamalı, kendi ölçüsü olmalı.
- ⬜ **42.** **Yerel biçim merkezi** — ⚠ kullanıcı 16 Kasım 2026'da
  ekletti: *"kullanıcı hangi dil ile kullanıyorsa o dilde olmalı.
  Yeni eklenecek dillere göre düzenlenmesi lazım."*

  ⛔ **BUGÜN CANLI BİR HATA VAR.** `lokasyon.html` ay adlarını **üç
  yerde** `'tr-TR'` diye SABİT yazıyor (satır **2218, 2319, 3085**)
  ama o sayfanın dil seçicisinde **tr, en, ru** var. Yani İngilizce
  ya da Rusça kullanan biri takvimde **Türkçe ay adı** görüyor
  ("Kas", "Ara"). Doğrulandı, uydurma değil.

  Aynı ailenin tamamı (koddan sayıldı, 16 Kasım 2026):

  | Kalıp | Kaç yer | Nerede |
  |---|---|---|
  | `currentLang === 'tr' ? 'tr-TR' : 'en-US'` (ve `en-GB` türevleri) | **19** | `app.html` 15, `paylas.html` 3, `fiyatlar.html` 1 |
  | `… ? 'tr' : 'en'` (sıralama, büyük/küçük harf) | **34** | `app.html` |
  | Sabit `'tr-TR'`, dil seçicisi varken | **3** | `lokasyon.html` 2218, 2319, 3085 |
  | **Toplam** | **56** | |

  Yapılacak: tek bir **dil → locale eşlemesi** (`tr`→`tr-TR`,
  `en`→`en-GB` ya da `en-US`, sonra `es`, `pt-BR`, `de`, `fr`, `it`,
  `ru`), 56 yeri ona bağla, testini yaz.

  ⚠ **İki işi birden yapıyor:** (a) bugünkü lokasyon hatasını
  kapatıyor, (b) **41. maddenin ön koşulu.** Bu düzelmeden dil
  eklenirse yeni diller **hata vermeden** Amerikan tarih biçimi ve
  İngilizce sıralamasıyla kalır — sessiz bozulma.

  ⛔ Sıralamada 41'den ÖNCE olmak zorunda, ama 41'i beklemiyor:
  lokasyon hatası bugün canlı.
- ⬜ **1.** Instagram 5 hashtag sınırı (AI 8-15 üretiyor), YouTube
  60 karakter üstü, Reels kapağı. Bugün `f_hashtags` yalnızca
  **karakter** sınırı taşıyor (400), **adet** sınırı yok.

- ⬜ **56.** **Fikirler sayfası: kart yüksekliği sabitlensin + Türkçe
  "hepsini ayır" düğmesi kısalsın.** Kullanıcı 18 Kasım 2026'da iki
  ekran görüntüsüyle istedi:

  > *"Burada fikir içeriği uzadıkça alan da aşağı doğru kayıyor,
  > buranın sabit bir ölçüde olması lazım — maks yüksekliği 2.
  > gönderdiğim ss'de yer alan kadar yap. Ayrıca burada Türkçe ve
  > İngilizce değişimlerde altta yer alan '3 parçanın hepsini ayır',
  > İngilizce 'split all 3'e göre daha uzun olduğu için bu da alanda
  > aşağı atmasına neden oluyor. Bunu Türkçe daha kısa ve anlamlı
  > olacak hale çevir."*

  **a · Kart yüksekliği.** Koddan doğrulandı: `app.html:1865`
  `.fk-card-body` `flex:1` ile yazılmış ve **hiçbir `max-height`
  yok** — kart metin kadar uzuyor. Birinci ekran görüntüsünde
  Süleymaniye kartı komşularının birkaç katı yükseklikte ve satırı
  aşağı itiyor.
  ⚠ **Piksel değeri UYDURULMAYACAK.** "2. ss'deki kadar" denen
  yükseklik, iş sırası gelince uygulamadan **ölçülecek**; ekran
  görüntüsü kırpılmış, oradan piksel okunmaz (Bölüm 4).

  ⚠ **SIRASI GELİNCE SORULACAK:** metin sığmayınca ne olacak?
  Üç seçenek var ve üçü farklı iş: (1) kartın içinde kaydırma,
  (2) "…" ile kırpıp tıklayınca açma, (3) kırpıp altına "devamı"
  bağlantısı. Kullanıcı seçecek, tahmin edilmeyecek.

  **b · Türkçe düğme metni.** Sözlük anahtarı `fk_split`:
  `app.html:7117` İngilizce `Split all ${n}`, `app.html:8466` Türkçe
  `${n} parçanın hepsini ayır`. Türkçesi gözle görülür biçimde uzun;
  ikinci ekran görüntüsünde düğme satıra sığmıyor ve `SCRIPT`
  düğmesini **alt satıra atıyor** — kartı uzatan ikinci sebep bu.
  ⚠ **Yeni metin uydurulmayacak, kullanıcı seçecek.** Hazır öneriler
  (kullanıcıya sunulacak): "Hepsini ayır" · "3'ü de ayır" ·
  "Üçünü ayır". Sayının metinde kalıp kalmayacağı da kararın parçası.

  ⛔ **Bölüm 7 — HER DİLDE.** `fk_split` bir arayüz dizesi; metin
  değişirse **her dilin sözlüğünde** değişir. Bekçi hazır:
  `testler/sozluk-paritesi.test.js` eksik/fazla anahtarı ve
  **tür/arite uyuşmazlığını** yakalıyor — yani `(n)=>` arite'si
  bozulursa düşer.
  ⚠ Düzeltilince **bekçi test**: kartın yüksekliği üst sınırı
  aşmasın ve düğme satırı **sarmasın**; ölçü iki dilde birden
  yapılsın (uzun olan dil bugün Türkçe, yarın başka bir dil olabilir
  — bu yüzden dil listesi teste elle yazılmayacak).

- ⬜ **57.** **Dil seçicide bayrak.** Kullanıcı 18 Kasım 2026'da istedi:

  > *"Eğer diller için açılır menü ekliyorsan dil isminin yanına
  > bayrak da ekle!"*

  **Yapıldı** (aynı gün): `uret/diller.js` her dile bir `bayrak`
  alanı taşıyor, `uret/ust-menu.js` seçenek metnine yazıyor —
  🇹🇷 Türkçe · 🇬🇧 English. Yeni dil eklemek yine **tek satır**.

  ⚠ **AÇIK KALAN İKİ ŞEY, İKİSİ DE KULLANICIYA SORULACAK:**

  1. **Windows'ta bayrak emojisi bayrak olarak görünmüyor.** Windows
     bayrak emojilerini çizmiyor; onların yerine iki harf gösteriyor
     (Türkçe için "TR" gibi). ⛔ **Bunu buradan doğrulayamam** —
     Linux'ta koşuyorum. Kullanıcı kendi bilgisayarında bakıp
     söyleyecek. Bayrak gerçekten görünmüyorsa seçenekler:
     (a) olduğu gibi bırak (iki harf de bilgi veriyor),
     (b) `<select>` yerine resim koyabilen özel bir açılır liste yaz
     — daha büyük iş, klavye ve ekran okuyucu desteği elde yazılır.
  2. **Bayrak bir dilin değil bir ÜLKENİN işareti.** 41. maddede
     altı dil gelecek; İspanyolca, Arapça, Rusça gibi diller tek bir
     ülkeye ait değil. Hangi dile hangi bayrağın konacağı
     **sorulacak, tahmin edilmeyecek.** Bugünkü iki dil için
     🇹🇷 ve 🇬🇧 seçildi; 🇬🇧 yerine 🇺🇸 isteniyorsa tek satır.

  Bekçi: `testler/ust-menu-birligi.test.js` — her dilin seçenekte
  adıyla bulunduğunu ölçüyor; bayrak alanı eklenince metin
  "🇹🇷 Türkçe" oldu ve iddia kendiliğinden kapsadı.

- ⬜ **58.** ⛔ **UYGULAMA İÇİNDE "AYARLAR" SAYFASI + dil tuşunun
  uygulamaya yakışır hâle gelmesi.** Kullanıcı 18 Kasım 2026'da
  istedi:

  > *"App içerisinde de dil tuşu var, bu tuşu da app'e uygun şekilde
  > düzeltmemiz lazım. Daha önce sana yazdığım gibi bazı başlıkları
  > app içerisinde settings gibi bir sayfaya alıp her şeyi tıpkı
  > projects'te olduğu gibi sayfa gibi oluşturup kullanıcının
  > ayarlarını yapmasını isteyebiliriz. AI, hesap etiketleri, konum,
  > dil vs."*

  **a · Dil tuşu.** `app.html:4342` bugün yerli bir `<select>`
  (`#langSelect`, `.rail-lang`) — yan menünün içinde duruyor.
  ⚠ **Sitede bu iş 18 Kasım'da zaten yapıldı:** yerli `<select>`
  bırakıldı, yerine bayraklı özel seçici geldi
  (`uret/ust-menu.js`, `uret/bayraklar.js`, `marka.css` `.dil-*`).
  Kullanıcı site için *"çok amatör duruyor"* demişti. Uygulamadaki
  tuş **aynı akıbete uğrayacak** ama uygulamanın kendi paletiyle
  (`--accent`, `--line`, `--surface-2` …), sitenin paletiyle değil.
  ⚠ **Bayraklar hazır:** `uret/bayraklar.js` SVG olarak tutuyor;
  uygulamaya kopyalanmayacak, **ortak bir yerden** okunacak — yoksa
  bu deponun tekrarlayan hatası (bir yerde yapıp ötekinde unutmak)
  yine olur.

  **b · Ayarlar sayfası.** Bugün yan menünün dibinde **dağınık**
  duruyorlar; koddan sayıldı (`app.html:4428-4470`):

  | Öge | Bugün nerede |
  |---|---|
  | Dil seçici | `#langSelect`, yan menü üstü |
  | ✨ AI (Gemini) | `#aiSettingsBtn` → pencere |
  | 🔔 Hatırlatmalar | `#remindersBtn` → pencere |
  | Hesap etiketleri | `#hesapEtiketBtn` → pencere |
  | Hava & ışık | `#havaGosterBtn` (konum buradan geliyor) |
  | Tema (açık/koyu) | `#themeBtn` |
  | Bilgisayara kur | `#kurBtnMobil` |
  | Hesabım | `.rail-me` |

  İstenen: bunların **Projeler gibi bir SAYFA** olması
  (`SAYFALAR` dizisine `['ayarlar','ayarlarPage','tabAyarlar']`),
  pencere değil. 50. maddede proje düzenleme pop-up'tan sayfaya
  alınmıştı; aynı gerekçe: *"bu pop-up çok küçük"*.

  ⚠ **SIRASI GELİNCE SORULACAK, tahmin edilmeyecek:**
  1. Hangileri sayfaya taşınacak, hangileri yan menüde kalacak?
     (Tema tuşu tek tıkla çalışıyor; sayfaya girmek onu yavaşlatır.)
  2. Sayfa **bölümlü tek sayfa** mı olsun, yoksa sol tarafta kendi
     alt menüsü olan bir yapı mı?
  3. Yan menüde ayarlara giden **tek bir düğme** mi kalsın, yoksa
     kısayollar da dursun mu?
  4. "Konum" derken hava/ışık için kullanılan konum mu kastediliyor,
     yoksa ayrı bir ayar mı?

  ⛔ **Bölüm 7 — HER DİLDE.** Yeni sayfanın her başlığı, her etiketi
  iki dilde (yarın sekiz dilde) olacak. Bekçi hazır:
  `testler/sozluk-paritesi.test.js`.
  ⚠ Taşınan pencerelerin testleri var; hiçbiri **zayıflatılmayacak**,
  güvence korunup ifadesi sayfaya taşınacak (18 Kasım'da 11 testte
  aynısı yapıldı).

- ⬜ **59.** **"Fotoğrafı olmayanlara bak" — tuş çalışıyor ama ne
  yaptığını ANLATMIYOR.** Kullanıcı 18 Kasım 2026'da ekran
  görüntüsüyle sordu: *"O yazı ne anlama geliyor anlamadım. Ayrıca
  'fotoğrafı olmayanlara bak' tuşu çalışıyor mu? Ben tıkladım ama bir
  sonuç dönmedi."*

  ✅ **ÖNCE İYİ HABER: TUŞ ÇALIŞIYOR.** Kullanıcının durumu birebir
  yeniden üretildi ve ölçüldü: **54 mekân, fotoğrafı olmayan 1 tane**
  (Balıklı Meryem Ana). Tuş o bir mekâna bakmış, Vikipedi'de bir şey
  bulamamış ve bunu söylemiş. Kusur **işlevde değil, ANLATIMDA.**

  **Üç ayrı sorun, üçü de ölçüldü:**

  | # | Sorun | Neden kafa karıştırıyor |
  |---|---|---|
  | 1 | *"1 mekâna bakıldı"* | 54 mekânı olan biri "neden yalnızca 1?" diye düşünüyor. Sayı **fotoğrafı eksik olanların** sayısı ama cümle bunu söylemiyor. |
  | 2 | **Hangi mekâna** bakıldığı yazmıyor | Tarama sırasında ad görünüyor (`mk_photo_scan`) ama tek mekânda bir saniye bile sürmüyor. Bitince ad kayboluyor. |
  | 3 | *"Kartlarda harita duruyor"* | Fotoğraf bulunamayınca kartın haritaya düştüğünü **bilmeyen** biri için anlamsız. |

  **Dördüncü sorun — tarama sonrası iz kalmıyor:** hangi mekânın hâlâ
  fotoğrafsız olduğu listede görünmüyor. Kullanıcı 54 kartı tek tek
  gezmeden bulamıyor.

  ⚠ **METİN UYDURULMAYACAK, KULLANICIYA SORULACAK.** Sırası gelince
  şu seçenekler sunulacak (Bölüm 4: ürün metni uydurulmaz):
  - Cümlenin **mekânın adını** taşıması (*"Balıklı Meryem Ana için
    Vikipedi'de fotoğraf bulunamadı"*)
  - Sayının ne olduğunu açması (*"fotoğrafı eksik 1 mekâna bakıldı"*)
  - Harita cümlesinin kalıp kalmayacağı
  - Fotoğrafsız mekânların listede **işaretlenmesi** (rozet) ya da
    süzgece bir *"fotoğrafı olmayanlar"* seçeneği eklenmesi

  ⛔ **Bölüm 7 — HER DİLDE.** `mk_photo_scan_done` ve
  `mk_photo_scan` iki dilde de duruyor (`app.html:7119` / `8470`);
  metin değişirse ikisi de değişir. Bekçi hazır:
  `testler/sozluk-paritesi.test.js` — tür/arite uyuşmazlığını da
  yakalıyor, yani `(b, t)=>` arite'si bozulursa düşer.

  ⚠ Düzeltilince **bekçi test**: fotoğrafsız mekân sayısı 0, 1 ve
  çok olduğunda çıkan cümleler ayrı ayrı ölçülsün — bugün yalnızca
  "bulundu / bulunamadı" ayrımı var.

- ⬜ **60.** **Yönetim panelinde para biriminin AÇIK/KAPALI
  anahtarı.** Kullanıcı 18 Kasım 2026: *"Admin panelinde hangi
  fiyatı kullanabileceğimiz ve ne kadar olacağını arka planda ben
  yazabileyim"* → **ne kadar olacağı** aynı gün bitti (44.2),
  **hangisinin kullanılacağı** bu madde. Sonraya bırakıldı:
  *"ok yapılacaklar ekle sonra yaparız."*

  ✅ **YARISI ZATEN HAZIR.** `plan_prices.active` sütunu var ve
  **fiyat sayfası onu zaten dinliyor** — `active=false` olan para
  biriminin hem fiyatı hem **düğmesi** kayboluyor, tek para birimi
  kalırsa seçici hiç görünmüyor. Bunların bekçisi de var
  (`testler/fiyat-para-birimi.test.js`).

  ⬜ **EKSİK OLAN: paneli o sütunu yazabilir hale getirmek.**

  | Halka | Durum |
  |---|---|
  | `plan_prices.active` sütunu | ✅ var (`sql/69`) |
  | Fiyat sayfası dinliyor | ✅ var |
  | `yonetim.html` tabloda gösteriyor | ⬜ yok |
  | Edge Function işlemi | ⬜ yok — `islem:'fiyat-degistir'` yalnızca `amount_minor` yazıyor |

  ⛔ **BU BİR DAĞITIM İŞİ.** Panel doğrudan veritabanına yazmıyor,
  `supabase/functions/yonetim` Edge Function'ına yazıyor. Yani
  değişiklik iki dosyada: `yonetim.html` **ve** o fonksiyon —
  ve fonksiyon **yeniden dağıtılmalı.**
  ⚠ **Dağıtımı kullanıcı yapar, adım adım yazılacak** (Bölüm 1).
  Dağıtım adımları `supabase/functions/*/README.md` dosyalarında
  yazılı; "nasıl dağıtıyorsan öyle dağıt" denmeyecek.

  ⚠ **SIRASI GELİNCE SORULACAK:**
  1. Anahtar **para birimi başına mı** olsun (EUR'yu tümden kapat),
     yoksa **satır başına mı** (yalnızca studio/yearly EUR'yu kapat)?
     Sütun satır başına; panelde tümden kapatmak için birden çok
     satırı birden değiştirmek gerekir.
  2. Bir para birimini kapatmak **o parayla ödeyen mevcut aboneleri**
     etkiler mi? (Bugün ödeme altyapısı yok; soru canlıya geçmeden
     önce cevaplanmalı.)
  3. Kapatma da fiyat değişimi gibi **onay** istesin mi?

  ⚠ Düzeltilince **bekçi test**: panelden kapatılan satırın fiyat
  sayfasında kaybolduğu uçtan uca ölçülsün — bugün yalnızca
  sayfanın tarafı ölçülüyor.

- ⬜ **61.** **Yönetim panelinde fiyat tablosu KULLANIŞLI olsun —
  her plan bir satır, para birimi × dönem sütun.** Kullanıcı
  18 Kasım 2026'da iki ekran görüntüsüyle istedi:

  > *"Admin sayfasında fiyat yönetimi için daha kolay bir sayfa
  > yapabilir miyiz! Örnek SS ekte, sadece Excel'de bu tabloyu nasıl
  > rahat kullanırım onu göstermek için yazdım — tasarım değişikliği
  > değil, tablonun kullanımını rahatlatacak değişiklik."*

  **BUGÜNKÜ HÂLİ (koddan ölçüldü, `yonetim.html:375`):** her
  plan × para birimi × dönem **ayrı bir satır** → bugün **18 satır**
  ve **18 ayrı "Kaydet" düğmesi**. Sıralama plan → para → dönem
  olduğu için aynı planın TRY, EUR ve USD satırları birbirinden
  uzağa düşüyor; bir planın fiyatlarını karşılaştırmak için
  gözle tarama gerekiyor.

  **İSTENEN (kullanıcının Excel taslağı):** satır = plan,
  sütun = dönem × para birimi.

  | | monthly TRY | yearly TRY | monthly EUR | yearly EUR | monthly USD | yearly USD |
  |---|---|---|---|---|---|---|
  | Starter | | | | | | |
  | Creator Pro | | | | | | |
  | Founding | | | | | | |
  | Studio Pro | | | | | | |

  18 satır → **4 satır**. Bir planın bütün fiyatları tek bakışta.

  ⚠ **DİKKAT EDİLECEKLER (ölçüldü):**
  - **Gizli planlar.** `founding` ve `studio` bugün `gizli` etiketi
    taşıyor; matriste de o işaret durmalı, yoksa yönetici satılmayan
    bir planın fiyatını düzenlediğini fark etmez.
  - **Her hücre aynı dönemi taşımıyor.** `founding` yalnızca `once`,
    `starter` yalnızca `monthly`. Matris boş hücreleri **boş**
    göstermeli, sıfır değil — sıfır "bedava" demek, boş "böyle bir
    fiyat yok" demek; ikisi karıştırılırsa ücretli plan bedava olur.
  - **Kaydetme yolu.** Panel doğrudan veritabanına yazmıyor;
    `supabase/functions/yonetim` → `islem:'fiyat-degistir'` **tek
    satır** alıyor ve her kayıtta **onay** istiyor (çok büyük
    değişimde ikinci onay). Matris çok hücreyi birden değiştirmeye
    davet ediyor; bu soruyu doğuruyor.

  ⚠ **SIRASI GELİNCE SORULACAK:**
  1. **Kaydetme hücre başına mı, satır başına mı, tablo başına mı?**
     Tablo başına "hepsini kaydet" istenirse Edge Function'a **toplu
     işlem** eklenip **yeniden dağıtılması** gerekir (dağıtımı
     kullanıcı yapar). Hücre başına kalırsa dağıtım gerekmez.
  2. **Onay nasıl olsun?** Bugün her kayıtta ayrı onay penceresi
     çıkıyor. Altı hücre değiştirildiyse altı pencere mi, tek bir
     özet mi?
  3. **Para birimi sütunları sabit mi, veriden mi?** Fiyat sayfası
     18 Kasım'da veriden beslenir hâle geldi (44.2); panel de aynı
     yoldan gitmeli ki yarın dördüncü para birimi eklenince sütun
     elle yazılmasın.
  4. Dönem sırası: Excel taslağında **dönem önce, para birimi
     sonra** (monthly TRY · yearly TRY · monthly EUR …). Öyle mi
     kalsın, yoksa para birimi önce mi gruplansın?

  ⚠ Düzeltilince **bekçi test**: matrisin her hücresi doğru
  plan/para/dönem üçlüsüne yazıyor mu, ve boş hücre **sıfır olarak
  kaydedilmiyor** mu — ikincisi para hatası doğurur.

  ✅ **İLGİLİ KANIT:** kullanıcının ekran görüntüsünde EUR satırları
  **düzenlenmiş** görünüyor (creator_pro TRY aylık 299 / yıllık 2999,
  USD yıllık 98, EUR yıllık 89). Yani 44.2'nin kurduğu zincir —
  SQL → panel → sayfa — uçtan uca çalışıyor.

- ⬜ **62.** **Supabase kitaplığı DIŞARIDAN geliyor — beş sayfanın
  ortak tek dayanağı.** 18 Kasım 2026'da fiyat sayfası arızası
  araştırılırken çıktı.

  `cdn.jsdelivr.net` adresinden çekiliyor ve depoda **yerel kopyası
  yok** (`testler/sahte-supabase.js` yalnızca testlerin taklidi).
  Koddan sayıldı, beş sayfa da aynı adrese bağlı:

  | Sayfa | Satır |
  |---|---|
  | `app.html` (uygulamanın kendisi) | `<script src="…jsdelivr…supabase-js@2.45.4…">` |
  | `yonetim.html` (yönetim paneli) | aynı |
  | `kaynak/fiyatlar.html` | `276` |
  | `kaynak/index.html` | aynı |
  | `lokasyon.html` | aynı |

  O adrese bir gün ulaşılamazsa **uygulama, panel ve fiyat sayfası
  birden** çalışmaz. Çözüm: kitaplığı depoya koyup kendi alan
  adımızdan sunmak — o zaman üçüncü taraf tek dayanak ortadan kalkar.

  ⛔ **BU, 18 KASIM ARIZASININ SEBEBİ DEĞİLDİ — yanlış suçladım,
  kaydı buraya düşüyorum ki bir daha aynı yoldan gidilmesin.**
  Kullanıcı *"Fiyatlar yükleniyor…"* yazısında takılı bir sayfa
  gördü ve ben kitaplığı suçladım. Kanıt tersini söylüyor:
  `kaynak/fiyatlar.html:248` → `<div id="durum" class="durum"></div>`,
  yani o kutu HTML'de **boş**; "yükleniyor" yazısını bizim betiğimiz
  yazıyor ve onu ancak **kitaplığın var olduğunu gördükten sonra**
  yazıyor (yoksa "tarayıcı kitaplığı yüklenemedi" yazardı). Demek ki
  kitaplık **sorunsuz gelmiş**. Kullanıcının konsolunda da sayfaya
  ait tek hata yoktu (gördüğü satır bir tarayıcı eklentisine aitti).
  Takılan şey **veritabanına giden isteğin kendisiydi**: yanıt hiç
  dönmedi, ve yanıtsız kalan bir istek konsola hiçbir şey yazmaz.
  Kullanıcı aynı gün *"sayfada euro dahil tüm fiyatları görüyorum"*
  dedi — yani geçici bir takılmaydı.

  Ders (Bölüm 4): **belirtiye uyan ilk açıklamayı sebep sanma.**
  Kanıt zinciri kurulana kadar "şu yüzden" denmeyecek.

- ✅ **63. BİTTİ (18 Kasım 2026)** — **fiyat sayfası artık
  "yükleniyor"da TAKILI kalmıyor.** Yukarıdaki arızanın asıl kusuru
  buydu: istek yanıtsız kalırsa `await` sonsuza kadar bekliyordu —
  ne hata mesajı, ne tekrar deneme. Sayfanın söyleyecek sözü yoktu.

  | Ne | Nerede |
  |---|---|
  | 12 saniyede zaman aşımı | `kaynak/fiyatlar.html` → `zamanAsimli()` |
  | "Yüklenemedi" + **Tekrar dene** düğmesi (sayfa yenilemeye gerek yok) | aynı dosya, `catch` |
  | İngilizce sayfada aynı güvence, kendi diliyle (Bölüm 7) | aynı dosya, iki sözlük |

  Ölçüldü: 12. saniyede yazı değişiyor, gerçek bir `<button>`
  çıkıyor, telefonda **47px** dokunma yüksekliği (44 eşiğinin
  üstünde). Bekçi: `testler/fiyat-para-birimi.test.js`, **15 iddia**;
  üç mutasyonla kanıtlandı (zaman aşımı kaldırılınca 5 iddia düşer,
  düğme düz yazıya çevrilince 5 iddia düşer, İngilizce sözlüğe
  girmezse 1 iddia düşer).

  ⚠ **Bu bir TEŞHİS değil, bir GÜVENCE.** Sebep ne olursa olsun
  (ağ, CDN, sunucu) kullanıcı ekranda bekleyip durmuyor.

- ✅ **64. BİTTİ (18 Kasım 2026).** ⛔ **ÜST VE ALT MENÜ HER SAYFADA
  AYNI VE SABİT (app hariç).**

  **Sonuç — on üretilen sayfa, üç genişlikte ölçüldü:**

  | Genişlik | Üst menü | Alt menü |
  |---|---|---|
  | 1280 | **63 px** (hepsi) | **174,80 px** (hepsi) |
  | 900 | **63 px** | **174,80 px** |
  | 390 | **63 px** | **253,59 px** |

  Her sayfada 5 bağlantı, aynı metinler, aynı sırada.

  **Ne yapıldı:**
  1. Üst menünün dolgusu üretilen `<style>`'da çivilendi
     (`uret/ust-menu.js`) — sayfanın kendi `.ust` dolgusu artık
     eziliyor.
  2. ⛔ **Alt menü artık ÜRETİLİYOR** (`uret/alt-menu.js`, yeni).
     Her sayfanın elle yazdığı altlık siliniyor, üretilen altlık
     gövdenin **sonuna** ekleniyor.
     ⚠ Yerinde değiştirilmedi: kılavuzun altlığı bir kapsayıcının
     içindeydi, yerinde değiştirilse dar sütunda kalırdı.
     ⚠ Bağlantı listesi **yazılı değil**: `SAYFALAR` tablosundaki
     `ev` dışındaki her sayfa giriyor — 65. maddenin sayfaları
     kendiliğinden girecek.
  3. Son cümlenin iki dildeki metni **uydurulmadı**;
     `kaynak/index.html`'in kendi sözlüğünden alındı.

  ⚠ **DÖRT AYRI SEBEP ÇIKTI VE ÜÇÜ ÖLÇMEDEN BULUNAMAZDI:**

  | Sebep | Nerede | Etkisi |
  |---|---|---|
  | `.ust{padding-bottom:22px}` | gizlilik/şartlar | üst menü 22 px uzun |
  | `p{max-width:68ch}` | kılavuz | son cümle satır atlamıyordu → 52,8 px fark |
  | `footer{border-top:1px}` | kılavuz | tam **1 px** fark |
  | `.alt-ic a{min-height:44px}` yalnızca fiyatlarda | öteki sayfalar | 13,6 px fark **ve eksik dokunma hedefi** |

  ⛔ İkincisi en sinsisiydi: hesaplanan `flex` değeri **doğru**
  okunuyordu (`0 0 100%`); yanlış olan `max-width`'ti. Tahminle
  "flex kısayolu eziliyor" denip yanlış yer düzeltilebilirdi.
  ✅ Dördüncüsünde kural **kırılmadı, her sayfaya yayıldı**: 44 px
  telefonda dokunulabilir en küçük ölçü, öteki sayfalar eksikti.

  ✅ **`/en/privacy/` ve `/en/terms/`'te altlığın HİÇ olmamasının
  sebebi de bulundu:** o iki dosya iki dili üst üste taşıyor, altlık
  Türkçe yarının içinde kalıyor ve İngilizce üretilirken o yarı
  atılınca altlık da gidiyordu.

  Bekçi: `testler/menu-olcu-birligi.test.js`, **14 iddia**, üç
  genişlikte. ⛔ Liste yazmıyor (sayfalar `sayfalar.js`'ten, diller
  `diller.js`'ten). Dört mutasyonla kanıtlandı: üst menü dolgusu
  çivilenmezse 3 iddia düşer, alt menü gömülmezse 7, `max-width`
  kalkarsa 1, 44 px kuralı kalkarsa 4.

  ⛔ **47. MADDENİN BEKÇİSİ BUNU NEDEN KAÇIRDI:** `uretilen-sayfalar`
  menünün **yatay** konumunu ölçüyordu, **yüksekliğini** değil. O 22
  piksel sekiz gün görünmedi. Alt menüyü ise hiçbir test ölçmüyordu.

  ⬇ Maddenin özgün hâli kayıt için duruyor:

  Kullanıcı 18 Kasım 2026'da bildirdi:

  > *"alt bölümde yer alan kullanım şartları linkine gittiğimde üst
  > menü genişliyor gibi geldi bana. Önemli — üst ve alt menü hiçbir
  > sayfada yer değiştirmesin kaybolmasın! Her sayfada üst ve alt
  > menü mutlaka aynı olsun. (app hariç) ... tüm sayfaları kontrol
  > et ve tüm sayfalarda üst ve alt menünün aynı ve sabit
  > boyutlarda olduğundan emin ol ve düzelt."*

  ✅ **ÖLÇÜLDÜ (18 Kasım 2026) — kullanıcı haklı ve sorun gördüğünden
  BÜYÜK.** On üretilen sayfa 1280px'te ölçüldü:

  **Üst menü — 22 piksel fark:**

  | Sayfalar | Yükseklik |
  |---|---|
  | `/tr/` `/tr/fiyatlar/` `/tr/kilavuz/` + İngilizceleri | 63 px |
  | `/tr/gizlilik/` `/tr/sartlar/` `/en/privacy/` `/en/terms/` | **85 px** |

  Sebep bulundu: şartlar/gizlilik sayfalarında `.ust` öğesinin
  **kendi `padding-bottom:22px`'i** var. İçerik (`.ust-ic` 62 px) ve
  çağrı düğmesi (44 px) her sayfada aynı — fark yalnızca o dolgudan.
  ⚠ 47. madde tam bu aileyi kapatmıştı (bir sayfanın kendi menü
  stili olması); bu artık kalmış.

  **Alt menü — her sayfada başka, ikisinde HİÇ YOK:**

  | Sayfa | Yükseklik | Bağlantı |
  |---|---|---|
  | `/tr/` · `/en/` | 161,2 px | 5 |
  | `/tr/fiyatlar/` · `/en/pricing/` | 122 px | 4 |
  | `/tr/kilavuz/` · `/en/guide/` | 104,3 px | 5 |
  | `/tr/gizlilik/` | 23,1 px | **1** |
  | `/tr/sartlar/` | 23,1 px | **2** |
  | `/en/privacy/` · `/en/terms/` | ⛔ **HİÇ YOK** | — |

  ⛔ **İngilizce gizlilik ve şartlar sayfalarında alt menü hiç yok.**
  47. maddede üst menü birleştirildi ama **alt menüye dokunulmadı**;
  her sayfa kendi altlığını taşımaya devam etti.

  **Yapılacak:**
  1. Üst menünün ölçüsü üretilen `<style>` bloğunda çivilensin —
     sayfanın kendi `.ust` dolgusu ezilsin.
  2. ⛔ **Alt menü de üst menü gibi ÜRETİLSİN** (`uret/alt-menu.js`),
     her sayfaya aynısı girsin. Elle yazılan altlıklar kalksın.
  3. Bekçi: üst menü ölçüsü bugün yalnızca **yatay** konumu ölçüyor
     (`uretilen-sayfalar.test.js`); **yükseklik** ölçülmediği için
     bu 22 piksel sekiz gün görünmedi. Yükseklik de ölçülecek, alt
     menü de ölçülecek — ⛔ ikisi de **liste yazmayan** bekçiyle
     (sayfalar `sayfalar.js`'ten, diller `diller.js`'ten).

  ⚠ **app.html kapsam dışı** — kullanıcı "app hariç" dedi.

- ⬜ **65.** **Hakkımızda sayfası + İletişim sayfası.** Kullanıcı
  18 Kasım 2026'da istedi: *"yapılacaklara başka bir bölüm —
  hakkımızda sayfası ve iletişim sayfası. Bunlar da yapılacaklar
  listesinde olsun."*

  ⚠ **İÇERİK KULLANICIDAN GELECEK — UYDURULMAYACAK** (Bölüm 4).
  Bu iki sayfa şirket, kişi ve iletişim bilgisi içerir; hiçbiri
  koddan ya da tahminden yazılamaz. Sırası gelince sorulacak:

  | Hakkımızda | İletişim |
  |---|---|
  | Kim yazdı, neden yazıldı | Hangi e-posta görünecek |
  | Hangi hikâye anlatılacak | Form mu, düz adres mi |
  | Fotoğraf/görsel olacak mı | Sosyal hesaplar listelenecek mi |
  | Şirket/şahıs bilgisi görünecek mi | Yanıt süresi sözü verilecek mi |

  ✅ **ELDEKİ DOĞRULANMIŞ TEK BİLGİ:** `hello@shootboard.app`
  Cloudflare Email Routing ile Gmail'e düşüyor (bu dosyada kayıtlı).
  ⛔ Bunun dışında hiçbir iletişim bilgisi uydurulmayacak.

  **Bağlı işler — ikisi de 64 ve Bölüm 7 ile birlikte:**
  - İki sayfa da **her dilde** olacak (Bölüm 7), yani `uret/
    sayfalar.js`'e kayıt + her dilde kaynak.
  - Üst ve alt menüye girecekler — yani **64 bitmeden eklenirse**
    menü dağınıklığı iki sayfa daha çoğalır. ⚠ Sırası: önce 64.

### 4 · Basitleştirme (hepsi ilk deneyimi değiştiriyor)
- ⬜ **17.** İlk ekran: kendiliğinden açılan tur yok
  (bugün `tourAutoSequence = true`, app.html:25300)
- ⬜ **18.** Yeni kayıt: üç alan görünür, gerisi katlı
- ⬜ **19a. AYARLAR SAYFASI** — kullanıcı istedi (16 Kasım 2026):
  *"hesabım sayfasına tıklanınca çıkan pop-up'ı değiştirmek istiyorum.
  Böyle bir pop-up yerine bir settings / ayarlar sayfası gibi bir sayfa
  olmalı. Hatta hatırlatmalar, hesap etiketleri, AI gibi başlıkları da
  bu alana taşımak gerekiyor."*
  Bugün bunların her biri AYRI bir pencere (`hesapOverlay`,
  `remindersOverlay`, `aiSettingsOverlay`, hesap etiketleri). Hepsi
  ⋯ çekmecesinden ayrı ayrı açılıyor.

  **Ayarlar sayfasına taşınacaklar** (kullanıcı, 16 Kasım 2026):
  - Hesabım (bugün `hesapOverlay`)
  - Hatırlatmalar (bugün `remindersOverlay`)
  - Hesap etiketleri (bugün `hesapEtiketBtn`)
  - AI / Gemini ayarları (bugün `aiSettingsOverlay`)
  - **Açık / koyu tema** (bugün ⋯ çekmecesinde `themeBtn`)
  - **Dil seçimi** (bugün ÜST ŞERİTTE `langSelect`)

  ⚠ Dil seçici üst şeritten kalkarsa marka adına **63 piksel** yer
  açılır. 16 Kasım'da ölçüldü: o kutu şeridin en dar yerinde ikinci
  büyük tüketici. Marka adının üçüncü kez kırpılmasının sebeplerinden
  biriydi. Taşınırken bu kazanç da hesaba katılsın.
  ⚠ Dil ve tema **girişsiz ziyaretçide de** erişilebilir kalmalı;
  ayarlar sayfası hesaba bağlanırsa o iki ayar kaybolur.
  ⚠ Bu madde 19'un (sekme sayısı) hemen öncesine konuldu: ikisi de
  gezinmeyi yeniden kuruyor ve aynı iskelete dokunuyor; ayrı ayrı
  yapılırsa iş iki kez yapılır.
  ⚠ Prompt yok — sırası gelince önce plan ve sorular.
- ⬜ **19.** Gezinme: bugün **yedi** sekme → dörde
- ⬜ **20.** Boş ekran yok
- ⬜ **21.** Yedi adım: atlanabilir adım ve hazır akışlar

### 5 · Listeler ve föy
- ⬜ **2.** Plan listesi (`tasarim/plan-listesi.md` var, kod yok)
- ⬜ **3.** Yayın günü listesi, platforma göre
- ⬜ **13.** Çekim Föyü tasarımı (bütün aşamaları)

### 6 · Fiyatlandırma (para işleri en sonda)
- ⬜ **28.** Starter / Creator Pro kıyaslama tablosu — girdi geldi
  (46 satır: 31 ortak, 15 yalnızca Pro). ⛔ Uygulamada **açık
  olmayan** özellik siteye "var" diye konmaz. İlk raporda her satır
  için "bugün var mı" sütunu.
- ⬜ **29.** Ödeme duvarı ve veri taşıma. Bugün yalnızca kayıt/proje
  **sayısı** sınırlanıyor (`sinirlariUygula`), özellik bazlı duvar
  yok. ⚠ Bugün herkese açık olan bazı özellikler "yalnızca Pro"
  listesinde: kapatmak MEVCUT kullanıcıları etkiler — **kullanıcıya
  sor, kendiliğinden kapatma.**
- ⬜ **30.** Kullanım kaydı
- ⬜ **26.** Ödeme, test modunda — ⚠ **sağlayıcı kararı da bekliyor**
- ⬜ **31.** Fatura programı bağlantısı
- ⬜ **32.** Canlıya geçiş

### 7 · Düzen
- ⬜ **36.** Test düzeni üç kademe. `kosu.sh` ve 207 test var ama
  `testler/README.md`'de kademe tarifi **yok**.

### 8 · Prompt / karar bekleyenler — sırası gelince DUR
- ⬜ **37.** Gemini dışı sağlayıcılar — **PROMPT YOK**.
  Doğrulandı: `app.html`'de tek adres `generativelanguage.googleapis.com`.
  `callClaude` bu dosyada **hiç olmadı** — yalnızca
  `testler/eski/index.html` (eski prototip) ve bu dosyanın 1 Eylül
  kaydında geçiyor. Yani "kaldırıldı" değil, "hiç getirilmedi".
  ⛔ Sağlayıcıların tarayıcıdan doğrudan çağrılmaya izin verip
  vermediği **doğrulanmadı** — sırası gelince kendi belgelerinden
  okunacak, ezberden yazılmayacak.
- ⬜ **38.** Plan aktarma — altyapı var (`ai/` klasörü, `ai_aktarimlar`,
  `imp_paket_ipucu`). Plan kararı: yalnızca Creator Pro. Nasıl
  tanıtılacağı kullanıcının kararı.

### 9 · En son
- ⬜ **39.** MCP'nin ücretli kullanıcılara açılması — **KARAR BEKLİYOR**.
  ⛔ `CLAUDE.md` Bölüm 3 bunu bugün YASAKLIYOR. O kuralı yalnızca
  kullanıcı kaldırır. Kullanıcı açıkça "aç" demeden kod yazılmaz,
  bayrak açılmaz, kimseye anahtar üretilmez.

### I · Diller  ⬜ EN SON GRUP
- ⬜ **41.** **Altı yeni arayüz dili:** Ispanyolca (`es`), Brezilya
  Portekizcesi (`pt-BR`), Almanca (`de`), Fransızca (`fr`), İtalyanca
  (`it`), Rusça (`ru`). Kullanıcı 16 Kasım 2026'da hem dilleri hem de
  **en sona** kararını verdi. Ayrıntı: aşağıdaki "DİLLER" bölümü.
  ⛔ **Kullanıcı "dillere başla" demeden kod yazılmaz.**
  ⚠ **İKİ ÖN KOŞUL, ikisi de 41'den ÖNCE:**
  1. **40** (sözlük parite testi) — Sıra 2'de.
  2. **42** (yerel biçim merkezi) — Sıra 3'te, **56 yer**. O madde
     bugünkü `lokasyon.html` hatasını da kapatıyor; ayrıntı orada.
  ⚠ **Dalga dalga:** önce `es` + `pt-BR`, sonra `de` + `fr`, sonra
  `it` + `ru`. Her dalgadan sonra kullanıcıya göster, onay al.

## Bitenler (bu listeden)

4, 5 (A) · 14, 15, 16 (C) · 22, 23, 24, 25, 27 (E) · 33, 34, 35 (F)

**35 (push) 16 Kasım 2026'da canlıda uçtan uca doğrulandı:** üç cihaza
gönderildi, üçünde de bildirim göründü. Windows'ta görünmemesinin
sebebi uygulamada değildi — Windows'un Chrome'a bildirim izni kapalıydı.

## Başlanmayacaklar (kullanıcı kararı)

- PDF / CSV dışa aktarma — kullanıcının kararı, istenmedi
- Birleşik kutu (aynı içerik tek kutuda) — ayrı iş, istenmedi
- Mağazaya sarmalama / yerli uygulama — bilerek ertelendi

---

## 16 KASIM 2026 — DİLLER (karar + ölçüm)

Kullanıcı sordu: "TR ve EN haricinde ek dil eklemenin maliyeti ne?
GitHub ya da Supabase'de ek yer tutar mı?" Sayılar **koddan**
çıkarıldı, tahmin değil.

### Neden EN SONA (kullanıcının sezgisi doğru çıktı)

Üç sebep, üçüncüsü belirleyici:

1. **`t()` İngilizce'ye düşüyor** (`app.html:8721-8725`). Yani üçüncü
   dil **her an** eklenebilir; bugün yapılan hiçbir iş onu sonra
   zorlaştırmıyor. Erken yapmanın teknik bir kazancı yok.
2. **`LANG_NAMES` tek satır** (`app.html:6097`) ve `prefs` sütunu
   `jsonb` (`sql/06-tercihler.sql:48`) — altyapı hazır, beklemenin
   bedeli yok.
3. ⛔ **Listede 20'den fazla açık madde var ve her biri YENİ DİZE
   getiriyor.** Bugün çevrilen bir sözlük, 6/7/8/10/11/12 ve ayarlar
   sayfası bitince yeniden çevrilmek zorunda kalır. Üçüncü dil
   varken her yeni özellik **1,5 kat** dize maliyeti demek.

⚠ **Ama 40. madde (parite testi) EN SONA DEĞİL.** O bekçi üçüncü dil
için değil, **bugünkü TR/EN için** gerekiyor: bu oturumda zaten
`"boş yanıt"` diye üç yere gömülmüş Türkçe bir dize bulundu ve
İngilizce kullanan kişiye görünüyordu. Bekçisi olmayan şey
sessizce bozuluyor.

### Çevrilecek miktar

| Yer | Dize | Boyut |
|---|---|---|
| `app.html` ana sözlük | 1 186 | 80 KB |
| `app.html` ilk-adım turu | 51 | 4,5 KB |
| `app.html` küçük sözlükler (platform, rozet, durum) | ~30 | ~1 KB |
| `index.html` | 132 | 7,6 KB |
| `lokasyon.html` | 114 | 4,6 KB |
| `fiyatlar.html` | 42 | 3,1 KB |
| `paylas.html` | 11 | 0,6 KB |
| **Toplam arayüz** | **~1 566** | **~101 KB** |

Düzyazı ayrıca: `kilavuz.html` 56 KB / `guide.html` 54 KB (üçüncü dil
**ayrı dosya** ister), `privacy.html` 27 KB ve `sartlar.html` 23 KB
(iki dili **aynı dosyada ayrı bölüm** olarak taşıyor → her birine
üçüncü bölüm).

### Kullanıcının elle yapacağı (kod değil, panel işi)

1. **18 görsel** (3 × 6 dil). `index.html:1294` dile göre resim
   değiştiriyor: `kahraman-<dil>.webp`, `uygulama-tablet-<dil>.webp`,
   `uygulama-telefon-<dil>.webp`. Yani her dil için uygulamanın o
   dildeki üç ekran görüntüsü gerekiyor.
   ⚠ **Dalga başına 6 görsel** (iki dil × üç görsel) — dalga dalga
   gitmenin bir sebebi de bu.
2. **18 e-posta şablonu** (3 × 6 dil) Supabase panelinde:
   `confirm-signup`, `hosgeldin`, `magic-link`.
3. **İki Edge Function dağıtımı:** `hosgeldin` (`index.ts:108` dili
   `'tr' | 'en' | 'both'` diye sabitlemiş) ve `push-gonder`
   (`index.ts:41-52` bildirim metni iki dilde sabit).

### Yer — ⚠ ALTI DİLLE ÇARPILIYOR

Aşağıdaki sayılar **tek dil** içindir; karar altı dil olduğu için
altıyla çarpılıyor.

| | Tek dil | **Altı dil** |
|---|---|---|
| Sözlükler (`app.html`, `index`, `lokasyon`, `fiyatlar`, `paylas`) | ~101 KB | **~606 KB** |
| Kılavuz (ayrı dosya) | ~55 KB | **~330 KB** |
| Gizlilik + şartlar (üçüncü bölüm) | ~24 KB | **~144 KB** |
| E-posta şablonları | ~30 KB | **~180 KB** |
| Dile bağlı görseller (3 adet) | ~240 KB | **~1 440 KB** |
| **Toplam** | **~450 KB** | **~2,7 MB** |

- **GitHub:** depo 8,8 MB → **~11,5 MB**, yani **%31 artış.** Yarısından
  fazlası görsel (1,4 MB).
- **Supabase: sıfır.** `prefs` alanı `jsonb`; `"lang":"ru"` ile
  `"lang":"tr"` aynı yeri tutuyor. Yeni tablo, sütun ya da satır yok.
  ⛔ Ödeme/abonelik tarafında da değişiklik yok (Rusça notuna bak).

### Gizli maliyetler

| Sorun | Nerede | Sonucu |
|---|---|---|
| **Parite testi yok** | — | Eksik anahtar hiç kırmızı yanmaz → **40. madde** |
| 34 sıralama kapısı | `app.html` içinde `currentLang === 'tr' ? 'tr' : 'en'` | Üçüncü dil İngilizce sıralanır → **41'in ilk adımı** |
| Kılavuz ayrı dosya | `kilavuz.html` / `guide.html` | Her kılavuz değişikliği **üç** dosyada. Bu deponun tekrarlayan hatası tam bu: bir yerde düzeltip ötekilerde unutmak. |

⚠ **Çeviri hızı ölçülemedi, uydurulmadı.** Kod tarafı (parite testi,
`LANG_NAMES`, yerel biçim merkezi, çoğul yardımcısı, iskelet) bir
oturumluk ve **altı dil için bir kez** yapılıyor; asıl yük dil başına
1 566 dize + 79 KB düzyazı, yani **altı dilde ~9 400 dize + ~474 KB
düzyazı.** Hukuk metinleri (`privacy`, `sartlar`)
kullanıcıya **doğrulattırılmadan** "tamam" denmez (Bölüm 4).

### Hangi diller — KARAR VERİLDİ (16 Kasım 2026)

Kullanıcı altı dil seçti: **es, pt-BR, de, fr, it, ru.** Bugünkü
ikisiyle toplam **sekiz dil**.

- **Ispanyolca:** Latin Amerika'ya uygun, yansız İspanyolca
  (İspanya'ya özgü kalıplar yok, "vosotros" yok). Tek `es`.
- **Portekizce:** **Brezilya** (Portekiz değil). Tek `pt`; `pt-PT`
  tarayıcısında da `pt-BR` açılacak.
- **Rusça bilerek listede.** Kullanıcının notu: Rusya'dan ödeme
  alınamıyor olabilir (kartlar Mart 2022'den beri askıda). Kullanıcı
  biliyor, *"Rusya'ya gerekirse ücretsiz veririm ileride"* dedi.
  ⛔ **Ödeme tarafında şimdi hiçbir şey yapılmaz**; sırası gelince
  kullanıcıya sorulur.
- ⛔ **Kapsam dışı:** sağdan sola diller (Arapça, İbranice), Hintçe,
  Endonezce, Japonca vb. Kullanıcı istemeden başka dil eklenmez.
- ⛔ **Çevrilmeyenler:** plan adları (`Starter`, `Creator Pro`).

### Araştırma sohbetinin sayıları — DEPODAN DOĞRULANDI

Araştırma sohbeti 3 Eylül kaydına dayanan sayılar gönderdi; §4 gereği
hepsi koddan yeniden sayıldı. **İkisi değişmiş:**

| İddia | Depodaki gerçek | Durum |
|---|---|---|
| Yerel biçim 8 yerde sabit | **19 yer** (`app.html` 15, `paylas.html` 3, `fiyatlar.html` 1) + ayrı kalıpta **34** sıralama kapısı = **53** | ⛔ sayı iki kattan fazla büyümüş |
| Dil başına ~32 KB ham | **~80 KB** (ana sözlük, 1 186 anahtar) + tur 4,5 KB | ⛔ ölçüm yenilendi |
| `buyuk-harf.test.js` var | **var** | ✅ |
| Lokasyon uygulamasında Rusça çalışıyor | **çalışıyor** — `lokasyon.html:1589` `ru:` sözlüğü, seçicide 🇷🇺 RU | ✅ örnek alınacak |
| Çoğul riski sayılmadı | **76 anahtar** sayı alıyor (`app.html` EN sözlüğünde `anahtar: (n)=>` biçiminde) | ✅ sayıldı |
| Kiril yazı tipi şüphesi | **sorun yok** — IBM Plex Sans ve IBM Plex Mono, Google Fonts'tan `cyrillic` + `cyrillic-ext` alt kümeleriyle geliyor (CSS'ten doğrulandı) | ✅ |

### ⛔ YOL ÜSTÜNDE BULUNAN AYRI HATA (dil işinin parçası değil)

`lokasyon.html` ay adlarını **üç yerde** `'tr-TR'` diye SABİT yazıyor:
satır 2218, 2319, 3085. Ama o sayfanın dil seçicisinde **tr, en, ru**
var. Yani İngilizce ya da Rusça kullanan biri takvimde **Türkçe ay
adı** görüyor (`Kas`, `Ara`). Bugünkü bir hata, altı dille ilgisi yok.

✅ **Kullanıcı 16 Kasım 2026'da onayladı ve listeye ekletti: 42. madde
(Sıra 3).** Orada 56 yerin tamamıyla birlikte ele alınıyor.

### Çoğul biçimleri — 76 anahtar

Rusça'da dört çoğul biçimi var (1 video / 2 video / 5 video ayrı
yazılır); `es`, `fr`, `it`, `pt` de "one/other" dışında biçim
isteyebiliyor. **Sayı içeren metinler elle birleştirilmeyecek**;
`Intl.PluralRules` üzerinden tek bir yardımcıya bağlanacak. Bugün
76 anahtar sayı alıyor, hepsi o yardımcıya geçecek.

### Metin uzaması — 375 pikselde denetlenecek

Almanca, İtalyanca, Fransızca ve Rusça etiketler İngilizcenin 2-3
katına çıkabiliyor. Düğme, sekme, takvim hücresi ve telefon
genişliğinde taşma her dilde ekranda ölçülecek.

⚠ **Bunun bir örneği bugün yaşandı:** 9. maddede menü adı tek
kelimeden ("Malzeme") iki kelimeye ("Çekim Setleri") çıkınca
701-980 piksel arasında sekme etiketi **iki satıra sardı**.
`testler/sekme-adi.test.js` o bekçiyi kurdu ve sekiz dilde de
koşacak — yeni diller için hazır duruyor.

### Büyük/küçük harf

Türkçe'ye özel `i`/`I` mantığı başka dillere sızmayacak; Almanca'da
isimler büyük harfle başlıyor ve `text-transform:uppercase` "ß" gibi
harflerde bozulabiliyor. `testler/buyuk-harf.test.js` yeni dillerle
de koşacak.

### Yalnızca arayüz değil — tam liste kullanıcıya sorulacak

Arayüz çevrilip bunlar İngilizce kalırsa ürün yarım görünür.
⚠ **Hangilerinin bu işe dahil olduğunu kullanıcı seçecek:**
örnek/demo içerikler · karşılama ve giriş e-postaları
(`supabase/email`, `hosgeldin`) · kılavuz sayfaları
(`kilavuz.html` / `guide.html`) · tanıtım sayfası (`index.html`) ·
gizlilik ve şartlar · asistan kartı (`ai/asistan-karti.md`) ·
bildirim metinleri (`push-gonder`) · hata mesajları.

### Marka dili her dilde geçerli

`MARKA.md`'deki yasak ifadeler çeviride de yasak: "otomatik paylaşır",
"hesaplarına bağlanır", "istatistik gösterir" anlamına gelen hiçbir
çeviri yazılmaz. `MARKA.md`'nin terim karşılıkları (shoot, post,
entry, project, place…) için **her dilde sabit bir terim listesi**
çıkarılacak ve önce kullanıcıya gösterilecek.

### Çeviri kalitesi

⚠ Çeviriyi Claude yazacaksa bunu **açıkça söyleyecek** ve ana dili
konuşan biri gözden geçirmeden "tamam" demeyecek; "gözden
geçirilmedi" diye işaretlenecek.

### Boyut — eklemeden önce ve sonra ölçülecek

3 Eylül kaydı "sınır ~8-10 dil" diyor. Sekiz dille **sınırın
içindeyiz ama ucundayız.** ⚠ Sayfa boyutu eklemeden önce ve sonra
ölçülüp kullanıcıya **sayıyla** bildirilecek. Tahmin yazılmayacak.

### Dil seçimi ve varsayılan

Yeni kullanıcıda tarayıcı dili bu sekizden biriyse o dil açılacak,
değilse İngilizce. Seçim bulutta saklanıyor
(`testler/dil-bulut.test.js`); yeni kodla da çalıştığı test edilecek.

---

## 14 KASIM 2026 — AÇIK İŞLER (oturum yarıda kesildi)

### ⚠ ÖNCE BU: tam test koşusu yarıda kaldı

Koşu **32/197**'de durduruldu (kullanıcı bilgisayarını kapatacaktı).
O noktaya kadar kırmızı yoktu ama **165 test koşmadı**.
**Dönüşte ilk iş:** `bash testler/kosu.sh` — temiz çıkarsa aşağıdaki
iki commit `main`'e gönderilir.

### ⚠ `main`'e GÖNDERİLMEYİ BEKLEYEN İKİ COMMIT

| Commit | İçerik |
|---|---|
| `297c8dc` | Google ile giriş tek tıklamaya indi + `giris-donus.test.js` |
| `1690061` | Mekân kartları, giriş paneli, markadaki alt çizgi, devre dışı düğme kontrastı + `mekan-kart-yukseklik.test.js` |

İkisi de **`yedek/kahraman-yatay`** dalında GitHub'da duruyor; konteyner
kapansa bile kaybolmazlar. `main`'e push edilmedi çünkü `main` canlı
siteyi yayına alıyor ve koşu tamamlanmadı.

---

### (c) Renk paleti — Aşama 2 ve 3 canlıda, 4-7 kaldı

| Aşama | Ne yapılacak |
|---|---|
| **4** | Elle yazılmış **53 rengi** değişkene bağla. İçinde: fikir kartı etiketleri (altı renklik küme — tek tek değil küme olarak uyarlanmalı), mekân baş harflerinin hesaplanan rengi (`hsl(var(--mk-h) 45% 50%)`), pencere perdelerinin üç ayrı koyuluğu (`rgba(4,5,10,.8/.6/.45)`), 11 yerdeki `#fff`, `--green` dururken sabit yazılmış `#5FD9A0`. **Ayrıca yan menü paletteki kendi rengini alacak** (`#0B0C0D` / `#F2F2F3`); bugün `--surface` kullanıyor, yani yüzeyle aynı. ⛔ **Google'ın 13 logo rengine DOKUNULMAZ** (Drive ikonu, "Google ile giriş"). |
| **5** | `manifest.json` (`theme_color`, `background_color`), `<meta name="theme-color">` (app.html:9 ve 22863'teki JS), **`sw.js` önbellek sürümü** (`SURUM`). ⚠ Sonuncusu atlanırsa kullanıcıda eski renkler önbellekte takılı kalır. |
| **6** | `paylas.html` — kullanıcı kapsama aldı. `yonetim.html` ve `deneme.html` de eski palette; onlar sonraya bırakıldı. |
| **7** | `MARKA.md` "Görsel kimlik" bölümü — hâlâ **eski paleti** yazıyor (`#F1EDE3` / `#C4350A`). Metin önce kullanıcıya gösterilecek. |

**Palet (kullanıcı onaylı, "Kömür ve turuncu"):**

| | KOYU | AÇIK |
|---|---|---|
| zemin | `#0F1011` | `#FAFAFA` |
| yan menü | `#0B0C0D` | `#F2F2F3` |
| yüzey | `#17181A` | `#FFFFFF` |
| ikinci yüzey | `#1F2124` | `#EFEFF1` |
| çizgi | `#2A2C30` | `#E2E3E6` |
| metin | `#EDEEF0` | `#17181A` |
| soluk metin | `#9A9DA3` | `#5E6167` |
| vurgu | `#FF6B35` | `#C8400B` |
| vurgu üstü yazı | `#0F1011` | `#FFFFFF` |
| olumlu | `#4CC38A` | `#1E7A4E` |
| uyarı | `#F5B544` | `#8A5A00` |
| hata | `#FF6B6B` | `#B3261E` |

**Türetilenler (onaylandı, app.html'de uygulandı):** `--line-soft`
`#212429`/`#EEEFF1` · `--bekleyen` `#70757D`/`#8D9199` · `--accent-dim`
`#9196A0`/`#64686F` · `--accent-hover` `#FF8A5C`/`#A8340A` ·
`--accent-soft` `#32190D`/`#FDF1EB` · `--amber-soft` `#352A12`/`#FBF1DC`.
Platform renkleri **değişmedi** (sekizi de yeni zeminde en az 3,97).

---

### (b) Çanta ve Yapılacaklar — ✅ KOD YAZILDI (12 Kasım 2026)

⚠ **BU BÖLÜM 16 KASIM 2026'YA KADAR "başlamadı" DİYORDU — YANLIŞTI.**
Sekiz set 12 Kasım'da kodlandı: `app.html` içinde `LANG[dil].hset`,
**63 madde**, iki dilde, `testler/hazir-setler.test.js` bekçisiyle
(bir dilde eksik madde, donmuş grup başlığı, uçuş günü setinde sayı,
kullanıcının kendi verisine dokunma — dördünü de ölçüyor).

Bugünkü sekiz set (16 Kasım 2026'da koddan sayıldı):

| # | Türkçe | İngilizce | Çanta | Yap |
|---|---|---|---|---|
| 1 | Önceki akşam | The night before | 2 | 7 |
| 2 | Dış çekim | Outdoor shoot | 9 | 0 |
| 3 | Konuşmalı çekim | Interview | 5 | 4 |
| 4 | Telefonla çekim | Shooting on a phone | 3 | 7 |
| 5 | Kayda basmadan | Before you hit record | 0 | 8 |
| 6 | Çekimden sonra | After the shoot | 0 | 7 |
| 7 | Uçuş günü | Flying day | 3 | 2 |
| 8 | Soğuk ve ıslak | Cold and wet | 4 | 2 |

İki dilin çanta/yap sayıları birebir tutuyor. ⚠ **6. maddenin açık
kalan tek kısmı "düzeltilmiş adlar"** — hangi adın neye düzeltileceği
hiçbir yerde yazılı değil, kullanıcıya soruldu.

Aşağıdaki dört madde o günün notu; 1, 3 ve 4 hâlâ açık:

1. **Hava eşikleri** — kullanıcı önermemi istedi, "kamera ve telefonların
   yağmur/soğuk dayanıklılığına göre". ⛔ Doğrulanmadan sayı yazılmayacak.
2. **63 maddenin İngilizcesi** — koda koymadan önce tablo olarak
   gösterilecek (kullanıcının kuralı).
3. **Not alanı tasarımı** — "hazır sete bir not ya da yeni bir alet
   ekleyebilsin".
4. ⛔ **ÇÖZÜLMEMİŞ ÇELİŞKİ:** *"çekimden 4 saat önce"* hatırlatması
   **hesaplanamıyor** — projelerde yalnızca tarih var, saat yok
   (`/^\d{4}-\d{2}-\d{2}$/`, app.html:9453). Ya saat alanı eklenecek
   ya hatırlatma yeniden tanımlanacak. **Karar kullanıcıda.**

---

### Karar bekleyen üç şey

- **Ödeme.** Lemon Squeezy Türkiye'ye banka havalesiyle ödüyor; Stripe'ın
  kendi ülke listesinde Türkiye yok; PayPal da yok. Tek yol banka
  havalesi. Git/gitme kararı kullanıcıda.
- ✅ **`MARKA.md` 49. satır KAPANDI — iddia doğruydu, ben yanlıştım.**
  *"senin adına hiçbir yere gönderi atmaz"* satırı iki kez "yanlış
  iddia" diye bildirildi. Değil. 15 Kasım 2026'da kullanıcı düzeltti:
  otomatik yayın **yalnızca kendi hesabı için**, kendi bilgisayarındaki
  `pc/story-yukle.py` ile kurulu; **kullanıcılara açılmadı ve
  açılmayacak.** Yani ürün gerçekten kimsenin adına gönderi atmıyor ve
  satır olduğu gibi kalıyor. Kural `CLAUDE.md` Bölüm 5'e yazıldı ki
  üçüncü kez sorulmasın.
- ✅ **`privacy.html` Open-Meteo'yu artık anıyor (15 Kasım 2026).**
  Servis tablosunun **hem İngilizce hem Türkçe** sürümüne satır
  eklendi: koordinat **iki ondalığa yuvarlanmış** (≈1 km) ya da
  yazdığın yer adı gidiyor; hesap, anahtar ve çerez yok. Satır
  Cloudflare R2'den **önceye** konuldu, böylece tablonun altındaki
  "son beş" cümlesinin saydığı beş satır bozulmadı.
  ⚠ **Ders:** bu iş sırasında "privacy.html'in Türkçesi yok" diye
  yanlış bildirdim. Var — sayfa İngilizce bölümden sonra Türkçe
  bölümü taşıyor (iki `<h1>`, 89. ve 302. satır). `sartlar.html` de
  öyle. Yanlışın sebebi: başlık aramasını `head -8` ile kestim ve
  ikinci dili hiç görmedim. **Dosyanın tamamına bakmadan "yok"
  demeyin** (Bölüm 4'ün tekrarı).

---

### Daha önce ertelenmiş, duruyor

- Giriş anında **veri taşınmıyor**: mekânlar, fikirler, scriptler hesaba
  geçmiyor.
- Yönetim fonksiyonunda **kalıcı hız sınırı ve iki adımlı doğrulama** yok.
- "Basitleşme + yedi adım" çalışması.
- `calisma` dalı `main`'in gerisinde.

---

## "TELEFONA KUR" DÜĞMESİ — 1. AŞAMA BİTTİ (15 Kasım 2026)

İş planlama/tasarım sohbetinden geldi. Dört aşama, her biri ayrı onayla.

### Kurulabilirlik: hazır ✅
`manifest.json` şartları karşılıyor (`display:standalone`,
`start_url:./app.html`, 192 ve 512 simgeler, `any` + `maskable`),
dosyalar yerinde, `sw.js` kayıtlı (app.html:23213).
⛔ **Kurulum düğmesi yok**: `beforeinstallprompt`, `appinstalled`,
`display-mode` kontrolü — hiçbiri.

### Tarayıcı tablosu (kaynaktan doğrulandı)
Chrome (Android/masaüstü) · Edge 79+ · Samsung Internet 8.2+ → tek
dokunuşla kurulum var. **Safari (iPhone/iPad/Mac) ve Firefox → yok.**
iPhone'da Chrome da yok (iOS'ta bütün tarayıcılar Safari motorunu
kullanıyor). Chrome'un kendi belgesi "çalışmayan kurulum düğmesi
gösterme" diyor — brief'teki "ölü düğme olmaz" şartıyla aynı.

⚠ `navigator.install()` / HTML `<install>` öğesi deneme aşamasında
(origin trial 153'te bitiyor). **Şimdilik kullanılmayacak**;
`beforeinstallprompt` bugün her yerde çalışıyor.

### ⛔ Apple tarifi: araştırma sohbetinin çizdiği YANLIŞTI
Apple'ın kendi sayfalarından alındı (*Bookmark a website in Safari*,
iPhone ve iPad; iOS 27 sürümü):

**iPhone:** `Tap ⟨the Page Menu button⟩, then tap Share.` —
*"If your Tabs layout is Bottom or Top, tap ⟨the Share button⟩"* →
`Scroll down the list of options, then tap Add to Home Screen.` → `Tap Add.`

**iPad:** `While viewing the website, tap ⟨simge⟩, tap View More, then
tap Add to Home Screen.`

Farklar: ayrım "beş düğme mi üç nokta mı" DEĞİL, **"Tabs layout" ayarı
Bottom/Top mı değil mi**. Apple iki düğme adı veriyor: *Page Menu
button* ve *Share button*. **iPad'de fazladan "View More" adımı var.**
Apple ayrıca: *"If you don't see Add to Home Screen… tap Edit Actions"*.

### 🔑 "Open as Web App" — tarife GİRECEK (kullanıcı kararı)
Apple'ın ayrı sayfası var (*Turn a website into an app*) ve ekleme
sırasında açılan bir anahtar:
> *"Turn on Open as Web App. … When you tap the icon, the website opens
> just like an app. **You can receive notifications from the web app**"*

⚠ **iPhone'da bildirim almanın yolu bu anahtar.** Push işi buna bağlı.

### Doğrulanamayanlar (uydurulmayacak)
- Paylaş düğmesinin **fiziksel yeri** (üst mü alt mı): Apple metinde
  yazmıyor, satır içi simge resmiyle gösteriyor. "iPad'de sağ üstte"
  ezberi **doğrulanmadı**.
- Safari dışı tarayıcılar hakkında Apple bu sayfalarda bir şey demiyor.
- **Menülerin Türkçe adları** doğrulanmadı.
- ⚠ Gerçek bir iPhone/iPad'de denenemiyor; şemalar çizilince
  kullanıcıdan kendi cihazında kontrol etmesi adım adım istenecek.

### Kullanıcının verdiği üç karar (15 Kasım 2026)
1. **Düğme çerçevesi: A — nötr** ("Giriş yap" gibi). Vurgu rengi
   "+ Yeni Giriş" gibi asıl işe ait kalsın.
2. **Hesapsız ziyaretçiye de görünecek.** Demo hesapsız çalışıyor ve
   değerinin yarısı o; ana ekrana ekleyen kişi geri dönme ihtimali en
   yüksek kişi.
3. **iPhone'da İKİ şema birden** alt alta çizilecek (Page Menu yolu ve
   doğrudan Paylaş yolu), çünkü hangi "Tabs layout" ayarının açık
   olduğu koddan güvenilir şekilde anlaşılamıyor.

### Kalan aşamalar
2. Android ve masaüstü düğmesi (yan menü + "⋯" çekmecesi)
3. iPhone/iPad tarifi ve şemaları (önce şemalar gösterilecek)
4. Kılavuz metinleri (`kilavuz.html`, `guide.html`) — metin önce gösterilecek

Bu işten SONRA: **push bildirimi fizibilite raporu**.

---

## MEKÂNLAR SAYFASI — KARTLAR SABİT BOYDA OLACAK (15 Kasım 2026)

Kullanıcı ekran görüntüsüyle bildirdi: *"mekanlar sayfasında da buraya
biz izin notu eklenirse yine kutu büyüyor. Bu kutular da sabit
büyüklükte olmalı."*

Görüntüde net: `Balıklı Meryem Ana Rum Manastırı` ve `Kin Kapısı`
kartlarında izin/dikkat notu açık ve o kartlar diğerlerinden belirgin
şekilde uzun; satırın tamamı onlara göre esniyor.

⚠ **Bu, 14 Kasım'da yapılan işin EKSİK kalan yarısı.** O gün `.mk-foy`
(not gövdesi) 132 pikselle sınırlandı ve "Devamı" düğmesi eklendi — ama
**kartın kendisi** sabitlenmedi. Not bloğu eklendiğinde kart yine
büyüyor.

Yapılacak, takvim kutularında yapılanın aynısı:
- Kart yüksekliği sabit (ölçülerek bulunacak, tahmin edilmeyecek).
- Notu olan ve olmayan kartlar **her zaman aynı boyda**.
- Taşan not "Devamı" ile açılır; açılış **kullanıcının** işi, kendiliğinden
  olan bir esneme değil.
- Üç ekran boyunda ölçülecek (masaüstü, tablet, telefon).

⛔ Takvim işinde iki tuzak yaşandı, burada da beklenir:
1. Sınıf yalnızca *bazı* kartlara ekleniyorsa `:not()` kuralı ötekileri
   serbest bırakır (takvimde hücreler 39 ve 192 diye iki boy çıkmıştı).
2. Yükseklik **tahmin edilmeyecek**: takvimde 192 yazıldı, içerik 195
   istiyordu ve üçüncü kutunun altı kırpıldı.

---

## ⛔ app.html'DE CSS YAZARKEN: EŞİT ÖZGÜLLÜK + SONRAKİ KURAL = SESSİZ KAYIP

15 Kasım 2026'da **beş kez** aynı tuzağa düşüldü. `app.html` 24 bin
satır ve aynı öğeye bakan kurallar dosyanın çok farklı yerlerinde.
Eşit özgüllükte iki kural varsa **dosyada SONRA gelen kazanır.**

| Yazılan | Nerede kaybetti | Belirti |
|---|---|---|
| `.hg-chip{flex:0 0 ...}` | `.cal-chip{flex:1}` daha sonra | Kutu 40 değil 82 px |
| `.cal-day .cal-chip{grid-...}` | ay kuralları 2112'de | Saat şeridinin **rengi** tuttu, **yerleşimi** tutmadı |
| `.rail-kur{display:none}` | bir sınıf kuralı sonra | Telefonda düğme hem şeritte hem çekmecede |
| `.s-metin-vurgu{fill:...}` | `.s-metin{font:...}` sonra | Vurgulu satır gri ve ince kaldı |
| `.wordmark{font-size}` (13 Kasım) | aynı seçici sonra | Marka "Shoot..." diye kesildi |

**Kural:** `app.html`'de bir öğeye kural yazmadan önce
`grep -n '<seçici>' app.html` ile **bütün** kurallarını çıkar. Kendi
kuralın en sondaki değilse **özgüllüğü yükselt**:
- sınıf ekle (`.hour-grid .hg-chip`)
- öğe adı ekle (`text.s-metin-vurgu`)
- kimlik kullan (`#kurBtn`) — kimlik her sınıfı yener

⚠ **En sinsi belirti:** kuralın bir KISMI tutar, bir kısmı tutmaz.
Ay görünümünde saat şeridinin rengi geçti ama yerleşimi ezildi, çünkü
ezen kural `background` yazmıyordu. "Yarısı çalışıyor" görürsen önce
özgüllüğe bak.

⚠ `font:` ve `padding:` gibi **kısayollar** yazılmayan alt özellikleri
de sıfırlar. `font:10px ...` yazan bir kural `font-weight`'i de ezer.

---

## KOŞU SÜRERKEN BOŞ DURMA (15 Kasım 2026, kullanıcı kuralı)

> *"bundan sonra bekleme gerektirmeyen ve app.html ve index.html'i
> değiştirmeyecek işleri testler devam ederken yapman. Bu şekilde en
> azından biraz zaman kazanırız"*

Tam koşu 30-40 dakika sürüyor. O sürede yapılabilecekler:

| Yapılabilir | Yapılamaz |
|---|---|
| Araştırma (web, Apple/MDN belgeleri) | ⛔ `app.html` ya da `index.html` değiştirmek |
| `YAPILACAKLAR.md` ve öteki belgeler | ⛔ Uygulamayı tarayıcıda açıp ekran görüntüsü almak |
| Yeni dosya üretmek (şema, önizleme, test dosyası) | ⛔ 8097/8098/8099 portlarına sunucu kurmak |
| Kod okumak, plan çıkarmak, ölçüm betiği yazmak | ⛔ Testlerin okuduğu herhangi bir dosyayı değiştirmek |
| Commit ve yedek dala push | |

⚠ Sebep: testler `app.html`'i **diskten** okuyor; koşu sürerken
değiştirmek ölçümü kirletir. Port kuralı için bir üstteki bölüme bak.

---

## ⛔ 8097 / 8098 / 8099 PORTLARI TESTLERİN — EKRAN GÖRÜNTÜSÜ İÇİN KULLANMA

15 Kasım 2026'da tam koşuda `duzeltme.test.js` kırmızı verdi. Kırmızı
**gerçek değildi**: ekran görüntüsü almak için 8099'a kendi sunucumu
kurmuştum ve o port testlerin.

`testler/kosu.sh` satır 28 bunu zaten yazıyor:
> 8098 = depo kökü · **8099 = lokasyon uygulaması** (`index.html`
> → `lokasyon.html`) · 8097 = eski anlık görüntü

`duzeltme.test.js` `http://127.0.0.1:8099/index.html` açıyor ve
lokasyon uygulamasını bekliyor; benim sunucum depo kökünü sunduğu için
ana sayfa geldi ve test düştü.

⛔ **Ekran görüntüsü / ölçüm sunucuları 8101 ve üstünü kullanacak.**
Koşu sürerken bu üç porta hiçbir şey kurulmayacak.

⚠ Kirlenen koşu güvenilmezdi: 1-56 arası testler o pencerede koştu.
Koşu durdurulup baştan başlatıldı.

---

## 15 KASIM 2026 — TEST KOŞTURMA DÜZENİ (kullanıcı onayladı)

Kullanıcının isteği, planlama sohbeti üzerinden geldi: *"her adımda
bütün testleri beklemek uzun sürüyor."* Tam koşu ~30-45 dakika.

⚠ Önce çelişki kontrolü yapıldı: `testler/README.md` yalnızca testlerin
NASIL koşturulacağını anlatıyor, NE ZAMAN koşturulacağına dair kural
koymuyor; `CLAUDE.md`'de de test sıklığı kuralı yok. **Çelişki yok.**

| Ne zaman | Ne koşar |
|---|---|
| Küçük değişiklikten sonra | Yalnızca ilgili testler. **Hangileri seçildi ve neden yeterli olduğu bir satırla yazılır.** |
| **Yedek dala** commit | Hedefli koşu yeter — yedek bir güvenlik ağı, teslim değil |
| ⛔ **`main`'e göndermeden önce** | **BÜTÜN testler.** `main` canlı siteyi yayına alıyor. |
| Bir aşamayı "bitti" diye raporlamadan önce | **BÜTÜN testler** |
| Para/hesap (fiyat, ödeme, yönetim), veri yapısı, eşitleme, yedek ve geri yükleme | **Her seferinde BÜTÜN testler** |

⛔ **Kısmi koşu asla "bütün testler geçti" diye raporlanmaz.** Her
raporda **kaç test koştu, kaç tanesi koşmadı** yazılır.

⚠ Bunun değeri aynı gün görüldü: "8 geçti, 0 kaldı" diye rapor edilen
bir koşuda `ay.test.js` ve `hafta.test.js` **hiç koşmamıştı** — filtreye
`ay.test` yazılmıştı ama `kosu.sh` dosya adından `.test.js`'i atıp
kalanla eşleştiriyor, yani ad `ay`. Tam eşleşme seçeneği yok; geniş
eşleşen bir ad verildiğinde (`ay` → `yayin`, `paylas`...) beklenenden
çok daha fazla test koşuyor.

⛔ **Testleri zayıflatmak, silmek ya da atlatmak bu düzenin parçası
DEĞİL.** Değişen yalnızca hangi testin ne zaman koştuğu.

---

## 15 KASIM 2026 — GÜVENLİK DENETİMİ ve DEPO KARARI

### ⏰ TARİHLİ İKİ İŞ

**1. İki adımlı doğrulama — ✅ ZATEN KURULU.**
GitHub hesabında (`gerceginizleritv`) 24 Kasım 2026 son tarihli bir
uyarı şeridi görünüyordu; kullanıcı 15 Kasım'da *"2FA kurulmuştu
zaten"* dedi. Yapılacak bir şey yok. ⛔ Tek hatırlatma: kurtarma
kodları saklanmış olmalı (Drive ya da şifre yöneticisi) — telefon
kaybolursa hesaba yalnızca onlarla girilir.

**2. GitHub Pro — KARAR VERİLDİ, ödeme şirket kurulunca.**
Kullanıcının kendi sözleriyle: *"Pro kararımı verdim. Ama bir kaç gün
sonra şirketim kurulmuş olacak. Burada harcadığım ödemelerin faturasını
alıp şirketime masrafa göstereceğim için bir kaç gün bekleyecek."*

Doğrulanan bilgiler (ekran görüntüsünden, 15 Kasım 2026):
- **Pro kişisel hesapta var, $4 USD/ay** (yılda ~$48).
- "Collaboration → Pages and wikis" satırı: Free'de *Public
  repositories*, **Pro'da ✓** — yani kapalı depodan da site yayınlanıyor.
- ⛔ **Organizasyona taşımak GEREKMİYOR.** Daha önce "Team planı lazım,
  depo organizasyona taşınmalı" diye yazılmıştı; o YANLIŞTI. Depo
  adresi, `gerceginizleritv.github.io` adresi ve Google anahtarının
  kısıt listesi olduğu gibi kalıyor.

Ödeme yapılmadan önce: **fatura şirkete kesilsin diye GitHub'ın
faturalama bilgilerine şirket adı ve vergi numarası girilmeli** — ilk
ödemeden ÖNCE, yoksa fatura şahsa çıkar.

Pro alındıktan sonra yapılacak: depoyu private yap (Settings → General
→ Danger Zone → Change visibility). Sonra sitenin hâlâ açıldığı
doğrulanacak.

### 🔒 GÜVENLİK DENETİMİ — YAPILDI, TEMİZ

| Kontrol | Sonuç |
|---|---|
| 573 commit'te gizli anahtar/token | **Yok** — JWT, OpenAI, GitHub, AWS, Slack, özel anahtar: hiçbiri |
| Supabase anahtarı | `sb_publishable_…` — istemci kodunda durmak için tasarlandı, sorun değil |
| 27 tablo — RLS | **Hepsinde açık** (`calendar_events` dahil; kullanıcı Supabase'te doğruladı) |
| Sınırsız politika var mı | **Yok.** Açık olan tek şey fiyat tabloları (`plans`, `plan_prices`, `plan_limits`, `tax_settings`) ve `founding_seats` kontenjan sayacı — hepsi bilerek |
| `workspaces` tablosu | Alarm **yanlıştı**: INSERT koşulu `with_check`'te duruyor ve `owner_id = auth.uid()` diyor; anonim kimse ekleyemez |
| Depolama kovaları | Yedek kovası **kapalı**; `paylasim` ve `takvim` açık ama tahmin edilemez jetonla korumalı |
| 7 Edge Function | Hepsi yetki istiyor (401/403) |
| CI akışları | Sır sızdırmıyor |

⚠ **Bir ders:** ilk RLS taramam dokuz tabloyu "RLS yok" diye
işaretledi. **Yanlıştı** — SQL'de hizalama için çoklu boşluk kullanılmış
(`alter table public.ideas   enable row level security;`) ve tek boşluk
arayan desenim kaçırdı. Aynı şekilde `workspaces` alarmı da desen
hatasıydı. Tarama sonucu, deseni doğrulanmadan rapor edilmemeli.

### ⛔ SİLİNDİ: açıkta kalmış eski Google anahtarı

`AIzaSyCpvL…` ile başlayan anahtar 2 Eylül'de koda konmuş, 13 Eylül'de
yenisiyle değiştirilmiş (commit `05ecb09`) ama **git geçmişinde kalmıştı**
ve depo herkese açık. Eski proje numarası: **600126485767**.
**Kullanıcı 15 Kasım 2026'da sildi.** ✅

Kullanımdaki anahtar (proje **1050310663036**) kontrol edildi:
Application restrictions = **Websites**, listede
`https://gerceginizleritv.github.io/*` ve `https://shootboard.app/*`.
`CNAME` zaten `shootboard.app` (www'suz), yani liste yeterli. ✅

### Bilinmesi gereken: `app.html` HER DURUMDA açık

Shootboard bir tarayıcı uygulaması; `app.html` siteyi açan herkesin
tarayıcısına iniyor. **Depoyu kapatmak onu gizlemez.** Pro'nun gizlediği
şeyler: `sql/` (şema ve RLS politikaları), `supabase/functions/`
(sunucu kodu), `docs/` ve `YAPILACAKLAR.md` (iş planı), `testler/`, ve
**573 commit'lik git geçmişi**.

⚠ Daha önce "GitHub Pro hem kodu hem belgeleri kapatır" yazılmıştı;
**o yanlıştı**, yalnızca yarısı doğru.

---

## 14 KASIM 2026 — PLANLAMA SOHBETİNDEN GELEN LİSTE

Kullanıcı planlama sohbetinin (ChatGPT) durum raporunu buraya getirdi
ve "listemizde olmayanları ekle" dedi. Aşağısı o karşılaştırma.
⚠ Rapor **o sohbetin bildiği kadarıyla** yazılmış; geliştirme
tarafında neyin bittiğini göremiyor. Üç yerde yanlış biliyor, bölüm
B'de düzeltildi.

### A. Listemizde OLMAYAN işler — eklendi

**Fiyat tarafı (hepsi BÖLÜM 2'ye bağlı, bu dosyada aşağıda):**

1. **Kıyaslama tablosu.** `starter-pro-kiyaslama-v2.xlsx` — sarı
   Starter sütununda olmaması gerekenlere "Yok" yazılacak.
   **Kullanıcının kendi işi**; fiyat promptunun girdisi. Planlama
   sohbeti dolduğunda tabloyu kesinleştirip fiyat sayfası için 8-10
   satırlık özet önerecek.
2. **Fiyat promptuna girecek yeni kararlar** (planlama sohbeti
   yazacak, ama uygulamada **kota olarak zorlanacağı** için bizi de
   bağlıyor): script sınırı **2** · AI **tamamen Pro'da** · hazır
   setler sınıra **sayılmıyor** · **Studio / Agency sütunu yok** ·
   PDF/CSV dışa aktarma **satılamaz**.
3. **TRY fiyatları kesinleşmedi.** Köşeli parantezle verilenler:
   320, 250, 1.050, 850, 2.450. ⛔ Bu sayılar **doğrulanmadı**,
   yalnızca aktarıldı — hangi satır hangi pakete ait, burada belli
   değil.
4. **KDV dahil mi + fatura programı.** İkisi için **mali müşavire
   danışılacak**; buradan cevaplanamaz.
5. **TRY fiyatını kim alabilir?** Ülke / para birimi kuralı.
6. **Bugün ücretsiz giriş yapmış hesaplara ne olacak?** Geçiş
   kuralı. (Ödeme sağlayıcısı kararı zaten yukarıda, "Karar bekleyen
   üç şey" içinde.)

**Ürün tarafı:**

7. **PDF / CSV dışa aktarma — yapılsın mı, stratejiden mi çıksın?**
   ✅ **Doğrulandı:** uygulamada PDF ve CSV dışa aktarma **yok**.
   Olan tek şey JSON yedek (`#exportBtn` → `shootboard-yedek-*.json`,
   app.html:19283). Yani raporun "uygulamada yok" tespiti doğru.
   `CSV / Google Sheets` bu dosyada **içe** aktarma olarak geçiyor
   (Öncelik 2), dışa aktarma hiç yoktu.
8. **Push bildirimi fizibilitesi** — bölüm C'de cevaplandı.
9. **İki dilde paylaşım.** Türkçe ve İngilizce videoları aynı
   hesapta nasıl paylaşacağımız. Kullanıcı *"ayrıca konuşalım"*
   demiş, konuşulmamış; bu dosyada da hiç yoktu.

**Bize bağlı olan, planlama sohbetinin işleri** (yapan onlar, ama
kilidi biz açıyoruz — kayda geçiyor ki beklediği şey unutulmasın):

10. **Tanıtım videosu** gerçek ekran görüntüsü bekliyor; görüntüler
    **renk işi bitince** alınacak. Uygulama rengi değişince videonun
    renklerine de bakılacak.
11. **Videonun kalan sürümleri** (İngilizce, yatay, uzun). İngilizce
    açılış için Flow'da **12 kredilik** yeni klip gerekiyor;
    harcamadan önce sorulacak.
12. **İlk altı Reels senaryosu.** Strateji hazır, senaryolar
    yazılmadı. **"AI tamamen Pro'da"** kararı Gemini Reels'ını
    etkiliyor.
13. **30 günlük Instagram planı** hazır; başlangıç tarihi
    **tasarımın yayına girmesine** bağlı.

Yani (c) Aşama 4-7 bu üç işi de kilitliyor.

**Sıra önerisi (planlama sohbetinden):** renk → çekim setleri →
basitleştirme → **en son** fiyatlandırma. Gerekçe: hepsi `app.html`'e
dokunuyor, ikisi aynı anda verilmeyecek. Bu sıra bizim elimizdeki
sırayla uyumlu.

### B. Planlama sohbetine düzeltilecek üç şey

1. **"Renk paleti — verilmedi sanıyorum" YANLIŞ.** Prompt verildi ve
   **yarısı canlıda**: Aşama 2 (koyu tema) ve Aşama 3 (açık tema),
   19 değişken × üç blok, `main`'de. Ölçüldü: iki temada da sekiz
   ekranda **0 zayıf kontrast**, ve eski açık temanın **4 gerçek
   hatası** bu arada kapandı. Kalan: Aşama 4-7 (yukarıda).
2. **"Bej kâğıt rengi logoda ve klaket şeridinde kalsın mı?" sorusu
   kodda zaten cevaplanmış** — ayrı bir karar gerekmiyor.
   Logo SVG'si (app.html:3670) ve klaket şeridi (`body::before`,
   app.html:124) renklerini **değişkenden** alıyor: `var(--text)`,
   `var(--accent)`, `var(--bg)`, `var(--text-dim)`, `var(--amber)`.
   Yani palet değişince ikisi de kendiliğinden yeni palete geçti.
   Bej `#F1EDE3` **tek bir yerde** kaldı: `app.html:22940`
   theme-color meta'sı — o da (c) **Aşama 5**'in işi. Soru "kalsın
   mı" değil, "Aşama 5 yapılınca gidecek".
3. **"Çekim setleri — üzerinde çalışıyor" DEĞİL: başlamadı.** Dört
   soru cevap bekliyor (hava eşikleri · 63 maddenin İngilizcesi ·
   not alanı tasarımı · ⛔ *"çekimden 4 saat önce"* hesaplanamıyor,
   çünkü projede yalnızca tarih var, saat yok). Ayrıntı yukarıda,
   "(b) Çanta ve Yapılacaklar".

### C. Push bildirimi — fizibilitenin doğrulanabilen kısmı

Rapor *"hesapsız kullanıcıda ve iPhone'da çalışıp çalışmadığı belli
değil"* diyor. İkisi de cevaplanabiliyor.

**iPhone: çalışıyor, ama şartlı.** Kullanıcının Shootboard'u **ana
ekrana eklemesi şart**; yoksa iOS hiç bildirim göndermiyor. Bu zaten
bu dosyada yazılı ("Yapılacak 2 — Tarayıcı bildirimi") ve
uygulamanın kendi metninde de söylüyor (`rm_ch_browser_lead`).

⛔ **Hesapsız kullanıcı: zamanlanmış push İMKÂNSIZ.** Sebebi veri
değil mimari: `saveProjects()` (app.html:9566) yerel kopyayı **her
zaman** yazıyor ama sunucuya yalnızca `if(session)` gönderiyor.
Hesapsız kullanıcının terminleri Supabase'e **hiç ulaşmıyor**; sunucu
tarafında zamanlanmış bir iş neyi hatırlatacağını bilemez. Hesapsızda
çalışan tek şey bugün de olan şey: **uygulama açılırken** bildirim.

**Bugün ne var:** izin isteme ve uygulama açıkken bildirim
(app.html:22556 ve 22575) çalışıyor; `sw.js:120` gelen bir push'u
gösterebiliyor. Eksik olan **gönderim tarafı**: Edge Function +
zamanlanmış görev + VAPID. Bu dosyadaki tabloda da öyle yazıyor
("Kim yapar: Claude yazar, KULLANICI kurar").

⛔ Maliyet/sayı yazılmadı — doğrulanamıyor.

### D. Bir çelişki: "AI tamamen Pro'da" ile "başka AI sağlayıcı"

"AI tamamen Pro'da" kararı, bu dosyadaki **"BAŞKA BİR AI SAĞLAYICI
(ChatGPT / Claude)"** bölümünün gerekçesiyle çarpışıyor. O bölümün
dayanağı **erişilebilirlik**: Gemini ücretsiz anahtar veriyor, kart
istemiyor, tarayıcıdan çağrılabiliyor. Ama AI ücretsiz katmanda hiç
görünmeyecekse "ücretsiz anahtar" gerekçesi zayıflıyor; buna karşılık
Pro kullanıcısının elindeki anahtar Gemini'nin olmayabilir, yani
ChatGPT/Claude desteği **daha** önemli hale geliyor.

İkisi aynı turda karara bağlanacak. (Aşama 5'in "AI taslak üretme —
SONA" kararı da aynı tura bakıyor.)

---

## AŞAMA 5 — PLAN LİSTESİ: ALINAN KARARLAR
## 12 Kasım 2026 — kod yazılmadan önce

Henüz **tasarım belgesi** aşamasında; kod yok. Üç soru soruldu, üçü
de cevaplandı.

### 1. İngilizce ad çakışması — ÇÖZÜLDÜ

Uygulamada zaten "Çekim listesi" var: çekime **götürülecekler**
(malzeme, izin). MARKA.md sözlüğünde İngilizcesi **"shot checklist"**.
Yeni gelen "plan listesi" ise **çekilecek planlar** — İngilizcede tam
karşılığı "shot list". İkisi İngilizce arayüzde ayırt edilemeyecek
kadar benziyordu. Türkçede sorun yok.

**Karar:** yeni liste İngilizcede **"Shot list"**, eskisi
**"Kit & prep"** olur. Türkçe hiçbir ad değişmiyor.

Dokunulacak yerler (Grep ile çıkarıldı, kullanıcıya listelendi):

| Dosya | Ne |
|---|---|
| `app.html` | `cl_title`, o anahtarın HTML yedek metni, `bugun_eksik_liste` |
| `guide.html` | içindekiler bağlantısı + bölüm başlığı |
| `MARKA.md` | sözlük satırı + yeni "shot list" satırı |

⛔ **Değişmeyecekler:** Türkçe metinlerin hiçbiri · bölüm kimliği
`cekim-listesi` (iki kılavuzda da; `kilavuz.test.js` "bölüm
kimlikleri birebir aynı" diye ölçüyor) · öğe kimlikleri · testler.

**Hiçbir test İngilizce adı okumuyor** — arandı ve doğrulandı.
`proje-tek-pencere` ve `proje-rozet` "Çekim listesi" geçiriyor ama
yorumda ya da Türkçe tarafta, ikisi de öğe kimliğiyle çalışıyor.

**Eski kullanıcı nereye bakacak:** ad değişiyor, **yer ve düğme
değişmiyor** — aynı proje penceresi, aynı düğme. Türkçe kullanan
hiçbir şey fark etmeyecek.

### 2. Script bölümü bağlantısı — İŞARET

Belge "bağlantı; numara değil" diyor ama script bugün düz metin,
bölüm diye bir şey yok. Üç seçenek soruldu.

**Karar: script'in İÇİNE kullanıcının koyduğu işaret** (örnek satır
başında `## Giriş`). Plan o işarete bağlanır; script düzenlenince bağ
kopmaz çünkü işaret metnin içinde taşınır.

⛔ **Paragraf sırası ELENDİ:** araya bir paragraf eklenince bütün
bağlar kayardı ve bu **sessiz** olurdu — plan yanlış bölümü
gösterir, hiçbir yerde hata çıkmaz.

### 3. AI taslak üretme — SONA

Belge "Gemini anahtarı olanlara script'ten taslak plan listesi"
diyor. **Karar: Aşama 5'e girmiyor.** ChatGPT/Claude bağlama işiyle
aynı turda ele alınacak ki üç sağlayıcı için tek seferde tasarlansın
ve Gemini'ye özel bir yol açılmasın.

### Belgeden gelen, henüz tasarlanmamış parçalar

· İki görünüm, tek liste: **yazarken** script sırasına göre,
  **sette** mekana göre ve çekilmeyenler üstte.
· Tek dokunuşla eklenen hatırlatmalar (mekan başına): geniş plan ·
  orta plan · yakın plan · geliş/ayrılış · kameraya konuşma ·
  30 saniye ortam sesi · kapak fotoğrafı · dikey sürüm.
· Bugün sayfası: "çekimden önce eksik" bölümüne "plan listesi yok".
· Mekandan ayrılırken: çekilmeyen **olmazsa olmaz** varsa uyarı.
· Alanlar: açıklama, tür (konuşma/ek görüntü/ekran kaydı/fotoğraf),
  mekan, script bölümü, çekildi işareti — zorunlu; olmazsa olmaz,
  not, dikey de çek — isteğe bağlı.
· ⛔ **Bilerek YOK:** lens, kare hızı, açı, kamera hareketi, sahne
  numarası, süre tahmini. Bunlar ekip için; tek kişilik üreticiye yük.

⚠ Ayrıca Aşama 3'te yapılamayan bir şey buraya bağlı: ışık bilgisinin
"plan listesinin sette görünümü"nde gösterilmesi. O liste bu aşamada
doğacak.

---

## AŞAMA 0 — PLATFORM BAŞINA ETİKET: YAPILMAYACAK
## 12 Kasım 2026 — kullanıcı kararı

⛔ **Bu iş iptal edildi.** Kullanıcının kendi sözleriyle:

> *"aşama 0'ı atla burada değişiklik yapmama kararı verdim. Çünkü
> zaten konu ile ilgili konulacak etiketler genel olarak aynı post
> için birbirine benziyor."*

### ⚠ Bu, AYNI GÜN verilmiş bir kararı geri alıyor

Aynı gün daha önce kullanıcı "Platform başına ayrı üret" demiş ve
tasarımını da anlatmıştı:

> *"Kullanıcı Instagram için kayıt açıyorsa ona karşısına Instagram
> etiketleri alanı çıkacak, başka SM kaydı açıyorsa o alan çıkacak.
> Copy yaparsam kaydı zaten copy yaptığı kayıttan başka bir SM kanalı
> seçecek o kanalı seçtiğinde de ilgili alan değişir ve seçtiği alan
> gelir."*

O tasarım **veri yapısına dokunuyordu**: etiketler tek bir alanda
duruyor, platform başına ayrılması kaydın şeklini değiştiriyordu — ve
o alanın `sanitizeEvent`, `toRow`, bulut eşitleme, yedek, dışa
aktarma, paylaşım bağlantısı ve MCP yollarından ayrı ayrı geçmesi
gerekiyordu. (12 Kasım'da Aşama 2'de ölçüldü: `sanitizeEvent`
tanımadığı alanı **sessizce düşürüyor**.)

Kullanıcının gerekçesi bunu gereksiz kılıyor: aynı paylaşımın
etiketleri platformdan platforma zaten büyük ölçüde aynı.

### Bugün ne var

Tek bir etiket alanı, bütün platformlar için ortak. Değişmiyor.

### Geri dönülürse ne lazım

Karar değişirse iş küçük değil: veri yapısı + yedi geçiş yolu + göç
(mevcut kayıtların tek alanı platform başına nasıl dağılacak, kayıp
olmadan). Önce tasarım belgesi yazılmalı.

⚠ Instagram'ın "en çok beş etiket" kuralı HÂLÂ DOĞRULANMADI. Aşama
2'de yayın günü listesine yazıldı çünkü kullanıcının verdiği
belgeden geliyor; birinci elden doğrulanmadı. Instagram yardım
sayfası JS ile çiziliyor ve bot kapısı var; tarayıcı kimliği taklidi
denendi ve DOĞRU OLARAK reddedildi. YouTube'un 60 etiket kuralı
doğrulandı.

---

## BASİTLEŞME ve YEDİ ADIM — SIRADAKİ İŞ, HENÜZ BAŞLANMADI
## 12 Kasım 2026

⛔ **Bilerek başlanmadı.** Kullanıcı promptu verirken kendi sözleriyle
şunu dedi:

> *"Bunu başladığın geliştirmeler bittikten sonra üzerine konuşacağız.
> Yapılacaklar gibi düşünebilirsin."*

Yani bu iş, altı geliştirme (Aşama 0-5) bitmeden açılmayacak. Promptun
kendisi de ilk cevapta hiçbir dosyanın değiştirilmemesini istiyor:
**önce plan, sonra kod**, her aşama ayrı onay.

### ⚠ BAŞLAMADAN ÖNCE OKUNAMAYAN BİR DOSYA VAR

Prompt şunu okumamı istiyor:

    E:\SLATE\shootboard-video\urun-plani-v1.md  (Bölüm 4 ve 5)

Bu dosya **depo dışında** ve bu oturum bulutta koşuyor; o diske
erişimim yok. Promptun kendi kuralı: *"okuyamazsan TAHMİN ETME, DUR ve
kullanıcıya yaz."* Yazıldı. İş başlayınca kullanıcının o dosyanın
içeriğini sohbete yapıştırması ya da depoya koyması gerekiyor —
öneriler (Bölüm 4) ve yedi adım seçenekleri (Bölüm 5) oradan geliyor.

### İş ne

**A — Basitleşme.** Yeni gelenin ilk dakikası ve günlük kullanımın
yükü azalacak. ⛔ **Özellik SİLİNMEYECEK**: sıralanacak, katlanacak,
ihtiyaç anında görünecek. Ayar ekleyerek ("basit mod / gelişmiş mod")
basitleştirmek de yasak — karmaşıklığı kullanıcıya geri verir.

Öneriler: (1) ilk ekran Bugün + tek düğme, kendiliğinden açılan pencere
yok; (2) yeni kayıtta üç alan görünür, gerisi katlı, Kaydet hep
görünür; (3) gezinme sekizden dörde (Bugün / Planla / Çek / Yayınla);
(4) boş ekran yok; (5) ihtiyaç anında görünen özellikler (çok dilli
başlık yalnızca YouTube seçilince, AI düğmeleri yalnızca anahtar
girilince).

**B — Yedi adım.** Sabit yedi adım esnetilecek. Üç seçenek:
A·ATLA (adım "bu projede yok" denebilir, gecikmiş sayılmaz),
B·HAZIR AKIŞLAR (proje türüne göre hazır adım dizileri),
C·TAM ÖZEL (kullanıcı adım ekler/siler/adlandırır/sıralar).
Araştırmanın önerisi A ve B; C, Notion'da şikâyet edilen "kendin kur"
yükünü getiriyor ve basitleşme kararıyla çelişiyor. **Karar
kullanıcının** ve etki raporu görülmeden verilmeyecek.

### Gerekçe (promptun verdiği kanıt)

· 11 Kasım 2026 kullanıcı testi: ilk dakikada **5 kesinti** (tur,
  bekleyenler penceresi, örnekleri kaldırma sorusu, anket, giriş
  şeridi); telefonda takvim ilk ekranın **%67'sinden** sonra
  başlıyordu; yeni kayıt formu **1.549 piksel**, Kaydet en altta;
  **sekiz sekme**.
· Üreticilerin kendi sözleri (10 Reddit başlığı): Notion şablonları
  fazla karmaşık; *"kanalım ikinci bir iş gibi olmasın"*; çoğu "tek
  dosya yeter" diyor.
· Kullanıcı kararı (12 Kasım 2026): *"basitleşmeliyiz"*.

### ⚠ BİLİNEN ÇELİŞKİ — karar bekliyor

Çekim Föyü'nün telefon çizimi **sekiz sekmeyi 4+4 tabloda** gösteriyor.
Basitleşme önerisi sekmeleri **dörde** indiriyor. İkisi birden olmaz.
Kullanıcıya sorulacak (promptun 2. sorusu). Çekim Föyü **main'de,
canlıda** (b300d65) — yani bu, yapılmış bir işin üstüne gidiyor.

### İlk aşama kod değil

    1. Çakışma haritası + yedi adım etki raporu   (kod yok)
    2. İlk ekran ve kesintiler
    3. Yeni kayıt
    4. Gezinme
    5. Boş ekranlar ve ihtiyaç anında görünen özellikler
    6. Yedi adım (seçilen seçenek); önce tasarım belgesi
    7. Kılavuz ve MARKA.md metinleri (önce göster)

Çakışma haritası şunu çıkaracak: her öneri için **ZATEN YAPILDI /
BAŞKA İŞTE PLANLI / YENİ**. Üç iş aynı yere dokunuyor: 11 Kasım
testinin 15 bulgusu, Çekim Föyü tasarımı, altı geliştirme.

### Başlarken hatırlanacak kurallar

· Testler zayıflatılmayacak. Bazı testler **kaynak metnine** bakıyor;
  sekme adları ve öğe kimlikleri değişirse düşerler. Önce Grep ile
  kullanıldığı her yer bulunacak.
· Öğe id'leri ve JS'in tutunduğu sınıf adları korunacak; değişmesi
  gerekiyorsa önce listelenecek.
· Bir özelliğin yeri değişirse **eski kullanıcı onu nerede bulacak**:
  her değişiklik için yazılacak.
· `kilavuz.html` ve `guide.html` ekran adlarına göre yazılı; değişen
  her ad için kılavuz metni önce gösterilecek.

### Ölçüm ölçütleri (promptun verdiği, her aşamadan sonra)

Demo modu, tarayıcı kaydı temizlenmiş, hesaba girmeden:
ilk dakikada kendiliğinden açılan pencere **0**; ilk ekranda
kaydırmadan bugünün işi görünür (380x700, 390x844, 768x1024,
1440x900); Kaydet kaydırmadan görünür; her sayfaya **en çok iki
dokunuş**; ilk çekim listesi 30 saniyede dolu; 11 genişlikte yatay
taşma yok; dokunma hedefi ≥44 px, en küçük yazı ≥11 px, kontrast ≥4,5.
Sonuçlar **11 Kasım değeri / bugünkü değer** diye yan yana verilecek.

---

## BÖLÜM 2 (fiyat / ödeme duvarı / yönetim) — KULLANICI KARARLARI
## 12 Kasım 2026

⛔ **Henüz başlanmadı** ve bilerek başlanmadı: promptun kendi kapısı
*"Bölüm 1 bitip kullanıcı ONAYLAMADAN başlama"* diyor. Bölüm 1 bitti,
onay yok (kullanıcı önce uygulamada görecek). Başlanınca da ilk iş
kod değil **tasarım belgesi**.

Aşağıdakiler kullanıcının bugün verdiği cevaplar. Yazılıyor çünkü iş
beklemede ve bu kararlar unutulur.

### 1. Yönetim paneli — KAPSAM DARALDI ⚠

Promptun ilk hâli *"kim girdi, ne kullandı, ne satın aldı"* diyordu.
Kullanıcı bugün daralttı, kendi sözleriyle:

> *"benim derdim kişi bilgilerini saklamak değil ama kaç kişinin
> kullanıma başladığını kaç kişinin hangi paketi aldığını göreceğim
> bir panel olmalı"*

Yani panel **sayı** gösterecek, kişi başına davranış kaydı değil:
  · kaç kişi kullanmaya başladı
  · kaç kişi hangi paketi aldı
  · (promptta ayrıca) yurt içi / yurt dışı ayrı

⚠ Bunu "hiç kişisel veri yok" diye okumamak gerek: bir abonelik
zaten **kimin hangi planı aldığını** tutmak zorunda (fatura, erişim
hakkı, iade). Daralan şey **davranış izleme** — "şu kişi şunu
kullandı" kaydı. Tasarım belgesinde bu ayrım tek tek yazılacak:
hangi tablo kişiye bağlı, hangisi yalnızca sayaç.

### 2. Ücretsiz katman — kota ile tanımlanacak

> *"ücretsiz bölümü belirli bir kota ile tanımlayacağız ileride ve
> bunları değiştireceğiz"*

Promptun "yönetimden değiştirilebilir limitler" şartıyla uyumlu:
kota koda gömülmeyecek, veritabanından okunacak.
MARKA.md satır 111 (*"Ücretsiz. Şu an para alınmıyor, fiyat sayfası
yok."*) o zaman güncellenecek.

### 3. Koyu tema — KORUNACAK ✅ (karar verildi)

Bölüm 1'in cevapsız sorularındandı. Karar: korunsun.
Zaten öyle yapıldı: Aşama 1–7 boyunca her ölçüm **iki temada** da
alındı (kontrast, taşma). Ek iş gerekmiyor, karar kayda geçti.

### 4. MARKA.md "Görsel kimlik" — BEKLİYOR

> *"her şey bittiğinde bakacağız buna beklesin"*

Yeni görsel kurallar (2px köşe, klaket şeridi, 11px yazı tabanı,
mono künyeler) MARKA.md'ye yazılmadı. Yazılacağı zaman metin önce
kullanıcıya gösterilecek.

## AŞAMA 2b KAPATILDI (12 Kasım 2026)

2b iki parçaydı; **ölçüm ikisinin de gerekçesini değiştirdi.**

**1. Hesap menüsü kalabalığı — artık yok.** Gerekçe 2a'nın telefon
düzeninden geliyordu (avatar + Giriş yap + dil + "⋯" tek satırda).
2a geri alındı, sorun da gitti. Ölçüldü: masaüstünde `.rail-me`
182×163 bir sütun — avatar, Giriş yap, dil alt alta; `railMoreBtn`
masaüstünde 0×0 (o telefonun düğmesi). Düzeltilecek bir şey yok.

**2. Masaüstü üst şerit — yapılmadı, kullanıcı kararı.**
Çizimler (FoyProjeler / FoyMekan) masaüstünde yatay bir üst şerit
gösteriyor. Ölçülen boyut: kenar çubuğu 208×1047, dört bölüm
(marka, hesap+dil, hava kutusu, yardım bağlantıları), **24
tıklanabilir öğe**, ve `rail` geçen **14 test dosyası**.

Bu, telefonda yapılıp **geri alınan** değişikliğin masaüstü ikizi.
Telefonda gerekçe bütçeydi (120 px şerit / 134 px çizim);
masaüstünde yer sorunu yok, yani teknik olarak yapılabilir — ama
24 öğeyi dört bölümden tek bir yatay şeride dağıtmak demek.

Karar: **yapılmadı.** Kenar çubuğu olduğu gibi kalıyor.
İleride istenirse aşamalara bölünerek ele alınabilir.

## BAŞKA BİR AI SAĞLAYICI (ChatGPT / Claude) — 12 Kasım 2026

Kullanıcı sordu: Gemini dışında ChatGPT ya da Claude bağlanabilir mi?

**Üç ayrı şey var, ikisi zaten çalışıyor.**

1. **Uygulama içinden yazdırma (✨ düğmeleri) — yalnızca Gemini.**
   Çağrı sekiz yerde sabit: adres `generativelanguage.googleapis.com`,
   yol `/v1beta/models/<ad>:generateContent`, başlık `x-goog-api-key`,
   istek/yanıt gövdesi, ve iki dildeki hata metinleri de o adresi
   adıyla yazıyor. 19 `ai-*` test dosyası Gemini'yi varsayıyor.

2. **ChatGPT/Claude ile planlama — zaten var.** `ai_er_not`:
   "ChatGPT, Claude ya da Gemini ile planla, sonucu buraya getir."
   Asistan kartı kopyalanıp sonuç yapıştırılıyor.

3. **Claude için MCP** — doğrudan okuma/yazma var, yalnızca
   `bostancioglum@gmail.com` hesabına tanımlı (CLAUDE.md kuralı).

**Neden tek sağlayıcı — kodun kendi gerekçesi (satır ~19032):**
Google AI Studio ücretsiz anahtar veriyor, kart istemiyor; OpenAI
ayrı hesap ve kart şart koşuyor. Ve Gemini **tarayıcıdan doğrudan**
çağrılabiliyor — Shootboard'un sunucusu yok, sunucu gerektiren bir
sağlayıcı anahtarın bizden geçmesi demek olurdu ve *"anahtarını
görmeyiz"* sözü bozulurdu.

**Engel:** OpenAI ve Anthropic tarayıcıdan anahtar kullanmayı
önermiyor. Düzgün yolu Edge Function üzerinden geçmek — teknik olarak
mümkün (Edge Function'lar zaten var) ama yukarıdaki sözü yeniden
değerlendirmeyi gerektirir.

⚠ Fiyat/kota karşılaştırması YAZILMADI: buradan doğrulanamıyor.

**Kullanıcının gerekçesi (12 Kasım 2026, kendi sözleriyle):**
*"dünyada insanlar sadece gemini kullanmıyor ve pazarda ChatGPT ve
Claude kullanım oranları da yüksek, buna bakmamız lazım."*

Yani bu bir teknik merak değil **erişilebilirlik kararı**: kendi
anahtarını getiren kullanıcının elindeki anahtar büyük ihtimalle
Gemini'nin değil. Kodun "tek sağlayıcı" gerekçesi de zaten
erişilebilirlikti (ücretsiz anahtar, tarayıcıdan çağrı) — yani iki
gerekçe aynı soruya iki cevap veriyor ve yeniden tartılması gerekiyor.

Karar: Çekim Föyü tasarımı bitene kadar başlanmadı; **bitince ilk iş
bu.**

## GECELİK TURDA KIRMIZI KALAN DOKUZ TEST (11 Kasım 2026)

Tam tur: 190 koşuldu, 177 geçti, **13 düştü**. Dördü o anki bir
değişiklikten geliyordu ve geri alındı; **dokuzu önceden kırıktı.**

Atıf tahmin edilmedi: aynı 13 test önce değişiklikle, sonra
`git stash` ile değişiklik kaldırılıp koşuldu, iki liste
karşılaştırıldı.

Dokuzu tanılandı. **Üç gruba ayrılıyorlar ve ikisi GERÇEK ÜRÜN
EKSİĞİ — çürümüş test değil.**

---

### A. GERÇEK ÜRÜN EKSİĞİ — ikisi de Threads'ten

⛔ **`hesap-sil.test.js` — hesap silinince Threads verisi SİLİNMİYOR.**

Testin "bekçi" bölümü şunu kontrol ediyor: `sql/` içinde `user_id`
sütunu olan her tablo, hesap silme listesinde olmalı. İki tablo
eksik çıktı:

    threads_hesaplari   (sql/63-threads-jeton.sql)
    threads_yanitlari   (sql/65-threads-anket-cevabi.sql)

Liste `app.html` içinde `HESAP_TABLOLARI` (satır ~22717). İçinde
`tiktok_hesaplari` ve `youtube_hesaplari` var, Threads yok.

Anlamı: kullanıcı hesabını sildiğinde **Threads erişim jetonu ve
Threads anket cevapları veritabanında kalıyor.** Bu bir mahremiyet
sorunu, kozmetik değil.

Test tam da işini yapıyor — biri tablo ekleyip listeyi güncellemeyi
unuttuğunda ötüyor. Testin kendi yorumunda bu bekçinin neden
konulduğu da yazılı (sql/36 olayı).

Düzeltmesi iki dize eklemek. ⚠ Ama **veri silme davranışı**: önce
onay alınmalı, ve eklemeden önce iki tablonun gerçekten kullanıcıya
ait olduğu doğrulanmalı.

⛔ **`sartlar.test.js` — Threads için belge çengeli tanımlı değil.**

Düşen iddia: `'threads' icin belge cengeli tanimli`. Uygulama
Threads'i destekliyor ama şartlar/belgeler tarafında karşılığı yok.
Yukarıdakiyle aynı aileden: Threads eklendi, evrakı eklenmedi.

---

### B. ESKİ SÜRÜME GÖRE YAZILMIŞ BEŞ TEST (lokasyon uygulaması)

    arama.test.js · duzeltme.test.js · tz.test.js
    lok-klon.test.js · lok-surukle.test.js

Beşi de `app.html`'i DEĞİL, **lokasyon uygulamasını** (8099 portu,
`lokasyon.html`) test ediyor. Hepsi aynı şeye takılıyor: takvimde
kayıt kutusu yok (0).

Ölçüldü: lokasyon.html tarayıcıda açıldı. Sayfa hatasız yükleniyor,
takvim çiziliyor (21 gün hücresi), ama `calendarEvents` **0 kayıt**.
Sayfanın kendi başlığı sebebi söylüyor: *"DENEME KOPYASI — Supabase
sürümü · Eski sistem: lokasyon-takip"*. Veri artık buluttan geliyor;
test ortamında bağlantı yok, dolayısıyla veri de yok.

Yani uygulama bozuk değil, **testler yerel veriyle çalışan eski
sürüme göre yazılmış.** Düzeltme yolu: `story-yayin.test.js`'teki
gibi sahte bir sunucu kurmak.

⚠ Bu, "uygulama çalışıyor" demek DEĞİL — buradan giriş yapılamadığı
için gerçek kullanıcı akışı doğrulanamadı. Yalnızca "bu başarısızlık
veri yokluğundan" denebilir.

---

### C. ÇÜRÜMÜŞ İKİ TEST (ürün sağlam)

**`push.test.js`** — `app.html`'den `async function pushChanges()`
kalıbını **parametresiz** arıyor; fonksiyon `pushChanges(derinlik)`
olmuş (app.html satır 8481). Kodun kendisi satır 8463'te bu
değişikliği not etmiş, test güncellenmemiş. Düzeltmesi testteki
düzenli ifade.

**`paylas.test.js`** — ayrı bölümde yazılı (takvimle çürüyor).

---

### DURUM — 11 Kasım 2026 akşamı

Dördü **çözüldü**, beşi duruyor.

| Test | Durum |
|---|---|
| `hesap-sil` | ✅ çözüldü — Threads tabloları silme listesine eklendi |
| `sartlar` | ✅ çözüldü — belgeler Threads'i anlatıyor, bekçi Threads'i de kilitliyor |
| `push` | ✅ çözüldü — kalıp düzeltildi, oturum tazeleme yolu artık ölçülüyor |
| `paylas` | ✅ çözüldü — tarihler bugüne göreli üretiliyor |
| `arama`, `duzeltme`, `tz`, `lok-klon`, `lok-surukle` | ✅ çözüldü — fikstür tarihleri bugüne taşınıyor |

**Dokuzunun dokuzu da kapandı. Tam tur: 190 koşuldu, 190 geçti.**
(Oturumun başında aynı tur 177/13 idi.)

⚠ **Teşhisim bir kez yanlış çıktı, kayda geçsin:** kalan beş için
"sahte sunucu kurmak gerekiyor" denmişti. Sahte sunucu zaten vardı
(`testler/sahte-supabase.js`); gerçek sebep `paylas` ile aynıydı —
fikstür tarihleri takvimle ilerlemiyordu. "Bağlantı yok" teşhisi,
ölçülmeden söylenmiş bir cümleydi.

### SIRA ÖNERİSİ

1. `hesap-sil` — mahremiyet, en acili. Onay gerekir.
2. `sartlar` — Threads belgesi, aynı aile.
3. `push` ve `paylas` — tek satırlık test düzeltmeleri, ürüne
   dokunmaz.
4. Lokasyon beşlisi — sahte sunucu kurmak gerekiyor, en pahalısı.

## ✅ ÇÖZÜLDÜ — paylas.test.js takvimle çürüyordu (11 Kasım 2026)

**Ürün arızası YOK.** Paylaşım bağlantısıyla açılan salt okunur sayfa
kayıtları doğru gösteriyor — ölçüldü: Kasım tarihli kayıt açılışta
göründü, Eylül tarihli kayıt iki ay geri gidince göründü.

Düşen iddia: `takvimde kayıt görünüyor`.
Sebebi: testin örnek kayıtları **2026-09-10** ve **2026-09-12**
tarihlerine çakılı (`testler/paylas.test.js` satır 30, 56, 67),
görüntüleyici ise `var ay = new Date()` ile **içinde bulunulan ayı**
açıyor (`paylas.html` satır 134). Eylül 2026 geçtiği için test
bugünden sonra **her zaman** düşecek; kendiliğinden düzelmez.

⚠ Gecelik tam tur `main` üzerinde bunu her gece kırmızı gösterir.
Push/PR turunda yok (o tur yalnızca
`mobil takvim proje mekan fikir izgara serit ai-erisimi` koşuyor).

**Önerilen düzeltme** (test zayıflatılmıyor, çürümesi durduruluyor):
üç tarihi bugüne göreli üret — örneğin ayın 10'u ve 12'si, içinde
bulunulan aydan. Böylece iddia aynı kalır ama takvim ilerledikçe
geçerliliğini korur.

Karar kullanıcıda; onay gelmeden teste dokunulmadı (Bölüm 2 kuralı).

## TELEFON GEZİNMESİ: ÇİZİM 134 PİKSEL İSTİYOR, BÜTÇE 120 (11 Kasım 2026)

**Uygulandı, ölçüldü, GERİ ALINDI.** Commit `856e861`, geri alma `20b20a3`.
`git revert` kullanıldı, `reset` değil — commit duruyor, fikir değişirse tek
komutla geri getirilebilir.

### Ne yapıldı

Çekim Föyü tasarımının telefon gezinmesi: sekmeler alt sabit çubuktan **üste**,
**4+4 hücreli tabloya** taşındı (kullanıcı kararı: *"çizimdeki gibi üstte"*).
İki eski bulguyu da kapatıyordu:

- **bulgu 11 (telefon yarısı):** sekme adları `.tab-ad-k` kısaltmasıyla **9,5
  piksele** düşürülüyordu; iki satıra yayılınca **tam ad, 14 piksel** oldu.
- **bulgu 9b:** yüzen yuvarlak "+" düğmesi altındaki kaydın üstüne biniyordu;
  tam genişlikte alt şerit hiçbir şeyin üstüne binmiyor.

### ⬛ NEDEN GERİ ALINDI — İKİ İSTEK BİRBİRİNİ KESİYOR

Dört test düştü: `mobil-serit`, `mobil-alt-menu`, `mobil-menu`, `serit`.
Üçü eski tasarımı (alt çubuk, tek satırlık şerit) ölçüyordu — ama biri
**gerçek bir şeyi** koruyordu:

    mobil-serit:  "şerit 120px altında"  →  ölçülen 206px  (ekranın %24'ü)

O 120 piksellik bütçe, kabuğun ekranı yemesini engelliyor — yani kullanıcı
testinin **2. bulgusuyla** (*"takvim ilk ekranda çok aşağıda"*) aynı şeyi
savunuyor.

**206'nın 116'si henüz yapılmamış işlerin kalıntısıydı** (ölçüldü):

| Parça | Boy | Nereye gidecekti |
|---|---|---|
| `rail-brand` | 44px | kalıyor |
| `rail-me` (avatar, Giriş yap, dil) | 44px | 2b — hesap menüsü |
| `rail-more` (⋯) | 34px | 2b — marka satırına |
| `rail-hava` | 26px | 5. aşama — "Bugün sette" kutusuna |
| **4+4 ızgara** | **90px** | **çizimin kendisi** |

→ 2b ve 5. aşama bitse bile: 44 + 90 = **~134 piksel.**

⚠ **ÇİZİMİN KENDİ ÖLÇÜSÜ BU.** `FoyTelTakvim.dc.html`: başlık 44 + gezinme
88 + çizgiler ≈ 134. Yani fark **uygulamadan değil tasarımdan** geliyor;
daha iyi kodlayarak kapanmaz.

### Karar verilmeden önce bilinmesi gereken

Telefonda "üstte 4+4 tablo", kabuğun **14 piksel daha fazla** yer kaplamasını
kabul etmek demek — ve aynı kullanıcı testi "takvim çok aşağıda" demişti.
İki istek aynı anda sağlanamıyor. Seçenekler:

1. **Bütçeyi yükselt** (120 → 140) ve testleri bir kez güncelle. Tasarım
   uygulanır, kabuk 14 piksel büyür.
2. **Gezinmeyi tek satıra sığdır** (8 hücre yerine 4 + "⋯"), 44 piksel.
   Bütçe korunur ama çizimden sapılır.
3. **Alt çubukta bırak** (bugünkü hal). O zaman **bulgu 11'in telefon yarısı
   açık kalır**: sekme adları 9,5 pikselde durur.

⛔ Hangisi seçilirse seçilsin, **ölçmeden karar verilmesin**: bu satırların
tamamı tahmin değil, 390x844'te alınmış ölçüm.

### Ders

Bu geri alma boşa gitmedi. İki istek (çizime uy / kabuk küçük kalsın)
**çeliştiği ancak uygulanıp ölçülünce görüldü.** Testler bunu yakaladı;
yakalamasaydı kabuk sessizce %24'e çıkmış olacaktı.

---

## THREADS UÇTAN UCA TESTİ — ve bir kabul edilmiş boşluk (3 Kasım 2026)

### Ne yapıldı

Threads yayın yolunun **davranışsal** testi yoktu. `threads-yayin.test.js`
kararın beş yerde yazılı olduğunu ölçüyor ama kaynak **metnine** bakarak;
yani "doğru yazılmış mı" sorusunu cevaplıyor, "doğru **DAVRANIYOR** mu"
sorusunu cevaplamıyordu.

`testler/story-yayin.test.js`'e 116 ölçüm eklendi (364 → 480). Worker
gerçekten koşuyor; sahte Threads sunucusu `graf.test`ten **ayrı bir
makinede** (`threads.test`) — bilerek: ikisi aynı sahte sunucuda olsaydı
"yanlış uygulamaya gitti" hatası GÖRÜNMEZDİ, ve o hata bugün çalışan
Facebook yayınını bozmak demek.

Ölçülenler: metin postu (TEXT kapsayıcı → yayın sırası), görselli gönderi
(IMAGE, dosya **bize indirilmiyor** — Threads kendisi çekiyor), anket
(`option_a..option_d` SIRAYLA, boş kutular atılıyor, tür anket değilse
anket gitmiyor), anket kuralları (1 ve 5 seçenek, görselli anket → kalıcı
hata ve kapsayıcı **hiç** yaratılmıyor), 27 Ekim'in bayt vakası (tam 25
birim geçiyor, 26 reddediliyor, kırpma yok), çöküş kurtarması (iki tanık
ve **sırası**: liste okunamadıysa kapsayıcıya hiç sorulmuyor), uçtan uca
çöküş (toplamda TEK yayın çağrısı), jeton yaşam döngüsü (sql/63),
tür/platform kapıları.

Mutasyon testi: **24 mutasyonun 24'ü yakalandı.**

⚠ Hiçbir üretim dosyasına dokunulmadı. Değişen tek dosya
`testler/story-yayin.test.js` — `supabase/functions/`, `sql/`, `app.html`
ve `pc/` altında **tek satır** değişmedi, dağıtım gerekmedi.

### Bulunan gerçek hata — DÜZELTİLMEDİ, kullanıcı kararı

**Threads yayını başarısız olunca giden e-posta "Platform: threads"
diyor, "Threads" demiyor.**

`index.ts` → `basarisizBildir` içindeki platform adı tablosunda
(`instagram`, `facebook`, `tiktok`, `youtube`) **`threads` satırı yok**;
tanınmayan platform küçük harfli kod adıyla yazılıyor.

⚠ **Kodun kendi yorumu tam bu hataya karşı uyarıyor.** TikTok ve YouTube
28-29 Eylül 2026'da eklenirken aynı tablo atlanmış ve bildirim
"Platform: tiktok" demişti. Threads 16 Ekim'de eklendi, tablo YİNE
atlandı. Bu bir çeşit değil, bir **desen**: tür tablosu bir yerde,
platform adı tablosu başka yerde.

**KARAR (3 Kasım 2026, kullanıcı):** *"Düzeltmeyelim, ama kayıt altına
alalım."* Gerekçe: metni yalnızca kayıt sahibi okuyor, yayını
durdurmuyor, veriye dokunmuyor — **çalışan bir worker'ı tek bir görsel
kelime için yeniden dağıtmaya değmez.**

→ **Bir sonraki `story-yayin` dağıtımında yanında gidecek tek satır:**
`basarisizBildir`'deki platform adı tablosuna `threads: 'Threads'`
eklenir, `SURUM` arttırılır. Kendi başına dağıtım YOK.

⚠ **Kırmızı test bırakılmadı — bilerek.** Gecelik turda zaten bakılmayan
beş arıza var; altıncısını eklemek, kırmızılığın "normal" olmasına bir
katkı daha olurdu ve asıl tehlike o: bir gün gerçek bir arıza o listede
kaybolur. Ölçüm **bugünkü gerçeği** doğrulayacak şekilde yazıldı
(`Platform: threads` bekliyor) ve yanına kararın gerekçesi not edildi.
Biri tabloya `threads` eklerse **ölçüm düşer ve haber verir**; o gün blok
silinip yerine "platformu Threads yazıyor" ölçümü yazılacak.

### Açık kalanlar (bu işte kapatılmadı)

- **DÜZELTME (aynı gün):** İlk yazdığımda "anket cevabının zinciri
  ölçülmüyor" demiştim — **yanlıştı, doğrulamadan yazdım** (§4'ün
  ihlali). Zincir **ölçülüyor**: `testler/sql-yanit-kuyrugu.test.py`
  sql/65-66'yı **gerçek bir PostgreSQL'e** kuruyor ve sıra şartını,
  zincirin bağlanmasını, "üçüncü parça patlarsa ilk ikisi yeniden
  gitmez"i ve çift yanıt korumasını koşturuyor.

- **AMA O TEST CI'DA HİÇ KOŞMUYOR — ve yeşil görünüyor (3 Kasım 2026,
  ölçüldü).** Postgres bağlantısını `SHOOTBOARD_TEST_PG` ortam
  değişkeninden alıyor; yoksa kendini atlıyor ve **0 döndürüyor**.
  O değişken **hiçbir yerde tanımlı değil**: ne `testler/kosu.sh`'de, ne
  `.github/workflows/testler.yml`'de. Yerelde ölçtüm, çıktı şu:

      [  1/1] ok  sql-yanit-kuyrugu.test.py             0sn
      === BITTI — 1 gecti, 0 kaldi ===

  Yani kuyruğun en kritik mantığı (zincir sırası, çift yanıt) her gece
  **ölçülmeden "geçti" yazıyor** — sessiz atlama, geçmiş gibi görünüyor.
  Dosyanın kendi yorumu bunu bilerek böyle yapmış ("bir geliştiricinin
  makinesinde Postgres olmaması arızanın kendisi değil") ve o gerekçe
  yerelde doğru; **CI için değil.** CI'da Postgres servisi açılabilir
  (`services: postgres` + değişkeni vermek) ya da hiç olmazsa atlamanın
  çıktıda **"ATLANDI" olarak görünmesi** gerekiyor. Ayrı iş, kullanıcı
  kararı bekliyor.

- Worker'ın **yanıt gönderme** yolunun (`yanitiGonder`, `yanitCikmisMi`)
  davranışsal testi yok: `reply_to_id` ile ne gittiği ve yanıtın iki
  tanığı (zaman damgası **ve** metnin kendisi) ölçülmüyor. Bu işte kurulan
  sahte Threads sunucusunda `/replies` ucu hazır; kapatmak için yalnızca
  yanıt kuyruğunun RPC'lerini test taklİdine yazmak kaldı.
- `hesap-sil`'de `threads_hesaplari` / `threads_yanitlari`'nın atlanıyor
  olabileceği şüphesi duruyor (ayrı iş, doğrulanmadı).

---

## ÇİFT FACEBOOK REEL'İ — kök sebep ve onarım (26-27 Ekim 2026)

**OLAN.** 26 Ekim'de aynı Facebook reel'i iki kez yayınlandı: 10:01
(80 görüntülenme) ve 10:12 (153 görüntülenme). Kullanıcı birini elle
sildi. Kaydın `attempt_count` değeri 2 idi.

**TEŞHİS KANITLANMADI, ÇIKARIM.** Satırın iz alanları (`publish_ref`,
`publish_ref_at`, `publish_called_at`, `last_error`) `story_yayinlandi`
tarafından temizleniyor (sql/42) ve Edge Function günlükleri bir gün
sonra siliniyor — yani olayın kendi kanıtı yoktu. Teşhis koddan
okunarak kuruldu, ölçümle değil. **Bu satır böyle kalsın:** "kanıtlandı"
yazmak, 13 Ekim'de uydurulan görüntülenme sayısının yaptığı hatanın
aynısı olur.

**KODDAN OKUNAN AKIŞ.** Bölüm 8, üçüncü katman:

    publish_ref VE publish_called_at doluysa -> cikmisMi() sor
      biliniyor=false            -> 5 dk ertele (sonsuza kadar)
      biliniyor=true,  id dolu   -> yayınlanmış say
      biliniyor=true,  id boş    -> YENİDEN YAYINLA   <-- kapı burada

`cikmisMi` Facebook reels için `/{pageId}/video_reels` listesine
bakıyordu. Liste okunup içinde bizim yayın bulunamazsa cevap "çıkmadı"
oluyordu — ve o cevap yeniden yayın demek. Yalnızca **iki dakikalık**
bir "taze" penceresi vardı: çağrının üstünden iki dakika geçmediyse boş
liste "bilmiyorum" sayılıyordu. Dünkü olayda arada **onbir dakika**
vardı, yani pencere çoktan kapanmıştı.

**PENCEREYİ BÜYÜTMEK ÇÖZÜM DEĞİL.** Belirsizlik yaşlandıkça azalmıyor:
listede neden görünmediğini bilmiyoruz ve beklemek bunu öğretmiyor.
Pencere ne kadar olsa bir gün onun da dışına düşen bir vaka çıkar —
26 Ekim'de olan tam buydu.

### Onarım (27 Ekim 2026) — iki parça

**1. İKİNCİ TANIK.** Reels'te boş liste artık tek başına karar
vermiyor; kendi nesnemizin durumu soruluyor. Desen yeni değil:
Threads'te 16 Ekim'den beri çalışıyor (`threadsCikmisMi`), aynısı
Facebook ve Instagram'a taşındı (`kapsayiciCikmisMi`).

| | sorulan | "çıkmış" cevabı |
|---|---|---|
| Instagram | `GET /{konteyner}?fields=status_code` | `PUBLISHED` |
| Facebook | `GET /{video_id}?fields=status` | `status.publishing_phase.publish_status = published` |

⚠ **SIRA ÖNEMLİ, TERSİ ÇİFT YAYIN ÜRETİR.** Önce liste soruluyor;
nesnenin durumu yalnızca liste OKUNDU ve BOŞ iken karar veriyor. Tek
başına nesneye güvenmek, Meta durumu geç güncellerse çıkmış bir reel'i
"çıkmadı" saymak olurdu.

⚠ **FACEBOOK ALANI GARANTİ DEĞİL, BİLEREK BÖYLE YAZILDI.** O alanlar
Meta'nın Video API belgesinde duruyor ama `video_reels` ucunun kendi
referansında geçmiyor — yani gerçekte boş dönebilir. Dönerse zararsız:
tanınmayan her cevap "bilmiyorum" sayılıyor, **asla "çıkmadı"**. Yani
bu tanık kesinliği yalnızca artırabilir, çift yayın üretemez. Canlıda
hangi cevabın geldiği **henüz ölçülmedi**; ilk kurtarma turunda
günlükten okunacak.

`FINISHED` / `ERROR` / `EXPIRED` (IG) ve `not_published` (FB) **kesin**
cevaplar: "yayınlanmadım" diyorlar, orada yeniden yayın güvenli ve
kurtarma kendiliğinden tamamlanıyor.

**2. BELİRSİZLİK TAVANI — 30 dakika.** "Sonucu bilinmiyor" hâli beş
dakikada bir sonsuza kadar erteleniyordu: ne yayın çıkıyor, ne e-posta
gidiyor. Bölüm 9'un yasakladığı sessiz başarısızlığın tam kendisi ve
16 Ekim'de Threads'te zaten yaşanmıştı. Artık 30 dakika sonra kayıt
`failed` yazılıyor ve bildirim gidiyor.

⛔ **KENDİLİĞİNDEN YENİDEN YAYINLANMIYOR.** Belirsizken ikinci kez
yayınlamak, 26 Ekim'de olanın aynısıdır. Kararı kullanıcı veriyor;
e-posta ne yapacağını söylüyor: platformu aç ve bak, gönderi oradaysa
kaydı elle "yayınlandı" işaretle, orada değilse elle yayınla.

**STORY'DE HİÇBİR ŞEY DEĞİŞMEDİ** ve bu bilinçli: `/stories` 24
saatlik ve anında güncelleniyor, orada boş liste kesin "çıkmadı"
demek. Reels için getirilen ihtiyat story'yi yavaşlatmamalı. Gerileme
testi bunu ölçüyor.

**ÖLÇÜM.** `testler/story-yayin.test.js` 328 → 364 ölçüm. Yeni 36
ölçümün içinde 26 Ekim olayının birebir canlandırması var (Facebook,
liste boş, onbir dakika geçmiş → ikinci yayın ÇIKMIYOR). Mutasyon
testi: 10 kasıtlı bozma, 10'u yakalandı.

⚠ **TEK BİLİNEN BOŞLUK:** `kapsayiciCikmisMi` içindeki `if (!ref)`
koruması bugün erişilemiyor (tek çağıran Bölüm 8 ve orası `publish_ref`
kapısının arkasında), yani mutasyon testi o satırı öldürmüyor. Bilerek
duruyor; `threadsCikmisMi`'de de aynı koruma var.

---

## CI KIRILGANLIĞI — gezinme tavanı (27 Ekim 2026)

**OLAN.** PR #36'nın CI koşusu iki denemede de kırmızı geldi ama **her
denemede farklı bir test** kaldı: `mobil-alt-menu` (`page.goto: Timeout
30000ms`), sonra `mekan-gorsel` (`page.reload: Timeout 30000ms`).

**KOD DEĞİL, ORTAM — kanıtlandı.** `git merge-tree origin/main HEAD`
ağacı dal ucuyla birebir aynı çıktı (`98ba8b5`): aynı commit'in `push`
koşusu (#393) yeşil, `pull_request` koşusu (#394) iki kez kırmızı. İki
test de yerelde ve aynı sabahın gece koşusunda geçiyordu. Aynı desen
22 Ekim'de ters yönde de görülmüş (`2761a57`: push kırmızı, PR yeşil).

**ÖLÇÜM.** CI koşucusu bu testleri ~4 kat yavaş koşuyor:

| test | yerel | CI |
|---|---|---|
| `mekan-gorsel` | 5 sn | 28 sn |
| `mobil-alt-menu` | 19 sn | 44 sn |

Playwright'ın varsayılan gezinme tavanı 30 saniye; 1,14 MB'lık
`app.html` + üç yerel sunucu + Chromium yüklü bir koşucuda bu sınıra
dayanıyor.

**ONARIM.** `testler/araclar.js` tek merkezinde açılan her sayfaya 60
saniyelik tavan konuyor (`GEZINME_TAVANI_MS`, çevre değişkeniyle
geçersiz kılınabiliyor). ⛔ **Hiçbir test atlanmadı, devre dışı
bırakılmadı:** gerçekten açılmayan bir sayfa yine kalıyor, yalnızca
daha geç.

Tavan `newContext`'e konuyor, `newPage`'e **konmuyor** — çünkü
Playwright'ın `browser.newPage()`'i içeride kendi `newContext()`'ini
çağırıyor, yani ikisini de sarmak ölü kod olurdu. Mutasyon testi bunu
böyle buldu: `newPage` sarmalını kaldıran mutasyon yakalanamadı, çünkü
davranış gerçekten değişmiyordu. Varsayım bir Playwright iç ayrıntısına
yaslanıyor ve testin `[newPage]` bölümü onu çiviliyor.

`testler/gezinme-tavani.test.js`: 11 ölçüm, mutasyon testi 7/7.

⚠ **YEREL TAM TAKIM KOŞUSU BU KUTUDA TAMAMLANAMIYOR.** `hatirlatma`
testine gelindiğinde (59. sıra, en ağır test) koşucu ortam sınırına
çarpıp 144 ile ölüyor — iki kez, aynı yerde. Test kendi başına 63/0
geçiyor, yani test sağlam. Takım bu yüzden ikiye bölünerek koşuluyor.

---

## THREADS YAYINI — çalışıyor (16 Ekim 2026)

Threads artık Shootboard'dan yayınlanıyor. Kullanıcının elle yaptığı iş
story'dekiyle aynı: kaydı gir, görseli klasöre bırak.

ZİNCİR
  planlama sohbeti --MCP--> takvim kaydı (tür text_post, platform threads)
  görsel --> E:\CLAUDE VIDEOS\TESLIM\THREADS
  Görev Zamanlayıcı (5 dk) --> pc/threads-izle.bat --> pc/threads-izle.py
      --> R2'ye yükle, mediaName ile kaydı bul, bağla, autoPublish aç
  pg_cron (1 dk) --> Edge Function story-yayin --> graph.threads.net
      (kapsayıcı /me/threads, sonra /me/threads_publish)

ETİKET: BİR TANE ÇALIŞIYOR, GERİSİ SÜS (16 Ekim 2026, ölçüldü)
  Threads gönderi başına TEK etiket kabul ediyor. İlk gönderide üç
  etiket vardı (`#tarih #belgesel #sümela`); kullanıcı canlı gönderide
  baktı: **yalnızca ilki** gerçek tag olmuş (gönderinin yanında
  duruyor), diğer ikisi gövdenin altında düz yazı olarak kalmış.
  → Planlama kuralı: en önemli etiketi BAŞA yaz, ikiden fazla yazma.
  Kaynak ayrıca doğruluyor (TechCrunch, Social Media Today: "tek
  konu etiketi, etiket spam'ini önlemek için") ama karar ÖLÇÜME
  dayanıyor.

ANKETİN SÜRESİ 24 SAAT (16 Ekim 2026, ölçüldü)
  Meta'nın belgesinde yazmıyor; yalnızca `expiration_timestamp` alanı
  var. Kullanıcı canlı gönderide anketin altında geri sayan sayacı
  gördü: yayın anından 24 saat. Cevabın varsayılan gecikmesi (24 saat)
  bu yüzden anketin KAPANDIĞI ana denk geliyor.

UYGULAMA KAYITLARIN HEPSİNİ OKUMUYORDU — SESSİZ KESME
(22 Ekim 2026, ölçüldü ve düzeltildi)

  Kullanıcı 1 Ocak 2027'de Facebook 18:00 hikâyesinin uygulamada
  görünmediğini bildirdi. Aynı gün aynı saatteki Instagram hikâyesi
  GÖRÜNÜYORDU — yani eksik olan şey bir filtre ya da tarih hatası
  değildi.

  SEBEP: `pullRemote` (app.html) `limit`siz yazılmıştı ve "hepsini
  ver" demek sanılıyordu. PostgREST'in kendi üst sınırı 1000 satırda
  kesiyor ve HATA DÖNDÜRMÜYOR. Tarayıcı konsolundan ölçüldü:

      GELEN: 1000   TOPLAM: 1074   HATA: null

  74 kayıt uygulamada hiç görünmüyordu ve uygulama bunu fark
  etmiyordu. Ekrandaki "1000 / 100000" bir sınır değil, YÜKLENEN
  kayıt sayısıydı (`renderEntryCount`: soldaki `events.length`,
  sağdaki hesabın limiti) — tam 1000'de durması kesmenin imzasıydı.

  ⚠ SIRA BELİRSİZ OLDUĞU İÇİN KÜME DE SABİT DEĞİLDİ. Sorguda
  `order by` yoktu; hangi 74 kaydın düştüğü yenilemeden yenilemeye
  değişebiliyordu. Aynı gün aynı saatteki iki hikâyeden birinin
  görünüp ötekinin görünmemesinin sebebi buydu.

  ⛔ YAYINI ETKİLEMİYORDU. Yayın zinciri (pg_cron → story-yayin →
  story_kuyruk_al) doğrudan `calendar_events`'ten okuyor; uygulamanın
  ne gördüğü yayını hiç ilgilendirmiyor. Görünmeyen kayıtların tiki
  açıktı ve sıraları geldiğinde çıkacaklardı. Bu bir GÖRÜNÜRLÜK
  arızasıydı.

  VERİ GÜVENLİĞİ: yazma yolu incelendi, silme yalnızca kullanıcının
  sildiği kimliklerle yapılıyor (`removedIds`) — "uzakta olmayanı sil"
  gibi bir karşılaştırma yok. Yani eksik okuma veri kaybına yol
  açmıyordu. TEK İSTİSNA: Ayarlar'daki "Sıfırla" düğmesi yüklü olan
  her kaydı siliyor; kesme varken 1000'i siler, görünmeyen 74'ü
  sunucuda bırakırdı. Sayfalama bu tehlikeyi de kapattı.

  DÜZELTME (app.html):
    1. `pullRemote` 1000'lik parçalarla sayfalanıyor, eksik sayfada
       duruyor, sonsuz döngüye karşı tavanı var.
    2. ⚠ `order('id')` EKLENDİ. Sayfalamayı sıralamasız eklemek
       arızayı DAHA SİNSİ hale getirirdi: aynı kayıt iki kez gelirken
       başkası hiç gelmeyebilirdi. `id` benzersiz ve değişmiyor.
    3. `MAX_EVENTS` 2000 → 50000 ve kesme artık SESSİZ DEĞİL
       (console.error + kullanıcıya uyarı, iki dilde). 2000'de
       dururken kullanıcının 1074 kaydı vardı ve günde ~11 ekliyordu:
       üç ay sonra aynı şikâyet sessizce geri gelecekti.

  ⚠ BUILD_STAMP YANILTIYOR: sol alttaki tarih (2026-09-08) kodda
  sabit yazılı ve güncellenmiyor; dağıtımın eskiliğini göstermiyor.

  CANLIDA DOĞRULANDI (22 Ekim 2026). Kullanıcı PR'ı birleştirdi,
  sayfayı yeniledi: "evet merge ettim ve çalıştı". Eksik kayıtlar
  geri geldi.

  testler/bulut-sayfalama.test.js (26 ölçüm) — pullRemote kaynaktan
  çıkarılıp sahte `sb` ile GERÇEKTEN koşturuluyor, tarayıcı
  gerekmiyor. 11 mutasyonun 11'i yakalandı (sayfalamayı kaldırmak,
  sıralamayı kaldırmak/değişken alana bağlamak, aralık aritmetiğini
  kaydırmak, başlangıcı sabitlemek, dolu sayfada durmak, hatayı
  yutmak, kesmeyi tekrar sessizleştirmek, MAX_EVENTS'i geri almak,
  sınır altında yanlış alarm vermek).

SUPABASE'İN DİĞER İKİ METRESİ — LOG INGESTION VE LOG QUERY
(22 Ekim 2026, ölçüldü)

  Kota uyarısından sonra Usage sayfasındaki diğer işaretli satırlara
  da bakıldı. İki metre, iki ayrı hikâye.

  LOG INGESTION (ücretsiz hak: 1 GB/ay) — AYNI HASTALIK, İYİLEŞTİ.
      19 Ekim   516 MB
      20 Ekim   320 MB
      21 Ekim  12,4 MB   (temizlik düzeltmesi 20 Ekim akşamı girdi)
      22 Ekim   5,4 MB
  %97,6 düşüş; Edge Function eğrisinin birebir aynısı. Sebep aynı:
  günde 68.000 çağrının her biri günlüğe yazıyordu
  (320 MB / 68.000 ≈ çağrı başına 5 KB). Yani tek düzeltme İKİ metreyi
  birden iyileştirdi. Yapacak bir şey yok.

  LOG QUERY (ücretsiz hak: 100 GB) — SEBEBİ SİSTEM DEĞİL, BİZDİK.
      16 Ekim  39,9 GB
      17 Ekim   4,4 GB
      20 Ekim  77,4 GB
  Bu metre günlükleri OKURKEN taranan veriyi ölçüyor (Studio arayüzü,
  Logs sayfaları, API, CLI). Tarihler bunu söylüyor: 16 Ekim kullanıcı
  Supabase log dosyasını sohbete yapıştırdığı, 20 Ekim kota sorununu
  birlikte kovaladığımız gündü. Çalışan sistemin ürettiği bir şey
  değil; araştırma bitince kendiliğinden duruyor.

  ⚠ SQL EDITOR BU METREYE GİRMİYOR. `net._http_response` gibi normal
  tablo sorguları veritabanı sorgusudur; sayan yer sol menüdeki Logs
  sayfaları.

  ⚠ TERS YAN ETKİ — BİLEREK KABUL EDİLDİ. Supabase'in kendi
  açıklaması: "Logs Query usage isn't billed directly. Instead, your
  organization gets a log query allowance that scales with how much
  log data you ingest." Yani sorgu hakkı, ÜRETİLEN günlük miktarıyla
  orantılı. Günlük üretimini 516 MB'tan 5 MB'a indirdiğimiz için
  SORGU HAKKI DA KÜÇÜLECEK. Bundan sonra Logs sayfalarında zaman
  aralığını dar tutmak gerekiyor ("son 7 gün" tek tıkla gigabaytlar
  taratıyor).

  ⚠ YAPTIRIM 2027 BAŞINA KADAR YOK: "Enforcement starts after the
  grace period ends at the start of 2027." Ve bu metre doğrudan
  faturalanmıyor. Gelen uyarı maili Log Query'den değil, EDGE
  FUNCTION çağrılarından geliyordu — o çözüldü.

  ⚠ BELGE İLE EKRAN UYUŞMUYOR: supabase.com belgelerinde ücretsiz hak
  Log Query için 1.000 GB, Log Ingest için 5 GB görünüyor; kullanıcının
  kendi ekranı 100 GB ve 1 GB diyor. ESAS OLAN EKRAN. Belgeden okunan
  rakam bu hesaba uymuyor.

SUPABASE KOTASI — TEMİZLİK SORGUSU FATURAYI PATLATIYORDU
(20 Ekim 2026, ölçüldü ve düzeltildi)

  Supabase "Fair Use" uyarısı geldi: 558.630 Edge Function çağrısı,
  ücretsiz sınır 500.000. 19 Kasım 2026'da kısıtlama başlayacaktı.

  SEBEP ÖLÇÜLDÜ, TAHMİN EDİLMEDİ. Depodan hesaplanabilen her şey
  (story-yayin dakikada bir = 43.800/ay, üç izleyici 5 dakikada bir
  = 26.000/ay) toplamda ~70.000 ediyordu. Aradaki 488.000 görünmüyordu.

  Kök sebep: `story-yukle.py` → `temizlenecekler()` defterdeki her
  temizlenmemiş dosya için HER TURDA bir istek atıyordu. Soru yükleme
  değil, SİLME sorusu: "yayınlandı mı, R2'den kaldırabilir miyim?"

  Kullanıcının defterinden ölçüldü (20 Ekim 2026):
    story   112 dosya → tarihi geçmiş 0,  gelecek 112
    threads  94 dosya → tarihi geçmiş 1,  gelecek 93
    reels    34 dosya → tarihi geçmiş 1,  gelecek 33
    240 dosya × 288 tur/gün = 69.120/gün = ayda 2.073.600

  Yani sorulan 240 dosyanın 238'i HENÜZ TARİHİ GELMEMİŞ dosyaydı:
  kullanıcı 16 Ocak'a kadar her şeyi önceden yüklüyor ve 31 Aralık'ta
  çıkacak bir hikâyeye bugünden itibaren yirmi bin kez soruluyordu.

  ⚠ VE BEDEL TERSİNE DÖNMÜŞTÜ. Bu sorgunun amacı R2'de yer açmak.
  R2 ölçüldü (19 Ekim): 50 GB bile ayda 60 sent, kullanıcı 2,7 GB-ay
  ile SIFIR ödüyor. Ayda birkaç sentlik depolamadan kaçınmak için
  ayda iki milyon çağrı harcanıyordu. Süpürge yazıldığında depolama
  darboğaz sanılmıştı; ölçüldü, değilmiş.

  İKİ KAPI EKLENDİ (`story-yukle.py`):
    1. Tarihi gelmemiş dosya hiç sorulmuyor (ad YYYY-MM-DD ile
       başlıyor). Tek başına %99,2 kesiyor.
    2. Kalanlar saatte bir soruluyor (`son_soru` damgası defterde).
    Sonuç: günde 69.120 → günde ~48.

  ⛔ SİLME KURALLARI DEĞİŞMEDİ. Otomatik tiki açık ama çıkmamış kayıt
  varsa dosya yine duruyor; `matchedBy != mediaName` ise yine
  dokunulmuyor. Değişen tek şey SORUNUN NE ZAMAN sorulduğu.

  ⚠ DAMGA SORUDAN ÖNCE BASILIYOR. Sonra basılsaydı, sorgu her
  patladığında damga hiç konmaz ve seyreltme tam da ağların kötü
  olduğu anda çalışmayı bırakırdı.

  ⚠ TARİHSİZ AD SORULMAYA DEVAM EDİYOR. "Tarihini bilmiyorum" ile
  "tarihi gelmedi" ayrı şeyler; bilinmeyeni atlamak dosyayı sessizce
  sonsuza kadar R2'de bırakırdı.

  CANLIDA DOĞRULANDI (20 Ekim 2026, 18:10). Kullanıcı yeni
  `story-yukle.py`'yi indirdi, üç izleyici yeni kodla koştu:
    · her turda sorulan dosya: 240 → 2
    · damga konan dosyalar tam olarak o iki geçmiş tarihli dosya
      (2026-10-03_reels_tekfur_bes_hayat.mp4,
       2026-10-17_threads_sumela_bosaldi.jpg)
    · damga saatleri günlüklerin yazma saatleriyle birebir aynı
      (18:10:02 / 18:09:01) — yani damga gerçekten o turda kondu
    · 238 gelecek tarihli dosya hiç sorulmadı
  Aylık tahmin: ~45.000 çağrı (worker dahil), sınır 500.000.

  SUPABASE RAKAMLARIYLA DOĞRULANDI (22 Ekim 2026). Kullanıcı Usage
  sayfasındaki günlük Edge Function çağrılarını okudu:

      18 Ekim   39.000   (düzeltme öncesi)
      20 Ekim   68.000   (düzeltme öncesi son tam gün)
      21 Ekim    1.500   (düzeltme sonrası ilk tam gün)
      22 Ekim      552   (gün bitmeden)

  Düşüş %97,8. Tahminler tuttu: öncesi için "69.120/gün" denmişti,
  gerçek 68.000; sonrası için "~1.500" denmişti (worker 1.440 +
  izleyiciler 48), gerçek 1.500.

  ⚠ VE MEKANİZMA BAĞIMSIZ OLARAK DOĞRULANDI. Günlük çağrıyı tur
  sayısına (288) bölünce defterdeki dosya sayısı çıkıyor:
      39.000 / 288 ≈ 135 dosya  (18 Ekim)
      68.000 / 288 ≈ 236 dosya  (20 Ekim)
  20 Ekim'de kullanıcının bilgisayarında SAYILAN sayı 240'tı. Yani
  rakamlar yalnızca "düzeldi" demiyor, sebebin tam olarak bu olduğunu
  da söylüyor: maliyet defter büyüklüğüyle doğru orantılıydı.

  Aylık izdüşüm ~45.000, ücretsiz sınır 500.000 — %9.

  ⚠ İLK ÖLÇÜMDE REELS "0" GÖRÜNDÜ ve bu bir arıza sanılabilirdi:
  sebebi reels izleyicisinin henüz yeni kodla koşmamış olmasıydı.
  Beş dakika sonra damga göründü. Ders: izleyici değişikliğinden
  sonra ölçüm almadan önce ÜÇ GÜNLÜĞÜN DE tazelendiğini gör.

  testler/temizlik-seyreltme.test.py (30 ölçüm, davranış) — 11
  mutasyonun 11'i yakalandı. Bu arızanın GÖRÜNÜR BELİRTİSİ YOK:
  seyreltme bozulursa hiçbir yayın kaçmaz, yalnızca fatura geri gelir.
  Ölçüm tek bekçi.

GÖRÜNTÜLENMELERİ SHOOTBOARD TOPLASIN (19 Ekim 2026, başladı)

  Kullanıcının kararları:
    · KAPSAM: kalıcı içerikler — reels + Threads. Hikâyeler DIŞARIDA.
      Sebep: hikâye insights'ı 24 saatte kayboluyor; toplayıcının
      günde birkaç kez koşması şart olurdu ve bir günlük arıza o
      günün sayısını KALICI olarak yok ederdi. Ayrı adım.
    · GÖSTERİM: Shootboard uygulamasında kartın üstünde.

  Aşamalar:
    0. sql/67 + supabase/functions/olcum-dene — SONDA. ✅ YAPILDI.
    1. Ölçüm tablosu (zaman serisi) + işlevler.   ⏸ DURDURULDU
    2. Toplayıcı Edge Function + cron.            ⏸ DURDURULDU
    3. app.html'de kartta gösterim.               ⏸ DURDURULDU

  ⏸ 19 EKİM 2026'DA DURDURULDU. Kullanıcı: "Claude bunları panelden
  görebiliyorum. Hiç uğraşmayalım istersen!" Karar kendisinin ve
  makul: sayıları zaten Meta/Threads panellerinden görüyor.

  Kaybedilen tek şey bilerek kabul edildi: panel BUGÜNKÜ sayıyı
  gösteriyor, zaman içindeki EĞRİYİ değil. "API ile giden, elle
  gidenden az mı alıyor" sorusu ancak birkaç gün üst üste
  kaydedilmiş sayılarla cevaplanır; o yük şimdilik kullanıcıda
  (panelden bakıp not almak).

  Sonda ve tablo KALDI (kullanıcının kararı: "dursun şimdilik").
  Zararsız: salt okur, cron'a bağlı değil, yalnızca sql/67'deki
  çağrı elle çalıştırılırsa koşuyor. İş yeniden açılırsa aşama 1'den
  devam edilir, sıfırdan değil.

  ══ SONDANIN ÖLÇTÜĞÜ (19 Ekim 2026, gerçek gönderilerden) ══
  Bunlar ÖLÇÜM, tahmin değil. Aşama 1'e başlayan buradan devam etsin.

  · THREADS — AÇIK. Hem text_post hem poll için 200 döndü:
      views, likes, replies, reposts, quotes
    Yani `threads_manage_insights` izni jetonda ZATEN VAR; korkulan
    engel çıkmadı. Threads tek başına bugün toplanabilir durumda.

  · INSTAGRAM — YARISI AÇIK.
      çalışan : id, media_type, permalink, like_count, comments_count
      kapalı  : insights (views VE plays) -> 400
                "(#10) Application does not have permission"
    Yani beğeni/yorum alınabiliyor, GÖRÜNTÜLENME alınamıyor. Bu bir
    izin eksiği, kod hatası değil. İki aday: instagram_manage_insights
    ve pages_read_engagement -- hata mesajı hangisini kastettiğini
    YAZMIYOR, doğrulanmadı.

  · FACEBOOK — ÜÇ YOLUN ÜÇÜ DE BAŞARISIZ.
      /{id}?fields=views,post_views       -> 400
      /{id}/video_insights                -> 400
      /{id}/insights                      -> 400
      hepsi: "(#12) singular statuses API is deprecated for versions
      v2.4 and higher"
    Bu "izin yok" demiyor: sakladığımız kimlik o biçimde sorulamıyor.
    ⚠ KÖK SEBEP ADAYI (doğrulanmadı): Facebook yolunda external_id
    olarak `post_id` saklanıyor (story-yayin, facebookYayinla:
    `bit?.post_id ?? bit?.id ?? videoId`). Reels için doğru tutamak
    muhtemelen VİDEO kimliği -- ama o, yayın bitince publish_ref ile
    birlikte siliniyor (story_yayinlandi tasarımı). Devam edecek kişi
    önce external_id'nin gerçek biçimine baksın.

  ⚠ NEDEN ÖNCE SONDA. Metrik adları sürüme göre değişiyor
  (Instagram'da `plays` -> `views`) ve Threads insights ayrı bir izin
  istiyor (`threads_manage_insights`) — o izin mevcut jetonda
  olmayabilir. Adları hafızadan yazıp kod üretmek, Bölüm 4'teki
  "doğrulamadan sayı yazma" hatasının kod hali olurdu. Sonda gerçek
  gönderilere soruyor, cevabı tabloya yazıyor.

  ⛔ SONDA SALT OKUR ve jetonu hiçbir yere yazmıyor: sakladığı adres
  access_token ayıklanmış hali, ham cevap ve hata metinleri
  süzülüyor. testler/olcum-dene.test.js (43 ölçüm) bunu ve "0 ile
  bilinmiyor ayrı" kuralını koruyor; 13 mutasyonun 13'ü yakalandı.

THREADS ZİNCİRİ UÇTAN UCA ÇALIŞTI (17 Ekim 2026, ölçüldü)
  Üç şey aynı gün, elle hiçbir müdahale olmadan gerçekleşti:
    · 12:00 — ilk tam otomatik Threads metin postu (Üsküdar kuş evi).
      Veriden: publishedAt 12:00:11, attemptCount 1.
    · 16 Ekim 16:45:12 — anket çıktı (attemptCount 1), 16 kişi oy verdi.
    · 17 Ekim ~16:45 — anketin CEVABI anketin altına yanıt olarak
      düştü. Kullanıcı Threads'te gördü ve "GELDİ" dedi.

  Üçüncüsü 24 saatlik gecikmenin gerçekten tuttuğunun ilk kanıtı:
  gecikme ölçülmüş bir sayıydı (yukarı bak), şimdi canlıda doğrulandı.
  Soruyu soran da cevabı veren de sistem; "rivayet değil, kayıt"
  iddiası ankette de karşılığını buluyor.

ASİSTAN TİKİ AÇABİLİYOR — AMA KAPILI (16 Ekim 2026)
  Ankette görsel yok, yani klasör izleyicisi hiç koşmuyor ve
  `auto_publish` tikini açan yer odur. Kullanıcı "anketler otomatik
  planlandığında gitsin" dedi ve iki seçenekten KAPILI olanı seçti:
  MCP'nin `shootboard_update_entry` aracına `autoPublish` eklendi, ama
  yalnızca `threads/poll` ve `threads/text_post` çiftlerinde açılabiliyor
  (`OTO_IZINLI`). Başka her çiftte istek reddediliyor ve sebebi
  yazılıyor. Kapatmak her zaman serbest.
  ⚠ Bu liste `pc/story-yukle.py`'deki politika tablosunun KOPYASI
  DEĞİL, alt kümesi: instagram/facebook çiftlerinin tikini zaten
  izleyici açıyor, asistanın oraya uzanmasına gerek yok.

DİZİ: ÇOK PARÇALI THREAD (16 Ekim 2026)
  `content.dizi` = 2. parçadan itibaren parça metinleri (1. parça
  caption). Yayından hemen sonra, her biri bir öncekinin ALTINA yanıt
  olarak gidiyor. En çok 10 parça, her biri 500 karakter.
  sql/66: `threads_yanitlari` tablosuna `tur` + `sira`, kısıt
  (kayit, tur, sira). Sıra şartı: parça N, N-1 yayınlanmadan ALINMIYOR
  (sql/48'deki story serisinin aynısı) -- ve N'nin hedefi N-1'in ÇIKAN
  gönderi kimliği.
  ⚠ Üçüncü parça patlarsa ilk ikisi YENİDEN GİTMİYOR: her parça kendi
  satırı, kendi durumu.
  ⛔ sql/65'i yeniden koşturursan sql/66'yı da koştur (iki işlev eski
  haline döner ve kuyruk HATA VERİR).

  GERÇEK POSTGRES'TE TEST EDİLDİ (testler/sql-yanit-kuyrugu.test.py) ve
  bu, kaynağa bakan ölçümlerin GÖREMEYECEĞİ iki hatayı yakaladı:
    1. `ana_gonderi_id` NOT NULL'du. 2. parçanın hedefi kuyruğa girerken
       YOK (o kimlik 1. parça yayınlanınca doğuyor), yani kuyruğa alma
       işlevi hata veriyordu -- ve anket cevapları da aynı işlevde
       olduğu için onlar da duruyordu.
    2. Boş parça atlanırken numarada BOŞLUK kalıyordu (1,3,4) ve sıra
       şartı olmayan 2. parçayı beklediği için zincir SESSİZCE
       kilitleniyordu. Numaralandırma artık boşlar atıldıktan sonra.
    3. (üçüncüsü de çıktı) `create or replace` bir işlevin dönüş tipini
       değiştiremiyor; `drop function` olmadan sql/66 hiç uygulanmıyor.

AYRI UYGULAMA, AYRI JETON
  Threads'in kendi Meta uygulaması var ("Shootboard Threads").
  Facebook/Instagram yayını META_PAGE_TOKEN ile graph.facebook.com'a
  gidiyor; Threads THREADS_TOKEN ile graph.threads.net'e. Jeton
  `threads_hesaplari` tablosunda duruyor (sql/63) ve süreye 10 gün kala
  kendini yeniliyor. ⛔ 60 gün yenilenmezse jeton KALICI ölür; tek çare
  panelden elle yeni jeton almak.

ÜÇ İZLEYİCİ, ÜÇ AYRI KURAL (16 Ekim 2026 kararı)
  Tek izleyiciyi üç klasöre yöneltmek teklif edildi; kullanıcı
  "üç izleyici dosyasının birbirinden tamamen ayrı olmasını tercih
  ediyorum" dedi.

    story   | story\cikti          | 100 MB | video + fotoğraf
    reels   | TESLIM\REELS_V2      | 1 GB   | video + kapak
    threads | TESLIM\THREADS       | 8 MB   | yalnızca fotoğraf

  8 MB ve 10:1 oran sınırı Meta'nın belgesinden
  (developers.facebook.com/docs/threads/create-posts). Oran ölçülmüyor:
  Pillow bağımlılığı yok, oranı aşan görseli Threads reddediyor ve
  kapsayıcı ERROR dönüyor — worker bunu kalıcı hata yazıp e-posta
  gönderiyor, sessiz kalmıyor.

  ⚠ PAYLAŞILAN TEK ŞEY YÜKLEYİCİ (story-yukle.py) ve bu kasıtlı:
  otomatik yayın politikası (OTOMATIK_YAYIN) tek yerde duruyor. Üç
  kopya çıkarmak, 10 Ekim'de 66 kaydı otomatik yayında bırakan hatanın
  aynı sınıfından olurdu.

İLK GERÇEK YAYIN PATLADI — ÜÇ EKSİK ÇIKTI (16 Ekim 2026)
  Worker kapsayıcıyı yarattı (görsel işlendi, durum FINISHED), yayın
  çağrısını yaptı ve çağrı SESSİZCE sonuçsuz kaldı: ne gönderi, ne
  e-posta, ne log satırı. Teşhis, kapsayıcı durumu Threads'e elle
  sorularak yapılabildi. Üçü de düzeltildi (worker 1.17.0):

  1. Yakalanan hata yalnızca `last_error`'a yazılıyordu; bir sonraki tur
     üstüne yazdı ve asıl mesaj yok oldu. Artık loga da düşüyor.
  2. "Sonucu bilinmiyor" hâli kendiliğinden çözülmüyordu — kayıt beş
     dakikada bir sonsuza kadar erteleniyordu. Artık ikinci bir tanık
     var: kapsayıcının durumu. PUBLISHED = çıktı, FINISHED/ERROR/EXPIRED
     = kesin çıkmadı. ⛔ Sıra önemli: önce profildeki son gönderiler,
     kapsayıcı durumu ancak liste OKUNDU ve boşsa karar veriyor. Tersi,
     Meta durumu geç güncellerse çift gönderi demek.
  3. Threads çağrılarında zaman aşımı yoktu; askıda kalan istek
     isolate'ı öldürtüyor ve catch hiç çalışmıyor. Artık 20 saniye.

DAĞITIM ÖLÇÜMÜ — AÇIK (16 Ekim 2026)
  Threads'e geçmenin sebebi dağıtımı ölçmek. ⚠ Kullanıcının notu:
  **elle gönderdiği Threads gönderileri de zaman zaman 0 görüntülenme
  almış.** Yani "Shootboard'dan gidince 0 aldı" tek başına bir şey
  kanıtlamıyor; taban gürültülü. Birkaç gün, hem sistemden hem elle
  giden gönderilerle eşli ölçüm gerekiyor.

  13 Ekim dersi burada da geçerli: ölçüm doğru olabilir, teşhis yanlış
  olabilir. Facebook'ta "API reels'i dağıtmıyor" denmişti; gerçek sebep
  uygulamanın hiç yayınlanmamış olmasıydı.

  AÇIK TEKLİF: görüntülenmeleri elle okumak yerine Shootboard kendi
  toplayabilir (her kaydın gönderi kimliği saklı, Threads insights ucu
  var). Kullanıcı karar vermedi.

---

## OTOMATİK STORY YAYINI — çalışıyor (22–23 Eylül 2026)

Instagram ve Facebook sayfa story'leri artık kendiliğinden yayınlanıyor.
Kullanıcının elle yaptığı tek iş kaldı: render'ı klasöre bırakmak.

ZİNCİR
  planlama sohbeti --MCP--> takvim kaydı (autoPublish açık, medya yok)
  render dosyası --> E:\CLAUDE VIDEOS\story\cikti
  Görev Zamanlayıcı (5 dk) --> pc/story-izle.bat --> pc/story-izle.py
      --> R2'ye yükle, mediaName ile kaydı bul, bağla, autoPublish aç
  pg_cron (1 dk) --> pg_net --> Edge Function story-yayin
      --> Instagram (konteyner + media_publish) / Facebook (rupload)
  hata olursa Resend ile e-posta

DOSYALAR
  sql/41  kuyruk, durum sütunları, RPC'ler
  sql/42  çöküş izi (publish_ref / publish_called_at) + story_asili_topla
  sql/43  pg_cron + pg_net + Vault
  sql/44  kuyruk platformu da döndürüyor
  sql/45  publish_at'i post_date+post_time'dan üreten tetikleyici
  sql/46  parça sırası: publish_at, media_name, id
  sql/47  story_ertele(0) = "bekleme yok, sıradaki tur"
  sql/48  seri: önceki parça çıkmadan sonraki çıkmaz
  supabase/functions/story-yayin/index.ts   worker
  pc/story-yukle.py   elle yükleme
  pc/story-izle.py    klasör izleyici
  pc/story-izle.bat   Görev Zamanlayıcı sarmalayıcısı
  pc/r2-supurge.py    R2'de kalanları bulur (elle, Zamanlayıcıya BAĞLI DEĞİL)
  pc/r2-supurge.bat   çift tıkla listele; silmek için --sil
  pc/yedek-al.py      takvimi diske yedekler (SALT OKUR)
  pc/yedek-al.bat     Görev Zamanlayıcı sarmalayıcısı, haftada bir
  pc/gizli-calistir.vbs  .bat'i pencere açmadan çalıştırır (17 Ekim 2026)

GÖREV PENCERESİ GİZLENDİ — VE GÖRÜNÜRLÜK NEREYE GİTTİ (17 Ekim 2026)

  Üç izleyici görevi beş dakikada bir koşuyor ve her koşuda bir
  cmd.exe penceresi öne fırlıyordu. Kullanıcının sözleri: "ben çekim
  yaparken sürekli elimin altında ekrana çıkıyor". Görev Zamanlayıcı
  bir .bat'i doğrudan çağırdığında o pencereyi gizleyemiyor.

  pc/gizli-calistir.vbs araya giriyor: .bat'i GİZLİ pencerede
  başlatıyor, BİTMESİNİ BEKLİYOR, çıkış kodunu olduğu gibi döndürüyor.

  Görev Zamanlayıcı > görevi aç > Eylemler > Düzenle:
    Program/script : wscript.exe
    Add arguments  : "E:\SHOOTBOARD\gizli-calistir.vbs" "E:\SHOOTBOARD\threads-izle.bat"
    Start in       : E:\SHOOTBOARD
  (üç görevde de aynı, yalnızca .bat adı değişiyor)

  ⚠ BU DEĞİŞİKLİK BİR GÖZLEM YERİNİ KAPATIYOR. Pencere tanışık bir
  işaretti: akşam boyunca hiç açılmadıysa görev koşmuyordu. Geriye
  iki yer kalıyor ve ikisi de sessizce bozulabilir:

    1. "Last Run Result" sütunu. Sarmalayıcı Run(..., 0, False)
       yazsaydı ya da WScript.Quit'i atlasaydı görev HER KOŞUYU 0x0
       gösterirdi — izleyici aylarca patlasa bile. Yalancı yeşil,
       hiç ışıktan daha kötü.
    2. .bat'lerin kendi günlükleri (story/reels/threads-izle.log).
       Pencere gizlendiği için tek okunur iz artık onlar.

  CANLIDA DOĞRULANDI (17 Ekim 2026). Üç görev 17:55'te başlatıcıya
  bağlandı; 19:44'te üç günlüğün de son yazma saati 19:40–19:44'tü,
  yani iki saat boyunca her tur koştular ve pencere hiç açılmadı.
  Değişiklikten önceki taze günlükler kanıt sayılmadı: onlar eski
  eylemle koşmuş olabilirdi.

  testler/gizli-baslatici.test.js (23 ölçüm) ikisini de koruyor;
  yedi mutasyonun yedisi de yakalandı — pencereyi görünür yapmak,
  beklememek, sabit 0 dönmek, boş çağrıyı sessizce geçmek, yolu
  tırnaklamamak, dönen kodu hiç okumamak, dosyaya Türkçe karakter
  sokmak (wscript sistem kod sayfasıyla okuyor, sözdizimi hatası
  verdirir).

R2 TEMİZLİĞİ — İKİ AYRI MEKANİZMA (9–10 Ekim 2026)

  1. İzleyicinin içindeki temizlik (story-yukle.py: temizlenecekler).
     Her turda çalışıyor, DEFTERE bakıyor. Normal akışta yeterli.
  2. pc/r2-supurge.py — KOVAYA bakıyor, deftere değil.

  İkincisi şunun için var: birincisi R2'yi hiç listelemiyor, PC'deki
  defteri geziyor. Defter girdisi yoksa nesne GÖRÜNMEZ ve sonsuza kadar
  kalıyor. Girdi şu hallerde kayboluyor: klasör boşaltıldı, defter
  silindi, PC değişti, dosya elle kondu, yüklendikten sonra adı değişti.

  9 Ekim'de kovada iki örneği görüldü:
    2026-10-05_story_deneme_k1.mp4    21 Eylül'den kalma bir deneme;
                                      hiçbir kayıt bu adı taşımıyor.
    2026-10-03_reels_tekfur_bes_hayat bağlı tek kaydın (yt shorts)
      .mp4 + .jpg                     mediaName'i BOŞ, otomatiği kapalı.

  İkincisinin bedeli iki yönlü ve ikisi de sessizdi: o kayıt dosyasını
  bir daha bulamaz (yayınlanamaz), temizlik de dosyayı tam adla
  eşleştiremez (R2'de kalır). Bu yüzden kayda_yaz artık dönen
  mediaName'i gönderilenle karşılaştırıp UYARI basıyor.

  SÜPÜRGENİN KURALLARI (testler/r2-supurge.test.py, 43 ölçüm)
    · varsayılan HİÇBİR ŞEY SİLMEZ; yalnızca --sil silinebilir grubu siler
    · matchedBy='date' eşleşme sayılmıyor — o günün BAŞKA kayıtlarına
      bakıp silmek, bizim dosyamızı silmek olurdu
    · kapak videosunun kararına bağlı; tek başına değerlendirilseydi her
      kapak "öksüz" çıkardı
    · öksüz bir nesne silinmeden önce 7 gün bekliyor (yükle→kayda-yaz
      arasındaki yarış) ve tarihi geçmiş olmalı
    · adında tarih olmayan hiçbir nesne kendiliğinden silinmiyor
    · Görev Zamanlayıcıya BAĞLANMIYOR: silen bir iş gözetimsiz koşmamalı

OTOMATİK YAYIN POLİTİKASI — TEK TABLO (13 Ekim 2026)

  pc/story-yukle.py: OTOMATIK_YAYIN

    instagram/story   ✓    facebook/reels   ✓  13 Ekim'de geri açıldı
    facebook/story    ✓    tiktok/reels     ✗  video.publish onayı yok
    instagram/reels   ✓    youtube/shorts   ✗  denetim kapısı kapalı

  13 EKİM 2026 — FACEBOOK ÇÖZÜLDÜ. Kök sebep "Facebook API reels'i
  dağıtmıyor" değilmiş: Meta uygulaması hiç yayınlanmamıştı (In
  development) ve o durumda içerik yalnızca uygulamada rolü olan
  kişilere gidiyor. Uygulama Live yapıldı; reels görüntülenme aldı,
  hikâyeler 39 ve 14 aldı (önceki 28 gün düz 0'dı — hikâyeler de
  etkilenmişti, "etkilenmiyor" diye yazılmış olması doğrulanmamış
  bir iddiaydı).

  Açmak iki kapı gerektirdi: tablo (burası) + story_kuyruk_al
  (sql/58). sql/56 yeniden koşturulursa ikinci kapı kapanır.

  ⚠ TABLODA OLMAYAN ÇİFT KAPALI. Yeni bir platform/tür sessizce yayına
  başlamıyor. Bir çift açılacaksa DEĞİŞECEK TEK YER burası.

  Neden var: yükleyicide `otomatik_ac` TEK BİR GLOBAL BAYRAKTI ve eşleşen
  her kayda uygulanıyordu. Bir reels dosyası dört kayıt buluyor (ig/fb/tt
  reels + yt shorts) ve dördünün de autoPublish'ini açıyordu.

  10 Ekim'de bedeli ölçüldü: 66 kayıt (26 tiktok, 24 youtube, 16
  facebook) otomatik yayında duruyordu. İkisi iki gün sonraydı ve biri
  YouTube'du — denetim kapısı kapalıyken oraya video gidecekti.
  Kayıtlar SQL ile kapatıldı (64 satır; kullanıcı bir kısmını zaten
  kendisi kapatmıştı), ama izleyici bir sonraki dosyada hepsini yeniden
  açacaktı. Asıl arıza buydu.

  İKİ YERDE UYGULANIYOR, ikisi de gerekli:
   1. YAZMADAN ÖNCE — kaydi_bul artık kimlik değil KAYIT döndürüyor,
      yani platform kararın verildiği yere kadar taşınıyor.
   2. YAZDIKTAN SONRA — --id dalında platform bilinmiyor (tek kayıt
      getiren uç yok). Dönen kayıt platformu taşıyor; politika ihlal
      edildiyse autoPublish geri kapatılıyor ve sebebi ekrana yazılıyor.
      Normal yolda bu dal hiç çalışmıyor, yani ikinci istek maliyeti yok.

  Ölçüm: testler/oto-yayin-politikasi.test.py (36). Sekiz mutasyon
  denendi; ilk turda biri HAYATTA KALDI — story testinde iki kayıt da
  izinli olduğu için politikayı tamamen atlayan bir story-izle.py de aynı
  sonucu veriyordu. Teste bir yt/shorts kaydı eklendi (find, mediaName'i
  YAYIN_TURLERI boyunca eşleştiriyor; bu gerçek bir durum) ve mutasyon
  yakalandı. Şimdi 8/8.

TIKTOK DIRECT POST — ⛔ UYGUN DEĞİL, KAPANDI (27 Ekim 2026)
────────────────────────────────────────────────────────────────────

⛔ **ARAYÜZ YAZMAYIN. DENETİME BAŞVURMAYIN.** Aşağıdaki 12 Ekim planı
(7 maddelik arayüz + denetim) **geçersiz.** Sebep arayüz değil,
UYGUNLUK.

TikTok'un kendi App Review Guidelines belgesi:

    "API Clients must not be limited to test applications and should
     be intended for a wide audience, not limited to internal
     groups/private use."

Ve belge **kabul edilemez örnek** olarak şunu veriyor: *bir ekibin
yönettiği hesaplara yükleme yapan araç.*

Shootboard tam olarak bu: tek kullanıcılı, kendi hesaplarına yükleyen
bir araç. Yani arayüz kusursuz olsa bile denetim uygunluktan reddedilir.
12 Ekim'de tespit edilen "varsayılan gizlilik olamaz" kuralı doğruydu
ama ALTINDA daha sert bir kural varmış ve o gün görülmemiş.

BAĞIMSIZ DOĞRULAMA (üçüncü taraf, kanıt değil ama aynı yöne işaret)
  Postiz'in GitHub kayıtları:
    #2297 (21 Ekim 2026) — kendi sunucusunda Postiz kuran kullanıcı
          tam bu "internal/own-account use" gerekçesiyle reddedilmiş
    #1563, #1362 — daha eski redler, arayüz kurallarından
          (özellikle varsayılan gizlilik)

POSTIZ DENENDİ, KULLANILMAYACAK (27 Ekim 2026, kullanıcı kararı)
  · Kendi sunucuna kurmak ÇÖZMÜYOR: kendi TikTok uygulamanı açman ve
    aynı denetimden geçmen gerekiyor -- birebir aynı duvar.
  · Postiz Cloud ($29/ay, 5 kanal) teorik olarak çözerdi: yayın
    Postiz'in çok kullanıcılı, denetimli uygulamasından gider ve
    uygunluk kuralı Postiz için sorun değil.
    ⚠ Ama "Cloud'da TikTok kendi uygulamanı gerektirmez" iddiası
    HİÇBİR KAYNAKTA açıkça yazmıyor; doğrulanmadı.
  · Kullanıcı kararı: Postiz kullanılmayacak. Kodda hiçbir yere
    bağlanmadı, silinecek bir şey yok.

GERİYE KALAN TEK OTOMASYON: TASLAK YOLU
  `/v2/post/publish/inbox/video/init/` -- video TikTok GELEN KUTUSUNA
  taslak olarak düşüyor, paylaşmayı kullanıcı uygulamadan yapıyor.
  Denetim GEREKMİYOR, uygunluk kuralından ETKİLENMİYOR, bugün çalışır.
  İzin (`video.upload`) 12 Ekim'de verilmiş ve duruyor.

  ⚠ ALT YAZI GİTMİYOR. `post_info` yalnızca Direct Post ucunda var.
  Kullanıcı alt yazıyı TikTok uygulamasında yazıyor.

  ⛔ TASLAK YOLU DA AÇILMAYACAK — 27 Ekim 2026, kullanıcı kararı.
  Seçenek açıkça soruldu ("aç" / "kapalı kalsın" / "hiç planlamayalım"),
  cevap **"kapalı kalsın"**. Yani TikTok'a Shootboard'dan HİÇBİR ŞEY
  gitmiyor; takvimdeki TikTok kayıtları yalnızca plan olarak duruyor,
  dosya R2'ye bile çıkmıyor. Bu bir eksiklik değil, VERİLMİŞ KARAR --
  "neden TikTok kapalı" diye tekrar araştırmaya gerek yok.

  ⛔ YANİ TIKTOK "REELS GİBİ" OLAMAZ. Kullanıcı 27 Ekim'de "tıpkı
  reels gibi post edebiliyor olmalıyım" dedi; teknik cevap HAYIR ve
  sebebi bizde değil, TikTok'un uygunluk kuralında. Bunu bir daha
  araştırmaya gerek yok.

HESAP DURUMU (27 Ekim 2026'da `tiktok_hesaplari`'ndan okundu)
  kullanici_adi    Gerçeğin İzleri
  kapsamlar        user.info.basic · video.publish · video.upload
  erisim_bitis     13 Ekim 2026 (eskimiş -- kod yenileme jetonuyla
                   kendiliğinden tazeliyor, iş değil)
  yenileme_bitis   12 Ekim 2027
  son_hata         boş
  ⚠ Bu bağın Sandbox'ta mı Production'da mı kurulduğu bu satırdan
  GÖRÜNMÜYOR. 12 Ekim'deki çalışma Sandbox'taydı.

⬇ AŞAĞISI TARİHSEL KAYIT. Uygunluk kuralı yüzünden uygulanabilir
değil; 12 Ekim'de ne düşünüldüğünü ve kodun nereye kadar gittiğini
göstermek için duruyor.

TIKTOK `video.publish` — DURDURULDU (12 Ekim 2026, kullanıcı kararı)
────────────────────────────────────────────────────────────────────

NEREDE KALDIK — altyapı HAZIR, eksik olan ARAYÜZ

  Sahada doğrulandı (Sandbox `shootboard-test`, hedef `gerceginizleritv`):
    ✓ Direct Post açıldı, `video.publish` kapsamı verildi
    ✓ creator_info/query cevap veriyor
    ✓ /v2/post/publish/video/init/ çağrılıyor
    ✗ TikTok 403: `unaudited_client_can_only_post_to_private_accounts`

  Yani zincirin tamamı TikTok'un kapısına kadar çalışıyor. Kod
  (story-yayin 1.14.0) bu hatayı adıyla yakalayıp anlaşılır mesajla
  erteliyor; `video.publish` yoksa eski taslak yoluna düşüyor. Bugün
  hiçbir şeyi bozmuyor, olduğu yerde durabilir.

⛔ NEDEN DURDURULDU — denetim bir form işi DEĞİL, ARAYÜZ İŞİ

  TikTok "Content Sharing Guidelines" belgesi Direct Post kullanan
  uygulamanın ARAYÜZÜNE şart koyuyor. Shootboard'da hiçbiri yok:

    · bağlı TikTok hesabının takma adı görünmeli
    · başlık alanı
    · gizlilik seçici, creator_info'nun verdiği listeden
    · ⚠ VARSAYILAN GİZLİLİK OLAMAZ -- kullanıcı elle seçmeli
    · yorum/düet/dikiş anahtarları, creator_info'ya uygun
    · ticari içerik bildirimi + "Your brand" / "Branded content"
    · creator_info "şu an atamaz" diyorsa yayını durdurup uyarmalı

  ⚠ Yazdığımız `tiktokGizlilik()` gizlilik seviyesini KENDİ seçiyor --
  kuralın açıkça yasakladığı şey. Bu hâliyle denetimden döner.
  Gerçek projelerin aynı gerekçeyle reddedilip arayüzlerini yeniden
  yazdığı iki PR bulundu (postiz-app#1563, socialApp#120).

  Ayrıca RESMÎ: denetimsiz istemcide hesap gönderi anında GİZLİ olmak
  zorunda, ve 24 saatte 5 kullanıcı sınırı var. Yani demo videosu için
  gizli bir test hesabı şart; kullanıcının herkese açık kanalı olmaz.

DEVAM EDİLİRSE YAPILACAKLAR SIRASI
  1. Takvim düzenleyicisine TikTok bölümü (yukarıdaki yedi madde)
  2. Seçimlerin saklanması (yeni alanlar)
  3. Worker otomatik seçmek yerine kullanıcının seçtiğini göndersin
  4. Testler
  5. Gizli test TikTok hesabı + Sandbox'a Target User olarak ekleme
  6. Demo videosu -- shootboard.app üzerinde, bu arayüzü kullanarak
  7. Production formu + Submit (metinler hazır, aşağıda)

HAZIR BEKLEYENLER (yeniden yazmaya gerek yok)
  Production formu `Draft`; Sandbox'ta zaten dolu olanlar oradan
  kopyalanabilir: Login Kit + Content Posting API, Redirect URI
  https://shootboard.app/tiktok.html, ToS/Privacy URL'leri, Web
  platformu, https://shootboard.app.
  Description (110/120) ve App review açıklaması (955/1000) 12 Ekim
  sohbetinde yazıldı.

KAZANÇ / MALİYET — neden ertelendi
  Kazanç: TikTok alt yazısını elle yazmaktan kurtulmak. Video zaten
  otomatik gidiyor (taslak olarak gelen kutuya), kullanıcı açıp alt
  yazıyı yapıştırıp paylaşıyor. Yani kazanç gönderi başına bir
  kopyala-yapıştır.
  Maliyet: yukarıdaki 7 madde + ilk turda sık reddedilen bir denetim.
  YouTube onayı (24 kayıt) ve Supabase yedeği (426 kayıt, yedek YOK)
  bundan yüksek getirili.

THREADS — ARAŞTIRILDI, KARAR KULLANICIDA (16 Ekim 2026)
────────────────────────────────────────────────────────────────────

  Soru: "Threads için Shootboard üzerinden gönderi yapabilir miyiz?"
  Kısa cevap: TEKNİK OLARAK EVET, mimarimize TikTok'tan çok daha iyi
  oturuyor. Ama CEVAPLANMAMIŞ BİR RİSK var ve o risk bizi Facebook'ta
  sekiz gün yakan şeyin birebir aynısı.

  ⚠ KAYNAK UYARISI
  Meta'nın kendi belgelerine bu oturumdan ERİŞİLEMEDİ (ağ engeli:
  developers.facebook.com çözülmüyor). Aşağıdakilerin çoğu üçüncü
  taraf rehberlerden; hangisinin ne olduğu tek tek yazıldı. Koda
  başlamadan önce resmi belgeden doğrulanmalı.

  NE KESİN (birden çok bağımsız kaynak aynı şeyi söylüyor)
    · Threads'in resmi yayın API'si var: metin, görsel, video, karusel
    · Akış iki adımlı -- kapsayıcı oluştur, sonra yayınla. Instagram
      yolumuzun aynısı, yani kod iskeleti elimizde
    · Medyayı ADRESTEN ÇEKİYOR, dosya yüklemiyoruz. Dosyalarımız zaten
      R2'de herkese açık adreste; bu kısım bizde HAZIR
    · Kendi zamanlaması YOK -- yayın saatini biz tutacağız. Shootboard
      zaten bunu yapıyor
    · İzinler: `threads_basic` + `threads_content_publish`
    · OAuth AYRI: threads.net/oauth/authorize üzerinden, uzun ömürlü
      jeton 60 gün, yenileyince 90. Facebook/Instagram bağlantımızdan
      KENDİLİĞİNDEN GELMİYOR
    · Sınırlar: ~250 gönderi/24 saat, metin ~500 karakter

  YENİ UYGULAMA GEREKMİYOR (Meta'nın kendi belgesinden alıntılanmış)
    "Access the Threads API" kullanım senaryosu MEVCUT uygulamaya
    eklenebiliyor ve Page-management senaryosuyla uyumlu olduğu
    açıkça örnek veriliyor. Bizim uygulamamız tam olarak o -- yani
    Live olan uygulamamıza eklenebilir.
    ⛔ AMA: eklenen bir kullanım senaryosu GERİ ALINAMIYOR. Uygulama
    13 Ekim'de Live yapıldı ve Facebook/Instagram yayını ona bağlı;
    geri alınamayan bir değişikliği hafife almayalım.

  ⛔ CEVAPLANMAYAN SORU -- ASIL RİSK BU
    Geliştirme (Development) modundayken API ile atılan bir Threads
    gönderisi HERKESE GÖRÜNÜYOR MU, yoksa Facebook'ta olduğu gibi
    yalnızca uygulamada rolü olanlara mı?

    Dört ayrı arama yapıldı, HİÇBİR kaynak bunu söylemiyor. Hepsi
    "development modda yalnızca tester hesaplar BAĞLANABİLİR ve
    PAYLAŞABİLİR" diyor -- yani kimin gönderebileceğini anlatıyor,
    gönderinin kime GÖRÜNECEĞİNİ değil. İkisi farklı şey.

    Bu ayrımı bilmemek Facebook'ta bize sekiz gün kaybettirdi:
    yayınlama çalışıyordu, dağıtım yoktu, hiçbir yerde hata yoktu.
    3 Ekim'deki reel "başarıyla yayınlandı" ve Erişim 1 aldı.

    Threads'te aynı tuzak VAR MI bilmiyoruz. Bilmeden kod yazmak,
    Ekim ayını tekrar yaşamak demek.

  KAZANÇ / MALİYET
    Kazanç: kullanıcı Threads'e ELLE atıyor. Otomatikleşirse gönderi
    başına bir elle işlem kalkıyor.
    ⚠ Ama kullanıcının kendi gözlemi: "bazı gönderiler 0 görüntülenme
    aldı bazıları 1000 üzerinde, ne görüntülenecek belli değil."
    Yani kanalın kendisi oynak; otomatikleştirmenin getirisi belirsiz.

    Maliyet: App Review (her izin için ayrı başvuru + ekran kaydı),
    kaynaklara göre 2-4 hafta; kimlik doğrulama bir hafta daha
    ekleyebiliyor. Üstüne yeni bir OAuth yolu ve yeni bir yayın yolu.

  ÖNERİLEN SIRA -- kod EN SONDA
    1. Resmi belgeden doğrula: development modda dağıtım var mı?
       (Bu oturumdan erişilemedi; kullanıcı açabilir ya da başka bir
       oturumda bakılır.)
    2. Cevap "dağıtım normal" ise: KÜÇÜK BİR DENEY. Uygulamayı Live
       yapmadan, tester hesapla tek bir gönderi at, aynı gün elle bir
       gönderi at, görüntülenmeleri karşılaştır. Threads'in oynaklığı
       yüzünden TEK ÖLÇÜM YETMEZ -- birkaç gün üst üste eşli ölçüm.
    3. Deney olumluysa App Review, sonra kod.
    Cevap "yalnızca rolü olanlara görünür" ise: App Review'dan ÖNCE
    kod yazmanın anlamı yok, Facebook'taki sırayı tekrarlamayalım.

  ──────────────────────────────────────────────────────────────────
  16 EKİM 2026 AKŞAMI — İLK DENEME YAPILDI, YAYINLANDI
  ──────────────────────────────────────────────────────────────────

  ✓ CEVAPLANDI: `threads_content_publish` DEVELOPMENT MODDA ÇALIŞIYOR.
    Tech Provider olmaya, App Review'a, geri alınamaz hiçbir karara
    gerek YOK. Paneldeki "+ Add to App Review" düğmesine BASILMADI.

    Kanıt: pc/threads-deneme.py ile atılan metin gönderisi.
    kapsayıcı 18099895004330632 -> gönderi 18126058492786488

  KURULUM — gerçekte ne gerekti
    1. AYRI bir Meta uygulaması ("Shootboard Threads"). Mevcut Live
       uygulamamıza DOKUNULMADI; Facebook/Instagram yayını etkilenmedi.
    2. Kullanım senaryosu: "Access the Threads API".
       `threads_basic` kendiliğinden "Ready for testing" geliyor.
    3. İş portföyü BAĞLANMADI ("I don't want to connect yet"). Test
       için gerekmiyor; gereksiz bir bağ kurmaktan kaçınıldı.
    4. App roles > Threads Tester olarak kendi hesabı; davet PC'den
       kabul edildi (telefondaki menü bulunamadı).
    5. Use cases > Settings > User Token Generator ile uzun ömürlü
       jeton. ⚠ Yalnızca HERKESE AÇIK Threads hesapları için.
       Jeton: SHOOTBOARD_THREADS_TOKEN ortam değişkeni.

    ⚠ OAuth AKIŞINA GEREK KALMADI. Yönlendirme sayfası (threads.html),
    kod->jeton takası, uzun ömürlü jeton yenileme -- hiçbiri
    yazılmadı. Jeton üreticisi hepsini atlatıyor. Gerçek entegrasyona
    geçilirse OAuth yine gerekebilir (jeton ~60 gün), ama ÖLÇÜM için
    gerekmedi.

  ⛔ HÂLÂ CEVAPSIZ: DAĞITIM
    Gönderi yayınlandı -- ama GÖRÜNÜYOR MU? Facebook'ta yayınlama
    çalışıyordu, dağıtım yoktu, hiçbir yerde hata görünmüyordu ve bu
    sekiz gün kaybettirdi. Asıl soru hâlâ bu.

    Ölçüm planı: birkaç gün üst üste, aynı gün bir API gönderisi ve
    bir elle gönderi, 24 saat sonra görüntülenmeler karşılaştırılacak.
    ⚠ TEK ÖLÇÜM YETMEZ -- kullanıcının kendi gözlemi: "bazı gönderiler
    0 aldı, bazıları 1000 üzerinde." Kanal oynak; tek bir çift
    yanıltır. Facebook'ta tek ölçümle yanlış teşhis koymuştuk.

  DURUM: ölçüm sürüyor. Shootboard entegrasyonu YAZILMADI.

YEDEK — Supabase ÜCRETSİZ planda, otomatik yedek YOK (12 Ekim 2026)
────────────────────────────────────────────────────────────────────

  Kullanıcı Pro'ya (25 $/ay, günlük yedek, 7 gün saklama) şimdilik
  geçmedi. Yedek tamamen `pc/yedek-al.py`'ye kaldı.

  ⚠ ASIL RİSK SUPABASE'İN ÇÖKMESİ DEĞİL, BİZİM HATAMIZ. Ekim 2026
  boyunca canlı veritabanında elle UPDATE'ler koşuldu: 64 kayıt, 25
  kayıt, tek kayıtlar. Hepsi tuttu çünkü her seferinde önce SELECT ile
  bakıldı. Bir gün bir `where` satırı eksik kalırsa bugün geri dönüş YOK.

  Pro'ya geçilse bile bu script gerekli kalır: Pro 7 gün saklıyor, üç
  hafta sonra fark edilen bir bozulmaya yetmez.

  NE YEDEKLER: bütün takvim kayıtları + projeler. Medya YOK (R2'de ve
  asılları kullanıcının diskinde), kod YOK (GitHub'da).

  ⛔ SALT OKUR: yalnızca shootboard_list_entries ve _list_projects.
  PATCH yok, silme yok, `uploaded`a dokunmuyor.

  Hesap durumu (12 Ekim): 8 hesap, 2'si tanınmayan gerçek kullanıcı.
  Yani artık başkalarının verisi de tutuluyor; privacy.html'de onlara
  taahhüt var. Pro kararı bu yüzden tekrar gündeme gelebilir.

  Ölçüm: testler/yedek-al.test.py (31). Dokuz mutasyon denendi; ilk
  turda İKİSİ HAYATTA KALDI ve ikisi de testin zayıflığıydı:
    · pencere ölçümü KENDİ sabitine bakıyordu (sabit 180 olunca ölçüm
      de 180'e bakıyor) -> ucun gerçek sınırı 90'a bağlandı
    · geri okuma doğrulaması yalnızca kaynak metninde aranıyordu ->
      davranışla ölçülüyor (json.load eksik döndürülüp çıkış bekleniyor)
  Script'te bulunan GERÇEK hata: dosya damgası dakika hassasiyetindeydi,
  aynı dakika içinde iki kez koşmak öncekinin üstüne yazıyordu.

PAZARLIK KONUSU OLMAYAN KURALLAR
  ⛔ Hiçbir kod `uploaded` sütununa yazmıyor. Bu kullanıcının kendi
     işareti; sistemin durumu `publish_state`. Kural söz değil YAPI:
     worker calendar_events'i hiç UPDATE etmiyor, yalnızca o sütuna
     erişemeyen security-definer RPC'leri çağırıyor; toRow() bütün
     yayın sütunlarını bilerek dışarıda bırakıyor.
  ⛔ MCP sunucusunda silme aracı yok. Kaydı yalnızca kullanıcı,
     uygulamanın içinden siler.
  ⛔ MCP erişimi yalnızca hesap sahibinin kendi anahtarıyla.

SAHADA ÖLÇÜLEN, SONRA DÜZELTİLEN
  22 Eylül, ilk çok parçalı video yayını: Instagram'da 1/2 ile 2/2
  arasına 2 dk 17 sn girdi. İki ayrı sebebi vardı:
   1. Konteyner beklemeleri TOPLANIYORDU (her video ~100 sn). Artık
      turun başında hepsi birlikte yaratılıyor, beklemeler üst üste
      biniyor. Yayın sırası değişmiyor.
   2. "Bir dakika ertele" pratikte iki dakikaydı: tur dakika ortasında
      bittiği için retry_after bir sonraki turu ıskalıyordu. sql/47.

AÇIK KALANLAR (sebebiyle)

1. **Ayarlar sayfasında Meta bağlantı durumu** — ✖ KAPATILDI
   (25 Eylül, kullanıcı kararı: "atla bu konuyu").
   Şartname Bölüm 10'un üçüncü maddesiydi. Yapılmama sebebi: tehlikeli
   durum zaten kapalı -- worker token'ı yokluyor, bozulunca kuyruğu
   durduruyor ve e-posta atıyor, yani sessizce ölmüyor. O satırın tek
   gerçek faydası "hangi sayfaya/hesaba bağlıyım" sorusunu tek bakışta
   cevaplamaktı; 22 Eylül'de bu soru saatler almıştı. Maliyeti:
   `sistem_durumu` tarayıcıya kapalı, ayrı bir uç gerekiyor.
   AÇILMA KOŞULU: token bir daha sorun çıkarırsa geri dönülür.

2. **`shb_` MCP anahtarını değiştir** — ✖ KAPATILDI
   (25 Eylül, kullanıcı kararı).
   Anahtarın tamamı sohbet kaydında iki kez geçti ama YAYIMLANMADI:
   depoya girmedi, çalışan ağaç ve git geçmişi 23 Eylül'de kontrol
   edildi, temiz. O anahtarla yapılabilecek en kötü şey takvime çöp
   kayıt eklemek -- silme aracı yok, Meta'ya yayın yapamıyor, Meta
   token'ını okuyamıyor. Sohbet kaydına ulaşabilen tek taraf hesabın
   kendisi.
   AÇILMA KOŞULU: anahtar herkese açık bir yere düşerse -- depoya
   girerse ya da paylaşılan bir ekran görüntüsünde görünürse.

3. **NVIDIA (build.nvidia.com) ücretsiz modelleri** — ✖ MÜMKÜN DEĞİL
   (24 Eylül'de denendi). `integrate.api.nvidia.com` tarayıcıdan
   çağrılmayı desteklemiyor: ön uçtaki OPTIONS isteğine
   `Access-Control-Allow-Origin` başlığı dönmüyor. Araya sunucu koymak
   teknik olarak mümkün ama kullanıcının anahtarı bizim sunucumuzdan
   geçerdi ve "anahtarını görmeyiz" sözü bozulurdu -- Gemini'nin
   seçilme sebebi de zaten buydu.
   BAŞKA BİR SAĞLAYICI DÜŞÜNÜLÜRSE otuz saniyelik test, tarayıcı
   konsolunda:
     fetch('https://<saglayici>/v1/models', { headers:{ Authorization:'Bearer test' } })
       .then(r => console.log('CORS AÇIK, durum:', r.status))
       .catch(e => console.log('CORS KAPALI:', e.message));
   401 görürsen aday olabilir; "Failed to fetch" görürsen daha ileri
   gitmeye gerek yok.

4. **Planlama sohbetine kural:** çok parçalı story'de bütün parçalar
   AYNI `time` değerini almalı. 23 Eylül'de 09:00 / 09:02 diye
   planlanmıştı; kuyruk bir kaydı `publish_at` gelmeden alamadığı
   için parçalar arasına iki dakika giriyordu -- kod kusuru değil,
   plan kusuru. Sıra `mediaName`'deki `_k1`/`_k2`'den geliyor.

5. **İzleyici yalnızca bilgisayar açıkken çalışıyor.** Kapalıyken tur
   atmıyor; açılınca kaçan turlar telafi ediliyor. Yayın Supabase'de,
   ondan bağımsız -- ama yalnızca önceden yüklenmiş medya için.

6. **Seri koruması `auto_publish` kapalı önceki parçayı bekletmiyor.**
   Onu elle yayınlayacak demektir ve sistem ne zaman yapıldığını
   bilemez; bekletseydi sonraki parça sonsuza kadar kuyrukta dönerdi.
   Bilinçli boşluk, sql/48'in başında yazılı.

---

## ÇEKİM LİSTESİ — ikinci tur (11 Eylül 2026)

Birinci tur yapıldı: ihtiyaç kütüphanesi (`user_prefs.prefs.ihtiyaclar`),
projenin çekim listesi (`projects.checklist`, sql/37), mekan kartındaki
izin/dikkat notlarının kendiliğinden madde olması, sahada doldurulan
not alanı, toplu yapıştırma.

Konuşuldu, **ikinci tura bırakıldı**:

1. **Hazır setler.** Kütüphaneden seçilmiş, isimlendirilmiş paketler:
   "Sokak çekimi seti", "Röportaj seti". Yeni projede tek tıkla geliyor.
   Kullanıcının kendi cümlesi: *"kendi listesini kendisi önceden
   hazırlayıp sonrasında bu alanda değerlendirmesi daha iyi olabilir."*
   Veri yeri hazır: kütüphane maddesinin `grup` alanı var, set bunun
   üstüne bir ad + kimlik listesi olarak biner.

2. **Telefonda çekim modu.** Tam ekran, tek sütun, çok büyük kutular,
   ekran açık kalsın (Wake Lock), sayaç tepede sabit. Bugünkü pencere
   telefonda çalışıyor ama "sahada, ayakta, tek elle" için tasarlanmadı.

3. **Eksik çekimler.** Çekimden dönünce işaretlenmemiş maddeler
   "eksik" olarak proje satırında ve mekan kartında görünsün — mekan
   kartındaki "bekleyen çekim" rozetiyle aynı yere bağlanır.

4. **Listeyi paylaşma / PDF.** Ekiple çalışıldığında listeyi göndermek.
   Bugün yok; paylaşım altyapısı (`paylasim`) var, oraya bağlanabilir.

5. **Scriptten çekim planı üretme.** Script metnindeki "TAŞ 1 — geniş +
   çok yakın" gibi satırlar listeye madde olarak çıkabilir. Fazla
   akıllı davranıp yanlış satırları madde yapma riski var; önce
   kullanıcı birinci turu kullansın.

---

## ÜCRETLİ SÜRÜME GEÇİNCE: hava servisini değiştir (11 Eylül 2026)

**Bu madde bir tarihe değil, bir OLAYA bağlı: Shootboard para almaya
başladığı gün.** Kullanıcı kararı: "şimdi dokunmuyorum ama paralı
versiyona geçtiğimizde mutlaka bu değişikliği yapmak için listeye ekle."

### Ne yapılacak

`havaCek()` içindeki `api.open-meteo.com` çağrısı **met.no**
(Norveç Meteoroloji Enstitüsü, Locationforecast) ile değiştirilecek.
Yarım günlük iş: kodda tek bir fetch fonksiyonu var, yanıttaki alan
adları eşlenecek, `hava.test.js` içindeki taklit cevap yeni biçime
uyarlanacak.

### Neden

Open-Meteo'nun ücretsiz katmanı **ticari olmayan kullanım** için. Ürün
para almaya başladığı an o katman bize kapanır: ya ticari plana para
ödenecek ya da başka bir kaynağa geçilecek. met.no ticari kullanıma da
açık; karşılığında isteklerde uygulamayı tanıtan bir `User-Agent` başlığı
göndermek ve kaynağı belirtmek gerekiyor. (Şartlar bu ortamdan
doğrulanamadı — ağ kapalı. Geçiş günü ikisinin de kendi sayfasından
teyit edilecek.)

Alternatifler: ABD için NWS, Almanya için DWD. Hepsi devlet kurumu,
verileri kamuya açık.

### Neden ŞİMDİ yapılmıyor

30 kişilik ücretsiz denemede her iki servis de fazlasıyla bedava.
Bugün değiştirmek, henüz olmayan bir sorunu çözmek olurdu.

### Bu maddeye GİRMEYEN şey

Gün doğumu, gün batımı, altın saat, mavi saat. Onlar koordinattan
HESAPLANIYOR, dışarıdan veri gelmiyor: maliyeti sonsuza kadar sıfır,
internet olmadan da çalışıyor. Çekim planlamada asıl işe yarayan kısım
da bu. Servis değişikliği yalnızca sıcaklık/yağış/rüzgârı ilgilendiriyor.

### Aynı olaya bağlı öteki madde

**Barındırmayı taşımak** — GitHub Pages ticari SaaS'a izin vermiyor.
Cloudflare Pages ya da Netlify. İkisi aynı gün yapılmalı.

## AI erişimi: herhangi bir yapay zekâ Shootboard'a yazsın, okusun (10 Eylül 2026)

Kullanıcı sordu: "ChatGPT/Claude ile başka bir sohbette plan ve script
yazıyorum; 'bunları Shootboard'a ekle' diyebilir miyim?" Cevap: eskiden
hayır (dış kapı yalnızca sahibine özel gelen kutusu ve tablo yapıştırma
idi). Kullanıcı "AI eklentisi önemli, tablo yapısı karşı tarafa
aktarılabilmeli, AI asistan gibi çalışabilmeli" dedi; sıra "önce şema ve
kart, sonra anahtar ve uçlar, en son OpenAPI ve geri alma" diye
kararlaştırıldı ve hepsi bu PR'da yapıldı.

- **Paket biçimi** `ai/sema.json` (JSON Schema 2020-12). Üst anahtarlar
  İngilizce (`entries/projects/places/scripts/ideas`), alan adları
  uygulamanın modeliyle birebir; yedek dosyasının Türkçe anahtarları da
  kabul (bir yedek de geçerli paket). Karar: dış yüz İngilizce (Custom GPT,
  yabancı kullanıcı), iç kod Türkçe kalır.
- **Asistan kartı** `ai/asistan-karti.md` + `ai/assistant-card.md`: sohbetin
  başına yapıştırılan metin; kurallar (adres uydurma, uploaded yazma, tek
  JSON bloğu). Uygulamada *Hesabım → AI erişimi → Kartı kopyala* ve
  `ai/index.html` (shootboard.app/ai) aynı dosyayı çeker.
- **İki yol, tek doğrulama.** (1) *Paket yapıştırma:* İçe Aktar kutusuna
  JSON (```json çiti soyulur) → önizleme → alınır; anahtarsız, girişsiz.
  (2) *API:* `supabase/functions/ai` — `Bearer shb_…`, SHA-256 özeti
  `api_keys`'te (düz metin hiçbir yerde), servis rolü ama her sorgu
  `user_id` süzgeçli, verilen kimlikte sahiplik denetimi. Doğrulama
  `supabase/functions/ai/dogrula.js` sunucuda da tarayıcıda da (dinamik
  import; `sw.js` kabuğuna eklendi, sürüm v3) aynı dosya.
- **Kurallar:** proje ve mekan *ada göre* eşleşir ve güncellenir (ikinci
  kopya yok), paketin sustuğu alan ezilmez; kayıt/script/fikir yalnızca
  kimlikle güncellenir. Bulunmayan proje → öğe projesiz alınır, uyarı;
  `concept` BOŞ bırakılır (dolu olsaydı `projeleriGocur` sonraki açılışta
  sessizce proje üretirdi — bu, gelen kutusu yolunda hâlâ böyle). Sınırlar
  hesaptan (`user_prefs.entry_limit`), aşılacaksa hiçbir şey yazılmaz.
  Pakette 200 öğe, anahtar başına saatte 60 aktarım.
- **Defter ve geri alma:** her aktarım `ai_aktarimlar` satırı (yapıştırma
  yolunda yerelde de `demo_ai_defter`), eklenen kimlikler + güncellenenlerin
  önceki satır halleri. Uygulamada "AI" rozeti (kayıt, proje, mekan,
  script, fikir kartları) ve "Geri al" (İçe Aktar penceresi ve Hesabım)
  bu defterden; API'de `POST /undo`. *Buluttan yenile* düğmesi: gerçek
  zamanlı abonelik yok, AI API ile yazınca uygulama yeniden açılmadan
  görmüyordu; önce bekleyenler gönderilir, gönderilemediyse yenileme yapılmaz.
- **Bulunan eski hata:** `projeleriGocur` açılışta `saveProjects` →
  `takvimTazeleKuyrukla` → `hatirlatma` TDZ; concept'li kayıt varsa
  bütün açılış duruyordu. Koruma eklendi.
- **Kullanıcının çalıştıracakları:** `sql/33`, `sql/34`, sonra
  **`sql/35-ai-erisimi.sql`**; fonksiyon dağıtımı
  `supabase/functions/ai/README.md` (panelden `tek-dosya.ts`, Verify JWT
  kapalı; gizli ayar gerekmez). Canlıda denenmedi (ağ yok): ilk gerçek
  denemede README'deki curl sırası; `GET /` anahtarsız çalışmalı.
- **Testler:** `ai-erisimi-dogrula` (Node, saf), `ai-erisimi-sunucu`
  (Node, tek-dosya.ts tsc ile çevrilip bellekte PostgREST taklidine karşı;
  CI'a `typescript` eklendi), `ai-erisimi` (Playwright: yapıştırma, rozet,
  geri al, anahtar üret/iptal, yenile). CI alt kümesine `ai-erisimi` eklendi.
- **Sonrası (yapılmadı):** MCP sunucusu (Claude Desktop/claude.ai
  bağlayıcısı, aynı uçların sarmalayıcısı); OAuth "Shootboard'a bağlan";
  `api.shootboard.app` özel alan adı; salt okunur anahtar seçeneği
  arayüzde (`scopes` sütunu hazır); kart metnini uygulama diline göre
  otomatik güncelleme.

## Karşılama sayfası SEO ve bağlantı önizlemesi (10 Eylül 2026)

Kullanıcı Threads'te duyuruya başlıyor (ilk plan yalnızca Threads, Reddit
sonra). İki değişiklik:

- `index.html` başlığı ve açıklaması arama terimiyle yeniden yazıldı:
  "Content Calendar for Video Creators". Gerekçe: 2 Eylül vidIQ ölçümünde
  "content calendar" ayda 11.8K, "content planner app" 750'nin altında;
  kimse "app" aramıyor. `app.html` başlığı da aynı terimi taşıyor ama
  farklı: iki sayfa aynı başlığı taşımasın.
- `index.html`'e canonical (`https://shootboard.app/`) ve Open Graph /
  Twitter etiketleri eklendi; `og.png` (2400×1260) kök dizinde. Threads,
  X ve WhatsApp bağlantı önizlemesini bu etiketlerden kuruyor; og:image
  yokken önizleme çıplak başlıktı. Görsel, örnek veriyle (tek çekim, on
  paylaşım) alınmış takvim ekranı; takvim arayüzü değişirse yeniden
  alınmalı (scratchpad'deki Playwright betiği: viewport 1200×630, 2x).
- Hero başlığı (`hero_h1`) değişmedi; arama terimi H1'de yok.
- **Aynı gün, araştırma (kod yok):** `docs/mekan-adres-ve-coklu-mekan-analizi.md`.
  Kullanıcı mekan adından adresin otomatik gelmesini, il/ilçe/sokak
  kırılımını ve tek projeye birden çok mekanı sordu. Bulgular: "adres
  istiyor" sorusu proje penceresinden geliyor (seçili mekanın adresine
  bakılmıyor, "+ Yeni mekan" yalnızca ad soruyor); koordinat saklanmıyor;
  Nominatim'de yazdıkça öneri yasak, Photon serbest; Google Places yalnızca
  Edge Function arkasında ve ücretli pakette (önceki kararla aynı);
  Open-Meteo ticari kullanımda 29 $/ay ister (hava bloğu da buna bağlı).
  Öneri: Faz 0 yarım gün (mekan adresi projeye sayılsın, tam pencere),
  Faz 1 iki gün (Nominatim Enter ile bul + koordinat + TR il/ilçe listesi),
  çoklu mekan `place_ids text[]` (sql/23 deseni) 1–2 gün. Karar bekliyor.
- **Faz 0 yapıldı (aynı gün, kullanıcı "Faz 0'a başla" dedi):** `projeYeri(p)`
  projenin kendi adresi yoksa bağlı mekanın adresini ya da harita
  bağlantısını veriyor; "adres girmedin" sorusu ve karttaki "Harita"/"Adres
  yok" ona bakıyor. Proje formundaki "+ Yeni mekan" isim sorusu yerine tam
  mekan penceresini açıyor (`mekanPenceresiniAc(id, sonra)` geri çağrısı;
  `mekanKayitSonrasi` pencere kapanınca temizleniyor ki Mekanlar
  sayfasından sonradan eklenen mekan forma sıçramasın). İl/ilçe tek başına
  adres sayılmıyor.
- **Faz 1 yapıldı (aynı gün, kullanıcı "Faz 1'e başla" dedi):** mekan
  penceresinde "Bul": ad + şehir Nominatim'de aranıyor (Enter/düğme, tek
  istek; yazdıkça öneri Nominatim kuralınca yasak), seçilen sonuç adres,
  ilçe, il, ülke, koordinat, OSM kimliği ve harita bağlantısını dolduruyor;
  "burası mı?" karosu pencerede. Mekan modeline lat/lon/country/timezone/
  source/externalId; **`sql/33-mekan-konum.sql` Supabase'de çalıştırılmalı**,
  çalıştırılana kadar koordinat yalnızca tarayıcıda kalır (sessiz geri
  düşüş, `mekanKonumSutunlari`). Türkiye il/ilçe listesi
  `veri/tr-il-ilce.json` (MIT; kaynakta Türkçe büyük/küçük harf bozuktu,
  onarıldı), `sw.js` kabuğuna eklendi. Nominatim POI kapsamı canlı
  doğrulanamadı (ağ engeli); ilk gerçek denemede "Nuruosmaniye Han",
  "Kariye" gibi adlarla bakılmalı. Ayrıntı: analiz belgesi, bölüm 4.
- **Ayrı madde, karar bekliyor:** Open-Meteo ücretsiz sürümü ticari
  kullanıma kapalı (abonelikli/reklamlı uygulama 29 $/ay plan ister); hava
  bloğu ve saat dilimi ona bağlı. Para alınmaya başlanmadan karar verilmeli.
- **Çoklu mekan yapıldı (aynı gün, kullanıcı istedi):** `projects.placeIds`
  sıralı durak listesi, `placeId` ilk durak (eski yerler bozulmadı). Proje
  formunda her seçim bir çip; ▲▼ sıra, × çıkarma; kartta "ilk durak +N".
  **`sql/34-proje-cok-mekan.sql` çalıştırılmalı**; çalışana kadar yalnızca
  ilk durak buluta gider (`projMekanSutunu` geri düşüşü). Durak saati yok.
  Test: `proje-cok-mekan.test.js`.
- **Karar (10 Eylül, kullanıcı): Google Places park edildi, "belki ileride".**
  Gerekçe konuşuldu: demo ölçeğinde ücret yok (SKU başına 10.000/ay bedava)
  ama anahtar tarayıcıda durur, kötüye kullanım faturası ürün sahibine
  yazılır, adres metni saklama şartına takılır. OpenStreetMap ile devam.
  İleride açılırsa: önce ödeme altyapısı, sonra Supabase Edge Function
  arkasında anahtar ve kullanıcı başına kota; demoda istenirse Google
  Cloud'da günlük sert kota (ör. 300 istek) ile riski sıfırlayıp
  "Google'da bul" düğmesi. Kapsam yetmezse ilk adım Photon (Faz 2).
- **Kullanıcının çalıştıracakları (PR #10 birleşince):** Supabase SQL
  Editor'da sırayla `sql/33-mekan-konum.sql` ve `sql/34-proje-cok-mekan.sql`.
  Sonra canlıda bir mekanda "Bul" ile OSM kapsamını denemek.
- **Aynı gün, ikinci PR (kullanıcı "ekle" dedi):** logonun altına tek satır
  tanıtım metni. Karşılama sayfasında `.marka-alt` ("Content calendar for
  video creators" / "Video üreticileri için içerik takvimi"), 640px altında
  gizli. Uygulama rayında `.rail-tagline`, 1023px altında (yatay şerit)
  gizli; iki satıra kırılıyor, bilerek, ray dar. Hero rozeti `hero_tag`
  "Content calendar — not an auto-poster" oldu; "for video creators" ekli
  sürüm masaüstünde iki satıra kırılıp "AUTO-/POSTER" diye bölünüyordu,
  kısaltıldı. Avatara metin konmadı (40 pikselde okunmuyor).

---

## Nerede kaldık (7 Eylül 2026 — araştırmalar Drive'a taşındı)

**Google Drive klasörü "SHOOTBOARD.APP PAZARLAMA STRATEJISI"** (Drive kökünde,
kimlik `1dsDtQdkuyEwykehUP-8tp4KDcu7pNqT_`). Kullanıcı bu ada klasör istedi;
aynı adda klasör ya da belge yoktu, açıldı. İçine depodaki altı belge HTML
olarak yüklenip Google Doc'a çevrildi (md → HTML dönüştürücü scratchpad'de
kaldı; başlık, liste ve tablo aktarımı ilk belgede geri okunarak doğrulandı):

| Google Doc | Kaynak | Doc kimliği |
|---|---|---|
| Shootboard – Pazar Araştırması ve Satılabilirlik Raporu (2 Eylül 2026) | `docs/pazar-arastirmasi.md` | `1N0TzVA1EUkuo7-v5VPsbqfjf2YEBViEaOFeKBTQnD40` |
| Shootboard – İsim, Marka, Alan Adı ve E-posta Kararları (Eylül 2026) | `docs/isim-marka-alanadi-kararlari.md` | `1VAJvOARyt_5EsZdJy38MlzXoZBgyXVXp8OGKE9KCJTc` |
| Demo açılışı ve ürün kanalları planı (7 Eylül 2026) | `docs/demo-ve-kanal-plani.md` | `1DAi_e6JHLgS_CYPMTV7GW54LBV_K0cCsUSaO-s16GC0` |
| Araştırma notu 1 – Rakipler ve fiyatlar (EN, 2 Eylül 2026) | `docs/arastirma-notlari/01-rakipler.md` | `1-UIzE5HIQ8oPM1JtaW8QbKoEDwZyXYP6kJCg4iGYBZ4` |
| Araştırma notu 2 – Talep sinyalleri (EN) | `docs/arastirma-notlari/02-talep.md` | `1KxTGJcuZcdlQ3NjpilIaVFpPArROVmYtCnYrSOwPXjE` |
| Araştırma notu 3 – İş modeli, ödeme ve Türkiye'den satış (EN) | `docs/arastirma-notlari/03-is-modeli.md` | `18F3-iUz-zzT2-qNjXaln43iUblmbeK02N11GOaDJHbc` |

- Raporun iki ekran görüntüsü (`docs/gorseller/takvim-masaustu.png`,
  `takvim-telefon.png`) Doc'a gömülmedi; dönüştürücü resim satırlarını
  atlıyor, metindeki yerlerinde boşluk var. İstenirse klasöre ayrıca
  yüklenir.
- Kural: bu belgelerden biri depoda değişirse Drive'daki kopyayı aynı Doc
  kimliğiyle güncelle; yeni belge açıp çoğaltma.
- Depodaki `.md` dosyaları kaynak olmaya devam ediyor; Drive kopyası
  paylaşım ve okuma için.
---

## Giriş: kayıt/giriş ayrımı ve şifre (5 Eylül 2026)

Giriş yalnızca e-posta bağlantısıyla yapılıyordu. Gerçek denemede iki kez
tökezledi: bağlantı Gmail'de spam'e düştü, Hotmail'de ikinci sefer hiç
gelmedi. Bağlantıya bağlı tek yol kırılgan.

Yapılanlar (uygulama ve karşılama sayfası, ikisinde de):

- **Kayıt ol / Giriş yap iki ayrı sekme.** Tek kartta toplandığında
  kullanıcı hangisini yaptığını anlamıyordu.
- **Kayıt:** Google ile tek tık, ya da ad + e-posta + şifre (`signUp`).
  Adres zaten kayıtlıysa Supabase hata vermez, boş `identities` döner;
  bu yakalanıp kullanıcı giriş sekmesine yönlendiriliyor.
- **Giriş:** Google, ya da e-posta + şifre. Şifresini unutan için giriş
  bağlantısı aynı panelde duruyor — kimse kilitli kalmıyor.
- **Şifre gücü** yazarken görünüyor: ince çubuk + ne yapılması gerektiğini
  söyleyen bir satır. **Zayıf şifre kabul edilmiyor** (kısa, tek karakter
  tekrarı, `password/şifre/1234/qwerty` gibi kalıplar). Aynı ölçü,
  bağlantıyla girene sorulan şifre penceresinde de geçerli.
- Bağlantıyla giren kişiye bir kez **şifre belirle** penceresi açılıyor
  (üretici + güç ölçüsü). "Şimdi değil" bir hafta susturuyor. Google ile
  girene sorulmuyor. Sonradan değiştirmek için sol taraftaki isimlerin
  altında bir bağlantı var.
- **Spam uyarısı** bağlantı gönderildiğinde mesajın içinde.
- Karşılama sayfasının çağrı düğmeleri artık boş uygulamaya değil giriş
  bölümüne götürüyor; **çıkış yapan da karşılama sayfasına dönüyor.**

Yol boyunca çıkan üç kusur: bulut yüklenmediğinde giriş düğmeleri sessizce
hiçbir şey yapmıyordu; koyu temada seçili sekme seçilmemişten daha koyu
çıkıyordu (oluk `--yuzey2`, pil `--yuzey` — ilişki tema değişince tersine
dönüyor); kapatma şeridinin negatif kenar boşluğu `.modal`'ın 26 pikseline
göreydi, dlg penceresi 22 kullanıyor, serit dört piksel taşıyordu.

Aynı gün iki oturum aynı sorunu ayrı çözmüştü: biri uygulamadaki tüm
`confirm/alert/prompt` çağrılarını karşılayan genel bir pencere, diğeri
yalnızca iki auth sorusu için başlıklı bir pencere. Genel olan esas alındı;
`onayla()` artık metin ya da `{baslik, govde, vurgu, not, tamam}` alıyor.

**E-posta tarafı (5 Eylül):** Resend bağlandı, SMTP kuruldu, şablonlar
Supabase'e girildi, `hosgeldin` fonksiyonu dağıtıldı, `sql/20` çalıştırıldı.
`hello@shootboard.app` Cloudflare Email Routing ile Gmail'e düşüyor.
**14 Eylül'de doğrulandı:** DNS sorgusuyla bakıldı, üç kayıt da yerinde —
`_dmarc` (`v=DMARC1; p=none;`), `resend._domainkey` DKIM ve
`send.shootboard.app` SPF (`v=spf1 include:amazonses.com ~all`).
İlk e-postanın spam'e düşmesi bu kayıtlar girilmeden önceydi; artık
eksik yok. Gerçek bir kayıt e-postasıyla SPF/DKIM/DMARC'ın PASS
verdiğini görmek kaldı.

Panelden kurulum iki kez düştü: ad kutusu rastgele bir isimle (`dynamic-task`)
dolu geliyor ve değiştirilmezse tetikleyicinin çağırdığı adla uyuşmuyor;
editörde ikinci dosya (`sablonlar.js`) eklenmeden Deploy'a basılınca
"Module not found" veriyor. İkisi de `supabase/email/README.md`'ye yazıldı,
ayrıca tek dosyalık sürüm üretildi: `supabase/functions/hosgeldin/tek-dosya.ts`
(elle değil `birlestir.py` ile üretiliyor, iki sürüm ayrışmasın).

---

## Nerede kaldık (3 Eylül 2026, gece — e-posta: giriş bağlantıları ve hoşgeldin)

**Alan adı e-postası kuruldu (kullanıcı, Cloudflare Email Routing):** hello@,
info@ ve welcome@shootboard.app Gmail'e yönleniyor. Gönderim için Gmail
"şu adresten posta gönder" ayarı uygulama şifresiyle yapıldı.

**Bu PR'da yazılanlar (kullanıcı isteği: "kayıt olana otomatik e-posta"):**
- `supabase/email/confirm-signup.html` ve `magic-link.html`: Supabase'in giriş
  e-postaları. Go şablon koşuluyla (`{{ if eq (printf "%v" .Data.lang) "tr" }}`)
  hesabın `lang` meta verisine göre TEK dilli; `lang` hiç yoksa iki dilli.
  Selamlama `.Data.full_name` varsa adla. Konu satırları `KONULAR.txt`; konu
  alanı şablon kabul etmezse düz sürümleri orada. Kullanıcı kararı (3 Eylül):
  iki dilli e-posta varsayılan OLMAYACAK, herkes kendi dilinde alacak.
- `supabase/functions/hosgeldin/`: hoşgeldin e-postasını Resend API ile gönderen
  Edge Function (`index.ts`) ve metinler (`sablonlar.js`, düz ESM; Node ile
  önizleme üretilebiliyor, `supabase/email/onizleme/`). Dil:
  `raw_user_meta_data.lang`; yoksa GÖNDERMİYOR (tetikleyici dil yazılınca
  yeniden çağırıyor). Idempotency-Key = kullanıcı kimliği; iki tetikleyici
  aynı kullanıcı için çalışsa da ikinci e-posta gitmez. Kimlik doğrulama
  `x-webhook-secret` başlığıyla; `--no-verify-jwt` şart.
- `sql/20-hosgeldin-webhook.sql`: iki tetikleyici. INSERT (lang varsa: e-posta
  girişi) ve raw_user_meta_data UPDATE (lang null→dolu: Google girişinde ilk
  açılış). Her kullanıcıya tek dilli e-posta.
- `app.html`: giriş formuna isteğe bağlı ad alanı (`#authName`, i18n
  `auth_name_label`); `signInWithOtp` `data:{lang, full_name}` yazıyor ve adı
  `demo_auth_ad`'a saklıyor; `afterSignIn` başında `hesapMetaVerisiniTamamla()`
  eksik lang/full_name'i tamamlıyor; `setLanguage` kullanıcı seçiminde meta
  veriyi güncelliyor ki sonraki e-postalar yeni dilde gitsin.
- `privacy.html`: iletişim adresi hello@shootboard.app; Resend servis tablosuna
  eklendi; 3. bölüme hoşgeldin e-postası cümlesi; tarih 3 Eylül 2026.
- `supabase/email/README.md`: Resend alan adı, Supabase SMTP, şablon yapıştırma,
  fonksiyon dağıtımı (panel ve CLI), tetikleyici, test.

**Kullanıcının yapacakları:** README'deki 1–6. adımlar. Kod tarafında bekleyen
iş yok. Bir sonraki e-posta işi, istenirse, "3. gün / 7. gün" dizi e-postaları;
onun için Kit ya da Loops önerildi, tetikleyici aynı.

**Karar:** tanıtım/bülten e-postası YOK; yalnızca işlemsel. Bülten istenirse
kayıt ekranına onay kutusu ve İYS kaydı gerekir.

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

## Kaydırma hareketi ve yapışık Kaydet (5 Eylül 2026)

- **Kaydırma:** `#calGridWrap` üzerinde touchstart/touchend. Yatay yol ≥60px
  ve dikeyin 1,5 katından büyükse `takvimKaydir(±1)`. Tablo görünümünde
  kapalı (tablo kendi içinde yana kayıyor). `passive:true`, kaydırmayı
  engellemiyor.
- **Yapışık Kaydet:** telefonda `.modal .modal-actions{position:sticky;
  bottom:0}`; pencerenin alt boşluğu şeride taşındı (safe-area dahil).
  Düğmeler tam genişlik 48px. `#dlgOverlay` istisna (küçük diyalog).
- Test: `scratchpad/swipe.test.js` (9 iddia). Diğer takımlar yeniden geçti.

---

## Takvim başlığı telefonda yerel takvim düzeni (5 Eylül 2026)

Kullanıcı canlı siteden ekran görüntüsü attı: koca mavi "+ Yeni Giriş"
şeridi, demo sayacı, üç satıra dağılmış Ay/Hafta/Gün/Tablo + Önceki +
Bugün + Sonraki, ayırıcı çizgili filtre düğmeleri. "Karışık, native
görünmesin" dedi. Yalnızca `max-width:700px` bloğunda:

- Başlık satırı `‹  Eylül 2026   Bugün  ›`: oklar yuvarlak 44px, yazısız
  (`font-size:0` + `::before` ‹ ›; i18n metni ekran okuyucuda duruyor),
  ay adı Archivo 19px başlık. Grid `grid-template-areas` ile, `.cal-nav-left/
  right{display:contents}`.
- Segment kontrolü tam genişlik, iOS tarzı: gri zemin, seçili mavi hap.
- "+ Yeni Giriş" sağ altta 56px yuvarlak sabit düğme, sekme şeridinin
  üstünde. Özgüllük tuzağı: genel kural `.btn.btn-new` yazılı, telefon
  kuralı da `.btn.btn-new` olmalı; tek sınıfla metin görünür kaldı.
- Demo notu ve "Erken erişim iste" telefonda gizli, sayaç 11px soluk.
- Filtreler yuvarlak çip, ayırıcı ve özet yazısı gizli, tek satır kayar.

Test: `scratchpad/gorunum.js` (oklar/başlık aynı satır, FAB sekme
şeridinin üstünde, ok ve Bugün çalışıyor, segment seçimi, FAB pencereyi
açıyor). Diğer üç takım yeniden geçti.

---

## Yerel diyaloglar kaldırıldı: alert/confirm/prompt yok (5 Eylül 2026)

Kullanıcı bildirdi: kaydederken açılan yerel tarayıcı diyaloğu sayfayı
kilitliyor, "diyalogları engelle" seçilince `confirm` hep `false` dönüp
kayıt sessizce düşüyor; proje iki kez böyle kayboldu. Kenar çubuğundaki
hesap düğmesi de (`confirm` ile çıkış sorusu) aynı şekilde donuyordu.

**Kural (kalıcı):** `alert`, `confirm`, `prompt` bir daha KULLANILMAYACAK.
Yerine `uyari(msg)`, `onayla(msg)` → Promise<boolean>, `sor(msg, varsayılan)`
→ Promise<string|null>. Üçü de `#dlgOverlay` penceresini açıyor (z-index 80,
kayıt penceresinin üstüne çıkar). Çağıran fonksiyon `async` olmalı ve
`await` etmeli; 39 çağrı yeri çevrildi, `node --check` ile doğrulandı.

Dönüşüm notları:
- `alert(x)` → `uyari(x)` (await gerekmez, çağıranlar zaten `return` ediyor).
- `confirm(x)` → `await onayla(x)`; `prompt(x)` → `await sor(x)`. Bu yüzden
  `secimdenProje`, `projeSil`, `secilenProjeyiCoz` ve 10 kadar click/change
  dinleyicisi `async` oldu; `secimdenProje` ve `secilenProjeyiCoz`
  çağıranları `await` ediyor.
- Tek düğmeli uyarıda perde de Tamam sayılır; onay/soru penceresinde perde
  ve Escape iptal, Enter Tamam. Aynı anda ikinci diyalog istenirse ilki
  iptal sayılıp kapanır.
- Test: `scratchpad/dlg.test.js` (16 iddia: proje adres sorusu, termin
  sorusu, hesap düğmesi, kayıt silme onayı pencere üstünde, eksik alan
  uyarısı; sıfır yerel diyalog, sıfır sayfa hatası).

---

## Telefon: uygulama gibi (5 Eylül 2026)

Kullanıcı sahadan bildirdi: shootboard.app telefonda "bazı menüler açılınca
kapanmıyor, takvimde filtreler doğru çalışmıyor". iPhone 12 Pro ölçüsünde
(390×844) Playwright ile yeniden üretildi. Teşhis:

1. **Filtre paneli** telefonda ekranın altına sabitleniyordu ama arkasında
   perde yoktu. Kapatmanın tek yolu "dışarıya dokunmak"tı; o dokunuş
   ALTTAKİ güne isabet edip yeni kayıt penceresi açıyordu (testte
   `editOverlay` açıldı). iOS Safari'de ise tıklanabilir olmayan alana
   dokunulunca `document`'e `click` hiç gelmiyor, panel hiç kapanmıyordu.
   Filtre mantığının kendisi doğruydu (seçim 8 → 1 kayıt); sorun kapanma.
2. **Kayıt, proje, klon vb. pencerelerde kapatma düğmesi yoktu.** Sadece
   perdeye tıklamak ya da formun en altındaki Vazgeç'e inmek gerekiyordu.
   Telefonda pencere ekranı kapladığı için perde yok; 1.800 px'lik formda
   Vazgeç ekran dışında. "Menüyü açtım, kapatamıyorum" bu.
3. Üst şerit 750 px yer yiyordu; 5 sekme + 4 bağlantı + dil + tema.

Çözüm (`app.html`, yalnızca `max-width:700px` bloğu + küçük JS):
- Sekmeler altta sabit şerit (`.rail-nav{position:fixed;bottom:0}`),
  `safe-area-inset-bottom` payıyla; `.wrap`'a alt boşluk, toast yukarı.
- Filtre paneli: `.fbackdrop` perdesi (JS ekliyor, kendi click dinleyicisi
  var, dokunuş alta geçmiyor), panelin üstünde başlık + Kapat (`.fpanel-head`,
  masaüstünde `display:none`). `body.sheet-open` ile gövde kaymıyor.
- Her `.overlay .modal`'a, `.modal-head`'i yoksa JS ile yapışkan bir
  `.modal-xbar` + `×` ekleniyor. Düğme pencerenin KENDİ kapanma yolunu
  kullanıyor: perdeye tıklanmış gibi `overlay.dispatchEvent(click)`; böylece
  `closeModal`, `closeClone` vb. temizlikler aynen çalışıyor. Masaüstünde
  de görünüyor (tutarlılık); test edildi, kırılan yok.
- Pencereler alttan açılan sayfa: `align-items:flex-end`, üst köşeler
  yuvarlak, `92dvh`. Takvim gezintisi 3 satır ızgara (görünüm / aralık /
  önceki-bugün-sonraki). Filtre şeridi tek satır yana kayar.
- MutationObserver overlay sınıflarını izleyip `sheet-open` düşürüyor.

**Tuzak (yaşandı):** Medya bloğundan SONRA yazılan genel kural aynı
özgüllükte olduğu için telefon kuralını eziyordu (`.fpanel-head` hiç
görünmedi). Çözüm: medya içinde `.fpanel .fpanel-head`, `.modal .modal-xbar`.

Test: `scratchpad/mobil5.js` (22 iddia, hepsi geçti), `desk.js` (masaüstü
açılır menü ve pencere değişmedi), `gelen.test.js` (regresyon yok).

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

## Nerede kaldık (3 Eylül 2026, gece — takvim aboneliği çalıştı)

**Takvim aboneliği artık uçtan uca çalışıyor.** Kullanıcı gerçek Supabase
projesinde kurdu ve doğruladı. Yolda üç şey çıktı, üçü de düzeltildi:

1. **İzin kuralı tutmadı** — "new row violates row-level security policy".
   Üç ayrı politika yerine TEK politika yazıldı ve şart en basit biçime
   indirildi: `name like auth.uid()::text || '/%'`. `storage.foldername`
   kullanılmıyor artık; yalnızca metin karşılaştırması, sürüm farkından
   etkilenmiyor.
2. **İzinli dosya türü listesi fazla dardı** — uygulama dosyayı
   `text/calendar; charset=utf-8` olarak yüklüyor, listede yalnızca
   `text/calendar` vardı. İki yazılış da eklendi.
3. **Yazılmamış adres gösteriliyordu** — kullanıcı fark etti ("açtığımda
   otomatik bir adres geliyor"). Jeton üretilir üretilmez adres
   görünüyordu; dosya hiç yazılmamış olabilirdi ve o adres ölü doğuyordu.
   Artık `hatirlatma.yayinlandi` bayrağı var, adres yalnızca yükleme
   başarılıysa görünüyor.

**Hata mesajı düzeni değişti:** "Biraz sonra tekrar dene" sebebi
düzeltilebilir bir ayar hatasıyken kullanıcıyı boşuna bekletiyordu. Artık
bilinen bir sebep varsa o, yoksa SUNUCUNUN kendi cümlesi gösteriliyor.
Kullanıcı tam olarak buna takıldı ve gerçek mesajı görünce iş tek adımda
çözüldü.

**Ders:** Yan etkisi olan bir adımın (dosya yazma) sonucunu, kullanıcıya
gösterilen duruma (adres) bağlamadan önce DOĞRULA. Ve bir hata mesajını
genelleştirirken, kullanıcının düzeltebileceği bilgiyi yutma.

### Kullanıcı isteğiyle eklenenler (aynı gün)
- Pencerenin başına **kapsam cümlesi**: hatırlatmalar yalnızca proje
  adımlarının terminleri için; yayın takvimindeki paylaşımlar girmiyor.
  Kullanıcı kararı: paylaşımlar bilerek girmiyor — "uygulamayı gelip
  kullanmalarını isterim".
- **"Adım geciktiğinde"** seçeneğinin yanına notu: yalnızca tarayıcı
  bildiriminde çalışıyor. Takvim dosyası hatırlatmaları önceden yazdığı
  için sonradan gecikmeyi bilemiyor.
- **Hatırlatma saati ayarlanabilir** oldu (varsayılan 09:00). Gün boyu
  olayda tetik olayın başından sayılıyor: termin günü 08:30 → `PT8H30M`,
  bir gün önce 08:30 → `-PT15H30M`. Saat değişince takvim dosyası
  yeniden yazılıyor; yalnızca ayarı kaydetmek kullanıcının takviminde
  eski saati bırakırdı.

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

## Nerede kaldık (16 Kasım 2026 — PUSH BİTTİ, kuruluma hazır)

### Kullanıcının verdiği iki karar

**1. Termin hesabını SUNUCU yapacak.** Kullanıcı sordu: *"Normal
şartlar altında sunucu daha sağlıklı değil mi? Sonuçta sunucu her
zaman açık ve saati çalışıyor"* — haklıydı ve benim çerçevelemem
hatalıydı. "Tarayıcı hesaplayıp yüklesin" seçeneğinin dezavantajı
olarak "dosya eskir" demiştim; abartmışım, çünkü terminler ancak
uygulamada bir şey değişince değişir. Asıl fark: sunucu
**veritabanındaki asıl kaynağı** okuyor, araya bir yükleme adımı
girmiyor. O adım bir kez başarısız olsa bildirim sessizce gelmezdi.

⚠ "Tek kopya" seçeneği **zaten yoktu**: tarayıcı internetsizken ve
hesapsız kullanıcıda da hatırlatma göstermek zorunda, yani kendi
hesabını her hâlükârda tutuyor. Ben yanlış sunmuşum.

Ayrışma riski `testler/termin-ikiz.test.js` ile **görünür** kılındı
(ortadan kaldırılamaz). Mutasyonla kanıtlandı: üç bozma denendi,
üçü de yakalandı.

**2. Push, fiyatlandırmaya girecek.** Kullanıcı: *"ok çok daha iyi
bu da bizim fiyatlandırmamıza ek olarak girecek bir konu olur"*.

⚠ **`fiyatlar.html`'e HENÜZ EKLENMEDİ ve eklenmemeli.** O dosyada
yazılı kural: *"YALNIZCA VAR OLAN ÖZELLİKLER"* — özellik denetiminde
"yok" çıkanlar bilerek listeden çıkarılmış. Push canlıda değil:
VAPID anahtarı üretilmedi, fonksiyon dağıtılmadı, `sql/71` ve
`sql/72` çalıştırılmadı. **Kurulum bitip ilk bildirim gerçekten
düştükten sonra** `fiyatlar.html`'deki `ozellik` listesine eklenecek
(iki dilde, 298. ve 338. satırlar).

⚠ Özellik **kendiliğinden** hesaba bağlı, zorlama bir sınır değil:
hesapsız kullanıcının terminleri sunucuya hiç ulaşmıyor
(`saveProjects` yalnızca `if(session)` gönderiyor), yani sunucu neyi
hatırlatacağını bilemiyor. Hesapsızda yalnızca uygulama açılırken
bildirim var. Bu, arayüz metnine de yazıldı (`rm_ch_browser_note`).

### Yazılan dosyalar — hepsi hazır, kurulum bekliyor

| Dosya | Ne |
|---|---|
| `supabase/functions/push-gonder/webpush.ts` | RFC 8291/8188/8292, dış kütüphane yok |
| `…/terminler.ts` | termin kuralının sunucu kopyası |
| `…/index.ts` | gönderen fonksiyon (GET: sağlık, POST: tur) |
| `…/README.md` | **yedi adımlı kurulum**, adım adım |
| `sql/71` | `push_abonelikleri` + `genel_ayarlar` |
| `sql/72` | saatlik cron |
| `araclar/vapid-uret.html` | anahtarı kullanıcının tarayıcısında üretir |
| `testler/webpush-vektor.test.js` | 8 kontrol — RFC'nin resmî vektörü |
| `testler/termin-ikiz.test.js` | 11 kontrol — iki kopya karşılaştırması |

### Doğrulananlar (iddia değil, ölçüm)

- **Şifreleme RFC 8291 Bölüm 5'in resmî vektörüyle birebir tutuyor.**
  Vektör `https://www.rfc-editor.org/rfc/rfc8291.txt` adresinden
  indirildi (host ağ listesine eklendi).
- `vapid-uret.html` **hiç dış ağ isteği yapmıyor** (ölçüldü).
  Anahtar uzunlukları doğru (87/43), açık anahtar `0x04` ile başlıyor,
  her üretim farklı, sayfa iki dilde.
- İki kopya testi mutasyonla kanıtlandı.

### ⛔ Testin yakaladığı GERÇEK hata

`hesap-sil.test.js` kırmızı yandı. Depoda bir **bekçi** varmış:
`sql/` içinde `user_id` taşıyan her tablo `HESAP_TABLOLARI`'nda olmak
zorunda. `push_abonelikleri` listede değildi — yani **hesabını silen
kullanıcının push aboneliği kalacaktı.** Listeye eklendi.

Cascade vardı ama yetmiyor: cascade yalnızca auth kullanıcısı
silinince çalışıyor, uygulamanın yedek silme yolu bu listeyi
kullanıyor. (Aynı bekçi `sql/69`'un üç tablosunu da yakalamıştı.)

### Bilinen sınır (koda ve buraya yazıldı)

Aynı tarayıcıda **başka bir hesap** abonelik bırakmış ve çıkarken
temizlememişse (sekme çöktü, veri silindi), yeni hesabın aboneliği
RLS'e takılır — satır onun, biz güncelleyemeyiz. Normal akışta olmaz:
çıkışta `pushAbonelikBirak()` çağrılıyor, hem de `signOut`'tan ÖNCE
(tersi sırada RLS kendi satırımızı silmemize de izin vermezdi).

### Sırada ne var

1. Kullanıcı `README.md`'deki yedi adımı uygulayacak.
2. İlk bildirim gerçekten düştükten **sonra**: `fiyatlar.html`'e
   özellik olarak eklenecek, `MARKA.md` sözlüğüne bakılacak.
3. ⚠ **Gerçek bir push servisinin kabul edip etmediği hâlâ
   doğrulanmadı.** Şifrelemenin standarda uygunluğu kanıtlandı ama
   uçtan uca deneme ancak canlıda yapılabilir.

---

## Nerede kaldık (15 Kasım 2026, akşam — LOGO + PUSH BAŞLADI)

Kullanıcı PC'yi kapattı, **yarın devam.** Bu bölüm devir notudur.

### ✅ BİTEN — logo ailesi tek kaynağa getirildi

Kullanıcı PC'de kurduktan sonra masaüstü simgesini gördü:
*"pc de icon bu şekilde bizim kendi iconumuz logomuz olamaz mı"*.
Haklıydı — PWA ikonu **jenerik bir "not kâğıdı"** çizimiydi, logo
değildi, turuncusu bile paletten değildi.

⛔ **Sorun sanılandan büyüktü: ikon ailesinin TAMAMI ayrışmıştı.**
`favicon.svg` 13 Kasım'da maviden turuncu klakete çevrilmiş, ama PNG
sürümler 31 Ekim'de kalmıştı. Yani sekme simgesi, Apple simgesi ve
PWA simgesi üç ayrı şeyi gösteriyordu.

Hepsi `logo-koyu.svg`'den yeniden üretildi (koyu zemin için olan sürüm;
`logo.svg` açık zemin içindir ve kendi yorumunda "koyu zemine koyma"
yazıyor):

| Dosya | Boyut | Not |
|---|---|---|
| `icons/icon-192.png` · `icon-512.png` | %84 logo | `purpose: any` |
| `icons/icon-maskable-192.png` · `-512` | %60 logo | **YENİ** |
| `apple-touch-icon.png` | 180 | opak (iOS alfa sevmiyor) |
| `favicon-32x32.png` · `favicon-16x16.png` | — | artık klaket |
| `favicon.ico` | 16+32+48 | elle paketlendi |

⛔ **Manifest'te gerçek bir hata vardı:** `any` ve `maskable` için
**aynı dosya** veriliyordu. Maskable ikon daire/kare maskeye kırpılır,
yani kenarlar kesilirdi. Artık ayrı, boşluklu dosya.

`sw.js` SURUM **v6 → v7**: eski önbellek eski ikonu tutardı.

`sayfa-saglik.test.js` yeni ikonlarla **geçti**.

### 🔄 BAŞLAYAN — push bildirimi

Kullanıcı: *"ben pc başında olmayacağım sen push mesaj için
çalışmalar başla"*.

**Durum tespiti (doğrulandı, varsayım değil):**

| Parça | Durum |
|---|---|
| `sw.js:119` push dinleyicisi | ✅ zaten vardı |
| Bildirim izni (`app.html:22938`) | ✅ var |
| Uygulama AÇIKKEN bildirim | ✅ var |
| Abonelik tablosu | ✅ **bu oturumda yazıldı** → `sql/71` |
| Şifreleme + VAPID imzası | ✅ **bu oturumda yazıldı + DOĞRULANDI** |
| Gönderen Edge Function | ⬜ yazılacak |
| İstemci tarafı `pushManager.subscribe` | ⬜ yazılacak |
| Zamanlanmış görev (cron) | ⬜ kullanıcı kuracak |
| VAPID anahtar çifti | ⬜ kullanıcı üretecek |

**Yazılan dosyalar:**

- `sql/71-push-abonelikleri.sql` — tablo + RLS. Hiçbir şeyi geri
  almıyor, tekrar çalıştırılması güvenli. **Henüz ÇALIŞTIRILMADI.**
- `supabase/functions/push-gonder/webpush.ts` — RFC 8291 (şifreleme),
  RFC 8188 (paketleme), RFC 8292 (VAPID imzası). **Dış kütüphane yok**,
  depodaki gelenek bu: hiçbir Edge Function dış paket çekmiyor.
- `testler/webpush-vektor.test.js` — **8 kontrol, 8'i geçti.**

⚠ **Şifreleme UYDURULMADI, RFC'nin kendi sayılarıyla doğrulandı.**
Test vektörü `https://www.rfc-editor.org/rfc/rfc8291.txt` Bölüm 5'ten
indirildi (host bu oturumda ağ listesine eklendi). Aynı girdilerle
üretilen şifreli metin, RFC'nin yazdığıyla **birebir aynı**.

⚠ **Bu testin sınırı:** doğrulanan şey şifrelemenin standarda
uygunluğu. Gerçek bir push servisinin kabul edip etmediği **ancak
canlıda, gerçek bir cihaza bildirim düşünce** belli olur.

### Alınan tasarım kararları (yarın tekrar tartışılmasın)

1. **VAPID açık anahtarı `app.html`'e GÖMÜLMEYECEK.** Edge Function GET
   ile döndürecek, istemci açılışta çekecek. Sebebi: kullanıcı hiçbir
   dosyayı elle düzenlemek zorunda kalmasın; anahtar yalnızca Supabase
   sırlarında dursun.
2. **Abonelikler ayrı tablo**, `user_prefs` içinde değil. Bir
   kullanıcının birden çok tarayıcısı olur.
3. **Ölü abonelik silinir**, mezar taşı tutulmaz. 404/410 dönen
   abonelik bir daha dirilmez.
4. **Endpoint tekil (kullanıcı başına değil GENEL).** Aynı tarayıcı
   başka hesapla girerse satırı devralır; bildirim yanlış hesaba
   gitmez.

### ⛔ YARIN ÇÖZÜLECEK AÇIK SORU — saat dilimi

Hatırlatma saati (`prefs.reminders.saat`) **kullanıcının yerel
saati**, ama kullanıcının saat dilimi **hiçbir yerde saklanmıyor**
(mekânlarda var, kullanıcıda yok). Sunucu bunu bilmeden ne zaman
göndereceğini hesaplayamaz.

Önerilen: istemci `Intl.DateTimeFormat().resolvedOptions().timeZone`
değerini `prefs`e yazsın. Küçük bir ekleme ama `app.html`'e dokunuyor.

### ⛔ İKİNCİ AÇIK SORU — termin hesabı iki yerde olacak

`hatirlatilacaklar()` (app.html:22050) terminleri tarayıcıda
hesaplıyor. Gönderen Edge Function aynı hesabı **Deno'da tekrar**
yapacak. İki kopya ayrışır — bu depo tam bu hatayı defalarca yaşadı
(politika tablosu, palet, ikon ailesi).

Yarın karar verilecek: (a) iki kopya + ayrışmayı yakalayan test,
(b) hesabı SQL'e taşıyıp ikisinin de oradan okuması.

### Kaydın durumu

Bu işler **`yedek/push-bildirimi` dalında**, `main`'de DEĞİL.
Sebebi: tam test koşusu yapılmadı ve kural "main'e göndermeden önce
tam test" diyor. Yarın tam koşu yeşilse `main`'e geçecek.

---

## Nerede kaldık (15 Kasım 2026 — "her şeyin İngilizcesi olmalı")

Kullanıcı: *"hazırlanan her şey mutlaka invgilizcede olmalı !"* ve
ardından *"sana sorduğum tuşlar için hazırladığın görsellerin
ingilizcesi var mı diye"*.

**Sonuç: kurulum kılavuzunun şemaları ve adım yazıları iki dilde tam.**
Tarayıcıda iki dil de açılıp etiketler tek tek okutularak doğrulandı
(uydurulmadı, Bölüm 4'ün gereği).

Soru sorulduğu için iki **gerçek** kusur çıktı:

1. ⛔ **İngilizcede yanlış menü adı.** Bir adımda "Show More" yazıyordu;
   iPhone ekranında yazan ad **"View More"**. İngilizce kullanan kişi
   ekranda o yazıyı arayıp bulamayacaktı. Metin artık şema
   etiketleriyle **aynı değişkenden** (`dahaf`) geliyor — ikisi bir
   daha ayrışamaz. Ders: aynı dizgeyi iki yere elle yazmak, ikisinin
   ayrışmasını zaman meselesi yapar.
2. ⛔ **Kılavuz AÇIKKEN dil değişirse eski dilde kalıyordu.** Şemaların
   HTML'i pencere açılırken bir kez üretiliyor. `setLanguage` artık
   pencere açıksa `kurTarifiAc()`'i tekrar çağırıyor.

**Depo genelinde Türkçe-only taraması:** sözlük bloklarının dışında 140
eşleşme çıktı, çoğu meşru ve İngilizce gerektirmiyor:

| Tür | Örnek | Neden sorun değil |
|---|---|---|
| Mekân adı çözümleme sözcükleri | `ören yeri`, `manastır`, `müze` | Türkçe mekân adlarını tanımak için **veri**, arayüz metni değil |
| Dil seçicisi | `Türkçe` | Dil adı kendi dilinde yazılır |
| CSS yorumları | gün kısaltmaları | Kullanıcı görmez |
| HTML yedek metinleri | `data-i18n` ile üzerine yazılanlar | Açılışta sözlükten geliyor |
| `tr ? ... : ...` şubeleri | kılavuz adımları | İngilizcesi karşı şubede |

⚠ **Kalan iş:** bu 140'ın tamamı tek tek ayıklanmadı. Yukarıdaki beş
kalıp büyük kısmını açıklıyor ama "hepsi temiz" denemez —
doğrulanmayan şey yazılmıyor (Bölüm 4). Bu oturumda **eklenen** kodun
tamamı tarandı ve temiz.

**Yanlış alarm düzeltmesi:** önceki taramada `mk_daha_az` anahtarı
"eksik" göründü; eksik değil, arama girintiyi yanlış varsaymış.
İki dilde de var (`Show less` / `Daha az`).

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

   ⛔ **BU TAŞIMAYA BAĞLANMIŞ İŞ VAR — 44.3. Taşıma yapılırken onu da
   yap, yoksa bekleyen iki şey sessizce beklemeye devam eder.**
   Kullanıcı 18 Kasım 2026'da iki kararı burada birleştirdi:

   1. **Para birimi ülkeye göre, düğme olmadan.** *"kullanıcı hangi
      ülkeden giriyorsa sadece o fiyatları görmeli — hatta burada
      farklı para birimi tuşları çıkmamalı."* Cloudflare ziyaretçinin
      ülkesini kendisi söylüyor; GitHub Pages'te bu mümkün değil
      (durağan site, bizim kodumuz koşmuyor).
   2. **Türkçe sayfada dolar çıkması.** *"cloudflare e kalsın"* ·
      *"buna dahil et"*. `kaynak/fiyatlar.html:414` hâlâ tarayıcı
      diline bakıyor.

   ⚠ Tam ayrıntı, ölçülen sayılar ve neyin neden bugün yapılamadığı
   **44.3'te** yazılı — taşımaya başlamadan önce orayı oku.

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

    **13 Kasım 2026 — Lemon Squeezy'nin kendi sayfası okundu.**
    Kaynak: `docs.lemonsqueezy.com/help/getting-started/supported-countries`
    (o gün okundu; sayfada güncellenme tarihi yazmıyor, altında yalnızca
    "© 2026 Lemon Squeezy, LLC" var).

    · **Türkiye "Bank payouts supported in the following countries"
      listesinde VAR**, `Tunisia` ile `United Arab Emirates` arasında,
      dipnot işareti olmadan.
    · Türkiye, "Unsupported countries for purchases" listesinde YOK —
      yani müşteri de ödeme yapabiliyor.
    · İkinci yol PayPal: *"PayPal payouts are supported in 200+
      countries and regions."*
    · ⚠ Asgari tutar, para birimi ya da Türkiye'ye özel bir şart
      sayfada YAZMIYOR. Yazmadığı için buraya da yazılmadı.

    ⚠ **DOĞRULANMASI GEREKEN SORU — kapanmadı.** Sayfadaki Hindistan
    dipnotu banka ödemesinin Stripe üzerinden yürüdüğünü açık ediyor:
    *"From May 2024, Stripe only accepts new accounts from India on an
    invite-only basis. This means merchants will only be able to set up
    a bank payout method if their accounts are pre-approved by Stripe."*
    Türkiye için böyle bir dipnot yok, **ama Stripe'ın Türkiye'yi kendi
    ülke listesinde nasıl tuttuğu bu sayfadan görünmüyor.** Kayıt
    olmadan önce Stripe'ın kendi ülke sayfası okunacak.

    ⛔ **Oturumda daha önce iletilen "Lemon Squeezy Stripe Managed
    Payments'a katlanıyor ve o Türkiye'yi desteklemiyor" riski BU
    SAYFADA DOĞRULANMADI.** Sayfada Stripe Managed Payments, bir geçiş,
    kapanma ya da "yeni kayıt alınmıyor" diye hiçbir şey yok. O bilgi
    başka kaynaklardan gelmişti; ikisi birleştirilmedi. Sağlayıcı
    seçimi yapılmadan önce doğrudan Lemon Squeezy'ye sorulacak.
    (CLAUDE.md Bölüm 4: doğrulanmayan şey doğrulanmış gibi yazılmaz.)

    **13 Kasım 2026 — STRIPE'IN KENDİ SAYFALARI DA OKUNDU. İKİ KAYNAK
    ÇELİŞİYOR ve bu çelişki KAPANMADI.**

    `stripe.com/global` — "Global availability" başlığı altında
    *"Stripe is currently supported in the following countries/regions,
    with more to come."* diyor ve **51 ülke sayıyor. TÜRKİYE O LİSTEDE
    YOK.** (Liste sayfayı JavaScript yazıyor; ham HTML'de hiç ülke
    geçmiyor, o yüzden tarayıcıda açılıp okundu. Listede Yunanistan,
    BAE, Tayland, Malezya, Meksika, Brezilya var; Türkiye yok.)

    `docs.stripe.com/connect/cross-border-payouts` —
    *"Platforms based in the US, UK, EEA, Canada, or Switzerland can
    transfer funds to connected accounts in any of those regions"* ve
    hemen ardından *"Stripe doesn't support self-serve cross-border
    payouts to countries outside the listed regions. Contact sales to
    discuss alternatives, or use Global Payouts."*
    Türkiye bu beş bölgenin hiçbirinde değil.

    ⚠ **ÇELİŞKİ ŞU:** Lemon Squeezy "Türkiye'ye banka ödemesi
    yapılabilir" diyor; Stripe kendi ülke listesinde Türkiye'yi
    saymıyor ve kendi belgesinde Türkiye'nin bulunduğu bölgelere
    self-servis sınır ötesi ödeme yapmadığını yazıyor. Lemon Squeezy
    sayfasındaki Hindistan dipnotu da banka ödemesinin Stripe'a
    dayandığını açık ediyor.

    ⛔ **BURADAN "ÇALIŞMAZ" SONUCU ÇIKARILMADI ve çıkarılmamalı.**
    Stripe'ın `Global Payouts` diye ayrı bir ürünü var ve kendi
    belgesi onu *"transfer funds to recipients in any supported
    country"* diye tanımlıyor — Lemon Squeezy Türkiye'ye onunla ya da
    başka bir yolla ödüyor olabilir. **Hangisi olduğunu bu üç sayfadan
    göremiyorum.** Varsayım yazmıyorum (CLAUDE.md Bölüm 4).

    **BİR SONRAKİ ADIM — kullanıcı kararı gerekiyor:**
    Lemon Squeezy'ye doğrudan sorulacak tek soru şu:
    *"Türkiye'de şahıs şirketi olarak kayıtlı bir satıcıya banka
    ödemesi (TRY ya da USD) gerçekten yapıyor musunuz; Stripe'ın
    Türkiye'yi kendi ülke listesinde saymaması buna engel mi?"*
    Cevap gelmeden ödeme sağlayıcısı seçilmeyecek, kod yazılmayacak.

    ⛔ **İKİNCİ KAPI KAPALI — PayPal Türkiye'de yok.**
    Kullanıcı, 13 Kasım 2026, kendi sözleriyle: *"lemon squeezy den
    başka çaremiz yok. Pay Pal TR de yok"*.
    (Bu bir KULLANICI BEYANI; bir sayfadan doğrulanmadı. Doğrulanması
    da gerekmiyor: kendi ülkesindeki kendi durumunu biliyor.)

    **SONUÇ — bu, soruyu bir ayrıntıdan GİT/GİTME KARARINA çeviriyor.**
    Lemon Squeezy'nin Türkiye'ye iki ödeme yolu vardı; PayPal kapalı
    olduğuna göre **banka ödemesi TEK yol.** Ve yukarıda okunan Stripe
    sayfaları tam o yolu soru işareti yapıyor.

    ⚠ **"Başka çaremiz yok" o kapıyı AÇMIYOR.** Kapı ya açık ya değil;
    çaresizlik bir cevap değil. Cevap gelmeden ödeme kodu yazmak,
    sonradan baştan yazılacak bir altyapı demek — o yüzden Aşama 7
    (ödeme, test kipi) bu cevap gelene kadar BAŞLAMIYOR.

    **Cevap "hayır" gelirse tek yol:** yurt içi bir sağlayıcı
    (iyzico / PayTR / Param gibi) + ayrı bir yurt dışı sağlayıcı.
    Bedeli: merchant of record ortadan kalkıyor, yani KDV ve fatura
    BİZİM üstümüze geçiyor. Bu, şahıs şirketi için gerçek bir yük ve
    mali müşavire sorulacak bir konu. ⛔ Bugün bu yol hakkında hiçbir
    şey doğrulanmadı; buraya sağlayıcı adı, oran ya da şart YAZILMADI.

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

### Salt okunur MCP anahtarı (Gemini için) — öncelik DEĞİL (8 Kasım 2026)

⚠ **Yukarıdaki maddeyle KARIŞTIRILMASIN.** O madde *ikinci bir insan
kullanıcı* (workspaces, davet, roller) hakkında. Bu madde tek bir
hesabın ürettiği MCP **anahtarının kapsamı** hakkında — başka bir user
tanımlanmıyor, yeni kullanıcı yok.

Kullanıcı sordu: *"Gemini'ye Shootboard için sadece okuma yetkisi
verebilir miyim?"* Cevap: evet, ve sürpriz şu — **sunucu tarafı zaten
hazır ve canlıda.**

**1. MCP sunucusu: HAZIR (1.16.0, canlı).** `api_keys.scopes` sütunu var
ve sunucu onu gerçekten kontrol ediyor, yazıp bırakmamış:

    shootboard_list_entries   -> 'read'  gerekiyor
    shootboard_list_projects  -> 'read'  gerekiyor
    shootboard_import         -> 'write' gerekiyor
    shootboard_update_entry   -> 'write' gerekiyor
    (REST /import ucu da 'write' istiyor)

Yetkisi olmayan araç `this key cannot write` deyip dönüyor. `sql/35`'in
yorumu niyeti de söylüyor: *"read / write. İkisi de varsayılan; ileride
salt okunur anahtar için."* Yani **sunucuya hiç dokunmak gerekmiyor.**

**2. Uygulama: EKSİK.** `app.html`'de anahtar üretme kodu kapsamı sabit
yazıyor (`scopes: ['read', 'write']`). Yani Hesabım ekranından üretilen
her anahtar yazabiliyor. Salt okunur anahtar için oraya bir onay kutusu
gerekiyor.

**3. Gemini tarafı: DOĞRULANMADI.** Gemini CLI uzak MCP'yi destekliyor
(`~/.gemini/settings.json` → `mcpServers` → `httpUrl` + `headers`), bizim
sunucu Streamable HTTP olduğu için uyumlu. Gemini **uygulaması** için
kaynaklar çelişiyor: özel bağlayıcının Gemini Spark aboneliği
gerektirdiğini yazanlar var, Business'ta "Pre-GA" diyenler var, hepsi
üçüncü taraf blog. ⚠ **Google'ın kendi yardım sayfası görülmedi — buraya
"çalışıyor" yazılmadı** (Bölüm 4: doğrulamadan yazma). Kullanıcının
Gemini → Ayarlar → Connected Apps'te özel sunucu kutusu olup olmadığına
bakması gerekiyor.

**CLAUDE.md kuralı ihlal EDİLMİYOR.** *"MCP erişimi yalnızca
bostancioglum@gmail.com hesabına"* kuralı **Shootboard kullanıcı hesabı**
hakkında ve `sql/40`'taki kilit onu uyguluyor (`user_prefs.prefs.mcp`
bayrağı olmayan hesap anahtar üretemiyor). Kendi hesabının anahtarını
başka bir programa vermek yeni bir user tanımlamak değil.

**ÜÇ RİSK (karar verilirken okunsun)**
1. Salt okunur bile olsa **takvimin tamamı Google'ın sistemine gidiyor.**
   Yazmayı kapatmak veri sızmasını değil veri BOZULMASINI engelliyor.
2. **`mediaUrl` cevapta dönüyor ve o adresler imzasız.**
   `pc/story-yukle.py` adresi `R2_PUBLIC_BASE` üzerinden kuruyor, yani
   dosyalar adresi bilen herkese açık. Anahtar dosyaya erişim VERMİYOR
   ama **adreslerini açıklıyor.**
3. **Anahtar yola değil BAŞLIĞA konsun.** `/mcp/shb_...` biçimi yalnızca
   claude.ai mecbur olduğu için var; yolda duran anahtar günlüklere
   düşer. Gemini CLI `headers` destekliyor.

→ **Gemini için AYRI anahtar üretilsin**, Claude'unki verilmesin: her
anahtarın kendi `revoked_at`'i var, yani Gemini tek başına iptal
edilebilir.

**Neden bekliyor (8 Kasım 2026, kullanıcı kararı):** *"Şimdilik hiçbir
şey yapmıyoruz"*, sonra *"yaz orada dursun ama öncelik değil."* Mantıklı
sıra: **önce** Gemini uygulamasının özel MCP sunucusu kabul ettiği
doğrulanır, **sonra** onay kutusu yazılır — kabul etmiyorsa iş boşa gider.

**Yapılınca ne gerekir:** `app.html`'e onay kutusu + ölçüm. Dağıtım
GitHub Pages, yani birleştirme yeterli — Edge Function dağıtımı YOK.
Tek seferlik kaçamak (SQL ile bir anahtarın kapsamını `{read}` yapmak)
mümkün ama her yeni anahtarda tekrar gerekir ve bir gün atlanır —
deponun kendi dersinin ("ekranı gizlemek kapıyı kilitlemez", `sql/40`)
ters yönden hâli.

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
