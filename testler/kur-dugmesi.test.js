// "TELEFONA KUR" DUGMESI: ne zaman gorunur, ne zaman gorunmez.
//
// ⛔ OLU DUGME OLMAZ. Dugme yalnizca gercekten bir sey yapabiliyorsa
//    aciliyor. Bu dosyanin isi o kapiyi olcmek.
//
// Tarayici destegi (kaynaktan dogrulandi, 15 Kasim 2026):
//   Chrome · Edge 79+ · Samsung Internet 8.2+  -> beforeinstallprompt var
//   Safari (iPhone/iPad/Mac) · Firefox         -> YOK
//   iOS'ta butun tarayicilar Safari motorunu kullandigi icin
//   iPhone'daki Chrome da yok -> orada TARIF gosteriliyor.
//
// ⚠ Playwright'in Chromium'u beforeinstallprompt'u KENDILIGINDEN
//   uretmiyor (gercek kurulabilirlik denetimi istiyor). O yuzden olay
//   testte ELLE tetikleniyor: olculen sey tarayicinin karari degil,
//   BIZIM dugmemizin o olaya dogru tepki verip vermedigi.
const { chromium } = require('./araclar');

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

(async () => {
  const b = await chromium.launch({ });
  let gecen = 0, kalan = 0;
  const bak = (ad, kosul, ek) => {
    if (kosul) { gecen++; console.log('  ok  ' + ad); }
    else { kalan++; console.log('  YOK ' + ad + (ek !== undefined ? ' → ' + JSON.stringify(ek) : '')); }
  };

  async function sayfa(secenek = {}) {
    const c = await b.newContext(Object.assign({ viewport:{width:1440,height:900} }, secenek));
    const p = await c.newPage();
    await p.addInitScript(()=>{ try{
      localStorage.setItem('demo_ui_language','tr');
      localStorage.setItem('demo_ornek_kaldirildi','1');
    }catch(e){} });
    await p.route('**/supabase-js**', r=>r.abort());
    await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1500);
    const atla = await p.$('#tourSkip'); if (atla) { await atla.click(); await p.waitForTimeout(400); }
    for (let i=0;i<3;i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(120); }
    return { c, p };
  }
  const gorunur = (p, sec) => p.evaluate(s=>{
    const e = document.querySelector(s);
    if(!e) return null;
    return !e.hidden && e.getBoundingClientRect().height > 0;
  }, sec);

  // 1. Kurulabilirlik ISARETI YOKKEN dugme gizli. Playwright'in
  //    Chromium'u olayi uretmiyor, yani bu masaustu Firefox'un da
  //    durumu: gosterilecek bir sey yok -> dugme yok.
  {
    const { c, p } = await sayfa();
    bak('isaret yokken dugme GIZLI', (await gorunur(p, '#kurBtn')) === false);
    bak('isaret yokken aciklama da GIZLI', (await gorunur(p, '#kurNot')) === false);
    await c.close();
  }

  // 2. beforeinstallprompt gelince dugme ACILIYOR.
  {
    const { c, p } = await sayfa();
    await p.evaluate(()=>{
      const olay = new Event('beforeinstallprompt');
      olay.prompt = ()=>{};
      olay.userChoice = Promise.resolve({ outcome:'dismissed' });
      window.dispatchEvent(olay);
    });
    await p.waitForTimeout(250);
    bak('beforeinstallprompt gelince dugme GORUNUR', (await gorunur(p, '#kurBtn')) === true);
    bak('aciklama da GORUNUR', (await gorunur(p, '#kurNot')) === true);
    bak('masaustunde etiket "Bilgisayara kur"',
        (await p.textContent('#kurBtn')).includes('Bilgisayara kur'),
        await p.textContent('#kurBtn'));

    // 3. Kurulum bitince dugme KAYBOLUYOR.
    await p.evaluate(()=> window.dispatchEvent(new Event('appinstalled')));
    await p.waitForTimeout(250);
    bak('appinstalled sonrasi dugme GIZLI', (await gorunur(p, '#kurBtn')) === false);
    await c.close();
  }

  // 4. iPhone: olay hic gelmese de TARIF gosterilecegi icin dugme var.
  {
    const { c, p } = await sayfa({ userAgent: IPHONE_UA, viewport:{width:390,height:844},
                                   isMobile:true, hasTouch:true });
    // Telefonda dugme yan seritte DEGIL, "⋯" cekmecesinde.
    const mobilVar = await p.evaluate(()=>{
      const e = document.getElementById('kurBtnMobil');
      return !!e && !e.hidden;
    });
    bak('iPhone: cekmecedeki dugme ACIK', mobilVar === true);
    bak('iPhone: etiket "Telefona kur"',
        (await p.textContent('#kurBtnMobil')).includes('Telefona kur'),
        await p.textContent('#kurBtnMobil'));
    await c.close();
  }

  // 5. ZATEN KURULUYSA dugme gizli. standalone kipi taklit ediliyor.
  {
    const c = await b.newContext({ viewport:{width:1440,height:900} });
    const p = await c.newPage();
    await p.addInitScript(()=>{
      try{ localStorage.setItem('demo_ui_language','tr'); }catch(e){}
      // matchMedia'yi standalone diyecek sekilde sarmala
      const asil = window.matchMedia.bind(window);
      window.matchMedia = (q)=> (q === '(display-mode: standalone)')
        ? { matches:true, media:q, addListener(){}, removeListener(){},
            addEventListener(){}, removeEventListener(){}, onchange:null, dispatchEvent(){return false;} }
        : asil(q);
    });
    await p.route('**/supabase-js**', r=>r.abort());
    await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1500);
    const atla = await p.$('#tourSkip'); if (atla) await atla.click();
    for (let i=0;i<3;i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(120); }
    await p.evaluate(()=>{
      const olay = new Event('beforeinstallprompt');
      olay.prompt = ()=>{}; olay.userChoice = Promise.resolve({ outcome:'dismissed' });
      window.dispatchEvent(olay);
    });
    await p.waitForTimeout(250);
    bak('zaten kuruluyken dugme GIZLI (olay gelse bile)',
        (await gorunur(p, '#kurBtn')) === false);
    await c.close();
  }

  // 6. ACILISTA KENDILIGINDEN ACILAN PENCERE EKLENMEDI.
  {
    const { c, p } = await sayfa();
    const acikSayisi = await p.evaluate(()=> document.querySelectorAll('.overlay.open').length);
    bak('acilista kendiliginden acilan pencere yok', acikSayisi === 0, acikSayisi);
    await c.close();
  }

  await b.close();
  console.log('\n=== gecen ' + gecen + ' / kalan ' + kalan + ' ===');
  process.exit(kalan ? 1 : 0);
})();
