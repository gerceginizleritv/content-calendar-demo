// YILLIK INDIRIM ROZETI — UC YERDE, VERIDEN  (YAPILACAKLAR 44.7)
//
// NEDEN BU TEST VAR
//   Kullanici 16 Kasim 2026'da ekran goruntusuyle istedi: yillik
//   indirim orani GOZE CARPSIN -- "kendi fontu ve gorseli" olan
//   tasarlanmis bir oge, kartta yillik fiyatin yazdigi yerde, ve
//   ayni oran "Yillik" dugmesinin yaninda. Ayrica baslikti cumle
//   ("Yillik odemede %22 kadar daha ucuz") "cok kucuk" dedi.
//
// NE OLCUYOR
//   1. Oran VERIDEN geliyor -- fiyat degisince rozet de degisiyor.
//      ⛔ Sabit sayi yazilsaydi bu iddia duserdi.
//   2. Uc yer de ayni oran: dugme yani · baslikti cumle · kart.
//   3. Kart rozeti YALNIZCA yillik secilyken cikiyor (aylik fiyatin
//      yaninda "indirim" yazmak yanlis olurdu).
//   4. ⛔ Indirim YOKSA hicbir yerde rozet yok. "%0 indirim" yazmak
//      gurultu, hatta yaniltici olurdu.
//   5. Bolum 7: iki dil AYRI metin kullaniyor (tr "indirim",
//      en "off") -- biri sozluge girmezse bu iddia duser.
//   6. Hapin kontrasti WCAG AA esiginin (4.5) uzerinde.

const assert = require('node:assert');
const { chromium } = require('playwright');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

const L = c => { const v = c.map(x=>{ x/=255;
  return x <= .03928 ? x/12.92 : Math.pow((x+.055)/1.055, 2.4); });
  return .2126*v[0] + .7152*v[1] + .0722*v[2]; };
const kontrast = (a,b)=>{ const l1=L(a), l2=L(b);
  const [y,d] = l1>l2 ? [l1,l2] : [l2,l1]; return (y+.05)/(d+.05); };
const rgb = s => s.match(/\d+/g).slice(0,3).map(Number);

const PLANLAR = [
  { key:'starter',     visible:true, badge:null,          sort:10 },
  { key:'creator_pro', visible:true, badge:'recommended', sort:20 }
];
// aylik 100,00 · yillik 840,00 -> yillik/12 = 70,00 -> %30 indirim
const FIYAT = (yillikMinor)=> [
  { plan_key:'starter',     currency:'TRY', period:'monthly', amount_minor:0,      active:true },
  { plan_key:'creator_pro', currency:'TRY', period:'monthly', amount_minor:10000,  active:true },
  { plan_key:'creator_pro', currency:'TRY', period:'yearly',  amount_minor:yillikMinor, active:true }
];

(async ()=>{
  const b = await chromium.launch();
  const jsHata = [];
  const sonuc = {};

  for(const [d, yol] of [['tr','/tr/fiyatlar/'], ['en','/en/pricing/']]){
    const p = await b.newPage({ viewport:{ width:1280, height:1200 } });
    p.on('pageerror', e=> jsHata.push(d + ': ' + e.message));
    await p.route('**/rest/v1/**', r=> r.abort());
    await p.route('**/supabase-js**', r=> r.abort());
    await p.goto(SUNUCU + yol, { waitUntil:'load' });
    await p.evaluate(()=> document.fonts.ready);

    const oku = ()=> p.evaluate(()=>{
      const hap = document.getElementById('donemIndirim');
      const cumle = document.getElementById('indirim');
      const kart = [...document.querySelectorAll('.fiyat-alt .ind-rozet')];
      const s = hap && !hap.hidden ? getComputedStyle(hap) : null;
      return { denetim: hap && !hap.hidden ? hap.textContent.trim() : null,
               cumle: cumle.textContent.trim(),
               cumleHap: (cumle.querySelector('.ind-rozet') || {}).textContent || null,
               kart: kart.map(x=> x.textContent.trim()),
               yazi: s ? s.color : null, zemin: s ? s.backgroundColor : null };
    });
    const kur = (yillik, donem)=> p.evaluate(({ pl, fi, dn })=>{
      veri = { planlar: pl, limitler: [], fiyatlar: fi };
      const t = document.querySelector('[data-donem="' + dn + '"]');
      if(t) t.click();
      ciz();
    }, { pl: PLANLAR, fi: FIYAT(yillik), dn: donem });

    // ── %30 indirim (yillik 840,00) ──────────────────────────────
    await kur(84000, 'yearly');   sonuc[d + ':30:yillik'] = await oku();
    await kur(84000, 'monthly');  sonuc[d + ':30:aylik']  = await oku();
    // ── %10 indirim (yillik 1080,00) -- sayi DEGISMELI ───────────
    await kur(108000, 'yearly');  sonuc[d + ':10:yillik'] = await oku();
    // ── indirim YOK (yillik = aylik x 12) ────────────────────────
    await kur(120000, 'yearly');  sonuc[d + ':0:yillik']  = await oku();
    await p.close();
  }

  for(const d of ['tr','en']){
    const yuzde = (n)=> d === 'tr' ? '%' + n : n + '%';
    const o30 = sonuc[d + ':30:yillik'], o30a = sonuc[d + ':30:aylik'];
    const o10 = sonuc[d + ':10:yillik'], o0  = sonuc[d + ':0:yillik'];

    dene('★ ' + d + ': oran VERIDEN — %30 uc yerde de yaziyor', ()=>{
      assert.ok(o30.denetim && o30.denetim.indexOf(yuzde(30)) !== -1,
        'dugme yanindaki hap: ' + JSON.stringify(o30.denetim));
      assert.strictEqual(o30.cumleHap, yuzde(30),
        'baslikti cumledeki hap: ' + JSON.stringify(o30.cumleHap));
      assert.strictEqual(o30.kart.length, 1, 'kart rozeti sayisi: ' + o30.kart.length);
      assert.ok(o30.kart[0].indexOf(yuzde(30)) !== -1,
        'kart rozeti: ' + JSON.stringify(o30.kart[0]));
    });

    dene('★ ' + d + ': fiyat degisince oran da DEGISIYOR (sabit yazili degil)', ()=>{
      assert.ok(o10.denetim && o10.denetim.indexOf(yuzde(10)) !== -1,
        'yillik fiyat degisti ama dugme hapi: ' + JSON.stringify(o10.denetim));
      assert.strictEqual(o10.cumleHap, yuzde(10),
        'cumledeki hap: ' + JSON.stringify(o10.cumleHap));
      assert.ok(o10.kart[0] && o10.kart[0].indexOf(yuzde(10)) !== -1,
        'kart rozeti: ' + JSON.stringify(o10.kart[0]));
    });

    dene('★ ' + d + ': kart rozeti YALNIZCA yillik secilyken', ()=>{
      assert.strictEqual(o30a.kart.length, 0,
        'aylik secilyken kartta rozet var: ' + JSON.stringify(o30a.kart));
      // ⚠ Dugme yanindaki hap aylikta da durur: amac yillaga tesvik.
      assert.ok(o30a.denetim, 'aylik secilyken dugme hapi kayboldu');
    });

    dene('★ ' + d + ': INDIRIM YOKSA hicbir yerde rozet yok', ()=>{
      assert.strictEqual(o0.denetim, null,
        'indirim yokken dugme hapi duruyor: ' + JSON.stringify(o0.denetim));
      assert.strictEqual(o0.cumle, '',
        'indirim yokken cumle duruyor: ' + JSON.stringify(o0.cumle));
      assert.strictEqual(o0.kart.length, 0,
        'indirim yokken kart rozeti duruyor: ' + JSON.stringify(o0.kart));
    });

    dene('★ ' + d + ': hap kontrasti AA esiginin uzerinde', ()=>{
      const k = kontrast(rgb(o30.yazi), rgb(o30.zemin));
      assert.ok(k >= 4.5, 'kontrast ' + k.toFixed(2) + ' (en az 4.5)');
    });
  }

  dene('★ Bolum 7: iki dil AYRI SOZCUK kullaniyor', ()=>{
    // ⛔ 18 KASIM 2026 — BU IDDIA ONCE YANLIS NEDENLE YESILDI.
    //    Once dizeleri oldugu gibi karsilastiriyordu. Ama `yuzde`
    //    biciminin kendisi zaten farkli ("%30" ve "30%"), yani
    //    Ingilizce sozluge HIC girmese ve "indirim" yazsa bile
    //    dizeler esit cikmiyordu -- iddia hicbir seyi korumuyordu.
    //    Mutasyonla goruldu: ingilizce metin Turkcesiyle
    //    degistirildi ve test GECTI.
    //    Artik SAYI ve % atiliyor, geriye kalan SOZCUK
    //    karsilastiriliyor: tr " indirim" · en " off".
    const sadeleştir = (x)=> String(x || '').replace(/[\d%\s]+/g, ' ').trim();
    const tr = sonuc['tr:30:yillik'], en = sonuc['en:30:yillik'];
    assert.notStrictEqual(sadeleştir(tr.denetim), sadeleştir(en.denetim),
      'dugme hapi iki dilde AYNI SOZCUK: ' + JSON.stringify(sadeleştir(tr.denetim))
      + ' -- sozluge girmemis');
    assert.notStrictEqual(sadeleştir(tr.kart[0]), sadeleştir(en.kart[0]),
      'kart rozeti iki dilde AYNI SOZCUK: ' + JSON.stringify(sadeleştir(tr.kart[0])));
    assert.notStrictEqual(sadeleştir(tr.cumle), sadeleştir(en.cumle),
      'baslikti cumle iki dilde AYNI SOZCUK: ' + JSON.stringify(sadeleştir(tr.cumle)));
  });

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
