const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  const ac = async ()=>{
    const page = await b.newPage({ viewport:{width:1250,height:1000} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('calendar'); });
    return page;
  };
  const doldur = `
    const p2=n=>String(n).padStart(2,'0'); const bg=new Date();
    document.getElementById('f_title').value='Takvimden gelen kayıt';
    document.getElementById('f_date').value=\`\${bg.getFullYear()}-\${p2(bg.getMonth()+1)}-\${p2(bg.getDate())}\`;
    document.getElementById('f_time').value='18:00';`;

  console.log('A) PLATFORM + TÜR SEÇİLİ, "+ yeni proje"');
  let page = await ac();
  let r = await page.evaluate(async (doldur)=>{
    const onceP=projects.length, onceK=events.length;
    document.getElementById('addBtn').click(); await new Promise(r=>setTimeout(r,250));
    eval(doldur);
    document.getElementById('f_project').value = YENI_PROJE;
    document.querySelector('#platformChecks input[value="youtube"]').checked = true;
    document.querySelector('#platformChecks input[value="youtube"]').dispatchEvent(new Event('change'));
    const tp = document.querySelector('#typeChecks input[value="video"]'); if(tp){ tp.checked=true; tp.dispatchEvent(new Event('change')); }
    const up=[]; const ea=window.uyari; window.uyari=m=>up.push(m);
    window.sor = ()=> 'Takvimden kurulan proje';
    document.getElementById('saveBtn').click(); await new Promise(r=>setTimeout(r,350));
    window.uyari=ea;
    return { uyarilar:up, proje:projects.length-onceP, kayit:events.length-onceK,
             ad:(projects[projects.length-1]||{}).name,
             kapandi:!document.getElementById('editOverlay').classList.contains('open'),
             bagli:(events[events.length-1]||{}).content.projectId === (projects[projects.length-1]||{}).id };
  }, doldur);
  k('proje oluştu', r.proje === 1, r.ad);
  k('kayıt oluştu', r.kayit === 1, r.kayit+' kayıt');
  k('kayıt projeye bağlandı', r.bagli === true);
  k('modal kapandı', r.kapandi === true, JSON.stringify(r.uyarilar));
  await page.close();

  console.log('B) PLATFORM SEÇMEDEN KAYDET → UYARI → PLATFORM SEÇ → TEKRAR KAYDET');
  page = await ac();
  r = await page.evaluate(async (doldur)=>{
    const onceP=projects.length;
    document.getElementById('addBtn').click(); await new Promise(r=>setTimeout(r,250));
    eval(doldur);
    document.getElementById('f_project').value = YENI_PROJE;
    const up=[]; const ea=window.uyari; window.uyari=m=>up.push(m);
    let kacKezSoruldu=0; window.sor = ()=>{ kacKezSoruldu++; return 'Takvimden kurulan proje'; };
    document.getElementById('saveBtn').click(); await new Promise(r=>setTimeout(r,300));
    const ilkTur = { proje:projects.length-onceP, secim:document.getElementById('f_project').value,
                     secimMetni:(document.getElementById('f_project').selectedOptions[0]||{}).textContent };
    // simdi platformu sec ve tekrar kaydet
    document.querySelector('#platformChecks input[value="youtube"]').checked = true;
    document.querySelector('#platformChecks input[value="youtube"]').dispatchEvent(new Event('change'));
    const tp=document.querySelector('#typeChecks input[value="video"]'); if(tp){ tp.checked=true; tp.dispatchEvent(new Event('change')); }
    document.getElementById('saveBtn').click(); await new Promise(r=>setTimeout(r,350));
    window.uyari=ea;
    return { ilkTur, kacKezSoruldu, uyarilar:up, toplamProje:projects.length-onceP,
             adlar:projects.map(p=>p.name), kayit:events.length };
  }, doldur);
  console.log('  ilk turda seçim:', JSON.stringify(r.ilkTur));
  // Eskiden proje dogrulamadan ONCE kuruluyordu; kullanici vazgecerse
  // geride bos proje kaliyordu. Dogrulama one alindi: ilk turda proje
  // HIC olusmuyor. Asil sozler (ad tekrar sorulmasin, kopya proje
  // olusmasin) asagida ayrica sinaniyor.
  k('ilk turda proje HENÜZ oluşmuyor', r.ilkTur.proje === 0, r.ilkTur.proje);
  k('ikinci kaydette proje adı TEKRAR SORULMUYOR', r.kacKezSoruldu === 1, r.kacKezSoruldu+' kez soruldu');
  k('TEK proje oluştu (kopya yok)', r.toplamProje === 1, r.toplamProje+' → '+r.adlar.join(', '));
  await page.close();

  console.log('C) PROJE ADI SORULUNCA VAZGEÇ');
  page = await ac();
  r = await page.evaluate(async (doldur)=>{
    const onceP=projects.length, onceK=events.length;
    document.getElementById('addBtn').click(); await new Promise(r=>setTimeout(r,250));
    eval(doldur);
    document.getElementById('f_project').value = YENI_PROJE;
    const pf = document.querySelector('#platformChecks input[value="youtube"]');
    pf.checked = true; pf.dispatchEvent(new Event('change', {bubbles:true}));
    // Tur de secilmeli: yoksa is proje adi sorulmadan tur uyarisinda duruyor
    // ve senaryonun sinamak istedigi "vazgecme" hic yasanmiyor.
    const tp = document.querySelector('#typeChecks input[value="video"]');
    if(tp){ tp.checked = true; tp.dispatchEvent(new Event('change', {bubbles:true})); }
    const up=[]; const ea=window.uyari; window.uyari=m=>up.push(m);
    let soruldu = false;
    window.sor = ()=>{ soruldu = true; return null; };      // vazgec
    document.getElementById('saveBtn').click(); await new Promise(r=>setTimeout(r,300));
    window.uyari=ea;
    return { proje:projects.length-onceP, kayit:events.length-onceK, uyarilar:up, soruldu,
             acik:document.getElementById('editOverlay').classList.contains('open') };
  }, doldur);
  k('proje adı gerçekten soruldu', r.soruldu === true, r.soruldu);
  k('vazgeçince proje oluşmuyor', r.proje === 0, r.proje);
  k('vazgeçince kayıt da oluşmuyor', r.kayit === 0, r.kayit);
  k('neden olmadığı söyleniyor', r.uyarilar.length > 0, JSON.stringify(r.uyarilar));
  k('modal açık kalıyor (veri kaybolmasın)', r.acik === true);
  await page.close();

  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
