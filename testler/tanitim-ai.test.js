const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  const yeniSayfa = async (ilkZiyaret)=>{
    const page = await b.newPage({ viewport:{width:1280,height:1000} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript((ilk)=>{ try{
      localStorage.setItem('demo_seen_intro','1');
      if(!ilk) localStorage.setItem('demo_pitch','acik');   // ESKI kullanicida "acik" kayitli
    }catch(e){} }, ilkZiyaret);
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1400);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    await page.waitForTimeout(200);
    return page;
  };

  console.log('TANITIM KALDIRILDI');
  for(const [ad, ilk] of [['ilk ziyaret', true], ['eski kullanıcı (pitch=açık kayıtlı)', false]]){
    const page = await yeniSayfa(ilk);
    const g = await page.evaluate(()=>{
      const gor = id=>{ const el=document.getElementById(id); return el ? getComputedStyle(el).display !== 'none' : null; };
      return { pitch:gor('pitch'), kart:gor('pitchCard'), serit:gor('pitchBanner'), dugme:gor('pitchToggle') };
    });
    k(ad+': tanıtım bloğu yok', g.pitch === false);
    k(ad+': tanıtım kartı yok', g.kart === false);
    k(ad+': "bu bir demo" şeridi yok', g.serit === false);
    k(ad+': sol menüde "Slate nedir?" yok', g.dugme === false);
    // Takvim yukari cikti mi: tanitim kalkinca calisma alani tepede olmali
    const ust = await page.evaluate(()=>Math.round(document.querySelector('.cal-nav').getBoundingClientRect().top));
    k(ad+': takvim sayfanın üstünde', ust < 200, ust+'px');
    await page.close();
  }

  console.log('\nAI AYARLARI SOL MENÜDEN AÇILIYOR');
  const page = await yeniSayfa(true);
  const menu = await page.evaluate(()=>{
    const el = document.getElementById('aiSettingsBtn');
    if(!el) return null;
    return { gorunur: getComputedStyle(el).display !== 'none', metin: el.textContent.trim(),
             railde: !!el.closest('.rail-foot') };
  });
  k('sol menüde AI düğmesi var', !!menu && menu.gorunur, menu && menu.metin);
  k('düğme alt menüde', !!menu && menu.railde);

  await page.click('#aiSettingsBtn');
  await page.waitForTimeout(250);
  const ekran = await page.evaluate(()=>{
    const ov = document.getElementById('aiSettingsOverlay');
    const rehber = ov.querySelector('.ai-howto');
    const adimlar = [...ov.querySelectorAll('.ai-steps li')].map(li=>li.textContent.trim());
    const link = ov.querySelector('.ai-step-link');
    return { acik: ov.classList.contains('open'),
             rehberGorunur: rehber ? getComputedStyle(rehber).display !== 'none' : false,
             rehberAcik: rehber ? rehber.open : false,
             adim: adimlar.length, ilk: adimlar[0] || '',
             href: link ? link.getAttribute('href') : '',
             uyari: (ov.querySelector('.ai-warn')||{}).textContent || '',
             saglayiciSecimi: !!ov.querySelector('#ai_provider') };
  });
  k('AI ekranı açılıyor', ekran.acik);
  k('rehber görünür', ekran.rehberGorunur);
  k('rehber baştan açık', ekran.rehberAcik);
  k('4 adım var', ekran.adim === 4, String(ekran.adim));
  k('AI Studio bağlantısı doğru', ekran.href === 'https://aistudio.google.com/apikey', ekran.href);
  k('“abonelik ≠ anahtar” uyarısı var', /abonelik/i.test(ekran.uyari));
  k('sağlayıcı seçimi yok (tek AI: Gemini)', ekran.saglayiciSecimi === false);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
