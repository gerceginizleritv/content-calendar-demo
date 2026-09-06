const { chromium } = require('./araclar');
(async () => {
  const D = process.argv[2];
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:900} });
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  // Uygulama artik projeler sayfasiyla aciliyor; takvim testleri once
  // takvim sekmesine geciyor.
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('calendar'); });

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('PROJE KONSEPTI + KLONLAMA');

  // Hic proje yokken filtre satiri gorunmemeli
  k('proje yokken filtre satırı gizli',
    await page.evaluate(()=> document.getElementById('conceptLegend').hidden === true));

  // Yeni kayit: proje modalden olusturuluyor (artik serbest metin degil secim)
  const olustur = await page.evaluate(async ()=>{
    const pr = window.sor; window.sor = ()=> 'Stüdyo Çekimi';
    openModal(null, '2026-09-10');
    document.getElementById('f_title').value = 'Ana video';
    document.querySelector('#typeChecks input').checked = true;
    document.querySelector('#platformChecks input').checked = true;
    document.getElementById('saveBtn').click();
    await new Promise(r=>setTimeout(r,300));
    window.sor = pr;
    const e = events.find(x=>x.title==='Ana video');
    return { kayitli: e ? evProjectAdi(e) : null,
             filtreGorunur: !document.getElementById('conceptLegend').hidden,
             cip: [...document.querySelectorAll('#conceptLegend .legend-item')].map(x=>x.textContent.trim()) };
  });
  k('proje kayda bağlandı', olustur.kayitli === 'Stüdyo Çekimi', olustur.kayitli);
  k('filtre satırı belirdi', olustur.filtreGorunur === true);
  k('projesiz kayıtlar için de seçenek var', olustur.cip.some(x=>/Projesiz|No project/.test(x)), olustur.cip.join(' | '));

  // Filtre calisiyor mu
  const filtre = await page.evaluate(async ()=>{
    document.getElementById('editOverlay').classList.remove('open');
    const cip = [...document.querySelectorAll('#conceptLegend .legend-item')].find(x=>x.dataset.concept==='Stüdyo Çekimi');
    cip.click();
    await new Promise(r=>setTimeout(r,200));
    return { gorunen: document.querySelectorAll('#calGrid .cal-chip, #calGrid .cal-entry, #calGrid [data-ev-id]').length,
             toplam: events.length };
  });
  k('filtre uygulanınca liste daraldı', filtre.gorunen < filtre.toplam, filtre.gorunen + ' / ' + filtre.toplam);

  // Klonlama
  const klon = await page.evaluate(async ()=>{
    document.querySelectorAll('#conceptLegend .legend-item').forEach(x=>{ if(x.classList.contains('active')) x.click(); });
    await new Promise(r=>setTimeout(r,150));
    const kaynak = events.find(x=>x.title==='Ana video');
    kaynak.content.caption = 'kopyalanacak metin';
    kaynak.uploaded = true;
    openModal(kaynak);
    const klonDugmesi = getComputedStyle(document.getElementById('cloneBtn')).display !== 'none';
    document.getElementById('cloneBtn').click();
    await new Promise(r=>setTimeout(r,200));
    return { klonDugmesi,
             acik: document.getElementById('cloneOverlay').classList.contains('open'),
             satir: document.querySelectorAll('#cloneRows .clone-row').length,
             ilkTarih: document.querySelector('.k-date').value,
             kaynakTarih: kaynak.date,
             bilgi: document.getElementById('cloneSource').textContent };
  });
  k('mevcut kayıtta Çoğalt düğmesi çıkıyor', klon.klonDugmesi === true);
  k('çoğaltma penceresi açıldı', klon.acik === true);
  k('bir satırla açılıyor', klon.satir === 1, klon.satir);
  k('ilk satır ertesi güne ayarlı', klon.ilkTarih > klon.kaynakTarih, klon.kaynakTarih + ' → ' + klon.ilkTarih);
  k('hangi kayıt çoğaltılıyor yazıyor', /Ana video/.test(klon.bilgi), klon.bilgi);

  // Yeni kayitta klon dugmesi olmamali
  k('yeni kayıtta Çoğalt düğmesi yok', await page.evaluate(async ()=>{
    document.getElementById('cloneOverlay').classList.remove('open');
    openModal(null,'2026-09-12');
    const g = getComputedStyle(document.getElementById('cloneBtn')).display === 'none';
    document.getElementById('editOverlay').classList.remove('open');
    return g; }));

  // Satir ekle, tarihleri tek tek sec, olustur
  const sonuc = await page.evaluate(async ()=>{
    const kaynak = events.find(x=>x.title==='Ana video');
    openClone(kaynak);
    document.getElementById('cloneAddRow').click();
    document.getElementById('cloneAddRow').click();
    const satirlar = [...document.querySelectorAll('#cloneRows .clone-row')];
    const tarihler = ['2026-09-15','2026-09-18','2026-09-22'];
    const platformlar = ['instagram','tiktok','youtube'];
    satirlar.forEach((sr,i)=>{ sr.querySelector('.k-date').value = tarihler[i];
      sr.querySelector('.k-platform').value = platformlar[i]; });
    const once = events.length;
    document.getElementById('cloneSave').click();
    await new Promise(r=>setTimeout(r,400));
    const yeniler = events.filter(e=>e.title==='Ana video' && e.id !== kaynak.id);
    return { eklenen: events.length - once,
             tarihler: yeniler.map(e=>e.date).sort(),
             platformlar: yeniler.map(e=>e.platform).sort(),
             metinKopyalandi: yeniler.every(e=>e.content.caption === 'kopyalanacak metin'),
             projeKopyalandi: yeniler.every(e=>evProjectAdi(e) === 'Stüdyo Çekimi'),
             hicbiriYayinlanmis: yeniler.some(e=>e.uploaded),
             kapandi: !document.getElementById('cloneOverlay').classList.contains('open') };
  });
  k('üç kopya oluştu', sonuc.eklenen === 3, sonuc.eklenen);
  k('tarihler tek tek seçildiği gibi', sonuc.tarihler.join(',') === '2026-09-15,2026-09-18,2026-09-22', sonuc.tarihler.join(', '));
  k('platformlar ayrı ayrı', sonuc.platformlar.join(',') === 'instagram,tiktok,youtube', sonuc.platformlar.join(', '));
  k('açıklama metni kopyalandı', sonuc.metinKopyalandi === true);
  k('proje adı kopyalandı', sonuc.projeKopyalandi === true);
  k('kopyalar yayınlanmamış başlıyor', sonuc.hicbiriYayinlanmis === false);
  k('pencere kapandı', sonuc.kapandi === true);

  await page.screenshot({ path: D+'/proje.png' });
  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
