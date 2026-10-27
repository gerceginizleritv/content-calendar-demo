# Shootboard (eski adı Slate) — Yapılacaklar ve Değerlendirilenler

Bu dosya oturumlar arasında hafıza görevi görüyor. Claude'un hafızası
oturumlar arasında taşınmıyor; konuşulan ama yapılmayan işler burada
duruyor, neden ertelendiği de yazıyor ki aynı tartışma baştan yapılmasın.

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
