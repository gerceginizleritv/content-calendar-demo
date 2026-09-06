const { chromium } = require('./araclar');
const stub = (prefs, kayitlar) => {
  window.__prefs = prefs; window.__satirlar = kayitlar; window.__yazmalar = [];
  window.supabase = { createClient(){ return {
    auth:{ getSession: ()=> new Promise(r=> setTimeout(()=> r({data:{session:{user:{id:'u42',email:'t@o.com',user_metadata:{}}}}}), 200)),
           onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
           signOut: ()=>Promise.resolve({error:null}) },
    from(tablo){ const q = { _filtre:{},
      select(){ return q; },
      eq(){ return q; },
      is(kolon, deger){ q._filtre[kolon] = deger; 
        if(tablo === 'calendar_events'){
          // Gercek davranisi taklit: deleted_at is null suzuyor
          const veri = window.__satirlar.filter(r=> !r.deleted_at);
          return Promise.resolve({ data: veri, error: null });
        }
        return q; },
      in(){ return q; },
      maybeSingle(){ return Promise.resolve({ data: tablo==='user_prefs' ? window.__prefs : null, error:null }); },
      upsert(rows){ window.__yazmalar.push({tablo, rows: JSON.parse(JSON.stringify(rows))});
                    return Promise.resolve({data:[],error:null}); },
      update(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
      delete(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
      then(r){ return Promise.resolve({data:[],error:null}).then(r); } }; return q; } };}};
};
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  const WS = '11111111-2222-3333-4444-555555555555';
  const satirlar = [
    { id:'cal_lok_1', type:'video', platform:'youtube', title:'Lokasyondan gelen', post_date:'2026-09-10',
      post_time:'20:00', uploaded:false, content:{}, workspace_id: WS, deleted_at:null },
    { id:'cal_lok_2', type:'reels', platform:'instagram', title:'Silinmiş kayıt', post_date:'2026-09-11',
      post_time:'19:00', uploaded:false, content:{}, workspace_id: WS, deleted_at:'2026-08-01T00:00:00Z' },
    { id:'cal_slate_1', type:'shorts', platform:'tiktok', title:'Slate kaydı', post_date:'2026-09-12',
      post_time:'18:00', uploaded:false, content:{}, workspace_id: null, deleted_at:null }
  ];
  const ac = async (prefs)=>{
    const page = await b.newPage({ viewport:{width:1280,height:900} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(([pr, sat, kaynak])=>{
      try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){}
      eval('('+kaynak+')')(pr, sat);
    }, [prefs, satirlar, stub.toString()]);
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1900);
    return page;
  };
  console.log('VERİ TAŞIMA — SLATE LOKASYON KAYITLARINI GÖRÜYOR');

  let page = await ac({ user_id:'u42', prefs:{}, entry_limit:100000, project_limit:100000,
                        updated_at:new Date().toISOString() });
  let r = await page.evaluate(()=>({
    adet: events.length,
    basliklar: events.map(e=>e.title),
    ws: events.map(e=>({ b:e.title, w:e.workspaceId })),
    kayitSiniri: MAX_ENTRIES, projeSiniri: MAX_PROJECTS
  }));
  k('LOKASYON KAYDI SLATE\'TE GÖRÜNÜYOR', r.basliklar.includes('Lokasyondan gelen'), r.basliklar.join(' | '));
  k('SLATE KAYDI DA DURUYOR', r.basliklar.includes('Slate kaydı'));
  k('SİLİNMİŞ KAYIT GELMİYOR', !r.basliklar.includes('Silinmiş kayıt'), r.adet+' kayıt');
  k('ÇALIŞMA ALANI KİMLİĞİ KORUNDU',
     r.ws.find(x=>x.b==='Lokasyondan gelen').w === '11111111-2222-3333-4444-555555555555',
     JSON.stringify(r.ws));
  k('slate kaydının alanı boş kaldı', r.ws.find(x=>x.b==='Slate kaydı').w === null);
  k('SINIR HESAPTAN GELDİ', r.kayitSiniri === 100000 && r.projeSiniri === 100000,
     r.kayitSiniri+' / '+r.projeSiniri);

  // Kayit geri yazilirken calisma alani da gidiyor mu
  const yazma = await page.evaluate(async ()=>{
    window.__yazmalar.length = 0;
    const ev = events.find(e=>e.title==='Lokasyondan gelen');
    ev.title = 'Lokasyondan gelen (düzenlendi)';
    markDirty(ev.id); await pushChanges();
    const y = window.__yazmalar.filter(w=>w.tablo==='calendar_events');
    const satir = y.length ? y[0].rows.find(x=>x.id==='cal_lok_1') : null;
    return { yazildi: !!satir, ws: satir && satir.workspace_id, baslik: satir && satir.title };
  });
  k('DÜZENLENEN KAYIT GERİ YAZILDI', yazma.yazildi === true);
  k('GERİ YAZARKEN ÇALIŞMA ALANI KAYBOLMADI', yazma.ws === '11111111-2222-3333-4444-555555555555', String(yazma.ws));
  await page.close();

  // Sinir yoksa varsayilan
  page = await ac({ user_id:'u42', prefs:{}, updated_at:new Date().toISOString() });
  r = await page.evaluate(()=>({ k: MAX_ENTRIES, p: MAX_PROJECTS }));
  k('sınır tanımsızsa varsayılan 100', r.k === 100 && r.p === 100, r.k+' / '+r.p);
  await page.close();

  // Bozuk deger varsayilana dusmeli
  page = await ac({ user_id:'u42', prefs:{}, entry_limit:'sinirsiz', project_limit:-5,
                    updated_at:new Date().toISOString() });
  r = await page.evaluate(()=>({ k: MAX_ENTRIES, p: MAX_PROJECTS }));
  k('BOZUK SINIR DEĞERİ VARSAYILANA DÜŞÜYOR', r.k === 100 && r.p === 100, r.k+' / '+r.p);
  await page.close();

  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
