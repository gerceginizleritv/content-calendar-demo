// Telefonda "Giris yap" dugmesine basan kisi DOGRUDAN forma dusmeli.
// Iki sutun tek sutuna inince anlatim once geliyordu ve form ekranin
// altinda kaliyordu.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const EKRANLAR = [['iPhone SE',375,667],['iPhone 14',390,844],['Android',412,915],['iPad mini',768,1024]];

(async () => {
  const t = await chromium.launch({ });

  for (const [ad, w, h] of EKRANLAR) {
    const c = await t.newContext({ viewport:{width:w,height:h}, isMobile:true, hasTouch:true });
    const p = await c.newPage();
    await p.goto(KOK + '/index.html', { waitUntil:'networkidle' });
    console.log('[' + ad + ' ' + w + 'x' + h + ']');

    bak('sayfa yatay kaymiyor',
        (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);

    // Dar ekranda tepedeki dugmenin kisa yazisi gorunuyor.
    if (w <= 640) {
      const y = await p.$eval('.tepe-sag .dug', e => e.innerText.trim());
      bak('tepedeki dugme kisa yaziyi kullaniyor', y.length <= 12, y);
    }

    await p.click('.tepe-sag .dug');
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const sek = document.querySelector('.sekmeler').getBoundingClientRect();
      const dug = document.getElementById('kayitDug').getBoundingClientRect();
      const sol = document.querySelector('.giris-sol').getBoundingClientRect();
      const tepe = document.querySelector('header').getBoundingClientRect().height;
      return { sekUst: sek.top, sekAlt: sek.bottom, tepe,
               dugAlt: dug.bottom, ekran: innerHeight, solUst: sol.top };
    });
    bak('sekmeler yapiskan seridin altinda', r.sekUst >= r.tepe - 2, Math.round(r.sekUst) + ' / serit ' + Math.round(r.tepe));
    bak('sekmeler ekranda', r.sekAlt <= r.ekran);
    bak('"Hesap olustur" dugmesi kaydirmadan gorunuyor', r.dugAlt <= r.ekran,
        Math.round(r.dugAlt) + ' / ' + r.ekran);
    bak('anlatim formun ALTINDA', r.solUst > r.sekUst, 'anlatim ' + Math.round(r.solUst));

    // Sekme degistirmek de calisiyor.
    await p.click('#sekmeGiris');
    bak('giris sekmesi acilabiliyor', !(await p.$eval('#girisPanel', e => e.hidden)));
    const r2 = await p.evaluate(() => document.getElementById('sifreGirisDug').getBoundingClientRect().bottom);
    bak('giris dugmesi de ekranda', r2 <= r.ekran, Math.round(r2) + ' / ' + r.ekran);
    await c.close();
  }

  // Masaustunde sira DEGISMEMELI: anlatim solda, form sagda.
  const c2 = await t.newContext({ viewport:{width:1280,height:900} });
  const p2 = await c2.newPage();
  await p2.goto(KOK + '/index.html', { waitUntil:'networkidle' });
  console.log('[masaustu 1280x900]');
  const yer = await p2.evaluate(() => {
    const sol = document.querySelector('.giris-sol').getBoundingClientRect();
    const sag = document.querySelector('.giris-sag').getBoundingClientRect();
    return { solSol: sol.left, sagSol: sag.left, ustAyni: Math.abs(sol.top - sag.top) < 2 };
  });
  bak('anlatim solda, form sagda', yer.solSol < yer.sagSol);
  bak('ikisi yan yana', yer.ustAyni);

  // Uygulamanin giris penceresi telefonda kullanilabilir olmali.
  const c3 = await t.newContext({ viewport:{width:375,height:667}, isMobile:true, hasTouch:true });
  const p3 = await c3.newPage();
  await p3.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  console.log('[uygulama penceresi 375x667]');
  await p3.evaluate(() => openAuth());
  await p3.waitForSelector('#authOverlay.open');
  const m = await p3.evaluate(() => {
    const mo = document.querySelector('#authOverlay .modal');
    const r = mo.getBoundingClientRect();
    return { ekranaSigiyor: r.top >= -1 && r.bottom <= innerHeight + 1,
             yatay: mo.scrollWidth - mo.clientWidth,
             sayfaYatay: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  bak('pencere ekrana sigiyor', m.ekranaSigiyor);
  bak('pencerede yatay kaydirma yok', m.yatay <= 0, m.yatay + 'px');
  bak('sayfa yatay kaymiyor', m.sayfaYatay <= 0, m.sayfaYatay + 'px');
  await p3.evaluate(() => document.querySelector('#authOverlay .modal').scrollTop = 99999);
  await p3.waitForTimeout(200);
  const d = await p3.evaluate(() => {
    const b = document.getElementById('authKayitBtn').getBoundingClientRect();
    return { alt: b.bottom, ekran: innerHeight };
  });
  bak('"Hesap olustur" dugmesine ulasilabiliyor', d.alt <= d.ekran + 1, Math.round(d.alt) + ' / ' + d.ekran);

  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
