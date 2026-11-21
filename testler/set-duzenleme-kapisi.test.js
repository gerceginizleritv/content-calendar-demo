// SET DÜZENLEME KAPISI (YAPILACAKLAR 54a)
//
// NEDEN BU TEST VAR
//   Kullanıcının kararı (21 Kasım 2026, 1. karar): *"üçü de Creator
//   Pro, 54a dâhil."* ⚠ Bilinen bedeli de o gün kayda geçti: 54a
//   bugün **herkeste açık** çalışıyor ve kapıya bağlamak onu
//   bugünkü Starter kullanıcılarından **geri alıyor.**
//
// ⛔ EN BÜYÜK RİSK: KAPIYI "VERİYİ GİZLEME" SANMAK.
//   67. maddenin kuralı: *"veri durur, yalnızca görünmez."*
//   Kullanıcının kararı daha da net: **setler KULLANILMAYA devam
//   eder, yalnızca DÜZENLENEMEZ.** Yani kapalı planda:
//     - sete dokununca malzemeler çekim listesine GİRMEYE devam eder
//     - setin içine BAKILABİLİR
//     - hazır setler listeye eklenebilir
//   ve yalnızca şunlar kapanır: set yaratma, silme, sete madde
//   ekleme/çıkarma, hazır seti kendi setlerine kopyalama.
//   Aşağıda her biri AYRI AYRI ölçülüyor.
//
// ⛔ İKİNCİ RİSK: YALNIZCA ÇİZİMDE GİZLEMEK.
//   Düğmeyi gizlemek yetmez: bayat bir DOM, klavye ya da ikinci bir
//   sekme işlevi hâlâ çağırabilir. İşlevlerin kendi kapısı da ayrı
//   ölçülüyor.
//
// ⚠ Bölüm 7: dil listesi `LANG`dan BULUNUYOR.

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

(async ()=>{
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1280, height:1000 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                   localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1700);
  console.log('SET DÜZENLEME KAPISI (54a)');

  const kur = (acik)=> p.evaluate(async (a)=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    window.__uyarilar = []; window.uyari = (m)=> window.__uyarilar.push(String(m));
    window.onayla = ()=> Promise.resolve(true);
    ihtiyaclar = [{ id:'ih1', ad:'Powerbank', grup:'Enerji' },
                  { id:'ih2', ad:'Yedek pil', grup:'Enerji' }];
    ihtiyacSetleri = [{ id:'st_a', ad:'Sokak çekimi',
                        maddeler:[{ metin:'Powerbank', not:'' },
                                  { metin:'Yedek pil', not:'' }] }];
    ozellikKapisi = { set_kisisellestirme: a };
    sayfaSecimi.clear();   // ⚠ `const`: yeniden atanamaz, boşaltılır
    // ⚠ AÇIK PANEL DURUMU DA SIFIRLANIYOR. İlk sürümde sıfırlanmadı:
    //   bir önceki bölümde açılan panel açık kaldığı için ikinci
    //   tıklama onu KAPATTI ve "içi görünüyor" iddiası 0 satır
    //   gördü. Testin hatasıydı, kodun değil.
    acikSet = null;
    setPage('kit');
    setleriCiz('ihs');
    await new Promise(z=> setTimeout(z, 150));
  }, acik);

  const oku = ()=> p.evaluate(()=> ({
    silDugmesi: document.querySelectorAll('#ihs_setler [data-set-sil]').length,
    artiDugmesi: document.querySelectorAll('#ihs_setler [data-set-art]').length,
    yeniSetDugmesi: document.querySelectorAll('#ihs_setler [data-set-yap]').length,
    planNotu: document.querySelectorAll('#ihs_setler .set-plan').length,
    setCipi: document.querySelectorAll('#ihs_setler [data-set-ekle]').length,
    bakDugmesi: document.querySelectorAll('#ihs_setler [data-set-bak]').length,
    setAdet: ihtiyacSetleri.length
  }));

  // ── 1 · KAPI AÇIK: BUGÜNKÜ DAVRANIŞ ──────────────────────────────
  await kur(true);
  const a1 = await oku();
  dene('★ kapı AÇIKKEN silme, ekleme ve "yeni set" düğmeleri duruyor', ()=>{
    assert.strictEqual(a1.silDugmesi, 1, JSON.stringify(a1));
    assert.strictEqual(a1.yeniSetDugmesi, 1, JSON.stringify(a1));
  });
  dene('★ kapı açıkken plan notu YOK', ()=>{
    assert.strictEqual(a1.planNotu, 0, JSON.stringify(a1));
  });

  // Setin içine bakınca madde çıkarma düğmesi var mı?
  const ic1 = await p.evaluate(async ()=>{
    document.querySelector('#ihs_setler [data-set-bak]').click();
    await new Promise(z=> setTimeout(z, 150));
    return { maddeSil: document.querySelectorAll('#ihs_setler [data-set-mad]').length,
             satir: document.querySelectorAll('#ihs_setler .set-sat').length,
             hazirNot: document.querySelectorAll('#ihs_setler .set-icerik .hint').length };
  });
  dene('★ kapı açıkken setin içinde "−" (madde çıkar) var', ()=>{
    assert.strictEqual(ic1.maddeSil, 2, JSON.stringify(ic1));
  });

  // ── 2 · KAPI KAPALI: DÜZENLEME YOK, KULLANIM VAR ─────────────────
  await kur(false);
  const a2 = await oku();
  dene('⛔ kapı KAPALIYKEN silme düğmesi YOK', ()=>{
    assert.strictEqual(a2.silDugmesi, 0, JSON.stringify(a2));
  });
  dene('⛔ kapı kapalıyken "yeni set" düğmesi YOK', ()=>{
    assert.strictEqual(a2.yeniSetDugmesi, 0, JSON.stringify(a2));
  });
  dene('★ kapı kapalıyken SEBEBİ ekranda yazıyor', ()=>{
    assert.strictEqual(a2.planNotu, 1, JSON.stringify(a2));
  });
  dene('⛔ KULLANIM DURUYOR: set çipi ve "içine bak" yerinde', ()=>{
    assert.strictEqual(a2.setCipi, 1, JSON.stringify(a2));
    assert.strictEqual(a2.bakDugmesi, 1, JSON.stringify(a2));
  });
  dene('⛔ VERİ DURUYOR: set silinmedi', ()=>{
    assert.strictEqual(a2.setAdet, 1, JSON.stringify(a2));
  });

  const ic2 = await p.evaluate(async ()=>{
    document.querySelector('#ihs_setler [data-set-bak]').click();
    await new Promise(z=> setTimeout(z, 150));
    return { maddeSil: document.querySelectorAll('#ihs_setler [data-set-mad]').length,
             satir: document.querySelectorAll('#ihs_setler .set-sat').length,
             hazirNot: [...document.querySelectorAll('#ihs_setler .set-icerik .hint')]
                         .map(e=> e.textContent.trim()) };
  });
  dene('⛔ kapı kapalıyken setin içi GÖRÜNÜYOR (maddeler duruyor)', ()=>{
    assert.strictEqual(ic2.satir, 2, JSON.stringify(ic2));
  });
  dene('⛔ kapı kapalıyken "−" (madde çıkar) YOK', ()=>{
    assert.strictEqual(ic2.maddeSil, 0, JSON.stringify(ic2));
  });
  dene('⛔ kendi setinde "uygulamayla geliyor" notu ÇIKMIYOR (yanlış olurdu)', ()=>{
    assert.deepStrictEqual(ic2.hazirNot, [], JSON.stringify(ic2.hazirNot));
  });

  // ── 3 · İŞLEVLERİN KENDİ KAPISI ──────────────────────────────────
  // ⛔ Çizimde gizlemek yetmez: bayat DOM / klavye / ikinci sekme.
  const zorla = await p.evaluate(async ()=>{
    const once = JSON.parse(JSON.stringify(ihtiyacSetleri));
    await setiSil('st_a');
    setMaddeSil('st_a', 0);
    seteEkle('st_a');
    await setYap('ihs');
    hazirSetiKopyala(0);
    await new Promise(z=> setTimeout(z, 150));
    return { once, sonra: JSON.parse(JSON.stringify(ihtiyacSetleri)) };
  });
  dene('⛔ kapı kapalıyken İŞLEVLER doğrudan çağrılsa da VERİ DEĞİŞMİYOR', ()=>{
    assert.deepStrictEqual(zorla.sonra, zorla.once, JSON.stringify(zorla));
  });

  // ── 4 · SETİ KULLANMAK HÂLÂ ÇALIŞIYOR ────────────────────────────
  // ⛔ Kullanıcının kararının asıl yarısı: "setler KULLANILMAYA
  //    devam eder". Kapalı planda sete dokunmak maddeleri çekim
  //    listesine GİRDİRMELİ.
  const kullan = await p.evaluate(async ()=>{
    const pr = { id:'pk1', name:'Deneme', type:'vlog', steps:{}, createdAt:Date.now() };
    projects = [pr];
    listeProjesi = pr;
    ozellikKapisi = { set_kisisellestirme: false };
    setiListeyeEkle('st_a');
    await new Promise(z=> setTimeout(z, 150));
    return { liste: projeListesi(pr).map(x=> x.metin) };
  });
  dene('⛔ KAPALI PLANDA DA sete dokununca malzemeler listeye giriyor', ()=>{
    assert.deepStrictEqual(kullan.liste.slice().sort(),
      ['Powerbank','Yedek pil'], JSON.stringify(kullan));
  });

  // ── 5 · HAZIR SETLER: KULLANIM AÇIK, KOPYALAMA KAPALI ────────────
  const hazir = await p.evaluate(async ()=>{
    const oku = (acik)=>{
      ozellikKapisi = { set_kisisellestirme: acik };
      const html = hazirSetCipleri();
      return { kopyala: (html.match(/data-hkopyala=/g) || []).length,
               cip: (html.match(/data-hset=/g) || []).length };
    };
    // Icerigi acik bir hazir set gerekiyor ki "kopyala" satiri cizilsin.
    setBakCevir('hset', 0, ()=>{});
    await new Promise(z=> setTimeout(z, 60));
    return { acik: oku(true), kapali: oku(false) };
  });
  dene('★ kapı açıkken "Setlerime kopyala" var', ()=>{
    assert.strictEqual(hazir.acik.kopyala, 1, JSON.stringify(hazir));
  });
  dene('⛔ kapı kapalıyken "Setlerime kopyala" YOK', ()=>{
    assert.strictEqual(hazir.kapali.kopyala, 0, JSON.stringify(hazir));
  });
  dene('⛔ hazır set çipleri İKİ DURUMDA DA duruyor (kullanım açık)', ()=>{
    assert.ok(hazir.acik.cip >= 8, JSON.stringify(hazir));
    assert.strictEqual(hazir.kapali.cip, hazir.acik.cip, JSON.stringify(hazir));
  });

  // ── 6 · HER DİLDE (Bölüm 7) ──────────────────────────────────────
  const diller = await p.evaluate(()=>{
    const sonuc = {};
    for(const dil of Object.keys(LANG)){
      const v = LANG[dil].set_plan;
      sonuc[dil] = (typeof v === 'string' && v.trim()) ? v.trim() : null;
    }
    return sonuc;
  });
  for(const dil of Object.keys(diller)){
    dene('★ ' + dil + ' sözlüğünde set_plan var ve dolu', ()=>{
      assert.ok(diller[dil], dil + ' dilinde set_plan yok ya da boş');
    });
  }
  dene('★ diller birbirinden FARKLI (çeviri atlanmamış)', ()=>{
    const dl = Object.keys(diller);
    if(dl.length < 2) return;
    assert.strictEqual(new Set(dl.map(d=> diller[d])).size, dl.length,
      JSON.stringify(diller));
  });

  dene('★ hiç JS hatası yok', ()=>{
    assert.strictEqual(jsHata.length, 0, jsHata.join(' | '));
  });

  await p.close(); await b.close();
  console.log('  ---- ' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
