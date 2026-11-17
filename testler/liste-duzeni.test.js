// CEKIM LISTESI EKRANI, EKLEME EKRANIYLA AYNI DILI KONUSSUN
// (YAPILACAKLAR 55. madde)
//
// NEDEN BU TEST VAR
//   Kullanici bildirdi (17 Kasim 2026, ekran goruntusuyle):
//   "Ekleme yapildiktan sonra Cekim Listesine tikladim, liste acik ve
//    bir onceki eklediğim alandan FARKLI olarak geliyor... Bu ekran
//    kullanicinin kafasini karistiriyor, farkli bir liste gibi
//    geliyor."
//
//   Sebep KODDAN bulundu: cekim listesi maddeleri hangi setten
//   geldiklerini KAYDETMIYORDU. Elde yalnizca `kaynak` vardi
//   (canta/yap) ve ekran ona gore grupluyordu -- ekrandaki "CANTA" ve
//   "YAP" basliklari o. Oneri bolumu ise SETLERE gore diziliyordu.
//   Iki ekran ayni seyi iki ayri dille gosteriyordu.
//
//   Kullanicinin istedigi akis, kendi siralamasiyla:
//     1. Listeleri ekler ve kaydeder.
//     2. Projeye girer; cekim listesine TIKLAMADAN, basligin altinda
//        ekledigi listeleri "+" isaretli gorur.
//     3. "+" ile acar, tikleri kaldirir, not yazar.
//     4. Kaydeder, kapatir.
//
// ⛔ EN ONEMLI IDDIA ASAGIDA: set anahtari OLMAYAN maddeler (17 Kasim
//    oncesi kayitlar ve elle yazilanlar) KAYBOLMUYOR. Onlari zorla bir
//    sete atamak ya da gizlemek VERI KAYBI olurdu.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8159;           // ⛔ 8097-8099 kosucunun; asla kullanma
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
  const p = await tarayici.newPage({ viewport: { width: 1280, height: 900 } });
  const sayfaHatasi = [];
  p.on('pageerror', e => sayfaHatasi.push(String(e.message).slice(0, 120)));
  await p.goto('http://localhost:' + PORT + '/app.html');
  await p.waitForFunction(() => typeof openProjectNew === 'function', { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.setItem('demo_tour_done', '1');
                                 localStorage.setItem('demo_seen_intro', '1'); } catch (e) {} });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof openProjectNew === 'function', { timeout: 30000 });
  await p.waitForTimeout(900);

  // ── 1. BEYAZ LISTE: `set` alani korunuyor ─────────────────────────
  // ⛔ listeMaddeTemizle bir BEYAZ LISTE: yazilmayan alan her okumada
  //    sessizce silinir. Silinirse gruplama coker.
  const temiz = await p.evaluate(() => {
    const a = listeMaddeTemizle({ metin: 'X', kaynak: 'canta', set: 'konusmali' });
    const b = listeMaddeTemizle({ metin: 'X', kaynak: 'canta', set: 'BUYUK' });
    const c = listeMaddeTemizle({ metin: 'X', kaynak: 'canta' });
    return { a: a.set, b: b.set, c: c.set };
  });
  dene('★ listeMaddeTemizle `set` alanini KORUYOR', () => {
    assert.strictEqual(temiz.a, 'konusmali',
      'set silindi: cekim listesi set basligi altinda gruplayamaz');
  });
  dene('bozuk set degeri temizleniyor, eski kayit bozulmuyor', () => {
    assert.strictEqual(temiz.b, '', 'buyuk harfli deger suzulmedi');
    assert.strictEqual(temiz.c, '', 'alani olmayan kayit bozuldu');
  });

  // ── 2. Kullanicinin tarif ettigi akis ─────────────────────────────
  const akis = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    document.querySelectorAll('.overlay.open').forEach(e => e.classList.remove('open'));
    setLanguage('tr'); setPage('projects'); await bekle(250);
    const o = {};
    openProjectNew(''); await bekle(300);
    document.getElementById('pe_name').value = 'Liste duzeni';
    document.getElementById('pe_type').value = 'vlog';
    document.getElementById('pe_type').dispatchEvent(new Event('change'));
    const g = document.getElementById('pe_shoot');
    g.value = '2026-12-28'; g.dispatchEvent(new Event('change'));
    await bekle(300);
    // ⛔ 17 KASIM 2026 -- AYRI "Tikli setleri ekle" DUGMESI KALDIRILDI.
    //    Kullanici: "bu tus burada gereksiz bir hal aliyor... kullanici
    //    projeyi kayit ettiginde zaten bu secilenlerin de otomatik
    //    olarak kayit olmasi lazim." Secim artik projenin KENDI
    //    Kaydet / + Proje olustur tusuyla kaydediliyor.
    document.getElementById('pe_save').click(); await bekle(1400);
    document.querySelectorAll('#dlgOverlay.open').forEach(e => e.classList.remove('open'));
    await bekle(200);
    const pr = projects.find(x => x.name === 'Liste duzeni');
    o.maddeSayisi = pr ? (pr.checklist || []).length : -1;
    o.setAnahtarlari = pr ? Array.from(new Set((pr.checklist || []).map(x => x.set))) : [];
    o.projeId = pr ? pr.id : null;

    // Kapat, YENIDEN AC: kullanicinin tarif ettigi an
    closeProjectEdit(true); await bekle(300);
    // ⛔ KAPANDIGINI AYRICA OLCUYORUZ. Bu satir olmadan asagidaki
    //    "kendiliginden aciliyor" iddiasi YANLIS SEBEPLE gecer: bolum
    //    zaten ekleme akisindan acik kalmis olur ve olcu onu gorur.
    //    17 Kasim 2026'da mutasyon denemesi tam bunu yakaladi --
    //    kendiliginden acilma KALDIRILDIGI halde iddia yesil kaldi.
    o.kapatincaKapandi = !document.getElementById('cekimListesiOverlay')
      .classList.contains('open');
    window.scrollTo(0, 0);
    openProjectEdit(pr.id, true); await bekle(500);
    o.bolumKendiliginden = document.getElementById('cekimListesiOverlay')
      .classList.contains('open');
    o.sayfaKaymasi = Math.round(window.scrollY);
    const blok = () => Array.prototype.slice.call(
      document.querySelectorAll('#cl_liste .cl-blok'));
    o.grupSayisi = blok().length;
    o.basliklar = blok().map(b => b.querySelector('.cl-grup-ad').textContent.trim());
    o.isaretler = blok().map(b => b.querySelector('.cl-grup-ac').textContent.trim());
    o.kapaliykenSatir = document.querySelectorAll('#cl_liste .cl-satir').length;
    // "+" ile ac.
    // ⚠ DAYANIKLI OLMALI: bolum hic acilmamissa burada cokmek yerine
    //   olculeri bos birakip ASAGIDAKI IDDIALARIN konusmasini
    //   istiyoruz. 17 Kasim 2026'da mutasyon denemesinde test
    //   "Cannot read properties of null" diye coktu -- dusuyordu ama
    //   sebebi soylemiyordu.
    o.acik = { isaret: '', satir: 0, notDugmesi: 0, tikKutusu: 0,
               say: '', tiksiz: 0 };
    o.tikSonrasi = { say: '', isaret: '', satir: 0 };
    const ilkBlok = blok()[0];
    if (ilkBlok) {
      const dugme = ilkBlok.querySelector('.cl-grup-ac');
      if (dugme) dugme.click();
      await bekle(250);
      const b0 = blok()[0];
      if (b0) {
        o.acik = { isaret: (b0.querySelector('.cl-grup-ac') || {}).textContent || '',
                   satir: b0.querySelectorAll('.cl-satir').length,
                   notDugmesi: b0.querySelectorAll('[data-cl-notac]').length,
                   tikKutusu: b0.querySelectorAll('[data-cl-tik]').length,
                   say: ((b0.querySelector('.cl-grup-say') || {}).textContent || '').trim(),
                   tiksiz: b0.querySelectorAll('.cl-kutu:not(.on)').length };
        o.acik.isaret = String(o.acik.isaret).trim();
        const tik = b0.querySelector('[data-cl-tik]');
        if (tik) { tik.click(); await bekle(300); }
        const b1 = blok()[0];
        if (b1) {
          o.tikSonrasi = {
            say: ((b1.querySelector('.cl-grup-say') || {}).textContent || '').trim(),
            satir: b1.querySelectorAll('.cl-satir').length,
            isaret: ((b1.querySelector('.cl-grup-ac') || {}).textContent || '').trim() };
        }
      }
    }
    return o;
  });

  dene('★ maddeler HANGI SETTEN geldiklerini kaydediyor', () => {
    assert.ok(akis.maddeSayisi > 10, 'madde eklenmedi: ' + akis.maddeSayisi);
    assert.deepStrictEqual(akis.setAnahtarlari.slice().sort(), ['dis', 'konusmali'],
      'set anahtarlari yazilmamis: gruplama kaynak basliklarina duser');
  });
  dene('proje kapaninca cekim listesi bolumu de kapaniyor', () => {
    assert.strictEqual(akis.kapatincaKapandi, true,
      'bolum acik kaldi: baska projeye girildiginde ONCEKI projenin ' +
      'listesi gorunur (olculdu 17 Kasim 2026: bos projede "A dolu" basligi)');
  });
  dene('★ projeye girince bolum KENDILIGINDEN aciliyor', () => {
    assert.strictEqual(akis.kapatincaKapandi, true,
      'on sart saglanmadi: bolum zaten acikti, bu olcu bir sey kanitlamaz');
    assert.strictEqual(akis.bolumKendiliginden, true,
      'kullanici "cekim listesine bile tiklamadan" gormek istiyor');
  });
  dene('kendiliginden acilis sayfayi asagi KAYDIRMIYOR', () => {
    assert.ok(akis.sayfaKaymasi <= 2,
      'proje acilir acilmaz sayfanin altina dusuldu: ' + akis.sayfaKaymasi);
  });
  dene('★ gruplar SET ADIYLA geliyor (kaynak basligiyla degil)', () => {
    assert.strictEqual(akis.grupSayisi, 2, 'grup sayisi: ' + akis.grupSayisi);
    assert.deepStrictEqual(akis.basliklar.slice().sort(),
      ['Dış çekim', 'Konuşmalı çekim'],
      'basliklar set adi degil: ' + JSON.stringify(akis.basliklar));
  });
  dene('★ gruplar KAPALI basliyor, isaret "+"', () => {
    assert.deepStrictEqual(akis.isaretler, ['+', '+'],
      'isaretler: ' + JSON.stringify(akis.isaretler));
    assert.strictEqual(akis.kapaliykenSatir, 0,
      'kapaliyken madde satiri gorunuyor: ozet olmaz, sayfa uzar');
  });
  dene('★ "+" ile acilinca maddeler, tikler ve NOT alani geliyor', () => {
    assert.strictEqual(akis.acik.isaret, '−', 'isaret "−" olmadi');
    assert.ok(akis.acik.satir >= 5, 'madde satiri: ' + akis.acik.satir);
    assert.strictEqual(akis.acik.tikKutusu, akis.acik.satir, 'her maddede tik kutusu yok');
    assert.strictEqual(akis.acik.tiksiz, 0,
      'tiksiz satir var: hepsi TIKLI gelmeli (tik = "bu madde listede")');
    assert.strictEqual(akis.acik.notDugmesi, akis.acik.satir,
      'her maddede not alani yok: kullanici "altinda not alanlari bulunmali" dedi');
  });
  dene('madde tiklaninca grup sayisi artiyor, grup ACIK kaliyor', () => {
    // ⛔ 17 KASIM 2026 -- TIKIN ANLAMI DEGISTI. Eskiden tik "bitti"
    //    demekti ve bu olcu grup sayacinin payini ("1/9") okuyordu.
    //    Kullanici bunu karisiklik olarak bildirdi; karar: hepsi TIKLI
    //    gelir, tikten cikarmak maddeyi LISTEDEN cikarir. Sayacta pay
    //    kalmadi, grup "9 madde" yaziyor. Guvence ayni kaldi: tiklamak
    //    sayaci tazeliyor ve grubu KAPATMIYOR.
    assert.strictEqual(akis.tikSonrasi.satir, akis.acik.satir - 1,
      'tikten cikarmak satiri listeden dusurmedi: ' +
      akis.acik.satir + ' -> ' + akis.tikSonrasi.satir);
    assert.notStrictEqual(akis.tikSonrasi.say, akis.acik.say,
      'grup sayaci tazelenmedi: ' + akis.acik.say);
    assert.strictEqual(akis.tikSonrasi.isaret, '−', 'tiklayinca grup kapandi');
  });

  // ── 3. ⛔ SET ANAHTARI OLMAYAN MADDE KAYBOLMUYOR ──────────────────
  // 17 Kasim 2026 oncesi kayitlar ve elle yazilan maddeler boyle.
  const eski = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    const pr = projects.find(x => x.name === 'Liste duzeni');
    const liste = projeListesi(pr).concat([
      listeMaddeTemizle({ metin: 'Elle yazdigim madde', kaynak: 'elle' }),
      listeMaddeTemizle({ metin: 'Eski set maddesi', kaynak: 'canta' })
    ]);
    projeListesiYaz(pr, liste);
    cekimListesiCiz(); await bekle(300);
    const bloklar = Array.prototype.slice.call(
      document.querySelectorAll('#cl_liste .cl-blok'));
    // Hepsini ac, butun metinleri topla.
    // ⛔ HER TIKLAMA BOLUMU YENIDEN CIZIYOR: `bloklar` dizisindeki
    //    ogeler ilk tiklamadan sonra ARTIK BELGEDE DEGIL ve onlara
    //    tiklamak hicbir sey yapmaz. 17 Kasim 2026'da bu test tam bu
    //    yuzden "ekranda 10, listede 19" dedi -- uygulama degil, test
    //    yaniliyordu. Her seferinde TAZE sorgu sart.
    for (let i = 0; i < bloklar.length; i++) {
      const taze = document.querySelectorAll('#cl_liste .cl-blok')[i];
      const dugme = taze && taze.querySelector('.cl-grup-ac');
      if (dugme && dugme.textContent.trim() === '+') dugme.click();
      await bekle(150);
    }
    await bekle(300);
    const metinler = Array.prototype.slice.call(
      document.querySelectorAll('#cl_liste .cl-metin')).map(x => x.textContent.trim());
    return { grupSayisi: bloklar.length,
             basliklar: bloklar.map(b => b.querySelector('.cl-grup-ad').textContent.trim()),
             metinler,
             listeUzunlugu: projeListesi(pr).length };
  });
  dene('★ set anahtari OLMAYAN maddeler KAYBOLMUYOR', () => {
    assert.ok(eski.metinler.indexOf('Elle yazdigim madde') !== -1,
      'elle yazilan madde ekrandan kayboldu -- veri kaybi gibi gorunur');
    assert.ok(eski.metinler.indexOf('Eski set maddesi') !== -1,
      'eski (set anahtarsiz) madde ekrandan kayboldu');
  });
  dene('eski maddeler ZORLA bir sete atanmiyor', () => {
    assert.ok(eski.grupSayisi >= 3,
      'eski maddeler icin ayri grup acilmadi, grup sayisi: ' + eski.grupSayisi +
      ' -- baslikllar: ' + JSON.stringify(eski.basliklar));
  });
  dene('ekrandaki madde sayisi listedekiyle ayni', () => {
    assert.strictEqual(eski.metinler.length, eski.listeUzunlugu,
      'ekranda ' + eski.metinler.length + ', listede ' + eski.listeUzunlugu);
  });

  // ── 4. ⛔ BOS PROJEDE BASKA PROJENIN LISTESI GORUNMESIN ──────────
  // Olculdu (17 Kasim 2026): bolum proje kapaninca kapanmadigi icin,
  // bos bir projeye girince ONCEKI projenin listesi "A dolu" basligiyla
  // acik duruyordu. Kullanici baskasinin cekim listesini kendi projesi
  // sanirdi.
  const bayat = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    closeProjectEdit(true); await bekle(250);
    const bos = sanitizeProject({ id: 'pr_bos55', name: 'Bos proje', type: 'desk' });
    projects.push(bos);
    openProjectEdit('pr_bos55', true); await bekle(400);
    const o = {
      bolumAcik: document.getElementById('cekimListesiOverlay').classList.contains('open'),
      kendiListesi: (bos.checklist || []).length
    };
    projects = projects.filter(x => x.id !== 'pr_bos55');
    return o;
  });
  dene('★ BOS projede bolum acilmiyor (bayat liste gorunmez)', () => {
    assert.strictEqual(bayat.kendiListesi, 0, 'test kurulumu bozuk: proje bos degil');
    assert.strictEqual(bayat.bolumAcik, false,
      'bos projede bolum acik: onceki projenin listesi gorunur');
  });

  // ── 5. ⛔ IKI EKRAN AYNI GORUNMELI ──────────────────────────────
  // Kullanici UCUNCU kez bildirdi (17 Kasim 2026, iki ekran
  // goruntusuyle): "burasi kullanicinin kafasini karistiriyor...
  // ikinci ekran goruntusunde secim alani TEMIZ, ayni sekilde
  // birincisi de olsun; kullanici her iki tarafta da AYNI seyi gorur."
  //
  // Ilk iki turda yalnizca GRUPLAMA ayni yapilmisti; SATIRIN KENDISI
  // kart olarak kalmisti (cerceve + zemin + 7px alt bosluk + 26px
  // kutu, yukseklik 41,5'e karsi 26). Bu bolum tam o farki olcuyor.
  const esit = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    openProjectNew(''); await bekle(300);
    document.getElementById('pe_name').value = 'Esitlik olcumu';
    document.getElementById('pe_type').value = 'vlog';
    document.getElementById('pe_type').dispatchEvent(new Event('change'));
    const g = document.getElementById('pe_shoot');
    g.value = '2026-12-30'; g.dispatchEvent(new Event('change'));
    await bekle(350);
    const bic = (el, yaziEl) => { const c = getComputedStyle(el);
      const k = el.getBoundingClientRect();
      return { dolgu: c.paddingTop + '/' + c.paddingBottom + '/' + c.paddingLeft,
               cerceve: c.borderTopWidth + '/' + c.borderLeftWidth,
               zemin: c.backgroundColor, altBosluk: c.marginBottom,
               yazi: getComputedStyle(yaziEl || el).fontSize,
               yukseklik: Math.round(k.height) }; };
    const om = document.querySelector('[data-somad]').closest('label');
    o.oneri = bic(om, om.querySelector('span'));
    // ⛔ 17 KASIM 2026 -- AYRI "Tikli setleri ekle" DUGMESI KALDIRILDI.
    //    Kullanici: "bu tus burada gereksiz bir hal aliyor... kullanici
    //    projeyi kayit ettiginde zaten bu secilenlerin de otomatik
    //    olarak kayit olmasi lazim." Secim artik projenin KENDI
    //    Kaydet / + Proje olustur tusuyla kaydediliyor.
    document.getElementById('pe_save').click(); await bekle(1400);
    document.querySelectorAll('#dlgOverlay.open').forEach(e => e.classList.remove('open'));
    await bekle(200);
    // ⚠ Kaydet projeyi kaydedip SAYFAYI KAPATIYOR (normal kaydetme
    //   davranisi). Olcum icin projeye geri girmek gerekiyor; zaten
    //   kullanicinin akisi da bu -- 55. madde geri girince bolumu
    //   kendiliginden aciyor.
    const kayitli = projects.find(x => x.name === 'Esitlik olcumu');
    openProjectEdit(kayitli.id, true); await bekle(600);
    // ⚠ Geri girince bolum KAPALI gruplarla aciliyor (kullanicinin
    //   istedigi ozet). Satir olcmek icin bir grubu acmak gerekiyor.
    const ilkAc = document.querySelector('#cl_liste .cl-grup-ac');
    if (ilkAc) { ilkAc.click(); await bekle(400); }
    const cm = document.querySelector('#cl_liste .cl-satir');
    o.liste = bic(cm, cm.querySelector('.cl-metin'));
    o.girintiVar = !!document.querySelector('#cl_liste .cl-ic');
    // Parmak hedefi: kutudan 14 px uzakta hala kutu mu
    // ⛔ ONCE GORUNTUYE GETIR. `elementFromPoint` yalnizca EKRANDAKI
    //    noktalari goruyor; oge ekranin altinda kalirsa null doner ve
    //    olcu "tiklanamiyor" der. 17 Kasim 2026'da tam bu oldu: kutu
    //    y=1147'deydi, pencere 900 yuksekliginde -- uygulama degil
    //    OLCUM yaniliyordu.
    const kutu = cm.querySelector('.cl-kutu');
    kutu.scrollIntoView({ block: 'center' }); await bekle(250);
    const kk = kutu.getBoundingClientRect();
    const uzak = document.elementFromPoint(kk.left + kk.width / 2 - 14,
                                           kk.top + kk.height / 2);
    o.uzaktanTiklanir = !!(uzak && uzak.closest('.cl-kutu'));
    o.kutuGorunen = Math.round(kk.width);
    // Not kutusu metnin ALTINDA ve tam genislikte mi
    const notBtn = cm.querySelector('[data-cl-notac]');
    if (notBtn) { notBtn.click(); await bekle(350); }
    const s2 = document.querySelector('#cl_liste .cl-satir');
    const nt = s2.querySelector('.cl-not');
    o.not = nt ? {
      altinda: Math.round(nt.getBoundingClientRect().top) >
               Math.round(s2.querySelector('.cl-metin').getBoundingClientRect().top),
      tamGenislik: Math.abs(nt.getBoundingClientRect().width -
        s2.querySelector('.cl-orta').getBoundingClientRect().width) <= 2
    } : null;
    return o;
  });

  dene('★ iki ekranın satır BİÇİMİ aynı (kart değil, temiz satır)', () => {
    assert.strictEqual(esit.liste.cerceve, esit.oneri.cerceve,
      'çekim listesi satırı hâlâ çerçeveli: kart gibi görünüyor');
    assert.strictEqual(esit.liste.zemin, esit.oneri.zemin,
      'çekim listesi satırının kendi zemini var: kart gibi görünüyor');
    assert.strictEqual(esit.liste.dolgu, esit.oneri.dolgu,
      'dolgular ayrı: ' + esit.liste.dolgu + ' / ' + esit.oneri.dolgu);
    assert.strictEqual(esit.liste.altBosluk, esit.oneri.altBosluk,
      'satır aralıkları ayrı: ' + esit.liste.altBosluk + ' / ' + esit.oneri.altBosluk);
    assert.strictEqual(esit.liste.yazi, esit.oneri.yazi,
      'yazı boyları ayrı: ' + esit.liste.yazi + ' / ' + esit.oneri.yazi);
  });
  dene('★ iki ekranın satır YÜKSEKLİĞİ aynı', () => {
    const fark = Math.abs(esit.liste.yukseklik - esit.oneri.yukseklik);
    assert.ok(fark <= 3,
      'satır yükseklikleri ayrı: liste ' + esit.liste.yukseklik +
      ', öneri ' + esit.oneri.yukseklik + ' (fark ' + fark +
      ') — göz bunu "başka bir liste" diye okuyor');
  });
  dene('maddeler set başlığının altına GİRİNTİLİ giriyor', () => {
    assert.strictEqual(esit.girintiVar, true);
  });
  dene('★ kutu küçüldü ama PARMAK HEDEFİ küçülmedi', () => {
    assert.ok(esit.kutuGorunen <= 20,
      'kutu hâlâ iri: ' + esit.kutuGorunen + 'px');
    assert.strictEqual(esit.uzaktanTiklanir, true,
      'kutunun 14 px uzağı tıklanamıyor: sahada parmakla nişan almak zorlaşır');
  });
  dene('not kutusu metnin ALTINDA ve tam genişlikte açılıyor', () => {
    assert.ok(esit.not, 'not kutusu hiç açılmadı');
    assert.strictEqual(esit.not.altinda, true, 'not kutusu metnin altında değil');
    assert.strictEqual(esit.not.tamGenislik, true, 'not kutusu tam genişlikte değil');
  });

  // ── 6. ⛔ HAZIR SETLER SERIDINDEKI "+" BU LISTEYE EKLER ──────────
  // Kullanici bildirdi (17 Kasim 2026): "hazir setleri hic bir sekilde
  // ekleyemiyorum, yanlarindaki + isareti calismiyor."
  // OLCULDU: calisiyordu ama seti "kendi setlerim"e KOPYALIYORDU ve
  // bunu soyledigi oge (ih_topluNot) Ihtiyac kutuphanesi penceresinde
  // -- cekim listesi acikken o pencere KAPALI. Gorunmez bir is.
  // Cekim listesinin icinde "+" dogal olarak "bu listeye ekle" demek.
  const serit = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    const pr = projects.find(x => x.name === 'Esitlik olcumu');
    cekimListesiAc(pr.id); await bekle(600);
    const fold = document.getElementById('cl_hsetFold');
    if (fold) fold.open = true;
    await bekle(250);
    const o = { artiSayisi: document.querySelectorAll('#cl_hset [data-hkopya]').length };
    const once = (projects.find(x => x.name === 'Esitlik olcumu').checklist || []).length;
    const setOnce = ihtiyacSetleri.length;
    // Henuz eklenmemis bir set: "Telefonla cekim"
    const artilar = Array.prototype.slice.call(
      document.querySelectorAll('#cl_hset [data-hkopya]'));
    if (artilar[3]) artilar[3].click();
    await bekle(700);
    o.listeArtti = (projects.find(x => x.name === 'Esitlik olcumu').checklist || []).length - once;
    o.kendiSetDegisti = ihtiyacSetleri.length - setOnce;
    // Onizleme panelinde ADIYLA duran kopyalama dugmesi
    const bak = document.querySelector('#cl_hset [data-hbak]');
    if (bak) bak.click(); await bekle(400);
    const kop = document.querySelector('#cl_hset [data-hkopyala]');
    o.kopyaDugmeMetni = kop ? kop.textContent.trim() : '';
    const setOnce2 = ihtiyacSetleri.length;
    if (kop) kop.click(); await bekle(600);
    o.kopyaCalisti = ihtiyacSetleri.length - setOnce2;
    return o;
  });
  dene('★ şeritteki "+" BU LİSTEYE ekliyor', () => {
    assert.ok(serit.artiSayisi >= 8, '"+" düğmeleri yok: ' + serit.artiSayisi);
    assert.ok(serit.listeArtti > 0,
      '"+" basıldı ama çekim listesine hiç madde girmedi — kullanıcının ' +
      '"çalışmıyor" dediği şey buydu');
    assert.strictEqual(serit.kendiSetDegisti, 0,
      '"+" hâlâ "kendi setlerim"e kopyalıyor: görünmez bir iş yapıyor');
  });
  dene('★ "Setlerime kopyala" kaybolmadı, ADIYLA duruyor', () => {
    assert.ok(serit.kopyaDugmeMetni.length > 3,
      'kopyalama düğmesi önizleme panelinde yok: işlev kayboldu');
    assert.strictEqual(serit.kopyaCalisti, 1,
      'kopyalama düğmesi çalışmıyor');
  });

  dene('sayfa hatasi yok', () => {
    assert.deepStrictEqual(sayfaHatasi, []);
  });

  await p.close();
  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
