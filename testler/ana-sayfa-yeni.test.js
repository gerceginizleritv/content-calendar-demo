// YENI ANA SAYFA (index-yeni.html) -- 13 Kasim 2026
//
// NEDEN BU TEST VAR
// Kullanici mevcut ana sayfa icin "cok fazla AI gorunuyor ... hic insan
// yok ... semalardan sikicilikdan baska bir sey yok" dedi. Yeni tasarim
// AYRI dosya olarak duruyor; canli ana sayfaya dokunulmadi.
//
// ⚠ BU TESTTE IKI OLCUM BOSA GECTI, IKISI DE BURADA YAZILI:
//
// 1) "tum resimler yuklendi" -- tembel (lazy) resimleri KAYDIRMADAN
//    olcuyordu ve yuklenmemis sayiyordu. Once sayfa sonuna kadar
//    kaydiriliyor.
//
// 2) "gorsel kutusunu tasirmiyor" -- yalnizca GENISLIGE bakiyordu.
//    Kullanicinin bildirdigi gercek hatada genislik DOGRUYDU (230px);
//    bozuk olan YUKSEKLIKTI (2532px). Mutasyon isirmadi. Dogru olcu
//    ORAN: cizilen en/boy ile dogal en/boy karsilastiriliyor.
//    Ayrica getBoundingClientRect DEGIL offsetWidth/Height kullaniliyor:
//    cihaz cerceveleri rotate() ile donduruluyor ve o islev dondurulmus
//    ogenin eksen hizali kutusunu veriyor -- %7'lik sahte sapma uretti.
//
// Mutasyonla dogrulandi: hata geri konuldugunda sapma %80,3 cikiyor ve
// iki olcum birden dusuyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g=0,k=0;
const bak=(a,ko,ek)=>{ if(ko){g++;console.log('  ok  '+a);} else {k++;console.log('  YOK '+a+(ek!==undefined?' -> '+ek:''));} };
(async()=>{
  const t=await chromium.launch();
  for(const [w,h,ad] of [[1440,900,'masaustu'],[390,844,'telefon'],[834,1112,'tablet']]){
    const p=await (await t.newContext({viewport:{width:w,height:h},deviceScaleFactor:2})).newPage();
    const hata=[]; p.on('pageerror',e=>hata.push(String(e)));
    const istek=[]; p.on('requestfailed',r=>istek.push(r.url().split('/').pop()+' :: '+(r.failure()||{}).errorText));
    await p.goto(KOK+'/index-yeni.html',{waitUntil:'networkidle'});
    // Tembel (lazy) resimler yalnizca gorunur olunca yuklenir: once
    // sayfayi sonuna kadar kaydirmadan 'yuklenmedi' demek yanlis olur.
    for(let i=0;i<24;i++){ await p.mouse.wheel(0,900); await p.waitForTimeout(120); }
    await p.evaluate(()=> window.scrollTo(0,0));
    await p.waitForTimeout(1200);
    console.log('['+ad+' '+w+'x'+h+']');
    bak('js hatasi yok', hata.length===0, hata.join(' | '));
    // Google Fonts sandbox'ta engelli olabilir; onu ayirt et
    const kritik = istek.filter(x=> !/fonts\.(googleapis|gstatic)/.test(x));
    bak('kritik kaynak yuklendi', kritik.length===0, kritik.join(' | '));
    bak('yatay kayma yok',
        await p.evaluate(()=> document.documentElement.scrollWidth <= window.innerWidth+1),
        await p.evaluate(()=> document.documentElement.scrollWidth+'/'+window.innerWidth));
    const o = await p.evaluate(()=>{
      const im=[...document.querySelectorAll('img')];
      return { resim: im.length,
               yuklenmeyen: im.filter(x=> !x.complete || x.naturalWidth===0).map(x=> x.getAttribute('src')),
               yuva: document.querySelectorAll('.foto-yuva-bos').length,
               bolum: document.querySelectorAll('section').length,
               zemin: getComputedStyle(document.body).backgroundColor,
               h1: (document.querySelector('h1')||{}).textContent.slice(0,40) };
    });
    bak('tum resimler yuklendi', o.yuklenmeyen.length===0, o.yuklenmeyen.join(','));
    bak('body zemini acikca verilmis', o.zemin!=='rgba(0, 0, 0, 0)', o.zemin);
    console.log('    resim='+o.resim+' fotoYuvasi='+o.yuva+' bolum='+o.bolum);
    // Dokunma hedefleri
    const kucuk = await p.evaluate(()=> [...document.querySelectorAll('a.dug, button')]
      .map(e=>({id:e.textContent.trim().slice(0,18), y:Math.round(e.getBoundingClientRect().height)}))
      .filter(x=> x.y>0 && x.y<40));
    bak('tum dugmeler 40px+', kucuk.length===0, JSON.stringify(kucuk));
    // ⚠ GORSEL KENDI KUTUSUNU TASIRMASIN.
    // Bir kutuya max-width verilip icindeki gorsele genislik
    // verilmezse, tarayici gorseli DOGAL boyutunda yerlestirip kutuyu
    // kirpiyor: overflow:hidden tasan kismi kesiyor ve gorsel kat kat
    // buyumus, kenarlari kesik gorunuyor. Sayfa yatay kaymiyor, hicbir
    // js hatasi da yok -- bu yuzden eski olcumlerin HICBIRI gormedi.
    // Kullanici gordu. Olcum bu yuzden eklendi.
    const gorselDurumu = await p.evaluate(()=> [...document.querySelectorAll('img')].map(im=>{
      // ⚠ getBoundingClientRect DEGIL. Cihaz cerceveleri rotate()
      // ile hafifce dondurulmus; o islev dondurulmus bir ogenin EKSEN
      // HIZALI kutusunu veriyor, gercek boyutunu degil -- telefonda
      // %7'lik sahte bir sapma uretti. offsetWidth/Height donusten
      // etkilenmiyor.
      const en = im.offsetWidth, boy = im.offsetHeight;
      const ic = im.parentElement.clientWidth;
      const dogalOran = im.naturalWidth / im.naturalHeight;
      const cizilenOran = en / boy;
      return { src: im.getAttribute('src').split('/').pop(),
               en: Math.round(en), boy: Math.round(boy), kutu: Math.round(ic),
               asim: Math.round(en - ic),
               sapma: +(Math.abs(cizilenOran - dogalOran) / dogalOran * 100).toFixed(1) };
    }).filter(x=> x.en > 0));
    bak('hicbir gorsel kutusunu tasirmiyor',
        gorselDurumu.filter(x=> x.asim > 1).length === 0,
        JSON.stringify(gorselDurumu.filter(x=> x.asim > 1)));
    // ⚠ GENISLIK YETMEZ -- ILK YAZIMDA OLCUM TAM BU YUZDEN BOSA GECTI.
    // Bozuk halde genislik DOGRUYDU (242px); bozuk olan YUKSEKLIKTI
    // (2532px): <img height="..."> ozniteligi CSS yukseklik verilmeyince
    // kullaniliyor ve gorsel dikey geriliyor. Mutasyon isirmadi, cunku
    // yalnizca genislige bakiyordum. Dogru olcu ORAN.
    bak('hicbir gorselin orani bozulmamis',
        gorselDurumu.filter(x=> x.sapma > 2).length === 0,
        JSON.stringify(gorselDurumu.filter(x=> x.sapma > 2)));

    // Ust cubuk: icerik cubugun DISINA tasmasin (dar ekranda dugme
    // iki satira kirilip tasiyordu).
    const cubuk = await p.evaluate(()=>{
      const u = document.querySelector('.ust-ic').getBoundingClientRect();
      const d = [...document.querySelectorAll('.ust-ic *')]
        .filter(e=> e.getBoundingClientRect().width > 0)
        .map(e=>{ const r = e.getBoundingClientRect();
          return { ad:(e.className||e.tagName)+'', asim: Math.round(Math.max(0,
            r.right-u.right, u.left-r.left, r.bottom-u.bottom, u.top-r.top)) }; })
        .filter(x=> x.asim > 1);
      return d;
    });
    bak('ust cubuktan tasan oge yok', cubuk.length===0, JSON.stringify(cubuk.slice(0,3)));
    // Dil degistir
    await p.click('[data-dil="en"]'); await p.waitForTimeout(400);
    const en = await p.evaluate(()=>({ lang:document.documentElement.lang,
      h1:(document.querySelector('h1')||{}).textContent.slice(0,40),
      fiyat:(document.querySelector('a[href^="fiyatlar"]')||{}).getAttribute('href') }));
    bak('EN gecisi calisti', en.lang==='en' && /One shoot/.test(en.h1), en.lang+' / '+en.h1);
    bak('fiyat baglantisi dili tasiyor', en.fiyat==='fiyatlar.html?lang=en', en.fiyat);
    await p.click('[data-dil="tr"]'); await p.waitForTimeout(400);
    const tr = await p.evaluate(()=> (document.querySelector('h1')||{}).textContent.slice(0,40));
    bak('TR geri donuyor (metin kaybolmuyor)', /Bir çekimden/.test(tr), tr);
    // ⛔ Yasak cumleler
    const yasak = await p.evaluate(()=>{
      const m = document.body.innerText;
      return ['otomatik paylaş','hesaplarına bağlan','istatistik','analitik panel']
        .filter(x=> new RegExp(x,'i').test(m) && !/değil|DEĞİL|bağlanmaz|atmaz|saymaz/i.test(
          m.slice(Math.max(0,m.search(new RegExp(x,'i'))-90), m.search(new RegExp(x,'i'))+140)));
    });
    bak('yasak vaat yok (otomatik paylasim / istatistik)', yasak.length===0, yasak.join(','));
    await p.screenshot({path:'/tmp/claude-0/yeni-'+ad+'.png', fullPage:(ad==='masaustu')});
    await p.close();
  }
  await t.close();
  console.log('=== BITTI — '+g+' gecti, '+k+' kaldi ===');
})();
