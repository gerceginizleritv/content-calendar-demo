// Denetim diyagramlarini PNG'ye cevirir.
//
//   node denetim/uret.js
//
// ⚠ NEDEN KAYNAK HTML DURUYOR: denetim BIR KEZLIK DEGIL. YouTube
// periyodik yeniden denetim yapiyor ve o gun diyagramin guncel hali
// isteniyor. Yalnizca PNG saklasaydik, bir kutu degistirmek icin
// diyagrami sifirdan cizmek gerekirdi.
//
// ⚠ 1600x980 SECILDI: formun kalite sarti "en az 1280x720". Daha
// buyugunu kucultmek serbest, kucugunu buyutmek degil.
const yol = require('path');
const { chromium } = require(yol.join(__dirname, '..', 'testler', 'araclar'));

const ISLER = [
  { kaynak: 'mimari.html', cikti: 'shootboard-architecture-diagram.png', en: 1600, boy: 980 },
  { kaynak: 'akis.html',   cikti: 'shootboard-user-flow-diagram.png',   en: 1600, boy: 900 }
];

(async () => {
  const t = await chromium.launch();
  for (const is of ISLER) {
    const c = await t.newContext({
      viewport: { width: is.en, height: is.boy },
      // ⚠ 2x: formda metnin "clear, readable, no blur" olmasi isteniyor
      // ve 1x PNG'de kucuk punto yaziler yayiliyor.
      deviceScaleFactor: 2
    });
    const p = await c.newPage();
    await p.goto('file://' + yol.join(__dirname, is.kaynak), { waitUntil: 'load' });
    // Yazi tipleri yerine oturmadan cekmek, satirlarin kaymasi demek.
    await p.evaluate(() => document.fonts && document.fonts.ready);
    await p.waitForTimeout(250);
    await p.screenshot({ path: yol.join(__dirname, is.cikti), clip: { x: 0, y: 0, width: is.en, height: is.boy } });
    await c.close();
    console.log('  ' + is.cikti + '  (' + (is.en * 2) + 'x' + (is.boy * 2) + ')');
  }
  await t.close();
})().catch(e => { console.error(e); process.exit(1); });
