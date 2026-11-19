const { chromium, menuAc } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  const UZUN = 'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash.';

  for(const [ad,w,h] of [['masaüstü 1280x900',1280,900], ['telefon 390x844',390,844]]){
    const page = await b.newPage({ viewport:{width:w,height:h} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{
      localStorage.setItem('demo_seen_intro','1');
      localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AQ.TEST_1234'}));
    }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.route('**generativelanguage.googleapis.com/v1beta/models', r=>r.fulfill({status:200,
      contentType:'application/json', body: JSON.stringify({models:[
        {name:'models/gemini-3.7-flash'},{name:'models/gemini-3.6-flash'},
        {name:'models/gemini-3.5-flash'},{name:'models/gemini-3.5-flash-lite'}]})}));
    await page.route('**generativelanguage.googleapis.com/v1beta/models/**', r=>r.fulfill({status:400,
      contentType:'application/json', body: JSON.stringify({error:{message:UZUN}})}));
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1400);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    await menuAc(page);   // telefonda serit baglantilari alt sayfada
    await page.click('#ayarlarBtn'); await page.waitForTimeout(250);
    await page.click('#aiTestBtn');
    await page.waitForFunction(()=>!document.getElementById('aiTestBtn').disabled, null, {timeout:20000});
    await page.waitForTimeout(300);

    const r = await page.evaluate(()=>{
      const liste = document.getElementById('ai_test_list');
      const satirlar = [...liste.querySelectorAll('li')].map(li=>{
        const ad = li.querySelector('.tm-ad');
        const sonuc = li.querySelector('.tm-sonuc');
        const ar = ad.getBoundingClientRect(), sr = sonuc.getBoundingClientRect();
        return { adGen:Math.round(ar.width), adYuk:Math.round(ar.height),
                 sonucYuk:Math.round(sr.height), sonucGen:Math.round(sr.width),
                 // Hem yatay hem dikey kirpilma: ellipsis ile tek satira
                 // dusurulmus bir metin de, tasip gizlenmis bir metin de
                 // yakalanir.
                 sonucKirpik: sonuc.scrollWidth > sonuc.clientWidth + 1
                           || sonuc.scrollHeight > sonuc.clientHeight + 1 };
      });
      const modal = document.querySelector('#ayarAi');
      return { satirlar, listeGen:Math.round(liste.getBoundingClientRect().width),
               yatay: liste.scrollWidth > liste.clientWidth + 1,
               modalYatay: modal.scrollWidth > modal.clientWidth + 1 };
    });
    console.log('  ── '+ad);
    // Model adi harf harf alt alta dusmus olsaydi yuksekligi devasa olurdu
    k('    model adı TEK satırda (harf harf dökülmüyor)',
       r.satirlar.every(x=>x.adYuk < 30), r.satirlar.map(x=>x.adYuk));
    k('    model adı yeterince geniş', r.satirlar.every(x=>x.adGen > 80), r.satirlar.map(x=>x.adGen));
    // ⛔ 19 KASIM 2026 — "SARIYOR MU" ARTIK DOGRU SORU DEGIL
    //    (YAPILACAKLAR 58 asama 6). AI ayarlari 440 piksellik bir
    //    PENCEREDEYDI; simdi 640 piksellik ayarlar sayfasinin bolumu
    //    ve ayni uzun hata metni TEK SATIRA sigiyor (36px -> 18px).
    //    Sarmak bir GENISLIK KAZASIYDI; korunmasi gereken sey o degil.
    //    ⚠ ASIL GUVENCE: uzun hata metni KIRPILMIYOR, tamami okunuyor.
    //      Eski hali de bunu koruyordu (kirpilmis metin tek satirda
    //      kalirdi); yeni hali her genislikte gecerli ve daha dogrudan.
    k('    uzun hata metni KIRPILMIYOR (tamami okunuyor)',
       r.satirlar.every(x=> !x.sonucKirpik),
       r.satirlar.map(x=> x.sonucYuk + (x.sonucKirpik ? ' KIRPIK' : '')));
    k('    listede yatay kaydırma yok', r.yatay === false);
    k('    ekranda yatay kaydırma yok', r.modalYatay === false);
    await page.screenshot({ path:'ciktilar/aitest-'+w+'.png' });
    await page.close();
  }
  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
