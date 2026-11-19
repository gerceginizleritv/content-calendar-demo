// UYGULAMA ICINDE "AYARLAR" SAYFASI  (YAPILACAKLAR 58)
//
// NEDEN BU TEST VAR
//   Kullanici 18 Kasim 2026: "App icerisinde de dil tusu var, bu tusu
//   da app'e uygun sekilde duzeltmemiz lazim. Daha once sana
//   yazdigim gibi bazi basliklari app icerisinde settings gibi bir
//   sayfaya alip her seyi tipki projects'te oldugu gibi SAYFA gibi
//   olusturup kullanicinin ayarlarini yapmasini isteyebiliriz. AI,
//   hesap etiketleri, konum, dil vs."
//   Ayarlar yan menunun dibinde dagniktı ve her biri kucuk bir
//   pencere aciyordu. 50. maddede proje duzenleme ayni gerekceyle
//   pop-up'tan sayfaya alinmisti.
//
// ⚠ ASAMALI TASINIYOR ve asama sinirlari OLCUYLE cizildi: her ayarin
//   kac test dosyasina dokundugu sayildi (AI 15, dil 6, hatirlatma 5,
//   hesap ~10, tema 3, etiketler 2, hava 1, kurulum 1). Hepsini tek
//   seferde tasimak ~20 dosyaya ayni anda dokunmak demekti; bir sey
//   kirildiginda sebebini bulmak zorlasirdi.
//   ✅ 1. asama: sayfa kuruldu + TEMA tasindi.
//   ✅ 2. asama: dil secici yeniden yapildi. ⚠ KULLANICININ KARARIYLA
//      yan seritte KALDI -- dili bulamayan birinin ayarlar sayfasina
//      girmesi beklenemez. Olcumu `dil-secici-app` testinde.
//   ✅ 3. asama: HATIRLATMALAR tasindi (pencere -> sayfa bolumu).
//   ⬜ Sirada: hesap etiketleri · hava & isik · hesap · AI.
//      Bu test her asamada BUYUYECEK.
//
// NE OLCUYOR
//   1. Ayarlar bir SAYFA: serit dugmesi onu aciyor, oteki sayfayi
//      kapatiyor, dugme "acik" isaretini aliyor
//   2. Serit dugmesi IKI DILDE de cevrili (Bolum 7)
//   3. Bolum basliklari iki dilde de cevrili
//   4. Tema denetimi sayfanin ICINDE ve CALISIYOR (yalnizca durmuyor)
//   5. ⛔ Seritte tema kalmadi ve bos `.rail-prefs` kutusu da yok
//   6. ⛔ Hatirlatmalar sayfanin icinde; PENCERESI ve serit dugmesi
//      geride kalmadi (yarim tasima en kotusu: iki yerde iki kopya)
//   7. Sayfa OKUNUR genislikte ve telefonda yatay tasma yok

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

(async ()=>{
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1280, height:900 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  p.on('dialog', d=> d.accept());
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.route('**/supabase-js**', r=> r.fulfill({ status:200,
    contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};' }));
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);

  const diller = await p.evaluate(()=> Object.keys(LANG));
  const metin = {};
  for(const d of diller){
    await p.evaluate((x)=>{
      document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
      setLanguage(x);
    }, d);
    await p.waitForTimeout(250);
    metin[d] = await p.evaluate(()=>({
      dugme: document.getElementById('ayarlarBtn').textContent.trim(),
      baslik: [...document.querySelectorAll('#ayarlarPage .tpl-h')].map(x=> x.textContent.trim()),
      giris: (document.querySelector('#ayarlarPage .hint') || {}).textContent
    }));
  }

  // ── SAYFA AC ────────────────────────────────────────────────────
  await p.evaluate(()=> setPage('projects'));
  await p.waitForTimeout(200);
  const once = await p.evaluate(()=>({
    ayarlar: document.getElementById('ayarlarPage').hidden,
    projeler: document.getElementById('projectsPage').hidden
  }));
  await p.evaluate(()=> document.getElementById('ayarlarBtn').click());
  await p.waitForTimeout(300);
  const sonra = await p.evaluate(()=>({
    ayarlar: document.getElementById('ayarlarPage').hidden,
    projeler: document.getElementById('projectsPage').hidden,
    aktif: document.getElementById('ayarlarBtn').classList.contains('active')
  }));

  dene('★ ayarlar bir SAYFA: dugme onu aciyor, otekini kapatiyor', ()=>{
    assert.strictEqual(once.ayarlar, true, 'basta ayarlar acik');
    assert.strictEqual(once.projeler, false, 'basta projeler kapali');
    assert.strictEqual(sonra.ayarlar, false, 'ayarlar acilmadi');
    assert.strictEqual(sonra.projeler, true, 'oteki sayfa kapanmadi');
    assert.strictEqual(sonra.aktif, true, 'dugme "acik" isaretini almadi');
  });

  // ── TEMA SAYFADA VE CALISIYOR ───────────────────────────────────
  const tema = await p.evaluate(async ()=>{
    const t = document.getElementById('themeBtn');
    const yerde = !!t.closest('#ayarlarPage');
    const gorunur = t.getBoundingClientRect().height > 0;
    const onceTema = document.documentElement.getAttribute('data-theme')
                  || document.documentElement.className;
    t.click();
    await new Promise(r=> setTimeout(r, 250));
    const sonraTema = document.documentElement.getAttribute('data-theme')
                   || document.documentElement.className;
    t.click();   // geri al
    return { yerde, gorunur, degisti: onceTema !== sonraTema,
             seritte: !!t.closest('.rail'),
             bosPrefs: document.querySelectorAll('.rail-prefs').length };
  });

  dene('★ tema denetimi sayfanin ICINDE ve gorunur', ()=>{
    assert.strictEqual(tema.yerde, true, 'tema dugmesi ayarlar sayfasinda degil');
    assert.strictEqual(tema.gorunur, true, 'tema dugmesi gorunmuyor');
  });

  dene('★ tema denetimi CALISIYOR (yalnizca durmuyor)', ()=>{
    // ⚠ "Sayfada duruyor" yetmez: tasima sirasinda dinleyicisini
    //   kaybetmis bir dugme de "duruyor" gorunurdu.
    assert.strictEqual(tema.degisti, true, 'tema tiklaninca degismedi');
  });

  dene('★ seritte tema kalmadi, bos kutu da yok', ()=>{
    assert.strictEqual(tema.seritte, false, 'tema hala seritte');
    assert.strictEqual(tema.bosPrefs, 0,
      'geride ' + tema.bosPrefs + ' adet bos `.rail-prefs` kutusu kalmis');
  });

  dene('★ Bolum 7: serit dugmesi ve basliklar HER DILDE', ()=>{
    for(const d of diller){
      assert.ok(metin[d].dugme, d + ': dugme metni bos');
      assert.ok(metin[d].baslik.length >= 1, d + ': hic bolum basligi yok');
      assert.ok(metin[d].giris && metin[d].giris.trim(), d + ': giris metni bos');
    }
    // ⚠ Sozluge girmeyen bir anahtar iki dilde AYNI metni verir.
    const d0 = diller[0], d1 = diller[1];
    assert.notStrictEqual(metin[d0].dugme, metin[d1].dugme,
      'serit dugmesi iki dilde ayni: ' + JSON.stringify(metin[d0].dugme));
    assert.notStrictEqual(JSON.stringify(metin[d0].baslik), JSON.stringify(metin[d1].baslik),
      'basliklar iki dilde ayni: ' + JSON.stringify(metin[d0].baslik));
    assert.notStrictEqual(metin[d0].giris, metin[d1].giris,
      'giris metni iki dilde ayni');
  });

  // ── HATIRLATMALAR SAYFADA, PENCERE GERIDE KALMADI ──────────────
  // ⛔ 19 KASIM 2026 (asama 3). Yarim tasima en kotu sonuc: bolum
  //   sayfaya girer ama pencere ve serit dugmesi de kalir, kullanici
  //   ayni ayari iki yerde gorur ve hangisinin gectigini bilemez.
  //   Bu yuzden "geldi mi" kadar "gitti mi" de olculuyor.
  const htr = await p.evaluate(()=>{
    const b = document.getElementById('ayarHatirlatma');
    return {
      sayfada: !!(b && b.closest('#ayarlarPage')),
      gorunur: !!b && b.getBoundingClientRect().height > 0,
      pencere: !!document.getElementById('remindersOverlay'),
      seritDugmesi: !!document.getElementById('remindersBtn'),
      kapatDugmesi: !!document.getElementById('rm_kapatBtn'),
      // Alan kimlikleri korundu mu: bunlari yazan kod kimlikle buluyor.
      alanlar: ['rm_once','rm_gun','rm_gecikti','rm_tarayici','rm_takvim',
                'rm_saat','rm_adres','rm_adresPay','rm_kurBtn']
                .filter(id=> !document.getElementById(id))
    };
  });

  dene('★ hatirlatmalar AYARLAR SAYFASINDA ve gorunur', ()=>{
    assert.strictEqual(htr.sayfada, true, 'bolum ayarlar sayfasinin icinde degil');
    assert.strictEqual(htr.gorunur, true, 'bolum gorunmuyor');
  });

  dene('★ eski PENCERE ve serit dugmesi GERIDE KALMADI', ()=>{
    assert.strictEqual(htr.pencere, false, '#remindersOverlay hala duruyor');
    assert.strictEqual(htr.seritDugmesi, false, '#remindersBtn hala duruyor');
    assert.strictEqual(htr.kapatDugmesi, false,
      '#rm_kapatBtn hala duruyor -- sayfada kapatilacak bir sey yok');
  });

  dene('★ alan KIMLIKLERI degismedi', ()=>{
    // ⚠ Bu alanlari yazan kod da, olcen testler de kimlikle buluyor.
    //   Tasima sirasinda bir kimlik degisse `hatirlatma` testi duserdi
    //   ama sebebi gorunmezdi; burada sebep acikca yaziliyor.
    assert.deepStrictEqual(htr.alanlar, [],
      'kaybolan alan kimlikleri: ' + htr.alanlar.join(', '));
  });

  // ── OKUNUR GENISLIK ─────────────────────────────────────────────
  // ⛔ 19 KASIM 2026: hatirlatmalar 520 piksellik bir PENCERE icin
  //   tasarlanmisti. Sayfaya tasinir tasinmaz 1280 piksellik ekranda
  //   olculdu: metin satiri 1004 piksel (≈140 karakter; rahat okuma
  //   65-75) ve "Tarayici bildirimi" basligi kendi tikinden ~1100
  //   piksel uzaga dusuyordu. `#ayarlarPage{max-width:640px}` kondu.
  //   ⚠ Esik 760: 640'in uzerinde pay birakiyor ama "sinir hic yok"
  //     halini (1004) yakaliyor.
  const genislik = await p.evaluate(()=>
    Math.round(document.getElementById('ayarlarPage').getBoundingClientRect().width));

  dene('★ geniş ekranda sayfa OKUNUR genislikte', ()=>{
    assert.ok(genislik <= 760,
      'ayarlar sayfasi ' + genislik + 'px genislikte; satirlar okunamayacak ' +
      'kadar uzuyor ve tikler kendi basliklarindan kopuyor');
  });

  // Telefonda yatay tasma: tasiyan bolum butun sayfayi yana kaydirir.
  const tel = await b.newPage({ viewport:{ width:390, height:844 } });
  await tel.route('**/supabase-js**', r=> r.fulfill({ status:200,
    contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};' }));
  await tel.route('**/goatcounter**', r=> r.abort());
  await tel.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await tel.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await tel.waitForTimeout(1500);
  const telOlcum = await tel.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setPage('ayarlar');
    const d = document.documentElement;
    return { tasma: d.scrollWidth - d.clientWidth,
             bolumEni: Math.round(document.getElementById('ayarHatirlatma')
                                          .getBoundingClientRect().width) };
  });
  await tel.close();

  dene('★ telefonda yatay tasma yok', ()=>{
    assert.ok(telOlcum.tasma <= 1,
      'sayfa ' + telOlcum.tasma + 'px yana kayiyor (hatirlatma bolumu ' +
      telOlcum.bolumEni + 'px)');
  });

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
