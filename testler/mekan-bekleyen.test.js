// MEKAN KARTINDA BEKLEYEN IS.
//
// Kartta "3 proje" yaziyordu ve bu HER projeyi sayiyordu: bitmisini de,
// iptal edilmisini de. "Balat'a gidiyorum, orada bekleyen baska ne var?"
// sorusuna cevap vermiyordu — kumeleme diye ayri bir ekran tasarlamamizin
// sebebi de buydu. Gerek kalmadi: bekleyen bilgisi zaten projede duruyor
// (iptal degil + henuz cekilmemis), yeni alan eklenmedi.
//
// Sayfa da buna gore siraliniyor: nerede is biriktigi bir bakista gorunsun.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

// m_c: 2 bekleyen | m_a: 1 bekleyen | m_b: 0 bekleyen ama 2 proje (biri
// cekilmis, biri iptal) | m_d: hic proje yok
const KUR = ()=>{
  mekanlar = [
    mekanTemizle({ id:'m_a', name:'Ahrida', city:'İstanbul', district:'Fatih' }),
    mekanTemizle({ id:'m_b', name:'Balat sokak', city:'İstanbul', district:'Fatih' }),
    mekanTemizle({ id:'m_c', name:'Zeyrek', city:'İstanbul', district:'Fatih' }),
    mekanTemizle({ id:'m_d', name:'Ev stüdyosu', city:'İstanbul' })
  ];
  projects = [
    { id:'p1', name:'Z1', placeId:'m_c', filmed:false, cancelled:false },
    { id:'p2', name:'Z2', placeId:'m_c', filmed:false, cancelled:false },
    { id:'p3', name:'B1', placeId:'m_b', filmed:true,  cancelled:false },
    { id:'p4', name:'B2', placeId:'m_b', filmed:false, cancelled:true  },
    { id:'p5', name:'A1', placeId:'m_a', filmed:false, cancelled:false }
  ];
  saveMekanlar(); setPage('places'); renderMekanlar();
};
const kartlar = (p)=> p.evaluate(()=> [...document.querySelectorAll('.mk-kart')].map(x=>({
  ad: x.querySelector('.mk-ad').textContent.trim(),
  rozetler: [...x.querySelectorAll('.mk-rozet')].map(r=> r.textContent.trim()),
  bekleyen: !!x.querySelector('.mk-bekleyen')
})));

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{ width:1100, height:900 } })).newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**tile.openstreetmap.org**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
  });
  await p.evaluate(KUR);
  await p.waitForTimeout(300);

  console.log('[rozet bekleyen isi sayiyor]');
  const liste = await kartlar(p);
  const bul = ad => liste.find(x=> x.ad === ad) || { rozetler:[], bekleyen:false };
  bak('iki bekleyen: "2 bekleyen çekim"',
      bul('Zeyrek').rozetler.some(r=> /2 bekleyen çekim/.test(r)),
      bul('Zeyrek').rozetler.join(' | '));
  bak('bir bekleyen: "1 bekleyen çekim"',
      bul('Ahrida').rozetler.some(r=> /1 bekleyen çekim/.test(r)),
      bul('Ahrida').rozetler.join(' | '));
  // Cekilmis ve iptal edilmis projeler BEKLEYEN degil.
  bak('çekilmiş + iptal = bekleyen yok', !bul('Balat sokak').bekleyen,
      bul('Balat sokak').rozetler.join(' | '));
  bak('ama toplam proje sayısı yine görünüyor',
      bul('Balat sokak').rozetler.some(r=> /2 proje/.test(r)),
      bul('Balat sokak').rozetler.join(' | '));
  bak('projesi olmayan mekanda sayı uydurulmuyor',
      !bul('Ev stüdyosu').rozetler.some(r=> /proje|bekleyen/.test(r)),
      bul('Ev stüdyosu').rozetler.join(' | '));
  bak('bekleyen rozeti vurgulu', bul('Zeyrek').bekleyen);

  console.log('[önce bekleyen işi olanlar]');
  bak('en çok bekleyen en üstte', liste[0].ad === 'Zeyrek', liste.map(x=>x.ad).join(' > '));
  bak('sonra bir bekleyeni olan', liste[1].ad === 'Ahrida', liste.map(x=>x.ad).join(' > '));
  // Esitler arasinda ad sirasi korunuyor: liste tahmin edilebilir kalsin.
  bak('bekleyeni olmayanlar altta, kendi aralarında ad sırasında',
      liste[2].ad === 'Balat sokak' && liste[3].ad === 'Ev stüdyosu',
      liste.map(x=>x.ad).join(' > '));

  console.log('[çekim yapılınca sayı düşüyor]');
  await p.evaluate(()=>{ projects.find(x=>x.id==='p1').filmed = true; renderMekanlar(); });
  await p.waitForTimeout(250);
  const sonra = await kartlar(p);
  const z = sonra.find(x=> x.ad === 'Zeyrek');
  bak('iki bekleyenden biri çekildi: "1 bekleyen çekim"',
      z.rozetler.some(r=> /1 bekleyen çekim/.test(r)), z.rozetler.join(' | '));
  bak('sıralama da güncellendi (ad sırası öne geçti)',
      sonra[0].ad === 'Ahrida' && sonra[1].ad === 'Zeyrek',
      sonra.map(x=>x.ad).join(' > '));

  console.log('[İngilizce]');
  await p.evaluate(()=> setLanguage('en'));
  await p.waitForTimeout(400);
  const ing = await kartlar(p);
  bak('İngilizcede "waiting" diyor',
      ing.some(x=> x.rozetler.some(r=> /shoots? waiting/.test(r))),
      ing.map(x=> x.rozetler.join('/')).join(' | '));
  bak('tekil/çoğul doğru',
      ing.some(x=> x.rozetler.some(r=> /^1 shoot waiting$/.test(r))),
      ing.map(x=> x.rozetler.join('/')).join(' | '));

  bak('sayfa hatası yok', hata.length === 0, hata.join(' | '));
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
