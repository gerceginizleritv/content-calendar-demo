// Drive'a geri yazma: yeni belge / uzerine yazma, degisiklik kontrolu.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:1000}, colorScheme:'light' });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  // Uygulama artik confirm() degil kendi onayla() penceresini kullaniyor.
  let onaylar = [];
  await page.exposeFunction('__onayKaydet', m=>{ onaylar.push(m); return true; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.route('https://accounts.google.com/gsi/client', r=>r.fulfill({status:200,contentType:'application/javascript', body:`
    window.google = window.google || {};
    window.google.accounts = { oauth2: { initTokenClient(cfg){ return { requestAccessToken(){ setTimeout(()=> cfg.callback({access_token:'tok'}), 10); } }; } } };
  `}));
  await page.route('https://apis.google.com/js/api.js', r=>r.fulfill({status:200,contentType:'application/javascript', body:`
    window.gapi = { load(a,cb){ setTimeout(cb,5); } };
    window.google = window.google || {};
    window.google.picker = { ViewId:{DOCS:'docs'}, Action:{PICKED:'picked',CANCEL:'cancel'},
      DocsView: function(){ this.setIncludeFolders=()=>this; this.setSelectFolderEnabled=()=>this; },
      PickerBuilder: function(){ const o={};
        this.setAppId=()=>this; this.setOAuthToken=()=>this; this.setDeveloperKey=()=>this;
        this.setOrigin=()=>this; this.addView=()=>this; this.setCallback=(cb)=>{o.cb=cb;return this;};
        this.build=()=>({ setVisible(){ setTimeout(()=> o.cb(window.__pick), 10); } }); } };
  `}));
  // Istekleri kaydet
  const istekler = [];
  await page.route('https://www.googleapis.com/**', async (route, req)=>{
    const u = req.url();
    istekler.push({ metot:req.method(), url:u, govde: req.postData() || '' });
    if(/\/upload\/drive\/v3\/files\?/.test(u))
      return route.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({ id:'yeni1', name:'Kariye — 2 Eylül', modifiedTime:'2026-09-02T20:00:00.000Z' })});
    if(/\/upload\/drive\/v3\/files\//.test(u))
      return route.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({ id:'d1', name:'Kariye açılış', modifiedTime:'2026-09-02T21:00:00.000Z' })});
    if(/fields=modifiedTime/.test(u))
      return route.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({ name:'Kariye açılış', modifiedTime: await page.evaluate(()=>window.__docZaman || '2026-09-01T10:00:00.000Z') })});
    return route.fulfill({status:200,contentType:'text/plain', body:'DRIVE METNİ'});
  });

  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=> typeof window.onayla === 'function');
  await page.evaluate(()=>{ window.onayla = g=> window.__onayKaydet(
      typeof g === 'string' ? g : [g&&g.baslik, g&&g.govde, g&&g.not].filter(Boolean).join(' ')); });
  await page.waitForTimeout(1600);
  console.log('DRIVE\'A GERI YAZMA');

  // Drive'dan getir
  await page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr'); setPage('scripts');
    window.__pick = { action:'picked', docs:[{ id:'d1', name:'Kariye açılış', mimeType:'application/vnd.google-apps.document' }] };
    openScript(null, {});
    await new Promise(r=>setTimeout(r,150));
  });
  await page.click('#sc_drive');
  await page.waitForTimeout(900);

  const r0 = await page.evaluate(()=>({ yazDugmesi: !document.getElementById('sc_drivePush').hidden, bag: driveBaglantisi }));
  k('Getirince "Drive\'a yaz" düğmesi belirdi', r0.yazDugmesi===true);
  k('Belge bağı kuruldu', r0.bag.id==='d1' && !!r0.bag.zaman, r0.bag);

  // Pencereyi aç
  await page.click('#sc_drivePush');
  await page.waitForTimeout(250);
  const r1 = await page.evaluate(()=>({
    acik: document.getElementById('driveWriteOverlay').classList.contains('open'),
    ustuneGorunur: !document.getElementById('dw_overwriteWrap').hidden,
    varsayilanYeni: document.getElementById('dw_new').checked,
    ad: document.getElementById('dw_name').value,
    belgeAdi: document.getElementById('dw_overwriteName').textContent
  }));
  k('Yazma penceresi açıldı', r1.acik===true);
  k('İki seçenek de görünüyor', r1.ustuneGorunur===true);
  k('VARSAYILAN "yeni belge" — üzerine yazma değil', r1.varsayilanYeni===true);
  k('Ad kutusu dolu geliyor', r1.ad.length>0, r1.ad);
  k('Hangi belgenin üzerine yazılacağı yazıyor', r1.belgeAdi==='Kariye açılış', r1.belgeAdi);

  // Yeni belge olarak yaz
  await page.evaluate(()=>{ document.getElementById('dw_name').value='Kariye — 2 Eylül'; });
  istekler.length = 0;
  await page.click('#dw_go');
  await page.waitForTimeout(800);
  const yeniIstek = istekler.find(x=> /uploadType=multipart/.test(x.url));
  const r2 = await page.evaluate(()=>({ kapandi: !document.getElementById('driveWriteOverlay').classList.contains('open'),
                                        durum: document.getElementById('sc_driveStatus').textContent, bag: driveBaglantisi }));
  k('Yeni belge isteği gitti', !!yeniIstek && yeniIstek.metot==='POST', yeniIstek && yeniIstek.metot);
  k('Belge Google Docs olarak oluşturuluyor', !!yeniIstek && /vnd\.google-apps\.document/.test(yeniIstek.govde));
  k('Verilen ad kullanılıyor', !!yeniIstek && /Kariye — 2 Eylül/.test(yeniIstek.govde));
  k('Metin gövdede', !!yeniIstek && /DRIVE METNİ/.test(yeniIstek.govde));
  k('Pencere kapandı, sonuç bildiriliyor', r2.kapandi && /yazıldı/.test(r2.durum), r2.durum);
  k('Bağ yeni belgeye geçti', r2.bag.id==='yeni1', r2.bag);

  // Üzerine yazma — belge DEĞİŞMEMİŞSE tek onay
  await page.evaluate(()=>{ driveBaglantisi = { id:'d1', ad:'Kariye açılış', zaman:'2026-09-01T10:00:00.000Z' }; window.__docZaman='2026-09-01T10:00:00.000Z'; });
  await page.click('#sc_drivePush');
  await page.waitForTimeout(200);
  await page.evaluate(()=>{ document.getElementById('dw_overwrite').checked = true; });
  onaylar = [];
  istekler.length = 0;
  await page.click('#dw_go');
  await page.waitForTimeout(900);
  const ustIstek = istekler.find(x=> x.metot==='PATCH');
  k('Üzerine yazma PATCH ile gidiyor', !!ustIstek, ustIstek && ustIstek.url);
  k('Tek onay soruldu (belge değişmemiş)', onaylar.length===1, onaylar.length);
  k('Onayda biçimlendirme uyarısı var', onaylar[0] && /biçimlendirme/i.test(onaylar[0]), onaylar[0] && onaylar[0].slice(0,60));

  // Üzerine yazma — belge DEĞİŞMİŞSE iki onay
  await page.evaluate(()=>{ driveBaglantisi = { id:'d1', ad:'Kariye açılış', zaman:'2026-09-01T10:00:00.000Z' }; window.__docZaman='2026-09-02T18:00:00.000Z'; });
  await page.click('#sc_drivePush');
  await page.waitForTimeout(200);
  await page.evaluate(()=>{ document.getElementById('dw_overwrite').checked = true; });
  onaylar = [];
  await page.click('#dw_go');
  await page.waitForTimeout(900);
  k('Belge değişmişse ÖNCE o söyleniyor', onaylar.length===2 && /değişmiş/.test(onaylar[0]), onaylar.map(x=>x.slice(0,40)));

  // Ad kutusuna yazmak "yeni belge"yi seçiyor
  await page.click('#sc_drivePush');
  await page.waitForTimeout(200);
  await page.evaluate(()=>{ document.getElementById('dw_overwrite').checked = true; });
  await page.fill('#dw_name', 'Başka ad');
  const r3 = await page.evaluate(()=>({ yeni: document.getElementById('dw_new').checked }));
  k('Ad yazınca "yeni belge" seçiliyor', r3.yeni===true);
  await page.evaluate(()=> driveYazPenceresiKapat());

  // --- Bağlı belge YOKKEN: satır duruyor ama kilitli, "Belge seç" var
  await page.evaluate(async ()=>{
    closeScript(); openScript(null, {});
    await new Promise(r=>setTimeout(r,120));
    document.getElementById('sc_text').value = 'Slate\'te sıfırdan yazdığım metin';
    document.getElementById('sc_text').dispatchEvent(new Event('input'));
    driveYazPenceresiAc();
    await new Promise(r=>setTimeout(r,150));
  });
  const r5 = await page.evaluate(()=>({
    satirVar: !document.getElementById('dw_overwriteWrap').hidden,
    kilitli: document.getElementById('dw_overwrite').disabled,
    secDugmesi: document.getElementById('dw_pick').textContent,
    adGizli: document.getElementById('dw_overwriteName').hidden
  }));
  k('Bağlı belge yokken satır DURUYOR', r5.satirVar===true);
  k('Ama seçenek kilitli', r5.kilitli===true);
  k('"Belge seç" düğmesi var', /Belge seç/.test(r5.secDugmesi), r5.secDugmesi);
  k('Belge adı yeri gizli', r5.adGizli===true);

  // Belge seçince açılıyor
  await page.evaluate(()=>{ window.__pick = { action:'picked', docs:[{ id:'d9', name:'Var olan belgem', mimeType:'application/vnd.google-apps.document' }] }; });
  await page.click('#dw_pick');
  await page.waitForTimeout(800);
  const r6 = await page.evaluate(()=>({
    kilitli: document.getElementById('dw_overwrite').disabled,
    secili: document.getElementById('dw_overwrite').checked,
    ad: document.getElementById('dw_overwriteName').textContent,
    secDugmesi: document.getElementById('dw_pick').textContent,
    bag: driveBaglantisi.id
  }));
  k('Belge seçilince kilit açılıyor', r6.kilitli===false);
  k('Seçilen belge işaretleniyor', r6.secili===true && r6.bag==='d9', r6);
  k('Belge adı yazıyor', /Var olan belgem|Kariye açılış/.test(r6.ad), r6.ad);
  k('Düğme "başka belge seç"e dönüyor', /Başka belge/.test(r6.secDugmesi), r6.secDugmesi);

  // Docs olmayan dosya seçilirse
  await page.evaluate(()=>{ driveBaglantisi={id:'',ad:'',zaman:''}; dwUstuneSatiriTazele();
                            window.__pick = { action:'picked', docs:[{ id:'p1', name:'kapak.png', mimeType:'image/png' }] }; });
  await page.click('#dw_pick');
  await page.waitForTimeout(800);
  const r7 = await page.evaluate(()=>({ durum: document.getElementById('dw_status').textContent,
                                        kilitli: document.getElementById('dw_overwrite').disabled }));
  k('Docs olmayan dosya reddediliyor', /Yalnızca bir Google Docs/.test(r7.durum) && r7.kilitli===true, r7);
  await page.evaluate(()=> driveYazPenceresiKapat());

  // Metin yoksa düğme gizli
  await page.evaluate(async ()=>{ closeScript(); openScript(null, {}); await new Promise(r=>setTimeout(r,120)); });
  const r4 = await page.evaluate(()=> document.getElementById('sc_drivePush').hidden);
  k('Metin yokken "Drive\'a yaz" gizli', r4===true);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
