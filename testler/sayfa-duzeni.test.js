// PROJE VE SCRIPT: PENCERE DEGIL SAYFA (50. madde).
//
// NEDEN BU TEST VAR
//   Kullanici 16 Kasim 2026'da UC KEZ, ekran goruntuleriyle bildirdi:
//     "pop-up da degil tipki bir sayfa gibi acilmasi lazim"
//     "sagdaki projelerin listesinin gidip yerine buyuk bir sayfada
//      projeyi calisabilecegim alan"
//     "bu pop-up icerisinde cekim listesine tikladigimda yeni pop-up
//      cikiyor, sonra geri donmek istersem donemiyorum"
//     "scriptler sayfasinda da durum ayni, pop-up cikiyor"
//
//   ⛔ BU TESTIN BIRINCI ISI "GORUNMEZ ACIK" HALINI YAKALAMAK.
//      3. parcada tam bu oldu: openScript `open` sinifini ekliyor ama
//      scriptsPage'e GECMIYORDU, yani script acik sayiliyor ama
//      kullanici BOS EKRAN goruyordu. Iki test (script-akis, ai-tarif)
//      yakaladi; biri "hidden <div … class='script-sayfasi open'>"
//      diye 30 saniye bekledi, oteki gizli elemanin olculeri 0 oldugu
//      icin dustu. O yuzden burada `open` sinifi YETMIYOR -- eleman
//      GERCEKTEN GORUNUR mu olculuyor.
//
//   ⛔ GOVDE KILIDI. Uc yer `document.querySelector('.overlay.open')`
//      ile sayfanin kaydirmasini kilitliyor. Proje/script artik
//      pencere degil; `overlay` sinifini tasirlarsa kullanici kendi
//      sayfasini kaydiramaz. Bu test o sinifin GERI GELMEDIGINI de
//      olcuyor.

const assert = require('assert');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8153;           // ⛔ 8097-8099 kosucunun; asla kullanma
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
  await p.waitForFunction(() => typeof openProjectEdit === 'function', { timeout: 30000 });
  await p.waitForTimeout(600);

  // Gercekten gorunur mu: `open` sinifi YETMEZ.
  const gorunur = (id) => p.evaluate((i) => {
    const e = document.getElementById(i);
    if (!e) return { var: false };
    const k = e.getBoundingClientRect();
    return { var: true, acikSinifi: e.classList.contains('open'),
             gorunur: e.offsetParent !== null && k.width > 0 && k.height > 0,
             overlaySinifi: e.classList.contains('overlay'),
             konum: getComputedStyle(e).position,
             ebeveyn: e.parentElement ? (e.parentElement.id || e.parentElement.className) : '' };
  }, id);

  // ── PROJE ──────────────────────────────────────────────────────────
  const pid = await p.evaluate(async () => {
    document.querySelectorAll('.overlay.open').forEach(e => e.classList.remove('open'));
    setPage('projects');
    await new Promise(r => setTimeout(r, 200));
    return projects[0].id;
  });
  await p.evaluate(id => openProjectEdit(id), pid);
  await p.waitForTimeout(300);
  const proje = await gorunur('projectEditOverlay');
  const projeEk = await p.evaluate(() => ({
    listeGizli: document.getElementById('projectList').offsetParent === null,
    geri: !!document.getElementById('pe_geri'),
    geriMetin: (document.getElementById('pe_geri') || {}).textContent || '',
    adres: location.hash,
    govdeKilidi: !!document.querySelector('.overlay.open'),
  }));

  dene('★ proje GERÇEKTEN GÖRÜNÜR (gizli "açık" değil)', () => {
    assert.strictEqual(proje.acikSinifi, true, 'open sınıfı yok');
    assert.strictEqual(proje.gorunur, true,
      'eleman "açık" ama GÖRÜNMÜYOR — sayfası gizli kalmış olabilir. ' +
      '3. parçada script tarafında tam bu oldu.');
  });
  dene('★ proje PENCERE DEĞİL: overlay sınıfı yok, akışta duruyor', () => {
    assert.strictEqual(proje.overlaySinifi, false,
      'overlay sınıfı geri gelmiş: gövde kilidi devreye girer ve sayfa kaydırılamaz');
    assert.notStrictEqual(proje.konum, 'fixed', 'hâlâ sabit konumlu bir pencere');
  });
  dene('★ proje LİSTENİN YERİNE geçiyor', () => {
    assert.strictEqual(proje.ebeveyn, 'projectsPage',
      'proje sayfası projectsPage içinde değil: ' + proje.ebeveyn);
    assert.strictEqual(projeEk.listeGizli, true,
      'proje açıkken liste hâlâ görünüyor — kullanıcının istediği "liste gitsin" idi');
  });
  dene('★ geri şeridi var ve ADRES değişiyor', () => {
    assert.strictEqual(projeEk.geri, true, 'geri düğmesi yok');
    assert.ok(projeEk.geriMetin.length > 2, 'geri düğmesinin metni boş');
    assert.ok(/^#\/proje\//.test(projeEk.adres), 'adres yazılmadı: ' + projeEk.adres);
  });
  dene('★ gövde kilidi DEVREDE DEĞİL', () => {
    assert.strictEqual(projeEk.govdeKilidi, false,
      '.overlay.open eşleşiyor: sayfa kaydırması kilitlenir');
  });

  // Tarayicinin geri tusu
  await p.goBack(); await p.waitForTimeout(350);
  const geriSonra = await p.evaluate(() => ({
    acik: document.getElementById('projectEditOverlay').classList.contains('open'),
    liste: document.getElementById('projectList').offsetParent !== null,
  }));
  dene('★ tarayıcı GERİ tuşu projeyi kapatıp listeyi getiriyor', () => {
    assert.strictEqual(geriSonra.acik, false, 'geri tuşundan sonra proje hâlâ açık');
    assert.strictEqual(geriSonra.liste, true, 'liste geri gelmedi');
  });

  // ── CEKIM LISTESI: PROJE SAYFASININ ICINDE ─────────────────────────
  await p.evaluate(async () => { setPage('bugun'); await new Promise(r => setTimeout(r, 200)); });
  await p.evaluate(id => cekimListesiAc(id), pid);
  await p.waitForTimeout(400);
  const liste = await gorunur('cekimListesiOverlay');
  const listeEk = await p.evaluate(() => ({
    projeAcik: document.getElementById('projectEditOverlay').classList.contains('open'),
    icinde: document.getElementById('cekimListesiOverlay')
              .closest('#projectEditOverlay') !== null,
    sayfa: ([...document.querySelectorAll('.rail-main > div[id$="Page"]')]
              .find(d => !d.hidden) || {}).id,
  }));

  dene('★ çekim listesi GÖRÜNÜR ve proje sayfasının İÇİNDE', () => {
    assert.strictEqual(liste.gorunur, true, 'çekim listesi açık ama görünmüyor');
    assert.strictEqual(listeEk.icinde, true,
      'çekim listesi proje sayfasının içinde değil — pop-up içinde pop-up geri gelmiş');
    assert.strictEqual(listeEk.projeAcik, true, 'proje sayfası açık değil');
    assert.strictEqual(listeEk.sayfa, 'projectsPage');
  });
  dene('★ çekim listesi PENCERE değil', () => {
    assert.strictEqual(liste.overlaySinifi, false);
  });

  // Listeyi kapatmak PROJEDE birakmali
  await p.evaluate(() => cekimListesiKapat());
  await p.waitForTimeout(250);
  const kapaliSonra = await p.evaluate(() => ({
    liste: document.getElementById('cekimListesiOverlay').classList.contains('open'),
    proje: document.getElementById('projectEditOverlay').classList.contains('open'),
  }));
  dene('★ liste kapanınca PROJEDE kalınıyor (tabloya düşmüyor)', () => {
    assert.strictEqual(kapaliSonra.liste, false, 'liste kapanmadı');
    assert.strictEqual(kapaliSonra.proje, true,
      'liste kapanınca proje de kapandı — kullanıcı tabloya düşüyor, ' +
      'bildirdiği hata tam buydu');
  });

  // Geri tusu BUGUN'e dondurmeli (gelinen sayfa)
  await p.goBack(); await p.waitForTimeout(400);
  const buguneDondu = await p.evaluate(() => ({
    sayfa: ([...document.querySelectorAll('.rail-main > div[id$="Page"]')]
              .find(d => !d.hidden) || {}).id,
    proje: document.getElementById('projectEditOverlay').classList.contains('open'),
  }));
  dene('★ geri tuşu GELİNEN sayfaya (Bugün) döndürüyor', () => {
    assert.strictEqual(buguneDondu.proje, false, 'proje sayfası kapanmadı');
    assert.strictEqual(buguneDondu.sayfa, 'bugunPage',
      'Bugün\'e dönülmedi: ' + buguneDondu.sayfa +
      '. Sekme geçişleri adresi REPLACE etmeli, PUSH değil.');
  });

  // ── SEKME GEZINMEK GECMISI DOLDURMAMALI ────────────────────────────
  // ⛔ Bu olcu ILK SURUMDE YOKTU ve mutasyon denemesi acigi gosterdi:
  //   setPage'i REPLACE yerine PUSH yapmak hicbir testi kirmiyordu.
  //   Oysa fark kullanici icin buyuk: uc sekme gezen biri geri tusuna
  //   bastiginda projesine degil, gezdigi sekmelere geri doner.
  // ⚠ TEMIZ SAYFA YUKLEMESIYLE BASLIYOR. Iki deneme gerekti:
  //   1) Hic yedek kayit yokken iki geri BELGENIN DISINA (about:blank)
  //      dusuyordu ve olcum cokuyordu ("Cannot read properties of
  //      null").
  //   2) history.pushState(location.href) ile yedek kayit acmak da
  //      ise yaramadi: o anki adres zaten testin onceki adimindan
  //      kalma #/bugun idi, yani yeni yuva acmadi ve iki geri
  //      Bugun'e dusuyordu -- mutasyon olmadan da kirmizi yaniyordu.
  //   Temiz yukleme ikisini birden cozuyor: gecmis [about:blank,
  //   app] diye basliyor, setPage'ler app kaydini REPLACE ediyor,
  //   proje PUSH ediyor; iki geri hashsiz app kaydina donuyor ve
  //   belge yerinde kaliyor.
  await p.goto('http://localhost:' + PORT + '/app.html');
  await p.waitForFunction(() => typeof openProjectEdit === 'function', { timeout: 30000 });
  await p.waitForTimeout(600);
  const gecmis = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    document.querySelectorAll('.overlay.open').forEach(e => e.classList.remove('open'));
    setPage('bugun');      await bekle(120);
    setPage('ideas');      await bekle(120);
    setPage('places');     await bekle(120);
    setPage('projects');   await bekle(120);
    return { adres: location.hash };
  });
  await p.evaluate(id => openProjectEdit(id), pid);
  await p.waitForTimeout(300);
  const okuSayfa = () => p.evaluate(() => ({
    proje: document.getElementById('projectEditOverlay').classList.contains('open'),
    sayfa: ([...document.querySelectorAll('.rail-main > div[id$="Page"]')]
              .find(d => !d.hidden) || {}).id,
  }));
  await p.goBack(); await p.waitForTimeout(350);
  const birGeri = await okuSayfa();
  // ⛔ IKINCI GERI SART. Ilk surumde yalnizca BIR kez geri basiliyordu
  //   ve o olcu PUSH ile REPLACE'i AYIRT EDEMIYORDU: iki durumda da
  //   ilk geri projeyi kapatip Projeler'e donuyor. Fark ancak ikinci
  //   geride gorunuyor -- PUSH olsaydi gezilen sekmelere donulurdu.
  await p.goBack(); await p.waitForTimeout(350);
  const ikiGeri = await okuSayfa();
  dene('★ sekme gezinmek GEÇMİŞİ DOLDURMUYOR', () => {
    assert.strictEqual(gecmis.adres, '#/projects', 'son sekmenin adresi yazılmamış');
    assert.strictEqual(birGeri.proje, false, 'ilk geri projeyi kapatmadı');
    assert.strictEqual(birGeri.sayfa, 'projectsPage',
      'ilk geriden sonra ' + birGeri.sayfa + ' ekranındayız, Projeler bekleniyordu');
    assert.strictEqual(ikiGeri.sayfa, 'projectsPage',
      'Dört sekme gezilip proje açıldı, İKİ kez geri basıldı ve ' +
      ikiGeri.sayfa + ' ekranına düşüldü. Sekme geçişleri adresi ' +
      'REPLACE etmeli (PUSH değil), yoksa geri tuşu projeye değil ' +
      'kullanıcının gezdiği sekmelere döner.');
  });

  // ── SCRIPT ─────────────────────────────────────────────────────────
  // ⛔ BILEREK BASKA BIR SAYFADAN aciliyor: 3. parcadaki hata tam
  //    buydu -- openScript sayfaya gecmiyordu ve script gorunmuyordu.
  // ⚠ Script KENDIMIZ yaratiliyor, ornek veriye guvenilmiyor: ilk
  //   surumde demo verisinde hic script yoktu ve script olcumlerinin
  //   TAMAMI hic kosmadi. Bekci onu yakaladi (sessizce gecmedi).
  const sid = await p.evaluate(async () => {
    const sc = scriptTemizle({ id: 'sc_sayfa_olcum', title: 'Olcum scripti',
                               text: 'Sayfa duzeni testi icin.' });
    scriptler = [sc];
    if (typeof saveScriptler === 'function') saveScriptler();
    setPage('calendar');
    await new Promise(r => setTimeout(r, 200));
    return sc ? sc.id : null;
  });
  if (sid) {
    await p.evaluate(id => openScript(id), sid);
    await p.waitForTimeout(350);
    const sc = await gorunur('scriptOverlay');
    const scEk = await p.evaluate(() => ({
      listeGizli: document.getElementById('sc_list').offsetParent === null,
      geri: !!document.getElementById('sc_geri'),
      adres: location.hash,
      sayfa: ([...document.querySelectorAll('.rail-main > div[id$="Page"]')]
                .find(d => !d.hidden) || {}).id,
    }));
    dene('★ script BAŞKA SAYFADAN açılınca da GÖRÜNÜR', () => {
      assert.strictEqual(sc.acikSinifi, true, 'open sınıfı yok');
      assert.strictEqual(sc.gorunur, true,
        'script "açık" ama GÖRÜNMÜYOR — openScript scriptler sayfasına geçmiyor. ' +
        '3. parçada tam bu hata yapıldı.');
      assert.strictEqual(scEk.sayfa, 'scriptsPage');
    });
    dene('★ script listenin yerine geçiyor, adres değişiyor', () => {
      assert.strictEqual(sc.ebeveyn, 'scriptsPage', 'script sayfası yanlış yerde: ' + sc.ebeveyn);
      assert.strictEqual(scEk.listeGizli, true, 'script açıkken liste hâlâ görünüyor');
      assert.strictEqual(scEk.geri, true, 'geri düğmesi yok');
      assert.ok(/^#\/script\//.test(scEk.adres), 'adres yazılmadı: ' + scEk.adres);
    });
    dene('★ script PENCERE değil, gövde kilidi yok', () => {
      assert.strictEqual(sc.overlaySinifi, false);
      assert.notStrictEqual(sc.konum, 'fixed');
    });
  } else {
    dene('bekçi: örnek script var', () => {
      assert.fail('hiç script yok — script ölçümleri hiç koşmadı, test sessizce yarım kalır');
    });
  }

  // ── TAKVIM GIRISI ──────────────────────────────────────────────────
  // ⛔ BILEREK BASKA SAYFADAN aciliyor: 3. parcadaki hatanin ayni sinav.
  const kayit = await p.evaluate(async () => {
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    // ⚠ TANITIM TURU KAPATILIYOR. Olcumun ortasinda sayfa yeniden
    //   yuklendigi icin (gecmis olcusu temiz yukleme istiyor) tur
    //   aciliyor ve `.overlay.open` esleserek govde kilidi iddiasini
    //   haksiz yere kirmizi yakiyordu. Hata mesaji elemanin adini
    //   soyledigi icin tek turda bulundu.
    document.querySelectorAll('.overlay.open').forEach(e => e.classList.remove('open'));
    // ⚠ ONCE baska sayfadan acilip GORUNURLUK olculuyor (3. parcadaki
    //   hatanin sinavi), sonra kapatilip GERCEK senaryo kuruluyor:
    //   kullanici TAKVIMDEYKEN giris aciyor ve geri tusu takvime
    //   donmeli. Ilk surumde yalnizca projeler sayfasindan acilmisti
    //   ve "geri takvime donsun" iddiasi haksiz yere kirmizi yandi --
    //   geri tusu dogru calisiyordu, gelinen yer takvim DEGILDI.
    setPage('projects');
    await bekle(150);
    openModal(null, '2026-11-20', '09:00');
    await bekle(250);
    const baskaSayfadanGorunur = document.getElementById('editOverlay').offsetParent !== null;
    closeModal();
    await bekle(150);
    setPage('calendar');
    await bekle(200);
    openModal(events[0] || null, '2026-11-20', '09:00');
    await bekle(300);
    const el = document.getElementById('editOverlay');
    const k = el.getBoundingClientRect();
    const takvimKabi = document.getElementById('calTable')
                    || document.getElementById('calWrap')
                    || document.querySelector('#calendarPage .cal-nav');
    return {
      baskaSayfadanGorunur,
      acikSinifi: el.classList.contains('open'),
      gorunur: el.offsetParent !== null && k.width > 0 && k.height > 0,
      overlaySinifi: el.classList.contains('overlay'),
      konum: getComputedStyle(el).position,
      ebeveyn: el.parentElement ? el.parentElement.id : '',
      sayfa: ([...document.querySelectorAll('.rail-main > div[id$="Page"]')]
                .find(d => !d.hidden) || {}).id,
      takvimGizli: takvimKabi ? takvimKabi.offsetParent === null : null,
      geri: !!document.getElementById('ev_geri'),
      adres: location.hash,
      // ⚠ Hangi eleman oldugunu SOYLUYOR: "true !== false" diye bir
      //   hata mesaji kimin acik kaldigini bulmak icin ikinci bir tur
      //   olcum gerektiriyordu.
      govdeKilidi: (document.querySelector('.overlay.open') || {}).id || '',
    };
  });

  dene('★ takvim girişi BAŞKA SAYFADAN açılınca da GÖRÜNÜR', () => {
    assert.strictEqual(kayit.baskaSayfadanGorunur, true,
      'projeler sayfasındayken açılan kayıt GÖRÜNMEDİ — openModal ' +
      'takvim sayfasına geçmiyor. 3. parçada script tarafında tam bu oldu.');
    assert.strictEqual(kayit.acikSinifi, true, 'open sınıfı yok');
    assert.strictEqual(kayit.gorunur, true, 'kayıt "açık" ama görünmüyor');
    assert.strictEqual(kayit.sayfa, 'calendarPage');
  });
  dene('★ takvim görünümü GİDİYOR, yerine giriş geliyor', () => {
    assert.strictEqual(kayit.ebeveyn, 'calendarPage',
      'kayıt sayfası calendarPage içinde değil: ' + kayit.ebeveyn);
    assert.strictEqual(kayit.takvimGizli, true,
      'kayıt açıkken takvim hâlâ görünüyor — kullanıcının istediği ' +
      '"arkadaki takvim görüntüsünün gitmesi" idi');
  });
  dene('★ takvim girişi PENCERE değil, adres değişiyor', () => {
    assert.strictEqual(kayit.overlaySinifi, false,
      'overlay sınıfı geri gelmiş: gövde kilidi devreye girer');
    assert.notStrictEqual(kayit.konum, 'fixed');
    assert.strictEqual(kayit.govdeKilidi, '',
      '"' + kayit.govdeKilidi + '" hâlâ .overlay.open eşleşiyor: ' +
      'gövde kilidi devreye girer ve kullanıcı sayfasını kaydıramaz');
    assert.strictEqual(kayit.geri, true, 'geri düğmesi yok');
    assert.ok(/^#\/kayit\//.test(kayit.adres), 'adres yazılmadı: ' + kayit.adres);
  });

  await p.goBack(); await p.waitForTimeout(350);
  const kayitGeri = await p.evaluate(() => ({
    acik: document.getElementById('editOverlay').classList.contains('open'),
    sayfa: ([...document.querySelectorAll('.rail-main > div[id$="Page"]')]
              .find(d => !d.hidden) || {}).id,
  }));
  dene('★ geri tuşu girişten TAKVİME döndürüyor', () => {
    assert.strictEqual(kayitGeri.acik, false, 'geri tuşundan sonra giriş hâlâ açık');
    assert.strictEqual(kayitGeri.sayfa, 'calendarPage',
      'takvime dönülmedi: ' + kayitGeri.sayfa);
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
