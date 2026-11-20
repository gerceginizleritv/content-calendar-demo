// YÖNETİM PANELİ — ÖZELLİK × PLAN MATRİSİ  (YAPILACAKLAR 67)
//
// NEDEN BU TEST VAR
//   Kullanıcı 20 Kasım 2026'da istedi:
//     "Yönetim panelinde Creator Pro - Starter gibi hangi uygulamanın
//      hangi plana açık ya da kapalı olacağını her zaman
//      değiştirebileceğim bir panel de hazırlamanı istiyorum.
//      Mümkünse özellikler satırda, plan tipleri sütunda olsun."
//
// ⛔ EN BÜYÜK RİSK: LİSTENİN İKİ YERDE DURMASI.
//   Bu deponun tekrarlayan hatası — otomatik yayın tablosu, palet
//   değerleri, ikon ailesi, hesap silme listesi hep böyle ayrıştı.
//   Burada üç ayrı liste var ve ÜÇÜ DE veriden üretilmeli:
//     · sütunlar  → `plans` içinde `visible === true` olanlar
//     · özellik satırları → gelen satırlardaki `feature_key`'ler
//     · sınır satırları   → gelen satırlardaki `limit_key`'ler
//   Aşağıda veriye KODDA ADI GEÇMEYEN bir özellik ve bir sınır
//   konuluyor; ikisi de ekranda görünmek ZORUNDA.
//
// ⛔ BİLİNMEYEN ANAHTAR GİZLENMEZ, HAM HÂLİYLE GÖSTERİLİR.
//   `OZELLIK_ADI` tablosu yalnızca okunabilirlik için. Bilinmeyeni
//   gizleseydik, SQL ile açılan yeni bir özellik panelde hiç çıkmaz
//   ve kimse fark etmezdi — üstelik kullanıcının kararı "yeni özellik
//   KAPALI başlasın" olduğu için o özellik hiçbir kullanıcıda da
//   görünmezdi. İki sessizlik üst üste gelirdi.
//
// ⛔ BOŞ = SINIRSIZ, 0 = HİÇ. `sql/69` bu ikisinin karıştırılmasının
//   ücretli kullanıcıyı hiçbir şey yapamaz hâle getirdiğini yazıyor.
//   Aşağıda ikisi AYRI AYRI ölçülüyor: boş kutu `null` göndermeli,
//   "0" yazan kutu `0` göndermeli.

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

// ⚠ `gizli_ozellik` ve `gizli_sinir` KODDA TANIMLI DEĞİL. Panelde
//   görünmeleri, listenin veriden geldiğinin kanıtı.
const VERI = {
  planlar: [
    { key:'starter',     visible:true,  badge:null,          sort:10 },
    { key:'creator_pro', visible:true,  badge:'recommended', sort:20 },
    { key:'studio',      visible:false, badge:null,          sort:30 },
    { key:'founding',    visible:false, badge:null,          sort:40 }
  ],
  ozellikler: [
    { plan_key:'starter',     feature_key:'drive_script',   enabled:true },
    { plan_key:'creator_pro', feature_key:'drive_script',   enabled:true },
    { plan_key:'starter',     feature_key:'fikir_onceligi', enabled:false },
    { plan_key:'creator_pro', feature_key:'fikir_onceligi', enabled:true },
    // ⚠ starter satırı BİLEREK YOK: "—" çıkmalı, kutu OLMAMALI.
    { plan_key:'creator_pro', feature_key:'gizli_ozellik',  enabled:false }
  ],
  limitler: [
    { plan_key:'starter',     limit_key:'projects', limit_value:2 },
    { plan_key:'creator_pro', limit_key:'projects', limit_value:null },
    { plan_key:'starter',     limit_key:'entries',  limit_value:100 },
    { plan_key:'creator_pro', limit_key:'entries',  limit_value:0 },
    { plan_key:'starter',     limit_key:'gizli_sinir', limit_value:7 },
    { plan_key:'creator_pro', limit_key:'gizli_sinir', limit_value:null }
  ]
};

(async ()=>{
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1400, height:1000 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));

  const sorular = [];
  let cevap = true;
  p.on('dialog', async d=>{ sorular.push(d.message()); await (cevap ? d.accept() : d.dismiss()); });

  await p.route('**/supabase-js**', r=> r.fulfill({ status:200,
    contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{'
       + 'getSession:()=>Promise.resolve({data:{session:{access_token:"T",user:{email:"a@b.c"}}}}),'
       + 'onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}'
       + '}};}};' }));

  const cagrilar = [];
  let hataVer = null;        // bu etikete gelen cagri 400 donsun
  await p.route('**/functions/v1/yonetim', async r=>{
    const g = JSON.parse(r.request().postData() || '{}');
    cagrilar.push(g);
    if(g.islem === 'matris'){
      return r.fulfill({ status:200, contentType:'application/json',
                         body: JSON.stringify(VERI) });
    }
    if(hataVer && (g.feature_key === hataVer || g.limit_key === hataVer)){
      return r.fulfill({ status:400, contentType:'application/json',
                         body: JSON.stringify({ hata:'satir_yok' }) });
    }
    return r.fulfill({ status:200, contentType:'application/json',
                       body: JSON.stringify({ ok:true, degisiklik:true }) });
  });

  await p.goto(SUNUCU + '/yonetim.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(800);
  await p.evaluate(()=> yukle('planlar', true));
  await p.waitForFunction(()=> document.querySelectorAll('#ozellikTablo tbody tr').length > 0,
                          null, { timeout: 10000 });

  const oku = ()=> p.evaluate(()=>{
    const tablo = (id, nitelik)=> ({
      basliklar: [...document.querySelectorAll('#' + id + ' thead th')].map(x=> x.textContent.trim()),
      satirlar: [...document.querySelectorAll('#' + id + ' tbody tr')].map(tr=> ({
        ad: tr.children[0].textContent.trim(),
        hucreler: [...tr.children].slice(1).map(td=>{
          const i = td.querySelector('[' + nitelik + ']');
          if(!i) return { kutu:false, metin:td.textContent.trim() };
          return { kutu:true, anahtar:i.getAttribute(nitelik),
                   deger: i.type === 'checkbox' ? i.checked : i.value,
                   yertut: i.placeholder || '' };
        })
      }))
    });
    return { oz: tablo('ozellikTablo','data-oz'), lim: tablo('limitMatrisTablo','data-lim') };
  });

  const m = await oku();

  // ── 1. SÜTUNLAR VERİDEN, YALNIZCA SATIŞTAKİ PLANLAR ─────────────
  dene('★ sütunlar yalnızca visible=true planlar (Studio/Founding YOK)', ()=>{
    assert.deepStrictEqual(m.oz.basliklar, ['Özellik','Starter','Creator Pro'],
      JSON.stringify(m.oz.basliklar));
    assert.deepStrictEqual(m.lim.basliklar, ['Sınır','Starter','Creator Pro'],
      JSON.stringify(m.lim.basliklar));
  });

  // ── 2. SATIRLAR VERİDEN — KODDA ADI OLMAYAN DA GÖRÜNÜYOR ────────
  dene('★ kodda adı OLMAYAN özellik gizlenmiyor, ham anahtarla çıkıyor', ()=>{
    const adlar = m.oz.satirlar.map(s=> s.ad);
    assert.ok(adlar.indexOf('gizli_ozellik') !== -1,
      'satirlar: ' + JSON.stringify(adlar));
  });
  dene('★ kodda adı OLMAYAN sınır da gizlenmiyor', ()=>{
    const adlar = m.lim.satirlar.map(s=> s.ad);
    assert.ok(adlar.indexOf('gizli_sinir') !== -1,
      'satirlar: ' + JSON.stringify(adlar));
  });
  dene('bilinen anahtarlar okunur adla çıkıyor', ()=>{
    const adlar = m.oz.satirlar.map(s=> s.ad);
    assert.ok(adlar.indexOf('Fikirlere öncelik') !== -1, JSON.stringify(adlar));
    assert.ok(adlar.indexOf('drive_script') === -1,
      'ham anahtar kalmis: ' + JSON.stringify(adlar));
  });

  // ── 3. OLMAYAN SATIR: "—" VE KUTU YOK ───────────────────────────
  dene('★ satırı olmayan hücrede kutu YOK, "—" var', ()=>{
    const s = m.oz.satirlar.find(x=> x.ad === 'gizli_ozellik');
    assert.ok(s, 'gizli_ozellik satiri yok');
    assert.strictEqual(s.hucreler[0].kutu, false, 'starter hucresinde kutu var');
    assert.strictEqual(s.hucreler[0].metin, '—', s.hucreler[0].metin);
    assert.strictEqual(s.hucreler[1].kutu, true, 'creator_pro hucresinde kutu yok');
  });

  // ── 4. BOŞ = SINIRSIZ, 0 = HİÇ ──────────────────────────────────
  dene('★ sınırsız (null) BOŞ kutu, 0 ise "0" yazıyor', ()=>{
    const s = m.lim.satirlar.find(x=> x.ad === 'Kayıt');
    assert.ok(s, 'entries satiri yok');
    assert.strictEqual(s.hucreler[0].deger, '100', 'starter: ' + s.hucreler[0].deger);
    assert.strictEqual(s.hucreler[1].deger, '0', 'creator_pro 0 olmali: ' + s.hucreler[1].deger);
    const pr = m.lim.satirlar.find(x=> x.ad === 'Proje');
    assert.strictEqual(pr.hucreler[1].deger, '', 'null BOS olmali: ' + pr.hucreler[1].deger);
    assert.ok(/sınırsız/.test(pr.hucreler[1].yertut), 'yer tutucu: ' + pr.hucreler[1].yertut);
  });

  // ── 5. DEĞİŞMEYEN HÜCRE İÇİN ÇAĞRI YOK ──────────────────────────
  cagrilar.length = 0; sorular.length = 0;
  await p.evaluate(()=> document.getElementById('matrisKaydet').click());
  await p.waitForTimeout(400);
  dene('★ hiçbir şey değişmediyse sunucuya çağrı YOK', ()=>{
    assert.strictEqual(cagrilar.length, 0, JSON.stringify(cagrilar));
    assert.strictEqual(sorular.length, 0, 'onay penceresi cikti: ' + JSON.stringify(sorular));
  });

  // ── 6. DEĞİŞENLER: TEK ONAY, DOĞRU GÖVDE ────────────────────────
  cagrilar.length = 0; sorular.length = 0;
  await p.evaluate(()=>{
    // starter/fikir_onceligi: kapali -> acik
    document.querySelector('[data-oz="starter|fikir_onceligi"]').checked = true;
    // creator_pro/projects: BOS (sinirsiz) -> 50
    document.querySelector('[data-lim="creator_pro|projects"]').value = '50';
    // starter/entries: 100 -> BOS (sinirsiz)
    document.querySelector('[data-lim="starter|entries"]').value = '';
    document.getElementById('matrisKaydet').click();
  });
  await p.waitForTimeout(700);

  dene('★ TEK onay penceresi çıkıyor (her hücre için ayrı değil)', ()=>{
    assert.strictEqual(sorular.length, 1, JSON.stringify(sorular));
  });
  dene('onay penceresi verinin silinmeyeceğini söylüyor', ()=>{
    assert.ok(/SİLİNMEZ/.test(sorular[0]), sorular[0]);
  });
  const yazanlar = cagrilar.filter(c=> c.islem !== 'matris');
  dene('★ yalnızca DEĞİŞEN üç hücre için çağrı var', ()=>{
    assert.strictEqual(yazanlar.length, 3, JSON.stringify(yazanlar));
  });
  dene('★ özellik çağrısı onay:true ve enabled:true taşıyor', ()=>{
    const c = yazanlar.find(x=> x.islem === 'ozellik-degistir');
    assert.ok(c, JSON.stringify(yazanlar));
    assert.strictEqual(c.onay, true);
    assert.strictEqual(c.plan_key, 'starter');
    assert.strictEqual(c.feature_key, 'fikir_onceligi');
    assert.strictEqual(c.enabled, true);
  });
  dene('★ BOŞ bırakılan sınır 0 DEĞİL, null gönderiyor', ()=>{
    const c = yazanlar.find(x=> x.islem === 'limit-degistir' && x.plan_key === 'starter');
    assert.ok(c, JSON.stringify(yazanlar));
    assert.strictEqual(c.limit_key, 'entries');
    assert.strictEqual(c.limit_value, null,
      'null bekleniyordu, gelen: ' + JSON.stringify(c.limit_value));
  });
  dene('sayı yazılan sınır tam sayı gönderiyor', ()=>{
    const c = yazanlar.find(x=> x.islem === 'limit-degistir' && x.plan_key === 'creator_pro');
    assert.strictEqual(c.limit_value, 50, JSON.stringify(c));
  });

  // ── 7. GEÇERSİZ METİN: HİÇBİR ŞEY KAYDEDİLMİYOR ─────────────────
  await p.evaluate(()=> yukle('planlar', true));
  await p.waitForTimeout(500);
  cagrilar.length = 0; sorular.length = 0;
  await p.evaluate(()=>{
    document.querySelector('[data-lim="starter|projects"]').value = 'abc';
    document.querySelector('[data-oz="starter|drive_script"]').checked = false;
    document.getElementById('matrisKaydet').click();
  });
  await p.waitForTimeout(400);
  dene('★ geçersiz sayı varsa HİÇBİR ŞEY kaydedilmiyor (tiki bile)', ()=>{
    const y = cagrilar.filter(c=> c.islem !== 'matris');
    assert.strictEqual(y.length, 0, JSON.stringify(y));
    assert.strictEqual(sorular.length, 0, 'onay cikmamaliydi: ' + JSON.stringify(sorular));
  });

  // ── 8. YARIM KALMA: HANGİSİ GEÇTİ YAZILIYOR ─────────────────────
  await p.evaluate(()=> yukle('planlar', true));
  await p.waitForTimeout(500);
  cagrilar.length = 0; sorular.length = 0;
  hataVer = 'fikir_onceligi';
  await p.evaluate(()=>{
    document.querySelector('[data-oz="starter|fikir_onceligi"]').checked = true;
    document.querySelector('[data-oz="starter|drive_script"]').checked = false;
    document.getElementById('matrisKaydet').click();
  });
  await p.waitForTimeout(900);
  const durumMetni = await p.evaluate(()=> document.getElementById('durum').textContent);
  dene('★ biri hata verirse hangisinin geçtiği EKRANDA yazıyor', ()=>{
    assert.ok(/KAYDEDİLEMEYEN/.test(durumMetni), 'durum: ' + durumMetni);
    assert.ok(/Fikirlere öncelik/.test(durumMetni), 'durum: ' + durumMetni);
    assert.ok(/Google Drive/.test(durumMetni), 'durum: ' + durumMetni);
  });

  dene('sayfa hatası yok', ()=>{
    assert.strictEqual(jsHata.length, 0, jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
