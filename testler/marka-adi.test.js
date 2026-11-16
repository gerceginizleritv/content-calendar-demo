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
        u === '.html' ? 'text/html; charset=utf-8' :
        u === '.js' ? 'text/javascript' :
        u === '.json' ? 'application/json' :
        u === '.svg' ? 'image/svg+xml' : 'application/octet-stream' });
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
