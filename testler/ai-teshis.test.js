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
      if(c === 'asili') return;                       // hiç cevap verme
      await r.fulfill({ status:c.status, contentType:'application/json', body: JSON.stringify(c.body) });
    });
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr');
      // 15 sn beklememek icin test sinirini kisaltiyoruz
      window.__f = window.fetch;
    });
    return page;
  };
  const iyi = { status:200, body:{candidates:[{content:{parts:[{text:'test'}]}}]} };
  const yogun = { status:503, body:{error:{message:'This model is currently experiencing high demand.'}} };

  console.log('MODEL MODEL TEŞHİS');
  // 3.7 yogun, 3.6 anahtara acik degil, 2.5 calisiyor
  let page = await ac(['gemini-3.7-flash','gemini-3.5-flash-lite','baska-model'],
                      m => m === 'gemini-3.7-flash' ? yogun : iyi);
  await page.click('#aiSettingsBtn'); await page.waitForTimeout(250);
  await page.click('#aiTestBtn');
  await page.waitForFunction(()=>!document.getElementById('aiTestBtn').disabled, null, {timeout:20000});
  await page.waitForTimeout(300);
  let r = await page.evaluate(()=>({
    ozet: document.getElementById('ai_test_out').textContent,
    sinif: document.getElementById('ai_test_out').className,
    satirlar: [...document.querySelectorAll('#ai_test_list li')].map(li=>({
      ad: li.querySelector('.tm-ad').textContent,
      sonuc: li.querySelector('.tm-sonuc').textContent,
      sinif: li.querySelector('.tm-sonuc').className })),
    calisan: aiCalisanModel
  }));
  k('bütün adayların satırı var', r.satirlar.length === 4, r.satirlar.map(x=>x.ad));
  k('yoğun model kırmızı ve SEBEBİ yazıyor',
     /high demand/.test(r.satirlar[0].sonuc) && /tm-hata/.test(r.satirlar[0].sinif), r.satirlar[0]);
  k('anahtara açık olmayan modeller DENENMİYOR',
     /açık değil/.test(r.satirlar[1].sonuc) && /açık değil/.test(r.satirlar[2].sonuc)
     && page.__uretim.indexOf('gemini-3.6-flash') === -1, [r.satirlar[1], r.satirlar[2]]);
  k('çalışan model yeşil ve süresi yazıyor',
     /çalışıyor/.test(r.satirlar[3].sonuc) && /tm-ok/.test(r.satirlar[3].sinif), r.satirlar[3]);
  k('özet çalışan modeli söylüyor', /gemini-3\.5-flash-lite yanıt veriyor/.test(r.ozet), r.ozet);
  k('özet yeşil', /ok/.test(r.sinif));
  k('çalışan model hatırlanıyor', r.calisan === 'gemini-3.5-flash-lite', r.calisan);

  // Simdi yazma: CALISAN modelden basliyor mu?
  page.__uretim.length = 0;
  await page.evaluate(()=>{
    document.getElementById('aiSettingsOverlay').classList.remove('open');
    projects = [{ id:'p1', name:'D', type:'other', keywords:'', notes:'', address:'', shootDate:'',
      script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
      deadlines:{}, createdAt:Date.now() }];
    saveProjects(); scriptler=[]; saveScriptler(); fikirler=[]; saveFikirler();
    openScript(null, { projectId:'p1', title:'D' });
  });
  await page.waitForTimeout(300);
  await page.click('#sc_ai');
  await page.waitForTimeout(900);
  k('yazma ÇALIŞAN modelden başlıyor (tıkalıyı baştan denemiyor)',
     page.__uretim[0] === 'gemini-3.5-flash-lite', page.__uretim);
  k('metin geldi', await page.evaluate(()=>document.getElementById('sc_text').value === 'test'));
  await page.close();

  console.log('\nHİÇBİRİ ÇALIŞMIYORSA');
  page = await ac(['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'], ()=> yogun);
  await page.click('#aiSettingsBtn'); await page.waitForTimeout(250);
  await page.click('#aiTestBtn');
  await page.waitForFunction(()=>!document.getElementById('aiTestBtn').disabled, null, {timeout:20000});
  await page.waitForTimeout(300);
  r = await page.evaluate(()=>({ ozet: document.getElementById('ai_test_out').textContent,
    sinif: document.getElementById('ai_test_out').className, calisan: aiCalisanModel }));
  k('hiçbiri çalışmıyorsa dürüstçe söylüyor', /Hiçbir model yanıt vermedi/.test(r.ozet), r.ozet.slice(0,50));
  k('sorumluyu doğru gösteriyor', /Google tarafında/.test(r.ozet));
  k('kırmızı', /error/.test(r.sinif));
  k('çalışan model işaretlenmedi', r.calisan === '', r.calisan);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
