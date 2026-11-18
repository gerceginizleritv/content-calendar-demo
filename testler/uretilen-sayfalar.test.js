// URETILEN /tr/ VE /en/ SAYFALARI (YAPILACAKLAR 47+48)
//
// Bugun (18 Kasim 2026) olculen DORT kusuru iddia olarak sabitliyor:
//   1. /en/ sayfasinin basligi ve aciklamasi TURKCE kaliyordu
//   2. goreli adresler koke cevrilmiyordu -> 404, sayfa STILSIZ
//   3. hafizadaki dil, adresin dilini EZIYORDU (menu Turkce, govde
//      Ingilizce ayni sayfada)
//   4. sozluk icine gomulu baglantilar dosya adi yaziyordu
//      (/en/guide.html diye var olmayan adres)
//
// ⛔ LISTE YAZMIYOR: sayfalari uret/sayfalar.js'ten, dilleri
//    uret/diller.js'ten okuyor (CLAUDE.md Bolum 7).
'use strict';
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { DILLER, kodlar } = require('../uret/diller.js');
const { SAYFALAR, DOKUNULMAZ, adres } = require('../uret/sayfalar.js');
const { ustMenu, BAS, SON } = require('../uret/ust-menu.js');

const KOK = path.join(__dirname, '..');
let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

const DIL = kodlar();
function dosyaYolu(sayfaAdi, dil){
  return path.join(KOK, adres(sayfaAdi, dil).replace(/^\/|\/$/g, ''), 'index.html');
}
const icerik = {};
for(const s of SAYFALAR) for(const d of DIL){
  const y = dosyaYolu(s.ad, d);
  icerik[s.ad + '@' + d] = fs.existsSync(y) ? fs.readFileSync(y, 'utf8') : null;
}

dene('her sayfa her dilde URETILMIS', ()=>{
  for(const k of Object.keys(icerik))
    assert.ok(icerik[k], k + ' icin dosya yok -- "node uret/uret.js" kosmamis');
});

dene('★ html lang ADRESIN dili (hafiza degil)', ()=>{
  for(const s of SAYFALAR) for(const d of DIL){
    const m = /<html[^>]*\slang="([^"]*)"/.exec(icerik[s.ad+'@'+d]);
    assert.ok(m, s.ad+'@'+d+' html lang yok');
    assert.strictEqual(m[1], DILLER[d].htmlLang, s.ad+'@'+d+' lang yanlis');
  }
});

dene('★ baslik ve aciklama HER DILDE AYRI (Ingilizce sayfa Turkce tanitmiyor)', ()=>{
  // Bu iddia 1 numarali kusuru tutuyor. Iki dilin basligi ayni
  // cikarsa ceviri uygulanmamis demektir.
  for(const s of SAYFALAR){
    const bas = {}, acik = {};
    for(const d of DIL){
      const t = icerik[s.ad+'@'+d];
      bas[d]  = (/<title>([^<]*)<\/title>/.exec(t) || [,''])[1];
      acik[d] = (/<meta name="description" content="([^"]*)"/.exec(t) || [,''])[1];
      assert.ok(bas[d].trim(), s.ad+'@'+d+' basligi bos');
    }
    // ⛔ 18 KASIM 2026: gizlilik/sartlar BOLUNDU, artik bu iddia
    //    onlari da kapsiyor. Bolundukten sonra olculdu: govdesi
    //    Turkce ama <title> hala "Privacy Policy" idi.
    const ayri = new Set(DIL.map(d=> bas[d]));
    assert.strictEqual(ayri.size, DIL.length,
      s.ad + ' basligi dillere gore degismiyor: ' + JSON.stringify(bas));
    const ayriA = new Set(DIL.map(d=> acik[d]));
    assert.strictEqual(ayriA.size, DIL.length,
      s.ad + ' aciklamasi dillere gore degismiyor: ' + JSON.stringify(acik));
  }
});

dene('★ GORELI adres kalmamis (404 ve stilsiz sayfa sebebi)', ()=>{
  for(const k of Object.keys(icerik)){
    const kotu = [];
    const re = /\s(?:href|src)="([^"]+)"/g;
    let m;
    while((m = re.exec(icerik[k]))){
      const v = m[1];
      // ⚠ HESAPLANAN deger degil, DUZ YAZILAN adres aranıyor.
      //   kilavuz.html:877 bagliantiyi var olan bir capadan
      //   kopyaliyor: href="' + a.getAttribute('href') + '".
      //   O bir adres degil, JavaScript kaynagi.
      //   ⛔ BETIKLERIN ICI YINE TARANIYOR: 18 Kasim 2026'da
      //   fiyatlar.html:493'teki GERCEK kusur (plan kartinin
      //   dugmesi href="app.html") tam orada yakalandi.
      if(/['"`]\s*\+|\+\s*['"`]|\$\{/.test(v)) continue;
      if(!/^(#|\/|https?:|mailto:|tel:|data:|javascript:)/i.test(v)) kotu.push(v);
    }
    assert.deepStrictEqual([...new Set(kotu)], [],
      k + ' icinde koke cevrilmemis adres var');
  }
});

dene('★ sozluk icinde DOSYA ADI yazan baglanti kalmamis', ()=>{
  // 4 numarali kusur: href=\"sartlar.html\" gibi KACISLI bicim,
  // sayfaya calisma aninda giriyor ve /en/sartlar.html'e gidiyordu.
  const kaynakAdlari = new Set();
  for(const s of SAYFALAR) for(const d of DIL){
    const kd = typeof s.kaynak === 'string' ? s.kaynak : s.kaynak[d];
    if(kd) kaynakAdlari.add(kd);
  }
  for(const k of Object.keys(icerik)) for(const ad of kaynakAdlari){
    const re = new RegExp('href=\\\\"(?:\\\\./)?' + ad.replace(/\./g,'\\.'));
    assert.ok(!re.test(icerik[k]), k + ' sozlugunde "' + ad + '" yazili');
  }
});

dene('★ canonical + hreflang: her dil ve x-default var', ()=>{
  for(const s of SAYFALAR) for(const d of DIL){
    const t = icerik[s.ad+'@'+d];
    assert.ok(t.includes('<link rel="canonical" href="https://shootboard.app' + adres(s.ad, d) + '">'),
      s.ad+'@'+d+' canonical yanlis ya da yok');
    for(const k of DIL){
      assert.ok(t.includes('hreflang="' + k + '" href="https://shootboard.app' + adres(s.ad, k) + '"'),
        s.ad+'@'+d+' · ' + k + ' hreflang yok');
    }
    assert.ok(t.includes('hreflang="x-default"'), s.ad+'@'+d+' x-default yok');
  }
});

dene('★ ust menu URETILMIS halle AYNI (bayatlamamis)', ()=>{
  for(const s of SAYFALAR) for(const d of DIL){
    const t = icerik[s.ad+'@'+d];
    const bas = t.indexOf(BAS), son = t.indexOf(SON);
    assert.ok(bas !== -1 && son !== -1, s.ad+'@'+d+' menu isaretleri yok');
    const icinde = t.slice(bas, son + SON.length);
    const beklenen = ustMenu({ sayfa: s.ad, dil: d });
    // ⚠ TARAYICI SERILESTIRMESI: bos degerli oznitelikleri
    //   `selected` degil `selected=""` diye yaziyor. 18 Kasim
    //   2026'da bu iddia tam bu yuzden dustu -- uygulama degil
    //   OLCUM yaniliyordu. Guvence degismedi (menu kaynagiyla
    //   birebir ayni olsun), yalnizca karsilastirma sadelesti.
    // ⚠ TARAYICI SERILESTIRMESI, IKI YERDE:
    //   1. Bos degerli oznitelik: `selected` -> `selected=""`
    //   2. Kendini kapatan SVG etiketi: `<rect .../>` -> `<rect ...></rect>`
    //   Ikisi de 18 Kasim 2026'da bu iddiayi dusurdu; ikisinde de
    //   UYGULAMA degil OLCUM yaniliyordu. Guvence degismedi: menu
    //   kaynagiyla birebir ayni olsun.
    const sade = (x)=> x
      .replace(/=""/g, '')
      .replace(/\s*\/>/g, '>')
      .replace(/<\/(?:rect|circle|path|clipPath|polygon|line|g)>/g, '')
      .replace(/\s+/g, ' ').trim();
    assert.strictEqual(sade(icinde), sade(beklenen),
      s.ad+'@'+d+' menusu BAYAT -- "node uret/uret.js" yeniden kosmali');
  }
});

dene('★ uretilen sayfa DOKUNULMAZ dosyalarin adresini BOZMUYOR', ()=>{
  // tiktok.html / youtube.html TikTok ve Google panellerinde kayitli.
  // Uretici onlarin dosyalarina dokunmuyor; burada da kok dizinde
  // durduklarini dogruluyoruz.
  for(const d of DOKUNULMAZ){
    assert.ok(fs.existsSync(path.join(KOK, d)), d + ' kok dizinde yok');
  }
});

dene('★ tek dosyada iki dil tasiyan sayfalar DILE BOLUNMUS', ()=>{
  // privacy.html ve sartlar.html once Ingilizce yari, sonra <hr>,
  // sonra id="turkce" ile Turkce yari tasiyordu. Turkce okuyan kisi
  // sayfanin BASINDA Ingilizce metinle karsilasiyordu.
  for(const s of SAYFALAR.filter(x=> x.trCapa)) for(const d of DIL){
    const t = icerik[s.ad+'@'+d];
    const h1 = [...t.matchAll(/<h1[^>]*>([^<]*)<\/h1>/g)].map(m=> m[1].trim());
    assert.strictEqual(h1.length, 1,
      s.ad+'@'+d+' icinde ' + h1.length + ' tane <h1> var: ' + JSON.stringify(h1)
      + ' -- bolunme yapilmamis, iki dil ust uste duruyor');
    assert.ok(!t.includes('id="turkce"'),
      s.ad+'@'+d+' hala bolme capasini tasiyor');
    assert.ok(!/class="langbar"/.test(t),
      s.ad+'@'+d+' sayfa ici dil cubugu kalmis (dil secici ust menude)');
  }
});

dene('★ DUZ adresler dil agacina YONLENDIRIYOR', ()=>{
  // Kullanici 18 Kasim 2026 iki ekran goruntusu gonderdi: eski
  // menuyu goruyordu, cunku duz adresler eski haliyle duruyordu.
  //
  // ⛔ Duz adresi TEK DILDE uretmek denendi ve iki seyi kirdi:
  //    "?lang=en" sozlesmesini (app.html fiyat seridi oyle
  //    bagliyor) ve tarayici dilini. Ikisi de fiyat-baglantisi
  //    testinde olculdu. Cozum: duz adres YONLENDIRICI oldu.
  for(const s of SAYFALAR){
    const duzler = s.duzCok || (s.duz ? [s.duz] : []);
    for(const d of duzler){
      const y = path.join(KOK, d.dosya);
      assert.ok(fs.existsSync(y), d.dosya + ' uretilmemis');
      const t = fs.readFileSync(y, 'utf8');
      // Her dile hreflang: arama motoru bunu kopya degil kapi saysin.
      for(const k of DIL){
        assert.ok(t.includes('hreflang="' + k + '" href="https://shootboard.app' + adres(s.ad, k) + '"'),
          d.dosya + ' · ' + k + ' hreflang yok');
      }
      assert.ok(t.includes('hreflang="x-default"'), d.dosya + ' x-default yok');
      // Siralama: ?lang -> hafiza -> tarayici -> varsayilan
      assert.ok(/URLSearchParams\(location\.search\)\.get\("lang"\)/.test(t),
        d.dosya + ' ?lang= okunmuyor -- app.html fiyat seridi kirilir');
      assert.ok(/localStorage\.getItem\("demo_ui_language"\)/.test(t),
        d.dosya + ' hafizadaki dil okunmuyor -- sureklilik kirilir');
      assert.ok(/navigator\.language/.test(t),
        d.dosya + ' tarayici dili okunmuyor');
      assert.ok(/location\.replace/.test(t), d.dosya + ' yonlendirmiyor');
      // Betik kapaliysa elle gidilebilsin.
      assert.ok(/<noscript>/.test(t), d.dosya + ' noscript cikisi yok');
      for(const k of DIL){
        assert.ok(t.includes('href="' + adres(s.ad, k) + '" hreflang="' + k + '"'),
          d.dosya + ' noscript listesinde ' + k + ' yok');
      }
      assert.ok(!/content="noindex/.test(t), d.dosya + ' noindex tasiyor');
    }
  }
});

// ─────────────────────────────────────────────────────────────────
// TARAYICIDA: hafizadaki dil ADRESIN dilini EZEMEZ.
//
// ⛔ 18 KASIM 2026 — BU BOLUM BIR TEST BOSLUGUNDAN DOGDU.
//    Yukaridaki dosya iddialari dil kilidini kaldiran mutasyonu
//    YAKALAMADI: uretici `documentElement.lang`i zaten yaziyor,
//    kilit ise ZIYARETCI SAYFAYI ACINCA is goruyor. Dosyaya bakan
//    bir olcu bunu goremez. Kusurun kendisi de boyleydi: menu
//    Turkce, govde Ingilizce -- ikisi de AYNI dosyadan.
// ⚠ Paylasilan 8098 sunucusunu kullaniyor (hizli.sh kuruyor).
const { chromium } = require('playwright');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

(async ()=>{
  let tarayici;
  try { tarayici = await chromium.launch(); }
  catch(e){
    kalan++;
    console.log('  XX  tarayici acilamadi: ' + e.message);
    console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
    process.exit(1);
  }

  // Her sayfayi, OTEKI dil hafizada yaziliyken ac.
  for(const s of SAYFALAR) for(const d of DIL){
    const oteki = DIL.find(x=> x !== d) || d;
    const p2 = await tarayici.newPage({ viewport:{ width:1280, height:900 } });
    const jsHata = [];  p2.on('pageerror', e=> jsHata.push(String(e.message)));
    const kayip = [];   p2.on('response', r=>{ if(r.status() >= 400) kayip.push(r.status() + ' ' + r.url()); });
    await p2.goto(SUNUCU + '/');
    await p2.evaluate(x=>{ try{ localStorage.setItem('demo_ui_language', x); }catch(e){} }, oteki);
    await p2.goto(SUNUCU + adres(s.ad, d), { waitUntil: 'load' });
    await p2.waitForTimeout(700);
    const o = await p2.evaluate(()=>({
      lang: document.documentElement.lang,
      baslik: document.title,
      menu: [...document.querySelectorAll('.ust-nav a')].map(a=> a.textContent.trim()),
      cta: !!document.querySelector('.ust-sag .dug'),
      secici: !!document.querySelector('.dil-tetik') && !!document.querySelector('.dil-panel'),
      // ⛔ ACILDIKTAN SONRAKI baglantilar. Dosyaya bakan olcu
      //    yetmiyor: 18 Kasim 2026'da index.html'in calisma
      //    zamani yeniden-yazmasini geri acan mutasyon HICBIR
      //    iddiayi dusurmedi, oysa o blok /en/ sayfasinda
      //    href'i "guide.html" yapip /en/guide.html'e yolluyor.
      goreli: [...new Set([...document.querySelectorAll('a[href]')]
        .map(a=> a.getAttribute('href'))
        .filter(h=> h && !/^(#|\/|https?:|mailto:|tel:|data:|javascript:)/i.test(h)))]
    }));
    await p2.close();
    const etiket = s.ad + '@' + d + ' (hafizada "' + oteki + '")';

    dene('★ ' + etiket + ': adres kazaniyor', ()=>{
      assert.strictEqual(o.lang, DILLER[d].htmlLang,
        'hafizadaki dil adresi EZDI -- menu bir dilde, govde otekinde kalir');
    });
    dene(etiket + ': CTA ve dil secici duruyor', ()=>{
      assert.ok(o.cta, 'CTA yok (kullanicinin 16 Kasim sikayeti)');
      assert.ok(o.secici, 'dil secici yok');
      assert.ok(o.menu.length >= 5, 'menu eksik: ' + JSON.stringify(o.menu));
    });
    dene('★ ' + etiket + ': acildiktan SONRA goreli baglanti yok', ()=>{
      assert.deepStrictEqual(o.goreli, [],
        'sayfa acilinca bir baglanti dosya adina dondu -- 48. maddenin '
        + 'kok sebebi: /en/ icinden "guide.html" /en/guide.html olur');
    });
    dene(etiket + ': 404 ve JS hatasi yok', ()=>{
      assert.deepStrictEqual([...new Set(kayip)], [], 'eksik dosya');
      assert.deepStrictEqual(jsHata, [], 'JS hatasi');
    });
  }

  // ───────────────────────────────────────────────────────────────
  // DIL SECICI GERCEKTEN CALISIYOR MU
  //
  // ⛔ 18 KASIM 2026 — BU BOLUM BIR BEKCI HATASINDAN DOGDU.
  //    Secici cizilmisti ama hicbir sey dinlemiyordu: SECMEK
  //    SAYFAYI DEGISTIRMIYORDU. Yukaridaki iddialar bunu kacirdi
  //    cunku "secici VAR" ve "dogru adresleri TASIYOR" diyorlardi;
  //    "secince GIDIYOR" demiyorlardi. Varligi olculen bir sey
  //    calistigi anlamina gelmez.
  for(const s of SAYFALAR){
    const d = DIL[0], hedefDil = DIL.find(x=> x !== d) || d;
    const p3 = await tarayici.newPage({ viewport:{ width:1280, height:900 } });
    await p3.goto(SUNUCU + '/');
    await p3.evaluate(()=>{ try{ localStorage.clear(); }catch(e){} });
    await p3.goto(SUNUCU + adres(s.ad, d), { waitUntil: 'load' });
    await p3.waitForTimeout(500);
    let gittigi = null, hafiza = null;
    const panelKapali = await p3.evaluate(()=>{
      const x = document.querySelector('.dil-panel'); return !x || x.hidden;
    });
    try {
      // ⛔ 18 KASIM 2026: YERLI <select> BIRAKILDI (kullanici "amator"
      //    buldu). Artik tetikleyiciye tiklanip panelden satir
      //    seciliyor. Olculen sey AYNI: secmek gercekten o sayfaya
      //    goturuyor mu, ve dil hatirlaniyor mu.
      await p3.click('.dil-tetik');
      await p3.waitForTimeout(250);
      await p3.click('.dil-satir[data-dil="' + hedefDil + '"]');
      await p3.waitForTimeout(800);
      gittigi = new URL(p3.url()).pathname;
      hafiza = await p3.evaluate(()=>{ try{ return localStorage.getItem('demo_ui_language'); }catch(e){ return null; } });
    } catch(e){ gittigi = 'HATA: ' + e.message; }
    await p3.close();

    dene('★ ' + s.ad + ': dil secmek GERCEKTEN o sayfaya goturuyor', ()=>{
      assert.strictEqual(gittigi, adres(s.ad, hedefDil),
        'secici OLU ya da yanlis yere goturuyor');
    });
    dene(s.ad + ': panel basta KAPALI', ()=>{
      assert.strictEqual(panelKapali, true,
        'dil paneli sayfa acilir acilmaz acik geliyor');
    });
    dene('★ ' + s.ad + ': secilen dil TARAYICIYA yaziliyor (sureklilik)', ()=>{
      assert.strictEqual(hafiza, hedefDil,
        'dil hatirlanmiyor -- kullanici bir dahaki gelisinde dilini kaybeder');
    });
  }

  // ───────────────────────────────────────────────────────────────
  // DUZ ADRESTE DIL SUREKLILIGI
  // Kullanici 18 Kasim 2026: "ingilizce secili iken ana sayfaya
  // gidince Turkceye dondu."
  for(const s of SAYFALAR){
    const duzler = s.duzCok || (s.duz ? [s.duz] : []);
    for(const d of duzler){
      const baskaDil = DIL.find(x=> x !== d.dil);
      if(!baskaDil) continue;
      const p4 = await tarayici.newPage({ viewport:{ width:1280, height:900 } });
      await p4.goto(SUNUCU + '/');
      await p4.evaluate(x=>{ try{ localStorage.setItem('demo_ui_language', x); }catch(e){} }, baskaDil);
      await p4.goto(SUNUCU + '/' + d.dosya, { waitUntil: 'load' });
      await p4.waitForTimeout(900);
      const nerede = new URL(p4.url()).pathname;
      await p4.close();
      dene('★ ' + d.dosya + ': hatirlanan dile goturuyor', ()=>{
        assert.strictEqual(nerede, adres(s.ad, baskaDil),
          'duz adres hatirlanan dili yok saydi -- kullanici dilini kaybeder');
      });
    }
  }

  await tarayici.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
