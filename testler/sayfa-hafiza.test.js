// Yenileyince ayni sayfada kalinmali.
const { chromium } = require('./araclar');
const HEDEF = process.argv[2] || 'http://127.0.0.1:8098/app.html';
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:900} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto(HEDEF,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  console.log('SAYFA HAFIZASI');
  for (const [ad, sayfa] of [['Fikirler','ideas'],['Scriptler','scripts'],['Takvim','calendar'],['Şablonlar','templates'],['Projeler','projects']]) {
    await page.evaluate(s=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage(s); }, sayfa);
    await page.waitForTimeout(120);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1300);
    const acik = await page.evaluate(()=>{
      document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
      const g = ['ideasPage','scriptsPage','projectsPage','calendarPage','templatesPage'].find(x=>!document.getElementById(x).hidden);
      const sekme = document.querySelector('.tab.active');
      return { sayfa:g, sekme: sekme && sekme.id };
    });
    const bekle = { ideas:'ideasPage', scripts:'scriptsPage', calendar:'calendarPage', templates:'templatesPage', projects:'projectsPage' }[sayfa];
    k(ad + ' sayfasında yenileyince orada kalıyor', acik.sayfa === bekle, acik);
  }
  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
