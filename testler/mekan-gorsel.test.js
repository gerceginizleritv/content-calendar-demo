// Mekan kartinin ust seridi: fotograf > harita karesi > bas harfler.
// Serit hicbir zaman bos kalmamali; sayfa duz bir kutu listesi gibi
// gorunuyordu, sikayet buydu.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch({ });
  const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e)));
  // Karo istekleri disariya cikmasin: testte ag yok.
  await p.route('**tile.openstreetmap.org**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  await p.evaluate(() => { try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'networkidle' });
  await p.evaluate(() => document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')));

  console.log('[koordinat okuma]');
  const konum = await p.evaluate(()=>({
    at:    mekanKonum('https://www.google.com/maps/place/Kariye/@41.0311,28.9391,17z/data=!4m5'),
    d3d4:  mekanKonum('https://www.google.com/maps/place/X/data=!3m1!4b1!3d41.0311!4d28.9391'),
    q:     mekanKonum('https://maps.google.com/?q=41.0311,28.9391'),
    query: mekanKonum('https://www.google.com/maps/search/?api=1&query=41.0311, 28.9391'),
    kisa:  mekanKonum('https://maps.app.goo.gl/abcdEFGH'),
    bos:   mekanKonum(''),
    sacma: mekanKonum('https://ornek.com/@999.9,999.9')
  }));
  bak('"@enlem,boylam" okunuyor', konum.at && Math.abs(konum.at.en - 41.0311) < 1e-6, JSON.stringify(konum.at));
  bak('"!3d..!4d.." okunuyor', konum.d3d4 && Math.abs(konum.d3d4.boy - 28.9391) < 1e-6, JSON.stringify(konum.d3d4));
  bak('"?q=" okunuyor', !!konum.q, JSON.stringify(konum.q));
  bak('"query=" okunuyor (bosluklu)', !!konum.query, JSON.stringify(konum.query));
  bak('kisa baglantidan koordinat CIKMIYOR', konum.kisa === null);
  bak('bos baglanti sorun degil', konum.bos === null);
  bak('gecersiz koordinat reddediliyor', konum.sacma === null, JSON.stringify(konum.sacma));

  console.log('[karo hesabi]');
  // z=15'te 41.0311,28.9391 -> karo 19018/12281, karo ici 26,211.
  // Degerler Web Mercator formulunden ayrica hesaplandi. Nokta karonun
  // SOL yarisinda (26 < 128), o yuzden blok soldaki karodan basliyor.
  const kare = await p.evaluate(()=> haritaKaresi(41.0311, 28.9391));
  const adresler = kare.karolar.map(c=> c.url.replace('https://tile.openstreetmap.org/',''));
  bak('dort karo isteniyor', kare.karolar.length === 4, String(kare.karolar.length));
  bak('karo adresleri dogru',
      adresler.join(' ') === '15/19017/12281.png 15/19018/12281.png 15/19017/12282.png 15/19018/12282.png',
      adresler.join(' '));
  bak('karolar blokta yerine oturuyor',
      kare.karolar.map(c=> c.x+','+c.y).join(' ') === '0,0 256,0 0,256 256,256');
  bak('noktanin blok icindeki yeri dogru', kare.nx === 282 && kare.ny === 211, kare.nx+','+kare.ny);
  // Nokta karonun SAG yarisindaysa blok kendi karosundan basliyor.
  const sag = await p.evaluate(()=> haritaKaresi(41.0311, 28.9435));
  bak('sag yarida blok kaymiyor', sag.nx < 256, String(sag.nx));

  console.log('[kartlar]');
  await p.evaluate(()=>{
    mekanlar = [
      mekanTemizle({ id:'m_foto', name:'Fotoğraflı yer', city:'İstanbul',
                     imageUrl:'https://ornek.com/foto.jpg' }),
      mekanTemizle({ id:'m_harita', name:'Haritalı yer', city:'İstanbul',
                     mapsUrl:'https://www.google.com/maps/place/K/@41.0311,28.9391,17z' }),
      mekanTemizle({ id:'m_harf', name:'Çıplak Yer', city:'İzmir' }),
      mekanTemizle({ id:'m_kotu', name:'Kötü bağlantı', city:'Ankara',
                     imageUrl:'javascript:alert(1)', mapsUrl:'javascript:alert(2)' })
    ];
    saveMekanlar(); setPage('places'); renderMekanlar();
  });
  await p.waitForTimeout(200);

  const kart = sel => p.$eval('[data-mk="'+sel+'"]', e => e.innerHTML);
  const foto = await kart('m_foto');
  bak('fotograflı mekanda fotograf var', /class="mk-foto"/.test(foto) && /ornek\.com\/foto\.jpg/.test(foto));
  const harita = await kart('m_harita');
  bak('fotografsizda harita karesi var', /mk-harita/.test(harita) && /tile\.openstreetmap\.org/.test(harita));
  bak('haritada nokta ve kaynak yazisi var',
      /mk-nokta/.test(harita) && /OpenStreetMap/.test(harita));
  bak('blok kaydiriliyor (yer ortada)', /class="mk-blok" style="left:calc\(50% - \d+px\)/.test(harita));
  bak('kutuyu dolduran dort karo', (harita.match(/tile\.openstreetmap\.org/g) || []).length === 4);
  const harf = await kart('m_harf');
  bak('ikisi de yoksa bas harfler', /mk-harf/.test(harf) && />ÇY</.test(harf), harf.slice(0,200));
  bak('bas harf rengi kimlikten uretiliyor', /--mk-h:\d+/.test(harf));
  const kotu = await kart('m_kotu');
  bak('javascript: baglantisi fotograf olmuyor', !/javascript:/.test(kotu), kotu.slice(0,160));
  bak('javascript: baglantisi harita rozeti olmuyor', !/mk-rozet[^>]*href/.test(kotu));
  bak('kotu baglantida yine de bas harf var', /mk-harf/.test(kotu));

  console.log('[yerlesim]');
  const yer = await p.evaluate(()=>{
    const k = [...document.querySelectorAll('.mk-kart')].map(e=> e.getBoundingClientRect());
    const l = document.getElementById('mk_list');
    return { adet: k.length, sutunlu: k.length > 1 && Math.abs(k[0].top - k[1].top) < 2,
             izgara: getComputedStyle(l).display,
             serit: Math.round((document.querySelector('.mk-gorsel')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height),
             tasma: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  bak('kartlar izgarada', yer.izgara === 'grid', yer.izgara);
  bak('genis ekranda yan yana', yer.sutunlu === true, yer.adet+' kart');
  bak('gorsel seridi var', yer.serit > 60, yer.serit+'px');
  bak('sayfa yana kaymiyor', yer.tasma <= 0, yer.tasma+'px');

  console.log('[fotograf alani]');
  await p.click('[data-mk="m_harf"]');
  await p.waitForSelector('#placeOverlay.open');
  bak('pencerede fotograf kutusu var', await p.$('#mk_image') !== null);
  await p.fill('#mk_image', 'https://ornek.com/yeni.jpg');
  await p.click('#mk_save');
  await p.waitForTimeout(200);
  bak('fotograf kaydedildi',
      await p.evaluate(()=> (mekanById('m_harf')||{}).imageUrl === 'https://ornek.com/yeni.jpg'));
  bak('kart artik fotografi gosteriyor', /mk-foto/.test(await kart('m_harf')));
  const satir = await p.evaluate(()=> mekanRowYap(mekanById('m_harf'), 'u1'));
  bak('buluta image_url gidiyor', satir.image_url === 'https://ornek.com/yeni.jpg', satir.image_url);
  bak('sutun yoksa fotografsiz gonderiliyor', await p.evaluate(()=>{
    mekanFotoSutunu = false;
    const s = mekanRowYap(mekanById('m_harf'), 'u1');
    mekanFotoSutunu = true;
    return !('image_url' in s) && s.name === 'Çıplak Yer';
  }));

  // Yenilenince duruyor mu?
  await p.reload({ waitUntil:'networkidle' });
  await p.evaluate(() => document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')));
  bak('yenilendikten sonra da duruyor',
      await p.evaluate(()=> (mekanlar.find(m=>m.id==='m_harf')||{}).imageUrl === 'https://ornek.com/yeni.jpg'));

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
