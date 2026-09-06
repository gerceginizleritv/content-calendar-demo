const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const ctx = await b.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx.newPage();
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2200);   // otomatik popup bu arada cikiyor
  console.log('BEKLEYENLER POPUP’I');

  // Uzun bir liste kur ki kaydirma gercekten olsun
  await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    const bugun = new Date();
    events = Array.from({length:40}, (_,i)=>({
      id:'e'+i, type:'video', platform:'youtube', title:'Bekleyen kayıt '+(i+1),
      date: new Date(bugun.getFullYear(), bugun.getMonth(), 1+(i%28)).toISOString().slice(0,10),
      time:'20:00', uploaded:false, content:{} }));
    save();
    try{ sessionStorage.removeItem('demo_pending_dismissed'); }catch(e){}
    pendingAutoShown = false;
    showPendingPopup(true);
  });
  await page.waitForTimeout(300);

  // 1) Carpi gorunuyor ve baslikla birlikte SABIT duruyor
  const g = await page.evaluate(()=>{
    const x = document.getElementById('pendingX');
    const modal = document.querySelector('#pendingOverlay .modal');
    const r = x.getBoundingClientRect(), m = modal.getBoundingClientRect();
    return { acik: document.getElementById('pendingOverlay').classList.contains('open'),
             gorunur: getComputedStyle(x).display !== 'none',
             sagUst: (m.right - r.right) < 40 && (r.top - m.top) < 40,
             baslik: x.title, aria: x.getAttribute('aria-label'),
             kaydirilabilir: modal.scrollHeight > modal.clientHeight + 20,
             yapiskan: getComputedStyle(document.querySelector('#pendingOverlay .modal-head')).position };
  });
  k('popup açıldı', g.acik);
  k('× görünüyor', g.gorunur);
  k('× SAĞ ÜST köşede', g.sagUst);
  k('başlık şeridi yapışkan', g.yapiskan === 'sticky', g.yapiskan);
  k('liste gerçekten uzun (kaydırma var)', g.kaydirilabilir === true);
  k('× ipucu Türkçe', g.baslik === 'Kapat' && g.aria === 'Kapat', {t:g.baslik, a:g.aria});

  // 2) EN ALTA KAYDIRINCA DA carpi gorunur kaliyor
  const alt = await page.evaluate(()=>{
    const modal = document.querySelector('#pendingOverlay .modal');
    modal.scrollTop = modal.scrollHeight;
    const r = document.getElementById('pendingX').getBoundingClientRect();
    const m = modal.getBoundingClientRect();
    return { ustunde: r.top >= m.top - 2 && r.bottom <= m.bottom, yuk: Math.round(r.height) };
  });
  k('aşağı kaydırınca × hâlâ ekranda', alt.ustunde && alt.yuk > 20, alt);

  // 3) Carpi kapatiyor
  await page.evaluate(()=>{ document.querySelector('#pendingOverlay .modal').scrollTop = 0; });
  await page.click('#pendingX');
  await page.waitForTimeout(200);
  const kapandi = await page.evaluate(()=>({
    acik: document.getElementById('pendingOverlay').classList.contains('open'),
    isaret: sessionStorage.getItem('demo_pending_dismissed')
  }));
  k('× kapatıyor', kapandi.acik === false);
  k('kapatıldığı işaretleniyor', kapandi.isaret === '1');

  // 4) Ayni oturumda TEKRAR ACILMIYOR (sayfa yenilense bile)
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2400);
  const sonra = await page.evaluate(()=>({
    acik: document.getElementById('pendingOverlay').classList.contains('open'),
    kayit: events.length, isaret: sessionStorage.getItem('demo_pending_dismissed')
  }));
  k('YENİLEMEDEN sonra kendiliğinden AÇILMIYOR', sonra.acik === false, sonra);
  k('bekleyen kayıtlar hâlâ duruyor (gizlenen sadece popup)', sonra.kayit === 40, sonra.kayit);

  // 5) Elle acmak HER ZAMAN calisiyor
  await page.evaluate(()=>showPendingPopup(false));
  await page.waitForTimeout(200);
  k('düğmeden elle açmak çalışıyor', await page.evaluate(()=>document.getElementById('pendingOverlay').classList.contains('open')));

  // 6) Escape de kapatiyor
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  k('Escape kapatıyor', await page.evaluate(()=>!document.getElementById('pendingOverlay').classList.contains('open')));

  // 7) YENIDEN BASLATINCA (yeni oturum) tekrar cikiyor
  await ctx.close();
  const ctx2 = await b.newContext({ viewport:{width:1280,height:900} });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page2.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page2.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page2.route('**/goatcounter**', r=>r.abort());
  await page2.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page2.waitForTimeout(2400);
  const yeni = await page2.evaluate(()=>({
    acik: document.getElementById('pendingOverlay').classList.contains('open'),
    isaret: sessionStorage.getItem('demo_pending_dismissed')
  }));
  k('yeniden başlatınca işaret sıfırlanıyor', yeni.isaret === null, yeni.isaret);
  k('yeni oturumda popup TEKRAR çıkıyor', yeni.acik === true, yeni);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
