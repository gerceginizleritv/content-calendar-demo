// KILAVUZDA OKUNAN BOLUM SOL MENUDE ISARETLI KALSIN — HER DILDE.
//
// NEDEN BU TEST VAR
//   Kullanici 16 Kasim 2026'da sordu: "kilavuz sayfasinda Turkce'de
//   okumaya basladigim bolum sol taraftaki menude highlight ediliyor…
//   Ingilizce de yok. Diger diller eklenince olmasi lazim."
//
//   ⚠ OLCULDU: Ingilizce'de DE CALISIYOR. Masaustunde ve telefonda
//     alti bolum tek tek kaydirildi, ikisinde de dogru baglanti
//     isaretlendi; canli sitede de kod duruyor. Iki dosya arasindaki
//     tek fark bir YORUM satiri. Yani ortada eksik bir ozellik yoktu.
//
//   Test yine de yazildi, cunku istegin ASIL yari ileriye donuk:
//   41. madde alti yeni dil getiriyor ve her dilin kilavuzu AYRI BIR
//   DOSYA olacak. Bu deponun tekrarlayan hatasi tam bu: bir yerde
//   yapilip otekilerde unutulmak (otomatik yayin tablosu, palet,
//   ikon ailesi, hesap silme listesi, yatay yaylanma korumasi).
//   Yeni bir kilavuz dosyasi vurgusuz eklenirse burada kirmizi yanar.
//
// ⛔ KILAVUZ LISTESI SABIT YAZILMADI. Test depodaki butun .html
//    dosyalarini tariyor ve icinde `id="yanMenu"` gecenleri kilavuz
//    sayar. Yeni dilin kilavuzu kendiliginden denetime girer; tek
//    satir degisiklik gerekmiyor.
//
// NE OLCUYOR — her kilavuz dosyasinda:
//   1. Sol menudeki her baglantinin karsiligi bir bolum var mi
//      (olu baglanti = tiklayinca hicbir yere gitmez)
//   2. Her bolume kaydirildiginda O bolumun baglantisi isaretleniyor mu
//   3. Isaret GORUNUR mu (arka plan gercekten degisiyor mu) — sinif
//      eklenip CSS'i unutulursa kod "calisiyor" ama kimse gormez
//   4. Ayni anda tek bir baglanti isaretli mi
//   5. Telefon genisliginde ustteki serit de isaretleniyor mu

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const PORT = 8143;           // ⛔ 8097-8099 kosucunun; asla kullanma
const KOK = path.join(__dirname, '..');

(async () => {
  let gecti = 0; const hatalar = [];
  const dene = (ad, fn) => {
    try { fn(); gecti++; console.log('  ok  ' + ad); }
    catch (e) { hatalar.push(ad); console.log('  HATA ' + ad + ': ' + e.message); }
  };

  // Kilavuzlar BULUNUYOR, listelenmiyor.
  const KILAVUZLAR = fs.readdirSync(KOK)
    .filter(f => f.endsWith('.html') && !f.startsWith('.'))
    .filter(f => fs.readFileSync(path.join(KOK, f), 'utf8').includes('id="yanMenu"'));

  dene('★ bekçi: en az iki kılavuz bulundu (boş tarama değil)', () => {
    assert.ok(KILAVUZLAR.length >= 2,
      'id="yanMenu" taşıyan ' + KILAVUZLAR.length + ' dosya bulundu, en az 2 bekleniyordu.\n' +
      '  Bulunanlar: ' + (KILAVUZLAR.join(', ') || '(hiç)') +
      '\n  ⛔ Hiç bulunmazsa test sessizce yeşil yanar ve hiçbir şey denetlemez.');
  });

  const sunucu = http.createServer((istek, cevap) => {
    const yol = istek.url.split('?')[0];
    const dosya = path.join(KOK, yol === '/' ? 'index.html' : yol.slice(1));
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

  async function olc(sayfa, mobilMi) {
    return await sayfa.evaluate(async (mobil) => {
      const bekle = ms => new Promise(r => setTimeout(r, ms));
      const secici = mobil ? '#mobMenu a' : '#yanMenu a';
      const baglar = [...document.querySelectorAll(secici)];
      const bolumler = [...document.querySelectorAll('.bolum')];
      const kimlikler = new Set(bolumler.map(b => b.id));

      // Olu baglanti: menude var, karsiligi yok.
      const olu = baglar.map(a => a.getAttribute('href'))
                        .filter(h => h && h.startsWith('#'))
                        .filter(h => !kimlikler.has(h.slice(1)));

      const adimlar = [];
      for (const b of bolumler) {
        b.scrollIntoView({ block: 'start' });
        await bekle(320);
        const acik = [...document.querySelectorAll(secici + '.acik')];
        adimlar.push({
          bolum: b.id,
          isaretli: acik.map(a => a.getAttribute('href')),
          // Isaret GORUNUR mu: isaretli baglantinin arka plani,
          // isaretsiz bir baglantininkinden farkli olmali.
          gorunur: (() => {
            if (!acik.length) return false;
            const digeri = baglar.find(a => !a.classList.contains('acik'));
            if (!digeri) return true;
            const a = getComputedStyle(acik[0]), d = getComputedStyle(digeri);
            return a.backgroundColor !== d.backgroundColor
                || a.color !== d.color
                || a.fontWeight !== d.fontWeight;
          })(),
        });
      }
      return { olu, adimlar, bagSayi: baglar.length, bolumSayi: bolumler.length };
    }, mobilMi);
  }

  for (const dosya of KILAVUZLAR) {
    for (const [kip, mobil] of [['masaüstü', false], ['telefon', true]]) {
      const p = await tarayici.newPage(mobil
        ? { ...devices['iPhone 13'] }
        : { viewport: { width: 1280, height: 900 } });
      const sayfaHatalari = [];
      p.on('pageerror', e => sayfaHatalari.push(String(e).slice(0, 140)));
      await p.goto('http://localhost:' + PORT + '/' + dosya, { waitUntil: 'load' });
      await p.waitForTimeout(600);
      const r = await olc(p, mobil);
      const etiket = dosya + ' [' + kip + ']';

      dene(etiket + ': sayfada JS hatası yok', () => {
        assert.deepStrictEqual(sayfaHatalari, [],
          'Sayfa hatası vurguyu sessizce öldürür:\n    ' + sayfaHatalari.join('\n    '));
      });

      dene(etiket + ': bekçi — menü ve bölümler dolu', () => {
        assert.ok(r.bagSayi >= 10, r.bagSayi + ' menü bağlantısı bulundu, 10+ bekleniyordu');
        assert.ok(r.bolumSayi >= 10, r.bolumSayi + ' bölüm bulundu, 10+ bekleniyordu');
      });

      dene(etiket + ': ölü menü bağlantısı yok', () => {
        assert.deepStrictEqual(r.olu, [],
          'Bu bağlantıların karşılığı olan bölüm yok — tıklayınca hiçbir yere gitmez:\n    ' +
          r.olu.join('\n    '));
      });

      dene(etiket + ': ★ okunan bölüm menüde işaretleniyor', () => {
        const yanlis = r.adimlar
          .filter(a => !(a.isaretli.length === 1 && a.isaretli[0] === '#' + a.bolum))
          .map(a => '#' + a.bolum + ' okunurken işaretli: ' + (a.isaretli.join(',') || '(HİÇBİRİ)'));
        assert.deepStrictEqual(yanlis, [],
          yanlis.length + ' bölümde işaret yanlış ya da hiç yok:\n    ' +
          yanlis.join('\n    ') +
          '\n  Okuyan kişi menüde nerede olduğunu göremez.');
      });

      dene(etiket + ': ★ işaret GÖRÜNÜR (sınıf var ama CSS yok değil)', () => {
        const gorunmez = r.adimlar.filter(a => a.isaretli.length && !a.gorunur)
                                  .map(a => '#' + a.bolum);
        assert.deepStrictEqual(gorunmez, [],
          'Bu bölümlerde `acik` sınıfı ekleniyor ama görünüm DEĞİŞMİYOR:\n    ' +
          gorunmez.join(', ') +
          '\n  Kod "çalışıyor" ama kimse göremez — CSS kuralı eksik.');
      });

      await p.close();
    }
  }

  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\nKilavuzlar: ' + KILAVUZLAR.join(', '));
  console.log(gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
