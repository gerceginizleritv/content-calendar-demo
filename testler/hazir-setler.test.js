// HAZIR SETLER — kutudan cikan sekiz cekim listesi (Asama 1, 12 Kasim 2026).
//
// BU TESTIN ASIL ISI dort sessiz kaybi olcmek:
//
//  1. BIR DILDE EKSIK MADDE. Sekiz set, 63 madde, IKI LANG nesnesinde
//     ayri ayri duruyor. Birine madde eklenip otekine eklenmemesi
//     EKRANDA HICBIR SEY PATLATMAZ: Ingilizce set bir madde eksik
//     eklenir, o kadar. Sayi, SIRA ve her maddenin TURU olculuyor.
//
//  2. DONMUS GRUP BASLIGI. Maddeler listeye "Canta" / "Yap" basliklari
//     altinda giriyor. Baslik KAYDEDILSEYDI, dilini Ingilizceye ceviren
//     kullanici kendi listesinde Turkce baslik gorurdu. Kaydedilen sey
//     bir anahtar; bu test dili cevirip basliklarin DEGISTIGINI olcuyor.
//
//  3. UCUS GUNU SETINDE SAYI. Pil kurallari ulkeye ve havayoluna gore
//     degisiyor; dogrulanmamis sayi yazmak CLAUDE.md Bolum 4'un yasak
//     ettigi sey. Bu olcu o kurali KODA baglıyor: o sette rakam yok.
//
//  4. KULLANICININ KENDI VERISINE DOKUNMA. Hazir set eklemek malzeme
//     kutuphanesini ve kullanicinin kendi 20 setlik listesini
//     DEGISTIRMEMELI. Ikisi de kullanicinin elle yazdigi sey.
//
// Olculmeyen sey: setlerin IYI olup olmadigi. Onu kullanici soyler.
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
    setLanguage('tr'); setPage('projects');
  });
  await page.waitForTimeout(350);
  return { page, hatalar };
}

(async () => {
  const b = await chromium.launch({ });
  let hata = 0;
  const k = (ad, s, ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('HAZIR SETLER');

  const m = await sayfa(b, 1250);

  // ───────── 1) Iki dil birebir mi ─────────
  const dil = await m.page.evaluate(()=>{
    const oku = d=>{ setLanguage(d); return t('hset'); };
    const tr = oku('tr'), en = oku('en');
    setLanguage('tr');
    const dizi = Array.isArray(tr) && Array.isArray(en);
    if(!dizi) return { dizi:false };
    return {
      dizi: true,
      trSet: tr.length, enSet: en.length,
      sayiUyum: tr.length === en.length
        && tr.every((x,i)=> Array.isArray(x.m) && Array.isArray(en[i].m)
                            && x.m.length === en[i].m.length),
      sayilar: tr.map(x=> x.m.length),
      toplam: tr.reduce((a,x)=> a + x.m.length, 0),
      // Tur SIRASI da ayni olmali: "en cok unutulan en ustte" kurali
      // iki dilde ayni sirayi gerektiriyor.
      // ⚠ `en[i].m[j]` EKSIK OLABILIR: tam o yuzden olculuyor. Guard
      // olmadan test cokuyordu, yani hatayi BILDIRMEK yerine yikiliyordu
      // -- mutasyon denemesinde goruldu ve burada duzeltildi.
      turUyum: tr.every((x,i)=> x.m.every((y,j)=>
        en[i] && en[i].m[j] && y[0] === en[i].m[j][0])),
      gecerliTur: tr.every(x=> x.m.every(y=> y[0] === 'canta' || y[0] === 'yap')),
      // Cevirisi yapilmamis: iki dilde birebir ayni metin.
      cevrilmeyen: tr.reduce((a,x,i)=>
        a.concat(x.m.filter((y,j)=> en[i] && en[i].m[j] && y[1] === en[i].m[j][1])
          .map(y=> y[1])), []),
      adlarFarkli: tr.every((x,i)=> en[i] && x.ad !== en[i].ad),
      bosMetin: tr.concat(en).some(x=> !x.ad.trim() || x.m.some(y=> !String(y[1]).trim())),
      // ⛔ CLAUDE.md Bolum 4: dogrulanmamis sayi yazilmaz.
      ucusRakam: [].concat(
        tr.filter(x=> /Uçuş/.test(x.ad)).flatMap(x=> x.m.filter(y=> /\d/.test(y[1])).map(y=> y[1])),
        en.filter(x=> /Flying/.test(x.ad)).flatMap(x=> x.m.filter(y=> /\d/.test(y[1])).map(y=> y[1])))
    };
  });
  k('sekiz set, iki dilde de', dil.dizi && dil.trSet === 8 && dil.enSet === 8,
     dil.trSet + ' / ' + dil.enSet);
  k('★ İKİ DİLDE AYNI SAYIDA MADDE', dil.sayiUyum === true,
     (dil.sayilar || []).join(',') + ' (toplam ' + dil.toplam + ')');
  k('★ her maddenin TÜRÜ iki dilde aynı', dil.turUyum === true);
  k('tür yalnızca canta/yap', dil.gecerliTur === true);
  k('★ çevrilmemiş madde yok', (dil.cevrilmeyen || []).length === 0,
     (dil.cevrilmeyen || []).slice(0,3).join(' | ') || '63 maddenin hepsi çevrildi');
  k('set adları iki dilde farklı', dil.adlarFarkli === true);
  k('boş metin yok', dil.bosMetin === false);
  k('★ UÇUŞ GÜNÜ SETİNDE RAKAM YOK', (dil.ucusRakam || []).length === 0,
     (dil.ucusRakam || []).join(' | ') || 'iki dilde de temiz');

  // ───────── 2) Bos ekran ─────────
  const bos = await m.page.evaluate(async ()=>{
    const pr = { id:'p_hset_bos', name:'Boş Proje', checklist:[] };
    projects.push(pr); saveProjects();
    cekimListesiAc('p_hset_bos');
    await new Promise(r=> setTimeout(r, 250));
    return {
      // ⚠ cekim-listesi testi tam olarak BU sayiyi olcuyor. Hazir set
      // blogu .cl-bos'un DISINDA duruyor ki o olcu bozulmasin.
      bosLi: document.querySelectorAll('#cl_liste .cl-bos li').length,
      blokIcinde: !!document.querySelector('#cl_liste .cl-bos .hset-cip'),
      bosCip: document.querySelectorAll('.hset-bos .hset-cip').length,
      seritCip: document.querySelectorAll('#cl_hset .hset-cip').length,
      seritAcik: document.getElementById('cl_hsetFold').open,
      // ⚠ MASAUSTUNDE SERIT GORUNUYOR MU. `.fold > summary` 701
      // pikselin ustunde display:none; pencere icindeki katlar icin
      // `fold-modal` istisnasi var. O sinif unutuldu ve serit
      // masaustunde TAMAMEN KAYBOLDU -- ekran goruntusunde goruldu,
      // olcumde degil. Bu satir o bosluğu kapatiyor.
      seritYuksek: Math.round(document.getElementById('cl_hsetFold')
        .getBoundingClientRect().height),
      seritBaslikGorunur: getComputedStyle(
        document.querySelector('#cl_hsetFold summary')).display !== 'none',
      sayilarCipte: [...document.querySelectorAll('.hset-bos .hset-cip b')].map(x=> Number(x.textContent))
    };
  });
  k('boş ekranda üç kaynak hâlâ anlatılıyor', bos.bosLi === 3, String(bos.bosLi));
  k('★ hazır set bloğu .cl-bos\'un DIŞINDA (eski ölçü bozulmuyor)', bos.blokIcinde === false);
  k('boş ekranda sekiz çip', bos.bosCip === 8, String(bos.bosCip));
  k('şeritte de sekiz çip', bos.seritCip === 8, String(bos.seritCip));
  k('şerit kapalı başlıyor', bos.seritAcik === false);
  k('★ ŞERİT MASAÜSTÜNDE GÖRÜNÜYOR (fold-modal tuzağı)',
     bos.seritBaslikGorunur === true && bos.seritYuksek > 0,
     'yükseklik ' + bos.seritYuksek + ' px');
  k('çipler madde sayısını yazıyor', String(bos.sayilarCipte) === String(dil.sayilar),
     String(bos.sayilarCipte));

  // ───────── 3) Set eklemek ─────────
  const ekle = await m.page.evaluate(async ()=>{
    const kutupOnce = JSON.stringify(ihtiyaclar);
    const setOnce = JSON.stringify(ihtiyacSetleri);
    document.querySelector('.hset-bos .hset-cip').click();
    await new Promise(r=> setTimeout(r, 250));
    const l = projectById('p_hset_bos').checklist;
    const kaynak = t('hset')[0].m;
    return {
      sayi: l.length, beklenen: kaynak.length,
      kaynaklar: [...new Set(l.map(x=> x.kaynak))].sort().join(','),
      // ⛔ Kullanicinin kendi verisi: ikisi de DEGISMEMELI.
      kutuphaneAyni: JSON.stringify(ihtiyaclar) === kutupOnce,
      setlerAyni: JSON.stringify(ihtiyacSetleri) === setOnce,
      // Sira korunuyor mu: "en cok unutulan en ustte".
      siraAyni: l.every((x,i)=> x.metin === kaynak[i][1] && x.kaynak === kaynak[i][0]),
      isaretsiz: l.every(x=> x.bitti === false),
      gruplar: [...new Set([...document.querySelectorAll('#cl_liste .cl-grup, #cl_liste h4')]
        .map(x=> x.textContent.trim()))]
    };
  });
  k('set bütün maddelerini ekliyor', ekle.sayi === ekle.beklenen,
     ekle.sayi + '/' + ekle.beklenen);
  k('maddeler canta/yap kaynağıyla giriyor', ekle.kaynaklar === 'canta,yap', ekle.kaynaklar);
  k('★ MALZEME KÜTÜPHANESİ DEĞİŞMİYOR', ekle.kutuphaneAyni === true);
  k('★ kullanıcının kendi setleri DEĞİŞMİYOR', ekle.setlerAyni === true);
  k('sıra korunuyor', ekle.siraAyni === true);
  k('hiçbiri işaretli gelmiyor', ekle.isaretsiz === true);
  k('listede "Çanta" ve "Yap" başlıkları', ekle.gruplar.join(',') === 'Yap,Çanta', ekle.gruplar.join(','));

  // ───────── 4) Donmus baslik tuzagi ─────────
  const cevir = await m.page.evaluate(async ()=>{
    setLanguage('en'); cekimListesiCiz();
    await new Promise(r=> setTimeout(r, 150));
    const en = [...new Set([...document.querySelectorAll('#cl_liste .cl-grup, #cl_liste h4')]
      .map(x=> x.textContent.trim()))];
    const seritEN = document.querySelector('#cl_hsetFold summary').textContent.trim();
    setLanguage('tr'); cekimListesiCiz();
    await new Promise(r=> setTimeout(r, 150));
    const tr = [...new Set([...document.querySelectorAll('#cl_liste .cl-grup, #cl_liste h4')]
      .map(x=> x.textContent.trim()))];
    return { en, tr, seritEN, seritTR: document.querySelector('#cl_hsetFold summary').textContent.trim() };
  });
  k('★ GRUP BAŞLIKLARI DİLLE DEĞİŞİYOR (donmuş metin değil)',
     cevir.en.join(',') === 'Do,Bring' && cevir.tr.join(',') === 'Yap,Çanta',
     cevir.en.join(',') + ' / ' + cevir.tr.join(','));
  k('şerit başlığı da çevriliyor', cevir.seritEN !== cevir.seritTR,
     cevir.seritEN + ' / ' + cevir.seritTR);

  // ───────── 5) Ikinci kez ayni set ─────────
  const tekrar = await m.page.evaluate(async ()=>{
    const once = projectById('p_hset_bos').checklist.length;
    hazirSetiEkle(0);
    await new Promise(r=> setTimeout(r, 200));
    const ortada = projectById('p_hset_bos').checklist.length;
    // Baska bir setin maddeleri EKLENIYOR: tekrar engeli metne bakiyor,
    // sete degil.
    hazirSetiEkle(4);
    await new Promise(r=> setTimeout(r, 200));
    return { once, ortada, sonra: projectById('p_hset_bos').checklist.length,
             besinciSayi: t('hset')[4].m.length };
  });
  k('aynı set ikinci kez madde eklemiyor', tekrar.once === tekrar.ortada,
     tekrar.once + ' → ' + tekrar.ortada);
  k('başka bir set ekleniyor', tekrar.sonra === tekrar.ortada + tekrar.besinciSayi,
     tekrar.ortada + ' + ' + tekrar.besinciSayi + ' = ' + tekrar.sonra);

  // ───────── 6) Baska proje etkilenmiyor ─────────
  const digeri = await m.page.evaluate(()=>
    projects.filter(p=> p.id !== 'p_hset_bos')
      .every(p=> (p.checklist || []).every(x=> x.kaynak !== 'canta' && x.kaynak !== 'yap')));
  k('★ başka projelerin listesine hiçbir şey girmiyor', digeri === true);

  k('masaüstünde sayfa hatası yok', m.hatalar.length === 0, m.hatalar.slice(0,2).join(' | '));
  await m.page.close();

  // ───────── 7) Telefon ─────────
  const f = await sayfa(b, 390);
  const fo = await f.page.evaluate(async ()=>{
    const pr = { id:'p_hset_f', name:'Telefon Projesi', checklist:[] };
    projects.push(pr); saveProjects();
    cekimListesiAc('p_hset_f');
    await new Promise(r=> setTimeout(r, 250));
    const cipler = [...document.querySelectorAll('.hset-bos .hset-cip')];
    const y = cipler.map(x=> Math.round(x.getBoundingClientRect().height));
    const sar = document.querySelector('#cekimListesiOverlay .modal');
    return {
      cipSayi: cipler.length,
      enKisaCip: Math.min(...y),
      // Pencere yana kaymiyor mu
      tasma: sar.scrollWidth - sar.clientWidth,
      belge: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // Cip metni kirpilmiyor mu
      kesik: cipler.filter(x=> x.scrollWidth > x.clientWidth + 1).map(x=> x.textContent.trim())
    };
  });
  k('telefonda sekiz çip', fo.cipSayi === 8, String(fo.cipSayi));
  k('★ çipler telefonda kırpılmıyor', fo.kesik.length === 0, fo.kesik.join(', ') || 'sekizi de tam');
  k('★ pencere yana kaymıyor', fo.tasma === 0 && fo.belge === 0,
     'pencere ' + fo.tasma + ' / belge ' + fo.belge);
  // ⚠ 28 DEGIL 44. Uygulamanin kendi .ih-set cipleri 28 piksel; bu
  // cipler bos ekranin asil dugmesi oldugu icin bilerek buyuk.
  k('★ çip dokunma hedefi ≥44 px', fo.enKisaCip >= 44, fo.enKisaCip + ' px');

  k('telefonda sayfa hatası yok', f.hatalar.length === 0, f.hatalar.slice(0,2).join(' | '));
  await f.page.close();

  await b.close();
  console.log(hata ? '\n' + hata + ' KALDI' : '\nhepsi gecti');
  process.exit(hata ? 1 : 0);
})();
