// YAYIN GUNU LISTESI (Asama 2, 12 Kasim 2026).
//
// Kaydin platformuna ve turune gore kisa liste: ONCE / YUKLEME
// EKRANINDA / HEMEN SONRA. Bu testin asil isi bes sessiz kaybi olcmek:
//
//  1. KAYDIN VERISINE DOKUNMA. Liste OKUNACAK SEY. Pencereyi acip
//     kapamak kaydi degistirmemeli. Tik atilabilir hali kayda yeni bir
//     alan ekler ve o alanin sanitizeEvent / toRow / bulut / yedek /
//     paylasim / MCP yollarindan ayri ayri gecmesi gerekirdi --
//     CLAUDE.md Bolum 5'te yazili UC ayri hata tam bu aileden ve
//     ucu de SESSIZ kayipti. Bu olcu o kapiyi kapali tutuyor.
//
//  2. BIR DILDE EKSIK MADDE. 10 liste, 47 madde, iki LANG nesnesinde
//     ayri ayri. Sayi, ASAMA SIRASI ve [hesap] isareti olculuyor;
//     birinde eksik olani ekranda hicbir sey patlatmaz.
//
//  3. YANLIS ANDA GORUNME. Liste YAYIN GUNU icin. Yeni kayit
//     penceresinde platform ve tur COKLU secilebiliyor; orada dort
//     ayri liste birden acilirdi.
//
//  4. `fold-modal` TUZAGI. `.fold > summary` 701 pikselin ustunde
//     display:none; pencere icindeki katlar icin istisna var. O sinif
//     unutulursa bolum MASAUSTUNDE TAMAMEN KAYBOLUR. Asama 1'de tam
//     bu oldu ve olcum degil ekran goruntusu yakaladi.
//
//  5. ERTELENEN SORUNUN GERI KONMASI. Asama 4'te "Platformun yayin
//     gunu listesi tamam mi?" sorusu ERTELENMISTI, cunku o gun bu
//     liste yoktu. Simdi var; soru da geri kondu.
const { chromium } = require('./araclar');
const PORT = process.argv[2] || '8098';
const ADRES = 'http://127.0.0.1:' + PORT + '/app.html';

async function sayfa(b, genislik){
  const page = await b.newPage({ viewport:{width:genislik, height:950} });
  const hatalar = [];
  page.on('pageerror', e=> hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/goatcounter**', r=> r.abort());
  await page.goto(ADRES, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr'); setPage('calendar');
  });
  await page.waitForTimeout(350);
  return { page, hatalar };
}

(async () => {
  const b = await chromium.launch({ });
  let hata = 0;
  const k = (ad, s, ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('YAYIN GÜNÜ LİSTESİ');

  const m = await sayfa(b, 1250);

  // ───────── 1) Iki dil ─────────
  const dil = await m.page.evaluate(()=>{
    const oku = d=>{ setLanguage(d); return t('yl'); };
    const tr = oku('tr'), en = oku('en');
    setLanguage('tr');
    const anah = Object.keys(tr);
    const gecerliAsama = x=> ['once','icinde','sonra'].indexOf(x) !== -1;
    return {
      anahtarSayi: anah.length,
      anahtarAyni: JSON.stringify(anah) === JSON.stringify(Object.keys(en)),
      sayilar: anah.map(x=> tr[x].length),
      toplam: anah.reduce((a,x)=> a + tr[x].length, 0),
      sayiUyum: anah.every(x=> en[x] && tr[x].length === en[x].length),
      // Asama SIRASI da ayni olmali: belge once/icinde/sonra diye
      // siraladi, iki dilde ayni siray tutmali.
      asamaUyum: anah.every(x=> tr[x].every((y,i)=> en[x] && en[x][i] && y[0] === en[x][i][0])),
      gecerliAsama: anah.every(x=> tr[x].every(y=> gecerliAsama(y[0]))),
      hesapUyum: anah.every(x=> tr[x].every((y,i)=> en[x] && en[x][i] && !!y[2] === !!en[x][i][2])),
      hesapSayi: anah.reduce((a,x)=> a + tr[x].filter(y=> y[2]).length, 0),
      cevrilmeyen: anah.reduce((a,x)=>
        a.concat(tr[x].filter((y,i)=> en[x] && en[x][i] && y[1] === en[x][i][1]).map(y=> y[1])), []),
      bos: anah.some(x=> tr[x].concat(en[x]).some(y=> !String(y[1]).trim())),
      // Erteленen dorduncu soru geri kondu mu
      yayinSoru: t('soru_published').length,
      yayinSoruSon: t('soru_published')[t('soru_published').length - 1]
    };
  });
  k('on liste, iki dilde aynı anahtarlar',
     dil.anahtarSayi === 10 && dil.anahtarAyni === true, String(dil.anahtarSayi));
  k('★ İKİ DİLDE AYNI SAYIDA MADDE', dil.sayiUyum === true,
     dil.sayilar.join(',') + ' (toplam ' + dil.toplam + ')');
  k('★ AŞAMA SIRASI iki dilde aynı', dil.asamaUyum === true);
  k('aşama yalnızca once/icinde/sonra', dil.gecerliAsama === true);
  k('★ [hesap] işareti iki dilde aynı maddelerde', dil.hesapUyum === true,
     dil.hesapSayi + ' madde hesaba bağlı');
  k('★ çevrilmemiş madde yok', dil.cevrilmeyen.length === 0,
     dil.cevrilmeyen.slice(0,3).join(' | ') || '47 maddenin hepsi çevrildi');
  k('boş metin yok', dil.bos === false);
  k('★ ERTELENEN DÖRDÜNCÜ SORU GERİ KONDU',
     dil.yayinSoru === 4 && /liste/i.test(dil.yayinSoruSon),
     dil.yayinSoru + ' soru · son: ' + dil.yayinSoruSon);

  // ───────── 2) Var olan kayitta ─────────
  const kayit = await m.page.evaluate(async ()=>{
    const ev = { id:'ev_yl', date:'2026-11-20', time:'19:00', platform:'youtube',
                 type:'video', title:'Deneme', content:{} };
    events.push(ev);
    openModal(ev);
    await new Promise(r=> setTimeout(r, 350));
    const kat = document.getElementById('f_yayinFold');
    const oku = ()=> ({
      gizli: kat.hidden,
      asama: [...document.querySelectorAll('#f_yayinListe .yl-asama h4')].map(x=> x.textContent),
      madde: document.querySelectorAll('#f_yayinListe li').length,
      hesap: document.querySelectorAll('#f_yayinListe .yl-hesap').length,
      // ⛔ TIK YOK: listenin icinde hicbir giris ogesi olmamali.
      giris: document.querySelectorAll('#f_yayinListe input, #f_yayinListe button,'
        + ' #f_yayinListe select, #f_yayinListe textarea').length,
      // fold-modal tuzagi: masaustunde baslik gorunuyor mu
      baslikGorunur: getComputedStyle(kat.querySelector('summary')).display !== 'none',
      yukseklik: Math.round(kat.getBoundingClientRect().height)
    });
    const yt = oku();
    const degistir = async (pf, tur)=>{
      if(pf){ const e = document.getElementById('f_platform');
        e.value = pf; e.dispatchEvent(new Event('change')); }
      if(tur){ const e = document.getElementById('f_type');
        e.value = tur; e.dispatchEvent(new Event('change')); }
      await new Promise(r=> setTimeout(r, 200));
    };
    await degistir('tiktok', null); const tt = oku();
    await degistir('instagram', 'carousel'); const ig = oku();
    await degistir(null, 'story'); const story = oku();
    return { yt, tt, ig, story };
  });
  k('YouTube videoda üç aşama, dokuz madde',
     kayit.yt.gizli === false && kayit.yt.asama.length === 3 && kayit.yt.madde === 9,
     kayit.yt.asama.join(' / ') + ' · ' + kayit.yt.madde + ' madde');
  k('bir madde "hesabına bağlı" işaretli', kayit.yt.hesap === 1, String(kayit.yt.hesap));
  k('★ LİSTEDE HİÇBİR GİRİŞ ÖĞESİ YOK (tik değil, okuma)',
     kayit.yt.giris === 0, kayit.yt.giris + ' öğe');
  k('★ BAŞLIK MASAÜSTÜNDE GÖRÜNÜYOR (fold-modal tuzağı)',
     kayit.yt.baslikGorunur === true && kayit.yt.yukseklik > 0,
     'yükseklik ' + kayit.yt.yukseklik + ' px');
  k('★ PLATFORM DEĞİŞİNCE LİSTE DEĞİŞİYOR',
     kayit.tt.madde === 5 && kayit.tt.asama.length === 2,
     'TikTok ' + kayit.tt.madde + ' madde, ' + kayit.tt.asama.length + ' aşama');
  k('tür değişince de değişiyor', kayit.ig.madde === 3,
     'Instagram carousel ' + kayit.ig.madde + ' madde');
  k('★ LİSTESİ OLMAYAN ÇİFTTE BÖLÜM HİÇ YOK (instagram/story)',
     kayit.story.gizli === true);

  // ───────── 3) ⛔ KAYDIN VERISI DEGISMIYOR ─────────
  const veri = await m.page.evaluate(async ()=>{
    closeModal(); await new Promise(r=> setTimeout(r, 200));
    const ev = events.find(x=> x.id === 'ev_yl');
    // Listesi olan bir cifte geri al
    ev.platform = 'youtube'; ev.type = 'video';
    const once = JSON.stringify(ev);
    // ⚠ Burada once 'demo_events' yaziyordu ve O ANAHTAR YOK: iki
    // okuma da null donuyor, olcu her zaman geciyordu. Gercek anahtar
    // storageKey() -- hesaba gore degisiyor.
    const anahtar = storageKey();
    const yerelOnce = localStorage.getItem(anahtar);
    openModal(ev); await new Promise(r=> setTimeout(r, 350));
    // Listeyi ac, icinde gezin
    document.getElementById('f_yayinFold').open = true;
    document.querySelectorAll('#f_yayinListe li').forEach(x=> x.click());
    await new Promise(r=> setTimeout(r, 200));
    closeModal(); await new Promise(r=> setTimeout(r, 250));
    const sonra = JSON.stringify(events.find(x=> x.id === 'ev_yl'));
    return { ayni: once === sonra, yerelAyni: yerelOnce === localStorage.getItem(anahtar),
             anahtar, yerelVar: yerelOnce !== null,
             once: once.slice(0,70), sonra: sonra.slice(0,70) };
  });
  // ⚠ MUTASYON DENEMESINDE OGRENILDI: koda `currentEvent.ylBakildi =
  // true` eklemek bu olcuyu DUSURMEDI, cunku sanitizeEvent tanimadigi
  // alani SESSIZCE DUSURUYOR. Yani kayda naifçe yeni bir alan eklemek
  // hicbir yerde patlamadan kaybolur -- CLAUDE.md Bolum 5'te yazili
  // tuzagin ta kendisi. Olcu, kaydin SAKLANAN halini tutuyor; bir
  // alanin gercekten gectigini gostermek ayri bir is olurdu.
  k('★ PENCEREYİ AÇIP KAPAMAK KAYDI DEĞİŞTİRMİYOR', veri.ayni === true,
     veri.ayni ? 'bayt bayt aynı' : veri.sonra);
  // Olcunun BOSA CALISMADIGI da olculuyor: anahtar gercekten dolu mu.
  k('tarayıcı kaydı okunabiliyor (ölçü boşa çalışmıyor)', veri.yerelVar === true,
     veri.anahtar);
  k('★ tarayıcı kaydı da değişmiyor', veri.yerelAyni === true);

  // ───────── 4) Yeni kayitta yok ─────────
  const yeni = await m.page.evaluate(async ()=>{
    openModal(null); await new Promise(r=> setTimeout(r, 350));
    const g = document.getElementById('f_yayinFold').hidden;
    closeModal(); await new Promise(r=> setTimeout(r, 150));
    return g;
  });
  k('★ YENİ KAYIT PENCERESİNDE YOK (bu liste yayın günü için)', yeni === true);

  k('masaüstünde sayfa hatası yok', m.hatalar.length === 0, m.hatalar.slice(0,2).join(' | '));
  await m.page.close();

  // ───────── 5) Telefon ─────────
  const f = await sayfa(b, 390);
  const fo = await f.page.evaluate(async ()=>{
    const ev = { id:'ev_yl2', date:'2026-11-20', time:'19:00', platform:'instagram',
                 type:'reels', title:'Deneme', content:{} };
    events.push(ev);
    openModal(ev); await new Promise(r=> setTimeout(r, 350));
    document.getElementById('f_yayinFold').open = true;
    await new Promise(r=> setTimeout(r, 200));
    const modal = document.querySelector('#editOverlay .modal');
    return { madde: document.querySelectorAll('#f_yayinListe li').length,
      tasma: modal.scrollWidth - modal.clientWidth,
      belge: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      baslikYuksek: Math.round(
        document.querySelector('#f_yayinFold summary').getBoundingClientRect().height) };
  });
  k('telefonda liste açılıyor', fo.madde === 8, fo.madde + ' madde');
  k('★ pencere yana kaymıyor', fo.tasma === 0 && fo.belge === 0,
     'pencere ' + fo.tasma + ' / belge ' + fo.belge);
  k('başlığın dokunma hedefi ≥44 px', fo.baslikYuksek >= 44, fo.baslikYuksek + ' px');

  k('telefonda sayfa hatası yok', f.hatalar.length === 0, f.hatalar.slice(0,2).join(' | '));
  await f.page.close();

  await b.close();
  console.log(hata ? '\n' + hata + ' KALDI' : '\nhepsi gecti');
  process.exit(hata ? 1 : 0);
})();
