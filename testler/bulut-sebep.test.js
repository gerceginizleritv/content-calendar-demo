const { chromium } = require('./araclar');

// Sahte Supabase. __okumaModu: 'ag' | 'oturum' | 'sunucu' | 'dolu'
// __tazeSonrasi: tazeleme basarili olduktan SONRA gecilecek mod.
const sahte = (mod, tazeSonrasi, tazeCalisiyor)=>`
window.__pushlar = []; window.__tazeSayisi = 0;
window.__okumaModu = ${JSON.stringify(mod)};
window.__tazeSonrasi = ${JSON.stringify(tazeSonrasi)};
window.__tazeCalisiyor = ${JSON.stringify(!!tazeCalisiyor)};
window.supabase = { createClient(){ return {
  auth: {
    getSession: ()=> Promise.resolve({ data:{ session:{ user:{ id:'kul-1', email:'a@b.c' } } } }),
    onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; },
    signOut(){ return Promise.resolve({}); },
    refreshSession(){
      window.__tazeSayisi++;
      if(!window.__tazeCalisiyor) return Promise.resolve({ data:null, error:{ message:'refresh failed' } });
      window.__okumaModu = window.__tazeSonrasi;
      return Promise.resolve({ data:{ session:{ user:{ id:'kul-1', email:'a@b.c' } } }, error:null });
    }
  },
  from(tablo){
    const z = {
      select(){ return z; }, is(){ return z; }, eq(){ return z; },
      in(){ return Promise.resolve({ data:[], error:null }); },
      upsert(satirlar){ window.__pushlar.push({tablo, satirlar}); return Promise.resolve({ data:null, error:null }); },
      delete(){ return z; },
      maybeSingle(){ return Promise.resolve({ data:null, error:null }); },
      single(){ return Promise.resolve({ data:null, error:null }); },
      then(coz, red){
        const m = window.__okumaModu;
        if(tablo === 'calendar_events'){
          if(m === 'ag')     return Promise.reject(new TypeError('Failed to fetch')).then(coz, red);
          if(m === 'oturum') return Promise.resolve({ data:null, error:{ message:'JWT expired', code:'PGRST301' } }).then(coz, red);
          if(m === 'sunucu') return Promise.resolve({ data:null, error:{ message:'permission denied for table calendar_events', code:'42501' } }).then(coz, red);
          if(m === 'dolu')   return Promise.resolve({ data:[{ id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            type:'video', platform:'youtube', title:'GERÇEK KAYIT', post_date:'2026-09-10',
            post_time:'20:00:00', uploaded:false, workspace_id:null, project_id:null, content:{} }], error:null }).then(coz, red);
        }
        return Promise.resolve({ data:[], error:null }).then(coz, red);
      }
    };
    return z;
  }
};}};`;

(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  const ac = async (mod, tazeSonrasi, tazeCalisiyor)=>{
    const page = await b.newPage({ serviceWorkers:'block', viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
    // Gelen kutusu bu testin konusu degil: kutuyu yoldan cekiyoruz,
    // yoksa acilista eklenen kayitlar sayimlari kaydiriyor.
    await page.route('**/gelen/kayitlar.json', r=>r.fulfill({status:404,body:''}));
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body: sahte(mod, tazeSonrasi, tazeCalisiyor)}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1800);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    await page.waitForTimeout(250);
    return page;
  };
  const oku = page => page.evaluate(()=>({
    neden: document.getElementById('cloudErrWhy').textContent.trim(),
    ayrinti: document.getElementById('cloudErrDetail').textContent.trim(),
    ayrintiGorunur: getComputedStyle(document.getElementById('cloudErrDetail')).display !== 'none',
    seritGorunur: getComputedStyle(document.getElementById('cloudError')).display !== 'none',
    taze: window.__tazeSayisi, kayit: events.length
  }));

  console.log('AĞA ULAŞILAMIYOR (engelleyici / bağlantı yok)');
  let page = await ac('ag');
  let r = await oku(page);
  k('şerit görünüyor', r.seritGorunur);
  k('sebep AĞ olarak yazıyor', r.neden === 'Bu cihaz buluta ulaşamadı.', r.neden);
  k('engelleyici ihtimali anlatılıyor', /engelleyici/.test(r.ayrinti) && /supabase\.co/.test(r.ayrinti), r.ayrinti.slice(0,80));
  k('sunucunun kendi cümlesi de yazıyor', /Failed to fetch/.test(r.ayrinti), r.ayrinti.slice(-40));
  k('ağ hatasında oturum tazelenmiyor', r.taze === 0, r.taze);
  // Dil degisince sebep de cevriliyor
  await page.evaluate(()=>setLanguage('en'));
  await page.waitForTimeout(200);
  const ing = await page.evaluate(()=>document.getElementById('cloudErrWhy').textContent.trim());
  k('dil değişince sebep de çevriliyor', ing === 'This device could not reach the cloud.', ing);
  await page.close();

  console.log('\nOTURUM SÜRESİ DOLMUŞ — kendiliğinden tazeleniyor');
  page = await ac('oturum', 'dolu', true);
  r = await oku(page);
  k('tazeleme denendi', r.taze === 1, r.taze);
  k('tazelendikten sonra kayıtlar GELDİ', r.kayit === 1, r.kayit);
  k('şerit çıkmadı', r.seritGorunur === false);
  await page.close();

  console.log('\nOTURUM DOLMUŞ — tazeleme de olmuyor');
  page = await ac('oturum', 'dolu', false);
  r = await oku(page);
  k('tazeleme bir kez denendi, tekrarlamıyor', r.taze === 1, r.taze);
  k('sebep OTURUM olarak yazıyor', r.neden === 'Oturunun süresi dolmuştu.' || r.neden === 'Oturumunun süresi dolmuştu.', r.neden);
  k('ne yapılacağı yazıyor', /çıkıp yeniden gir/.test(r.ayrinti), r.ayrinti.slice(0,80));
  k('sunucunun cümlesi yazıyor', /JWT expired/.test(r.ayrinti), r.ayrinti.slice(-30));
  k('kayıtlar boş, demo kalmadı', r.kayit === 0);
  await page.close();

  console.log('\nSUNUCU GERİ ÇEVİRDİ (izin / RLS)');
  page = await ac('sunucu');
  r = await oku(page);
  k('sebep SUNUCU olarak yazıyor', r.neden === 'Sunucu isteği geri çevirdi.', r.neden);
  k('sunucunun kendi cümlesi görünüyor', /permission denied/.test(r.ayrinti), r.ayrinti);
  k('izin hatasında tazeleme denenmiyor', r.taze === 0, r.taze);

  // "Tekrar dene": once tazeleyip yeniden okuyor
  await page.evaluate(()=>{ window.__tazeCalisiyor = true; window.__tazeSonrasi = 'dolu'; window.__okumaModu = 'dolu'; });
  await page.click('#cloudRetry');
  await page.waitForTimeout(900);
  const son = await oku(page);
  k('“Tekrar dene” oturumu tazeliyor', son.taze >= 1, son.taze);
  k('“Tekrar dene” kayıtları getiriyor', son.kayit === 1, son.kayit);
  k('şerit kayboluyor', son.seritGorunur === false);
  await page.close();

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
