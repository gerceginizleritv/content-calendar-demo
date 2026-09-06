const { chromium } = require('./araclar');
const KOK = 'http://127.0.0.1:8098/';

const OLC = `(() => {
  function ayir(s){ const m = s.match(/[\\d.]+/g); return m ? m.map(Number) : null; }
  function lin(c){ c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
  function parlak(rgb){ return 0.2126*lin(rgb[0]) + 0.7152*lin(rgb[1]) + 0.0722*lin(rgb[2]); }
  function karsit(a,b){ const l1=parlak(a), l2=parlak(b); const y=Math.max(l1,l2), k=Math.min(l1,l2); return (y+0.05)/(k+0.05); }
  function uzerine(on, alt){
    const a = on[3] === undefined ? 1 : on[3];
    return [0,1,2].map(i => Math.round(on[i]*a + alt[i]*(1-a)));
  }
  function zemin(el){
    let n = el;
    let yigin = [];
    while(n && n !== document.documentElement){
      const s = getComputedStyle(n);
      const c = ayir(s.backgroundColor);
      if(c && (c[3] === undefined || c[3] > 0)) yigin.push(c);
      n = n.parentElement;
    }
    const g = ayir(getComputedStyle(document.body).backgroundColor) || [255,255,255];
    let sonuc = g.slice(0,3);
    for(let i = yigin.length - 1; i >= 0; i--) sonuc = uzerine(yigin[i], sonuc);
    return sonuc;
  }
  const zayif = [];
  document.querySelectorAll('*').forEach(el => {
    // sadece kendi metni olan ogeler
    const kendi = Array.from(el.childNodes)
      .filter(n => n.nodeType === 3 && n.textContent.trim())
      .map(n => n.textContent.trim()).join(' ');
    if(!kendi) return;
    const r = el.getBoundingClientRect();
    if(!r.width || !r.height) return;
    const s = getComputedStyle(el);
    if(s.visibility === 'hidden' || s.opacity === '0') return;
    const on = ayir(s.color); if(!on) return;
    const px = parseFloat(s.fontSize);
    const kalin = parseInt(s.fontWeight, 10) >= 700;
    const buyuk = px >= 24 || (px >= 18.66 && kalin);
    const esik = buyuk ? 3.0 : 4.5;
    const k = karsit(uzerine(on, zemin(el)), zemin(el));
    if(k < esik) zayif.push({ etiket: el.tagName.toLowerCase()+'.'+(el.className.baseVal||el.className||'').toString().split(' ')[0],
                              metin: kendi.slice(0,42), px: px.toFixed(1), oran: k.toFixed(2), esik });
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
    console.log('\n== ' + ad + ' == zayif: ' + z.length);
    z.slice(0,20).forEach(x => console.log('   ' + x.oran + ' (esik ' + x.esik + ')  ' + x.px + 'px  ' + x.etiket + '  "' + x.metin + '"'));
    toplam += z.length;
    await p.close();
  }
  await b.close();
  console.log('\nTOPLAM ZAYIF: ' + toplam);
})();
