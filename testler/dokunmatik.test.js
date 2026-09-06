const { chromium, devices } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_page','calendar'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  // Hafta gorunumu saat izgarasina (hg-cell) donustu; gun hucreleri (.cal-day)
  // ay gorunumunde. Dokunarak surukleme burada sinaniyor.
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('calendar'); setView('month'); });
  await page.waitForTimeout(400);

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('DOKUNMATIK SURUKLEME (Pixel 7, ay gorunumu)');

  const hedefler = await page.evaluate(()=>{
    const c = document.querySelector('#calGrid .cal-chip');
    if(!c) return null;
    c.scrollIntoView({block:'center'});
    const r = c.getBoundingClientRect();
    const gun = c.closest('.cal-day');
    const adaylar = [...document.querySelectorAll('#calGrid .cal-day')].filter(x=>{
      if(x.dataset.gun === gun.dataset.gun) return false;
      const b = x.getBoundingClientRect();
      return b.top > 50 && b.bottom < window.innerHeight - 20;
    });
    const h = adaylar[0];
    const hr = h ? h.getBoundingClientRect() : null;
    return { x:r.x+r.width/2, y:r.y+r.height/2, kaynakGun: gun.dataset.gun,
             hx: hr ? hr.x+hr.width/2 : null, hy: hr ? hr.y+20 : null, hedefGun: h ? h.dataset.gun : null };
  });
  k('rozet ve hedef bulundu', !!hedefler && !!hedefler.hedefGun, hedefler && hedefler.kaynakGun + ' → ' + hedefler.hedefGun);

  // Kisa dokunus: surukleme baslamamali, kayit acilmali
  await page.touchscreen.tap(hedefler.x, hedefler.y);
  await page.waitForTimeout(300);
  k('kısa dokunuş kaydı açıyor', await page.evaluate(()=> document.getElementById('editOverlay').classList.contains('open')));
  await page.evaluate(()=> document.getElementById('editOverlay').classList.remove('open'));

  // Basili tutup surukle
  const cdp = await ctx.newCDPSession(page);
  const dokun = async (tip, x, y)=> cdp.send('Input.dispatchTouchEvent', {
    type: tip, touchPoints: tip === 'touchEnd' ? [] : [{x, y, id:1}] });
  await dokun('touchStart', hedefler.x, hedefler.y);
  await page.waitForTimeout(420);                   // basili tutma esigi
  const basiliTutma = await page.evaluate(()=> !!document.querySelector('.surukle-hayalet'));
  k('basılı tutunca sürükleme başlıyor', basiliTutma === true);
  await dokun('touchMove', hedefler.hx, hedefler.hy);
  await page.waitForTimeout(150);
  k('hedef gün işaretleniyor', await page.evaluate(()=> !!document.querySelector('.surukle-hedef')));
  await dokun('touchEnd', hedefler.hx, hedefler.hy);
  await page.waitForTimeout(350);
  const sonuc = await page.evaluate(g=>({ tasindi: events.some(e=>e.date === g),
    modal: document.getElementById('editOverlay').classList.contains('open'),
    hayalet: !!document.querySelector('.surukle-hayalet') }), hedefler.hedefGun);
  k('kayıt taşındı', sonuc.tasindi === true, hedefler.hedefGun);
  k('bırakınca pencere açılmadı', sonuc.modal === false);
  k('hayalet temizlendi', sonuc.hayalet === false);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,4).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
