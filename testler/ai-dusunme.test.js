const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  const govdeler = [];
  await page.route('**generativelanguage.googleapis.com**', async r=>{
    if(r.request().method() === 'GET'){
      return r.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({models: ['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'].map(n=>({name:'models/'+n}))})});
    }
    govdeler.push(JSON.parse(r.request().postData()));
    await r.fulfill({status:200,contentType:'application/json',
      body: JSON.stringify({candidates:[{content:{parts:[{text:'tamam'}]}}]})});
  });
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
  console.log('DÜŞÜNME SEVİYESİ İSTEKTE GİDİYOR MU');

  await page.click('#aiSettingsBtn');
  await page.waitForTimeout(200);
  await page.fill('#ai_key','AQ.TESTANAHTARI_123456');
  await page.click('#aiSettingsSaveBtn');
  await page.waitForTimeout(700);
  const g1 = govdeler[0] || {};
  const tc = ((g1.generationConfig||{}).thinkingConfig)||{};
  k('anahtar denemesinde düşünme seviyesi gidiyor', tc.thinkingLevel === 'low', tc);
  k('anahtar denemesinde çıktı sınırı var', (g1.generationConfig||{}).maxOutputTokens === 32, (g1.generationConfig||{}).maxOutputTokens);
  k('anahtar kaydedildi', await page.evaluate(()=>!!JSON.parse(localStorage.getItem('demo_ai_settings')||'null')));

  // Script uretimi de dusuk seviyede
  await page.evaluate(()=>{
    projects = [{ id:'p1', name:'Deneme', type:'other', keywords:'', notes:'', address:'', shootDate:'',
      script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
      deadlines:{}, createdAt:Date.now() }];
    saveProjects(); scriptler=[]; saveScriptler(); fikirler=[]; saveFikirler();
    openScript(null, { projectId:'p1', title:'Deneme scripti' });
  });
  await page.waitForTimeout(300);
  await page.click('#sc_ai');
  await page.waitForTimeout(700);
  const g2 = govdeler[govdeler.length-1] || {};
  const tc2 = ((g2.generationConfig||{}).thinkingConfig)||{};
  k('script üretiminde de düşünme seviyesi gidiyor', tc2.thinkingLevel === 'low', tc2);
  k('script üretiminde çıktı sınırı YOK (uzun metin yazabilsin)',
     (g2.generationConfig||{}).maxOutputTokens === undefined, (g2.generationConfig||{}).maxOutputTokens);
  k('script metni geldi', await page.evaluate(()=>document.getElementById('sc_text').value === 'tamam'));

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
