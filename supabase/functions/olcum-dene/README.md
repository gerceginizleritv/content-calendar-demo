# olcum-dene — görüntülenme sondası

Yayınlanmış gerçek gönderiler için insights uçlarını **deniyor** ve
sonucu `olcum_denemesi` tablosuna yazıyor. Amaç tek: asıl toplayıcı
yazılmadan önce hangi iznin ve hangi metrik adının gerçekten
çalıştığını görmek.

⛔ **Salt okur.** Yalnız GET. Hiçbir yayın ucunu çağırmıyor, hiçbir
kaydın durumunu değiştirmiyor. Tek yazdığı yer kendi deneme tablosu.

⛔ **Jeton hiçbir yere yazılmıyor.** Saklanan adres `access_token`
ayıklanmış hali; ham cevap ve her hata metni süzülüyor.

## Kurulum

### 1. Tablo

Supabase panel → SQL Editor → New query → `sql/67-olcum-denemesi.sql`
dosyasının **1/3** bölümündeki `create table` bloğunu yapıştır → Run.

### 2. Fonksiyon

**Panelden:** Edge Functions → Deploy a new function → Via Editor.
Ad kutusuna birebir `olcum-dene` yaz. Editördeki örnek kodu sil,
`index.ts`'nin tamamını yapıştır, Deploy.

⚠ **Verify JWT kapalı olmalı.** Çağıran taraf bir Supabase oturumu
değil, pg_cron/pg_net; kimliğini `x-webhook-secret` başlığıyla
kanıtlıyor.

**Komut satırından:**

```
npx supabase@latest login
npx supabase link --project-ref dyemvzmpnlpnzwebuciu
npx supabase functions deploy olcum-dene --no-verify-jwt
```

Gizli ayar eklenmez. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
kendiliğinden gelir; `STORY_WORKER_SECRET`, `META_PAGE_TOKEN` ve
`GRAF_TABANI` worker'la aynı ortamdan okunuyor.

### 3. Çalıştır ve oku

`sql/67` dosyasının 2/3 ve 3/3 bölümleri: önce `net.http_post` ile
çağır, 20 saniye sonra `olcum_denemesi` tablosunu oku.

## Uçlar

| yöntem | ne yapar |
|---|---|
| `GET /` | servis bilgisi (sürüm, saltOkur) |
| `POST /` | bir sonda turu — `x-webhook-secret` ister |
