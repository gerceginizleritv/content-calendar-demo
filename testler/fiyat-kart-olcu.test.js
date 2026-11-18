// FIYAT KARTLARI AYNI SATIRDA ESIT YUKSEKLIKTE  (YAPILACAKLAR 44.5)
//
// NEDEN BU TEST VAR
//   Kullanici 16 Kasim 2026'da ekran goruntusuyle bildirdi: Starter
//   ve Creator Pro kutulari farkli yukseklikte. 18 Kasim'da olculdu:
//
//     genislik 1280 -> 499,2 px / 575,2 px  = 76,0 px fark
//     genislik  900 -> 477,7 px / 577,7 px  = 100,0 px fark
//
//   Kok sebep tek satir: `.kartlar{align-items:start}`. Izgara
//   kartlari germiyor, her kart kendi dogal boyunda duruyor.
//   ⚠ `.kart ul{flex:1}` ZATEN dugmeyi kartin dibine itmek icin
//     yazilmis -- yani kart GERILMEK uzere tasarlanmis, izgara
//     izin vermiyordu.
//
// NE OLCUYOR
//   Ayni SATIRDA duran kartlarin yuksekligi esit mi.
//
//   ⛔ "Butun kartlar esit" DEMIYOR. Telefonda izgara tek sutuna
//      iniyor; alt alta duran iki kartin boyu farkli olabilir ve bu
//      normal. Test satirlari KENDISI buluyor (ayni ust kenar =
//      ayni satir), plan listesi ya da genislik esigi YAZMIYOR --
//      yarin ucuncu plan gorunur olursa kendiliginden girer.
//
//   ⛔ YUVARLAMIYOR. 18 Kasim 2026'da menu kayma olcusu bunu
//      ogretti: gercek deger yuvarlama sinirinin 0,016 px yakininda
//      durursa Math.round bir kil payi farki 1 PIKSELLIK ARIZAYA
//      cevirir. Alt piksel olculuyor, esik 0,5 px.

const assert = require('node:assert');
const { chromium } = require('playwright');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

// ⚠ Gercek Supabase'e GITMIYORUZ: veriyi testin kendisi veriyor,
//   yoksa olcu ag durumuna ve canli fiyata bagli olurdu.
const PLANLAR = [
  { key:'starter',     visible:true, badge:null,          sort:10 },
  { key:'creator_pro', visible:true, badge:'recommended', sort:20 }
];
const FIYATLAR = [
  { plan_key:'starter',     currency:'TRY', period:'monthly', amount_minor:0,      active:true },
  { plan_key:'creator_pro', currency:'TRY', period:'monthly', amount_minor:29900,  active:true },
  { plan_key:'creator_pro', currency:'TRY', period:'yearly',  amount_minor:299900, active:true }
];

(async ()=>{
  const b = await chromium.launch();
  const jsHata = [];

  for(const olcek of [{ ad:'masaustu', w:1280, h:1000 },
                      { ad:'tablet',   w:900,  h:1000 },
                      { ad:'telefon',  w:390,  h:1000 }]){
    for(const [d, yol] of [['tr','/tr/fiyatlar/'], ['en','/en/pricing/']]){
      const p = await b.newPage({ viewport:{ width:olcek.w, height:olcek.h } });
      p.on('pageerror', e=> jsHata.push(olcek.ad + '/' + d + ': ' + e.message));
      await p.route('**/rest/v1/**', r=> r.abort());
      await p.route('**/supabase-js**', r=> r.abort());
      await p.goto(SUNUCU + yol, { waitUntil:'load' });
      await p.evaluate(()=> document.fonts.ready);

      const satirlar = await p.evaluate(({ pl, fi })=>{
        veri = { planlar: pl, limitler: [], fiyatlar: fi };
        ciz();
        const k = [...document.querySelectorAll('#kartlar > .kart')];
        // Ayni ust kenar = ayni satir. Esik 1 px: alt piksel
        // gurultusu ayni satiri ikiye bolmesin.
        const grup = [];
        k.forEach(x=>{
          const r = x.getBoundingClientRect();
          const g = grup.find(y=> Math.abs(y.ust - r.top) < 1);
          const kayit = { yuk: r.height,
                          ad: (x.querySelector('h2') || {}).textContent };
          if(g) g.kartlar.push(kayit);
          else grup.push({ ust: r.top, kartlar: [kayit] });
        });
        return { grup, sayi: k.length };
      }, { pl: PLANLAR, fi: FIYATLAR });

      dene(olcek.ad + '/' + d + ': kartlar ciziliyor', ()=>{
        assert.strictEqual(satirlar.sayi, 2,
          satirlar.sayi + ' kart cizildi, 2 bekleniyordu');
      });

      const coklu = satirlar.grup.filter(g=> g.kartlar.length > 1);
      if(coklu.length){
        dene('★ ' + olcek.ad + '/' + d + ': AYNI SATIRDAKI kartlar esit yukseklikte', ()=>{
          for(const g of coklu){
            const y = g.kartlar.map(x=> x.yuk);
            const fark = Math.max(...y) - Math.min(...y);
            assert.ok(fark < 0.5,
              'ayni satirda ' + fark.toFixed(3) + ' px fark: '
              + g.kartlar.map(x=> (x.ad||'?') + '=' + x.yuk.toFixed(1)).join(' '));
          }
        });
      } else {
        // ⚠ Tek sutun: karsilastirilacak satir yok. Bu bir ATLAMA
        //   degil, olcunun kendisi -- kartlarin GERCEKTEN alt alta
        //   oldugunu dogruluyoruz ki "satir bulunamadi" diye sessizce
        //   gecmis olmayalim.
        dene(olcek.ad + '/' + d + ': tek sutun — kartlar alt alta', ()=>{
          assert.strictEqual(satirlar.grup.length, satirlar.sayi,
            'tek sutun bekleniyordu ama ' + satirlar.grup.length
            + ' satir bulundu');
        });
      }
      await p.close();
    }
  }

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
