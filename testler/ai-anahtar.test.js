// Tek saglayici (Gemini), adim adim rehber, anahtar dogrulama.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:1000}, colorScheme:'light' });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  let cagri = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async (route, req)=>{
    // Uygulama once anahtara ACIK model listesini soruyor (GET, govdesiz).
    // Sayac yalnizca URETIM isteklerini sayiyor.
    if(req.method() === 'GET'){
      return route.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({models:[{name:'models/gemini-3.7-flash'}]})});
    }
    cagri++;
    const anahtar = req.headers()['x-goog-api-key'] || '';
    if(anahtar === 'AIzaGECERLI_ANAHTAR_123456')
      return route.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({ candidates:[{ content:{ parts:[{ text:'test' }] } }] })});
    return route.fulfill({status:400,contentType:'application/json',
      body: JSON.stringify({ error:{ message:'API key not valid. Please pass a valid API key.' } })});
  });
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1600);
  console.log('AI ANAHTARI — TEK SAĞLAYICI VE REHBER');

  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); setPage('ayarlar'); });
  await page.waitForTimeout(300);

  const r1 = await page.evaluate(()=>({
    // ⛔ 19 KASIM 2026 — "PENCERE ACIK MI" SORUSU ARTIK YOK (YAPILACAKLAR
    //    58 asama 6): AI ayarlari bir SAYFA bolumu, hep "acik".
    //    ⚠ KORU KORUNE CEVIRSEYDIM BU IDDIALAR HER ZAMAN DOGRU OLURDU --
    //      bu oturumda uc kez yakalanan "bos bekci" tuzagi.
    //      Yerine pencerenin acik/kapali olmasinin NE ANLATTIGI olculuyor:
    //        kaydedildi = anahtar kayitli gorunuyor (Kaldir dugmesi cikti,
    //                     kutu bosaldi, durum satiri doldu)
    //        kutuDolu   = yazilan anahtar DURUYOR ki tekrar denenebilsin
    kaydedildi: !document.getElementById('aiForgetBtn').hidden
                && document.getElementById('ai_key').value === ''
                && document.getElementById('ai_state').textContent.trim() !== '',
    kutuDolu: document.getElementById('ai_key').value !== '',
    bolumGorunur: !document.getElementById('ayarlarPage').hidden
                  && document.getElementById('ayarAi').getBoundingClientRect().height > 0,
    saglayiciSecimi: !!document.getElementById('ai_provider'),
    rehberAcik: document.querySelector('.ai-howto') && document.querySelector('.ai-howto').open,
    adimSayisi: document.querySelectorAll('.ai-steps li').length,
    baglanti: document.querySelector('.ai-step-link') && document.querySelector('.ai-step-link').href,
    uyari: document.querySelector('.ai-warn') && document.querySelector('.ai-warn').textContent,
    etiket: document.querySelector('[data-i18n="ai_key_label"]') && document.querySelector('[data-i18n="ai_key_label"]').textContent,
    yerTutucu: document.getElementById('ai_key').placeholder
  }));
  k('AI bölümü ayarlar sayfasında görünür', r1.bolumGorunur===true);
  k('SAĞLAYICI SEÇİMİ KALKTI', r1.saglayiciSecimi===false);
  k('Rehber AÇIK geliyor', r1.rehberAcik===true);
  k('Dört adım var', r1.adimSayisi===4, r1.adimSayisi);
  k('AI Studio bağlantısı doğru', /aistudio\.google\.com\/apikey/.test(r1.baglanti||''), r1.baglanti);
  k('Abonelik ≠ anahtar uyarısı var', /abonelik/i.test(r1.uyari||''), (r1.uyari||'').slice(0,60));
  k('Alan adı Gemini diyor', /Gemini/.test(r1.etiket||''), r1.etiket);
  k('Yer tutucu iki biçimi de gösteriyor', /AQ\./.test(r1.yerTutucu) && /AIza/.test(r1.yerTutucu), r1.yerTutucu);

  // Boş
  await page.click('#aiSettingsSaveBtn');
  await page.waitForTimeout(200);
  const r2 = await page.evaluate(()=>({ ipucu: document.getElementById('ai_key_hint').textContent, cagri: 0 }));
  k('Boşken uyarıyor, ağa çıkmıyor', /Önce bir API/.test(r2.ipucu) && cagriSayisi()===0, r2.ipucu);
  function cagriSayisi(){ return cagri; }

  // Yanlış biçim (ör. OpenAI anahtarı yapıştırılmış)
  await page.fill('#ai_key', 'sk-proj-abcdefghijklmnop');
  await page.click('#aiSettingsSaveBtn');
  await page.waitForTimeout(300);
  const r3 = await page.evaluate(()=> document.getElementById('ai_key_hint').textContent);
  k('Yanlış biçim AĞA ÇIKMADAN söyleniyor', /AQ\. ya da AIza ile başlar/.test(r3) && cagri===0, {ipucu:r3, cagri});

  // Geçersiz anahtar — Google'ın hatası gösteriliyor
  await page.fill('#ai_key', 'AIzaGECERSIZ_ANAHTAR_999');
  await page.click('#aiSettingsSaveBtn');
  await page.waitForTimeout(700);
  const r4 = await page.evaluate(()=>({ ipucu: document.getElementById('ai_key_hint').textContent,
                                        // ⛔ 19 KASIM 2026 — "PENCERE ACIK MI" SORUSU ARTIK YOK (YAPILACAKLAR
    //    58 asama 6): AI ayarlari bir SAYFA bolumu, hep "acik".
    //    ⚠ KORU KORUNE CEVIRSEYDIM BU IDDIALAR HER ZAMAN DOGRU OLURDU --
    //      bu oturumda uc kez yakalanan "bos bekci" tuzagi.
    //      Yerine pencerenin acik/kapali olmasinin NE ANLATTIGI olculuyor:
    //        kaydedildi = anahtar kayitli gorunuyor (Kaldir dugmesi cikti,
    //                     kutu bosaldi, durum satiri doldu)
    //        kutuDolu   = yazilan anahtar DURUYOR ki tekrar denenebilsin
    kaydedildi: !document.getElementById('aiForgetBtn').hidden
                && document.getElementById('ai_key').value === ''
                && document.getElementById('ai_state').textContent.trim() !== '',
    kutuDolu: document.getElementById('ai_key').value !== '',
    bolumGorunur: !document.getElementById('ayarlarPage').hidden
                  && document.getElementById('ayarAi').getBoundingClientRect().height > 0,
                                        kayit: localStorage.getItem('demo_ai_settings') }));
  k('Geçersiz anahtar denendi ve reddedildi', cagri===1, cagri);
  k('Google\'ın hatası gösteriliyor', /API key not valid/.test(r4.ipucu), r4.ipucu);
  // ⚠ "Ekran acik kaldi" yerine: yazilan anahtar KUTUDA duruyor,
  //   yani kullanici duzeltip tekrar deneyebiliyor.
  k('GEÇERSİZ ANAHTAR KAYDEDİLMİYOR', r4.kayit===null && r4.kutuDolu===true, r4.kayit);

  // Geçerli anahtar
  await page.fill('#ai_key', 'AIzaGECERLI_ANAHTAR_123456');
  await page.click('#aiSettingsSaveBtn');
  await page.waitForTimeout(900);
  const r5 = await page.evaluate(()=>({ kayit: JSON.parse(localStorage.getItem('demo_ai_settings')||'null'),
                                        // ⛔ 19 KASIM 2026 — "PENCERE ACIK MI" SORUSU ARTIK YOK (YAPILACAKLAR
    //    58 asama 6): AI ayarlari bir SAYFA bolumu, hep "acik".
    //    ⚠ KORU KORUNE CEVIRSEYDIM BU IDDIALAR HER ZAMAN DOGRU OLURDU --
    //      bu oturumda uc kez yakalanan "bos bekci" tuzagi.
    //      Yerine pencerenin acik/kapali olmasinin NE ANLATTIGI olculuyor:
    //        kaydedildi = anahtar kayitli gorunuyor (Kaldir dugmesi cikti,
    //                     kutu bosaldi, durum satiri doldu)
    //        kutuDolu   = yazilan anahtar DURUYOR ki tekrar denenebilsin
    kaydedildi: !document.getElementById('aiForgetBtn').hidden
                && document.getElementById('ai_key').value === ''
                && document.getElementById('ai_state').textContent.trim() !== '',
    kutuDolu: document.getElementById('ai_key').value !== '',
    bolumGorunur: !document.getElementById('ayarlarPage').hidden
                  && document.getElementById('ayarAi').getBoundingClientRect().height > 0 }));
  k('Geçerli anahtar kaydedildi', r5.kayit && r5.kayit.provider==='gemini' && r5.kayit.key==='AIzaGECERLI_ANAHTAR_123456', r5.kayit);
  k('anahtar KAYITLI görünüyor', r5.kaydedildi===true);

  // Eski Claude ayarı yok sayılıyor
  const r6 = await page.evaluate(()=>{
    localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'claude', key:'sk-ant-eski'}));
    return getAiSettings();
  });
  k('ESKİ CLAUDE AYARI YOK SAYILIYOR', r6===null, r6);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
