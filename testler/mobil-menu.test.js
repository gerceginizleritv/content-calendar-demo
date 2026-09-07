// Telefonda ikincil baglantilar yana kayan bir seritteydi: alti baglanti
// 360 piksele sigmiyor, kaydirmayi fark etmeyen kullanici "Kullanim
// kilavuzu" ve "Geri bildirim"i hic gormuyordu. Kaydirma bir cozum degil,
// sorunun ertelenmesiydi. Artik hepsi "..." dugmesinin actigi alt
// sayfada, tam adiyla ve alt alta.
//
// Baglantilar TASINMADI, yerinde kaldi; serit CSS ile alt sayfaya
// donusuyor. Test bunu da olcuyor: dugmeler hala seridin icinde mi.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const BAGLANTILAR = ['tourBtn','aiSettingsBtn','remindersBtn','kilavuzLink','feedbackBtn'];

async function ac(t, w){
  const p = await (await t.newContext({ viewport:{width:w,height:844} })).newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
                              localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
  await p.waitForTimeout(250);
  return p;
}

(async () => {
  const t = await chromium.launch();
  const p = await ac(t, 390);
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));

  console.log('[baglantilar yerinde duruyor]');
  bak('hepsi hala seridin icinde',
      await p.evaluate(ids=> ids.every(id=>{ const e = document.getElementById(id);
        return !!(e && e.closest('#railFoot')); }), BAGLANTILAR));
  bak('dil ve tema da alt sayfada',
      await p.evaluate(()=> !!document.getElementById('langSelect').closest('#railFoot')
                         && !!document.getElementById('themeBtn').closest('#railFoot')));

  console.log('[kapaliyken]');
  const acikMi = ()=> p.$eval('#railFoot', e=> e.classList.contains('acik'));
  bak('alt sayfa kapali', !(await acikMi()));
  bak('kapaliyken gorunmuyor',
      await p.$eval('#railFoot', e=> getComputedStyle(e).visibility === 'hidden'),
      await p.$eval('#railFoot', e=> getComputedStyle(e).visibility));
  bak('YANA KAYAN SERIT KALKTI',
      await p.$eval('#railFoot', e=> e.scrollWidth <= e.clientWidth + 1),
      await p.$eval('#railFoot', e=> e.scrollWidth+'/'+e.clientWidth));
  bak('"..." dugmesi gorunur', await p.$eval('#railMoreBtn', e=> getComputedStyle(e).display !== 'none'));
  bak('arka perde gizli', await p.$eval('#railArka', e=> e.hidden));
  const serit = await p.$eval('.rail', e=> Math.round(e.getBoundingClientRect().height));
  bak('ust serit 70px altinda', serit < 70, serit+'px');

  console.log('[acilinca]');
  await p.click('#railMoreBtn');
  await p.waitForTimeout(350);
  bak('alt sayfa acildi', await acikMi());
  bak('arka perde belirdi', !(await p.$eval('#railArka', e=> e.hidden)));
  bak('aria-expanded dogru', await p.$eval('#railMoreBtn', e=> e.getAttribute('aria-expanded')) === 'true');
  bak('sayfa kaymasi kilitlendi', await p.evaluate(()=> document.body.classList.contains('menu-open')));
  const gorunen = await p.evaluate(ids=> ids.filter(id=>{
    const r = document.getElementById(id).getBoundingClientRect();
    return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight + 1;
  }), BAGLANTILAR);
  bak('BES BAGLANTI DA EKRANDA', gorunen.length === BAGLANTILAR.length, gorunen.join(','));
  bak('alt alta duruyorlar',
      await p.evaluate(()=>{
        const a = document.getElementById('tourBtn').getBoundingClientRect();
        const b = document.getElementById('aiSettingsBtn').getBoundingClientRect();
        return b.top >= a.bottom - 1;
      }));
  bak('dokunma hedefleri 40px+',
      await p.evaluate(ids=> ids.every(id=> document.getElementById(id).getBoundingClientRect().height >= 40), BAGLANTILAR),
      await p.evaluate(ids=> ids.map(id=> Math.round(document.getElementById(id).getBoundingClientRect().height)).join(','), BAGLANTILAR));

  console.log('[kapanma yollari]');
  await p.click('#railArka');
  await p.waitForTimeout(300);
  bak('arkaya dokununca kapaniyor', !(await acikMi()));
  await p.click('#railMoreBtn'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  bak('Escape kapatiyor', !(await acikMi()));
  await p.click('#railMoreBtn'); await p.waitForTimeout(300);
  await p.click('#tourBtn'); await p.waitForTimeout(400);
  bak('bir sey secilince kapaniyor', !(await acikMi()));
  bak('secilen sey acildi', await p.$eval('#tourOverlay', e=> e.classList.contains('open')));
  bak('kapaninca kayma kilidi kalkti', await p.evaluate(()=> !document.body.classList.contains('menu-open')));
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  await p.close();

  console.log('[masaustunde alt sayfa yok]');
  const m = await ac(t, 1280);
  bak('"..." dugmesi gizli', await m.$eval('#railMoreBtn', e=> getComputedStyle(e).display === 'none'));
  bak('baglantilar dogrudan gorunuyor',
      await m.$eval('#railFoot', e=> getComputedStyle(e).visibility === 'visible'));
  bak('serit sabitlenmemis', await m.$eval('#railFoot', e=> getComputedStyle(e).position !== 'fixed'),
      await m.$eval('#railFoot', e=> getComputedStyle(e).position));
  await m.close();

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
