const { chromium } = require('./araclar');
let g=0,k=0; const ok=(a,c,e)=>{ if(c){g++;console.log('  ok  ',a);} else {k++;console.log('  YOK ',a, e===undefined?'':'→ '+e);} };

// ⚠ TURKCE BUYUK HARF TUZAGI
//
// CSS `text-transform:uppercase` DIL DUYARLI. Belge lang="tr" iken
// tarayici Turkce kurali uyguluyor ve "i" harfi "İ" oluyor:
//
//   Script  -> SCRİPT        Drive  -> DRİVE        Caption -> CAPTİON
//
// Kural dogru uygulaniyor, kelimeler Ingilizce oldugu icin ekranda
// yazim hatasi gibi duruyor -- proje tablosunun basliginda "SCRİPT",
// hemen yaninda dogru yazilmis "ÇEKİM".
//
// Cozum kelimeyi lang="en" ile ISARETLEMEK. Iki ayri durum var:
//   a) Etiket tek kelime ("Caption")       -> elemanin kendisine lang="en"
//   b) Etiket karisik ("Script bağlantısı") -> SADECE terim <span lang="en">
//      icine aliniyor; elemanin tamamini isaretlemek bu sefer Turkce
//      kelimeyi bozardi (ters tuzak: "ÇEKİM" yerine "ÇEKIM").
//
// Bu test JS'te toLocaleUpperCase CAGIRMIYOR -- o, CSS'in ne yaptigini
// gormez. Her METIN DUGUMUNUN etkin lang'ini ve gercek text-transform
// degerini okuyup tarayicinin uretecegi metni hesapliyor.

const TERIM = /script|drive|caption/i;

(async()=>{
  const b = await chromium.launch();
  const c = await b.newContext({ viewport:{ width:1500, height:900 }, locale:'tr-TR' });
  const p = await c.newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());
  await p.route('**/supabase-js**', r=> r.abort());
  await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);

  // Proje tablosu terimlerin gorundugu yerlerden biri; kurulsun.
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    projects = [{ id:'pr_1', name:'Balıklı Meryem Ana Rum Manastırı', cancelled:false, type:'outdoor' }];
    saveProjects(); setPage('projects');
  });
  await p.waitForTimeout(600);

  ok('belge Turkce', (await p.getAttribute('html','lang')) === 'tr');

  const tara = ()=> p.evaluate(()=>{
    const cikti = [];
    const y = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while((n = y.nextNode())){
      const s = (n.data||'').trim();
      if(!s || !/script|drive|caption/i.test(s)) continue;
      const anne = n.parentElement;
      if(!anne) continue;
      if(getComputedStyle(anne).textTransform !== 'uppercase') continue;
      const kok = anne.closest('[lang]');
      const dil = kok ? kok.getAttribute('lang') : 'tr';
      // Tarayicinin ekrana yazacagi metin.
      cikti.push({ metin: s, dil, ekran: s.toLocaleUpperCase(dil) });
    }
    return cikti;
  });

  const bulgular = await tara();
  ok('buyutulen terim bulundu (test bos degil)', bulgular.length >= 3, bulgular.length);

  const bozuk = bulgular.filter(x=> /İ/.test(x.ekran));
  ok('hicbiri SCRİPT/DRİVE/CAPTİON yazmiyor', bozuk.length === 0,
     bozuk.map(x=> x.metin + '→' + x.ekran).join(' , '));

  for(const kelime of ['SCRIPT','DRIVE','CAPTION']){
    ok(kelime + ' dogru yaziliyor', bulgular.some(x=> x.ekran.includes(kelime)),
       bulgular.map(x=> x.ekran).join(' | '));
  }

  // (b) KARISIK etiket: terim ayri bir <span lang="en"> icinde, geri
  // kalan metin Turkce kaliyor.
  const karisik = await p.evaluate(()=>{
    const el = document.querySelector('label[data-i18n="pe_script_url"]');
    if(!el) return null;
    return {
      tam:  el.textContent,
      ing:  Array.from(el.querySelectorAll('[lang="en"]')).map(s=> s.textContent),
      // Turkce kisim isaretlenmemis olmali.
      etiketDili: el.getAttribute('lang')
    };
  });
  ok('karisik etiket bulundu', !!karisik);
  ok('karisik etiketin METNI bozulmadi', karisik && karisik.tam === 'Script bağlantısı', karisik && karisik.tam);
  ok('karisik etikette yalniz terim isaretli', karisik && karisik.ing.length === 1 && karisik.ing[0] === 'Script',
     karisik && JSON.stringify(karisik.ing));
  ok('karisik etiketin tamami isaretli DEGIL', karisik && !karisik.etiketDili, karisik && karisik.etiketDili);

  // Ters tuzak: Turkce kelimeler Ingilizce isaretlenmis olmasin.
  const tersTuzak = await p.evaluate(()=>{
    const kotu = [];
    document.querySelectorAll('[lang="en"]').forEach(el=>{
      const s = (el.textContent||'').trim();
      // Turkceye ozgu harf tasiyan bir metin Ingilizce isaretlenemez.
      if(/[çğıöşüÇĞİÖŞÜ]/.test(s)) kotu.push(s);
    });
    return kotu;
  });
  ok('Turkce metin Ingilizce isaretlenmemis', tersTuzak.length === 0, tersTuzak.join(' , '));

  // Ingilizce arayuzde hicbir sey degismemeli.
  await p.evaluate(()=> setLanguage('en'));
  await p.waitForTimeout(400);
  const enMetin = await p.evaluate(()=>{
    const el = document.querySelector('label[data-i18n="pe_script_url"]');
    return el ? el.textContent : null;
  });
  ok('Ingilizcede etiket dogru', enMetin === 'Script link', enMetin);

  await b.close();
  console.log('\n=== gecen '+g+' / kalan '+k+' ===');
  process.exit(k?1:0);
})();
