const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); setPage('projects'); });
  await page.waitForTimeout(300);
  console.log('PROJE SIRALAMASI');

  const r = await page.evaluate(async ()=>{
    const c = window.onayla; window.onayla = ()=>Promise.resolve(false);
    // Tek pencere: "Yeni proje" de "Projeyi duzenle" de ayni yer.
    const kur = async (ad, tarih)=>{
      openProjectNew(ad);
      document.getElementById('pe_type').value='studio';
      document.getElementById('pe_type').dispatchEvent(new Event('change'));
      document.getElementById('pe_shoot').value = tarih || '';
      document.getElementById('pe_save').click();
      await new Promise(r=>setTimeout(r,200));
    };
    // Ekleme sirasi BILEREK tarih sirasindan farkli
    await kur('Uzak proje',  '2026-12-01');
    await kur('Yakin proje', '2026-09-05');
    await kur('Orta proje',  '2026-10-10');
    await kur('Tarihsiz',    '');
    await new Promise(r=>setTimeout(r,400));
    window.onayla = c;
    const ad = ()=> [...document.querySelectorAll('.proj-table tbody .pname')].map(x=>x.textContent.trim());
    const sira1 = ad();

    // Yakin projeye BITMEMIS bir termin ver: sira ona gore degismeli
    const uzak = projects.find(p=>p.name==='Uzak proje');
    uzak.deadlines.script = '2026-09-02';   // en yakin, bitmemis
    saveProjects(); renderProjects();
    await new Promise(r=>setTimeout(r,250));
    const sira2 = ad();

    // Ayni adimi BITMIS isaretle: artik sirayi belirlememeli
    uzak.script = true;
    saveProjects(); renderProjects();
    await new Promise(r=>setTimeout(r,250));
    return { sira1, sira2, sira3: ad() };
  });
  console.log('  ekleme sırası: Uzak, Yakın, Orta, Tarihsiz');
  k('TARİHE GÖRE SIRALI (yakından uzağa)',
     JSON.stringify(r.sira1) === JSON.stringify(['Yakin proje','Orta proje','Uzak proje','Tarihsiz']),
     r.sira1.join(' → '));
  k('tarihsiz proje en sonda', r.sira1[r.sira1.length-1] === 'Tarihsiz');
  k('BİTMEMİŞ TERMİN SIRAYI ÖNE ÇEKİYOR', r.sira2[0] === 'Uzak proje', r.sira2.join(' → '));
  k('bitmiş adım sırayı belirlemiyor', r.sira3[0] === 'Yakin proje', r.sira3.join(' → '));

  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
