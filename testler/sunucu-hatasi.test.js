// Yükleme reddedilince SUNUCUNUN cümlesi gösterilmeli; "biraz sonra dene"
// yalnızca hiçbir bilgi yokken kalmalı.
const { chromium } = require('./araclar');
const fs = require('fs');
let k=0; const ok=(a,c,e)=>{ if(c) console.log('  ok  ',a); else { k++; console.log('  YOK ',a, e===undefined?'':'→ '+e); } };

function sb(hataMesaji){
  return `window.supabase={createClient(){return {
    auth:{ getSession:()=>Promise.resolve({data:{session: window.__oturum||null}}),
           onAuthStateChange(f){ return {data:{subscription:{unsubscribe(){}}}}; } },
    from(){ return { select(){return {eq(){return {maybeSingle:()=>Promise.resolve({data:null,error:null})}}}},
                     upsert(){ return Promise.resolve({error:null}); } }; },
    storage:{ from(){ return {
      upload(){ return Promise.resolve({ error: ${hataMesaji===null?'null':'{message:'+JSON.stringify(hataMesaji)+'}'} }); },
      remove(){ return Promise.resolve({error:null}); }
    }; } }
  };}};`;
}

async function dene(b, hata){
  const p = await b.newPage({ viewport:{width:1400,height:1000} });
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_pitch','kapali'); localStorage.setItem('demo_ui_language','tr'); }catch(e){} });
  await p.addInitScript(`window.__oturum=${JSON.stringify({user:{id:'11111111-1111-1111-1111-111111111111',email:'a@b.c'}})};`);
  await p.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:sb(hata)}));
  await p.route('**/goatcounter**', r=>r.abort());
  await p.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  await p.evaluate(()=>document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')));
  await p.click('#remindersBtn'); await p.waitForTimeout(250);
  await p.check('#rm_takvim'); await p.waitForTimeout(300);
  await p.click('#rm_kurBtn'); await p.waitForTimeout(700);
  const metin = await p.textContent('#rm_takvimDurum');
  await p.close();
  return metin;
}

(async()=>{
  const b = await chromium.launch({ });

  console.log('SUNUCU HATASI GÖSTERİLİYOR MU');

  const t1 = await dene(b, 'new row violates row-level security policy');
  ok('RLS hatası aynen gösteriliyor', /row-level security/.test(t1), t1);
  ok('"biraz sonra dene" DEĞİL', !/biraz sonra/i.test(t1), t1);

  const t2 = await dene(b, 'mime type text/calendar; charset=utf-8 is not supported');
  ok('mime hatası aynen gösteriliyor', /mime type/.test(t2), t2);

  const t3 = await dene(b, 'Bucket not found');
  ok('kova yoksa hâlâ sql/19 diyor', /sql\/19/.test(t3), t3);

  // Yukleme BASARISIZ olduysa adres GOSTERILMEMELI: yazilmamis bir dosyanin
  // adresini kullanici takvimine ekleyip olu abonelik kurabiliyordu.
  {
    const p2 = await b.newPage({ viewport:{width:1400,height:1000} });
    await p2.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
      localStorage.setItem('demo_pitch','kapali'); localStorage.setItem('demo_ui_language','tr'); }catch(e){} });
    await p2.addInitScript(`window.__oturum=${JSON.stringify({user:{id:'11111111-1111-1111-1111-111111111111',email:'a@b.c'}})};`);
    await p2.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:sb('new row violates row-level security policy')}));
    await p2.route('**/goatcounter**', r=>r.abort());
    await p2.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await p2.waitForTimeout(1600);
    await p2.evaluate(()=>document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')));
    await p2.click('#remindersBtn'); await p2.waitForTimeout(250);
    await p2.check('#rm_takvim'); await p2.waitForTimeout(300);
    ok('yükleme öncesi adres YOK', !(await p2.isVisible('#rm_adresSatir')));
    await p2.click('#rm_kurBtn'); await p2.waitForTimeout(700);
    ok('yükleme BAŞARISIZKEN adres gösterilmiyor', !(await p2.isVisible('#rm_adresSatir')));
    await p2.close();
  }

  const t4 = await dene(b, '');
  ok('bilgi yoksa genel mesaj kalıyor', /biraz sonra/i.test(t4), t4);

  await b.close();
  console.log(k ? '\n'+k+' SORUN' : '\nHEPSİ GEÇTİ');
  process.exit(k?1:0);
})();
