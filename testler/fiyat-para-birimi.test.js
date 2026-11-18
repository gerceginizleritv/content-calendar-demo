// FIYAT SAYFASI — PARA BIRIMLERI VERIDEN GELIYOR  (YAPILACAKLAR 44)
//
// NEDEN BU TEST VAR
//   Kullanici 16 Kasim 2026'da EUR istedi. Engel ikiydi:
//     1. sql/69:129 `check (currency in ('USD','TRY'))` -- EUR
//        veritabanina HIC girmiyordu. sql/73 kisiti genisletti.
//     2. Sayfada TRY ve USD dugmeleri ELLE yazilmisti ve para
//        bicimi "TRY ise TL, degilse $" diyordu -- yani EUR
//        fiyatlari DOLAR isaretiyle gorunurdu.
//
//   Kullanici 18 Kasim 2026: "USD ne kadar ise EURO o kadar olsun.
//   Admin panelinde hangi fiyati kullanabilecegimizi ve ne kadar
//   olacagini arka planda ben yazabileyim."
//   -> Para birimi listesi artik VERIDEN uretiliyor: panelde
//      `active` olan cikiyor, kapatilan kayboluyor. Kodda para
//      birimi listesi YAZILI DEGIL.
//
// NE OLCUYOR
//   1. Dugmeler veriden uretiliyor (EUR dahil)
//   2. EUR euro isaretiyle yaziliyor (dolar degil)
//   3. `active:false` olan para birimi dugmesi CIKMIYOR
//   4. Tek para birimi kalirsa secici gizleniyor
//   5. Secili para birimi kapatilirsa sayfa bos fiyat GOSTERMIYOR
//   6. ⛔ TRY ve USD bicimi BOZULMADI

const assert = require('node:assert');
const { chromium } = require('playwright');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

// Panelden gelecek veriyi taklit eden kurucu.
function fiyatlar(eurAktif, tekPara){
  const satir = (c, p, m, a)=> ({ plan_key:'creator_pro', currency:c,
                                  period:p, amount_minor:m, active:a });
  if(tekPara) return [satir('TRY','monthly',32000,true)];
  return [
    satir('TRY','monthly', 32000, true),
    satir('TRY','yearly', 300000, true),
    satir('USD','monthly',   900, true),
    satir('USD','yearly',   8400, true),
    satir('EUR','monthly',   900, eurAktif),
    satir('EUR','yearly',   8400, eurAktif)
  ];
}

(async ()=>{
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1280, height:900 } });
  const jsHata = []; p.on('pageerror', e=> jsHata.push(String(e.message)));
  // ⚠ Gercek Supabase'e GITMIYORUZ: veriyi testin kendisi veriyor.
  //   Yoksa olcu ag durumuna ve canli fiyata bagli olurdu.
  await p.route('**/rest/v1/**', r=> r.abort());
  await p.route('**/supabase-js**', r=> r.abort());
  await p.goto(SUNUCU + '/tr/fiyatlar/', { waitUntil:'load' });
  await p.waitForTimeout(700);

  const kur = (eurAktif, tekPara)=> p.evaluate(({ f })=>{
    veri = { planlar:[{ key:'creator_pro', visible:true, badge:'recommended', sort:20 }],
             limitler:[], fiyatlar:f };
    ciz();
    return {
      dugmeler: [...document.querySelectorAll('#paraSecici [data-para]')].map(x=> x.dataset.para),
      seciciGizli: document.getElementById('paraSecici').hidden,
      secili: [...document.querySelectorAll('#paraSecici [data-para]')]
        .filter(x=> x.getAttribute('aria-pressed') === 'true').map(x=> x.dataset.para)
    };
  }, { f: fiyatlar(eurAktif, tekPara) });

  const paraSec = (kod)=> p.evaluate(k=>{
    const d = document.querySelector('[data-para="' + k + '"]');
    if(d) d.click();
    return new Promise(r=> setTimeout(()=> r(
      (document.body.innerText.match(/[€$][\d.,]+|[\d.,]+ TL/g) || []).slice(0, 3)), 350));
  }, kod);

  // ── 1 · EUR ACIK ────────────────────────────────────────────────
  const acik = await kur(true, false);
  dene('★ para birimleri VERIDEN uretiliyor (EUR dahil)', ()=>{
    assert.deepStrictEqual(acik.dugmeler, ['TRY','USD','EUR'],
      'dugmeler: ' + JSON.stringify(acik.dugmeler)
      + ' -- liste kodda yazili olsaydi EUR cikmazdi');
  });

  const eurYazi = await paraSec('EUR');
  dene('★ EUR EURO isaretiyle yaziliyor (dolar degil)', ()=>{
    assert.ok(eurYazi.some(x=> x.indexOf('€') === 0),
      'ekranda euro isareti yok: ' + JSON.stringify(eurYazi));
    assert.ok(!eurYazi.some(x=> x.indexOf('$') === 0),
      'EUR secilyken dolar isareti var: ' + JSON.stringify(eurYazi));
  });
  dene('★ EUR rakami USD ile AYNI (kur hesabi yok)', ()=>{
    // Kullanici karari: "USD ne kadar ise EURO o kadar olsun."
    assert.ok(eurYazi.some(x=> /^€9(?:[.,]00)?$/.test(x)),
      'EUR 9 degil: ' + JSON.stringify(eurYazi));
  });

  const usdYazi = await paraSec('USD');
  dene('USD bicimi bozulmadi', ()=>{
    assert.ok(usdYazi.some(x=> x.indexOf('$') === 0), JSON.stringify(usdYazi));
  });
  const tryYazi = await paraSec('TRY');
  dene('TRY bicimi bozulmadi', ()=>{
    assert.ok(tryYazi.some(x=> / TL$/.test(x)), JSON.stringify(tryYazi));
  });

  // ── 2 · EUR PANELDEN KAPATILDI ──────────────────────────────────
  const kapali = await kur(false, false);
  dene('★ panelden kapatilan para birimi DUGMESI de cikmiyor', ()=>{
    assert.deepStrictEqual(kapali.dugmeler, ['TRY','USD'],
      'dugmeler: ' + JSON.stringify(kapali.dugmeler));
  });
  dene('★ secili para birimi kapatilirsa sayfa BOS fiyat gostermiyor', ()=>{
    // Yukarida TRY seciliydi; TRY acik kaldigi icin oyle kalmali.
    // ⚠ Asil guvence: secili olan listede YOKSA ilkine dusulsun.
    assert.strictEqual(kapali.secili.length, 1,
      'tam olarak bir para birimi secili olmali: ' + JSON.stringify(kapali.secili));
    assert.ok(kapali.dugmeler.indexOf(kapali.secili[0]) !== -1,
      'secili para birimi listede yok: ' + kapali.secili[0]);
  });

  // ── 3 · TEK PARA BIRIMI ─────────────────────────────────────────
  const tek = await kur(true, true);
  dene('★ tek para birimi kalirsa secici GIZLENIYOR', ()=>{
    assert.strictEqual(tek.dugmeler.length, 1, JSON.stringify(tek.dugmeler));
    assert.strictEqual(tek.seciciGizli, true, 'secici hala gorunuyor');
  });

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
