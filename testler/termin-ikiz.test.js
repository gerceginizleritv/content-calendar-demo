// TERMİN HESABININ İKİ KOPYASI AYRIŞMASIN.
//
// NEDEN BU TEST VAR
//   Hatırlatma terminleri İKİ yerde hesaplanıyor:
//     1. app.html  -> hatirlatilacaklar() / hatirlatmaSecili()
//     2. supabase/functions/push-gonder/terminler.ts
//
//   İkisi olmak zorunda (16 Kasım 2026 kararı): tarayıcı internetsizken
//   ve hesapsız kullanıcıda da hatırlatma göstermeli, sunucu ise
//   kullanıcı uygulamayı hiç açmasa bile bildirimi göndermeli.
//
//   ⛔ Bu depo "iki kopya sessizce ayrıştı" hatasını DEFALARCA yaşadı:
//      otomatik yayın politikası tablosu, palet değerleri, ikon ailesi.
//      Bu test o hatanın push'ta tekrarlanmasını engelliyor.
//
// NE ÖLÇÜYOR
//   Aynı projeler + aynı "bugün" + aynı ayarlar -> aynı sonuç.
//   Saat dilimi BİLEREK dışarıda: "bugün"ü ikisine de elle veriyoruz,
//   böylece ölçülen şey KURAL, takvim değil. Saat dilimi ayrı test
//   ediliyor (aşağıda, son bölüm).

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const { chromium } = require('playwright');

const PORT = 8104;            // ⛔ 8097-8099 koşucunun; asla kullanma
const KOK = path.join(__dirname, '..');

// ── Sunucu kopyasını Node'a yükle ───────────────────────────────────
function sunucuKopyasi() {
  const dosya = path.join(KOK, 'supabase', 'functions', 'push-gonder', 'terminler.ts');
  let kod = fs.readFileSync(dosya, 'utf8');
  kod = kod
    .replace(/^export\s+(interface|type)[\s\S]*?^\}/gm, '')
    .replace(/^export\s+type[^\n]*\n/gm, '')
    .replace(/\s+as\s+const/g, '')
    .replace(/:\s*(Cins\s*\|\s*''|Cins|Termin\[\]|Ayarlar|ProjeSatiri\[\]|string\s*\|\s*null\s*\|\s*undefined|string\s*\|\s*null|string|number|boolean|Date)/g, '')
    .replace(/([A-Za-z_$][\w$]*)\?(\s*[,:)])/g, '$1$2')
    .replace(/\bexport\s+/g, '');
  const kapsam = { Intl, Date, String, Number, Math, JSON, console };
  kapsam.disari = {};
  vm.createContext(kapsam);
  vm.runInContext(kod +
    '\n;disari.hatirlatilacaklar = hatirlatilacaklar;' +
    'disari.hatirlatmaSecili = hatirlatmaSecili;' +
    'disari.gunEkleKey = gunEkleKey;' +
    'disari.bugunKey = bugunKey;', kapsam);
  return kapsam.disari;
}

// ── Örnek projeler ──────────────────────────────────────────────────
// Tek tanımdan İKİ biçim üretiliyor: tarayıcının kullandığı biçim ve
// veritabanı satırı biçimi. projToRow'un yaptığı eşleme bu.
function ornekler(dun, bugun, yarin, obur) {
  return [
    { id: 'p1', name: 'Bergama', cancelled: false,
      adimlar: { script: false, filmed: false },
      tarihler: { script: dun, filmed: bugun } },

    { id: 'p2', name: 'Efes', cancelled: false,
      adimlar: { audio: false, edited: true },
      tarihler: { audio: yarin, edited: bugun } },      // edited BİTMİŞ: sayılmaz

    { id: 'p3', name: 'Iptal edilmis', cancelled: true,
      adimlar: { script: false },
      tarihler: { script: bugun } },                     // iptal: sayılmaz

    { id: 'p4', name: 'Uzak tarih', cancelled: false,
      adimlar: { approved: false },
      tarihler: { approved: obur } },                    // ne bugün ne yarın

    { id: 'p5', name: 'Tarihsiz', cancelled: false,
      adimlar: { package: false },
      tarihler: { package: '' } },                       // tarih yok

    { id: 'p6', name: 'Cok eski', cancelled: false,
      adimlar: { published: false },
      tarihler: { published: '2020-01-01' } },           // çok gecikmiş
  ];
}
const ADIMLAR = ['script','filmed','audio','edited','approved','package','published'];

function tarayiciBicimi(o) {
  const p = { id: o.id, name: o.name, cancelled: o.cancelled, deadlines: {} };
  ADIMLAR.forEach(k => { p[k] = o.adimlar[k] === true; });
  ADIMLAR.forEach(k => { p.deadlines[k] = o.tarihler[k] || ''; });
  return p;
}
function satirBicimi(o) {
  const steps = {}, deadlines = {};
  ADIMLAR.forEach(k => { steps[k] = o.adimlar[k] === true; });
  ADIMLAR.forEach(k => { deadlines[k] = o.tarihler[k] || ''; });
  return { id: o.id, name: o.name, cancelled: o.cancelled, steps, deadlines };
}

// Karşılaştırılabilir hâle getir: sıralama farkı hata sayılmasın.
//
// ⚠ Array.from ŞART. Sunucu kopyası vm içinde koşuyor ve oranın kendi
// Array'i var; deepStrictEqual prototipe de baktığı için aynı içerik
// "farklı" sayılıyordu. 16 Kasım 2026'da tam bu oldu: sekiz test
// kırmızı yandı, oysa iki taraf da birebir aynı listeyi veriyordu.
function duzle(liste) {
  return Array.from(liste, x => [x.projeId, x.adim, x.tarih, x.cins].join('|')).sort();
}

(async () => {
  const S = sunucuKopyasi();
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
      const uzanti = path.extname(dosya);
      cevap.writeHead(200, { 'Content-Type':
        uzanti === '.html' ? 'text/html; charset=utf-8' :
        uzanti === '.js' ? 'text/javascript' :
        uzanti === '.json' ? 'application/json' : 'application/octet-stream' });
      cevap.end(veri);
    });
  });
  await new Promise(r => sunucu.listen(PORT, r));

  const tarayici = await chromium.launch();
  const sayfa = await tarayici.newPage();
  await sayfa.goto('http://localhost:' + PORT + '/app.html');
  await sayfa.waitForFunction(() => typeof window.hatirlatilacaklar === 'function', { timeout: 30000 });

  // "Bugün"ü tarayıcıdan al: ikisi de AYNI günü kullansın.
  const bugun = await sayfa.evaluate(() => bugunKey());
  const dun   = S.gunEkleKey(bugun, -1);
  const yarin = S.gunEkleKey(bugun, 1);
  const obur  = S.gunEkleKey(bugun, 2);
  const veri  = ornekler(dun, bugun, yarin, obur);

  // ── 1. Ayarlardan bagimsiz liste ──────────────────────────────────
  const tarayiciHam = await sayfa.evaluate((p) => {
    projects = p;
    return hatirlatilacaklar().map(x => ({
      projeId: x.p.id, adim: x.k, tarih: x.d, cins: x.cins,
    }));
  }, veri.map(tarayiciBicimi));
  const sunucuHam = S.hatirlatilacaklar(veri.map(satirBicimi), bugun);

  dene('hatirlatilacaklar(): iki kopya AYNI sonucu veriyor', () => {
    assert.deepStrictEqual(duzle(sunucuHam), duzle(tarayiciHam),
      '\n  tarayici: ' + JSON.stringify(duzle(tarayiciHam), null, 1) +
      '\n  sunucu  : ' + JSON.stringify(duzle(sunucuHam), null, 1));
  });
  dene('liste bos degil (test gercekten bir sey olcuyor)', () => {
    assert.ok(sunucuHam.length >= 4,
      'en az 4 termin beklenir, su an ' + sunucuHam.length);
  });

  // ── 2. Her ayar birlesimi icin ────────────────────────────────────
  const birlesimler = [
    { gecikti: true,  gun: true,  once: true  },
    { gecikti: false, gun: true,  once: true  },
    { gecikti: true,  gun: false, once: true  },
    { gecikti: true,  gun: true,  once: false },
    { gecikti: false, gun: false, once: false },
    { gecikti: true,  gun: false, once: false },
  ];
  for (const ayar of birlesimler) {
    const tHam = await sayfa.evaluate(({ p, a }) => {
      projects = p;
      hatirlatma = Object.assign({}, hatirlatma, a);
      return hatirlatmaSecili().map(x => ({
        projeId: x.p.id, adim: x.k, tarih: x.d, cins: x.cins,
      }));
    }, { p: veri.map(tarayiciBicimi), a: ayar });
    const sHam = S.hatirlatmaSecili(veri.map(satirBicimi), bugun, ayar);
    dene('hatirlatmaSecili() ayni: ' + JSON.stringify(ayar), () => {
      assert.deepStrictEqual(duzle(sHam), duzle(tHam),
        '\n  tarayici: ' + JSON.stringify(duzle(tHam)) +
        '\n  sunucu  : ' + JSON.stringify(duzle(sHam)));
    });
  }

  // ── 3. Adim listesi ayni mi ───────────────────────────────────────
  const tarayiciAdimlar = await sayfa.evaluate(() => PROJ_STEPS.slice());
  // Her adima BUGUN tarihi verilip hangilerinin geri geldigine bakiliyor:
  // sunucu bir adimi tanimiyorsa o adim listede cikmaz.
  const sunucuAdimlar = Array.from(
    S.hatirlatilacaklar(
      [{ id: 'x', steps: {}, deadlines:
          Object.fromEntries(tarayiciAdimlar.map(k => [k, bugun])) }], bugun),
    x => x.adim).sort();
  dene('PROJ_STEPS ile PROJE_ADIMLARI birebir ayni', () => {
    assert.deepStrictEqual(sunucuAdimlar, tarayiciAdimlar.slice().sort(),
      '\n  tarayici: ' + JSON.stringify(tarayiciAdimlar.slice().sort()) +
      '\n  sunucu  : ' + JSON.stringify(sunucuAdimlar));
  });

  // ── 4. Saat dilimi: gun kullanicinin diliminde hesaplaniyor ───────
  dene('bugunKey saat dilimini dikkate aliyor', () => {
    // 2026-03-01 00:30 UTC: Istanbul'da (UTC+3) gun 1 Mart,
    // Los Angeles'ta (UTC-8) hala 28 Subat.
    const an = new Date('2026-03-01T00:30:00Z');
    assert.strictEqual(S.bugunKey('Europe/Istanbul', an), '2026-03-01');
    assert.strictEqual(S.bugunKey('America/Los_Angeles', an), '2026-02-28');
    assert.strictEqual(S.bugunKey('UTC', an), '2026-03-01');
  });
  dene('gecersiz saat dilimi UTC\'ye dusuyor, catlamiyor', () => {
    const an = new Date('2026-03-01T00:30:00Z');
    assert.strictEqual(S.bugunKey('Boyle/Bir_Yer_Yok', an), '2026-03-01');
    assert.strictEqual(S.bugunKey(null, an), '2026-03-01');
  });

  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
