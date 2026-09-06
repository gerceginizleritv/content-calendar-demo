const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1100} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  let onay = 'dismiss', onaySayisi = 0;
  // Uygulama artik tarayicinin confirm'ini kullanmiyor; kendi onayla()
  // penceresi var. Cevabi Node tarafindaki degiskenden okuyoruz.
  await page.exposeFunction('__onayCevap', ()=>{ onaySayisi++; return onay === 'accept'; });
  await page.addInitScript(()=>{ try{
    localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AIzaTESTKEY0123456789'}));
  }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());

  // Gemini'yi taklit ediyoruz: giden prompt'u saklayip sabit cevap donuyor.
  const gidenler = [];
  let cevap = 'AÇILIŞ\nBu sarayın kapısı 700 yıldır aynı yere bakıyor.\n\nORTA\nİçeri girelim.\n\nKAPANIŞ\nSıradaki videoda arka bahçe.';
  await page.route('**generativelanguage.googleapis.com**', async r=>{
    // Uygulama once anahtara ACIK model listesini soruyor (GET, govdesiz).
    if(r.request().method() === 'GET'){
      return r.fulfill({status:200,contentType:'application/json',
        body: JSON.stringify({models:[{name:'models/gemini-3.7-flash'}]})});
    }
    gidenler.push(JSON.parse(r.request().postData()).contents[0].parts[0].text);
    await r.fulfill({status:200,contentType:'application/json',
      body: JSON.stringify({candidates:[{content:{parts:[{text:cevap}]}}]})});
  });

  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);

  await page.evaluate(()=>{
    window.onayla = ()=> window.__onayCevap();
    window.uyari  = ()=> Promise.resolve(true);
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    projects = [{ id:'p_tekfur', name:'Tekfur Sarayı', type:'outdoor', keywords:'bizans, saray',
      notes:'Çekim izni alındı.', address:'Edirnekapı', shootDate:'', script:false, shot:false,
      edited:false, published:false, permit:false, cancelled:false, deadlines:{}, createdAt:Date.now() }];
    saveProjects();
    fikirler = [
      { id:'f1', text:'Duvardaki tuğla deseni neyi anlatıyor?', parts:[
          {id:'a', text:'Duvardaki tuğla deseni neyi anlatıyor?'},
          {id:'b', text:'Sarayın son sahibi kimdi?'} ],
        projectId:'p_tekfur', sort:0, createdAt:Date.now(), updatedAt:Date.now() },
      { id:'f2', text:'BAŞKA PROJENİN FİKRİ', parts:[{id:'c', text:'BAŞKA PROJENİN FİKRİ'}],
        projectId:'', sort:1, createdAt:Date.now(), updatedAt:Date.now() }
    ];
    saveFikirler();
    scriptler = []; saveScriptler();
    renderFikirler(); renderScriptler(); renderProjects();
  });
  await page.waitForTimeout(300);

  console.log('SCRIPT PENCERESİNDE “AI İLE YAZ”');
  await page.evaluate(()=>{ openScript(null, {projectId:'p_tekfur', title:'Tekfur Sarayı — bölüm 1'}); });
  await page.waitForTimeout(300);
  const gorunur = await page.evaluate(()=>{
    const d = document.getElementById('sc_ai');
    return { var: !!d, gorunur: d ? getComputedStyle(d).display !== 'none' : false, metin: d ? d.textContent.trim() : '' };
  });
  k('script penceresinde AI düğmesi var', gorunur.var && gorunur.gorunur, gorunur.metin);

  await page.click('#sc_ai');
  await page.waitForTimeout(500);
  const p1 = gidenler[gidenler.length-1] || '';
  k('istek gitti', gidenler.length === 1, gidenler.length+' istek');
  k('PROJE bağlama giriyor', /Project: Tekfur Sarayı/.test(p1));
  k('proje türü ÇEVRİLMİŞ hâlde bağlamda', /Project kind: Dış çekim/.test(p1), (p1.match(/Project kind:.*/)||[''])[0]);
  k('anahtar kelimeler bağlamda', /bizans, saray/.test(p1));
  k('adres bağlamda', /Edirnekapı/.test(p1));
  k('FİKİRLER bağlama giriyor', /Duvardaki tuğla deseni/.test(p1));
  k('BİRLEŞİK kartın ikinci parçası da giriyor', /Sarayın son sahibi/.test(p1));
  k('BAŞKA projenin fikri SIZMIYOR', !/BAŞKA PROJENİN FİKRİ/.test(p1));
  k('script başlığı bağlamda', /What this script is for: Tekfur Sarayı — bölüm 1/.test(p1));
  k('çıktı dili Türkçe isteniyor', /Write it in Turkish/.test(p1));

  const y1 = await page.evaluate(()=>({
    metin: document.getElementById('sc_text').value,
    geriAl: !document.getElementById('sc_driveUndo').hidden,
    durum: document.getElementById('sc_driveStatus').textContent,
    durumSinif: document.getElementById('sc_driveStatus').className
  }));
  k('metin kutuya yazıldı', y1.metin.indexOf('AÇILIŞ') === 0, y1.metin.slice(0,20));
  k('“önceki hâle dön” çıktı', y1.geriAl);
  k('durum yeşil', /ok/.test(y1.durumSinif), y1.durum.slice(0,40));

  // Dolu metnin ustune SORMADAN yazmiyor
  onay = 'dismiss';
  await page.click('#sc_ai');
  await page.waitForTimeout(400);
  const y2 = await page.evaluate(()=>document.getElementById('sc_text').value);
  k('dolu metnin üstüne sormadan yazmıyor', y2.indexOf('AÇILIŞ') === 0, y2.slice(0,12));
  k('vazgeçilince yeni istek gitmiyor', gidenler.length === 1, gidenler.length+' istek');

  // Geri al eski metni getiriyor
  await page.click('#sc_driveUndo');
  await page.waitForTimeout(200);
  const y3 = await page.evaluate(()=>({ metin: document.getElementById('sc_text').value,
                                        gizli: document.getElementById('sc_driveUndo').hidden }));
  k('“önceki hâle dön” eski (boş) metni getiriyor', y3.metin === '' && y3.gizli === true, JSON.stringify(y3.metin));

  // Kaydedince source 'ai' oluyor
  onay = 'accept';
  await page.click('#sc_ai');
  await page.waitForTimeout(500);
  await page.click('#sc_save');
  await page.waitForTimeout(300);
  const kayit = await page.evaluate(()=>({ adet: scriptler.length, src: (scriptler[0]||{}).source,
                                           pid: (scriptler[0]||{}).projectId }));
  k('script kaydedildi', kayit.adet === 1);
  k('kaynak “ai” yazıldı (drive değil)', kayit.src === 'ai', String(kayit.src));
  k('proje bağı korundu', kayit.pid === 'p_tekfur', String(kayit.pid));

  console.log('\nKAYIT PENCERESİ — BAŞLIK / KISA BAŞLIK / AÇIKLAMA');
  cevap = '"Tekfur Sarayı: 700 yıllık duvarın arkası"';
  await page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    openModal(null, '2026-09-20', '20:00');
    await new Promise(r=>setTimeout(r,200));
    document.getElementById('f_project').value = 'p_tekfur';
    document.getElementById('f_title').value = 'Tekfur Sarayı gezisi';
    document.getElementById('f_type').value = 'video';
    document.getElementById('f_type').dispatchEvent(new Event('change'));
  });
  await page.waitForTimeout(300);
  const dugmeler = await page.evaluate(()=>['aiDraftBtn','aiTitleBtn','aiShortBtn']
    .map(id=>({id, var: !!document.getElementById(id)})));
  k('üç AI düğmesi de var', dugmeler.every(d=>d.var), JSON.stringify(dugmeler));

  const oncekiAdet = gidenler.length;
  await page.click('#aiTitleBtn');
  await page.waitForTimeout(500);
  const p2 = gidenler[gidenler.length-1] || '';
  k('başlık isteği gitti', gidenler.length === oncekiAdet+1);
  k('kayıt bağlamında SCRIPT var', /The script for this project/.test(p2));
  k('kayıt bağlamında FİKİRLER var', /Duvardaki tuğla deseni/.test(p2));
  k('kayıt bağlamında platform var', /Platform:/.test(p2), (p2.match(/Platform:.*/)||[''])[0]);
  k('başlık tarifi doğru', /public title of this video/.test(p2));

  const bas = await page.evaluate(()=>document.getElementById('f_videotitle').value);
  k('TIRNAKLAR temizlendi', bas === 'Tekfur Sarayı: 700 yıllık duvarın arkası', bas);

  // Kisa baslik: cok satirli cevaptan ILK satir aliniyor
  cevap = 'Başlık: 700 YILLIK DUVAR\nikinci satır gitmeli';
  await page.click('#aiShortBtn');
  await page.waitForTimeout(500);
  const kisa = await page.evaluate(()=>document.getElementById('f_shorttitle').value);
  k('tek satır alınıyor ve “Başlık:” öneki atılıyor', kisa === '700 YILLIK DUVAR', kisa);

  // Dolu alanin ustune sormadan yazmiyor
  const adet2 = gidenler.length;
  onay = 'dismiss';
  await page.click('#aiShortBtn');
  await page.waitForTimeout(400);
  k('dolu alanın üstüne sormadan yazmıyor', gidenler.length === adet2, gidenler.length+' istek');

  // Baglam yoksa istek HIC gitmiyor
  await page.evaluate(()=>{
    document.getElementById('f_project').value = '';
    document.getElementById('f_title').value = '';
    document.getElementById('f_caption').value = '';
  });
  const adet3 = gidenler.length;
  await page.click('#aiDraftBtn');
  await page.waitForTimeout(400);
  const bosDurum = await page.evaluate(()=>({ metin: document.getElementById('aiStatus').textContent,
                                              sinif: document.getElementById('aiStatus').className }));
  k('dayanak yokken istek gitmiyor', gidenler.length === adet3, gidenler.length+' istek');
  k('kullanıcıya sebebi söyleniyor', /dayanak/.test(bosDurum.metin) && /error/.test(bosDurum.sinif), bosDurum.metin);

  // Anahtar yoksa AI ayar ekrani aciliyor
  await page.evaluate(()=>{ localStorage.removeItem('demo_ai_settings');
    document.getElementById('f_title').value = 'Bir şey'; });
  const adet4 = gidenler.length;
  await page.click('#aiDraftBtn');
  await page.waitForTimeout(400);
  const ayarAcik = await page.evaluate(()=>document.getElementById('aiSettingsOverlay').classList.contains('open'));
  k('anahtar yokken ayar ekranı açılıyor', ayarAcik);
  k('anahtar yokken istek gitmiyor', gidenler.length === adet4);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
