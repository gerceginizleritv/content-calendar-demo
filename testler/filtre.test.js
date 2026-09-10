const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1100} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); setPage('calendar'); });
  await page.waitForTimeout(300);
  console.log('FİLTRE ŞERİDİ');

  // 1) Yerlesim: yeni giris dugmesi filtrelerden ONCE ve daha buyuk
  const yer = await page.evaluate(()=>{
    const yeni = document.getElementById('addBtn').getBoundingClientRect();
    const serit = document.getElementById('filterBar').getBoundingClientRect();
    const izgara = document.getElementById('calGrid').getBoundingClientRect();
    const nav = document.querySelector('.cal-nav').getBoundingClientRect();
    return { yeniUst:Math.round(yeni.top), yeniAlan:Math.round(yeni.width*yeni.height),
             seritUst:Math.round(serit.top), seritBoy:Math.round(serit.height),
             izgaraUst:Math.round(izgara.top), navUst:Math.round(nav.top) };
  });
  k('“+ Yeni Giriş” filtrelerden önce geliyor', yer.yeniUst < yer.seritUst, yer.yeniUst+' < '+yer.seritUst);
  k('ŞERİT TAKVİMİN HEMEN ÜSTÜNDE', yer.seritUst > yer.navUst && yer.seritUst < yer.izgaraUst,
     'nav '+yer.navUst+' → şerit '+yer.seritUst+' → ızgara '+yer.izgaraUst);
  k('şerit tek satır (ince)', yer.seritBoy <= 56, yer.seritBoy+'px');

  // 2) Acilir panel calisiyor mu
  const panel = await page.evaluate(async ()=>{
    const kap = document.querySelector('.fdrop[data-drop="platform"]');
    const once = kap.querySelector('.fpanel').hidden;
    kap.querySelector('.fbtn').click();
    await new Promise(r=>setTimeout(r,80));
    const acik = !kap.querySelector('.fpanel').hidden;
    const adet = kap.querySelectorAll('.legend-item').length;
    return { once, acik, adet, aria: kap.querySelector('.fbtn').getAttribute('aria-expanded') };
  });
  k('panel başta kapalı', panel.once === true);
  // Rozet GERCEKTEN gorunmuyor mu: hidden ozniteligi display kuralina
  // yenilebiliyor, o yuzden hesaplanan stile bakiliyor.
  const rozetGizli = await page.evaluate(()=>
    [...document.querySelectorAll('#filterBar .fbadge')].every(el=>getComputedStyle(el).display === 'none'));
  k('filtre yokken rozet GÖRÜNMÜYOR', rozetGizli === true);
  k('düğmeye basınca açılıyor', panel.acik === true, 'aria-expanded='+panel.aria);
  k('sekiz platform listeleniyor', panel.adet === 8, panel.adet);

  // 3) COKLU secim: panel acik kaliyor, rozet sayiyor, takvim suzuluyor
  const coklu = await page.evaluate(async ()=>{
    const kap = document.querySelector('.fdrop[data-drop="platform"]');
    const oncekiCip = document.querySelectorAll('#calGrid .cal-chip').length;
    kap.querySelector('.legend-item[data-platform="youtube"]').click();
    await new Promise(r=>setTimeout(r,120));
    const birSonra = { acik: !kap.querySelector('.fpanel').hidden,
                       rozet: kap.querySelector('.fbadge').textContent,
                       cip: document.querySelectorAll('#calGrid .cal-chip').length };
    kap.querySelector('.legend-item[data-platform="instagram"]').click();
    await new Promise(r=>setTimeout(r,120));
    return { oncekiCip, birSonra,
             rozet2: kap.querySelector('.fbadge').textContent,
             cip2: document.querySelectorAll('#calGrid .cal-chip').length,
             ozet: document.getElementById('filterSummary').textContent,
             temizleGorunur: !document.getElementById('filterClearAll').hidden,
             acik2: !kap.querySelector('.fpanel').hidden };
  });
  k('seçince PANEL AÇIK KALIYOR (çoklu seçim)', coklu.birSonra.acik === true && coklu.acik2 === true);
  k('rozet seçim sayısını gösteriyor', coklu.birSonra.rozet === '1' && coklu.rozet2 === '2', coklu.birSonra.rozet+' → '+coklu.rozet2);
  k('takvim gerçekten süzülüyor', coklu.birSonra.cip < coklu.oncekiCip && coklu.cip2 > coklu.birSonra.cip,
     coklu.oncekiCip+' → '+coklu.birSonra.cip+' → '+coklu.cip2);
  k('kaç filtre açık yazıyor', /filtre/i.test(coklu.ozet||''), coklu.ozet);
  k('“temizle” beliriyor', coklu.temizleGorunur === true);

  // 4) TABLO gorunumunde AYNI serit ve ayni suzme
  const tablo = await page.evaluate(async ()=>{
    document.getElementById('viewTableBtn').click();
    await new Promise(r=>setTimeout(r,250));
    const seritGorunur = !!document.getElementById('filterBar').offsetParent;
    const izgaraGizli = getComputedStyle(document.getElementById('calGrid')).display === 'none';
    const hucre = document.querySelectorAll('#calTableWrap .ct-chip').length;
    // filtreyi kaldir, sayinin artmasi lazim
    document.getElementById('filterClearAll').click();
    await new Promise(r=>setTimeout(r,250));
    const hucre2 = document.querySelectorAll('#calTableWrap .ct-chip').length;
    return { seritGorunur, izgaraGizli, hucre, hucre2,
             rozet: document.querySelector('.fdrop[data-drop="platform"] .fbadge').hidden,
             temizleGizli: document.getElementById('filterClearAll').hidden };
  });
  k('ŞERİT TABLO GÖRÜNÜMÜNDE DE VAR', tablo.seritGorunur === true && tablo.izgaraGizli === true);
  k('tabloda da süzüyor', tablo.hucre2 > tablo.hucre, tablo.hucre+' → '+tablo.hucre2);
  k('“tümünü temizle” hepsini sıfırlıyor', tablo.rozet === true && tablo.temizleGizli === true);

  // 5) Disari tiklayinca kapaniyor
  const kapan = await page.evaluate(async ()=>{
    const kap = document.querySelector('.fdrop[data-drop="type"]');
    kap.querySelector('.fbtn').click(); await new Promise(r=>setTimeout(r,80));
    const acik = !kap.querySelector('.fpanel').hidden;
    document.body.click(); await new Promise(r=>setTimeout(r,80));
    const kapali = kap.querySelector('.fpanel').hidden;
    kap.querySelector('.fbtn').click(); await new Promise(r=>setTimeout(r,80));
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
    await new Promise(r=>setTimeout(r,80));
    return { acik, kapali, escIle: kap.querySelector('.fpanel').hidden };
  });
  k('dışarı tıklayınca kapanıyor', kapan.acik === true && kapan.kapali === true);
  k('Escape ile kapanıyor', kapan.escIle === true);

  // 6) Icerigi olmayan filtre gorunmuyor (proje yokken)
  const bos = await page.evaluate(()=>({
    proje: document.querySelector('.fdrop[data-drop="concept"]').hidden,
    pazar: document.querySelector('.fdrop[data-drop="tz"]').hidden,
    tur: document.querySelector('.fdrop[data-drop="type"]').hidden }));
  k('boş filtre düğmesi gizli (proje/pazar)', bos.proje === true && bos.pazar === true, JSON.stringify(bos));
  k('dolu filtre düğmesi görünür', bos.tur === false);

  const sayfa = await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+1);
  k('sayfa yatay kaymıyor', sayfa === false);

  // 7) TELEFON: panel ekranin ICINDE acilmali
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(300);
  const tel = await page.evaluate(async ()=>{
    const kap = document.querySelector('.fdrop[data-drop="status"]');
    kap.querySelector('.fbtn').click();
    await new Promise(r=>setTimeout(r,150));
    const p = kap.querySelector('.fpanel').getBoundingClientRect();
    return { sol:Math.round(p.left), sag:Math.round(p.right), ust:Math.round(p.top), alt:Math.round(p.bottom),
             en:Math.round(p.width), boy:Math.round(p.height),
             ekranEn:window.innerWidth, ekranBoy:window.innerHeight,
             yatayKayma: document.documentElement.scrollWidth > window.innerWidth+1 };
  });
  k('telefonda panel EKRANIN İÇİNDE', tel.sol >= 0 && tel.sag <= tel.ekranEn && tel.ust >= 0 && tel.alt <= tel.ekranBoy,
     `${tel.sol},${tel.ust} → ${tel.sag},${tel.alt} (ekran ${tel.ekranEn}x${tel.ekranBoy})`);
  k('telefonda panelin boyu var', tel.en > 100 && tel.boy > 40, tel.en+'x'+tel.boy);
  k('telefonda sayfa yatay kaymıyor', tel.yatayKayma === false);

  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
