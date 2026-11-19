// YONETIM PANELI — FIYAT MATRISI  (YAPILACAKLAR 61)
//
// NEDEN BU TEST VAR
//   Kullanici 18 Kasim 2026, iki ekran goruntusuyle: "Admin sayfasinda
//   fiyat yonetimi icin daha kolay bir sayfa yapabilir miyiz! Ornek SS
//   ekte, sadece Excel'de bu tabloyu nasil rahat kullanirim onu
//   gostermek icin yazdim -- tasarim degisikligi degil, tablonun
//   kullanimini rahatlatacak degisiklik."
//
//   Eskiden her plan x para x donem AYRI BIR SATIRDI: 18 satir, 18
//   ayri Kaydet dugmesi, ve ayni planin TRY/EUR/USD satirlari
//   birbirinden uzaga dusuyordu.
//
// NE OLCUYOR
//   1. Satir = plan, sutun = para birimi icinde donem (18 -> 4 satir)
//   2. ⛔ Sutunlar VERIDEN: liste kodda yazili degil. Veriye dorduncu
//      bir para birimi girince sutun kendiliginden cikiyor.
//   3. ⛔ Olmayan fiyat "—" ve KUTUSU YOK. Sunucu `merge-duplicates`
//      ile yaziyor, yani olmayan bir ucluye yazmak o fiyati YARATIR;
//      bugunku panel hic fiyat yaratamiyordu ve matris bu yetkiyi
//      eklememeli -- ustelik para tarafinda.
//   4. Gizli plan etiketi matriste de duruyor
//   5. Tek "Degisenleri kaydet": TEK onay, sonra her degisen hucre
//      icin sunucuya AYRI cagri (sunucu toplu islem bilmiyor)
//   6. Degismeyen hucre icin cagri YOK
//   7. Cok buyuk degisimde (409) yalnizca O HUCRE icin ikinci onay
//   8. Yarim kalirsa hangisinin kaydedildigi yaziliyor

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

// Panelin sunucudan aldigi veri. ⚠ Bilerek DUZENSIZ degil, sunucunun
// kendi sirasiyla (order=plan_key,currency,period).
const VERI = {
  planlar: [
    { key:'starter',     visible:true,  badge:null,          sort:10 },
    { key:'creator_pro', visible:true,  badge:'recommended', sort:20 },
    { key:'studio',      visible:false, badge:null,          sort:30 },
    { key:'founding',    visible:false, badge:null,          sort:40 }
  ],
  fiyatlar: [
    { plan_key:'creator_pro', currency:'EUR', period:'monthly', amount_minor:900,    active:true },
    { plan_key:'creator_pro', currency:'EUR', period:'yearly',  amount_minor:8900,   active:true },
    { plan_key:'creator_pro', currency:'TRY', period:'monthly', amount_minor:29900,  active:true },
    { plan_key:'creator_pro', currency:'TRY', period:'yearly',  amount_minor:299900, active:true },
    { plan_key:'creator_pro', currency:'USD', period:'monthly', amount_minor:900,    active:true },
    { plan_key:'creator_pro', currency:'USD', period:'yearly',  amount_minor:9800,   active:true },
    { plan_key:'founding',    currency:'EUR', period:'once',    amount_minor:6900,   active:true },
    { plan_key:'founding',    currency:'TRY', period:'once',    amount_minor:245000, active:true },
    { plan_key:'founding',    currency:'USD', period:'once',    amount_minor:6900,   active:true },
    { plan_key:'starter',     currency:'EUR', period:'monthly', amount_minor:0,      active:true },
    { plan_key:'starter',     currency:'TRY', period:'monthly', amount_minor:0,      active:true },
    { plan_key:'starter',     currency:'USD', period:'monthly', amount_minor:0,      active:true },
    { plan_key:'studio',      currency:'EUR', period:'monthly', amount_minor:2900,   active:true },
    { plan_key:'studio',      currency:'EUR', period:'yearly',  amount_minor:28800,  active:true },
    { plan_key:'studio',      currency:'TRY', period:'monthly', amount_minor:105000, active:true },
    { plan_key:'studio',      currency:'TRY', period:'yearly',  amount_minor:1020000,active:true },
    { plan_key:'studio',      currency:'USD', period:'monthly', amount_minor:2900,   active:true },
    { plan_key:'studio',      currency:'USD', period:'yearly',  amount_minor:28800,  active:true }
  ],
  limitler: [], vergi: []
};

(async ()=>{
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1400, height:900 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));

  // Kullaniciya cikan onay pencereleri ve verilen cevaplar
  const sorular = [];
  let cevap = true;
  p.on('dialog', async d=>{ sorular.push(d.message()); await (cevap ? d.accept() : d.dismiss()); });

  // Oturum: panel `sb.auth.getSession()` ile jeton ariyor.
  await p.route('**/supabase-js**', r=> r.fulfill({ status:200,
    contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{'
       + 'getSession:()=>Promise.resolve({data:{session:{access_token:"T",user:{email:"a@b.c"}}}}),'
       + 'onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}'
       + '}};}};' }));

  // Edge Function: cagrilari topluyoruz.
  const cagrilar = [];
  let buyukDegisimIcin = null;   // bu anahtara ilk cagri 409 donsun
  await p.route('**/functions/v1/yonetim', async r=>{
    const g = JSON.parse(r.request().postData() || '{}');
    cagrilar.push(g);
    if(g.islem === 'fiyatlar'){
      return r.fulfill({ status:200, contentType:'application/json',
                         body: JSON.stringify(VERI) });
    }
    if(g.islem === 'fiyat-degistir'){
      const anahtar = g.plan_key + '|' + g.currency + '|' + g.period;
      if(anahtar === buyukDegisimIcin && g.buyuk_degisim_onay !== true){
        return r.fulfill({ status:409, contentType:'application/json',
          body: JSON.stringify({ hata:'buyuk_degisim', eski_minor:29900, yeni_minor:1 }) });
      }
      return r.fulfill({ status:200, contentType:'application/json',
                         body: JSON.stringify({ ok:true }) });
    }
    return r.fulfill({ status:200, contentType:'application/json', body:'{}' });
  });

  await p.goto(SUNUCU + '/yonetim.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(800);
  await p.evaluate(()=> yukle('fiyatlar', true));
  await p.waitForFunction(()=> document.querySelectorAll('#fiyatTablo tbody tr').length > 0,
                          null, { timeout: 10000 });

  const matris = await p.evaluate(()=>({
    basliklar: [...document.querySelectorAll('#fiyatTablo thead th')].map(x=> x.textContent.trim()),
    satirlar: [...document.querySelectorAll('#fiyatTablo tbody tr')].map(tr=> ({
      plan: tr.children[0].textContent.trim(),
      hucreler: [...tr.children].slice(1).map(td=>{
        const i = td.querySelector('input[data-f]');
        return i ? { kutu:true, deger:i.value, anahtar:i.dataset.f } : { kutu:false, metin:td.textContent.trim() };
      })
    }))
  }));

  dene('★ satir = plan (18 satir yerine 4)', ()=>{
    assert.strictEqual(matris.satirlar.length, 4,
      'satir sayisi: ' + matris.satirlar.length);
  });

  dene('★ sutunlar VERIDEN uretiliyor (para birimi icinde donem)', ()=>{
    // Veride TRY/EUR/USD var; EUR'da monthly+yearly, founding'de `once`.
    // ⛔ Liste kodda yazili olsaydi `once` sutunu cikmazdi.
    assert.deepStrictEqual(matris.basliklar,
      ['Plan','monthly EUR','yearly EUR','once EUR',
              'monthly TRY','yearly TRY','once TRY',
              'monthly USD','yearly USD','once USD'],
      'basliklar: ' + JSON.stringify(matris.basliklar));
  });

  dene('★ olmayan fiyat "—" ve KUTUSU YOK', ()=>{
    const starter = matris.satirlar.find(x=> x.plan.startsWith('starter'));
    const kutulu = starter.hucreler.filter(x=> x.kutu);
    assert.strictEqual(kutulu.length, 3,
      'starter yalnizca uc aylik fiyat tasiyor, kutu sayisi: ' + kutulu.length);
    for(const h of starter.hucreler.filter(x=> !x.kutu)){
      assert.strictEqual(h.metin, '—', 'bos hucre metni: ' + JSON.stringify(h.metin));
    }
  });

  dene('★ gizli plan etiketi matriste duruyor', ()=>{
    const studio = matris.satirlar.find(x=> x.plan.startsWith('studio'));
    assert.ok(/gizli/.test(studio.plan), 'studio etiketsiz: ' + studio.plan);
    const cp = matris.satirlar.find(x=> x.plan.startsWith('creator_pro'));
    assert.ok(!/gizli/.test(cp.plan), 'gorunur plan gizli isaretli: ' + cp.plan);
  });

  // ── TOPLU KAYDETME ──────────────────────────────────────────────
  const oncekiCagri = cagrilar.length;
  sorular.length = 0;
  await p.evaluate(()=>{
    const d1 = document.querySelector('[data-f="creator_pro|TRY|monthly"]');
    const d2 = document.querySelector('[data-f="creator_pro|EUR|yearly"]');
    d1.value = '349,00'; d2.value = '95,00';
  });
  await p.evaluate(()=> document.getElementById('fiyatKaydet').click());
  await p.waitForTimeout(900);
  const yazanlar = cagrilar.slice(oncekiCagri).filter(x=> x.islem === 'fiyat-degistir');

  dene('★ tek onay cikiyor ve DEGISEN HEPSINI listeliyor', ()=>{
    const onay = sorular.filter(x=> /değişecek/i.test(x));
    assert.strictEqual(onay.length, 1, 'onay sayisi: ' + sorular.length
      + ' -> ' + JSON.stringify(sorular));
    assert.ok(onay[0].includes('creator_pro · TRY · monthly'), 'TRY satiri yok: ' + onay[0]);
    assert.ok(onay[0].includes('creator_pro · EUR · yearly'), 'EUR satiri yok: ' + onay[0]);
  });

  dene('★ her degisen hucre icin AYRI cagri (sunucu toplu islem bilmiyor)', ()=>{
    assert.strictEqual(yazanlar.length, 2, 'cagri sayisi: ' + yazanlar.length);
    const anahtarlar = yazanlar.map(x=> x.plan_key + '|' + x.currency + '|' + x.period).sort();
    assert.deepStrictEqual(anahtarlar,
      ['creator_pro|EUR|yearly','creator_pro|TRY|monthly']);
    const tryCagri = yazanlar.find(x=> x.currency === 'TRY');
    assert.strictEqual(tryCagri.amount_minor, 34900, 'kurus cevirimi: ' + tryCagri.amount_minor);
  });

  dene('★ DEGISMEYEN hucreler icin cagri YOK', ()=>{
    // Tabloda 18 kutu var, yalnizca 2'si degisti.
    assert.strictEqual(yazanlar.length, 2,
      'degismeyenler de gonderilmis: ' + yazanlar.length);
  });

  // ── COK BUYUK DEGISIM ───────────────────────────────────────────
  await p.evaluate(()=> yukle('fiyatlar', true));
  await p.waitForTimeout(500);
  buyukDegisimIcin = 'creator_pro|TRY|monthly';
  const oncekiCagri2 = cagrilar.length;
  sorular.length = 0;
  await p.evaluate(()=>{
    document.querySelector('[data-f="creator_pro|TRY|monthly"]').value = '1,00';
    document.querySelector('[data-f="creator_pro|USD|monthly"]').value = '10,00';
  });
  await p.evaluate(()=> document.getElementById('fiyatKaydet').click());
  await p.waitForTimeout(1200);
  const yazanlar2 = cagrilar.slice(oncekiCagri2).filter(x=> x.islem === 'fiyat-degistir');

  dene('★ buyuk degisimde YALNIZCA o hucre icin ikinci onay', ()=>{
    const ikinci = sorular.filter(x=> /sıfır fazla/i.test(x));
    assert.strictEqual(ikinci.length, 1, 'ikinci onay sayisi: ' + ikinci.length
      + ' -> ' + JSON.stringify(sorular));
    assert.ok(ikinci[0].includes('creator_pro · TRY · monthly'),
      'yanlis hucre sorulmus: ' + ikinci[0]);
  });

  dene('★ ikinci onaydan sonra `buyuk_degisim_onay` ile tekrar gonderiliyor', ()=>{
    const onayli = yazanlar2.filter(x=> x.buyuk_degisim_onay === true);
    assert.strictEqual(onayli.length, 1, 'onayli cagri: ' + onayli.length);
    assert.strictEqual(onayli[0].currency, 'TRY');
    // Oteki hucre kesintisiz gecmis olmali
    const usd = yazanlar2.filter(x=> x.currency === 'USD');
    assert.strictEqual(usd.length, 1, 'oteki hucre gonderilmemis');
    assert.ok(!usd[0].buyuk_degisim_onay, 'oteki hucreye de onay bayragi konmus');
  });

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
