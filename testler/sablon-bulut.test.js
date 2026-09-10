const { chromium } = require('./araclar');
const PORT = process.argv[2] || '8098';

// Sunucu taklidi: caption_templates icin gercek bir satir tutuyor.
const stub = (bulutSatir, patlasin) => {
  window.__bulut = bulutSatir;      // null ya da satir nesnesi
  window.__yazilan = [];
  window.supabase = { createClient(){ return {
    auth:{ getSession: ()=> new Promise(r=> setTimeout(()=> r({data:{session:{user:{id:'u42',email:'t@o.com'}}}}), 200)),
           onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
           signOut: ()=>Promise.resolve({error:null}) },
    from(tablo){
      const q = {
        select(){ if(tablo==='caption_templates' && patlasin) throw new Error('bulut okunamadi'); return q; },
        eq(){ return q; }, is(){ return q; }, in(){ return q; },
        maybeSingle(){ return Promise.resolve({ data: window.__bulut, error:null }); },
        upsert(rows){
          if(tablo==='caption_templates'){
            window.__yazilan.push(JSON.parse(JSON.stringify(rows[0])));
            window.__bulut = JSON.parse(JSON.stringify(rows[0]));
          }
          return Promise.resolve({data:[],error:null});
        },
        update(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
        delete(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
        then(r){ return Promise.resolve({data:[],error:null}).then(r); }
      };
      return q;
    }
  };}};
};

(async () => {
  const b = await chromium.launch({ });
  let hata=0;
  const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };

  const ac = async (opt)=>{
    const page = await b.newPage({ viewport:{width:1300,height:950} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(([yerel, bulut, patla, stubKaynak])=>{
      try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){}
      if(yerel){ try{ localStorage.setItem('demo_templates_u42', JSON.stringify(yerel)); }catch(e){} }
      eval('(' + stubKaynak + ')')(bulut, patla);
    }, [opt.yerel||null, opt.bulut||null, !!opt.patla, stub.toString()]);
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:'+PORT+'/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1900);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('templates'); });
    await page.waitForTimeout(250);
    return page;
  };

  const bulutSatiri = (ts)=>({ user_id:'u42',
    accounts:[{id:'ac_a',platform:'youtube',handle:'@gerceginizleritv'},
              {id:'ac_b',platform:'instagram',handle:'@gerceginizleritv'}],
    general:'Buluttan gelen metin', overrides:{ youtube:'YouTube ozel' },
    updated_at: new Date(ts).toISOString() });

  console.log('ŞABLONLARIN BULUT SENKRONU');

  // 1) YENI CIHAZ: yerel bos, bulut dolu
  const p1 = await ac({ bulut: bulutSatiri(Date.now()) });
  const r1 = await p1.evaluate(()=>({ hesap: sablon.accounts.length,
    genel: sablon.general, kutu: document.getElementById('tplGeneral').value,
    ozel: Object.keys(sablon.overrides).length }));
  k('YENİ CİHAZDA ŞABLONLAR BULUTTAN GELDİ', r1.hesap === 2, r1.hesap + ' hesap');
  k('genel metin geldi', r1.genel === 'Buluttan gelen metin', JSON.stringify(r1.genel));
  k('ekrandaki kutuya da yazıldı', /Buluttan gelen metin/.test(r1.kutu));
  k('platform istisnası geldi', r1.ozel === 1, r1.ozel);
  await p1.close();

  // 2) DUZENLEME BULUTA GIDIYOR
  const p2 = await ac({ bulut: bulutSatiri(Date.now()) });
  await p2.evaluate(()=>{ const ta=document.getElementById('tplGeneral');
    ta.value='Bu cihazda yazıldı'; ta.dispatchEvent(new Event('input')); });
  await p2.waitForTimeout(1400);
  const r2 = await p2.evaluate(()=>({ yazilan: window.__yazilan.length,
    son: window.__yazilan[window.__yazilan.length-1] }));
  k('DEĞİŞİKLİK BULUTA YAZILDI', r2.yazilan >= 1 && r2.son.general === 'Bu cihazda yazıldı',
     JSON.stringify((r2.son||{}).general));
  k('damga da gönderildi', !!(r2.son && r2.son.updated_at), (r2.son||{}).updated_at);
  k('tek istek gitti (her harfte değil)', r2.yazilan === 1, r2.yazilan + ' istek');
  await p2.close();

  // 3) YERELDEKI DAHA YENIYSE O KAZANIR
  const p3 = await ac({
    yerel: { accounts:[{id:'ac_z',platform:'tiktok',handle:'@yeni'}], general:'Yerel daha yeni',
             overrides:{}, updatedAt: Date.now() },
    bulut: bulutSatiri(Date.now() - 86400000) });   // bulut bir gun eski
  const r3 = await p3.evaluate(()=>({ genel: sablon.general, hesap: sablon.accounts.length,
    bulutGenel: (window.__bulut||{}).general }));
  k('YEREL DAHA YENİYSE EZİLMİYOR', r3.genel === 'Yerel daha yeni', JSON.stringify(r3.genel));
  k('yerel hal buluta gönderildi', r3.bulutGenel === 'Yerel daha yeni', JSON.stringify(r3.bulutGenel));
  await p3.close();

  // 4) BULUT DAHA YENIYSE BULUT KAZANIR
  const p4 = await ac({
    yerel: { accounts:[{id:'ac_z',platform:'tiktok',handle:'@eski'}], general:'Yerel eski',
             overrides:{}, updatedAt: Date.now() - 86400000 },
    bulut: bulutSatiri(Date.now()) });
  const r4 = await p4.evaluate(()=>({ genel: sablon.general, kutu: document.getElementById('tplGeneral').value }));
  k('BULUT DAHA YENİYSE O GELİYOR', r4.genel === 'Buluttan gelen metin', JSON.stringify(r4.genel));
  k('ekran da tazelendi', /Buluttan gelen metin/.test(r4.kutu));
  await p4.close();

  // 5) BOS BULUT DOLU YERELI SILMIYOR
  const p5 = await ac({
    yerel: { accounts:[{id:'ac_z',platform:'tiktok',handle:'@duruyor'}], general:'Silinmemeli',
             overrides:{}, updatedAt: Date.now() - 86400000 },
    bulut: { user_id:'u42', accounts:[], general:'', overrides:{}, updated_at:new Date().toISOString() } });
  const r5 = await p5.evaluate(()=>({ genel: sablon.general, hesap: sablon.accounts.length,
    bulutGenel: (window.__bulut||{}).general }));
  k('BOŞ BULUT DOLU YERELİ SİLMİYOR', r5.genel === 'Silinmemeli' && r5.hesap === 1, JSON.stringify(r5.genel));
  k('yerel hal buluta gönderildi', r5.bulutGenel === 'Silinmemeli');
  await p5.close();

  // 6) BULUT OKUNAMAZSA YEREL DURUYOR (eski hatanin nobetcisi)
  const p6 = await ac({
    yerel: { accounts:[{id:'ac_z',platform:'tiktok',handle:'@duruyor'}], general:'Bulut patlasa da duruyor',
             overrides:{}, updatedAt: Date.now() }, patla:true });
  const r6 = await p6.evaluate(()=>({ genel: sablon.general, hesap: sablon.accounts.length,
    kutu: document.getElementById('tplGeneral').value }));
  k('BULUT PATLASA DA YEREL DURUYOR', r6.hesap === 1 && /Bulut patlasa da duruyor/.test(r6.kutu), r6.hesap);
  await p6.close();

  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
