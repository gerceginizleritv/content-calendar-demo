# Shootboard AI erişimi

Herhangi bir yapay zekâ (ChatGPT, Claude, Gemini, bir otomasyon aracı)
kullanıcının planını, scriptlerini, fikirlerini Shootboard'a aktarabilsin ve
hesaptaki planı okuyup asistan gibi çalışabilsin diye kurulan parçalar.

Bu klasör https://shootboard.app/ai/ altında **herkese açık** servis edilir
(site depo kökünden yayınlanıyor). Buradaki dosyalar makine ve insan için;
sunucu tarafı `supabase/functions/ai/`, veritabanı `sql/35-ai-erisimi.sql`.

## İki yol

| Yol | Ne gerekir | Ne zaman |
|---|---|---|
| **Paket yapıştırma** | hiçbir şey; giriş bile şart değil | AI paketi verir, kullanıcı Shootboard'da *İçe Aktar*'a yapıştırır |
| **API anahtarı** | Hesabım → *AI erişimi* → *Yeni anahtar* | AI (Custom GPT, MCP, Zapier, kendi betiği) doğrudan yazıp okur |

İkisi de aynı paket biçimini ve aynı doğrulamayı kullanır; iki yolla gelen
öğeler aynı "AI ekledi" defterine yazılır, aynı yerden geri alınır.

## Dosyalar

| Dosya | Kim okur | Ne |
|---|---|---|
| `sema.json` | makine + AI | Paketin JSON Schema'sı (draft 2020-12). `GET /schema` da bunu döndürür. |
| `asistan-karti.md` | kullanıcı → AI | Türkçe kart: sohbetin başına yapıştırılır. Uygulamada *Kartı kopyala* düğmesi aynı metni verir. |
| `assistant-card.md` | kullanıcı → AI | Aynı kartın İngilizcesi. |
| `openapi.yaml` | Custom GPT Actions, Zapier, kod üreten AI | API'nin OpenAPI 3.1 tanımı. |
| `index.html` | kullanıcı | Kısa tanıtım sayfası: ne işe yarar, kart, bağlantılar. |

## Paket biçimi, kısaca

```json
{ "shootboard": 1, "source": "ChatGPT",
  "places": [...], "projects": [...], "entries": [...], "scripts": [...], "ideas": [...] }
```

Alan adları uygulamanın kendi modeliyle birebir (`shootDate`, `caption`,
`placeIds`...); yedek dosyasındaki Türkçe üst anahtarlar (`kayitlar`,
`projeler`, `mekanlar`, `scriptler`, `fikirler`) da kabul edilir, yani bir
Shootboard yedeği de geçerli bir pakettir. Ayrıntı: `sema.json`.

## Güvenlik modeli

- Anahtar `shb_` ile başlar, tarayıcıda üretilir, yalnızca **SHA-256
  özeti** `api_keys` tablosuna yazılır; düz metin bir kez gösterilir.
- Edge Function anahtarın özetini bulur → `user_id`; yazma ve okuma servis
  rolüyle ama **yalnızca o kullanıcının satırlarına** (her sorguda
  `user_id` süzgeci, verilen kimliklerde sahiplik denetimi).
- Anahtar hesaptan iptal edilince (`revoked_at`) anında geçersiz.
- Her `POST /import` bir `ai_aktarimlar` satırı bırakır: hangi kimlikler
  eklendi, hangileri güncellendi (önceki halleriyle). Geri alma bu satırdan.
- Hız sınırı: anahtar başına saatte 60 aktarım, pakette 200 öğe.
- Hesap silinince iki tablo da `user_id` üzerinden `hesabi_sil()` ile gider.

## Kurulum sırası

1. `sql/35-ai-erisimi.sql` → Supabase SQL Editor.
2. `supabase/functions/ai/README.md` adımlarıyla fonksiyonu dağıt
   (`--no-verify-jwt`; gizli ayar gerekmez, servis rolü Supabase'den gelir).
3. Uygulamada Hesabım → AI erişimi → Yeni anahtar.

## Sonrası (yapılmadı)

- MCP sunucusu (Claude Desktop / Claude.ai bağlayıcısı): aynı uçların
  ince bir sarmalayıcısı; anahtar yine `shb_`.
- OAuth ile "Shootboard'a bağlan" (anahtar kopyalamadan).
- `api.shootboard.app` özel alan adı (Cloudflare Worker ile yönlendirme).
