// Proje OLUSTURMA penceresinde de mekan secilebilmeli. Onceden mekan
// yalnizca duzenleme penceresinde vardi: yeni projeyi kurup kapatiyor,
// sonra mekani baglamak icin tekrar aciyordun.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch({ });
  const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e)));
  await p.route('**tile.openstreetmap.org**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  await p.evaluate(() => { try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'networkidle' });
  await p.evaluate(() => {
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    // Adres sorusuna "yine de olustur", termin sorusuna "simdi degil".
    window.onayla = (g)=>{
      const y = typeof g === 'string' ? g : ((g && g.govde) || '');
      return Promise.resolve(!/teslim tarihi/i.test(y));
    };
    mekanlar = [
      mekanTemizle({ id:'m_kariye', name:'Kariye Müzesi', city:'İstanbul', district:'Fatih',
                     address:'Dervişali, Kariye Cami Sk. No:8', cautions:'İçeride tripod yasak' }),
      mekanTemizle({ id:'m_ev', name:'Ev stüdyosu', city:'İstanbul' })
    ];
    saveMekanlar(); projects = []; saveProjects(); setPage('projects');
  });

  console.log('[pencere]');
  await p.click('#p_openNew');
  await p.waitForSelector('#projectNewOverlay.open');
  bak('mekan secimi olusturma penceresinde var', await p.$('#p_place') !== null);
  const secenek = await p.$$eval('#p_place option', e => e.map(x=> x.value));
  bak('mekanlar listeleniyor', secenek.indexOf('m_kariye') !== -1 && secenek.indexOf('m_ev') !== -1, secenek.join(','));
  bak('bos secenek basta', secenek[0] === '', secenek[0]);
  bak('"yeni mekan" secenegi var', secenek[secenek.length-1] === '__yeni__');
  bak('baslangicta hicbiri secili degil', await p.$eval('#p_place', e=> e.value) === '');

  console.log('[secim]');
  await p.selectOption('#p_place', 'm_kariye');
  await p.waitForTimeout(150);
  const bilgi = await p.$eval('#p_placeBilgi', e=> e.textContent);
  bak('secilince adres gorunuyor', /Kariye Cami Sk/.test(bilgi), bilgi);
  bak('dikkat notu da gorunuyor', /tripod/.test(bilgi));
  bak('dikkat varsa satir renkleniyor',
      await p.$eval('#p_placeBilgi', e=> e.className.indexOf('mk-uyari') !== -1));
  await p.selectOption('#p_place', 'm_ev');
  await p.waitForTimeout(150);
  bak('notsuz mekanda uyari rengi kalkiyor',
      await p.$eval('#p_placeBilgi', e=> e.className.indexOf('mk-uyari') === -1));

  console.log('[olusturma]');
  await p.selectOption('#p_place', 'm_kariye');
  await p.fill('#p_name', 'Kariye — bölüm 1');
  await p.click('#p_add');
  await p.waitForTimeout(400);
  const proje = await p.evaluate(()=> projects.map(x=>({ ad:x.name, yer:x.placeId })));
  bak('proje olustu', proje.length === 1, JSON.stringify(proje));
  bak('MEKAN BAGI KAYDEDILDI', proje[0] && proje[0].yer === 'm_kariye', JSON.stringify(proje[0]));
  bak('mekan kac projede kullanildigini biliyor',
      await p.evaluate(()=> mekanProjeleri('m_kariye').length) === 1);
  bak('buluta giden satirda da var',
      await p.evaluate(()=> projToRow(projects[0], 'u1').place_id) === 'm_kariye');

  console.log('[pencere yeniden acilinca]');
  await p.click('#p_openNew');
  await p.waitForSelector('#projectNewOverlay.open');
  bak('secim sifirlandi', await p.$eval('#p_place', e=> e.value) === '', await p.$eval('#p_place', e=> e.value));
  bak('bilgi satiri ipucuna dondu',
      /mekan|Mekan/.test(await p.$eval('#p_placeBilgi', e=> e.textContent)));

  console.log('[pencereden yeni mekan]');
  // Onceden yalnizca ad soruluyordu (sor); mekan adressiz doguyor, proje
  // adressiz kaliyor ve hemen "adres girmedin" sorusu geliyordu. Artik
  // tam mekan penceresi aciliyor.
  await p.selectOption('#p_place', 'm_kariye');
  await p.waitForTimeout(120);
  await p.selectOption('#p_place', '__yeni__');
  await p.waitForSelector('#placeOverlay.open');
  bak('"+ Yeni mekan" tam mekan penceresini aciyor', true);
  bak('liste "+ Yeni mekan"da kalmiyor, eski secim duruyor',
      await p.$eval('#p_place', e=> e.value) === 'm_kariye', await p.$eval('#p_place', e=> e.value));
  bak('proje penceresi altta acik kaliyor',
      await p.$eval('#projectNewOverlay', e=> e.classList.contains('open')));
  bak('pencere "yeni mekan" basligiyla ve bos aciliyor',
      await p.$eval('#mk_name', e=> e.value) === '' && await p.$eval('#mk_delete', e=> e.hidden));
  await p.fill('#mk_name', 'Sultanahmet Meydanı');
  await p.fill('#mk_address', 'Sultanahmet, Fatih');
  await p.click('#mk_save');
  await p.waitForFunction(()=> !document.getElementById('placeOverlay').classList.contains('open'));
  const yeni = await p.evaluate(()=>({
    secili: document.getElementById('p_place').value,
    kayit: mekanlar.find(m=> m.name === 'Sultanahmet Meydanı') || null,
    adet: mekanlar.length
  }));
  bak('pencereden mekan eklenebiliyor', !!yeni.kayit && yeni.adet === 3, JSON.stringify(yeni));
  bak('adres de kaydediliyor', !!yeni.kayit && yeni.kayit.address === 'Sultanahmet, Fatih');
  bak('yeni mekan hemen secili geliyor', !!yeni.kayit && yeni.secili === yeni.kayit.id, yeni.secili);
  bak('bilgi satirinda yeni mekanin adresi',
      /Sultanahmet, Fatih/.test(await p.$eval('#p_placeBilgi', e=> e.textContent)));
  bak('proje penceresi hala acik',
      await p.$eval('#projectNewOverlay', e=> e.classList.contains('open')));

  console.log('[vazgecince]');
  await p.selectOption('#p_place', 'm_ev');
  await p.waitForTimeout(120);
  await p.selectOption('#p_place', '__yeni__');
  await p.waitForSelector('#placeOverlay.open');
  await p.click('#mk_cancel');
  await p.waitForFunction(()=> !document.getElementById('placeOverlay').classList.contains('open'));
  bak('vazgecilince eski secim geri geliyor',
      await p.$eval('#p_place', e=> e.value) === 'm_ev', await p.$eval('#p_place', e=> e.value));
  bak('vazgecilince mekan eklenmedi', await p.evaluate(()=> mekanlar.length) === 3);
  // Vazgecilen pencerenin geri cagrisi temizlenmis olmali: Mekanlar
  // sayfasindan sonradan eklenen mekan proje formuna sicramasin.
  await p.evaluate(()=>{ mekanPenceresiniAc(null); });
  await p.fill('#mk_name', 'Alakasız mekan');
  await p.click('#mk_save');
  await p.waitForFunction(()=> !document.getElementById('placeOverlay').classList.contains('open'));
  bak('sonradan eklenen mekan forma sicramiyor',
      await p.$eval('#p_place', e=> e.value) === 'm_ev', await p.$eval('#p_place', e=> e.value));

  console.log('[duzenleme penceresi bozulmadi]');
  await p.click('#p_newCancel');
  await p.waitForTimeout(150);
  await p.evaluate(()=>{ openProjectEdit(projects[0].id); });
  await p.waitForSelector('#projectEditOverlay.open');
  bak('duzenlemede mekan hala secili', await p.$eval('#pe_place', e=> e.value) === 'm_kariye');
  bak('duzenlemede bilgi satiri dolu',
      /Kariye Cami Sk/.test(await p.$eval('#pe_placeBilgi', e=> e.textContent)));

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
