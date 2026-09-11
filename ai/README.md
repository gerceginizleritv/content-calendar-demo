# AI ile plan aktarma

Bir yapay zekâyla (ChatGPT, Claude, Gemini) plan yapıp sonucu Shootboard'a
getirmenin yolu. **Kurulum yok, anahtar yok, hesap bağlama yok.**

## Nasıl çalışıyor

1. Kullanıcı `asistan-karti.md` (ya da `assistant-card.md`) içindeki metni
   AI sohbetinin başına yapıştırır. Uygulamada da bir düğmesi var:
   Hesabım → **AI'dan gelen planlar** → *Asistan kartını kopyala*.
2. Normal konuşur: çekimler, paylaşım günleri, platformlar, metinler.
3. AI tek bir ```json bloğu verir — biçimi `sema.json`.
4. Kullanıcı o bloğu **İçe Aktar**'a yapıştırır. Önizleme çıkar; bulunamayan
   proje ve mekan adları uyarı olarak görünür.
5. Gelen her şey **AI rozeti** taşır. Hesabım'daki *Son AI aktarımları*
   listesinden **Geri al** denebilir: eklenenler silinir, güncellenenler
   eski hâline döner.

## Dosyalar

| Dosya | Ne |
|---|---|
| `asistan-karti.md` / `assistant-card.md` | sohbete yapıştırılan metin |
| `sema.json` | paketin JSON şeması |
| `dogrula.js` | paket doğrulama; tarayıcıda dinamik import ile yükleniyor, `testler/ai-erisimi-dogrula.test.js` doğrudan koşuyor |

`ai_aktarimlar` tablosu (sql/35) defteri tutuyor: rozetler ve geri alma
oradan besleniyor.

## Kaldırılan yol: API anahtarı

sql/35 bir de `shb_` API anahtarı ve bir Edge Function getirmişti; AI
hesaba doğrudan yazabiliyordu. Denemede çöktü ve **kaldırıldı** (sql/36).

Sebep teknik değildi: anahtarı bir yere **bağlamak** gerekiyordu — Custom
GPT Actions, bir otomasyon aracı ya da kendi betiğin. Sohbet pencereleri
dışarıya istek atamıyor, yani anahtarı Gemini'ye veren kullanıcı hiçbir
şey olmadığını görüyordu. Shootboard'un kullanıcısı yazılımcı değil; ona
kurulum işi yaptıran bir yol, yol değildir.

Yapıştırma yolu bunun tam tersi: hiçbir şey kurulmuyor, İçe Aktar
penceresinin içinde duruyor, önizlemeli ve geri alınabilir.
