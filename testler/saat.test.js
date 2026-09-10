// Hatırlatma saati: seçilebiliyor mu, .ics tetiği doğru mu, metinler yerinde mi.
const { chromium } = require('./araclar');
const fs = require('fs');
const SB = fs.readFileSync('hatirlatma.test.js','utf8').match(/const SB = `([\s\S]*?)`;/)[1];
let k=0; const ok=(a,c,e)=>{ if(c) console.log('  ok  ',a); else { k++; console.log('  YOK ',a, e===undefined?'':'→ '+e); } };

async function ac(b, yerel){
  const p = await b.newPage({ viewport:{width:1400,height:1000} });
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_pitch','kapali'); localStorage.setItem('demo_ui_language','tr'); }catch(e){} });
  await p.addInitScript(`window.__oturum=${JSON.stringify({user:{id:'11111111-1111-1111-1111-111111111111',email:'a@b.c'}})};`);
  if(yerel) await p.addInitScript(`try{localStorage.setItem('demo_reminders',${JSON.stringify(JSON.stringify(yerel))});}catch(e){}`);
  await p.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:SB}));
  await p.route('**/goatcounter**', r=>r.abort());
  await p.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  await p.evaluate(()=>document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')));
  return p;
}
const tetik = (p, saat, once) => p.evaluate(([s,o])=>{ hatirlatma.saat=s; return icsTetik(o); }, [saat, once]);

(async()=>{
  const b = await chromium.launch({ });

  console.log('\n1. Tetik hesabı');
  {
    const p = await ac(b);
    ok('09:00 termin günü  → PT9H',      await tetik(p,'09:00',false) === 'PT9H',      await tetik(p,'09:00',false));
    ok('09:00 bir gün önce → -PT15H',    await tetik(p,'09:00',true)  === '-PT15H',    await tetik(p,'09:00',true));
    ok('08:30 termin günü  → PT8H30M',   await tetik(p,'08:30',false) === 'PT8H30M',   await tetik(p,'08:30',false));
    ok('08:30 bir gün önce → -PT15H30M', await tetik(p,'08:30',true)  === '-PT15H30M', await tetik(p,'08:30',true));
    ok('00:00 termin günü  → PT0M',      await tetik(p,'00:00',false) === 'PT0M',      await tetik(p,'00:00',false));
    ok('23:00 bir gün önce → -PT1H',     await tetik(p,'23:00',true)  === '-PT1H',     await tetik(p,'23:00',true));
    await p.close();
  }

  console.log('\n2. Varsayılan ve saklama');
  {
    const p = await ac(b);
    await p.click('#remindersBtn'); await p.waitForTimeout(250);
    ok('varsayılan 09:00', (await p.inputValue('#rm_saat')) === '09:00');
    ok('takvim kapalıyken saat gizli', !(await p.isVisible('#rm_saatSatir')));
    await p.check('#rm_takvim'); await p.waitForTimeout(250);
    ok('takvim açılınca saat göründü', await p.isVisible('#rm_saatSatir'));
    await p.fill('#rm_saat','07:45');
    await p.dispatchEvent('#rm_saat','change'); await p.waitForTimeout(300);
    ok('saat kaydedildi', await p.evaluate(()=>JSON.parse(localStorage.getItem('demo_reminders')).saat === '07:45'));
    await p.close();
  }

  console.log('\n3. Bozuk saat varsayılana düşüyor');
  {
    const p = await ac(b, { takvim:true, saat:'25:99' });
    await p.click('#remindersBtn'); await p.waitForTimeout(250);
    ok('bozuk değer reddedildi', (await p.inputValue('#rm_saat')) === '09:00');
    await p.close();
  }

  console.log('\n4. Açıklama metinleri');
  {
    const p = await ac(b);
    await p.click('#remindersBtn'); await p.waitForTimeout(250);
    const kapsam = await p.textContent('.rm-kapsam');
    ok('kapsam cümlesi var', /proje adımlarının terminleri/i.test(kapsam), kapsam.slice(0,60));
    ok('paylaşımların girmediği yazıyor', /paylaşımlar eklenmez/i.test(kapsam));
    ok('kalın etiket düz metin değil', !/<b>/.test(kapsam));
    const not = await p.textContent('[data-i18n="rm_when_gecikti_note"]');
    ok('geciktiğinde notu var', /yalnızca tarayıcı bildiriminde/i.test(not), not.slice(0,50));
    await p.close();
  }

  console.log('\n5. .ics dosyasında seçilen saat kullanılıyor');
  {
    const p = await ac(b, { takvim:true, once:true, gun:true, saat:'07:45' });
    // Terminli bir adim olmadan .ics bos cikiyor; once veri kuruluyor.
    await p.evaluate(()=>{ const x=projeEkle('Saat testi','','','studio','');
      adimTarihiYaz(x,'script','2026-10-01'); saveProjects(); });
    await p.click('#remindersBtn'); await p.waitForTimeout(250);
    await p.check('#rm_takvim'); await p.waitForTimeout(250);
    await p.click('#rm_kurBtn'); await p.waitForTimeout(700);
    const ics = await p.evaluate(()=>window.__ics || '');
    ok('bir gün önce tetiği 07:45\'e göre', ics.includes('TRIGGER;VALUE=DURATION:-PT16H15M'), (ics.match(/TRIGGER[^\r\n]*/g)||[]).join(' | '));
    ok('termin günü tetiği 07:45\'e göre', ics.includes('TRIGGER;VALUE=DURATION:PT7H45M'));
    ok('eski sabit 09:00 tetiği YOK', !/TRIGGER;VALUE=DURATION:-PT15H\r?\n/.test(ics));
    await p.close();
  }

  await b.close();
  console.log(k ? '\n'+k+' SORUN' : '\nHEPSİ GEÇTİ');
  process.exit(k?1:0);
})();
