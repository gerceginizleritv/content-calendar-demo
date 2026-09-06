const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };

  // yanit: model adina gore ne donecegini belirleyen fonksiyon
  const ac = async (yanit)=>{
    const page = await b.newPage({ viewport:{width:1280,height:1000} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    page.__istekler = [];
    // Anahtara acik model listesi (GET) ayri karsilaniyor: uretim
    // isteklerinin listesine karismasin.
    await page.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
      contentType:'application/json',
      body: JSON.stringify({models: ['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'].map(n=>({name:'models/'+n}))})}));
    await page.route('**generativelanguage.googleapis.com/v1beta/models/**', async r=>{
      const url = r.request().url();
      const model = (url.match(/models\/([^:]+):/) || [])[1] || '?';
      page.__istekler.push(model);
      const c = yanit(model);
      await r.fulfill({ status:c.status, contentType:'application/json', body: JSON.stringify(c.body) });
    });
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1400);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    return page;
  };
  const iyi = { status:200, body:{candidates:[{content:{parts:[{text:'tamam'}]}}]} };
  const yogun = { status:503, body:{error:{message:'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.'}} };
  const kota  = { status:429, body:{error:{message:'Quota exceeded: RESOURCE_EXHAUSTED'}} };
  const kotu  = { status:400, body:{error:{message:'API key not valid. Please pass a valid API key.'}} };

  const anahtarGir = async (page)=>{
    await page.click('#aiSettingsBtn'); await page.waitForTimeout(200);
    await page.fill('#ai_key','AQ.TESTANAHTARI_123456');
    await page.click('#aiSettingsSaveBtn');
    await page.waitForTimeout(900);
  };

  console.log('İLK MODEL YOĞUN → YEDEK MODELE GEÇİYOR');
  let page = await ac(m => m === 'gemini-3.7-flash' ? yogun : iyi);
  await anahtarGir(page);
  let r = await page.evaluate(()=>({
    kayit: JSON.parse(localStorage.getItem('demo_ai_settings')||'null'),
    acik: document.getElementById('aiSettingsOverlay').classList.contains('open')
  }));
  k('yoğun modelden yedeğe geçiliyor', page.__istekler[0] === 'gemini-3.7-flash' && page.__istekler.length >= 2, page.__istekler);
  k('anahtar kaydedildi', !!r.kayit && r.kayit.provider === 'gemini');
  k('ekran kapandı', r.acik === false);
  await page.close();

  console.log('\nİKİ MODEL DE YOĞUN → ANAHTAR YİNE DE KAYDEDİLİYOR');
  page = await ac(()=> yogun);
  await anahtarGir(page);
  r = await page.evaluate(()=>({
    kayit: JSON.parse(localStorage.getItem('demo_ai_settings')||'null'),
    acik: document.getElementById('aiSettingsOverlay').classList.contains('open'),
    toast: (document.querySelector('.toast, #toast')||{}).textContent || '',
    ipucu: document.getElementById('ai_key_hint').textContent
  }));
  k('bütün modeller denendi', page.__istekler.length === 4, page.__istekler);
  k('ÇALIŞAN anahtar yoğunluk yüzünden REDDEDİLMİYOR', !!r.kayit, r.kayit);
  k('durum dürüstçe söyleniyor', /yoğun/.test(r.toast) && /kaydedildi/.test(r.toast), r.toast);
  k('“anahtar çalışmadı” DENMİYOR', !/çalışmadı/.test(r.ipucu), r.ipucu);
  await page.close();

  console.log('\nKOTA DOLMUŞ');
  page = await ac(()=> kota);
  await anahtarGir(page);
  r = await page.evaluate(()=>({ kayit: !!JSON.parse(localStorage.getItem('demo_ai_settings')||'null'),
    toast: (document.querySelector('.toast, #toast')||{}).textContent || '' }));
  k('kota dolunca da anahtar kaydediliyor', r.kayit === true);
  await page.close();

  console.log('\nGERÇEKTEN GEÇERSİZ ANAHTAR → REDDEDİLİYOR');
  page = await ac(()=> kotu);
  await anahtarGir(page);
  r = await page.evaluate(()=>({
    kayit: localStorage.getItem('demo_ai_settings'),
    ipucu: document.getElementById('ai_key_hint').textContent,
    acik: document.getElementById('aiSettingsOverlay').classList.contains('open')
  }));
  k('geçersiz anahtarda YEDEK MODEL denenmiyor (boşuna istek yok)', page.__istekler.length === 1, page.__istekler);
  k('geçersiz anahtar KAYDEDİLMİYOR', r.kayit === null);
  k('Google’ın kendi cümlesi gösteriliyor', /API key not valid/.test(r.ipucu), r.ipucu.slice(0,60));
  k('ekran açık kalıyor', r.acik === true);
  await page.close();

  console.log('\nÜRETİMDE YOĞUNLUK');
  page = await ac(m => m === 'gemini-3.7-flash' ? yogun : iyi);
  await page.evaluate(()=>{
    localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.TEST_123456'}));
    projects = [{ id:'p1', name:'Deneme', type:'other', keywords:'', notes:'', address:'', shootDate:'',
      script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
      deadlines:{}, createdAt:Date.now() }];
    saveProjects(); scriptler=[]; saveScriptler(); fikirler=[]; saveFikirler();
    openScript(null, { projectId:'p1', title:'Deneme' });
  });
  await page.waitForTimeout(300);
  await page.click('#sc_ai');
  await page.waitForTimeout(900);
  const u = await page.evaluate(()=>({ metin: document.getElementById('sc_text').value,
    durum: document.getElementById('sc_driveStatus').textContent }));
  k('üretimde de yedek modele geçiliyor', u.metin === 'tamam', u.metin);

  // Ikisi de yogunsa uretim ne diyor
  await page.evaluate(()=>{ document.getElementById('sc_text').value=''; });
  await page.unroute('**generativelanguage.googleapis.com**');
  await page.route('**generativelanguage.googleapis.com**', r=>r.fulfill({status:503,
    contentType:'application/json', body: JSON.stringify({error:{message:'This model is currently experiencing high demand.'}})}));
  await page.click('#sc_ai');
  await page.waitForTimeout(900);
  const u2 = await page.evaluate(()=>document.getElementById('sc_driveStatus').textContent);
  k('üretimde yoğunluk anlaşılır anlatılıyor', /yoğun/.test(u2) && /anahtarınla ilgili değil/.test(u2), u2);
  k('“Google’ın söylediği” diye sunulmuyor', !/söylediği/.test(u2), u2.slice(0,40));
  await page.close();

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
