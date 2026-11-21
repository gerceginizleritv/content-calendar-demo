// PLAN × ÖZELLİK KAPISI — uygulama tarafı  (YAPILACAKLAR 67, 5. aşama)
//
// NEDEN BU TEST VAR
//   67'de karar veriye taşındı: hangi özellik hangi planda açık,
//   yönetim panelinden değiştiriliyor (`plan_features`, sql/76).
//   52'de tek bir bayrak vardı (`prefs.pro`); artık plan var.
//
// ⛔ EN BÜYÜK RİSK VERİ KAYBI, VE O SESSİZ OLUR.
//   Kullanıcının kararı (20 Kasım 2026): **"veri durur, yalnızca
//   görünmez"**. Planı düşen birinin verdiği öncelikler SİLİNMEMELİ.
//   Aşağıda bu ayrı bir iddia: kapı kapandıktan sonra `fikirler`
//   dizisindeki `oncelik` alanları hâlâ yerinde mi.
//   ⚠ Ekrandan kaybolması yetmez; veride durduğu ayrıca ölçülüyor.
//
// ⛔ İKİNCİ RİSK: LİSTENİN İKİ YERE AYRIŞMASI.
//   Geçerli özellikler hem `app.html` içinde (`OZELLIK_VARSAYILAN`)
//   hem `sql/76`da yazılı. Biri değişip öteki unutulursa: kodda
//   açılan yeni bir özelliğin matriste satırı olmaz, panelden
//   açılamaz ve kullanıcının kararı gereği (**yeni özellik kapalı
//   başlar**) hiç kimsede görünmez. Aşağıda iki dosya da okunup
//   karşılaştırılıyor — liste teste KOPYALANMIYOR.
//
// ⛔ ÜÇÜNCÜ RİSK: AĞ KESİNTİSİNDE ÖZELLİKLERİN KAYBOLMASI.
//   Kapı okunamazsa ürün DÜNKÜ hâlinde kalmalı. 20 Kasım 2026'da
//   tam bu aileden dört arıza yaşandı (62. madde). "Okunamadı =
//   kapalı" deseydik her ağ kesintisi özellikleri yok ederdi.
//   ⚠ Bu, "yeni özellik KAPALI başlar" kararından AYRI bir şey:
//     o karar tablodaki satırın varsayılanı.

const assert = require('node:assert');
const fs = require('fs');
const yol = require('path');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';
const KOK = yol.join(__dirname, '..');

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

(async ()=>{
  // ── 1. İKİ DOSYA AYRIŞMAMIŞ MI ──────────────────────────────────
  const app = fs.readFileSync(yol.join(KOK, 'app.html'), 'utf8');

  // ⛔ 21 KASIM 2026 — TEST TEK BIR SQL DOSYASINA BAKIYORDU VE DUSTU.
  //   Ilk halinde yalnizca `sql/76` okunuyordu. 54. maddede dorduncu
  //   ozellik `sql/78` ile geldi; kod listesi dogruydu ama test onu
  //   goremedigi icin "ayrismis" dedi.
  //   ⚠ Test ZAYIFLATILMADI, KAPSAMI DUZELTILDI: artik `sql/` klasoru
  //     TARANIYOR. Kisit birden cok dosyada yeniden kuruluyor
  //     (her yeni ozellik onu genisletiyor), bu yuzden GECERLI olan
  //     EN YUKSEK NUMARALI dosyadaki -- veritabaninda en son o kaldi.
  //     Tohum satirlari ise butun dosyalardan toplaniyor.
  //   ⛔ Dosya adlari elle yazilmiyor; yarin `sql/83` eklenirse
  //     kendiliginden kapsama giriyor.
  const sqlDosyalari = fs.readdirSync(yol.join(KOK, 'sql'))
    .filter(x=> x.endsWith('.sql'))
    .sort((a,b)=> parseInt(a,10) - parseInt(b,10))
    .map(ad=> ({ ad, metin: fs.readFileSync(yol.join(KOK, 'sql', ad), 'utf8') }));

  const kisitliDosyalar = sqlDosyalari.filter(d=> /feature_key in \(/.test(d.metin));
  const sonKisit = kisitliDosyalar.length
    ? /feature_key in \(([^)]*)\)/.exec(kisitliDosyalar[kisitliDosyalar.length - 1].metin)
    : null;
  const sqlKisit = sonKisit
    ? [...sonKisit[1].matchAll(/'([^']+)'/g)].map(m=> m[1]).sort() : [];

  const sqlTohum = [...new Set(sqlDosyalari.flatMap(d=>
    [...d.metin.matchAll(/'(?:starter|creator_pro|studio|founding)',\s*'([a-z_]+)',\s*(?:true|false)/g)]
      .map(m=> m[1])))].sort();
  // app.html: OZELLIK_VARSAYILAN anahtarlari
  const blok = /const OZELLIK_VARSAYILAN = \{([\s\S]*?)\};/.exec(app);
  const kodAnahtar = blok ? [...blok[1].matchAll(/^\s*([a-z_]+):/gm)].map(m=> m[1]).sort() : [];

  dene('üç listeyi de okuyabildik (ölçüm boşa düşmüyor)', ()=>{
    assert.ok(kisitliDosyalar.length >= 1,
      'kisiti kuran sql dosyasi bulunamadi');
    assert.ok(sqlKisit.length >= 3, 'kisit: ' + JSON.stringify(sqlKisit));
    assert.ok(sqlTohum.length >= 3, 'tohum: ' + JSON.stringify(sqlTohum));
    assert.ok(kodAnahtar.length >= 3, 'kod: ' + JSON.stringify(kodAnahtar));
  });
  dene('★ koddaki özellik listesi sql/76 KISITIYLA birebir aynı', ()=>{
    assert.deepStrictEqual(kodAnahtar, sqlKisit,
      'kod=' + kodAnahtar.join(',') + '  kisit=' + sqlKisit.join(','));
  });
  dene('★ koddaki her özelliğin sql/76\'da TOHUM satırı var', ()=>{
    assert.deepStrictEqual(kodAnahtar, sqlTohum,
      'kod=' + kodAnahtar.join(',') + '  tohum=' + sqlTohum.join(','));
  });

  // ── YONETIM PANELINDE OKUNUR BIR ADI VAR MI ─────────────────────
  // ⛔ 21 KASIM 2026 — EKSIKTI VE KIMSE GORMEDI. 54. maddede
  //    `set_kisisellestirme` eklendi, kapiya baglandi, SQL'e tohum
  //    satiri yazildi; YONETIM PANELININ ETIKETI unutuldu ve panelde
  //    ham anahtar (`set_kisisellestirme`) goruluyordu.
  //    ⚠ Ham anahtarin GORUNMESI bilerek (gizlenen ozellik
  //      yonetilemez); ama her ozelligin okunur bir adi OLMALI.
  // ⚠ LISTE ELLE YAZILMIYOR: anahtarlar yukarida koddan cikarildi,
  //   adlar da `yonetim.html`den okunuyor.
  const yonetim = fs.readFileSync(yol.join(KOK, 'yonetim.html'), 'utf8');
  const adBlok = /const OZELLIK_ADI = \{([\s\S]*?)\};/.exec(yonetim);
  const adliAnahtar = adBlok
    ? [...adBlok[1].matchAll(/^\s*([a-z_]+):/gm)].map(m=> m[1]).sort() : [];

  dene('yönetim panelinin ad tablosu okunabildi (ölçüm boşa düşmüyor)', ()=>{
    assert.ok(adliAnahtar.length >= 3, 'adlar: ' + JSON.stringify(adliAnahtar));
  });
  dene('⛔ koddaki HER özelliğin yönetim panelinde okunur bir adı var', ()=>{
    const eksik = kodAnahtar.filter(k=> adliAnahtar.indexOf(k) === -1);
    assert.deepStrictEqual(eksik, [],
      'panelde ham anahtar olarak görünecek: ' + eksik.join(', '));
  });
  dene('★ panelde KARŞILIĞI OLMAYAN ad kalmamış (silinen özelliğin artığı)', ()=>{
    const fazla = adliAnahtar.filter(k=> kodAnahtar.indexOf(k) === -1);
    assert.deepStrictEqual(fazla, [],
      'kodda olmayan özelliğin adı duruyor: ' + fazla.join(', '));
  });

  // ── 2. TARAYICIDA: KAPININ DAVRANIŞI ────────────────────────────
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1280, height:1000 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                   localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1800);

  // Tohum: oncelikli iki fikir + bir proje.
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    projects = [{ id:'p1', name:'Deneme', type:'vlog', steps:[] }];
    fikirler = [
      fikirTemizle({ id:'f1', text:'Bir',  parts:[], projectIds:[], oncelik:'1' }),
      fikirTemizle({ id:'f2', text:'Iki',  parts:[], projectIds:[], oncelik:'3' })
    ];
    setPage('ideas');
  });

  const olc = ()=> p.evaluate(()=>{
    renderFikirler();
    ozellikKapilariUygula();
    const sekme = document.getElementById('tabKit');
    const drive = document.getElementById('sc_driveBlok');
    return {
      secici: document.querySelectorAll('[data-fk-onc]').length,
      setSekmesi: sekme ? !sekme.hidden : null,
      driveBlok: drive ? !drive.hidden : null,
      // ⛔ ASIL OLCUM: veri duruyor mu?
      oncelikler: fikirler.map(f=> f.oncelik)
    };
  });

  // (a) Kapı okunmamış + prefs.pro KAPALI → bugünkü hâl
  await p.evaluate(()=>{ ozellikKapisi = null; proAcik = false; });
  const a = await olc();
  dene('★ kapı okunmamış ve pro kapalı: öncelik seçicisi YOK (bugünkü hâl)', ()=>{
    assert.strictEqual(a.secici, 0, JSON.stringify(a));
  });
  dene('★ kapı okunmamışken setler ve Drive AÇIK kalıyor (ağ kesintisi özellik yok etmiyor)', ()=>{
    assert.strictEqual(a.setSekmesi, true, JSON.stringify(a));
    assert.strictEqual(a.driveBlok, true, JSON.stringify(a));
  });

  // (b) Kapı okunmamış + prefs.pro AÇIK → seçici var
  await p.evaluate(()=>{ ozellikKapisi = null; proAcik = true; });
  const bb = await olc();
  dene('★ kapı okunmamış ve pro açık: seçici VAR (52. maddenin hâli korunuyor)', ()=>{
    assert.strictEqual(bb.secici, 2, JSON.stringify(bb));
  });

  // (c) Kapı diyor ki: öncelik KAPALI → seçici yok AMA VERİ DURUYOR
  await p.evaluate(()=>{
    proAcik = true;   // bayrak acik olsa bile KAPI kazanir
    ozellikKapisi = { fikir_onceligi:false, cekim_setleri:true, drive_script:true };
  });
  const cc = await olc();
  dene('★ kapı kapalıysa seçici gizleniyor (bayrak açık olsa bile)', ()=>{
    assert.strictEqual(cc.secici, 0, JSON.stringify(cc));
  });
  dene('⛔ KAPI KAPANINCA VERİ SİLİNMİYOR — öncelikler kayıtta duruyor', ()=>{
    assert.deepStrictEqual(cc.oncelikler, ['1','3'],
      'veri bozuldu: ' + JSON.stringify(cc.oncelikler));
  });

  // (d) Kapı tekrar açılınca her şey geri geliyor
  await p.evaluate(()=>{
    ozellikKapisi = { fikir_onceligi:true, cekim_setleri:true, drive_script:true };
  });
  const d = await olc();
  dene('★ plan geri yükselince öncelikler yerinde çıkıyor', ()=>{
    assert.strictEqual(d.secici, 2, JSON.stringify(d));
    assert.deepStrictEqual(d.oncelikler, ['1','3'], JSON.stringify(d.oncelikler));
  });

  // (e) Setler ve Drive kapanıyor
  await p.evaluate(()=>{
    ozellikKapisi = { fikir_onceligi:true, cekim_setleri:false, drive_script:false };
  });
  const e = await olc();
  dene('★ çekim setleri kapalıysa sekme gizleniyor', ()=>{
    assert.strictEqual(e.setSekmesi, false, JSON.stringify(e));
  });
  dene('★ Drive kapalıysa blok gizleniyor', ()=>{
    assert.strictEqual(e.driveBlok, false, JSON.stringify(e));
  });

  // (f) Setler sayfası AÇIKKEN kapanırsa boş ekranda kalınmıyor
  await p.evaluate(()=>{
    ozellikKapisi = { fikir_onceligi:true, cekim_setleri:true, drive_script:true };
    ozellikKapilariUygula();
    setPage('kit');
    ozellikKapisi = { fikir_onceligi:true, cekim_setleri:false, drive_script:true };
    ozellikKapilariUygula();
  });
  const f = await p.evaluate(()=> ({
    kitAcik: !document.getElementById('kitPage').hidden,
    takvimAcik: !document.getElementById('calendarPage').hidden
  }));
  dene('★ açık sayfa kapanırsa boş ekranda kalınmıyor', ()=>{
    assert.strictEqual(f.kitAcik, false, JSON.stringify(f));
    assert.strictEqual(f.takvimAcik, true, JSON.stringify(f));
  });

  // ── 3. PLAN ÇÖZÜMÜ ──────────────────────────────────────────────
  const planDene = (kurulum)=> p.evaluate(async (k)=>{
    const istekler = [];
    proAcik = k.pro;
    session = { user:{ id:'u1' } };
    sb = { from(t){ istekler.push(t); return {
      select(){ return {
        eq(){ return {
          maybeSingle(){ return Promise.resolve({ data: k.abonelik || null }); },
          then(r){ return Promise.resolve(
            k.hata ? { data:null, error:new Error('kapali') }
                   : { data:k.ozellikler || [], error:null }).then(r); }
        };}
      };}
    };}};
    ozellikKapisi = null;
    await planKapisiSenkron();
    return { plan: planAnahtari, kapi: ozellikKapisi, istekler };
  }, kurulum);

  const r1 = await planDene({ pro:true, ozellikler:[{feature_key:'fikir_onceligi', enabled:true}] });
  dene('★ prefs.pro açıkken plan Creator Pro sayılıyor (52: "hesabım muaf")', ()=>{
    assert.strictEqual(r1.plan, 'creator_pro', JSON.stringify(r1));
  });
  dene('★ prefs.pro açıkken abonelik tablosu HİÇ sorgulanmıyor', ()=>{
    assert.ok(r1.istekler.indexOf('subscriptions') === -1, JSON.stringify(r1.istekler));
  });

  const r2 = await planDene({ pro:false, abonelik:{ plan_key:'studio', status:'active' },
                              ozellikler:[{feature_key:'cekim_setleri', enabled:false}] });
  dene('★ abonelik satırı varsa onun planı kullanılıyor', ()=>{
    assert.strictEqual(r2.plan, 'studio', JSON.stringify(r2));
    assert.deepStrictEqual(r2.kapi, { cekim_setleri:false }, JSON.stringify(r2.kapi));
  });

  const r3 = await planDene({ pro:false, abonelik:{ plan_key:'studio', status:'canceled' },
                              ozellikler:[] });
  dene('★ iptal edilmiş abonelik plan vermiyor (Starter)', ()=>{
    assert.strictEqual(r3.plan, 'starter', JSON.stringify(r3));
  });

  const r4 = await planDene({ pro:false, abonelik:{ plan_key:'creator_pro', status:'past_due' },
                              ozellikler:[] });
  dene('★ ödemesi gecikmiş abonelik planı DÜŞÜRMÜYOR', ()=>{
    assert.strictEqual(r4.plan, 'creator_pro', JSON.stringify(r4));
  });

  const r5 = await planDene({ pro:false, abonelik:null, hata:true });
  dene('⛔ okuma HATA verirse kapı null kalıyor (özellikler kaybolmuyor)', ()=>{
    assert.strictEqual(r5.kapi, null, JSON.stringify(r5));
  });

  dene('sayfa hatası yok', ()=> assert.strictEqual(jsHata.length, 0, jsHata.join(' | ')));

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
