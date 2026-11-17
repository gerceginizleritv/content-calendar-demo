// SET ONERISI: CEKIM TARIHI GIRILINCE HANGI SETLER ONERILIYOR
// (YAPILACAKLAR 10. madde)
//
// NEDEN BU TEST VAR
//   Kullanici eslesme tablosunu kendisi verdi (16 Kasim 2026): yedi
//   proje turunun her birinde hangi set TIKLI, hangisi TIKSIZ gelecek.
//   Tablo bir KARAR; koddaki eslesmenin ondan sapmasi sessiz bir hata
//   olur -- kullanici yanlis setleri goruр ekler ve sahada eksik kalir.
//
//   Kurulum kararlari (kullanici, 17 Kasim 2026):
//     - Oneri ACILIR PENCERE DEGIL, proje sayfasinin ICINDE bolum.
//       (Dun butun pencereler sayfaya cevrildi: "pop up cok kucuk".)
//     - Tetik: cekim tarihi ILK KEZ girildiginde.
//     - Masabasi/grafik turunde oneri HIC cikmiyor.
//     - Uc genel set (Onceki aksam / Kayda basmadan / Cekimden sonra)
//       her turde TIKSIZ listede duruyor.
//
// ⛔ ESLESME SIRAYA GORE DEGIL, SABIT ANAHTARA GORE olculuyor. Sekiz
//    setin her birinde `k` alani var. Siraya guvenen bir test, biri
//    sozlugu duzenleyip setleri yer degistirince YESIL kalirdi ve
//    eslesme sessizce bozulurdu -- bu deponun tekrarlayan hatasi.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8157;           // ⛔ 8097-8099 kosucunun; asla kullanma
const KOK = path.join(__dirname, '..');

// Kullanicinin tablosu, oldugu gibi. Testin TEK dogru kaynagi bu.
const TABLO = {
  outdoor: { tikli: ['dis'],             tiksiz: ['konusmali','telefon'] },
  venue:   { tikli: ['dis'],             tiksiz: ['konusmali','telefon'] },
  studio:  { tikli: ['konusmali'],       tiksiz: ['telefon'] },
  vlog:    { tikli: ['konusmali','dis'], tiksiz: ['telefon'] },
  review:  { tikli: ['konusmali'],       tiksiz: ['telefon'] },
  desk:    null,                         // oneri HIC cikmiyor
  other:   { tikli: [],                  tiksiz: ['dis','konusmali','telefon'] }
};
const GENEL = ['onceki','kayda','sonra'];

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
      // ⛔ .css dogru MIME ile servis edilmek zorunda: yanlis turde
      //    tarayici stil sayfasini REDDEDIYOR ve butun var(--…)
      //    degerleri bos cozuluyor. 16 Kasim 2026'da bu yuzden VAR
      //    OLMAYAN bir hata bildirilmisti.
      cevap.writeHead(200, { 'Content-Type':
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
  const p = await tarayici.newPage({ viewport: { width: 1280, height: 900 } });
  const sayfaHatasi = [];
  p.on('pageerror', e => sayfaHatasi.push(String(e.message).slice(0, 120)));
  await p.goto('http://localhost:' + PORT + '/app.html');
  await p.waitForFunction(() => typeof setOnerisiListesi === 'function', { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.setItem('demo_tour_done', '1');
                                 localStorage.setItem('demo_seen_intro', '1'); } catch (e) {} });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof setOnerisiListesi === 'function', { timeout: 30000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    document.querySelectorAll('.overlay.open').forEach(e => e.classList.remove('open'));
    setLanguage('tr');
  });

  // ── 1. ESLESME: yedi turun hepsi kullanicinin tablosuyla ayni ────
  const esleme = await p.evaluate((turler) => {
    const o = {};
    turler.forEach(tur => {
      const l = setOnerisiListesi({ type: tur });
      o[tur] = { tikli: l.filter(x => x.tikli).map(x => x.k),
                 tiksiz: l.filter(x => !x.tikli).map(x => x.k) };
    });
    o.__turler = PROJ_TYPES.slice();
    return o;
  }, Object.keys(TABLO));

  dene('★ proje turleri tabloyla ayni (yedi tane)', () => {
    assert.deepStrictEqual(esleme.__turler.slice().sort(),
      Object.keys(TABLO).slice().sort(),
      'PROJ_TYPES degismis: eslesme tablosu da guncellenmeli');
  });

  Object.keys(TABLO).forEach(tur => {
    const beklenen = TABLO[tur];
    const olculen = esleme[tur];
    if (beklenen === null) {
      dene('★ ' + tur + ': oneri HIC cikmiyor', () => {
        assert.deepStrictEqual(olculen.tikli, [], tur + ' icin tikli set var');
        assert.deepStrictEqual(olculen.tiksiz, [], tur + ' icin tiksiz set var');
      });
      return;
    }
    dene('★ ' + tur + ': TIKLI setler tabloyla ayni', () => {
      assert.deepStrictEqual(olculen.tikli, beklenen.tikli,
        tur + ' tikli: beklenen ' + JSON.stringify(beklenen.tikli) +
        ', olculen ' + JSON.stringify(olculen.tikli));
    });
    dene(tur + ': TIKSIZ setler tablo + uc genel set', () => {
      assert.deepStrictEqual(olculen.tiksiz, beklenen.tiksiz.concat(GENEL),
        tur + ' tiksiz: beklenen ' + JSON.stringify(beklenen.tiksiz.concat(GENEL)) +
        ', olculen ' + JSON.stringify(olculen.tiksiz));
    });
  });

  // ── 2. Kullanicinin uc yasagi ────────────────────────────────────
  dene('★ "telefon" HICBIR turde tikli gelmiyor', () => {
    const suclu = Object.keys(TABLO).filter(tur => esleme[tur].tikli.includes('telefon'));
    assert.deepStrictEqual(suclu, [],
      'telefon bir tur degil, cihaz secimi -- tikli gelmemeli: ' + JSON.stringify(suclu));
  });
  dene('★ "ucus" ve "soguk" hicbir turde YOK', () => {
    const suclu = [];
    Object.keys(TABLO).forEach(tur => {
      ['ucus','soguk'].forEach(k => {
        if (esleme[tur].tikli.includes(k) || esleme[tur].tiksiz.includes(k)) suclu.push(tur + '/' + k);
      });
    });
    assert.deepStrictEqual(suclu, [],
      'biri kullanicinin kendi secimi, oteki havaya gore (11. madde): ' + JSON.stringify(suclu));
  });
  dene('uc genel set her turde TIKSIZ (desk haric)', () => {
    Object.keys(TABLO).forEach(tur => {
      if (TABLO[tur] === null) return;
      GENEL.forEach(k => {
        assert.ok(esleme[tur].tiksiz.includes(k), tur + ' icinde ' + k + ' yok');
        assert.ok(!esleme[tur].tikli.includes(k), tur + ' icinde ' + k + ' TIKLI gelmis');
      });
    });
  });

  // ── 3. Sabit anahtarlar iki dilde de ayni ────────────────────────
  const anahtarlar = await p.evaluate(() => {
    const al = () => hazirSetler().map(x => x && x.k);
    setLanguage('tr'); const tr = al();
    setLanguage('en'); const en = al();
    setLanguage('tr');
    return { tr, en };
  });
  dene('★ sekiz setin anahtarlari IKI DILDE ayni sirada', () => {
    assert.deepStrictEqual(anahtarlar.tr, anahtarlar.en,
      'anahtarlar ayristi: eslesme bir dilde sessizce bozulur');
    assert.strictEqual(anahtarlar.tr.length, 8);
    assert.ok(anahtarlar.tr.every(k => typeof k === 'string' && k.length > 0),
      'anahtarsiz set var: ' + JSON.stringify(anahtarlar.tr));
  });

  // ── 4. ZATEN EKLENMIS set yeniden onerilmiyor ────────────────────
  const eklenmis = await p.evaluate(() =>
    setOnerisiListesi({ type: 'vlog', setOneri: { soruldu: false, eklenen: ['dis','onceki'] } })
      .map(x => x.k));
  dene('★ zaten eklenmis set listeye GIRMIYOR', () => {
    assert.ok(!eklenmis.includes('dis'), 'eklenmis "dis" yeniden onerildi');
    assert.ok(!eklenmis.includes('onceki'), 'eklenmis "onceki" yeniden onerildi');
    assert.ok(eklenmis.includes('konusmali'), 'eklenmemis "konusmali" kayboldu');
  });

  // ── 5. sanitizeProject ALANI KORUYOR (beyaz liste tuzagi) ────────
  // Alan beyaz listede olmasa HER OKUMADA sessizce silinirdi: "soruldu"
  // kaybolur ve oneri her acilista yeniden cikardi.
  const temiz = await p.evaluate(() => {
    const a = sanitizeProject({ id: 'pr_t1', name: 'T', type: 'vlog',
      setOneri: { soruldu: true, eklenen: ['dis','konusmali'] } });
    const b = sanitizeProject({ id: 'pr_t2', name: 'T', type: 'vlog',
      setOneri: { soruldu: 'evet', eklenen: ['DIS', 'x'.repeat(40), 'dis', 7] } });
    const c = sanitizeProject({ id: 'pr_t3', name: 'T', type: 'vlog' });
    return { a: a.setOneri, b: b.setOneri, c: c.setOneri };
  });
  dene('★ sanitizeProject setOneri alanini KORUYOR', () => {
    assert.strictEqual(temiz.a.soruldu, true, 'soruldu silindi: oneri her acilista cikar');
    assert.deepStrictEqual(temiz.a.eklenen, ['dis','konusmali'],
      'eklenen silindi: eklenmis set yeniden onerilir');
  });
  dene('sanitizeProject bozuk degeri temizliyor', () => {
    assert.strictEqual(temiz.b.soruldu, false, '"evet" metni true sayildi');
    assert.deepStrictEqual(temiz.b.eklenen, ['dis'],
      'buyuk harf / cok uzun / sayi suzulmedi: ' + JSON.stringify(temiz.b.eklenen));
  });
  dene('alani olmayan eski kayit bozulmuyor', () => {
    assert.deepStrictEqual(temiz.c, { soruldu: false, eklenen: [] });
  });

  // ── 6. TETIK: tarih ILK KEZ girilince ────────────────────────────
  const tetik = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    const bolum = () => document.getElementById('pe_oneri');
    const tarihGir = (deger) => {
      const g = document.getElementById('pe_shoot');
      g.value = deger; g.dispatchEvent(new Event('change'));
    };
    const o = {};
    // ⛔ YENI PROJE `openProjectNew()` ILE ACILIR, openProjectEdit(null)
    //    ILE DEGIL. openProjectEdit basinda `if(!p) return;` tasiyor,
    //    yani null ile HICBIR SEY YAPMIYOR: form eski projede kalir,
    //    `duzenlenenProje` degismez ve asagidaki olculer YANLIS SEBEPLE
    //    gecer. 17 Kasim 2026'da tam bu oldu: "Masabasi'nda acilmiyor"
    //    iddiasi, eslesme tablosuna desk eklenmis olmasina ragmen yesil
    //    kaldi -- cunku olculen sey desk degil, onceki projeydi.
    //    Mutasyon denemesi yakaladi.
    openProjectNew(''); await bekle(250);
    o.baslangicKapali = bolum().hidden;
    document.getElementById('pe_name').value = 'Tetik olcumu';
    document.getElementById('pe_type').value = 'vlog';
    document.getElementById('pe_type').dispatchEvent(new Event('change'));
    // (b) tarih girilince ACILIYOR
    tarihGir('2026-12-01'); await bekle(200);
    o.tarihleAcildi = !bolum().hidden;
    // (c) tarih SILINIRSE bir sey olmuyor
    setOnerisiKapat(); tarihGir(''); await bekle(150);
    o.bosTarihAcmadi = bolum().hidden;
    // (d) KAYITLI tarihi olan projede tarih degisimi ACMIYOR
    const kayitli = sanitizeProject({ id: 'pr_kayitli', name: 'Kayitli',
      type: 'vlog', shootDate: '2026-11-20' });
    projects.push(kayitli);
    openProjectEdit('pr_kayitli'); await bekle(250);
    tarihGir('2026-12-05'); await bekle(200);
    o.kayitliTarihAcmadi = bolum().hidden;
    // (e) "soruldu" isaretliyse ACMIYOR
    const sorulmus = sanitizeProject({ id: 'pr_sorulmus', name: 'Sorulmus',
      type: 'vlog', setOneri: { soruldu: true, eklenen: [] } });
    projects.push(sorulmus);
    openProjectEdit('pr_sorulmus'); await bekle(250);
    tarihGir('2026-12-07'); await bekle(200);
    o.sorulmusAcmadi = bolum().hidden;
    // (f) MASABASI turunde acilmiyor
    openProjectNew(''); await bekle(250);
    document.getElementById('pe_type').value = 'desk';
    document.getElementById('pe_type').dispatchEvent(new Event('change'));
    tarihGir('2026-12-09'); await bekle(200);
    o.deskAcmadi = bolum().hidden;
    // ⚠ Olcunun DOGRU SEBEPLE gectiginin kaniti: form gercekten yeni
    //    projede (duzenlenenProje null) ve oneri gercekten desk turune
    //    bakiyor. Bunlar olmadan iddia yanlis sebeple yesil kalabilir.
    o.deskDuzenlenen = duzenlenenProje ? duzenlenenProje.id : null;
    o.deskOneriTuru = setOnerisiProjesi().type;
    // Temizlik
    projects = projects.filter(x => x.id !== 'pr_kayitli' && x.id !== 'pr_sorulmus');
    closeProjectEdit ? closeProjectEdit(true) : null;
    return o;
  });
  dene('oneri bolumu form acilisinda KAPALI', () => {
    assert.strictEqual(tetik.baslangicKapali, true);
  });
  dene('★ tarih ILK KEZ girilince bolum ACILIYOR', () => {
    assert.strictEqual(tetik.tarihleAcildi, true, 'tetik hic calismadi');
  });
  dene('tarih silinince bolum acilmiyor', () => {
    assert.strictEqual(tetik.bosTarihAcmadi, true);
  });
  dene('★ KAYITLI tarihi olan projede tarih degisimi ACMIYOR', () => {
    assert.strictEqual(tetik.kayitliTarihAcmadi, true,
      'cekimi erteleyen kullanici ayni soruyu tekrar tekrar gorur');
  });
  dene('★ bir kez soruldugunda yeniden ACMIYOR', () => {
    assert.strictEqual(tetik.sorulmusAcmadi, true,
      'reddedilen oneri ayni proje icin yeniden soruluyor');
  });
  dene('★ Masabasi/grafik turunde HIC acilmiyor', () => {
    // Once olcunun DOGRU seyi olctugu kanitlaniyor, sonra sonuc.
    assert.strictEqual(tetik.deskDuzenlenen, null,
      'form yeni projede degil: olcu baska bir projeye bakiyor');
    assert.strictEqual(tetik.deskOneriTuru, 'desk',
      'oneri desk turune bakmiyor: olcu yanlis sebeple gecerdi');
    assert.strictEqual(tetik.deskAcmadi, true,
      'bos bir oneri bolumu kullaniciya "bir sey mi eksik?" dedirtir');
  });

  // ── 7. SETIN ICI GORUNUYOR, MADDE CIKARILABILIYOR ───────────────
  // Kullanici istedi (17 Kasim 2026): "bu setlerin icerikleri de
  // mutlaka gorunuyor olmali. Hatta bu setlerin icerisinde yer alan
  // bazi araclari da dilerse cikarabilmeli. Illa her vlogda hep ayni
  // araclari kullanmasi gerekmiyor."
  // Ayni sikayeti 16 Kasim'da 49. madde icin de yazmisti: "+ var ama
  // - yok."
  //
  // ⛔ VE BURADA BIR GERILEME BEKCISI VAR. 17 Kasim 2026'da kullanici
  //    su hatayi yasadi: "ekle dedim projeyi kaydettim ama projeyi
  //    geri acinca bunlarin hic biri gorunmuyordu."
  //    Sebep: `projeyiKaydet()` sonunda `closeProjectEdit()` cagiriyor,
  //    yani PROJE SAYFASINI KAPATIYOR. "Ekle" basilinca sayfa kapaniyor,
  //    proje listesi geri geliyor ve kullanici eklenen maddeleri
  //    hicbir yerde goremiyordu. Veri yerindeydi, GORUNMUYORDU.
  //    Asagidaki uc iddia (sayfa acik kaldi mi, duzenlenen proje dogru
  //    mu, cekim listesi acildi mi) o hatanin bekcisi.
  const ic = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    openProjectNew(''); await bekle(300);
    document.getElementById('pe_name').value = 'Ic olcumu';
    document.getElementById('pe_type').value = 'vlog';
    document.getElementById('pe_type').dispatchEvent(new Event('change'));
    const g = document.getElementById('pe_shoot');
    g.value = '2026-12-20'; g.dispatchEvent(new Event('change'));
    await bekle(250);
    o.acildi = !document.getElementById('pe_oneri').hidden;
    // ⛔ ICERIKLER ILK ACILISTA GORUNUR OLMALI. Kullanici karari
    //    (17 Kasim 2026): "ilk liste tavsiyesi geldiginde setlerin
    //    icerigi de altinda yer almali". Ilk surum kapali basliyordu
    //    ve kullanici "icerikler yine gorunmuyor" diye bildirdi.
    o.ilkAcilistaIcSatir = document.querySelectorAll('[data-somad]').length;
    o.dugmeIsaretiAcik = document.querySelector('[data-sobak="konusmali"]').textContent.trim();
    // "-" ile KAPAT
    document.querySelector('[data-sobak="konusmali"]').click(); await bekle(200);
    o.kapaninca = document.querySelectorAll('[data-somad^="konusmali:"]').length;
    o.dugmeIsaretiKapali = document.querySelector('[data-sobak="konusmali"]').textContent.trim();
    // "+" ile yeniden AC
    document.querySelector('[data-sobak="konusmali"]').click(); await bekle(200);
    const mad = Array.prototype.slice.call(
      document.querySelectorAll('[data-somad^="konusmali:"]'));
    o.icSatir = mad.length;
    o.metinVar = mad.every(x => (x.closest('label').textContent || '').trim().length > 2);
    o.hepsiTikli = mad.every(x => x.checked);
    const etiket = () => document.querySelector('[data-soblok="konusmali"] .set-oneri-adet').textContent;
    o.adetOnce = etiket();
    // Bir maddeyi tikten cikar
    o.cikarilan = (mad[0].closest('label').textContent || '').trim();
    mad[0].checked = false;
    mad[0].dispatchEvent(new Event('change', { bubbles: true })); await bekle(200);
    o.adetSonra = etiket();
    o.hala9Satir = document.querySelectorAll('[data-somad^="konusmali:"]').length;
    // Ekle
    // ⛔ 17 KASIM 2026 -- AYRI "Tikli setleri ekle" DUGMESI KALDIRILDI.
    //    Kullanici: "bu tus burada gereksiz bir hal aliyor... kullanici
    //    projeyi kayit ettiginde zaten bu secilenlerin de otomatik
    //    olarak kayit olmasi lazim." Secim artik projenin KENDI
    //    Kaydet / + Proje olustur tusuyla kaydediliyor.
    document.getElementById('pe_save').click(); await bekle(1400);
    document.querySelectorAll('#dlgOverlay.open').forEach(e => e.classList.remove('open'));
    await bekle(200);
    // Kaydet sayfayi kapatiyor (normal davranis). Kullanicinin akisi:
    // projeye GERI GIRIP ekledigini gormek.
    const kayitli = projects.find(x => x.name === 'Ic olcumu');
    openProjectEdit(kayitli.id, true); await bekle(600);
    o.geriGirinceAcik = document.getElementById('cekimListesiOverlay').classList.contains('open');
    o.geriGirinceSatir = document.querySelectorAll('#cl_liste .cl-blok').length;
    const pr = projects.find(x => x.name === 'Ic olcumu');
    o.maddeSayisi = pr ? (pr.checklist || []).length : -1;
    o.cikarilanListede = pr
      ? (pr.checklist || []).some(m => o.cikarilan.indexOf(m.metin) >= 0) : true;
    o.adres = location.hash;
    return o;
  });

  dene('★ setin ICI ILK ACILISTA gorunuyor (maddeler metinleriyle)', () => {
    assert.strictEqual(ic.acildi, true, 'oneri bolumu acilmadi');
    assert.ok(ic.ilkAcilistaIcSatir > 0,
      'icerikler kapali basliyor: kullanici setin icini yine ezberlemek zorunda kalir');
    assert.ok(ic.icSatir >= 5, 'setin ici gorunmuyor, satir: ' + ic.icSatir);
    assert.strictEqual(ic.metinVar, true, 'madde satirlarinin metni bos');
  });
  dene('★ "+" / "−" ile kapanip aciliyor', () => {
    assert.strictEqual(ic.dugmeIsaretiAcik, '−',
      'acikken isaret "−" degil: ' + JSON.stringify(ic.dugmeIsaretiAcik));
    assert.strictEqual(ic.kapaninca, 0, '"−" basildi ama icerik kapanmadi');
    assert.strictEqual(ic.dugmeIsaretiKapali, '+',
      'kapaliyken isaret "+" degil: ' + JSON.stringify(ic.dugmeIsaretiKapali));
    assert.ok(ic.icSatir >= 5, '"+" basildi ama icerik geri acilmadi');
  });
  dene('setin maddeleri varsayilan olarak TIKLI', () => {
    assert.strictEqual(ic.hepsiTikli, true);
  });
  dene('★ madde tikten cikarilabiliyor ve sayi bunu yaziyor', () => {
    assert.notStrictEqual(ic.adetOnce, ic.adetSonra,
      'bir madde cikarildi ama sayi etiketi degismedi: kullanici ne cikardigini gormez');
    assert.ok(/\//.test(ic.adetSonra),
      'etiket "8 / 9 madde" bicimine gecmedi: ' + ic.adetSonra);
    assert.strictEqual(ic.hala9Satir, ic.icSatir,
      'bolum yeniden cizildi: tiklanan kutudan odak kacar');
  });
  dene('★ tikten cikarilan madde cekim listesine GIRMIYOR', () => {
    assert.strictEqual(ic.cikarilanListede, false,
      'cikarilan madde yine eklendi: "istemedigini cikarabilmeli" karsilanmiyor');
    assert.ok(ic.maddeSayisi > 0, 'hic madde eklenmedi');
  });
  // ⛔ BU IKI IDDIA YENIDEN YONLENDIRILDI (17 Kasim 2026).
  //    Ayri "Tikli setleri ekle" dugmesi KALDIRILDI; kullanici:
  //    "bu tus burada gereksiz bir hal aliyor... projeyi kayit
  //    ettiginde zaten bu secilenlerin de kayit olmasi lazim."
  //    Artik secim projenin KENDI Kaydet tusuyla kaydediliyor ve
  //    kaydetmek sayfayi kapatir -- her kaydetmede oldugu gibi.
  //    Yani "Ekle sayfayi kapatmasin" sarti ortadan kalkti.
  //
  //    Arkasindaki GERCEK ihtiyac duruyor: kullanici ekledigini
  //    GOREBILMELI. Olcu ona yoneldi: kaydedilen maddeler projede
  //    duruyor mu, ve projeye geri girince GORUNUYOR mu.
  dene('★ seçilen setler PROJE KAYDEDİLİNCE kaydediliyor', () => {
    assert.ok(ic.maddeSayisi > 0,
      'proje kaydedildi ama cekim listesi bos: secim kaydedilmemis');
    assert.strictEqual(ic.cikarilanListede, false,
      'tikten cikarilan arac yine kaydedilmis');
  });
  dene('★ projeye geri girince eklenenler GORUNUYOR', () => {
    assert.strictEqual(ic.geriGirinceAcik, true,
      'projeye geri girince cekim listesi acilmiyor: kullanici ne eklendigini goremez');
    assert.ok(ic.geriGirinceSatir > 0,
      'projeye geri girince madde gorunmuyor: ' + ic.geriGirinceSatir);
  });

  // ── 8. MADDE TIKLERI SETIN TIKINI IZLIYOR ──────────────────────
  // ⛔ KULLANICININ BILDIRDIGI HATA (17 Kasim 2026, ekran goruntusu):
  //    "Default gelenler haricinde diger setlerin basliklarinda tik
  //    olmamasina ragmen onlarin altinda yer alan tum araclar tikli
  //    geliyor. Bu sekilde olmamali."
  //    Sebebi: madde tiki setin tikinden BAGIMSIZ ciziliyordu.
  //    Dogrusu: set tiksizse maddeleri de tiksiz (ve kapali); set
  //    tiklenince hepsi tiklenir; kullanici iclerinden cikarir.
  const tik = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    const durum = () => {
      const o = {};
      document.querySelectorAll('[data-soblok]').forEach(b => {
        const k = b.getAttribute('data-soblok');
        const setKutu = b.querySelector('[data-so]');
        const mad = Array.prototype.slice.call(b.querySelectorAll('[data-somad]'));
        o[k] = { setTikli: setKutu.checked,
                 tikli: mad.filter(x => x.checked).length,
                 toplam: mad.length,
                 kapali: mad.filter(x => x.disabled).length };
      });
      return o;
    };
    openProjectNew(''); await bekle(300);
    document.getElementById('pe_name').value = 'Tik olcumu';
    document.getElementById('pe_type').value = 'vlog';
    document.getElementById('pe_type').dispatchEvent(new Event('change'));
    const g = document.getElementById('pe_shoot');
    g.value = '2026-12-22'; g.dispatchEvent(new Event('change'));
    await bekle(300);
    const o = { baslangic: durum() };
    // Tiksiz bir seti TIKLE
    let tel = document.querySelector('[data-so="telefon"]');
    tel.checked = true; tel.dispatchEvent(new Event('change', { bubbles: true }));
    await bekle(250);
    o.tiklenince = durum().telefon;
    // Icinden bir arac cikar
    const ilk = document.querySelector('[data-somad^="telefon:"]');
    ilk.checked = false; ilk.dispatchEvent(new Event('change', { bubbles: true }));
    await bekle(200);
    o.cikarilinca = document.querySelector('[data-soblok="telefon"] .set-oneri-adet').textContent;
    // ⚠ TAZE SECICI: bolum yeniden cizildigi icin eski oge artik
    //   belgede degil; eskisine olay gondermek HICBIR SEY yapmaz.
    //   17 Kasim 2026'da olcum tam bu yuzden yanlis sonuc verdi.
    tel = document.querySelector('[data-so="telefon"]');
    tel.checked = false; tel.dispatchEvent(new Event('change', { bubbles: true }));
    await bekle(250);
    o.tiksizlesince = durum().telefon;
    // Yeniden tiklenince eski "cikarilmis" hafizasi TEMIZ mi
    tel = document.querySelector('[data-so="telefon"]');
    tel.checked = true; tel.dispatchEvent(new Event('change', { bubbles: true }));
    await bekle(250);
    o.yenidenTiklenince = durum().telefon;
    return o;
  });

  dene('★ TIKLI setlerin araclari tikli ve acik', () => {
    ['konusmali', 'dis'].forEach(k => {
      assert.strictEqual(tik.baslangic[k].setTikli, true, k + ' tikli gelmeliydi');
      assert.strictEqual(tik.baslangic[k].tikli, tik.baslangic[k].toplam,
        k + ': tikli setin bazi araclari tiksiz');
      assert.strictEqual(tik.baslangic[k].kapali, 0, k + ': tikli setin araclari kapali');
    });
  });
  dene('★ TIKSIZ setlerin araclari TIKSIZ (kullanicinin bildirdigi hata)', () => {
    ['telefon', 'onceki', 'kayda', 'sonra'].forEach(k => {
      assert.strictEqual(tik.baslangic[k].setTikli, false, k + ' tiksiz olmaliydi');
      assert.strictEqual(tik.baslangic[k].tikli, 0,
        k + ': set tiksiz ama ' + tik.baslangic[k].tikli +
        ' araci tikli -- kullaniciya "bunlar gelecek" dedirtir, oysa gelmiyorlar');
      assert.strictEqual(tik.baslangic[k].kapali, tik.baslangic[k].toplam,
        k + ': tiksiz setin araclari tiklanabilir durumda');
    });
  });
  dene('★ set tiklenince HEPSI tiklenir', () => {
    assert.strictEqual(tik.tiklenince.setTikli, true);
    assert.strictEqual(tik.tiklenince.tikli, tik.tiklenince.toplam);
    assert.strictEqual(tik.tiklenince.kapali, 0);
  });
  dene('tikli setten arac cikarilabiliyor', () => {
    assert.ok(/\//.test(tik.cikarilinca), 'sayi "9 / 10" bicimine gecmedi: ' + tik.cikarilinca);
  });
  dene('★ set tiksizlesince araclari da tiksizlesir', () => {
    assert.strictEqual(tik.tiksizlesince.setTikli, false);
    assert.strictEqual(tik.tiksizlesince.tikli, 0);
    assert.strictEqual(tik.tiksizlesince.kapali, tik.tiksizlesince.toplam);
  });
  dene('★ yeniden tiklenince eski "cikarilmis" hafizasi TEMIZ', () => {
    assert.strictEqual(tik.yenidenTiklenince.tikli, tik.yenidenTiklenince.toplam,
      'set yeniden tiklendi ama onceden cikarilan arac tiksiz kaldi: ' +
      'kullanici "hepsi tiklenir" bekliyor');
  });

  // ── 9. ⛔ AYRI "EKLE" DUGMESI OLMAMALI ──────────────────────────
  // Kullanici (17 Kasim 2026): "bu tus burada gereksiz bir hal aliyor.
  // Burada zaten kullanici bir proje icerisinde ve projede bu alan
  // haricinde de yaptigi her seyi ilk ekranda en altta yer alan
  // PROJE OLUSTUR tusu ile kayit edecek."
  const dugmeler = await p.evaluate(() => ({
    ekle: !!document.getElementById('pe_oneriEkle'),
    sonra: !!document.getElementById('pe_oneriSonra'),
    kaydet: !!document.getElementById('pe_save')
  }));
  dene('★ ayrı "Tikli setleri ekle" düğmesi YOK', () => {
    assert.strictEqual(dugmeler.ekle, false,
      'ayrı ekleme düğmesi geri gelmiş: kullanıcı "gereksiz" dedi');
    assert.strictEqual(dugmeler.sonra, false, '"Şimdi değil" düğmesi geri gelmiş');
    assert.strictEqual(dugmeler.kaydet, true,
      'projenin kendi Kaydet düğmesi yok: seçim hiç kaydedilemez');
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
