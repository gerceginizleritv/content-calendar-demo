const { chromium } = require('./araclar');
const stub = (satir, patlasin) => {
  window.__prefs = satir; window.__yazmalar = [];
  window.supabase = { createClient(){ return {
    auth:{ getSession: ()=> new Promise(r=> setTimeout(()=> r({data:{session:{user:{id:'u42',email:'t@o.com',user_metadata:{}}}}}), 200)),
           onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
           signOut: ()=>Promise.resolve({error:null}) },
    from(tablo){ const q = {
      select(){ if(tablo==='user_prefs' && patlasin) throw new Error('bulut yok'); return q; },
      eq(){ return q; }, is(){ return q; }, in(){ return q; },
      maybeSingle(){ return Promise.resolve({ data: tablo==='user_prefs' ? window.__prefs : null, error:null }); },
      upsert(rows){ if(tablo==='user_prefs'){ window.__yazmalar.push(JSON.parse(JSON.stringify(rows[0])));
                     window.__prefs = JSON.parse(JSON.stringify(rows[0])); }
                    return Promise.resolve({data:[],error:null}); },
      update(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
      delete(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
      then(r){ return Promise.resolve({data:[],error:null}).then(r); } }; return q; } };}};
};
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  const ac = async (opt)=>{
    const page = await b.newPage({ viewport:{width:1280,height:900} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(([yerelDil, yerelTs, bulut, patla, kaynak])=>{
      try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){}
      if(yerelDil){ try{ localStorage.setItem('demo_ui_language', yerelDil); }catch(e){} }
      if(yerelTs){ try{ localStorage.setItem('demo_ui_language_ts', String(yerelTs)); }catch(e){} }
      eval('('+kaynak+')')(bulut, patla);
    }, [opt.yerelDil||null, opt.yerelTs||0, opt.bulut||null, !!opt.patla, stub.toString()]);
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1800);
    return page;
  };
  const simdi = Date.now();
  console.log('DİLİN BULUT SENKRONU');

  // 1) YENI CIHAZ: yerelde tercih yok, bulutta Turkce
  let page = await ac({ bulut:{ user_id:'u42', prefs:{lang:'tr'}, updated_at:new Date(simdi).toISOString() } });
  let r = await page.evaluate(()=>({ dil: currentLang, secim: document.getElementById('langSelect').value,
    baslik: document.querySelector('[data-i18n="tab_projects"]').textContent.trim() }));
  k('YENİ CİHAZDA DİL BULUTTAN GELDİ', r.dil === 'tr', r.dil);
  k('açılır liste de güncellendi', r.secim === 'tr');
  k('ekran gerçekten Türkçe', /Projeler/.test(r.baslik), r.baslik);
  await page.close();

  // 2) YERELDEKI DAHA YENIYSE bulut ezmiyor, yukari gidiyor
  page = await ac({ yerelDil:'en', yerelTs: simdi,
                    bulut:{ user_id:'u42', prefs:{lang:'tr'}, updated_at:new Date(simdi-86400000).toISOString() } });
  await page.waitForTimeout(900);
  r = await page.evaluate(()=>({ dil: currentLang, yazma: window.__yazmalar, bulut: window.__prefs }));
  k('YEREL DAHA YENİYSE KORUNUYOR', r.dil === 'en', r.dil);
  k('yerel tercih buluta gönderildi', r.bulut && r.bulut.prefs.lang === 'en', JSON.stringify(r.bulut && r.bulut.prefs));
  await page.close();

  // 3) Kullanici dil degistirince buluta yaziliyor
  page = await ac({ yerelDil:'en', yerelTs: simdi - 1000,
                    bulut:{ user_id:'u42', prefs:{lang:'en'}, updated_at:new Date(simdi-1000).toISOString() } });
  await page.evaluate(()=>{ window.__yazmalar.length = 0; setLanguage('tr'); });
  await page.waitForTimeout(1100);
  r = await page.evaluate(()=>({ yazma: window.__yazmalar.length, son: window.__yazmalar[window.__yazmalar.length-1] }));
  k('DİL DEĞİŞİNCE BULUTA YAZILIYOR', r.yazma >= 1 && r.son.prefs.lang === 'tr', JSON.stringify((r.son||{}).prefs));
  // Tercihler artik yalnizca dil DEGIL: gelen kutusu defteri ve hatirlatma
  // ayarlari da mesru olarak burada. Onemli olan BEKLENMEYEN bir sey olmamasi
  // ve cihaza ait olanin sizmamasi.
  const izinli = ['lang','gelen_alinan','reminders'];
  const fazla = Object.keys((r.son||{}).prefs || {}).filter(x=> !izinli.includes(x));
  k('tercihlerde beklenmeyen alan yok', fazla.length === 0, fazla);
  k('hatırlatma ayarları buluta gidiyor',
    !!r.son.prefs.reminders && 'takvim' in r.son.prefs.reminders, r.son.prefs.reminders);
  k('TARAYICI anahtarı buluta GİTMİYOR',
    !('tarayici' in (r.son.prefs.reminders||{})), r.son.prefs.reminders);
  k('damga da gönderiliyor', !!(r.son && r.son.updated_at), (r.son||{}).updated_at);
  k('tek istek (her tuşta değil)', r.yazma === 1, r.yazma+' istek');
  await page.close();

  // 4) Buluttan gelen dil GERI gonderilmiyor (sonsuz dongu olmasin)
  page = await ac({ bulut:{ user_id:'u42', prefs:{lang:'tr'}, updated_at:new Date(simdi).toISOString() } });
  await page.waitForTimeout(1200);
  // Gelen kutusu acilista tercih yazabiliyor, o yuzden istek SAYMAK yaniltici.
  // Asil soz su: buluttan gelen dil, damgasi TAZELENEREK geri gonderilmemeli —
  // yoksa iki cihaz birbirini surekli gunceller. Onu olcuyoruz: yazma varsa,
  // gonderilen damga buluttan gelenle AYNI olmali.
  r = await page.evaluate(()=>({
    yazma: window.__yazmalar.length,
    dil: currentLang,
    damgalar: window.__yazmalar.map(x=> x && x.updated_at)
  }));
  const tazelenen = r.damgalar.filter(d=> d && d !== new Date(simdi).toISOString());
  k('BULUTTAN GELEN DİL DAMGASI TAZELENMİYOR', tazelenen.length === 0, r.damgalar);
  await page.close();

  // 5) Bulut okunamazsa yerel dil duruyor
  page = await ac({ yerelDil:'tr', yerelTs: simdi, patla:true });
  r = await page.evaluate(()=>({ dil: currentLang }));
  k('bulut patlasa da yerel dil duruyor', r.dil === 'tr', r.dil);
  await page.close();

  // 6) Tema ve gorunum BULUTA GITMIYOR (cihaza ait)
  page = await ac({ bulut:{ user_id:'u42', prefs:{lang:'en'}, updated_at:new Date(simdi).toISOString() } });
  await page.evaluate(()=>{ window.__yazmalar.length = 0; document.getElementById('themeBtn').click(); setView('week'); });
  await page.waitForTimeout(1100);
  r = await page.evaluate(()=>({ yazma: window.__yazmalar, alanlar: window.__prefs && Object.keys(window.__prefs.prefs) }));
  k('TEMA VE GÖRÜNÜM BULUTA GİTMİYOR', r.yazma.length === 0, r.yazma.length+' istek');
  // Buluttaki satirda da cihaza ait bir sey durmamali.
  const bulutFazla = (r.alanlar || []).filter(x=> !['lang','gelen_alinan','reminders'].includes(x));
  k('bulutta cihaza ait alan yok', bulutFazla.length === 0, r.alanlar);
  await page.close();

  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
