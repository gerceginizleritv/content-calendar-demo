// TELEFONDA FILTRE PANELI — secim yapilabiliyor mu?
//
// 26 Eylul 2026, iPhone Safari: kullanici takvimde "Platform" filtresine
// basiyor, panel aciliyor ama HICBIR SEY SECEMIYOR. Ekranda panelin
// yalnizca basligi goruniyor, o da bas harfleri kesik ("PLATFORM" yerine
// "_ATFORM").
//
// ══════════════════════════════════════════════════════════════════
// SEBEP
// ══════════════════════════════════════════════════════════════════
// .fpanel position:fixed ve #filterBar'in ICINDE duruyor. Serit
// telefonda `overflow-x:auto` + `-webkit-overflow-scrolling:touch` ile
// yana kayan tek satirdi.
//
// iOS Safari'de kaydirilabilir bir kapsayicinin icindeki position:fixed
// cocuk viewport'a DEGIL O KAPSAYICIYA gore konumlaniyor ve ona
// KIRPILIYOR. Yani alttan acilmasi gereken panel 40 piksellik serit
// satirina sikisiyor, serdin kaydirma miktari kadar da sola kayiyor.
// Secenekler ekranin disinda kaliyor.
//
// ══════════════════════════════════════════════════════════════════
// BU TESTIN ASIL OLCUMU NEDEN "GORUNUYOR MU" DEGIL
// ══════════════════════════════════════════════════════════════════
// Chromium bu davranisi GOSTERMIYOR. Hata duruyorken de panel burada
// duzgun aciliyor, secenekler tiklanabiliyor. Yani "secenek gorunuyor
// mu" olcumu bu hatayi YAKALAMAZDI -- hatanin yasandigi gun bile yesil
// yanardi.
//
// Yakalayan sey KOSULUN KENDISI: acik panelin ustunde, position:fixed
// icin kapsayici blok ureten bir ata var mi? Bu olcum tarayicidan
// bagimsiz ve iOS'un cezalandirdigi sey tam olarak bu.
const { chromium, ORNEKSIZ } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

// position:fixed icin kapsayici blok ureten (ya da iOS'ta kirpan)
// ozellikler. Sayfa icinde calisacak, o yuzden kaynak olarak geciyor.
const KUSUR_KAYNAK = `(s)=> ({
  transform:   s.transform !== 'none',
  filter:      s.filter !== 'none',
  perspective: s.perspective !== 'none',
  willChange:  /transform|filter|perspective/.test(s.willChange || ''),
  contain:     /paint|layout|strict|content/.test(s.contain || ''),
  backdrop:    !!(s.backdropFilter && s.backdropFilter !== 'none'),
  overflow:    s.overflowX !== 'visible' || s.overflowY !== 'visible'
})`;

async function ac(t, genislik){
  const c = await t.newContext({ viewport:{ width:genislik, height:844 }, locale:'tr-TR',
    isMobile: genislik < 700, hasTouch: genislik < 700 });
  const p = await c.newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**supabase.co**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());
  await p.addInitScript(`try{ localStorage.setItem('demo_tour_done','1'); localStorage.setItem('demo_seen_intro','1'); }catch(e){}`);
  await p.addInitScript(ORNEKSIZ);
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1700);
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr'); setPage('calendar');
    // Filtre cipleri veriden turuyor. Sayi da onemli: "kapaninca sayfa
    // yeniden kayiyor" olcumu ancak sayfa GERCEKTEN kaydirilabilirse bir
    // sey olcuyor. Iki kayitla sayfa kisa kaliyor, scrollTo hicbir sey
    // yapmiyor ve olcum sessizce bosa dusuyordu.
    for(let i = 0; i < 40; i++){
      events.push(sanitizeEvent({ id:'f'+i, type: i % 2 ? 'reels' : 'story',
        platform: i % 2 ? 'instagram' : 'facebook', title:'Kayıt ' + i,
        date:'2026-09-' + String((i % 28) + 1).padStart(2,'0'), time:'09:00', content:{} }));
    }
    save(); renderCal();
  });
  await p.waitForTimeout(400);
  return { c, p };
}

// Acik panelin ustunde kapsayici blok ureten ata var mi?
// body ve html HARIC: sayfa kilitlenince body'ye overflow:hidden
// konuyor ve bu fixed ogeleri kirpmiyor -- kok kaydirma kapsayicisi
// zaten viewport'un kendisi.
const kotuAtalar = (p, secici)=> p.evaluate(({ sec, kaynak })=>{
  const KUSURLU = eval('(' + kaynak + ')');
  const pan = document.querySelector(sec);
  const kotu = [];
  for(let el = pan.parentElement; el && el !== document.body; el = el.parentElement){
    const s = getComputedStyle(el);
    const k = KUSURLU(s);
    const sebep = Object.keys(k).filter(x=> k[x]);
    if(sebep.length) kotu.push((el.id || el.className || el.tagName) + ': ' + sebep.join(','));
  }
  return kotu;
}, { sec: secici, kaynak: KUSUR_KAYNAK });

(async () => {
  const t = await chromium.launch();

  console.log('[telefon]');
  {
    const { c, p } = await ac(t, 390);
    const hata = []; p.on('pageerror', e=> hata.push(String(e)));

    // Serit yana KAYMIYOR: kayan bir serit hem kesfedilmiyor hem de
    // iOS'ta paneli kiriyor.
    const serit = await p.evaluate(()=>{
      const e = document.getElementById('filterBar');
      const s = getComputedStyle(e);
      return { kayiyor: e.scrollWidth > e.clientWidth + 1,
               overflowX: s.overflowX, sarma: s.flexWrap,
               yukseklik: Math.round(e.getBoundingClientRect().height) };
    });
    bak('★ filtre şeridi yana KAYMIYOR', serit.kayiyor === false, JSON.stringify(serit));
    bak('şerit sarıyor', serit.sarma === 'wrap', serit.sarma);
    bak('şeritte overflow yok', serit.overflowX === 'visible', serit.overflowX);

    await p.click('.fdrop[data-drop="platform"] .fbtn');
    await p.waitForTimeout(400);

    // ⚠ ASIL OLCUM. Yukaridaki uzun nottaki sebep.
    const kotu = await kotuAtalar(p, '.fdrop[data-drop="platform"] .fpanel');
    bak('★ panelin üstünde fixed\'i kıran ata YOK', kotu.length === 0, kotu.join(' | '));

    const d = await p.evaluate(()=>{
      const pan = document.querySelector('.fdrop[data-drop="platform"] .fpanel');
      const r = pan.getBoundingClientRect();
      const bas = pan.querySelector('.fpanel-title');
      const br = bas && bas.getBoundingClientRect();
      const ilk = pan.querySelector('.legend-item');
      const ir = ilk && ilk.getBoundingClientRect();
      const ust = ir && document.elementFromPoint(ir.left + ir.width/2, ir.top + ir.height/2);
      return {
        pozisyon: getComputedStyle(pan).position,
        panel: { x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width) },
        tamGenislik: Math.abs(r.width - innerWidth) <= 1 && Math.round(r.x) === 0,
        altaYapisik: Math.abs(r.bottom - innerHeight) <= 1,
        secenek: pan.querySelectorAll('.legend-item').length,
        baslikGorunur: br ? (br.left >= 0 && br.right <= innerWidth) : null,
        ilkGorunur: ir ? (ir.top >= 0 && ir.bottom <= innerHeight && ir.left >= 0) : null,
        ilkTiklanabilir: !!(ust && (ust === ilk || ilk.contains(ust) || ust.contains(ilk)))
      };
    });
    bak('panel fixed', d.pozisyon === 'fixed', d.pozisyon);
    bak('alttan açılan sayfa: tam genişlik', d.tamGenislik === true, JSON.stringify(d.panel));
    bak('alta yapışık', d.altaYapisik === true, JSON.stringify(d.panel));
    bak('★ başlık kesilmiyor', d.baslikGorunur === true, JSON.stringify(d.panel));
    bak('seçenekler var', d.secenek >= 2, String(d.secenek));
    bak('ilk seçenek ekranda', d.ilkGorunur === true);
    bak('ilk seçenek tıklanabilir', d.ilkTiklanabilir === true);

    // SECIM GERCEKTEN CALISIYOR MU: tiklayip filtrenin uygulandigini gor.
    const secim = await p.evaluate(async ()=>{
      const pan = document.querySelector('.fdrop[data-drop="platform"] .fpanel');
      const ilk = pan.querySelector('.legend-item');
      const ad = ilk.dataset.platform || ilk.textContent.trim();
      ilk.click();
      await new Promise(r=> setTimeout(r, 300));
      const rozet = document.querySelector('.fdrop[data-drop="platform"] .fbadge');
      return { ad, rozetGorunur: rozet && !rozet.hidden,
               rozet: rozet && rozet.textContent.trim(),
               secili: activePlatformFilters.size };
    });
    bak('★ seçim uygulanıyor', secim.secili === 1, JSON.stringify(secim));
    bak('seçim rozette görünüyor', secim.rozetGorunur === true, JSON.stringify(secim));

    // ══════════════════════════════════════════════════════════
    // KAPANABILIYOR MU — "ekranda kitleniyor" sikayetinin olcumu
    // ══════════════════════════════════════════════════════════
    // Panel secimden sonra BILEREK acik kaliyor (coklu secim). O yuzden
    // cikis yolunun her zaman CALISMASI ve GORUNMESI sart: gorunmeyen
    // bir panel + karartilmis ekran + kilitli govde, kullanici icin
    // "donmus ekran" demek.
    const kapatDugme = await p.$('.fdrop[data-drop="platform"] .fpanel .fpanel-close');
    bak('★ kapat düğmesi görünür', !!(kapatDugme && await kapatDugme.isVisible()));
    // Kilit ACIKKEN gercekten donduruyor mu? Sinif adina degil
    // mekanizmaya bakiliyor: sinif dursa da kural uygulanmiyorsa kilit
    // yok demektir.
    bak('gövde kilitli (panel açıkken doğru)',
        await p.evaluate(()=> document.body.classList.contains('govde-kilit')
                           && getComputedStyle(document.body).position === 'fixed'),
        await p.evaluate(()=> document.body.className + ' / ' + getComputedStyle(document.body).position));

    await p.tap('.fdrop[data-drop="platform"] .fpanel .fpanel-close');
    await p.waitForTimeout(350);
    let kilit = await p.evaluate(()=> ({
      kilit: document.body.classList.contains('govde-kilit'),
      perde: !!document.querySelector('.fbackdrop.open'),
      acik: document.querySelectorAll('#filterBar .fdrop.open').length,
      secili: activePlatformFilters.size }));
    bak('★ × ile kapanıyor', kilit.acik === 0 && kilit.perde === false, JSON.stringify(kilit));
    bak('★ gövde kilidi KALKIYOR', kilit.kilit === false, JSON.stringify(kilit));
    bak('seçim kapanınca kaybolmuyor', kilit.secili === 1, String(kilit.secili));
    // Kaydirma denemesi sayfanin UZUNLUGUNA bagliydi ve o da gorunume
    // gore degisiyor: kisa bir sayfada scrollTo hicbir sey yapmiyor ve
    // olcum sessizce bosa dusuyordu. Onun yerine DONDURAN MEKANIZMANIN
    // kendisi olculuyor -- body'nin position:fixed ve tepe kaydirmasi.
    const govde = await p.evaluate(()=> ({
      pozisyon: getComputedStyle(document.body).position,
      top: document.body.style.top,
      sinif: document.body.className
    }));
    bak('★ gövde artık position:fixed DEĞİL', govde.pozisyon !== 'fixed', JSON.stringify(govde));
    bak('★ gövdenin tepe kaydırması temizlendi', govde.top === '', JSON.stringify(govde));

    // Perde de bir cikis yolu. iOS duz bir div'e click gondermeyebiliyor;
    // cursor:pointer o yuzden var, fare icin degil.
    await p.tap('.fdrop[data-drop="platform"] .fbtn');
    await p.waitForTimeout(300);
    bak('perde imleç olarak tıklanabilir işaretli (iOS şartı)',
        await p.evaluate(()=> getComputedStyle(document.querySelector('.fbackdrop')).cursor === 'pointer'),
        await p.evaluate(()=> getComputedStyle(document.querySelector('.fbackdrop')).cursor));
    await p.touchscreen.tap(195, 60);
    await p.waitForTimeout(350);
    kilit = await p.evaluate(()=> ({
      kilit: document.body.classList.contains('govde-kilit'),
      acik: document.querySelectorAll('#filterBar .fdrop.open').length }));
    bak('★ perdeye dokununca da kapanıyor', kilit.acik === 0 && kilit.kilit === false,
        JSON.stringify(kilit));

    bak('js hatası yok', hata.length === 0, hata.slice(0,2).join(' | '));
    await c.close();
  }

  console.log('[masaüstü — gerileme]');
  {
    const { c, p } = await ac(t, 1280);
    await p.click('.fdrop[data-drop="platform"] .fbtn');
    await p.waitForTimeout(300);
    const d = await p.evaluate(()=>{
      const kap = document.querySelector('.fdrop[data-drop="platform"]');
      const pan = kap.querySelector('.fpanel');
      const br = kap.querySelector('.fbtn').getBoundingClientRect();
      const r = pan.getBoundingClientRect();
      return { pozisyon: getComputedStyle(pan).position,
               dugmeninAltinda: r.top >= br.bottom - 1,
               // Masaustunde tam genislik OLMAMALI: acilir menu, sayfa degil.
               dar: r.width < innerWidth / 2,
               secenek: pan.querySelectorAll('.legend-item').length };
    });
    bak('masaüstünde panel açılır menü olarak kalıyor', d.pozisyon === 'absolute', d.pozisyon);
    bak('düğmenin altında duruyor', d.dugmeninAltinda === true);
    bak('sayfa genişliğini kaplamıyor', d.dar === true);
    bak('seçenekler yerinde', d.secenek >= 2, String(d.secenek));
    bak('masaüstünde de kıran ata yok', (await kotuAtalar(p, '.fdrop[data-drop="platform"] .fpanel')).length === 0);
    await c.close();
  }

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
