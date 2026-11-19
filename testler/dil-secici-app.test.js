// UYGULAMADAKI DIL SECICI  (YAPILACAKLAR 58, a maddesi)
//
// NEDEN BU TEST VAR
//   Kullanici 18 Kasim 2026: "App icerisinde de dil tusu var, bu tusu
//   da app'e uygun sekilde duzeltmemiz lazim."
//   Sitede ayni is bir gun once yapilmisti: yerli <select> birakilip
//   bayrakli ozel secici gelmisti, cunku kullanici "cok amator
//   duruyor" demisti. Uygulamadaki tus eski halinde kalmisti.
//
// ⛔ SECICININ YERI DEGISMEDI VE BU BIR KARAR. Kullanici once "butun
//    ayarlar sayfaya tasinsin" demisti; ama depoda bunun tersine
//    verilmis bilincli bir karar vardi (mobil-menu.test.js:57): dil
//    anahtari gomulu bir yerden CIKARILMISTI cunku kullanici onu
//    bulamiyordu. Ayarlar sayfasina tasimak o karari geri alirdi --
//    ustelik tam da "uygulamayi kendi dilinde gormeyen" kisi icin,
//    ki o kisinin once "Ayarlar" yazan bir dugmeyi ANLAMASI gerekir.
//    Celiski kullaniciya soruldu: "yan menude kalsin" dedi.
//
// NE OLCUYOR
//   1. Secici artik yerli <select> DEGIL: dugme + role="listbox"
//   2. ⛔ BAYRAKLAR ORTAK DOSYADAN: `uret/bayraklar.js` ne uretiyorsa
//      ekranda o var. Kopyalansaydi iki kopya zamanla ayrisirdi --
//      bu deponun tekrarlayan hatasi.
//   3. Panel acilip kapaniyor; Escape kapatiyor; disari tiklama kapatiyor
//   4. Satira basmak dili GERCEKTEN degistiriyor
//   5. ARIA: aria-expanded, role=option, aria-selected
//   6. Secici hala YAN MENUDE (yukaridaki karar)

const assert = require('node:assert');
const { chromium } = require('./araclar');
const { bayrak } = require('../uret/bayraklar.js');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

(async ()=>{
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
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
  });
  await p.waitForTimeout(300);

  const yapi = await p.evaluate(()=>{
    const k = document.getElementById('langSelect');
    const t = k.querySelector('.dil-tetik');
    const pnl = k.querySelector('.dil-panel');
    return {
      etiket: k.tagName,
      selectVar: !!k.querySelector('select') || k.tagName === 'SELECT',
      tetikEtiket: t ? t.tagName : null,
      tetikGenislik: t ? t.getAttribute('aria-expanded') : null,
      panelRol: pnl ? pnl.getAttribute('role') : null,
      satirRol: [...k.querySelectorAll('.dil-satir')].map(x=> x.getAttribute('role')),
      secili: [...k.querySelectorAll('.dil-satir')]
                .filter(x=> x.getAttribute('aria-selected') === 'true')
                .map(x=> x.dataset.dil),
      seritte: !!k.closest('.rail'),
      ayarlardaDegil: !k.closest('#ayarlarPage'),
      // Bayragin DOM'daki hali (karsilastirma icin)
      trBayrak: (k.querySelector('.dil-satir[data-dil="tr"] svg.bayrak') || {}).outerHTML || null
    };
  });

  dene('★ secici artik yerli <select> DEGIL', ()=>{
    assert.strictEqual(yapi.selectVar, false, 'hala bir <select> var');
    assert.strictEqual(yapi.tetikEtiket, 'BUTTON', 'tetik dugme degil: ' + yapi.tetikEtiket);
    assert.strictEqual(yapi.panelRol, 'listbox', 'panel rolu: ' + yapi.panelRol);
  });

  dene('★ ARIA eksiksiz: aria-expanded, role=option, aria-selected', ()=>{
    assert.strictEqual(yapi.tetikGenislik, 'false', 'aria-expanded yok/yanlis');
    assert.ok(yapi.satirRol.length >= 2, 'satir sayisi: ' + yapi.satirRol.length);
    assert.ok(yapi.satirRol.every(x=> x === 'option'),
      'satir rolleri: ' + JSON.stringify(yapi.satirRol));
    assert.deepStrictEqual(yapi.secili, ['tr'],
      'tam olarak bir satir secili olmali: ' + JSON.stringify(yapi.secili));
  });

  dene('★ secici hala YAN MENUDE (bilincli karar)', ()=>{
    assert.strictEqual(yapi.seritte, true, 'secici seritte degil');
    assert.strictEqual(yapi.ayarlardaDegil, true, 'secici ayarlar sayfasina tasinmis');
  });

  dene('★ BAYRAKLAR ORTAK DOSYADAN, kopyalanmamis', ()=>{
    // ⛔ Node tarafinda `uret/bayraklar.js` ne uretiyorsa ekranda o
    //    olmali. Bayraklar uygulamaya KOPYALANSAYDI iki kopya zamanla
    //    ayrisirdi -- bu deponun tekrarlayan hatasi (otomatik yayin
    //    tablosu, palet degerleri, ikon ailesi... hepsi boyle).
    assert.ok(yapi.trBayrak, 'ekranda bayrak yok');
    const beklenen = bayrak('tr', 'apptr');
    // Tarayici isaretlemeyi yeniden yaziyor (`<path/>` -> `<path></path>`,
    // oznitelik sirasi). Karsilastirmadan once ikisi de sadelestiriliyor.
    const sade = (x)=> String(x).replace(/\s+/g, ' ')
                                .replace(/<([a-z]+)([^>]*)\/>/g, '<$1$2></$1>')
                                .replace(/"/g, '"').trim();
    const d = sade(yapi.trBayrak), e = sade(beklenen);
    // Ic icerik (path verisi) ayni olmali: kopya olsaydi zamanla ayrisirdi.
    const ic = (x)=> (x.match(/ d="[^"]+"/g) || []).join('');
    assert.ok(ic(d).length > 0, 'bayragin yol verisi yok');
    assert.strictEqual(ic(d), ic(e),
      'ekrandaki bayrak `uret/bayraklar.js` ile AYNI DEGIL -- kopyalanmis olabilir');
  });

  // ── PANEL DAVRANISI ─────────────────────────────────────────────
  const davranis = await p.evaluate(async ()=>{
    const bekle = (ms)=> new Promise(r=> setTimeout(r, ms));
    const k = document.getElementById('langSelect');
    const t = k.querySelector('.dil-tetik');
    const pnl = ()=> k.querySelector('.dil-panel');
    const o = {};
    t.click(); await bekle(120);
    o.acildi = !pnl().hidden;
    o.ariaAcik = k.querySelector('.dil-tetik').getAttribute('aria-expanded');
    document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    await bekle(120);
    o.escKapatti = pnl().hidden;
    k.querySelector('.dil-tetik').click(); await bekle(120);
    document.body.click(); await bekle(120);
    o.disariKapatti = pnl().hidden;
    return o;
  });

  dene('★ panel aciliyor, Escape ve disari tiklama KAPATIYOR', ()=>{
    assert.strictEqual(davranis.acildi, true, 'panel acilmadi');
    assert.strictEqual(davranis.ariaAcik, 'true', 'aria-expanded guncellenmedi');
    assert.strictEqual(davranis.escKapatti, true, 'Escape kapatmadi');
    assert.strictEqual(davranis.disariKapatti, true, 'disari tiklama kapatmadi');
  });

  // ── SECIM DILI DEGISTIRIYOR ─────────────────────────────────────
  const secim = await p.evaluate(async ()=>{
    const bekle = (ms)=> new Promise(r=> setTimeout(r, ms));
    const k = document.getElementById('langSelect');
    const once = currentLang;
    k.querySelector('.dil-tetik').click(); await bekle(120);
    const hedef = [...k.querySelectorAll('.dil-satir')].find(x=> x.dataset.dil !== once);
    const kod = hedef.dataset.dil;
    hedef.click(); await bekle(400);
    return { once, kod, sonra: currentLang,
             tetikMetni: k.querySelector('.dil-tetik').textContent.trim(),
             panelKapali: k.querySelector('.dil-panel').hidden,
             seciliSonra: [...k.querySelectorAll('.dil-satir')]
               .filter(x=> x.getAttribute('aria-selected') === 'true').map(x=> x.dataset.dil) };
  });

  dene('★ satira basmak dili GERCEKTEN degistiriyor', ()=>{
    assert.notStrictEqual(secim.once, secim.sonra, 'dil degismedi');
    assert.strictEqual(secim.sonra, secim.kod,
      'secilen ' + secim.kod + ' ama dil ' + secim.sonra);
    assert.deepStrictEqual(secim.seciliSonra, [secim.kod], 'isaret guncellenmedi');
    assert.strictEqual(secim.panelKapali, true, 'secimden sonra panel acik kaldi');
    assert.ok(secim.tetikMetni, 'tetik metni bos');
  });

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
