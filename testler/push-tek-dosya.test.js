// TEK-DOSYA.ts, uc kaynak dosyayla AYNI KALSIN.
//
// NEDEN BU TEST VAR
//   Supabase panelindeki editorde uc ayri dosya olusturmak kullaniciyi
//   zorladi: 16 Kasim 2026'da dagitim
//   'Module not found "webpush.ts"' ile patladi, cunku panele yalnizca
//   index.ts ulasmisti. Cozum: araclar/push-tek-dosya.js uc dosyayi
//   tek dosyada birlestiriyor.
//
//   ⛔ Ama artik AYNI KOD IKI YERDE. Bu depo "iki kopya sessizce
//      ayristi" hatasini defalarca yasadi: otomatik yayin politikasi
//      tablosu, palet, ikon ailesi, termin hesabi. Bu test onu
//      push'ta tekrarlanmaktan aliyor.
//
// NE OLCUYOR
//   1. Birlestirmeyi YENIDEN yapip diskteki TEK-DOSYA.ts ile
//      karsilastiriyor. Uc dosyadan biri degisip betik
//      kosturulmadiysa burasi kirmizi yanar.
//   2. Tek dosyada import/export KALMADIGINI dogruluyor -- kalsaydi
//      panelde ayni hata tekrarlanirdi.
//   3. Dosyayi gercekten YUKLUYOR (Deno sahte) ve uclarin dogru
//      cevap verdigini olcuyor. Boylece birlestirme kodu bozmamis
//      oluyor.
//
// Kirmizi yanarsa cozum:  node araclar/push-tek-dosya.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const { uret, CIKTI } = require(path.join(KOK, 'araclar', 'push-tek-dosya.js'));

(async () => {
  let gecti = 0; const hatalar = [];
  const dene = (ad, fn) => {
    try { fn(); gecti++; console.log('  ok  ' + ad); }
    catch (e) { hatalar.push(ad); console.log('  HATA ' + ad + ': ' + e.message); }
  };

  const diskte = fs.readFileSync(CIKTI, 'utf8');
  const taze = uret();

  dene('TEK-DOSYA.ts uc kaynakla AYNI (betik tekrar kosturulmus)', () => {
    if (diskte === taze) return;
    // Nerede ayristigini soyle: "farkli" demek yetmiyor.
    const a = diskte.split('\n'), b = taze.split('\n');
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    assert.fail(
      'TEK-DOSYA.ts guncel DEGIL. Kaynaklardan biri degismis ama\n' +
      '  "node araclar/push-tek-dosya.js" kosturulmamis.\n' +
      '  Ilk fark ' + (i + 1) + '. satirda:\n' +
      '    diskte: ' + JSON.stringify((a[i] || '(dosya bitti)').slice(0, 90)) + '\n' +
      '    olmasi gereken: ' + JSON.stringify((b[i] || '(dosya bitti)').slice(0, 90)));
  });

  dene('tek dosyada import/export KALMAMIS', () => {
    const imp = (diskte.match(/^import\s/gm) || []).length;
    const exp = (diskte.match(/^export\s/gm) || []).length;
    assert.strictEqual(imp, 0, imp + ' adet import kalmis -- panelde ayni hata tekrarlanir');
    assert.strictEqual(exp, 0, exp + ' adet export kalmis');
  });

  dene('uc kaynagin da govdesi iceride', () => {
    for (const iz of ['function govdeSifrele', 'function hatirlatmaSecili', 'Deno.serve']) {
      assert.ok(diskte.includes(iz), 'eksik: ' + iz);
    }
  });

  // ── Gercekten yukleniyor ve uclar dogru cevap veriyor mu ──────────
  // Deno sahte; gerisi gercek kod.
  const OZEL = 'cokGizliOzelAnahtarOrnek';
  globalThis.Deno = {
    serve(fn) { globalThis.__pushIsleyici = fn; },
    env: {
      get(k) {
        return ({
          VAPID_ACIK: 'BPublicKeyOrnek', VAPID_OZEL: OZEL,
          VAPID_KONU: 'mailto:a@b.c', PUSH_TETIK_SIRRI: 'sir',
          SUPABASE_URL: 'https://x.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'servis',
        })[k] || '';
      },
    },
  };
  await import('file://' + CIKTI);
  const h = globalThis.__pushIsleyici;

  dene('Deno.serve cagrildi', () => {
    assert.strictEqual(typeof h, 'function', 'istek isleyici kurulmadi');
  });

  const get = await h(new Request('https://x/', { method: 'GET' }));
  const govde = await get.json();
  dene('GET: 200, surum ve sirlar donuyor', () => {
    assert.strictEqual(get.status, 200);
    assert.strictEqual(govde.surum, 1, 'surum 1 bekleniyordu');
    assert.ok(Object.values(govde.sirlar).every(v => v === true),
      'sirlarin hepsi true olmaliydi: ' + JSON.stringify(govde.sirlar));
    assert.strictEqual(govde.vapidAcik, 'BPublicKeyOrnek');
  });

  dene('⛔ OZEL anahtar GET cevabinda SIZMIYOR', () => {
    assert.ok(!JSON.stringify(govde).includes(OZEL),
      'ozel anahtar cevapta gorunuyor -- bu bir guvenlik hatasi');
  });

  for (const [ad, istek, beklenen] of [
    ['sirsiz POST 401', new Request('https://x/', { method: 'POST' }), 401],
    ['yanlis sir 401', new Request('https://x/', {
      method: 'POST', headers: { 'x-push-secret': 'yanlis' } }), 401],
    ['OPTIONS 204', new Request('https://x/', { method: 'OPTIONS' }), 204],
    ['PUT 405', new Request('https://x/', { method: 'PUT' }), 405],
  ]) {
    const c = await h(istek);
    dene(ad, () => assert.strictEqual(c.status, beklenen,
      beklenen + ' bekleniyordu, ' + c.status + ' geldi'));
  }

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
