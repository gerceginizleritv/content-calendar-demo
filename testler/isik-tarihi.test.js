// ISIK BILGISI CEKIM TARIHINE GORE (Asama 3, 12 Kasim 2026).
//
// Gunes hesabi zaten her tarih icin calisiyordu; tek engel ekrana yazan
// parcanin tarihi "bugun" diye SABIT almasiydi. Bu testin asil isi dort
// sessiz kaybi olcmek:
//
//  1. TARIH GERCEKTEN KULLANILIYOR MU. Bir parametre eklemek kolay,
//     kullanildigini SANMAK da kolay. Olcu fiziksel: kuzey yarimkurede
//     21 Haziran gunu 21 Aralik gununden UZUN olmak ZORUNDA. Tarih
//     yolda bir yerde dusurulurse iki gun birebir ayni cikar ve bu
//     satir duser. "Farkli gorunuyor" demiyor, FARKLI OLMAK ZORUNDA
//     olani olcuyor.
//
//  2. SESSIZCE YANLIS SAAT. Saat dilimi mekanin KAYITLI alanindan
//     geliyor. Dilim yoksa satir HIC yazilmamali; tarayicinin dilimine
//     dusmek baska ulkedeki bir mekan icin yanlis saat demek (olculdu:
//     ayni mekan UTC tarayicida 15:00, Istanbul'da 18:00). Hic saat
//     olmamasindan KOTU bir sey.
//
//  3. AG CAGRISI. Isik hesabi yerel. Proje penceresi acilirken ag
//     istegi atilmasi sessiz bir yavaslama olurdu; istekler sayiliyor.
//
//  4. ESKI DAVRANISIN BOZULMASI. isikHtml'in uc eski cagirani var ve
//     ucu de tarih VERMIYOR. Tarihsiz cagri bugunu vermeye devam
//     etmeli; telefondaki kisa satir da bugun icin eskisi gibi
//     "siradaki" altin saati yazmali. Ilk yazimda tam orasi bozuldu.
const { chromium } = require('./araclar');
const PORT = process.argv[2] || '8098';
const ADRES = 'http://127.0.0.1:' + PORT + '/app.html';

// Bergama Akropolu. Kuzey yarimkure, dilimi kayitli.
const KUR = `(()=>{
  const m = { id:'mk_t', name:'Bergama Akropolü', lat:39.1317, lon:27.1842,
              timezone:'Europe/Istanbul', address:'Bergama', permission:'', cautions:'' };
  const m2 = { id:'mk_tz_yok', name:'Dilimsiz Yer', lat:40, lon:30, timezone:'', address:'' };
  mekanlar.push(m, m2);
  const pr = { id:'p_t', name:'Bergama Çekimi', shootDate:'', placeIds:['mk_t'] };
  projects.push(pr); saveProjects();
})()`;

function dakika(hhmm){
  const p = String(hhmm).split(':').map(Number);
  return p.length === 2 && p.every(Number.isFinite) ? p[0]*60 + p[1] : NaN;
}

(async () => {
  const b = await chromium.launch({ });
  let hata = 0;
  const k = (ad, s, ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('ÇEKİM GÜNÜNDE IŞIK');

  const page = await b.newPage({ viewport:{width:1250,height:950} });
  const hatalar = [];
  page.on('pageerror', e=> hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  // HAVA SERVISINE istek sayiliyor: isik hesabi yerel olmali, mekanin
  // dilimi kayitli alandan gelmeli. Sayfanin kendi acilis kaynaklari
  // (yazi tipi, supabase) bu olcunun konusu DEGIL -- ilk yazimda
  // onlari da saydi ve olcu yanlis yere isaret etti.
  const agIstek = [];
  page.on('request', r=>{ if(/open-meteo\.com/.test(r.url())) agIstek.push(r.url()); });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/goatcounter**', r=> r.abort());
  await page.goto(ADRES, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr'); setPage('projects');
  });
  await page.evaluate(KUR);
  await page.waitForTimeout(300);

  // ───────── 1) TARIH GERCEKTEN KULLANILIYOR MU ─────────
  const gun = await page.evaluate(()=>{
    const m = mekanById('mk_t'); const kk = mekanKonumu(m);
    const al = ymd=>{ const i = gunIsigi(kk.en, kk.boy, ymd);
      return { d: havaSaat(i.dogus, 'Europe/Istanbul'),
               b: havaSaat(i.batis, 'Europe/Istanbul') }; };
    return { kis: al('2026-12-21'), yaz: al('2026-06-21'), ara: al('2026-03-20') };
  });
  const uzunluk = x=> dakika(x.b) - dakika(x.d);
  k('kış ve yaz değerleri FARKLI',
     gun.kis.d !== gun.yaz.d && gun.kis.b !== gun.yaz.b,
     '21 Ara ' + gun.kis.d + '–' + gun.kis.b + ' | 21 Haz ' + gun.yaz.d + '–' + gun.yaz.b);
  // ★ Fizik: kuzey yarimkurede yaz gunu kis gununden uzun.
  k('★ 21 HAZİRAN GÜNÜ 21 ARALIK\'TAN UZUN (kuzey yarımküre)',
     uzunluk(gun.yaz) > uzunluk(gun.kis) + 120,
     Math.round(uzunluk(gun.yaz)/60*10)/10 + ' saat / '
     + Math.round(uzunluk(gun.kis)/60*10)/10 + ' saat');
  // Ekinoks: gun ~12 saat. Genis pay, hesabin kabaca dogru oldugunu tutar.
  k('ekinoksta gün ≈ 12 saat',
     Math.abs(uzunluk(gun.ara) - 720) < 25, Math.round(uzunluk(gun.ara)) + ' dakika');
  k('doğuş her zaman batıştan önce',
     [gun.kis, gun.yaz, gun.ara].every(x=> dakika(x.d) < dakika(x.b)));

  // ───────── 2) Eski cagri bugunu vermeye devam ediyor ─────────
  const eski = await page.evaluate(()=>{
    const m = mekanById('mk_t'); const kk = mekanKonumu(m);
    const a = isikHtml(kk.en, kk.boy, 'Europe/Istanbul', false);
    const bq = isikHtml(kk.en, kk.boy, 'Europe/Istanbul', false, bugunYmd());
    const kisa = h=>{ const d = document.createElement('div'); d.innerHTML = h;
      return (d.querySelector('.hv-kisa') || {}).textContent || ''; };
    // Bugunun kisa hali: "siradaki" altin saat. Gelecek bir gun icin
    // aksaminki. Ikisi ayni cikarsa kisa satir bugun icin bozulmustur.
    const yarin = new Date(); yarin.setDate(yarin.getDate() + 30);
    const ileri = isikHtml(kk.en, kk.boy, 'Europe/Istanbul', false,
      yarin.toISOString().slice(0,10));
    return { ayni: a === bq, bugunKisa: kisa(a), ileriKisa: kisa(ileri),
             ileriIkiAltin: (ileri.match(/·/g) || []).length > 0,
             bugunTekAltin: (a.match(/·/g) || []).length === 0 };
  });
  k('★ TARİHSİZ ÇAĞRI BUGÜNÜ VERİYOR (eski üç çağıran bozulmadı)', eski.ayni === true);
  k('bugünün dar satırında TEK altın saat (eski davranış)', eski.bugunTekAltin === true);
  k('★ GELECEK GÜNDE İKİ altın saat de yazılıyor', eski.ileriIkiAltin === true,
     'ileri kısa: ' + eski.ileriKisa);

  // ───────── 3) Proje penceresi ─────────
  const pen = await page.evaluate(async ()=>{
    openProjectEdit('p_t');
    await new Promise(r=> setTimeout(r, 250));
    const sar = document.getElementById('pe_isikWrap');
    const tarihsiz = sar.hidden;
    const g = document.getElementById('pe_shoot');
    g.value = '2026-12-21'; g.dispatchEvent(new Event('change'));
    await new Promise(r=> setTimeout(r, 150));
    const kis = document.getElementById('pe_isik').textContent.replace(/\s+/g,' ').trim();
    const baslik = document.getElementById('pe_isikBas').textContent;
    g.value = '2026-06-21'; g.dispatchEvent(new Event('change'));
    await new Promise(r=> setTimeout(r, 150));
    const yaz = document.getElementById('pe_isik').textContent.replace(/\s+/g,' ').trim();
    // Dilimi olmayan mekan: satir HIC olmamali.
    mekanSecimiDoldur('', 'pe', ['mk_tz_yok']);
    await new Promise(r=> setTimeout(r, 150));
    const dilimsiz = sar.hidden;
    // Iki durak, biri dilimli: dilimli olan secilmeli.
    mekanSecimiDoldur('', 'pe', ['mk_tz_yok','mk_t']);
    await new Promise(r=> setTimeout(r, 150));
    return { tarihsiz, kis, yaz, baslik, dilimsiz,
             ikisi: !sar.hidden,
             ikisiBaslik: document.getElementById('pe_isikBas').textContent };
  });
  k('tarih yokken satır yok', pen.tarihsiz === true);
  k('tarih girilince beliriyor', pen.kis.length > 10, pen.kis.slice(0,42));
  k('★ TARİH DEĞİŞİNCE DEĞERLER DEĞİŞİYOR', pen.kis !== pen.yaz,
     pen.kis.slice(0,18) + '  ≠  ' + pen.yaz.slice(0,18));
  k('başlıkta durağın adı var', /Bergama/.test(pen.baslik), pen.baslik);
  k('★ DİLİMİ OLMAYAN MEKANDA SATIR HİÇ YOK', pen.dilimsiz === true);
  k('iki duraktan dilimli olan seçiliyor',
     pen.ikisi === true && /Bergama/.test(pen.ikisiBaslik), pen.ikisiBaslik);

  // ───────── 4) Bugun sayfasi ─────────
  const bg = await page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    const pr = projectById('p_t');
    const d = new Date(); d.setDate(d.getDate() + 3);
    pr.shootDate = d.toISOString().slice(0,10);
    pr.placeIds = ['mk_t']; saveProjects();
    // Bugun cekimi olan ikinci bir proje
    const bugunPr = { id:'p_t2', name:'Bugünkü Çekim',
      shootDate: (new Date()).toISOString().slice(0,10), placeIds:['mk_t'] };
    projects.push(bugunPr); saveProjects();
    setPage('bugun');
    await new Promise(r=> setTimeout(r, 500));
    const satir = ad=> [...document.querySelectorAll('#bugunGovde .bg-liste li')]
      .map(x=> x.textContent.replace(/\s+/g,' ').trim())
      .find(x=> x.indexOf(ad) !== -1) || '';
    return { yaklasan: satir('Bergama Çekimi'), bugunku: satir('Bugünkü Çekim') };
  });
  k('★ YAKLAŞAN ÇEKİM SATIRINDA O GÜNÜN ALTIN SAATİ',
     /\u{1F305}/u.test(bg.yaklasan) && /\d\d:\d\d/.test(bg.yaklasan), bg.yaklasan);
  k('bugünkü çekim satırında tekrar edilmiyor',
     bg.bugunku.length > 0 && !/\u{1F305}/u.test(bg.bugunku), bg.bugunku);

  // ───────── 5) Ag cagrisi ─────────
  k('★ HAVA SERVİSİNE HİÇ İSTEK ATILMADI (ışık yerel hesap)', agIstek.length === 0,
     agIstek.slice(0,2).join(' | ') || '0 istek');

  // ───────── 6) Iki dil ─────────
  const dil = await page.evaluate(async ()=>{
    setPage('projects'); openProjectEdit('p_t');
    await new Promise(r=> setTimeout(r, 250));
    const g = document.getElementById('pe_shoot');
    g.value = '2026-06-21'; g.dispatchEvent(new Event('change'));
    await new Promise(r=> setTimeout(r, 150));
    const tr = document.getElementById('pe_isikBas').textContent;
    setLanguage('en'); openProjectEdit('p_t');
    await new Promise(r=> setTimeout(r, 250));
    const en = document.getElementById('pe_isikBas').textContent;
    setLanguage('tr');
    return { tr, en };
  });
  k('başlık iki dilde de yazılı ve farklı',
     dil.tr.length > 5 && dil.en.length > 5 && dil.tr !== dil.en,
     dil.tr + ' / ' + dil.en);

  k('sayfa hatası yok', hatalar.length === 0, hatalar.slice(0,2).join(' | '));
  await page.close();
  await b.close();
  console.log(hata ? '\n' + hata + ' KALDI' : '\nhepsi gecti');
  process.exit(hata ? 1 : 0);
})();
