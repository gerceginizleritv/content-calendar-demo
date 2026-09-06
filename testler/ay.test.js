const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:1100} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_pitch','kapali'); localStorage.setItem('demo_page','calendar');
    localStorage.setItem('demo_view','month'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); setPage('calendar'); });
  await page.waitForTimeout(300);
  console.log('AY GÖRÜNÜMÜ — SADECE İLGİLİ AY');

  const r = await page.evaluate(()=>{
    const gunler = [...document.querySelectorAll('.cal-day[data-gun]')].map(c=>c.dataset.gun);
    const ayDisi = [...document.querySelectorAll('.cal-day.cal-out')].length;
    const aylar = [...new Set(gunler.map(g=>g.slice(0,7)))];
    const icAylar = [...new Set([...document.querySelectorAll('.cal-day[data-gun]:not(.cal-out)')]
                     .map(c=>c.dataset.gun.slice(0,7)))];
    return { etiket: document.getElementById('rangeLabel').textContent.trim(),
             ilk: gunler[0], son: gunler[gunler.length-1], adet: gunler.length,
             aylar, icAylar, ayDisi,
             ilkGunAdi: new Date(gunler[0]+'T00:00:00').getDay(),
             sonGunAdi: new Date(gunler[gunler.length-1]+'T00:00:00').getDay() };
  });
  console.log('  pencere:', r.ilk, '→', r.son, '('+r.adet+' gün)');
  k('BAŞLIKTA SADECE AY ADI VE YIL', /^[A-Za-zĞÜŞİÖÇğüşıöç]+ \d{4}$/.test(r.etiket), r.etiket);
  k('AYIN GÜNLERİ TEK BİR AYDAN', r.icAylar.length === 1, r.icAylar.join(', '));
  k('pencere Pazartesi başlıyor, Pazar bitiyor', r.ilkGunAdi === 1 && r.sonGunAdi === 0);
  k('tam haftalar (7\'nin katı)', r.adet % 7 === 0, r.adet+' gün');
  k('komşu ayın günleri soluk işaretli', r.ayDisi > 0 && r.ayDisi < 14, r.ayDisi+' gün');

  // Ay ay ilerliyor
  const nav = await page.evaluate(async ()=>{
    const once = document.getElementById('rangeLabel').textContent.trim();
    document.getElementById('nextBtn').click(); await new Promise(r=>setTimeout(r,300));
    const sonra = document.getElementById('rangeLabel').textContent.trim();
    const icAylar = [...new Set([...document.querySelectorAll('.cal-day[data-gun]:not(.cal-out)')]
                     .map(c=>c.dataset.gun.slice(0,7)))];
    document.getElementById('prevBtn').click(); await new Promise(r=>setTimeout(r,300));
    document.getElementById('prevBtn').click(); await new Promise(r=>setTimeout(r,300));
    const geri = document.getElementById('rangeLabel').textContent.trim();
    document.getElementById('todayBtn').click(); await new Promise(r=>setTimeout(r,300));
    return { once, sonra, geri, icAylar, bugun: document.getElementById('rangeLabel').textContent.trim() };
  });
  k('İLERİ BİR AY GİDİYOR', nav.once !== nav.sonra, nav.once+' → '+nav.sonra);
  k('sonraki ay da tek ay gösteriyor', nav.icAylar.length === 1, nav.icAylar.join(', '));
  k('geri gidiyor', nav.geri !== nav.sonra && nav.geri !== nav.once, nav.geri);
  k('“Bugün” bu aya döndürüyor', nav.bugun === nav.once, nav.bugun);

  // Diger gorunumler bozulmadi
  const digerleri = await page.evaluate(async ()=>{
    const al = ()=>document.getElementById('rangeLabel').textContent.trim();
    document.getElementById('viewWeekBtn').click(); await new Promise(r=>setTimeout(r,300));
    const hafta = { etiket: al(), gun: document.querySelectorAll('.hg-dayhead').length };
    document.getElementById('viewDayBtn').click(); await new Promise(r=>setTimeout(r,300));
    const gun = { etiket: al(), gun: document.querySelectorAll('.hg-dayhead').length };
    document.getElementById('viewTableBtn').click(); await new Promise(r=>setTimeout(r,300));
    const tablo = { satir: document.querySelectorAll('#calTableWrap tbody tr').length };
    document.getElementById('viewMonthBtn').click(); await new Promise(r=>setTimeout(r,300));
    return { hafta, gun, tablo, ayGeri: al() };
  });
  k('hafta görünümü bozulmadı', digerleri.hafta.gun === 7, digerleri.hafta.etiket);
  k('gün görünümü bozulmadı', digerleri.gun.gun === 1, digerleri.gun.etiket);
  k('tablo görünümü bozulmadı', digerleri.tablo.satir === 14, digerleri.tablo.satir+' satır');
  k('aya dönünce yine ay adı', /\d{4}$/.test(digerleri.ayGeri), digerleri.ayGeri);

  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
