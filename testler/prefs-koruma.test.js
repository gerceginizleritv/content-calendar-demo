// TERCIH SATIRINDA BILMEDIGIMIZ ANAHTARLAR KORUNUYOR MU?
//
// tercihPrefsYap() prefs'in TAMAMINI yeniden uretiyor: orada sayilmayan
// her anahtar ilk kaydetmede siliniyor. Ayni tuzaga iki kez dusuldu --
// once gelen_kutusu, sonra mcp. Ikisinde de belirti ayniydi ve kotuydu:
// bayrak Supabase panelinden aciliyor, uygulama ilk kayitta siliyor,
// EKRAN bellekteki degerle acik kalmaya devam ediyor. Yani hata hicbir
// yerde gorunmuyor; yalnizca o bayraga bagli is sessizce duruyor.
//
// Ucuncusu kapida bekliyordu: sql/49 ile story yayin kuyrugu artik
// prefs.story_yayin bayragina bakiyor. Uygulama onu da silecekti.
//
// Bu yuzden kural TERSINE cevrildi: uygulamanin YONETTIGI anahtarlar
// (PREFS_BIZIM) sayili, geri kalan her sey oldugu gibi korunuyor. Bu
// test o kurali olcuyor -- tek tek bayraklari degil. Yarin panelden
// acilacak bir bayragin adini kimsenin bilmesi gerekmiyor.
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
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });

  // Her adim TEMIZ baslıyor. AI anahtari adimlar arasi sizabiliyor:
  // gelenAlinanOku, hesapta anahtar gorup bu cihazda yoksa indiriyor ve
  // "hesaba kaydet"i aciyor (dogru davranis, cihazlar arasi anahtar).
  // Sizmasina izin verilirse sonraki olcumler kendi kurdugu duruma degil
  // bir oncekinin artigina bakar.
  const oku = (prefs)=> p.evaluate((b)=>{
    session = { user:{ id:'00000000-0000-4000-8000-000000000001', email:'deneme@ornek.com' } };
    bulutOkumaBasarisiz = false;
    aiHesabaKaydet = false;
    try{ localStorage.removeItem(AI_HESABA_ANAHTARI); }catch(e){}
    try{ localStorage.removeItem('demo_ai_settings'); }catch(e){}
    // Paylasim jetonu da ayni sekilde sizabiliyor: gelenAlinanOku
    // buluttaki jetonu yerelde yoksa benimsiyor.
    paylasim = { jeton:'', zaman:0 };
    gelenAlinanOku(b === null ? null : { prefs: b });
  }, prefs);
  const yaz = ()=> p.evaluate(()=> tercihPrefsYap());

  console.log('[ASIL OLCUM: story_yayin bayragi ayakta kaliyor]');
  await oku({ lang:'tr', story_yayin:true });
  let cikti = await yaz();
  bak('story_yayin yazilan satirda duruyor', cikti.story_yayin === true, JSON.stringify(cikti));
  bak('dil de yerinde', cikti.lang === 'tr', String(cikti.lang));

  console.log('[kural GENEL: adini bilmedigimiz anahtar da kaliyor]');
  await oku({ lang:'tr', reels_yayin:true, kota:{ ay:500 }, bir_gun_eklenecek:'x' });
  cikti = await yaz();
  bak('bilinmeyen bayrak korunuyor', cikti.reels_yayin === true, JSON.stringify(cikti));
  bak('bilinmeyen nesne korunuyor',
      cikti.kota && cikti.kota.ay === 500, JSON.stringify(cikti.kota));
  bak('bilinmeyen metin korunuyor', cikti.bir_gun_eklenecek === 'x', String(cikti.bir_gun_eklenecek));

  console.log('[yonetilen anahtarlar uygulamanindir]');
  // Kuralin BELKEMIGI: yabanci defter ile yonetilen anahtarlar AYRIK
  // olmali. Ayrik olduklari surece hangisinin once konuldugu onemsiz;
  // ayrik DEGILSE buluttaki bayat bir deger kullanicinin yeni secimini
  // geri alabilir. O yuzden olcum ayrikligin kendisine bakiyor.
  await oku({ lang:'en', ai:{ key:'AIzaX' }, share:{ jeton:'j' }, mcp:true,
              gelen_kutusu:true, reminders:{ takvim:true }, ihtiyaclar:['x'],
              ihtiyac_setleri:[], gelen_alinan:['a'], story_yayin:true });
  // Beklenen liste TESTTE yaziyor, uygulamadan okunmuyor. PREFS_BIZIM ile
  // karsilastirmak totoloji olurdu: listeden bir anahtar dusurulunce
  // olcumun iki tarafi birden degisir ve hata gorunmez.
  const YONETILEN = ['lang','ihtiyaclar','ihtiyac_setleri','gelen_alinan',
                     'gelen_kutusu','mcp','ai','share','reminders'];
  const yabanci = await p.evaluate(()=> Object.keys(prefsYabanci));
  bak('yabanci defterde yonetilen anahtar YOK',
      yabanci.every(x=> YONETILEN.indexOf(x) === -1), yabanci.join(','));
  bak('yabanci defter bos degil (test bos degil)',
      yabanci.indexOf('story_yayin') !== -1, yabanci.join(','));
  // Sonucu: buluttaki bayat dil ekrandakini ezmiyor.
  await oku({ lang:'en', story_yayin:true });
  cikti = await yaz();
  bak('buluttaki bayat dil ekrandakini ezmiyor', cikti.lang === 'tr', String(cikti.lang));
  // ai YONETILEN bir anahtar: kullanici "hesaba kaydet"i kapattiysa
  // satirdan DUSMELI. Yabancilar arasinda tasinsaydi kapatmak ise
  // yaramazdi -- eski anahtar sonsuza kadar hesapta kalirdi.
  await oku({ lang:'tr', ai:{ key:'AIzaESKI' }, story_yayin:true });
  await p.evaluate(()=>{ aiHesabaKaydet = false; });
  cikti = await yaz();
  bak('ai kapatilinca satirdan dusuyor', cikti.ai === undefined, JSON.stringify(cikti.ai));
  bak('yaninda story_yayin yine duruyor', cikti.story_yayin === true, JSON.stringify(cikti));

  console.log('[kardes bayraklar birbirini dusurmuyor]');
  await oku({ lang:'tr', mcp:true, gelen_kutusu:true, story_yayin:true });
  cikti = await yaz();
  bak('mcp + gelen_kutusu + story_yayin birlikte',
      cikti.mcp === true && cikti.gelen_kutusu === true && cikti.story_yayin === true,
      JSON.stringify(cikti));

  console.log('[yeni hesap: satir yok]');
  await oku(null);
  cikti = await yaz();
  bak('satir yokken yabanci anahtar uydurulmuyor',
      Object.keys(cikti).every(x=> ['lang','reminders'].includes(x)), JSON.stringify(Object.keys(cikti)));

  console.log('[OKUNMADAN YAZILMIYOR]');
  // Okuma basarisizsa prefsYabanci bos kalir; o bos defterle yazmak,
  // bilmedigimiz anahtarlari silmek olurdu.
  const yazildiMi = await p.evaluate(async ()=>{
    prefsOkundu = false;
    let cagrildi = false;
    const eski = sb;
    sb = { from(){ cagrildi = true; return { upsert: async ()=> ({ error:null }) }; } };
    session = { user:{ id:'00000000-0000-4000-8000-000000000001' } };
    await tercihPush();
    sb = eski;
    return cagrildi;
  });
  bak('okunmadan buluta yazilmiyor', yazildiMi === false);

  const yazildiMi2 = await p.evaluate(async ()=>{
    prefsOkundu = true;
    let cagrildi = false;
    const eski = sb;
    sb = { from(){ cagrildi = true; return { upsert: async ()=> ({ error:null }) }; } };
    session = { user:{ id:'00000000-0000-4000-8000-000000000001' } };
    await tercihPush();
    sb = eski;
    return cagrildi;
  });
  bak('okunduktan sonra yaziliyor (test bos degil)', yazildiMi2 === true);

  bak('js hatasi yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
