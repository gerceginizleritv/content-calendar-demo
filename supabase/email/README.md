# E-posta kurulumu: giriş bağlantıları ve hoşgeldin e-postası

Bu klasör ve `supabase/functions/hosgeldin/` ile `sql/20-hosgeldin-webhook.sql`,
Shootboard'un kendi adresinden (hello@shootboard.app) e-posta göndermesini sağlar.
İki parça var:

1. **Giriş e-postaları** (e-posta bağlantısıyla giriş): Supabase gönderir, ama
   Resend'in SMTP'si ve buradaki şablonlarla. Böylece gönderici adresi ve
   görünüm senin olur; ücretsiz plandaki saatlik e-posta sınırı da kalkar.
2. **Hoşgeldin e-postası**: hesap ilk açıldığında bir kez gider. Bir Edge Function
   ve auth.users üzerindeki bir tetikleyiciyle çalışır; sunucu gerekmez.

Aşağıdaki adımların hepsi bir kez yapılır; toplam yarım saat.

## 1. Resend hesabı ve alan adı

1. https://resend.com adresinde hesap aç (ücretsiz plan: ayda 3.000, günde 100 e-posta).
2. **Domains → Add Domain** → `shootboard.app`. Bölge olarak Avrupa'yı seç.
3. Resend üç DNS kaydı verir: `send` alt alan adı için bir **MX** ve bir **TXT**
   (SPF), bir de `resend._domainkey` için **TXT** (DKIM). Üçünü Cloudflare'de
   DNS → Records'a aynen ekle; proxy durumu **DNS only**. Cloudflare'in Email
   Routing için kilitlediği MX kayıtlarına dokunulmaz; Resend farklı bir alt
   alan adı kullanır, ikisi birlikte çalışır.
4. Resend'de **Verify** de. Genellikle birkaç dakikada doğrulanır.
5. **API Keys → Create API Key**: ad "supabase", izin "Sending access", alan adı
   shootboard.app. Anahtar `re_` ile başlar ve bir kez gösterilir; kopyala.

## 2. Supabase SMTP: giriş e-postaları hello@ adresinden gitsin

Supabase panel → **Project Settings → Authentication → SMTP Settings** →
"Enable Custom SMTP":

| Alan | Değer |
|---|---|
| Sender email | hello@shootboard.app |
| Sender name | Shootboard |
| Host | smtp.resend.com |
| Port | 465 |
| Username | resend |
| Password | Resend API anahtarı |

Sonra **Authentication → Rate Limits** → "Rate limit for sending emails"
değerini 30'a çıkar; özel SMTP'de bu sınır senin.

## 3. Şablonlar: Authentication → Email Templates

İki şablonu yapıştır. "Message body" alanına dosyanın tamamı, "Subject
heading" alanına `KONULAR.txt` içindeki ilgili satır.

| Supabase şablonu | Dosya |
|---|---|
| Confirm sign up | `confirm-signup.html` |
| Magic Link | `magic-link.html` |

E-posta bağlantısıyla giriş isteyen kişinin hesabı yoksa "Confirm sign up",
varsa "Magic Link" şablonu gider. **Her e-posta tek dilde gider:** şablon,
hesabın meta verisindeki `lang` alanına bakar (uygulama e-posta girişinde
kayıt anında, Google girişinde ilk açılışta yazıyor; dil değiştirilince
güncelliyor). `lang` hiç yoksa, yani daha uygulamayı hiç açmamış eski bir
hesapsa, iki dilli gider. Giriş formuna yazılan ad varsa e-posta o adla
seslenir.

Konu satırı da aynı kuralla dile göre seçilir. Test e-postasında konu
satırında süslü parantez görürsen Supabase'in konu alanı şablon kabul
etmiyordur; `KONULAR.txt` içindeki düz sürümleri kullan.

`{{ ... }}` ile yazılan her şey Supabase'in doldurduğu yer tutucudur; silme,
değiştirme. Önizlemeler `onizleme/` klasöründe.

## 4. Edge Function: hoşgeldin e-postası

İki yol var; ikisi de aynı sonucu verir.

**Panelden (komut satırı yok):** Supabase panel → **Edge Functions → Deploy a
new function → Via Editor**. Ad: `hosgeldin`. Editörde iki dosya oluştur:
`index.ts` ve `sablonlar.js`; içeriklerini `supabase/functions/hosgeldin/`
klasöründeki dosyalardan yapıştır. Fonksiyon ayarlarında **Verify JWT**
kapalı olmalı. Sonra **Edge Functions → Secrets** bölümünde iki gizli değer ekle:

- `RESEND_API_KEY`: Resend anahtarı
- `HOSGELDIN_WEBHOOK_SECRET`: en az 32 karakterlik rastgele bir metin. Bir parola
  üreticisinden alabilirsin ya da terminalde `openssl rand -hex 32`.

**Komut satırından:**

```
npx supabase@latest login
npx supabase link --project-ref dyemvzmpnlpnzwebuciu
npx supabase secrets set RESEND_API_KEY=re_... HOSGELDIN_WEBHOOK_SECRET=...
npx supabase functions deploy hosgeldin --no-verify-jwt
```

## 5. Tetikleyici

1. Supabase panel → **Database → Webhooks** → "Enable Database Webhooks".
2. **SQL Editor**'de `sql/20-hosgeldin-webhook.sql` dosyasını aç, içindeki
   `DEGISTIR_GIZLI_ANAHTAR` (iki yerde) yerine HOSGELDIN_WEBHOOK_SECRET'in
   birebir aynısını yaz, çalıştır. İki tetikleyici kurulur: e-posta ile açılan
   hesapta hemen, Google ile açılan hesapta uygulama ilk açılıp dili yazınca.

## 6. Test

1. Daha önce kullanılmamış bir e-posta adresiyle Shootboard'a e-posta
   bağlantısıyla gir. Gelen kutusunda önce "Confirm signup" e-postası, giriş
   yaptıktan hemen sonra hoşgeldin e-postası olmalı.
2. Resend → **Logs**: iki gönderim de "Delivered" görünmeli.
3. Supabase → **Edge Functions → hosgeldin → Logs**: `[hosgeldin] gonderildi`
   satırı. `gizli anahtar uyusmuyor` görürsen SQL'deki anahtar ile secret farklı.

Hoşgeldin e-postası her zaman tek dilde gider: e-posta ile açılan hesapta
kayıt anındaki arayüz dili, Google ile açılan hesapta uygulamanın ilk
açılışındaki dil. Google hesabında e-posta, kullanıcı yönlendirmeden
uygulamaya döndüğü saniyede gider. Selamlama, giriş formuna yazılan ada ya da
Google'dan gelen ada göre.

## 7. Metinleri değiştirmek

- Giriş e-postaları: bu klasördeki iki HTML dosyasını düzenle, Supabase'e
  yeniden yapıştır.
- Hoşgeldin e-postası: `supabase/functions/hosgeldin/sablonlar.js` içindeki
  `METIN` nesnesi. Değiştirdikten sonra fonksiyonu yeniden dağıt. Önizlemeler
  `onizleme/` klasöründe; `node` ile yeniden üretilebilir.

## 8. Hukuki not

Giriş bağlantısı ve hoşgeldin e-postası işlemsel sayılır; izin gerekmez.
Bülten ya da tanıtım e-postası göndereceksen kayıt ekranına açık bir onay
kutusu gerekir; Türkiye'deki alıcılar için ayrıca İYS kaydı zorunludur.
Bu kurulumda tanıtım e-postası yoktur.
