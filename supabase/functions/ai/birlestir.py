#!/usr/bin/env python3
"""ai/sema.json -> sema.ts ; dogrula.js + sema.ts + index.ts -> tek-dosya.ts

İki iş:
1. Şema tek bir yerde durur (depo kökünde ai/sema.json; siteden de servis
   edilir). Fonksiyon GET /schema ile aynısını döndürsün diye buraya
   sema.ts olarak kopyalanır. Elle düzenlenmez.
2. Supabase panelindeki "Via Editor" yolunda ikinci bir dosya oluşturmak
   zahmetli; oradan kuran kişi tek dosya yapıştırsın diye birleşik sürüm
   üretilir. dogrula.js, index.ts ya da ai/sema.json değiştiğinde bu betik
   yeniden çalıştırılır, yoksa panele yapıştırılan sürüm eskide kalır.
"""
import io, os, json

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sema_yolu = os.path.join('..', '..', '..', 'ai', 'sema.json')
sema = json.load(io.open(sema_yolu, encoding='utf-8'))
sema_ts = ('// ai/sema.json kopyası — elle düzenleme, birlestir.py üretir.\n'
           'export const SEMA = ' + json.dumps(sema, ensure_ascii=False, indent=1) + ';\n')
io.open('sema.ts', 'w', encoding='utf-8', newline='\n').write(sema_ts)

dog = io.open('dogrula.js', encoding='utf-8').read()
idx = io.open('index.ts', encoding='utf-8').read()

# Tek dosyada modül sınırı yok: dışa aktarım sözcükleri kalkıyor.
dog = dog.replace('\nexport function ', '\nfunction ').replace('\nexport const ', '\nconst ')
if dog.startswith('export '):
    dog = dog[len('export '):]
sema_tek = sema_ts.replace('export const SEMA', 'const SEMA')

for satir in ("import { paketiCoz, basvuruCoz, kimlikUret, kimlikGecerli, tarihGecerli, adAnahtari, SINIRLAR, PROJE_ADIMLARI } from './dogrula.js';\n",
              "import { SEMA } from './sema.ts';\n"):
    assert satir in idx, 'index.ts içindeki içe aktarma satırı bulunamadı: ' + satir
    idx = idx.replace(satir, '')

baslik = """// Shootboard AI erişimi — TEK DOSYALIK sürüm.
//
// Supabase panelindeki "Via Editor" yolunda ikinci bir dosya oluşturmak
// gerekmesin diye dogrula.js, sema.ts ve index.ts bu dosyada birleştirildi.
// Panelden kuruyorsan YALNIZCA bu dosyayı yapıştır. Komut satırından
// kuruyorsan çok dosyalı sürüm kullanılır.
//
// İçeriği elle değiştirme: kaynaklar değişirse şu komutla yeniden üretilir:
//   python3 supabase/functions/ai/birlestir.py
//
"""
io.open('tek-dosya.ts', 'w', encoding='utf-8', newline='\n').write(
    baslik + '\n// ---- dogrula.js ----\n\n' + dog.rstrip() +
    '\n\n// ---- sema.ts ----\n\n' + sema_tek.rstrip() +
    '\n\n// ---- index.ts ----\n\n' + idx.lstrip())
print('sema.ts ve tek-dosya.ts yeniden üretildi')
