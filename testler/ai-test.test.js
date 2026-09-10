const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  const ac = async (kur)=>{
    const page = await b.newPage({ viewport:{width:1280,height:1000} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{
      localStorage.setItem('demo_seen_intro','1');
      localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.TEST_ANAHTAR_1234'}));
    }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    page.__istekler = [];
    if(kur) await kur(page);
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    return page;
  };

  console.log('BAĞLANTI TESTİ');
  let page = await ac(async p=>{
    await p.route('**generativelanguage.googleapis.com/v1beta/models', r=>{
      p.__istekler.push({ url:r.request().url(), yontem:r.request().method(),
                          anahtar:r.request().headers()['x-goog-api-key'] });
      r.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({models:[{name:'models/gemini-3.7-flash'},{name:'models/gemini-2.5-flash'},{name:'models/x'}]})});
    });
  });
  await page.click('#aiSettingsBtn'); await page.waitForTimeout(250);
  let g = await page.evaluate(()=>({ var: !!document.getElementById('aiTestBtn'),
    gorunur: getComputedStyle(document.getElementById('aiTestBtn')).display !== 'none',
    metin: document.getElementById('aiTestBtn').textContent.trim() }));
  k('“Bağlantıyı test et” düğmesi var', g.var && g.gorunur, g.metin);

  await page.click('#aiTestBtn');
  await page.waitForTimeout(900);
  let r = await page.evaluate(()=>({ metin: document.getElementById('ai_test_out').textContent,
    sinif: document.getElementById('ai_test_out').className }));
  k('test kayıtlı anahtarı kullanıyor', page.__istekler[0] && page.__istekler[0].anahtar === 'AQ.TEST_ANAHTAR_1234', page.__istekler[0]);
  k('GET model listesi çağrılıyor', page.__istekler[0] && page.__istekler[0].yontem === 'GET', page.__istekler[0] && page.__istekler[0].yontem);
  k('başarılı sonuç yeşil', /ok/.test(r.sinif), r.sinif);
  k('kaç saniye sürdüğü yazıyor', /\d+[.,]\d+ sn'de/.test(r.metin), r.metin.slice(0,60));
  k('kaç model listelendiği yazıyor', /3 model/.test(r.metin), r.metin.slice(0,90));
  k('sonucun anlamı açıklanıyor', /[Aa]nahtarın da ağın da sağlam/.test(r.metin), r.metin.slice(-70));
  await page.close();

  console.log('\nAĞA ULAŞILAMIYORSA');
  page = await ac(async p=>{ await p.route('**generativelanguage.googleapis.com/v1beta/models',
    r=>r.abort('connectionrefused')); });
  await page.click('#aiSettingsBtn'); await page.waitForTimeout(250);
  await page.click('#aiTestBtn');
  await page.waitForTimeout(900);
  r = await page.evaluate(()=>({ metin: document.getElementById('ai_test_out').textContent,
    sinif: document.getElementById('ai_test_out').className }));
  k('bağlantı yoksa net söylüyor', /hiç ulaşılamadı/.test(r.metin) && /bağlantıda/.test(r.metin), r.metin.slice(0,70));
  k('kırmızı', /error/.test(r.sinif));
  await page.close();

  console.log('\nANAHTAR GEÇERSİZSE');
  page = await ac(async p=>{ await p.route('**generativelanguage.googleapis.com/v1beta/models',
    r=>r.fulfill({status:400,contentType:'application/json',
      body: JSON.stringify({error:{message:'API key not valid. Please pass a valid API key.'}})})); });
  await page.click('#aiSettingsBtn'); await page.waitForTimeout(250);
  await page.click('#aiTestBtn');
  await page.waitForTimeout(900);
  r = await page.evaluate(()=>document.getElementById('ai_test_out').textContent);
  k('Google’ın kendi cümlesi gösteriliyor', /API key not valid/.test(r), r.slice(0,60));
  await page.close();

  console.log('\nYOĞUN MODELLERDEN YEDEĞE İNİYOR');
  const govdeler = [];
  page = await ac(async p=>{
    await p.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
      contentType:'application/json', body: JSON.stringify({models:[
        {name:'models/gemini-3.7-flash'},{name:'models/gemini-3.6-flash'},
        {name:'models/gemini-3.5-flash'},{name:'models/gemini-3.5-flash-lite'}]})}));
    await p.route('**generativelanguage.googleapis.com/v1beta/models/**', r=>{
    const model = (r.request().url().match(/models\/([^:]+):/)||[])[1];
    govdeler.push({ model, govde: JSON.parse(r.request().postData()) });
    if(model === 'gemini-3.5-flash-lite'){
      r.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({candidates:[{content:{parts:[{text:'ESKİ MODEL YAZDI'}]}}]})});
    }else{
      r.fulfill({status:503,contentType:'application/json',
        body: JSON.stringify({error:{message:'This model is currently experiencing high demand.'}})});
    }
  }); });
  await page.evaluate(()=>{
    projects = [{ id:'p1', name:'D', type:'other', keywords:'', notes:'', address:'', shootDate:'',
      script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
      deadlines:{}, createdAt:Date.now() }];
    saveProjects(); scriptler=[]; saveScriptler(); fikirler=[]; saveFikirler();
    openScript(null, { projectId:'p1', title:'D' });
  });
  await page.waitForTimeout(300);
  await page.click('#sc_ai');
  await page.waitForTimeout(1200);
  const metin = await page.evaluate(()=>document.getElementById('sc_text').value);
  k('modeller sırayla denendi', govdeler.map(x=>x.model).join(',')
     === 'gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite', govdeler.map(x=>x.model));
  k('yeni modellere düşünme seviyesi gidiyor',
     govdeler[0].govde.generationConfig.thinkingConfig.thinkingLevel === 'low');
  // Adaylarin hepsi Gemini 3: dordune de dusunme seviyesi gidiyor.
  k('bütün adaylara düşünme seviyesi gidiyor',
     govdeler.every(x=>x.govde.generationConfig.thinkingConfig.thinkingLevel === 'low'),
     govdeler.map(x=>x.govde.generationConfig.thinkingConfig));
  k('yedek modelden gelen metin yazıldı', metin === 'ESKİ MODEL YAZDI', metin);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
