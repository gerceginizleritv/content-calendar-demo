const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:900} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  page.on('dialog', d=>d.accept());   // dolu metnin üstüne yazma onayı
  await page.addInitScript(()=>{ try{
    localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.TEST_1234'}));
  }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
    contentType:'application/json', body: JSON.stringify({models:[{name:'models/gemini-3.7-flash'}]})}));
  const promptlar = [];
  await page.route('**generativelanguage.googleapis.com/v1beta/models/**', async r=>{
    promptlar.push(JSON.parse(r.request().postData()).contents[0].parts[0].text);
    await r.fulfill({status:200,contentType:'application/json',
      body: JSON.stringify({candidates:[{content:{parts:[{text:'bir iki üç dört beş'}]}}]})});
  });
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('KELİME SAYACI VE UZUNLUK');

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
  k('boşken "boş" yazıyor', await page.evaluate(()=>document.getElementById('scCount').textContent === 'boş'));

  await page.evaluate(()=>{
    const ta = document.getElementById('sc_text');
    ta.value = 'Bir iki üç dört beş altı yedi.';
    ta.dispatchEvent(new Event('input'));
  });
  await page.waitForTimeout(200);
  let sayac = await page.evaluate(()=>document.getElementById('scCount').textContent);
  k('kelime sayısı yazıyor', /7 kelime/.test(sayac), sayac);
  k('karakter sayısı da duruyor', /karakter/.test(sayac), sayac);

  // Satir sonlari ve fazla bosluklar yanlis saydirmasin
  await page.evaluate(()=>{
    const ta = document.getElementById('sc_text');
    ta.value = 'AÇILIŞ\n\nBir   iki\tüç\n\nKAPANIŞ\n';
    ta.dispatchEvent(new Event('input'));
  });
  await page.waitForTimeout(200);
  sayac = await page.evaluate(()=>document.getElementById('scCount').textContent);
  k('satır sonu ve çift boşluk doğru sayılıyor', /5 kelime/.test(sayac), sayac);

  // Kutuda metin varken AI ustune yazmadan once soruyor; uygulama artik
  // tarayicinin confirm kutusunu degil kendi penceresini kullaniyor.
  await page.evaluate(()=>{ window.onayla = ()=> Promise.resolve(true); });
  // Uzunluk ALT SINIR olarak gidiyor
  await page.fill('#sc_aiBrief','400 kelimelik bir script yaz');
  await page.click('#sc_ai');
  await page.waitForTimeout(900);
  const p1 = promptlar[promptlar.length-1] || '';
  k('uzunluk ALT SINIR olarak veriliyor', /treat that number as a MINIMUM/.test(p1));
  k('erken bitirmemesi söyleniyor', /do not stop early/.test(p1));
  k('ton ve hedef kitle yine birebir', /sets a tone or an audience, follow it exactly/.test(p1));

  // Uretilen metnin kelime sayisi hemen gorunuyor
  const sonra = await page.evaluate(()=>document.getElementById('scCount').textContent);
  k('AI yazdıktan sonra sayaç güncelleniyor', /5 kelime/.test(sonra), sonra);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
