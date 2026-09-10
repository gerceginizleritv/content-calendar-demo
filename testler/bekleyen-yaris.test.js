// Giris yapilmisken sayfa yenilendiginde "Henüz Yüklenmemiş" penceresi
// DEMO kayitlarini gosteriyordu: pencere, bulut verisi gelmeden aciliyordu.
const { chromium } = require('./araclar');
const HEDEF = process.argv[2] || 'http://127.0.0.1:8098/app.html';
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });

  // Sahte Supabase: OTURUM VAR, bulut cevabi 400 ms GECIKMELI gelir.
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript', body:`
    const OTURUM = { user: { id:'u1', email:'ben@ornek.com' } };
    const BULUT = [{
      id:'bulut1', user_id:'u1', type:'video', platform:'youtube',
      title:'BENIM GERCEK KAYDIM', post_date:'2026-09-04', post_time:'10:00',
      uploaded:false, content:{}, deleted_at:null,
      created_at:new Date().toISOString(), updated_at:new Date().toISOString()
    }];
    function gec(deger){ return new Promise(r=> setTimeout(()=> r(deger), 1500)); }
    function tablo(ad){
      const api = {
        _f: [],
        select(){ return api; }, eq(){ return api; }, is(){ return api; }, in(){ return api; },
        update(){ return { in:()=>Promise.resolve({error:null}), eq:()=>Promise.resolve({error:null}) }; },
        upsert(){ return Promise.resolve({ error:null }); },
        maybeSingle(){ return gec({ data:null, error:null }); },
        then(res){ return gec({ data: ad==='calendar_events' ? BULUT : [], error:null }).then(res); }
      };
      return api;
    }
    window.supabase = { createClient(){ return {
      auth: {
        getSession: ()=> Promise.resolve({ data:{ session: OTURUM } }),
        onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; },
        signOut(){ return Promise.resolve({}); }
      },
      from: tablo
    }; } };
  `}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto(HEDEF,{waitUntil:'domcontentloaded'});

  // Pencere acilincaya kadar bekle (ya da 6 sn)
  await page.waitForSelector('#pendingOverlay.open', { timeout: 6000 }).catch(()=>{});
  const r = await page.evaluate(()=>{
    const acik = document.getElementById('pendingOverlay').classList.contains('open');
    const basliklar = [...document.querySelectorAll('#pendingBody tbody tr')]
      .map(tr=> tr.lastElementChild.textContent.trim());
    return { acik, basliklar, ekrandakiKayit: (window.events||[]).map(e=>e.title) };
  });

  k('Pencere açıldı', r.acik, r.acik);
  k('GERÇEK kayıt görünüyor', r.basliklar.includes('BENIM GERCEK KAYDIM'), r.basliklar);
  k('DEMO kayıtları GÖRÜNMÜYOR',
    !r.basliklar.some(x=> /Product Launch|Feature Teaser|Which feature next/i.test(x)), r.basliklar);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
