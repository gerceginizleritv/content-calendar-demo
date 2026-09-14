// Kahraman zaman cizgisi taşmasın.
//
// Eskiden burada bir ay ızgarası vardı ve testi "sütun kesilmesin" diyordu.
// Şimdi kurgu masasından tanıdık bir şerit var: sol sütun platform, sağ taraf
// on gün. Klipler mutlak konumlu ve genişlikleri sol sütuna (--et) bağlı
// hesaplanıyor — yani yanlış bir --et değeri kliplerin panodan taşmasına yol
// açar ve bu gözle kolay kaçar. Test tam olarak onu tutuyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
(async()=>{
  const b = await chromium.launch({ });
  let k=0; const ok=(a,c,e)=>{ if(c) console.log('  ok  ',a); else { k++; console.log('  YOK ',a,e===undefined?'':'→ '+e); } };
  for (const [ad, w, dil] of [['masaüstü',1280,null],['masaüstü/TR',1280,'tr'],['tablet',900,'tr'],['telefon',390,'tr'],['dar telefon',320,'tr']]) {
    const p = await b.newPage({ viewport:{width:w,height:900} });
    await p.route('**/supabase-js**', r=>r.abort());
    await p.route('**supabase.co**', r=>r.abort());
    if(dil) await p.addInitScript(`try{localStorage.setItem('demo_ui_language','tr');}catch(e){}`);
    await p.goto(KOK + '/', {waitUntil:'domcontentloaded'});
    await p.waitForTimeout(900);
    const r = await p.evaluate(()=>{
      const pano = document.getElementById('kahramanPano');
      const zc = pano.querySelector('.zc');
      const kutu = pano.getBoundingClientRect();
      const klipler = [...zc.querySelectorAll('.zc-klip')];
      const tasan = klipler.filter(c=>{
        const kk = c.getBoundingClientRect();
        return kk.right > kutu.right + 0.5 || kk.left < kutu.left - 0.5;
      }).length;
      // Klip gorunur genislikte mi: 24 pikselin altinda metin hic okunmuyor.
      const cokDar = klipler.filter(c=> c.getBoundingClientRect().width < 24).length;
      // Cekim gunu bandi, cetveldeki ilk gun sutunuyla ayni yerde baslamali.
      const band = zc.querySelector('.zc-band').getBoundingClientRect();
      const ilkGun = zc.querySelector('.zc-gun').getBoundingClientRect();
      return {
        klipSayisi: klipler.length,
        tasan, cokDar,
        zcKaydi: zc.scrollWidth > zc.clientWidth + 1,
        bandKaymasi: Math.abs(band.left - ilkGun.left),
        sayfaYatay: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        seritSayisi: zc.querySelectorAll('.zc-serit').length
      };
    });
    console.log(' ' + ad);
    ok('  beş klip de duruyor', r.klipSayisi === 5, r.klipSayisi);
    ok('  dört şerit de duruyor', r.seritSayisi === 4, r.seritSayisi);
    ok('  klip panodan taşmıyor', r.tasan === 0, r.tasan);
    ok('  klip okunacak genişlikte', r.cokDar === 0, r.cokDar + ' klip 24px altında');
    ok('  çizgi şişmemiş', !r.zcKaydi);
    ok('  çekim günü bandı gün sütunuyla hizalı', r.bandKaymasi < 2, r.bandKaymasi);
    ok('  sayfa yana kaymıyor', !r.sayfaYatay);
    await p.close();
  }
  await b.close();
  console.log(k ? '\n' + k + ' SORUN' : '\nHEPSİ GEÇTİ');
  process.exit(k?1:0);
})();
