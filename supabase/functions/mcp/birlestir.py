#!/usr/bin/env python3
"""ai/ -> supabase/functions/mcp/ : doğrulayıcıyı ve şemayı kopyalar, tek
dosyalık sürümü üretir.

    python3 supabase/functions/mcp/birlestir.py

ÜÇ İŞ:

1. `ai/dogrula.js` buraya KOPYALANIR. İki ayrı doğruluk olmasın diye:
   İçe Aktar penceresi (tarayıcıda) ve MCP sunucusu (Deno'da) aynı
   doğrulayıcıyı çalıştırmalı. Burada elle düzenleme yapılmaz -- yapılırsa
   bu betik bir sonraki çalıştırmada üzerine yazar. Doğrulayıcıya bir alan
   eklemek gerekiyorsa `ai/dogrula.js` düzenlenir.

2. `ai/sema.json` -> `sema.ts`. Araçların girdi şemaları bundan türüyor.

3. Üçü birleştirilip `tek-dosya.ts` olur. Supabase panelindeki "Via Editor"
   yolunda ikinci bir dosya oluşturmak zahmetli; oradan kuran kişi tek
   dosya yapıştırsın diye.

`index.ts`, `ai/dogrula.js` ya da `ai/sema.json` değiştiğinde bu betik
yeniden çalıştırılır, yoksa panele yapıştırılan sürüm eskide kalır.
Testler bunu ayrıca denetliyor (testler/mcp-sunucu.test.js).
"""
import io, os, re, json, hashlib

os.chdir(os.path.dirname(os.path.abspath(__file__)))
KOK = os.path.join('..', '..', '..')

# --- 1) dogrula.js: kaynaktan kopya -----------------------------------------
kaynak = io.open(os.path.join(KOK, 'ai', 'dogrula.js'), encoding='utf-8').read()
uyari = ('// ai/dogrula.js KOPYASI — elle düzenleme, birlestir.py üretir.\n'
         '// Değişiklik ai/dogrula.js üzerinde yapılır: İçe Aktar penceresi ve bu\n'
         '// sunucu AYNI doğrulayıcıyı çalıştırmalı, yoksa aynı paket iki yerde\n'
         '// iki farklı sonuç verir.\n')
io.open('dogrula.js', 'w', encoding='utf-8', newline='\n').write(uyari + kaynak)

# --- 2) sema.json -> sema.ts -------------------------------------------------
sema = json.load(io.open(os.path.join(KOK, 'ai', 'sema.json'), encoding='utf-8'))
sema_ts = ('// ai/sema.json kopyası — elle düzenleme, birlestir.py üretir.\n'
           'export const SEMA = ' + json.dumps(sema, ensure_ascii=False, indent=1) + ';\n')
io.open('sema.ts', 'w', encoding='utf-8', newline='\n').write(sema_ts)

# --- 3) tek-dosya.ts ---------------------------------------------------------
dog = uyari + kaynak
idx_ham = io.open('index.ts', encoding='utf-8').read()
idx = idx_ham

# Tek dosyada modül sınırı yok: dışa aktarım sözcükleri kalkıyor.
dog = dog.replace('\nexport function ', '\nfunction ').replace('\nexport const ', '\nconst ')
if dog.startswith('export '):
    dog = dog[len('export '):]
sema_tek = sema_ts.replace('export const SEMA', 'const SEMA')

for satir in ("import { paketiCoz, basvuruCoz, kimlikUret, kimlikGecerli, tarihGecerli, adAnahtari, SINIRLAR, PROJE_ADIMLARI } from './dogrula.js';\n",
              "import { SEMA } from './sema.ts';\n"):
    assert satir in idx, 'index.ts içindeki içe aktarma satırı bulunamadı: ' + satir
    idx = idx.replace(satir, '')

baslik = """// Shootboard MCP sunucusu — TEK DOSYALIK sürüm.
//
// Supabase panelindeki "Via Editor" yolunda ikinci bir dosya oluşturmak
// gerekmesin diye dogrula.js, sema.ts ve index.ts bu dosyada birleştirildi.
// Panelden kuruyorsan YALNIZCA bu dosyayı yapıştır. Komut satırından
// kuruyorsan çok dosyalı sürüm kullanılır.
//
// İçeriği elle değiştirme: kaynaklar değişirse şu komutla yeniden üretilir:
//   python3 supabase/functions/mcp/birlestir.py
//
"""
tek = (baslik + '\n// ---- dogrula.js ----\n\n' + dog.rstrip() +
       '\n\n// ---- sema.ts ----\n\n' + sema_tek.rstrip() +
       '\n\n// ---- index.ts ----\n\n' + idx.lstrip())
io.open('tek-dosya.ts', 'w', encoding='utf-8', newline='\n').write(tek)

# --- 4) sürüm denetimi -------------------------------------------------------
# NEDEN BURADA DURUYOR. index.ts'teki SURUM, dağıtılan sürümün gerçekten
# yerine geçip geçmediğini anlamanın TEK yolu: panelden yapıştırılan kod
# sessizce eski kalabiliyor ve GET cevabı ikisinde de aynı görünüyor.
#
# Bu kural üç kez unutuldu. İlkinde eski sürüm "doğrulandı" sanıldı ve
# sorun günlerce yanlış yerde arandı. Üçüncüsünde artık söze
# bırakılmıyor: kaynak değişip sürüm aynı kalırsa bu betik DURUYOR ve
# tek-dosya.ts'i üretmiyor. Testler de tek-dosya.ts'in bayat oluşuna
# bakıyor, yani unutmanın sessiz kalacağı bir yol kalmıyor.
surum = re.search(r"const SURUM = '([^']+)'", idx_ham)
surum = surum.group(1) if surum else ''
ozet = hashlib.sha256((kaynak + sema_ts + idx_ham).encode('utf-8')).hexdigest()

onceki_ozet = onceki_surum = ''
try:
    satirlar = io.open('.kaynak-ozeti', encoding='utf-8').read().split()
    onceki_ozet = satirlar[0] if satirlar else ''
    onceki_surum = satirlar[1] if len(satirlar) > 1 else ''
except IOError:
    pass

if onceki_ozet and onceki_ozet != ozet and onceki_surum and onceki_surum == surum:
    raise SystemExit(
        "\nDURDU: kaynak degisti ama SURUM ayni kaldi (%s).\n"
        "\n"
        "index.ts'teki SURUM sabitini yukselt, sonra bu betigi tekrar\n"
        "calistir. Yukseltilmezse panele yapistirilan yeni surum ile\n"
        "eski surum AYNI cevabi verir ve dagitimin yerine gectigini\n"
        "dogrulamanin yolu kalmaz -- bu tam olarak iki kez yasandi.\n" % surum)

io.open('.kaynak-ozeti', 'w', encoding='utf-8', newline='\n').write(ozet + '\n' + surum + '\n')

print('dogrula.js, sema.ts ve tek-dosya.ts yeniden üretildi')
print('surum:', surum, '· kaynak ozeti:', ozet[:16])
