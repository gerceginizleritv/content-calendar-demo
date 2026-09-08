// Telefonda ekran kaydirirken saga sola oynuyor, birakinca yayliyordu.
//
// Sebep: iOS Safari BELGENIN yaylanmasini kapatmiyor —
// overscroll-behavior'u yalnizca IC kaydiricilarda dinliyor, sayfanin
// kendisinde degil. Ilk denemede kurali belgeye yazmistik, ise
// yaramadi. Cozum kaydirmayi belgeden alip .wrap'in icine koymak:
// orada overscroll-behavior:none gercekten calisiyor.
//
// Headless tarayici lastik hareketini uretmiyor; bu yuzden test
// YAPININ dogru oldugunu olcuyor: telefonda belge hic kaymiyor, kayan
// sey .wrap, ve pencere acikken .wrap duruyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

async function ac(t, w, dokunmatik){
  const p = await (await t.newContext({ viewport:{width:w,height:844},
                    isMobile:!!dokunmatik, hasTouch:!!dokunmatik })).newPage();
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
// Telefonda kayan sey .wrap, masaustunde belgenin kendisi.
const kilit = p => p.evaluate(()=>{
  const w = document.querySelector('.wrap');
  const icerde = getComputedStyle(w).overflowY !== 'visible';
  return { kilitli: w.classList.contains('kilitli'),
           donuk: icerde ? getComputedStyle(w).overflowY === 'hidden' : false,
           kayma: Math.round(icerde ? w.scrollTop : window.scrollY) };
});
const kaydir = (p, y) => p.evaluate(v=>{
  const w = document.querySelector('.wrap');
  if(getComputedStyle(w).overflowY !== 'visible') w.scrollTop = v; else window.scrollTo(0, v);
}, y);

(async () => {
  const t = await chromium.launch();
  const p = await ac(t, 390, true);
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));

  console.log('[belge hic kaymiyor, kayan sey .wrap]');
  bak('belge dikeyde kaymiyor',
      await p.evaluate(()=> document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1),
      await p.evaluate(()=> document.documentElement.scrollHeight + '/' + document.documentElement.clientHeight));
  bak('belge yatayda kaymiyor',
      await p.evaluate(()=> document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      await p.evaluate(()=> document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth));
  bak('.wrap kaydirici', await p.evaluate(()=> getComputedStyle(document.querySelector('.wrap')).overflowY) === 'auto');
  bak('.wrap YAYLANMIYOR (overscroll-behavior none)',
      await p.evaluate(()=> getComputedStyle(document.querySelector('.wrap')).overscrollBehaviorY) === 'none');
  bak('.wrap gercekten kaydirilabilir',
      await p.evaluate(()=>{ const w = document.querySelector('.wrap');
        return w.scrollHeight > w.clientHeight + 1; }));
  bak('.wrap yatayda kaymiyor',
      await p.evaluate(()=>{ const w = document.querySelector('.wrap');
        return w.scrollWidth <= w.clientWidth + 1; }),
      await p.evaluate(()=>{ const w = document.querySelector('.wrap');
        return w.scrollWidth + '/' + w.clientWidth; }));

  console.log('[sayfa ici kaydiricilar da yaylanmiyor]');
  for(const sec of ['.cal-grid-wrap', '.cal-table-wrap', '.filter-bar']){
    const d = await p.evaluate(s=>{ const e = document.querySelector(s);
      return e ? getComputedStyle(e).overscrollBehaviorX : 'yok'; }, sec);
    bak(sec + ' none', d === 'none', d);
  }

  console.log('[pencere acilinca kaydirma duruyor]');
  await kaydir(p, 320);
  await p.waitForTimeout(200);
  const once = await kilit(p);
  bak('once sayfa asagida', once.kayma > 100, String(once.kayma));
  await p.evaluate(()=>{ openModal(null, fmtKey(new Date())); });
  await p.waitForTimeout(450);
  const acik = await kilit(p);
  bak('KAYDIRMA DONDU', acik.kilitli && acik.donuk, JSON.stringify(acik));
  bak('donarken yerinden oynamadi', Math.abs(acik.kayma - once.kayma) <= 2,
      once.kayma + ' -> ' + acik.kayma);
  bak('pencere kendi icinde kayiyor, arkaya zincirlenmiyor',
      await p.evaluate(()=> getComputedStyle(document.querySelector('.overlay.open .modal')).overscrollBehaviorY) === 'none');
  bak('pencere acikken belge yine kaymiyor',
      await p.evaluate(()=> document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

  console.log('[kapaninca sayfa ayni yerde]');
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  await p.waitForTimeout(450);
  const sonra = await kilit(p);
  bak('kilit cozuldu', !sonra.kilitli && !sonra.donuk, JSON.stringify(sonra));
  bak('AYNI YERE geri donuldu', Math.abs(sonra.kayma - once.kayma) <= 2,
      once.kayma + ' -> ' + sonra.kayma);

  console.log('["..." alt sayfasi da donduruyor]');
  // Playwright'in click'i ogeyi gorunur kilmak icin sayfayi yukari
  // kaydiriyor; olculen sey de tam olarak kayma konumu oldugu icin
  // tiklama kaydirmayan yoldan yapiliyor.
  await kaydir(p, 260);
  await p.waitForTimeout(250);
  const m0 = await kilit(p);
  bak('once sayfa asagida (alt sayfa turu)', m0.kayma > 100, String(m0.kayma));
  await p.evaluate(()=> document.getElementById('railMoreBtn').click());
  await p.waitForTimeout(400);
  bak('alt sayfa acikken kaydirma donuk', (await kilit(p)).donuk);
  await p.evaluate(()=> document.getElementById('railArka').click());
  await p.waitForTimeout(400);
  const m1 = await kilit(p);
  bak('kapaninca cozuldu', !m1.donuk);
  bak('kayma korundu', Math.abs(m1.kayma - m0.kayma) <= 2, m0.kayma + ' -> ' + m1.kayma);

  console.log('[iki sey ust uste acilinca kilit erken kalkmiyor]');
  await p.evaluate(()=> document.getElementById('railMoreBtn').click());
  await p.waitForTimeout(350);
  await p.evaluate(()=>{ openModal(null, fmtKey(new Date())); });
  await p.waitForTimeout(400);
  bak('ikisi acikken donuk', (await kilit(p)).donuk);
  // Alt sayfa kapansin, pencere acik kalsin: kilit SURMELI.
  await p.evaluate(()=>{ document.getElementById('railFoot').classList.remove('acik');
                         document.getElementById('railArka').hidden = true;
                         document.body.classList.remove('menu-open');
                         kilidiTazele(); });
  await p.waitForTimeout(250);
  bak('pencere hala acikken kilit surüyor', (await kilit(p)).donuk);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  await p.waitForTimeout(350);
  bak('ikisi de kapaninca cozuldu', !(await kilit(p)).donuk);
  await p.close();

  console.log('[masaustunde eskisi gibi: kaydiran sey belge]');
  const d = await ac(t, 1280, false);
  bak('belge kaydiriyor',
      await d.evaluate(()=> document.documentElement.scrollHeight > document.documentElement.clientHeight + 1));
  bak('.wrap kaydirici degil',
      await d.evaluate(()=> getComputedStyle(document.querySelector('.wrap')).overflowY) === 'visible',
      await d.evaluate(()=> getComputedStyle(document.querySelector('.wrap')).overflowY));
  await d.evaluate(()=> window.scrollTo(0, 180));
  await d.waitForTimeout(200);
  await d.evaluate(()=>{ openModal(null, fmtKey(new Date())); });
  await d.waitForTimeout(400);
  bak('masaustunde sayfa yerinden oynamadi',
      Math.abs(await d.evaluate(()=> Math.round(window.scrollY)) - 180) <= 2,
      String(await d.evaluate(()=> Math.round(window.scrollY))));
  await d.close();

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
