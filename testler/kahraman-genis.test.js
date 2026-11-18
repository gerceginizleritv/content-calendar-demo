// ⛔ 18 KASIM 2026 — "/index.html" ARTIK BIR YONLENDIRICI.
//    Yayin sayfalari dil agacina tasindi; duz adres yalnizca dili
//    okuyup /tr/ ya da /en/ adresine gonderiyor. Bu olcu Turkce
//    ana sayfayi olcuyor, dolayisiyla dogrudan /tr/ yukleniyor.
//    (Yonlendiricinin kendisi `uretilen-sayfalar` testinde olculuyor.)
// ANA SAYFA KAHRAMANI GENIS EKRANDA (YAPILACAKLAR 45. madde)
//
// NEDEN BU TEST VAR
//   Kullanici bildirdi (16 Kasim 2026): geniş ekranda "yazilar sola
//   dayanmis, yazi blogu ile fotograftaki kisi arasinda kocaman bos
//   turuncu alan kaliyor".
//
//   OLCULDU (17 Kasim 2026) -- yazinin bitisi ile telefonun baslangici
//   arasindaki aralik:
//     1280 -> -105    1920 -> -54    2560 -> +381    3440 -> +979
//   Sebebi: yazi sol kenara 96 pikselde CIVILI, fotograf ise saga yasli
//   ve 1800 pikselde duruyor. Ekran buyudukce arasi aciliyor.
//
// ⛔ MEVCUT KONTRAST TESTI BU GENISLIKLERI OLCMUYOR: yalnizca 1280'de
//    kosuyor (kontrast.test.js:54). Yaziyi saga tasimak, turuncu
//    katmanin disina dusurup kontrasti dusurebilirdi -- CSS yorumunda
//    "2,26'ya iniyordu" diye yazili bir tuzak bu. Bu test tam o
//    bosluk icin var: GENIS ekranlarda hem duzeni hem zemini olcuyor.
//
// ⛔ ZEMIN GERCEKTEN OLCULUYOR, hesaplanmiyor: sayfanin ekran
//    goruntusu alinip tuvale ciziliyor ve PIKSEL okunuyor. CSS'ten
//    hesaplamak, CSS'i ikinci kez yazmak olurdu -- kendi kendini
//    dogrulayan bir test hicbir sey kanitlamaz.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8161;           // ⛔ 8097-8099 kosucunun; asla kullanma
const KOK = path.join(__dirname, '..');
const TIP = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript', '.webp':'image/webp', '.png':'image/png',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2',
  '.json':'application/json', '.jpg':'image/jpeg' };

// Fotograf icindeki telefon araligi: CSS yorumunda OLCULMUS deger.
const TELEFON_SOL_ORAN = 0.298;
const FOTO_EN_COK = 1800;

let gecti = 0; const hatalar = [];
const dene = (ad, fn) => {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { hatalar.push(ad); console.log('  HATA ' + ad + ': ' + e.message); }
};

(async () => {
  const sunucu = http.createServer((istek, cevap) => {
    const yol = decodeURIComponent(istek.url.split('?')[0]);
    // ⚠ 18 KASIM 2026: KLASOR ADRESI DE CALISSIN. Yayin sayfalari
    //   /tr/ ve /en/ altina tasindi; "/tr/" bir DIZIN ve readFile
    //   dizin okuyamiyor -> 404 -> bos sayfa -> butun olculer null.
    //   Gercek sunucu (GitHub Pages) bu adreste index.html sunuyor;
    //   bu mini sunucu da artik oyle yapiyor.
    const sonEk = yol.endsWith('/') ? yol.slice(1) + 'index.html'
                                    : (yol === '' ? 'index.html' : yol.slice(1));
    const dosya = path.join(KOK, sonEk || 'index.html');
    fs.readFile(dosya, (hata, veri) => {
      if (hata) { cevap.writeHead(404); cevap.end(); return; }
      cevap.writeHead(200, { 'Content-Type':
        TIP[path.extname(dosya)] || 'application/octet-stream' });
      cevap.end(veri);
    });
  });
  await new Promise(r => sunucu.listen(PORT, r));
  const tarayici = await chromium.launch();
  const olculer = [];

  for (const W of [1280, 1920, 2560, 3440]) {
    const p = await tarayici.newPage({ viewport: { width: W, height: 900 } });
    const sayfaHatasi = [];
    p.on('pageerror', e => sayfaHatasi.push(String(e.message).slice(0, 90)));
    await p.goto('http://localhost:' + PORT + '/tr/', { waitUntil: 'load' });
    await p.waitForTimeout(500);

    const o = await p.evaluate((sabit) => {
      const kutu = e => { const b = e.getBoundingClientRect();
        return { sol: Math.round(b.left), sag: Math.round(b.right),
                 ust: Math.round(b.top), alt: Math.round(b.bottom) }; };
      const ust = document.querySelector('.kahraman-ust');
      const ic = document.querySelector('.kahraman-ic');
      const foto = document.querySelector('.kahraman-foto');
      const f = kutu(foto), y = kutu(ic), u = kutu(ust);
      const telefonSol = Math.round(f.sol + (f.sag - f.sol) * sabit.oran);
      // Sayfanin STANDART sutunu: ortalanmis .sar'in yazi kenari.
      // Kahramanin disindaki ilk .sar aliniyor (yesil bolum vb.).
      const sarlar = Array.prototype.slice.call(document.querySelectorAll('.sar'))
        .filter(x => !x.closest('.kahraman-ust'));
      const sar = sarlar[0];
      const standartSol = sar
        ? Math.round(sar.getBoundingClientRect().left +
            parseFloat(getComputedStyle(sar).paddingLeft)) : -1;
      // Ust menu: turuncu dugme ve dil tuslari
      const dug = Array.prototype.slice.call(
        document.querySelectorAll('header a, header button'))
        .filter(x => /ücretsiz|free/i.test(x.textContent))[0];
      // ⛔ 18 KASIM 2026: DIL SECIMI ARTIK "TR"/"EN" DUGMESI DEGIL.
      //    Kullanici yerli <select>'i "amator" buldu; yerine bayrakli
      //    ozel bir secici geldi (uret/ust-menu.js). Olcunun isi ayni:
      //    dil secici ile cagri dugmesi AYNI HIZADA mi, ikisi de
      //    ayni yukseklikte mi.
      const dil = document.querySelector('header .dil-tetik');
      const olc = e => { const b = e.getBoundingClientRect();
        return { ust: Math.round(b.top), alt: Math.round(b.bottom),
                 yuk: Math.round(b.height) }; };
      return { W: innerWidth, foto: f, yazi: y, ust: u, standartSol,
               telefonSol, bosluk: telefonSol - y.sag,
               menu: (dug && dil) ? { dugme: olc(dug), dil: olc(dil) } : null,
               yaziRengi: getComputedStyle(document.querySelector('.kahraman-ust h1')).color };
    }, { oran: TELEFON_SOL_ORAN });

    // ⛔ ZEMIN PIKSELI: ekran goruntusu tuvale cizilip okunuyor.
    const png = (await p.screenshot({ clip: {
      x: 0, y: Math.max(0, o.ust.ust),
      width: Math.min(W, 4000),
      height: Math.min(400, Math.max(1, o.ust.alt - o.ust.ust)) } })).toString('base64');
    const ornek = await p.evaluate(async (g) => {
      const im = new Image();
      await new Promise(r => { im.onload = r; im.src = 'data:image/png;base64,' + g.png; });
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      c.getContext('2d').drawImage(im, 0, 0);
      const ctx = c.getContext('2d');
      const al = (x, y) => { const d = ctx.getImageData(
        Math.min(Math.max(0, Math.round(x)), c.width - 1),
        Math.min(Math.max(0, Math.round(y)), c.height - 1), 1, 1).data;
        return [d[0], d[1], d[2]]; };
      // ⛔ TEK NOKTA YETMEZ. Fotografin rengi DIKEYDE degisiyor; ortadan
      //    tek ornek almak yazinin ustunde ya da altinda bozulan bir
      //    zemini kacirir. Yazi blogunun yuksekligi boyunca bes nokta,
      //    ve her birinde yazinin SAG UCU (en riskli yer).
      const noktalar = [];
      for(let i = 0; i < 5; i++){
        const yy = g.yaziUst + (g.yaziAlt - g.yaziUst) * (i / 4);
        // ⚠ +24: yazinin SAGINDA kenar payi da turuncu olmali.
        //   Tam sinirda bitmek, bir sonraki ceviri daha uzun oldugunda
        //   sessizce disari tasmak demektir.
        noktalar.push({ y: Math.round(yy), sol: al(g.yaziSag - 6, yy),
                        sag: al(g.yaziSag + 24, yy) });
      }
      return { noktalar, tuvalGen: c.width, tuvalYuk: c.height };
    }, { png, yaziSag: o.yazi.sag,
         yaziUst: Math.max(2, o.yazi.ust - o.ust.ust + 2),
         yaziAlt: Math.max(4, o.yazi.alt - o.ust.ust - 2) });

    o.zemin = ornek;
    o.sayfaHatasi = sayfaHatasi;
    olculer.push(o);
    await p.close();
  }

  // ⛔ "TURUNCU MU" DEGIL, KONTRAST ORANI. Gercek guvence yazinin
  //    okunabilmesi; zeminin hangi renk oldugu degil. Oran WCAG
  //    formuluyle hesaplaniyor ve esik 4,5.
  const isik = k => { const c = k / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const parlaklik = ([r, g, b]) =>
    0.2126 * isik(r) + 0.7152 * isik(g) + 0.0722 * isik(b);
  const oran = (a, b) => { const l1 = parlaklik(a), l2 = parlaklik(b);
    const y = Math.max(l1, l2), k = Math.min(l1, l2);
    return Math.round(((y + 0.05) / (k + 0.05)) * 100) / 100; };
  const rgbCoz = metin => {
    const m = /rgba?\(([^)]+)\)/.exec(metin);
    if (!m) return [0, 0, 0];
    const p = m[1].split(',').map(x => parseFloat(x));
    return [p[0], p[1], p[2]];
  };

  olculer.forEach(o => {
    dene(o.W + ': yazının sağ ucunda KONTRAST yeterli (5 dikey nokta)', () => {
      const yazi = rgbCoz(o.yaziRengi);
      const oranlar = [];
      o.zemin.noktalar.forEach(n => {
        oranlar.push({ y: n.y, sol: oran(yazi, n.sol), sag: oran(yazi, n.sag) });
      });
      const enDusuk = Math.min.apply(null,
        oranlar.map(x => Math.min(x.sol, x.sag)));
      assert.ok(enDusuk >= 4.5,
        'yazının sağ ucunda kontrast ' + enDusuk + ' (< 4.5): yazı turuncunun ' +
        'dışına taşmış olabilir. Noktalar: ' + JSON.stringify(oranlar));
    });
    dene(o.W + ': sayfa hatası yok', () => {
      assert.deepStrictEqual(o.sayfaHatasi, []);
    });
  });

  // ⛔ BU IKI IDDIA KALDIRILDI VE YERINE YUKARIDAKI "STANDART SUTUN"
  //    IDDIASI GECTI. Sebebi iki kat:
  //
  //    1) YANLIS MODEL. Telefonun yeri fotografin GENISLIGININ %29,8'i
  //       diye hesaplaniyordu. `object-fit:cover` yatayda da KIRPIYOR,
  //       yani o oran ekranda karsiligi olmayan bir sayi. Piksel
  //       olcumu gercegi gosterdi: fotografin turuncusu her genislikte
  //       %43,2'de bitiyor (1280→548, 1920→896, 2560→1536, 3440→2416).
  //    2) KULLANICININ KARARI DEGISTI. Ilk duzeltme yaziyi fotografa
  //       bagladi ve solda kocaman bos turuncu kaldi. Kullanici
  //       (17 Kasim 2026): "yazilar tipki yesil alanda oldugu gibi o
  //       hizalamada olmali." Ortalanmis sutun genis ekranda zaten
  //       bosluk birakir; "aralik buyumesin" sarti o kararla celisiyor.
  //
  //    Guvence kaybolmadi, yer degistirdi: yazi STANDART SUTUNDA
  //    basliyor (yukarida) ve TURUNCUNUN ICINDE bitiyor (asagida,
  //    piksel + kontrast olcumuyle).
  // ⛔ 17 KASIM 2026, IKINCI TUR. Ilk duzeltme yaziyi FOTOGRAFA
  //    baglamisti ve bu sefer SOLDA kocaman bos turuncu kaldi --
  //    kullanici ekran goruntusuyle bildirdi: "yazilar tipki yesil
  //    alanda oldugu gibi o hizalamada olmali".
  //    Dogru olcu: yazi, sayfanin STANDART sutununda baslasin.
  dene('★ yazı sayfanın STANDART sütununda başlıyor (yeşil bölümle aynı hiza)', () => {
    const sapan = olculer.filter(o => Math.abs(o.yazi.sol - o.standartSol) > 2)
      .map(o => o.W + ': yazı ' + o.yazi.sol + ', standart sütun ' + o.standartSol);
    assert.deepStrictEqual(sapan, [],
      'kahraman yazısı sayfanın geri kalanıyla aynı hizada değil:\n    ' +
      sapan.join('\n    '));
  });

  // ── ÜST MENÜ: "Ücretsiz başla" dil tuşlarıyla aynı boyda ─────────
  // Kullanıcı bildirdi (17 Kasım 2026): "sanki koyu bandın dışına
  // çıkıyor gibi... dil tuşları büyüklüğüne gelebilir."
  // ⚠ ÖLÇÜLDÜ: düğme bandın dışına TAŞMIYORDU (8,4 px içeride). Ama
  //   dil tuşlarından iriydi (47,2'ye karşı 44) ve turuncusu alttaki
  //   kahraman turuncusuyla aynı olduğu için göz "taşmış" diye okuyor.
  dene('★ üst menüdeki birincil düğme dil tuşlarıyla AYNI boyda', () => {
    const sapan = olculer.filter(o => o.menu).filter(o =>
      Math.abs(o.menu.dugme.yuk - o.menu.dil.yuk) > 1 ||
      Math.abs(o.menu.dugme.ust - o.menu.dil.ust) > 1 ||
      Math.abs(o.menu.dugme.alt - o.menu.dil.alt) > 1)
      .map(o => o.W + ': düğme ' + JSON.stringify(o.menu.dugme) +
                ', dil ' + JSON.stringify(o.menu.dil));
    assert.deepStrictEqual(sapan, [],
      'üst menüdeki düğme dil tuşlarıyla aynı boyda değil:\n    ' + sapan.join('\n    '));
  });
  dene('üst menü düğmesi 44 px dokunma hedefini koruyor', () => {
    olculer.filter(o => o.menu).forEach(o => {
      assert.ok(o.menu.dugme.yuk >= 44,
        o.W + ': düğme ' + o.menu.dugme.yuk + ' px — parmak hedefi küçüldü');
    });
  });

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  await tarayici.close();
  await new Promise(r => sunucu.close(r));
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
