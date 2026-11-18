// UST VE ALT MENU HER SAYFADA AYNI OLCUDE  (YAPILACAKLAR 64)
//
// NEDEN BU TEST VAR
//   Kullanici 18 Kasim 2026: "alt bolumde yer alan kullanim sartlari
//   linkine gittigimde ust menu genisliyor gibi geldi bana. Onemli --
//   ust ve alt menu hicbir sayfada yer degistirmesin kaybolmasin!
//   Her sayfada ust ve alt menu mutlaka ayni olsun. (app haric)"
//
//   Olculdu, hakliydi ve sorun gordugunden BUYUKTU:
//     UST MENU  63 px (ana/fiyatlar/kilavuz) · 85 px (gizlilik/
//               sartlar/privacy/terms). Sebep: o sayfalarda `.ust`un
//               kendi `padding-bottom:22px`i.
//     ALT MENU  161,2 / 122 / 104,3 / 23,1 px -- her sayfada baska,
//               ve /en/privacy/ ile /en/terms/'te HIC YOKTU.
//
// ⛔ 47. MADDENIN BEKCISI BUNU NEDEN KACIRDI: `uretilen-sayfalar`
//    menunun YATAY konumunu olcuyordu (marka/nav1/dil/cta `left`),
//    YUKSEKLIGINI degil. 22 piksel sekiz gun gorunmedi. Bu test
//    yuksekligi olcer -- ve alt menuyu hic kimse olcmuyordu.
//
// NE OLCUYOR (uc genislikte: 1280 · 900 · 390)
//   1. Ust menu yuksekligi HER sayfada ayni
//   2. Alt menu HER sayfada VAR  ⛔ (ikisinde hic yoktu)
//   3. Alt menu yuksekligi HER sayfada ayni
//   4. Alt menudeki baglanti METINLERI her sayfada ayni (dil basina)
//   5. Telefonda alt menu baglantilari dokunulabilir (>=44px)
//
// ⛔ LISTE YAZMIYOR: sayfalar `uret/sayfalar.js`ten, diller
//    `uret/diller.js`ten geliyor. Yarin eklenecek sayfa ya da dil
//    (65. madde: hakkimizda, iletisim) kendiliginden girer.

const assert = require('node:assert');
const { chromium } = require('playwright');
const { SAYFALAR, adres } = require('../uret/sayfalar.js');
const { kodlar } = require('../uret/diller.js');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

const OLCEK = [{ ad:'masaustu', w:1280 }, { ad:'tablet', w:900 },
               { ad:'telefon',  w:390 }];

(async ()=>{
  const b = await chromium.launch();
  const jsHata = [];

  for(const olcek of OLCEK){
    const toplanan = [];
    for(const dil of kodlar()){
      for(const s of SAYFALAR){
        const yol = adres(s.ad, dil);
        const p = await b.newPage({ viewport:{ width: olcek.w, height: 900 } });
        p.on('pageerror', e=> jsHata.push(yol + ': ' + e.message));
        await p.goto(SUNUCU + yol, { waitUntil:'load' });
        await p.evaluate(()=> document.fonts.ready);
        await p.evaluate(()=> new Promise(r=>
          requestAnimationFrame(()=> requestAnimationFrame(r))));
        toplanan.push(Object.assign({ yol, dil }, await p.evaluate(()=>{
          const u = document.querySelector('.ust');
          const a = document.querySelector('.alt');
          const sayi = (e)=> e ? +e.getBoundingClientRect().height.toFixed(2) : null;
          return {
            ustY: sayi(u),
            altVar: !!a,
            altY: sayi(a),
            altBag: a ? [...a.querySelectorAll('a')].map(x=> x.textContent.trim()) : null,
            altEnKucukDokunma: a
              ? Math.min(...[...a.querySelectorAll('a')]
                  .map(x=> x.getBoundingClientRect().height), Infinity)
              : null
          };
        })));
        await p.close();
      }
    }

    const e = olcek.ad + ': ';
    // ⛔ YUVARLAMIYORUZ. 18 Kasim'da ogrenildi: gercek deger
    //    yuvarlama sinirina yakin durursa Math.round bir kil payi
    //    farki 1 PIKSELLIK arizaya cevirir. Alt piksel, esik 0,5.
    const yayilim = (dizi)=> Math.max(...dizi) - Math.min(...dizi);

    dene('★ ' + e + 'UST menu yuksekligi her sayfada AYNI', ()=>{
      const y = toplanan.map(x=> x.ustY);
      assert.ok(y.every(v=> v !== null), 'bir sayfada ust menu YOK');
      assert.ok(yayilim(y) < 0.5, yayilim(y).toFixed(2) + ' px fark: '
        + toplanan.map(x=> x.yol + '=' + x.ustY).join(' '));
    });

    dene('★ ' + e + 'ALT menu HER sayfada VAR', ()=>{
      const yok = toplanan.filter(x=> !x.altVar).map(x=> x.yol);
      assert.deepStrictEqual(yok, [],
        'alt menu olmayan sayfalar: ' + yok.join(' '));
    });

    dene('★ ' + e + 'ALT menu yuksekligi her sayfada AYNI', ()=>{
      const y = toplanan.filter(x=> x.altVar).map(x=> x.altY);
      assert.ok(y.length === toplanan.length, 'olculemeyen alt menu var');
      assert.ok(yayilim(y) < 0.5, yayilim(y).toFixed(2) + ' px fark: '
        + toplanan.map(x=> x.yol + '=' + x.altY).join(' '));
    });

    dene('★ ' + e + 'ALT menudeki baglantilar her sayfada AYNI', ()=>{
      for(const dil of kodlar()){
        const ayniDil = toplanan.filter(x=> x.dil === dil && x.altBag);
        if(!ayniDil.length) continue;
        const ilk = JSON.stringify(ayniDil[0].altBag);
        for(const x of ayniDil){
          assert.strictEqual(JSON.stringify(x.altBag), ilk,
            x.yol + ' baglantilari ' + JSON.stringify(x.altBag)
            + ' ama ' + ayniDil[0].yol + ' ' + ilk);
        }
      }
    });

    if(olcek.ad === 'telefon'){
      dene('★ ' + e + 'ALT menu baglantilari dokunulabiliyor (>=44px)', ()=>{
        // ⚠ Bu kural bugune kadar YALNIZCA fiyatlar sayfasindaydi
        //   (kaynak/fiyatlar.html:214); oteki sayfalarda altlik
        //   baglantilari 22-24 px idi. Kurali kirmak degil HER
        //   SAYFAYA YAYMAK dogrusuydu.
        for(const x of toplanan){
          assert.ok(x.altEnKucukDokunma >= 44,
            x.yol + ' en kucuk dokunma hedefi '
            + x.altEnKucukDokunma + 'px');
        }
      });
    }
  }

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
