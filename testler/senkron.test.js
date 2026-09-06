const { chromium } = require('./araclar');
(async () => {
  const D = process.argv[2];
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:900} });
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(()=>{
    try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){}
    // Supabase taklidi: hangi tabloya ne gonderildigini kaydediyor.
    window.__db = { projects: [], calendar_events: [] };
    window.__log = [];
    window.__session = null;
    window.supabase = { createClient(){ return {
      auth: {
        getSession: ()=> Promise.resolve({ data:{ session: window.__session } }),
        onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; },
        signOut: ()=> Promise.resolve({ error:null })
      },
      from(tablo){
        const q = {
          select(){ return q; }, eq(){ return q; },
          is(){ return q; },
          in(_c, ids){ q._ids = ids; return q; },
          upsert(rows){
            window.__log.push({tablo, islem:'upsert', adet:rows.length});
            rows.forEach(r=>{
              const i = window.__db[tablo].findIndex(x=>x.id===r.id);
              if(i>=0) window.__db[tablo][i] = Object.assign({}, window.__db[tablo][i], r);
              else window.__db[tablo].push(Object.assign({created_at:new Date().toISOString()}, r));
            });
            return Promise.resolve({data:rows, error:null});
          },
          update(alan){
            const p = Promise.resolve({data:[], error:null});
            p.in = (_c, ids)=>{ window.__log.push({tablo, islem:'sil', adet:ids.length});
              ids.forEach(id=>{ const r = window.__db[tablo].find(x=>x.id===id); if(r) Object.assign(r, alan); });
              return Promise.resolve({data:[], error:null}); };
            return p;
          },
          delete(){ const p=Promise.resolve({data:[],error:null});
            p.in=()=>Promise.resolve({data:[],error:null}); return p; },
          then(res){ return Promise.resolve({
            data: window.__db[tablo].filter(r=>!r.deleted_at), error:null }).then(res); }
        };
        return q;
      }
    };}};
  });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('PROJE BULUT SENKRONU');

  // Cikisken: yalnizca tarayici
  const anon = await page.evaluate(async ()=>{
    projeEkle('Anonim Proje','', '2026-09-05','studio','');
    renderProjects();
    await new Promise(r=>setTimeout(r,600));
    return { yerel: JSON.parse(localStorage.getItem('demo_projects')||'[]').length,
             buluta: window.__log.filter(x=>x.tablo==='projects').length };
  });
  k('çıkışken tarayıcıya yazılıyor', anon.yerel === 1, anon.yerel);
  k('çıkışken buluta gönderilmiyor', anon.buluta === 0, anon.buluta);

  // Giris: yerel proje buluta tasiniyor
  const giris = await page.evaluate(async ()=>{
    window.__session = { user:{ id:'u1', email:'t@o.com' } };
    session = window.__session;
    await projAfterSignIn();
    await new Promise(r=>setTimeout(r,400));
    return { bulutta: window.__db.projects.length, ad: (window.__db.projects[0]||{}).name,
             tur: (window.__db.projects[0]||{}).type,
             adimlar: (window.__db.projects[0]||{}).steps,
             baslangic: (window.__db.projects[0]||{}).start_date };
  });
  k('giriş yapınca yerel proje buluta taşındı', giris.bulutta === 1, giris.ad);
  k('tür ve başlangıç tarihi taşındı', giris.tur === 'studio' && giris.baslangic === '2026-09-05', giris.tur+' / '+giris.baslangic);
  k('adımlar taşındı', giris.adimlar && giris.adimlar.script === false && 'package' in giris.adimlar, JSON.stringify(giris.adimlar));

  // Degisiklik buluta gidiyor
  const degis = await page.evaluate(async ()=>{
    window.__log.length = 0;
    const p = projects[0];
    p.script = true; p.deadlines.script = '2026-09-01';
    projDirtyIsaretle(p.id); saveProjects();
    await new Promise(r=>setTimeout(r,700));
    const r = window.__db.projects[0];
    return { yazma: window.__log.filter(x=>x.islem==='upsert').length,
             script: r.steps.script, dl: r.deadlines.script };
  });
  k('değişiklik buluta yazıldı', degis.yazma === 1 && degis.script === true && degis.dl === '2026-09-01',
     JSON.stringify(degis));

  // Silme: mezar tasi
  const sil = await page.evaluate(async ()=>{
    const c = window.onayla; window.onayla = ()=>true;
    window.__log.length = 0;
    projeSil(projects[0]);
    await new Promise(r=>setTimeout(r,700));
    window.onayla = c;
    return { yerel: projects.length, silindi: !!window.__db.projects[0].deleted_at,
             satirDuruyor: window.__db.projects.length === 1 };
  });
  k('silinen proje listeden düştü', sil.yerel === 0);
  k('bulutta satır duruyor, mezar taşı konuldu', sil.silindi === true && sil.satirDuruyor === true);

  // Kayitlarda proje kimligi ayri sutuna da yaziliyor
  const kayit = await page.evaluate(async ()=>{
    const p = projeEkle('Yeni Proje','', '', 'vlog','');
    const e = events[0];
    e.content.projectId = p.id;
    markDirty(e.id); save();
    await new Promise(r=>setTimeout(r,700));
    const r = window.__db.calendar_events.find(x=>x.id===e.id);
    return { sutun: r && r.project_id, icerik: r && r.content && r.content.projectId, ayni: r && r.project_id === r.content.projectId };
  });
  k('kayıtta project_id sütunu dolduruldu', !!kayit.sutun && kayit.ayni === true, kayit.sutun);

  // Baska cihaz: bulutta veri varsa esas o
  const cihaz2 = await page.evaluate(async ()=>{
    projects = []; localStorage.removeItem('demo_projects_u1'); localStorage.removeItem('demo_projects');
    await projAfterSignIn();
    return { adet: projects.length, adlar: projects.map(p=>p.name) };
  });
  k('başka cihazda projeler buluttan geliyor', cihaz2.adet === 1 && cihaz2.adlar[0] === 'Yeni Proje', cihaz2.adlar.join(', '));

  // Cikista onceki hesabin verisi ekranda kalmamali
  const cikis = await page.evaluate(async ()=>{
    session = null; window.__session = null;
    projAfterSignOut();
    return { adet: projects.length };
  });
  k('çıkışta hesabın projeleri ekrandan kalkıyor', cikis.adet === 0, cikis.adet);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
