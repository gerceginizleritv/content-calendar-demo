const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };

  for(const [ad, w, h] of [['masaüstü 1280x800',1280,800], ['dar 1200x700',1200,700], ['telefon 390x844',390,844]]){
    const page = await b.newPage({ viewport:{width:w,height:h} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1400);
    await page.evaluate(()=>{
      document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
      setLanguage('tr');
      projects = [{ id:'p1', name:'01_AI SCRIPT', type:'other', keywords:'', notes:'', address:'',
        shootDate:'', script:false, shot:false, edited:false, published:false, permit:false,
        cancelled:false, deadlines:{}, createdAt:Date.now() }];
      saveProjects();
      fikirler = [{ id:'f1', text:'bir fikir', parts:[{id:'a',text:'bir fikir'}], projectId:'p1',
        sort:0, createdAt:Date.now(), updatedAt:Date.now() }];
      saveFikirler(); scriptler=[]; saveScriptler();
      openScript(null, { projectId:'p1', title:'AI IDEA TO PROJECT TO SCRIPT' });
      // UZUN script: kaydirma gercekten gereksin
      const ta = document.getElementById('sc_text');
      ta.value = Array.from({length:400}, (_,i)=>'Satır '+(i+1)+' — uzun bir script metni.').join('\n');
      ta.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(400);

    const r = await page.evaluate(()=>{
      const modal = document.querySelector('#scriptOverlay .modal');
      const ta = document.getElementById('sc_text');
      const kaydet = document.getElementById('sc_save');
      const ov = document.getElementById('scriptOverlay');
      return {
        modalKayiyor: modal.scrollHeight > modal.clientHeight + 2,
        modalYuk: Math.round(modal.getBoundingClientRect().height),
        ekranYuk: window.innerHeight,
        modalGen: Math.round(modal.getBoundingClientRect().width),
        icerdeMi: modal.getBoundingClientRect().bottom <= window.innerHeight + 1
                  && modal.getBoundingClientRect().top >= -1,
        kaydetGorunur: kaydet.getBoundingClientRect().bottom <= window.innerHeight + 1
                       && kaydet.getBoundingClientRect().top >= 0,
        metinKayiyor: ta.scrollHeight > ta.clientHeight + 2,
        metinYuk: Math.round(ta.getBoundingClientRect().height),
        sayfaKayiyor: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });
    console.log('  ── '+ad);
    k('    pencerenin KENDİSİ kaymıyor', r.modalKayiyor === false, {modal:r.modalYuk, ekran:r.ekranYuk});
    k('    pencere tamamen ekranda', r.icerdeMi === true);
    k('    “Kaydet” düğmesi görünür', r.kaydetGorunur === true);
    k('    UZUN script metin kutusunda kayıyor', r.metinKayiyor === true, r.metinYuk+'px');
    k('    metin kutusu boğulmadı (yeterli yükseklik)', r.metinYuk >= 110, r.metinYuk+'px');
    k('    sayfa yana kaymıyor', r.sayfaKayiyor === false);
    if(w >= 1280) k('    pencere geniş', r.modalGen >= 900, r.modalGen+'px');
    await page.screenshot({ path:'ciktilar/sc-'+w+'.png' });
    await page.close();
  }

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
