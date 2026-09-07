// Telefonda takvimde yeni kayit penceresi acilinca ekran saga sola
// oynuyor, birakinca yayliyordu; pencere kapaninca da takvim baska bir
// yerde duruyordu.
//
// Iki ayri sebep vardi:
//   1. Yatay YAYLANMA. Sayfa ekrandan genis degil ama tarayici bos yerde
//      belgeyi lastik gibi cekiyor. overscroll-behavior-x:none kapatiyor.
//   2. Govde DONMUYORDU. overflow:hidden iOS'ta yetmiyor; parmak sayfayi
//      yine de suruklüyor. position:fixed gercekten donduruyor, kayma
//      konumu saklanip geri veriliyor.
//
// Headless tarayici lastik hareketini uretmiyor; bu yuzden test
// KURALLARIN yerinde oldugunu ve kilidin gercekten calistigini olcuyor.
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
const kilit = p => p.evaluate(()=>({
  poz: getComputedStyle(document.body).position,
  top: document.body.style.top,
  kayma: Math.round(window.scrollY)
}));

(async () => {
  const t = await chromium.launch();
  const p = await ac(t, 390, true);
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));

  console.log('[yatay yaylanma kapali]');
  bak('belgede overscroll-behavior-x none',
      await p.evaluate(()=> getComputedStyle(document.documentElement).overscrollBehaviorX) === 'none');
  bak('govdede de none',
      await p.evaluate(()=> getComputedStyle(document.body).overscrollBehaviorX) === 'none');
  bak('sayfa zaten ekrandan genis degil',
      await p.evaluate(()=> document.documentElement.scrollWidth <= innerWidth + 1),
      await p.evaluate(()=> document.documentElement.scrollWidth + '/' + innerWidth));

  console.log('[takvimin yatay kaydiricilari zincirlemiyor]');
  for(const sec of ['.cal-grid-wrap', '.cal-table-wrap']){
    const d = await p.evaluate(s=>{ const e = document.querySelector(s);
      return e ? getComputedStyle(e).overscrollBehaviorX : 'yok'; }, sec);
    bak(sec + ' contain', d === 'contain', d);
  }

  console.log('[pencere acilinca govde donuyor]');
  await p.evaluate(()=> window.scrollTo(0, 320));
  await p.waitForTimeout(200);
  const once = await kilit(p);
  bak('once sayfa asagida', once.kayma > 100, String(once.kayma));
  await p.evaluate(()=>{ openModal(null, fmtKey(new Date())); });
  await p.waitForTimeout(450);
  const acik = await kilit(p);
  bak('GOVDE DONDU (position:fixed)', acik.poz === 'fixed', acik.poz);
  bak('kayma konumu saklandi', acik.top === '-' + once.kayma + 'px', acik.top);
  bak('pencere kendi icinde kayiyor, arkaya zincirlenmiyor',
      await p.evaluate(()=> getComputedStyle(document.querySelector('.overlay.open .modal')).overscrollBehaviorY) === 'contain');
  bak('pencere acikken de yatay tasma yok',
      await p.evaluate(()=> document.documentElement.scrollWidth <= innerWidth + 1),
      await p.evaluate(()=> document.documentElement.scrollWidth + '/' + innerWidth));

  console.log('[kapaninca sayfa ayni yerde]');
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  await p.waitForTimeout(450);
  const sonra = await kilit(p);
  bak('govde cozuldu', sonra.poz === 'static', sonra.poz);
  bak('AYNI YERE geri donuldu', Math.abs(sonra.kayma - once.kayma) <= 2,
      once.kayma + ' -> ' + sonra.kayma);
  bak('top temizlendi', sonra.top === '', sonra.top);

  console.log('["..." alt sayfasi da donduruyor]');
  // Playwright'in click'i ogeyi gorunur kilmak icin sayfayi yukari
  // kaydiriyor; olculen sey de tam olarak kayma konumu oldugu icin
  // tiklama kaydirmayan yoldan yapiliyor.
  await p.evaluate(()=> window.scrollTo(0, 260));
  await p.waitForTimeout(250);
  const m0 = await kilit(p);
  bak('once sayfa asagida (alt sayfa turu)', m0.kayma > 100, String(m0.kayma));
  await p.evaluate(()=> document.getElementById('railMoreBtn').click());
  await p.waitForTimeout(400);
  bak('alt sayfa acikken govde donuk',
      (await kilit(p)).poz === 'fixed', (await kilit(p)).poz);
  await p.evaluate(()=> document.getElementById('railArka').click());
  await p.waitForTimeout(400);
  const m1 = await kilit(p);
  bak('kapaninca cozuldu', m1.poz === 'static', m1.poz);
  bak('kayma korundu', Math.abs(m1.kayma - m0.kayma) <= 2, m0.kayma + ' -> ' + m1.kayma);

  console.log('[iki sey ust uste acilinca kilit erken kalkmiyor]');
  await p.evaluate(()=> document.getElementById('railMoreBtn').click());
  await p.waitForTimeout(350);
  await p.evaluate(()=>{ openModal(null, fmtKey(new Date())); });
  await p.waitForTimeout(400);
  bak('ikisi acikken donuk', (await kilit(p)).poz === 'fixed');
  // Alt sayfa kapansin, pencere acik kalsin: kilit SURMELI.
  await p.evaluate(()=>{ document.getElementById('railFoot').classList.remove('acik');
                         document.getElementById('railArka').hidden = true;
                         document.body.classList.remove('menu-open');
                         kilidiTazele(); });
  await p.waitForTimeout(250);
  bak('pencere hala acikken kilit surüyor', (await kilit(p)).poz === 'fixed',
      (await kilit(p)).poz);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  await p.waitForTimeout(350);
  bak('ikisi de kapaninca cozuldu', (await kilit(p)).poz === 'static');
  await p.close();

  console.log('[masaustunde govde dondurulmuyor]');
  const d = await ac(t, 1280, false);
  await d.evaluate(()=>{ openModal(null, fmtKey(new Date())); });
  await d.waitForTimeout(400);
  bak('masaustunde position static kaliyor',
      await d.evaluate(()=> getComputedStyle(document.body).position) === 'static',
      await d.evaluate(()=> getComputedStyle(document.body).position));
  await d.close();

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
