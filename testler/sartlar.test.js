// Kullanim sartlari sayfasi ve kayit ekranindaki kabul cumlesi.
// Sol menude Projeler en ustte.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch({ });

  for (const tema of ['light','dark']) {
    const p = await (await t.newContext({ colorScheme: tema, viewport:{width:1100,height:900} })).newPage();
    const konsol = [];
    p.on('pageerror', e => konsol.push(String(e)));
    await p.goto(KOK + '/sartlar.html', { waitUntil:'networkidle' });
    console.log('[sartlar.html · ' + tema + ']');
    bak('sayfa aciliyor', (await p.title()).includes('Shootboard'), await p.title());
    bak('sayfa hatasi yok', konsol.length === 0, konsol[0]);

    const b = await p.evaluate(() => ({
      basliklar: [...document.querySelectorAll('h1')].map(x => x.textContent.trim()),
      bolum: document.querySelectorAll('h2').length,
      turkce: !!document.getElementById('turkce'),
      yatay: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    bak('iki dil de var', b.basliklar.length === 2, b.basliklar.join(' / '));
    bak('bolumler yerinde', b.bolum === 28, b.bolum + ' baslik');
    bak('turkce bolume atlanabiliyor', b.turkce);
    bak('yatay kaydirma yok', b.yatay <= 0, b.yatay + 'px');

    // Kullanicinin sordugu iki soru sayfada CEVAPLI olmali.
    const yazi = await p.evaluate(() => document.body.innerText);
    bak('"kapanirsa ne olur" cevapli', /30 gün|30 days/.test(yazi) && /kapan|shut/i.test(yazi));
    bak('"verim ne olur" cevapli', /sizin kalır|stays yours/i.test(yazi));
    bak('ucret bugun yok diyor', /ücretsiz|free/i.test(yazi) && /kart bilgisi|No card/i.test(yazi));
    bak('hesap silme anlatiliyor', /Hesabını sil|Delete your account/.test(yazi));
    bak('iletisim adresi var', yazi.includes('hello@shootboard.app'));
    bak('gizlilik sayfasina bag var', (await p.$$('a[href$="privacy.html"]')).length >= 1);

    // Kontrast: gri yazilar okunur olmali.
    const zayif = await p.evaluate(() => {
      const cz = v => { const c = v.match(/\d+/g).slice(0,3).map(Number).map(x => { x/=255; return x <= .03928 ? x/12.92 : Math.pow((x+.055)/1.055, 2.4); }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
      const zemin = cz(getComputedStyle(document.body).backgroundColor);
      const kotu = [];
      document.querySelectorAll('p,li,td,th,h1,h2,a').forEach(el => {
        if (!el.textContent.trim()) return;
        const l = cz(getComputedStyle(el).color);
        const o = (Math.max(l,zemin)+.05)/(Math.min(l,zemin)+.05);
        if (o < 4.5) kotu.push(el.tagName + ' ' + o.toFixed(2));
      });
      return kotu;
    });
    bak('yazilar okunur (4.5:1)', zayif.length === 0, zayif.slice(0,3).join(', '));
  }

  // Kayit ekraninda kabul cumlesi ve baglantilar
  for (const [ad, yol, kutu] of [['karsilama', '/index.html', '#kayitPanel'], ['uygulama', '/app.html', '#authKayitPanel']]) {
    const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
    await p.goto(KOK + yol, { waitUntil:'networkidle' });
    if (yol.endsWith('app.html')) { await p.evaluate(() => openAuth()); await p.waitForSelector('#authOverlay.open'); }
    console.log('[kabul cumlesi · ' + ad + ']');
    const c = await p.evaluate((k) => {
      const el = document.querySelector(k + ' [data-i18n-html="signup_legal"]');
      if (!el) return null;
      return { yazi: el.innerText, baglar: [...el.querySelectorAll('a')].map(a => a.getAttribute('href')) };
    }, kutu);
    bak('kabul cumlesi kayit panelinde', c !== null);
    if (c) {
      bak('sartlar baglantisi var', c.baglar.includes('sartlar.html'), c.baglar.join(', '));
      bak('gizlilik baglantisi var', c.baglar.includes('privacy.html'), c.baglar.join(', '));
      bak('cumle kabulden soz ediyor', /accept|kabul/i.test(c.yazi), c.yazi.slice(0,60));
    }
    // Dipteki bag
    bak('dipte sartlar bagi var', (await p.$$('a[href="sartlar.html"]')).length >= 1);
    await p.close();
  }

  // Sol menu sirasi
  const p3 = await (await t.newContext({ viewport:{width:1280,height:900} })).newPage();
  await p3.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  console.log('[sol menu]');
  const sira = await p3.$$eval('.rail-nav .tab', els => els.map(e => e.id));
  // Sira kullanicinin istegiyle degisti: once Fikirler, sonra Mekanlar,
  // sonra Projeler — isin akisi bu yonde.
  bak('Fikirler en ustte', sira[0] === 'tabIdeas', sira.join(' > '));
  bak('sira: fikir, mekan, proje, script, takvim, sablon',
      sira.join(',') === 'tabIdeas,tabPlaces,tabProjects,tabScripts,tabCalendar,tabTemplates',
      sira.join(' > '));
  bak('sekmeler hala calisiyor', await p3.evaluate(async () => {
    document.getElementById('tabIdeas').click();
    await new Promise(r => setTimeout(r, 200));
    return document.getElementById('tabIdeas').classList.contains('active');
  }));

  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
