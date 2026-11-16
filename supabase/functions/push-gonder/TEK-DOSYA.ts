// ═══════════════════════════════════════════════════════════════════
// push-gonder — TEK DOSYA SURUMU
// ═══════════════════════════════════════════════════════════════════
//
// ⛔ BU DOSYA ELLE DUZENLENMEZ. Uretilmis bir ciktidir.
//    Asil kaynak su uc dosya:
//      supabase/functions/push-gonder/webpush.ts
//      supabase/functions/push-gonder/terminler.ts
//      supabase/functions/push-gonder/index.ts
//    Degisiklik orada yapilir, sonra:  node araclar/push-tek-dosya.js
//
// NEDEN VAR
//    Supabase panelindeki editorde uc ayri dosya olusturmak zor;
//    16 Kasim 2026'da dagitim 'Module not found "webpush.ts"' ile
//    patladi cunku panele yalnizca index.ts ulasmisti. Bu surumde
//    import yok, yani o hata da yok.
//
// ⚠ Ayrisma testler/push-tek-dosya.test.js ile yakalaniyor.
//
// ═══════════════════════════════════════════════════════════════════

// ═══ webpush.ts ══════════════════════════════════════════════════
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

function b64urlCoz(s: string): Uint8Array {
  const d = s.replace(/-/g, '+').replace(/_/g, '/');
  const dolgu = d + '='.repeat((4 - (d.length % 4)) % 4);
  const ham = atob(dolgu);
  const u = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i++) u[i] = ham.charCodeAt(i);
  return u;
}

function b64urlYaz(u: Uint8Array): string {
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

async function govdeSifrele(
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

async function vapidBasligi(
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

async function pushGonder(
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

// ═══ terminler.ts ════════════════════════════════════════════════
// Termin hesabı — SUNUCU KOPYASI.
//
// ⛔ BU KOD app.html'deki hatirlatilacaklar() + hatirlatmaSecili()
//    İKİZİDİR. İkisi aynı sonucu vermek ZORUNDA.
//
// NEDEN İKİ KOPYA VAR (16 Kasım 2026, kullanıcı kararı)
//   Kullanıcı sordu: *"Normal şartlar altında sunucu daha sağlıklı
//   değil mi? Sonuçta sunucu her zaman açık ve saati çalışıyor"* —
//   ve haklıydı. Sunucu veritabanındaki ASIL kaynağı okuyor; araya
//   "tarayıcı hesaplayıp yüklesin" adımı girmiyor. O adım bir kez
//   başarısız olsa bildirim sessizce gelmezdi.
//
//   Tek kopya seçeneği zaten YOKTU: tarayıcı internetsizken ve
//   hesapsız kullanıcıda da hatırlatmayı göstermek zorunda, yani
//   kendi hesabını her hâlükârda tutuyor.
//
// ⚠ AYRIŞMA NASIL YAKALANIYOR
//   testler/termin-ikiz.test.js aynı örnek verileri İKİSİNE de verip
//   çıktıları karşılaştırıyor. Bu dosyada ya da app.html'deki
//   ikizinde bir kural değişirse o test kırmızı yanar.
//   Bu depo "iki kopya sessizce ayrıştı" hatasını defalarca yaşadı:
//   otomatik yayın politikası tablosu, palet, ikon ailesi.
//
// ⚠ "BUGÜN" KULLANICININ GÜNÜ
//   Tarayıcıda bugunKey() yerel tarihi veriyor. Sunucuda yerel diye
//   bir şey yok: UTC'de koşuyor. O yüzden gün, kullanıcının IANA
//   saat diliminde hesaplanıyor (push_abonelikleri.saat_dilimi).
//   Dilim bilinmiyorsa UTC'ye düşülüyor — bu, dilimi bilinmeyen
//   kullanıcıda bildirimi en fazla bir gün kaydırır, yanlış içerik
//   göndermez.

const PROJE_ADIMLARI = [
  'script', 'filmed', 'audio', 'edited', 'approved', 'package', 'published',
] as const;

type Cins = 'gecikti' | 'bugun' | 'yarin';

interface ProjeSatiri {
  id: string;
  name?: string | null;
  cancelled?: boolean | null;
  deleted_at?: string | null;
  steps?: Record<string, boolean> | null;
  deadlines?: Record<string, string> | null;
}

interface Ayarlar {
  gecikti?: boolean;
  gun?: boolean;
  once?: boolean;
}

interface Termin {
  projeId: string;
  projeAdi: string;
  adim: string;
  tarih: string;
  cins: Cins;
}

// Kullanıcının saat diliminde bugünün YYYY-AA-GG anahtarı.
// Intl her Deno sürümünde var; geçersiz dilim atar, o yüzden UTC'ye
// düşülüyor (sessizce yanlış gün hesaplamaktansa bilinen bir gün).
function bugunKey(saatDilimi?: string | null, simdi = new Date()): string {
  const dilim = saatDilimi || 'UTC';
  try {
    // en-CA biçimi zaten YYYY-MM-DD veriyor.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: dilim, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(simdi);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(simdi);
  }
}

// Gün anahtarına n gün ekler. app.html'deki gunEkleKey ile aynı iş.
function gunEkleKey(key: string, n: number): string {
  const [y, a, g] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 1, g));
  d.setUTCDate(d.getUTCDate() + n);
  const iki = (x: number) => String(x).padStart(2, '0');
  return d.getUTCFullYear() + '-' + iki(d.getUTCMonth() + 1) + '-' + iki(d.getUTCDate());
}

// ⛔ app.html:hatirlatilacaklar() İKİZİ.
// Ayarlardan BAĞIMSIZ: "seni bekleyen" terminlerin tamamı.
function hatirlatilacaklar(
  projeler: ProjeSatiri[], bugun: string,
): Termin[] {
  const yarin = gunEkleKey(bugun, 1);
  const liste: Termin[] = [];
  for (const p of projeler) {
    // Mezar taşı satırları listelerden düşüyor (projects.deleted_at).
    // Tarayıcıda bu satırlar zaten hiç yüklenmiyor.
    if (p.deleted_at) continue;
    if (p.cancelled) continue;
    const adimlar = p.steps || {};
    const tarihler = p.deadlines || {};
    for (const k of PROJE_ADIMLARI) {
      const d = tarihler[k] || '';
      if (!d || adimlar[k] === true) continue;
      let cins: Cins | '' = '';
      if (d < bugun) cins = 'gecikti';
      else if (d === bugun) cins = 'bugun';
      else if (d === yarin) cins = 'yarin';
      if (cins) {
        liste.push({
          projeId: p.id, projeAdi: p.name || '', adim: k, tarih: d, cins,
        });
      }
    }
  }
  return liste;
}

// ⛔ app.html:hatirlatmaSecili() İKİZİ.
// Kullanıcının açtığı kanallara göre süzüyor.
function hatirlatmaSecili(
  projeler: ProjeSatiri[], bugun: string, ayar: Ayarlar,
): Termin[] {
  return hatirlatilacaklar(projeler, bugun).filter((x) =>
    (x.cins === 'gecikti' && ayar.gecikti === true) ||
    (x.cins === 'bugun' && ayar.gun === true) ||
    (x.cins === 'yarin' && ayar.once === true)
  );
}

// ═══ index.ts ════════════════════════════════════════════════════
// Push bildirimi göndericisi — Supabase Edge Function.
//
// NE YAPAR
//   Zamanlanmış görev (cron) bunu saatte bir çağırıyor. Fonksiyon
//   push aboneliklerini geziyor, her kullanıcının KENDİ saat diliminde
//   hatırlatma saati gelmiş mi diye bakıyor, gelmişse o günün termin
//   listesini hesaplayıp bildirimi gönderiyor.
//
// GİZLİ AYARLAR (supabase secrets set ...)
//   VAPID_ACIK           VAPID açık anahtarı (base64url, 65 bayt ham)
//   VAPID_OZEL           VAPID özel anahtarı (base64url, 32 bayt ham)
//   VAPID_KONU           "mailto:hello@shootboard.app" gibi
//   PUSH_TETIK_SIRRI     cron'un x-push-secret başlığında yolladığı
//                        uzun rastgele metin. Uyuşmazsa istek reddedilir.
//   SUPABASE_URL                 Supabase kendisi tanımlıyor
//   SUPABASE_SERVICE_ROLE_KEY    Supabase kendisi tanımlıyor
//
// DAĞITIM: supabase/functions/push-gonder/README.md — adım adım.
//
// ⚠ KISA AD KLASÖR ADI DEĞİL. Panelden kurulunca adresteki kısa ad
//   RASTGELE üretiliyor ve sonradan değiştirilemiyor. Bu tuzak bu
//   depoda iki kez 404'e yol açtı (sql/20'nin başı ve hosgeldin
//   README'si). Dağıttıktan sonra GERÇEK adresi README'ye yaz.
//
// ⚠ SURUM: metin ya da mantık değişince ARTIR. Yoksa "dağıtım tuttu mu"
//   sorusunun dışarıdan cevabı olmuyor — story-yayin'de bir kez eski
//   sürüm "doğrulandı" sanıldı ve sorun günlerce yanlış yerde arandı.



const SURUM = 1;

// ── Metinler ────────────────────────────────────────────────────────
// ⛔ İKİ DİL ŞART. Kullanıcının kuralı: "hazırlanan her şey mutlaka
//    İngilizcede olmalı" (15 Kasım 2026). Dil prefs.lang'den geliyor.
const METIN = {
  tr: {
    baslik: (n: number) => n === 1 ? '1 termin seni bekliyor'
                                   : n + ' termin seni bekliyor',
    gecikti: 'gecikti',
    bugun: 'bugün',
    yarin: 'yarın',
    adim: {
      script: 'Senaryo', filmed: 'Çekim', audio: 'Ses', edited: 'Kurgu',
      approved: 'Onay', package: 'Paketleme', published: 'Yayın',
    } as Record<string, string>,
  },
  en: {
    baslik: (n: number) => n === 1 ? '1 deadline is waiting'
                                   : n + ' deadlines are waiting',
    gecikti: 'late',
    bugun: 'today',
    yarin: 'tomorrow',
    adim: {
      script: 'Script', filmed: 'Filming', audio: 'Audio', edited: 'Edit',
      approved: 'Approval', package: 'Packaging', published: 'Publish',
    } as Record<string, string>,
  },
};

function govdeYaz(terminler: Termin[], dil: 'tr' | 'en'): string {
  const m = METIN[dil];
  // En fazla üç satır: bildirim zaten kısalıyor, dördüncü satır
  // kullanıcıya hiçbir şey söylemeden yer kaplıyor.
  const ilk = terminler.slice(0, 3).map((t) => {
    const adimAdi = m.adim[t.adim] || t.adim;
    const ne = t.cins === 'gecikti' ? m.gecikti
             : t.cins === 'bugun' ? m.bugun : m.yarin;
    const proje = t.projeAdi || '—';
    return proje + ' · ' + adimAdi + ' (' + ne + ')';
  });
  const kalan = terminler.length - ilk.length;
  if (kalan > 0) {
    ilk.push(dil === 'tr' ? '+' + kalan + ' tane daha'
                          : '+' + kalan + ' more');
  }
  return ilk.join('\n');
}

// ── Supabase REST ───────────────────────────────────────────────────
// Dış kütüphane yok; depodaki gelenek bu.
async function sor(
  yol: string, url: string, anahtar: string,
): Promise<unknown[]> {
  const cevap = await fetch(url + '/rest/v1/' + yol, {
    headers: {
      apikey: anahtar,
      Authorization: 'Bearer ' + anahtar,
      Accept: 'application/json',
    },
  });
  if (!cevap.ok) {
    throw new Error('REST ' + yol.split('?')[0] + ' -> ' + cevap.status +
                    ' ' + (await cevap.text()).slice(0, 200));
  }
  return await cevap.json();
}

async function yaz(
  yol: string, url: string, anahtar: string, yontem: string, govde?: unknown,
): Promise<void> {
  const cevap = await fetch(url + '/rest/v1/' + yol, {
    method: yontem,
    headers: {
      apikey: anahtar,
      Authorization: 'Bearer ' + anahtar,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  });
  if (!cevap.ok && cevap.status !== 404) {
    throw new Error('REST ' + yontem + ' ' + yol.split('?')[0] + ' -> ' +
                    cevap.status + ' ' + (await cevap.text()).slice(0, 200));
  }
}

// Kullanıcının saat diliminde şu anki "SS:DD".
function simdiSaat(dilim: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: dilim || 'UTC', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date());
  }
}

interface Abonelik {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  saat_dilimi: string | null;
  son_gonderim_gunu: string | null;
}

// ── Giriş ───────────────────────────────────────────────────────────

Deno.serve(async (istek: Request) => {
  const vapidAcik = Deno.env.get('VAPID_ACIK') || '';
  const vapidOzel = Deno.env.get('VAPID_OZEL') || '';
  const vapidKonu = Deno.env.get('VAPID_KONU') || 'mailto:hello@shootboard.app';
  const tetikSirri = Deno.env.get('PUSH_TETIK_SIRRI') || '';
  const url = Deno.env.get('SUPABASE_URL') || '';
  const servisAnahtari = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  // ── GET: durum + VAPID AÇIK anahtarı ──────────────────────────────
  // Açık anahtar gizli değil: tarayıcıya zaten gidiyor. Buradan
  // verilmesinin sebebi, app.html'e GÖMÜLMEMESİ — kullanıcı hiçbir
  // dosyayı elle düzenlemek zorunda kalmasın diye.
  // ⛔ ÖZEL anahtar buradan ASLA dönmüyor; yalnızca tanımlı mı bilgisi.
  if (istek.method === 'GET') {
    return new Response(JSON.stringify({
      surum: SURUM,
      vapidAcik,
      sirlar: {
        VAPID_ACIK: !!vapidAcik,
        VAPID_OZEL: !!vapidOzel,
        VAPID_KONU: !!Deno.env.get('VAPID_KONU'),
        PUSH_TETIK_SIRRI: !!tetikSirri,
        SUPABASE_URL: !!url,
        SUPABASE_SERVICE_ROLE_KEY: !!servisAnahtari,
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // app.html baska bir kokenden (shootboard.app) cagiriyor.
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  if (istek.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  if (istek.method !== 'POST') {
    return new Response('yontem desteklenmiyor', { status: 405 });
  }

  // ── POST: gönderim turu ───────────────────────────────────────────
  if (!tetikSirri || istek.headers.get('x-push-secret') !== tetikSirri) {
    // ⛔ Sebep YAZILMIYOR: sirrin tanimli olup olmadigi disaridan
    //    anlasilmasin.
    return new Response('yetkisiz', { status: 401 });
  }
  if (!vapidAcik || !vapidOzel) {
    return new Response(JSON.stringify({ hata: 'VAPID anahtarlari tanimli degil' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const rapor = {
    surum: SURUM, abonelik: 0, gonderildi: 0, atlandi: 0,
    silindi: 0, hata: 0, ayrinti: [] as string[],
  };

  try {
    const abonelikler = await sor(
      'push_abonelikleri?select=id,user_id,endpoint,p256dh,auth,saat_dilimi,son_gonderim_gunu',
      url, servisAnahtari) as Abonelik[];
    rapor.abonelik = abonelikler.length;

    // Kullanıcı başına tercih ve proje BİR KEZ okunuyor: aynı kişinin
    // üç tarayıcısı varsa üç kez sorgulamanın anlamı yok.
    const tercihOnbellek = new Map<string, { ayar: Record<string, boolean>; saat: string; dil: 'tr' | 'en' }>();
    const projeOnbellek = new Map<string, ProjeSatiri[]>();

    for (const a of abonelikler) {
      try {
        if (!tercihOnbellek.has(a.user_id)) {
          const satirlar = await sor(
            'user_prefs?select=prefs&user_id=eq.' + a.user_id, url, servisAnahtari,
          ) as Array<{ prefs?: Record<string, unknown> }>;
          const prefs = (satirlar[0] && satirlar[0].prefs) || {};
          const r = (prefs.reminders || {}) as Record<string, unknown>;
          tercihOnbellek.set(a.user_id, {
            ayar: {
              gecikti: r.gecikti === true,
              gun: r.gun === true,
              once: r.once === true,
            },
            // ⚠ saat prefs'e 16 Kasim 2026'da eklendi. Eski satirlarda
            //   yok; varsayilan 09:00 (HATIRLATMA_VARSAYILAN ile ayni).
            saat: typeof r.saat === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.saat)
                  ? r.saat : '09:00',
            dil: prefs.lang === 'tr' ? 'tr' : 'en',
          });
        }
        const tercih = tercihOnbellek.get(a.user_id)!;

        // Hiçbir kanal açık değilse bu kullanıcıya hiç bakma.
        if (!tercih.ayar.gecikti && !tercih.ayar.gun && !tercih.ayar.once) {
          rapor.atlandi++; continue;
        }

        const bugun = bugunKey(a.saat_dilimi);

        // Bugün zaten gönderildi mi?
        if (a.son_gonderim_gunu === bugun) { rapor.atlandi++; continue; }

        // Saat geldi mi? Kullanıcının KENDİ saatine bakılıyor.
        if (simdiSaat(a.saat_dilimi) < tercih.saat) { rapor.atlandi++; continue; }

        if (!projeOnbellek.has(a.user_id)) {
          projeOnbellek.set(a.user_id, await sor(
            'projects?select=id,name,cancelled,deleted_at,steps,deadlines' +
            '&user_id=eq.' + a.user_id, url, servisAnahtari) as ProjeSatiri[]);
        }
        const terminler = hatirlatmaSecili(
          projeOnbellek.get(a.user_id)!, bugun, tercih.ayar);

        if (!terminler.length) { rapor.atlandi++; continue; }

        const m = METIN[tercih.dil];
        const sonuc = await pushGonder(a, {
          baslik: m.baslik(terminler.length),
          govde: govdeYaz(terminler, tercih.dil),
          etiket: 'shootboard-termin',
        }, vapidAcik, vapidOzel, vapidKonu);

        if (sonuc.ok) {
          rapor.gonderildi++;
          await yaz('push_abonelikleri?id=eq.' + a.id, url, servisAnahtari, 'PATCH',
                    { son_gonderim_gunu: bugun, son_gorulme: new Date().toISOString() });
        } else if (sonuc.durum === 404 || sonuc.durum === 410) {
          // ⛔ Abonelik ÖLDÜ ve bir daha dirilmez: satir siliniyor.
          //    Mezar tasi tutmanin faydasi yok, burada kullanicinin
          //    verisi degil yalnizca bir teslimat adresi var.
          await yaz('push_abonelikleri?id=eq.' + a.id, url, servisAnahtari, 'DELETE');
          rapor.silindi++;
        } else {
          rapor.hata++;
          rapor.ayrinti.push('push ' + sonuc.durum + ': ' + sonuc.metin);
        }
      } catch (e) {
        rapor.hata++;
        rapor.ayrinti.push(String(e instanceof Error ? e.message : e).slice(0, 200));
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({
      surum: SURUM, hata: String(e instanceof Error ? e.message : e).slice(0, 300),
    }), { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }

  // Ayrıntı listesi sınırlanıyor: bin abonelik bozuksa kayıt dosyası
  // okunmaz hâle gelmesin.
  rapor.ayrinti = rapor.ayrinti.slice(0, 20);
  return new Response(JSON.stringify(rapor), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
});
