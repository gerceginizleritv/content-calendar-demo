// ILK KARSILASMA. Iki sey olculuyor.
//
// 1. BOS SAYFADA YOL. Fikirler, Mekanlar, Scriptler ve Projeler bos
//    gelebiliyor. Bos bir ekrana bakan kisi once ortaya bakiyor; ekleme
//    dugmesi yalnizca ust cubukta durursa "ne yapacagim" sorusu cevapsiz
//    kaliyor. Her bos sayfada, ortada, tek dokunusla baslatan bir sey
//    olmali.
//
// 2. ILK GELENE KISA TUR. On adim, daha hicbir seye dokunmamis birine
//    kapida on ekranlik bir sunum demekti. Acilista uc adim; on adimlik
//    tam surum "? Bu nasil calisir" dugmesinde ve kisa turun sonundaki
//    baglantida duruyor. Hicbir adim silinmedi.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

// Turu gormus kullanici: bos sayfalari incelerken tur karisimasin.
async function ac(t, turGorulmus){
  const p = await (await t.newContext({ viewport:{width:1280,height:900} })).newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(g=>{ try{
      if(g){ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_tour_done','1'); }
      else { localStorage.removeItem('demo_seen_intro'); localStorage.removeItem('demo_tour_done'); }
    }catch(e){} }, turGorulmus);
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1600);
  return p;
}

(async () => {
  const t = await chromium.launch();

  // ---------- 1. Bos sayfalar ----------
  const p = await ac(t, true);
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    // Her sey bos: ilk kez giren birinin gordugu hal.
    projects = []; fikirler = []; scriptler = []; mekanlar = [];
    saveProjects(); saveFikirler(); saveScriptler(); saveMekanlar();
  });

  const SAYFALAR = [
    ['projects', 'Projeler', '#p_emptyNew',  ()=> !document.getElementById('projectNewOverlay').hidden
                                               || document.querySelector('#projectNewOverlay.open') !== null],
    ['places',   'Mekanlar', '#mk_emptyNew', ()=> !!document.querySelector('#placeOverlay.open')],
    ['scripts',  'Scriptler','#sc_emptyNew', ()=> !!document.querySelector('#scriptOverlay.open')]
  ];
  for(const [sayfa, ad, sec] of SAYFALAR){
    console.log('['+ad+' bos]');
    await p.evaluate(x=> setPage(x), sayfa);
    await p.waitForTimeout(350);
    const dugme = await p.$(sec);
    bak(ad + ': ortada baslatan dugme var', !!dugme, sec);
    if(dugme){
      bak(ad + ': dugme gorunur', await dugme.isVisible());
      const yazi = (await dugme.textContent()).trim();
      bak(ad + ': dugme ne yapacagini soyluyor', yazi.length > 2, yazi);
    }
  }

  console.log('[Fikirler bos]');
  await p.evaluate(()=> setPage('ideas'));
  await p.waitForTimeout(350);
  // Fikirler'de ekleme KARTI ayni isi goruyor: ayri dugme eklenmedi.
  bak('Fikirler: ekleme karti duruyor', await p.$('#fk_openAdd') !== null);
  bak('Fikirler: karti gorunur', await (await p.$('#fk_openAdd')).isVisible());

  console.log('[dugmeler gercekten aciyor]');
  await p.evaluate(()=> setPage('places'));
  await p.waitForTimeout(300);
  await p.click('#mk_emptyNew');
  await p.waitForTimeout(400);
  bak('Mekanlar: dugme pencereyi acti', await p.$('#placeOverlay.open') !== null);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  await p.evaluate(()=> setPage('scripts'));
  await p.waitForTimeout(300);
  await p.click('#sc_emptyNew');
  await p.waitForTimeout(400);
  bak('Scriptler: dugme pencereyi acti', await p.$('#scriptOverlay.open') !== null);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });

  console.log('[dolu sayfada bos hali cikmiyor]');
  await p.evaluate(()=>{ mekanlar = [mekanTemizle({ id:'m1', name:'Yerebatan Sarnıcı', city:'İstanbul' })];
                         saveMekanlar(); setPage('places'); renderMekanlar(); });
  await p.waitForTimeout(350);
  bak('Mekanlar: kayit varken bos dugmesi yok', await p.$('#mk_emptyNew') === null);
  bak('sayfa hatasi yok (bos sayfalar)', hata.length === 0, hata.join(' | '));
  await p.close();

  // ---------- 2. Kisa tur ----------
  console.log('[ilk gelene kisa tur]');
  const y = await ac(t, false);
  const hata2 = []; y.on('pageerror', e=> hata2.push(String(e)));
  await y.waitForTimeout(1200);
  await y.evaluate(()=> setLanguage('tr'));
  await y.waitForTimeout(200);
  bak('tur kendiliginden acildi', await y.$eval('#tourOverlay', e=> e.classList.contains('open')));
  const adimYazi = ()=> y.$eval('#tourStep', e=> e.textContent.trim());
  const nokta = ()=> y.$$eval('#tourDots .tour-dot', e=> e.length);
  bak('UC adim gosteriliyor', (await nokta()) === 3, String(await nokta()));
  bak('sayac uctan sayiyor', /1\s*\/\s*3/.test(await adimYazi()), await adimYazi());
  bak('ilk adim: genel bakis',
      /yay[ıi]na|fikirden/i.test(await y.$eval('#tourTitle', e=> e.textContent)),
      await y.$eval('#tourTitle', e=> e.textContent));
  bak('ilk adimda tam tur baglantisi gorunmuyor', await y.$eval('#tourFull', e=> e.hidden));

  await y.click('#tourNextBtn'); await y.waitForTimeout(250);
  bak('ikinci adim projeler', /proje/i.test(await y.$eval('#tourTitle', e=> e.textContent)),
      await y.$eval('#tourTitle', e=> e.textContent));
  await y.click('#tourNextBtn'); await y.waitForTimeout(250);
  bak('ucuncu adim takvim', /takvim/i.test(await y.$eval('#tourTitle', e=> e.textContent)),
      await y.$eval('#tourTitle', e=> e.textContent));
  bak('gorsel de ciziliyor (adim atlanmasina ragmen)',
      await y.$eval('#tourVisual', e=> e.querySelector('svg') !== null));
  bak('son adimda dugme "tamam" diyor',
      /tamam|anlad/i.test(await y.$eval('#tourNextBtn', e=> e.textContent)),
      await y.$eval('#tourNextBtn', e=> e.textContent));

  console.log('[tam tura gecis]');
  bak('son adimda tam tur baglantisi cikti', !(await y.$eval('#tourFull', e=> e.hidden)));
  bak('baglanti on adimi soyluyor', /10/.test(await y.$eval('#tourFull', e=> e.textContent)),
      await y.$eval('#tourFull', e=> e.textContent));
  await y.click('#tourFull'); await y.waitForTimeout(300);
  bak('ON adima gecildi', (await nokta()) === 10, String(await nokta()));
  bak('basa donuldu', /1\s*\/\s*10/.test(await adimYazi()), await adimYazi());
  bak('pencere kapanmadi', await y.$eval('#tourOverlay', e=> e.classList.contains('open')));

  console.log('["? Bu nasil calisir" hep TAM turu aciyor]');
  await y.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  await y.evaluate(()=> document.getElementById('tourBtn').click());
  await y.waitForTimeout(350);
  bak('elle acilan tur on adim', (await nokta()) === 10, String(await nokta()));
  bak('tam turda baglanti gizli', await y.$eval('#tourFull', e=> e.hidden));
  bak('sayfa hatasi yok (tur)', hata2.length === 0, hata2.join(' | '));
  await y.close();

  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
