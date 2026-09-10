
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
  let cagri = 0, gidenAnahtar = '';
  await page.route('**generativelanguage.googleapis.com**', async r=>{
    if(r.request().method() === 'GET'){
      return r.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({models: ['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'].map(n=>({name:'models/'+n}))})});
    }
    cagri++; gidenAnahtar = r.request().headers()['x-goog-api-key'] || '';
    await r.fulfill({status:200,contentType:'application/json',
      body: JSON.stringify({candidates:[{content:{parts:[{text:'test'}]}}]})});
  });
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });

  console.log('AI STUDIO’NUN YENİ "AQ." ANAHTARI');
  // Kullanicinin ekranindaki bicim. Gercek anahtar degil, ayni SEKILDE
  // uretilmis bir ornek.
  const YENI = 'AQ.Ab8RN6ORNEKANAHTAR_123456-xyz';
  await page.click('#aiSettingsBtn');
  await page.waitForTimeout(250);
  await page.fill('#ai_key', YENI);
  await page.click('#aiSettingsSaveBtn');
  await page.waitForTimeout(600);
  const s1 = await page.evaluate(()=>({
    ipucu: document.getElementById('ai_key_hint').textContent,
    sinif: document.getElementById('ai_key_hint').className,
    kayit: JSON.parse(localStorage.getItem('demo_ai_settings')||'null'),
    acik: document.getElementById('aiSettingsOverlay').classList.contains('open')
  }));
  k('"AQ." anahtarı biçim kontrolünü GEÇİYOR', !/benzemiyor/.test(s1.ipucu), s1.ipucu);
  k('canlı doğrulama çağrısı yapıldı', cagri === 1, cagri);
  k('anahtar başlıkta doğru gitti', gidenAnahtar === YENI, gidenAnahtar);
  k('anahtar kaydedildi', !!s1.kayit && s1.kayit.key === YENI && s1.kayit.provider === 'gemini', s1.kayit);
  k('ekran kapandı', s1.acik === false);

  // Eski AIza bicimi hala gecerli
  await page.evaluate(()=>{ localStorage.removeItem('demo_ai_settings'); });
  cagri = 0;
  await page.click('#aiSettingsBtn');
  await page.waitForTimeout(250);
  await page.fill('#ai_key', 'AIzaESKI_BICIM_ANAHTAR_123');
  await page.click('#aiSettingsSaveBtn');
  await page.waitForTimeout(600);
  const s2 = await page.evaluate(()=>JSON.parse(localStorage.getItem('demo_ai_settings')||'null'));
  k('eski "AIza" biçimi hala kabul ediliyor', !!s2 && s2.key === 'AIzaESKI_BICIM_ANAHTAR_123', s2);

  // Yanlis yerden yapistirilan hala reddediliyor
  await page.evaluate(()=>{ localStorage.removeItem('demo_ai_settings'); });
  cagri = 0;
  await page.click('#aiSettingsBtn');
  await page.waitForTimeout(250);
  await page.fill('#ai_key', 'sk-proj-baskabiryerdenkopyalanmis');
  await page.click('#aiSettingsSaveBtn');
  await page.waitForTimeout(400);
  const s3 = await page.evaluate(()=>({ ipucu: document.getElementById('ai_key_hint').textContent,
    kayit: localStorage.getItem('demo_ai_settings') }));
  k('başka sağlayıcının anahtarı reddediliyor', /benzemiyor/.test(s3.ipucu) && cagri === 0, s3.ipucu);
  k('reddedilen anahtar KAYDEDİLMİYOR', s3.kayit === null);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
