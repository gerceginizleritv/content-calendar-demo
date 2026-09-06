const { chromium } = require('./araclar');
(async () => {
  const D = process.argv[2];
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:950} });
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_page','calendar'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('calendar'); setView('month'); });
  await page.waitForTimeout(300);

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('SURUKLE-BIRAK');

  const bas = await page.evaluate(()=>{
    const c = document.querySelector('#calGrid .cal-chip');
    const id = events.find(e=>true);
    return { rozetVar: !!c, gunEtiketi: !!document.querySelector('#calGrid .cal-day[data-gun]') };
  });
  k('rozetler ve gün etiketleri var', bas.rozetVar && bas.gunEtiketi);

  // FARE: bir rozeti baska gune surukle
  const kaynak = await page.evaluate(()=>{
    const c = document.querySelector('#calGrid .cal-chip');
    c.scrollIntoView({block:'center'});
    const gun = c.closest('.cal-day');
    // Hedef de ekranda olmali; ekran disindaki bir hucreye fare gonderilemez.
    const hedefler = [...document.querySelectorAll('#calGrid .cal-day')].filter(x=>{
      if(x.dataset.gun === gun.dataset.gun || x.querySelector('.cal-chip')) return false;
      const r = x.getBoundingClientRect();
      return r.top > 60 && r.bottom < window.innerHeight - 20;
    });
    const hedef = hedefler[Math.floor(hedefler.length/2)];
    const r1 = c.getBoundingClientRect(), r2 = hedef.getBoundingClientRect();
    const kayitId = [...document.querySelectorAll('#calGrid .cal-chip')].indexOf(c);
    return { x1:r1.x+r1.width/2, y1:r1.y+r1.height/2, x2:r2.x+r2.width/2, y2:r2.y+30,
             kaynakGun: gun.dataset.gun, hedefGun: hedef.dataset.gun };
  });
  await page.mouse.move(kaynak.x1, kaynak.y1);
  await page.mouse.down();
  await page.mouse.move(kaynak.x1+20, kaynak.y1+10, {steps:4});
  const hayalet = await page.evaluate(()=> !!document.querySelector('.surukle-hayalet'));
  k('sürüklerken hayalet çıkıyor', hayalet === true);
  await page.mouse.move(kaynak.x2, kaynak.y2, {steps:8});
  const isaret = await page.evaluate(()=> !!document.querySelector('.surukle-hedef'));
  k('hedef gün işaretleniyor', isaret === true);
  await page.mouse.up();
  await page.waitForTimeout(300);

  const sonuc = await page.evaluate((g)=>{
    const hedef = document.querySelector(`#calGrid .cal-day[data-gun="${g}"]`);
    return { hedefteRozet: hedef.querySelectorAll('.cal-chip').length,
             tarih: events.find(e=>e.date === g) ? g : null,
             modalAcik: document.getElementById('editOverlay').classList.contains('open'),
             hayalet: !!document.querySelector('.surukle-hayalet'),
             isaret: !!document.querySelector('.surukle-hedef') };
  }, kaynak.hedefGun);
  k('kayıt hedef güne taşındı', sonuc.hedefteRozet > 0 && sonuc.tarih === kaynak.hedefGun,
     kaynak.kaynakGun + ' → ' + kaynak.hedefGun);
  k('bırakınca düzenleme penceresi AÇILMIYOR', sonuc.modalAcik === false);
  k('hayalet ve işaret temizlendi', sonuc.hayalet === false && sonuc.isaret === false);

  // "Yayinlandi" isareti degismemeli
  const isaretKorundu = await page.evaluate((g)=>{
    const e = events.find(x=>x.date === g);
    return e ? e.uploaded : null;
  }, kaynak.hedefGun);
  k('yayınlandı işareti sürüklemeyle değişmedi', isaretKorundu === false || isaretKorundu === true, String(isaretKorundu));

  // Sadece tiklama: modal acilmali, tarih degismemeli
  const tikla = await page.evaluate(async ()=>{
    const c = document.querySelector('#calGrid .cal-chip');
    c.scrollIntoView({block:'center'});
    const g = c.closest('.cal-day').dataset.gun;
    const r = c.getBoundingClientRect();
    return { x:r.x+r.width/2, y:r.y+r.height/2, gun:g };
  });
  await page.mouse.move(tikla.x, tikla.y);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);
  const tiklaSonuc = await page.evaluate((g)=>({
    modal: document.getElementById('editOverlay').classList.contains('open'),
    hala: !!document.querySelector(`#calGrid .cal-day[data-gun="${g}"] .cal-chip`)
  }), tikla.gun);
  k('tıklamak hâlâ kaydı açıyor', tiklaSonuc.modal === true);
  k('tıklamak tarihi değiştirmiyor', tiklaSonuc.hala === true);

  // Ayni gune birakmak degisiklik yaratmamali
  await page.evaluate(()=> document.getElementById('editOverlay').classList.remove('open'));
  const ayniGun = await page.evaluate(()=>{
    const c = document.querySelector('#calGrid .cal-chip');
    c.scrollIntoView({block:'center'});
    const r = c.getBoundingClientRect();
    return { x:r.x+r.width/2, y:r.y+r.height/2, gun:c.closest('.cal-day').dataset.gun,
             once: JSON.stringify(events.map(e=>e.date)) };
  });
  await page.mouse.move(ayniGun.x, ayniGun.y);
  await page.mouse.down();
  await page.mouse.move(ayniGun.x+15, ayniGun.y+8, {steps:4});
  await page.mouse.up();
  await page.waitForTimeout(250);
  const ayniSonuc = await page.evaluate(o=> JSON.stringify(events.map(e=>e.date)) === o, ayniGun.once);
  k('aynı güne bırakmak hiçbir şeyi değiştirmiyor', ayniSonuc === true);

  // Yenileyince kalici
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(1300);
  const kalici = await page.evaluate((g)=> events.some(e=>e.date === g), kaynak.hedefGun);
  k('taşıma yenileyince duruyor', kalici === true);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
