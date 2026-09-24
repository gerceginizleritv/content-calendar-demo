// TEK TUSLA BUTUN ALANLARI AI ILE YAZ.
//
// Bes ayri dugmeye tek tek basmak, ayni kararin bes kez verilmesiydi.
// Model burada TAKLIT ediliyor; olculen sey modelin cevabi degil toplu
// dugmenin isleyisi.
//
// DORT TUZAK, dordu de burada olculuyor:
//
//   1. ALAN LISTESI GORUNURLUKTEN TUREMELI. Hangi alanin gorunecegine
//      refreshTypeDependentFields karar veriyor: video'da video basligi
//      var, story'de yok. Liste kodda ikinci kez yazilsaydi biri
//      guncellenir oburu unutulurdu -- bu depoda dort yerli beyaz
//      listelerin basina tam olarak bu geldi. Story'de video basligina
//      istek gitmesi, kullanicinin gormedigi bir alani doldurmak ve
//      kotasindan bir istek harcamak demek.
//
//   2. UYARI BIR KEZ SORULMALI. Bes kez ust uste sormak kullaniciyi
//      okumadan "Tamam"a basmaya alistirir; o noktadan sonra uyari
//      korumaz, yalnizca gecikme uretir.
//
//   3. HAYIR DENINCE HICBIR SEY YAZILMAMALI. Yarim yazilmis bir form,
//      hic yazilmamistan kotu: kullanici hangi alanin kendi yazdigi
//      hangisinin uretilmis oldugunu bilemez.
//
//   4. ALAN BASINA DUGMELER BOZULMAMALI. Toplu dugme bir EKLEME; tek
//      bir alani yeniden yazdirmak isteyen eski dugmeyi kullanmaya
//      devam ediyor ve o dugme kendi sorusunu sormali.
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

  const promptlar = [];
  let cevap = 'üretilmiş metin';
  let patlat = 0;          // kacinci istekte hata donsun (0 = hic)
  let istek = 0;
  let anlikEnCok = 0, anlik = 0;   // ayni anda kac istek havada

  await p.route('**generativelanguage.googleapis.com/v1beta/models', r=> r.fulfill({ status:200,
    contentType:'application/json',
    body: JSON.stringify({ models:[{ name:'models/gemini-3.5-flash',
                                     supportedGenerationMethods:['generateContent'] }] }) }));
  await p.route('**generativelanguage.googleapis.com/v1beta/models/**', async r=>{
    istek++; anlik++; if(anlik > anlikEnCok) anlikEnCok = anlik;
    let govde = {};
    try{ govde = JSON.parse(r.request().postData() || '{}'); }catch(e){}
    promptlar.push(JSON.stringify(govde).slice(0, 4000));
    await new Promise(x=> setTimeout(x, 120));   // sira olculebilsin
    anlik--;
    if(patlat && istek === patlat){
      await r.fulfill({ status:500, contentType:'application/json',
        body: JSON.stringify({ error:{ message:'test hatasi' } }) });
      return;
    }
    await r.fulfill({ status:200, contentType:'application/json',
      body: JSON.stringify({ candidates:[{ content:{ parts:[{ text: cevap }] } }] }) });
  });

  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });

  await p.click('#aiSettingsBtn'); await p.waitForTimeout(300);
  await p.fill('#ai_key', 'AQ.TESTANAHTARI_123456');
  await p.click('#aiSettingsSaveBtn');
  await p.waitForTimeout(900);
  await p.evaluate(()=> document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')));

  // onayla() sayiliyor ve cevabi testten veriliyor: kac kez sorulduğu
  // bu ozelligin can alici olcumu.
  await p.evaluate(()=>{
    window.__onaySayi = 0; window.__onayMetin = [];
    window.__onayCevap = true;
    window.onayla = async (m)=>{ window.__onaySayi++; window.__onayMetin.push(String(m)); return window.__onayCevap; };
  });
  const onay = ()=> p.evaluate(()=>({ sayi: window.__onaySayi, metin: window.__onayMetin }));
  const onaySifirla = (cevap)=> p.evaluate((c)=>{ window.__onaySayi = 0; window.__onayMetin = []; window.__onayCevap = c; }, cevap);

  const pencere = async (tur)=>{
    await p.evaluate((tur)=>{
      openModal(null, fmtKey(new Date()), '10:00');
      document.getElementById('f_title').value = 'Balat sokaklarında sabah çekimi';
      document.getElementById('f_type').value = tur;
      refreshTypeDependentFields();
      ['f_videotitle','f_shorttitle','f_caption','f_hashtags','f_thumb']
        .forEach(id=>{ const el = document.getElementById(id); if(el) el.value = ''; });
    }, tur);
    await p.waitForTimeout(400);
  };
  const alanlar = ()=> p.evaluate(()=>{
    const c = {};
    ['f_videotitle','f_shorttitle','f_caption','f_hashtags','f_thumb'].forEach(id=>{
      const el = document.getElementById(id);
      c[id] = { deger: el ? el.value : null, gorunur: !!(el && el.offsetParent !== null) };
    });
    return c;
  });

  // ------------------------------------------------------------- 1. dugme
  console.log('[düğme]');
  bak('toplu düğme var', await p.$('#aiHepsiBtn') !== null);
  bak('alan başına düğmeler DURUYOR',
    (await p.$('#aiDraftBtn')) && (await p.$('#aiTitleBtn')) && (await p.$('#aiShortBtn'))
    && (await p.$('#aiTagsBtn')) && (await p.$('#aiThumbBtn')) ? true : false);

  // ----------------------------------------------------- 2. video: bes alan
  console.log('[video — beş alan]');
  await pencere('video');
  istek = 0; promptlar.length = 0; anlikEnCok = 0; await onaySifirla(true);
  await p.click('#aiHepsiBtn');
  await p.waitForFunction(()=> !document.getElementById('aiHepsiBtn').disabled, null, { timeout: 25000 });
  let a = await alanlar();
  bak('beş alanın beşi de yazıldı',
    ['f_videotitle','f_shorttitle','f_caption','f_hashtags','f_thumb'].every(id=> a[id].deger.length > 0),
    JSON.stringify(a));
  bak('beş istek gitti', istek === 5, String(istek));
  bak('★ istekler SIRAYLA gitti, paralel değil', anlikEnCok === 1, 'en çok eşzamanlı: ' + anlikEnCok);
  bak('boş formda uyarı sorulmadı', (await onay()).sayi === 0, JSON.stringify(await onay()));

  // ------------------------------------------- 3. story: video basligi YOK
  console.log('[story — görünmeyen alan atlanıyor]');
  await pencere('story');
  a = await alanlar();
  bak('story\'de video başlığı gizli', a.f_videotitle.gorunur === false, JSON.stringify(a.f_videotitle));
  istek = 0; promptlar.length = 0; await onaySifirla(true);
  await p.click('#aiHepsiBtn');
  await p.waitForFunction(()=> !document.getElementById('aiHepsiBtn').disabled, null, { timeout: 25000 });
  a = await alanlar();
  bak('★ gizli alana istek gitmedi: dört istek', istek === 4, String(istek));
  bak('★ gizli alan boş kaldı', a.f_videotitle.deger === '', JSON.stringify(a.f_videotitle));
  bak('modele video başlığı işi hiç tarif edilmedi',
    !/public title of this video/i.test(promptlar.join(' ')), promptlar.join(' ').slice(0,100));
  bak('görünen dördü yazıldı',
    ['f_shorttitle','f_caption','f_hashtags','f_thumb'].every(id=> a[id].deger.length > 0),
    JSON.stringify(a));

  // ------------------------------------------------------- 4. TEK uyari
  console.log('[tek uyarı]');
  await pencere('video');
  await p.evaluate(()=>{
    ['f_videotitle','f_shorttitle','f_caption'].forEach(id=>{
      document.getElementById(id).value = 'elle yazdığım metin';
    });
  });
  istek = 0; await onaySifirla(true);
  await p.click('#aiHepsiBtn');
  await p.waitForFunction(()=> !document.getElementById('aiHepsiBtn').disabled, null, { timeout: 25000 });
  let o = await onay();
  bak('★ uyarı BİR kez soruldu, beş kez değil', o.sayi === 1, JSON.stringify(o));
  bak('uyarı kaç alan olduğunu söylüyor', /3/.test(o.metin.join(' ')), o.metin.join(' '));
  bak('onaydan sonra beşi de yazıldı', istek === 5, String(istek));

  // --------------------------------------------- 5. hayir denince hic yazma
  console.log('[hayır]');
  await pencere('video');
  await p.evaluate(()=>{ document.getElementById('f_caption').value = 'elle yazdığım açıklama'; });
  istek = 0; await onaySifirla(false);
  await p.click('#aiHepsiBtn');
  await p.waitForTimeout(900);
  a = await alanlar();
  bak('★ hayır denince hiç istek gitmedi', istek === 0, String(istek));
  bak('★ elle yazılan metin duruyor', a.f_caption.deger === 'elle yazdığım açıklama', a.f_caption.deger);
  bak('hiçbir alan doldurulmadı', a.f_videotitle.deger === '' && a.f_hashtags.deger === '',
    JSON.stringify(a));

  // --------------------------------------------------- 6. hata halinde dur
  console.log('[hata halinde duruyor]');
  await pencere('video');
  istek = 0; patlat = 2; await onaySifirla(true);
  await p.click('#aiHepsiBtn');
  await p.waitForFunction(()=> !document.getElementById('aiHepsiBtn').disabled, null, { timeout: 25000 });
  bak('★ ikinci istek patlayınca üçüncü hiç gitmedi', istek === 2, String(istek));
  bak('düğme kilitli kalmadı', await p.$eval('#aiHepsiBtn', e=> e.disabled) === false);
  patlat = 0;

  // -------------------------------------- 7. alan basina dugme bozulmamis
  console.log('[alan başına düğme — regresyon]');
  await pencere('video');
  await p.evaluate(()=>{ document.getElementById('f_hashtags').value = 'elle yazdığım etiketler'; });
  istek = 0; await onaySifirla(false);
  await p.click('#aiTagsBtn');
  await p.waitForTimeout(900);
  o = await onay();
  bak('★ tek alan düğmesi hâlâ kendi sorusunu soruyor', o.sayi === 1, JSON.stringify(o));
  bak('hayır denince o alan da korundu',
    (await alanlar()).f_hashtags.deger === 'elle yazdığım etiketler' && istek === 0,
    String(istek));

  // ------------------------------------------------------------ 8. metinler
  console.log('[metinler]');
  const eksik = await p.evaluate(()=>{
    const sonuc = {};
    ['tr','en'].forEach(dil=>{
      setLanguage(dil);
      ['btn_ai_hepsi','ai_hepsi_not'].forEach(k=>{
        const v = t(k); if(!v || v === k) sonuc[dil+':'+k] = String(v);
      });
      [['ai_hepsi_onay',[3]], ['ai_hepsi_calisiyor',[1,4]], ['ai_hepsi_bitti',[4]], ['ai_hepsi_yarim',[2,4]]]
        .forEach(([k,arg])=>{
          const f = t(k);
          if(typeof f !== 'function') { sonuc[dil+':'+k] = 'fonksiyon değil'; return; }
          const v = f(...arg); if(!v) sonuc[dil+':'+k] = 'boş';
        });
    });
    setLanguage('tr');
    return sonuc;
  });
  bak('iki dilde de metinler tanımlı', Object.keys(eksik).length === 0, JSON.stringify(eksik));

  bak('sayfa hatası yok', hata.length === 0, hata.join(' | '));
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
