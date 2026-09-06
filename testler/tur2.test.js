const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  const ac = async (w,h,dil)=>{
    const page = await b.newPage({ viewport:{width:w,height:h} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1400);
    await page.evaluate((d)=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage(d); }, dil);
    await page.click('#tourBtn'); await page.waitForTimeout(300);
    return page;
  };

  console.log('YENİ TUR');
  let page = await ac(1280,900,'tr');
  const adim = await page.evaluate(()=>(TOUR_STEPS_I18N.tr||[]).length);
  k('on adım var', adim === 10, adim);
  k('görsel sayısı adım sayısına eşit', await page.evaluate(()=>TOUR_VISUALS.length === TOUR_STEPS_I18N.tr.length));
  k('iki dilde de aynı sayıda adım',
     await page.evaluate(()=>TOUR_STEPS_I18N.tr.length === TOUR_STEPS_I18N.en.length));

  // Her adımı gez: görsel çiziliyor mu, metinler dolu mu, kayma var mı
  const sonuc = await page.evaluate(async ()=>{
    const cikti = [];
    for(let i=0;i<TOUR_STEPS_I18N.tr.length;i++){
      tourIndex = i; renderTourStep();
      await new Promise(r=>setTimeout(r,60));
      const modal = document.querySelector('#tourOverlay .modal');
      const svg = document.querySelector('#tourVisual svg');
      cikti.push({
        i, baslik: document.getElementById('tourTitle').textContent.trim(),
        govdeUz: document.getElementById('tourBody').textContent.trim().length,
        madde: document.querySelectorAll('#tourPoints li').length,
        svg: !!svg, svgIc: svg ? svg.innerHTML.length : 0,
        adimYazi: document.getElementById('tourStep').textContent,
        modalKayiyor: modal.scrollHeight > modal.clientHeight + 2,
        icerdeMi: modal.getBoundingClientRect().bottom <= window.innerHeight + 1,
        ileriGorunur: document.getElementById('tourNextBtn').getBoundingClientRect().bottom <= window.innerHeight + 1
      });
    }
    return cikti;
  });
  k('her adımın başlığı var', sonuc.every(x=>x.baslik.length > 5), sonuc.map(x=>x.baslik.slice(0,18)));
  k('her adımın açıklaması DETAYLI (>200 karakter)', sonuc.every(x=>x.govdeUz > 200), sonuc.map(x=>x.govdeUz));
  k('her adımda en az 3 madde', sonuc.every(x=>x.madde >= 3), sonuc.map(x=>x.madde));
  k('her adımda çizim var', sonuc.every(x=>x.svg && x.svgIc > 300), sonuc.map(x=>x.svgIc));
  k('adım sayacı Türkçe', /^ADIM 1 \/ 10$/.test(sonuc[0].adimYazi), sonuc[0].adimYazi);
  k('PENCERE hiçbir adımda kaymıyor', sonuc.every(x=>!x.modalKayiyor), sonuc.filter(x=>x.modalKayiyor).map(x=>x.i));
  k('pencere hep ekranda', sonuc.every(x=>x.icerdeMi));
  k('“İleri” hep görünür', sonuc.every(x=>x.ileriGorunur));

  // Kontrast: govde ve maddeler --text ile
  const renk = await page.evaluate(()=>{
    const g = getComputedStyle(document.getElementById('tourBody')).color;
    const m = getComputedStyle(document.querySelector('#tourPoints li')).color;
    const t = getComputedStyle(document.body).color;
    return { g, m, t };
  });
  k('gövde metni ana metin rengiyle (gri değil)', renk.g === renk.t, renk);
  k('maddeler de ana metin rengiyle', renk.m === renk.t, renk);

  // Kapatma carpisi
  k('sağ üstte kapatma × var', await page.evaluate(()=>!!document.getElementById('tourX')));
  await page.click('#tourX');
  await page.waitForTimeout(200);
  k('× turu kapatıyor', await page.evaluate(()=>!document.getElementById('tourOverlay').classList.contains('open')));

  // İleri / geri / noktalar
  await page.click('#tourBtn'); await page.waitForTimeout(250);
  await page.click('#tourNextBtn'); await page.waitForTimeout(200);
  k('İleri ikinci adıma geçiyor', await page.evaluate(()=>tourIndex === 1));
  await page.click('#tourBackBtn'); await page.waitForTimeout(200);
  k('Geri birinci adıma dönüyor', await page.evaluate(()=>tourIndex === 0));
  await page.click('.tour-dot[data-tour-git="7"]'); await page.waitForTimeout(200);
  k('noktadan istenen adıma atlanıyor', await page.evaluate(()=>tourIndex === 7));
  await page.screenshot({ path:'ciktilar/tur-1280.png' });
  await page.close();

  // İngilizce ve telefon
  page = await ac(1280,900,'en');
  const ing = await page.evaluate(()=>({ adim: document.getElementById('tourStep').textContent,
    baslik: document.getElementById('tourTitle').textContent }));
  k('İngilizce adım sayacı', /^STEP 1 \/ 10$/.test(ing.adim), ing.adim);
  k('İngilizce başlık', /idea to a published post/.test(ing.baslik), ing.baslik);
  await page.close();

  page = await ac(390,844,'tr');
  const tel = await page.evaluate(async ()=>{
    const c = [];
    for(let i=0;i<10;i++){ tourIndex=i; renderTourStep(); await new Promise(r=>setTimeout(r,50));
      const m = document.querySelector('#tourOverlay .modal');
      c.push({ kayiyor: m.scrollHeight > m.clientHeight + 2,
               icerde: m.getBoundingClientRect().bottom <= window.innerHeight + 1,
               yatay: document.documentElement.scrollWidth > window.innerWidth + 1 }); }
    return c;
  });
  k('telefonda pencere kaymıyor', tel.every(x=>!x.kayiyor));
  k('telefonda pencere ekranda', tel.every(x=>x.icerde));
  k('telefonda sayfa yana kaymıyor', tel.every(x=>!x.yatay));
  await page.screenshot({ path:'ciktilar/tur-390.png' });

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
