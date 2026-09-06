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
    page.__m = [];
    // Model listesi (GET) her zaman hizli donuyor.
    await page.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
      contentType:'application/json',
      body: JSON.stringify({models: ['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'].map(n=>({name:'models/'+n}))})}));
    await kur(page);
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr');
      window.__eski = callGemini; window.callGemini = (a,p,o)=> window.__eski(a,p, Object.assign({}, (typeof o==='number'?{sure:o}:o||{}), {sure:800})); });
    return page;
  };
  const dene = async (page)=>{
    await page.click('#aiSettingsBtn'); await page.waitForTimeout(200);
    await page.fill('#ai_key','AQ.TESTANAHTARI_123456');
    await page.click('#aiSettingsSaveBtn');
    await page.waitForFunction(()=>!document.getElementById('aiSettingsSaveBtn').disabled, null, {timeout:9000});
    await page.waitForTimeout(150);
  };

  console.log('İSTEK ASILI KALIRSA');
  let page = await ac(async p=>{ await p.route('**generativelanguage.googleapis.com/v1beta/models/**', r=>{ 
    p.__m.push((r.request().url().match(/models\/([^:]+):/)||[])[1]); }); });
  await dene(page);
  let r = await page.evaluate(()=>({
    ipucu: document.getElementById('ai_key_hint').textContent,
    yinede: !document.getElementById('aiSaveAnywayBtn').hidden,
    kayit: localStorage.getItem('demo_ai_settings')
  }));
  k('istek GERÇEKTEN gönderildi (sormadan suçlama yok)', page.__m.length >= 1, page.__m);
  k('sebep yazıyor', /yanıt gelmedi/.test(r.ipucu), r.ipucu.slice(0,40));
  k('“Denemeden kaydet” çıkıyor', r.yinede === true);
  k('henüz kaydedilmedi', r.kayit === null);

  await page.click('#aiSaveAnywayBtn');
  await page.waitForTimeout(300);
  r = await page.evaluate(()=>({
    kayit: JSON.parse(localStorage.getItem('demo_ai_settings')||'null'),
    acik: document.getElementById('aiSettingsOverlay').classList.contains('open'),
    toast: (document.querySelector('.toast, #toast')||{}).textContent || ''
  }));
  k('“Denemeden kaydet” anahtarı kaydediyor', !!r.kayit && r.kayit.key === 'AQ.TESTANAHTARI_123456', r.kayit);
  k('ekran kapanıyor', r.acik === false);
  k('durum dürüstçe söyleniyor', /denenmeden kaydedildi/i.test(r.toast), r.toast);
  await page.close();

  console.log('\nGERÇEKTEN GEÇERSİZ ANAHTAR');
  page = await ac(async p=>{ await p.route('**generativelanguage.googleapis.com/v1beta/models/**', r=>{
    p.__m.push('x'); r.fulfill({status:400,contentType:'application/json',
      body: JSON.stringify({error:{message:'API key not valid. Please pass a valid API key.'}})}); }); });
  await dene(page);
  r = await page.evaluate(()=>({
    yinede: !document.getElementById('aiSaveAnywayBtn').hidden,
    kayit: localStorage.getItem('demo_ai_settings'),
    ipucu: document.getElementById('ai_key_hint').textContent
  }));
  k('geçersiz anahtarda “Denemeden kaydet” ÇIKMIYOR', r.yinede === false);
  k('geçersiz anahtar kaydedilmiyor', r.kayit === null);
  k('Google’ın cümlesi gösteriliyor', /API key not valid/.test(r.ipucu), r.ipucu.slice(0,50));
  await page.close();

  console.log('\nEKRAN YENİDEN AÇILINCA DÜĞME GİZLİ');
  page = await ac(async p=>{ await p.route('**generativelanguage.googleapis.com/v1beta/models/**', r=>{ p.__m.push('x'); }); });
  await dene(page);
  await page.evaluate(()=>document.getElementById('aiSettingsOverlay').classList.remove('open'));
  await page.click('#aiSettingsBtn');
  await page.waitForTimeout(200);
  k('yeniden açılınca “Denemeden kaydet” gizli',
     await page.evaluate(()=>document.getElementById('aiSaveAnywayBtn').hidden === true));
  await page.close();

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
