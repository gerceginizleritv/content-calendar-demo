const { chromium } = require('./araclar');
(async () => {
  const D = process.argv[2];
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:950} });
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('PROJELER');

  // Sekmeler: fikir ve script projeden bagimsiz birer sayfa; mekanlar da
  // eski lokasyon takibinden tasindi. Projeler EN USTTE: cekim asil orada
  // yurutuluyor.
  k('altı sekme var', await page.evaluate(()=> document.querySelectorAll('.tab').length === 6));
  k('açılışta projeler sekmesi', await page.evaluate(()=> document.getElementById('projectsPage').hidden === false));
  k('sekmelerde ikon var', await page.evaluate(()=> document.querySelectorAll('.tab .tab-ico').length === 6));
  k('sıra: fikir, mekan, proje…', await page.evaluate(()=>
    [...document.querySelectorAll('.rail-nav .tab')].map(x=>x.id).join(',')
      === 'tabIdeas,tabPlaces,tabProjects,tabScripts,tabCalendar,tabTemplates'))

  await page.click('#tabCalendar'); await page.waitForTimeout(200);
  k('takvim sekmesine geçiliyor', await page.evaluate(()=> document.getElementById('calendarPage').hidden === false));
  await page.click('#tabProjects'); await page.waitForTimeout(300);

  // Demo verisindeki eski "concept" alanlari projeye cevrilmis olmali (bu demoda yok, bos olmali)
  const bas = await page.evaluate(()=>({ proje: projects.length, metin: document.getElementById('projectList').textContent.trim().slice(0,40) }));
  k('proje yokken açıklayıcı metin var', bas.proje === 0 && bas.metin.length > 10, bas.metin);

  // Proje olustur (yeni form: ad + tur + cekim tarihi; anahtar kelime yok)
  const olus = await page.evaluate(async ()=>{
    document.getElementById('p_type').value = 'studio';
    document.getElementById('p_type').dispatchEvent(new Event('change'));
    document.getElementById('p_name').value = 'Güz Stüdyo Çekimi';
    document.getElementById('p_shoot').value = '2026-09-14';
    document.getElementById('p_add').click();
    await new Promise(r=>setTimeout(r,200));
    return { adet: projects.length, satir: document.querySelectorAll('.proj-table tbody tr').length,
             ad: projects[0] && projects[0].name, cekim: projects[0] && projects[0].shootDate,
             adim: document.querySelectorAll('.proj-table tbody tr .pflag').length,
             formTemiz: document.getElementById('p_name').value === '' };
  });
  k('proje oluştu', olus.adet === 1 && olus.satir === 1, olus.ad);
  k('çekim tarihi kaydedildi', olus.cekim === '2026-09-14', olus.cekim);
  k('yedi takip adımı var', olus.adim === 7, olus.adim);
  k('form temizlendi', olus.formTemiz === true);

  const mukerrer = await page.evaluate(async ()=>{
    window.__uyari=null; const eskiAlert = window.uyari; window.uyari = m=>{ window.__uyari=m; };
    document.getElementById('p_name').value = 'güz stüdyo çekimi';
    document.getElementById('p_add').click();
    await new Promise(r=>setTimeout(r,150));
    window.uyari = eskiAlert;
    return { adet: projects.length, uyari: window.__uyari };
  });
  k('aynı ad ikinci kez eklenmiyor', mukerrer.adet === 1, mukerrer.uyari);

  const damga = await page.evaluate(async ()=>{
    document.querySelector('.pflag').click();
    await new Promise(r=>setTimeout(r,150));
    return { script: projects[0].script, gorsel: document.querySelector('.pflag').classList.contains('on') };
  });
  k('damgaya tıklayınca işaretleniyor', damga.script === true && damga.gorsel === true);

  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(1400);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  const kalici = await page.evaluate(()=>({ adet: projects.length, script: projects[0] && projects[0].script,
    sayfa: document.getElementById('projectsPage').hidden === false }));
  k('yenileyince proje duruyor', kalici.adet === 1 && kalici.script === true);
  k('sekme seçimi hatırlandı', kalici.sayfa === true);

  const ara = await page.evaluate(async ()=>{
    document.getElementById('p_search').value = 'stüdyo';
    document.getElementById('p_search').dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,120));
    return document.querySelectorAll('.proj-table tbody tr').length;
  });
  k('türe göre arama', ara === 1, ara);
  const ara2 = await page.evaluate(async ()=>{
    document.getElementById('p_search').value = 'zzzz';
    document.getElementById('p_search').dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,120));
    return { satir: document.querySelectorAll('.proj-table tbody tr').length,
             metin: document.getElementById('projectList').textContent.trim().slice(0,30) };
  });
  k('eşleşme yoksa haber veriyor', ara2.satir === 0 && ara2.metin.length > 5, ara2.metin);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await page.screenshot({ path: D+'/projeler.png' });
  await b.close(); process.exit(hata?1:0);
})();
