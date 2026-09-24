// ANAHTAR DOGRULANINCA "DIGER CIHAZLARINDA DA OLSUN MU?" SORUSU.
//
// Ozellik zaten vardi: AI ayarlarinda "Anahtari hesabimda tut" kutusu.
// Mekanizma da saglamdi -- kutu isaretlenince anahtar hesap satirina
// yaziliyor, anahtari olmayan cihaz acilista indiriyor. Eksik olan tek
// sey GORUNURLUKTU: kutu, kullanicinin anahtari CALISTIRMAYA odaklandigi
// anda formun altinda pasif duruyordu ve kimse gormuyordu. Kullanicinin
// kendi cumlesi: "ben bile atlamisim".
//
// UC KOSUL:
//
//   1. VARSAYILAN DEGISMEMELI. Soru SORULUYOR, kutu kendiliginden
//      acilmiyor. Varsayilani acmak bir kimlik bilgisini kullanici
//      istemeden sunucuya kopyalamak olurdu; kutunun altindaki soz tam
//      olarak bunu engelliyor ("Kapali birakirsan anahtar bu cihazdan
//      hic cikmaz").
//
//   2. OTURUM YOKKEN HIC SORULMAMALI. Yazacak bir hesap satiri yok;
//      soru cevaplanamaz bir seyi soruyor olurdu.
//
//   3. ZATEN ACIKSA SORULMAMALI. Cevabi belli olan soruyu her anahtar
//      kaydinda tekrarlamak, kullaniciyi okumadan gecmeye alistirir.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{ width:1280, height:1000 } })).newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());
  await p.route('**supabase.co**', r=> r.abort());

  // Anahtar denemesi hep basarili: olculen sey anahtar degil, sonrasi.
  await p.route('**generativelanguage.googleapis.com/v1beta/models', r=> r.fulfill({ status:200,
    contentType:'application/json',
    body: JSON.stringify({ models:[{ name:'models/gemini-3.5-flash',
                                     supportedGenerationMethods:['generateContent'] }] }) }));
  await p.route('**generativelanguage.googleapis.com/v1beta/models/**', r=> r.fulfill({ status:200,
    contentType:'application/json',
    body: JSON.stringify({ candidates:[{ content:{ parts:[{ text:'test' }] } }] }) }));

  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });

  // onayla sahteleniyor: kac kez, ne soruldu, cevap ne.
  await p.evaluate(()=>{
    window.__sayi = 0; window.__metin = []; window.__cevap = true;
    window.onayla = async (o)=>{
      window.__sayi++;
      window.__metin.push(typeof o === 'string' ? o : JSON.stringify(o));
      return window.__cevap;
    };
    // tercihPushKuyrukla ag istegi yapiyor; burada yalnizca CAGRILDIGI
    // olculuyor -- anahtarin hesaba gitmesi bu cagriyla oluyor.
    window.__push = 0;
    const eskiPush = window.tercihPushKuyrukla;
    window.tercihPushKuyrukla = ()=>{ window.__push++; };
  });
  const oku = ()=> p.evaluate(()=>({ sayi: window.__sayi, metin: window.__metin,
                                     push: window.__push, hesaba: aiHesabaKaydet }));
  const kur = (oturum, hesaba, cevap)=> p.evaluate(({oturum, hesaba, cevap})=>{
    session = oturum ? { user:{ id:'u1' } } : null;
    aiHesabaKaydet = hesaba;
    try{ localStorage.setItem('demo_ai_hesaba', hesaba ? '1' : '0'); localStorage.removeItem('demo_ai_settings'); }catch(e){}
    window.__sayi = 0; window.__metin = []; window.__push = 0; window.__cevap = cevap;
  }, {oturum, hesaba, cevap});

  const anahtarKaydet = async ()=>{
    await p.evaluate(()=> openAiSettings());
    await p.waitForTimeout(350);
    await p.fill('#ai_key', 'AQ.TESTANAHTARI_123456');
    await p.click('#aiSettingsSaveBtn');
    await p.waitForTimeout(1200);
  };

  // ------------------------------------------------- 1. oturum varken sorulur
  console.log('[oturum var, kutu kapalı]');
  await kur(true, false, true);
  await anahtarKaydet();
  let s = await oku();
  bak('★ anahtar doğrulanınca soruldu', s.sayi === 1, JSON.stringify(s));
  bak('soru cihazlardan bahsediyor', /cihaz/i.test(s.metin.join(' ')), s.metin.join(' ').slice(0,180));
  bak('★ "tut" denince hesaba yazma açıldı', s.hesaba === true, String(s.hesaba));
  bak('hesaba yazma gerçekten tetiklendi', s.push > 0, String(s.push));
  bak('kutu da işaretli görünüyor',
    await p.evaluate(()=> document.getElementById('ai_hesaba').checked) === true);

  // ----------------------------------------------------- 2. hayir denirse
  console.log('[hayır]');
  await kur(true, false, false);
  await anahtarKaydet();
  s = await oku();
  bak('soruldu', s.sayi === 1, JSON.stringify(s));
  bak('★ hayır denince VARSAYILAN korundu: hesaba yazılmıyor',
    s.hesaba === false, String(s.hesaba));
  bak('hesaba yazma tetiklenmedi', s.push === 0, String(s.push));
  bak('anahtar yine de bu cihazda kayıtlı',
    await p.evaluate(()=> !!(getAiSettings() && getAiSettings().key)) === true);

  // ------------------------------------------------------ 3. oturum yoksa
  console.log('[oturum yok]');
  await kur(false, false, true);
  await anahtarKaydet();
  s = await oku();
  bak('★ oturum yokken hiç sorulmuyor', s.sayi === 0, JSON.stringify(s));
  bak('hesaba yazma da yok', s.hesaba === false && s.push === 0, JSON.stringify(s));

  // --------------------------------------------------- 4. zaten aciksa
  console.log('[zaten açık]');
  await kur(true, true, true);
  await anahtarKaydet();
  s = await oku();
  bak('★ zaten açıkken tekrar sorulmuyor', s.sayi === 0, JSON.stringify(s));
  bak('ama anahtar hesaba yine de yazılıyor', s.push > 0, String(s.push));

  // ------------------------------------------------------------ 5. metinler
  console.log('[metinler]');
  const eksik = await p.evaluate(()=>{
    const sonuc = {};
    ['tr','en'].forEach(dil=>{
      setLanguage(dil);
      ['ai_cihaz_baslik','ai_cihaz_govde','ai_cihaz_tut','ai_hesaba','ai_hesaba_not'].forEach(k=>{
        const v = t(k); if(!v || v === k) sonuc[dil+':'+k] = String(v);
      });
    });
    setLanguage('tr');
    return sonuc;
  });
  bak('iki dilde de metinler tanımlı', Object.keys(eksik).length === 0, JSON.stringify(eksik));
  bak('kutu hâlâ duruyor (fikrini sonra değiştirmenin yolu)',
    await p.$('#ai_hesaba') !== null);

  bak('sayfa hatası yok', hata.length === 0, hata.join(' | '));
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
