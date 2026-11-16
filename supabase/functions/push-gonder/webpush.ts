// Web Push — şifreleme ve imza. Dış kütüphane YOK.
//
// Bu depoda hiçbir Edge Function dış paket çekmiyor; bu dosya da o
// geleneği sürdürüyor. İki standart elle uygulandı:
//
//   RFC 8291 — Message Encryption for Web Push  (gövdenin şifrelenmesi)
//   RFC 8188 — aes128gcm içerik kodlaması       (gövdenin paketlenmesi)
//   RFC 8292 — VAPID                            (gönderenin imzası)
//
// ⚠ BU DOSYA TAHMİNLE YAZILMADI. RFC 8291'in 5. bölümündeki resmî test
// vektörüyle doğrulandı: aynı girdilerle aynı şifreli metin çıkıyor.
// Testi: testler/webpush-vektor.test.js. Bu dosyada bir şey
// değiştirirsen o testi KOŞTUR — şifreleme sessizce bozulur, tarayıcı
// yalnızca "bildirim gelmedi" der ve sebebini söylemez.

// ───────────────────────────────────────────────────────────────────
// Küçük yardımcılar
// ───────────────────────────────────────────────────────────────────

export function b64urlCoz(s: string): Uint8Array {
  const d = s.replace(/-/g, '+').replace(/_/g, '/');
  const dolgu = d + '='.repeat((4 - (d.length % 4)) % 4);
  const ham = atob(dolgu);
  const u = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i++) u[i] = ham.charCodeAt(i);
  return u;
}

export function b64urlYaz(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function birlestir(...parcalar: Uint8Array[]): Uint8Array {
  let boy = 0;
  for (const p of parcalar) boy += p.length;
  const c = new Uint8Array(boy);
  let o = 0;
  for (const p of parcalar) { c.set(p, o); o += p.length; }
  return c;
}

function yazi(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// HKDF'in tek turluk hâli. Web Push'ta çıktı hep 32 bayttan kısa, yani
// tek tur yetiyor: T(1) = HMAC(PRK, info || 0x01).
async function hkdf(
  tuz: Uint8Array, ikm: Uint8Array, info: Uint8Array, uzunluk: number,
): Promise<Uint8Array> {
  const tuzAnahtar = await crypto.subtle.importKey(
    'raw', tuz as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const prk = new Uint8Array(
    await crypto.subtle.sign('HMAC', tuzAnahtar, ikm as BufferSource),
  );
  const prkAnahtar = await crypto.subtle.importKey(
    'raw', prk as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const t = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC', prkAnahtar, birlestir(info, new Uint8Array([1])) as BufferSource,
    ),
  );
  return t.slice(0, uzunluk);
}

// ───────────────────────────────────────────────────────────────────
// Gövdenin şifrelenmesi — RFC 8291 + RFC 8188
// ───────────────────────────────────────────────────────────────────
//
// p256dhB64 : aboneliğin açık anahtarı (tarayıcı verdi), 65 bayt ham
// authB64   : aboneliğin gizli tuzu (tarayıcı verdi), 16 bayt
// veri      : gönderilecek düz metin (bizde JSON)
//
// Test edilebilirlik için gonderenJwk ve tuz DIŞARIDAN verilebiliyor;
// normalde ikisi de burada rastgele üretilir. Test vektörü sabit
// değerler gerektirdiği için bu kapı açık bırakıldı.

export async function govdeSifrele(
  p256dhB64: string,
  authB64: string,
  veri: Uint8Array,
  sabitGonderen?: CryptoKeyPair,
  sabitTuz?: Uint8Array,
): Promise<Uint8Array> {
  const uaAcik = b64urlCoz(p256dhB64);   // 65 bayt, 0x04 ile başlar
  const authTuz = b64urlCoz(authB64);    // 16 bayt

  // Gönderenin tek kullanımlık anahtar çifti.
  const gonderen = sabitGonderen || await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  ) as CryptoKeyPair;
  const asAcik = new Uint8Array(
    await crypto.subtle.exportKey('raw', gonderen.publicKey),
  );

  // Ortak sır: ECDH(gönderenin özeli, alıcının açığı)
  const uaAnahtar = await crypto.subtle.importKey(
    'raw', uaAcik as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );
  const ortak = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaAnahtar }, gonderen.privateKey, 256,
    ),
  );

  // IKM — RFC 8291 §3.3
  //   key_info = "WebPush: info" || 0x00 || ua_public || as_public
  const keyInfo = birlestir(
    yazi('WebPush: info'), new Uint8Array([0]), uaAcik, asAcik,
  );
  const ikm = await hkdf(authTuz, ortak, keyInfo, 32);

  // CEK ve NONCE — RFC 8188 §2.2/2.3
  const tuz = sabitTuz || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(tuz, ikm, yazi('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(tuz, ikm, yazi('Content-Encoding: nonce\0'), 12);

  // Düz metnin sonuna 0x02: "bu son kayıt" ayracı (RFC 8188 §2).
  const acikMetin = birlestir(veri, new Uint8Array([2]));
  const cekAnahtar = await crypto.subtle.importKey(
    'raw', cek as BufferSource, { name: 'AES-GCM' }, false, ['encrypt'],
  );
  const sifreli = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, tagLength: 128 },
    cekAnahtar, acikMetin as BufferSource,
  ));

  // Başlık: tuz(16) || kayıtBoyu(4, büyük uçlu) || idBoyu(1) || id
  // Web Push'ta id = gönderenin açık anahtarı (65 bayt).
  const kayitBoyu = new Uint8Array(4);
  new DataView(kayitBoyu.buffer).setUint32(0, 4096, false);
  const baslik = birlestir(
    tuz, kayitBoyu, new Uint8Array([asAcik.length]), asAcik,
  );
  return birlestir(baslik, sifreli);
}

// ───────────────────────────────────────────────────────────────────
// VAPID imzası — RFC 8292
// ───────────────────────────────────────────────────────────────────
//
// ozelB64 : VAPID özel anahtarı, 32 bayt ham (base64url)
// acikB64 : VAPID açık anahtarı, 65 bayt ham (base64url)
// hedef   : abonelik adresinin kökü (https://fcm.googleapis.com gibi)
// konu    : "mailto:..." — Push servisi sorun çıkınca buraya yazar

export async function vapidBasligi(
  ozelB64: string, acikB64: string, hedef: string, konu: string,
): Promise<string> {
  const ozel = b64urlCoz(ozelB64);
  const acik = b64urlCoz(acikB64);

  // Ham 32 baytlık özel anahtar WebCrypto'ya doğrudan girmiyor; JWK'ye
  // çevriliyor. Açık anahtarın x ve y'si de JWK'de şart.
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: b64urlYaz(ozel),
    x: b64urlYaz(acik.slice(1, 33)),
    y: b64urlYaz(acik.slice(33, 65)),
    ext: true,
  };
  const anahtar = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );

  const baslik = b64urlYaz(yazi(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const govde = b64urlYaz(yazi(JSON.stringify({
    aud: hedef,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: konu,
  })));
  const imzalanacak = yazi(baslik + '.' + govde);
  const imza = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, anahtar, imzalanacak as BufferSource,
  ));
  const jwt = baslik + '.' + govde + '.' + b64urlYaz(imza);
  return 'vapid t=' + jwt + ', k=' + acikB64;
}

// ───────────────────────────────────────────────────────────────────
// Tek bir aboneliğe gönderim
// ───────────────────────────────────────────────────────────────────
//
// Dönüş: { ok, durum }  — durum HTTP kodu.
// ⚠ 404 ve 410 "abonelik ÖLDÜ" demektir; çağıran satırı silmeli.

export async function pushGonder(
  abonelik: { endpoint: string; p256dh: string; auth: string },
  govde: unknown,
  vapidAcik: string,
  vapidOzel: string,
  konu: string,
  omur = 12 * 60 * 60,
): Promise<{ ok: boolean; durum: number; metin: string }> {
  const sifreli = await govdeSifrele(
    abonelik.p256dh, abonelik.auth, yazi(JSON.stringify(govde)),
  );
  const kok = new URL(abonelik.endpoint).origin;
  const yetki = await vapidBasligi(vapidOzel, vapidAcik, kok, konu);

  const cevap = await fetch(abonelik.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': yetki,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': String(omur),
      'Urgency': 'normal',
    },
    body: sifreli as BodyInit,
  });
  let metin = '';
  try { metin = (await cevap.text()).slice(0, 300); } catch { /* gövdesiz cevap */ }
  return { ok: cevap.ok, durum: cevap.status, metin };
}
