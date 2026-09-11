const { chromium, devices } = require('./araclar');
const PORT = process.argv[2] || '8098';
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:950} });
  const hatalar=[]; page.on('pageerror', e=>hatalar.push(String(e)));
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:'+PORT+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  console.log('TERMİNE GERİ DÖNEBİLME');

  // Tarihsiz proje kur, termin sorusuna HAYIR de
  await page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('projects');
    const c=window.onayla; window.onayla=()=>false;
    openProjectNew('Tarihsiz proje');
    document.getElementById('pe_type').value='studio';
    document.getElementById('pe_type').dispatchEvent(new Event('change'));
    document.getElementById('pe_shoot').value='';
    document.getElementById('pe_save').click();
    await new Promise(r=>setTimeout(r,300)); window.onayla=c;
  });
  const bas = await page.evaluate(()=>({
    proje: projects.length, tarih: projects[0] && projects[0].shootDate,
    acik: document.getElementById('deadlineOverlay').classList.contains('open') }));
  k('tarihsiz proje kuruldu, pencere kapalı', bas.proje===1 && bas.tarih==='' && !bas.acik);

  // 1) Tablodaki bos tarih dugmesi GORUNUR mu
  const gor = await page.evaluate(()=>{
    const d = document.querySelector('.pdate.bos');
    const st = getComputedStyle(d);
    const yaz = st.color.replace(/\s/g,'');
    const saydam = /rgba?\([^)]*,0\)$/.test(yaz) || st.opacity === '0' || st.visibility === 'hidden';
    const r = d.getBoundingClientRect();
    // Ikon bir SVG; metin yerine onu ariyoruz.
    const ikon = !!d.querySelector('svg');
    // Hover kurali stil sayfasinda mi: .pdate.bos:hover cerceve veriyor.
    const hoverKenar = [...document.styleSheets].some(ss=>{
      try{ return [...ss.cssRules].some(rl=>
        rl.selectorText && /\.pdate\.bos:hover/.test(rl.selectorText)
        && /border-color/.test(rl.style.cssText)); }catch(e){ return false; }
    });
    return { saydam, ikon, hoverKenar, metin:d.textContent.trim(), kenar: st.borderStyle,
             en: Math.round(r.width), boy: Math.round(r.height), renk: st.color };
  });
  k('BOŞ TARİH DÜĞMESİ GÖRÜNÜR (fareyi getirmeden)', gor.saydam === false, gor.renk);
  // TASARIM DEGISTI. Once kesik cizgili bir "+" vardi: neyin dugmesi
  // oldugu anlasilmiyor, dolu tarihlerle ayni hizada durmadigi icin de
  // sutun dagini gorunuyordu. Yerine kucuk bir takvim isareti kondu.
  // Olculen sey ayni kaldi: dugme GORUNUR ve TIKLANABILIR mi.
  k('düğmede takvim işareti var', gor.ikon === true, gor.metin || '(ikon)');
  k('fareyle üstüne gelince çerçeve çıkıyor', gor.hoverKenar === true, gor.hoverKenar);
  k('dokunma hedefi yeterli', gor.en >= 20 && gor.boy >= 18, gor.en+'x'+gor.boy);

  // 2) Gercek tiklama (fare ustune gelmeden, dogrudan) pencereyi aciyor mu
  await page.locator('.pdate.bos').first().click();
  await page.waitForTimeout(250);
  k('tıklayınca termin penceresi açıldı', await page.evaluate(()=>document.getElementById('deadlineOverlay').classList.contains('open')));

  // 3) Baslangic tarihi buradan girilebiliyor mu
  const kaydet = await page.evaluate(async ()=>{
    document.getElementById('dlStart').value = '2026-10-05';
    document.querySelector('[data-dl-step="filmed"]').value = '2026-10-09';
    document.getElementById('dlSave').click();
    await new Promise(r=>setTimeout(r,250));
    return { shoot: projects[0].shootDate, dl: projects[0].deadlines.filmed,
             meta: document.querySelector('.pn-meta').textContent };
  });
  k('BAŞLANGIÇ TARİHİ PENCEREDEN GİRİLDİ', kaydet.shoot === '2026-10-05', kaydet.shoot);
  k('adım tarihi de kaydedildi', kaydet.dl === '2026-10-09', kaydet.dl);
  k('tabloda başlangıç görünüyor', /05/.test(kaydet.meta||''), (kaydet.meta||'').trim());

  // 4) Duzenleme penceresindeki termin dugmesi
  const duz = await page.evaluate(async ()=>{
    document.querySelector('.pname').click();
    await new Promise(r=>setTimeout(r,200));
    const gorunur = !!document.getElementById('pe_deadlines').offsetParent;
    document.getElementById('pe_deadlines').click();
    await new Promise(r=>setTimeout(r,250));
    return { gorunur, duzKapali: !document.getElementById('projectEditOverlay').classList.contains('open'),
             terminAcik: document.getElementById('deadlineOverlay').classList.contains('open'),
             baslangic: document.getElementById('dlStart').value,
             adim: document.querySelector('[data-dl-step="filmed"]').value };
  });
  k('düzenleme penceresinde termin düğmesi var', duz.gorunur === true);
  k('DÜĞME TERMİN PENCERESİNİ AÇIYOR', duz.terminAcik === true && duz.duzKapali === true);
  k('mevcut tarihler dolu geliyor', duz.baslangic === '2026-10-05' && duz.adim === '2026-10-09',
     duz.baslangic + ' / ' + duz.adim);

  // 5) Yenileyince duruyor mu
  await page.evaluate(()=>document.getElementById('dlCancel').click());
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(1400);
  const kal = await page.evaluate(()=>({ shoot: projects[0].shootDate, dl: projects[0].deadlines.filmed }));
  k('yenileyince duruyor', kal.shoot === '2026-10-05' && kal.dl === '2026-10-09', kal.shoot);

  if(hatalar.length){ hatalar.slice(0,4).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
