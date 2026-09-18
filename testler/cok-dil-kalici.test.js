// COK DILLI BASLIK: YENIDEN YUKLEMEDE HAYATTA KALIYOR MU?
//
// Gercek bir kayip yasandi. Kullanici YouTube kaydina Ingilizce baslik ve
// aciklama yaziyordu; Supabase'e dogru gidiyordu (content.diller.en ve
// content.anaDil orada duruyordu). Ama sayfa yenilenince serit yalnizca
// "Türkçe" gosteriyor, kayit bir daha kaydedilince ceviri BULUTTA DA
// siliniyordu.
//
// Sebep: sanitizeEvent content'i beyaz listeden yeniden kuruyor ve diller
// ile anaDil o listede yoktu. Kaydetme tarafi (dilleriTopla) bastan beri
// dogruydu; kayip OKUMA tarafindaydi. Bu yuzden cok-dil.test.js hatayi
// goremedi: o test yazmayi olcuyor, bu test YENIDEN YUKLEMEYI olcuyor.
//
// Buradaki asil sinir su: bir alanin kaydedilmesi onu guvende yapmaz.
// Guvende olmasi icin okuma yolundan da gecmesi gerekir.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{ width:1280, height:1000 } })).newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**supabase.co**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());

  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1300);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });

  // Buluttan / yerelden gelmis gibi ham bir kayit. Aynen bu sekilde
  // Supabase'te duruyordu.
  const HAM = {
    id:'ev_dil1', type:'video', platform:'youtube', title:'Sokollu',
    date:'2026-10-09', time:'19:00', uploaded:false,
    content:{
      videoTitle:'Sokollu Köprüsü', caption:'Mimar Sinan\'ın köprüsü.',
      hashtags:'#sokollu', shortTitle:'Sokollu',
      anaDil:'tr',
      diller:{ en:{ videoTitle:'The Bridge of Sokollu', caption:'Sinan\'s bridge.',
                    hashtags:'#bridge', shortTitle:'Bridge' } }
    }
  };

  console.log('[sanitizeEvent cevireyi DUSURMUYOR]');
  const temiz = await p.evaluate((ham)=> sanitizeEvent(ham), HAM);
  // Erisimler korumali: alan dustugunde test COKMEDEN dusmeli, yoksa
  // takim ciktisinda geri kalan olcumler hic gorunmez.
  const en = ((temiz.content || {}).diller || {}).en || {};
  bak('diller hayatta', !!(temiz.content && temiz.content.diller),
      JSON.stringify(temiz.content).slice(0,200));
  bak('İngilizce başlık aynen duruyor',
      en.videoTitle === 'The Bridge of Sokollu', JSON.stringify(en));
  bak('İngilizce açıklama aynen duruyor', en.caption === 'Sinan\'s bridge.');
  bak('hashtag ve kısa başlık da duruyor',
      en.hashtags === '#bridge' && en.shortTitle === 'Bridge');
  bak('anaDil hayatta', temiz.content.anaDil === 'tr', String(temiz.content.anaDil));
  bak('ana dilin kendi metni bozulmadı',
      temiz.content.videoTitle === 'Sokollu Köprüsü');

  console.log('[yerel kopyadan geri okuma — asıl senaryo]');
  // Kayit yaziliyor, sayfa YENILENIYOR, geri okunuyor. Hatanin kullaniciya
  // gorunen hali tam olarak buydu.
  await p.evaluate((ham)=>{ events = [ham]; save(); }, HAM);
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });
  const geri = await p.evaluate(()=>{
    const e = events.find(x=> x.id === 'ev_dil1');
    return e ? { diller: (e.content||{}).diller, anaDil: (e.content||{}).anaDil } : null;
  });
  bak('yenilemeden sonra kayıt duruyor', !!geri, String(geri));
  bak('yenilemeden sonra İngilizce duruyor',
      !!(geri && geri.diller && geri.diller.en
         && geri.diller.en.videoTitle === 'The Bridge of Sokollu'),
      JSON.stringify(geri));
  bak('yenilemeden sonra anaDil duruyor', geri && geri.anaDil === 'tr', JSON.stringify(geri));

  console.log('[şerit ve damga]');
  await p.evaluate(()=>{ const e = events.find(x=> x.id === 'ev_dil1'); openModal(e); });
  await p.waitForTimeout(500);
  const sekmeler = await p.evaluate(()=>
    [...document.querySelectorAll('#dilSerit .dil-sek')]
      .filter(e=> !e.classList.contains('dil-sek-ekle'))
      .map(e=> e.textContent.replace('×','').trim()));
  bak('şeritte İngilizce sekmesi var', sekmeler.indexOf('English') !== -1, sekmeler.join('|'));
  bak('Türkçe sekmesi de duruyor', sekmeler.indexOf('Türkçe') !== -1, sekmeler.join('|'));
  await p.evaluate(()=> closeModal());
  await p.waitForTimeout(200);

  const rozet = await p.evaluate(()=> dilRozeti(events.find(x=> x.id === 'ev_dil1')));
  bak('damgada TR ve EN var', /TR/.test(rozet) && /EN/.test(rozet), rozet);

  console.log('[yeniden kaydetmek çeviriyi SİLMİYOR]');
  // Kaybin ikinci yarisi: kayit bir daha kaydedilince bulutta da
  // siliniyordu. Pencere acilip Kaydet'e basiliyor.
  await p.evaluate(()=>{ const e = events.find(x=> x.id === 'ev_dil1'); openModal(e); });
  await p.waitForTimeout(500);
  await p.click('#saveBtn');
  await p.waitForTimeout(600);
  const sonra = await p.evaluate(()=>{
    const e = events.find(x=> x.id === 'ev_dil1');
    return e ? { diller: (e.content||{}).diller, anaDil: (e.content||{}).anaDil,
                 baslik: (e.content||{}).videoTitle } : null;
  });
  bak('kaydettikten sonra İngilizce hâlâ yerinde',
      !!(sonra && sonra.diller && sonra.diller.en
         && sonra.diller.en.videoTitle === 'The Bridge of Sokollu'),
      JSON.stringify(sonra));
  bak('ana dil metni ezilmedi', sonra && sonra.baslik === 'Sokollu Köprüsü', JSON.stringify(sonra));

  console.log('[beyaz liste hâlâ süzüyor]');
  // Alan eklendi diye kapi ardina kadar acilmadi: gecersiz kod, bos dil,
  // nesne olmayan deger ve sekizden fazlasi hala duşuyor.
  const suzme = await p.evaluate(()=> sanitizeEvent({
    id:'ev_suz', type:'video', platform:'youtube', date:'2026-10-09',
    content:{
      anaDil:'TURKCE',
      diller:{
        en:{ videoTitle:'ok' },
        english:{ videoTitle:'uzun kod' },
        de:{ videoTitle:'', caption:'', hashtags:'', shortTitle:'' },
        fr:'nesne degil',
        es:{ videoTitle:'x'.repeat(400) }
      }
    }
  }));
  const d = suzme.content.diller || {};
  bak('geçerli kod geçti', !!d.en, JSON.stringify(Object.keys(d)));
  bak('iki harften uzun kod düştü', !d.english, JSON.stringify(Object.keys(d)));
  bak('boş dil düştü', !d.de, JSON.stringify(Object.keys(d)));
  bak('nesne olmayan düştü', !d.fr, JSON.stringify(Object.keys(d)));
  bak('uzun başlık 300\'e kırpıldı',
      !!(d.es && d.es.videoTitle && d.es.videoTitle.length === 300),
      d.es && d.es.videoTitle && d.es.videoTitle.length);
  bak('geçersiz anaDil düştü', suzme.content.anaDil === undefined, String(suzme.content.anaDil));

  const cok = await p.evaluate(()=>{
    const diller = {};
    'ab cd ef gh ij kl mn op qr st'.split(' ').forEach(k=> diller[k] = { videoTitle: k });
    return Object.keys(sanitizeEvent({ id:'ev_cok', type:'video', platform:'youtube',
      date:'2026-10-09', content:{ diller } }).content.diller || {}).length;
  });
  bak('en çok sekiz dil', cok === 8, cok);

  console.log('[eski kayıtlar etkilenmiyor]');
  // undefined JSON'a yazilmaz: cevirisi olmayan kayitlar bos alan
  // tasimamali, yoksa her yedek bos yere sisiyor.
  const eski = await p.evaluate(()=>{
    const e = sanitizeEvent({ id:'ev_eski', type:'reels', platform:'instagram',
      date:'2026-10-09', content:{ caption:'sade' } });
    return { anahtarlar: Object.keys(e.content), json: JSON.stringify(e.content) };
  });
  bak('dillersiz kayıtta diller undefined',
      eski.json.indexOf('diller') === -1, eski.json.slice(0,160));
  bak('dillersiz kayıtta anaDil undefined',
      eski.json.indexOf('anaDil') === -1, eski.json.slice(0,160));

  bak('js hatası yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
