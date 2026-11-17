// IKON AILESI TEK OLSUN: her Shootboard sayfasi AYNI ikon kumesini
// yuklesin ve dosyalar AYNI kaynaktan uretilmis olsun.
//
// NEDEN BU TEST VAR
//   Kullanici sekmelerde gordu (16 Kasim 2026): "fiyatlar ve ana sayfa
//   arasindaki fav ikonlar birbirinden farkli".
//
//   Incelenince iki ayri kusur cikti:
//   1) 15 sayfa, YEDI FARKLI ikon kalibi. Ucunde (aktar, tiktok,
//      youtube) hic ikon yoktu; index.html yalnizca favicon.svg
//      yukluyordu; lokasyon.html ise SVG'siz raster yukluyordu.
//   2) favicon.svg 13 Kasim'da kalmisti; PNG/ICO ailesi 15 Kasim'da
//      logo-koyu.svg'den YENIDEN URETILMISTI. Yani sekme ikonu ile
//      Apple/PWA ikonu FARKLI bir cizim gosteriyordu.
//
// ⛔ BU DEPONUN TEKRARLAYAN HATASI TAM BURASI: bir yerde yapip
//    otekilerde unutmak. Ikon ailesi 13 Kasim'da da ayrismisti.
//    CLAUDE.md Bolum 7'nin kurali: cozum her seferinde ayni --
//    LISTEYI ELLE YAZMAYAN, KENDI BULAN bir bekci test.
//    Bu yuzden asagisi sayfa listesi TUTMUYOR: kok dizindeki her
//    .html dosyasini kendi buluyor. Yeni bir sayfa eklendiginde
//    kendiliginden kapsama giriyor.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');

// Kanonik kume. Degisirse burasi da degisir -- ama tek yerde.
const KANONIK = [
  'favicon.svg',
  'favicon.ico',
  'favicon-32x32.png',
  'favicon-16x16.png',
  'apple-touch-icon.png',
];

let gecti = 0; const hatalar = [];
const dene = (ad, fn) => {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { hatalar.push(ad); console.log('  HATA ' + ad + ': ' + e.message); }
};

// ---- Sayfalari KENDI BUL ----
const sayfalar = fs.readdirSync(KOK)
  .filter(f => f.endsWith('.html'))
  .sort();

const oku = f => fs.readFileSync(path.join(KOK, f), 'utf8');
const ikonlari = metin => {
  const r = [];
  const re = /<link[^>]*rel="[^"]*(?:icon|apple-touch-icon)[^"]*"[^>]*>/gi;
  let m;
  while ((m = re.exec(metin))) {
    const h = /href="([^"]+)"/i.exec(m[0]);
    if (h) r.push(h[1]);
  }
  return r;
};
// Shootboard sayfasi mi? ⛔ lokasyon.html Shootboard DEGIL: kullanicinin
// kendi kanalina ait saha dosyasi, icinde "Shootboard" hic gecmiyor.
// Ona Shootboard ikonu basmak yanlis olurdu. Bu AYIRIM KENDI KENDINI
// DENETLIYOR: sayfa bir gun Shootboard markali olursa kapsama girer ve
// ikonsuzsa test duser.
const shootboardMi = f => /shootboard/i.test(oku(f));

dene('kok dizinde .html sayfasi bulundu', () => {
  assert.ok(sayfalar.length >= 10, 'sayfa bulunamadi: ' + sayfalar.length);
});

// ---- 1. Her Shootboard sayfasi AYNI kumeyi yukluyor ----
const kapsanan = sayfalar.filter(shootboardMi);
dene('★ her Shootboard sayfasi AYNI ikon kumesini yukluyor', () => {
  const sapan = [];
  kapsanan.forEach(f => {
    const v = ikonlari(oku(f));
    const eksik = KANONIK.filter(k => v.indexOf(k) === -1);
    const fazla = v.filter(k => KANONIK.indexOf(k) === -1);
    if (eksik.length || fazla.length) {
      sapan.push(f + ' [eksik: ' + eksik.join(',') + '] [fazla: ' + fazla.join(',') + ']');
    }
  });
  assert.deepStrictEqual(sapan, [],
    'ikon ailesi yine ayristi:\n    ' + sapan.join('\n    '));
});

dene('kapsam yeterince genis (sayfalarin cogu)', () => {
  assert.ok(kapsanan.length >= sayfalar.length - 2,
    'beklenenden az sayfa kapsandi: ' + kapsanan.length + '/' + sayfalar.length +
    ' -- kapsam disi: ' + sayfalar.filter(f => !shootboardMi(f)).join(','));
});

// ---- 2. Referans verilen her dosya GERCEKTEN VAR ----
dene('★ referans verilen her ikon dosyasi diskte var', () => {
  const yok = KANONIK.filter(k => !fs.existsSync(path.join(KOK, k)));
  assert.deepStrictEqual(yok, [], 'eksik dosya: ' + yok.join(','));
});

// ---- 3. favicon.svg AYRISTIRILABILIYOR ----
// ⛔ 17 Kasim 2026: favicon.svg bir kez XML olarak BOZULDU, cunku
//    yorumuna cift tire yazilmisti (XML yorumunda yasak). Tarayici
//    ikonu HIC cizemezdi ve bunu hicbir sey yakalamazdi.
dene('★ favicon.svg gecerli XML (cift tire tuzagi)', () => {
  const s = fs.readFileSync(path.join(KOK, 'favicon.svg'), 'utf8');
  const yorumlar = s.match(/<!--[\s\S]*?-->/g) || [];
  yorumlar.forEach(y => {
    const ic = y.slice(4, -3);
    assert.ok(ic.indexOf('--') === -1,
      'XML yorumunda cift tire var: dosya ayristirilamaz ve ikon hic cizilmez');
  });
  assert.ok(/<svg[\s>]/.test(s), 'svg kok ogesi yok');
  assert.ok(/<\/svg>\s*$/.test(s), 'svg kapanmamis');
});

// ---- 4. favicon.svg ile logo ailesi AYNI CIZIM ----
// Renkler bilerek farkli (govde acik/koyu); GEOMETRI ayni olmali.
const geometri = dosya => {
  const s = fs.readFileSync(path.join(KOK, dosya), 'utf8');
  const kutu = (/viewBox="([^"]+)"/.exec(s) || [])[1] || '';
  const yollar = (s.match(/\sd="[^"]+"/g) || []).map(x => x.trim());
  const kutular = (s.match(/<rect[^>]*>/g) || [])
    .map(x => (x.match(/\s(?:x|y|width|height|rx)="[^"]+"/g) || []).join(' '));
  return { kutu, yollar, kutular };
};
dene('★ favicon.svg ile logo-koyu.svg AYNI geometri', () => {
  const a = geometri('favicon.svg');
  const b = geometri('logo-koyu.svg');
  assert.strictEqual(a.kutu, b.kutu, 'viewBox ayristi: ' + a.kutu + ' / ' + b.kutu);
  assert.deepStrictEqual(a.yollar, b.yollar,
    'klaket disleri ayristi: ikon ailesi yine iki ayri cizim oldu');
  assert.deepStrictEqual(a.kutular, b.kutular,
    'govde/cizgi olculeri ayristi');
});
dene('logo.svg de ayni geometride (uc dosya bir aile)', () => {
  const a = geometri('favicon.svg');
  const c = geometri('logo.svg');
  // ⚠ Yukaridaki iddia ile AYNI seyleri olcuyor. Once yalnizca viewBox
  //   ve yollara bakiyordu; mutasyon denemesinde bir rect degistirildi
  //   ve bu iddia YESIL kaldi. "Uc dosya bir aile" diyen bir olcu,
  //   otekiyle ayni sertlikte olmali.
  assert.strictEqual(a.kutu, c.kutu, 'viewBox ayristi');
  assert.deepStrictEqual(a.yollar, c.yollar, 'klaket disleri ayristi');
  assert.deepStrictEqual(a.kutular, c.kutular, 'govde/cizgi olculeri ayristi');
});

// ---- 5. favicon.svg iki temayi da tasiyor ----
dene('★ favicon.svg acik ve koyu temayi birlikte tasiyor', () => {
  const s = fs.readFileSync(path.join(KOK, 'favicon.svg'), 'utf8');
  assert.ok(/prefers-color-scheme:\s*dark/.test(s),
    'koyu tema kurali yok: koyu sekme seridinde ikon kaybolur');
  // Acik zemin surumunun govdesi KOYU, koyu zemin surumununki ACIK.
  assert.ok(s.indexOf('#17122A') !== -1 && s.indexOf('#FFF9F0') !== -1,
    'iki govde rengi birlikte bulunmali');
  assert.ok(s.indexOf('#FF5A1F') !== -1,
    'turuncu cubuk markanin sabiti, iki temada da ayni');
});

console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
process.exit(hatalar.length ? 1 : 0);
