// Mekan adlarinda TUR sozcugu ceviriliyor, ozel ad degil:
// "Selimiye Camii" -> "Selimiye Mosque". Testin asil derdi VERIYE
// DOKUNULMAMASI: dil degistirmek kullanicinin yazdigi adi bozmamali,
// duzenleme penceresi hep yazdigi hali gostermeli.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const TOHUM = ()=>{
  mekanlar = [
    { id:'m1', name:'Selimiye Camii',        city:'Edirne' },
    { id:'m2', name:'Sümela Manastırı',      city:'Trabzon' },
    { id:'m3', name:'Galata Kulesi',         city:'İstanbul' },
    { id:'m4', name:'Valens Su Kemeri',      city:'İstanbul' },
    { id:'m5', name:'Efes Antik Kenti',      city:'İzmir' },
    { id:'m6', name:'Ahrida Sinagogu',       city:'İstanbul' },
    { id:'m7', name:'Kapadokya',             city:'Nevşehir' },
    { id:'m8', name:'Yerebatan Sarnıcı',     city:'İstanbul' }
  ].map(x=> mekanTemizle(x)).filter(Boolean);
  saveMekanlar(); setPage('places'); renderMekanlar();
};

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**wikipedia.org**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
                              localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
  await p.evaluate(TOHUM);
  await p.waitForTimeout(300);
  const adlar = ()=> p.$$eval('.mk-ad', e=> e.map(x=> x.textContent.trim()));

  console.log('[Turkce arayuz: ad oldugu gibi]');
  let a = await adlar();
  bak('Selimiye Camii', a.includes('Selimiye Camii'), a.join(' | '));
  bak('Sümela Manastırı', a.includes('Sümela Manastırı'));

  console.log('[Ingilizce arayuz: tur sozcugu ceviriliyor]');
  await p.evaluate(()=> setLanguage('en'));
  await p.waitForTimeout(350);
  a = await adlar();
  bak('Selimiye Mosque',      a.includes('Selimiye Mosque'), a.join(' | '));
  bak('Sümela Monastery',     a.includes('Sümela Monastery'));
  bak('Galata Tower',         a.includes('Galata Tower'));
  bak('Ahrida Synagogue',     a.includes('Ahrida Synagogue'));
  bak('Yerebatan Cistern',    a.includes('Yerebatan Cistern'));
  bak('IKI KELIME: Valens Aqueduct', a.includes('Valens Aqueduct'), a.join(' | '));
  bak('IKI KELIME: Efes Ancient City', a.includes('Efes Ancient City'));
  bak('tur sozcugu olmayan ad AYNEN duruyor', a.includes('Kapadokya'));

  console.log('[veri bozulmuyor]');
  bak('kayitli ad Turkce kaldi',
      await p.evaluate(()=> mekanById('m1').name === 'Selimiye Camii'),
      await p.evaluate(()=> mekanById('m1').name));
  await p.evaluate(()=> mekanPenceresiniAc('m1'));
  await p.waitForTimeout(250);
  bak('duzenleme penceresinde yazdigi ad var',
      await p.$eval('#mk_name', e=> e.value) === 'Selimiye Camii',
      await p.$eval('#mk_name', e=> e.value));
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  await p.waitForTimeout(150);

  console.log('[arama iki dilde de buluyor]');
  const say = async (q)=>{ await p.evaluate(x=>{ mekanArama = x; renderMekanlar(); }, q);
                           await p.waitForTimeout(200); return (await adlar()).length; };
  bak('Ingilizce "mosque" buluyor', await say('mosque') === 1, String(await say('mosque')));
  bak('Turkce "camii" hala buluyor', await say('camii') === 1, String(await say('camii')));
  bak('"aqueduct" buluyor', await say('aqueduct') === 1);
  await say('');

  console.log('[Turkceye donunce geri geliyor]');
  await p.evaluate(()=> setLanguage('tr'));
  await p.waitForTimeout(350);
  a = await adlar();
  bak('ad yeniden Turkce', a.includes('Selimiye Camii') && !a.includes('Selimiye Mosque'), a.join(' | '));

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
