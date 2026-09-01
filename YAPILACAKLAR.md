# Slate — Yapılacaklar ve Değerlendirilenler

Bu dosya oturumlar arasında hafıza görevi görüyor. Claude'un hafızası
oturumlar arasında taşınmıyor; konuşulan ama yapılmayan işler burada
duruyor, neden ertelendiği de yazıyor ki aynı tartışma baştan yapılmasın.

---

## Nerede kaldık (1 Eylül 2026)

**Bitti:** Projeler sayfası (üretim takibi, termin tarihleri, tür/adres,
harita bağlantısı), takvim tablo görünümü, sürükle-bırak, açıklama
şablonları, projelerin buluta senkronu, kayıt çoğaltma, saat dilimi.

**Sırada:** aşağıdaki listeler.

---

## Sırada

### Şablonları buluta taşı
Açıklama şablonları ve hesap listesi şu an yalnızca tarayıcının
deposunda. Projelerde olduğu gibi bir tablo ve senkron gerekiyor.
Tek satırlık bir veri olduğu için projelerden daha küçük bir iş.

**Dikkat:** Bu alanda bir kez veri kaybı yaşandı. Sebebi, verinin
açılışta oturum çözülmeden okunmasıydı: anahtar o an anonim anahtardı,
kaydetme ise girişten sonra hesabın anahtarına yazıyordu. Okuma bir daha
oraya bakmadığı için girişliyken girilen her şey yenilemede yok
görünüyordu. Aynı tuzağa düşmemek için: **oturum durumu değiştiğinde
veriyi yeniden oku.**

### Lokasyon uygulamasını kendi adresine taşı
Yeni sürüm `content-calendar-demo/lokasyon.html` adresinde deneme
kopyası olarak duruyor. Onay gelince `lokasyon-takip` deposunun üzerine
yazılacak, turuncu şerit kalkacak. Geri dönüş noktası: `github-surumu`
dalı. GitHub token'ı geçiş bir hafta sorunsuz geçene kadar silinmemeli.

### Yapay zekâ bağlantısı
Metin taslağı için Claude (kod iskeleti var), görsel için Gemini (yeni
iş). Bu ortamdan ikisinin de sunucusuna çıkılamıyor, yani yazılan kod
burada test edilemiyor; ilk denemeyi kullanıcı yapacak.

---

## Ertelenenler (sebebiyle)

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
