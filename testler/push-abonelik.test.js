// PUSH ABONELIGI KAYDEDILIRKEN "BUGUN GONDERILDI" ISARETI SILINMESIN.
//
// NEDEN BU TEST VAR
//   Abonelik ONCE upsert ile yaziliyordu. Upsert satirin TAMAMINI
//   yeniden yazar: verilmeyen sutunlar varsayilanina doner. Yani her
//   kayitta son_gonderim_gunu NULL oluyordu.
//
//   ⛔ SONUCU: uygulama her acildiginda "bugun gonderildi" isareti
//      silinir ve AYNI hatirlatma gun icinde tekrar tekrar gelirdi.
//      Acilista abone olma eklendigi icin bu her gun yasanacakti.
//      16 Kasim 2026'da kullanici fark etti: gonderimden sonra
//      iPhone'un isareti duruyordu, Chrome'unki silinmisti.
//
//   Cozum: ONCE GUNCELLE, satir yoksa EKLE. Guncelleme yalnizca adi
//   gecen sutunlara dokunuyor.
//
// NE OLCUYOR
//   Kaynak metnine BAKMIYOR ("upsert gecmiyor mu" diye aramiyor):
//   sahte bir veritabani istemcisiyle pushAboneOl()'u GERCEKTEN
//   calistirip hangi cagrilarin yapildigini ve gonderilen alanlari
//   olcuyor. upsert'e geri donulurse ya da son_gonderim_gunu
//   gonderilmeye baslanirsa test kirmizi yanar.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8128;           // ⛔ 8097-8099 kosucunun; asla kullanma
const KOK = path.join(__dirname, '..');

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
  const p = await tarayici.newPage();
  await p.goto('http://localhost:' + PORT + '/app.html');
  await p.waitForFunction(() => typeof pushAboneOl === 'function', { timeout: 30000 });

  // Sahte ortam: gercek kod calisiyor, yalnizca disa acilan uclar sahte.
  // satirVar = guncelleme bir satir buldu mu (true: cihaz zaten kayitli).
  const kur = (satirVar) => p.evaluate((varMi) => {
    window.__cagrilar = [];
    session = { user: { id: 'kullanici-1', email: 'a@b.test', user_metadata: {} } };
    bildirimDurumu = () => 'granted';
    pushIosEngeli = () => false;
    vapidAcikOnbellek = 'BSahteAcikAnahtar';

    sb = {
      from(tablo) {
        const kayit = { tablo };
        return {
          update(alanlar) {
            kayit.islem = 'update'; kayit.alanlar = alanlar;
            return {
              eq(sutun, deger) {
                kayit.esle = sutun + '=' + deger;
                return {
                  select() {
                    window.__cagrilar.push(kayit);
                    return Promise.resolve({ data: varMi ? [{ id: 'satir-1' }] : [], error: null });
                  }
                };
              }
            };
          },
          insert(satirlar) {
            kayit.islem = 'insert'; kayit.alanlar = satirlar[0];
            window.__cagrilar.push(kayit);
            return Promise.resolve({ error: null });
          },
          upsert(satirlar, secenek) {
            kayit.islem = 'upsert'; kayit.alanlar = satirlar[0]; kayit.secenek = secenek;
            window.__cagrilar.push(kayit);
            return Promise.resolve({ error: null });
          },
          select() {
            return { eq() { return { maybeSingle(){
              return Promise.resolve({ data: { deger: 'BSahteAcikAnahtar' }, error: null }); } }; } };
          }
        };
      }
    };

    // Service worker ve push yoneticisi sahte.
    const abonelik = {
      endpoint: 'https://push.ornek.test/abc',
      toJSON: () => ({ endpoint: 'https://push.ornek.test/abc',
                       keys: { p256dh: 'pppp', auth: 'aaaa' } })
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      get: () => ({
        ready: Promise.resolve({ pushManager: {
          getSubscription: () => Promise.resolve(abonelik),
          subscribe: () => Promise.resolve(abonelik)
        } }),
        getRegistration: () => Promise.resolve(null)
      })
    });
    window.PushManager = window.PushManager || function(){};
  }, satirVar);

  // ── 1. Cihaz ZATEN kayitli: guncelleme yapilmali ──────────────────
  await kur(true);
  const sonuc1 = await p.evaluate(() => pushAboneOl());
  const cagri1 = await p.evaluate(() => window.__cagrilar);

  dene('kayitli cihaz: abonelik basariyla yazildi', () => {
    assert.strictEqual(sonuc1, 'ok', 'donus "ok" degil: ' + sonuc1);
  });
  dene('★ UPSERT KULLANILMIYOR (satirin tamamini yeniden yazardi)', () => {
    const upsert = cagri1.filter(c => c.islem === 'upsert');
    assert.deepStrictEqual(upsert, [],
      'upsert cagrildi: son_gonderim_gunu silinir ve ayni hatirlatma ' +
      'gun icinde tekrar gelir');
  });
  dene('kayitli cihaz: UPDATE yapiliyor', () => {
    const u = cagri1.find(c => c.tablo === 'push_abonelikleri' && c.islem === 'update');
    assert.ok(u, 'push_abonelikleri uzerinde update yok');
    assert.strictEqual(u.esle, 'endpoint=https://push.ornek.test/abc');
  });
  dene('★ son_gonderim_gunu GONDERILMIYOR', () => {
    for (const c of cagri1) {
      if (c.tablo !== 'push_abonelikleri' || !c.alanlar) continue;
      assert.ok(!('son_gonderim_gunu' in c.alanlar),
        c.islem + ' cagrisi son_gonderim_gunu tasiyor: isaret ezilir');
    }
  });
  dene('kayitli cihazda INSERT YAPILMIYOR', () => {
    assert.strictEqual(cagri1.filter(c => c.islem === 'insert').length, 0,
      'satir varken insert denendi: tekil endpoint kisitina takilir');
  });

  // ── 2. Cihaz YENI: guncelleme bos donunce insert ──────────────────
  await kur(false);
  const sonuc2 = await p.evaluate(() => pushAboneOl());
  const cagri2 = await p.evaluate(() => window.__cagrilar);

  dene('yeni cihaz: abonelik basariyla yazildi', () => {
    assert.strictEqual(sonuc2, 'ok', 'donus "ok" degil: ' + sonuc2);
  });
  dene('yeni cihaz: once UPDATE sonra INSERT', () => {
    const sira = cagri2.filter(c => c.tablo === 'push_abonelikleri').map(c => c.islem);
    assert.deepStrictEqual(sira, ['update', 'insert'],
      'beklenen sira update->insert, gelen: ' + JSON.stringify(sira));
  });
  dene('yeni cihaz: insert user_id ve endpoint tasiyor', () => {
    const i = cagri2.find(c => c.islem === 'insert');
    assert.strictEqual(i.alanlar.user_id, 'kullanici-1');
    assert.strictEqual(i.alanlar.endpoint, 'https://push.ornek.test/abc');
    assert.strictEqual(i.alanlar.p256dh, 'pppp');
    assert.strictEqual(i.alanlar.auth, 'aaaa');
  });
  dene('★ yeni cihazda da son_gonderim_gunu GONDERILMIYOR', () => {
    for (const c of cagri2) {
      if (c.tablo !== 'push_abonelikleri' || !c.alanlar) continue;
      assert.ok(!('son_gonderim_gunu' in c.alanlar),
        c.islem + ' cagrisi son_gonderim_gunu tasiyor');
    }
  });
  dene('saat dilimi ve cihaz etiketi yaziliyor', () => {
    const i = cagri2.find(c => c.islem === 'insert');
    assert.ok(typeof i.alanlar.saat_dilimi === 'string',
      'saat_dilimi yok: sunucu "bugun"u hesaplayamaz');
    assert.ok(typeof i.alanlar.cihaz === 'string' && i.alanlar.cihaz.length > 0,
      'cihaz etiketi yok');
  });

  await p.close();
  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
