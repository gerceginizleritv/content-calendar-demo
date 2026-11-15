// Web Push şifrelemesi — RFC 8291'in RESMÎ test vektörü.
//
// NEDEN BU TEST VAR
//   supabase/functions/push-gonder/webpush.ts şifrelemeyi elle uyguluyor
//   (bu depoda hiçbir Edge Function dış paket çekmiyor). Elle yazılan
//   şifreleme sessizce bozulur: tarayıcı "çözemedim" demez, bildirim
//   yalnızca GELMEZ ve sebebi hiçbir yere yazılmaz. O yüzden doğrulama
//   kendi ürettiğimize değil, STANDARDIN kendi sayılarına bakıyor.
//
// KAYNAK — uydurulmadı, 15 Kasım 2026'da şu adresten indirildi:
//   https://www.rfc-editor.org/rfc/rfc8291.txt   (Bölüm 5)
//   Düz metinde satır kaydırması var; aşağıdaki değerler birleştirildi.
//
// ⚠ BU TESTİN SINIRI
//   Burada doğrulanan ŞİFRELEME. VAPID imzası (RFC 8292) ayrı
//   doğrulanıyor: imza atılıp aynı açık anahtarla geri doğrulanıyor.
//   Gerçek bir push servisinin kabul edip etmediği ANCAK canlıda,
//   gerçek bir cihaza bildirim düşünce belli olur.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ── RFC 8291 Bölüm 5 ────────────────────────────────────────────────
const DUZ_METIN = 'When I grow up, I want to be a watermelon';
const AUTH_SIR  = 'BTBZMqHH6r4Tts7J_aSIgg';
const ALICI_ACIK =
  'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcx' +
  'aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
const GONDEREN_OZEL = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw';
const GONDEREN_ACIK =
  'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIg' +
  'Dll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
const TUZ = 'DGv6ra1nlYgDCS1FRnbzlw';
const BEKLENEN =
  'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
  'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
  'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';

// ── Modülü yükle ────────────────────────────────────────────────────
// webpush.ts Deno için yazıldı ama gövdesi düz JavaScript; yalnızca tip
// açıklamaları var. Node'da koşturmak için tipler siliniyor.
// ⚠ Bu silme KABA. Dosyaya karmaşık bir tip sözdizimi girerse burası
//   kırılır ve testin kendisi hata verir — sessizce geçmez.
function moduluYukle() {
  const dosya = path.join(__dirname, '..', 'supabase', 'functions',
                          'push-gonder', 'webpush.ts');
  let kod = fs.readFileSync(dosya, 'utf8');
  kod = kod
    .replace(/^import\s+type[^;]+;$/gm, '')
    .replace(/\s+as\s+(BufferSource|BodyInit|CryptoKeyPair|JsonWebKey)\b/g, '')
    .replace(/:\s*Promise<[^>]*(?:<[^>]*>)?[^>]*>/g, '')
    .replace(/:\s*\{[^}]*\}(?=\s*[,)])/g, '')
    .replace(/:\s*(Uint8Array|string|number|unknown|boolean|CryptoKey(?:Pair)?|JsonWebKey|BufferSource)(\[\])?/g, '')
    // Istege bagli parametre isareti: "sabitGonderen?," -> "sabitGonderen,"
    .replace(/([A-Za-z_$][\w$]*)\?(\s*[,)])/g, '$1$2')
    .replace(/\bexport\s+/g, '');
  const kapsam = {
    crypto: require('crypto').webcrypto,
    atob, btoa, TextEncoder, fetch, URL, DataView, Uint8Array,
    Date, Math, JSON, String, Number, console,
  };
  kapsam.disari = {};
  vm.createContext(kapsam);
  vm.runInContext(
    kod + '\n;disari.govdeSifrele = govdeSifrele;' +
          'disari.vapidBasligi = vapidBasligi;' +
          'disari.b64urlCoz = b64urlCoz; disari.b64urlYaz = b64urlYaz;',
    kapsam,
  );
  return kapsam.disari;
}

(async () => {
  const M = moduluYukle();
  const webcrypto = require('crypto').webcrypto;
  let gecti = 0;
  const hatalar = [];
  const dene = (ad, fn) => {
    try { fn(); gecti++; console.log('  ok  ' + ad); }
    catch (e) { hatalar.push(ad + ' -> ' + e.message); console.log('  HATA ' + ad + ': ' + e.message); }
  };

  // ── 1. RFC vektörü: aynı girdiler, aynı çıktı ─────────────────────
  const ozel = M.b64urlCoz(GONDEREN_OZEL);
  const acik = M.b64urlCoz(GONDEREN_ACIK);
  const gonderenCift = {
    privateKey: await webcrypto.subtle.importKey('jwk', {
      kty: 'EC', crv: 'P-256',
      d: M.b64urlYaz(ozel),
      x: M.b64urlYaz(acik.slice(1, 33)),
      y: M.b64urlYaz(acik.slice(33, 65)),
      ext: true,
    }, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']),
    publicKey: await webcrypto.subtle.importKey(
      'raw', acik, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
  };

  const cikti = await M.govdeSifrele(
    ALICI_ACIK, AUTH_SIR,
    new TextEncoder().encode(DUZ_METIN),
    gonderenCift,
    M.b64urlCoz(TUZ),
  );
  const ciktiB64 = M.b64urlYaz(cikti);

  dene('RFC 8291 vektoru birebir tutuyor', () => {
    assert.strictEqual(ciktiB64, BEKLENEN,
      'beklenen ve uretilen sifreli metin AYNI DEGIL\n' +
      '  beklenen: ' + BEKLENEN.slice(0, 64) + '...\n' +
      '  uretilen: ' + ciktiB64.slice(0, 64) + '...');
  });

  // ── 2. Başlık yapısı — RFC 8188 §2.1 ──────────────────────────────
  dene('baslik: tuz 16 bayt, kayit boyu 4096, id 65 bayt', () => {
    assert.strictEqual(M.b64urlYaz(cikti.slice(0, 16)), TUZ, 'tuz yanlis');
    const rs = new DataView(cikti.buffer, cikti.byteOffset + 16, 4).getUint32(0, false);
    assert.strictEqual(rs, 4096, 'kayit boyu 4096 olmali, su an ' + rs);
    assert.strictEqual(cikti[20], 65, 'id uzunlugu 65 olmali, su an ' + cikti[20]);
    assert.strictEqual(cikti[21], 0x04, 'gonderen anahtari sikistirilmamis (0x04) olmali');
    assert.strictEqual(M.b64urlYaz(cikti.slice(21, 86)), GONDEREN_ACIK,
      'basliktaki anahtar gonderenin acik anahtari degil');
  });

  // ── 3. Rastgele tuz/anahtarla da calisiyor, cikti her seferinde farkli ──
  dene('rastgele kurulumda cikti her seferinde degisiyor', async () => {});
  const a = M.b64urlYaz(await M.govdeSifrele(ALICI_ACIK, AUTH_SIR,
    new TextEncoder().encode('ayni metin')));
  const b = M.b64urlYaz(await M.govdeSifrele(ALICI_ACIK, AUTH_SIR,
    new TextEncoder().encode('ayni metin')));
  dene('ayni metin iki kez sifrelenince farkli cikiyor (tuz rastgele)', () => {
    assert.notStrictEqual(a, b, 'iki sifreleme AYNI cikti - tuz sabit kalmis olabilir');
  });

  // ── 4. VAPID imzasi: atilan imza geri dogrulaniyor ────────────────
  const vapidCift = await webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const vAcik = new Uint8Array(await webcrypto.subtle.exportKey('raw', vapidCift.publicKey));
  const vJwk = await webcrypto.subtle.exportKey('jwk', vapidCift.privateKey);
  const baslik = await M.vapidBasligi(
    vJwk.d, M.b64urlYaz(vAcik), 'https://push.example.net', 'mailto:hello@shootboard.app');

  dene('VAPID basligi bicimi dogru', () => {
    assert.ok(baslik.startsWith('vapid t='), 'baslik "vapid t=" ile baslamali');
    assert.ok(baslik.includes(', k='), 'baslik ", k=" tasimali');
  });

  const jwt = baslik.slice('vapid t='.length, baslik.indexOf(', k='));
  const [bas, gov, imz] = jwt.split('.');
  dene('VAPID imzasi ayni anahtarla DOGRULANIYOR', async () => {});
  const imzaGecerli = await webcrypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, vapidCift.publicKey,
    M.b64urlCoz(imz), new TextEncoder().encode(bas + '.' + gov));
  dene('VAPID imzasi gecerli', () => {
    assert.ok(imzaGecerli, 'imza kendi acik anahtariyla dogrulanamadi');
  });
  dene('VAPID iddialari dogru', () => {
    const g = JSON.parse(Buffer.from(gov.replace(/-/g,'+').replace(/_/g,'/'), 'base64'));
    assert.strictEqual(g.aud, 'https://push.example.net', 'aud yanlis');
    assert.strictEqual(g.sub, 'mailto:hello@shootboard.app', 'sub yanlis');
    const kalan = g.exp - Math.floor(Date.now()/1000);
    assert.ok(kalan > 0 && kalan <= 12*60*60 + 60,
      'exp 12 saati asmamali (RFC 8292), su an ' + kalan + ' sn');
  });

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) { hatalar.forEach(h => console.log('  ⛔ ' + h)); process.exit(1); }
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
