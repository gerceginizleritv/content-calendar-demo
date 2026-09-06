const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1400,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); setPage('projects'); });
  await page.waitForTimeout(300);
  console.log('PROJE SAHA ALANLARI');

  // Proje kur ve pencereyi ac
  const ac = await page.evaluate(async ()=>{
    const c=window.onayla; window.onayla=()=>false;
    document.getElementById('p_type').value='studio';
    document.getElementById('p_type').dispatchEvent(new Event('change'));
    document.getElementById('p_name').value='Zeyrek Camii';
    document.getElementById('p_add').click();
    await new Promise(r=>setTimeout(r,300)); window.onayla=c;
    document.querySelector('.pname').click();
    await new Promise(r=>setTimeout(r,250));
    const kat = document.getElementById('pe_fieldFold');
    return { pencere: document.getElementById('projectEditOverlay').classList.contains('open'),
             bolumVar: !!kat, bosProjedeKapali: kat && !kat.open,
             alanSayisi: SAHA_ALANLARI.length,
             sayac: document.getElementById('pe_fieldCount').textContent.trim() };
  });
  k('düzenleme penceresi açıldı', ac.pencere === true);
  k('“Saha detayları” bölümü var', ac.bolumVar === true);
  k('BOŞ PROJEDE BÖLÜM KATLI', ac.bosProjedeKapali === true);
  k('on bir saha alanı tanımlı', ac.alanSayisi === 11, ac.alanSayisi);
  k('boşken sayaç yazmıyor', ac.sayac === '', JSON.stringify(ac.sayac));

  // Doldur, kaydet, geri oku
  const kaydet = await page.evaluate(async ()=>{
    document.getElementById('pe_fieldFold').open = true;
    const g = (id,v)=>{ const el=document.getElementById(id); el.value=v; el.dispatchEvent(new Event('input')); };
    g('pe_topic','Bizans hastanesi ve Molla Zeyrek');
    g('pe_district','Fatih'); g('pe_city','İstanbul');
    g('pe_format','Saha'); g('pe_permission','Vakıf izni gerekiyor');
    g('pe_maps','https://maps.app.goo.gl/zeyrek');
    g('pe_scriptUrl','https://docs.google.com/document/d/abc');
    g('pe_driveUrl','https://drive.google.com/drive/folders/xyz');
    g('pe_shotList','Giriş çekimi, kubbe detayı, mezar odası kapısı');
    g('pe_cautions','Mezar odaları ziyarete kapalı, öğleden sonra ışık iyi');
    g('pe_fieldNotes','Rehber Molla Zeyrek anlatımını hatırlattı');
    const sayac = document.getElementById('pe_fieldCount').textContent.trim();
    document.getElementById('pe_save').click();
    await new Promise(r=>setTimeout(r,350));
    const p = projects[0];
    return { sayac, kapandi: !document.getElementById('projectEditOverlay').classList.contains('open'),
             konu:p.topic, ilce:p.district, sehir:p.city, format:p.format,
             izin:p.permission, harita:p.mapsUrl, script:p.scriptUrl, drive:p.driveUrl,
             cekilecek:p.shotList, dikkat:p.cautions, notlar:p.fieldNotes,
             depo: JSON.parse(localStorage.getItem('demo_projects')||'[]')[0] };
  });
  k('SAYAÇ DOLU ALAN SAYISINI YAZIYOR', /11 dolu/.test(kaydet.sayac), kaydet.sayac);
  k('pencere kapandı', kaydet.kapandi === true);
  k('ON BİR ALANIN HEPSİ KAYDEDİLDİ',
     kaydet.konu && kaydet.ilce==='Fatih' && kaydet.sehir==='İstanbul' && kaydet.format==='Saha' &&
     kaydet.izin && kaydet.harita && kaydet.script && kaydet.drive &&
     kaydet.cekilecek && kaydet.dikkat && kaydet.notlar,
     kaydet.ilce+' / '+kaydet.sehir+' / '+kaydet.format);
  k('tarayıcıya da yazıldı', kaydet.depo && kaydet.depo.district === 'Fatih', (kaydet.depo||{}).district);

  // Yenileyince duruyor + bolum ACIK aciliyor
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  const sonra = await page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setPage('projects'); await new Promise(r=>setTimeout(r,200));
    document.querySelector('.pname').click();
    await new Promise(r=>setTimeout(r,250));
    return { konu: document.getElementById('pe_topic').value,
             dikkat: document.getElementById('pe_cautions').value.slice(0,20),
             acik: document.getElementById('pe_fieldFold').open,
             sayac: document.getElementById('pe_fieldCount').textContent.trim() };
  });
  k('YENİLEYİNCE ALANLAR DURUYOR', /Bizans/.test(sonra.konu), sonra.konu);
  k('DOLU PROJEDE BÖLÜM AÇIK AÇILIYOR', sonra.acik === true);
  k('sayaç yine doğru', /11 dolu/.test(sonra.sayac), sonra.sayac);

  // Buluta giden satirda alanlar var mi
  const satir = await page.evaluate(()=>{
    const r = projToRow(projects[0], 'u1');
    return { anahtarlar: Object.keys(r), ilce: r.district, cekilecek: r.shot_list };
  });
  k('BULUT SATIRINDA SAHA ALANLARI VAR',
     satir.anahtarlar.includes('district') && satir.anahtarlar.includes('shot_list') &&
     satir.ilce === 'Fatih', satir.ilce);

  // Buluttan gelen satir geri okunuyor mu
  const geri = await page.evaluate(()=>{
    const p = projFromRow({ id:'pr_x', name:'Test', type:'outdoor', steps:{}, deadlines:{},
      district:'Beşiktaş', city:'İstanbul', topic:'Konu', format:'Hibrit',
      permission:'İzin var', script_url:'u1', drive_url:'u2', maps_url:'u3',
      field_notes:'n', cautions:'c', shot_list:'s' });
    return { ilce:p.district, format:p.format, cekilecek:p.shotList, dikkat:p.cautions };
  });
  k('BULUTTAN GELEN SATIR GERİ OKUNUYOR',
     geri.ilce==='Beşiktaş' && geri.format==='Hibrit' && geri.cekilecek==='s' && geri.dikkat==='c',
     JSON.stringify(geri));

  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
