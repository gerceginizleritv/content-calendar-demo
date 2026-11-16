// SEKME ADLARI DUGMESININ DISINA TASMASIN.
//
// NEDEN BU TEST VAR
//   16 Kasim 2026'da 9. madde geregi menunun en uzun adi degisti:
//   "Malzeme" (7 harf) -> "Cekim Setleri" (13 harf). Yedi sekmenin
//   en uzunu artik bu; oncesinde "Sablonlar" (9) idi.
//
//   ⛔ ARIZA KIPI KIRPILMA DEGIL, SATIRA SARMA. 16 Kasim 2026'da
//      olculdu; ilk iki tahmin de yanlis cikti:
//        1. "Ellipsis kirpar" -- HAYIR. `white-space` hesaplanan
//           degeri `normal`: yazi kirpilmaya sira gelmeden SARIYOR.
//        2. "Inline kutuda overflow etkisiz, disa tasar" -- HAYIR.
//           `.rail-nav .tab` bir flex kabi; flex ogesi BLOKLASIYOR,
//           yani 3748. satirdaki `display:inline` hesaplanirken
//           `block` oluyor ve 1958. satirdaki overflow/ellipsis
//           kurali uyguluyor. Zaten sarma yuzunden hic devreye girmez.
//      Olcum (320px, TR kisa adi bilerek "Cekim Setleri" yapildi):
//      o etiket 22,8 piksel yani IKI SATIR, oteki alti 11,4 yani tek
//      satir. Fazla uzun bir ad sekmeyi ikiye bolup cubugu bozuyor --
//      gorunen hata bu.
//
//      ⚠ Bu yuzden ANA OLCU "tek satirda mi". Tasma ve cakisma
//      kontrolleri de duruyor ama ikincil: sarma onlardan ONCE
//      devreye giriyor.
//
//   Bu deponun tekrarlayan hatasi: marka adi ust seritte UC KEZ
//   kirpildi (13 ve 16 Kasim 2026) cunku kimse olcmemisti. Menu adi
//   da ayni seride bakiyor. Bu test olcuyor.
//
// NE OLCUYOR — her genislikte, HER IKI DILDE:
//   1. Gorunur etiket KENDI dugmesinin ic kutusunda kaliyor mu.
//   2. Iki komsu etiket ust uste biniyor mu.
//   3. Sayfa yatayda kayiyor mu.
//   4. Dogru bicim gorunuyor mu: genis ekranda uzun ad, dar ekranda
//      kisa ad. (Ikisi yer degistirse olcum sessizce kolaylasirdi.)
//   5. Adlar BEKLENEN metin mi — sessiz bir geri alma kirmizi yansin.
//
// ⚠ ADLAR DEGISIRSE asagidaki BEKLENEN tablosu da degisecek. Tablo
//   testin kendi olcusu degil, SOZLESME: "menu adi bu" diyen yer.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const PORT = 8131;           // ⛔ 8097-8099 kosucunun; asla kullanma
const KOK = path.join(__dirname, '..');

// ⛔ ESIK 1023 PIKSEL, 560 DEGIL. `@media(max-width:1023px)` seridi
//   yataya ceviriyor ve ayni blok kisa ada geciyor. Ilk surumde esik
//   560 sanildi; 768 piksel "uzun ad" diye olculdu ve "Cekim Setleri"
//   orada iki satira sardi. Olcum: 701-980 arasi sariyordu.
// ⚠ 820/860/900/980 BILEREK LISTEDE: ilk surumde bu aralikta yalnizca
//   768 ornegi vardi, hata penceresinin tamami gorulmedi.
const GENIS = [1280, 1100, 1024];                      // uzun ad (dikey serit)
const DAR   = [1023, 980, 900, 860, 820, 768, 700, 640, 561,  // kisa ad (yatay serit)
               430, 390, 360, 320];                           // kisa ad (telefon)

// 9. maddenin sozlesmesi. Uzun ad = .tab-ad, kisa ad = .tab-ad-k.
const BEKLENEN = {
  en: { uzun: 'Shoot kits',    kisa: 'Kit' },
  tr: { uzun: 'Çekim Setleri', kisa: 'Set' },
};

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

  // Tek sayfada dil ve genislik degistirip olcuyoruz: her kombinasyon
  // icin yeni tarayici acmak 24 kez chromium baslatmak demekti.
  async function olc(sayfa, dil) {
    return await sayfa.evaluate((d) => {
      // Acilis perdeleri olcumun onunu kapatiyor.
      document.querySelectorAll('.overlay.open').forEach(e => e.classList.remove('open'));
      setLanguage(d);
      const ic = (el) => {
        const b = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return {
          sol: b.left + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth),
          sag: b.right - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth),
          disSol: b.left, disSag: b.right,
        };
      };
      const gorunur = (el) => el && getComputedStyle(el).display !== 'none'
                            && el.getBoundingClientRect().width > 0;
      // Satir sayisi: elemanin KUTUSUNA degil YAZININ satir kutularina
      // bakiyor. Range her satir icin bir dikdortgen veriyor, yani
      // display'in block mu inline mi oldugundan etkilenmiyor.
      const satirSayisi = (el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        const ust = new Set(Array.from(r.getClientRects())
                                 .filter(k => k.width > 0 && k.height > 0)
                                 .map(k => Math.round(k.top)));
        return ust.size;
      };

      const satirlar = [];
      document.querySelectorAll('.rail-nav .tab').forEach(tab => {
        const uzun = tab.querySelector('.tab-ad');
        const kisa = tab.querySelector('.tab-ad-k');
        const et = gorunur(uzun) ? uzun : (gorunur(kisa) ? kisa : null);
        if (!et) { satirlar.push({ id: tab.id, etiketYok: true }); return; }
        const e = et.getBoundingClientRect();
        const k = ic(tab);
        satirlar.push({
          id: tab.id,
          hangi: et.classList.contains('tab-ad') ? 'uzun' : 'kisa',
          yazi: et.textContent.trim(),
          // ⚠ IKI AYRI KENAR OLCULUYOR, iddia DIS kenara dayaniyor.
          //   ic kutu (content box): dolgunun BASLADIGI yer. Flex
          //     dugmeyi kisinca yazi dolguya tasiyor -- bu NORMAL,
          //     dolgu tam bu pay icin var. Ilk surumde iddia buraya
          //     dayandi ve 768 pikselde "Templates", "Sablonlar",
          //     "Mekanlar" icin kirmizi yandi: ucu de 9. maddeden
          //     ONCE de oyleydi, yani test var olmayan bir hatayi
          //     bildiriyordu.
          //   dis kutu (border box): dugmenin GORUNEN kenari. Yazi
          //     buradan tasarsa kullanici gercekten dugmenin disinda
          //     yazi gorur. Iddia bunda.
          sagTasma: Math.round((e.right - k.sag) * 10) / 10,
          solTasma: Math.round((k.sol - e.left) * 10) / 10,
          sagTasmaDis: Math.round((e.right - k.disSag) * 10) / 10,
          solTasmaDis: Math.round((k.disSol - e.left) * 10) / 10,
          satir: satirSayisi(et),
          sol: e.left, sag: e.right,
          // Iki bicim birden gorunmemeli.
          ikisiBirden: gorunur(uzun) && gorunur(kisa),
        });
      });

      return {
        satirlar,
        kitUzun: (document.querySelector('#tabKit .tab-ad') || {}).textContent,
        kitKisa: (document.querySelector('#tabKit .tab-ad-k') || {}).textContent,
        // Serit kipi: ≤900 pikselde yan menu ustte YATAY bir cubuga
        // donuyor, ≤560'ta da satir kipi var. Cakisma olcumu yalnizca
        // yatay dizilimde anlamli; dikeyde dugmeler alt alta ve hepsi
        // ayni yatay araligi paylasiyor (ilk surumde bu atlandi ve
        // test kendi kendine kirmizi yandi).
        navYonu: getComputedStyle(document.querySelector('.rail-nav')).flexDirection,
        yatayKayma: document.documentElement.scrollWidth
                  - document.documentElement.clientWidth,
      };
    }, dil);
  }

  function kontroller(etiket, r, beklenenBicim, dil) {
    dene(etiket + ': yedi sekme olculdu', () => {
      assert.strictEqual(r.satirlar.length, 7,
        r.satirlar.length + ' sekme bulundu, 7 bekleniyordu');
      assert.deepStrictEqual(r.satirlar.filter(s => s.etiketYok).map(s => s.id), [],
        'bu sekmelerin hicbir etiketi gorunmuyor');
    });

    dene(etiket + ': ★ etiket TEK SATIRDA duruyor', () => {
      const saran = r.satirlar.filter(s => !s.etiketYok && s.satir > 1)
                              .map(s => s.id + ' ("' + s.yazi + '") ' + s.satir + ' satir');
      assert.deepStrictEqual(saran, [],
        'Bu etiket(ler) satira sariyor:\n    ' + saran.join('\n    ') +
        '\n  `white-space` degeri `normal`: fazla uzun ad kirpilmaz, SARAR\n' +
        '  ve o sekme ikiye bolunup cubugu bozar. Dar ekran icin\n' +
        '  `tab_*_k` kisa bicimi tam bu ise yariyor.');
    });

    dene(etiket + ': etiket dugmenin DISINA tasmiyor', () => {
      const tasan = r.satirlar
        .filter(s => !s.etiketYok && (s.sagTasmaDis > 0.5 || s.solTasmaDis > 0.5))
        .map(s => s.id + ' ("' + s.yazi + '") dis kenardan sag+' + s.sagTasmaDis +
                  ' sol+' + s.solTasmaDis + '  (ic kenar sag+' + s.sagTasma + ')');
      assert.deepStrictEqual(tasan, [],
        'Etiket dugmesinin ic kutusundan tasiyor. Sekme etiketinde\n' +
        '  ellipsis YOK (inline kutuda overflow:hidden etkisiz), yani bu\n' +
        '  tasma komsu sekmenin uzerine biner:\n    ' + tasan.join('\n    '));
    });

    if (r.navYonu === 'row') dene(etiket + ': iki komsu etiket ust uste binmiyor', () => {
      const dizi = r.satirlar.filter(s => !s.etiketYok)
                             .slice().sort((a, b) => a.sol - b.sol);
      const binen = [];
      for (let i = 1; i < dizi.length; i++) {
        if (dizi[i].sol < dizi[i - 1].sag - 0.5) {
          binen.push(dizi[i - 1].id + ' / ' + dizi[i].id);
        }
      }
      assert.deepStrictEqual(binen, [], 'bu etiketler cakisiyor: ' + binen.join(', '));
    });

    dene(etiket + ': sayfa yatayda kaymiyor', () => {
      assert.ok(r.yatayKayma <= 1,
        'sayfa ' + r.yatayKayma + ' piksel yana kayiyor');
    });

    dene(etiket + ': ' + beklenenBicim + ' bicim gorunuyor', () => {
      const yanlis = r.satirlar.filter(s => !s.etiketYok && s.hangi !== beklenenBicim)
                               .map(s => s.id + '=' + s.hangi);
      assert.deepStrictEqual(yanlis, [],
        beklenenBicim + ' bicim beklenirken: ' + yanlis.join(', ') +
        '\n  Iki bicim yer degistirse olcum sessizce kolaylasirdi.');
      const ikisi = r.satirlar.filter(s => s.ikisiBirden).map(s => s.id);
      assert.deepStrictEqual(ikisi, [], 'bu sekmelerde iki bicim BIRDEN gorunuyor');
    });

    dene(etiket + ': ★ "Cekim Setleri" sozlesmesi duruyor (' + dil + ')', () => {
      assert.strictEqual((r.kitUzun || '').trim(), BEKLENEN[dil].uzun,
        'uzun ad degismis. 9. maddenin karari: ' + BEKLENEN[dil].uzun);
      assert.strictEqual((r.kitKisa || '').trim(), BEKLENEN[dil].kisa,
        'kisa ad degismis. Dar ekranda 9,5 piksel yaziyla cizilen bicim ' +
        'KISA kalmak zorunda: ' + BEKLENEN[dil].kisa);
    });
  }

  for (const [kip, genislikler, bicim] of
       [['serit', GENIS, 'uzun'], ['satir', DAR, 'kisa']]) {
    for (const w of genislikler) {
      // ⛔ CIHAZ SECIMI GENISLIGE GORE, kipe gore DEGIL. Telefon
      //   kullanici-etmeni tablet genisligine verilince uygulama mobil
      //   koduna dusuyor ve sayfa yana kayiyor: ilk surumde 768
      //   pikselde tam bu oldu, "62 piksel kayma" diye kirmizi yandi
      //   ve olculdu ki duz masaustu baglaminda kayma SIFIR. O kirmizi
      //   uygulamanin degil TESTIN hatasiydi.
      const p = await tarayici.newPage(w < 561
        ? { ...devices['iPhone 13'], viewport: { width: w, height: 820 } }
        : { viewport: { width: w, height: 820 } });
      await p.goto('http://localhost:' + PORT + '/app.html');
      await p.waitForFunction(() => typeof setLanguage === 'function', { timeout: 30000 });
      await p.waitForTimeout(500);
      for (const dil of ['en', 'tr']) {
        const r = await olc(p, dil);
        kontroller(w + 'px ' + dil + ' [' + kip + ']', r, bicim, dil);
      }
      await p.close();
    }
  }

  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
