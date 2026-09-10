const { chromium } = require('./araclar');
const fs = require('fs');
(async () => {
  const D = process.argv[2];
  const PORT = process.argv[3] || '8097';
  const satirlar = JSON.parse(fs.readFileSync(D + '/satirlar.json', 'utf8'));
  const veri = { workspaces:[{id:'00000000-0000-0000-0000-000000000001',name:'Test'}],
                 locations: satirlar.L, calendar_events: satirlar.E };
  const stub = fs.readFileSync(D + '/sahte-supabase.js', 'utf8');
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1300,height:950} });
  const hatalar = [];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(({veri,stub})=>{ window.__VERI__=veri;
    window.__OTURUM__={user:{id:'00000000-0000-0000-0000-000000000002',email:'t@o.com'}};
    window.eval(stub); }, {veri,stub});
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.goto('http://127.0.0.1:'+PORT+'/index.html', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('LOKASYON — KAYIT ÇOĞALTMA');

  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    [...document.querySelectorAll('button,a')].find(x=>/Yayın Takvimi/.test(x.textContent)).click(); });
  await page.waitForTimeout(400);

  // 1) Yeni kayitta cogalt dugmesi GORUNMEMELI
  const yeni = await page.evaluate(async ()=>{
    openCalDetail(null, '2026-09-20');
    await new Promise(r=>setTimeout(r,200));
    const d = document.getElementById('calCloneBtn');
    return { gorunur: getComputedStyle(d).display !== 'none' };
  });
  k('yeni kayıtta “Çoğalt” gizli', yeni.gorunur === false);

  // 2) Kayitli giriste gorunmeli ve pencereyi acmali
  const ac = await page.evaluate(async ()=>{
    closeCalModal();
    const ev = calendarEvents.find(e=>e.title && e.content && e.content.caption);
    openCalDetail(ev);
    await new Promise(r=>setTimeout(r,200));
    const gorunur = getComputedStyle(document.getElementById('calCloneBtn')).display !== 'none';
    document.getElementById('calCloneBtn').click();
    await new Promise(r=>setTimeout(r,250));
    const sr = document.querySelector('#cloneRows .clone-row');
    return { gorunur, kaynakBaslik: ev.title, kaynakTarih: ev.date,
             acik: document.getElementById('cloneOverlay').classList.contains('open'),
             calKapandi: !document.getElementById('calOverlay').classList.contains('open'),
             satir: document.querySelectorAll('#cloneRows .clone-row').length,
             ilkTarih: sr ? sr.querySelector('.k-date').value : '',
             ilkTur: sr ? sr.querySelector('.k-type').value : '',
             ozet: document.getElementById('cloneSource').textContent,
             turSecenek: sr ? sr.querySelectorAll('.k-type option').length : 0,
             pfSecenek: sr ? sr.querySelectorAll('.k-platform option').length : 0 };
  });
  k('kayıtlı girişte “Çoğalt” görünür', ac.gorunur === true);
  k('pencere açıldı, kayıt penceresi kapandı', ac.acik === true && ac.calKapandi === true);
  k('bir satırla açılıyor', ac.satir === 1);
  const ertesi = (()=>{ const d=new Date(ac.kaynakTarih+'T00:00:00'); d.setDate(d.getDate()+1);
    const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; })();
  k('ilk satır bir gün sonrası', ac.ilkTarih === ertesi, ac.kaynakTarih+' → '+ac.ilkTarih);
  k('tür ve hesap listeleri dolu', ac.turSecenek === 7 && ac.pfSecenek === 4, ac.turSecenek+' tür / '+ac.pfSecenek+' hesap');
  k('kaynak ve adet yazıyor', /Kaynak:/.test(ac.ozet) && /1 kopya/.test(ac.ozet), ac.ozet);

  // 3) Satir ekle / cikar
  const satir = await page.evaluate(async ()=>{
    document.getElementById('cloneAddRow').click();
    document.getElementById('cloneAddRow').click();
    await new Promise(r=>setTimeout(r,120));
    const uc = document.querySelectorAll('#cloneRows .clone-row').length;
    document.querySelector('#cloneRows .clone-row:last-child .k-del').click();
    await new Promise(r=>setTimeout(r,120));
    return { uc, iki: document.querySelectorAll('#cloneRows .clone-row').length,
             ozet: document.getElementById('cloneSource').textContent };
  });
  k('satır eklenip çıkarılabiliyor', satir.uc === 3 && satir.iki === 2, satir.uc+' → '+satir.iki);
  k('özet sayıyı güncelliyor', /2 kopya/.test(satir.ozet), satir.ozet);

  // 4) Tarihsiz satir engelleniyor
  const bosTarih = await page.evaluate(async ()=>{
    document.querySelector('#cloneRows .clone-row .k-date').value = '';
    // lokasyon.html hala tarayicinin alert'ini kullaniyor (donusum
    // yalnizca app.html'de yapildi).
    const up=[]; const ea=window.alert; window.alert=m=>up.push(m);
    const once = calendarEvents.length;
    document.getElementById('cloneSave').click();
    await new Promise(r=>setTimeout(r,250));
    window.alert=ea;
    return { up, olustu: calendarEvents.length - once,
             acik: document.getElementById('cloneOverlay').classList.contains('open') };
  });
  k('tarihsiz satır engelleniyor', bosTarih.olustu === 0 && bosTarih.up.length === 1, JSON.stringify(bosTarih.up));
  k('pencere açık kalıyor (veri kaybolmasın)', bosTarih.acik === true);

  // 5) Gercek cogaltma
  const olustur = await page.evaluate(async ()=>{
    const kaynak = calendarEvents.find(e=>e.title && e.content && e.content.caption);
    const once = calendarEvents.length;
    const sr = [...document.querySelectorAll('#cloneRows .clone-row')];
    sr[0].querySelector('.k-date').value = '2026-10-01';
    sr[0].querySelector('.k-type').value = 'reels';
    sr[0].querySelector('.k-platform').value = 'instagram';
    sr[0].querySelector('.k-time').value = '19:30';
    sr[1].querySelector('.k-date').value = '2026-10-02';
    sr[1].querySelector('.k-type').value = 'shorts';
    sr[1].querySelector('.k-platform').value = 'youtube';
    window.__yazmalar.length = 0;
    document.getElementById('cloneSave').click();
    await new Promise(r=>setTimeout(r,500));
    const yeniler = calendarEvents.slice(once);
    return { adet: calendarEvents.length - once,
             kapandi: !document.getElementById('cloneOverlay').classList.contains('open'),
             kaynakBaslik: kaynak.title, kaynakCaption: (kaynak.content.caption||'').slice(0,40),
             kaynakLok: kaynak.locationId, kaynakYayin: kaynak.uploaded,
             yeniler: yeniler.map(e=>({ t:e.type, p:e.platform, d:e.date, s:e.time,
                                        u:e.uploaded, lok:e.locationId, bas:e.title,
                                        cap:(e.content.caption||'').slice(0,40) })),
             kimlikTekil: new Set(calendarEvents.map(e=>e.id)).size === calendarEvents.length,
             yazma: window.__yazmalar.filter(w=>w.tablo==='calendar_events') };
  });
  k('İKİ KOPYA OLUŞTU', olustur.adet === 2, olustur.adet);
  k('pencere kapandı', olustur.kapandi === true);
  k('tür/hesap/tarih/saat girildiği gibi',
     olustur.yeniler[0].t==='reels' && olustur.yeniler[0].p==='instagram' &&
     olustur.yeniler[0].d==='2026-10-01' && olustur.yeniler[0].s==='19:30' &&
     olustur.yeniler[1].t==='shorts' && olustur.yeniler[1].p==='youtube',
     JSON.stringify(olustur.yeniler.map(x=>x.t+'/'+x.p+' '+x.d+' '+x.s)));
  k('İÇERİK KOPYALANDI', olustur.yeniler.every(e=>e.cap === olustur.kaynakCaption && e.bas === olustur.kaynakBaslik),
     JSON.stringify(olustur.yeniler[0].cap));
  k('lokasyon bağı korundu', olustur.yeniler.every(e=>e.lok === olustur.kaynakLok));
  k('KOPYA YAYINLANMAMIŞ DOĞUYOR', olustur.yeniler.every(e=>e.u === false), 'kaynak yayınlandı: '+olustur.kaynakYayin);
  k('kimlikler benzersiz', olustur.kimlikTekil === true);
  k('buluta yazıldı', olustur.yazma.some(w=>w.islem==='upsert'), JSON.stringify(olustur.yazma.slice(0,2)));

  // 6) Icerik BAGLI DEGIL kopya: kaynagi degistirmek kopyayi degistirmemeli
  const bagimsiz = await page.evaluate(()=>{
    const kaynak = calendarEvents.find(e=>e.content && e.content.caption);
    const kopya = calendarEvents[calendarEvents.length-1];
    kaynak.content.caption = 'DEĞİŞTİRİLDİ';
    return { kopya: kopya.content.caption.slice(0,20) };
  });
  k('kopya kaynaktan bağımsız', !/DEĞİŞTİRİLDİ/.test(bagimsiz.kopya), bagimsiz.kopya);

  // 7) Takvimde gorunuyor
  const takvim = await page.evaluate(async ()=>{
    renderCal();
    await new Promise(r=>setTimeout(r,250));
    return { ekim: document.body.textContent.indexOf('DEĞİŞTİRİLDİ') , chip: document.querySelectorAll('.cal-chip').length };
  });
  k('takvim yeniden çizildi', takvim.chip > 0, takvim.chip+' kayıt kutusu');

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
