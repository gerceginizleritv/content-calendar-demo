# MCP sunucusu — kurulum

Claude'u (ya da MCP konuşan başka bir istemciyi) Shootboard takvimine
bağlayan uzak MCP sunucusu. Ne yaptığı ve neden böyle yapıldığı:
`index.ts`'in başındaki açıklama ve `sql/39-mcp-erisimi.sql`.

## Dosyalar

| Dosya | Ne |
|---|---|
| `index.ts` | MCP protokolü, kimlik, dört araç |
| `dogrula.js` | **`ai/dogrula.js` kopyası** — elle düzenleme, `birlestir.py` üretir |
| `sema.ts` | `ai/sema.json` kopyası; araç şemaları bundan türer |
| `tek-dosya.ts` | üçünün birleşiği; panelden kurarken yapıştırılır |
| `.kaynak-ozeti` | üretilen dosyalar güncel mi — testi bunu denetler |

`index.ts`, `ai/dogrula.js` ya da `ai/sema.json` değişince:

```
python3 supabase/functions/mcp/birlestir.py
```

Unutulursa `testler/mcp-sunucu.test.js` kalır.

## Kurulum (bir kez)

### 1. SQL

Supabase panel → SQL Editor → New query → `sql/39-mcp-erisimi.sql`'in
içeriğini yapıştır → Run.

Ne yapar: `api_keys` tablosunu geri getirir (sql/36 düşürmüştü),
`ai_aktarimlar`'a `key_id` ve `paket_ozeti` sütunlarını ekler. Tekrar
çalıştırılabilir.

### 2. Fonksiyon

**Panelden:** Edge Functions → Deploy a new function → Via Editor. Ad
kutusuna birebir `mcp` yaz (adres bu adı taşıyor). Editördeki dosyanın
içini sil, `tek-dosya.ts`'nin tamamını yapıştır, Deploy.

Fonksiyon ayarlarında **Verify JWT kapalı** olmalı: çağıran taraf bir
Supabase oturumu değil, bizim anahtarımızı taşıyor.

Gizli ayar eklenmez; `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY`
fonksiyona kendiliğinden gelir.

**Komut satırından:**

```
npx supabase@latest login
npx supabase link --project-ref dyemvzmpnlpnzwebuciu
npx supabase functions deploy mcp --no-verify-jwt
```

### 3. Bayrağı aç

Anahtar üretme ekranı herkese açık değil; hesabın kendi ayarında bir
bayrakla açılıyor. Kaynak kodda kimsenin e-postası geçmiyor, bayrak
veritabanında duruyor.

Supabase panel → SQL Editor:

```sql
update public.user_prefs
   set prefs = coalesce(prefs, '{}'::jsonb) || '{"mcp": true}'::jsonb
 where user_id = (select id from auth.users where email = 'BURAYA_E-POSTAN');
```

Kapatmak için `'{"mcp": false}'`.

### 4. Adresi üret

Shootboard → **☁ Hesabım** → "Claude'u takvimine bağla" →
**Bağlantı adresi oluştur**.

Adres şu biçimde çıkar ve **bir kez gösterilir**:

```
https://dyemvzmpnlpnzwebuciu.supabase.co/functions/v1/mcp/shb_...
```

Düz anahtar hiçbir yerde saklanmıyor (yalnızca SHA-256 özeti), o yüzden
geri gösterilemiyor. Kaybedersen yenisini üretirsin, eskisini iptal
edersin.

**Bu adres bir sırdır.** Anahtarı içinde taşıyor ve yazma yetkisi veriyor.
Paylaşma. Aynı ekrandaki "İptal et" onu anında geçersiz kılar.

### 5. claude.ai'a ekle

claude.ai → **Ayarlar → Connectors → Özel connector ekle** → adresi
yapıştır → ekle. OAuth alanları boş bırakılır; kimlik adresin içinde.

## Deneme

Anahtar doğru mu, kurulum tamam mı:

```
U=https://dyemvzmpnlpnzwebuciu.supabase.co/functions/v1/mcp/shb_...

curl -s $U                                   # sayılar + araç adları
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' $U
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"shootboard_list_entries","arguments":{"since":"2026-10-01","until":"2026-10-31"}}}' $U
```

Anahtarsız `GET` de çalışır; ne olduğunu ve nasıl anahtar alınacağını
söyler, veri vermez.

## Araçlar

| Araç | Ne |
|---|---|
| `shootboard_list_entries` | tarih aralığındaki kayıtlar; en çok 90 gün, sayfalamalı |
| `shootboard_list_projects` | proje adları ve kimlikleri |
| `shootboard_import` | paket yazar; aynı paket iki kez yazılmaz |
| `shootboard_update_entry` | tek kaydın alanlarını değiştirir |

**Silme aracı yok ve eklenmeyecek.** Kullanıcı kararı. Geri alma
uygulamanın kendi ekranından yapılıyor; bu fonksiyonun yazdığı defter
satırı (`ai_aktarimlar`) onu besliyor.

## Sınırlar

- Paket başına 200 öğe (`ai/sema.json` → `x-limits`).
- Hesap başına saatte 60 aktarım.
- Gövde 1.5 MB.
- `list_entries` aralığı en çok 90 gün, sayfa başına en çok 500 kayıt.

## Tekrar koruması

`shootboard_import` her pakette bir özet tutuyor: çağıran `idempotencyKey`
verdiyse o, vermediyse paketin kendisinin SHA-256'sı. Aynı özet ikinci kez
gelirse **hiçbir şey yazılmıyor**, ilk aktarımın kimlikleri `duplicate:true`
ile geri dönüyor.

Bilerek aynı içeriği ikinci kez yazmak isteyen farklı bir
`idempotencyKey` veriyor. Zaman penceresi yok: "bazen çalışan" bir koruma
korumadan kötüdür, çünkü güvenilir sanılır.

## Saat dilimi

Tarihler ve saatler kullanıcının kendi takvimindeki gibi dönüyor ve
yazılıyor. Sunucu hiçbir çevirme yapmıyor; `initialize` yanıtındaki
yönerge asistana da bunu söylüyor.
