# Mekan adresini otomatik bulma ve tek projede birden çok mekan — analiz

**Tarih:** 10 Eylül 2026. **Durum:** araştırma; kod değişikliği yok.
**Soru (kullanıcı):** "Mekanlarda mekan adını yazdığımda benden adres istiyor,
otomatik doldurabilir miyiz? İstemeyenler için il/ilçe var ama yurtdışında
farklı olabilir; il seçilince alt kırılımlar (ilçe, sokak) gelebilir mi?
İsimle bulunamayınca elle eklenebilmeli ya da bulunan yer kontrol
edilebilmeli. Bir de tek proje altına birden çok mekan seçilebilmeli; aynı
günde aynı video için 2–3 lokasyon oluyor."

**Dayanak:** `app.html` (main, 10 Eylül), `sql/24-mekanlar.sql`,
`sql/23-script-cok-proje.sql`, `sql/30-fikir-cok-proje.sql`,
`YAPILACAKLAR.md` "Adres otomatik tamamlama (Google Places)" maddesi ve
aşağıdaki kaynaklar. Dış servisler bu ortamdan çağrılamadı (ağ engeli);
kapsam yargıları belgelere dayanıyor, canlı deneme yapılmadı.

---

## 0. Kısa cevap

1. **"Adres istiyor" uyarısı mekan penceresinden gelmiyor, proje
   penceresinden geliyor.** Mekan kaydında yalnızca ad zorunlu. Proje "saha
   işi" (açık alan / mekan) türündeyse ve projenin kendi adres alanı boşsa
   "Bu bir saha işi ama adres girmedin. Yine de oluşturulsun mu?" soruluyor.
   Proje formundan "+ Yeni mekan" ile mekan eklemek yalnızca ad soruyor;
   mekan adressiz doğuyor, proje de adressiz kalıyor, soru geliyor. Kod
   seçili mekanın adresine hiç bakmıyor. **Yarım günlük düzeltme:** seçili
   mekanın adresi projenin adresi sayılsın; "+ Yeni mekan" isim sorusu
   yerine tam mekan penceresini açsın.
2. **Adresi otomatik bulma: evet, iki katmanlı.** Ücretsiz katman OSM
   tabanlı: Enter'a basınca Nominatim araması (yazdıkça öneri yasak), ya da
   yazdıkça Photon önerisi. Seçince adres, ilçe, il, ülke, koordinat ve
   harita bağlantısı dolar; her alan elle düzeltilebilir; bulunamazsa aynı
   alanlar boş açılır. Google Places yalnızca ücretli pakette ve Supabase
   Edge Function arkasında; bu, `YAPILACAKLAR`'daki önceki kararla aynı.
3. **İl → ilçe → sokak kırılımı:** Türkiye için 81 il / 973 ilçe listesi
   sayfaya gömülür (yaklaşık 30 KB), il seçilince ilçe listesi daralır.
   Dünya için gömülü liste yok; arama sonucunun yönetim kademeleri (il,
   ilçe karşılıkları) otomatik doldurulur. Sokak düzeyi gömülemez; Türkiye
   sokak verisi yüzlerce MB, o iş geocoder'ın.
4. **Birden çok mekan: evet.** Script ve fikirlerde zaten kullanılan
   `project_ids text[]` deseniyle `projects.place_ids text[]`; sıra dizide,
   `place_id` ilk durak olarak kalır (eski istemciler ve `sql/26` bozulmaz).
   Bir iki gün.

---

## 1. Bugün ne var (kodda doğrulandı)

| Konu | Durum | Yer |
|---|---|---|
| Mekan alanları | `name` (zorunlu), `city`, `district`, `address`, `permission`, `cautions`, `notes`, `mapsUrl`, `driveUrl`, `imageUrl`. **Koordinat saklanmıyor.** | `app.html` `mekanTemizle`, `sql/24-mekanlar.sql` |
| Koordinat nereden | Önce harita bağlantısından regex ile (`@41.0,28.9`, `!3d..!4d..`, `?q=lat,lon`); yoksa "ilçe, il" ya da "il" metni Open-Meteo geocoding'e soruluyor. **Mekan adı bilerek sorulmuyor:** servis yerleşim adı indeksliyor, işletme/bina değil; "Berlin Kafe, İstanbul" ya boş dönüyor ya başka şehri veriyor. | `mekanKonum`, `mekanKoordinati`, `yerdenKoordinat` |
| Kart görseli | Fotoğraf varsa o; yoksa koordinat varsa OpenStreetMap karosu (© OpenStreetMap yazılı); yoksa baş harf. | `mekanGorseli`, `haritaKaresi` |
| Fotoğraf arama | Vikipedi'den ad + il/ilçe ile. | `mekanFotoAra` |
| Proje ↔ mekan | `projects.placeId` tek değer; veritabanında `projects.place_id` → `places.id` (silinince `set null`). Bekleyen iş sayımı, sıralama ve silme davranışı bu tek alana bağlı. | `mekanProjeleri`, `mekanBekleyenleri`, `mekanSil`, `sql/24` |
| Proje adresi | Projenin kendi `address/district/city` alanları var; mekandan kopyalanmıyor. Kartta "Harita" düğmesi projenin adresinden üretiliyor; adres yoksa "Adres yok" rozeti. | proje kartı çizimi, `haritaLinki` |
| Adres sorusu | Tür `outdoor`/`venue` ve proje adresi boşsa onay sorusu (`p_addr_confirm`). Seçili mekanın adresine bakılmıyor. | `PROJ_TYPES_ADDRESS`, proje oluşturma |
| Çoklu bağ örneği | Script ↔ proje ve fikir ↔ proje zaten çok-çok: `project_ids text[]`, eski `project_id` ilk eleman olarak korunuyor; `kimlikListesi` ile temizleniyor. | `sql/23`, `sql/30`, `fikirProjeListesi` |
| Eski saha uygulaması | `lokasyon.html` `locations` tablosunu okuyor, `places` ile bağı yok. Bu değişiklik onu etkilemiyor. | `lokasyon.html` |
| Önceki karar | "Adres otomatik tamamlama (Google Places)" beklemede, üç şartla: anahtar sunucuda, demoda kapalı, saklama şartları okunmalı. | `YAPILACAKLAR.md` |

Hatırlatma (aynı dosyadaki ders): beyaz listeyle temizlenen nesnelere alan
eklenirken `sanitize*` beyaz listesi ve satır dönüştürücüler (`*RowYap`,
`*RowOku`) güncellenmezse alan sessizce düşer. Aşağıdaki her yeni alan bu
üç yeri birlikte ister.

---

## 2. "Adres istiyor" akışı ve ucuz düzeltme

Akış bugün şöyle: Projeler → Yeni proje → tür "Mekan çekimi" → Mekan
listesinde "+ Yeni mekan" → yalnızca **ad** soruluyor → Kaydet → "adres
girmedin, yine de oluşturulsun mu?".

İki küçük değişiklik, otomatik doldurma hiç yapılmasa da rahatsızlığı
kaldırır:

1. Onay sorusu ve kart rozeti, proje adresi boşken **seçili mekanın**
   adresine baksın (`mekanById(placeId).address`). Mekanın adresi varsa
   soru yok, "Harita" düğmesi mekanın bağlantısını açar.
2. "+ Yeni mekan" isim sorusu yerine mekan penceresini açsın (ad, il,
   ilçe, adres, uyarılar); kaydedince listede seçili gelsin. Yeni mekanı
   projeden ekleyen kişi zaten oradayken adresi de yazar.

Yarım gün; testlerden `mekan-yeniproje.test.js` ve `yeniproje*.test.js`
güncellenir.

**Yapıldı (10 Eylül 2026, Faz 0):** `projeYeri(p)` yardımcısı projenin
kendi adresi yoksa bağlı mekanın adresini ya da harita bağlantısını
döndürüyor; onay sorusu ve karttaki "Harita" düğmesi ona bakıyor (mekanın
harita bağlantısı varsa düğme doğrudan onu açıyor). "+ Yeni mekan" artık
`mekanPenceresiniAc(null, sonra)` ile tam pencereyi açıyor, kaydedilen
mekan proje formunda seçili geliyor, vazgeçilince eski seçim duruyor.
Testler: `mekan-adres-proje.test.js` (yeni), `mekan-yeniproje.test.js`
(güncellendi).

---

## 3. Adresi otomatik bulma: seçenekler

| Servis | Ne bulur | Ücret / sınır | Anahtar | Kurallar | Türkiye'de kapsam |
|---|---|---|---|---|---|
| **Google Places API (New)**: Autocomplete + Place Details | İşletme, bina, anıt, adres; dünyanın en iyi POI verisi | Mart 2025'ten beri SKU başına ücretsiz kota: Essentials 10.000 çağrı/ay; Autocomplete istek başına 1.000'de 2,83 $, oturum (session) içinde 0 $; Place Details Essentials 1.000'de 5 $ (10.000 ücretsiz). 200 $ genel kredi kalktı. | Zorunlu; tarayıcıya konamaz (kötüye kullanım faturası size). Supabase Edge Function arkasında, kullanıcı başına sınır ve önbellekle. | **Saklama:** Place ID süresiz saklanabilir; enlem/boylam en çok 30 gün; adres metni, ad gibi içerik için saklama istisnası yok. Yani "adresi Google'dan çekip kendi tablomuza yazalım" tam olarak izinli değil; izinli olan Place ID'yi saklayıp gösterirken yeniden sormak. | En iyi. Küçük işletme, han, cami, müze, kafe: hepsi. |
| **Nominatim** (OSM, nominatim.openstreetmap.org) | Adres, yerleşim, OSM'deki POI'ler; yapılandırılmış adres parçaları (sokak, mahalle, ilçe, il, ülke) ve koordinat | Ücretsiz; en çok 1 istek/sn; toplu kullanım yok | Yok; `User-Agent` ya da `Referer` şart | **Yazdıkça öneri (autocomplete) açıkça yasak.** Enter'a basınca tek arama serbest. Veri ODbL, atıf şart; saklama serbest. | Tarihi yapılar ve kamu binaları büyük ölçüde var; küçük işletmeler seyrek. Canlı doğrulanamadı. |
| **Photon** (komoot, OSM) | Nominatim'le aynı veri, yazdıkça arama için tasarlanmış, yazım hatasına toleranslı | Ücretsiz; "makul kullanım", aşırı kullanımda kısma/yasak, SLA yok | Yok | Yazdıkça öneri serbest. Kendi sunucusu kurulabilir (dünya indeksi ~95 GB). | OSM ile aynı. |
| **Open-Meteo geocoding** (zaten kullanılıyor) | Yalnızca yerleşim: ülke, il, ilçe, mahalle/belde; `admin1..admin4`, saat dilimi, posta kodları | Ücretsiz, ticari olmayan kullanım; 10.000 çağrı/gün. **Ticari kullanım (abonelikli ya da reklamlı uygulama) 29 $/ay Standart plan ister; geocoding plana dahil.** | Ücretsizde yok | POI yok, adres yok | Yerleşim adları tam. |
| Mapbox Search Box / Geoapify / LocationIQ | OSM + kendi verileri; yazdıkça öneri | Ücretsiz kotalar var (bu oturumda doğrulanmadı) | Tarayıcıda alan adı kısıtıyla kullanılabiliyor | Saklama şartları Google'dan rahat | OSM düzeyi |
| **Gömülü Türkiye listesi** (il/ilçe/mahalle JSON, GitHub) | Kırılım listeleri; koordinat yok | Ücretsiz | Yok | Kaynağa göre değişir (NVİ türevi) | 81 il, 973 ilçe (~30 KB); mahalle dahil birkaç MB; sokak yüzlerce MB |

Not: Open-Meteo şartı bu analizden bağımsız bir konu; hava bloğu bugün
onu kullanıyor. Para alınmaya başlandığı gün ya Standart plan alınır ya
da hava için başka kaynak bulunur. `YAPILACAKLAR`'a ayrı madde.

---

## 4. Önerilen tasarım: adres

**Arama kutusu davranışı (mekan penceresi):**

- Ad alanı arama kutusu olur. Enter ya da "Bul" düğmesi Nominatim'e
  sorar (Faz 1); Photon eklenirse yazdıkça 3 karakterden sonra öneri
  düşer (Faz 2). Sorgu her zaman "ad + varsa il" biçiminde gider:
  "Nuruosmaniye Han, İstanbul". Öneri satırı: **ad — ilçe, il, ülke**.
- Seçince dolanlar: `address` (yol + kapı no + mahalle), `district`,
  `city`, `country`, `lat`, `lon`, `timezone` (Open-Meteo'dan ya da
  koordinattan), `mapsUrl` (kullanıcının seçtiği harita: Google Maps
  `?q=lat,lon` ya da OSM bağlantısı), `source` (`osm` / `google` /
  `manual`), `external_id` (OSM id ya da Place ID). Her alan düzenlenebilir
  kalır; kullanıcı dokunursa `source` `manual` olur.
- **Bulunamazsa:** "Bulunamadı, elle gir" notu; alanlar boş açık; il/ilçe
  için Türkiye listesi. Koordinatsız mekan bugünkü gibi ilçe/il'den
  yaklaşık koordinat alır.
- **Kontrol:** Kart görseli zaten OSM karosu; seçimden hemen sonra
  pencere içinde aynı karo gösterilir ("burası mı?"). Yanlışsa öneri
  listesine dönülür ya da harita bağlantısı elle yapıştırılır (bugünkü
  yol). Koordinatı harita bağlantısından okuma korunur; bağlantı arama
  sonucunu ezer, çünkü kullanıcının seçtiği nokta daha kesindir.

**İl / ilçe / yurtdışı:**

- Türkiye listesi gömülü: `city` alanı `datalist` ile 81 il; il
  seçilince `district` `datalist`'i o ilin ilçelerine iner. Serbest
  yazma yasaklanmaz; yurtdışı için aynı alanlar serbest metin.
- Yurtdışında kırılım: arama sonucunun `admin1` (eyalet/il) ve `admin2`
  (ilçe/county) karşılıkları aynı iki alana yazılır; etiketler ülkeye
  göre değişmez, "İl" ve "İlçe" olarak kalır. Ayrı bir "eyalet" alanı
  açmak formu şişirir, gerek yok.
- Sokak: gömülü değil; adres alanı arama sonucundan dolar ya da elle
  yazılır.

**Veri modeli:** `places` tablosuna `lat double precision`, `lon double
precision`, `country text`, `timezone text`, `source text`, `external_id
text` (`sql/33-mekan-koordinat.sql`, hepsi `add column if not exists`,
varsayılan boş). Uygulamada `mekanTemizle` beyaz listesi, `mekanRowYap`,
`mekanRowOku`; sütun yoksa `mekanFotoSutunu` desenindeki gibi geri düşüş.
Koordinat artık saklandığı için hava bloğu ve kart karosu her açılışta
yeniden geocode etmez; `mekanKoordinati` önce `m.lat/m.lon`'a bakar.

**Ücret, anahtar, şartlar:**

- Faz 1–2 anahtarsız ve ücretsiz; demoda açık kalabilir. Nominatim'de
  istekler kullanıcı eylemiyle (Enter) tek tek gider, 1 istek/sn sınırı
  tek kullanıcıda aşılmaz; 20 deneyici için sorun yok. Photon "makul
  kullanım"; deneme ölçeğinde sorun yok, satışta kendi sunucu ya da
  ücretli OSM servisi (Geoapify/LocationIQ) düşünülür.
- Google yalnızca Edge Function arkasında, ücretli pakette, oturum
  belirteciyle; Place ID saklanır, adres metni kullanıcının onayladığı
  alan olarak yazılır. Bu son nokta şartların okunmasını ister; "biz
  Place ID'yi saklıyoruz, adres metnini kullanıcı kendi alanına yazıyor"
  yorumu yaygın ama Google'ın açık istisnası değil. Ödeme altyapısı
  gelmeden bu faz açılmaz (önceki karar).
- Atıf: OSM verisi kullanılan her yerde "© OpenStreetMap contributors"
  (kartta zaten var; öneri listesine de konur).

**Yapıldı (10 Eylül 2026, Faz 1):** mekan penceresinde ad alanının yanında
"Bul" düğmesi; Enter ya da düğme Nominatim'e tek istek atıyor (yazdıkça
öneri yok, kural gereği), sonuçlar "ad — tür · adres · ilçe · il · ülke"
satırlarıyla listeleniyor, altında OSM kaynak yazısı. Seçince adres (yol +
kapı no + mahalle + posta kodu), ilçe, il, ülke, koordinat, OSM kimliği ve
harita bağlantısı doluyor (bağlantı `?query=en,boy` biçiminde, virgül
kodlanmadan; `mekanKonum` onu geri okuyor); kullanıcının yazdığı ad
korunuyor. "Burası mı?" karosu pencere içinde (`haritaKaroHtml`, kartla
aynı dört karo). Saat dilimi hava bloğunun Open-Meteo cevabından alınıp
gizli alana yazılıyor. Mekan modeline `lat, lon, country, timezone,
source, externalId` eklendi (`mekanTemizle` beyaz listesi, `mekanRowYap`,
`mekanRowOku`); `sql/33-mekan-konum.sql` sütunları ekliyor, betik
çalıştırılmadıysa `mekanKonumSutunlari` geri düşüşüyle sütunsuz yazılıyor.
Kart karosu ve hava koordinatı artık `mekanKonumu(m)` üzerinden: harita
bağlantısı > kayıtlı koordinat > ilçe/il araması. Türkiye il/ilçe listesi
`veri/tr-il-ilce.json` (81 il, 973 ilçe, 12 KB, MIT kaynaklı), pencere ilk
açıldığında çekiliyor, `datalist` olarak; il yazılınca ilçe listesi
daralıyor; yurtdışında serbest metin. Test: `mekan-bul.test.js`.
Yapılmayan: Photon (Faz 2) ve Google (Faz 3).

**Fazlar:**

| Faz | İş | Süre |
|---|---|---|
| 0 | Bölüm 2'deki iki düzeltme — **yapıldı, 10 Eylül** | Yarım gün |
| 1 | Nominatim "Enter ile bul", koordinat + ülke + saat dilimi saklama, otomatik harita bağlantısı, pencere içi karo ile kontrol, Türkiye il/ilçe `datalist`, migration `sql/33` — **yapıldı, 10 Eylül** | 2 gün |
| 2 | Photon yazdıkça öneri (aynı seçim akışı, sadece tetikleyici değişir) | Yarım gün |
| 3 | Google Places, Edge Function, oturum belirteci, paket kapısı | 2 gün, ödeme sonrası |

---

## 5. Tek projede birden çok mekan

**Neden:** Belgesel gününde sabah han, öğlen çarşı, akşam sahil. Bugün ya
üç proje açılıyor ya da biri seçilip diğerleri notlara yazılıyor; mekan
kartındaki "bekleyen iş" sayısı ve "orada başka ne var" cevabı ikisinde
de yanlış çıkıyor.

**Veri modeli:** `sql/23` ve `sql/30`'daki desen birebir:

- `projects.place_ids text[] not null default '{}'`; dizinin sırası
  durak sırası. `place_id` ilk eleman olarak kalır (`sql/26`, eski
  istemciler, kart ve sayımlar bozulmaz). Migration: `set place_ids =
  array[place_id] where place_id is not null and cardinality(place_ids)=0`.
- Uygulamada `sanitizeProject`'e `placeIds` (`kimlikListesi` ile, var
  olmayan mekan kimlikleri ayıklanır), `placeId = placeIds[0] || ''`
  türetilir; satır dönüştürücülerde `place_ids`; sütun yoksa geri düşüş.
- Durak başına saat ve not (`09:00 Han`, `13:00 Çarşı`) ilk sürümde yok;
  gerekirse ikinci adımda `stops jsonb` gelir. Önce sıra ve çokluk.

**Arayüz:**

- Proje penceresinde "Mekan" seçicisi "Mekanlar" olur: seçilenler çip
  olarak sıralanır, ▲▼ ile sıra değişir, × ile çıkar, listeden ekle;
  "+ Yeni mekan" pencereyi açar (Bölüm 2). Tek mekanlı proje için görünüm
  bugünkünden farklı değil: bir çip.
- Proje kartı: bir mekan varsa adı; birden çoksa "3 mekan" ve ipucunda
  sırayla adlar. "Harita" düğmesi ilk durağı açar; ipucunda hepsi.
- Bekleyen mekan bilgisi satırı (adres · izin · dikkat) durak başına
  tek satır; en fazla üç, fazlası "…+2".
- Hava bloğu (proje düzenleme): koordinatı olan her durak için bir satır;
  ilk durak açık, diğerleri katlı.

**Etkilenen yerler ve davranış:**

| Yer | Bugün | Sonra |
|---|---|---|
| `mekanProjeleri`, `mekanBekleyenleri` | `p.placeId === id` | `p.placeIds.includes(id)` |
| `mekanSil` | bağlı projelerde `placeId=''` | diziden çıkar; ilk durak değişirse `placeId` yeniden türetilir |
| Proje kartı "Harita" / "Adres yok" | proje adresi | proje adresi, yoksa ilk durağın adresi (Bölüm 2) |
| Proje türü "saha" onayı | proje adresi | proje adresi ya da herhangi bir durağın adresi |
| Mekan sayfası kart sayacı | tek bağ | çok bağ; bir proje iki kartta sayılır, doğru olan bu |
| Paylaşım sayfası (`paylas.html`) | mekan göstermiyor | değişmez |
| Takvim kayıtları | projeye bağlı, mekana değil | değişmez |
| Eski saha uygulaması | `locations` | değişmez |

**Testler:** `mekan.test.js`, `mekan-bekleyen.test.js`,
`mekan-yeniproje.test.js`, `proje-bagi.test.js`, `yeniproje*.test.js`
güncellenir; yeni: "iki mekanlı proje: sıra, silme, sayım, harita".

**Süre:** 1–2 gün; Bölüm 4 Faz 1 ile aynı PR'da olmak zorunda değil.

**Yapıldı (10 Eylül 2026):** `projects.placeIds` sıralı liste,
`placeId` ilk duraktan türetiliyor (`sanitizeProject`, `projeMekanListesi`;
temizlenmemiş nesneler için `projeMekanlari`). Bulut: `place_ids text[]`
(`sql/34-proje-cok-mekan.sql`, eski `place_id` ilk durak olarak kalıyor,
betik yoksa `projMekanSutunu` geri düşüşüyle listesiz yazılıyor). Proje
formunda seçim kutusu kaldı; her seçim bir çip ekliyor, ▲▼ ile sıra, × ile
çıkarma, tek mekanda tek çip; "+ Yeni mekan" penceresi kaydedince yeni
mekan listeye giriyor. Kartta ilk durağın adı ve "+N", ipucunda hepsi;
"Harita" ve adres sorusu ilk durağa bakıyor. Mekan kartı sayımları ve
silme davranışı listeyi tarıyor. Durak saati yok (karar 3). Test:
`proje-cok-mekan.test.js`. Proje düzenleme penceresinde durak başına hava
satırı yapılmadı; ayrı iş.

---

## 6. Karar isteyen noktalar

1. Faz 1'i demoda açmak (Nominatim/Photon, ücretsiz) — evet önerilir.
2. Google katmanı: ödeme altyapısından önce hiç dokunulmasın (önceki
   kararla aynı) — evet önerilir.
3. Çoklu mekanda durak saati ilk sürümde olsun mu — hayır önerilir;
   sıra yeter, saat kayıtlarda zaten var. (Uygulandı: saat yok.)
4. Open-Meteo ticari şartı: para alınan gün 29 $/ay plan mı, hava için
   başka kaynak mı — şimdi değil, `YAPILACAKLAR`'a madde.

---

## Kaynaklar (10 Eylül 2026)

- Google Places fiyatlandırma (SKU başına ücretsiz kota, Autocomplete ve
  Place Details): <https://www.woosmap.com/blog/google-places-api-pricing> ;
  <https://storerocket.io/learn/google-maps-api-pricing> ; resmî sayfa
  <https://developers.google.com/maps/documentation/places/web-service/usage-and-billing>
  (bu ortamdan açılamadı)
- Google Places saklama kuralları (Place ID süresiz, koordinat 30 gün):
  <https://developers.google.com/maps/documentation/places/web-service/policies> ;
  <https://openplacesapi.com/blog/can-you-store-places-api-results>
- Nominatim kullanım politikası (autocomplete yasak, 1 istek/sn):
  <https://operations.osmfoundation.org/policies/nominatim/>
- Photon (komoot): <https://github.com/komoot/photon> ; karşılaştırma
  <https://chibigeo.com/docs/compare/photon-vs-nominatim/>
- Open-Meteo geocoding alanları ve şartlar:
  <https://open-meteo.com/en/docs/geocoding-api> ;
  <https://open-meteo.com/en/terms> ; <https://open-meteo.com/en/pricing>
- Türkiye il/ilçe/mahalle açık verileri:
  <https://github.com/bertugfahriozer/il_ilce_mahalle> ;
  <https://github.com/ferhat-mousavi/turkiye-il-ilce-mahalle-koy> ;
  <https://github.com/metinyildirimnet/turkiye-adresler-json> (sokak dahil)
