const { chromium } = require('./araclar');

// Telefonda hesaba girildi ama bulut okumasi basarisiz: ekranda DEMO
// kayitlari kalmamali, hicbir sey hesaba yazilmamali, sebebi yazmali.
const sahteSupabase = (mod)=>`
window.__pushlar = [];
window.__okumaModu = ${JSON.stringify(mod)};
window.supabase = { createClient(){ return {
  auth: {
    getSession: ()=> Promise.resolve({ data:{ session:{ user:{ id:'kul-1', email:'a@b.c' } } } }),
    onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; },
    signOut(){ return Promise.resolve({}); }
  },
  from(tablo){
    const zincir = {
      select(){ return zincir; },
      is(){ return zincir; },
      eq(){ return zincir; },
      in(){ return Promise.resolve({ data:[], error:null }); },
      upsert(satirlar){ window.__pushlar.push({tablo, satirlar}); return Promise.resolve({ data:null, error:null }); },
      delete(){ return zincir; },
      maybeSingle(){ return Promise.resolve({ data:null, error:null }); },
      single(){ return Promise.resolve({ data:null, error:null }); },
      then(coz, red){
        if(tablo === 'calendar_events' && window.__okumaModu === 'hata')
          return Promise.resolve({ data:null, error:{ message:'network' } }).then(coz, red);
        if(tablo === 'calendar_events' && window.__okumaModu === 'dolu')
          return Promise.resolve({ data:[{ id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            type:'video', platform:'youtube', title:'GERÇEK KAYIT', post_date:'2026-09-10',
            post_time:'20:00:00', uploaded:false, workspace_id:null, project_id:null,
            content:{ caption:'' } }], error:null }).then(coz, red);
        return Promise.resolve({ data:[], error:null }).then(coz, red);
      }
    };
    return zincir;
  }
};}};`;

(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };

  const ac = async (mod)=>{
    // Telefon boyu: kullanicinin gordugu yer burasi.
    const page = await b.newPage({ serviceWorkers:'block', viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
    // Gelen kutusu bu testin konusu degil: kutuyu yoldan cekiyoruz,
    // yoksa acilista eklenen kayitlar sayimlari kaydiriyor.
    await page.route('**/gelen/kayitlar.json', r=>r.fulfill({status:404,body:''}));
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript', body: sahteSupabase(mod)}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1800);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    await page.waitForTimeout(200);
    return page;
  };

  console.log('BULUT OKUNAMADIĞINDA (telefon)');
  let page = await ac('hata');
  const h = await page.evaluate(()=>({
    kayitSayisi: events.length,
    seritGorunur: getComputedStyle(document.getElementById('cloudError')).display !== 'none',
    seritMetni: document.getElementById('cloudError').textContent.replace(/\s+/g,' ').trim(),
    ekleKapali: document.getElementById('addBtn').disabled,
    ekleSebebi: document.getElementById('addBtn').title,
    yerel: localStorage.getItem('demo_cal_kul-1'),
    push: window.__pushlar.filter(x=>x.tablo==='calendar_events').length,
    pushTablolar: window.__pushlar.map(x=>x.tablo)
  }));
  k('DEMO kayıtları ekranda BIRAKILMIYOR', h.kayitSayisi === 0, h.kayitSayisi);
  k('hata şeridi görünüyor', h.seritGorunur);
  k('şerit sebebi söylüyor', /geri çevirdi|ulaşamadı|süresi dolmuş/.test(h.seritMetni) && /kaybolmadı/.test(h.seritMetni), h.seritMetni.slice(0,60));
  k('“Tekrar dene” var', /Tekrar dene/.test(h.seritMetni));
  k('yeni kayıt girişi kapalı', h.ekleKapali === true);
  k('kapalı olmasının sebebi yazıyor', /üzerine yazmasın/.test(h.ekleSebebi), h.ekleSebebi);
  k('hesabın yerel kopyasına YAZILMIYOR', h.yerel === null, h.yerel);
  k('takvim satırları buluta gönderilmiyor', h.push === 0, h.pushTablolar);

  // Bu haldeyken save() cagrilsa bile hesaba sizmiyor
  const sizinti = await page.evaluate(async ()=>{
    events = [{ id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', type:'video', platform:'youtube',
      title:'DEMO SIZINTISI', date:'2026-09-11', time:'10:00', uploaded:false, content:{} }];
    markDirty(events[0].id);
    save();
    await pushChanges();
    return { yerel: localStorage.getItem('demo_cal_kul-1'),
             push: window.__pushlar.filter(x=>x.tablo==='calendar_events').length };
  });
  k('zorlansa da yerele yazmıyor', sizinti.yerel === null, sizinti.yerel);
  k('zorlansa da buluta göndermiyor', sizinti.push === 0, sizinti.push);

  // "Tekrar dene" bu kez basarili
  await page.evaluate(()=>{ window.__okumaModu = 'dolu'; });
  await page.click('#cloudRetry');
  await page.waitForTimeout(900);
  const d = await page.evaluate(()=>({
    kayit: events.length, baslik: (events[0]||{}).title,
    serit: getComputedStyle(document.getElementById('cloudError')).display !== 'none',
    ekleKapali: document.getElementById('addBtn').disabled,
    yerel: !!localStorage.getItem('demo_cal_kul-1')
  }));
  k('tekrar denenince GERÇEK kayıtlar geliyor', d.kayit === 1 && d.baslik === 'GERÇEK KAYIT', d);
  k('şerit kayboluyor', d.serit === false);
  k('kayıt girişi tekrar açılıyor', d.ekleKapali === false);
  k('artık yerele yazılıyor', d.yerel === true);
  await page.close();

  console.log('\nBULUT OKUNDUĞUNDA (regresyon)');
  page = await ac('dolu');
  const n = await page.evaluate(()=>({
    kayit: events.length, baslik: (events[0]||{}).title,
    serit: getComputedStyle(document.getElementById('cloudError')).display !== 'none',
    ekleKapali: document.getElementById('addBtn').disabled
  }));
  k('kayıtlar geliyor', n.kayit === 1 && n.baslik === 'GERÇEK KAYIT', n);
  k('hata şeridi çıkmıyor', n.serit === false);
  k('kayıt girişi açık', n.ekleKapali === false);
  await page.close();

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
