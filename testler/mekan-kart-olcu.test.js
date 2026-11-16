// MEKAN KARTLARI AYNI BOYDA KALSIN.
//
// NEDEN BU TEST VAR
//   Kullanici bildirdi: "mekanlar sayfasinda izin notu eklenirse yine
//   kutu buyuyor. Bu kutular da sabit buyuklukte olmali."
//
//   14 Kasim 2026'da `.mk-foy` 132 pikselle sinirlandi ama KARTIN
//   KENDISI sinirsiz kaldi. 16 Kasim 2026'da olculdu: kartlar 189 ile
//   495 piksel arasinda degisiyordu, fark 233 piksel.
//
//   ⛔ Izgarada daha kotusu vardi: tek bir uzun kart BUTUN SATIRI
//      geriyordu, yani kisa notlu bir mekanin karti da 422 piksel
//      oluyordu. Kullanicinin gordugu buydu.
//
// NE OLCUYOR
//   Icerigi FARKLI bes mekan koyup butun kartlarin AYNI yukseklikte
//   oldugunu olcuyor. Degiskeni yaratan dort sey ayri ayri temsil
//   ediliyor: uzun ad (satir sarar), uzun adres, rozet sayisi, ve
//   foyun olup olmamasi.
//
//   Ayrica: her kartta EN FAZLA BIR "Devami" dugmesi. Dugme cizimden
//   sonra ekleniyor ve "zaten var mi" diye bakmiyordu; liste ayni
//   karede iki kez cizilince iki dugme olusuyordu ve foyden ~25
//   piksel calimiyordu. 16 Kasim 2026'da ekran goruntusunde gorundu.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const PORT = 8129;           // ⛔ 8097-8099 kosucunun; asla kullanma
const KOK = path.join(__dirname, '..');

const UZUN = 'Burada cekim yapmak icin once muduriyetten yazili izin ' +
             'alinmasi gerekiyor. Basvuru en az on gun once yapilmali, ' +
             'dilekce ekine kimlik fotokopisi konulmali.';

// Degiskeni yaratan her sey temsil ediliyor.
const MEKANLAR = [
  { id: 'k1', name: 'Kisa', city: 'Istanbul', district: 'Fatih' },
  { id: 'k2', name: 'Izin notu olan', city: 'Istanbul', district: 'Fatih',
    permission: UZUN },
  { id: 'k3', name: 'Izin ve dikkat', city: 'Izmir', district: 'Konak',
    permission: UZUN, cautions: UZUN },
  { id: 'k4', name: 'Cok uzun adi olan bir mekan ornegi burada duruyor ve satira sariyor',
    city: 'Ankara', district: 'Cankaya',
    address: 'Cok uzun bir adres satiri burada duruyor, numara 12/B blok kat 3',
    permission: UZUN, cautions: UZUN, notes: UZUN },
  { id: 'k5', name: 'Yalniz not', city: 'Bursa', district: 'Osmangazi',
    notes: UZUN },
];

const GENISLIKLER = [1280, 1024, 390];

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
        u === '.js' ? 'text/javascript' : 'application/octet-stream' });
      cevap.end(veri);
    });
  });
  await new Promise(r => sunucu.listen(PORT, r));
  const tarayici = await chromium.launch();

  for (const genislik of GENISLIKLER) {
    const p = await tarayici.newPage({ ...devices['iPhone 13'],
                                       viewport: { width: genislik, height: 900 },
                                       isMobile: genislik < 700 });
    await p.goto('http://localhost:' + PORT + '/app.html');
    await p.waitForFunction(() => typeof renderMekanlar === 'function', { timeout: 30000 });
    await p.waitForTimeout(500);

    const olcum = await p.evaluate((liste) => {
      document.querySelectorAll('.overlay.open').forEach(e => e.classList.remove('open'));
      mekanlar = liste;
      document.getElementById('tabPlaces').click();
      renderMekanlar();
      return new Promise(cz => requestAnimationFrame(() => requestAnimationFrame(() => {
        const k = [...document.querySelectorAll('.mk-kart')];
        cz({
          sayi: k.length,
          yukseklikler: k.map(e => Math.round(e.getBoundingClientRect().height)),
          // Kartin KENDI icerigi tasiyor mu (kirpilma degil, TASMA)
          tasan: k.filter(e => e.scrollHeight > e.clientHeight + 1).length,
          dugmeler: k.map(e => e.querySelectorAll('.mk-devam').length),
          foyVarKart: k.filter(e => e.querySelector('.mk-foy')).length,
        });
      })));
    }, MEKANLAR);

    dene(genislik + 'px: bes kart cizildi', () => {
      assert.strictEqual(olcum.sayi, 5, olcum.sayi + ' kart cizildi, 5 bekleniyordu');
    });

    dene(genislik + 'px: ★ butun kartlar AYNI yukseklikte', () => {
      const enAz = Math.min(...olcum.yukseklikler);
      const enCok = Math.max(...olcum.yukseklikler);
      assert.strictEqual(enCok - enAz, 0,
        'kartlar ' + enAz + ' ile ' + enCok + ' piksel arasinda degisiyor ' +
        '(fark ' + (enCok - enAz) + 'px). Icerik kutuyu buyutuyor.\n' +
        '  olculen: ' + JSON.stringify(olcum.yukseklikler));
    });

    dene(genislik + 'px: kartin kendi icerigi tasmiyor', () => {
      assert.strictEqual(olcum.tasan, 0,
        olcum.tasan + ' kartta icerik kutunun disina tasiyor');
    });

    dene(genislik + 'px: ★ her kartta EN FAZLA BIR "Devami" dugmesi', () => {
      const fazla = olcum.dugmeler.filter(n => n > 1);
      assert.deepStrictEqual(fazla, [],
        'bir kartta ' + fazla.join(', ') + ' dugme var. Cizim iki kez ' +
        'kosulunca ikinci dugme ekleniyor ve foyden yer caliyor.');
    });

    dene(genislik + 'px: foy gercekten ciziliyor (test bos degil)', () => {
      assert.ok(olcum.foyVarKart >= 3,
        'en az uc kartta foy beklenir, ' + olcum.foyVarKart + ' var');
    });

    await p.close();
  }

  // ── Foy acilinca kart BUYUYOR: kullanici bilerek acti ─────────────
  const p = await tarayici.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('http://localhost:' + PORT + '/app.html');
  await p.waitForFunction(() => typeof renderMekanlar === 'function', { timeout: 30000 });
  await p.waitForTimeout(500);
  const acilma = await p.evaluate((liste) => {
    document.querySelectorAll('.overlay.open').forEach(e => e.classList.remove('open'));
    mekanlar = liste;
    document.getElementById('tabPlaces').click();
    renderMekanlar();
    return new Promise(cz => requestAnimationFrame(() => requestAnimationFrame(() => {
      const dug = document.querySelector('.mk-devam');
      if (!dug) return cz({ dugmeVar: false });
      const kart = dug.closest('.mk-kart');
      const once = Math.round(kart.getBoundingClientRect().height);
      dug.click();
      requestAnimationFrame(() => cz({
        dugmeVar: true, once,
        sonra: Math.round(kart.getBoundingClientRect().height),
      }));
    })));
  }, MEKANLAR);

  dene('"Devami" dugmesi tasan kartta var', () => {
    assert.ok(acilma.dugmeVar, 'hicbir kartta dugme yok: tasma hic olusmamis');
  });
  dene('acilinca kart BUYUYOR (kirpilmiyor)', () => {
    assert.ok(acilma.sonra > acilma.once,
      'acildiktan sonra kart buyumedi: ' + acilma.once + ' -> ' + acilma.sonra);
  });
  await p.close();

  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
