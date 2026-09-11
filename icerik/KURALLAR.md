# İçerik Kuralları — Gerçeğin İzleri TV / Tarihi Dedektif

Bu dosya, sohbette belirlenen ve Drive'daki "Kanal İçerik Anayasası (v3)"
ile "ANAYASA GÜNCELLEMESİ" belgelerini tamamlayan kuralların depodaki
kopyasıdır. Çelişki olursa Drive'daki anayasa geçerlidir; buradaki
maddeler oradan alınmış ya da 2026-09-10 sohbetinde eklenmiştir.

Motto: **Rivayet değil, kayıt.** Konu: İstanbul'un tarih gizemleri. Paranormal
ve komplo dili yok, örgüt adı yok.

## 1. Script kuralları (uzun video)

- **Format**: 4 bölümlü motovlog / saha formatı; mekânlar arasında GEÇİŞ
  bölümleri (yürüyüş, vapur, tramvay seslendirmesi). İstanbul dışı ya da
  gidilemeyen yerler `[HARİTA + ARŞİV]` ile.
- **Uzunluk**: en az 1500 seslendirme kelimesi (yalnızca okunan metin;
  başlık, kamera notu, ekran damgası ve Reels işaretleri sayılmaz). Sayım
  dosya sonuna gerçek rakamla yazılır (≈140 kelime/dk → 10–11 dk).
- **İzleyici tutma kurgusu (Kuş Evleri v2 kalıbı)**:
  - 0–3 sn: tek görüntü, tek cümle; kubbe yok, yüz yok.
  - 3–25 sn: üç soru açılır, üçü de videoda kapanır.
  - SONA SAKLANAN bir cevap/deney: hook'ta vaat edilir, yalnızca kapanışta verilir.
  - Her bölüm bir cevap verir, yeni bir soru açar; hiçbir bölüm "bitti" hissiyle kapanmaz.
  - ~90 saniyede bir kalıp kırılır: harita, sayaç, "rivayet / kayıt" damgası, tilt, arşiv.
  - Giriş-çıkış selamı, kanal tanıtımı, "abone ol" yok; ilk cümleden itibaren içerik.
  - Çağrı kısa, tek istek; sonraki bölüm teaser'ı.
  - Kapanış açılış çerçevesine döner.
- **Kapanış cümlesi (değişmez)**: "Ben Mustafa Bostancıoğlu, bu da Tarihi
  Dedektif. Rivayet değil, kayıt. Bir sonraki gizemde görüşmek üzere."
- **Kayıt / rivayet etiketi**: her iddia KAYIT, RİVAYET, YORUM ya da "BAZI
  KAYNAKLARA GÖRE" damgasıyla; belgesi olmayan hiçbir şey kayıt gibi
  anlatılmaz. Dosya sonunda damga listesi ve kaynaklar.
- **Reels kesimleri** script içinde işaretli (`[REELS KESİM n — ...]`), 4–5 adet.
- **Çekim kontrol listesi** scriptin başında; ayrıca Apple Notes'a
  yapıştırılabilir sade sürüm (`icerik/kontrol-listeleri/`).
- **Sahada doldurulacaklar** (sayımlar, bugünkü kullanım) scriptte boş
  bırakılır; çekim sonrası v2'ye işlenir.
- **Seri bağı** (Sinan Dosyası): başlıkta "1. Bölüm" YOK; 5 sn ortak jenerik
  açılış karesinden sonra, kapanışta seri kartı, oynatma listesi. Her bölüm
  tek başına izlenebilir.
- Script Drive'a "Script — X (v1 …)" adıyla, mekân klasörüne yüklenir; kopyası
  `icerik/scriptler/`.

## 2. Script bitince yayın paketi otomatik (2026-09-10)

Her uzun video scripti tamamlanınca, sorulmadan, Shootboard yayın paketi
hazırlanır ve `gelen/kayitlar.json`'a **iki kayıt** yazılır:

| Alan | YouTube kaydı | Facebook kaydı |
|---|---|---|
| `platform` / `type` | youtube / video | facebook / video |
| `time` | 20:00 | 21:00 |
| `proje` | proje adı (Shootboard'daki adla eşleşir) | aynı |
| `title` | takvim başlığı | "X — Facebook paylaşımı" |
| `content.videoTitle` | SEO uzun başlık (≤100 karakter hedef) | kısa hali |
| `content.shortTitle` | kapak başlığı (büyük harf) | aynı |
| `content.caption` | YouTube açıklaması (aşağıda) | Facebook metni (aşağıda) |
| `content.hashtags` | virgüllü anahtar kelimeler | kısa liste |
| `content.thumbPrompt` | YATAY 16:9 + DİKEY 9:16 prompt (bölüm 3) | "YouTube kapağının aynısı" + kırpım notu |
| `content.slidePrompts` | `[]` | `[]` |

**YouTube açıklaması iskeleti**: hook paragrafı → 1–2 paragraf özet →
"Bu videoda:" madde listesi (5–6) → yorum sorusu → seri satırı → "Rivayet
değil, kayıt." → "📍 Kaynaklar:" → kanal linkleri (YouTube, Instagram,
TikTok, Facebook) → hashtag'ler.

**Facebook metni iskeleti**: hook (emoji ile) → kısa özet → yorum sorusu →
"Rivayet değil, kayıt." → "Sayfamda Abonelikler açık. 🙏" → 4–6 hashtag.
**Facebook'a video native yüklendiği için açıklamada ASLA "YouTube'da
izle" ya da YouTube linki olmaz.**

Tarih verilmemişse önceki uzun videodan sonraki Cuma'ya konur ve
kullanıcıya söylenir (Shootboard'da taşınabilir). Kayıtlar takvime ancak dal
main'e alınınca düşer; gelen kutusu yayındaki siteden okunur. Örnekler:
Nuruosmaniye (18 Eylül 2026) ve Sokollu (2 Ekim 2026) kayıtları.

## 3. Kapak görseli (2026-09-10)

- Gemini ile, Mustafa'nın kendi fotoğrafı referans; yüz ve yaş değiştirilmez.
- Yalnızca düz siyah bisiklet yaka tişört; logo, ceket, aksesuar yok.
- Yatayda sol üçte bir / dikeyde alt %45; baş-omuz, göğüsten kesilmiş.
- Bakış kameraya değil konu nesnesine (sağa / yukarı); kaşlar çatık, ciddi.
- Yüzde sıcak altın kenar ışığı, diğer tarafta soğuk gölge; arka plan flu, alacakaranlık.
- TEK konu nesnesi, kalın parlayan SARI NEON HALKA içinde; halka her kapakta aynı kalınlıkta (seri kimliği).
- Başlık iki katman: SARI büyük harf (ince koyu kontur) + KIRMIZI bant üstüne BEYAZ; 2–3 kelime; yüz ve halkayla çakışmaz.
- **Başlık Gemini'de üretilir** (TEXT bloğu prompta girer; onay 2026-09-10).
  Türkçe harf bozulursa TEXT bloğu çıkarılır, alan boş bırakılır, başlık Canva'da eklenir.
- Canva yalnızca damga temizliği ve boyutlandırma (1280x720 / 1080x1920).
- Yasaklar: başka metin, watermark, logo, ikinci kişi.
- Prompt İngilizce, başlık Türkçe. Şablon: `icerik/kapak-promptlari/SABLON.txt`.
  Referans kapak: "Gizli Mimari / Kuş Sarayı" (yatay + dikey).

## 4. Görsel ve kurgu

- AI görseller her zaman Gemini ile; kota dolarsa beklenip tekrar denenir.
- AI canlandırmalar ekranda "TEMSİLİ CANLANDIRMA" etiketiyle.
- Kurgu reçetesi + materyal paketi (b-roll, AI video, arşiv, grafik kart)
  script bitince hazırlanır (`icerik/kurgu/`). Grafik kartlar Playwright ile
  üretilebilir (`icerik/grafik/kus-evleri-kartlar-uretici.js`).
- Ekipman: Osmo Action 4 (+gimbal), iPhone 12 Pro (2x tele: küçük detaylar),
  70 mm üstü objektif uzak kuş evleri için, mini tripod, yaka mikrofonu.

## 5. Çalışma düzeni

- Bu sohbet yalnızca video içerik araştırması ve hazırlığı içindir (kullanıcı
  kararı, 2026-09-10). Uygulama işleri ayrı.
- Drive klasör düzeni: her mekân için klasör; içinde "Script — X (v1 …)",
  "Kurgu Reçetesi — X", "Yayın Paketi — X", "Teleprompter — X",
  "Çekim Kontrol Listesi — X", "Kapak Promptları — X".
- Anayasa değişiklikleri Drive'da "ANAYASA GÜNCELLEMESİ - ..." belgesi olarak
  (klasör 1WzzFcJYspQWUUthn5DFD2wLVynlVsDNm) ve bu dosyada.
