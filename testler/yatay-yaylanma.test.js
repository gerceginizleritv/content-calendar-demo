// YATAY YAYLANMA KORUMASI — HER SAYFADA OLMAK ZORUNDA.
//
// NEDEN BU TEST VAR
//   Telefonda parmak biraz yana kaydiginda tarayici sayfayi yatayda
//   "lastik gibi" cekip birakiyor. Sayfa ekrandan genis DEGIL --
//   yaylanma bos yerde oluyor; arkadaki zemin aciga ciktigi icin
//   fark ediliyor.
//
//   ⛔ Bu hata bir kez bulunup app.html'de duzeltilmisti. Diger SEKIZ
//      sayfada duzeltilmedi. 16 Kasim 2026'da kullanici index.html'de
//      gordu ve ekran goruntusuyle bildirdi: ust bolumun saginda krem
//      bir serit olusuyordu.
//
//      "Bir yerde duzeltilip otekilerde unutulmasi" bu deponun
//      tekrarlayan hatasi: otomatik yayin politikasi tablosu, palet
//      degerleri, ikon ailesi, hesap silme listesi. Bu test o kaliba
//      bir bekci daha koyuyor.
//
// NE OLCUYOR — iki ayri sey:
//   1. Her sayfanin govdesinde (html ve body) overscroll-behavior-x
//      tanimli mi. Belgenin KENDI yaylanmasini bu kapatiyor.
//   2. Yana kayan HER ic alanda (overflow-x:auto/scroll) zincirleme
//      korumasi var mi. Bir alan sonuna gelince kaydirma sayfaya
//      zincirleniyor ve sayfa yayilaniyor; overscroll-behavior:contain
//      zinciri kaynakta kesiyor.
//
// ⚠ Yeni bir sayfa eklendiginde asagidaki SAYFALAR listesine YAZ.
//   Liste disinda kalan sayfa sessizce denetlenmemis olur.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');

const SAYFALAR = [
  'app.html', 'index.html', 'kilavuz.html', 'guide.html', 'fiyatlar.html',
  'lokasyon.html', 'privacy.html', 'sartlar.html', 'paylas.html',
];

// Denetim disi birakilanlar ve SEBEBI. Sebepsiz dosya buraya yazilmaz.
const KAPSAM_DISI = {
  'index-eski.html': 'eski surum, yayinda degil',
  'deneme.html': 'gelistirme araci',
  'aktar.html': 'tek seferlik ice aktarma araci',
  'yonetim.html': 'yonetim paneli, telefonda kullanilmiyor',
  'tiktok.html': 'platform dogrulama sayfasi, tek satir',
  'youtube.html': 'platform dogrulama sayfasi, tek satir',
  'araclar/vapid-uret.html': 'kurulum araci, yana kayan alani yok',
};

function kurallar(css) {
  // { secici, govde } ciftleri. Kaba ama yeterli: CSS'in tamamini
  // ayristirmiyoruz, yalnizca "secici{...}" bloklarini geziyoruz.
  return Array.from(css.matchAll(/([^\n{}]+)\{([^}]*)\}/g)).map(m => ({
    secici: m[1].trim().split('\n').pop().trim(),
    govde: m[2],
  }));
}

(() => {
  let gecti = 0; const hatalar = [];
  const dene = (ad, fn) => {
    try { fn(); gecti++; console.log('  ok  ' + ad); }
    catch (e) { hatalar.push(ad); console.log('  HATA ' + ad + ': ' + e.message); }
  };

  // ── 1. Liste gercekten sayfalari kapsiyor mu ──────────────────────
  // Bos tarama sessizce gecmesin, ve yeni bir sayfa listeye
  // yazilmadan eklenmesin.
  dene('★ bekci: depodaki her yayin sayfasi listede ya da kapsam disinda', () => {
    const diskte = fs.readdirSync(KOK)
      .filter(f => f.endsWith('.html'))
      .filter(f => !f.startsWith('.'));
    const bilinen = new Set([...SAYFALAR, ...Object.keys(KAPSAM_DISI)]);
    const yeni = diskte.filter(f => !bilinen.has(f));
    assert.deepStrictEqual(yeni, [],
      'Bu sayfa(lar) ne denetleniyor ne de kapsam disi:\n    ' + yeni.join(', ') +
      '\n  testler/yatay-yaylanma.test.js icindeki SAYFALAR listesine ekle,' +
      '\n  ya da KAPSAM_DISI icine SEBEBIYLE yaz.');
  });

  dene('liste bos degil (test gercekten bir sey olcuyor)', () => {
    assert.ok(SAYFALAR.length >= 9, 'en az 9 sayfa beklenir');
  });

  // ── 2. Her sayfanin govdesinde koruma ─────────────────────────────
  for (const sayfa of SAYFALAR) {
    const css = fs.readFileSync(path.join(KOK, sayfa), 'utf8').replace(/\r\n/g, '\n');

    dene(sayfa + ': html ve body yaylanmaya kapali', () => {
      const html = /html\s*\{[^}]*overscroll-behavior-x\s*:\s*none/.test(css) ||
                   /html\s*,\s*body\s*\{[^}]*overscroll-behavior-x\s*:\s*none/.test(css);
      const body = /body\s*\{[^}]*overscroll-behavior-x\s*:\s*none/.test(css) ||
                   /html\s*,\s*body\s*\{[^}]*overscroll-behavior-x\s*:\s*none/.test(css);
      assert.ok(html, 'html{overscroll-behavior-x:none} YOK');
      assert.ok(body, 'body{overscroll-behavior-x:none} YOK');
    });

    // ── 3. Yana kayan her ic alanda zincirleme korumasi ─────────────
    dene(sayfa + ': yana kayan her alan zinciri kesiyor', () => {
      const korumasiz = kurallar(css)
        .filter(k => k.secici && !k.secici.startsWith('@'))
        .filter(k => /overflow(-x)?\s*:\s*(auto|scroll)/.test(k.govde))
        .filter(k => !/overscroll-behavior/.test(k.govde))
        .map(k => k.secici);
      assert.deepStrictEqual(korumasiz, [],
        'Bu alanlar yana kayiyor ama kaydirmayi SAYFAYA zincirliyor:\n    ' +
        korumasiz.join('\n    ') +
        '\n  Her birine overscroll-behavior-x:contain ekle.');
    });
  }

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})();
