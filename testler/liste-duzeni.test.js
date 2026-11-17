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
    document.getElementById('pe_oneriEkle').click(); await bekle(1200);
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
    o.acik = { isaret: '', satir: 0, notDugmesi: 0, tikKutusu: 0 };
    o.tikSonrasi = { say: '', isaret: '' };
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
                   tikKutusu: b0.querySelectorAll('[data-cl-tik]').length };
        o.acik.isaret = String(o.acik.isaret).trim();
        const tik = b0.querySelector('[data-cl-tik]');
        if (tik) { tik.click(); await bekle(300); }
        const b1 = blok()[0];
        if (b1) {
          o.tikSonrasi = {
            say: ((b1.querySelector('.cl-grup-say') || {}).textContent || '').trim(),
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
    assert.strictEqual(akis.acik.notDugmesi, akis.acik.satir,
      'her maddede not alani yok: kullanici "altinda not alanlari bulunmali" dedi');
  });
  dene('madde tiklaninca grup sayisi artiyor, grup ACIK kaliyor', () => {
    assert.strictEqual(akis.tikSonrasi.say.split('/')[0], '1', akis.tikSonrasi.say);
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

  dene('sayfa hatasi yok', () => {
    assert.deepStrictEqual(sayfaHatasi, []);
  });

  await p.close();
  await tarayici.close();
  await new Promise(r => sunucu.close(r));

  console.log('\n' + gecti + ' gecti, ' + hatalar.length + ' kaldi');
  if (hatalar.length) process.exit(1);
})().catch(e => { console.error('TEST COKTU:', e); process.exit(1); });
