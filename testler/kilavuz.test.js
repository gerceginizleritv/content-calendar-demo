// Kullanim kilavuzu: iki dil, iki ayri sayfa (arama motoru icin ayri URL).
// Tur "nasil calisir"i gosteriyor, kilavuz NEDEN oyle calistigini ve her
// modulun ne ise yaradigini anlatiyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

async function say(p, s){ return p.$$eval(s, e=> e.length).catch(()=> 0); }

(async () => {
  const t = await chromium.launch();
  const veri = {};

  for(const [dil, dosya] of [['tr','kilavuz.html'], ['en','guide.html']]){
    console.log('[' + dosya + ']');
    const p = await (await t.newContext({ viewport:{width:1280,height:900} })).newPage();
    const hata = []; p.on('pageerror', e=> hata.push(String(e)));
    const yanit = await p.goto(KOK + '/' + dosya, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(700);
    bak('sayfa aciliyor', yanit.status() === 200, String(yanit.status()));
    bak('js hatasi yok', hata.length === 0, hata.join(' | '));
    bak('sayfa dili ' + dil, await p.$eval('html', e=> e.lang) === dil,
        await p.$eval('html', e=> e.lang));

    const bilgi = await p.evaluate(()=>({
      baslik: document.title,
      aciklama: (document.querySelector('meta[name="description"]')||{}).content || '',
      kanonik: (document.querySelector('link[rel="canonical"]')||{}).href || '',
      alternatif: [...document.querySelectorAll('link[rel="alternate"]')].map(x=> x.hreflang + '=' + x.getAttribute('href')),
      og: !!document.querySelector('meta[property="og:title"]'),
      bolumler: [...document.querySelectorAll('.bolum')].map(x=> x.id),
      menu: [...document.querySelectorAll('#yanMenu a')].map(x=> x.getAttribute('href')),
      mob: document.querySelectorAll('#mobMenu a').length,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(x=> x.textContent)
    }));
    veri[dil] = bilgi;

    bak('baslik dolu ve uzun', bilgi.baslik.length > 30, bilgi.baslik);
    bak('meta aciklama var', bilgi.aciklama.length > 80, String(bilgi.aciklama.length));
    bak('canonical var', /shootboard\.app\//.test(bilgi.kanonik), bilgi.kanonik);
    bak('hreflang tr+en+x-default', bilgi.alternatif.length === 3, bilgi.alternatif.join(' '));
    bak('og etiketleri var', bilgi.og === true);
    bak('on bes bolum', bilgi.bolumler.length === 15, String(bilgi.bolumler.length));
    bak('sol menu on bes bagli', bilgi.menu.length === 15, String(bilgi.menu.length));
    bak('mobil serit menuden uretildi', bilgi.mob === 15, String(bilgi.mob));
    // Menudeki her baglantinin karsiligi olmali: kirik ic baglanti kalmasin.
    const eksik = bilgi.menu.filter(h=> bilgi.bolumler.indexOf(h.slice(1)) === -1);
    bak('menudeki baglantilarin hepsi bir bolume gidiyor', eksik.length === 0, eksik.join(','));

    let sss = false, makale = false;
    bilgi.ld.forEach(m=>{
      const j = JSON.parse(m);
      (j['@graph'] || [j]).forEach(x=>{
        if(x['@type'] === 'FAQPage') sss = (x.mainEntity || []).length >= 4;
        if(x['@type'] === 'TechArticle') makale = !!x.headline;
      });
    });
    bak('JSON-LD: makale', makale);
    bak('JSON-LD: en az dort SSS', sss);

    // Canlandirmalar EKRANA GIRINCE basliyor: hepsi birden oynamasin.
    const oynayan = await p.evaluate(()=> document.querySelectorAll('[data-canlandir].gorunur').length);
    const toplam = await say(p, '[data-canlandir]');
    bak('canlandirmalar var', toplam >= 4, String(toplam));
    bak('hepsi birden oynamiyor', oynayan < toplam, oynayan + '/' + toplam);
    // Bolumun kendisi degil, GOSTERIM ekrana getiriliyor: baslik ustte
    // dursa da gosterim asagida kalabiliyor.
    await p.evaluate(()=>{
      const e = document.querySelector('#ai [data-canlandir]');
      if(e) e.scrollIntoView({ block:'center' });
    });
    await p.waitForTimeout(800);
    bak('gorunen bolumun canlandirmasi basliyor',
        (await p.evaluate(()=> document.querySelectorAll('[data-canlandir].gorunur').length)) > 0);

    // Sol menu okudugun bolumu isaretliyor.
    bak('sol menu okunan bolumu isaretliyor',
        (await p.evaluate(()=> !!document.querySelector('#yanMenu a.acik'))) === true);
    await p.close();
  }

  console.log('[iki dil ayni yapida]');
  bak('bolum kimlikleri birebir ayni',
      veri.tr.bolumler.join(',') === veri.en.bolumler.join(','),
      veri.tr.bolumler.join(',') + ' vs ' + veri.en.bolumler.join(','));
  bak('basliklar farkli (ceviri var)', veri.tr.baslik !== veri.en.baslik);
  bak('tr sayfasi en sayfasini gosteriyor',
      veri.tr.alternatif.some(x=> /^en=.*guide\.html$/.test(x)), veri.tr.alternatif.join(' '));
  bak('en sayfasi tr sayfasini gosteriyor',
      veri.en.alternatif.some(x=> /^tr=.*kilavuz\.html$/.test(x)), veri.en.alternatif.join(' '));

  console.log('[telefonda]');
  {
    const p = await (await t.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true })).newPage();
    await p.goto(KOK + '/kilavuz.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(600);
    bak('sayfa yana kaymiyor',
        (await p.evaluate(()=> document.documentElement.scrollWidth - window.innerWidth)) <= 0);
    bak('sol menu gizli, serit menu gorunur',
        (await p.evaluate(()=> getComputedStyle(document.querySelector('.yan')).display)) === 'none'
        && (await p.evaluate(()=> getComputedStyle(document.querySelector('.mob-menu')).display)) !== 'none');
    await p.close();
  }

  console.log('[uygulamadan baglanti]');
  {
    const p = await (await t.newContext({ viewport:{width:1280,height:900} })).newPage();
    await p.route('**accounts.google.com**', r=> r.abort());
    await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1600);
    await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
    bak('sol menude kilavuz baglantisi var', await p.$('#kilavuzLink') !== null);
    await p.evaluate(()=> setLanguage('tr'));
    await p.waitForTimeout(200);
    bak('turkcede kilavuz.html', /kilavuz\.html$/.test(await p.$eval('#kilavuzLink', e=> e.getAttribute('href'))),
        await p.$eval('#kilavuzLink', e=> e.getAttribute('href')));
    await p.evaluate(()=> setLanguage('en'));
    await p.waitForTimeout(200);
    bak('ingilizcede guide.html', /guide\.html$/.test(await p.$eval('#kilavuzLink', e=> e.getAttribute('href'))),
        await p.$eval('#kilavuzLink', e=> e.getAttribute('href')));

    await p.goto(KOK + '/index.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(900);
    bak('karsilama sayfasinin dibinde de var', await p.$('#dipKilavuz') !== null);
    await p.close();
  }

  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
