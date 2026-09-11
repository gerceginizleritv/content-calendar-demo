// Eklenme tarihine gore siralama: tek dugme, uc durum.
// "Dun ekledigim hangisiydi" sorusunun listede karsiligi olsun diye.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1100} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  page.on('dialog', d=>d.accept());
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('SIRA — EKLENME TARİHİ');

  const r = await page.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    const GUN = 86400000, simdi = Date.now();

    // Projeler: EN ESKI eklenen, gunu EN YAKIN olan. Boylece akilli sira
    // ile eklenme sirasi birbirinden AYRILIYOR; test ikisini karistirmaz.
    const bugun = new Date().toISOString().slice(0,10);
    const yarin = new Date(simdi + GUN).toISOString().slice(0,10);
    const bosProje = { type:'studio', keywords:'', notes:'', address:'',
      script:false, filmed:false, edited:false, approved:false, published:false,
      permission:'', cancelled:false, deadlines:{} };
    projects = [
      { ...bosProje, id:'p_eski', name:'EN ESKİ PROJE', shootDate:bugun, createdAt: simdi - 3*GUN },
      { ...bosProje, id:'p_orta', name:'ORTA PROJE',    shootDate:yarin, createdAt: simdi - 2*GUN },
      { ...bosProje, id:'p_yeni', name:'EN YENİ PROJE', shootDate:'',    createdAt: simdi - 1*GUN }
    ];
    saveProjects();

    mekanlar = [
      { id:'m_eski', name:'ESKİ MEKAN', city:'İstanbul', district:'Fatih', address:'', mapsUrl:'',
        permission:'', cautions:'', imageUrl:'', createdAt: simdi - 5*GUN },
      { id:'m_yeni', name:'YENİ MEKAN', city:'İstanbul', district:'Balat', address:'', mapsUrl:'',
        permission:'', cautions:'', imageUrl:'', createdAt: simdi - 1*GUN }
    ];
    saveMekanlar();

    // Onceki kosudan kalan secim testi bozmasin.
    localStorage.removeItem('demo_proje_sira');
    localStorage.removeItem('demo_mekan_sira');
    projeSiraSecimi = 'akilli'; mekanSiraSecimi = 'akilli';

    const adlar = ()=> [...document.querySelectorAll('#projectList .pname')].map(x=>x.textContent.trim());
    const mkAdlar = ()=> [...document.querySelectorAll('#mk_list .mk-ad')].map(x=>x.textContent.trim());
    const pDugme = ()=> document.getElementById('p_sira');
    const mDugme = ()=> document.getElementById('mk_sira');

    setPage('projects'); renderProjects();
    await bekle(250);
    const pEtiket0 = pDugme().textContent;
    const pSira0 = adlar();
    const pVurgu0 = pDugme().classList.contains('acik');
    // Eklenme tarihi satirda gorunuyor mu?
    const pMeta = (document.querySelector('#projectList .pn-meta')||{}).textContent || '';

    pDugme().click(); await bekle(200);
    const pEtiket1 = pDugme().textContent, pSira1 = adlar();
    const pVurgu1 = pDugme().classList.contains('acik');
    const pKayit1 = localStorage.getItem('demo_proje_sira');

    pDugme().click(); await bekle(200);
    const pEtiket2 = pDugme().textContent, pSira2 = adlar();

    pDugme().click(); await bekle(200);
    const pEtiket3 = pDugme().textContent, pSira3 = adlar();

    // Arama ve filtre sirayla birlikte calismaya devam ediyor mu?
    pDugme().click(); await bekle(150);             // yeni eklenen
    document.getElementById('p_search').value = 'ORTA';
    document.getElementById('p_search').dispatchEvent(new Event('input'));
    await bekle(200);
    const aramaSonuc = adlar();
    document.getElementById('p_search').value = '';
    document.getElementById('p_search').dispatchEvent(new Event('input'));
    await bekle(150);

    setPage('places'); renderMekanlar();
    await bekle(250);
    const mEtiket0 = mDugme().textContent, mSira0 = mkAdlar();
    const mkEklendi = (document.querySelector('#mk_list .mk-eklendi')||{}).textContent || '';

    mDugme().click(); await bekle(200);
    const mSira1 = mkAdlar(), mKayit1 = localStorage.getItem('demo_mekan_sira');
    mDugme().click(); await bekle(200);
    const mSira2 = mkAdlar();

    // Dil degisince dugme de cevriliyor mu?
    setLanguage('en'); renderMekanlar(); await bekle(150);
    const mEtiketEn = mDugme().textContent;
    setLanguage('tr'); renderMekanlar(); await bekle(150);

    return { pEtiket0, pSira0, pVurgu0, pMeta, pEtiket1, pSira1, pVurgu1, pKayit1,
             pEtiket2, pSira2, pEtiket3, pSira3, aramaSonuc,
             mEtiket0, mSira0, mkEklendi, mSira1, mKayit1, mSira2, mEtiketEn };
  });

  // --- Projeler
  k('varsayılan AKILLI sıra', /Akıllı/.test(r.pEtiket0), r.pEtiket0);
  k('akıllı sırada günü yakın olan üstte', r.pSira0[0] === 'EN ESKİ PROJE', r.pSira0);
  k('akıllı sırada düğme vurgulu DEĞİL', r.pVurgu0 === false);
  k('satırda eklenme tarihi yazıyor', /eklendi/.test(r.pMeta), r.pMeta);
  k('1. tık → yeni eklenen', /Yeni eklenen/.test(r.pEtiket1), r.pEtiket1);
  k('yeni eklenen en üstte', r.pSira1[0] === 'EN YENİ PROJE', r.pSira1);
  k('en eski en altta', r.pSira1[2] === 'EN ESKİ PROJE', r.pSira1);
  k('seçim vurgulanıyor', r.pVurgu1 === true);
  k('seçim tarayıcıya yazılıyor', r.pKayit1 === 'yeni', r.pKayit1);
  k('2. tık → eski eklenen', /Eski eklenen/.test(r.pEtiket2), r.pEtiket2);
  k('eski eklenen en üstte', r.pSira2[0] === 'EN ESKİ PROJE', r.pSira2);
  k('3. tık → akıllı sıraya dönüyor', /Akıllı/.test(r.pEtiket3), r.pEtiket3);
  k('akıllı sıra geri geldi', r.pSira3.join('|') === r.pSira0.join('|'), r.pSira3);
  k('arama sırayla birlikte çalışıyor', r.aramaSonuc.length === 1 && r.aramaSonuc[0] === 'ORTA PROJE', r.aramaSonuc);

  // --- Mekanlar
  k('mekanlarda da varsayılan akıllı', /Akıllı/.test(r.mEtiket0), r.mEtiket0);
  k('kartta eklenme tarihi yazıyor', /eklendi/.test(r.mkEklendi), r.mkEklendi);
  k('mekan akıllı sıra ada göre', r.mSira0[0] === 'ESKİ MEKAN', r.mSira0);
  k('mekan: yeni eklenen üstte', r.mSira1[0] === 'YENİ MEKAN', r.mSira1);
  k('mekan seçimi tarayıcıya yazılıyor', r.mKayit1 === 'yeni', r.mKayit1);
  k('mekan: eski eklenen üstte', r.mSira2[0] === 'ESKİ MEKAN', r.mSira2);
  k('düğme İngilizceye çevriliyor', /Sort/.test(r.mEtiketEn), r.mEtiketEn);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close();
  process.exit(hata ? 1 : 0);
})();
