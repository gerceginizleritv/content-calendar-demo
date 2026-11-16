# push-gonder — kapalıyken gelen bildirim

Shootboard kapalıyken termin hatırlatmasını gönderen Edge Function.
Zamanlanmış görev saatte bir çağırıyor; fonksiyon her kullanıcının
**kendi saat diliminde** hatırlatma saati gelmiş mi diye bakıyor,
gelmişse o günün terminlerini hesaplayıp bildirimi yolluyor.

⛔ **Hiçbir dış kütüphane yok.** Şifreleme (RFC 8291), paketleme
(RFC 8188) ve VAPID imzası (RFC 8292) `webpush.ts` içinde elle
yazıldı — bu depodaki her Edge Function böyle.

⛔ **Şifreleme uydurulmadı.** RFC 8291'in resmî test vektörüyle
doğrulandı: `testler/webpush-vektor.test.js`. Bu dosyalarda bir şey
değiştirirsen o testi koştur — şifreleme sessizce bozulur, tarayıcı
sebep söylemez, bildirim yalnızca gelmez.

⛔ **Termin hesabı iki yerde.** `terminler.ts` ile `app.html`'deki
`hatirlatilacaklar()` ikizdir. `testler/termin-ikiz.test.js` ikisini
aynı verilerle karşılaştırıyor; ayrışırsa kırmızı yanıyor.

---

## Kurulum — adım adım

Toplam yedi adım. Sırayı bozma: 4. adım 2. adımdaki anahtarlara,
6. adım 5. adımdaki adrese ihtiyaç duyuyor.

### Adım 1 — Tabloyu kur

1. Tarayıcıda **Supabase** panelini aç, Shootboard projesini seç.
2. Sol menüden **SQL Editor** → sağ üstten **New query**.
3. Depodaki `sql/71-push-abonelikleri.sql` dosyasının **tamamını**
   kopyalayıp kutuya yapıştır.
4. **Run** düğmesine bas.

Ne göreceksin: Supabase "Success. No rows returned" yazacak.

⚠ Bu bir **başarı** mesajıdır, "sıfır satır" demek değildir. Bu
dosya tablo kuruyor, satır döndürmüyor.

Farklı bir şey görürsen — özellikle kırmızı bir hata — **dur, bana yaz.**

### Adım 2 — VAPID anahtarını üret

Push bildirimi bir anahtar çifti istiyor. Bilgisayarına hiçbir şey
kurman gerekmiyor; anahtar senin tarayıcında üretiliyor.

1. Tarayıcıda şu adresi aç:
   `https://shootboard.app/araclar/vapid-uret.html`
2. **Anahtar çiftini üret** düğmesine bas.
3. İki kutu açılacak: **VAPID_ACIK** ve **VAPID_OZEL**.
4. Bu sekmeyi **kapatma** — bir sonraki adımda ikisini de
   kopyalayacaksın.

Ne göreceksin: üstteki kutuda yaklaşık 87 karakterlik, alttakinde
43 karakterlik, `B...` ve rastgele harflerden oluşan iki metin.

⛔ **Özel anahtarı kimseye gönderme, bu sohbete de yapıştırma.**
Yalnızca bir sonraki adımdaki Supabase kutusuna girecek.

⚠ Sayfanın ağa çıkan tek satırı yok; anahtar sekmeden dışarı çıkmıyor.
Sekmeyi kapatınca da yok oluyor, yani 3. adımı bitirmeden kapatma.

### Adım 3 — Gizli ayarları yaz

1. Supabase panelinde sol menüden **Edge Functions**.
2. Üstteki **Secrets** sekmesi.
3. **Add new secret** ile aşağıdaki dördünü **tek tek** ekle.

| Name kutusuna | Value kutusuna |
|---|---|
| `VAPID_ACIK` | 2. adımdaki **açık** anahtar |
| `VAPID_OZEL` | 2. adımdaki **özel** anahtar |
| `VAPID_KONU` | `mailto:hello@shootboard.app` |
| `PUSH_TETIK_SIRRI` | uzun, rastgele bir metin (aşağıya bak) |

`PUSH_TETIK_SIRRI` ne olacak: kendi uyduracağın, tahmin edilemeyecek
uzun bir metin. Klavyeden rastgele 40 karakter yeterli. **Bir yere
not et** — 6. adımda aynısını bir daha yazacaksın.

⚠ `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` eklenmez; Supabase
onları kendisi tanımlıyor.

Ne göreceksin: Secrets listesinde dört yeni satır. Değerler
gösterilmiyor, yalnızca adlar — bu normal.

**Aynı adımın ikinci yarısı:** açık anahtar bir de veritabanına
yazılacak, çünkü uygulamanın aboneliği açarken ona ihtiyacı var.

4. Supabase → **SQL Editor** → **New query**.
5. Şunu yapıştır ve `<ACIK-ANAHTAR>` yerine 2. adımdaki **açık**
   anahtarı koy:

```
insert into public.genel_ayarlar (anahtar, deger, not_)
values ('vapid_acik', '<ACIK-ANAHTAR>',
        'Push aboneligi icin. Gizli DEGIL, tarayiciya gidiyor.')
on conflict (anahtar) do update
  set deger = excluded.deger, guncellendi = now();
```

6. **Run.**

Ne göreceksin: "Success. No rows returned".

⛔ Buraya **özel** anahtarı yazma. Bu tablo herkese açık okunuyor —
öyle olması gerekiyor, çünkü giriş yapmamış ziyaretçinin de abonelik
açabilmesi lazım. Açık anahtar zaten gizli değil; özel anahtar
yalnızca yukarıdaki Secrets kutusuna girer.

### Adım 4 — Fonksiyonu dağıt

İki yol var, **birini** seç.

**Panelden (daha kolay):**

1. **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Ad kutusuna birebir şunu yaz: `push-gonder`
3. Editördeki örnek kodu **tamamen sil.**
4. Depodaki şu üç dosyayı ayrı ayrı oluştur ve içeriklerini yapıştır:
   `index.ts`, `webpush.ts`, `terminler.ts`
5. **Verify JWT** seçeneğini **kapat.** Çağıran taraf bir kullanıcı
   oturumu değil, cron; kimliğini `x-push-secret` başlığıyla
   kanıtlıyor.
6. **Deploy.**

**Komut satırından:**

```
npx supabase@latest login
npx supabase link --project-ref dyemvzmpnlpnzwebuciu
npx supabase functions deploy push-gonder --no-verify-jwt
```

### Adım 5 — Dağıtımı doğrula ve GERÇEK adresi öğren

⚠ **Bu adımı atlama.** Panelden kurulan fonksiyonun adresindeki kısa
ad **klasör adı değildir** — rastgele üretilir ve sonradan
değiştirilemez. Bu tuzak bu depoda iki kez 404'e yol açtı.

1. **Edge Functions** listesinde `push-gonder`'a tıkla.
2. Sayfada görünen **tam adresi** kopyala. Şuna benzeyecek:
   `https://dyemvzmpnlpnzwebuciu.supabase.co/functions/v1/bir-sey`
3. O adresi tarayıcının adres çubuğuna yapıştır ve **Enter**.

Ne göreceksin: düz metin bir JSON. İçinde `"surum": 1` yazmalı ve
`sirlar` bölümündeki **altısı da `true`** olmalı.

Biri `false` ise: 3. adımdaki gizli ayarlardan biri eksik ya da adı
yanlış yazılmış. Geri dön, adı harfi harfine karşılaştır.

404 görürsen: adresi listeden değil tahminle yazmışsındır. 2. maddeye
dön.

⛔ Bu adreste **özel anahtar görünmez** — yalnızca "tanımlı mı"
bilgisi. Açık anahtar görünür; o zaten gizli değil, tarayıcılara
gidiyor.

### Adım 6 — Zamanlayıcıyı kur

1. Supabase → **SQL Editor** → **New query**.
2. Depodaki `sql/72-push-zamanlayici.sql` dosyasının tamamını yapıştır.
3. Yapıştırdığın metinde **üç yeri** değiştir:

| Bul | Yerine yaz |
|---|---|
| `<BURAYA-TETIK-SIRRI>` | 3. adımda uydurduğun metnin **aynısı** |
| `<PROJE-REF>` | Settings → General → Reference ID |
| `<KISA-AD>` | 5. adımda okuduğun adresin **son parçası** |

4. **Run.**

Ne göreceksin: "Success. No rows returned".

⚠ Dosyanın sonundaki kontrol sorguları **yorum içinde**, bilerek.
Onları yukarıdaki betikle birlikte çalıştırma: biri patlarsa kurulum
da geri alınır. Bu kaza `sql/43`'te bir kez yaşandı.

Kontrol etmek istersen, **ayrı bir New query** açıp dosyanın sonundaki
kontrol sorgusunu (başındaki `--` işaretlerini silerek) çalıştır.
Beklenen: 1 satır, `active` sütunu `true`.

### Adım 7 — Uygulamada aç ve dene

1. `shootboard.app/app.html` adresini aç, hesabına gir.
2. Sol menüden **🔔 Hatırlatmalar**.
3. **Tarayıcı bildirimi** bölümünde **Bildirimlere izin ver**.
4. Tarayıcı izin soracak — **İzin ver**.
5. Hangi durumlarda bildirim isteyeceğini seç (gecikmiş / bugün /
   yarın) ve hatırlatma saatini ayarla.

⚠ **iPhone ve iPad'de önce ana ekrana eklemek ŞART.** Eklenmemişse
iOS hiç bildirim göndermiyor. Kurulum düğmesi sol menüde, "Giriş
yap"ın altında.

Ne göreceksin: ekranda "Bu tarayıcıda bildirimler açık."

Bildirim ne zaman gelir: ayarladığın saatten sonraki ilk cron
koşusunda — yani **en geç 59 dakika** içinde. Saatte bir koşuyor.

---

## Uçlar

| yöntem | ne yapar |
|---|---|
| `GET /` | sürüm, VAPID **açık** anahtarı, hangi sırların tanımlı olduğu |
| `POST /` | bir gönderim turu — `x-push-secret` başlığı ister |
| `OPTIONS /` | CORS ön kontrolü (app.html başka kökenden çağırıyor) |

`GET` bir **sağlık kontrolü**: dağıtımın tuttuğunu ve hangi sırların
tanımlı olduğunu dışarıdan görmenin tek yolu. Özel anahtar buradan
asla dönmüyor.

⚠ **`app.html` bu fonksiyonu hiç çağırmıyor.** VAPID açık anahtarını
`genel_ayarlar` tablosundan okuyor. Sebebi: panelden kurulan
fonksiyonun adresindeki kısa ad **rastgele** üretiliyor, yani
`app.html` o adresi önceden bilemezdi. Tablodan okuyunca istemci
fonksiyonun adresinden tamamen bağımsız kalıyor.

## Gönderim turunda ne oluyor

1. Bütün push abonelikleri okunuyor.
2. Her abonelik için kullanıcının tercihleri okunuyor (bir kez,
   önbellekten — aynı kişinin üç tarayıcısı varsa üç kez sorulmuyor).
3. Hiçbir hatırlatma kanalı açık değilse atlanıyor.
4. Kullanıcının saat diliminde bugünün tarihi bulunuyor.
5. O gün zaten gönderilmişse atlanıyor (`son_gonderim_gunu`).
6. Kullanıcının kendi saatine bakılıyor; saat gelmemişse atlanıyor.
7. Terminler hesaplanıyor; boşsa gönderilmiyor.
8. Bildirim gönderiliyor, `son_gonderim_gunu` işaretleniyor.
9. Push servisi **404** ya da **410** döndürürse abonelik ölmüştür:
   satır siliniyor.

Cevapta dönen JSON: `abonelik`, `gonderildi`, `atlandi`, `silindi`,
`hata` sayıları ve en fazla 20 satır hata ayrıntısı.

## Sürüm

`index.ts` içindeki `SURUM` sabiti. Metin ya da mantık değişince
**artır** — yoksa "dağıtım tuttu mu" sorusunun dışarıdan cevabı
olmuyor. `story-yayin`'de bir kez eski sürüm "doğrulandı" sanıldı ve
sorun günlerce yanlış yerde arandı.
