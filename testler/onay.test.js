// Cikis ve "kayitlari tasi" onaylari artik tarayicinin confirm() kutusuyla
// degil uygulamanin kendi penceresiyle soruluyor. Bu deneme pencerenin
// aciliyor, okunur duruyor ve yatay kaydirma cubugu cikarmiyor olmasini
// kontrol ediyor.
const { chromium } = require('./araclar');
const YOL = process.argv[2] || 'http://127.0.0.1:8098/app.html';
let gecti = 0, kaldi = 0;
function bak(ad, kosul, ek){ if(kosul){ gecti++; console.log('  ok  ' + ad); }
  else { kaldi++; console.log('  YOK ' + ad + (ek ? ' -> ' + ek : '')); } }

(async () => {
  const t = await chromium.launch({ });
  for (const tema of ['light', 'dark']) {
    const s = await t.newContext({ colorScheme: tema, viewport: { width: 1280, height: 800 } });
    const p = await s.newPage();
    let confirmCikti = false;
    p.on('dialog', async d => { confirmCikti = true; await d.dismiss(); });
    await p.goto(YOL, { waitUntil: 'networkidle' });

    console.log('[' + tema + ']');
    // Pencereyi dogrudan cagiriyoruz: oturum acmadan cikis dugmesine
    // basilamiyor, sorulan sey ise ayni pencere.
    await p.evaluate(() => { window.__cevap = onayla({
      baslik: t('auth_signout'), govde: t('auth_signed_as'),
      vurgu: 'bostancioglum@gmail.com', not: t('auth_signout_note'),
      tamam: t('auth_signout')
    }); });
    await p.waitForSelector('#dlgOverlay.open', { timeout: 3000 });

    const m = await p.$('#dlg' + 'Overlay .modal');
    const k = await m.boundingBox();
    bak('pencere ekrana sigiyor', k.width <= 440 && k.height < 400, Math.round(k.width) + 'x' + Math.round(k.height));

    const tasma = await p.evaluate(() => {
      const d = document.querySelector('#dlgOverlay .modal');
      return { yatay: d.scrollWidth - d.clientWidth, dikey: d.scrollHeight - d.clientHeight,
               govde: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    bak('pencerede yatay kaydirma yok', tasma.yatay <= 0, tasma.yatay + 'px');
    bak('pencerede dikey kaydirma yok', tasma.dikey <= 0, tasma.dikey + 'px');
    bak('sayfada yatay kaydirma yok', tasma.govde <= 0, tasma.govde + 'px');

    const yazi = await p.evaluate(() => ({
      baslik: document.getElementById('dlgTitle').textContent,
      vurgu: document.getElementById('dlgVurgu').textContent,
      not: document.getElementById('dlgNot').textContent,
      tamam: document.getElementById('dlgOk').textContent,
      vazgec: document.getElementById('dlgCancel').textContent
    }));
    bak('baslik dolu', yazi.baslik.length > 2, yazi.baslik);
    bak('e-posta gorunuyor', yazi.vurgu.includes('@'), yazi.vurgu);
    bak('aciklama var', yazi.not.length > 10);
    bak('dugmeler adlandirilmis', yazi.tamam.length > 1 && yazi.vazgec.length > 1, yazi.tamam + ' / ' + yazi.vazgec);
    bak('metin ile dugme ayni sozcugu kullaniyor',
        !/İptal|Cancel'e/.test(yazi.not), yazi.not);

    // Esc vazgecmek demek.
    await p.keyboard.press('Escape');
    bak('Esc kapatiyor', await p.evaluate(() => window.__cevap.then(v => v === false)));
    bak('kapaninca gizleniyor', !(await p.$('#dlgOverlay.open')));

    // Tamam gercekten true donuyor mu?
    await p.evaluate(() => { window.__c2 = onayla({ baslik: 'x', tamam: 'y' }); });
    await p.waitForSelector('#dlgOverlay.open');
    await p.click('#dlgOk');
    bak('Tamam true donuyor', await p.evaluate(() => window.__c2));

    bak('tarayicinin confirm kutusu acilmadi', !confirmCikti);
    await s.close();
  }
  await t.close();
  console.log('\n' + gecti + ' gecti, ' + kaldi + ' kaldi');
  process.exit(kaldi ? 1 : 0);
})();
