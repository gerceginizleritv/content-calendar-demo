// HAVA VE ISIK. Iki yerde duruyor: sol seritte (bulundugun yer) ve mekan
// penceresinde (o mekan). Ikisinin de tek kurali var:
//
//   ISIK HESAPLANIR, HAVA SORULUR.
//
// Gun dogumu, gun batimi ve altin saat koordinattan hesaplaniyor; internet
// olmasa da dogru. Sicaklik/yagis aga bagli; gelmezse blok KAYBOLMUYOR,
// son bilinen olcum yasiyla birlikte duruyor. Testin buyuk kismi bu iki
// davranisi ayirt ediyor.
//
// Ag burada TAKLIT ediliyor: gercek servise cikmiyoruz.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const HAVA_CEVAP = {
  timezone: 'Europe/Istanbul',
  current: { temperature_2m: 23.6, weather_code: 2, wind_speed_10m: 11.4 },
  daily: { weather_code:[2], temperature_2m_max:[26.1], temperature_2m_min:[18.3],
           precipitation_probability_max:[20] }
};
const YERLER = {
  'izmir': { name:'İzmir', latitude:38.41, longitude:27.14, admin1:'İzmir' },
  'kadıköy, i̇stanbul': { name:'Kadıköy', latitude:40.99, longitude:29.03, admin1:'İstanbul' },
  'kadıköy': { name:'Kadıköy', latitude:40.99, longitude:29.03, admin1:'İstanbul' }
};

async function kur(t, secenek){
  const c = await t.newContext(Object.assign({
    viewport:{ width:1280, height:900 },
    permissions:['geolocation'],
    geolocation:{ latitude:41.0082, longitude:28.9784 }
  }, secenek || {}));
  const p = await c.newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**tile.openstreetmap.org**', r=> r.abort());
  return { c, p };
}
// DIKKAT: kalip '**api.open-meteo.com**' olamaz — 'geocoding-api.open-meteo.com'
// da o kalibin icinde geciyor ve iki servis birbirine karisiyor.
async function havaYolu(p, calisiyor){
  await p.unroute('https://api.open-meteo.com/**').catch(()=>{});
  await p.route('https://api.open-meteo.com/**', r=> calisiyor
    ? r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(HAVA_CEVAP) })
    : r.abort());
}
async function yerYolu(p){
  await p.route('https://geocoding-api.open-meteo.com/**', r=>{
    const u = r.request().url();
    const ad = decodeURIComponent((u.match(/[?&]name=([^&]*)/) || [])[1] || '')
                 .toLocaleLowerCase('tr');
    const y = YERLER[ad];
    return r.fulfill({ status:200, contentType:'application/json',
      body: JSON.stringify(y ? { results:[y] } : {}) });
  });
}
const metin = (p, sec)=> p.$eval(sec, e=> e.textContent.replace(/\s+/g,' ').trim());

(async () => {
  const t = await chromium.launch();

  // ---------- 1. Gunes matematigi ----------
  // Bagimsiz bir kutuphaneyle (suncalc) karsilastirildi: en buyuk sapma
  // 2.8 dakika, cogu 1 dakikanin altinda. Buradaki degerler o dogrulanmis
  // degerler; 3 dakikalik pay biraktik.
  console.log('[gunes hesabi]');
  const { c: c0, p: p0 } = await kur(t);
  await havaYolu(p0, true); await yerYolu(p0);
  await p0.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p0.waitForTimeout(1400);
  // Tur penceresi acik kalirsa tiklamalari engelliyor; testin konusu o degil.
  await p0.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p0.reload({ waitUntil:'domcontentloaded' });
  await p0.waitForTimeout(1500);
  await p0.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
  });
  await p0.waitForTimeout(300);
  const hata = []; p0.on('pageerror', e=> hata.push(String(e)));

  const BEKLENEN = [
    ['İstanbul yaz',  41.01, 28.98, '2026-06-21', '02:31', '17:39'],
    ['İstanbul kış',  41.01, 28.98, '2026-12-21', '05:25', '14:38'],
    ['Londra ilkbahar', 51.51, -0.13, '2026-03-20', '06:03', '18:12'],
    ['Reykjavik yaz', 64.13, -21.90, '2026-06-21', '02:55', '00:03']
  ];
  for(const [ad, lat, lon, ymd, d, b] of BEKLENEN){
    const s = await p0.evaluate(([lat, lon, ymd])=>{
      const x = gunesAnlari(lat, lon, ymd, -0.833);
      const u = t => t ? t.toISOString().slice(11,16) : null;
      return { d: u(x.dogus), b: u(x.batis), dms: x.dogus && x.dogus.getTime(), bms: x.batis && x.batis.getTime() };
    }, [lat, lon, ymd]);
    const fark = (a, bek)=>{
      const [sa, dk] = bek.split(':').map(Number);
      const [sa2, dk2] = a.split(':').map(Number);
      let f = Math.abs((sa*60+dk) - (sa2*60+dk2));
      return Math.min(f, 1440 - f);
    };
    bak(ad + ': gün doğumu', s.d && fark(s.d, d) <= 3, s.d + ' / beklenen ' + d);
    bak(ad + ': gün batımı', s.b && fark(s.b, b) <= 3, s.b + ' / beklenen ' + b);
  }
  const kutup = await p0.evaluate(()=>{
    const x = gunesAnlari(78.2, 15.6, '2026-06-21', -0.833);  // Svalbard, gece yarisi gunesi
    return { d: x.dogus, b: x.batis };
  });
  bak('kutupta güneş doğmuyor/batmıyor: boş dönüyor', kutup.d === null && kutup.b === null);
  const sira = await p0.evaluate(()=>{
    const i = gunIsigi(41.01, 28.98, '2026-09-08');
    return { dogus:+i.dogus, batis:+i.batis, altinBas:+i.altinAksamBas,
             altinSabah:+i.altinSabahBitis, mavi:+i.maviAksamBitis };
  });
  bak('akşam altın saati batıştan ÖNCE başlıyor', sira.altinBas < sira.batis);
  bak('akşam altın saati makul uzunlukta (10-90 dk)',
      (sira.batis - sira.altinBas)/60000 > 10 && (sira.batis - sira.altinBas)/60000 < 90,
      Math.round((sira.batis - sira.altinBas)/60000) + ' dk');
  bak('sabah altın saati doğuştan SONRA bitiyor', sira.altinSabah > sira.dogus);
  bak('mavi saat batıştan SONRA bitiyor', sira.mavi > sira.batis);

  // ---------- 2. Acilista konum SORULMUYOR ----------
  console.log('[açılışta konum penceresi çıkmıyor]');
  // Tarayici iznini VERDIK; buna ragmen blok "konumu aç" halinde olmali.
  // Yani uygulama acilir acilmaz konum okumaya kalkmiyor.
  bak('blok görünüyor', !(await p0.$eval('#railHava', e=> e.hidden)));
  bak('konum kendiliğinden okunmadı, düğme duruyor', await p0.$('#havaIzinBtn') !== null);
  bak('şehir kutusu da var (izin vermeyene yol)', await p0.$('#havaSehirGiris') !== null);
  bak('daha derece yok', !/°/.test(await metin(p0, '#railHava')));

  // ---------- 3. Izin verilince ----------
  console.log('[konum açılınca]');
  await p0.click('#havaIzinBtn');
  await p0.waitForFunction(()=> /°/.test(document.getElementById('railHava').textContent),
                           null, { timeout: 8000 });
  const dolu = await metin(p0, '#railHava');
  bak('derece yazıyor', /24°/.test(dolu), dolu);
  bak('gün doğumu ve batımı yazıyor', /↑\s*\d\d:\d\d/.test(dolu) && /↓\s*\d\d:\d\d/.test(dolu), dolu);
  bak('altın saat yazıyor', await p0.$('#railHava .hv-altin') !== null);
  // Seritte SIRADAKI altin saat yaziyor: gun icindeyken aksaminki,
  // sabah erkenken sabahinki. Ikisini birden yazmak dar seritte gurultu.
  const altin = await p0.evaluate(()=>{
    const i = gunIsigi(41.01, 28.98, bugunYmd());
    const y = document.querySelector('#railHava .hv-altin .hv-uzun').textContent;
    // Blok saatleri MEKANIN dilimiyle yaziyor (taklit cevaptaki
    // Europe/Istanbul); karsilastirma da ayni dilimde olmali.
    const bicim = d => new Intl.DateTimeFormat('tr-TR',
      { hour:'2-digit', minute:'2-digit', hour12:false,
        timeZone:'Europe/Istanbul' }).format(d);
    return { yazi:y, sabah:bicim(i.dogus), aksam:bicim(i.altinAksamBas),
             sabahMi: Date.now() < +i.altinSabahBitis };
  });
  bak('sıradaki altın saat yazıyor',
      altin.yazi.indexOf(altin.sabahMi ? altin.sabah : altin.aksam) !== -1,
      altin.yazi + ' (sabah mı: ' + altin.sabahMi + ')');
  bak('şeritte iki altın saat birden yazmıyor',
      (altin.yazi.match(/\d\d:\d\d/g) || []).length === 2, altin.yazi);
  bak('yağmur ihtimali yazıyor', /%20/.test(dolu), dolu);
  bak('rüzgâr yazıyor', /11 km\/s|11 km\/h/.test(dolu), dolu);
  bak('"tazelenemedi" notu YOK (veri taze)', !/tazelenemedi|refresh/i.test(dolu), dolu);
  const kayit = await p0.evaluate(()=> JSON.parse(localStorage.getItem('demo_hava_konum')));
  bak('koordinat iki haneye yuvarlanmış (~1 km)',
      String(kayit.lat) === '41.01' && String(kayit.lon) === '28.98',
      kayit.lat + ',' + kayit.lon);

  // ---------- 4. Ag yokken ----------
  console.log('[internet yokken blok kaybolmuyor]');
  await p0.evaluate(()=> localStorage.removeItem('demo_hava_onbellek'));
  await havaYolu(p0, false);
  await p0.evaluate(()=> railHavaYenile());
  await p0.waitForTimeout(900);
  const agsiz = await metin(p0, '#railHava');
  bak('blok hâlâ duruyor', !(await p0.$eval('#railHava', e=> e.hidden)));
  bak('ışık saatleri yine yazıyor', /↑\s*\d\d:\d\d/.test(agsiz), agsiz);
  bak('hava bilgisi yok diye açıklanıyor', /hesaplan|calculated/i.test(agsiz), agsiz);

  // ---------- 5. Eski veri ----------
  console.log('[eski veri yaşıyla duruyor]');
  await p0.evaluate(()=>{
    localStorage.setItem('demo_hava_onbellek', JSON.stringify({
      '41.01,28.98': { t: Date.now() - 3*60*60*1000,
                       v: { derece:19, kod:3, ruzgar:8, yagis:5, tz:'Europe/Istanbul' } }
    }));
  });
  await p0.evaluate(()=> railHavaYenile());
  await p0.waitForFunction(()=> /°/.test(document.getElementById('railHava').textContent),
                           null, { timeout: 8000 });
  const eski = await metin(p0, '#railHava');
  bak('son bilinen derece gösteriliyor', /19°/.test(eski), eski);
  bak('yaşı söyleniyor', /3 saat önceki|3 h ago/.test(eski), eski);
  bak('tazelenemediği söyleniyor', /tazelenemedi|refresh/i.test(eski), eski);

  // ---------- 6. Kapatma ve geri acma ----------
  console.log('[kapatılabiliyor]');
  await havaYolu(p0, true);
  await p0.click('#havaKapatBtn');
  await p0.waitForTimeout(250);
  bak('blok gizlendi', await p0.$eval('#railHava', e=> e.hidden));
  bak('geri açma bağlantısı çıktı', !(await p0.$eval('#havaGosterBtn', e=> e.hidden)));
  bak('tercih saklandı', await p0.evaluate(()=> localStorage.getItem('demo_hava_kapali')) === 'true');
  await p0.evaluate(()=> document.getElementById('havaGosterBtn').click());
  await p0.waitForTimeout(400);
  bak('blok geri geldi', !(await p0.$eval('#railHava', e=> e.hidden)));
  bak('geri açma bağlantısı yeniden gizlendi', await p0.$eval('#havaGosterBtn', e=> e.hidden));

  // ---------- 7. Sehir yazarak ----------
  console.log('[konum yerine şehir]');
  await p0.evaluate(()=>{ localStorage.removeItem('demo_hava_konum');
                          localStorage.removeItem('demo_hava_onbellek'); railHavaYenile(); });
  await p0.waitForTimeout(300);
  await p0.fill('#havaSehirGiris', 'İzmir');
  await p0.evaluate(()=> document.getElementById('havaSehirForm')
                           .dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })));
  await p0.waitForFunction(()=> /°/.test(document.getElementById('railHava').textContent),
                           null, { timeout: 8000 });
  const sehirli = await metin(p0, '#railHava');
  bak('şehir adı başlıkta', /İzmir/.test(sehirli), sehirli);
  bak('şehir için de hava geldi', /24°/.test(sehirli), sehirli);
  // Bulunamayan bir ad: mekan penceresinin cumlesi degil, kendi cumlesi.
  await p0.evaluate(()=>{ localStorage.removeItem('demo_hava_konum'); railHavaYenile(); });
  await p0.waitForTimeout(300);
  await p0.fill('#havaSehirGiris', 'Zzzqq');
  await p0.evaluate(()=> document.getElementById('havaSehirForm')
                           .dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })));
  await p0.waitForTimeout(900);
  bak('bulunamayan şehir doğru cümleyle söyleniyor',
      /uyan bir yer bulunamadı/i.test(await metin(p0, '#railHava')), await metin(p0, '#railHava'));
  await p0.fill('#havaSehirGiris', 'İzmir');
  await p0.evaluate(()=> document.getElementById('havaSehirForm')
                           .dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })));
  await p0.waitForFunction(()=> /°/.test(document.getElementById('railHava').textContent),
                           null, { timeout: 8000 });

  // ---------- 8. Dil ----------
  console.log('[dil değişince]');
  await p0.evaluate(()=> setLanguage('en'));
  await p0.waitForTimeout(600);
  bak('İngilizceye döndü', /Today|Golden/i.test(await metin(p0, '#railHava')),
      await metin(p0, '#railHava'));
  await p0.evaluate(()=> setLanguage('tr'));
  await p0.waitForTimeout(600);
  bak('Türkçeye döndü', /Bugün|Altın/i.test(await metin(p0, '#railHava')),
      await metin(p0, '#railHava'));

  // ---------- 9. Mekan penceresi ----------
  console.log('[mekan penceresi: konum iznine bağlı DEĞİL]');
  await p0.evaluate(()=>{
    // Konum bilgisini tamamen siliyoruz: mekan blogu bundan bagimsiz calismali.
    localStorage.removeItem('demo_hava_konum');
    localStorage.removeItem('demo_hava_onbellek');
    localStorage.removeItem('demo_hava_yer');
    mekanlar = [
      mekanTemizle({ id:'m_harita', name:'Sahil', city:'İstanbul',
                     mapsUrl:'https://www.google.com/maps/@40.99,29.03,17z' }),
      mekanTemizle({ id:'m_sehir', name:'Kadıköy', city:'İstanbul', district:'Kadıköy' }),
      mekanTemizle({ id:'m_bos', name:'Ev stüdyosu' })
    ];
    saveMekanlar(); setPage('places'); renderMekanlar();
  });
  await p0.waitForTimeout(300);

  await p0.evaluate(()=> mekanPenceresiniAc('m_harita'));
  await p0.waitForFunction(()=> /°/.test(document.getElementById('mk_hava').textContent),
                           null, { timeout: 8000 });
  const haritali = await metin(p0, '#mk_hava');
  bak('harita bağlantılı mekanda hava geldi', /24°/.test(haritali), haritali);
  bak('koordinatın haritadan geldiği söyleniyor', /harita bağlantısı/i.test(haritali), haritali);
  bak('ışık saatleri de var', /↑\s*\d\d:\d\d/.test(haritali), haritali);
  bak('mavi saat de var (geniş hâl)', /Mavi saat/i.test(haritali), haritali);
  await p0.evaluate(()=> mekanPenceresiniKapat());

  await p0.evaluate(()=> mekanPenceresiniAc('m_sehir'));
  await p0.waitForFunction(()=> /°/.test(document.getElementById('mk_hava').textContent),
                           null, { timeout: 8000 });
  const sehirMekan = await metin(p0, '#mk_hava');
  bak('haritasız mekanda ad aramasıyla bulundu', /24°/.test(sehirMekan), sehirMekan);
  bak('yaklaşık olduğu söyleniyor', /yaklaşık/i.test(sehirMekan), sehirMekan);
  await p0.evaluate(()=> mekanPenceresiniKapat());

  await p0.evaluate(()=> mekanPenceresiniAc('m_bos'));
  await p0.waitForTimeout(1200);
  const bosMekan = await metin(p0, '#mk_hava');
  bak('bilgisi olmayan mekanda ne yapılacağı söyleniyor',
      /Şehir ya da harita/i.test(bosMekan), bosMekan);
  bak('boş mekanda derece uydurulmuyor', !/°/.test(bosMekan), bosMekan);
  await p0.evaluate(()=> mekanPenceresiniKapat());

  bak('sayfa hatası yok', hata.length === 0, hata.join(' | '));
  await c0.close();

  // ---------- 10. Telefon ----------
  // Ust serit gecen hafta kucultuldu. Hava satiri onu yeniden sismesin
  // diye AYRI bir satirda; marka, kimlik ve "..." hala tek satirda.
  //
  // Burasi TEK sayfada, viewport degistirilerek olculuyor. Her genislik
  // icin ayri tarayici acmak testi bes dakikaya cikariyor ve kosucunun
  // 200 saniyelik siniri onu kesiyordu.
  console.log('[telefon: üst şerit bozulmuyor]');
  const { c: cm, p: pm } = await kur(t, { viewport:{ width:412, height:850 },
                                          isMobile:true, hasTouch:true });
  const hata3 = []; pm.on('pageerror', e=> hata3.push(String(e)));
  await havaYolu(pm, true); await yerYolu(pm);
  await pm.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await pm.waitForTimeout(1400);
  await pm.evaluate(()=>{
    localStorage.setItem('demo_tour_done','1');
    localStorage.setItem('demo_hava_konum', JSON.stringify({ lat:41.01, lon:28.98, t:Date.now() }));
  });
  await pm.reload({ waitUntil:'domcontentloaded' });
  await pm.waitForFunction(()=> /°/.test(document.getElementById('railHava').textContent),
                           null, { timeout: 10000 });
  await pm.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    document.getElementById('authBtn').textContent = '\u2601 Hesabım';
    document.getElementById('railAvatar').textContent = 'MB';
  });
  await pm.waitForTimeout(400);

  const seritOlc = ()=> pm.evaluate(()=>{
    const y = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const marka = y('.rail-brand'), ben = y('.rail-me'), nokta = y('.rail-more'), hava = y('#railHava');
    return { marka:marka.top, ben:ben.top, nokta:nokta.top, hava:hava.top,
             satir:hava.height, seritYuk: y('.rail').height,
             yatay: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });

  for(const [ad, w] of [['320',320],['iPhone SE',375],['iPhone 14',390],['Android',412],['büyük',430]]){
    await pm.setViewportSize({ width:w, height:850 });
    await pm.waitForTimeout(250);
    const o = await seritOlc();
    console.log('  [' + ad + ' ' + w + 'px]');
    bak('marka, kimlik ve "..." aynı satırda',
        Math.abs(o.marka - o.ben) < 14 && Math.abs(o.nokta - o.ben) < 14,
        [o.marka, o.ben, o.nokta].map(Math.round).join(' / '));
    bak('hava şeridi ALT satırda', o.hava > o.ben + 8, Math.round(o.hava) + ' > ' + Math.round(o.ben));
    bak('hava şeridi tek satır (30px altı)', o.satir < 30, Math.round(o.satir) + 'px');
    bak('üst şerit hâlâ makul (110px altı)', o.seritYuk < 110, Math.round(o.seritYuk) + 'px');
    bak('sayfa yatay kaymıyor', o.yatay <= 0, o.yatay + 'px');
  }

  // GERCEK TELEFONDA CIKAN HATA. iOS Safari bazi bloklarda yaziyi
  // kendiliginden buyutuyor. Sarma acik bir flex kabinda tarayici once
  // satiri boluyor, kucultmeyi ondan SONRA yapiyor: buyuyen marka
  // "sigmiyorum" deyip "..." dugmesini alt satira atiyordu ve ust serit
  // iki satir oluyordu. Burada yaziyi biz sisiriyoruz.
  console.log('[yazı büyütülse bile üst şerit tek satır]');
  await pm.evaluate(()=>{
    const s = document.createElement('style');
    s.id = 'sisir';
    s.textContent = '.wordmark{font-size:25px !important;}';
    document.head.appendChild(s);
  });
  for(const w of [320, 360, 390, 414, 430]){
    await pm.setViewportSize({ width:w, height:850 });
    await pm.waitForTimeout(250);
    const o = await seritOlc();
    console.log('  [' + w + 'px, şişirilmiş yazı]');
    bak('"..." düğmesi alt satıra düşmedi', Math.abs(o.nokta - o.ben) < 14,
        Math.round(o.nokta) + ' / ' + Math.round(o.ben));
    bak('marka aynı satırda (kısalarak)', Math.abs(o.marka - o.ben) < 16,
        Math.round(o.marka) + ' / ' + Math.round(o.ben));
    bak('üst şerit hâlâ 110px altında', o.seritYuk < 110, Math.round(o.seritYuk) + 'px');
  }
  await pm.evaluate(()=> document.getElementById('sisir').remove());
  await pm.setViewportSize({ width:390, height:850 });
  await pm.waitForTimeout(250);

  // Acik halde satirlar birbirine yapismiyor: yagmur/ruzgar satiri bir
  // flex satiri; display:block verilirse "Yagmur %20Ruzgar 11 km/s" oluyordu.
  console.log('[dokununca açılan hâl]');
  await pm.evaluate(()=> document.getElementById('railHava').click());
  await pm.waitForTimeout(300);
  const acikHal = await pm.evaluate(()=>{
    const ek = document.querySelector('#railHava .hv-ek');
    // textContent'te bosluk YOK (iki ayri span); goze gorunen bosluk flex
    // gap'ten geliyor, o yuzden kutulari olcuyoruz.
    const ic = ek ? [...ek.children].map(e=> e.getBoundingClientRect()) : [];
    return { display: ek ? getComputedStyle(ek).display : 'yok',
             aralik: ic.length > 1 ? Math.round(ic[1].left - ic[0].right) : -1,
             bas: !!document.querySelector('#railHava .hv-bas').offsetParent };
  });
  bak('yağmur/rüzgâr satırı flex kaldı', acikHal.display === 'flex', acikHal.display);
  bak('yağmur ve rüzgâr birbirine yapışmadı', acikHal.aralik >= 5, acikHal.aralik + 'px aralık');
  bak('açılınca başlık da görünüyor', acikHal.bas);
  await pm.evaluate(()=> document.getElementById('railHava').classList.remove('acik'));

  // Konum daha acilmamisken de tek satir olmali: aciklama ve sehir kutusu
  // ust seridi 120 pikselin uzerine cikariyordu.
  console.log('[konum açılmadan]');
  await pm.evaluate(()=>{ localStorage.removeItem('demo_hava_konum'); railHavaYenile(); });
  await pm.waitForTimeout(400);
  const sorHal = await pm.evaluate(()=>{
    const h = document.getElementById('railHava');
    return { hava: h.getBoundingClientRect().height,
             serit: document.querySelector('.rail').getBoundingClientRect().height,
             dugmeGorunur: !!(document.getElementById('havaIzinBtn') || {}).offsetParent,
             yazi: (document.querySelector('.hv-sor-kisa') || {}).textContent || '' };
  });
  bak('sorma hâli de tek satır', sorHal.hava < 30, Math.round(sorHal.hava) + 'px');
  bak('üst şerit 100px altında', sorHal.serit < 100, Math.round(sorHal.serit) + 'px');
  bak('44px düğme yerine tek satır yazı',
      !sorHal.dugmeGorunur && sorHal.yazi.length > 5, sorHal.yazi);
  await pm.evaluate(()=> document.getElementById('railHava').click());
  await pm.waitForTimeout(300);
  const acilan = await pm.evaluate(()=> ({
    dugme: !!(document.getElementById('havaIzinBtn') || {}).offsetParent,
    sehir: !!(document.getElementById('havaSehirGiris') || {}).offsetParent }));
  bak('dokununca düğme ve şehir kutusu açılıyor', acilan.dugme && acilan.sehir,
      JSON.stringify(acilan));
  bak('sayfa hatası yok (telefon)', hata3.length === 0, hata3.join(' | '));
  await cm.close();

  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
