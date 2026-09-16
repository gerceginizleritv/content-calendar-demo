// BUGUN OZETI.
//
// Uygulamanin parcalari veride birbirine bagli ama ekranda degil. Once
// o baglari tek yerde toplayan bir fonksiyon yaziliyor; ekran sonra.
// Bu test o fonksiyonu EKRAN OLMADAN tutuyor.
//
// En onemlisi: gun ve an disaridan veriliyor. Bu takimda iki test
// "bugun hangi gun" varsayimi yuzunden kirildi (biri pazartesi disinda,
// oteki hafta sonu). Burada sabit bir gun kullaniliyor, yani test yilin
// hangi gunu kosarsa kossun ayni sonucu veriyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

// Sabit basvuru gunu. Bir pazartesi degil, ozellikle sıradan bir gun:
// hafta basi varsayimi da test edilmesin.
const GUN = '2026-06-17';
const AN  = '2026-06-17T12:00:00';

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
  await p.waitForTimeout(1200);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')); });

  // Tarayicida veriyi kurup ozeti alan tek giris noktasi. Proje alanlari
  // eksik verilebiliyor; sanitizeProject gerisini dolduruyor.
  const ozet = (projeler, kayitlar) => p.evaluate(([pr, ev, gun, an])=>{
    projects = pr.map(sanitizeProject).filter(Boolean);
    events = ev;
    const o = bugunOzeti(gun, new Date(an));
    // Proje nesneleri oldugu gibi disari cikarsa devasa olur; testin
    // baktigi sey kimlik ve sayi.
    const sadelestir = liste => liste.map(x=> ({
      id: x.p ? x.p.id : undefined, k: x.k, tarih: x.tarih,
      kacGun: x.kacGun, neler: x.neler
    }));
    return {
      cekim: sadelestir(o.cekim),
      bugunAdim: sadelestir(o.bugunAdim),
      gecikenAdim: sadelestir(o.gecikenAdim),
      eksikler: sadelestir(o.eksikler),
      bugunYayin: o.bugunYayin.map(e=> e.id),
      gecikenKayit: o.gecikenKayit.map(e=> e.id),
      toplam: o.toplam, dikkat: o.dikkat,
      yeni: o.yeni, temiz: o.temiz, bugun: o.bugun
    };
  }, [projeler, kayitlar, GUN, AN]);

  const proje = (id, ek) => Object.assign({
    id, name:'Proje ' + id, type:'desk', keywords:'', notes:'', address:'',
    shootDate:'', script:false, filmed:false, audio:false, edited:false,
    approved:false, package:false, published:false, cancelled:false,
    deadlines:{}, createdAt: 1
  }, ek || {});
  const kayit = (id, ek) => Object.assign({
    id, type:'reels', platform:'instagram', title:'K'+id,
    date: GUN, time:'09:00', uploaded:false, content:{}
  }, ek || {});

  console.log('[bos haller]');
  let o = await ozet([], []);
  bak('yeni kullanici: yeni=true', o.yeni === true);
  bak('yeni kullanici: toplam 0', o.toplam === 0, o.toplam);
  bak('gun geri donuyor', o.bugun === GUN, o.bugun);

  // Veri VAR ama bugun yapilacak bir sey yok. Bu, yeni kullaniciyla ayni
  // sey degil: birine "basla", otekine "temiz" demek gerekiyor.
  o = await ozet([ proje('p1', { shootDate:'2026-01-05', script:true, filmed:true,
                                 audio:true, edited:true, approved:true,
                                 package:true, published:true }) ],
                 [ kayit('e1', { date:'2026-01-05', uploaded:true }) ]);
  bak('her sey tamam: temiz=true', o.temiz === true, JSON.stringify(o).slice(0,160));
  bak('her sey tamam: yeni=false', o.yeni === false);

  console.log('[yaklasan cekim]');
  o = await ozet([
    proje('bugun',  { shootDate: GUN }),
    proje('yarin',  { shootDate:'2026-06-18' }),
    proje('alti',   { shootDate:'2026-06-23' }),   // ufkun son gunu
    proje('yedi',   { shootDate:'2026-06-24' }),   // ufkun disi
    proje('dun',    { shootDate:'2026-06-16' }),   // gecmis
    proje('tarihsiz')
  ], []);
  const cekimId = o.cekim.map(x=> x.id);
  bak('bugunku cekim listede', cekimId.indexOf('bugun') !== -1, cekimId.join(','));
  bak('yarinki cekim listede', cekimId.indexOf('yarin') !== -1, cekimId.join(','));
  bak('altinci gun hala listede', cekimId.indexOf('alti') !== -1, cekimId.join(','));
  bak('yedinci gun listede DEGIL', cekimId.indexOf('yedi') === -1, cekimId.join(','));
  bak('gecmis cekim listede degil', cekimId.indexOf('dun') === -1, cekimId.join(','));
  bak('tarihi olmayan listede degil', cekimId.indexOf('tarihsiz') === -1, cekimId.join(','));
  bak('en yakin cekim en ustte', cekimId[0] === 'bugun', cekimId.join(','));
  bak('bugunun kacGun degeri 0', (o.cekim[0]||{}).kacGun === 0, (o.cekim[0]||{}).kacGun);

  console.log('[iptal ve bitmis proje hicbir listede yok]');
  o = await ozet([
    proje('iptal', { shootDate: GUN, cancelled:true, deadlines:{ script:'2026-06-01' } }),
    proje('bitti', { shootDate: GUN, script:true, filmed:true, audio:true,
                     edited:true, approved:true, package:true, published:true })
  ], []);
  bak('iptal cekimde yok', o.cekim.every(x=> x.id !== 'iptal'), JSON.stringify(o.cekim));
  bak('iptal gecikende yok', o.gecikenAdim.length === 0, JSON.stringify(o.gecikenAdim));
  bak('bitmis proje cekimde yok', o.cekim.every(x=> x.id !== 'bitti'), JSON.stringify(o.cekim));

  console.log('[terminler: bugun ile geciken AYRI]');
  o = await ozet([
    proje('t1', { deadlines:{ script: GUN } }),                  // bugun
    proje('t2', { deadlines:{ filmed:'2026-06-10' } }),          // geciken
    proje('t3', { deadlines:{ edited:'2026-06-01' } }),          // daha eski geciken
    proje('t4', { deadlines:{ script:'2026-06-01' }, script:true }), // yapilmis
    proje('t5', { deadlines:{ audio:'2026-06-30' } })            // ileride
  ], []);
  bak('bugunku termin bugunAdim\'da',
      o.bugunAdim.length === 1 && o.bugunAdim[0].id === 't1', JSON.stringify(o.bugunAdim));
  bak('bugunku termin gecikende DEGIL',
      o.gecikenAdim.every(x=> x.id !== 't1'), JSON.stringify(o.gecikenAdim));
  bak('gecmis termin gecikende',
      o.gecikenAdim.some(x=> x.id === 't2'), JSON.stringify(o.gecikenAdim));
  bak('en eski gecikme en ustte',
      (o.gecikenAdim[0]||{}).id === 't3', JSON.stringify(o.gecikenAdim));
  bak('isaretlenmis adim listede yok',
      o.gecikenAdim.every(x=> x.id !== 't4'), JSON.stringify(o.gecikenAdim));
  bak('ileri tarihli termin listede yok',
      o.bugunAdim.every(x=> x.id !== 't5') && o.gecikenAdim.every(x=> x.id !== 't5'));
  bak('adim anahtari tasiniyor', (o.bugunAdim[0]||{}).k === 'script', (o.bugunAdim[0]||{}).k);

  console.log('[takvim]');
  o = await ozet([], [
    kayit('sabah',    { time:'08:00' }),
    kayit('aksam',    { time:'20:00' }),                       // bugun ama saati gelmedi
    kayit('isaretli', { time:'07:00', uploaded:true }),
    kayit('dun',      { date:'2026-06-16', time:'10:00' }),
    kayit('gelecek',  { date:'2026-06-20', time:'10:00' })
  ]);
  bak('bugunYayin bugunkuleri aliyor',
      o.bugunYayin.length === 3, o.bugunYayin.join(','));
  bak('bugunYayin isaretlenmisi de iceriyor',
      o.bugunYayin.indexOf('isaretli') !== -1, o.bugunYayin.join(','));
  bak('bugunYayin saate gore sirali',
      o.bugunYayin.join(',') === 'isaretli,sabah,aksam', o.bugunYayin.join(','));
  bak('saati gecmis isaretsiz kayit gecikende',
      o.gecikenKayit.indexOf('sabah') !== -1, o.gecikenKayit.join(','));
  bak('dunku isaretsiz kayit gecikende',
      o.gecikenKayit.indexOf('dun') !== -1, o.gecikenKayit.join(','));
  bak('saati gelmemis kayit gecikende DEGIL',
      o.gecikenKayit.indexOf('aksam') === -1, o.gecikenKayit.join(','));
  bak('isaretlenmis kayit gecikende DEGIL',
      o.gecikenKayit.indexOf('isaretli') === -1, o.gecikenKayit.join(','));
  bak('gelecekteki kayit gecikende DEGIL',
      o.gecikenKayit.indexOf('gelecek') === -1, o.gecikenKayit.join(','));
  bak('gecikenler eskiden yeniye sirali',
      o.gecikenKayit.join(',') === 'dun,sabah', o.gecikenKayit.join(','));

  console.log('[eksikler yalnizca yaklasan cekim icin]');
  o = await ozet([
    proje('yakin', { shootDate:'2026-06-18' }),
    proje('uzak',  { shootDate:'2026-07-30' })
  ], []);
  bak('yaklasan cekimin eksigi sayiliyor',
      o.eksikler.length === 1 && o.eksikler[0].id === 'yakin', JSON.stringify(o.eksikler));
  bak('scripti yok isaretlendi',
      (o.eksikler[0]||{}).neler.indexOf('script') !== -1, JSON.stringify(o.eksikler[0]));
  bak('listesi yok isaretlendi',
      (o.eksikler[0]||{}).neler.indexOf('liste') !== -1, JSON.stringify(o.eksikler[0]));
  bak('kaydi yok isaretlendi',
      (o.eksikler[0]||{}).neler.indexOf('kayit') !== -1, JSON.stringify(o.eksikler[0]));
  bak('masa basi isinde adres eksigi ARANMIYOR',
      (o.eksikler[0]||{}).neler.indexOf('yer') === -1, JSON.stringify(o.eksikler[0]));

  // Dis cekimde adres gerekiyor; verilmisse eksik sayilmamali.
  o = await ozet([ proje('saha', { shootDate:'2026-06-18', type:'outdoor' }) ], []);
  bak('dis cekimde adres yoksa eksik',
      (o.eksikler[0]||{}).neler.indexOf('yer') !== -1, JSON.stringify(o.eksikler[0]));
  o = await ozet([ proje('saha2', { shootDate:'2026-06-18', type:'outdoor',
                                    address:'Rumeli Hisarı, İstanbul' }) ], []);
  bak('adres varsa yer eksigi yok',
      (o.eksikler[0]||{}).neler.indexOf('yer') === -1, JSON.stringify(o.eksikler[0]));

  // Kaydi olan projenin "kayit" eksigi olmamali: bag content.projectId'de.
  o = await ozet([ proje('dolu', { shootDate:'2026-06-18' }) ],
                 [ kayit('e9', { date:'2026-06-19', content:{ projectId:'dolu' } }) ]);
  bak('takvimde kaydi olanda kayit eksigi yok',
      (o.eksikler[0]||{}).neler.indexOf('kayit') === -1, JSON.stringify(o.eksikler[0]));

  console.log('[rozet sayisi ustuste binmiyor]');
  // Ilk olcumde rozet ayni isi iki kez sayiyordu: saati gecmis bir kayit
  // hem "bugun takvimde" hem "isaretlenmeyi bekleyen" listesindeydi,
  // eksikler de yaklasan cekimlerin kendisiydi. Rozet ortada olandan
  // fazlasini gosterirse kullanici ona bir daha inanmaz.
  o = await ozet([
    proje('r1', { shootDate:'2026-06-18' }),          // cekim + eksikler (2 liste)
    proje('r2', { deadlines:{ script: GUN } }),       // bugun biten termin
    proje('r3', { deadlines:{ filmed:'2026-06-01' } })// geciken adim
  ], [
    kayit('gec', { time:'08:00' })                    // bugunYayin + gecikenKayit
  ]);
  bak('dikkat yalnizca cakismayanlari sayiyor', o.dikkat === 3,
      'dikkat=' + o.dikkat + ' toplam=' + o.toplam);
  bak('toplam ustuste binenleri de sayiyor', o.toplam === 6,
      'toplam=' + o.toplam);
  bak('yaklasan cekim rozete girmiyor',
      o.cekim.length === 1 && o.dikkat === 3, 'cekim=' + o.cekim.length);

  // Yalnizca yaklasan cekimi olan biri icin rozet BOS olmali: "yarin
  // cekim var" bir uyari degil, bir bilgi.
  o = await ozet([ proje('yalniz', { shootDate:'2026-06-18' }) ], []);
  bak('sadece cekim varken rozet bos', o.dikkat === 0, 'dikkat=' + o.dikkat);
  bak('ama sayfa bos degil', o.temiz === false, 'toplam=' + o.toplam);

  console.log('[gun farki]');
  const gf = await p.evaluate(()=> ({
    ayni: gunFarki('2026-06-17','2026-06-17'),
    ileri: gunFarki('2026-06-24','2026-06-17'),
    geri: gunFarki('2026-06-10','2026-06-17'),
    // Yaz saati gecisi olan bir aralik: 24 saatlik bolme burada yaniltir.
    gecis: gunFarki('2026-04-01','2026-03-28'),
    bozuk: gunFarki('', '2026-06-17')
  }));
  bak('ayni gun 0', gf.ayni === 0, gf.ayni);
  bak('yedi gun ileri 7', gf.ileri === 7, gf.ileri);
  bak('yedi gun geri -7', gf.geri === -7, gf.geri);
  bak('saat gecisinde de 4', gf.gecis === 4, gf.gecis);
  bak('bozuk tarihte null', gf.bozuk === null, String(gf.bozuk));

  bak('js hatası yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
