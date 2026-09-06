const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:900} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('FİKİRLER KUTUSU ile DRIVE ŞERİDİ ARASI');

  await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    projects = [{ id:'p1', name:'Tekfur', type:'other', keywords:'', notes:'', address:'', shootDate:'',
      script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
      deadlines:{}, createdAt:Date.now() }];
    saveProjects();
    fikirler = [{ id:'f1', text:'AI IDEA TO PROJECT TO SCRIPT', parts:[{id:'a',text:'AI IDEA TO PROJECT TO SCRIPT'}],
      projectId:'p1', sort:0, createdAt:Date.now(), updatedAt:Date.now() }];
    saveFikirler(); scriptler=[]; saveScriptler();
    openScript(null, { projectId:'p1', title:'Bölüm 1' });
  });
  await page.waitForTimeout(400);

  const r = await page.evaluate(()=>{
    // Serit yerini numarali bolume birakti; olculen sey ayni: fikir kutusu.
    const kutu = document.getElementById('sc_ideasList').closest('.sc-blok').getBoundingClientRect();
    const bar  = document.querySelector('#scriptOverlay .sc-bar').getBoundingClientRect();
    const ekle = document.querySelector('.sc-idea-ekle').getBoundingClientRect();
    const liste = document.getElementById('sc_ideasList').getBoundingClientRect();
    return { arasi: Math.round(bar.top - kutu.bottom),
             ekleAlti: Math.round(kutu.bottom - ekle.bottom),
             listeSol: Math.round(liste.left - kutu.left),
             ekleSol: Math.round(ekle.left - kutu.left),
             ekleSag: Math.round(kutu.right - ekle.right),
             cakisma: bar.top < kutu.bottom };
  });
  k('Drive şeridi fikirler kutusuyla ÇAKIŞMIYOR', r.cakisma === false);
  k('aralarında görünür boşluk var', r.arasi >= 12, r.arasi+'px');
  k('ekleme satırı kutunun ALT kenarına yapışmıyor', r.ekleAlti >= 10, r.ekleAlti+'px');
  k('liste kutunun sol kenarına yapışmıyor', r.listeSol >= 12, r.listeSol+'px');
  k('ekleme satırı kenarlardan içeride', r.ekleSol >= 12 && r.ekleSag >= 12, {sol:r.ekleSol, sag:r.ekleSag});

  await page.screenshot({ path:'ciktilar/sc-bosluk.png' });
  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
