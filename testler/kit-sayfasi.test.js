// Çekim kütüphanesi kendi sayfası (menüden). Pencereyle AYNI kütüphane,
// tek fark tıklamanın anlamı: pencerede "bu çekimin listesine ekle",
// sayfada "seti kurarken bunu al".
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1100} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('ÇEKİM KÜTÜPHANESİ SAYFASI');

  const r = await page.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    localStorage.removeItem('demo_ihtiyaclar');
    localStorage.removeItem('demo_ihtiyac_setleri');
    ihtiyaclar = []; ihtiyacSetleri = []; sayfaSecimi.clear();
    mekanlar = []; saveMekanlar();
    projects = [{ id:'p1', name:'Deneme', type:'studio', keywords:'', notes:'', address:'',
      shootDate:'', script:false, filmed:false, edited:false, approved:false, published:false,
      permission:'', cancelled:false, deadlines:{}, cautions:'', checklist:[], createdAt:Date.now() }];
    saveProjects();

    // 1) Menüde sekme var, sayfa açılıyor
    const sekmeVar = !!document.getElementById('tabKit');
    document.getElementById('tabKit').click();
    await bekle(250);
    const sayfaAcik = !document.getElementById('kitPage').hidden;
    const sekmeEtkin = document.getElementById('tabKit').classList.contains('active');
    const bosMetin = document.getElementById('ihs_liste').textContent.replace(/\s+/g,' ').trim();

    // 2) Sayfadan madde ekleme
    const ekle = (ad, grup)=>{
      document.getElementById('ihs_yeniAd').value = ad;
      document.getElementById('ihs_yeniGrup').value = grup || '';
      document.getElementById('ihs_yeniBtn').click();
    };
    ekle('Osmo Action 4','Kamera'); ekle('Gimbal','Kamera');
    ekle('Powerbank','Enerji'); ekle('Yaka mikrofonu','Ses');
    await bekle(250);
    const kutuphane = ihtiyaclar.map(x=>x.ad);
    // Sayfadan eklenen madde PROJEYE girmiyor (açık çekim yok)
    const projeBos = projeListesi(projectById('p1')).length === 0;
    // ve kendiliğinden işaretli geliyor
    const eklenenIsaretli = sayfaSecimi.size === 4;

    // 3) Arama
    document.getElementById('ihs_ara').value = 'kamera';
    document.getElementById('ihs_ara').dispatchEvent(new Event('input'));
    await bekle(200);
    const aramaSonuc = [...document.querySelectorAll('#ihs_liste [data-ih-sec]')].length;
    document.getElementById('ihs_ara').value = '';
    document.getElementById('ihs_ara').dispatchEvent(new Event('input'));
    await bekle(150);

    // 4) İşaretlilerden set
    sayfaSecimi.clear(); kitSayfasiCiz();
    await bekle(150);
    document.querySelector('#ihs_liste [data-ih-sec]').click();   // ilk madde
    await bekle(150);
    const tekSecim = sayfaSecimi.size;
    const kutuIsaretli = document.querySelector('#ihs_liste .cl-kutu.on') !== null;
    // İkinci maddeyi de al
    [...document.querySelectorAll('#ihs_liste [data-ih-sec]')][1].click();
    await bekle(150);
    return { sekmeVar, sayfaAcik, sekmeEtkin, bosMetin, kutuphane, projeBos, eklenenIsaretli,
             aramaSonuc, tekSecim, kutuIsaretli, secimSayisi: sayfaSecimi.size };
  });

  k('menüde "Malzeme" sekmesi var', r.sekmeVar);
  k('sekme sayfayı açıyor', r.sayfaAcik && r.sekmeEtkin);
  k('boş sayfa ne yapılacağını söylüyor', /yaz|yapıştır/.test(r.bosMetin), r.bosMetin.slice(0,60));
  k('sayfadan madde eklenebiliyor', r.kutuphane.length === 4, r.kutuphane);
  k('sayfadan eklenen madde PROJEYE girmiyor', r.projeBos);
  k('sayfada eklenen madde işaretli geliyor', r.eklenenIsaretli);
  k('arama grubu da süzüyor', r.aramaSonuc === 2, r.aramaSonuc);
  k('tıklamak seçiyor', r.tekSecim === 1 && r.kutuIsaretli);
  k('ikinci tıklama seçime ekliyor', r.secimSayisi === 2, r.secimSayisi);

  // Set kurma: adı dlg penceresinden geliyor
  await page.evaluate(()=> document.querySelector('#ihs_setler [data-set-yap]').click());
  await page.waitForTimeout(300);
  const sordu = await page.evaluate(()=> document.getElementById('dlgOverlay').classList.contains('open'));
  await page.evaluate(()=>{ document.getElementById('dlgInput').value = 'Sokak çekimi';
                            document.getElementById('dlgOk').click(); });
  await page.waitForTimeout(350);
  const s = await page.evaluate(()=>({
    setler: ihtiyacSetleri.map(x=>({ ad:x.ad, n:x.maddeler.length })),
    not: document.getElementById('ihs_topluNot').textContent,
    yerel: JSON.parse(localStorage.getItem('demo_ihtiyac_setleri')||'[]').length
  }));
  k('set adı soruluyor', sordu);
  k('İŞARETLİLERDEN set kuruldu', s.setler.length === 1 && s.setler[0].n === 2, s.setler);
  k('sonuç yazılıyor', /Sokak çekimi/.test(s.not), s.not);
  k('set tarayıcıya yazıldı', s.yerel === 1);

  // Sete dokunmak onu AÇIYOR (maddeleri işaretleniyor)
  const acilan = await page.evaluate(async ()=>{
    sayfaSecimi.clear(); kitSayfasiCiz();
    await new Promise(r=>setTimeout(r,150));
    document.querySelector('#ihs_setler [data-set-ekle]').click();
    await new Promise(r=>setTimeout(r,250));
    return sayfaSecimi.size;
  });
  k('sete dokunmak onu açıyor', acilan === 2, acilan);

  // Pencere (proje içinden) hâlâ eski gibi: tık PROJENİN listesine ekliyor
  const pencere = await page.evaluate(async ()=>{
    cekimListesiAc('p1');
    await new Promise(r=>setTimeout(r,200));
    ihtiyacPenceresiAc();
    await new Promise(r=>setTimeout(r,250));
    document.querySelector('#ih_liste [data-ih-sec]').click();
    await new Promise(r=>setTimeout(r,200));
    const n = projeListesi(projectById('p1')).length;
    document.getElementById('ih_bitti').click();
    await new Promise(r=>setTimeout(r,150));
    cekimListesiKapat();
    return n;
  });
  k('PENCEREDE tık projenin listesine ekliyor', pencere === 1, pencere);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close();
  process.exit(hata ? 1 : 0);
})();
