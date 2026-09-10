// Sifreyle giris ve sifre belirleme. Baglanti spam'e dustugunde kullanicinin
// disarida kalmamasi icin eklendi; bu deneme iki ekranin da acildigini,
// okundugunu ve uretilen sifrenin gucunu kontrol ediyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch({ });
  const s = await t.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await s.newPage();

  // --- uygulama ---
  await p.goto(KOK + '/app.html', { waitUntil: 'networkidle' });
  console.log('[app.html]');
  await p.evaluate(() => { openAuth(); authSekme(false); });
  await p.waitForSelector('#authOverlay.open');
  bak('sifre kutusu var', await p.$('#authPass') !== null);
  bak('sifre gizli basliyor', await p.$eval('#authPass', e => e.type) === 'password');
  await p.click('#authPassGoster');
  bak('Goster kutuyu aciyor', await p.$eval('#authPass', e => e.type) === 'text');
  await p.click('#authPassGoster');
  bak('tekrar basinca gizliyor', await p.$eval('#authPass', e => e.type) === 'password');

  // Bos sifre hata degil, yol ayrimi olmali.
  await p.fill('#authEmail', 'deneme@ornek.com');
  await p.click('#authPassBtn');
  const d1 = await p.$eval('#authStatus', e => ({ y: e.textContent, c: e.className }));
  bak('bos sifre baglantiya yonlendiriyor', d1.y.length > 10 && !d1.c.includes('error'), d1.y);

  const tasma = await p.evaluate(() => {
    const m = document.querySelector('#authOverlay .modal');
    return { yatay: m.scrollWidth - m.clientWidth, sayfa: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  bak('giris penceresinde yatay kaydirma yok', tasma.yatay <= 0, tasma.yatay + 'px');
  bak('sayfada yatay kaydirma yok', tasma.sayfa <= 0, tasma.sayfa + 'px');
  await p.screenshot({ path: 'giris-sifreli.png' });
  await p.evaluate(() => document.getElementById('authOverlay').classList.remove('open'));

  // --- sifre belirleme penceresi ---
  await p.evaluate(() => { document.getElementById('sifreOverlay').classList.add('open'); });
  await p.click('#sifreUret');
  const uretilen = await p.$eval('#sifreYeni', e => e.value);
  bak('uretilen sifre 16 karakter', uretilen.length === 16, String(uretilen.length));
  bak('uretilen sifre karisik', /[a-z]/.test(uretilen) && /[A-Z]/.test(uretilen) && /\d/.test(uretilen), uretilen);
  bak('karistirilan harfler yok (I l 1 O 0)', !/[Il1O0]/.test(uretilen), uretilen);
  const ikinci = await p.evaluate(() => sifreUretVer());
  bak('her seferinde farkli', ikinci !== uretilen);
  bak('olcu "guclu" diyor', (await p.$eval('#sifreOverlay', e => e.className)).includes('guc-3'));
  await p.fill('#sifreYeni', 'abc');
  bak('kisa sifre uyariyor', (await p.$eval('#sifreOverlay', e => e.className)).includes('guc-1'));
  await p.fill('#sifreYeni', uretilen);
  await p.screenshot({ path: 'sifre-belirle.png' });

  // Sifreyi sonradan degistirme yolu. Oturum yokken gorunmemeli.
  await p.goto(KOK + '/app.html', { waitUntil: 'networkidle' });
  // Sifre degistirme artik sol menudeki ayri dugmede degil, "Hesabim"
  // penceresinin icinde. Oturum yokken o pencereye girilemiyor: sol
  // menudeki dugme "Giris yap" olarak duruyor.
  bak('eski ayri sifre dugmesi kalmadi', await p.$('#railSifreBtn') === null);
  bak('oturum yokken sol menu girise cagiriyor',
      await p.$eval('#authBtn', e => e.getAttribute('data-i18n')) === 'btn_signin');
  bak('hesap penceresi kapali', !(await p.$eval('#hesapOverlay', e => e.classList.contains('open'))));
  bak('sifre satiri hesap penceresinde duruyor', await p.$('#hesapSifreBtn') !== null);
  await p.evaluate(() => { sifrePenceresiniAc(); });
  await p.waitForSelector('#sifreOverlay.open');
  bak('elle acilinca kutu bos geliyor', await p.$eval('#sifreYeni', e => e.value) === '');
  bak('elle acilinca olcu satiri bos', await p.$eval('#sifreOlcu', e => e.textContent) === '');
  await p.evaluate(() => document.getElementById('sifreOverlay').classList.remove('open'));

  // --- karsilama sayfasi ---
  await p.goto(KOK + '/index.html', { waitUntil: 'networkidle' });
  console.log('[index.html]');
  bak('giris kartinda sifre kutusu var', await p.$('#sifreAlan') !== null);
  bak('giris dugmesi var', await p.$('#sifreGirisDug') !== null);
  const tepe = await p.$eval('.tepe-sag .dug', e => ({ href: e.getAttribute('href'), y: e.textContent.trim() }));
  bak('tepedeki dugme girise gidiyor', tepe.href === '#giris', tepe.href + ' / ' + tepe.y);
  const kahraman = await p.$eval('.kahraman-dug .dug-birincil', e => e.getAttribute('href'));
  bak('kahraman dugmesi girise gidiyor', kahraman === '#giris', kahraman);
  bak('hesapsiz devam baglantisi duruyor', await p.$('a[href="app.html"]') !== null);
  const genis = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  bak('karsilama sayfasinda yatay kaydirma yok', genis <= 0, genis + 'px');
  await p.evaluate(() => document.getElementById('giris').scrollIntoView());
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'karsilama-giris.png' });

  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
