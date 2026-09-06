const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:1000} });
  const hatalar=[]; page.on('pageerror', e=>hatalar.push(String(e)));
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  console.log('TAKVİMDEN "+ YENİ PROJE" AKIŞI');

  const r = await page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setPage('calendar');
    const oncekiProje = projects.length, oncekiKayit = events.length;
    // Takvimden yeni giris
    document.getElementById('addBtn').click();
    await new Promise(r=>setTimeout(r,250));
    const sel = document.getElementById('f_project');
    const secenekler = [...sel.options].map(o=>o.value+' | '+o.textContent);
    const baslangicSecim = sel.value;
    // "+ yeni proje" sec
    sel.value = YENI_PROJE;
    sel.dispatchEvent(new Event('change'));
    // Zorunlu alanlari doldur
    document.getElementById('f_title').value = 'Takvimden gelen kayıt';
    const bugun = new Date(); const p2=n=>String(n).padStart(2,'0');
    document.getElementById('f_date').value = `${bugun.getFullYear()}-${p2(bugun.getMonth()+1)}-${p2(bugun.getDate())}`;
    document.getElementById('f_time').value = '18:00';
    // Platform secimi artik ZORUNLU (ve proje olusmadan once dogrulaniyor);
    // test eskiden hic platform secmiyordu.
    const pf = document.querySelector('#platformChecks input');
    if(pf && !pf.checked){ pf.checked = true; pf.dispatchEvent(new Event('change', {bubbles:true})); }
    const tp = document.querySelector('#typeChecks input');
    if(tp && !tp.checked){ tp.checked = true; tp.dispatchEvent(new Event('change', {bubbles:true})); }
    // prompt: proje adi
    const eskiPrompt = window.sor; window.__soruldu = false;
    window.sor = (m)=>{ window.__soruldu = true; return 'Takvimden kurulan proje'; };
    const uyarilar = []; const eskiAlert = window.uyari; window.uyari = m=>uyarilar.push(m);
    document.getElementById('saveBtn').click();
    await new Promise(r=>setTimeout(r,350));
    window.sor = eskiPrompt; window.uyari = eskiAlert;
    return { oncekiProje, oncekiKayit, secenekler, baslangicSecim,
             soruldu: window.__soruldu, uyarilar,
             projeSayisi: projects.length, kayitSayisi: events.length,
             projeAdlari: projects.map(p=>p.name),
             modalAcik: document.getElementById('editOverlay').classList.contains('open'),
             depo: (JSON.parse(localStorage.getItem('demo_projects')||'[]')).length };
  });
  console.log('  seçenekler:', JSON.stringify(r.secenekler));
  console.log('  uyarılar:', JSON.stringify(r.uyarilar));
  k('proje adı soruldu', r.soruldu === true);
  k('PROJE EKLENDİ', r.projeSayisi === r.oncekiProje+1, r.oncekiProje+' → '+r.projeSayisi+' ('+r.projeAdlari.join(', ')+')');
  k('proje tarayıcıya kaydedildi', r.depo === r.projeSayisi, 'depoda '+r.depo);
  k('kayıt da oluştu', r.kayitSayisi > r.oncekiKayit, r.oncekiKayit+' → '+r.kayitSayisi);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,4).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
