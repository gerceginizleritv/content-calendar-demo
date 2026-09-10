// Uygulamanin giris penceresi de kayit/giris diye ikiye ayrildi.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch({ });
  for (const tema of ['light','dark']) {
    const s = await t.newContext({ colorScheme: tema, viewport: { width: 1280, height: 900 } });
    const p = await s.newPage();
    await p.goto(KOK + '/app.html', { waitUntil: 'networkidle' });
    console.log('[' + tema + ']');
    await p.evaluate(() => openAuth());
    await p.waitForSelector('#authOverlay.open');

    bak('kayit sekmesi acilista secili', await p.$eval('#authTabKayit', e => e.classList.contains('secili')));
    bak('kayit paneli gorunur', !(await p.$eval('#authKayitPanel', e => e.hidden)));
    bak('giris paneli gizli', await p.$eval('#authGirisPanel', e => e.hidden));
    bak('kayitta "Hesap olustur" dugmesi', !(await p.$eval('#authKayitBtn', e => e.hidden)));
    bak('kayitta giris dugmeleri gizli',
        (await p.$eval('#authPassBtn', e => e.hidden)) && (await p.$eval('#authSendBtn', e => e.hidden)));

    await p.click('#authTabGiris');
    bak('giris sekmesine gecilebiliyor', !(await p.$eval('#authGirisPanel', e => e.hidden)));
    bak('giriste kayit dugmesi gizli', await p.$eval('#authKayitBtn', e => e.hidden));
    bak('giriste baglanti dugmesi gorunur', !(await p.$eval('#authSendBtn', e => e.hidden)));
    await p.click('#authTabKayit');

    const olc = async v => { await p.fill('#authKayitPass', v);
      return p.evaluate(() => ({ yazi: document.getElementById('authGucYazi').textContent,
                                 sinif: document.getElementById('authKayitPanel').className })); };
    bak('kisa sifre zayif', (await olc('abc')).sinif.includes('guc-1'));
    bak('bilindik kalip zayif', (await olc('password1')).sinif.includes('guc-1'));
    const iyi = await olc('Kadraj-2026-plan');
    bak('uzun ve karisik guclu', iyi.sinif.includes('guc-3'), iyi.yazi);
    bak('olcu yaziyla da anlatiyor', iyi.yazi.trim().length > 2, iyi.yazi);

    await p.fill('#authKayitEmail', 'deneme@ornek.com');
    await p.fill('#authKayitPass', 'abc');
    await p.click('#authKayitBtn');
    const st = await p.$eval('#authStatus', e => ({ y: e.textContent, c: e.className }));
    bak('zayif sifreyle hesap acilmiyor', st.c.includes('error') && st.y.length > 10, st.y);

    const tasma = await p.evaluate(() => {
      const m = document.querySelector('#authOverlay .modal');
      return { i: m.scrollWidth - m.clientWidth, d: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    bak('pencerede yatay kaydirma yok', tasma.i <= 0, tasma.i + 'px');
    bak('sayfada yatay kaydirma yok', tasma.d <= 0, tasma.d + 'px');
    await s.close();
  }
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
