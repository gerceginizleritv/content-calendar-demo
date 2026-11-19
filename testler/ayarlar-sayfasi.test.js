// UYGULAMA ICINDE "AYARLAR" SAYFASI  (YAPILACAKLAR 58)
//
// NEDEN BU TEST VAR
//   Kullanici 18 Kasim 2026: "App icerisinde de dil tusu var, bu tusu
//   da app'e uygun sekilde duzeltmemiz lazim. Daha once sana
//   yazdigim gibi bazi basliklari app icerisinde settings gibi bir
//   sayfaya alip her seyi tipki projects'te oldugu gibi SAYFA gibi
//   olusturup kullanicinin ayarlarini yapmasini isteyebiliriz. AI,
//   hesap etiketleri, konum, dil vs."
//   Ayarlar yan menunun dibinde dagniktı ve her biri kucuk bir
//   pencere aciyordu. 50. maddede proje duzenleme ayni gerekceyle
//   pop-up'tan sayfaya alinmisti.
//
// ⚠ ASAMALI TASINIYOR ve asama sinirlari OLCUYLE cizildi: her ayarin
//   kac test dosyasina dokundugu sayildi (AI 15, dil 6, hatirlatma 5,
//   hesap ~10, tema 3, etiketler 2, hava 1, kurulum 1). Hepsini tek
//   seferde tasimak ~20 dosyaya ayni anda dokunmak demekti; bir sey
//   kirildiginda sebebini bulmak zorlasirdi.
//   BU ASAMADA: sayfa kuruldu + TEMA tasindi.
//   ⬜ Sonraki asamalar: dil secici · hatirlatmalar · hesap etiketleri
//      · hava & isik · hesap · AI. Bu test her asamada BUYUYECEK.
//
// NE OLCUYOR
//   1. Ayarlar bir SAYFA: serit dugmesi onu aciyor, oteki sayfayi
//      kapatiyor, dugme "acik" isaretini aliyor
//   2. Serit dugmesi IKI DILDE de cevrili (Bolum 7)
//   3. Bolum basliklari iki dilde de cevrili
//   4. Tema denetimi sayfanin ICINDE ve CALISIYOR (yalnizca durmuyor)
//   5. ⛔ Seritte tema kalmadi ve bos `.rail-prefs` kutusu da yok

const assert = require('node:assert');
const { chromium } = require('./araclar');
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

  const diller = await p.evaluate(()=> Object.keys(LANG));
  const metin = {};
  for(const d of diller){
    await p.evaluate((x)=>{
      document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
      setLanguage(x);
    }, d);
    await p.waitForTimeout(250);
    metin[d] = await p.evaluate(()=>({
      dugme: document.getElementById('ayarlarBtn').textContent.trim(),
      baslik: [...document.querySelectorAll('#ayarlarPage .tpl-h')].map(x=> x.textContent.trim()),
      giris: (document.querySelector('#ayarlarPage .hint') || {}).textContent
    }));
  }

  // ── SAYFA AC ────────────────────────────────────────────────────
  await p.evaluate(()=> setPage('projects'));
  await p.waitForTimeout(200);
  const once = await p.evaluate(()=>({
    ayarlar: document.getElementById('ayarlarPage').hidden,
    projeler: document.getElementById('projectsPage').hidden
  }));
  await p.evaluate(()=> document.getElementById('ayarlarBtn').click());
  await p.waitForTimeout(300);
  const sonra = await p.evaluate(()=>({
    ayarlar: document.getElementById('ayarlarPage').hidden,
    projeler: document.getElementById('projectsPage').hidden,
    aktif: document.getElementById('ayarlarBtn').classList.contains('active')
  }));

  dene('★ ayarlar bir SAYFA: dugme onu aciyor, otekini kapatiyor', ()=>{
    assert.strictEqual(once.ayarlar, true, 'basta ayarlar acik');
    assert.strictEqual(once.projeler, false, 'basta projeler kapali');
    assert.strictEqual(sonra.ayarlar, false, 'ayarlar acilmadi');
    assert.strictEqual(sonra.projeler, true, 'oteki sayfa kapanmadi');
    assert.strictEqual(sonra.aktif, true, 'dugme "acik" isaretini almadi');
  });

  // ── TEMA SAYFADA VE CALISIYOR ───────────────────────────────────
  const tema = await p.evaluate(async ()=>{
    const t = document.getElementById('themeBtn');
    const yerde = !!t.closest('#ayarlarPage');
    const gorunur = t.getBoundingClientRect().height > 0;
    const onceTema = document.documentElement.getAttribute('data-theme')
                  || document.documentElement.className;
    t.click();
    await new Promise(r=> setTimeout(r, 250));
    const sonraTema = document.documentElement.getAttribute('data-theme')
                   || document.documentElement.className;
    t.click();   // geri al
    return { yerde, gorunur, degisti: onceTema !== sonraTema,
             seritte: !!t.closest('.rail'),
             bosPrefs: document.querySelectorAll('.rail-prefs').length };
  });

  dene('★ tema denetimi sayfanin ICINDE ve gorunur', ()=>{
    assert.strictEqual(tema.yerde, true, 'tema dugmesi ayarlar sayfasinda degil');
    assert.strictEqual(tema.gorunur, true, 'tema dugmesi gorunmuyor');
  });

  dene('★ tema denetimi CALISIYOR (yalnizca durmuyor)', ()=>{
    // ⚠ "Sayfada duruyor" yetmez: tasima sirasinda dinleyicisini
    //   kaybetmis bir dugme de "duruyor" gorunurdu.
    assert.strictEqual(tema.degisti, true, 'tema tiklaninca degismedi');
  });

  dene('★ seritte tema kalmadi, bos kutu da yok', ()=>{
    assert.strictEqual(tema.seritte, false, 'tema hala seritte');
    assert.strictEqual(tema.bosPrefs, 0,
      'geride ' + tema.bosPrefs + ' adet bos `.rail-prefs` kutusu kalmis');
  });

  dene('★ Bolum 7: serit dugmesi ve basliklar HER DILDE', ()=>{
    for(const d of diller){
      assert.ok(metin[d].dugme, d + ': dugme metni bos');
      assert.ok(metin[d].baslik.length >= 1, d + ': hic bolum basligi yok');
      assert.ok(metin[d].giris && metin[d].giris.trim(), d + ': giris metni bos');
    }
    // ⚠ Sozluge girmeyen bir anahtar iki dilde AYNI metni verir.
    const d0 = diller[0], d1 = diller[1];
    assert.notStrictEqual(metin[d0].dugme, metin[d1].dugme,
      'serit dugmesi iki dilde ayni: ' + JSON.stringify(metin[d0].dugme));
    assert.notStrictEqual(JSON.stringify(metin[d0].baslik), JSON.stringify(metin[d1].baslik),
      'basliklar iki dilde ayni: ' + JSON.stringify(metin[d0].baslik));
    assert.notStrictEqual(metin[d0].giris, metin[d1].giris,
      'giris metni iki dilde ayni');
  });

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
