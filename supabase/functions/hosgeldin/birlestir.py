#!/usr/bin/env python3
"""index.ts + sablonlar.js -> tek-dosya.ts

Supabase panelindeki "Via Editor" yolunda ikinci bir dosya oluşturmak
zahmetli; oradan kuran kişi tek dosya yapıştırsın diye bu birleşik sürüm
üretiliyor. index.ts ya da sablonlar.js değiştiğinde bu betik yeniden
çalıştırılır, yoksa panele yapıştırılan sürüm eskide kalır.
"""
import io, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sab = io.open('sablonlar.js', encoding='utf-8').read()
idx = io.open('index.ts', encoding='utf-8').read()

# Tek dosyada modül sınırı yok: dışa aktarım sözcükleri kalkıyor.
sab = sab.replace('\nexport function ', '\nfunction ')
if sab.startswith('export function '):
    sab = sab[len('export '):]

satir = "import { hosgeldinEposta } from './sablonlar.js';\n"
assert satir in idx, 'index.ts içindeki içe aktarma satırı bulunamadı'
idx = idx.replace(satir, '')

baslik = """// Hoşgeldin e-postası — TEK DOSYALIK sürüm.
//
// Supabase panelindeki "Via Editor" yolunda ikinci bir dosya oluşturmak
// gerekmesin diye index.ts ile sablonlar.js bu dosyada birleştirildi.
// Panelden kuruyorsan YALNIZCA bu dosyayı yapıştır; index.ts ve sablonlar.js'e
// dokunma. Komut satırından kuruyorsan iki dosyalı sürüm kullanılır.
//
// İçeriği elle değiştirme: index.ts ya da sablonlar.js değişirse bu dosya
// şu komutla yeniden üretilir:
//   python3 supabase/functions/hosgeldin/birlestir.py
//
"""
io.open('tek-dosya.ts', 'w', encoding='utf-8', newline='\n').write(
    baslik + '\n// ---- sablonlar.js ----\n\n' + sab.rstrip() +
    '\n\n// ---- index.ts ----\n\n' + idx.lstrip())
print('tek-dosya.ts yeniden üretildi')
