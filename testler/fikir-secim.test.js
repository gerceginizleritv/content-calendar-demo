const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:900} });
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
  await page.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
    contentType:'application/json', body: JSON.stringify({models:[{name:'models/gemini-3.7-flash'}]})}));
  const promptlar = [];
  await page.route('**generativelanguage.googleapis.com/v1beta/models/**', async r=>{
    promptlar.push(JSON.parse(r.request().postData()).contents[0].parts[0].text);
    await r.fulfill({status:200,contentType:'application/json',
      body: JSON.stringify({candidates:[{content:{parts:[{text:'YAZILDI'}]}}]})});
  });
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('FİKİR SEÇİMİ → SCRIPT');

  await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    projects = [
      { id:'p1', name:'Tekfur', type:'other', keywords:'', notes:'', address:'', shootDate:'',
        script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
        deadlines:{}, createdAt:Date.now() },
      { id:'p2', name:'Balat', type:'other', keywords:'', notes:'', address:'', shootDate:'',
        script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
        deadlines:{}, createdAt:Date.now() }
    ];
    saveProjects();
    fikirler = [
      { id:'f1', text:'Duvardaki tuğla deseni', parts:[{id:'a',text:'Duvardaki tuğla deseni'},
        {id:'b',text:'Sarayın son sahibi'}], projectId:'p1', sort:0, createdAt:Date.now(), updatedAt:Date.now() },
      { id:'f2', text:'Bahçedeki kuyu', parts:[{id:'c',text:'Bahçedeki kuyu'}],
        projectId:'p1', sort:1, createdAt:Date.now(), updatedAt:Date.now() },
      { id:'f3', text:'SEÇİLMEYEN FİKİR', parts:[{id:'d',text:'SEÇİLMEYEN FİKİR'}],
        projectId:'p1', sort:2, createdAt:Date.now(), updatedAt:Date.now() }
    ];
    saveFikirler(); scriptler=[]; saveScriptler();
    openScript(null, { projectId:'p1', title:'Bölüm 1' });
  });
  await page.waitForTimeout(400);

  let g = await page.evaluate(()=>({
    kutular: document.querySelectorAll('#sc_ideasList input[data-fikir-sec]').length,
    aiDugme: document.querySelectorAll('#sc_ideasList [data-fikir-ai]').length,
    tumu: !document.getElementById('sc_ideasAll').hidden,
    tumuMetin: document.getElementById('sc_ideasAll').textContent.trim(),
    secimNotu: document.getElementById('sc_ideaPicked').textContent,
    aiNot: document.querySelector('.sc-ai-not').textContent
  }));
  k('her fikrin SEÇİM KUTUSU var', g.kutular === 3, g.kutular);
  k('fikir yanındaki ✨ düğmesi KALDIRILDI', g.aiDugme === 0);
  k('“Tümünü seç” var', g.tumu && /Tümünü seç/.test(g.tumuMetin), g.tumuMetin);
  k('hiç seçilmemişken uyarıyor', /Hiç fikir seçilmedi/.test(g.secimNotu), g.secimNotu);
  k('açıklama önce işaretle diyor', /işaretle/.test(g.aiNot), g.aiNot.slice(0,50));

  // İki fikri seç
  await page.check('#sc_ideasList input[data-fikir-sec="f1"]');
  await page.check('#sc_ideasList input[data-fikir-sec="f2"]');
  await page.waitForTimeout(200);
  g = await page.evaluate(()=>({ not: document.getElementById('sc_ideaPicked').textContent,
    sinif: document.getElementById('sc_ideaPicked').className }));
  k('seçim sayısı yazıyor', /2 fikir seçili/.test(g.not), g.not);
  k('seçim notu vurgulu', /var/.test(g.sinif), g.sinif);

  // Tarif yaz ve üret
  await page.fill('#sc_aiBrief','Seçtiğim fikirlerin yer aldığı 1400 kelimelik bir script yaz');
  await page.click('#sc_ai');
  await page.waitForTimeout(900);
  const p1 = promptlar[promptlar.length-1] || '';
  k('SEÇİLEN fikirler MALZEME olarak gidiyor', /must be BUILT ON these ideas/.test(p1));
  k('birinci seçilen fikir prompta girdi', /Duvardaki tuğla deseni/.test(p1));
  k('birleşik kartın ikinci parçası da girdi', /Sarayın son sahibi/.test(p1));
  k('ikinci seçilen fikir de girdi', /Bahçedeki kuyu/.test(p1));
  k('SEÇİLMEYEN fikir malzemeye girmedi', !/SEÇİLMEYEN FİKİR/.test(p1));
  k('tarif de prompta girdi', /1400 kelimelik/.test(p1));
  k('tarif EN BAŞTA', p1.indexOf('The creator asks for this') === 0);
  k('metin script kutusuna yazıldı', await page.evaluate(()=>document.getElementById('sc_text').value === 'YAZILDI'));

  // Hiç seçilmezse: eski davranış (hepsi arka plan)
  await page.evaluate(()=>{ seciliFikirler.clear(); scriptFikirListesiCiz();
    document.getElementById('sc_text').value=''; });
  await page.waitForTimeout(200);
  await page.click('#sc_ai');
  await page.waitForTimeout(900);
  const p2 = promptlar[promptlar.length-1] || '';
  k('seçim yokken hepsi ARKA PLAN olarak gidiyor',
     /Ideas the creator collected/.test(p2) && !/must be BUILT ON/.test(p2));
  k('seçim yokken bütün fikirler bağlamda', /SEÇİLMEYEN FİKİR/.test(p2));

  // "Tümünü seç" çalışıyor
  await page.click('#sc_ideasAll');
  await page.waitForTimeout(200);
  let n = await page.evaluate(()=>document.getElementById('sc_ideaPicked').textContent);
  k('“Tümünü seç” hepsini işaretliyor', /3 fikir seçili/.test(n), n);
  await page.click('#sc_ideasAll');
  await page.waitForTimeout(200);
  n = await page.evaluate(()=>document.getElementById('sc_ideaPicked').textContent);
  k('tekrar basınca hepsini bırakıyor', /Hiç fikir seçilmedi/.test(n), n);

  // Proje degisince secim ARTIK SIFIRLANMIYOR: fikirler projeye bagli
  // degil, kullanici iki cekimin fikrini bir arada tutabiliyor.
  await page.check('#sc_ideasList input[data-fikir-sec="f1"]');
  await page.evaluate(()=>{ seciliProjeler.clear(); seciliProjeler.add('p2'); scriptProjeListesiCiz(); });
  await page.waitForTimeout(300);
  k('proje değişince fikir seçimi KORUNUYOR', await page.evaluate(()=>seciliFikirler.size === 1));

  // Yeni pencere: seçim sıfır
  await page.evaluate(()=>openScript(null, { projectId:'p1' }));
  await page.waitForTimeout(300);
  k('yeni script açınca seçim sıfır', await page.evaluate(()=>seciliFikirler.size === 0));

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
