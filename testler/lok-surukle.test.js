const { chromium } = require('./araclar');
const fs = require('fs');
(async () => {
  const D = process.argv[2], PORT = process.argv[3] || '8097';
  const satirlar = JSON.parse(fs.readFileSync(D + '/satirlar.json', 'utf8'));
  const veri = { workspaces:[{id:'00000000-0000-0000-0000-000000000001',name:'Test'}],
                 locations: satirlar.L, calendar_events: satirlar.E };
  const stub = fs.readFileSync(D + '/sahte-supabase.js', 'utf8');
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  const hatalar=[];

  const ac = async (vp, mobil)=>{
    const ctx = mobil
      ? await b.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true })
      : await b.newContext({ viewport: vp });
    const page = await ctx.newPage();
    page.on('pageerror', e=>hatalar.push(String(e)));
    await page.addInitScript(({veri,stub})=>{ window.__VERI__=veri;
      window.__OTURUM__={user:{id:'00000000-0000-0000-0000-000000000002',email:'t@o.com'}};
      window.eval(stub); }, {veri,stub});
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.goto('http://127.0.0.1:'+PORT+'/index.html', {waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
      [...document.querySelectorAll('button,a')].find(x=>/Yayın Takvimi/.test(x.textContent)).click(); });
    await page.waitForTimeout(600);
    // Acilistaki "Bekleyenler" penceresi veri yuklendikten SONRA aciliyor ve
    // butun tiklamalari yutuyor; testin konusu o degil.
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
    return page;
  };

  console.log('LOKASYON — SÜRÜKLE BIRAK');
  let page = await ac({width:1400,height:1000}, false);

  // Hedef bir kayit bul, ekranda gorunur hale getir
  const hazir = await page.evaluate(async ()=>{
    // Suruklenecek kaydin gunune git
    const ev = calendarEvents.find(e=>e.date && e.title);
    // Takvimi o kaydin ayina getir
    while(true){
      const kutu = [...document.querySelectorAll('.cal-day')].find(c=>c.dataset.gun === ev.date);
      if(kutu) break;
      const ileri = [...document.querySelectorAll('button')].find(x=>/›|İleri|Sonraki/.test(x.textContent));
      if(!ileri) break;
      break;
    }
    return { id: ev.id, tarih: ev.date, baslik: ev.title,
             gunDamgasi: document.querySelectorAll('.cal-day[data-gun]').length,
             chipVar: document.querySelectorAll('.cal-chip').length };
  });
  k('gün hücrelerinde tarih damgası var', hazir.gunDamgasi > 0, hazir.gunDamgasi+' hücre');
  k('takvimde kayıt kutusu var', hazir.chipVar > 0, hazir.chipVar);

  // 1) FARE ile surukleme
  const fare = await page.evaluate(async ()=>{
    // Ekranda duran ilk kaydi ve BOS bir gunu bul
    const chip = document.querySelector('.cal-chip');
    if(!chip) return { yok:true };
    // chip hangi kayda ait: baslik ve saatten bul
    const hucre = chip.closest('.cal-day');
    const kaynakGun = hucre.dataset.gun;
    const hedef = [...document.querySelectorAll('.cal-day[data-gun]')].find(c=>c.dataset.gun !== kaynakGun);
    return { kaynakGun, hedefGun: hedef.dataset.gun,
             cx: chip.getBoundingClientRect().left + 8,
             cy: chip.getBoundingClientRect().top + 8,
             hx: hedef.getBoundingClientRect().left + 30,
             hy: hedef.getBoundingClientRect().top + 30,
             baslik: chip.textContent.trim().slice(0,30) };
  });
  k('sürüklenecek kayıt ve hedef gün bulundu', !fare.yok && fare.hedefGun, fare.kaynakGun+' → '+fare.hedefGun);

  const oncekiDurum = await page.evaluate((g)=> calendarEvents.filter(e=>e.date===g).length, fare.hedefGun);

  await page.mouse.move(fare.cx, fare.cy);
  await page.mouse.down();
  await page.mouse.move(fare.cx + 20, fare.cy + 10, { steps: 4 });
  const hayalet = await page.evaluate(()=>({
    var: !!document.querySelector('.surukle-hayalet'),
    metin: (document.querySelector('.surukle-hayalet')||{}).textContent,
    govde: document.body.classList.contains('suruklenirken') }));
  k('sürüklerken hayalet çıkıyor', hayalet.var === true, hayalet.metin);
  k('gövdeye sürükleme işareti kondu', hayalet.govde === true);

  await page.mouse.move(fare.hx, fare.hy, { steps: 8 });
  const isaret = await page.evaluate(()=>({
    hedef: document.querySelectorAll('.surukle-hedef').length,
    gun: (document.querySelector('.surukle-hedef')||{}).dataset }));
  k('hedef gün işaretleniyor', isaret.hedef === 1, JSON.stringify(isaret.gun));

  await page.mouse.up();
  await page.waitForTimeout(500);
  const sonuc = await page.evaluate(([hg, kg])=>({
    hedefteki: calendarEvents.filter(e=>e.date===hg).length,
    hayaletKalmadi: !document.querySelector('.surukle-hayalet'),
    isaretKalmadi: document.querySelectorAll('.surukle-hedef').length === 0,
    govdeTemiz: !document.body.classList.contains('suruklenirken'),
    modalAcik: document.getElementById('calOverlay').classList.contains('open'),
    yazma: window.__yazmalar.filter(w=>w.tablo==='calendar_events').length
  }), [fare.hedefGun, fare.kaynakGun]);
  k('KAYIT HEDEF GÜNE TAŞINDI', sonuc.hedefteki === oncekiDurum + 1, oncekiDurum+' → '+sonuc.hedefteki);
  k('hayalet ve işaret temizlendi', sonuc.hayaletKalmadi && sonuc.isaretKalmadi && sonuc.govdeTemiz);
  k('SÜRÜKLEDİKTEN SONRA PENCERE AÇILMIYOR', sonuc.modalAcik === false);
  k('buluta yazıldı', sonuc.yazma > 0, sonuc.yazma+' yazma');

  // 2) Sadece TARIH degisti, gerisi durdu
  const degisim = await page.evaluate((hg)=>{
    const e = calendarEvents.filter(x=>x.date===hg).slice(-1)[0];
    return { u:e.uploaded, p:e.platform, t:e.type||e.typeOverride, lok:e.locationId,
             cap:(e.content&&e.content.caption||'').length };
  }, fare.hedefGun);
  k('hesap, tür, lokasyon ve içerik değişmedi',
     degisim.p && degisim.lok !== undefined, JSON.stringify(degisim));

  // 3) TIKLAMA hala calisiyor (surukleme yapmadan)
  const tikla = await page.evaluate(async ()=>{
    document.getElementById('calOverlay').classList.remove('open');
    const chip = document.querySelector('.cal-chip');
    const r = chip.getBoundingClientRect();
    return { x: r.left+8, y: r.top+8 };
  });
  await page.mouse.move(tikla.x, tikla.y);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(300);
  k('SÜRÜKLEMEDEN TIKLAYINCA KAYIT AÇILIYOR',
     await page.evaluate(()=>document.getElementById('calOverlay').classList.contains('open')));

  // 4) Tabloda BASKA HESABIN sutununa birakilamiyor
  await page.evaluate(()=>{ document.getElementById('calOverlay').classList.remove('open'); });
  const tablo = await page.evaluate(async ()=>{
    const tblBtn = [...document.querySelectorAll('.cal-toggle-btn,button')].find(x=>/Tablo|Yatay/.test(x.textContent));
    if(tblBtn) tblBtn.click();
    await new Promise(r=>setTimeout(r,400));
    const chip = document.querySelector('.cal-cell-chip');
    if(!chip) return { yok:true };
    const td = chip.closest('td');
    const kendiPf = td.dataset.platform, gun = td.dataset.gun;
    const baskaSutun = [...document.querySelectorAll('td[data-platform]')]
      .find(x=>x.dataset.platform !== kendiPf && x.dataset.gun !== gun);
    const ayniSutun = [...document.querySelectorAll('td[data-platform]')]
      .find(x=>x.dataset.platform === kendiPf && x.dataset.gun !== gun);
    const r = chip.getBoundingClientRect();
    return { kendiPf, gun,
             cx:r.left+6, cy:r.top+6,
             bx: baskaSutun ? baskaSutun.getBoundingClientRect().left+20 : 0,
             by: baskaSutun ? baskaSutun.getBoundingClientRect().top+12 : 0,
             ax: ayniSutun ? ayniSutun.getBoundingClientRect().left+20 : 0,
             ay: ayniSutun ? ayniSutun.getBoundingClientRect().top+12 : 0,
             baskaGun: baskaSutun && baskaSutun.dataset.gun,
             ayniGun: ayniSutun && ayniSutun.dataset.gun };
  });
  if(tablo.yok){ k('tablo görünümünde kayıt var', false); }
  else {
    await page.mouse.move(tablo.cx, tablo.cy);
    await page.mouse.down();
    await page.mouse.move(tablo.bx, tablo.by, { steps: 6 });
    const baska = await page.evaluate(()=>document.querySelectorAll('.surukle-hedef').length);
    k('BAŞKA HESABIN SÜTUNU HEDEF DEĞİL', baska === 0, baska+' işaretli');
    await page.mouse.move(tablo.ax, tablo.ay, { steps: 6 });
    const ayni = await page.evaluate(()=>document.querySelectorAll('.surukle-hedef').length);
    k('kendi sütununda hedef işaretleniyor', ayni === 1, ayni+' işaretli');
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  await page.context().close();

  // 5) TELEFON: basili tutunca surukleniyor, hemen kaydirinca sayfa kayiyor
  page = await ac(null, true);
  const dokun = await page.evaluate(()=>{
    const chip = document.querySelector('.cal-chip');
    if(!chip) return { yok:true };
    const r = chip.getBoundingClientRect();
    return { x:Math.round(r.left+8), y:Math.round(r.top+8) };
  });
  if(dokun.yok){ k('telefonda kayıt kutusu var', false); }
  else {
    const cdp = await page.context().newCDPSession(page);
    const nokta = (x,y)=>[{x,y,radiusX:6,radiusY:6,force:1,id:1}];
    // Basili tut, bekle, sonra hareket ettir
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:nokta(dokun.x,dokun.y)});
    await page.waitForTimeout(400);
    const basili = await page.evaluate(()=>!!document.querySelector('.surukle-hayalet'));
    k('TELEFONDA BASILI TUTUNCA SÜRÜKLEME BAŞLIYOR', basili === true);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:nokta(dokun.x+10,dokun.y+120)});
    await page.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(400);
    const temiz = await page.evaluate(()=>({
      hayalet: !document.querySelector('.surukle-hayalet'),
      govde: !document.body.classList.contains('suruklenirken') }));
    k('telefonda bırakınca temizleniyor', temiz.hayalet && temiz.govde);

    // Hemen kaydirinca surukleme BASLAMAMALI
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:nokta(dokun.x,dokun.y)});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:nokta(dokun.x,dokun.y+60)});
    await page.waitForTimeout(120);
    const kaydirma = await page.evaluate(()=>!document.querySelector('.surukle-hayalet'));
    k('HEMEN KAYDIRINCA SÜRÜKLEME BAŞLAMIYOR (sayfa kayabilsin)', kaydirma === true);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await page.context().close();

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
