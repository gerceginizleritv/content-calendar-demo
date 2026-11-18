// MEKANLAR: KART / LISTE GORUNUMU  (YAPILACAKLAR 43. madde)
//
// NEDEN BU TEST VAR
//   Kullanici 16 Kasim 2026: "places / mekanlar sayfasinda yine
//   fotografli gorunumlu liste gorunumu eklenecek. Ust bolume liste
//   ve diger gorunum turu icin eklediğime benzer bir tus ekle,
//   gorunumler arasinda gecis yapabilsin."
//   18 Kasim 2026: "yoksa benzer yeni bir tus olustur" -- iki ikonlu
//   cift o gun cizildi (IKON_IZGARA / IKON_SATIR).
//
//   Kullanici kararlari (18 Kasim 2026):
//     tus      -> iki ikonlu cift, secili olan dolu
//     satir    -> fotograf + ad + adres + rozetler
//     varsayilan -> KARTLAR (bugunku hali)
//
// NE OLCUYOR
//   1. Varsayilan kart gorunumu
//   2. Tus gorunumu gercekten degistiriyor
//   3. Secim HATIRLANIYOR (sayfa yenilense de)
//   4. Satirda fotograf, ad, adres ve rozetler VAR
//   5. Satirlar ALT ALTA (tek sutun) -- kapsayici `#mk_list` kimlikle
//      `display:grid` yazilmis ve duz bir sinif onu yenemiyordu;
//      satirlar YAN YANA diziliyordu (18 Kasim'da olculdu)
//   6. Gorsel kutusu SABIT: `mekanGorseli()` uc ayri sey donebiliyor
//      (fotograf, harita karosu, bas harf) ve bas harf kutuya
//      sigmayip satiri patlatiyordu
//   7. Telefonda yatay tasma YOK (olculdu: 31 piksel tasiyordu)
//   8. Dokunma hedefi komsu dugmelerle ayni (telefonda 44 piksel)
//   9. ⛔ KART GORUNUMU BOZULMADI: `mekan-kart-olcu` testi kartlarin
//      ayni yukseklikte olmasini olcuyor; burada da dogrulaniyor ki
//      iki gorunum birbirine karismasin.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8166;           // ⛔ 8097-8099 kosucunun; asla kullanma
const KOK = path.join(__dirname, '..');

const MEKANLAR = [
  { id: 'g1', name: 'Süleymaniye Camii', district: 'Fatih', city: 'İstanbul',
    address: 'Prof. Sıddık Sami Onar Cd. No:1',
    permission: 'Vakıflardan izin al', cautions: 'Tripod içeride yasak' },
  { id: 'g2', name: 'Bergama Akropol', district: 'Bergama', city: 'İzmir',
    address: 'Akropol Yolu' },
  { id: 'g3', name: 'Çok uzun adı olan bir mekân örneği burada duruyor',
    district: 'Çankaya', city: 'Ankara',
    address: 'Çok uzun bir adres satırı burada duruyor, numara 12/B kat 3',
    cautions: 'Rüzgâr çok' },
];

(async () => {
  let gecti = 0; const hatalar = [];
  const dene = (ad, fn) => {
    try { fn(); gecti++; console.log('  ok  ' + ad); }
    catch (e) { hatalar.push(ad); console.log('  HATA ' + ad + ': ' + e.message); }
  };

  const TIP = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
                '.js':'text/javascript', '.json':'application/json',
                '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png',
                '.woff2':'font/woff2' };
  const sunucu = http.createServer((istek, cevap) => {
    const yol = istek.url.split('?')[0];
    const dosya = path.join(KOK, yol === '/' ? 'app.html' : yol.slice(1));
    fs.readFile(dosya, (hata, veri) => {
      if (hata) { cevap.writeHead(404); cevap.end(); return; }
      cevap.writeHead(200, { 'Content-Type':
        TIP[path.extname(dosya)] || 'application/octet-stream' });
      cevap.end(veri);
    });
  });
  await new Promise(r => sunucu.listen(PORT, r));
  const tarayici = await chromium.launch();

  // Sayfayi acip mekanlari koyan ortak adim.
  async function sayfaAc(genislik, hafiza){
    const p = await tarayici.newPage({ viewport:{ width: genislik, height: 900 },
                                       isMobile: genislik < 700 });
    await p.addInitScript(`try{
      localStorage.setItem('demo_seen_intro','1');
      ${hafiza ? `localStorage.setItem('demo_mk_gorunum','${hafiza}');` : ''}
    }catch(e){}`);
    await p.goto('http://localhost:' + PORT + '/app.html');
    await p.waitForFunction(()=> typeof renderMekanlar === 'function', { timeout: 30000 });
    await p.waitForTimeout(400);
    await p.evaluate((liste)=>{
      // ⚠ Uygulama acilista bir karsilama penceresi gosteriyor ve
      //   gorunum tusunun USTUNU kapatiyor. Engellenen uygulama
      //   degil OLCUM; pencere kapatiliyor.
      document.querySelectorAll('.overlay.open').forEach(e=> e.classList.remove('open'));
      mekanlar = liste;
      document.getElementById('tabPlaces').click();
      renderMekanlar();
    }, MEKANLAR);
    await p.waitForTimeout(400);
    return p;
  }
  const olc = (p)=> p.evaluate(()=>({
    kart: document.querySelectorAll('#mk_list .mk-kart').length,
    satir: document.querySelectorAll('#mk_list .mk-satir').length,
    basiliKart: document.querySelector('[data-mkgor="kart"]').getAttribute('aria-pressed'),
    basiliListe: document.querySelector('[data-mkgor="liste"]').getAttribute('aria-pressed'),
    hafiza: (()=>{ try{ return localStorage.getItem('demo_mk_gorunum'); }catch(e){ return null; } })(),
    satirYuk: [...document.querySelectorAll('.mk-satir')].map(e=> Math.round(e.getBoundingClientRect().height)),
    sutunSayisi: new Set([...document.querySelectorAll('.mk-satir')]
      .map(e=> Math.round(e.getBoundingClientRect().left))).size,
    gorselOlcu: [...document.querySelectorAll('.mk-satir-gorsel')]
      .map(e=>{ const r = e.getBoundingClientRect();
                return Math.round(r.width) + 'x' + Math.round(r.height); }),
    // ⛔ 18 KASIM 2026 — COCUGU OLC, KUTUYU DEGIL.
    //    Ilk surumde yalnizca `.mk-satir-gorsel` kutusu olculuyordu
    //    ve o `overflow:hidden` oldugu icin DISARIDAN hep 76x54
    //    gorunuyordu: cocugu sinirlandiran kurali kaldiran mutasyon
    //    HICBIR iddiayi dusurmedi. Tasan sey cocuktu (bas harf,
    //    harita karosu ya da fotograf), kutu degil.
    gorselCocuk: [...document.querySelectorAll('.mk-satir-gorsel')]
      .map(e=>{ const c = e.firstElementChild; if(!c) return 'cocuk yok';
                const r = c.getBoundingClientRect();
                const k = e.getBoundingClientRect();
                return (Math.round(r.width) > Math.round(k.width) + 1
                     || Math.round(r.height) > Math.round(k.height) + 1)
                  ? ('TASIYOR ' + Math.round(r.width) + 'x' + Math.round(r.height)
                     + ' > ' + Math.round(k.width) + 'x' + Math.round(k.height))
                  : 'sigiyor'; }),
    adVar: [...document.querySelectorAll('.mk-satir .mk-ad')].length,
    yerVar: [...document.querySelectorAll('.mk-satir .mk-satir-yer')].length,
    rozetVar: document.querySelectorAll('.mk-satir .mk-satir-rozet .mk-rozet').length,
    kartYuk: [...document.querySelectorAll('.mk-kart')].map(e=> Math.round(e.getBoundingClientRect().height)),
    yatayKayma: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    tusYuk: Math.round(document.querySelector('.gs-dug').getBoundingClientRect().height),
    komsuYuk: Math.round(document.getElementById('mk_new').getBoundingClientRect().height)
  }));
  const bas = (p, mod)=> p.evaluate(m=>{
    document.querySelector('[data-mkgor="' + m + '"]').click(); }, mod);

  // ── MASAUSTU ────────────────────────────────────────────────────
  {
    const p = await sayfaAc(1280, null);
    const ilk = await olc(p);
    dene('★ varsayilan KART gorunumu (kullanici karari)', ()=>{
      assert.strictEqual(ilk.kart, MEKANLAR.length, 'kart sayisi: ' + ilk.kart);
      assert.strictEqual(ilk.satir, 0, 'satir gorunumu acik gelmis');
      assert.strictEqual(ilk.basiliKart, 'true');
      assert.strictEqual(ilk.basiliListe, 'false');
    });

    await bas(p, 'liste'); await p.waitForTimeout(400);
    const liste = await olc(p);
    dene('★ tus LISTEYE geciriyor', ()=>{
      assert.strictEqual(liste.satir, MEKANLAR.length, 'satir: ' + liste.satir);
      assert.strictEqual(liste.kart, 0, 'kartlar hala duruyor');
      assert.strictEqual(liste.basiliListe, 'true');
      assert.strictEqual(liste.basiliKart, 'false');
    });
    dene('★ satirda FOTOGRAF, AD, ADRES ve ROZETLER var', ()=>{
      assert.strictEqual(liste.gorselOlcu.length, MEKANLAR.length, 'gorsel kutusu eksik');
      assert.strictEqual(liste.adVar, MEKANLAR.length, 'ad eksik');
      assert.strictEqual(liste.yerVar, MEKANLAR.length, 'adres/sehir eksik');
      assert.ok(liste.rozetVar >= 3, 'rozet sayisi: ' + liste.rozetVar);
    });
    dene('★ satirlar ALT ALTA (tek sutun)', ()=>{
      assert.strictEqual(liste.sutunSayisi, 1,
        liste.sutunSayisi + ' sutun var: kapsayici hala izgara, '
        + 'satirlar yan yana diziliyor');
    });
    dene('★ gorsel kutusu SABIT olcude (bas harf satiri patlatmiyor)', ()=>{
      assert.strictEqual(new Set(liste.gorselOlcu).size, 1,
        'gorsel kutulari farkli boyda: ' + liste.gorselOlcu.join(' '));
      assert.strictEqual(liste.gorselOlcu[0], '76x54', liste.gorselOlcu[0]);
      assert.deepStrictEqual([...new Set(liste.gorselCocuk)], ['sigiyor'],
        'gorselin ICERIGI kutuyu asiyor: ' + liste.gorselCocuk.join(' | ')
        + ' -- kutu `overflow:hidden` oldugu icin disaridan dogru '
        + 'gorunur ama icerik yanlis olculenmistir');
    });
    dene('masaustunde yatay kayma yok', ()=>{
      assert.strictEqual(liste.yatayKayma, 0, liste.yatayKayma + 'px');
    });

    dene('★ secim TARAYICIYA YAZILIYOR (tiklama aninda)', ()=>{
      // ⛔ 18 KASIM 2026 — BU IDDIA BIR BOSLUKTAN DOGDU.
      //    Asagidaki "secim hatirlaniyor" olcusu hafizayi TESTIN
      //    KENDISI yaziyor, sonra okunuyor: yani yalnizca OKUMA
      //    sinaniyordu. Yazmayi kaldiran mutasyon hicbir iddiayi
      //    dusurmedi. Artik tiklamanin yazdigi da olculuyor.
      assert.strictEqual(liste.hafiza, 'liste',
        'listeye gecildi ama tarayiciya yazilmadi: ' + liste.hafiza);
    });

    await bas(p, 'kart'); await p.waitForTimeout(400);
    const geri = await olc(p);
    dene('★ KARTA geri donuluyor ve kartlar AYNI yukseklikte', ()=>{
      assert.strictEqual(geri.kart, MEKANLAR.length);
      assert.strictEqual(geri.satir, 0);
      assert.strictEqual(new Set(geri.kartYuk).size, 1,
        'kart yukseklikleri ayrismis: ' + geri.kartYuk.join(' '));
      assert.strictEqual(geri.hafiza, 'kart',
        'karta donuldu ama tarayiciya yazilmadi: ' + geri.hafiza);
    });
    await p.close();
  }

  // ── SECIM HATIRLANIYOR MU ───────────────────────────────────────
  {
    const p = await sayfaAc(1280, 'liste');
    const o = await olc(p);
    dene('★ secim HATIRLANIYOR (yeni oturumda liste aciliyor)', ()=>{
      assert.strictEqual(o.satir, MEKANLAR.length, 'liste acilmadi');
      assert.strictEqual(o.basiliListe, 'true');
      assert.strictEqual(o.hafiza, 'liste');
    });
    await p.close();
  }

  // ── TELEFON ─────────────────────────────────────────────────────
  {
    const p = await sayfaAc(390, 'liste');
    const o = await olc(p);
    dene('★ telefonda YATAY KAYMA yok', ()=>{
      assert.strictEqual(o.yatayKayma, 0,
        o.yatayKayma + 'px kayiyor -- rozet kutusu ekrani asiyor olabilir');
    });
    dene('★ telefonda dokunma hedefi komsu dugmelerle AYNI', ()=>{
      assert.ok(o.tusYuk >= 44,
        'gorunum tusu ' + o.tusYuk + 'px -- parmakla basilamayacak kadar kucuk');
      assert.ok(Math.abs(o.tusYuk - o.komsuYuk) <= 4,
        'tus ' + o.tusYuk + 'px, komsu dugme ' + o.komsuYuk + 'px');
    });
    dene('telefonda satirlar yine tek sutun', ()=>{
      assert.strictEqual(o.sutunSayisi, 1, o.sutunSayisi + ' sutun');
    });
    await p.close();
  }

  await tarayici.close();
  sunucu.close();
  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  process.exit(hatalar.length ? 1 : 0);
})();
