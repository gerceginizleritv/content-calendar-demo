// KENDİ ÇEKİM TÜRÜ ARAYÜZÜ (YAPILACAKLAR 54c)
//
// NEDEN BU TEST VAR
//   Kullanıcı istedi (17 Kasım 2026): *"bizim default video tipleri
//   haricinde kendi bir tip eklemek isteyecek, mesela 2 kişinin
//   karşılıklı konuştuğu podcast gibi"*. 21 Kasım 2026'da dört karar
//   alındı; bu test onların HEPSİNİ ayrı ayrı ölçüyor.
//
// ⛔ EN BÜYÜK RİSK: PROJE VERİSİNİ KAYBETMEK.
//   Kullanıcının kararı (3): *"Kendi türü silinirse o türdeki projeler
//   'Diğer'e düşer. ⛔ Proje SİLİNMEZ, hiçbir veri kaybolmaz."*
//   Aşağıda ayrı bir iddia: tür silinince proje SAYISI değişmiyor.
//
// ⛔ İKİNCİ RİSK: KAPI VERİYİ GİZLİYOR SANMAK.
//   67. maddenin kuralı: *"veri durur, yalnızca görünmez"*. Kapı
//   (set_kisisellestirme) kapanınca türler ÇALIŞMAYA devam eder;
//   yalnızca ekleme/düzenleme/silme denetimleri gizlenir. Kapalı
//   planda tür listesi de, projelerin türü de yerinde kalır.
//
// ⚠ CLAUDE.md Bölüm 7 — HER DİLDE. Dil listesi SABİT YAZILMIYOR:
//   `LANG`dan okunuyor, yeni bir dil kendiliğinden giriyor.
// ⚠ CLAUDE.md Bölüm 8 — TELEFONDA DA. 360 · 375 · 390 ölçülüyor ve
//   dokunma hedefi KUTUDAN DEĞİL, `elementFromPoint` ile gerçek
//   noktadan okunuyor (adim-sorulari testindeki ders: bir ::after'ın
//   kutusu 47 px diyordu, basılabilen yer 25 pikseldi).

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

async function sayfa(b, genislik){
  const p = await b.newPage({ viewport:{ width: genislik, height: 950 } });
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
    window.__uyarilar = [];
    window.uyari = (m)=> window.__uyarilar.push(String(m));
    window.onayla = ()=> Promise.resolve(true);
    kendiTurler = [];
    ozellikKapisi = { set_kisisellestirme: true };
    setPage('ayarlar');
    turFormuTemizle(); turleriCiz();
  });
  await p.waitForTimeout(300);
  return { p, jsHata };
}

// Türü arayüzden ekliyor: `kendiTurler.push` demek, ölçülecek şeyin
// kendisini atlamak olurdu.
const turEkle = (p, ad, adres, enterIle)=> p.evaluate(async (k)=>{
  document.getElementById('ct_ad').value = k.ad;
  document.getElementById('ct_adresTik').checked = !!k.adres;
  if(k.enterIle){
    document.getElementById('ct_ad').dispatchEvent(
      new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
  }else{
    document.getElementById('ct_kaydet').click();
  }
  await new Promise(z=> setTimeout(z, 120));
  return { adet: kendiTurler.length,
           adlar: kendiTurler.map(x=> x.ad),
           anahtarlar: kendiTurler.map(x=> x.k),
           uyarilar: window.__uyarilar.slice() };
}, { ad, adres, enterIle });

(async ()=>{
  const b = await chromium.launch({});
  console.log('KENDİ ÇEKİM TÜRÜ ARAYÜZÜ (54c)');

  // ── 1 · EKLEME ───────────────────────────────────────────────────
  const { p, jsHata } = await sayfa(b, 1280);

  const e1 = await turEkle(p, 'Podcast — iki kişi', true, false);
  dene('★ kendi türü EKLENİYOR', ()=>{
    assert.strictEqual(e1.adet, 1, JSON.stringify(e1));
    assert.strictEqual(e1.adlar[0], 'Podcast — iki kişi', JSON.stringify(e1));
  });
  dene('⛔ anahtar ct_ biçiminde (sanitizeProject onu korusun diye)', ()=>{
    assert.ok(/^ct_[A-Za-z0-9_-]{1,32}$/.test(e1.anahtarlar[0]), e1.anahtarlar[0]);
  });
  const adres1 = await p.evaluate(()=> adresGerekir(kendiTurler[0].k));
  dene('★ karar 2: tik AÇIKKEN adresGerekir true', ()=>{
    assert.strictEqual(adres1, true);
  });

  const e2 = await turEkle(p, 'Masa başı anlatım', false, true);
  dene('★ Enter da kaydediyor (53a dersi: sessizce yutulmuyor)', ()=>{
    assert.strictEqual(e2.adet, 2, JSON.stringify(e2));
  });
  dene('★ Enter sayfayı YENİLEMİYOR / JS hatası yok', ()=>{
    assert.strictEqual(jsHata.length, 0, jsHata.join(' | '));
  });
  const adres2 = await p.evaluate(()=> adresGerekir(kendiTurler[1].k));
  dene('★ karar 2: tik KAPALIYKEN adresGerekir false', ()=>{
    assert.strictEqual(adres2, false);
  });

  // ── 2 · BOŞ AD VE AYNI AD ────────────────────────────────────────
  const e3 = await turEkle(p, '   ', false, false);
  dene('⛔ boş ad EKLENMİYOR ve sebebi EKRANDA yazıyor', ()=>{
    assert.strictEqual(e3.adet, 2, JSON.stringify(e3));
    assert.ok((e3.uyarilar[e3.uyarilar.length-1] || '').length > 10,
      JSON.stringify(e3.uyarilar));
  });
  const e4 = await turEkle(p, 'PODCAST — İKİ KİŞİ', false, false);
  dene('⛔ aynı ad ikinci kez EKLENMİYOR (büyük/küçük harf dâhil)', ()=>{
    assert.strictEqual(e4.adet, 2, JSON.stringify(e4));
  });

  // ── 3 · TÜR LİSTESİNDE GÖRÜNÜYOR ─────────────────────────────────
  const liste = await p.evaluate(()=>{
    const sel = document.createElement('select');
    projTypeSelectDoldur(sel, 'other');
    return [...sel.options].map(o=> ({ v:o.value, ad:o.textContent }));
  });
  dene('★ kendi türü proje TÜR LİSTESİNDE çıkıyor, adıyla', ()=>{
    const bulunan = liste.find(o=> o.ad === 'Podcast — iki kişi');
    assert.ok(bulunan, JSON.stringify(liste));
    assert.ok(/^ct_/.test(bulunan.v), bulunan.v);
  });
  dene('★ hazır yedi tür listede DURUYOR (üzerine yazılmadı)', ()=>{
    assert.ok(liste.filter(o=> !/^ct_/.test(o.v)).length >= 7, JSON.stringify(liste));
  });

  // ── 4 · DÜZENLEME: AD DEĞİŞİYOR, ANAHTAR DEĞİŞMİYOR ──────────────
  const duz = await p.evaluate(async ()=>{
    const eski = kendiTurler[0].k;
    document.querySelector('[data-ct-duzen="' + eski + '"]').click();
    document.getElementById('ct_ad').value = 'Podcast — üç kişi';
    document.getElementById('ct_kaydet').click();
    await new Promise(z=> setTimeout(z, 120));
    return { eski, yeni: kendiTurler[0].k, ad: kendiTurler[0].ad, adet: kendiTurler.length };
  });
  dene('★ düzenleme adı değiştiriyor', ()=>{
    assert.strictEqual(duz.ad, 'Podcast — üç kişi', JSON.stringify(duz));
    assert.strictEqual(duz.adet, 2, JSON.stringify(duz));
  });
  dene('⛔ düzenleme ANAHTARI değiştirmiyor (projelerin bağı kopmasın)', ()=>{
    assert.strictEqual(duz.yeni, duz.eski, JSON.stringify(duz));
  });

  // ── 5 · TAVAN ────────────────────────────────────────────────────
  const tavan = await p.evaluate(async ()=>{
    const CT = CT_MAX;
    while(kendiTurler.length < CT){
      document.getElementById('ct_ad').value = 'Tur ' + kendiTurler.length;
      document.getElementById('ct_kaydet').click();
      await new Promise(z=> setTimeout(z, 30));
    }
    const dolu = kendiTurler.length;
    window.__uyarilar = [];
    document.getElementById('ct_ad').value = 'Bir fazla';
    document.getElementById('ct_kaydet').click();
    await new Promise(z=> setTimeout(z, 80));
    const sonra = kendiTurler.length;
    // Tavan dolu: DÜZENLEME hâlâ çalışıyor mu?
    document.querySelector('[data-ct-duzen="' + kendiTurler[0].k + '"]').click();
    document.getElementById('ct_ad').value = 'Tavanda düzenlendi';
    document.getElementById('ct_kaydet').click();
    await new Promise(z=> setTimeout(z, 80));
    return { CT, dolu, sonra, adet: kendiTurler.length,
             ilkAd: kendiTurler[0].ad, uyarilar: window.__uyarilar.slice() };
  });
  dene('⛔ tavan dolunca BİR FAZLASI eklenmiyor', ()=>{
    assert.strictEqual(tavan.dolu, tavan.CT, JSON.stringify(tavan));
    assert.strictEqual(tavan.sonra, tavan.CT, JSON.stringify(tavan));
  });
  dene('★ engellenince sebep EKRANDA yazıyor (sayıyla)', ()=>{
    const son = tavan.uyarilar[0] || '';
    assert.ok(new RegExp('\\b' + tavan.CT + '\\b').test(son), 'uyarı: ' + son);
  });
  dene('⛔ tavan doluyken DÜZENLEME hâlâ çalışıyor', ()=>{
    assert.strictEqual(tavan.ilkAd, 'Tavanda düzenlendi', JSON.stringify(tavan));
    assert.strictEqual(tavan.adet, tavan.CT, JSON.stringify(tavan));
  });

  // ── 6 · SİLME: PROJE SİLİNMİYOR, TÜRÜ "DİĞER" OLUYOR ─────────────
  const sil = await p.evaluate(async ()=>{
    kendiTurler = kendiTurler.slice(0, 1);
    const k = kendiTurler[0].k;
    projects = [
      { id:'p1', name:'A', type:k, steps:{}, createdAt:Date.now() },
      { id:'p2', name:'B', type:k, steps:{}, createdAt:Date.now() },
      { id:'p3', name:'C', type:'desk', steps:{}, createdAt:Date.now() }
    ];
    turleriCiz();
    const oncesi = projects.length;
    // Onay metni kaç projeyi etkilediğini SÖYLÜYOR mu?
    let metin = '';
    window.onayla = (m)=>{ metin = String(m); return Promise.resolve(true); };
    await turSil(k);
    await new Promise(z=> setTimeout(z, 120));
    return { oncesi, sonrasi: projects.length,
             turler: projects.map(x=> x.type),
             turAdet: kendiTurler.length, metin };
  });
  dene('⛔ KARAR 3: tür silinince PROJE SİLİNMİYOR', ()=>{
    assert.strictEqual(sil.sonrasi, sil.oncesi, JSON.stringify(sil));
    assert.strictEqual(sil.sonrasi, 3, JSON.stringify(sil));
  });
  dene('★ KARAR 3: o türdeki projeler "other"a düşüyor', ()=>{
    assert.deepStrictEqual(sil.turler, ['other','other','desk'], JSON.stringify(sil));
  });
  dene('★ tür listeden kalkıyor', ()=>{
    assert.strictEqual(sil.turAdet, 0, JSON.stringify(sil));
  });
  dene('★ onay metni KAÇ PROJEYİ etkilediğini söylüyor', ()=>{
    assert.ok(/\b2\b/.test(sil.metin), 'metin: ' + sil.metin);
  });
  dene('★ silmede JS hatası yok', ()=>{
    assert.strictEqual(jsHata.length, 0, jsHata.join(' | '));
  });

  // ── 7 · KAPI ─────────────────────────────────────────────────────
  const kapali = await p.evaluate(async ()=>{
    kendiTurler = [];
    ozellikKapisi = { set_kisisellestirme: false };
    ozellikKapilariUygula();
    await new Promise(z=> setTimeout(z, 60));
    const bosken = {
      blok: document.getElementById('ct_blok').hidden
    };
    // Şimdi türü OLAN biri: bölüm duruyor, form yok.
    kendiTurler = [{ k:'ct_abc123', ad:'Podcast', adres:false }];
    projects = [{ id:'p9', name:'Z', type:'ct_abc123', steps:{}, createdAt:Date.now() }];
    turleriCiz();
    const varken = {
      blok: document.getElementById('ct_blok').hidden,
      form: document.getElementById('ct_form').hidden,
      plan: document.getElementById('ct_plan').hidden,
      satir: document.querySelectorAll('#ct_liste li').length,
      silDug: document.querySelectorAll('#ct_liste [data-ct-sil]').length,
      duzDug: document.querySelectorAll('#ct_liste [data-ct-duzen]').length,
      adListede: (()=>{ const s = document.createElement('select');
                        projTypeSelectDoldur(s, 'ct_abc123');
                        return s.value; })(),
      projeTuru: projects[0].type
    };
    // Kapı kapalıyken Enter'a basılsa bile eklenmiyor mu?
    window.__uyarilar = [];
    document.getElementById('ct_ad').value = 'Kapıdan geçmesin';
    turKaydet();
    await new Promise(z=> setTimeout(z, 60));
    return { bosken, varken, kapidanSonra: kendiTurler.length };
  });
  dene('★ kapı kapalı + hiç tür yok → bölüm hiç GÖSTERİLMİYOR', ()=>{
    assert.strictEqual(kapali.bosken.blok, true, JSON.stringify(kapali.bosken));
  });
  dene('⛔ 67. KURAL: kapı kapalı + tür VAR → liste DURUYOR', ()=>{
    assert.strictEqual(kapali.varken.blok, false, JSON.stringify(kapali.varken));
    assert.strictEqual(kapali.varken.satir, 1, JSON.stringify(kapali.varken));
  });
  dene('★ kapı kapalı → EKLEME FORMU ve silme/düzenleme yok', ()=>{
    assert.strictEqual(kapali.varken.form, true, JSON.stringify(kapali.varken));
    assert.strictEqual(kapali.varken.silDug, 0, JSON.stringify(kapali.varken));
    assert.strictEqual(kapali.varken.duzDug, 0, JSON.stringify(kapali.varken));
  });
  dene('★ kapı kapalı → sebebi EKRANDA yazıyor (plan notu)', ()=>{
    assert.strictEqual(kapali.varken.plan, false, JSON.stringify(kapali.varken));
  });
  dene('⛔ kapı kapalı → VERİ ÇALIŞMAYA DEVAM EDİYOR (tür + proje)', ()=>{
    assert.strictEqual(kapali.varken.adListede, 'ct_abc123', JSON.stringify(kapali.varken));
    assert.strictEqual(kapali.varken.projeTuru, 'ct_abc123', JSON.stringify(kapali.varken));
  });
  dene('⛔ kapı kapalıyken gizli formdan Enter da EKLEMİYOR', ()=>{
    assert.strictEqual(kapali.kapidanSonra, 1, JSON.stringify(kapali));
  });
  await p.close();

  // ── 8 · HER DİLDE (Bölüm 7) — dil listesi SABİT DEĞİL ────────────
  const dp = await b.newPage({ viewport:{ width:1280, height:950 } });
  await dp.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                    localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await dp.route('**/goatcounter**', r=> r.abort());
  await dp.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await dp.waitForTimeout(1700);
  const diller = await dp.evaluate(()=>{
    const sonuc = {};
    const anahtarlar = ['ct_title','ct_intro','ct_plan','ct_ad','ct_ad_ph',
      'ct_adres_bas','ct_adres_label','ct_adres_im','ct_ekle','ct_bos',
      'ct_kullanim','ct_ad_gerek','ct_limit','ct_ayni','ct_sil','ct_sil_bagli'];
    // ⚠ DİL LİSTESİ LANG'DAN: yeni bir dil kendiliğinden giriyor.
    for(const dil of Object.keys(LANG)){
      const eksik = [], bos = [];
      for(const a of anahtarlar){
        const v = LANG[dil][a];
        if(v === undefined || v === null){ eksik.push(a); continue; }
        const metin = typeof v === 'function' ? String(v('X', 2)) : String(v);
        if(!metin.trim()) bos.push(a);
      }
      sonuc[dil] = { eksik, bos };
    }
    return sonuc;
  });
  for(const dil of Object.keys(diller)){
    dene('★ ' + dil + ' sözlüğünde 54c dizelerinin HEPSİ var ve boş değil', ()=>{
      assert.deepStrictEqual(diller[dil].eksik, [], 'eksik: ' + diller[dil].eksik.join(', '));
      assert.deepStrictEqual(diller[dil].bos, [], 'boş: ' + diller[dil].bos.join(', '));
    });
  }
  // Ekranda da gerçekten DİLE GÖRE değişiyor mu?
  const ekranda = await dp.evaluate(async ()=>{
    const sonuc = {};
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    for(const dil of Object.keys(LANG)){
      setLanguage(dil);
      ozellikKapisi = { set_kisisellestirme: true };
      kendiTurler = []; setPage('ayarlar'); turFormuTemizle(); turleriCiz();
      await new Promise(z=> setTimeout(z, 60));
      sonuc[dil] = {
        baslik: document.querySelector('#ct_blok h4').textContent.trim(),
        bos: document.querySelector('#ct_liste .hs-bos').textContent.trim(),
        dugme: document.getElementById('ct_kaydet').textContent.trim(),
        yer: document.getElementById('ct_ad').placeholder
      };
    }
    return sonuc;
  });
  dene('★ başlık, boş metin, düğme ve yer tutucu her dilde DOLU', ()=>{
    const dl = Object.keys(ekranda);
    for(const d of dl){
      const x = ekranda[d];
      assert.ok(x.baslik && x.bos && x.dugme && x.yer,
        d + ': ' + JSON.stringify(x));
    }
    // En az iki dil varsa başlıklar BİRBİRİNDEN farklı olmalı; aynıysa
    // çeviri atlanmış demektir.
    if(dl.length > 1){
      const baslik = new Set(dl.map(d=> ekranda[d].baslik));
      assert.ok(baslik.size === dl.length, 'aynı başlık: ' + JSON.stringify(ekranda));
    }
  });
  await dp.close();

  // ── 9 · TELEFONDA (Bölüm 8) — 360 · 375 · 390 ────────────────────
  for(const g of [360, 375, 390]){
    const m = await sayfa(b, g);
    const olcum = await m.p.evaluate(async ()=>{
      kendiTurler = [];
      ozellikKapisi = { set_kisisellestirme: true };
      setPage('ayarlar');
      document.getElementById('ct_ad').value = 'Podcast — iki kişi';
      document.getElementById('ct_adresTik').checked = true;
      document.getElementById('ct_kaydet').click();
      await new Promise(z=> setTimeout(z, 150));
      const dug = document.querySelector('#ct_liste [data-ct-sil]');
      dug.scrollIntoView({ block:'center' });
      await new Promise(z=> setTimeout(z, 120));
      const r = dug.getBoundingClientRect();
      // ⛔ KUTU OKUNMUYOR: gerçek nokta taranıyor.
      const nokta = (x,y)=>{ const e = document.elementFromPoint(Math.round(x), Math.round(y));
        return e ? e.closest('button, [role="button"]') : null; };
      const mx = r.left + r.width/2;
      let ust = Math.round(r.top + r.height/2), alt = ust;
      while(ust > 0 && nokta(mx, ust - 1) === dug) ust--;
      while(alt < innerHeight - 1 && nokta(mx, alt + 1) === dug) alt++;
      const orta = Math.round(r.top + r.height/2);
      let sol = Math.round(mx), sag = sol;
      while(sol > 0 && nokta(sol - 1, orta) === dug) sol--;
      while(sag < innerWidth - 1 && nokta(sag + 1, orta) === dug) sag++;
      // Tik de parmakla basılıyor.
      const tik = document.querySelector('.ct-tik');
      const tr = tik.getBoundingClientRect();
      return {
        y: alt - ust + 1, x: sag - sol + 1,
        tikY: Math.round(tr.height),
        yatayTasma: document.documentElement.scrollWidth - innerWidth,
        kesik: [...document.querySelectorAll('#ct_blok .hs-ad, #ct_blok label')]
          .filter(e=> e.scrollWidth > e.clientWidth + 1)
          .map(e=> e.textContent.trim().slice(0,24) + ' ' + e.clientWidth + '/' + e.scrollWidth)
      };
    });
    dene(g + 'px: silme düğmesinin GERÇEK dokunma yüksekliği ≥ 44', ()=>{
      assert.ok(olcum.y >= 44, 'ölçülen ' + olcum.y + ' px · ' + JSON.stringify(olcum));
    });
    dene(g + 'px: silme düğmesinin gerçek genişliği ≥ 44', ()=>{
      assert.ok(olcum.x >= 44, 'ölçülen ' + olcum.x + ' px');
    });
    dene(g + 'px: adres tiki ≥ 44 px', ()=>{
      assert.ok(olcum.tikY >= 44, 'ölçülen ' + olcum.tikY + ' px');
    });
    dene(g + 'px: sayfa YATAY taşmıyor', ()=>{
      assert.ok(olcum.yatayTasma <= 0, 'taşma ' + olcum.yatayTasma + ' px');
    });
    dene(g + 'px: 54c bölümünde kırpılan yazı yok', ()=>{
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
