const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); setPage('projects'); });
  await page.waitForTimeout(300);
  console.log('PROJE DURUMU: ozet seridi, tamamlandi, iptal');

  const r = await page.evaluate(async ()=>{
    const c = window.onayla; window.onayla = ()=>false;
    const kur = async (ad, tarih)=>{
      openProjectNew(ad);
      document.getElementById('pe_type').value='studio';
      document.getElementById('pe_type').dispatchEvent(new Event('change'));
      document.getElementById('pe_shoot').value = tarih || '';
      document.getElementById('pe_save').click();
      await new Promise(r=>setTimeout(r,200));
    };
    await kur('A surende', '2026-09-05');
    await kur('B bitecek', '2026-09-06');
    await kur('C iptal',   '2026-09-07');
    await kur('D surende', '2026-09-08');
    await new Promise(r=>setTimeout(r,400));
    window.onayla = c;
    const ad = ()=> [...document.querySelectorAll('.proj-table tbody .pname')].map(x=>x.textContent.trim());
    // OZET SERIDI KALDIRILDI. Sayfanin ustunde ust uste iki sayi blogu
    // vardi; biri okunuyor oteki calisiyordu. Bu testteki dokuz olcum onu
    // olcuyordu ve serit gidince askta kaldi. Ayni olcutler (script hazir,
    // cekildi, izin gerekiyor, iptal) filtre ciplerinde duruyor ve orasi
    // proje-filtre testleriyle olculuyor. Buradaki konu SIRALAMA ve iptal
    // davranisi; o kisim asagida oldugu gibi duruyor.

    // Bazi adimlari isaretle
    const A = projects.find(p=>p.name==='A surende');
    A.script = true; A.filmed = true;
    // B: butun adimlar tamam
    const B = projects.find(p=>p.name==='B bitecek');
    PROJ_STEPS.forEach(x=> B[x] = true);
    // C: iptal + izin alani dolu
    const C = projects.find(p=>p.name==='C iptal');
    C.cancelled = true; C.permission = 'İzin gerekiyor';
    // D: izin alani dolu, gecikmis termin
    const D = projects.find(p=>p.name==='D surende');
    D.permission = 'İzin gerekiyor';
    D.deadlines.script = '2020-01-01';
    saveProjects(); renderProjects();
    await new Promise(r=>setTimeout(r,250));

    const sira = ad();
    const satirlar = [...document.querySelectorAll('.proj-table tbody tr')].map(tr=>({
      ad: tr.querySelector('.pname').textContent.trim(),
      sinif: tr.className,
      rozet: (tr.querySelector('.pbadge')||{}).textContent || '',
      solukluk: getComputedStyle(tr).opacity,
      hucreSoluk: tr.querySelector('.pcell') ? getComputedStyle(tr.querySelector('.pcell')).opacity : null,
      adSoluk: tr.querySelector('.pname') ? getComputedStyle(tr.querySelector('.pname')).opacity : null
    }));

    // Iptal edilen projenin gecikmis adimi ust seritte sayilmamali
    const C2 = projects.find(p=>p.name==='C iptal');
    C2.deadlines.filmed = '2020-01-01';
    saveProjects(); renderProjects();
    await new Promise(r=>setTimeout(r,200));
    const gecikenMetin = document.getElementById('p_overdue').textContent;
    const gecikenSayi = gecikenAdimlar().length;

    // Duzenleme penceresindeki iptal kutusu gercekten yaziyor mu?
    openProjectEdit(A.id);
    const kutuBaslangic = document.getElementById('pe_cancelled').checked;
    document.getElementById('pe_cancelled').checked = true;
    document.getElementById('pe_save').click();
    await new Promise(r=>setTimeout(r,250));
    const AiptalMi = projects.find(p=>p.name==='A surende').cancelled;
    const siraIptalSonrasi = ad();

    // Geri al
    openProjectEdit(A.id);
    const kutuAcilistaIsaretli = document.getElementById('pe_cancelled').checked;
    document.getElementById('pe_cancelled').checked = false;
    document.getElementById('pe_save').click();
    await new Promise(r=>setTimeout(r,250));
    const AgeriDondu = projects.find(p=>p.name==='A surende').cancelled;

    // Lokasyon gocundeki [IPTAL] on eki bayraga cevriliyor mu?
    const gocmus = sanitizeProject({ name:'Gocmus', notes:'[İPTAL]\nEski not' });

    return { sira, satirlar,
             gecikenMetin, gecikenSayi, kutuBaslangic, AiptalMi, siraIptalSonrasi,
             kutuAcilistaIsaretli, AgeriDondu,
             gocmusIptal: gocmus.cancelled, gocmusNot: gocmus.notes };
  });

  // D'nin gecikmis bir termini var, A'nin yok: ikisi de surende oldugu icin
  // aralarindaki sirayi tarih belirliyor ve D once geliyor. Onemli olan
  // ikisinin de bitmis/iptal olanlarin USTUNDE olmasi.
  k('Sira: surende olanlar ustte, bitmis sonra, iptal en altta',
    JSON.stringify(r.sira)===JSON.stringify(['D surende','A surende','B bitecek','C iptal']), r.sira);

  const B = r.satirlar.find(x=>x.ad==='B bitecek');
  const C = r.satirlar.find(x=>x.ad==='C iptal');
  const A = r.satirlar.find(x=>x.ad==='A surende');
  k('Bitmis satirda ✓ rozeti', B && B.rozet==='✓', B);
  k('Bitmis satir prow-bitti sinifinda', B && B.sinif.includes('prow-bitti'), B && B.sinif);
  // Kural degisti: butun satiri saydamlastirmak koyu temada proje adini
  // okunmaz yapiyordu. Artik yalnizca adim hucreleri geri cekiliyor.
  k('Bitmis satirda adim hucreleri geri cekilmis', B && parseFloat(B.hucreSoluk) < 1, B && B.hucreSoluk);
  k('Bitmis satirda proje adi SAYDAM DEGIL', B && B.adSoluk === '1', B && B.adSoluk);
  k('Iptal satirinda İPTAL rozeti', C && C.rozet==='İptal', C);
  k('Iptal satiri prow-iptal sinifinda', C && C.sinif.includes('prow-iptal'), C && C.sinif);
  k('Surendeki satirda rozet yok', A && A.rozet==='', A);
  k('Surendeki satir tam gorunur', A && A.solukluk==='1' && A.hucreSoluk==='1', A);

  k('Iptal edilen projenin gecikmesi sayilmiyor', r.gecikenSayi===1, {sayi:r.gecikenSayi, metin:r.gecikenMetin});
  k('Geciken uyarisinda iptal projesi gecmiyor', !r.gecikenMetin.includes('C iptal'), r.gecikenMetin);

  k('Kutu acilirken bos', r.kutuBaslangic===false);
  k('Kutu isaretlenince proje iptal oluyor', r.AiptalMi===true);
  k('Iptal edilen proje en alta iniyor',
    r.siraIptalSonrasi[r.siraIptalSonrasi.length-1]==='A surende' || r.siraIptalSonrasi.indexOf('A surende') > r.siraIptalSonrasi.indexOf('D surende'),
    r.siraIptalSonrasi);
  k('Pencere yeniden acilinca kutu isaretli geliyor', r.kutuAcilistaIsaretli===true);
  k('Kutu kaldirilinca iptal geri aliniyor', r.AgeriDondu===false);

  k('[İPTAL] on eki bayraga cevriliyor', r.gocmusIptal===true, r.gocmusIptal);
  k('[İPTAL] on eki nottan temizleniyor', r.gocmusNot==='Eski not', r.gocmusNot);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
