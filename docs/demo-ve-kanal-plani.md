# Demo açılışı ve ürün kanalları planı

**Tarih:** 7 Eylül 2026
**Soru:** shootboard.app demoya açılmak üzere; ürünün Instagram ve YouTube
sayfaları henüz yok. Nasıl ilerlemeli? Hem Türkçe hem İngilizce konuşan
pazarın tamamı hedeflenmeli mi?
**Dayanak:** `docs/pazar-arastirmasi.md` (2 Eylül 2026), `YAPILACAKLAR.md`
KAPI 1 listesi ve 7 Eylül 2026'da kodun kendisinden yapılan doğrulamalar.

---

## 0. Kısa cevap

0. **Demo kapısı neredeyse açık.** 7 Eylül'de `main` kontrol edildi: gelen
   kutusu sızıntısı, kullanım şartları ve hesap silme bitmiş. Geriye bir
   saatlik tek iş kalıyor — karşılama sayfasına sayaç (bölüm 1).
1. **Sosyal hesap açmak demo açılışının önündeki iş değil, sonrasındaki iş.**
   İlk 20 deneyiciyi sıfır takipçili bir hesap getirmez; sizin var olan
   kanalınız, birebir davet ve üretici toplulukları getirir. Yeni bir hesabı
   büyütmeyi beklemek demoyu haftalarca geciktirir ve karşılığında hiçbir şey
   üretmez.
2. **Yapılacak tek acil sosyal iş kullanıcı adlarını almak.** Yarım saat,
   sıfır taahhüt: isim kapılmasın. Paylaşım yapmak ayrı karar.
3. **"Hem Türkçe hem İngilizce" evet, ama simetrik değil.** Ürün arayüzü iki
   dilde (zaten öyle). Ürün *hesabı* tek dilde, İngilizce olmalı. Türkçe
   erişim yeni bir hesaptan değil, sizin var olan kanalınızdan gelmeli.
   İki dilde iki hesap yürütmek tek kişi için iki kat iş, ve araştırmanın
   kendi sonucu şu: gelir İngilizce pazardan gelecek, Türkiye'nin rolü ilk
   topluluk ve ilk deneyiciler (bkz. `pazar-arastirmasi.md` bölüm 6).

---

## 1. Demo kapısı: güncel `main` üzerinde durum (7 Eylül 2026)

Bu bölüm önce, `main`'in 60 commit gerisinde kalmış bir daldan okunarak
yazılmıştı ve beş madde de açık görünüyordu. Güncel `main` kontrol edilince
üçünün bitmiş olduğu görüldü. Doğru liste:

| # | Madde | Durum (kanıt) |
|---|---|---|
| 1 | Gelen kutusu yalnızca sahibin hesabında çalışsın | **Bitti.** `gelenKutusuAcik` bayrağı eklenmiş; `gelenKutusunuIsle()` içinde `if(!gelenKutusuAcik) return;` (`app.html:9433`), bayrak `user_prefs.prefs.gelen_kutusu`'ndan okunuyor (`app.html:9350`). Önerilen çözümün aynısı, e-posta gömülmeden. |
| 2 | Kullanım şartları sayfası | **Bitti.** Kökte `sartlar.html` var. |
| 3 | Hesabı kendi kendine silme | **Bitti.** Arayüz `app.html:3479-3484`, sunucu tarafı `sql/22-hesap-sil.sql` ve `sql/29-hesap-sil-kovalar.sql`. E-posta yazarak onay isteniyor. |
| 4 | **Karşılama sayfasında ölçüm** | **AÇIK.** GoatCounter yalnızca `app.html` içinde; `index.html`'de hiçbir sayaç yok. Kaç kişi karşılama sayfasına geldi, kaçı uygulamaya geçti — bugün ölçülemiyor. Demonun en önemli tek sayısı bu. 1 saat. |
| 5 | Supabase ücretsiz katman | **Kısmen çözülmüş, karar sizin.** `sql/28-otomatik-yedek.sql` ile günde bir kez hesabın bütün verisi JSON olarak aynı projedeki özel bir kovaya yazılıyor, son yedi gün duruyor. Betiğin kendi notu sınırı dürüstçe yazıyor: *"bu yedek AYNI Supabase projesinde duruyor; projenin kendisi giderse yedek de gider."* Yani veri kaybı riski büyük ölçüde kapandı, ama hareketsizlikte projenin durması riski duruyor. Deneme dönemi boyunca ücretsiz katmanla gidilebilir; ödeyen ilk kullanıcıda Pro şart. |

**Demo açılışının önündeki tek zorunlu iş 4. madde.** Bir saatlik iş.

Ayrıca açılıştan önce bir kez gerçek telefonda takvim kontrolü: kodda
`.cal-day.collapsed` ve telefon medya sorgusu var, gerçek cihazda
doğrulanmadı. Deneyicilerin çoğu telefondan bakacak.

---

## 2. Dil ve pazar kararı

**Ürün arayüzü:** İngilizce + Türkçe. Zaten böyle, değişmiyor.

**Ürün hesapları (Instagram, YouTube, X):** yalnızca **İngilizce**.
Gerekçeler:
- Araştırmanın ölçümü: "içerik takvimi" terimlerinin hiçbiri Türkiye'de ayda
  750 arama eşiğini geçmiyor; İngilizce tarafta tek terim ayda 47 bin
  (`pazar-arastirmasi.md` bölüm 3.1). Türkçe içerik arama üzerinden kimseyi
  bulmuyor.
- Ödeme gücü: 9 dolarlık abonelik Türkiye'de Netflix'in iki katı.
- Tek kişi iki dilde iki hesabı sürdüremez; sürdürse bile ikisi de zayıf olur.

**Türkçe erişim:** yeni hesap açılarak değil, **sizin var olan kanalınız**
üzerinden. Kanal zaten çekim yapan, saha planlayan bir kitleye konuşuyor —
Shootboard'ın tarif ettiği nişin ta kendisi. "Bu belgeseli nasıl planladım"
formatında tek bir video, sıfırdan kurulacak bir ürün hesabının altı ayda
ulaşacağı yerden fazlasını getirir. Türkçe tarafta ürün hesabı açmak, var
olan erişimi çöpe atıp sıfırdan başlamaktır.

**Fiyat (para alma günü geldiğinde):** Türkiye'ye satın alma gücü paritesiyle
%50 civarı indirim, araştırmadaki öneriyle aynı.

---

## 3. Hesap planı

### Şimdi (bu hafta, yarım saat)
Kullanıcı adlarını al, sayfaları boş bırak. Ad kapılması geri alınamaz, hesap
açmak bedava:

- Instagram: `@shootboard` (yoksa `@shootboardapp`)
- YouTube: `@shootboard`
- X: `@shootboard`
- TikTok: `@shootboard`
- Reddit: `u/shootboard` (hesap yaşı ve karma gerektiren alt forumlar var;
  bugün açılan hesap 45. günde paylaşım yapabilir hale gelir)
- Product Hunt: ürün taslağı (yayınlamadan)

Her birine aynı avatar (`icons/icon-512.png`), aynı tek cümle
("One shoot becomes ten posts.") ve shootboard.app bağlantısı. Bu kadar.

### Demo bitene kadar (yaklaşık 4-6 hafta)
Hesaplara **paylaşım yapılmıyor**. Boş bir hesap, haftada üç kez paylaşım
yapıp kimseye ulaşamayan bir hesaptan iyidir; ikincisi hem zaman yer hem de
sonradan gelen ziyaretçiye "ölü ürün" görüntüsü bırakır.

### Demo sonrası (kanal açılışı)
Ürünün kendi tezini kendi pazarlamasına uygula: **bir çekim, on paylaşım.**
Ayrı bir "içerik üretimi" işi kurma; zaten yaptığın çekimin planlama tarafını
kaydet.

Tek kaynak çekim: "Bir belgeseli baştan sona nasıl planlıyorum" (8-12 dakika,
ekran kaydı + saha görüntüsü). Bundan çıkanlar:
- YouTube uzun video (İngilizce, Türkçe altyazı)
- 3 Short/Reel: (a) tür ve platform neden iki ayrı etiket, (b) bir çekimden
  on paylaşım nasıl çıkıyor, (c) neden bilerek yayınlamıyoruz
- 1 taşıma yazısı: "Neden içerik takvimimiz yayın yapmıyor" — Show HN ve
  r/SideProject için de bu yazı kullanılır
- Karşılama sayfasına gömülecek 40 saniyelik sessiz demo döngüsü

Haftalık yük: bir çekim + bir kurgu günü. Sürdürülebilir olan bu.

---

## 4. İlk deneyiciler nereden gelecek

Hedef: **20 kişi, 20 bin takipçi değil.** Sıra:

1. **Birebir davet (10-15 kişi).** Tanıdığınız, çekim yapan üreticiler.
   Mesaj kısa: "Kendi çekim planımı tutmak için bir pano yaptım, üç hafta
   bedava kullanır mısın, tek istediğim iki kere konuşmamız." Dönüş oranı
   soğuk trafikten on kat yüksek.
2. **Kendi kanalınız (5-10 kişi).** Video açıklamasında ve sabitlenmiş
   yorumda bağlantı. Kanal videosu şart değil; var olan bir videonun
   açıklaması bile yeter.
3. **Türk üretici Discord/Telegram toplulukları.** Kural: önce katkı, sonra
   bağlantı. Reklam gibi girilirse atılırsınız.
4. **Reddit ve Show HN — demo bittikten sonra.** r/SideProject çalışan ürün
   istiyor, bekleme listesi bağlantısını yasaklıyor; r/NewTubers ve
   r/ContentCreators kurallarını okumadan paylaşmayın.

Araştırmadaki "20 Mom Test görüşmesi" maddesi hâlâ geçerli ve hâlâ
yapılmadı: fikri anlatmayın, geçmiş davranışı sorun.

---

## 5. Neye bakacağız

Demo döneminde takipçi sayısı bir ölçüt değildir. Bakılacaklar:

| Soru | Ölçüm | Ne iyi |
|---|---|---|
| Karşılama sayfası işini yapıyor mu? | index.html ziyaret → app.html geçiş | %25 üstü |
| Ürün ilk beş dakikayı geçiyor mu? | `funnel/entry-created` / uygulamayı açan | %40 üstü |
| İkinci gün geri geliyor mu? | 7 gün içinde ikinci oturum | %30 üstü |
| Ürün "arada bir açılan pano" olmaktan çıkıyor mu? | `funnel/calendar-subscribed`, `funnel/reminder-shown` | 20 deneyicide 5+ |
| Ne söylüyorlar? | Web3Forms geri bildirim + iki görüşme | 20'de 10 görüşme |

Huni olaylarının çoğu kodda hazır (`funnel/*`, 45 olay). Eksik olan tek şey
karşılama sayfasındaki sayaç — bölüm 1, madde 4.

---

## 6. Dört haftalık takvim

**Hafta 1 — kapıyı kapat**
- Karşılama sayfasına GoatCounter (tek zorunlu madde, 1 saat)
- Gerçek telefonda takvim kontrolü
- Kullanıcı adlarını al (yarım saat)
- İade politikası: şartlar sayfasında yoksa eklenir — deneme döneminde
  para alınmadığı için açılışı bekletmez
- Supabase Pro: ödeyen ilk kullanıcıya kadar ertelenebilir (otomatik
  yedek eklendi), kararı siz verin

**Hafta 2 — 20 kişiyi çağır**
- Birebir davetler; hedef 20 kabul
- Gerçek telefonda takvim kontrolü
- Geri bildirim formunun deneme sürecine göre metni

**Hafta 3-4 — dinle ve onar**
- İlk 10 görüşme (Mom Test)
- Her hafta çıkan iki kusuru düzelt, deneyicilere haber ver
- Kaynak çekimi bu dönemde yap; yayınlama, biriktir

**5. hafta — kanalı aç**
- Uzun video + 3 kısa + yazı
- Show HN, r/SideProject, Product Hunt
- Türkçe taraf: kendi kanalında tek video, ürün hesabı yok

Bu takvimin sonunda araştırmanın 11. bölümündeki karar tablosunu doldurmak
için gerçek sayı olur; bugün yok.
