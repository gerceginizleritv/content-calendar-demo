// Hesabi kendi kendine silme. Geri donusu olmayan bir islem: dugme
// kullanici KENDI adresini yazana kadar kapali, ustune bir de onay
// penceresi var. Silme sunucuda (sql/22), tarayici yonetici yetkisi almiyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const POSTA = 'deneyici@ornek.com';

(async () => {
  const t = await chromium.launch({ });
  for (const tema of ['light','dark']) {
    const c = await t.newContext({ colorScheme: tema, viewport:{width:1280,height:900} });
    const p = await c.newPage();
    const olanlar = [];
    await p.exposeFunction('__kaydet', (x) => { olanlar.push(x); });
    await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
    console.log('[' + tema + ']');

    bak('oturum yokken dugme "Giris yap" diyor',
        !/hesab|account/i.test(await p.$eval('#authBtn', e => e.textContent)),
        await p.$eval('#authBtn', e => e.textContent));

    // Sahte oturum + rpc taklidi
    await p.evaluate((posta) => {
      session = { user: { id: '00000000-0000-4000-8000-000000000009', email: posta, app_metadata: { provider: 'email' } } };
      sb = { rpc: (ad) => { window.__kaydet('rpc:' + ad); return Promise.resolve({ error: null }); },
             auth: { signOut: () => { window.__kaydet('cikis'); return Promise.resolve({}); } } };
      refreshAuthUi();
      document.getElementById('authBtn').click();
    }, POSTA);
    await p.waitForSelector('#hesapOverlay.open');

    bak('giris yapmisken dugme "Hesabim" diyor',
        /hesab|account/i.test(await p.$eval('#authBtn', e => e.textContent)),
        await p.$eval('#authBtn', e => e.textContent));
    bak('ray uzerinde ikinci bir hesap dugmesi YOK',
        (await p.$$('#rail .rail-me button')).length === 1);
    bak('cikis penceredeki satirda', await p.$('#hesapCikisBtn') !== null);
    bak('adres pencerede yaziyor', (await p.$eval('#hesapEposta', e => e.textContent)) === POSTA);
    bak('onay etiketi adresi soyluyor', (await p.$eval('#hesapSilEtiket', e => e.textContent)).includes(POSTA));
    bak('silme dugmesi bastan KAPALI', await p.$eval('#hesapSilBtn', e => e.disabled));

    await p.fill('#hesapSilKutu', 'sil');
    bak('rastgele yaziyla acilmiyor', await p.$eval('#hesapSilBtn', e => e.disabled));
    await p.fill('#hesapSilKutu', 'baskasi@ornek.com');
    bak('baska adresle acilmiyor', await p.$eval('#hesapSilBtn', e => e.disabled));
    await p.fill('#hesapSilKutu', POSTA.toUpperCase());
    bak('kendi adresiyle aciliyor (buyuk/kucuk onemsiz)', !(await p.$eval('#hesapSilBtn', e => e.disabled)));

    // Onay penceresinde VAZGECINCE hicbir sey olmamali.
    await p.click('#hesapSilBtn');
    await p.waitForSelector('#dlgOverlay.open');
    bak('onay penceresi aciliyor', true);
    bak('onay dugmesi tehlike rengi', await p.$eval('#dlgOk', e => e.classList.contains('btn-danger')));
    await p.click('#dlgCancel');
    await p.waitForTimeout(200);
    bak('vazgecince sunucuya gidilmiyor', olanlar.length === 0, JSON.stringify(olanlar));
    

    // Onaylayinca: dogru islev, sonra cikis.
    await p.click('#hesapSilBtn');
    await p.waitForSelector('#dlgOverlay.open');
    await p.click('#dlgOk');
    await p.waitForTimeout(500);
    bak('sunucudaki hesabi_sil cagriliyor', olanlar[0] === 'rpc:hesabi_sil', JSON.stringify(olanlar));
    bak('once silinip SONRA cikis yapiliyor', olanlar.join('>') === 'rpc:hesabi_sil>cikis', olanlar.join('>'));
    await c.close();
  }

  // Google hesabinda sifre satiri gizli.
  const c2 = await t.newContext({ viewport:{width:1280,height:900} });
  const p2 = await c2.newPage();
  await p2.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  console.log('[google hesabi]');
  await p2.evaluate(() => {
    session = { user: { id: 'x', email: 'g@ornek.com', app_metadata: { provider: 'google' } } };
    refreshAuthUi();
    document.getElementById('authBtn').click();
  });
  await p2.waitForSelector('#hesapOverlay.open');
  bak('sifre satiri Google hesabinda gizli',
      await p2.$eval('#hesapSifreBtn', e => e.closest('.hesap-satir').hidden));
  bak('silme bolumu Google hesabinda da duruyor',
      !(await p2.$eval('#hesapSilBtn', e => e.closest('.hesap-tehlike').hidden)));

  // SQL calistirilmamissa anlasilir bir mesaj.
  await p2.evaluate(() => {
    sb = { rpc: () => Promise.resolve({ error: { message: 'Could not find the function public.hesabi_sil in the schema cache' } }),
           auth: { signOut: () => Promise.resolve({}) } };
  });
  await p2.fill('#hesapSilKutu', 'g@ornek.com');
  await p2.click('#hesapSilBtn');
  await p2.waitForSelector('#dlgOverlay.open');
  await p2.click('#dlgOk');
  await p2.waitForTimeout(400);
  const dz = await p2.$eval('#hesapDurum', e => ({ y: e.textContent, c: e.className }));
  bak('SQL calistirilmamissa ne yapilacagi yaziyor', /sql\/22/.test(dz.y) && dz.c.includes('error'), dz.y);
  bak('hata sonrasi dugme tekrar basilabilir', !(await p2.$eval('#hesapSilBtn', e => e.disabled)));

  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
