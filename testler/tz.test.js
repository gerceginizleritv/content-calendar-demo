const { chromium } = require('./araclar');
const fs = require('fs');
(async () => {
  const D = process.argv[2];
  const satirlar = JSON.parse(fs.readFileSync(D+'/satirlar.json','utf8'));
  const veri = { workspaces:[{id:'00000000-0000-0000-0000-000000000001',name:'T'}],
                 locations: satirlar.L, calendar_events: satirlar.E };
  const stub = fs.readFileSync(D+'/sahte-supabase.js','utf8');
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:900}, timezoneId:'Europe/Istanbul' });
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(({veri,stub})=>{ window.__VERI__=veri;
    window.__OTURUM__={user:{id:'00000000-0000-0000-0000-000000000002',email:'t@o.com'}}; window.eval(stub); },{veri,stub});
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.goto('http://127.0.0.1:8099/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1300);
  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('SAAT DILIMI');

  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open,#pendingOverlay').forEach(o=>o.classList.remove('open'));
    [...document.querySelectorAll('button,a')].find(x=>/Yayın Takvimi/.test(x.textContent)).click(); });
  await page.waitForTimeout(400);

  // Yeni kayit: yerel dilim varsayilan gelmeli
  const yeni = await page.evaluate(()=>{ document.getElementById('calAddBtn').click();
    const s=document.getElementById('cal_tz');
    return { secenek:s.options.length, deger:s.value }; });
  k('dilim listesi doldu', yeni.secenek > 100, yeni.secenek + ' seçenek');
  k('yeni kayıtta kendi dilimin seçili', yeni.deger === 'Europe/Istanbul', yeni.deger);

  // Mevcut kayit: dilimi yoksa yine yerel gorunmeli, "undefined" YAZMAMALI
  const mevcut = await page.evaluate(()=>{ document.getElementById('calOverlay').classList.remove('open');
    document.querySelector('.cal-chip').click();
    return document.getElementById('cal_tz').value; });
  k('eski kayıtta dilim boş değil, yerel geliyor', mevcut === 'Europe/Istanbul', mevcut);

  // Tek dilimdeyken takvimde etiket GORUNMEMELI
  const tek = await page.evaluate(()=>{ document.getElementById('calOverlay').classList.remove('open');
    return document.querySelectorAll('.cal-tz-tag').length; });
  k('tek pazarda dilim etiketi yok', tek === 0, tek);

  // Bir kaydi baska dilime al -> etiketler cikmali
  const cok = await page.evaluate(()=>{
    const e = calendarEvents.find(x=>x.date >= new Date().toISOString().slice(0,10)) || calendarEvents[0];
    e.content.timezone = 'Asia/Tokyo';
    renderCal();
    const etiketler = [...document.querySelectorAll('.cal-tz-tag')].map(x=>x.textContent);
    return { adet: etiketler.length, ornek: etiketler.slice(0,4), undef: etiketler.filter(x=>/undefined/.test(x)).length };
  });
  k('iki pazar olunca etiketler çıktı', cok.adet > 0, cok.adet + ' etiket: ' + cok.ornek.join(', '));
  k('hiçbir etikette "undefined" yok', cok.undef === 0);

  // Kaydetme: secilen dilim content icine yaziliyor mu
  const kaydet = await page.evaluate(async ()=>{
    window.__yazmalar.length = 0;
    document.getElementById('calAddBtn').click();
    document.getElementById('cal_title').value = 'Dilim testi';
    document.getElementById('cal_date').value = '2026-10-01';
    document.getElementById('cal_time').value = '09:00';
    document.getElementById('cal_tz').value = 'America/New_York';
    document.querySelector('#calPlatformMultiWrap input[type=checkbox]').checked = true;
    document.getElementById('calSaveBtn').click();
    await new Promise(r=>setTimeout(r,900));
    const y = calendarEvents.find(e=>e.title==='Dilim testi');
    const gonderilen = window.__yazmalar.filter(w=>w.tablo==='calendar_events');
    return { kayitli: y ? y.content.timezone : null, yazildi: gonderilen.length };
  });
  k('seçilen dilim kayda yazıldı', kaydet.kayitli === 'America/New_York', kaydet.kayitli);
  k('veritabanına gönderildi', kaydet.yazildi > 0, kaydet.yazildi);

  await page.screenshot({ path: D+'/tz.png' });
  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,4).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
