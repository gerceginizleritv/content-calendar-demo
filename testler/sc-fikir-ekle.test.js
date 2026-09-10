const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:900} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  page.on('dialog', d=>d.accept());
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('SCRIPT PENCERESİNDEN FİKİR EKLEME');

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
    saveProjects(); fikirler = []; saveFikirler(); scriptler=[]; saveScriptler();
    openScript(null, { projectId:'p1', title:'Bölüm 1' });
  });
  await page.waitForTimeout(300);

  // 1) HİÇ FİKİR YOKKEN de şerit görünüyor (ekleme kutusu için)
  let g = await page.evaluate(()=>({
    seritGizli: document.getElementById('sc_ideasList').closest('.sc-blok').hidden,
    sayi: document.getElementById('sc_ideasCount').textContent,
    kutuVar: !!document.getElementById('sc_newIdea'),
    ph: document.getElementById('sc_newIdea').placeholder,
    dugme: document.getElementById('sc_addIdea').textContent.trim()
  }));
  k('fikir yokken de şerit görünüyor', g.seritGizli === false);
  // Sayac artik SECIM sayisini yaziyor; "hic fikir yok" mesaji listenin isi.
  k('seçim yokken sayaç boş', g.sayi === '', g.sayi);
  k('liste "boş" diyor',
    /boş|Henüz/.test(await page.evaluate(()=>document.getElementById('sc_ideasList').textContent)));
  k('ekleme kutusu var', g.kutuVar);
  k('yer tutucu anlatıyor', /bu pencereden çıkmadan/.test(g.ph), g.ph);
  k('düğme "+ Ekle"', g.dugme === '+ Ekle', g.dugme);

  // 2) Fikir ekleniyor
  await page.fill('#sc_newIdea','Duvardaki tuğla deseni');
  await page.click('#sc_addIdea');
  await page.waitForTimeout(300);
  let r = await page.evaluate(()=>({
    adet: fikirler.length,
    metin: (fikirler[0]||{}).text,
    pid: (fikirler[0]||{}).projectId,
    listede: [...document.querySelectorAll('#sc_ideasList .sc-idea-metin')].map(x=>x.textContent),
    sayi: document.getElementById('sc_ideasCount').textContent,
    kutu: document.getElementById('sc_newIdea').value,
    acik: !document.getElementById('sc_ideasList').closest('.sc-blok').hidden,
    yerel: JSON.parse(localStorage.getItem('demo_ideas')||'[]').length
  }));
  k('fikir kaydedildi', r.adet === 1 && r.metin === 'Duvardaki tuğla deseni', r.metin);
  k('SEÇİLİ projeye bağlandı', r.pid === 'p1', r.pid);
  k('listede hemen görünüyor', r.listede.indexOf('Duvardaki tuğla deseni') !== -1, r.listede);
  // Eklenen fikir kendiliginden secili geliyor: kullanici onu script icin yaziyor.
  k('eklenen fikir seçili geliyor', /1/.test(r.sayi), r.sayi);
  k('kutu temizlendi', r.kutu === '');
  k('fikir bölümü açık kaldı', r.acik === true);
  k('tarayıcıya yazıldı', r.yerel === 1, r.yerel);

  // 3) Enter da ekliyor
  await page.fill('#sc_newIdea','Sarayın son sahibi');
  await page.press('#sc_newIdea','Enter');
  await page.waitForTimeout(300);
  k('Enter ile de ekleniyor', await page.evaluate(()=>fikirler.length === 2));

  // 4) Eklenen fikirler de SEÇİLEBİLİR oluyor
  const sec = await page.evaluate(()=>document.querySelectorAll('#sc_ideasList input[data-fikir-sec]').length);
  k('yeni fikirler de seçilebiliyor', sec === 2, sec);

  // 5) Boş metin eklemiyor
  const once = await page.evaluate(()=>fikirler.length);
  await page.fill('#sc_newIdea','   ');
  await page.click('#sc_addIdea');
  await page.waitForTimeout(200);
  k('boş fikir eklenmiyor', await page.evaluate(()=>fikirler.length) === once);

  // 6) Proje degisse de liste TUM fikirleri gosteriyor: kullanici iki
  //    cekimin fikirlerini tek scriptte birlestirebiliyor.
  await page.evaluate(()=>{ seciliProjeler.clear(); seciliProjeler.add('p2'); scriptProjeListesiCiz(); scriptFikirListesiCiz(); });
  await page.waitForTimeout(300);
  r = await page.evaluate(()=>({
    listede: [...document.querySelectorAll('#sc_ideasList .sc-idea-metin')].map(x=>x.textContent) }));
  k('başka projenin fikirleri de listede duruyor', r.listede.length === 2, r.listede);

  await page.fill('#sc_newIdea','Balat sokakları');
  await page.click('#sc_addIdea');
  await page.waitForTimeout(300);
  r = await page.evaluate(()=>({
    p2: fikirler.filter(f=>f.projectId==='p2').map(f=>f.text),
    p1: fikirler.filter(f=>f.projectId==='p1').length }));
  k('yeni fikir SEÇİLİ projeye gitti', r.p2.length === 1 && r.p2[0] === 'Balat sokakları', r.p2);
  k('önceki projenin fikirleri bozulmadı', r.p1 === 2, r.p1);

  // 7) Fikirler SAYFASINDA da görünüyor (aynı kayıt)
  await page.evaluate(()=>{ document.getElementById('scriptOverlay').classList.remove('open'); setPage('ideas'); });
  await page.waitForTimeout(400);
  const sayfada = await page.evaluate(()=>document.body.innerText.indexOf('Balat sokakları') !== -1);
  k('Fikirler sayfasında da görünüyor', sayfada === true);

  // 8) Proje secili DEGILKEN de fikir eklenebiliyor: once proje sec
  //    zorunlulugu akisi kesiyordu, fikir projesiz doguyor.
  await page.evaluate(()=>{ openScript(null, {}); });
  await page.waitForTimeout(300);
  k('proje yokken de fikir bölümü duruyor',
    await page.evaluate(()=>document.getElementById('sc_ideasList').closest('.sc-blok').hidden === false));
  const oncekiSayi = await page.evaluate(()=>fikirler.length);
  await page.fill('#sc_newIdea','Projesiz bir not');
  await page.click('#sc_addIdea');
  await page.waitForTimeout(300);
  const pz = await page.evaluate(()=>({ adet: fikirler.length, yeni: fikirler.find(f=>f.text==='Projesiz bir not') }));
  k('projesiz fikir eklenebiliyor', pz.adet === oncekiSayi + 1 && pz.yeni && pz.yeni.projectId === '', JSON.stringify(pz.yeni||{}));

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
