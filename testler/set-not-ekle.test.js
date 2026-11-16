// SETE TEK DUGMEYLE MADDE EKLEME (7) + SETTE NOT (8).
//
// NEDEN BU TEST VAR
//   16 Kasim 2026'da set yapisi degisti: `maddeler` DUZ METIN dizisiyken
//   { metin, not } nesnesine dondu.
//
//   ⛔ EN PAHALI HATA GOC HATASI. setTemizle HER OKUMA YOLUNDA duruyor
//      (readSetler ve setlerBuluttan). Eski bicimi kabul etmezse
//      kullanicinin KAYITLI SETLERI hem tarayicidan hem buluttan
//      SESSIZCE SILINIR -- ekranda hicbir sey patlamaz, setler bir
//      sabah yok olur. Bu testin birinci isi o yolu kapali tutmak.
//
//   Oncesinde var olan bir sete madde eklemenin tek yolu seti AYNI ADLA
//   bastan yaratmakti (setYap ayni adli seti siliyor): uc adim, ve adi
//   yeniden yazmak. Kullanici "tek dugmeyle" istedi.
//
//   Hazir setler kodun icinde METIN, hicbir yere kaydedilmiyor ve
//   herkeste ayni -- uzerine madde eklenemez. Kullanicinin karari
//   (16 Kasim 2026): "+" once KENDI setlerine bir kopya cikariyor.
//
// NE OLCUYOR
//   1. GOC: eski duz-metin set okununca KAYBOLMUYOR, nesneye donuyor
//   2. Not set icinde duruyor ve listeye GERI yaziliyor (8. madde)
//   3. "+" tek basista ekliyor, ayni maddeyi iki kez eklemiyor
//   4. "+" YALNIZCA secim varken ve YALNIZCA kutuphane sayfasinda
//   5. Hazir set kopyalaniyor; ayni adli varsa USTUNE YAZMIYOR, birlesiyor
//   6. Hazir setten yalnizca 'canta' kopyalaniyor ('yap' bir is, malzeme degil)

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8147;           // ⛔ 8097-8099 kosucunun; asla kullanma
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
        u === '.css'  ? 'text/css; charset=utf-8' :
        u === '.js'   ? 'text/javascript' :
        u === '.json' ? 'application/json' :
        u === '.svg'  ? 'image/svg+xml' : 'application/octet-stream' });
      cevap.end(veri);
    });
  });
  await new Promise(r => sunucu.listen(PORT, r));
  const tarayici = await chromium.launch();
  const p = await tarayici.newPage({ viewport: { width: 1280, height: 950 } });
  const sayfaHatalari = [];
  p.on('pageerror', e => sayfaHatalari.push(String(e).slice(0, 160)));
  await p.goto('http://localhost:' + PORT + '/app.html');
  await p.waitForFunction(() => typeof setTemizle === 'function', { timeout: 30000 });
  await p.waitForTimeout(500);

  // ── 1. GOC ─────────────────────────────────────────────────────────
  const goc = await p.evaluate(() => {
    const eski = setTemizle({ ad: 'Eski set', maddeler: ['Powerbank', 'Yedek pil', ''] });
    const yeni = setTemizle({ ad: 'Yeni set',
      maddeler: [{ metin: 'Powerbank', not: 'yan cep' }, { metin: 'Tripod', not: '' }] });
    const karisik = setTemizle({ ad: 'Karisik',
      maddeler: ['Mikrofon', { metin: 'Kedi', not: 'kirmizi kutu' }] });
    // Eski bicim localStorage'dan okununca da kaybolmamali.
    let okunan = null;
    try {
      localStorage.setItem('demo_ihtiyac_setleri',
        JSON.stringify([{ id: 'st_x', ad: 'Diskten', maddeler: ['Lens bezi', 'Kart'] }]));
      okunan = readSetler();
    } catch (e) { okunan = 'HATA: ' + e.message; }
    return { eski, yeni, karisik, okunan };
  });

  dene('★ GÖÇ: eski düz-metin set KAYBOLMUYOR', () => {
    assert.ok(goc.eski, 'setTemizle eski biçimi reddetti — bütün kayıtlı setler silinirdi');
    assert.deepStrictEqual(goc.eski.maddeler,
      [{ metin: 'Powerbank', not: '' }, { metin: 'Yedek pil', not: '' }],
      'eski biçim nesneye çevrilmedi');
  });
  dene('★ GÖÇ: diskteki eski kayıt okunuyor', () => {
    assert.ok(Array.isArray(goc.okunan) && goc.okunan.length === 1,
      'readSetler eski kaydı düşürdü: ' + JSON.stringify(goc.okunan));
    assert.strictEqual(goc.okunan[0].maddeler.length, 2);
    assert.strictEqual(goc.okunan[0].maddeler[0].metin, 'Lens bezi');
  });
  dene('yeni biçim notu koruyor', () => {
    assert.strictEqual(goc.yeni.maddeler[0].not, 'yan cep');
  });
  dene('karışık dizi de kabul ediliyor', () => {
    assert.strictEqual(goc.karisik.maddeler.length, 2);
    assert.strictEqual(goc.karisik.maddeler[1].not, 'kirmizi kutu');
  });

  // ── 2. NOT: liste -> set -> liste ──────────────────────────────────
  const notTur = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    document.querySelectorAll('.overlay.open').forEach(e => e.classList.remove('open'));
    ihtiyacSetleri = []; saveSetler();
    const pr = { ...projects[0], id: 'p_nottur', name: 'Not turu', placeIds: [], placeId: '',
                 cautions: '', checklist: [] };
    projects.push(pr); saveProjects();
    cekimListesiAc('p_nottur');
    await bekle(200);
    // Kutuphaneden bir madde + notu
    if (!ihtiyaclar.length) ihtiyaclar.push({ id: 'ih_t1', ad: 'Powerbank', grup: '' });
    const m = ihtiyaclar[0];
    listeMaddeEkle(m.ad, 'kutuphane', m.grup, 'çantanın yan cebinde');
    const listeOnce = projeListesi(projectById('p_nottur')).map(x => ({ metin: x.metin, not: x.not }));
    // Set yap (pencere kipi: adaylar listeden gelir)
    const s = setTemizle({ ad: 'Not seti',
      maddeler: projeListesi(projectById('p_nottur'))
        .filter(x => x.kaynak === 'kutuphane' || x.kaynak === 'canta')
        .map(x => ({ metin: x.metin, not: x.not || '' })) });
    ihtiyacSetleri = [s]; saveSetler();
    // Listeyi bosalt, seti geri ekle
    projeListesiYaz(projectById('p_nottur'), []);
    setiListeyeEkle(s.id);
    await bekle(120);
    const listeSonra = projeListesi(projectById('p_nottur')).map(x => ({ metin: x.metin, not: x.not }));
    cekimListesiKapat();
    return { listeOnce, setMaddeleri: s.maddeler, listeSonra };
  });

  dene('★ NOT sete kaydediliyor (8. madde)', () => {
    assert.ok(notTur.setMaddeleri.length, 'set boş kuruldu');
    assert.strictEqual(notTur.setMaddeleri[0].not, 'çantanın yan cebinde',
      'not sete girmedi: ' + JSON.stringify(notTur.setMaddeleri));
  });
  dene('★ NOT setten listeye GERİ yazılıyor', () => {
    assert.ok(notTur.listeSonra.length, 'set listeye hiç eklenmedi');
    assert.strictEqual(notTur.listeSonra[0].not, 'çantanın yan cebinde',
      'not geri gelmedi — eskiden tam burada kayboluyordu: ' +
      JSON.stringify(notTur.listeSonra));
  });

  // ── 3-4. "+" DUGMESI ───────────────────────────────────────────────
  const art = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    document.querySelectorAll('.overlay.open').forEach(e => e.classList.remove('open'));
    ihtiyaclar = [{ id: 'ih_a', ad: 'Alfa', grup: '' },
                  { id: 'ih_b', ad: 'Beta', grup: '' },
                  { id: 'ih_c', ad: 'Gama', grup: '' }];
    ihtiyacSetleri = [setTemizle({ id: 'st_h', ad: 'Hedef', maddeler: ['Alfa'] })];
    saveSetler();
    sayfaSecimi.clear();
    document.getElementById('tabKit').click();
    await bekle(200);
    kitSayfasiCiz();
    const secimsiz = document.querySelectorAll('#ihs_setler [data-set-art]').length;
    // Pencere kipinde ('ih') hic cikmamali
    setleriCiz('ih');
    const pencerede = document.querySelectorAll('#ih_setler [data-set-art]').length;

    sayfaSecimi.add('ih_b'); sayfaSecimi.add('ih_c');
    kitSayfasiCiz();
    const secimli = document.querySelectorAll('#ihs_setler [data-set-art]').length;

    const dugme = document.querySelector('#ihs_setler [data-set-art="st_h"]');
    dugme.click();
    await bekle(120);
    const sonra = ihtiyacSetleri.find(x => x.id === 'st_h');
    const secimKaldi = sayfaSecimi.size;
    // Ikinci kez basinca tekrar eklememeli
    const dugme2 = document.querySelector('#ihs_setler [data-set-art="st_h"]');
    if (dugme2) dugme2.click();
    await bekle(120);
    const ikinci = ihtiyacSetleri.find(x => x.id === 'st_h');
    return { secimsiz, pencerede, secimli,
             maddeler: sonra.maddeler.map(x => x.metin), secimKaldi,
             ikinciSayi: ikinci.maddeler.length };
  });

  dene('★ "+" seçim YOKKEN görünmüyor', () => {
    assert.strictEqual(art.secimsiz, 0, '+ seçimsizken de çizilmiş');
  });
  dene('★ "+" pencerede (çoklu seçim yok) görünmüyor', () => {
    assert.strictEqual(art.pencerede, 0, 'pencerede + çizilmiş; orada seçim diye bir şey yok');
  });
  dene('"+" seçim varken görünüyor', () => {
    assert.strictEqual(art.secimli, 1, art.secimli + ' tane + çizildi, 1 bekleniyordu');
  });
  dene('★ "+" tek basışta ekliyor', () => {
    assert.deepStrictEqual(art.maddeler, ['Alfa', 'Beta', 'Gama'],
      'sete eklenen yanlış: ' + JSON.stringify(art.maddeler));
  });
  dene('★ ekledikten sonra seçim KAYBOLMUYOR', () => {
    assert.strictEqual(art.secimKaldi, 2,
      'seçim silindi (' + art.secimKaldi + '). Çipin kendi tıklaması seti AÇIYOR; ' +
      '+ onu durdurmazsa kullanıcı eklediği anda seçimini kaybeder.');
  });
  dene('★ aynı madde İKİ KEZ eklenmiyor', () => {
    assert.strictEqual(art.ikinciSayi, 3,
      'ikinci basışta set ' + art.ikinciSayi + ' maddeye çıktı');
  });

  // ── 5-6. HAZIR SET KOPYALAMA ───────────────────────────────────────
  const kopya = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    ihtiyacSetleri = []; saveSetler();
    const h = hazirSetler()[0];
    const cantaSayi = h.m.filter(x => x[0] === 'canta').length;
    const yapSayi   = h.m.filter(x => x[0] === 'yap').length;
    hazirSetiKopyala(0);
    await bekle(100);
    const bir = ihtiyacSetleri.find(x => x.ad === h.ad);
    // Ayni adli set varken tekrar kopyalayinca USTUNE YAZMAMALI
    const once = bir ? bir.maddeler.length : 0;
    // ⚠ Kopyanin icerigi BURADA okunuyor: asagida `bir.maddeler`
    //   kullanicinin kendi maddesiyle degistiriliyor ve donus aninda
    //   okunsaydi bir fazla sayardi (ilk surumde tam bu oldu).
    const kopyaMetinleri = bir ? bir.maddeler.map(x => x.metin) : [];
    if (bir) {
      bir.maddeler = bir.maddeler.concat([{ metin: 'Kullanicinin kendi maddesi', not: '' }]);
      ihtiyacSetleri = ihtiyacSetleri.map(x => x.id === bir.id ? setTemizle(bir) : x);
      saveSetler();
    }
    const kendiEklenmis = ihtiyacSetleri.find(x => x.ad === h.ad).maddeler.length;
    hazirSetiKopyala(0);
    await bekle(100);
    const ikinci = ihtiyacSetleri.find(x => x.ad === h.ad);
    return { ad: h.ad, cantaSayi, yapSayi, once, kopyaMetinleri,
             kendiEklenmis, ikinciSayi: ikinci.maddeler.length,
             kendiDuruyor: ikinci.maddeler.some(x => x.metin === 'Kullanicinin kendi maddesi'),
             setSayisi: ihtiyacSetleri.length };
  });

  // ⚠ Bu iki kontrol AYRI SEYLER olcuyor. Ilk surumde ikisi de
  //   `once === cantaSayi` diyordu; mutasyon denemesinde ("yap"
  //   maddeleri de kopyalansin) kirmizi YANLIS kontrolden yandi.
  //   Her iddia tek sey olcecek.
  dene('★ hazır set kendi setlerine kopyalanıyor', () => {
    assert.strictEqual(kopya.setSayisi, 1, kopya.setSayisi + ' set oluştu, 1 bekleniyordu');
    assert.ok(kopya.once > 0, 'set boş kopyalandı');
    assert.strictEqual(kopya.kopyaMetinleri.length, kopya.once);
  });
  dene('★ hazır setten YALNIZCA çanta maddeleri kopyalanıyor', () => {
    assert.ok(kopya.yapSayi > 0, 'bu hazır sette "yap" maddesi yok — ölçü boş kalır');
    assert.strictEqual(kopya.once, kopya.cantaSayi,
      '"yap" maddeleri de kopyalanmış. Set "benim malzemem" demek; ' +
      '"30 saniye oda sesi kaydet" bir iş, malzeme değil.');
  });
  dene('★ ikinci kopyalama ÜSTÜNE YAZMIYOR, birleştiriyor', () => {
    assert.strictEqual(kopya.kendiDuruyor, true,
      'kullanıcının kendi eklediği madde silinmiş — kopyalama üstüne yazmış');
    assert.strictEqual(kopya.ikinciSayi, kopya.kendiEklenmis,
      'birleştirme madde sayısını değiştirdi: ' + kopya.kendiEklenmis +
      ' -> ' + kopya.ikinciSayi);
  });

  dene('sayfada JS hatası yok', () => {
    assert.deepStrictEqual(sayfaHatalari, [], sayfaHatalari.join('\n    '));
  });

  await p.close();
  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
