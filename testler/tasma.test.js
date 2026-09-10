// SVG icindeki yazilar cizildikleri kutunun disina tasiyor mu?
const { chromium } = require('./araclar');
(async()=>{
  const b = await chromium.launch({ });
  let k=0;
  for(const dil of [null,'tr']){
    const p = await b.newPage({ viewport:{width:1280,height:900} });
    await p.route('**/supabase-js**', r=>r.abort());
    if(dil) await p.addInitScript(`try{localStorage.setItem('demo_ui_language','tr');}catch(e){}`);
    await p.goto('http://127.0.0.1:8098/', {waitUntil:'networkidle'});
    await p.waitForTimeout(600);
    const tasan = await p.evaluate(()=>{
      const kotu=[];
      document.querySelectorAll('svg').forEach(svg=>{
        const vb = svg.viewBox.baseVal;
        svg.querySelectorAll('text').forEach(t=>{
          const b = t.getBBox();
          if(b.x < vb.x - 1 || b.x + b.width > vb.x + vb.width + 1)
            kotu.push({ metin:t.textContent.trim().slice(0,30),
                        sol:Math.round(b.x), sag:Math.round(b.x+b.width),
                        sinir:Math.round(vb.x+vb.width) });
        });
      });
      return kotu;
    });
    console.log('\n== dil ' + (dil||'en') + ' == taşan yazı: ' + tasan.length);
    tasan.forEach(x=>console.log('   "'+x.metin+'"  '+x.sol+'→'+x.sag+' (sınır '+x.sinir+')'));
    k += tasan.length;
    await p.close();
  }
  await b.close();
  console.log('\nTOPLAM TAŞAN: ' + k);
  process.exit(k?1:0);
})();
