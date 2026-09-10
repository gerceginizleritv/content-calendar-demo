# Testler

Shootboard tek dosyalık bir uygulama; derleme adımı yok, test çatısı da
yok. Buradaki her dosya **kendi başına çalışan bir Node betiği**: gerçek
bir tarayıcı açıyor (Playwright + Chromium), sayfayı yerel bir sunucudan
yüklüyor ve ekranda ne olduğuna bakıyor.

Her testin başında ne aradığı ve **neden** aradığı yazıyor. Çoğu, bir kez
gerçekten yaşanmış bir kusurdan doğdu.

## Çalıştırmak

```bash
./testler/kosu.sh            # hepsi (~1 saat)
./testler/kosu.sh mekan      # adında "mekan" geçenler
./testler/kosu.sh mekan sifre
```

Sonuç ekrana değil **`testler/sonuc.txt`**'ye yazılıyor; son satır kaç
tanesinin geçtiğini söylüyor. Kalan varsa o testin son 14 satırı da
dosyada duruyor.

Tek bir testi elle koşmak:

```bash
cd testler && node mekan.test.js
```

## Gerekenler

- **Node 18+**
- **Playwright ve Chromium.** Sırayla şuralara bakılıyor
  (`araclar.js`): `PLAYWRIGHT_YOLU` / `KROM_YOLU` çevre değişkenleri,
  depodaki `node_modules`, sistemdeki kurulum. Hiçbiri yoksa:
  ```bash
  npm i -D playwright && npx playwright install chromium
  ```
- **python3** — üç küçük dosya sunucusu için.

## Sunucular

`kosu.sh` üç sunucu kaldırıyor:

| Port | Ne sunuyor |
|------|------------|
| 8098 | Depo kökü — Shootboard'ın kendisi |
| 8099 | Eski lokasyon uygulaması (`index.html` → `lokasyon.html`) |
| 8097 | `testler/eski/` — eski bir anlık görüntü |

`eski/index.html` tarihsel bir kopya: birkaç test, düzeltilen bir kusurun
eski sürümde gerçekten var olduğunu kanıtlıyor. Silinmemeli.

## Argüman düzeni

Testler tek tip değil, `kosu.sh` her birine beklediğini veriyor:

- **D‑tipi** — `argv[2]` fikstür/çıktı dizini (`.`)
- **PORT‑tipi** — `argv[2]` port (varsayılan 8098)
- **HEDEF‑tipi** — `argv[2]` tam adres (varsayılan `app.html`)
- **`lok-*`** — `argv[2]` dizin, `argv[3]` port

## Fikstürler

- `satirlar.json` — eski lokasyon uygulamasından alınmış örnek satırlar
- `sahte-supabase.js` — sayfaya enjekte edilen sahte bulut istemcisi
- `eski/index.html` — eski sürüm anlık görüntüsü

## `emekli/`

Artık koşulmayan testler ve neden emekli oldukları. Silmiyoruz: biri
"bu neden test edilmiyor" diye sorduğunda cevabı burada.

## Tarayıcısız testler

`ai-erisimi-dogrula.test.js` ve `ai-erisimi-sunucu.test.js` tarayıcı açmaz:
ilki `supabase/functions/ai/dogrula.js` modülünü doğrudan koşar, ikincisi
`tek-dosya.ts`'yi bu sürece yükleyip bellekteki bir PostgREST taklidine
karşı uçları dener. TypeScript'i Node'un kendisi soyar (22.18+ / 23.6+);
daha eski Node'da `typescript@5` (transpileModule) yedek yoldur; ikisi de
yoksa test kendini atlar ve geçmiş sayılır. `typescript@7` işe yaramaz:
JS API'si yok.
