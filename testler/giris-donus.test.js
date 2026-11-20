// GIRIS DONUSU: Google'dan donunce DOGRUDAN uygulamaya gecilmeli.
//
// ⚠ 14 KASIM 2026 — KULLANICI BUNU CANLIDA YASADI:
//   "giris yap butonuna tikladim google ile giris yap dedim. girdi ama
//    sonra beni tekrar ana sayfaya atti ... tekrar tikladim appe girdim"
//   Uc tiklama. Olmasi gereken: bir tiklama.
//
// IKI AYRI HATA VARDI VE BIRI DIGERINI GIZLIYORDU:
//   1. donusVarMi() isareti OKURKEN SILIYORDU. Google'dan donuste
//      getSession() once kosuyor ve oturum henuz hazir olmadigi icin
//      null donuyor; isaret o anda tukeniyor. Saniyeler sonra SIGNED_IN
//      geldiginde isaret artik yok, yonlendirme olmuyor.
//   2. izleyipGit() HIC TANIMLI DEGILDI. Giris bolumu eski ana
//      sayfadan tasinirken cagrilari geldi, tanimi gelmedi. Uc yerden
//      cagriliyor ve ucu de ReferenceError veriyordu.
//   Birinci hata yuzunden ikinci satira hic gelinmiyordu; yani ilk
//   hatayi duzeltmek ikincisini ortaya cikardi.
//
// Bu test akisin SIRASINI taklit ediyor: oturum ONCE null gelir,
// SIGNED_IN SONRA duser. Gercek OAuth donusu boyle calisiyor.
const { chromium } = require('./araclar');

(async () => {
  const b = await chromium.launch({ });
  let kalan = 0, gecen = 0;
  const bak = (ad, kosul, ek) => {
    if (kosul) { gecen++; console.log('  ok  ' + ad); }
    else { kalan++; console.log('  YOK ' + ad + (ek !== undefined ? ' → ' + JSON.stringify(ek) : '')); }
  };

  // ── 1 · Google donusu: oturum gec gelse bile uygulamaya gecilmeli ──
  {
    const c = await b.newContext({ viewport:{width:1280,height:900} });
    const p = await c.newPage();
    const hatalar = [];
    p.on('pageerror', e => hatalar.push(String(e)));
    await p.addInitScript(() => {
      try{ sessionStorage.setItem('slate_giris_donus','1'); }catch(e){}
      window.supabase = { createClient(){ return { auth: {
        getSession(){ return Promise.resolve({ data:{ session:null } }); },   // HENUZ HAZIR DEGIL
        onAuthStateChange(cb){
          setTimeout(()=>cb('SIGNED_IN', { user:{ email:'a@b.c' } }), 400);   // SONRA geliyor
          return { data:{ subscription:{ unsubscribe(){} } } };
        },
        signInWithOAuth(){ return Promise.resolve({}); },
        signInWithOtp(){ return Promise.resolve({}); },
      }};}};
    });
    // ⛔ 20 KASIM 2026 — BU TEST YANLIS SEBEPLE YESILDI.
    //   Taklit `addInitScript` ile kuruluyor ama kutuphane DOSYASI
    //   engellenmiyordu. Eskiden dosya cdn.jsdelivr.net'ten geliyordu
    //   ve bu olcum ortaminda o adres kapaliydi: dosya hic gelmiyor,
    //   taklit ayakta kaliyordu. Yani test, internetin OLMAMASINA
    //   dayaniyordu -- internetli bir makinede o zaman da duserdi.
    //   62. maddede kutuphane depoya alinip gercekten yuklenmeye
    //   baslayinca taklidin ustune yazdi ve ariza gorunur oldu.
    //   ⚠ IDDIA DEGISMEDI: "oturum gec gelse bile app.html'e gecilir".
    //     Yalnizca taklit, oteki 115 testteki kalibin aynisiyla
    //     korunuyor.
    await p.route('**/supabase-js**', r=> r.fulfill({ status:200,
      contentType:'application/javascript', body:'' }));
    await p.goto('http://127.0.0.1:8098/index.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(2500);
    // ⚠ HASH ONCE ATILIYOR. 16 Kasim 2026'da uygulamaya adres yonetimi
    //   girdi (#/calendar gibi) ve hash'in ICINDE '/' var; once '/'
    //   ile bolunurse son parca "calendar" cikiyor ve olcum dosya
    //   adini hic gormuyordu. Iddia ayni: hangi SAYFAYA gidildi.
    const nerede = p.url().split('#')[0].split('?')[0].split('/').pop();
    bak('Google donusunde DOGRUDAN uygulamaya geciliyor', nerede === 'app.html', nerede);
    bak('yonlendirme sirasinda sayfa hatasi yok', hatalar.length === 0, hatalar.slice(0,2));
    await c.close();
  }

  // ── 2 · Isaret yoksa ve oturum yoksa: ana sayfada KALINMALI ──
  //    (yanlis yonlendirme de bir hata olurdu)
  {
    const c = await b.newContext({ viewport:{width:1280,height:900} });
    const p = await c.newPage();
    await p.addInitScript(() => {
      window.supabase = { createClient(){ return { auth: {
        getSession(){ return Promise.resolve({ data:{ session:null } }); },
        onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; },
        signInWithOAuth(){ return Promise.resolve({}); },
        signInWithOtp(){ return Promise.resolve({}); },
      }};}};
    });
    // ⚠ Kutuphane dosyasi engelleniyor: yoksa gercek supabase-js
    //   yuklenip yukaridaki taklidin ustune yazar (yukarida
    //   birinci blokta ayrintisi yazili).
    await p.route('**/supabase-js**', r=> r.fulfill({ status:200,
      contentType:'application/javascript', body:'' }));
    await p.goto('http://127.0.0.1:8098/index.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1500);
    // ⚠ HASH ONCE ATILIYOR. 16 Kasim 2026'da uygulamaya adres yonetimi
    //   girdi (#/calendar gibi) ve hash'in ICINDE '/' var; once '/'
    //   ile bolunurse son parca "calendar" cikiyor ve olcum dosya
    //   adini hic gormuyordu. Iddia ayni: hangi SAYFAYA gidildi.
    const nerede = p.url().split('#')[0].split('?')[0].split('/').pop();
    bak('isaret yokken ana sayfada kaliniyor', nerede === 'index.html' || nerede === '', nerede);
    await c.close();
  }

  // ── 3 · izleyipGit TANIMLI mi (cagrildigi her yer icin) ──
  {
    const c = await b.newContext({ viewport:{width:1280,height:900} });
    const p = await c.newPage();
    await p.addInitScript(() => {
      window.supabase = { createClient(){ return { auth: {
        getSession(){ return Promise.resolve({ data:{ session:null } }); },
        onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; },
        signInWithOAuth(){ return Promise.resolve({}); },
        signInWithOtp(){ return Promise.resolve({}); },
      }};}};
    });
    // ⚠ Kutuphane dosyasi engelleniyor: yoksa gercek supabase-js
    //   yuklenip yukaridaki taklidin ustune yazar (yukarida
    //   birinci blokta ayrintisi yazili).
    await p.route('**/supabase-js**', r=> r.fulfill({ status:200,
      contentType:'application/javascript', body:'' }));
    await p.goto('http://127.0.0.1:8098/index.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1200);
    const tur = await p.evaluate(()=>typeof izleyipGit);
    bak('izleyipGit tanimli', tur === 'function', tur);
    await c.close();
  }

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
