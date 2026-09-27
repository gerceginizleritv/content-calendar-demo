// Hosgeldin e-postasinin onizlemelerini uretir.
//
// NEDEN VAR: supabase/email/README.md "Onizlemeler onizleme/ klasorunde;
// node ile yeniden uretilebilir" diyordu ama BOYLE BIR BETIK YOKTU --
// onizlemeler elle uretilmisti. 27 Eylul 2026'da sablonlar.js'teki
// tanitim cumlesi degisti ("yayinlamaz" artik dogru degil) ve onizlemeler
// bayat kaldi. Elle uretilen her ciktinin bir gun bayatlamasi bu depoda
// alti kez yasandi; bu yuzden artik betik var.
//
//   node supabase/functions/hosgeldin/onizleme-uret.mjs
//
// Uretilen dosyalar gonderilen e-postanin KENDISI degil; tek kaynak
// sablonlar.js. Bunlar yalniz gozle bakmak icin.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hosgeldinEposta } from './sablonlar.js';

const burasi = dirname(fileURLToPath(import.meta.url));
const cikti = join(burasi, '..', '..', 'email', 'onizleme');
mkdirSync(cikti, { recursive: true });

// Adlar onizlemelerde ONCEDEN kullanilanlarla ayni tutuluyor: degisirse
// git diff'i gurultuye bogar ve gercek degisiklik gozden kacar.
const durumlar = [
  { dosya: 'hosgeldin-tr',        lang: 'tr',   ad: 'Ayşe' },
  { dosya: 'hosgeldin-en',        lang: 'en',   ad: 'Sam'  },
  { dosya: 'hosgeldin-iki-dilli', lang: 'both', ad: ''     }
];

for (const { dosya, lang, ad } of durumlar) {
  const e = hosgeldinEposta({ lang, ad });
  writeFileSync(join(cikti, dosya + '.html'), e.html, 'utf8');
  writeFileSync(join(cikti, dosya + '.txt'), 'Subject: ' + e.subject + '\n\n' + e.text, 'utf8');
  console.log('yazildi: ' + dosya + '.html + .txt');
}
