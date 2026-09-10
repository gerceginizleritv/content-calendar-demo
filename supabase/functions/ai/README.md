# AI erişimi — Edge Function kurulumu

Bu fonksiyon, `ai/` klasöründeki paket biçimini alıp hesaba yazan ve
hesaptakileri okuyan uçları verir. Ne olduğu ve neden: `ai/README.md`.
Kullanıcıya verilen kart: `ai/asistan-karti.md`.

## Dosyalar

| Dosya | Ne |
|---|---|
| `index.ts` | uçlar, kimlik doğrulama, yazma/okuma |
| `dogrula.js` | paket doğrulama; saf, Node'da test edilir (`testler/ai-erisimi-dogrula.test.js`) |
| `sema.ts` | `ai/sema.json` kopyası; `birlestir.py` üretir |
| `tek-dosya.ts` | üçünün birleşiği; panelden kurarken yapıştırılır; `birlestir.py` üretir |

`index.ts`, `dogrula.js` ya da `ai/sema.json` değişince:

```
python3 supabase/functions/ai/birlestir.py
```

## Kurulum (bir kez)

1. **SQL:** Supabase panel → SQL Editor → `sql/35-ai-erisimi.sql` → Run.
   (Öncesinde sql/33 ve sql/34 çalıştırılmış olmalı; çalıştırılmadıysa
   fonksiyon o sütunları atlayarak yine çalışır ama koordinat ve çoklu
   mekan bilgisi buluta gitmez.)

2. **Fonksiyon — panelden:** Edge Functions → Deploy a new function → Via
   Editor. Ad kutusuna birebir `ai` yaz (uçlar bu adı taşıyor). Editördeki
   dosyanın içini sil, `tek-dosya.ts`'nin tamamını yapıştır, Deploy.
   Fonksiyon ayarlarında **Verify JWT kapalı** olmalı: çağıran taraf
   Supabase oturumu değil, bizim `shb_` anahtarımızı taşıyor.
   Gizli ayar eklenmez; `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY`
   fonksiyona kendiliğinden gelir.

   **Komut satırından:**
   ```
   npx supabase@latest login
   npx supabase link --project-ref dyemvzmpnlpnzwebuciu
   npx supabase functions deploy ai --no-verify-jwt
   ```

3. **Anahtar:** uygulamada Hesabım → AI erişimi → Yeni anahtar. Anahtar
   bir kez gösterilir; kopyalanıp AI sohbetine verilir.

## Deneme

```
A=shb_...   # uygulamadan alınan anahtar
U=https://dyemvzmpnlpnzwebuciu.supabase.co/functions/v1/ai

curl -s $U/                          # uçların listesi, anahtarsız
curl -s -H "Authorization: Bearer $A" $U/me
curl -s -H "Authorization: Bearer $A" "$U/entries?from=2026-09-01&to=2026-09-30"
curl -s -X POST -H "Authorization: Bearer $A" -H "Content-Type: application/json" \
     -d '{"shootboard":1,"source":"curl","ideas":[{"text":"deneme fikri"}]}' $U/import
curl -s -X POST -H "Authorization: Bearer $A" -H "Content-Type: application/json" -d '{}' $U/undo
```

Beklenen: `/import` → `{"ok":true,"importId":"ak_...","created":{"ideas":["fk_..."]},...}`;
uygulamada Fikirler sayfasında "AI" rozetli bir fikir; `/undo` → o fikir
kalkar. Hata yanıtları hep `{"ok":false,"error":"...","message":"..."}`:

| error | anlamı |
|---|---|
| `unauthorized` (401) | anahtar yok, biçimi bozuk ya da iptal edilmiş |
| `not_installed` (503) | sql/35 çalıştırılmamış |
| `invalid_package` (422) | paket okunamadı; `warnings` içinde sebep |
| `limit` (422) | hesabın sınırı aşılırdı; hiçbir şey yazılmadı |
| `rate_limited` (429) | anahtar başına saatte 60 aktarım |

## Güvenlik notları

- Anahtar düz metin olarak hiçbir yerde durmaz; `api_keys.key_hash`
  SHA-256 özetidir. Log satırlarına anahtar yazılmaz.
- Servis rolü yalnızca bu fonksiyonun içinde; tarayıcıya gitmez. Her
  sorgu `user_id` ile süzülür; verilen kimliklerde sahiplik denetlenir
  (`sahiplik()`), başkasının kimliği gelirse öğe atlanır ve uyarı döner.
- CORS herkese açık: anahtar zaten istek başlığında; tarayıcıdan çalışan
  araçlar (ör. bir web ajanı) da kullanabilsin.
- Geri alma yalnızca defterdeki kimliklere dokunur ve yine `user_id`
  süzgeciyle.
