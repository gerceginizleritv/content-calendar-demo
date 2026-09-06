const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  const ac = async (liste, cevap)=>{
    const page = await b.newPage({ viewport:{width:1280,height:1000} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{
      localStorage.setItem('demo_seen_intro','1');
      localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.TEST_1234'}));
    }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    page.__uretim = [];
    await page.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
      contentType:'application/json', body: JSON.stringify({models: liste.map(n=>({name:'models/'+n}))})}));
    await page.route('**generativelanguage.googleapis.com/v1beta/models/**', async r=>{
      const m = (r.request().url().match(/models\/([^:]+):/)||[])[1];
      page.__uretim.push(m);
      const c = cevap(m);
      await r.fulfill({ status:c.status, contentType:'application/json', body: JSON.stringify(c.body) });
    });
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1400);
    await page.evaluate(()=>{
      document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
      setLanguage('tr');
      projects = [{ id:'p1', name:'D', type:'other', keywords:'', notes:'', address:'', shootDate:'',
        script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
        deadlines:{}, createdAt:Date.now() }];
      saveProjects(); scriptler=[]; saveScriptler(); fikirler=[]; saveFikirler();
    });
    return page;
  };
  const iyi = { status:200, body:{candidates:[{content:{parts:[{text:'tamam'}]}}]} };
  const kapali = { status:400, body:{error:{message:'This model models/x is no longer available to new users.'}} };

  console.log('KAPALI MODELE İSTEK GÖNDERİLMİYOR');
  // Anahtara yalnizca 3.6 ve lite acik
  let page = await ac(['gemini-3.6-flash','gemini-3.5-flash-lite','gemini-2.0-flash'],
                      m => m === 'gemini-3.6-flash' ? kapali : iyi);
  await page.evaluate(()=>openScript(null, { projectId:'p1', title:'D' }));
  await page.waitForTimeout(300);
  await page.click('#sc_ai');
  await page.waitForTimeout(1200);
  let metin = await page.evaluate(()=>document.getElementById('sc_text').value);
  k('anahtara KAPALI modellere hiç istek gitmiyor',
     page.__uretim.indexOf('gemini-3.7-flash') === -1 && page.__uretim.indexOf('gemini-3.5-flash') === -1,
     page.__uretim);
  k('açık olanlar sırayla denendi', page.__uretim.join(',') === 'gemini-3.6-flash,gemini-3.5-flash-lite', page.__uretim);
  k('lite modelden metin geldi', metin === 'tamam', metin);
  await page.close();

  console.log('\nSABİT ADAYLARIN HİÇBİRİ AÇIK DEĞİLSE');
  // Bizim listemizden hicbiri yok; ama baska flash modeller var
  page = await ac(['gemini-4.0-flash','gemini-4.0-flash-lite','gemini-4.0-pro','imagen-4','text-embedding-005'],
                  ()=> iyi);
  await page.evaluate(()=>openScript(null, { projectId:'p1', title:'D' }));
  await page.waitForTimeout(300);
  await page.click('#sc_ai');
  await page.waitForTimeout(1200);
  metin = await page.evaluate(()=>document.getElementById('sc_text').value);
  k('listedeki flash modele düşülüyor', /flash/.test(page.__uretim[0] || ''), page.__uretim);
  k('pro / görsel / gömme modelleri seçilmiyor',
     !page.__uretim.some(m=>/pro|imagen|embedding/.test(m)), page.__uretim);
  k('metin geldi', metin === 'tamam', metin);
  await page.close();

  console.log('\nMODEL LİSTESİ ALINAMAZSA ÜRETİM DURMUYOR');
  page = await b.newPage({ viewport:{width:1280,height:1000} });
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{
    localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.TEST_1234'}));
  }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  const uretim2 = [];
  await page.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.abort('connectionrefused'));
  await page.route('**generativelanguage.googleapis.com/v1beta/models/**', async r=>{
    uretim2.push((r.request().url().match(/models\/([^:]+):/)||[])[1]);
    await r.fulfill({status:200,contentType:'application/json',
      body: JSON.stringify({candidates:[{content:{parts:[{text:'tamam'}]}}]})});
  });
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    projects = [{ id:'p1', name:'D', type:'other', keywords:'', notes:'', address:'', shootDate:'',
      script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
      deadlines:{}, createdAt:Date.now() }];
    saveProjects(); scriptler=[]; saveScriptler(); fikirler=[]; saveFikirler();
    openScript(null, { projectId:'p1', title:'D' });
  });
  await page.waitForTimeout(300);
  await page.click('#sc_ai');
  await page.waitForTimeout(1200);
  k('liste alınamasa da sabit listeyle devam ediyor', uretim2[0] === 'gemini-3.7-flash', uretim2);
  k('metin geldi', await page.evaluate(()=>document.getElementById('sc_text').value === 'tamam'));

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
