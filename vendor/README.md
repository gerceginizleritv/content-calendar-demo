# vendor — depoya alınmış dış kütüphaneler

## Neden var (YAPILACAKLAR 62)

⛔ **20 Kasım 2026 — BİR GÜNDE DÖRT ARIZA, HEPSİ AYNI DOSYA.**

Kullanıcı sırayla şunları yaşadı:

1. Google ile giriş çalışmadı ("cevap dönmüyor")
2. Yönetim paneli "Yükleniyor…" diye asılı kaldı, tablolar boş
3. Kaydettiği değişiklik sunucuya hiç ulaşmadı (denetim kaydında yok)
4. Herkese açık **fiyatlar sayfası** "Fiyatlar yüklenemedi" dedi

Ölçüldü: Supabase'in kendisi **sağlamdı** — REST beş denemede de 200
döndü (0,18–0,39 sn), auth ayaktaydı, Google OAuth zinciri uçtan uca
çalışıyordu, canlı `app.html` depodakiyle bayt bayt aynıydı.

Geriye tek ortak bağımlılık kaldı: **`cdn.jsdelivr.net` üzerinden
gelen supabase-js.** O dosya gelmezse `sb` boş kalıyor ve o sayfada
hiçbir şey çalışmıyor — giriş de, kaydetme de, fiyat listesi de.

⚠ **Dürüst sınır:** CDN'in o anda gerçekten takıldığı
*kanıtlanmadı* — ölçümü yapan ortamda o adres ağ kuralıyla kapalıydı.
Ama Supabase'in sağlam olduğu ölçüldü ve arızalanan her şey bu tek
dosyaya bağlıydı. Kütüphaneyi kendi sitemizden sunmak, hangisi olursa
olsun bu arıza *sınıfını* tamamen kaldırıyor.

## Dosyalar

| Dosya | Ne |
|---|---|
| `supabase.js` | supabase-js **2.45.4** UMD yapısı |
| `591.supabase.js` | Aynı sürümün webpack parçası |

⚠ `591.supabase.js` tarayıcıda **hiç çağrılmıyor**: içeriği yalnızca
*"ws does not work in the browser"* hatası fırlatan bir Node yedeği.
Yine de yanında duruyor (223 bayt) ki tembel bir yükleme olursa 404
almasın.

## Nereden geldi

npm kayıt defterinden, jsdelivr'ın da aldığı yerden:

    npm pack @supabase/supabase-js@2.45.4

Paketin içinden `package/dist/umd/` klasörü alındı. ⛔ Dosya **elle
düzenlenmedi**; sürüm, CDN'den çekilenle birebir aynı.

## Sürüm yükseltmek gerekirse

1. `npm pack @supabase/supabase-js@<yeni-sürüm>`
2. `package/dist/umd/*.js` dosyalarını buraya kopyala
3. Bu dosyadaki sürüm numarasını güncelle
4. ⛔ **Tam koşu yap.** Sekiz sayfa bu kütüphaneye bağlı; biri
   kırılırsa o sayfada hiçbir şey çalışmaz.

## ⛔ Bekçi test

`testler/supabase-yerel.test.js` hiçbir sayfanın supabase-js'i
**dışarıdan** çekmediğini ölçüyor. ⚠ Sayfa listesini elle yazmıyor,
depoyu kendisi tarıyor — yarın eklenen bir sayfa yine CDN'den
çekerse yakalar.
