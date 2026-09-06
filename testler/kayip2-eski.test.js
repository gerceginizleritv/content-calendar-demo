const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1400,height:950} });
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  // Giris yapilmis bir oturum taklidi
  await page.addInitScript(()=>{
    try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){}
    window.__oturum = { user:{ id:'u42', email:'t@o.com' } };
    window.supabase = { createClient(){ return {
      auth:{ getSession: ()=> new Promise(r=> setTimeout(()=> r({data:{session: window.__oturum}}), 250)),
             onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
             signOut: ()=>Promise.resolve({error:null}) },
      from(){ const q={ select(){return q;}, eq(){return q;}, is(){return q;}, in(){return q;},
        upsert(){return Promise.resolve({data:[],error:null});},
        update(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
        delete(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
        then(r){ return Promise.resolve({data:[],error:null}).then(r); } }; return q; }
    };}};
  });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8097/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1800);

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('GIRISLIYKEN SABLON KALICILIGI');

  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('templates'); });
  await page.waitForTimeout(200);
  k('oturum çözüldü', await page.evaluate(()=> !!session));

  const gir = await page.evaluate(async ()=>{
    const ekle = (pf,h)=>{ document.getElementById('acc_platform').value=pf;
      document.getElementById('acc_url').value=h; document.getElementById('acc_add').click(); };
    ekle('youtube','@gerceginizleritv'); ekle('instagram','@gerceginizleritv');
    await new Promise(r=>setTimeout(r,150));
    const ta = document.getElementById('tplGeneral');
    ta.value = 'Text - for every caption' + ta.value;
    ta.dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,200));
    return { hesap: sablon.accounts.length, anahtarlar: Object.keys(localStorage).filter(x=>/templ/i.test(x)) };
  });
  k('iki hesap eklendi', gir.hesap === 2);
  k('hesabın anahtarına yazıldı', gir.anahtarlar.some(x=>/_u42$/.test(x)), gir.anahtarlar.join(', '));

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1800);
  const sonra = await page.evaluate(()=>({ hesap: sablon.accounts.length, genel: (sablon.general||'').slice(0,30),
    kutu: (document.getElementById('tplGeneral')||{}).value }));
  k('YENİLEYİNCE HESAPLAR DURUYOR', sonra.hesap === 2, sonra.hesap);
  k('yenileyince metin duruyor', /Text - for every caption/.test(sonra.genel), JSON.stringify(sonra.genel));
  k('kutuda da görünüyor', /Text - for every caption/.test(sonra.kutu||''));

  // Cikinca hesabin verisi ekranda kalmamali
  const cikis = await page.evaluate(async ()=>{
    session = null; window.__oturum = null;
    sablonAfterSignOut();
    return { hesap: sablon.accounts.length };
  });
  k('çıkınca hesabın şablonları ekrandan kalkıyor', cikis.hesap === 0, cikis.hesap);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,4).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
