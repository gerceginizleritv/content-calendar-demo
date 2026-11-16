// SOZLUK PARITESI — HER DILDE AYNI ANAHTARLAR OLMAK ZORUNDA.
//
// NEDEN BU TEST VAR (40. madde)
//   Bugune kadar boyle bir bekci YOKTU: bir anahtar tek dile yazilsa
//   hicbir yerde kirmizi yanmiyordu, yalnizca gozle goruluyordu.
//
//   ⛔ BU SESSIZ BOZULMA GERCEKTEN OLDU. 16 Kasim 2026'da yapilan
//      Turkce-only taramada `"bos yanit"` diye sabit bir Turkce dize
//      UC yerde, cevrilmis iki metnin ORTASINA gomulu bulundu.
//      Ingilizce kullanan kisi su cumleyi goruyordu:
//        Could not reach the API: bos yanit — check your key…
//      Kimse fark etmedi cunku olcen bir sey yoktu.
//
//   ⚠ KOSMA ZAMANI SECILDI: 9. maddeden hemen SONRA, 6/7/8/10/11/12'den
//     ONCE. O maddeler cok yeni dize getiriyor; bekci onlardan once
//     kurulsun diye. Kullanici 16 Kasim 2026'da onayladi.
//
// NE OLCUYOR — yedi sozluk ciftinin TAMAMI, uygulamanin kendi
//   icinden (dosyayi ayristirarak degil; ayristirma sahte guven
//   verir, degisken adi degisince sessizce bos tarar):
//     LANG · TYPE_NAMES · TYPE_LABELS · STATUS_LABELS
//     ORNEK_METIN · TOUR_STEPS_I18N (dizi) · KUR_SEMA_METIN
//
//   Her sozlukte, her dil `en` ile karsilastiriliyor:
//     1. Eksik anahtar     — `en`'de var, otekinde yok
//     2. Fazla anahtar     — otekinde var, `en`'de yok (yazim hatasi)
//     3. Tur uyusmazligi   — birinde metin, otekinde fonksiyon
//     4. Arite uyusmazligi — `(n)=>` ve `(n,m)=>` ayni anahtarda
//     5. Bos deger         — anahtar var ama metin bos (sessiz bosluk)
//     6. Dizi boyu         — TOUR_STEPS_I18N adim ve `points` sayisi
//
// ⛔ DIL LISTESI SABIT YAZILMADI. Test `Object.keys(LANG)` ile hangi
//    diller varsa onlari geziyor. 41. madde alti dil ekleyince
//    (es, pt-BR, de, fr, it, ru) bu test onlari KENDILIGINDEN
//    kapsayacak; tek satir degisiklik gerekmiyor.
//
// ⚠ `en` REFERANS, cunku t() eksik anahtarda `en`'e dusuyor
//   (app.html:8721-8725). Yani `en`'de olmayan bir anahtarin
//   hicbir yedegi yok.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8139;           // ⛔ 8097-8099 kosucunun; asla kullanma
const KOK = path.join(__dirname, '..');

// Bilerek tek dilde durabilen anahtarlar buraya SEBEBIYLE yazilir.
// ⛔ Bir anahtari "test kirmizi yaniyor" diye buraya ATMA; once
//   gercekten tek dilde durmasi gerekip gerekmedigini sor.
const MAZERETLI = {
  // ornek: 'LANG.bir_anahtar': 'sebep',
};

// BOS METNI MESRU olan anahtarlar. Bunlar bir cumlenin PARCASI ve
// dillerin sozdizimi ayni yere ayni parcayi koymuyor.
//
// ⛔ "Bos" her zaman hata degil -- ama cogu zaman hatadir. Bu listeye
//   bir anahtar YALNIZCA cumlenin tamami okunup o dilde gercekten
//   bos kalmasi gerektigi gorulunce eklenir, ve SEBEBIYLE eklenir.
//
// ⚠ 41. madde (alti yeni dil) bu listeyi BUYUTECEK: Almanca ve
//   Rusca'da da fiil/edat yeri farkli. Her ekleme ayri bir satir ve
//   ayri bir sebep ister; "hepsini serbest birak" diye genel bir
//   kural YAZILMAZ, cunku o zaman kazara bos kalan etiket gorunmez.
const BOS_OLABILIR = {
  // app.html:21289 su cumleyi UC parcadan kuruyor:
  //   t('ai_drafted_prefix') + 'Gemini' + t('ai_drafted_suffix')
  // Ingilizce : "Drafted with " + Gemini + ". Feel free to edit it."
  // Turkce    : ""             + Gemini + " ile taslak hazirlandi. …"
  // Turkce'de fiil sonda, yani onek MESRU olarak bos. 16 Kasim
  // 2026'da bu test onu buldu, cumle okundu, kasitli oldugu gorüldü.
  'LANG.ai_drafted_prefix': "Turkce'de fiil sonda: onek bos, cumleyi sonek tasiyor",
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
  const p = await tarayici.newPage();
  await p.goto('http://localhost:' + PORT + '/app.html');
  await p.waitForFunction(() => typeof LANG === 'object' && !!LANG, { timeout: 30000 });

  const rapor = await p.evaluate(() => {
    // Sozlukler uygulamanin KENDI icinden okunuyor.
    const SOZLUKLER = {
      LANG:            typeof LANG            !== 'undefined' ? LANG            : null,
      TYPE_NAMES:      typeof TYPE_NAMES      !== 'undefined' ? TYPE_NAMES      : null,
      TYPE_LABELS:     typeof TYPE_LABELS     !== 'undefined' ? TYPE_LABELS     : null,
      STATUS_LABELS:   typeof STATUS_LABELS   !== 'undefined' ? STATUS_LABELS   : null,
      ORNEK_METIN:     typeof ORNEK_METIN     !== 'undefined' ? ORNEK_METIN     : null,
      TOUR_STEPS_I18N: typeof TOUR_STEPS_I18N !== 'undefined' ? TOUR_STEPS_I18N : null,
      KUR_SEMA_METIN:  typeof KUR_SEMA_METIN  !== 'undefined' ? KUR_SEMA_METIN  : null,
    };

    const tur = (v) => Array.isArray(v) ? 'dizi'
                     : v === null ? 'bos'
                     : typeof v === 'function' ? 'fonksiyon'
                     : typeof v;

    // Ic ice nesneleri de geziyor: "a.b.c" biciminde duz anahtar listesi.
    function duzle(nesne, onek, cikti) {
      if (nesne === null || typeof nesne !== 'object') return cikti;
      for (const k of Object.keys(nesne)) {
        const yol = onek ? onek + '.' + k : k;
        const v = nesne[k];
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          duzle(v, yol, cikti);
        } else {
          cikti[yol] = {
            tur: tur(v),
            arite: typeof v === 'function' ? v.length : null,
            bos: (typeof v === 'string' && v.trim() === ''),
            uzunluk: Array.isArray(v) ? v.length : null,
          };
        }
      }
      return cikti;
    }

    const sonuc = { bulunamayan: [], diller: Object.keys(LANG || {}), sozlukler: {} };

    for (const [ad, sz] of Object.entries(SOZLUKLER)) {
      if (!sz) { sonuc.bulunamayan.push(ad); continue; }

      // TOUR_STEPS_I18N dil -> DIZI tutuyor; otekiler dil -> NESNE.
      const dilAnahtarlari = Object.keys(sz);
      const enVar = dilAnahtarlari.includes('en');
      const kayit = { diller: dilAnahtarlari, enVar, karsilastirma: {} };

      if (enVar) {
        const refDizi = Array.isArray(sz.en);
        const ref = duzle(refDizi ? { _: sz.en } : sz.en, '', {});
        for (const d of dilAnahtarlari) {
          if (d === 'en') continue;
          const o = duzle(Array.isArray(sz[d]) ? { _: sz[d] } : sz[d], '', {});
          const eksik = Object.keys(ref).filter(k => !(k in o));
          const fazla = Object.keys(o).filter(k => !(k in ref));
          const turFarki = [], ariteFarki = [], boslar = [], diziBoyu = [];
          for (const k of Object.keys(ref)) {
            if (!(k in o)) continue;
            if (ref[k].tur !== o[k].tur)
              turFarki.push(k + ': en=' + ref[k].tur + ' ' + d + '=' + o[k].tur);
            else if (ref[k].tur === 'fonksiyon' && ref[k].arite !== o[k].arite)
              ariteFarki.push(k + ': en=' + ref[k].arite + ' ' + d + '=' + o[k].arite);
            if (o[k].bos) boslar.push(k);
            if (ref[k].uzunluk !== null && ref[k].uzunluk !== o[k].uzunluk)
              diziBoyu.push(k + ': en=' + ref[k].uzunluk + ' ' + d + '=' + o[k].uzunluk);
          }
          kayit.karsilastirma[d] = { eksik, fazla, turFarki, ariteFarki, boslar,
                                     diziBoyu, refSayi: Object.keys(ref).length };
        }
      }
      sonuc.sozlukler[ad] = kayit;
    }
    return sonuc;
  });

  // ── Bekci: test gercekten bir sey olcuyor mu ───────────────────────
  dene('★ bekçi: yedi sözlüğün hepsi bulundu', () => {
    assert.deepStrictEqual(rapor.bulunamayan, [],
      'Bu sözlükler uygulamada bulunamadı (adı mı değişti?):\n    ' +
      rapor.bulunamayan.join(', ') +
      '\n  ⛔ Bulunamayan sözlük DENETLENMEMIS olur; test sessizce boş tarar.');
  });

  dene('★ bekçi: en az iki dil var', () => {
    assert.ok(rapor.diller.length >= 2,
      'LANG içinde ' + rapor.diller.length + ' dil var: ' + rapor.diller.join(', '));
  });

  dene('bekçi: ana sözlük gerçekten dolu (boş tarama değil)', () => {
    const n = (rapor.sozlukler.LANG || {}).karsilastirma || {};
    const ilk = Object.values(n)[0];
    assert.ok(ilk && ilk.refSayi > 900,
      'LANG referansında ' + (ilk ? ilk.refSayi : 0) + ' anahtar sayıldı, 900+ bekleniyordu');
  });

  // ── Her sozluk, her dil ────────────────────────────────────────────
  const mazeret  = (sz, k) => Object.prototype.hasOwnProperty.call(MAZERETLI, sz + '.' + k);
  const bosOlur  = (sz, k) => Object.prototype.hasOwnProperty.call(BOS_OLABILIR, sz + '.' + k);

  for (const [ad, kayit] of Object.entries(rapor.sozlukler)) {
    dene(ad + ': `en` dili var (referans)', () => {
      assert.ok(kayit.enVar,
        ad + ' içinde `en` yok. t() eksik anahtarda `en`e düşüyor, ' +
        'yani `en` olmadan hiçbir yedek kalmaz.');
    });

    for (const [d, c] of Object.entries(kayit.karsilastirma)) {
      const eksik = c.eksik.filter(k => !mazeret(ad, k));
      const fazla = c.fazla.filter(k => !mazeret(ad, k));

      dene('★ ' + ad + ' / ' + d + ': EKSIK anahtar yok', () => {
        assert.deepStrictEqual(eksik, [],
          eksik.length + ' anahtar `en`de var, `' + d + '`de YOK:\n    ' +
          eksik.slice(0, 25).join('\n    ') +
          (eksik.length > 25 ? '\n    … ve ' + (eksik.length - 25) + ' tane daha' : '') +
          '\n  Ekranda İngilizcesi görünür — yarım çeviri sessizce kalır.');
      });

      dene('★ ' + ad + ' / ' + d + ': FAZLA anahtar yok', () => {
        assert.deepStrictEqual(fazla, [],
          fazla.length + ' anahtar `' + d + '`de var, `en`de YOK:\n    ' +
          fazla.slice(0, 25).join('\n    ') +
          '\n  Çoğu zaman yazım hatası: o anahtar hiç kullanılmıyor, ' +
          'kullanıldığı yer ise `en`de yedeksiz.');
      });

      dene(ad + ' / ' + d + ': tür uyuşmazlığı yok (metin / fonksiyon)', () => {
        assert.deepStrictEqual(c.turFarki, [],
          'Aynı anahtar bir dilde metin, ötekinde fonksiyon:\n    ' +
          c.turFarki.join('\n    ') +
          '\n  Çağıran taraf birini çağırıp ötekini yazdırır: ya ekranda ' +
          '"function (n) {…}" çıkar ya da TypeError.');
      });

      dene(ad + ' / ' + d + ': fonksiyon arite uyuşmazlığı yok', () => {
        assert.deepStrictEqual(c.ariteFarki, [],
          'Aynı anahtarın fonksiyonu farklı sayıda argüman alıyor:\n    ' +
          c.ariteFarki.join('\n    '));
      });

      const boslar = c.boslar.filter(k => !bosOlur(ad, k));
      dene(ad + ' / ' + d + ': boş metin yok', () => {
        assert.deepStrictEqual(boslar, [],
          'Bu anahtarlar var ama metni BOŞ — ekranda sessiz boşluk:\n    ' +
          boslar.join('\n    ') +
          '\n  Cümlenin tamamını oku: gerçekten o dilde boş kalması ' +
          'gerekiyorsa\n  BOS_OLABILIR listesine SEBEBİYLE ekle. ' +
          'Gerekmiyorsa çeviriyi yaz.');
      });

      dene(ad + ' / ' + d + ': dizi boyları eşit', () => {
        assert.deepStrictEqual(c.diziBoyu, [],
          'Dizi uzunlukları farklı (tur adımı ya da `points` sayısı):\n    ' +
          c.diziBoyu.join('\n    ') +
          '\n  Bir dilde anlatılan bir madde ötekinde hiç yok.');
      });
    }
  }

  await p.close();
  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
