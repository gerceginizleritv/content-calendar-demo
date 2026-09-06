const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  const ac = async (anahtarVar)=>{
    const page = await b.newPage({ viewport:{width:1280,height:900} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript((v)=>{ try{
      localStorage.setItem('demo_seen_intro','1');
      if(v) localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.TEST_1234'}));
    }catch(e){} }, anahtarVar);
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
      contentType:'application/json', body: JSON.stringify({models:[{name:'models/gemini-3.7-flash'}]})}));
    await page.route('**generativelanguage.googleapis.com/v1beta/models/**', r=>r.fulfill({status:200,
      contentType:'application/json', body: JSON.stringify({candidates:[{content:{parts:[{text:'ok'}]}}]})}));
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1400);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    await page.click('#aiSettingsBtn'); await page.waitForTimeout(250);
    return page;
  };

  console.log('AI EKRANI — REHBER VE TEST SONUCU');
  let page = await ac(false);
  let r = await page.evaluate(()=>({ acik: document.querySelector('.ai-howto').open }));
  k('anahtar YOKKEN rehber açık', r.acik === true);
  await page.close();

  page = await ac(true);
  r = await page.evaluate(()=>{
    const kutu = document.getElementById('ai_key');
    const dugme = document.getElementById('aiTestBtn');
    const modal = document.querySelector('#aiSettingsOverlay .modal');
    const mr = modal.getBoundingClientRect();
    return { rehberAcik: document.querySelector('.ai-howto').open,
             kutuGorunur: kutu.getBoundingClientRect().bottom <= mr.bottom + 1,
             testGorunur: dugme.getBoundingClientRect().bottom <= window.innerHeight + 1,
             modalKayiyor: modal.scrollHeight > modal.clientHeight + 2 };
  });
  k('anahtar VARKEN rehber kapalı', r.rehberAcik === false);
  k('anahtar kutusu kaydırmadan görünüyor', r.kutuGorunur === true);
  k('“Bağlantıyı test et” ekranda görünüyor', r.testGorunur === true);
  k('ekran artık kaymıyor', r.modalKayiyor === false, r.modalKayiyor);

  // Test sonuclari bir sonraki acilista sifirlaniyor
  await page.click('#aiTestBtn');
  await page.waitForFunction(()=>!document.getElementById('aiTestBtn').disabled, null, {timeout:20000});
  await page.waitForTimeout(200);
  const doluydu = await page.evaluate(()=>document.getElementById('ai_test_list').innerHTML.length > 0);
  k('test sonuçları yazıldı', doluydu === true);
  await page.evaluate(()=>document.getElementById('aiSettingsOverlay').classList.remove('open'));
  await page.click('#aiSettingsBtn'); await page.waitForTimeout(250);
  const temiz = await page.evaluate(()=>({
    liste: document.getElementById('ai_test_list').hidden,
    cikti: document.getElementById('ai_test_out').textContent }));
  k('yeniden açılınca ESKİ sonuçlar duruyor değil', temiz.liste === true && temiz.cikti === '', temiz);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
