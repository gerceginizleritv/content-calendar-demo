const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  const ac = async (kur)=>{
    const page = await b.newPage({ viewport:{width:1280,height:1000} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    if(kur) await kur(page);
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    return page;
  };

  console.log('ANAHTAR KAYITLI MI — EKRANDA YAZIYOR');
  let page = await ac();
  await page.click('#aiSettingsBtn'); await page.waitForTimeout(250);
  let d = await page.evaluate(()=>({ metin: document.getElementById('ai_state').textContent,
    sinif: document.getElementById('ai_state').className,
    gorunur: getComputedStyle(document.getElementById('ai_state')).display !== 'none' }));
  k('anahtar yokken söylüyor', /Kayıtlı anahtar yok/.test(d.metin), d.metin);
  k('durum kutusu görünüyor', d.gorunur);
  k('“var” işareti yok', !/var/.test(d.sinif), d.sinif);

  await page.evaluate(()=>{
    localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.Ab8RNORNEK_ANAHTAR_wxyz'}));
    document.getElementById('aiSettingsOverlay').classList.remove('open');
  });
  await page.click('#aiSettingsBtn'); await page.waitForTimeout(250);
  d = await page.evaluate(()=>({ metin: document.getElementById('ai_state').textContent,
    sinif: document.getElementById('ai_state').className,
    sil: !document.getElementById('aiForgetBtn').hidden }));
  k('anahtar VARKEN söylüyor', /anahtar kayıtlı/.test(d.metin), d.metin);
  k('hangi anahtar olduğu belli (son 4 hane)', /…wxyz/.test(d.metin), d.metin);
  k('anahtarın tamamı gösterilmiyor', !/Ab8RNORNEK/.test(d.metin));
  k('yeşil işaretli', /var/.test(d.sinif), d.sinif);
  k('“Anahtarı sil” çıkıyor', d.sil === true);

  // Silince durum hemen tazeleniyor
  // Uygulama artik kendi onayla() penceresini kullaniyor.
  await page.evaluate(()=>{ window.onayla = ()=> Promise.resolve(true); });
  await page.click('#aiForgetBtn');
  await page.waitForTimeout(300);
  d = await page.evaluate(()=>document.getElementById('ai_state').textContent);
  k('silince durum hemen güncelleniyor', /Kayıtlı anahtar yok/.test(d), d);
  await page.close();

  console.log('\nAI YAZARKEN İLERLEME GÖRÜNÜYOR');
  // Istek 3 saniye askida kalsin: sayac calisiyor mu?
  page = await ac(async p=>{ await p.route('**generativelanguage.googleapis.com**', async r=>{
    // Model listesi (GET) beklemeden donuyor: olculen sey URETIM suresi.
    if(r.request().method() === 'GET'){
      return r.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({models: ['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'].map(n=>({name:'models/'+n}))})});
    }
    await new Promise(res=>setTimeout(res, 3000));
    await r.fulfill({status:200,contentType:'application/json',
      body: JSON.stringify({candidates:[{content:{parts:[{text:'YAZILDI'}]}}]})}); }); });
  await page.evaluate(()=>{
    localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.TEST_1234'}));
    projects = [{ id:'p1', name:'Deneme', type:'other', keywords:'', notes:'', address:'', shootDate:'',
      script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
      deadlines:{}, createdAt:Date.now() }];
    saveProjects(); scriptler=[]; saveScriptler(); fikirler=[]; saveFikirler();
    openScript(null, { projectId:'p1', title:'Deneme' });
  });
  await page.waitForTimeout(300);
  await page.click('#sc_ai');
  await page.waitForTimeout(500);
  const c0 = await page.evaluate(()=>({ durum: document.getElementById('sc_driveStatus').textContent,
    dugme: document.getElementById('sc_ai').textContent.trim(),
    kilit: document.getElementById('sc_ai').disabled }));
  k('başlar başlamaz “Yazıyor…” görünüyor', /Yazıyor/.test(c0.durum), c0.durum);
  k('düğme de durumu söylüyor', /Yazıyor/.test(c0.dugme), c0.dugme);
  k('düğme kilitli (iki kez basılmasın)', c0.kilit === true);

  await page.waitForTimeout(1800);
  const c1 = await page.evaluate(()=>document.getElementById('sc_driveStatus').textContent);
  k('GEÇEN SANİYE sayıyor', /\d+ sn/.test(c1), c1);

  await page.waitForTimeout(1600);
  const c2 = await page.evaluate(()=>({ metin: document.getElementById('sc_text').value,
    durum: document.getElementById('sc_driveStatus').textContent,
    sinif: document.getElementById('sc_driveStatus').className,
    dugme: document.getElementById('sc_ai').textContent.trim(),
    kilit: document.getElementById('sc_ai').disabled }));
  k('metin geldi', c2.metin === 'YAZILDI', c2.metin);
  k('bitince sayaç durdu, sonuç yazıyor', !/sn$/.test(c2.durum) && /Gemini yazdı/.test(c2.durum), c2.durum);
  k('durum yeşil', /ok/.test(c2.sinif), c2.sinif);
  k('düğme eski hâline döndü', /AI ile yaz/.test(c2.dugme) && c2.kilit === false, c2.dugme);
  await page.close();

  console.log('\nTOPLAM SÜRE İKİ MODELE BÖLÜNÜYOR');
  page = await ac(async p=>{ p.__m=[];
    await p.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
      contentType:'application/json',
      body: JSON.stringify({models: ['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'].map(n=>({name:'models/'+n}))})}));
    await p.route('**generativelanguage.googleapis.com/v1beta/models/**', r=>{
      p.__m.push((r.request().url().match(/models\/([^:]+):/)||[])[1]); }); });   // hic cevap yok
  await page.evaluate(()=>{
    localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.TEST_1234'}));
    projects = [{ id:'p1', name:'D', type:'other', keywords:'', notes:'', address:'', shootDate:'',
      script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
      deadlines:{}, createdAt:Date.now() }];
    saveProjects(); scriptler=[]; saveScriptler(); fikirler=[]; saveFikirler();
    openScript(null, { projectId:'p1', title:'D' });
    window.__eski = callGemini;
    window.callGemini = (a,pr,o)=> window.__eski(a,pr,{ sure: 12000 });   // TOPLAM 12 sn
  });
  await page.waitForTimeout(300);
  const t0 = Date.now();
  await page.click('#sc_ai');
  await page.waitForFunction(()=>!document.getElementById('sc_ai').disabled, null, {timeout:25000});
  const gecen = Date.now() - t0;
  const son = await page.evaluate(()=>document.getElementById('sc_driveStatus').textContent);
  k('toplam süre aşılmıyor (iki modele bölünüyor)', gecen < 15000, gecen+'ms');
  k('iki model de denendi', page.__m.length === 2, page.__m);
  k('mesajda TOPLAM süre yazıyor', /12 saniyede/.test(son), son.slice(0,40));

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
