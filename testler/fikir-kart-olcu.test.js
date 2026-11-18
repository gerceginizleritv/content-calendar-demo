// FIKIR KARTI SABIT OLCUDE + "HEPSINI AYIR" SATIRI TASMIYOR
//                                        (YAPILACAKLAR 56)
//
// NEDEN BU TEST VAR
//   Kullanici 18 Kasim 2026, iki ekran goruntusuyle:
//   "fikir içeriği uzadıkça alan da aşağı doğru kayıyor, buranın
//   sabit bir ölçüde olması lazım" ve "'3 parçanın hepsini ayır',
//   İngilizce 'split all 3'e göre daha uzun olduğu için bu da
//   alanda aşağı atmasına neden oluyor."
//
//   ⛔ IKISI DE OLCULDU, IKISI DE DOGRUYDU:
//     a) `.fk-card-body` `flex:1` ile yazilmisti, hicbir sinir yoktu:
//           80 harf -> kart 153,8 px
//          647 harf -> kart 488,5 px
//         1295 harf -> kart   886 px   (kisanin ~6 kati)
//     b) Turkce dugme metni 164,5 px genisligindeydi ve mini
//        dugmeleri UC satira indiriyordu; kart 233,8 px oluyordu,
//        Ingilizcede 203,8. Aradaki 30 px yalnizca o metinden.
//
// ⛔ ILK COZUM YETMEDI VE BUNU OLCU YAKALADI: yalnizca
//    `-webkit-line-clamp` konmustu; o ozellik DUZ METNI kirpiyor ama
//    parcali bir fikrin govdesi blok ogelerden olusuyor ve hic
//    kirpilmiyordu -- 24 parcali kart 2087,4 px cikti, yani sinirsiz
//    halinden (886) DAHA KOTU. `max-height` sert sinir olarak eklendi.
//    ⚠ Bu test tam o durumu kovaliyor: metin uzunlugu DE parca sayisi
//      DA artirilarak olculuyor.
//
// NE OLCUYOR
//   1. Kart yuksekligi, metin ne kadar uzun olursa olsun sinirda
//   2. Kart yuksekligi, parca sayisi ne olursa olsun sinirda
//   3. Sinir IKI DILDE de ayni  (Bolum 7)
//   4. Mini dugmeler ikiden fazla satira TASMIYOR -- iki dilde de
//   5. ⛔ Turkce dugme metninde SAYI YOK: olculdu, sayi parantezle
//      bile tutuldugunda dugme yine uc satira iniyordu

const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}
const assert = require('node:assert');

(async () => {
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1280, height:900 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  p.on('dialog', d=> d.accept());
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.route('**/supabase-js**', r=> r.fulfill({ status:200,
    contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};' }));
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);

  // ⛔ DIL LISTESI ELLE YAZILMIYOR: uygulamanin kendi `LANG`
  //    sozlugunden okunuyor, yani yarin eklenen dil kendiliginden
  //    girer (Bolum 7'nin bekci kurali).
  const diller = await p.evaluate(()=> Object.keys(LANG));

  const olc = (dil)=> p.evaluate((dil)=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage(dil);
    projects = [{ id:'p1', name:'T', type:'other', keywords:'', notes:'', address:'',
      shootDate:'', script:false, shot:false, edited:false, published:false,
      permit:false, cancelled:false, deadlines:{}, createdAt:Date.now() }];
    saveProjects();
    const C = 'Sabahin ilk isigi tasa vururken cekilecek uzun bir plan var burada. ';
    // Hem METIN UZUNLUGU hem PARCA SAYISI artiyor: ilk cozum
    // yalnizca birincisini kapatmisti.
    fikirler = [
      { n:'kisa',      kat:1,  parca:1  },
      { n:'orta',      kat:4,  parca:1  },
      { n:'uzun',      kat:16, parca:1  },
      { n:'cokparca',  kat:1,  parca:9  },
      { n:'ikisi',     kat:8,  parca:24 }
    ].map((x,i)=> ({
      id:'f'+i, text:C.repeat(x.kat).trim(),
      parts: Array.from({length:x.parca}, (_,j)=>({ id:'p'+i+j, text:C.repeat(x.kat).trim() })),
      projectId:'p1', sort:i, createdAt:Date.now(), updatedAt:Date.now()
    }));
    saveFikirler(); setPage('ideas'); renderFikirler();

    const kartlar = [...document.querySelectorAll('.fk-card')]
      .filter(x=> x.querySelector('.fk-card-body'));
    return {
      yukseklikler: kartlar.map(x=> +x.getBoundingClientRect().height.toFixed(2)),
      // Mini dugmeler kac SATIRA yayilmis
      dugmeSatirlari: kartlar.map(x=>{
        const m = [...x.querySelectorAll('.fk-mini')];
        return m.length ? [...new Set(m.map(e=> Math.round(e.getBoundingClientRect().top)))].length : 0;
      }),
      splitMetin: (()=>{ const d = document.querySelector('[data-fk-split]');
                         return d ? d.textContent.trim() : null; })()
    };
  }, dil);

  const sonuc = {};
  for(const d of diller) sonuc[d] = await olc(d);
  sonuc.__clamp = await p.evaluate(()=>{
    const g = document.querySelector('.fk-card-body');
    return g ? getComputedStyle(g).webkitLineClamp : null;
  });

  for(const d of diller){
    const o = sonuc[d];
    dene('★ ' + d + ': kart yuksekligi metin ve parca sayisindan BAGIMSIZ', ()=>{
      const y = o.yukseklikler;
      assert.ok(y.length >= 5, 'yalnizca ' + y.length + ' kart olculdu');
      // ⚠ ILK kart BILEREK kisa (tek cumle, tek parca) ve sinira hic
      //   degmiyor -- kisa kartlarin SISMESI istenmiyor, istenen sey
      //   uzun olanlarin BUYUMEMESI. O yuzden iddia "hepsi esit"
      //   degil: "siniri asan her icerik AYNI yukseklikte".
      const tasanlar = y.slice(1);
      const yayilim = Math.max(...tasanlar) - Math.min(...tasanlar);
      assert.ok(yayilim < 0.5,
        'siniri asan kartlar arasinda ' + yayilim.toFixed(2) + ' px fark: '
        + JSON.stringify(y) + ' -- sinir yok ya da yalnizca duz metni kapatiyor'
        + ' (parcali govde blok ogelerden olustugu icin line-clamp onu kirpmaz)');
      // ⛔ Kisa kart, sinira dayanmis kartlardan UZUN olamaz. Yoksa
      //    "sinir" diye konan sey aslinda bir ALT sinir olurdu.
      assert.ok(y[0] <= Math.min(...tasanlar) + 0.5,
        'kisa kart (' + y[0] + ') sinirli kartlardan uzun: ' + JSON.stringify(y));
    });

    dene('★ ' + d + ': mini dugmeler IKI satiri asmiyor', ()=>{
      const fazla = o.dugmeSatirlari.filter(x=> x > 2);
      assert.deepStrictEqual(fazla, [],
        'bazi kartlarda dugmeler ' + JSON.stringify(o.dugmeSatirlari)
        + ' satira yayilmis -- dugme metni cok uzun');
    });
  }

  dene('★ Bolum 7: sinir HER DILDE ayni', ()=>{
    const hepsi = diller.map(d=> sonuc[d].yukseklikler[0]);
    const yayilim = Math.max(...hepsi) - Math.min(...hepsi);
    assert.ok(yayilim < 0.5, 'diller arasinda ' + yayilim.toFixed(2) + ' px fark: '
      + diller.map((d,i)=> d + '=' + hepsi[i]).join(' '));
  });

  // ⛔ 18 KASIM 2026 — BU IDDIA BIR MUTASYON BOSLUGUNDAN DOGDU.
  //    `-webkit-line-clamp` kaldirilip yalnizca `max-height`
  //    birakildiginda test 7/7 GECIYORDU: yukseklik yine sinirliydi,
  //    ama metin "…" olmadan ORTADAN kesiliyordu. Oysa kullanicinin
  //    secimi tam olarak "'…' ile kesilsin, tiklayinca acilsin"di.
  //    ⚠ OLCULDU: ayirt edici bir dis iz YOK. `scrollHeight` iki
  //      durumda da ayni cikiyor (670 px), cunku ikisinde de icerik
  //      tasiyor. Uc noktayi TARAYICI ciziyor ve DOM'dan okunamiyor.
  //    ⚠ BU YUZDEN BU IDDIA GORUNUSU DEGIL MEKANIZMAYI dogruluyor.
  //      Sinirini saklamiyorum: `-webkit-line-clamp` duruyorsa uc
  //      nokta cikar; kaldirilirsa bu iddia duser. Ekranda gercekten
  //      "…" ciktigi ayrica EKRAN GORUNTUSUYLE dogrulandi.
  dene('★ uzun metin "…" ile kesiliyor (line-clamp duruyor)', ()=>{
    const d = sonuc.__clamp;
    assert.ok(d && d !== 'none',
      'line-clamp yok (' + JSON.stringify(d) + ') -- metin uc nokta'
      + ' olmadan ortadan kesilir; `max-height` tek basina bunu'
      + ' gizler cunku yukseklik yine sinirli gorunur');
  });

  dene('★ Turkce "hepsini ayir" metninde SAYI yok', ()=>{
    // ⚠ Olculdu: sayi parantezle tutuldugunda bile ("Hepsini ayır (3)")
    //   dugme UC satira iniyordu. Yani sayinin cikmasi zevk degil,
    //   olcunun gerektirdigi sey. Bu iddia onun geri gelmesini engeller.
    const m = sonuc.tr && sonuc.tr.splitMetin;
    assert.ok(m, 'turkce split dugmesi bulunamadi');
    assert.ok(!/\d/.test(m), 'metinde sayi var: ' + JSON.stringify(m));
  });

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
