// SET ATAMA ARAYÜZÜ (YAPILACAKLAR 54b, aşama 2)
//
// NEDEN BU TEST VAR
//   Kullanıcının kararı (21 Kasım 2026): *arayüz AYARLAR'da olacak,
//   "bir çekim türü seçilir, altında setler tik listesi olarak
//   gelir"*. Çekim Setleri sayfasında her setin yanına tik koymak
//   seçilmedi.
//
// ⛔ EN BÜYÜK RİSK: "DOKUNMADIM" İLE "HİÇBİRİ GELMESİN"İ KARIŞTIRMAK.
//   Satırın olmaması "uygulamayla gelen öneriler geçerli" demek;
//   boş dizi "bu türde hiçbir set tikli gelmesin" demek. İkisi ayrı
//   şey ve "Varsayılana dön" satırı SİLMEK zorunda, boşaltmak değil.
//   Aşağıda ayrı bir iddia bunu ölçüyor.
//
// ⛔ İKİNCİ RİSK: BİR TÜRÜN AYARININ ÖTEKİNE SIZMASI. Açılır listeden
//   tür değiştirince ekran o türün kendi durumunu göstermeli.
//
// ⛔ ÜÇÜNCÜ RİSK: ÖLÜ VERİ. Kendi çekim türü silinince o türün set
//   ataması da kalkmalı; `turSetTemizle` biçime baktığı için satır
//   yoksa bile sonsuza kadar durur ve kimse göremez.
//
// ⚠ CLAUDE.md Bölüm 7 — dil listesi SABİT YAZILMIYOR, `LANG`dan.
// ⚠ CLAUDE.md Bölüm 8 — 360 · 375 · 390 ölçülüyor; dokunma hedefi
//   KUTUDAN DEĞİL, `elementFromPoint` ile gerçek noktadan.

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

async function sayfa(b, genislik){
  const p = await b.newPage({ viewport:{ width: genislik, height: 1000 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                   localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1700);
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    window.__uyarilar = []; window.uyari = (m)=> window.__uyarilar.push(String(m));
    window.onayla = ()=> Promise.resolve(true);
    turSetleri = {}; kendiTurler = []; ihtiyacSetleri = []; projects = [];
    ozellikKapisi = { set_kisisellestirme: true };
    setPage('ayarlar');
    setAtamaTurDoldur(); setAtamaCiz();
  });
  await p.waitForTimeout(250);
  return { p, jsHata };
}

// Ekranın o anki hâlini tek yerden okuyor.
const durumOku = (p)=> p.evaluate(()=> ({
  tur: document.getElementById('sa_tur').value,
  secenekler: [...document.getElementById('sa_tur').options].map(o=> o.value),
  tikli: [...document.querySelectorAll('#sa_setler [data-sa-set]')]
    .filter(el=> el.checked).map(el=> el.dataset.saSet),
  hepsi: [...document.querySelectorAll('#sa_setler [data-sa-set]')].map(el=> el.dataset.saSet),
  kapali: [...document.querySelectorAll('#sa_setler [data-sa-set]')].every(el=> el.disabled),
  kendiImler: [...document.querySelectorAll('#sa_setler .sa-kendi-im')].length,
  durum: (document.getElementById('sa_durum').textContent || '').trim(),
  sifirlaGizli: document.getElementById('sa_sifirla').hidden,
  blokGizli: document.getElementById('sa_blok').hidden,
  planGizli: document.getElementById('sa_plan').hidden,
  atama: JSON.parse(JSON.stringify(turSetleri))
}));

const tikle = (p, k)=> p.evaluate(async (anahtar)=>{
  const el = document.querySelector('#sa_setler [data-sa-set="' + anahtar + '"]');
  el.checked = !el.checked;
  el.dispatchEvent(new Event('change', { bubbles:true }));
  await new Promise(z=> setTimeout(z, 80));
}, k);

const turSec = (p, tur)=> p.evaluate(async (t2)=>{
  const sel = document.getElementById('sa_tur');
  sel.value = t2;
  sel.dispatchEvent(new Event('change', { bubbles:true }));
  await new Promise(z=> setTimeout(z, 80));
}, tur);

(async ()=>{
  const b = await chromium.launch({});
  console.log('SET ATAMA ARAYÜZÜ (54b aşama 2)');
  const { p, jsHata } = await sayfa(b, 1280);

  // ── 1 · AÇILIŞ: VARSAYILAN DURUM ─────────────────────────────────
  await turSec(p, 'vlog');
  const d1 = await durumOku(p);
  const tablo = await p.evaluate(()=> JSON.parse(JSON.stringify(SET_ONERI.vlog)));
  const turAdet = await p.evaluate(()=> PROJ_TYPES.length);
  dene('★ tür listesi hazır türlerin HEPSİNİ içeriyor', ()=>{
    assert.strictEqual(d1.secenekler.length, turAdet, JSON.stringify(d1.secenekler));
  });
  dene('⛔ DOKUNULMAMIŞ türde tikliler bugünkü tablodan geliyor', ()=>{
    assert.deepStrictEqual(d1.tikli.slice().sort(), tablo.tikli.slice().sort(),
      JSON.stringify(d1));
  });
  dene('★ sekiz hazır set listede', ()=>{
    assert.strictEqual(d1.hepsi.length, 8, JSON.stringify(d1.hepsi));
  });
  dene('★ dokunulmamış türde durum satırı "uygulamayla gelen" diyor', ()=>{
    assert.ok(d1.durum.length > 10, 'durum: ' + d1.durum);
    assert.ok(!/\d/.test(d1.durum), 'durum sayı içeriyor: ' + d1.durum);
  });
  dene('⛔ dokunulmamış türde "Varsayılana dön" GİZLİ', ()=>{
    assert.strictEqual(d1.sifirlaGizli, true, JSON.stringify(d1));
  });
  dene('⛔ dokunulmamış türde atama satırı HİÇ yazılmıyor', ()=>{
    assert.deepStrictEqual(d1.atama, {}, JSON.stringify(d1.atama));
  });

  // ── 2 · TİK ANINDA KAYDEDİLİYOR ──────────────────────────────────
  await tikle(p, 'telefon');
  const d2 = await durumOku(p);
  dene('★ tik ANINDA kaydediliyor (ayrı kaydet düğmesi yok)', ()=>{
    assert.ok(d2.atama.vlog, JSON.stringify(d2.atama));
    assert.ok(d2.atama.vlog.indexOf('telefon') !== -1, JSON.stringify(d2.atama));
  });
  dene('★ tikleyince "Varsayılana dön" GÖRÜNÜYOR', ()=>{
    assert.strictEqual(d2.sifirlaGizli, false, JSON.stringify(d2));
  });
  dene('★ durum satırı artık "sen ayarladın" ve SAYI veriyor', ()=>{
    assert.ok(/\d/.test(d2.durum), 'durum: ' + d2.durum);
  });
  const oneri2 = await p.evaluate(()=>{
    const l = setOnerisiListesi({ type:'vlog', setOneri:{ soruldu:false, eklenen:[] } });
    return l.filter(x=> x.tikli).map(x=> x.k);
  });
  dene('⛔ ÖNERİ BÖLÜMÜ de aynı listeyi okuyor (tek kaynak)', ()=>{
    assert.deepStrictEqual(oneri2.slice().sort(), d2.tikli.slice().sort(),
      JSON.stringify({ oneri2, ekran: d2.tikli }));
  });

  // ⛔ TIKTEN SONRA ODAK YERINDE KALIYOR. Ilk surumde her tik tum
  //    listeyi yeniden ciziyordu: klavyeyle gezen biri her tikten
  //    sonra basa donuyor, telefonda da parmagin altindaki oge
  //    degisiyordu. Ard arda tik atilabildigi de burada olculuyor.
  const odak = await p.evaluate(async ()=>{
    const el = document.querySelector('#sa_setler [data-sa-set="onceki"]');
    el.focus();
    el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(z=> setTimeout(z, 80));
    const ayniOge = document.activeElement === el;
    // Ayni oge uzerinden IKINCI bir tik: DOM'dan kopmus olsa isleyemezdi.
    const el2 = document.querySelector('#sa_setler [data-sa-set="kayda"]');
    el2.checked = true; el2.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(z=> setTimeout(z, 80));
    return { ayniOge, bagli: document.body.contains(el),
             atama: (turSetleri.vlog || []).slice() };
  });
  dene('⛔ tikten sonra KLAVYE ODAGI yerinde kaliyor', ()=>{
    assert.strictEqual(odak.ayniOge, true, JSON.stringify(odak));
    assert.strictEqual(odak.bagli, true, JSON.stringify(odak));
  });
  dene('★ ard arda iki tik de kaydediliyor (oge DOM\'dan kopmuyor)', ()=>{
    assert.ok(odak.atama.indexOf('onceki') !== -1, JSON.stringify(odak));
    assert.ok(odak.atama.indexOf('kayda') !== -1, JSON.stringify(odak));
  });


  // ── 3 · HEPSİNİ KALDIRMAK BİR KARAR ──────────────────────────────
  const d3 = await p.evaluate(async ()=>{
    for(const el of document.querySelectorAll('#sa_setler [data-sa-set]')){
      if(el.checked){ el.checked = false; el.dispatchEvent(new Event('change', { bubbles:true }));
                      await new Promise(z=> setTimeout(z, 40)); }
    }
    return { atama: JSON.parse(JSON.stringify(turSetleri)),
             durum: (document.getElementById('sa_durum').textContent || '').trim(),
             sifirlaGizli: document.getElementById('sa_sifirla').hidden,
             oneri: setOnerisiListesi({ type:'vlog', setOneri:{ soruldu:false, eklenen:[] } })
                      .map(x=> ({ k:x.k, tikli:x.tikli })) };
  });
  dene('⛔ hepsi kaldırılınca BOŞ DİZİ yazılıyor (bir karar)', ()=>{
    assert.deepStrictEqual(d3.atama.vlog, [], JSON.stringify(d3.atama));
  });
  dene('★ durum satırı "hiçbiri tikli gelmiyor" diyor (sayı yok)', ()=>{
    assert.ok(!/\d/.test(d3.durum), 'durum: ' + d3.durum);
  });
  dene('⛔ boş dizide "Varsayılana dön" YİNE görünüyor', ()=>{
    assert.strictEqual(d3.sifirlaGizli, false, JSON.stringify(d3));
  });
  dene('⛔ boş dizide öneri bölümü KAPANMIYOR, tiksizler duruyor', ()=>{
    assert.strictEqual(d3.oneri.filter(x=> x.tikli).length, 0, JSON.stringify(d3.oneri));
    assert.ok(d3.oneri.length >= 3, JSON.stringify(d3.oneri));
  });

  // ── 4 · VARSAYILANA DÖN SATIRI SİLİYOR ───────────────────────────
  const d4 = await p.evaluate(async ()=>{
    document.getElementById('sa_sifirla').click();
    await new Promise(z=> setTimeout(z, 80));
    return { atama: JSON.parse(JSON.stringify(turSetleri)),
             varMi: Object.prototype.hasOwnProperty.call(turSetleri, 'vlog'),
             tikli: [...document.querySelectorAll('#sa_setler [data-sa-set]')]
                      .filter(el=> el.checked).map(el=> el.dataset.saSet),
             sifirlaGizli: document.getElementById('sa_sifirla').hidden };
  });
  dene('⛔ "Varsayılana dön" satırı SİLİYOR, boşaltmıyor', ()=>{
    assert.strictEqual(d4.varMi, false, JSON.stringify(d4.atama));
  });
  dene('★ sıfırlandıktan sonra tikliler yine TABLODAN geliyor', ()=>{
    assert.deepStrictEqual(d4.tikli.slice().sort(), tablo.tikli.slice().sort(),
      JSON.stringify(d4));
  });
  dene('★ sıfırlandıktan sonra düğme tekrar GİZLENİYOR', ()=>{
    assert.strictEqual(d4.sifirlaGizli, true, JSON.stringify(d4));
  });

  // ── 5 · BİR TÜRÜN AYARI ÖTEKİNE SIZMIYOR ─────────────────────────
  const d5 = await p.evaluate(async ()=>{
    turSetleri = { vlog:['telefon'], studio:[] };
    setAtamaCiz();
    const oku = async (tur)=>{
      const sel = document.getElementById('sa_tur');
      sel.value = tur; sel.dispatchEvent(new Event('change', { bubbles:true }));
      await new Promise(z=> setTimeout(z, 60));
      return { tikli: [...document.querySelectorAll('#sa_setler [data-sa-set]')]
                 .filter(el=> el.checked).map(el=> el.dataset.saSet),
               sifirlaGizli: document.getElementById('sa_sifirla').hidden };
    };
    return { vlog: await oku('vlog'), studio: await oku('studio'),
             review: await oku('review') };
  });
  dene('★ tür değişince o türün KENDİ durumu geliyor', ()=>{
    assert.deepStrictEqual(d5.vlog.tikli, ['telefon'], JSON.stringify(d5.vlog));
    assert.deepStrictEqual(d5.studio.tikli, [], JSON.stringify(d5.studio));
  });
  dene('⛔ dokunulmamış tür (review) tablodan geliyor, sızma yok', ()=>{
    assert.deepStrictEqual(d5.review.tikli, ['konusmali'], JSON.stringify(d5.review));
    assert.strictEqual(d5.review.sifirlaGizli, true, JSON.stringify(d5.review));
  });

  // ── 6 · KENDİ SETİ LİSTEDE VE AYIRT EDİLİYOR ─────────────────────
  const d6 = await p.evaluate(async ()=>{
    ihtiyacSetleri = [{ id:'st_benim1', ad:'Benim setim',
                        maddeler:[{ metin:'Powerbank', not:'yan cep' }] }];
    turSetleri = {};
    setAtamaCiz();
    await new Promise(z=> setTimeout(z, 60));
    // ⚠ NULL'A YAZMAK TESTI COKERTIR ve cokme sonraki butun
    //   iddialari durdurur -- bir mutasyon denemesinde tam bu oldu
    //   (kendi setleri listeden cikarilinca test cokuyordu, 30 iddia
    //   hic kosmuyordu). Yokluk VERI olarak donuyor, iddia olarak
    //   asagida olculuyor.
    const el = document.querySelector('#sa_setler [data-sa-set="st_benim1"]');
    if(el){
      el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true }));
      await new Promise(z=> setTimeout(z, 80));
    }
    return { bulundu: !!el,
             adet: document.querySelectorAll('#sa_setler [data-sa-set]').length,
             kendiIm: document.querySelectorAll('#sa_setler .sa-kendi-im').length,
             atama: JSON.parse(JSON.stringify(turSetleri)),
             tur: document.getElementById('sa_tur').value };
  });
  dene('★ kullanıcının KENDİ seti atama listesinde', ()=>{
    assert.strictEqual(d6.bulundu, true, 'kendi seti listede yok: ' + JSON.stringify(d6));
    assert.strictEqual(d6.adet, 9, JSON.stringify(d6));
  });
  dene('★ kendi seti "kendi setin" işaretiyle ayırt ediliyor', ()=>{
    assert.strictEqual(d6.kendiIm, 1, JSON.stringify(d6));
  });
  dene('★ kendi seti bir türe ATANABİLİYOR', ()=>{
    assert.strictEqual(d6.bulundu, true, 'kendi seti listede yok: ' + JSON.stringify(d6));
    // ⚠ O türün tablodan gelen tiklileri de listede duruyor; ölçülen
    //   şey kendi setinin EKLENDİĞİ, tek başına kaldığı değil.
    assert.ok(d6.atama[d6.tur].indexOf('st_benim1') !== -1, JSON.stringify(d6));
  });

  // ── 7 · KENDİ ÇEKİM TÜRÜ (54c ile birlikte) ──────────────────────
  const d7 = await p.evaluate(async ()=>{
    kendiTurler = [{ k:'ct_podcast1', ad:'Podcast — iki kişi', adres:false }];
    turSetleri = {};
    setAtamaTurDoldur(); setAtamaCiz();
    const sel = document.getElementById('sa_tur');
    const listede = [...sel.options].map(o=> o.value).indexOf('ct_podcast1') !== -1;
    sel.value = 'ct_podcast1'; sel.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(z=> setTimeout(z, 60));
    const bosken = [...document.querySelectorAll('#sa_setler [data-sa-set]')]
      .filter(el=> el.checked).length;
    const el = document.querySelector('#sa_setler [data-sa-set="konusmali"]');
    el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(z=> setTimeout(z, 80));
    return { listede, bosken, atama: JSON.parse(JSON.stringify(turSetleri)),
             oneri: setOnerisiListesi({ type:'ct_podcast1',
                      setOneri:{ soruldu:false, eklenen:[] } })
                      .filter(x=> x.tikli).map(x=> x.k) };
  });
  dene('★ KENDİ çekim türü atama listesinde seçilebiliyor', ()=>{
    assert.strictEqual(d7.listede, true, JSON.stringify(d7));
  });
  dene('★ kendi türünde başlangıçta hiçbir set tikli değil (tabloda yok)', ()=>{
    assert.strictEqual(d7.bosken, 0, JSON.stringify(d7));
  });
  dene('★ kendi türüne set atanınca ÖNERİ de onu veriyor', ()=>{
    assert.deepStrictEqual(d7.atama.ct_podcast1, ['konusmali'], JSON.stringify(d7));
    assert.deepStrictEqual(d7.oneri, ['konusmali'], JSON.stringify(d7));
  });

  // ── 8 · TÜR SİLİNİNCE ATAMASI DA KALKIYOR (ölü veri yok) ─────────
  const d8 = await p.evaluate(async ()=>{
    kendiTurler = [{ k:'ct_podcast1', ad:'Podcast', adres:false }];
    turSetleri = { ct_podcast1:['konusmali'], other:['dis'] };
    projects = [{ id:'q1', name:'A', type:'ct_podcast1', steps:{}, createdAt:Date.now() }];
    turleriCiz();
    await turSil('ct_podcast1');
    await new Promise(z=> setTimeout(z, 120));
    return { atama: JSON.parse(JSON.stringify(turSetleri)),
             projeAdet: projects.length, projeTuru: projects[0].type };
  });
  dene('⛔ kendi türü silinince ATAMASI da kalkıyor (ölü veri yok)', ()=>{
    assert.strictEqual(d8.atama.ct_podcast1, undefined, JSON.stringify(d8.atama));
  });
  dene('⛔ "Diğer"in kendi atamasına DOKUNULMUYOR', ()=>{
    assert.deepStrictEqual(d8.atama.other, ['dis'], JSON.stringify(d8.atama));
  });
  dene('⛔ proje yine SİLİNMİYOR, türü "other" oluyor (54c kararı)', ()=>{
    assert.strictEqual(d8.projeAdet, 1, JSON.stringify(d8));
    assert.strictEqual(d8.projeTuru, 'other', JSON.stringify(d8));
  });

  // ── 9 · KAPI ─────────────────────────────────────────────────────
  const d9 = await p.evaluate(async ()=>{
    turSetleri = {}; kendiTurler = []; ihtiyacSetleri = [];
    ozellikKapisi = { set_kisisellestirme: false };
    ozellikKapilariUygula();
    await new Promise(z=> setTimeout(z, 60));
    const bosken = document.getElementById('sa_blok').hidden;
    turSetleri = { vlog:['telefon'] };
    setAtamaCiz();
    const varken = {
      blok: document.getElementById('sa_blok').hidden,
      plan: document.getElementById('sa_plan').hidden,
      kapali: [...document.querySelectorAll('#sa_setler [data-sa-set]')].every(el=> el.disabled),
      sifirlaGizli: document.getElementById('sa_sifirla').hidden
    };
    // Kapalı planda tik ve sıfırlama hiçbir şey yapmıyor mu?
    const el = document.querySelector('#sa_setler [data-sa-set="dis"]');
    el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true }));
    setAtamaSifirla();
    await new Promise(z=> setTimeout(z, 80));
    return { bosken, varken, sonra: JSON.parse(JSON.stringify(turSetleri)),
             oneri: setOnerisiListesi({ type:'vlog', setOneri:{ soruldu:false, eklenen:[] } })
                      .filter(x=> x.tikli).map(x=> x.k) };
  });
  dene('★ kapı kapalı + hiç atama yok → bölüm hiç GÖSTERİLMİYOR', ()=>{
    assert.strictEqual(d9.bosken, true);
  });
  dene('⛔ 67. KURAL: kapı kapalı + atama VAR → bölüm duruyor', ()=>{
    assert.strictEqual(d9.varken.blok, false, JSON.stringify(d9.varken));
  });
  dene('★ kapı kapalı → tikler KAPALI ve sebebi ekranda', ()=>{
    assert.strictEqual(d9.varken.kapali, true, JSON.stringify(d9.varken));
    assert.strictEqual(d9.varken.plan, false, JSON.stringify(d9.varken));
  });
  dene('★ kapı kapalı → "Varsayılana dön" gizli', ()=>{
    assert.strictEqual(d9.varken.sifirlaGizli, true, JSON.stringify(d9.varken));
  });
  dene('⛔ kapı kapalıyken tik ve sıfırlama VERİYİ DEĞİŞTİRMİYOR', ()=>{
    assert.deepStrictEqual(d9.sonra, { vlog:['telefon'] }, JSON.stringify(d9.sonra));
  });
  dene('⛔ kapı kapalı → ATAMA ÇALIŞMAYA DEVAM EDİYOR (öneri okuyor)', ()=>{
    assert.deepStrictEqual(d9.oneri, ['telefon'], JSON.stringify(d9.oneri));
  });
  dene('★ buraya kadar JS hatası yok', ()=>{
    assert.strictEqual(jsHata.length, 0, jsHata.join(' | '));
  });
  await p.close();

  // ── 10 · HER DİLDE (Bölüm 7) ─────────────────────────────────────
  const dp = await b.newPage({ viewport:{ width:1280, height:1000 } });
  await dp.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                    localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await dp.route('**/goatcounter**', r=> r.abort());
  await dp.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await dp.waitForTimeout(1700);
  const diller = await dp.evaluate(()=>{
    const anahtarlar = ['sa_title','sa_intro','sa_plan','sa_tur','sa_kendi_im',
      'sa_varsayilan','sa_kendi','sa_kendi_bos','sa_sifirla'];
    const sonuc = {};
    for(const dil of Object.keys(LANG)){
      const eksik = [], bos = [];
      for(const a of anahtarlar){
        const v = LANG[dil][a];
        if(v === undefined || v === null){ eksik.push(a); continue; }
        const m = typeof v === 'function' ? String(v(2)) : String(v);
        if(!m.trim()) bos.push(a);
      }
      sonuc[dil] = { eksik, bos };
    }
    return sonuc;
  });
  for(const dil of Object.keys(diller)){
    dene('★ ' + dil + ' sözlüğünde 54b dizelerinin HEPSİ var ve boş değil', ()=>{
      assert.deepStrictEqual(diller[dil].eksik, [], 'eksik: ' + diller[dil].eksik.join(', '));
      assert.deepStrictEqual(diller[dil].bos, [], 'boş: ' + diller[dil].bos.join(', '));
    });
  }
  const ekranda = await dp.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    const sonuc = {};
    for(const dil of Object.keys(LANG)){
      setLanguage(dil);
      turSetleri = {}; ozellikKapisi = { set_kisisellestirme: true };
      setPage('ayarlar'); setAtamaTurDoldur(); setAtamaCiz();
      await new Promise(z=> setTimeout(z, 60));
      sonuc[dil] = {
        baslik: document.querySelector('#sa_blok h4').textContent.trim(),
        durum: document.getElementById('sa_durum').textContent.trim(),
        dugme: document.getElementById('sa_sifirla').textContent.trim()
      };
    }
    return sonuc;
  });
  dene('★ başlık, durum satırı ve düğme her dilde DOLU', ()=>{
    for(const d of Object.keys(ekranda)){
      const x = ekranda[d];
      assert.ok(x.baslik && x.durum && x.dugme, d + ': ' + JSON.stringify(x));
    }
  });
  dene('★ diller birbirinden FARKLI (çeviri atlanmamış)', ()=>{
    const dl = Object.keys(ekranda);
    if(dl.length < 2) return;
    const b2 = new Set(dl.map(d=> ekranda[d].baslik));
    assert.strictEqual(b2.size, dl.length, JSON.stringify(ekranda));
  });
  await dp.close();

  // ── 11 · TELEFONDA (Bölüm 8) ─────────────────────────────────────
  for(const g of [360, 375, 390]){
    const m = await sayfa(b, g);
    const olcum = await m.p.evaluate(async ()=>{
      ihtiyacSetleri = [{ id:'st_m1', ad:'Benim setim',
                          maddeler:[{ metin:'Powerbank', not:'' }] }];
      turSetleri = {};
      setAtamaCiz();
      await new Promise(z=> setTimeout(z, 120));
      const tik = document.querySelector('#sa_setler [data-sa-set="dis"]');
      const et = tik.closest('.sa-tik');
      et.scrollIntoView({ block:'center' });
      await new Promise(z=> setTimeout(z, 120));
      const r = et.getBoundingClientRect();
      // ⛔ KUTU OKUNMUYOR: gerçek nokta taranıyor.
      const nokta = (x,y)=>{ const e = document.elementFromPoint(Math.round(x), Math.round(y));
        return e ? e.closest('.sa-tik') : null; };
      const mx = r.left + r.width/2;
      let ust = Math.round(r.top + r.height/2), alt = ust;
      while(ust > 0 && nokta(mx, ust - 1) === et) ust--;
      while(alt < innerHeight - 1 && nokta(mx, alt + 1) === et) alt++;
      return {
        y: alt - ust + 1,
        yatayTasma: document.documentElement.scrollWidth - innerWidth,
        kesik: [...document.querySelectorAll('#sa_blok label, #sa_blok .sa-kendi-im')]
          .filter(e=> e.scrollWidth > e.clientWidth + 1)
          .map(e=> e.textContent.trim().slice(0,22) + ' ' + e.clientWidth + '/' + e.scrollWidth)
      };
    });
    dene(g + 'px: set tikinin GERÇEK dokunma yüksekliği ≥ 44', ()=>{
      assert.ok(olcum.y >= 44, 'ölçülen ' + olcum.y + ' px');
    });
    dene(g + 'px: sayfa YATAY taşmıyor', ()=>{
      assert.ok(olcum.yatayTasma <= 0, 'taşma ' + olcum.yatayTasma + ' px');
    });
    dene(g + 'px: 54b bölümünde kırpılan yazı yok', ()=>{
      assert.deepStrictEqual(olcum.kesik, [], olcum.kesik.join(' | '));
    });
    dene(g + 'px: JS hatası yok', ()=>{
      assert.strictEqual(m.jsHata.length, 0, m.jsHata.join(' | '));
    });
    await m.p.close();
  }

  await b.close();
  console.log('  ---- ' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
