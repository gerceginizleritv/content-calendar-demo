// Alt sekme cubugu ekranin ORTALARINA tasindi, altinda bos bir alan
// kaldi. Sebep: kaydirma bir sure belgeden alinip .wrap'in icine
// konmustu ve position:fixed olan alt cubuk o KABIN ICINDE kaliyordu.
// Kaydiran bir kabin icindeki sabit oge ekrana degil kaba gore
// konumlaniyor — masaustu tarayicisinda fark edilmiyor, telefonda
// cubuk havada kaliyor.
//
// Bu test o hatanin geri gelmesini engelliyor. Olctugu sey "guzel mi"
// degil, YAPISAL kural: sabit ogelerin hicbir atasi kaydiran bir kap
// ya da (transform/filter/contain gibi) sabit konumlandirmayi kendine
// baglayan bir kutu olmamali.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

// Sabit konumlandirmayi kendine baglayan ata var mi?
const SABIT_OGELER = ['#rail > .rail-nav', '#addBtn', '#railFoot', '#railArka'];
const atalariIncele = (p, sec) => p.evaluate(s=>{
  const el = document.querySelector(s);
  if(!el) return { yok:true };
  const kotu = [];
  let a = el.parentElement;
  while(a && a !== document.documentElement){
    const st = getComputedStyle(a);
    const sebep = [];
    if(st.transform && st.transform !== 'none') sebep.push('transform');
    if(st.filter && st.filter !== 'none') sebep.push('filter');
    if(st.backdropFilter && st.backdropFilter !== 'none') sebep.push('backdrop-filter');
    if(st.perspective && st.perspective !== 'none') sebep.push('perspective');
    if(/paint|layout|strict|content/.test(st.contain || '')) sebep.push('contain:'+st.contain);
    if(/transform|filter|perspective/.test(st.willChange || '')) sebep.push('will-change:'+st.willChange);
    if(st.overflowY !== 'visible' || st.overflowX !== 'visible')
      sebep.push('kaydirici(' + st.overflowX + '/' + st.overflowY + ')');
    if(sebep.length){
      kotu.push((a.tagName.toLowerCase() + (a.id?'#'+a.id:'')
        + (typeof a.className === 'string' && a.className ? '.'+a.className.trim().split(/\s+/)[0] : ''))
        + ' -> ' + sebep.join(', '));
    }
    a = a.parentElement;
  }
  return { kotu };
}, sec);

async function ac(t, w){
  const p = await (await t.newContext({ viewport:{width:w,height:844}, isMobile:w<700, hasTouch:w<700 })).newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
                              localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
                         setLanguage('tr'); setPage('calendar'); });
  await p.waitForTimeout(400);
  return p;
}

(async () => {
  const t = await chromium.launch();
  for(const w of [360, 390, 430]){
    const p = await ac(t, w);
    const hata = []; p.on('pageerror', e=> hata.push(String(e)));
    console.log('['+w+'px]');

    const nav = await p.evaluate(()=>{
      const e = document.querySelector('.rail-nav');
      const r = e.getBoundingClientRect();
      return { poz: getComputedStyle(e).position,
               alt: Math.round(r.bottom), ust: Math.round(r.top),
               x: Math.round(r.left), sag: Math.round(r.right),
               ekran: window.innerHeight, genislik: window.innerWidth };
    });
    bak('sekme cubugu sabit', nav.poz === 'fixed', nav.poz);
    bak('EKRANIN DIBINDE', Math.abs(nav.alt - nav.ekran) <= 1,
        'alt kenar ' + nav.alt + ', ekran ' + nav.ekran);
    bak('tam genislikte', nav.x <= 0 && nav.sag >= nav.genislik - 1,
        nav.x + '-' + nav.sag + ' / ' + nav.genislik);
    bak('altinda bos alan yok', nav.ekran - nav.alt === 0, String(nav.ekran - nav.alt));

    // Asil kural: sabit ogeler kaydiran bir kabin icinde OLMAMALI.
    for(const sec of SABIT_OGELER){
      const r = await atalariIncele(p, sec);
      if(r.yok){ bak(sec + ' bulundu', false, 'oge yok'); continue; }
      bak(sec + ' atalari temiz', r.kotu.length === 0, r.kotu.join(' | '));
    }

    // "+" dugmesi de sekme cubugunun USTUNDE kalmali.
    const fab = await p.evaluate(()=>{
      const b = document.getElementById('addBtn').getBoundingClientRect();
      const n = document.querySelector('.rail-nav').getBoundingClientRect();
      return { poz: getComputedStyle(document.getElementById('addBtn')).position,
               alt: Math.round(b.bottom), navUst: Math.round(n.top), ekran: window.innerHeight };
    });
    bak('"+" dugmesi sabit', fab.poz === 'fixed', fab.poz);
    bak('"+" sekme cubugunun ustunde', fab.alt <= fab.navUst + 1,
        fab.alt + ' / ' + fab.navUst);
    bak('"+" ekranin icinde', fab.alt <= fab.ekran, fab.alt + ' / ' + fab.ekran);

    // Sayfa dibindeki icerik cubugun arkasinda kalmasin.
    const dip = await p.evaluate(()=>{
      const f = document.querySelector('.site-foot');
      if(!f) return null;
      window.scrollTo(0, document.documentElement.scrollHeight);
      const r = f.getBoundingClientRect();
      const n = document.querySelector('.rail-nav').getBoundingClientRect();
      return { footAlt: Math.round(r.bottom), navUst: Math.round(n.top) };
    });
    await p.waitForTimeout(250);
    if(dip) bak('en alta inince icerik cubugun arkasinda kalmiyor',
                dip.footAlt <= dip.navUst + 1, dip.footAlt + ' / ' + dip.navUst);

    bak(w + 'px sayfa hatasi yok', hata.length === 0, hata.join(' | '));
    await p.close();
  }

  console.log('[masaustunde sekmeler yine seritte]');
  const d = await ac(t, 1280);
  bak('sabit degil', await d.evaluate(()=> getComputedStyle(document.querySelector('.rail-nav')).position) === 'static',
      await d.evaluate(()=> getComputedStyle(document.querySelector('.rail-nav')).position));
  await d.close();

  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
