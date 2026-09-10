// Mekan penceresinde "Bul": ad + sehir OpenStreetMap'te (Nominatim) aranir,
// secilen sonuc adres/ilce/il/ulke/koordinat/harita baglantisini doldurur.
// Yazdikca istek YOK (Nominatim kurali). Koordinat mekanda saklaniyor;
// kart ve hava blogu onu kullaniyor. Turkiye il/ilce listesi datalist'te.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const SONUC = [
  { place_id: 1, osm_type: 'way', osm_id: 123456, lat: '41.0102', lon: '28.9704', name: 'Nuruosmaniye Hanı',
    display_name: 'Nuruosmaniye Hanı, Nuruosmaniye Caddesi, Molla Fenari Mahallesi, Fatih, İstanbul, 34120, Türkiye',
    category: 'historic', type: 'caravanserai',
    address: { historic: 'Nuruosmaniye Hanı', road: 'Nuruosmaniye Caddesi', house_number: '12',
               neighbourhood: 'Molla Fenari Mahallesi', county: 'Fatih', province: 'İstanbul',
               postcode: '34120', country: 'Türkiye', country_code: 'tr' } },
  { place_id: 2, osm_type: 'node', osm_id: 77, lat: '41.0089', lon: '28.9700', name: 'Nuruosmaniye Camii',
    display_name: 'Nuruosmaniye Camii, Fatih, İstanbul, Türkiye', category: 'amenity', type: 'place_of_worship',
    address: { road: 'Vezirhan Caddesi', suburb: 'Çemberlitaş', county: 'Fatih', province: 'İstanbul',
               country: 'Türkiye', country_code: 'tr' } }
];

(async () => {
  const t = await chromium.launch({ });
  const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e)));
  await p.route('**tile.openstreetmap.org**', r=> r.abort());
  // Nominatim sahte: mod'a gore dolu, bos ya da hata.
  let mod = 'ok'; const istekler = [];
  await p.route('**nominatim.openstreetmap.org/**', r=>{
    istekler.push(r.request().url());
    if(mod === 'error') return r.fulfill({ status: 500, contentType: 'text/plain', body: 'kapali' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mod === 'empty' ? [] : SONUC) });
  });
  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  await p.evaluate(() => { try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'networkidle' });
  await p.evaluate(() => {
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    mekanlar = []; saveMekanlar(); projects = []; saveProjects(); setPage('places');
  });

  console.log('[il/ilce listesi]');
  await p.click('#mk_new');
  await p.waitForSelector('#placeOverlay.open');
  await p.waitForFunction(()=> document.querySelectorAll('#mk_ilListe option').length > 0, null, { timeout: 5000 }).catch(()=>{});
  bak('81 il listede', await p.$$eval('#mk_ilListe option', e=> e.length) === 81, String(await p.$$eval('#mk_ilListe option', e=> e.length)));
  await p.fill('#mk_city', 'İstanbul');
  await p.waitForTimeout(100);
  const ilceler = await p.$$eval('#mk_ilceListe option', e=> e.map(x=> x.value));
  bak('Istanbul yazinca 39 ilce', ilceler.length === 39, String(ilceler.length));
  bak('Fatih ve Kadıköy listede', ilceler.indexOf('Fatih') !== -1 && ilceler.indexOf('Kadıköy') !== -1);
  await p.fill('#mk_city', 'istanbul');
  await p.waitForTimeout(100);
  bak('kucuk harfle de eslesiyor (Turkce)', await p.$$eval('#mk_ilceListe option', e=> e.length) === 39);
  await p.fill('#mk_city', 'Berlin');
  await p.waitForTimeout(100);
  bak('yabanci sehirde ilce listesi bos, alan serbest', await p.$$eval('#mk_ilceListe option', e=> e.length) === 0);
  bak('harita kontrolu koordinatsizken gizli', await p.$eval('#mk_haritaKontrol', e=> e.hidden));

  console.log('[arama]');
  await p.fill('#mk_city', 'İstanbul');
  await p.fill('#mk_name', 'Nuruosmaniye Han');
  await p.waitForTimeout(250);
  bak('yazarken istek gitmiyor', istekler.length === 0, String(istekler.length));
  await p.press('#mk_name', 'Enter');
  await p.waitForFunction(()=> !document.getElementById('mk_bulListe').hidden, null, { timeout: 5000 });
  bak('Enter tek istek gonderiyor', istekler.length === 1, String(istekler.length));
  const url = decodeURIComponent(istekler[0] || '');
  bak('sorgu ad + sehir', /q=Nuruosmaniye Han, İstanbul/.test(url), url);
  bak('jsonv2 ve adres ayrintisi isteniyor', /format=jsonv2/.test(url) && /addressdetails=1/.test(url));
  const sonucSayisi = await p.$$eval('#mk_bulListe [data-mk-sonuc]', e=> e.length);
  bak('iki sonuc listeleniyor', sonucSayisi === 2, String(sonucSayisi));
  bak('kaynak yaziyor (OpenStreetMap)', /OpenStreetMap/.test(await p.$eval('#mk_bulListe', e=> e.textContent)));
  const ilkSatir = await p.$eval('#mk_bulListe [data-mk-sonuc="0"]', e=> e.textContent);
  bak('satirda ad, ilce ve il var', /Nuruosmaniye Hanı/.test(ilkSatir) && /Fatih/.test(ilkSatir) && /İstanbul/.test(ilkSatir), ilkSatir);
  bak('not "dogru olani sec"', await p.evaluate(()=> document.getElementById('mk_bulNot').textContent === t('mk_find_pick')));

  console.log('[secim]');
  await p.click('#mk_bulListe [data-mk-sonuc="0"]');
  await p.waitForTimeout(200);
  const alan = await p.evaluate(()=>{
    const al = k=> document.getElementById(k).value;
    return { ad: al('mk_name'), il: al('mk_city'), ilce: al('mk_district'), adres: al('mk_address'),
             harita: al('mk_maps'), lat: al('mk_lat'), lon: al('mk_lon'), ulke: al('mk_country'),
             kaynak: al('mk_source'), kimlik: al('mk_externalId'),
             listeGizli: document.getElementById('mk_bulListe').hidden,
             not: document.getElementById('mk_bulNot').textContent,
             kontrolGizli: document.getElementById('mk_haritaKontrol').hidden,
             karo: Array.from(document.querySelectorAll('#mk_haritaKaro img')).map(i=> i.getAttribute('src')),
             kontrolNot: document.getElementById('mk_haritaNot').textContent };
  });
  bak('kullanicinin yazdigi ad duruyor', alan.ad === 'Nuruosmaniye Han', alan.ad);
  bak('il ve ilce doldu', alan.il === 'İstanbul' && alan.ilce === 'Fatih', alan.il + ' / ' + alan.ilce);
  bak('adres yol + no + mahalle + posta kodu', alan.adres === 'Nuruosmaniye Caddesi 12, Molla Fenari Mahallesi, 34120', alan.adres);
  bak('koordinat gizli alanlarda', alan.lat === '41.0102' && alan.lon === '28.9704', alan.lat + ',' + alan.lon);
  bak('harita baglantisi koordinattan uretildi', alan.harita === 'https://www.google.com/maps/search/?api=1&query=41.0102,28.9704', alan.harita);
  bak('ulke, kaynak ve OSM kimligi', alan.ulke === 'Türkiye' && alan.kaynak === 'osm' && alan.kimlik === 'W123456', JSON.stringify([alan.ulke, alan.kaynak, alan.kimlik]));
  bak('liste kapandi, not "dolduruldu"', alan.listeGizli && alan.not === await p.evaluate(()=> t('mk_find_done')), alan.not);
  bak('"burasi mi?" karosu acik, dort karo', !alan.kontrolGizli && alan.karo.length === 4 && alan.karo.every(u=> /tile\.openstreetmap\.org\/15\//.test(u)), JSON.stringify(alan.karo));
  bak('kontrol notunda koordinat', /41\.01020, 28\.97040/.test(alan.kontrolNot), alan.kontrolNot);
  bak('ilce listesi Istanbul ilcelerine indi', await p.$$eval('#mk_ilceListe option', e=> e.length) === 39);

  console.log('[kaydet]');
  await p.click('#mk_save');
  await p.waitForFunction(()=> !document.getElementById('placeOverlay').classList.contains('open'));
  const m = await p.evaluate(()=> mekanlar[0] ? JSON.parse(JSON.stringify(mekanlar[0])) : null);
  bak('mekan kaydedildi', !!m && m.name === 'Nuruosmaniye Han');
  bak('koordinat sayi olarak duruyor', !!m && m.lat === 41.0102 && m.lon === 28.9704, m && (m.lat + ',' + m.lon));
  bak('ulke, kaynak, kimlik durdu', !!m && m.country === 'Türkiye' && m.source === 'osm' && m.externalId === 'W123456');
  const satir = await p.evaluate(()=> mekanRowYap(mekanlar[0], 'u1'));
  bak('buluta giden satirda lat/lon/external_id', satir.lat === 41.0102 && satir.lon === 28.9704 && satir.external_id === 'W123456' && satir.country === 'Türkiye', JSON.stringify(satir));
  const eksikSutun = await p.evaluate(()=>{ mekanKonumSutunlari = false; const r = mekanRowYap(mekanlar[0], 'u1'); mekanKonumSutunlari = true; return r; });
  bak('sql/33 yokken koordinat sutunlari satira girmiyor', !('lat' in eksikSutun) && !('external_id' in eksikSutun) && 'name' in eksikSutun, Object.keys(eksikSutun).join(','));
  const geri = await p.evaluate(()=> mekanRowOku({ id:'m_b', name:'Bulut', lat: 40.5, lon: 29.5, country:'Türkiye', source:'osm', external_id:'N1', created_at:'2026-09-01T00:00:00Z' }));
  bak('buluttan gelen satir koordinati tasiyor', geri.lat === 40.5 && geri.lon === 29.5 && geri.externalId === 'N1', JSON.stringify(geri));
  bak('depoda da koordinat var', await p.evaluate(()=> (JSON.parse(localStorage.getItem('demo_places')||'[]')[0]||{}).lat === 41.0102));

  console.log('[kart ve hava koordinati]');
  const kart = await p.evaluate(()=>{
    const koord = mekanTemizle({ id:'m_k', name:'Koordinatlı yer', lat: 41.0311, lon: 28.9391 });
    const link  = mekanTemizle({ id:'m_l', name:'Bağlantılı yer', lat: 10, lon: 10, mapsUrl: 'https://www.google.com/maps/@41.0311,28.9391,17z' });
    const bos   = mekanTemizle({ id:'m_x', name:'Boş yer', city:'İstanbul' });
    return { koord: mekanGorseli(koord), konumLink: mekanKonumu(link), konumBos: mekanKonumu(bos),
             kotu: mekanTemizle({ name:'x', lat:'abc', lon: 999 }) };
  });
  bak('yalniz koordinati olan mekanin karti harita karosu', /tile\.openstreetmap\.org\/15\/19018\/12281\.png/.test(kart.koord), kart.koord.slice(0, 120));
  bak('harita baglantisi kaydedilen koordinati eziyor', kart.konumLink && kart.konumLink.kaynak === 'harita' && Math.abs(kart.konumLink.en - 41.0311) < 1e-6, JSON.stringify(kart.konumLink));
  bak('koordinatsiz mekanda konum yok', kart.konumBos === null);
  bak('gecersiz koordinat null oluyor', kart.kotu.lat === null && kart.kotu.lon === null, JSON.stringify([kart.kotu.lat, kart.kotu.lon]));

  console.log('[duzenleme penceresi]');
  await p.evaluate(()=> mekanPenceresiniAc(mekanlar[0].id));
  await p.waitForSelector('#placeOverlay.open');
  await p.waitForTimeout(150);
  bak('acilinca koordinat gizli alanda', await p.$eval('#mk_lat', e=> e.value) === '41.0102');
  bak('acilinca "burasi mi?" karosu gorunuyor', !(await p.$eval('#mk_haritaKontrol', e=> e.hidden)));
  bak('onceki arama listesi temiz', await p.$eval('#mk_bulListe', e=> e.hidden && e.innerHTML === ''));
  await p.click('#mk_cancel');

  console.log('[bulunamadi ve hata]');
  await p.click('#mk_new');
  await p.waitForSelector('#placeOverlay.open');
  mod = 'empty';
  await p.fill('#mk_name', 'Olmayan Yer');
  await p.click('#mk_bul');
  await p.waitForFunction(()=> document.getElementById('mk_bulNot').textContent === t('mk_find_none'), null, { timeout: 5000 });
  bak('bos sonucta "bulunamadi, elle yaz"', true);
  bak('alanlar dokunulmadan duruyor', await p.$eval('#mk_address', e=> e.value) === '');
  bak('dugme yeniden basilabilir', !(await p.$eval('#mk_bul', e=> e.disabled)));
  mod = 'error';
  await p.click('#mk_bul');
  await p.waitForFunction(()=> document.getElementById('mk_bulNot').textContent === t('mk_find_error'), null, { timeout: 5000 });
  bak('servis hatasinda "yanit vermedi"', true);
  bak('bos adla arama istek gondermiyor', await p.evaluate(async ()=>{ document.getElementById('mk_name').value=''; document.getElementById('mk_city').value=''; const n = 0; await mekanAra(); return true; }) && istekler.length === 3, String(istekler.length));

  console.log('[elle yapistirilan harita baglantisi]');
  await p.fill('#mk_maps', 'https://www.google.com/maps/place/Kariye/@41.0311,28.9391,17z/data=!4m5');
  await p.waitForTimeout(150);
  bak('baglanti yapistirinca karo aciliyor', !(await p.$eval('#mk_haritaKontrol', e=> e.hidden)));
  bak('karo baglantidaki koordinata bakiyor', /41\.03110, 28\.93910/.test(await p.$eval('#mk_haritaNot', e=> e.textContent)));
  await p.click('#mk_cancel');

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
