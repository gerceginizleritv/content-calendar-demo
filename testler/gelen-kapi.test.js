// Gelen kutusu (gelen/kayitlar.json) tek ve ortak bir dosya. Acik kalirsa
// deneme kullanicisinin takvimine BIZIM kayitlarimiz duser. Kutu yalnizca
// hesabin tercihlerinde gelen_kutusu bayragi olanlarda calismali.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch({ });
  const p = await (await t.newContext({ viewport:{width:1280,height:900} })).newPage();

  // Kutu dosyasi istendi mi? Istek sayilir.
  let istek = 0;
  p.on('request', r => { if (r.url().includes('gelen/kayitlar.json')) istek++; });
  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });

  const kur = (bayrak) => p.evaluate((b) => {
    // Oturum ve defter, islevin bekledigi en az kosul.
    session = { user: { id: '00000000-0000-4000-8000-000000000001', email: 'deneme@ornek.com' } };
    bulutOkumaBasarisiz = false;
    gelenAlinanOku(b === null ? null : { prefs: b });
    window.__yazilan = [];
    window.showToast = m => window.__yazilan.push(m);
  }, bayrak);

  // 1) Bayraksiz hesap: dosyaya HIC dokunulmamali.
  await kur({ lang: 'tr' });
  bak('bayraksiz hesapta kutu kapali', await p.evaluate(() => gelenKutusuAcik === false));
  istek = 0;
  await p.evaluate(() => gelenKutusunuIsle());
  await p.waitForTimeout(400);
  bak('bayraksiz hesapta dosya hic istenmiyor', istek === 0, istek + ' istek');

  // 2) Satir hic yoksa da kapali (yeni hesap).
  await kur(null);
  bak('yeni hesapta kutu kapali', await p.evaluate(() => gelenKutusuAcik === false));
  istek = 0;
  await p.evaluate(() => gelenKutusunuIsle());
  await p.waitForTimeout(400);
  bak('yeni hesapta dosya hic istenmiyor', istek === 0, istek + ' istek');

  // 3) Bayrakli hesap: kutu calisiyor.
  await kur({ lang: 'tr', gelen_kutusu: true });
  bak('bayrakli hesapta kutu acik', await p.evaluate(() => gelenKutusuAcik === true));
  istek = 0;
  await p.evaluate(() => gelenKutusunuIsle());
  await p.waitForTimeout(600);
  bak('bayrakli hesapta dosya okunuyor', istek >= 1, istek + ' istek');

  // 4) Bayrak KAYDEDILIRKEN korunuyor: tercihPrefsYap satirin tamamini
  //    yeniden yaziyor, atlanirsa ilk kaydetmede bayrak silinirdi.
  bak('bayrak yazilan tercihlerde korunuyor',
      await p.evaluate(() => tercihPrefsYap().gelen_kutusu === true));
  await kur({ lang: 'tr' });
  bak('bayraksiz hesapta tercihlere bayrak EKLENMIYOR',
      await p.evaluate(() => tercihPrefsYap().gelen_kutusu === undefined));

  // 5) Kodda e-posta ya da kullanici kimligi gomulu olmamali.
  const kaynak = await p.evaluate(() => document.documentElement.outerHTML);
  bak('kaynakta e-posta adresi gomulu degil',
      !/[a-z0-9._%+-]+@(gmail|hotmail|outlook|yahoo|icloud)\.[a-z.]+/i.test(kaynak),
      (kaynak.match(/[a-z0-9._%+-]+@(gmail|hotmail|outlook|yahoo|icloud)\.[a-z.]+/i) || [''])[0]);
  // FEEDBACK_KEY bir geri bildirim formu adresi, kullanici kimligi degil;
  // aranan sey sahibin hesap kimliginin koda gomulmus olmasi.
  const uuidler = (kaynak.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig) || [])
    .filter(x => !/FEEDBACK_KEY = '\s*/.test(x) && kaynak.indexOf("FEEDBACK_KEY = '" + x) === -1);
  bak('kaynakta kullanici kimligi gomulu degil', uuidler.length === 0, uuidler.slice(0,3).join(', '));

  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
