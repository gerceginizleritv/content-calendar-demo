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
  console.log('SCRIPT — BAĞIMSIZ KAYIT MODELİ');

  const r = await page.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    projects = [
      { id:'p_kariye', name:'Kariye Mozaikleri', type:'studio', keywords:'', notes:'', address:'',
        shootDate:'', script:false, shot:false, edited:false, published:false, permit:false,
        cancelled:false, deadlines:{}, createdAt:Date.now() },
      { id:'p_balat', name:'Balat Sokakları', type:'outdoor', keywords:'', notes:'', address:'Balat',
        shootDate:'', script:false, shot:false, edited:false, published:false, permit:false,
        cancelled:false, deadlines:{}, createdAt:Date.now() }
    ];
    saveProjects();
    scriptler = []; saveScriptler();
    fikirler = []; saveFikirler();
    setPage('projects'); renderProjects();
    await bekle(200);

    const cip = pid => document.querySelector(`[data-proj-scripts="${pid}"]`);
    const cipOnce = cip('p_kariye').className;

    // 1) Projeler tablosundaki script cipi SCRIPTLER SAYFASINI o projeye
    //    filtreli aciyor (pencereyi degil): script artik projenin bir
    //    alani degil, kendi basina bir kayit.
    cip('p_kariye').click();
    await bekle(300);
    const cipSayfa = localStorage.getItem('demo_page');
    const cipFiltre = scriptFiltresi;
    // Pencere o sayfadan aciliyor, proje bagi hazir geliyor
    openScript(null, { projectId:'p_kariye' });
    await bekle(250);
    const acildi = document.getElementById('scriptOverlay').classList.contains('open');
    const projeSecili = [...seciliProjeler][0] || '';
    const sayacBos = document.getElementById('scCount').textContent;

    // 2) Yaz - kaydet
    const alan = document.getElementById('sc_text');
    document.getElementById('sc_title').value = 'Kariye — bölüm 1';
    alan.value = 'Kariye Camii mozaikleri üzerine dört bölümlük bir dizi.';
    alan.dispatchEvent(new Event('input'));
    const sayacDolu = document.getElementById('scCount').textContent;
    document.getElementById('sc_save').click();
    await bekle(300);
    // Kaydet ARTIK KAPATMIYOR: metin varsa pencere acik kaliyor ve
    // "Drive'a gonderelim mi?" satiri cikiyor. Kullanici en altta,
    // kaydet dugmesinin yaninda soruyu goruyor.
    const acikKaldi = document.getElementById('scriptOverlay').classList.contains('open');
    const notGorundu = !document.getElementById('sc_saveNote').hidden;
    closeScript();
    await bekle(150);
    const kayit = scriptler.find(s=>s.projectId === 'p_kariye');
    const kayitMetin = kayit.text, kayitBaslik = kayit.title;
    const cipSonra = cip('p_kariye').className;
    const adimIsaretlendi = projectById('p_kariye').script === true;

    // 3) Yeniden acinca metin geliyor
    openScript(kayit.id);
    await bekle(200);
    const geriGeldi = document.getElementById('sc_text').value;

    // 4) IPTAL kaydetmiyor
    document.getElementById('sc_text').value = 'BU KAYDEDİLMEMELİ';
    document.getElementById('sc_cancel').click();
    await bekle(200);
    const iptalSonrasi = scriptById(kayit.id).text;

    // 5) Tarayiciya yaziliyor (yeni anahtar)
    const yerel = JSON.parse(localStorage.getItem('demo_scripts_v2') || '[]');
    const yereldeVar = Array.isArray(yerel) && yerel.some(s=>s.id === kayit.id && s.text === kayitMetin);

    // 6) Metni silmek adim isaretini KALDIRMIYOR (kullanicinin kendi kararı)
    openScript(kayit.id);
    await bekle(200);
    document.getElementById('sc_text').value = '';
    document.getElementById('sc_text').dispatchEvent(new Event('input'));
    document.getElementById('sc_save').click();
    await bekle(250);
    const silinceIsaretDuruyor = projectById('p_kariye').script === true;

    // 7) Ust sinirda kirpiliyor
    openScript(null, { projectId:'p_balat', title:'Balat' });
    await bekle(200);
    const uzunAlan = document.getElementById('sc_text');
    uzunAlan.value = 'a'.repeat(SCRIPT_MAX + 500);
    uzunAlan.dispatchEvent(new Event('input'));
    const kirpildi = uzunAlan.value.length;
    document.getElementById('sc_save').click();
    await bekle(300);
    const balat = scriptler.find(s=>s.projectId === 'p_balat');

    // 8) Projesiz script de olabiliyor
    openScript(null, {});
    await bekle(200);
    document.getElementById('sc_title').value = 'Projesiz bir fikir';
    document.getElementById('sc_text').value = 'Henüz bir projeye bağlı değil.';
    document.getElementById('sc_save').click();
    await bekle(300);
    const projesiz = scriptler.find(s=>s.title === 'Projesiz bir fikir');

    return { cipOnce, cipSayfa, cipFiltre, acildi, projeSecili, sayacBos, sayacDolu, acikKaldi, notGorundu,
             kayitMetin, kayitBaslik, cipSonra, adimIsaretlendi,
             geriGeldi, iptalSonrasi, yereldeVar, silinceIsaretDuruyor,
             kirpildi, sinir: SCRIPT_MAX, balatUzunluk: balat ? balat.text.length : -1,
             projesizVar: !!projesiz, projesizPid: projesiz ? projesiz.projectId : null };
  });

  k('boş projede çip "dolu" değil', !r.cipOnce.includes('dolu'), r.cipOnce);
  k('çip SCRIPTLER sayfasını açıyor', r.cipSayfa === 'scripts', r.cipSayfa);
  k('çip o projeye filtreliyor', r.cipFiltre === 'p_kariye', r.cipFiltre);
  k('script penceresi açılıyor', r.acildi);
  k('pencere DOĞRU projeyle açılıyor', r.projeSecili === 'p_kariye', r.projeSecili);
  k('boş sayaç "boş"', r.sayacBos === 'boş', r.sayacBos);
  k('yazınca sayaç karakter sayıyor', /karakter/.test(r.sayacDolu), r.sayacDolu);
  k('kaydedince pencere AÇIK KALIYOR', r.acikKaldi);
  k('kaydedince Drive sorusu çıkıyor', r.notGorundu);
  k('metin kaydedildi', r.kayitMetin.startsWith('Kariye Camii'), r.kayitMetin.slice(0,30));
  k('başlık kaydedildi', r.kayitBaslik === 'Kariye — bölüm 1', r.kayitBaslik);
  k('dolu projede çip vurgulu', r.cipSonra.includes('dolu'), r.cipSonra);
  k('script adımı kendiliğinden işaretlendi', r.adimIsaretlendi === true);
  k('yeniden açınca metin geliyor', r.geriGeldi.startsWith('Kariye Camii'), r.geriGeldi.slice(0,30));
  k('iptal edilince yazılan kaydedilmiyor', r.iptalSonrasi.startsWith('Kariye Camii'), r.iptalSonrasi.slice(0,30));
  k('tarayıcıya yazılıyor (demo_scripts_v2)', r.yereldeVar);
  k('metni silmek adım işaretini KALDIRMIYOR', r.silinceIsaretDuruyor === true);
  k('üst sınırda kırpılıyor', r.kirpildi === r.sinir, {kirpildi:r.kirpildi, sinir:r.sinir});
  k('kayıtlı metin sınırda', r.balatUzunluk === r.sinir, r.balatUzunluk);
  k('PROJESİZ script de kaydediliyor', r.projesizVar === true);
  k('projesiz scriptin proje bağı boş', r.projesizPid === '', r.projesizPid);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
