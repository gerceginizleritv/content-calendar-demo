const { chromium } = require('./araclar');
const PORT = process.argv[2] || '8098';
(async () => {
  const b = await chromium.launch({ });
  let hata=0;
  const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };

  // Bulut okumasi PATLAYAN bir oturum: eski surumde sablonlar hic yuklenmiyordu.
  const acPatlak = async (patlasin)=>{
    const page = await b.newPage({ viewport:{width:1400,height:950} });
    await page.addInitScript(([p])=>{
      try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){}
      // Hesabin anahtarinda DOLU sablon duruyor
      try{ localStorage.setItem('demo_templates_u42', JSON.stringify({
        accounts:[{id:'ac_a',platform:'youtube',handle:'@gerceginizleritv'},
                  {id:'ac_b',platform:'instagram',handle:'@gerceginizleritv'}],
        general:'Her acıklamaya giden metin', overrides:{ youtube:'YouTube ozel' } })); }catch(e){}
      window.supabase = { createClient(){ return {
        auth:{ getSession: ()=> new Promise(r=> setTimeout(()=> r({data:{session:{user:{id:'u42',email:'t@o.com'}}}}), 250)),
               onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
               signOut: ()=>Promise.resolve({error:null}) },
        from(){ const q={ select(){ if(p) throw new Error('bulut okunamadi'); return q; },
          eq(){return q;}, is(){return q;}, in(){return q;},
          upsert(){return Promise.resolve({data:[],error:null});},
          update(){ const r=Promise.resolve({data:[],error:null}); r.in=()=>Promise.resolve({data:[],error:null}); return r; },
          delete(){ const r=Promise.resolve({data:[],error:null}); r.in=()=>Promise.resolve({data:[],error:null}); return r; },
          then(r){ return Promise.resolve({data:[],error:null}).then(r); } }; return q; }
      };}};
    }, [patlasin]);
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:'+PORT+'/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1900);
    return page;
  };

  console.log('SABLON KURTARMA');
  const p1 = await acPatlak(true);
  const r1 = await p1.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('templates');
    return { oturum: !!session, hesap: sablon.accounts.length,
             genel: (sablon.general||'').slice(0,40),
             kutu: (document.getElementById('tplGeneral')||{}).value || '',
             ekranda: document.querySelectorAll('#accList .acc-chip, #accList li, #accList .chip').length };
  });
  k('oturum açık', r1.oturum === true);
  k('BULUT PATLASA DA ŞABLONLAR DURUYOR', r1.hesap === 2, r1.hesap + ' hesap');
  k('genel metin duruyor', /Her acıklamaya giden metin/.test(r1.genel), JSON.stringify(r1.genel));
  k('ekrandaki kutuda da görünüyor', /Her acıklamaya giden metin/.test(r1.kutu));
  await p1.close();

  // Bos hal dolu kaydin uzerine yazmasin + yedekten kurtarma
  const p2 = await acPatlak(false);
  const r2 = await p2.evaluate(async ()=>{
    setPage('templates');
    // Bos hali zorla kaydet (hatali bir an taklidi)
    sablon = { accounts:[], general:'', overrides:{} };
    saveSablon();
    const yedekVar = !!localStorage.getItem('demo_templates_u42_yedek');
    // Sayfa yeniden yuklenmis gibi kurtarmayi calistir
    loadSablon();
    return { yedekVar, hesap: sablon.accounts.length, genel: (sablon.general||'').slice(0,40) };
  });
  k('boş kayıt öncesi yedek alındı', r2.yedekVar === true);
  k('YENİLEYİNCE YEDEKTEN GERİ GELDİ', r2.hesap === 2 && /Her acıklamaya/.test(r2.genel), r2.hesap + ' hesap');

  // BASKA bir hesap bu sablonlari ASLA gormemeli (ortak bilgisayar)
  const r3 = await p2.evaluate(()=>{
    session = { user:{ id:'bambaska' } };
    sablonAfterSignIn();
    return { hesap: sablon.accounts.length, ekran: (document.getElementById('tplGeneral')||{}).value||'' };
  });
  k('BAŞKA HESAP BUNLARI GÖRMÜYOR', r3.hesap === 0 && !/Her acıklamaya/.test(r3.ekran), r3.hesap + ' hesap');

  // Cikista da onceki hesabin verisi ekranda kalmamali
  const r4 = await p2.evaluate(()=>{
    session = null; sablonAfterSignOut();
    return { hesap: sablon.accounts.length, ekran: (document.getElementById('tplGeneral')||{}).value||'' };
  });
  k('çıkınca hesabın şablonları ekrandan kalkıyor', r4.hesap === 0 && !/Her acıklamaya/.test(r4.ekran), r4.hesap);

  // ...ama tekrar giris yapinca geri geliyor
  const r5 = await p2.evaluate(()=>{
    session = { user:{ id:'u42' } }; sablonAfterSignIn();
    return { hesap: sablon.accounts.length };
  });
  k('SAHİBİ GİRİNCE GERİ GELİYOR', r5.hesap === 2, r5.hesap + ' hesap');
  await p2.close();

  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
