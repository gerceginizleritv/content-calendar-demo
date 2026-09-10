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
  console.log('MODAL — PROJE SECIMI + COKLU TIP');

  // Demo verisi eski surumden geliyor: concept alani yoktu, projesizler
  const g = await page.evaluate(()=>{ openModal(null,'2026-09-20');
    const alanlar = [...document.querySelectorAll('#editOverlay .field > label')].map(x=>x.textContent.trim());
    return { ilkAlan: alanlar[0], tipCoklu: getComputedStyle(document.getElementById('typeMultiWrap')).display !== 'none',
             tipTekli: getComputedStyle(document.getElementById('typeSingleWrap')).display === 'none',
             tipKutu: document.querySelectorAll('#typeChecks input').length,
             projeSecenek: [...document.getElementById('f_project').options].map(o=>o.textContent) }; });
  k('proje alanı modalın en üstünde', /Project|Proje/.test(g.ilkAlan||''), g.ilkAlan);
  k('içerik tipi kutucuklu', g.tipCoklu && g.tipTekli, g.tipKutu + ' kutucuk');
  k('proje yokken listede yalnızca "+ yeni proje"', g.projeSecenek.length === 1, g.projeSecenek.join(' | '));

  // Proje secmeden kaydetmeye calis
  const zorunlu = await page.evaluate(async ()=>{
    window.__u=null; const a=window.uyari, pr=window.sor;
    window.uyari=m=>{window.__u=m;}; window.sor=()=>null;   // yeni proje adini iptal et
    document.getElementById('f_title').value='Deneme';
    document.querySelector('#typeChecks input').checked = true;
    document.querySelector('#platformChecks input').checked = true;
    const once = events.length;
    document.getElementById('saveBtn').click();
    await new Promise(r=>setTimeout(r,200));
    window.uyari=a; window.sor=pr;
    return { eklendi: events.length - once, uyari: window.__u };
  });
  k('projesiz kayıt oluşmuyor', zorunlu.eklendi === 0, zorunlu.uyari);

  // Modalden yeni proje olustur ve kaydet: 2 tip x 2 platform = 4 kayit
  const capraz = await page.evaluate(async ()=>{
    const pr = window.sor; window.sor = ()=> 'Reels Serisi';
    document.getElementById('f_title').value = 'Bölüm 1';
    const tipler = [...document.querySelectorAll('#typeChecks input')];
    tipler.forEach(x=>x.checked=false);
    tipler.find(x=>x.value==='reels').checked = true;
    tipler.find(x=>x.value==='story').checked = true;
    const pf = [...document.querySelectorAll('#platformChecks input')];
    pf.forEach(x=>x.checked=false);
    pf.find(x=>x.value==='instagram').checked = true;
    pf.find(x=>x.value==='facebook').checked = true;
    const once = events.length;
    document.getElementById('saveBtn').click();
    await new Promise(r=>setTimeout(r,300));
    window.sor = pr;
    const yeniler = events.filter(e=>e.title==='Bölüm 1');
    return { eklendi: events.length - once,
             cift: yeniler.map(e=>e.type+'/'+e.platform).sort(),
             proje: projects.find(p=>p.name==='Reels Serisi') ? 'var' : 'yok',
             hepsiAyniProje: new Set(yeniler.map(e=>e.content.projectId)).size === 1 };
  });
  k('2 tip × 2 platform = 4 kayıt', capraz.eklendi === 4, capraz.eklendi);
  k('kombinasyonlar doğru', capraz.cift.join(' ') === 'reels/facebook reels/instagram story/facebook story/instagram', capraz.cift.join(', '));
  k('modalden yeni proje oluştu', capraz.proje === 'var');
  k('dördü de aynı projeye bağlı', capraz.hepsiAyniProje === true);

  // Proje filtresi
  const filtre = await page.evaluate(async ()=>{
    await new Promise(r=>setTimeout(r,150));
    const cip = [...document.querySelectorAll('#conceptLegend .legend-item')].map(x=>x.textContent.trim());
    return cip;
  });
  k('proje filtresinde proje adı çıkıyor', filtre.some(x=>/Reels Serisi/.test(x)), filtre.join(' | '));

  // Mevcut kaydi duzenle: tip tekli secim olmali, proje secili gelmeli
  const duzen = await page.evaluate(async ()=>{
    document.getElementById('editOverlay').classList.remove('open');
    const e = events.find(x=>x.title==='Bölüm 1');
    openModal(e);
    return { tipTekli: getComputedStyle(document.getElementById('typeSingleWrap')).display !== 'none',
             tipCokluGizli: getComputedStyle(document.getElementById('typeMultiWrap')).display === 'none',
             projeDegeri: document.getElementById('f_project').value === e.content.projectId,
             tip: document.getElementById('f_type').value === e.type };
  });
  k('düzenlemede tip tekli seçim', duzen.tipTekli && duzen.tipCokluGizli);
  k('kaydın projesi seçili geliyor', duzen.projeDegeri === true);
  k('kaydın tipi seçili geliyor', duzen.tip === true);

  // Modaldeki proje aramasi
  const ara = await page.evaluate(async ()=>{
    document.getElementById('editOverlay').classList.remove('open');
    openModal(null,'2026-09-25');
    const kutu = document.getElementById('f_projectSearch');
    kutu.value = 'reels'; kutu.dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,120));
    const a = [...document.getElementById('f_project').options].map(o=>o.textContent);
    kutu.value = 'zzzz'; kutu.dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,120));
    return { eslesen: a, bos: document.getElementById('f_projectHint').textContent };
  });
  k('modalde proje araması süzüyor', ara.eslesen.some(x=>/Reels Serisi/.test(x)) && ara.eslesen.length <= 3, ara.eslesen.join(' | '));
  k('eşleşme yoksa haber veriyor', ara.bos.length > 5, ara.bos);

  // KULLANICI HATASI: secili OLMAYAN bir projeyi aratinca liste daraliyordu
  // ama kutuda hala eski proje goruunuyordu, yani arama calismiyor gibiydi.
  const secim = await page.evaluate(async ()=>{
    // Iki proje olsun
    const pr = window.sor; window.sor = ()=> null; window.sor = pr;
    if(!projects.find(p=>p.name==='Kahve Markası')) projeEkle('Kahve Markası','', '', 'studio','');
    document.getElementById('editOverlay').classList.remove('open');
    openModal(null,'2026-09-28');
    const sel = document.getElementById('f_project');
    // Baslangic secimi BILEREK aranacak projeden baskasi yapiliyor: aksi
    // halde alfabetik sirada zaten "Kahve" seciliyor ve test kendi kendini
    // kandiriyor.
    const baska = [...sel.options].find(o=>/Reels Serisi/.test(o.textContent));
    if(baska) sel.value = baska.value;
    const ilk = sel.value;
    const kutu = document.getElementById('f_projectSearch');
    kutu.value = 'kahve'; kutu.dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,150));
    const secilenAd = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
    // Onceki secim listede kaldi mi
    const listede = [...sel.options].some(o=>o.value === ilk);
    return { ilk, secilenAd, listede, degisti: sel.value !== ilk };
  });
  k('aranan proje otomatik seçiliyor', /Kahve Markası/.test(secim.secilenAd), secim.secilenAd);
  k('seçim gerçekten değişti', secim.degisti === true);
  k('önceki seçim listede kalıyor', secim.listede === true);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
