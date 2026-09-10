const { chromium } = require('./araclar');
let g=0,k=0; const ok=(a,c,e)=>{ if(c){g++;console.log('  ok  ',a);} else {k++;console.log('  YOK ',a, e===undefined?'':'→ '+e);} };
(async()=>{
  const b = await chromium.launch({ });

  // Tarayici dili Turkce olsa BILE varsayilan Ingilizce olmali
  for (const [ad, url, sec] of [
    ['uygulama (app.html)', 'http://127.0.0.1:8098/app.html', '#langSelect'],
    ['karsilama (/)',       'http://127.0.0.1:8098/',          '#dilDug']
  ]) {
    for (const tarayiciDili of ['tr-TR','en-US']) {
      const c = await b.newContext({ locale: tarayiciDili });   // TEMIZ profil
      const p = await c.newPage();
      await p.route('**/fonts.googleapis.com/**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
      await p.route('**/supabase-js**', r=>r.abort());
      await p.goto(url, { waitUntil:'domcontentloaded' });
      await p.waitForTimeout(900);
      const deger = sec === '#langSelect'
        ? await p.inputValue('#langSelect')
        : (await p.textContent('#dilDug')).trim().toLowerCase();
      ok(ad + ' · tarayici ' + tarayiciDili + ' → ingilizce', deger === 'en', deger);
      const kayit = await p.evaluate(()=>{ try{return localStorage.getItem('demo_ui_language');}catch(e){return 'HATA';} });
      ok(ad + ' · ilk acilista dil yazilmiyor mu', kayit === null || kayit === 'en', kayit);
      await c.close();
    }
  }

  // Kullanici Turkce sectiyse HATIRLANIYOR (bu dogru davranis)
  {
    const c = await b.newContext({ locale:'en-US' });
    const p = await c.newPage();
    await p.route('**/supabase-js**', r=>r.abort());
    await p.addInitScript(`try{localStorage.setItem('demo_ui_language','tr');}catch(e){}`);
    await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(900);
    ok('secilmis turkce hatirlaniyor', (await p.inputValue('#langSelect')) === 'tr');
    await c.close();
  }

  await b.close();
  console.log('\n=== gecen '+g+' / kalan '+k+' ===');
  process.exit(k?1:0);
})();
