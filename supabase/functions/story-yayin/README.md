# story-yayin — otomatik story yayını (Aşama 2)

Dakikada bir koşan worker. Kuyruktaki story'leri Instagram'a yayınlar.

Şartname: *"Shootboard Otomatik Story Yayını · Meta Graph API v21.0"*.
Bölüm 3, 4, 5, 7, 8, 9 bu klasörde karşılık buluyor; Bölüm 10 (arayüz)
Aşama 3'te, Bölüm 6 (Facebook sayfa story'si) kullanıcı kararıyla
ertelendi.

---

## ⛔ Değişmeyecek tek kural

`uploaded` alanına **hiçbir kod yazmaz.**

    publish_state = SİSTEMİN durumu
    uploaded      = KULLANICININ durumu ("bunu portala yükledim")

Bu bir söz değil, bir yapı: worker `calendar_events`'i hiç `UPDATE`
etmiyor. Yalnızca `sql/41` ve `sql/42`'deki `security definer`
fonksiyonlarını çağırıyor ve o fonksiyonlar `uploaded`'a erişmiyor —
erişemiyor. İyi niyete bırakılan bir kural bir gün birinin ekleyeceği
tek satırla bozulur.

---

## Kurulum sırası

Sıra önemli: her adım bir öncekinin çalıştığını varsayıyor.

### 1. SQL

    sql/41-story-otomatik-yayin.sql     (veri modeli, durum geçişleri)
    sql/42-story-yayin-izi.sql          (çöküş izi, asılı kayıt toplama)

Her ikisinin de sonunda kontrol sorguları var. 41 → 13 sütun + 4
fonksiyon, 42 → 3 sütun + 7 fonksiyon + `sistem_durumu` tablosu.
Sayılar tutmuyorsa devam etme; hangi `begin/commit` bloğunun patladığı
SQL Editor'da görünür.

### 2. Meta tarafı

Developers → uygulama → **Manage messaging & content on Instagram**
use case'i. İzinler: `instagram_basic`, `instagram_content_publish`,
`pages_show_list`, `pages_read_engagement`.

Instagram hesabı **Business** olmalı ve Facebook sayfasına bağlı
olmalı — Creator hesabı story API'sini desteklemiyor.

Token zinciri (Bölüm 3): kısa ömürlü kullanıcı token'ı → uzun ömürlü
(60 gün) → **sayfa token'ı (süresiz)**. Worker'ın kullandığı
sonuncusu.

App Review gerekmiyor: yalnızca uygulamanın admin'inin yönettiği
varlığa yayın yapılıyor.

### 3. Gizli ayarlar

Supabase → Edge Functions → Secrets:

| Ayar | Ne |
|---|---|
| `STORY_WORKER_SECRET` | cron'un `x-webhook-secret` başlığı. Uzun ve rastgele. |
| `META_PAGE_TOKEN` | Süresiz sayfa token'ı |
| `META_IG_USER_ID` | Instagram iş hesabının Graph kimliği |
| `META_APP_ID` / `META_APP_SECRET` | Token sağlık kontrolü için |
| `RESEND_API_KEY` | Başarısızlık bildirimi |
| `STORY_BILDIRIM_EPOSTA` | isteğe bağlı; token uyarısının gideceği adres |

`SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` otomatik geliyor.

`META_APP_ID`/`META_APP_SECRET` yoksa worker çalışmayı sürdürüyor ama
token sağlık kontrolü yapılamıyor — yani token'ın süresi dolduğunda
sistem sessizce durur. Bölüm 3'ün "atlanmaması gereken parça" dediği
tam olarak bu.

### 4. Dağıtım

    supabase functions deploy story-yayin --no-verify-jwt

`--no-verify-jwt` şart: cron kullanıcı oturumu taşımıyor, kimlik
doğrulama `STORY_WORKER_SECRET` ile yapılıyor.

Doğrulama — **GET** ile:

    https://<proje>.supabase.co/functions/v1/story-yayin

Dönen JSON'da `surum` ve hangi gizli ayarların **tanımlı olduğu** var
(değerleri değil). Bu uç bir sebepten var: bir kez eski sürüm
"doğrulandı" sanıldı, çünkü eski ve yeni aynı cevabı veriyordu, ve
sorun günlerce yanlış yerde arandı.

### 5. Zamanlayıcı

    sql/43-story-zamanlayici.sql

İki yerde `<...>` var: gizli anahtar ve proje kimliği. Anahtar Vault'a
gidiyor, betiğe yazılmıyor — depo herkese açık.

Kurulduktan sonra asıl bakılacak yer `net._http_response`: pg_net
isteği atıp bırakıyor, worker'ın cevabı oraya düşüyor. 401 → anahtar
uyuşmuyor, 404 → fonksiyon adresi yanlış.

---

## Akış

```
            ┌─ token geçersiz ──→ kuyruğa HİÇ dokunma + uyar
tur()  ─────┤
            └─ asılı kayıtları topla ─→ kuyruk al ─→ her kayıt:

  external_id dolu?          → yayınlanmış say, çık
  çöküş izi var?             → Instagram'a sor (aşağıda)
  kota dolu?                 → 60 dk ertele (deneme hakkı harcanmaz)
  konteyner yarat            → izi yaz
  hazır olana kadar yokla    → tavan 120 sn
  yayın izini yaz            ← ⚠ yayından ÖNCE
  media_publish              → external_id'yi kaydet
```

## Üç tekrarsızlık katmanı (Bölüm 8)

1. **Durum geçişi atomik.** `for update skip locked` + `in_progress`'e
   çevirme aynı işlemde. İki worker aynı kaydı alamıyor.
2. **`external_id` dolu ise hiçbir şey yapılmıyor.**
3. **Çöküş izi.** İki sütun, çünkü çöküş iki yerde olabiliyor ve
   ikisinin doğru cevabı zıt:

   | `publish_ref` | `publish_called_at` | Anlamı | Yapılacak |
   |---|---|---|---|
   | dolu | boş | Konteyner var, yayın çağrısı **hiç yapılmadı** | Hiçbir şey çıkmış olamaz; aynı konteynerden devam |
   | dolu | dolu | Yayın çağrısı yapıldı, **sonucu bilinmiyor** | `GET /{ig}/stories` — o pencerede story varsa yayınlanmış say |

   `/stories` sorulamıyorsa **yayınlanmıyor**. Bilmemek, ikinci kez
   atmaktan iyidir: çift story geri alınamaz, gecikmiş story alınabilir.

Bu katman `story_asili_topla` olmadan hiç çalışmıyordu ve bu, testi
yazarken ortaya çıktı: çöken worker kaydı `in_progress` bırakıyor,
kuyruk sorgusu ise yalnızca `pending` arıyor. Kurtarma kodu kusursuz
olsa bile çalışacağı an hiç gelmiyordu.

## Hata kovaları (Bölüm 9)

| Kova | Kodlar | Davranış |
|---|---|---|
| `kalici` | #190 #200 #100 #10 #3 #803, alt kod 2207xxx, konteyner `ERROR` | Hemen `failed` + bildirim |
| `gecici` | #2, 5xx, ağ, zaman aşımı | 1 dk → 5 dk → 15 dk, 3. denemede `failed` |
| `kota` | #4 #17 #32 #341 #613 | 60 dk ertele, **deneme hakkı harcanmaz** |

Token ölüyse kuyruk **hiç alınmıyor** (Bölüm 3 ile Bölüm 9 ancak böyle
uzlaşıyor: yoksa süresi dolan bir token kuyruktaki her kaydı tek turda
`failed` yapardı). Yayın sırasında gelen bir #190 hâlâ kalıcı — orada
token geçerli ama başka bir şey eksik demektir.

## Test

    node testler/story-yayin.test.js

Şartname Bölüm 11'deki sıra. En önemlisi 10. madde — worker'ı yayın
çağrısının ortasında öldürmenin dört ayrı biçimi ve hepsinin ölçüsü
aynı: `media_publish` çağrı sayısı.
