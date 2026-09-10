// Mekanlar: cekim yerleri kutuphanesi. Eski lokasyon takibinde projeler
// mekanlarin altinda duruyordu; tasima sirasinda mekan diye bir kayit
// kalmamis, adres her projenin icine ayri yazilmisti.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch({ });
  const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e)));
  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  await p.evaluate(() => { try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'networkidle' });
  await p.evaluate(() => document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')));

  console.log('[sayfa]');
  bak('sol menude Mekanlar sekmesi var', await p.$('#tabPlaces') !== null);
  const sira = await p.$$eval('.rail-nav .tab', e => e.map(x=>x.id));
  bak('Fikirler en ustte', sira[0] === 'tabIdeas', sira.join(' > '));
  await p.click('#tabPlaces');
  bak('sayfa aciliyor', !(await p.$eval('#placesPage', e => e.hidden)));
  bak('bos halde ne yapilacagi yaziyor',
      /mekan|place/i.test(await p.$eval('#mk_list', e => e.textContent)));

  console.log('[mekan ekleme]');
  await p.click('#mk_new');
  await p.waitForSelector('#placeOverlay.open');
  bak('adsiz kaydetmiyor', await p.evaluate(async () => {
    document.getElementById('mk_save').click();
    await new Promise(r=>setTimeout(r,150));
    return document.getElementById('placeOverlay').classList.contains('open') && mekanlar.length === 0;
  }));
  await p.fill('#mk_name', 'Kariye Müzesi');
  await p.fill('#mk_city', 'İstanbul');
  await p.fill('#mk_district', 'Fatih');
  await p.fill('#mk_address', 'Dervişali, Kariye Cami Sk. No:8');
  await p.fill('#mk_permission', 'Müzeler Müdürlüğü, 2 hafta önceden');
  await p.fill('#mk_cautions', 'İçeride tripod yasak');
  await p.fill('#mk_maps', 'https://maps.google.com/?q=kariye');
  await p.click('#mk_save');
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => mekanlar[0]);
  bak('mekan kaydedildi', m && m.name === 'Kariye Müzesi', JSON.stringify(m||{}).slice(0,60));
  bak('bütün alanlar durdu', m.city === 'İstanbul' && m.district === 'Fatih' && !!m.address && !!m.permission && !!m.cautions);
  bak('pencere kapandı', !(await p.$('#placeOverlay.open')));
  // Ad ekranda arayüz diline göre çevriliyor ("Müzesi" -> "Museum");
  // veride Türkçe duruyor. Testin derdi adın kartta görünmesi.
  bak('kartta ad görünüyor',
      /Kariye (Müzesi|Museum)/.test(await p.$eval('#mk_list', e => e.textContent)));
  bak('"dikkat" rozeti var', await p.$('.mk-dikkat') !== null);
  bak('harita bağlantısı var', await p.$('a.mk-rozet') !== null);
  bak('tarayıcıya yazıldı', await p.evaluate(() => JSON.parse(localStorage.getItem('demo_places')||'[]').length) === 1);

  console.log('[aynı ad ve arama]');
  await p.evaluate(() => { window.uyari = ()=>Promise.resolve(); mekanEkle({ name: 'kariye müzesi' }); });
  bak('aynı ad ikinci kez eklenmiyor', (await p.evaluate(() => mekanlar.length)) === 1);
  await p.evaluate(() => { mekanEkle({ name: 'Balat Sokakları', city: 'İstanbul' }); renderMekanlar(); });
  await p.fill('#mk_search', 'balat');
  bak('arama süzüyor', (await p.$$eval('[data-mk]', e => e.length)) === 1);
  await p.fill('#mk_search', 'fatih');
  bak('ilçeye göre de buluyor', (await p.$$eval('[data-mk]', e => e.length)) === 1);
  await p.fill('#mk_search', '');

  console.log('[projeye bağlama]');
  const pid = await p.evaluate(() => projeEkle('Kariye Belgeseli','','','field','').id);
  await p.evaluate((id) => { setPage('projects'); openProjectEdit(id); }, pid);
  await p.waitForSelector('#projectEditOverlay.open');
  bak('proje penceresinde mekan seçimi var', await p.$('#pe_place') !== null);
  const secenek = await p.$$eval('#pe_place option', e => e.map(x=>x.textContent));
  bak('mekanlar seçenekte', secenek.some(x=> /Kariye (Müzesi|Museum)/.test(x)), secenek.join(' | '));
  bak('şehir/ilçe seçenekte de yazıyor', secenek.some(x=>x.includes('Fatih')));
  const mid = await p.evaluate(() => mekanlar.find(x=>x.name==='Kariye Müzesi').id);
  await p.selectOption('#pe_place', mid);
  const bilgi = await p.$eval('#pe_placeBilgi', e => ({ y: e.textContent, s: e.className }));
  bak('seçilince adres ve uyarı görünüyor', bilgi.y.includes('Dervişali') && bilgi.y.includes('tripod'), bilgi.y);
  bak('uyarı varsa satır renkleniyor', bilgi.s.includes('mk-uyari'));
  await p.click('#pe_save');
  await p.waitForTimeout(300);
  bak('bağ kaydedildi', (await p.evaluate((id) => projectById(id).placeId, pid)) === mid);
  bak('mekan kaç projede kullanıldığını biliyor', (await p.evaluate((id) => mekanProjeleri(id).length, mid)) === 1);

  console.log('[silme]');
  await p.click('#tabPlaces');
  await p.evaluate((id) => mekanPenceresiniAc(id), mid);
  await p.waitForSelector('#placeOverlay.open');
  bak('bağlı proje sayısı pencerede yazıyor', /1/.test(await p.$eval('#mk_bagli', e => e.textContent)));
  await p.evaluate(() => { window.onayla = ()=>Promise.resolve(true); });
  await p.click('#mk_delete');
  await p.waitForTimeout(300);
  bak('mekan silindi', (await p.evaluate(() => mekanlar.length)) === 1);
  bak('PROJE silinmedi', (await p.evaluate(() => projects.length)) === 1);
  bak('projenin bağı koptu, adresi durdu',
      (await p.evaluate((id) => projectById(id).placeId, pid)) === '');

  bak('sayfa hatası yok', hata.length === 0, hata[0]);
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
