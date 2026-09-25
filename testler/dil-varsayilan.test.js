const { chromium } = require('./araclar');
let g=0,k=0; const ok=(a,c,e)=>{ if(c){g++;console.log('  ok  ',a);} else {k++;console.log('  YOK ',a, e===undefined?'':'→ '+e);} };

// Varsayilan dil ARTIK TARAYICIYA gore. Eskiden kosulsuz Ingilizce'ydi ve
// gerekcesi "bu bir demo" idi; uygulama kendi alan adina tasinip
// kullanicilarin cogu Turkce olunca o karar ters dustu -- Turkce bir
// tarayiciyla gelen kisi Ingilizce ekran gorup dil anahtarini ariyordu.
//
// Iki kural birlikte olculuyor:
//   1. Kayit YOKSA tarayicinin dili geliyor.
//   2. Ilk acilis localStorage'a HICBIR SEY yazmiyor. Yazsaydi "kullanici
//      secti" gibi gorunurdu: iki sayfa ayni anahtari paylasiyor, biri
//      digerinin tespitini kalici bir secime cevirirdi.
// Kullanicinin kendi secimi her ikisini de eziyor.

const SAYFALAR = [
  ['uygulama (app.html)', 'http://127.0.0.1:8098/app.html', '#langSelect'],
  ['karsilama (/)',       'http://127.0.0.1:8098/',          '#dilDug']
];
const BEKLENEN = { 'tr-TR':'tr', 'en-US':'en', 'de-DE':'en' };   // de: tanimadigimiz dil → en

(async()=>{
  const b = await chromium.launch({ });

  const dilOku = async (p, sec)=> sec === '#langSelect'
    ? await p.inputValue('#langSelect')
    : (await p.textContent('#dilDug')).trim().toLowerCase();

  const sayfaAc = async (locale, url, onceki)=>{
    const c = await b.newContext({ locale });                  // TEMIZ profil
    const p = await c.newPage();
    await p.route('**/fonts.googleapis.com/**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
    await p.route('**/supabase-js**', r=>r.abort());
    if(onceki) await p.addInitScript(`try{localStorage.setItem('demo_ui_language','${onceki}');}catch(e){}`);
    await p.goto(url, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(900);
    return { c, p };
  };

  for (const [ad, url, sec] of SAYFALAR) {
    for (const tarayiciDili of Object.keys(BEKLENEN)) {
      const { c, p } = await sayfaAc(tarayiciDili, url, null);
      const deger = await dilOku(p, sec);
      ok(ad + ' · tarayici ' + tarayiciDili + ' → ' + BEKLENEN[tarayiciDili],
         deger === BEKLENEN[tarayiciDili], deger);
      const kayit = await p.evaluate(()=>{ try{return localStorage.getItem('demo_ui_language');}catch(e){return 'HATA';} });
      ok(ad + ' · ' + tarayiciDili + ' · ilk acilista dil yazilmiyor mu', kayit === null, kayit);
      await c.close();
    }

    // Kullanicinin SECIMI tarayici dilini eziyor -- iki yonde de.
    for (const [secim, locale] of [['tr','en-US'], ['en','tr-TR']]) {
      const { c, p } = await sayfaAc(locale, url, secim);
      const deger = await dilOku(p, sec);
      ok(ad + ' · secilmis ' + secim + ' (tarayici ' + locale + ') hatirlaniyor', deger === secim, deger);
      await c.close();
    }
  }

  // Dil anahtari GORUNUR yerde mi? Eskiden sol seridin en dibindeydi ve
  // kullanici bulamiyordu; ust seride ("rail-me") tasindi.
  {
    const { c, p } = await sayfaAc('tr-TR', 'http://127.0.0.1:8098/app.html', null);
    ok('anahtar .rail-me icinde',
       await p.evaluate(()=> !!document.querySelector('.rail-me #langSelect')));
    ok('anahtar ekranda gorunuyor', await p.isVisible('#langSelect'));
    await c.close();
  }

  // Dar ekranda tam ad ("Türkçe") marka adini "Sho..." haline dusuruyordu;
  // kapali etiket KISA KODA dusuyor, acilir liste tam adlari koruyor.
  {
    const c = await b.newContext({ locale:'tr-TR', viewport:{ width:390, height:780 } });
    const p = await c.newPage();
    await p.route('**/supabase-js**', r=>r.abort());
    await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(900);
    const etiketler = await p.evaluate(()=> Array.from(document.querySelectorAll('#langSelect option')).map(o=> o.textContent));
    ok('dar ekranda kisa kod', etiketler.every(s=> s.length <= 3), etiketler.join(','));
    ok('dar ekranda anahtar yine gorunuyor', await p.isVisible('#langSelect'));
    await c.close();
  }

  await b.close();
  console.log('\n=== gecen '+g+' / kalan '+k+' ===');
  process.exit(k?1:0);
})();
