const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  page.on('dialog', d=>d.accept());
  await page.addInitScript(()=>{ try{
    localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.TEST_1234'}));
  }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  const promptlar = [];
  await page.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
    contentType:'application/json',
    body: JSON.stringify({models: ['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'].map(n=>({name:'models/'+n}))})}));
  await page.route('**generativelanguage.googleapis.com/v1beta/models/**', async r=>{
    promptlar.push(JSON.parse(r.request().postData()).contents[0].parts[0].text);
    await r.fulfill({status:200,contentType:'application/json',
      body: JSON.stringify({candidates:[{content:{parts:[{text:'AÇILIŞ\nMetin.'}]}}]})});
  });
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('AI TARİFİ AYRI ALANDA');

  await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    projects = [{ id:'p1', name:'Slate tanıtımı', type:'other', keywords:'', notes:'', address:'',
      shootDate:'', script:false, shot:false, edited:false, published:false, permit:false,
      cancelled:false, deadlines:{}, createdAt:Date.now() }];
    saveProjects();
    fikirler = [{ id:'f1', text:'AI ile script yazmak ne kadar kolay', parts:[{id:'a',text:'AI ile script yazmak ne kadar kolay'}],
      projectId:'p1', sort:0, createdAt:Date.now(), updatedAt:Date.now() }];
    saveFikirler(); scriptler=[]; saveScriptler();
    openScript(null, { projectId:'p1', title:'Bölüm 1' });
  });
  await page.waitForTimeout(300);

  const g = await page.evaluate(()=>{
    const brief = document.getElementById('sc_aiBrief');
    const metin = document.getElementById('sc_text');
    const dugme = document.getElementById('sc_ai');
    const not = document.querySelector('.sc-ai-not');
    return { var: !!brief, gorunur: getComputedStyle(brief).display !== 'none',
             ph: brief.placeholder, bos: brief.value,
             ustte: brief.getBoundingClientRect().top < metin.getBoundingClientRect().top,
             dugmeYaninda: Math.abs(dugme.getBoundingClientRect().top - brief.getBoundingClientRect().top) < 30,
             not: not ? not.textContent : '' };
  });
  k('ayrı tarif alanı var', g.var && g.gorunur);
  k('script kutusunun ÜSTÜNDE', g.ustte);
  k('AI düğmesi tarifin yanında', g.dugmeYaninda);
  // Ornekteki kelime sayisi metne bagli; onemli olan yer tutucunun bir
  // ORNEK vermesi. Sayiyi sabitlemek testi metin degisince bosuna dusuruyordu.
  k('yer tutucu ne yazılacağını anlatıyor', /AI ne yazsın/.test(g.ph) && /\d+ kelimelik/.test(g.ph), g.ph);
  k('açıklama notu var', /aşağıdaki kutuya yazıyor/.test(g.not), g.not.slice(0,50));
  k('pencere açılınca tarif boş', g.bos === '');

  // Tarif yazip uretince: tarif prompt'a BASTA giriyor, script kutusu SONUC
  await page.fill('#sc_aiBrief','Bunun ne kadar kolay olduğunu anlatan 1800 kelimelik bir script yaz');
  await page.click('#sc_ai');
  await page.waitForTimeout(800);
  const p1 = promptlar[promptlar.length-1] || '';
  k('tarif prompta giriyor', /1800 kelimelik/.test(p1), p1.slice(0,90));
  k('tarif EN BAŞTA', p1.indexOf('The creator asks for this') < p1.indexOf('Here is what the creator is planning'),
     {tarif:p1.indexOf('The creator asks for this'), baglam:p1.indexOf('Here is what the creator is planning')});
  k('ton/hedef kitle birebir uygulansın deniyor', /sets a tone or an audience, follow it exactly/.test(p1));
  k('uzunluk ALT SINIR olarak veriliyor', /treat that number as a MINIMUM/.test(p1));
  k('proje bağlamı da gidiyor', /Project: Slate tanıtımı/.test(p1));
  k('fikirler de gidiyor', /AI ile script yazmak ne kadar kolay/.test(p1));

  const sonuc = await page.evaluate(()=>({ metin: document.getElementById('sc_text').value,
    tarif: document.getElementById('sc_aiBrief').value }));
  k('sonuç script kutusuna yazıldı', sonuc.metin.indexOf('AÇILIŞ') === 0, sonuc.metin.slice(0,15));
  k('TARİF yerinde kaldı (script ile karışmıyor)', /1800 kelimelik/.test(sonuc.tarif), sonuc.tarif.slice(0,30));

  // Tarif YOKKEN eski davranis: proje + fikir baglamiyla yaziyor
  await page.evaluate(()=>{ document.getElementById('sc_aiBrief').value=''; document.getElementById('sc_text').value=''; });
  const adet = promptlar.length;
  await page.click('#sc_ai');
  await page.waitForTimeout(800);
  const p2 = promptlar[promptlar.length-1] || '';
  k('tarif olmadan da çalışıyor', promptlar.length === adet+1);
  k('tarifsizken “tarif” bölümü YOK', !/The creator asks for this/.test(p2));
  k('tarifsizken bağlam yine gidiyor', /Project: Slate tanıtımı/.test(p2));

  // Yeni pencere: tarif sifirlaniyor
  await page.evaluate(()=>{ openScript(null, { projectId:'p1' }); });
  await page.waitForTimeout(250);
  k('yeni script açınca tarif sıfırlanıyor',
     await page.evaluate(()=>document.getElementById('sc_aiBrief').value === ''));

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
