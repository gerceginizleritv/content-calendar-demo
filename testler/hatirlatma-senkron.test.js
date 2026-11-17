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
//   ⚠ 17 KASIM 2026'DA DEGISTI -- YUKARIDAKI SATIRIN ESKI HALI
//      "izin kendiliginden ISTENMIYOR" diyordu. Kullanici "denensin,
//      acilista kendiliginden sorulsun" dedi ve `otoIzinIste()`
//      eklendi (5. bolum olcuyor).
//
//   ⛔ AMA GEREKCE SILINMEDI, CUNKU HALA GECERLI: MDN'in
//      Notification.requestPermission sayfasi istegin "kullanici
//      etkilesimine cevaben" yapilmasi gerektigini yaziyor, yani
//      istek sessizce reddedilebilir. Bu yuzden kendiliginden istek
//      EK BIR SANS olarak kuruldu, TEK YOL olarak degil: anahtar ACIK
//      geliyor, "Bildirimlere izin ver" dugmesi orada bekliyor ve
//      neden bekledigi YAZIYOR (4. bolum). Istek ise yaramazsa
//      kullanici yolu kapanmiyor.
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
        // ⛔ .css BURADA OLMAK ZORUNDA. Tarayici stil sayfasini YANLIS
        //   MIME turuyle gelirse REDDEDIYOR: sayfa boyasiz aciliyor,
        //   butun `var(--…)` degerleri bos cozuluyor ve olcum sessizce
        //   yanlis sonuc veriyor. 16 Kasim 2026'da tam bu oldu --
        //   kilavuz sayfalari `marka.css` yukluyor, test onu
        //   `application/octet-stream` diye servis etti ve telefonda
        //   "vurgu gorunmuyor" diye VAR OLMAYAN bir hata bildirdi.
        //   (app.html dis stil sayfasi yuklemiyor, o yuzden ona bakan
        //   testler etkilenmemisti -- ama bir gun yuklerse etkilenir.)
        u === '.html' ? 'text/html; charset=utf-8' :
        u === '.css'  ? 'text/css; charset=utf-8' :
        u === '.js'   ? 'text/javascript' :
        u === '.json' ? 'application/json' :
        u === '.svg'  ? 'image/svg+xml' :
        u === '.webp' ? 'image/webp' :
        u === '.png'  ? 'image/png' :
        u === '.woff2'? 'font/woff2' : 'application/octet-stream' });
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

  // ── 5. ACILISTA KENDILIGINDEN IZIN ISTEME ─────────────────────────
  // Kullanici karari (17 Kasim 2026): "Denensin: acilista
  // kendiliginden sorulsun."
  //
  // ⛔ BU TEST TARAYICI POLITIKASINI OLCMUYOR, OLCEMEZ. Headless
  //    tarayicida izin penceresi diye bir sey yok; olculen sey
  //    `otoIzinIste()`in NE ZAMAN sordugu, ne zaman SUSTUGU ve KAC KEZ
  //    sordugu. Gercek tarayicinin pencereyi gosterip gostermedigi
  //    kullanicinin kendi cihazinda dogrulanacak.
  const oto = await p.evaluate(async () => {
    const asilDurum = bildirimDurumu, asilIste = bildirimIzniIste;
    const asilAbone = pushAboneOl, asilIos = pushIosEngeli;
    let kacKezSoruldu = 0, kacKezAboneOldu = 0, cevap = 'default';
    bildirimIzniIste = async () => { kacKezSoruldu++; return cevap; };
    pushAboneOl = async () => { kacKezAboneOldu++; return 'ok'; };
    pushIosEngeli = () => false;
    const sifirla = () => { kacKezSoruldu = 0; kacKezAboneOldu = 0;
      try { localStorage.removeItem('demo_izin_soruldu'); } catch (e) {} };
    const o = {};

    // niyet KAPALI -> sorulmaz
    sifirla(); bildirimDurumu = () => 'default'; hatirlatma.tarayici = false;
    o.niyetKapali = { sonuc: await otoIzinIste(), kac: kacKezSoruldu };

    // izin ZATEN VERILMIS -> sorulmaz (gereksiz)
    sifirla(); bildirimDurumu = () => 'granted'; hatirlatma.tarayici = true;
    o.izinVar = { sonuc: await otoIzinIste(), kac: kacKezSoruldu };

    // izin REDDEDILMIS -> sorulmaz (sormak hicbir sey yapmaz)
    sifirla(); bildirimDurumu = () => 'denied';
    o.izinYok = { sonuc: await otoIzinIste(), kac: kacKezSoruldu };

    // iOS, ana ekrana EKLENMEMIS -> sorulmaz (push zaten calismiyor)
    sifirla(); bildirimDurumu = () => 'default'; pushIosEngeli = () => true;
    o.ios = { sonuc: await otoIzinIste(), kac: kacKezSoruldu };
    pushIosEngeli = () => false;

    // ASIL DURUM: niyet acik + izin 'default' -> BIR KEZ soruluyor
    sifirla();
    o.ilk = { sonuc: await otoIzinIste(), kac: kacKezSoruldu };
    // Ayni cihazda IKINCI cagri -> tekrar sormuyor
    o.ikinci = { sonuc: await otoIzinIste(), kac: kacKezSoruldu };
    // Iki cagri UST USTE dusse de (acilis + buluttan niyet) iki pencere
    // acilmamali: isaret await'ten once konuyor.
    sifirla();
    const ikisi = await Promise.all([otoIzinIste(), otoIzinIste()]);
    o.ustUste = { kac: kacKezSoruldu, sonuclar: ikisi };

    // IZIN VERILIRSE abonelik aciliyor
    sifirla(); cevap = 'granted';
    o.verildi = { sonuc: await otoIzinIste(), abone: kacKezAboneOldu };

    // Isaret BULUTA yazilmiyor: "sordum mu" cihaza ait, niyet degil
    hatirlatma.tarayici = true;
    o.bulutAlanlari = Object.keys(tercihPrefsYap().reminders);

    bildirimDurumu = asilDurum; bildirimIzniIste = asilIste;
    pushAboneOl = asilAbone; pushIosEngeli = asilIos;
    return o;
  });

  dene('niyet KAPALIYKEN izin sorulmuyor', () => {
    assert.strictEqual(oto.niyetKapali.kac, 0);
    assert.strictEqual(oto.niyetKapali.sonuc, 'niyet kapali');
  });
  dene('izin ZATEN VERILMISSE sorulmuyor', () => {
    assert.strictEqual(oto.izinVar.kac, 0);
    assert.strictEqual(oto.izinVar.sonuc, 'karar verilmis');
  });
  dene('izin REDDEDILMISSE sorulmuyor', () => {
    assert.strictEqual(oto.izinYok.kac, 0,
      'reddedilmis izin yeniden soruldu: hicbir sey yapmaz, kullaniciyi rahatsiz eder');
  });
  dene('iOS ana ekrana eklenmemisse sorulmuyor', () => {
    assert.strictEqual(oto.ios.kac, 0);
    assert.strictEqual(oto.ios.sonuc, 'ios');
  });
  dene('★ niyet ACIK + izin bekliyorsa BIR KEZ soruluyor', () => {
    assert.strictEqual(oto.ilk.kac, 1, 'acilista hic sorulmadi');
  });
  dene('★ CIHAZ BASINA BIR KEZ: ikinci acilista sormuyor', () => {
    assert.strictEqual(oto.ikinci.kac, 1,
      'her acilista soruyor: kullaniciya saldirgan gelir ve tarayici cezalandirir');
    assert.strictEqual(oto.ikinci.sonuc, 'zaten soruldu');
  });
  dene('★ iki cagri UST USTE dusse de tek pencere', () => {
    assert.strictEqual(oto.ustUste.kac, 1,
      'acilis ve buluttan niyet ust uste dusunce iki kez soruldu: ' +
      JSON.stringify(oto.ustUste.sonuclar));
  });
  dene('izin verilince abonelik aciliyor', () => {
    assert.strictEqual(oto.verildi.sonuc, 'granted');
    assert.strictEqual(oto.verildi.abone, 1,
      'izin alindi ama abone olunmadi: bildirim yine gelmez');
  });
  dene('★ "soruldu" isareti BULUTA yazilmiyor', () => {
    assert.ok(!oto.bulutAlanlari.includes('izinSoruldu'),
      'isaret buluta gitti: yeni cihazda "zaten soruldu" sanilir ve HIC sorulmaz');
    assert.ok(oto.bulutAlanlari.includes('tarayici'),
      'niyet alani kayboldu: ' + JSON.stringify(oto.bulutAlanlari));
  });

  await p.close();
  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
