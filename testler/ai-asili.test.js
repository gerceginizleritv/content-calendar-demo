const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };

  const ac = async (mod)=>{
    const page = await b.newPage({ viewport:{width:1280,height:1000} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    // Model listesi (GET) her zaman hizli donuyor: olculen sey URETIM.
    await page.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
      contentType:'application/json',
      body: JSON.stringify({models: ['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'].map(n=>({name:'models/'+n}))})}));
    if(mod === 'asili')  await page.route('**generativelanguage.googleapis.com/v1beta/models/**', ()=>{ /* hiç cevap verme */ });
    if(mod === 'agyok')  await page.route('**generativelanguage.googleapis.com/v1beta/models/**', r=>r.abort('connectionrefused'));
    if(mod === 'iyi')    await page.route('**generativelanguage.googleapis.com/v1beta/models/**', r=>r.fulfill({status:200,
      contentType:'application/json', body: JSON.stringify({candidates:[{content:{parts:[{text:'test'}]}}]})}));
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1400);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    await page.waitForTimeout(200);
    return page;
  };

  console.log('İSTEK ASILI KALIRSA (zaman aşımı)');
  let page = await ac('asili');
  // Sinirlari testte kisaltiyoruz: 20 saniye beklemenin anlami yok.
  await page.evaluate(()=>{ window.__eskiCall = callGemini;
    window.callGemini = (k,p,s)=> window.__eskiCall(k,p, 900); });
  await page.click('#aiSettingsBtn');
  await page.waitForTimeout(200);
  await page.fill('#ai_key','AQ.TESTANAHTARI_123456');
  await page.click('#aiSettingsSaveBtn');
  const t0 = Date.now();
  await page.waitForFunction(()=>!document.getElementById('aiSettingsSaveBtn').disabled, null, {timeout:8000});
  const gecen = Date.now() - t0;
  const r1 = await page.evaluate(()=>({
    ipucu: document.getElementById('ai_key_hint').textContent,
    sinif: document.getElementById('ai_key_hint').className,
    kilit: document.getElementById('aiSettingsSaveBtn').disabled,
    acik: document.getElementById('aiSettingsOverlay').classList.contains('open'),
    kayit: localStorage.getItem('demo_ai_settings')
  }));
  k('düğme SONSUZA KADAR kilitli kalmıyor', r1.kilit === false, gecen+'ms');
  k('“Anahtar deneniyor…” yerinde çakılı kalmıyor', !/deneniyor/.test(r1.ipucu), r1.ipucu.slice(0,50));
  k('zaman aşımı SEBEBİYLE anlatılıyor', /zamanında gelmedi/.test(r1.ipucu) && /engelleyici/.test(r1.ipucu), r1.ipucu.slice(0,70));
  k('“Google\'ın söylediği” denmiyor (Google bir şey söylemedi)', !/söylediği/.test(r1.ipucu), r1.ipucu.slice(0,40));
  k('hata olarak gösteriliyor', /error/.test(r1.sinif));
  k('çalışmayan anahtar KAYDEDİLMİYOR', r1.kayit === null);
  k('ekran açık kalıyor (tekrar denenebilsin)', r1.acik === true);
  await page.close();

  console.log('\nAĞA HİÇ ÇIKILAMIYORSA');
  page = await ac('agyok');
  await page.click('#aiSettingsBtn');
  await page.waitForTimeout(200);
  await page.fill('#ai_key','AQ.TESTANAHTARI_123456');
  await page.click('#aiSettingsSaveBtn');
  await page.waitForFunction(()=>!document.getElementById('aiSettingsSaveBtn').disabled, null, {timeout:8000});
  const r2 = await page.evaluate(()=>document.getElementById('ai_key_hint').textContent);
  k('ağ hatası ayrı anlatılıyor', /ulaşılamadı/.test(r2) && /generativelanguage/.test(r2), r2.slice(0,70));
  k('ağ hatasında da “Google\'ın söylediği” denmiyor', !/söylediği/.test(r2), r2.slice(0,40));
  await page.close();

  console.log('\nANAHTAR ÇALIŞIYORSA (sol menüden girildi)');
  page = await ac('iyi');
  await page.click('#aiSettingsBtn');
  await page.waitForTimeout(200);
  await page.fill('#ai_key','AQ.TESTANAHTARI_123456');
  await page.click('#aiSettingsSaveBtn');
  await page.waitForTimeout(700);
  const r3 = await page.evaluate(()=>({
    acik: document.getElementById('aiSettingsOverlay').classList.contains('open'),
    kayit: JSON.parse(localStorage.getItem('demo_ai_settings')||'null'),
    kayitPenceresi: document.getElementById('editOverlay').classList.contains('open'),
    toast: (document.querySelector('.toast, #toast') || {}).textContent || ''
  }));
  k('anahtar kaydedildi', !!r3.kayit && r3.kayit.provider === 'gemini');
  k('ekran kapandı', r3.acik === false);
  k('KAYIT penceresi kendiliğinden AÇILMIYOR', r3.kayitPenceresi === false);
  k('kullanıcıya hazır olduğu söyleniyor', /hazır/.test(r3.toast), r3.toast);
  await page.close();

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
