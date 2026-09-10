const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  const hatalar=[];
  const ac = async (w,h,oturum)=>{
    const page = await b.newPage({ viewport:{width:w,height:h} });
    page.on('pageerror', e=>hatalar.push(String(e)));
    await page.addInitScript((o)=>{
      try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_page','calendar');
           localStorage.setItem('demo_pitch','kapali'); }catch(e){}
      window.supabase = { createClient(){ return {
        auth:{ getSession: ()=>Promise.resolve({data:{session:o}}),
               onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
               signOut: ()=>Promise.resolve({error:null}) },
        from(){ const q={ select(){return q;}, eq(){return q;}, is(){return q;}, in(){return q;},
          maybeSingle(){return Promise.resolve({data:null,error:null});},
          upsert(){return Promise.resolve({data:[],error:null});},
          update(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
          delete(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
          then(r){ return Promise.resolve({data:[],error:null}).then(r); } }; return q; } };}};
    }, oturum);
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.route('**/goatcounter**', r=>r.abort());
    // Google profil fotografi: gercek istek yok, sahte bir resim donduruyoruz
    await page.route('**/foto.png', r=>r.fulfill({status:200,contentType:'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')}));
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    await page.waitForTimeout(300);
    return page;
  };
  console.log('SOL ŞERİT');

  // 1) Masaustu yerlesimi
  let page = await ac(1366,768,null);
  const y = await page.evaluate(()=>{
    const r = s=>{ const e=document.querySelector(s); return e?e.getBoundingClientRect():null; };
    const serit=r('.rail'), ana=r('.rail-main'), izgara=r('.cal-grid');
    const sira = ['.rail-brand','.rail-me','.rail-nav','.rail-foot'].map(s=>Math.round(r(s).top));
    return { seritEn:Math.round(serit.width), seritSol:Math.round(serit.left),
             anaSol:Math.round(ana.left), izgaraUst:Math.round(izgara.top),
             sira, yatayKayma: document.documentElement.scrollWidth > window.innerWidth+1,
             ustBosluk: Math.round(serit.top) };
  });
  k('şerit solda ve 208px', y.seritEn === 208 && y.seritSol < y.anaSol, y.seritEn+'px');
  k('SIRA DOĞRU: logo → profil → sekmeler → alt grup',
     y.sira[0] < y.sira[1] && y.sira[1] < y.sira[2] && y.sira[2] < y.sira[3], JSON.stringify(y.sira));
  k('TAKVİM EN ÜSTTE', y.izgaraUst < 300, y.izgaraUst+'px');
  k('sayfa yatay kaymıyor', y.yatayKayma === false);

  // 2) Ust satirda hicbir sey kalmadi
  const ust = await page.evaluate(()=>({
    headTop: !!document.querySelector('.head-top'),
    headActions: !!document.querySelector('.head-actions'),
    headMeta: !!document.querySelector('.head-meta'),
    eskiTabs: !!document.querySelector('.tabs'),
    seritte: ['authBtn','langSelect','themeBtn','pitchToggle','tourBtn','feedbackBtn',
              'tabProjects','tabCalendar','tabTemplates']
             .every(id=>!!document.getElementById(id).closest('.rail')),
    altta: ['buildId','exportBtn','resetBtn'].every(id=>!!document.getElementById(id).closest('.site-foot')),
    gizlilikAltta: !!document.querySelector('.site-foot .privacy-link')
  }));
  k('eski üst satırlar kalktı', !ust.headTop && !ust.headActions && !ust.headMeta && !ust.eskiTabs);
  k('HEPSİ ŞERİTTE (giriş, dil, tema, nedir, nasıl çalışır, geri bildirim, 3 sekme)', ust.seritte === true);
  k('SÜRÜM DAMGASI SAYFA ALTINDA', ust.altta === true && ust.gizlilikAltta === true);

  // 3) Sekmeler calisiyor
  const gecis = await page.evaluate(async ()=>{
    document.getElementById('tabTemplates').click(); await new Promise(r=>setTimeout(r,200));
    const s1 = { sablon: !document.getElementById('templatesPage').hidden,
                 aktif: document.getElementById('tabTemplates').classList.contains('active') };
    document.getElementById('tabCalendar').click(); await new Promise(r=>setTimeout(r,200));
    return { s1, takvim: !document.getElementById('calendarPage').hidden,
             aktif2: document.getElementById('tabCalendar').classList.contains('active') };
  });
  k('şeritteki sekmeler sayfa değiştiriyor', gecis.s1.sablon && gecis.s1.aktif && gecis.takvim && gecis.aktif2);

  // 4) Giris yapilmamis: bos daire, ad yok
  const bos = await page.evaluate(()=>({
    bosDaire: document.getElementById('railAvatar').classList.contains('bos'),
    adGizli: document.getElementById('railName').hidden,
    dugme: document.getElementById('authBtn').textContent.trim(),
    dugmeAltinda: document.getElementById('authBtn').getBoundingClientRect().top >
                  document.getElementById('railAvatar').getBoundingClientRect().top
  }));
  k('girişsizken daire boş, ad yok', bos.bosDaire && bos.adGizli);
  const isaret = await page.evaluate(()=>{
    const d = document.getElementById('railAvatar');
    const svg = d.querySelector('svg');
    return { svgVar: !!svg, gorunur: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
             yazi: d.textContent.trim() };
  });
  k('GİRİŞSİZ DAİREDE SLATE İŞARETİ VAR', isaret.svgVar && isaret.gorunur > 10, isaret.gorunur+'px');
  k('işaretin yanında yazı yok', isaret.yazi === '', JSON.stringify(isaret.yazi));
  k('GİRİŞ DÜĞMESİ FOTOĞRAFIN ALTINDA', bos.dugmeAltinda === true, bos.dugme);
  await page.close();

  // 5) Google ile giris: fotograf ve ad
  page = await ac(1366,768,{ user:{ id:'u1', email:'bostancioglum@gmail.com',
    user_metadata:{ full_name:'Murat Bostancıoğlu', avatar_url:'https://example.test/foto.png' } } });
  await page.waitForTimeout(700);
  const girisli = await page.evaluate(()=>({
    ad: document.getElementById('railName').textContent,
    adGorunur: !document.getElementById('railName').hidden,
    fotoVar: !!document.querySelector('#railAvatar img'),
    dugme: document.getElementById('authBtn').textContent.trim(),
    baslik: document.getElementById('authBtn').title
  }));
  k('GOOGLE PROFİL FOTOĞRAFI GELDİ', girisli.fotoVar === true);
  k('ad şeritte yazıyor', /Murat/.test(girisli.ad) && girisli.adGorunur, girisli.ad);
  k('düğme “Hesabım” diyor, e-posta ipucunda', /Hesab/.test(girisli.dugme) && /gmail/.test(girisli.baslik), girisli.dugme);
  await page.close();

  // 6) Fotografsiz giris (e-posta linki): bas harf
  page = await ac(1366,768,{ user:{ id:'u2', email:'ayse.yilmaz@example.com', user_metadata:{} } });
  await page.waitForTimeout(500);
  const harf = await page.evaluate(()=>({
    metin: document.getElementById('railAvatar').textContent.trim(),
    foto: !!document.querySelector('#railAvatar img') }));
  k('fotoğrafsız girişte BAŞ HARF çıkıyor', harf.metin.length >= 1 && !harf.foto, harf.metin);
  await page.close();

  // 7) Fotograf yuklenemezse bas harf kaliyor
  page = await b.newPage({ viewport:{width:1366,height:768} });
  await page.addInitScript(()=>{
    try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){}
    window.supabase = { createClient(){ return {
      auth:{ getSession: ()=>Promise.resolve({data:{session:{user:{id:'u3',email:'x@y.com',
              user_metadata:{ full_name:'Test Kullanıcı', avatar_url:'https://example.test/YOK.png' }}}}}),
             onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; } },
      from(){ const q={ select(){return q;}, eq(){return q;}, is(){return q;}, in(){return q;},
        maybeSingle(){return Promise.resolve({data:null,error:null});},
        upsert(){return Promise.resolve({data:[],error:null});},
        update(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
        delete(){ const p=Promise.resolve({data:[],error:null}); p.in=()=>Promise.resolve({data:[],error:null}); return p; },
        then(r){ return Promise.resolve({data:[],error:null}).then(r); } }; return q; } };}};
  });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/YOK.png', r=>r.abort());
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1800);
  const kirik = await page.evaluate(()=>({
    metin: document.getElementById('railAvatar').textContent.trim(),
    img: !!document.querySelector('#railAvatar img') }));
  k('FOTOĞRAF YÜKLENEMEZSE baş harf kalıyor', kirik.metin.length >= 1 && !kirik.img, kirik.metin);
  await page.close();

  // 8) Telefon: serit yatay, navigasyon GORUNUR
  page = await ac(390,844,null);
  const tel = await page.evaluate(()=>{
    const serit = document.querySelector('.rail').getBoundingClientRect();
    const t1 = document.getElementById('tabProjects').getBoundingClientRect();
    const t2 = document.getElementById('tabCalendar').getBoundingClientRect();
    return { yatay: Math.abs(t1.top - t2.top) < 4, seritEn: Math.round(serit.width),
             gorunur: t1.width > 0 && t1.height > 0,
             izgara: Math.round(document.querySelector('.cal-grid').getBoundingClientRect().top),
             kayma: document.documentElement.scrollWidth > window.innerWidth+1 };
  });
  k('telefonda şerit yatay', tel.yatay === true);
  k('TELEFONDA NAVİGASYON GÖRÜNÜR (hamburger yok)', tel.gorunur === true);
  k('telefonda takvim yukarı geldi', tel.izgara < 750, tel.izgara+'px');
  k('telefonda yatay kayma yok', tel.kayma === false);

  // Telefon + TABLO gorunumu: genis tablo yalnizca KENDI icinde kaymali,
  // sayfa kaymamali. Sutunlu duzende .shell cocuklarini icerige gore
  // boyutlarken butun sayfa 992px'e cikiyordu.
  const tablo = await page.evaluate(async ()=>{
    document.getElementById('viewTableBtn').click();
    await new Promise(r=>setTimeout(r,350));
    const sar = document.querySelector('.cal-table-wrap');
    return { sayfaKayar: document.documentElement.scrollWidth > window.innerWidth + 1,
             anaEn: Math.round(document.querySelector('.rail-main').getBoundingClientRect().width),
             tabloKendiKayar: sar.scrollWidth > sar.clientWidth + 1 };
  });
  k('TELEFONDA TABLO GÖRÜNÜMÜNDE SAYFA KAYMIYOR', tablo.sayfaKayar === false, 'çalışma alanı '+tablo.anaEn+'px');
  k('tablo kendi içinde kayıyor', tablo.tabloKendiKayar === true);
  await page.close();

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
