// MARKA ADI KIRPILMASIN, VE ANA SAYFAYA DONUS OLSUN.
//
// NEDEN BU TEST VAR
//   Ust seritteki "Shootboard" yazisi telefonda UC KEZ kirpildi:
//     13 Kasim 2026 — kullanici canli ekranda gordu ("Shoot...")
//     (ayni gun ikinci kez, 381-409 piksel araligi icin ayri bir
//      kural yazilarak duzeltildi)
//     16 Kasim 2026 — kullanici yine bildirdi, bu kez "Shoot..."
//   Her seferinde serit biraz daha dolmustu ve kimse olcmemisti.
//   Bu test olcuyor.
//
// ⛔ KIRPILMIS MARKA MARKAYI TASIMAZ. Kural: ya ad TAM gorunur,
//    ya da hic gorunmez (yalnizca klaket isareti kalir). Arada
//    "Shootbo..." diye bir sey OLMAZ.
//
// ⚠ EN DAR DURUM: giris YAPILMIS hali. O zaman fotograf, hesap
//   dugmesi, dil kutusu ve "..." ayni satirda duruyor. Giris
//   yapilmamisken fotograf gizli, yani yer bol -- dar durumu
//   olcmek icin test giris yapmis gibi davraniyor.
//
// ⚠ IKI DIL DE OLCULUYOR. Turkce "Giriş yap" Ingilizce "Sign in"den
//   genis; 13 Kasim'daki kirpilma tam bu farktan cikmisti.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const PORT = 8125;           // ⛔ 8097-8099 kosucunun; asla kullanma
const KOK = path.join(__dirname, '..');

// Yazinin TAM gorunmesi beklenen genislikler.
const GENIS = [360, 375, 390, 412, 430];
// Yazinin GIZLI olmasi beklenen genislikler (isaret tek basina).
const DAR = [320, 340];

(async () => {
  let gecti = 0; const hatalar = [];
  const dene = (ad, fn) => {
    try { fn(); gecti++; console.log('  ok  ' + ad); }
    catch (e) { hatalar.push(ad); console.log('  HATA ' + ad + ': ' + e.message); }
  };

  const sunucu = http.createServer((istek, cevap) => {
    const yol = istek.url.split('?')[0];
    const dosya = path.join(KOK, yol === '/' ? 'app.html' : yol.slice(1));
    fs.readFile(dosya, (hata, veri) => {
      if (hata) { cevap.writeHead(404); cevap.end(); return; }
      const u = path.extname(dosya);
      cevap.writeHead(200, { 'Content-Type':
        // ⛔ .css BURADA OLMAK ZORUNDA. Tarayici stil sayfasini YANLIS
        //   MIME turuyle gelirse REDDEDIYOR: sayfa boyasiz aciliyor,
        //   butun `var(--…)` degerleri bos cozuluyor ve olcum sessizce
        //   yanlis sonuc veriyor. 16 Kasim 2026'da tam bu oldu --
        //   kilavuz sayfalari `marka.css` yukluyor, test onu
        //   `application/octet-stream` diye servis etti ve telefonda
        //   "vurgu gorunmuyor" diye VAR OLMAYAN bir hata bildirdi.
        //   (app.html dis stil sayfasi yuklemiyor, o yuzden ona bakan
        //   testler etkilenmemisti -- ama bir gun yuklerse etkilenir.)
        u === '.html' ? 'text/html; charset=utf-8' :
        u === '.css'  ? 'text/css; charset=utf-8' :
        u === '.js'   ? 'text/javascript' :
        u === '.json' ? 'application/json' :
        u === '.svg'  ? 'image/svg+xml' :
        u === '.webp' ? 'image/webp' :
        u === '.png'  ? 'image/png' :
        u === '.woff2'? 'font/woff2' : 'application/octet-stream' });
      cevap.end(veri);
    });
  });
  await new Promise(r => sunucu.listen(PORT, r));
  const tarayici = await chromium.launch();

  // Giris yapmis gibi davran ve olc.
  async function olc(sayfa, dil) {
    return await sayfa.evaluate((d) => {
      setLanguage(d);
      const av = document.getElementById('railAvatar');
      if (av) { av.classList.remove('bos'); av.textContent = 'M'; }
      // session uygulamanin kendi degiskeni; refreshAuthUi ona bakiyor.
      session = { user: { email: 'olcum@ornek.test', user_metadata: {} } };
      refreshAuthUi();
      const wm = document.querySelector('.wordmark');
      const kutu = wm.getBoundingClientRect();
      return {
        gorunur: kutu.width > 0,
        // scrollWidth > clientWidth => ellipsis devreye girmis, yani KIRPIK
        kirpik: kutu.width > 0 && wm.scrollWidth > wm.clientWidth + 1,
        genislik: Math.round(kutu.width),
        gereken: wm.scrollWidth,
        // Dugmenin yazisi dar ekranda gizleniyor mu
        etiketGizli: (() => {
          const e = document.querySelector('.rail-auth .auth-etiket');
          return e ? getComputedStyle(e).display === 'none' : null;
        })(),
      };
    }, dil);
  }

  // ── PAY OLCUMU ────────────────────────────────────────────────────
  // ⛔ 19 KASIM 2026 — "KIRPILMADI" TEK BASINA YETMIYOR.
  //   Dil secici yenilendiginde (YAPILACAKLAR 58 asama 2) tetik 45
  //   pikselden 67,17 piksele cikti. 360 pikselde ad kirpildi ve bu
  //   test yakaladi -- ama 375 pikselde pay YALNIZCA 0,12 PIKSELDI ve
  //   test orada YESIL kaldi. Yani serige eklenecek bir sonraki sey
  //   375'i de kirpacakti ve bunu yine kullanici gorecekti.
  //   Bu olcum paya bakiyor: serige PAY kadar sahte genislik eklenince
  //   ad hala kirpilmamis mi? Eklenen oge gercek bir ogenin yerine
  //   gecmiyor, sadece ayni satirda yer kapliyor -- yani "bu serit daha
  //   ne kadar dolabilir" sorusunun cevabi.
  // ⚠ Olculen pay (19 Kasim 2026): 360→10px, 375→22, 390→14, 412→22,
  //   430→40. En dar durum 360 piksel. Esik 8 piksel: olculen en kucuk
  //   degerin altinda ama sifirin cok uzerinde, yani yazi tipi
  //   cizimindeki kucuk oynamalar testi kirmiyor, YENI BIR OGE kiriyor.
  const PAY = 8;
  async function payVarMi(sayfa, dil) {
    return await sayfa.evaluate((d) => {
      setLanguage(d.dil);
      const av = document.getElementById('railAvatar');
      if (av) { av.classList.remove('bos'); av.textContent = 'M'; }
      session = { user: { email: 'olcum@ornek.test', user_metadata: {} } };
      refreshAuthUi();
      const me = document.querySelector('.rail-me');
      const sahte = document.createElement('span');
      sahte.style.cssText = 'flex:none;height:1px;width:' + d.pay + 'px;';
      me.appendChild(sahte);
      const wm = document.querySelector('.wordmark');
      const k = wm.getBoundingClientRect();
      const r = { kirpik: k.width > 0 && wm.scrollWidth > wm.clientWidth + 1,
                  genislik: Math.round(k.width), gereken: wm.scrollWidth };
      sahte.remove();
      return r;
    }, { dil, pay: PAY });
  }

  for (const w of GENIS) {
    const p = await tarayici.newPage({ ...devices['iPhone 13'],
                                       viewport: { width: w, height: 760 } });
    await p.goto('http://localhost:' + PORT + '/app.html');
    await p.waitForFunction(() => typeof refreshAuthUi === 'function', { timeout: 30000 });
    await p.waitForTimeout(600);
    for (const dil of ['en', 'tr']) {
      const r = await olc(p, dil);
      dene(w + 'px ' + dil + ': marka adi TAM gorunuyor', () => {
        assert.ok(r.gorunur, 'ad hic gorunmuyor (bu genislikte gorunmeli)');
        assert.ok(!r.kirpik,
          'ad KIRPIK: kutu ' + r.genislik + 'px, gereken ' + r.gereken + 'px');
      });
      dene(w + 'px ' + dil + ': giris yapmisken hesap yazisi gizli', () => {
        assert.strictEqual(r.etiketGizli, true,
          'dugmenin yazisi gorunuyor; markaya yer kalmiyor');
      });
      const pr = await payVarMi(p, dil);
      dene(w + 'px ' + dil + ': markanin en az ' + PAY + 'px PAYI var', () => {
        assert.ok(!pr.kirpik,
          'serige ' + PAY + 'px eklenince ad KIRPILIYOR: kutu ' + pr.genislik +
          'px, gereken ' + pr.gereken + 'px. Pay bu kadar inceyse bir sonraki ' +
          'serit ogesi markayi kullanicinin ekraninda kirpar.');
      });
    }
    await p.close();
  }

  for (const w of DAR) {
    const p = await tarayici.newPage({ ...devices['iPhone 13'],
                                       viewport: { width: w, height: 760 } });
    await p.goto('http://localhost:' + PORT + '/app.html');
    await p.waitForFunction(() => typeof refreshAuthUi === 'function', { timeout: 30000 });
    await p.waitForTimeout(600);
    const r = await olc(p, 'tr');
    dene(w + 'px: ad ya TAM ya GIZLI, arada kirpik degil', () => {
      assert.ok(!r.kirpik,
        'ad KIRPIK gorunuyor. Bu genislikte ya tam sigmali ya da ' +
        '.wordmark{display:none} ile gizlenmeli -- kirpilmis marka markayi tasimaz.');
    });
    await p.close();
  }

  // ── Ana sayfaya donus ─────────────────────────────────────────────
  // Uygulamanin icinden index.html'e donmenin hic yolu yoktu:
  // kullanici 16 Kasim 2026'da bildirdi.
  const p = await tarayici.newPage({ ...devices['iPhone 13'] });
  await p.goto('http://localhost:' + PORT + '/app.html');
  await p.waitForTimeout(900);
  const ev = await p.evaluate(() => {
    const a = document.querySelector('a.lockup');
    return a ? { href: a.getAttribute('href'), yazi: a.textContent.trim() } : null;
  });
  dene('★ marka ANA SAYFAYA baglanti', () => {
    assert.ok(ev, 'marka kilidi bir <a> degil: ana sayfaya donus yolu yok');
    assert.strictEqual(ev.href, 'index.html', 'baglanti index.html\'e gitmiyor');
    assert.ok(/Shootboard/.test(ev.yazi), 'baglantinin icinde marka adi yok');
  });

  // Dugmenin metnini YALNIZCA refreshAuthUi yazmali: data-i18n geri
  // yazip ikon+etiket yapisini siliyordu (16 Kasim 2026).
  const i18n = await p.evaluate(() =>
    document.getElementById('authBtn').hasAttribute('data-i18n'));
  dene('★ hesap dugmesinde data-i18n YOK (yapiyi siliyordu)', () => {
    assert.strictEqual(i18n, false,
      'data-i18n geri geldi: applyStaticI18n ikon+etiket yapisini duz metne cevirir');
  });
  await p.close();

  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
