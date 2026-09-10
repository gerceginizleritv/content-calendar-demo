// Birlesik karttan TEK parca cikarma / baska karta tasima.
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
  console.log('BİRLEŞİK KARTTAN TEK PARÇA');

  const r = await page.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr'); setPage('ideas');
    const A = fikirEkle('Birinci fikir', ''), B = fikirEkle('İkinci fikir', ''),
          C = fikirEkle('Üçüncü fikir', ''), D = fikirEkle('Dördüncü fikir', '');
    // A'ya B ve C'yi kat: uc parcali bir kart
    fikirBirlestir(A.id, B.id);
    fikirBirlestir(A.id, C.id);
    renderFikirler(); await bekle(200);
    const uclu = { parca: fikirById(A.id).parts.length, adet: fikirler.length,
                   ekrandaParca: document.querySelectorAll(`[data-fk-card="${A.id}"] .fk-part`).length,
                   cikarDugmesi: document.querySelectorAll(`[data-fk-card="${A.id}"] [data-fk-out]`).length };

    // ORTADAKI parcayi cikar (B) — otekiler kartta kalmali
    document.querySelector(`[data-fk-out="${B.id}"]`).click();
    await bekle(200);
    const cikarma = {
      adet: fikirler.length,
      kalanParca: fikirById(A.id).parts.length,
      kalanMetin: fikirById(A.id).text,
      cikanVar: !!fikirById(B.id),
      cikanMetin: fikirById(B.id) && fikirById(B.id).text,
      cikanTekParca: fikirById(B.id) && fikirById(B.id).parts.length === 1,
      mezarTasiKalkti: !fikirRemoved.has(B.id),
      halaBirlesik: fikirById(A.id).parts.length > 1
    };

    // Parcayi BASKA karta tasi: A'daki C parcasi D'ye gitsin
    const tasindi = fikirParcaTasi(A.id, C.id, D.id);
    renderFikirler(); await bekle(150);
    const tasima = {
      sonuc: tasindi,
      Aparca: fikirById(A.id).parts.length,
      Dparca: fikirById(D.id).parts.length,
      Dmetin: fikirById(D.id).text,
      adet: fikirler.length
    };

    // Tek parcali karttan cikarma olmamali
    const tekParcaCikti = fikirParcaCikar(A.id, fikirById(A.id).parts[0].id);

    // Tek parcali kart baska karta parca olarak birakilinca butun kart tasiniyor
    const oncekiAdet = fikirler.length;
    const butunKart = fikirParcaTasi(A.id, fikirById(A.id).parts[0].id, D.id);
    const kartTasima = { sonuc: butunKart, adet: fikirler.length, oncekiAdet,
                         Dparca: fikirById(D.id).parts.length, Agitti: !fikirById(A.id) };

    return { uclu, cikarma, tasima, tekParcaCikti, kartTasima };
  });

  k('Üç parçalı kart oluştu', r.uclu.parca===3 && r.uclu.adet===2, r.uclu);
  k('Her parça ekranda ayrı satır', r.uclu.ekrandaParca===3, r.uclu.ekrandaParca);
  k('Her parçanın çıkar düğmesi var', r.uclu.cikarDugmesi===3, r.uclu.cikarDugmesi);
  k('ORTADAKİ parça tek başına çıktı', r.cikarma.adet===3 && r.cikarma.cikanVar, r.cikarma);
  k('Çıkan parçanın metni doğru', r.cikarma.cikanMetin==='İkinci fikir', r.cikarma.cikanMetin);
  k('Çıkan parça tek parçalı kart oldu', r.cikarma.cikanTekParca===true);
  k('Kart geri kalanıyla BİRLEŞİK kaldı', r.cikarma.halaBirlesik===true && r.cikarma.kalanParca===2, r.cikarma);
  k('Kalan metin doğru', r.cikarma.kalanMetin==='Birinci fikir\n\nÜçüncü fikir', r.cikarma.kalanMetin);
  k('Mezar taşı kalktı', r.cikarma.mezarTasiKalkti===true);
  k('Parça başka karta taşınıyor', r.tasima.sonuc===true && r.tasima.Aparca===1 && r.tasima.Dparca===2, r.tasima);
  k('Taşınan metin hedefte', r.tasima.Dmetin.includes('Üçüncü fikir'), r.tasima.Dmetin);
  k('Taşımada kart sayısı değişmiyor', r.tasima.adet===3, r.tasima.adet);
  k('Tek parçalı karttan çıkarma yok', r.tekParcaCikti===false);
  k('Tek parçalı kart bırakılınca kartın kendisi taşınıyor',
    r.kartTasima.sonuc===true && r.kartTasima.Agitti===true && r.kartTasima.adet===r.kartTasima.oncekiAdet-1, r.kartTasima);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
