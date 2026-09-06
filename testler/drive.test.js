// Drive'dan getirme: izin, secim, okuma, uzerine yazma sorusu, geri alma.
// Google'a cikilmiyor; betikler ve uc nokta taklit ediliyor.
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

  // --- Google betikleri: sahte ---
  await page.route('https://accounts.google.com/gsi/client', r=>r.fulfill({status:200,contentType:'application/javascript', body:`
    window.google = window.google || {};
    window.google.accounts = { oauth2: { initTokenClient(cfg){
      window.__sonKapsam = cfg.scope;
      return { requestAccessToken(){
        if(window.__izinVer === false){ cfg.error_callback && cfg.error_callback({type:'popup_closed'}); return; }
        setTimeout(()=> cfg.callback({ access_token:'sahte-token' }), 10);
      } };
    } } };
  `}));
  await page.route('https://apis.google.com/js/api.js', r=>r.fulfill({status:200,contentType:'application/javascript', body:`
    window.gapi = { load(ad, cb){ setTimeout(cb, 5); } };
    window.google = window.google || {};
    window.google.picker = {
      ViewId:{ DOCS:'docs' }, Action:{ PICKED:'picked', CANCEL:'cancel' },
      DocsView: function(){ this.setIncludeFolders=()=>this; this.setSelectFolderEnabled=()=>this; },
      PickerBuilder: function(){
        const o = {};
        this.setAppId=()=>this; this.setOAuthToken=()=>this; this.setDeveloperKey=()=>this;
        this.setOrigin=()=>this; this.addView=()=>this;
        this.setCallback=(cb)=>{ o.cb=cb; return this; };
        this.build=()=>({ setVisible(){ setTimeout(()=> o.cb(window.__pickerSonuc), 10); } });
      }
    };
  `}));
  // --- Drive uc noktasi: sahte ---
  await page.route('https://www.googleapis.com/drive/v3/files/**', r=>{
    if(page.__hataVer) return r.fulfill({status:403, body:'yok'});
    r.fulfill({status:200, contentType:'text/plain',
      body:'AÇILIŞ — Kariye Camii\n\nKubbenin altında duruyoruz.'});
  });

  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1600);
  console.log('DRIVE\'DAN GETIRME');

  const hazirla = async ()=> page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr'); setPage('scripts');
    openScript(null, {});
    await new Promise(r=>setTimeout(r,150));
  });

  // 1) Bos alana getirme
  await page.evaluate(()=>{ window.__pickerSonuc = { action:'picked', docs:[{ id:'d1', name:'Kariye açılış', mimeType:'application/vnd.google-apps.document' }] }; });
  await hazirla();
  await page.click('#sc_drive');
  await page.waitForTimeout(900);
  const r1 = await page.evaluate(()=>({
    metin: document.getElementById('sc_text').value,
    baslik: document.getElementById('sc_title').value,
    durum: document.getElementById('sc_driveStatus').textContent,
    durumSinif: document.getElementById('sc_driveStatus').className,
    geriAl: !document.getElementById('sc_driveUndo').hidden,
    kapsam: window.__sonKapsam,
    sayac: document.getElementById('scCount').textContent
  }));
  k('Metin geldi', r1.metin.startsWith('AÇILIŞ — Kariye'), r1.metin.slice(0,25));
  k('Başlık belge adından kondu', r1.baslik==='Kariye açılış', r1.baslik);
  k('Karakter sayacı güncellendi', /karakter/.test(r1.sayac), r1.sayac);
  k('İZİN KAPSAMI SADECE drive.file', r1.kapsam==='https://www.googleapis.com/auth/drive.file', r1.kapsam);
  k('Biçimlendirme uyarısı gösteriliyor', /Biçimlendirme gelmez/.test(r1.durum), r1.durum);
  k('"Önceki hâle dön" belirdi', r1.geriAl===true);

  // 2) Geri alma
  await page.click('#sc_driveUndo');
  await page.waitForTimeout(200);
  const r2 = await page.evaluate(()=>({
    metin: document.getElementById('sc_text').value,
    geriAl: !document.getElementById('sc_driveUndo').hidden
  }));
  k('Geri alınca metin boşaldı', r2.metin==='', r2.metin);
  k('Geri alma düğmesi kayboldu', r2.geriAl===false);

  // 3) DOLU metnin üzerine SORMADAN yazmamalı — hayır dersek dokunmamalı
  await page.evaluate(()=>{ document.getElementById('sc_text').value = 'ELLE YAZDIĞIM METİN'; });
  await page.evaluate(()=>{ window.onayla = ()=> Promise.resolve(false); });
  await page.click('#sc_drive');
  await page.waitForTimeout(900);
  const r3 = await page.evaluate(()=> document.getElementById('sc_text').value);
  k('HAYIR denince mevcut metin korunuyor', r3==='ELLE YAZDIĞIM METİN', r3);

  // 4) EVET denince değişiyor ve geri alınabiliyor
  await page.evaluate(()=>{ window.onayla = ()=> Promise.resolve(true); });
  await page.click('#sc_drive');
  await page.waitForTimeout(900);
  const r4 = await page.evaluate(()=>({ metin: document.getElementById('sc_text').value, geriAl: !document.getElementById('sc_driveUndo').hidden }));
  k('EVET denince metin değişti', r4.metin.startsWith('AÇILIŞ'), r4.metin.slice(0,20));
  await page.click('#sc_driveUndo');
  await page.waitForTimeout(200);
  const r4b = await page.evaluate(()=> document.getElementById('sc_text').value);
  k('Üzerine yazma da geri alınabiliyor', r4b==='ELLE YAZDIĞIM METİN', r4b);

  // 5) Vazgeçilirse hiçbir şey olmuyor
  await page.evaluate(()=>{ window.__pickerSonuc = { action:'cancel' }; document.getElementById('sc_text').value=''; });
  await page.click('#sc_drive');
  await page.waitForTimeout(700);
  const r5 = await page.evaluate(()=>({ metin: document.getElementById('sc_text').value, durum: document.getElementById('sc_driveStatus').textContent }));
  k('Seçimden vazgeçilince sessiz kalıyor', r5.metin==='' && r5.durum==='', r5);

  // 6) Desteklenmeyen dosya türü
  await page.evaluate(()=>{ window.__pickerSonuc = { action:'picked', docs:[{ id:'d2', name:'kapak.png', mimeType:'image/png' }] }; });
  await page.click('#sc_drive');
  await page.waitForTimeout(800);
  const r6 = await page.evaluate(()=>({ durum: document.getElementById('sc_driveStatus').textContent, sinif: document.getElementById('sc_driveStatus').className }));
  k('Desteklenmeyen tür anlaşılır şekilde söyleniyor', /Yalnızca Google Docs/.test(r6.durum) && /error/.test(r6.sinif), r6);

  // 7) İzin verilmezse
  await page.evaluate(()=>{ window.__izinVer = false; driveToken = null; window.__pickerSonuc = { action:'cancel' }; });
  await page.click('#sc_drive');
  await page.waitForTimeout(800);
  const r7 = await page.evaluate(()=> document.getElementById('sc_driveStatus').textContent);
  k('İzin verilmezse anlaşılır uyarı', /izni verilmedi/.test(r7), r7);

  // 8) Pencere yeniden açılınca durum sıfırlanıyor
  await page.evaluate(async ()=>{ closeScript(); openScript(null, {}); await new Promise(r=>setTimeout(r,120)); });
  const r8 = await page.evaluate(()=>({ durum: document.getElementById('sc_driveStatus').textContent, geriAl: !document.getElementById('sc_driveUndo').hidden }));
  k('Yeni pencerede durum ve geri alma sıfır', r8.durum==='' && r8.geriAl===false, r8);

  // 9) Sayfa açılırken Google'a bağlanılmıyor
  const betikler = await page.evaluate(()=> [...document.querySelectorAll('script[src]')].map(x=>x.src).filter(x=>/google/.test(x)));
  k('Google betikleri ancak düğmeye basınca yüklendi (sayfa açılışında değil)', betikler.length===2, betikler);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
