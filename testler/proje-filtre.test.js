const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1100} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);

  // Bircok projesi olan bir takvim: kutu ancak liste uzayinca cikiyor.
  const ADLAR = ['Ahrida Sinagogu','Binbirdirek Sarnıcı','İstanbul Arkeoloji Müzeleri + Çinili Köşk',
                 'Kariye (Chora)','Kin Kapısı (Fener Rum Patrikhanesi)','Mihrimah Sultan Camii',
                 'Özel Günler / Kanal İçeriği','Rumeli Hisarı','Süleymaniye','Zindan Han'];
  await page.evaluate((adlar)=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr'); setPage('calendar');
    projects = adlar.map((ad,i)=>({ id:'p'+i, name:ad, type:'other', script:false, shot:false,
      edited:false, published:false, permit:false, cancelled:false, deadlines:{}, keywords:'', notes:'', address:'' }));
    saveProjects();
    const bugun = new Date();
    events = adlar.map((ad,i)=>({
      id:'e'+i, date: new Date(bugun.getFullYear(), bugun.getMonth(), 1+i).toISOString().slice(0,10),
      time:'20:00', uploaded:false,
      content:{ title:ad+' videosu', type:'video', platform:'instagram', projectId:'p'+i, concept:ad }
    }));
    save(); renderLegend(); renderCal();
  }, ADLAR);
  await page.waitForTimeout(400);
  console.log('PROJE FİLTRESİ — ARAMA');

  const ac = async ()=> page.evaluate(async ()=>{
    document.querySelector('.fdrop[data-drop="concept"] .fbtn').click();
    await new Promise(r=>setTimeout(r,80));
  });
  await ac();

  // 1) Kutu gercekten gorunuyor mu (hidden display kuralina yenilebiliyor)
  const g = await page.evaluate(()=>{
    const kutu = document.getElementById('conceptSearch');
    const r = kutu.getBoundingClientRect();
    const liste = document.getElementById('conceptLegend').getBoundingClientRect();
    return { gorunur: getComputedStyle(kutu).display !== 'none' && r.width > 40,
             ph: kutu.placeholder, ustte: r.top < liste.top,
             panelIci: kutu.closest('.fpanel') === document.querySelector('.fdrop[data-drop="concept"] .fpanel') };
  });
  k('arama kutusu görünüyor', g.gorunur);
  k('kutu listenin ÜSTÜNDE', g.ustte);
  k('kutu panelin içinde', g.panelIci);
  k('yer tutucu Türkçe', g.ph === 'Proje ara', g.ph);

  // 2) Yazinca liste daraliyor
  await page.fill('#conceptSearch','kariye');
  await page.waitForTimeout(120);
  const s1 = await page.evaluate(()=>{
    const hepsi = [...document.querySelectorAll('#conceptLegend .legend-item')];
    const acik = hepsi.filter(el=>getComputedStyle(el).display !== 'none');
    return { toplam:hepsi.length, acik:acik.length, ad:acik.map(el=>el.dataset.concept),
             bosNot: !document.getElementById('conceptNoMatch').hidden };
  });
  k('arama listeyi daraltıyor', s1.acik === 1 && s1.toplam >= 10, s1.acik+'/'+s1.toplam);
  k('eşleşen doğru proje', s1.ad[0] === 'Kariye (Chora)', s1.ad.join(','));
  k('eşleşme varken "yok" notu çıkmıyor', s1.bosNot === false);

  // 3) Turkce buyuk I: "İSTANBUL" yazinca "İstanbul..." bulunuyor
  await page.fill('#conceptSearch','İSTANBUL');
  await page.waitForTimeout(120);
  const s2 = await page.evaluate(()=>[...document.querySelectorAll('#conceptLegend .legend-item')]
    .filter(el=>getComputedStyle(el).display !== 'none').map(el=>el.dataset.concept));
  k('Türkçe büyük harf araması çalışıyor', s2.length === 1 && s2[0].startsWith('İstanbul'), s2.join(','));

  // 4) Eslesme yoksa not cikiyor
  await page.fill('#conceptSearch','zzzz');
  await page.waitForTimeout(120);
  const s3 = await page.evaluate(()=>{
    const not = document.getElementById('conceptNoMatch');
    return { acik:[...document.querySelectorAll('#conceptLegend .legend-item')]
               .filter(el=>getComputedStyle(el).display !== 'none').length,
             notGorunur: getComputedStyle(not).display !== 'none', metin: not.textContent.trim() };
  });
  k('eşleşme yokken liste boş', s3.acik === 0);
  k('"bu adda proje yok" notu çıkıyor', s3.notGorunur && s3.metin === 'Bu adda proje yok', s3.metin);

  // 5) Secili proje arama disinda kalsa da listede duruyor (filtre kapatilabilsin)
  await page.fill('#conceptSearch','');
  await page.waitForTimeout(100);
  await page.evaluate(()=>{
    [...document.querySelectorAll('#conceptLegend .legend-item')]
      .find(el=>el.dataset.concept === 'Kariye (Chora)').click();
  });
  await page.waitForTimeout(150);
  await ac();  // renderLegend paneli kapatmiyor ama garantiye alalim
  await page.evaluate(()=>{ document.getElementById('conceptSearch').value='rumeli';
    document.getElementById('conceptSearch').dispatchEvent(new Event('input')); });
  await page.waitForTimeout(120);
  const s4 = await page.evaluate(()=>[...document.querySelectorAll('#conceptLegend .legend-item')]
    .filter(el=>getComputedStyle(el).display !== 'none').map(el=>el.dataset.concept));
  k('SEÇİLİ proje aramaya uymasa da listede kalıyor', s4.includes('Kariye (Chora)'), s4.join(','));
  k('aranan da listede', s4.includes('Rumeli Hisarı'), s4.join(','));

  // 6) Panel kapaninca arama sifirlaniyor
  await page.evaluate(()=>{ document.body.click(); });
  await page.waitForTimeout(120);
  await ac();
  const s5 = await page.evaluate(()=>({
    deger: document.getElementById('conceptSearch').value,
    acik: [...document.querySelectorAll('#conceptLegend .legend-item')]
            .filter(el=>getComputedStyle(el).display !== 'none').length }));
  k('panel kapanınca arama sıfırlanıyor', s5.deger === '' && s5.acik >= 10, '"'+s5.deger+'" / '+s5.acik);

  // 7) YATAY KAYDIRMA YOK (kullanicinin gordugu cubuk)
  const kay = await page.evaluate(()=>{
    const l = document.getElementById('conceptLegend');
    const p = document.querySelector('.fdrop[data-drop="concept"] .fpanel');
    return { listeX: l.scrollWidth - l.clientWidth, panelX: p.scrollWidth - p.clientWidth,
             ovx: getComputedStyle(l).overflowX, dikey: l.scrollHeight > l.clientHeight };
  });
  k('listede YATAY kaydırma yok', kay.listeX <= 0 && kay.ovx === 'hidden', 'taşma '+kay.listeX+'px, overflow-x '+kay.ovx);
  k('panelde yatay kaydırma yok', kay.panelX <= 0, kay.panelX+'px');
  k('liste dikey kaydırılıyor (uzun liste)', kay.dikey === true);

  // 8) Kayit sayaci
  const say = await page.evaluate(()=>{
    const el = [...document.querySelectorAll('#conceptLegend .legend-item')]
      .find(x=>x.dataset.concept === 'Rumeli Hisarı');
    return el.querySelector('.lcount') ? el.querySelector('.lcount').textContent : null;
  });
  k('her projenin kayıt sayısı yazıyor', say === '1', String(say));

  // 9) Az proje varken kutu HİÇ çıkmıyor
  await page.evaluate(()=>{
    projects = projects.slice(0,3); saveProjects();
    events = events.slice(0,3); save(); renderLegend(); renderCal();
  });
  await page.waitForTimeout(200);
  await ac();
  const s6 = await page.evaluate(()=>{
    const kutu = document.getElementById('conceptSearch');
    return { gizli: getComputedStyle(kutu).display === 'none',
             adet: document.querySelectorAll('#conceptLegend .legend-item').length };
  });
  k('kısa listede arama kutusu çıkmıyor', s6.gizli === true, s6.adet+' proje');

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
