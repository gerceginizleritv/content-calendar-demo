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
      // `asar`: bu kartin icerigi 5 satirlik siniri ASIYOR mu.
      // ⚠ Iddialar DIZINE degil bu bayraga bakiyor: yeni bir ornek
      //   eklendiginde siralama degisse de olcu bozulmuyor.
      { n:'kisa',      kat:1,  parca:1,  asar:false },
      { n:'orta',      kat:4,  parca:1,  asar:true  },
      { n:'uzun',      kat:16, parca:1,  asar:true  },
      // ⛔ 19 KASIM 2026 — BU SATIR BIR MUTASYON BOSLUGUNDAN DOGDU.
      //    "Hepsi sigiyorsa isaret yok" iddiasi YALNIZCA tek parcali
      //    kartlara bakiyordu; orada kod zaten erken donuyor, yani
      //    "her zaman isaret goster" mutasyonu GORUNMUYORDU ve test
      //    14/14 geciyordu. Hepsi SIGAN cok parcali bir kart sart:
      //    iki kisa parca (`kisaParca`) tam o durumu kuruyor.
      { n:'hepsisigar', kat:1, parca:2, kisaParca:true, asar:false },
      { n:'cokparca',  kat:1,  parca:9,  asar:true  },
      { n:'ikisi',     kat:8,  parca:24, asar:true  }
    ].map((x,i)=> ({
      id:'f'+i, text:C.repeat(x.kat).trim(), __asar:x.asar,
      parts: Array.from({length:x.parca}, (_,j)=>({ id:'p'+i+j,
        text: x.kisaParca ? ('p'+(j+1)) : C.repeat(x.kat).trim() })),
      projectId:'p1', sort:i, createdAt:Date.now(), updatedAt:Date.now()
    }));
    saveFikirler(); setPage('ideas'); renderFikirler();

    const kartlar = [...document.querySelectorAll('.fk-card')]
      .filter(x=> x.querySelector('.fk-card-body'));
    const asarMi = fikirler.map(f=> !!f.__asar);
    // ⛔ 19 KASIM 2026 — "YENI FIKIR" KUTUSU DA OLCULUYOR.
    //    Fikir kartlarina sabit yukseklik verilince o kutu tek basina
    //    kisa kaldi (150'ye karsi 195,63) ve alt kenari komsulariyla
    //    hizalanmadi. Izgaranin germesi acilarak duzeltildi; bu olcu
    //    o kutuyu DISARIDA birakirsa duzeltme sessizce geri alinabilir.
    const ekleKutusu = [...document.querySelectorAll('.fk-card')]
      .filter(x=> !x.querySelector('.fk-card-body'))
      .map(x=> +x.getBoundingClientRect().height.toFixed(2));
    return {
      ekleKutusu,
      yukseklikler: kartlar.map(x=> +x.getBoundingClientRect().height.toFixed(2)),
      // ⛔ 19 KASIM 2026 — GOVDE YUKSEKLIGI DE OLCULUYOR, VE BU BIR
      //    MUTASYON BOSLUGUNDAN DOGDU. Govdeye `height` yerine
      //    `max-height` konunca test 14/14 GECIYORDU: izgara germesi
      //    acik oldugu icin kartlar yine ayni boyda gorunuyordu
      //    (her kart satirin boyuna uzuyor). Fark GOVDEDE kaliyordu:
      //    sabitken her govde 104,63 px, ust sinirken kisa icerik
      //    bunun altinda. Yani "kartlar esit" iddiasi tek basina
      //    sabit yuksekligi KORUMUYORDU.
      govdeler: kartlar.map(x=>
        +x.querySelector('.fk-card-body').getBoundingClientRect().height.toFixed(2)),
      asar: asarMi,
      // Mini dugmeler kac SATIRA yayilmis
      dugmeSatirlari: kartlar.map(x=>{
        const m = [...x.querySelectorAll('.fk-mini')];
        return m.length ? [...new Set(m.map(e=> Math.round(e.getBoundingClientRect().top)))].length : 0;
      }),
      splitMetin: (()=>{ const d = document.querySelector('[data-fk-split]');
                         return d ? d.textContent.trim() : null; })(),
      // "+N daha" isareti: kac parcasi gizli, isaret ne yaziyor
      isaretler: kartlar.map(x=>{
        const i = x.querySelector('.fk-gizli');
        return { parca: x.querySelectorAll('.fk-part').length,
                 metin: i && !i.hidden ? i.textContent.trim() : null }; })
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
    dene('★ ' + d + ': BUTUN kartlar ayni yukseklikte', ()=>{
      // ⛔ 19 KASIM 2026 — IDDIA GUCLENDI. Once "siniri ASAN kartlar
      //    esit" diyordu, cunku govdeye UST SINIR (max-height)
      //    verilmisti ve kisa icerik sinirin altinda kaliyordu.
      //    Kullanici bildirdi: "hepsini ayir tusu olanlar ile
      //    olmayanlar arasinda yukseklik farki var. Hepsi 'Hepsini
      //    Ayir' tusu olanlar ile ayni yukseklikte olsun."
      //    Olculdu: kisa tek parcali kart 150 px, parcali olanlar
      //    195,63 px. Sebep DUGME DEGIL ICERIK'ti -- parcalar ayri
      //    satirlar oldugu icin sinira hemen dayaniyorlar -- ama
      //    pratikte "parcali olan" = "dugmesi olan".
      //    Govde SABIT yukseklige cevrildi; iddia artik daha guclu:
      //    kisasi, uzunu, parcalisi ve "YENI FIKIR" kutusu BIR ARADA.
      const y = o.yukseklikler.concat(o.ekleKutusu);
      assert.ok(o.yukseklikler.length >= 5,
        'yalnizca ' + o.yukseklikler.length + ' fikir karti olculdu');
      assert.ok(o.ekleKutusu.length >= 1, '"YENI FIKIR" kutusu olculemedi');
      const fark = Math.max(...y) - Math.min(...y);
      assert.ok(fark < 0.5, fark.toFixed(3) + ' px fark: fikir kartlari '
        + JSON.stringify(o.yukseklikler) + ', ekleme kutusu '
        + JSON.stringify(o.ekleKutusu));
      // ⛔ GOVDELER DE ESIT OLMALI (yukarida sebebi). Izgara germesi
      //    kartlari esitler ama govdeyi esitlemez; sabit yukseklik
      //    gidince bu iddia duser.
      const gf = Math.max(...o.govdeler) - Math.min(...o.govdeler);
      assert.ok(gf < 0.5, 'govdeler arasinda ' + gf.toFixed(3) + ' px fark: '
        + JSON.stringify(o.govdeler)
        + ' -- govdeye sabit yukseklik yerine UST SINIR konmus olabilir');
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

  // ⛔ 19 KASIM 2026 — "KAC PARCA GIZLI" ISARETI (YAPILACAKLAR 56).
  //    Kart 5 satirda kesilince cok parcali bir fikir uc parca
  //    gosterip susuyordu; dokuz parcali kart UC parca gosteriyordu
  //    ve gerisi oldugunu belli etmiyordu. Bu EKSIK degil YANILTICI.
  //    Kullanici kucuk bir sayi ("+6 daha") secti.
  for(const d of diller){
    const isaret = sonuc[d].isaretler;
    dene('★ ' + d + ': gizli parca sayisi DOGRU yaziyor', ()=>{
      // Test verisinde 9 ve 24 parcali kartlar var; ikisinde de
      // isaret cikmali ve sayi GIZLI olan kadar olmali.
      const cok = isaret.filter(x=> x.parca >= 9);
      assert.ok(cok.length >= 2, 'cok parcali kart olculemedi');
      for(const x of cok){
        assert.ok(x.metin, x.parca + ' parcali kartta isaret YOK'
          + ' -- kart uc parca gosterip susuyor, bu yaniltici');
        const n = parseInt(String(x.metin).replace(/[^\d]/g, ''), 10);
        assert.ok(n > 0 && n < x.parca,
          x.parca + ' parcada isaret "' + x.metin + '" -- sayi tutmuyor');
      }
    });

    dene('★ ' + d + ': parcalarin HEPSI sigiyorsa isaret YOK', ()=>{
      // Tek parcali kartlarda olmamali: orada tarayici zaten "…"
      // koyuyor, ikinci bir isaret gurultu olurdu.
      const tek = isaret.filter(x=> x.parca < 2);
      assert.ok(tek.length >= 1, 'tek parcali kart olculemedi');
      for(const x of tek){
        assert.strictEqual(x.metin, null,
          'tek parcali kartta isaret var: ' + JSON.stringify(x.metin));
      }
      // ⛔ ASIL OLCU BURASI: iki KISA parcali kartta hepsi siginca
      //    isaret cikmamali. Tek parcali kartlar bunu olcmuyordu
      //    cunku kod orada zaten erken donuyor.
      const sigan = isaret.filter(x=> x.parca === 2);
      assert.ok(sigan.length >= 1, 'hepsi sigan cok parcali kart olculemedi');
      for(const x of sigan){
        assert.strictEqual(x.metin, null,
          'hepsi sigan ' + x.parca + ' parcali kartta isaret var: '
          + JSON.stringify(x.metin) + ' -- yanlis bilgi veriyor');
      }
    });
  }

  dene('★ Bolum 7: "+N" isareti CEVRILMIS (iki dil ayni sozcuk degil)', ()=>{
    // ⚠ Sayi ve isaretler atiliyor, SOZCUK karsilastiriliyor.
    //   18 Kasim'da ogrenildi: bicim farki (%30 / 30%) yuzunden
    //   dizeler esit cikmayabilir ve iddia yanlis nedenle yesil kalir.
    const sade = (x)=> String(x || '').replace(/[\d+%\s]+/g, ' ').trim();
    const tr = (sonuc.tr.isaretler.find(x=> x.metin) || {}).metin;
    const en = (sonuc.en.isaretler.find(x=> x.metin) || {}).metin;
    assert.ok(tr && en, 'bir dilde isaret hic cikmadi');
    assert.notStrictEqual(sade(tr), sade(en),
      'iki dilde AYNI SOZCUK: ' + JSON.stringify(sade(tr))
      + ' -- sozluge girmemis olabilir');
  });

  dene('★ isaret karta YUKSEKLIK EKLEMIYOR', ()=>{
    // ⚠ Isaret dugme satirina konsaydi mini dugmeler UCUNCU satira
    //   inerdi -- az once duzeltilen sorunun ta kendisi. Mutlak
    //   konumda duruyor; isaretli ve isaretsiz kartlar AYNI boyda.
    const y = sonuc.tr.yukseklikler.concat(sonuc.tr.ekleKutusu);
    const yayilim = Math.max(...y) - Math.min(...y);
    assert.ok(yayilim < 0.5,
      'isaretli ve isaretsiz kartlar arasinda ' + yayilim.toFixed(2)
      + ' px fark: ' + JSON.stringify(sonuc.tr.yukseklikler));
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
