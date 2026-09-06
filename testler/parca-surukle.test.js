// Gercek fare ile surukleme: parcayi bos alana ve baska karta birakma.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:1000}, colorScheme:'light' });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1600);
  console.log('SÜRÜKLEME — GERÇEK FARE');

  const kimlik = await page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr'); setPage('ideas');
    const A = fikirEkle('Birinci fikir', ''), B = fikirEkle('İkinci fikir', ''),
          C = fikirEkle('Üçüncü fikir', ''), D = fikirEkle('Dördüncü fikir', '');
    fikirBirlestir(A.id, B.id); fikirBirlestir(A.id, C.id);
    renderFikirler();
    await new Promise(r=>setTimeout(r,250));
    return { A:A.id, B:B.id, C:C.id, D:D.id };
  });

  // HTML5 surukleme: Playwright'in dragTo'su dataTransfer ile calisiyor
  const parcaB = page.locator(`[data-fk-part="${kimlik.B}"]`);
  const bosAlan = page.locator('#fk_list');
  // Bos alana birak: kartin disinda bir noktaya
  const kutu = await bosAlan.boundingBox();
  await parcaB.hover();
  await page.mouse.down();
  await page.mouse.move(kutu.x + kutu.width - 30, kutu.y + kutu.height - 20, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(350);
  const sonuc1 = await page.evaluate(k=>({
    adet: fikirler.length,
    Aparca: fikirById(k.A) && fikirById(k.A).parts.length,
    Bvar: !!fikirById(k.B),
    Btek: fikirById(k.B) && fikirById(k.B).parts.length
  }), kimlik);
  k('Parçayı boş alana bırakınca kendi kartı oluyor',
    sonuc1.adet===3 && sonuc1.Aparca===2 && sonuc1.Bvar && sonuc1.Btek===1, sonuc1);

  // Kalan parcayi (C) baska karta (D) surukle
  const parcaC = page.locator(`[data-fk-part="${kimlik.C}"]`);
  const kartD = page.locator(`[data-fk-card="${kimlik.D}"]`);
  await parcaC.hover();
  await page.mouse.down();
  const dk = await kartD.boundingBox();
  await page.mouse.move(dk.x + dk.width/2, dk.y + dk.height/2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(350);
  const sonuc2 = await page.evaluate(k=>({
    adet: fikirler.length,
    Aparca: fikirById(k.A) && fikirById(k.A).parts.length,
    Dparca: fikirById(k.D) && fikirById(k.D).parts.length,
    Dmetin: fikirById(k.D) && fikirById(k.D).text
  }), kimlik);
  k('Parçayı başka karta bırakınca oraya geçiyor',
    sonuc2.Aparca===1 && sonuc2.Dparca===2 && sonuc2.Dmetin.includes('Üçüncü'), sonuc2);
  k('Taşımada kart sayısı değişmiyor', sonuc2.adet===3, sonuc2.adet);

  // Kart sürükleyip başka kartın ÜSTÜNE bırakmak birleştiriyor
  const kartB = page.locator(`[data-fk-card="${kimlik.B}"]`);
  await kartB.hover();
  await page.mouse.down();
  const dk2 = await kartD.boundingBox();
  await page.mouse.move(dk2.x + dk2.width/2, dk2.y + dk2.height/2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(350);
  const sonuc3 = await page.evaluate(k=>({ adet: fikirler.length, Dparca: fikirById(k.D) && fikirById(k.D).parts.length }), kimlik);
  k('Kartı kartın üstüne bırakınca birleşiyor', sonuc3.adet===2 && sonuc3.Dparca===3, sonuc3);

  await page.screenshot({ path: process.env.SP + '/parca-son.png' });
  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
