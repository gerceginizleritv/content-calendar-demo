// TARAYICI BILDIRIMI TERCIHI CIHAZLAR ARASI TASINSIN.
//
// NEDEN BU TEST VAR
//   Kullanici istedi (16 Kasim 2026): "pc de ya da iphone da tarayici
//   bildirimi izni veren kisi her iki tarafta da bunu esitlemis
//   olmali."
//
//   ⛔ SENKRONLANAN SEY IZIN DEGIL, NIYET. Izin cihazin kendisine ait
//      ve uzaktan verilemez: bir cihazda izin vermek otekini
//      etkilemiyor, bunu hicbir tarayiciya kabul ettiremeyiz.
//      Tasinan sey "ben bildirim istiyorum" karari.
//
//   ⛔ IZIN KENDILIGINDEN ISTENMIYOR. MDN'in Notification.requestPermission
//      sayfasi: istek "kullanici etkilesimine cevaben" yapilmali.
//      Acilista sormak tarayicilarin istemedigi bir sey. O yuzden yeni
//      cihazda son adim bir dokunus olarak kaliyor: anahtar ACIK
//      geliyor, "Bildirimlere izin ver" dugmesi orada bekliyor ve
//      neden bekledigi YAZIYOR.
//
//   Bu alan 16 Kasim 2026'ya kadar BILEREK senkronlanmiyordu; gerekce
//   "calismayan bir ayari baska cihazda acik gostermek" idi. O itiraz
//   artik gecersiz: durum satiri neyin eksik oldugunu soyluyor.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8127;           // ⛔ 8097-8099 kosucunun; asla kullanma
const KOK = path.join(__dirname, '..');

(async () => {
  let gecti = 0; const hatalar = [];
  const dene = (ad, fn) => {
    try { fn(); gecti++; console.log('  ok  ' + ad); }
    catch (e) { hatalar.push(ad); console.log('  HATA ' + ad + ': ' + e.message); }
  };

  const sunucu = http.createServer((istek, cevap) => {
    const yol = istek.url.split('?')[0];
    const dosya = path.join(KOK, yol === '/' ? 'app.html' : yol.slice(1));
    fs.readFile(dosya, (hata, veri) => {
      if (hata) { cevap.writeHead(404); cevap.end(); return; }
      const u = path.extname(dosya);
      cevap.writeHead(200, { 'Content-Type':
        u === '.html' ? 'text/html; charset=utf-8' :
        u === '.js' ? 'text/javascript' : 'application/octet-stream' });
      cevap.end(veri);
    });
  });
  await new Promise(r => sunucu.listen(PORT, r));
  const tarayici = await chromium.launch();
  const p = await tarayici.newPage();
  await p.goto('http://localhost:' + PORT + '/app.html');
  await p.waitForFunction(() => typeof hatirlatmaBuluttan === 'function', { timeout: 30000 });
  await p.waitForTimeout(400);

  // ── 1. Niyet buluta GIDIYOR ───────────────────────────────────────
  const giden = await p.evaluate(() => {
    hatirlatma.tarayici = true;
    const a = tercihPrefsYap().reminders;
    hatirlatma.tarayici = false;
    const k = tercihPrefsYap().reminders;
    return { acikken: a.tarayici, kapaliyken: k.tarayici, alanVar: 'tarayici' in a };
  });
  dene('★ niyet buluta yazilan tercihte var', () => {
    assert.strictEqual(giden.alanVar, true,
      'prefs.reminders icinde tarayici alani yok: tercih hic tasinmaz');
    assert.strictEqual(giden.acikken, true);
    assert.strictEqual(giden.kapaliyken, false);
  });

  // ── 2. Buluttan gelen niyet UYGULANIYOR ───────────────────────────
  const gelen = await p.evaluate(() => {
    hatirlatma.tarayici = false;
    hatirlatmaBuluttan({ tarayici: true, takvim: false, once: true,
                         gun: false, gecikti: true, saat: '08:00' });
    const acildi = hatirlatma.tarayici;
    hatirlatma.tarayici = true;
    hatirlatmaBuluttan({ tarayici: false, takvim: false, once: true,
                         gun: false, gecikti: true });
    const kapandi = hatirlatma.tarayici;
    return { acildi, kapandi };
  });
  dene('★ buluttan ACIK gelince bu cihazda da aciliyor', () => {
    assert.strictEqual(gelen.acildi, true);
  });
  dene('buluttan KAPALI gelince kapaniyor', () => {
    assert.strictEqual(gelen.kapandi, false);
  });

  // ── 3. ESKI satirda alan yoksa yerel deger KORUNUYOR ──────────────
  // Bu alan 16 Kasim'dan once yazilmiyordu; eski satirlar onsuz.
  // Korunmasaydi, eski bir satir cihazdaki acik ayari KAPATIRDI.
  const eski = await p.evaluate(() => {
    hatirlatma.tarayici = true;
    hatirlatmaBuluttan({ takvim: false, once: true, gun: false, gecikti: true });
    const acikKaldi = hatirlatma.tarayici;
    hatirlatma.tarayici = false;
    hatirlatmaBuluttan({ takvim: false, once: true, gun: false, gecikti: true });
    const kapaliKaldi = hatirlatma.tarayici;
    return { acikKaldi, kapaliKaldi };
  });
  dene('★ eski satirda alan yoksa yereldeki deger KORUNUYOR', () => {
    assert.strictEqual(eski.acikKaldi, true,
      'eski bir bulut satiri cihazdaki ACIK ayari kapatti');
    assert.strictEqual(eski.kapaliKaldi, false);
  });

  // ── 4. Yeni cihazda NEDEN bekledigi yaziyor ───────────────────────
  const ekran = await p.evaluate(() => {
    const o = {};
    const asil = bildirimDurumu;
    bildirimDurumu = () => 'default';
    hatirlatma.tarayici = true; hatirlatmaEkraniTazele();
    o.izinDugmesi = !document.getElementById('rm_izinBtn').hidden;
    o.metinEN = document.getElementById('rm_pushDurum').textContent.trim();
    setLanguage('tr'); hatirlatmaEkraniTazele();
    o.metinTR = document.getElementById('rm_pushDurum').textContent.trim();
    // Anahtar kapaliyken hicbir sey yazmamali
    hatirlatma.tarayici = false; hatirlatmaEkraniTazele();
    o.kapaliMetin = document.getElementById('rm_pushDurum').textContent.trim();
    o.kapaliDugme = !document.getElementById('rm_izinBtn').hidden;
    bildirimDurumu = asil;
    return o;
  });
  dene('izin beklerken "izin ver" dugmesi gorunuyor', () => {
    assert.strictEqual(ekran.izinDugmesi, true);
  });
  dene('★ izin beklerken SEBEBI yaziyor (iki dilde)', () => {
    assert.ok(ekran.metinEN.length > 10, 'Ingilizce metin bos: ' + JSON.stringify(ekran.metinEN));
    assert.ok(ekran.metinTR.length > 10, 'Turkce metin bos: ' + JSON.stringify(ekran.metinTR));
    assert.notStrictEqual(ekran.metinEN, ekran.metinTR, 'iki dil ayni metni veriyor');
  });
  dene('anahtar kapaliyken ne dugme ne metin var', () => {
    assert.strictEqual(ekran.kapaliMetin, '');
    assert.strictEqual(ekran.kapaliDugme, false);
  });

  await p.close();
  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
