// Takvim basligi (ay adi / gunun tarihi) telefonda oklarin ve "Bugun"
// dugmesinin ALTINA giriyordu: uc uc uste binmis, tarih okunmuyordu.
//
// Iki sebep vardi. (1) Baslik izgara gozunde "ortalanmis" duruyordu:
// oyle olunca goz basligi germiyor, basligin kendi genisligine
// birakiyor ve uzun baslik iki yana tasiyor. (2) Gun gorunumunun
// basligi ("Tuesday, September 8, 2026") telefonun yerine zaten
// sigmiyordu; gerilse bile uc noktayla kirpilirdi ve kirpilmis bir
// tarih tarihi soylemez.
//
// Test her gorunumu, iki dilde ve uc genislikte geziyor: baslik
// komsulariyla cakisiyor mu, ve kirpilmis mi.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

async function ac(t, w){
  const p = await (await t.newContext({ viewport:{width:w,height:900}, isMobile:w<700, hasTouch:w<700 })).newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
                              localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
                         setPage('calendar'); });
  await p.waitForTimeout(350);
  return p;
}
const olc = p => p.evaluate(()=>{
  const r = document.getElementById('rangeLabel');
  const g = s=>{ const e = document.querySelector(s); if(!e) return null;
    const b = e.getBoundingClientRect(); return { x:b.left, sag:b.right }; };
  const kutu = r.getBoundingClientRect();
  return { metin: r.textContent,
           x: kutu.left, sag: kutu.right,
           // Kirpilmis mi: metnin gercek genisligi kutuya sigiyor mu?
           kirpik: r.scrollWidth > r.clientWidth + 1,
           prev: g('#prevBtn'), today: g('#todayBtn'), next: g('#nextBtn') };
});

(async () => {
  const t = await chromium.launch();
  for(const w of [320, 360, 390, 430]){
    const p = await ac(t, w);
    const hata = []; p.on('pageerror', e=> hata.push(String(e)));
    console.log('['+w+'px]');
    for(const dil of ['tr','en']){
      await p.evaluate(d=> setLanguage(d), dil);
      await p.waitForTimeout(250);
      for(const gor of ['month','week','day','table']){
        await p.evaluate(x=> setView(x), gor);
        await p.waitForTimeout(300);
        const o = await olc(p);
        const ad = dil + '/' + gor;
        // Baslik solda okun, sagda "Bugun"un uzerine binmemeli.
        const cakisiyor = (o.prev && o.x < o.prev.sag - 0.5)
                       || (o.today && o.sag > o.today.x + 0.5);
        bak(ad + ' cakisma yok', !cakisiyor,
            'baslik ' + Math.round(o.x) + '-' + Math.round(o.sag)
            + ' / ok ' + (o.prev ? Math.round(o.prev.sag) : '-')
            + ' / bugun ' + (o.today ? Math.round(o.today.x) : '-'));
        bak(ad + ' kirpilmadi', !o.kirpik, JSON.stringify(o.metin));
      }
    }
    bak(w + 'px sayfa hatasi yok', hata.length === 0, hata.join(' | '));
    await p.close();
  }

  console.log('[masaustunde uzun baslik duruyor]');
  const d = await ac(t, 1280);
  await d.evaluate(()=>{ setLanguage('en'); setView('day'); });
  await d.waitForTimeout(400);
  const o = await olc(d);
  bak('gun basligi tam yaziliyor', /day,/i.test(o.metin), JSON.stringify(o.metin));
  bak('masaustunde de kirpik degil', !o.kirpik);
  await d.close();

  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
