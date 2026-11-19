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

  // ── SAYFALAR IC ICE GECMIS MI ───────────────────────────────────
  // ⛔ 19 KASIM 2026 — KAPANMAYAN BIR <div> BUTUN SAYFALARI IC ICE
  //    GECIRDI. 4. asamada hesap etiketleri tasinirken `.hs-form`'u
  //    kapatan `</div>` kesildi: `#ayarlarPage` acik kaldi ve ONDAN
  //    SONRAKI HER SAYFA onun icine dustu.
  //    ⚠ BELIRTISI SEBEBINE HIC BENZEMIYORDU: kayit penceresindeki
  //      "Kaydet" dugmesi 54x36 yerine 0x0 oldu ve `hesap-arayuz`
  //      testi 30 saniye bekleyip zaman asimina ugradi. Sebebi
  //      bulmak, degisiklik oncesi/sonrasi olcum almayi gerektirdi.
  //      Bu bekci sebebi DOGRUDAN soyluyor.
  // ⚠ LISTE YAZMIYOR: sayfalari `SAYFALAR`'dan okuyor, yani yarin
  //   eklenen sayfa kendiliginden giriyor (asama 5 ve 6 geliyor).
  const icIce = await p.evaluate(()=>{
    const ids = SAYFALAR.map(x=> x[1]);
    const kotu = [];
    ids.forEach(a=> ids.forEach(c=>{
      if(a === c) return;
      const ea = document.getElementById(a), ec = document.getElementById(c);
      if(ea && ec && ec.contains(ea)) kotu.push(a + ' ⊂ ' + c);
    }));
    return kotu;
  });

  dene('★ sayfalar KARDES, ic ice degil', ()=>{
    assert.deepStrictEqual(icIce, [],
      'ic ice gecmis sayfalar: ' + icIce.join(' | ') +
      ' -- kapanmamis bir <div> var');
  });

  // ── HER SAYFADAN ACILABILIYOR MU ────────────────────────────────
  // ⛔ 19 KASIM 2026 — CANLIDA BUTUN BETIGI OLDUREN HATA. Kullanici
  //    bildirdi: tanitim kutusu ("SIRADAKILER — ONUMUZDEKI 6 HAFTA")
  //    ekranin tepesinde duruyor ve GIRIS DUGMESI calismiyor.
  //    Tek sebep: asama 3'te `setPage`'e eklenen "ayarlar acilirsa
  //    tazele" satiri, acilista cagrilinca HENUZ TANIMLANMAMIS
  //    `hatirlatma` baglantisina dokunuyordu ->
  //      "Cannot access 'hatirlatma' before initialization"
  //    Hata betigi oldurunce ARDINDAKI her sey calismiyor.
  //    ⚠ NEDEN HICBIR TEST YAKALAMADI: hepsi uygulamayi VARSAYILAN
  //      sayfada acip sonra ayarlara tikliyordu. Oysa uygulama en son
  //      kalinan sayfayi hatirliyor -- ayarlara girip sayfayi yenileyen
  //      herkes bu hatayi aliyordu. `hatirlatma.test.js`'in 1. bolumu
  //      "TDZ hatasi yok" diyor ama o da varsayilan sayfadan aciyor.
  //    ⚠ LISTE YAZMIYOR: sayfalari `SAYFALAR`'dan okuyor, yani yarin
  //      eklenen sayfa kendiliginden olculuyor.
  const sayfaAdlari = await p.evaluate(()=> SAYFALAR.map(x=> x[0]));
  const acilisSonuc = [];
  for(const ad of sayfaAdlari){
    const a = await b.newPage({ viewport:{ width:1280, height:900 } });
    const aHata = [];
    a.on('pageerror', e=> aHata.push(ad + ': ' + e.message));
    await a.route('**/supabase-js**', r=> r.fulfill({ status:200,
      contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};' }));
    await a.route('**/goatcounter**', r=> r.abort());
    await a.addInitScript((x)=>{ try{ localStorage.setItem('demo_seen_intro','1');
      localStorage.setItem('demo_tour_done','1');
      sessionStorage.setItem('demo_page', x); }catch(e){} }, ad);
    await a.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
    await a.waitForTimeout(1800);
    acilisSonuc.push({ ad, hata: aHata,
      // Betik olmusse bu ikisi de calismaz: tanitim kutusu gizlenemez
      // ve giris dugmesinin dinleyicisi takilamaz. Belirtiyi de olcuyoruz,
      // cunku kullanicinin GORDUGU sey bu.
      pitch: await a.evaluate(()=>{ const e = document.getElementById('pitchBanner');
        if(!e) return false; const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0; }),
      giris: await a.evaluate(()=>{ try{ document.getElementById('authBtn').click();
        return document.getElementById('authOverlay').classList.contains('open');
      }catch(e){ return false; } }) });
    await a.close();
  }

  dene('★ HER sayfadan acilirken JS hatasi yok', ()=>{
    const kotu = acilisSonuc.filter(x=> x.hata.length);
    assert.deepStrictEqual(kotu.map(x=> x.hata).flat(), [],
      'acilista patlayan sayfalar: ' + kotu.map(x=> x.ad).join(', '));
  });

  dene('★ HER sayfadan acilista giris dugmesi calisiyor', ()=>{
    const kotu = acilisSonuc.filter(x=> !x.giris).map(x=> x.ad);
    assert.deepStrictEqual(kotu, [],
      'giris penceresi acilmayan sayfalar: ' + kotu.join(', ') +
      ' -- betik acilista olmus olabilir');
  });

  dene('★ HER sayfadan acilista tanitim kutusu gizli', ()=>{
    const kotu = acilisSonuc.filter(x=> x.pitch).map(x=> x.ad);
    assert.deepStrictEqual(kotu, [],
      'tanitim kutusu gorunen sayfalar: ' + kotu.join(', '));
  });

  // ── AYARLARDAN ACILINCA ALANLAR KAYITTAN DOLUYOR MU ─────────────
  // ⚠ "Hata yok" yetmez: hatayi susturup isi yapmamak da hatasizdir.
  //   Bu olcum degerlerin GERCEKTEN kayittan geldigini soruyor.
  const dolum = await (async ()=>{
    const a = await b.newPage({ viewport:{ width:1280, height:900 } });
    await a.route('**/supabase-js**', r=> r.fulfill({ status:200,
      contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};' }));
    await a.route('**/goatcounter**', r=> r.abort());
    await a.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
      localStorage.setItem('demo_tour_done','1');
      localStorage.setItem('demo_reminders', JSON.stringify(
        { once:false, gun:true, gecikti:false, tarayici:false, takvim:false, saat:'07:30' }));
      sessionStorage.setItem('demo_page','ayarlar'); }catch(e){} });
    await a.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
    await a.waitForTimeout(2000);
    const r = await a.evaluate(()=>({
      sayfaAcik: !document.getElementById('ayarlarPage').hidden,
      once: document.getElementById('rm_once').checked,
      gun: document.getElementById('rm_gun').checked,
      saat: document.getElementById('rm_saat').value,
      platformSecenek: document.getElementById('hs_platform').options.length,
      hesapListesi: document.getElementById('hs_liste').children.length
    }));
    await a.close();
    return r;
  })();

  dene('★ ayarlardan acilinca alanlar KAYITTAN doluyor', ()=>{
    assert.strictEqual(dolum.sayfaAcik, true, 'ayarlar sayfasi acilmadi');
    // Kayitta once=false, gun=true, saat='07:30' yaziyor. HTML
    // varsayilani bunlarin tersi; yani bu degerler tazelemeden geliyor.
    assert.strictEqual(dolum.once, false, '"bir gun once" kayittan gelmedi');
    assert.strictEqual(dolum.gun, true, '"termin gunu" kayittan gelmedi');
    assert.strictEqual(dolum.saat, '07:30', 'saat kayittan gelmedi: ' + dolum.saat);
    assert.ok(dolum.platformSecenek > 1,
      'platform listesi dolmadi (' + dolum.platformSecenek + ' secenek)');
    assert.ok(dolum.hesapListesi > 0, 'hesap listesi hic cizilmedi');
  });

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
