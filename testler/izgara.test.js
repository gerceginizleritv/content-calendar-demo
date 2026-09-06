// Kahraman panosunun ızgarası içeriğe göre şişmesin (kesilen sütun kalmasın).
const { chromium } = require('./araclar');
(async()=>{
  const b = await chromium.launch({ });
  let k=0; const ok=(a,c,e)=>{ if(c) console.log('  ok  ',a); else { k++; console.log('  YOK ',a,e===undefined?'':'→ '+e); } };
  for (const [ad, w, dil] of [['masaüstü',1280,null],['masaüstü/TR',1280,'tr'],['tablet',900,null],['telefon',390,'tr']]) {
    const p = await b.newPage({ viewport:{width:w,height:900} });
    await p.route('**/supabase-js**', r=>r.abort());
    if(dil) await p.addInitScript(`try{localStorage.setItem('demo_ui_language','tr');}catch(e){}`);
    await p.goto('http://127.0.0.1:8098/', {waitUntil:'domcontentloaded'});
    await p.waitForTimeout(900);
    const r = await p.evaluate(()=>{
      const iz = document.querySelector('#kahramanPano .izgara');
      const gov = iz.parentElement;
      const hucreler = [...iz.children];
      const sonSag = Math.max(...hucreler.map(h=>h.getBoundingClientRect().right));
      const kap = gov.getBoundingClientRect();
      const tasanKayit = [...iz.querySelectorAll('.kayit')].filter(c=>{
        const h = c.closest('.hucre').getBoundingClientRect();
        return c.getBoundingClientRect().right > h.right + 0.5;
      }).length;
      return { izGenislik: Math.round(iz.scrollWidth), gorunen: Math.round(iz.clientWidth),
               sonSutunKesik: sonSag > kap.right + 1, tasanKayit };
    });
    console.log(' ' + ad);
    ok('  ızgara şişmemiş', r.izGenislik <= r.gorunen + 1, r.izGenislik + ' > ' + r.gorunen);
    ok('  son sütun kesilmiyor', !r.sonSutunKesik);
    ok('  kayıt hücresini taşmıyor', r.tasanKayit === 0, r.tasanKayit);
    await p.close();
  }
  await b.close();
  console.log(k ? '\n' + k + ' SORUN' : '\nHEPSİ GEÇTİ');
  process.exit(k?1:0);
})();
