const { chromium } = require('./araclar');
const KOK = 'http://127.0.0.1:8098/';

// SVG <text> rengi fill'den geliyor. Zemin: en yakin dolgulu <rect> ya da
// gorselin kutusu (.ozellik-gorsel / .pano zemini).
const OLC = `(() => {
  function ayir(s){ const m = (s||'').match(/[\\d.]+/g); return m ? m.map(Number) : null; }
  function lin(c){ c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
  function parlak(r){ return 0.2126*lin(r[0]) + 0.7152*lin(r[1]) + 0.0722*lin(r[2]); }
  function karsit(a,b){ const l1=parlak(a), l2=parlak(b); const y=Math.max(l1,l2), k=Math.min(l1,l2); return (y+0.05)/(k+0.05); }
  function uzerine(on, alt, a){ return [0,1,2].map(i => Math.round(on[i]*a + alt[i]*(1-a))); }
  function kesisir(a,b){ return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }

  const kutuZemin = ayir(getComputedStyle(document.querySelector('.ozellik-gorsel')).backgroundColor).slice(0,3);
  const zayif = [];
  document.querySelectorAll('svg text').forEach(t => {
    const metin = t.textContent.trim(); if(!metin) return;
    const r = t.getBoundingClientRect(); if(!r.width || !r.height) return;
    const s = getComputedStyle(t);
    const on = ayir(s.fill); if(!on) return;
    const px = parseFloat(s.fontSize);

    // Metnin altinda kalan, dolgusu olan en son (en ustteki) rect'i bul
    let alt = kutuZemin;
    const svg = t.ownerSVGElement;
    svg.querySelectorAll('rect,circle,path').forEach(sekil => {
      if(sekil === t) return;
      const sr = sekil.getBoundingClientRect();
      if(!kesisir(r, sr)) return;
      // metin bu seklin ICINDE mi (tamamen kapsiyorsa zemin odur)
      if(!(r.left >= sr.left-1 && r.right <= sr.right+1 && r.top >= sr.top-1 && r.bottom <= sr.bottom+1)) return;
      const ss = getComputedStyle(sekil);
      const f = ayir(ss.fill);
      if(!f) return;
      const o = parseFloat(ss.fillOpacity === '' ? 1 : ss.fillOpacity) * parseFloat(ss.opacity || 1);
      if(o <= 0.02) return;
      alt = uzerine(f.slice(0,3), alt, Math.min(o,1));
    });
    const esik = px >= 18.66 ? 3.0 : 4.5;
    const k = karsit(on.slice(0,3), alt);
    if(k < esik) zayif.push({ metin: metin.slice(0,32), px: px.toFixed(1), oran: k.toFixed(2), esik,
                              renk: s.fill, zemin: 'rgb('+alt.join(',')+')' });
  });
  return zayif;
})()`;

(async () => {
  const b = await chromium.launch({ });
  let toplam = 0;
  for (const [ad, tema, dil] of [['acik/EN','light',null], ['koyu/EN','dark',null], ['acik/TR','light','tr'], ['koyu/TR','dark','tr']]) {
    const p = await b.newPage({ colorScheme: tema, viewport:{width:1280,height:900} });
    await p.route('**/fonts.googleapis.com/**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
    await p.route('**/supabase-js**', r => r.abort());
    if(dil) await p.addInitScript(`try{localStorage.setItem('demo_ui_language','${dil}');}catch(e){}`);
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(500);
    const z = await p.evaluate(OLC);
    console.log('\n== ' + ad + ' == zayif SVG metni: ' + z.length);
    z.forEach(x => console.log('   ' + x.oran + ' (esik ' + x.esik + ')  ' + x.px + 'px  "' + x.metin + '"  ' + x.renk + ' / ' + x.zemin));
    toplam += z.length;
    await p.close();
  }
  await b.close();
  console.log('\nTOPLAM: ' + toplam);
})();
