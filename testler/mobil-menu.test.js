// Telefonda ikincil baglantilar yana kayan bir seritteydi: alti baglanti
// 360 piksele sigmiyor, kaydirmayi fark etmeyen kullanici "Kullanim
// kilavuzu" ve "Geri bildirim"i hic gormuyordu. Kaydirma bir cozum degil,
// sorunun ertelenmesiydi. Artik hepsi "..." dugmesinin actigi alt
// sayfada, tam adiyla ve alt alta.
//
// Baglantilar TASINMADI, yerinde kaldi; serit CSS ile alt sayfaya
// donusuyor. Test bunu da olcuyor: dugmeler hala seridin icinde mi.
//
// DIL ANAHTARI bunun ISTISNASI ve sonradan disari alindi. Alt sayfada
// iken bulunamiyordu: "..." dugmesine basmayi gerektiren bir sey,
// uygulamayi kendi dilinde gormeyen birinin arayacagi son yer. Artik
// ust seritte, dugmeye basmadan gorunuyor. Tema alt sayfada kaldi --
// nadiren degistirilen bir ayar, ayni aciliga ihtiyaci yok.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

// ⛔ 19 KASIM 2026 — LISTE ARTIK ELLE YAZILMIYOR (YAPILACAKLAR 58).
//   3-6. asamalarda seritten UC baglanti kalkti (`remindersBtn`,
//   `hesapEtiketBtn`, `aiSettingsBtn`, ayrica `havaGosterBtn`) ve
//   yerlerine tek `ayarlarBtn` geldi. Elle yazilan liste her asamada
//   elle duzeltilmek zorunda kaldi; ucuncusunde yeter dendi.
//   ⚠ Olculen sey AYNI: seritte O AN ne varsa hepsi alt sayfada,
//     ekranda ve dokunulabilir mi. Artik yeni bir baglanti eklenirse
//     kendiliginden olculuyor.
//   ⚠ Bos donmedigi AYRICA sart kosuluyor: `[].every(...)` her zaman
//     dogrudur ve bu oturumda tam o tuzaga uc kez dusuldu.
let BAGLANTILAR = [];

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

  BAGLANTILAR = await p.evaluate(()=>
    [...document.querySelectorAll('#railFoot .rail-link')]
      .filter(e=> !e.hidden).map(e=> e.id).filter(Boolean));

  console.log('[baglantilar yerinde duruyor]');
  bak('serit baglantilari BULUNDU', BAGLANTILAR.length >= 4, BAGLANTILAR.join(','));
  bak('hepsi hala seridin icinde',
      await p.evaluate(ids=> ids.every(id=>{ const e = document.getElementById(id);
        return !!(e && e.closest('#railFoot')); }), BAGLANTILAR));
  // ⛔ 19 KASIM 2026 — TEMA ALT SAYFADAN CIKTI (YAPILACAKLAR 58).
  //    Eskiden burada kaliyordu ("nadiren degistirilen bir ayar").
  //    Kullanici ayarlarin bir SAYFAYA tasinmasini istedi; tema da
  //    oraya gitti. ⚠ Guvence kaybolmadi, yeri degisti: alt sayfada
  //    artik ayarlara GOTUREN dugme var ve tema o sayfada.
  bak('AYARLAR dugmesi alt sayfada',
      await p.evaluate(()=> !!document.getElementById('ayarlarBtn').closest('#railFoot')));
  bak('tema AYARLAR SAYFASINDA, alt sayfada degil',
      await p.evaluate(()=> {
        const t = document.getElementById('themeBtn');
        return !!t.closest('#ayarlarPage') && !t.closest('#railFoot');
      }));
  // DIL anahtari alt sayfadan CIKTI. Orada iken kullanici onu bulamiyordu
  // -- "..." dugmesine basmayi gerektiren bir sey, uygulamayi kendi
  // dilinde gormeyen birinin arayacagi son yer. Artik ust seritte,
  // dugmeye basmadan gorunuyor.
  bak('dil anahtari alt sayfada DEGIL',
      await p.evaluate(()=> !document.getElementById('langSelect').closest('#railFoot')));
  bak('dil anahtari ust seritte',
      await p.evaluate(()=> !!document.getElementById('langSelect').closest('.rail-me')));
  bak('dil anahtari alt sayfa KAPALIYKEN gorunuyor',
      await p.isVisible('#langSelect'));
  // Ust seritte yer dar: tam ad ("Türkçe") marka adini kirpiyordu,
  // kapali etiket kisa koda dusuyor.
  // ⛔ 19 KASIM 2026 — AYNI "BOS BEKCI" BURADA DA VARDI. Secici
  //    <select> olmaktan cikinca `#langSelect option` bos donmeye
  //    basladi ve bos dizide `.every(...)` her zaman dogru oldugu
  //    icin iddia hicbir seyi olcmeden yesil kaliyordu.
  //    ⚠ Olculen sey degismedi, tetikten okunuyor ve bos olmadigi da
  //      sart kosuluyor.
  const kisaEtiket = await p.$eval('#langSelect .dil-tetik .dil-ad',
                                   e=> e.textContent.trim());
  bak('dar ekranda kisa kod',
      kisaEtiket.length > 0 && kisaEtiket.length <= 3, kisaEtiket);

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
  // Serit yuksekligi BASLIK CUBUGU olarak olculuyor: hava/isik satiri
  // seride sonradan eklendi, kendi satirinda duruyor ve kullanici onu
  // kapatabiliyor. Cubugun kendisi icin sinir degismedi; hava satirinin
  // kendi butcesi asagida ve ayrica hava testinde olculuyor.
  const olcum = await p.evaluate(()=>{
    const s = document.querySelector('.rail').getBoundingClientRect();
    const h = document.getElementById('railHava');
    const hy = (h && !h.hidden) ? h.getBoundingClientRect().height : 0;
    return { serit: Math.round(s.height), hava: Math.round(hy) };
  });
  bak('ust serit 70px altinda (hava satiri haric)',
      olcum.serit - olcum.hava < 70, (olcum.serit - olcum.hava) + 'px');
  bak('hava satiri tek satirlik yer kapliyor', olcum.hava < 30, olcum.hava + 'px');

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
  bak(BAGLANTILAR.length + ' BAGLANTI DA EKRANDA', gorunen.length === BAGLANTILAR.length, gorunen.join(','));
  bak('alt alta duruyorlar',
      await p.evaluate(()=>{
        const a = document.getElementById('tourBtn').getBoundingClientRect();
        const b = document.getElementById('ayarlarBtn').getBoundingClientRect();
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
