// Buyuk harf, rakam ve ozel isaret zorunlu. Ekrandaki liste hangisinin
// eksik oldugunu gosteriyor; hepsi tamamlanmadan hesap acilmiyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const DURUMLAR = [
  ['kadrajplan',        { uzunluk:1, buyuk:0, rakam:0, isaret:0 }, 1],
  ['Kadrajplan',        { uzunluk:1, buyuk:1, rakam:0, isaret:0 }, 1],
  ['Kadrajplan1',       { uzunluk:1, buyuk:1, rakam:1, isaret:0 }, 1],
  ['Kadraj1!',          { uzunluk:1, buyuk:1, rakam:1, isaret:1 }, 2],
  ['Kadraj-2026-plan!', { uzunluk:1, buyuk:1, rakam:1, isaret:1 }, 3],
  ['Ka1!',              { uzunluk:0, buyuk:1, rakam:1, isaret:1 }, 1],
  ['Password1!',        { uzunluk:1, buyuk:1, rakam:1, isaret:1 }, 1]  // bilindik kalip
];

async function kutuyuDene(p, kutu, listeId, yaziId, kapId){
  await p.click(kutu);   // kural listesi odakla aciliyor
  for (const [sifre, bek, guc] of DURUMLAR) {
    await p.fill(kutu, sifre);
    const c = await p.evaluate(([l, y, kp]) => {
      const im = {};
      [...document.getElementById(l).children].forEach(li => { im[li.dataset.k] = li.classList.contains('tamam') ? 1 : 0; });
      return { im, yazi: document.getElementById(y).textContent,
               sinif: document.getElementById(kp).className };
    }, [listeId, yaziId, kapId]);
    const uyum = Object.keys(bek).every(x => c.im[x] === bek[x]);
    bak('"' + sifre + '" tikleri dogru', uyum, JSON.stringify(c.im));
    bak('"' + sifre + '" gucu ' + guc, c.sinif.includes('guc-' + guc), c.sinif + ' | ' + c.yazi);
    bak('"' + sifre + '" tek satirlik aciklama var', c.yazi.trim().length > 3, c.yazi);
  }
}

(async () => {
  const t = await chromium.launch({ });
  const s = await t.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await s.newPage();

  console.log('[karsilama sayfasi]');
  await p.goto(KOK + '/index.html', { waitUntil: 'networkidle' });
  await kutuyuDene(p, '#kSifre', 'kKurallar', 'kGucYazi', 'kayitPanel');
  await p.fill('#kEposta', 'deneme@ornek.com');
  await p.fill('#kSifre', 'Kadrajplan1');   // isaret eksik
  await p.click('#kayitDug');
  bak('isaretsiz sifreyle hesap acilmiyor',
      (await p.$eval('#girisDurum', e => e.className)).includes('hata'),
      await p.$eval('#girisDurum', e => e.textContent));

  console.log('[uygulama · kayit]');
  await p.goto(KOK + '/app.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => openAuth());
  await p.waitForSelector('#authOverlay.open');
  await kutuyuDene(p, '#authKayitPass', 'authKurallar', 'authGucYazi', 'authKayitPanel');
  await p.fill('#authKayitEmail', 'deneme@ornek.com');
  await p.fill('#authKayitPass', 'Kadrajplan1');
  await p.click('#authKayitBtn');
  bak('isaretsiz sifreyle hesap acilmiyor (uygulama)',
      (await p.$eval('#authStatus', e => e.className)).includes('error'));
  await p.evaluate(() => document.getElementById('authOverlay').classList.remove('open'));

  console.log('[uygulama · sifre belirle]');
  await p.evaluate(() => { sifrePenceresiniAc(); });
  await p.waitForSelector('#sifreOverlay.open');
  await kutuyuDene(p, '#sifreYeni', 'sifreKurallar', 'sifreOlcu', 'sifreOverlay');
  await p.fill('#sifreYeni', 'Kadrajplan1');
  await p.click('#sifreKaydet');
  bak('isaretsiz sifre kaydedilmiyor',
      (await p.$eval('#sifreDurum', e => e.className)).includes('error'));

  // Uretici kendi kurallarimizi saglamali.
  for (let i = 0; i < 40; i++) {
    const u = await p.evaluate(() => sifreUretVer());
    if (!(u.length === 16 && /[A-Z]/.test(u) && /[a-z]/.test(u) && /[0-9]/.test(u) && /[^A-Za-z0-9]/.test(u))) {
      bak('uretilen sifre her seferinde kurallara uyuyor', false, u); break;
    }
    if (i === 39) bak('uretilen sifre 40 denemede de kurallara uyuyor', true);
  }
  await p.click('#sifreUret');
  bak('Uret dugmesi guclu sonuc veriyor', (await p.$eval('#sifreOverlay', e => e.className)).includes('guc-3'));
  bak('Uret sonrasi dort tik da dolu',
      await p.$eval('#sifreKurallar', e => [...e.children].every(li => li.classList.contains('tamam'))));

  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
