// KAYIT PENCERESINDEKI ✨ AI ALANLARI.
//
// Uc alanda vardi (aciklama, video basligi, kapak yazisi); etiketler ve
// kapak gorseli tarifi elde kalmisti. Ikisi de elle yazmasi en sikici,
// AI'in en iyi oldugu isler.
//
// Burada model TAKLIT ediliyor: gercek Gemini'ye cikilmiyor. Olculen sey
// modelin cevabi degil, DUGMENIN ISLEYISI — dogru alani dolduruyor mu,
// prompt'a dogru is tarifi gidiyor mu, cok satirli cevap kirpiliyor mu.
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

  // Modelin gordugu prompt'lar burada birikiyor.
  const promptlar = [];
  let cevap = 'tamam';
  await p.route('**generativelanguage.googleapis.com/v1beta/models', r=> r.fulfill({ status:200,
    contentType:'application/json',
    body: JSON.stringify({ models:[{ name:'models/gemini-3.5-flash',
                                     supportedGenerationMethods:['generateContent'] }] }) }));
  await p.route('**generativelanguage.googleapis.com/v1beta/models/**', async r=>{
    let govde = {};
    try{ govde = JSON.parse(r.request().postData() || '{}'); }catch(e){}
    promptlar.push(JSON.stringify(govde).slice(0, 4000));
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

  // Anahtar: gercek bir anahtar DEGIL, sadece dugmelerin acilmasi icin.
  await p.click('#aiSettingsBtn'); await p.waitForTimeout(300);
  await p.fill('#ai_key', 'AQ.TESTANAHTARI_123456');
  await p.click('#aiSettingsSaveBtn');
  await p.waitForTimeout(900);
  await p.evaluate(()=> document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')));

  // Kayit penceresi: AI'in uretebilmesi icin bir baglam gerekiyor.
  await p.evaluate(()=>{
    openModal(null, fmtKey(new Date()), '10:00');
    document.getElementById('f_title').value = 'Balat sokaklarında sabah çekimi';
    document.getElementById('f_type').value = 'video';
  });
  await p.waitForTimeout(500);

  console.log('[düğmeler yerinde]');
  for(const [ad, id] of [['etiketler','aiTagsBtn'], ['kapak görseli tarifi','aiThumbBtn']]){
    bak(ad + ': ✨ AI düğmesi var', await p.$('#'+id) !== null, '#'+id);
  }

  console.log('[etiketler]');
  cevap = 'balat, istanbul, sokak fotoğrafçılığı, sabah ışığı, vlog';
  promptlar.length = 0;
  await p.click('#aiTagsBtn');
  await p.waitForFunction(()=> document.getElementById('f_hashtags').value.length > 0,
                          null, { timeout: 10000 });
  bak('alan dolduruldu',
      /balat/.test(await p.$eval('#f_hashtags', e=> e.value)),
      await p.$eval('#f_hashtags', e=> e.value));
  bak('modele etiket işi tarif edildi', /hashtags/i.test(promptlar.join(' ')),
      promptlar.join(' ').slice(0, 120));
  bak('modele # işareti istemediğimiz söylendi',
      /WITHOUT the # sign/i.test(promptlar.join(' ')));
  bak('modele kaydın konusu gitti', /Balat/.test(promptlar.join(' ')));

  console.log('[kapak görseli tarifi]');
  // Cok satirli cevap: kirpilmamali. Basligi tek satira indiren kural
  // buraya uygulanirsa metnin yarisi gider.
  cevap = 'A narrow Balat street at sunrise, warm low light.\nShot at eye level, 35mm, shallow depth of field.\nQuiet, unhurried mood.';
  promptlar.length = 0;
  await p.click('#aiThumbBtn');
  await p.waitForFunction(()=> document.getElementById('f_thumb').value.length > 0,
                          null, { timeout: 10000 });
  const thumb = await p.$eval('#f_thumb', e=> e.value);
  bak('alan dolduruldu', /Balat/.test(thumb), thumb.slice(0, 60));
  bak('çok satırlı cevap KIRPILMADI', thumb.split('\n').length === 3,
      thumb.split('\n').length + ' satır');
  bak('modele görsel üretici tarifi gitti',
      /image-generation prompt/i.test(promptlar.join(' ')));
  bak('modele "görselde yazı olmasın" dendi',
      /No text or lettering/i.test(promptlar.join(' ')));

  console.log('[eski alanlar bozulmadı]');
  cevap = 'Balat’ta sabahın ilk ışığı';
  await p.click('#aiTitleBtn');
  await p.waitForFunction(()=> document.getElementById('f_videotitle').value.length > 0,
                          null, { timeout: 10000 });
  const vt = await p.$eval('#f_videotitle', e=> e.value);
  bak('video başlığı hâlâ çalışıyor', /Balat/.test(vt), vt);
  // Baslik TEK SATIR kalmali.
  cevap = 'Birinci satır\nİkinci satır';
  await p.evaluate(()=>{ document.getElementById('f_videotitle').value = ''; });
  await p.click('#aiTitleBtn');
  await p.waitForFunction(()=> document.getElementById('f_videotitle').value.length > 0,
                          null, { timeout: 10000 });
  bak('başlık tek satıra indiriliyor',
      (await p.$eval('#f_videotitle', e=> e.value)).indexOf('\n') === -1,
      await p.$eval('#f_videotitle', e=> e.value));

  bak('sayfa hatası yok', hata.length === 0, hata.join(' | '));
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
