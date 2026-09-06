const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const p = await b.newPage({ viewport:{width:900,height:900}, colorScheme:'dark' });
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await p.route('**/goatcounter**', r=>r.abort());
  await p.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1400);
  for(const dil of ['en','tr']){
    const r = await p.evaluate(async (dil)=>{
      document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
      const sel = document.getElementById('langSelect');
      if(sel){ sel.value = dil; sel.dispatchEvent(new Event('change')); }
      await new Promise(r=>setTimeout(r,300));
      openModal(null,'2026-09-20');
      const lbl = [...document.querySelectorAll('#editOverlay label')].map(x=>x.textContent.trim());
      const alan = document.getElementById('f_concept');
      const et = document.querySelector('label[data-i18n="f_concept_label"]');
      return { dil, etiket: et ? et.textContent : null,
               gorunur: alan ? alan.offsetParent !== null : false,
               yerlesim: lbl.slice(0,5),
               klonDugmesiYeni: getComputedStyle(document.getElementById('cloneBtn')).display };
    }, dil);
    console.log(JSON.stringify(r,null,1));
  }
  // Mevcut kayitta klon dugmesi
  const mev = await p.evaluate(async ()=>{
    document.getElementById('editOverlay').classList.remove('open');
    openModal(events[0]);
    const b = document.getElementById('cloneBtn');
    return { metin: b.textContent, gorunur: getComputedStyle(b).display !== 'none',
             baslik: document.getElementById('modalTitle').textContent };
  });
  console.log('mevcut kayit:', JSON.stringify(mev));
  await p.screenshot({ path: process.argv[2]+'/tr-modal.png' });
  await b.close();
})();
