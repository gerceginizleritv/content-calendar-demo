// Kayit ve giris ayri sekmeler. Zayif sifre kabul edilmiyor, guc gostergesi
// yaziyla da anlatiyor (renk tek basina yeterli degil).
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch({ });
  for (const tema of ['light','dark']) {
    const s = await t.newContext({ colorScheme: tema, viewport: { width: 1280, height: 900 } });
    const p = await s.newPage();
    await p.goto(KOK + '/index.html', { waitUntil: 'networkidle' });
    console.log('[' + tema + ']');

    bak('kayit sekmesi acilista secili', await p.$eval('#sekmeKayit', e => e.classList.contains('secili')));
    bak('kayit paneli gorunur', !(await p.$eval('#kayitPanel', e => e.hidden)));
    bak('giris paneli gizli', await p.$eval('#girisPanel', e => e.hidden));
    bak('kayitta Google var', await p.$('#googleKayitDug') !== null);
    bak('giriste Google var', await p.$('#googleDug') !== null);

    await p.click('#sekmeGiris');
    bak('sekme degisiyor', await p.$eval('#girisPanel', e => !e.hidden) && await p.$eval('#kayitPanel', e => e.hidden));
    await p.click('#sekmeKayit');

    // Guc gostergesi
    const olc = async (v) => {
      await p.fill('#kSifre', v);
      await p.waitForTimeout(260);   // width gecisi bitsin
      return p.evaluate(() => ({
        yazi: document.getElementById('kGucYazi').textContent,
        sinif: document.getElementById('kayitPanel').className,
        genislik: getComputedStyle(document.getElementById('kGucDolgu')).width
      }));
    };
    const a = await olc('abc');
    bak('kisa sifre uyariyor', a.yazi.length > 5 && a.sinif.includes('guc-1'), a.yazi);
    const b = await olc('sifre123');
    bak('bilindik kalip zayif sayiliyor', b.sinif.includes('guc-1'), b.yazi);
    const c = await olc('aaaaaaaaaaaa');
    bak('tek harf tekrari zayif', c.sinif.includes('guc-1'), c.yazi);
    const d = await olc('Kadraj2026!');
    bak('orta sifre kabul araliginda', d.sinif.includes('guc-2'), d.yazi);
    const e = await olc('Kadraj-2026-plan!');
    bak('uzun ve karisik guclu', e.sinif.includes('guc-3'), e.yazi);
    bak('guc yazisi bos degil', e.yazi.trim().length > 2, e.yazi);
    bak('cubuk doluyor', e.genislik !== '0px', e.genislik);

    // Zayif sifreyle kayit denemesi engelleniyor.
    await p.fill('#kEposta', 'deneme@ornek.com');
    await p.fill('#kSifre', 'abc');
    await p.click('#kayitDug');
    const dr = await p.evaluate(() => ({ y: document.getElementById('girisDurum').textContent,
                                         gizli: document.getElementById('girisDurum').hidden,
                                         dugme: document.getElementById('kayitDug').disabled }));
    bak('zayif sifre reddediliyor', !dr.gizli && dr.y.length > 10, dr.y);
    bak('dugme kilitlenmiyor', dr.dugme === false);

    // Gecerli e-posta kontrolu
    await p.fill('#kEposta', 'bozuk');
    await p.fill('#kSifre', 'Kadraj-2026-plan!');
    await p.click('#kayitDug');
    bak('bozuk e-posta yakalaniyor', (await p.$eval('#girisDurum', e => e.className)).includes('hata'));

    const tasma = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    bak('yatay kaydirma yok', tasma <= 0, tasma + 'px');
    await s.close();
  }
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
