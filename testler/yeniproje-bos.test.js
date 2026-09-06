// Platform secmeden kaydetmeye calisinca GERIDE BOS PROJE KALMAMALI.
const { chromium } = require('./araclar');
(async()=>{
  const b = await chromium.launch({ });
  const p = await b.newPage({ viewport:{width:1400,height:950} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  await p.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await p.route('**/goatcounter**', r=>r.abort());
  await p.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('calendar'); });
  await p.waitForTimeout(300);

  console.log('PLATFORM SEÇİLMEDEN KAYDETME');
  const r = await p.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    const oncekiProje = projects.length, oncekiKayit = events.length;
    document.getElementById('addBtn').click();
    await bekle(250);
    const sel = document.getElementById('f_project');
    sel.value = '__yeni__'; sel.dispatchEvent(new Event('change'));
    document.getElementById('f_title').value = 'Platformsuz deneme';
    const g = new Date(), p2 = n=>String(n).padStart(2,'0');
    document.getElementById('f_date').value = `${g.getFullYear()}-${p2(g.getMonth()+1)}-${p2(g.getDate())}`;
    document.getElementById('f_time').value = '18:00';
    // Platform KASITLI olarak secilmiyor.
    document.querySelectorAll('#platformChecks input:checked').forEach(i=>{ i.checked=false; });
    let soruldu = false; const eskiPrompt = window.sor;
    window.sor = ()=>{ soruldu = true; return 'Olmaması gereken proje'; };
    const uyari = []; const eskiAlert = window.uyari; window.uyari = m=>uyari.push(m);
    document.getElementById('saveBtn').click();
    await bekle(350);
    window.sor = eskiPrompt; window.uyari = eskiAlert;
    return { oncekiProje, oncekiKayit, soruldu, uyari,
             projeSayisi: projects.length, kayitSayisi: events.length,
             depo: (JSON.parse(localStorage.getItem('demo_projects')||'[]')).length };
  });

  k('uyarı verildi', r.uyari.length === 1 && /platform/i.test(r.uyari[0]), r.uyari.join(' | '));
  k('kayıt oluşmadı', r.kayitSayisi === r.oncekiKayit, r.oncekiKayit + ' → ' + r.kayitSayisi);
  k('BOŞ PROJE OLUŞMADI', r.projeSayisi === r.oncekiProje, r.oncekiProje + ' → ' + r.projeSayisi);
  k('proje adı hiç sorulmadı', r.soruldu === false, r.soruldu);
  k('tarayıcıya da yazılmadı', r.depo === r.oncekiProje, r.depo);

  console.log(hata ? '\n'+hata+' SORUN' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
