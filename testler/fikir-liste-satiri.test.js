// FİKİRLER LİSTESİ: SATIR YÜKSEKLİĞİ VE "YENİ FİKİR" KUTUSU
// (YAPILACAKLAR 74a, 74b)
//
// NEDEN BU TEST VAR
//   Kullanıcı 21 Kasım 2026'da ekran görüntüsüyle bildirdi:
//   *"Yeni fikir ekle butonu çok büyük... fikirler satırları listede
//   çok kötü görünüyor. Her bir satır aynı yükseklikte olmalı. Eğer
//   yükseklik sığmıyorsa ... silik bir yazı ile '… devamı' gibi bir
//   kelime ile açılır hale getirilebilir."*
//
// ⚠ ÖLÇÜM TEŞHİSİ KISMEN DÜZELTTİ: masaüstünde satırlar ZATEN eşitti
//   (dördü de tam 150 px). Sorun eşitlik değil, hepsinin gereksiz
//   YÜKSEK olmasıydı — tek kelimelik bir fikir de 150 px kaplıyordu.
//   Kaynağı `.fk-card-body`ye verilen SABİT yükseklikti (5 satır).
//
// ⛔ EN BÜYÜK RİSK: "DEVAMI" DÜĞMESİNİN SATIRLARI EŞİTSİZ YAPMASI.
//   İlk sürümde düğme akışa eklendi ve ölçüm gösterdi: taşan satır
//   156, taşmayan 131. Yani düğme tam da kullanıcının şikâyet ettiği
//   şeyi yapıyordu. Aşağıda ayrı bir iddia bunu ölçüyor.
//
// ⛔ İKİNCİ RİSK: TELEFONA SIZMAK (Bölüm 8). 560'ın altında liste
//   görünümü ızgaraya dönüyor ve orada KART düzeni geçerli;
//   kartların eşit yükseklikte olması 19 Kasım 2026'da kullanıcının
//   kendi isteğiydi. İlk sürümde kurallar sarılmamıştı ve telefonda
//   kart boyları 199/229/229/229 iken 136/229/229/187 oldu — bir
//   gerilemeydi, ölçüm yakaladı.
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

const UZUN = 'Süleymaniye — zemindeki boşluk. İzleyici yorumda tarif etti: '
  + 'giriş kapısının karşısı, ortadaki büyük avizeye varmadan, halının altı. '
  + 'Gözle değil ayakla bulunuyor: yere vurunca boşluğun sesi farklı çıkıyor. '
  + 'Kendisine yıllar önce yaşlı bir bey göstermiş, herkes bilmezmiş.';

async function sayfa(b, genislik){
  const p = await b.newPage({ viewport:{ width: genislik, height: 950 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                   localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1700);
  await p.evaluate(async (uzun)=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    projects = [{ id:'p1', name:'DENEME', type:'vlog', steps:{}, createdAt:Date.now() }];
    fikirler = [
      { id:'f1', text:'TEST', parts:[{ id:'a1', text:'TEST' }], sort:1, createdAt:Date.now() },
      { id:'f2', text:'Orta boy bir fikir metni', parts:[{ id:'a2', text:'Orta boy bir fikir metni' }],
        projectIds:['p1'], sort:2, createdAt:Date.now() },
      { id:'f3', text:uzun, parts:[{ id:'a3', text:uzun }], projectIds:['p1'],
        sort:3, createdAt:Date.now() }
    ];
    fikirGorunumu = 'liste';
    setPage('ideas'); renderFikirler();
    await new Promise(z=> setTimeout(z, 450));
  }, UZUN);
  return { p, jsHata };
}

const satirOku = (p)=> p.evaluate(()=>{
  // ⚠ `!!` SART: oge yoksa `null` donerdi ve `false` beklerken
  //   karsilastirma duserdi (ilk surumde alti iddia boyle dustu).
  const gor = e=> !!(e && e.offsetParent !== null);
  const kartlar = [...document.querySelectorAll('.fk-grid .fk-card:not(.fk-add)')];
  const ekle = document.querySelector('.fk-card.fk-add');
  return {
    yukseklikler: kartlar.map(k=> Math.round(k.getBoundingClientRect().height)),
    govdeYuk: kartlar.map(k=>{
      const body = k.querySelector('.fk-card-body');
      return body ? Math.round(body.getBoundingClientRect().height) : null;
    }),
    govdeEsit: kartlar.map(k=>{
      const body = k.querySelector('.fk-card-body');
      const pEl = k.querySelector('.fk-card-body > p');
      return body && pEl
        ? Math.round(body.getBoundingClientRect().height) === Math.round(pEl.getBoundingClientRect().height)
        : null;
    }),
    devamGorunur: kartlar.map(k=> gor(k.querySelector('.fk-devam'))),
    // ⚠ Metin GERCEKTEN tasiyor mu: iddia genislikten BAGIMSIZ
    //   olsun diye. 1920 pikselde uzun fikir iki satira SIGIYOR,
    //   yani orada dugme cikmamasi DOGRU.
    tasiyor: kartlar.map(k=>{
      const pEl = k.querySelector('.fk-card-body > p');
      return pEl ? pEl.scrollHeight > pEl.clientHeight + 2 : false;
    }),
    devamAdet: document.querySelectorAll('.fk-devam').length,
    ekleYuksek: ekle ? Math.round(ekle.getBoundingClientRect().height) : null,
    tasma: document.documentElement.scrollWidth - window.innerWidth
  };
});

(async ()=>{
  const b = await chromium.launch({});
  console.log('FİKİR LİSTESİ SATIRI (74a, 74b)');

  // ── 1 · MASAÜSTÜ: SATIRLAR EŞİT VE ALÇAK ─────────────────────────
  for(const g of [900, 1366, 1920]){
    const { p, jsHata } = await sayfa(b, g);
    const r = await satirOku(p);
    dene(g + 'px: üç satır da çizildi (ölçüm boşa düşmüyor)', ()=>{
      assert.strictEqual(r.yukseklikler.length, 3, JSON.stringify(r));
    });
    if(g <= 1366){
      dene(g + 'px: uzun fikir GERÇEKTEN taşıyor (ölçüm boşa düşmüyor)', ()=>{
        assert.strictEqual(r.tasiyor[2], true, JSON.stringify(r.tasiyor));
      });
    }
    dene('⛔ ' + g + 'px: satırların HEPSİ AYNI yükseklikte', ()=>{
      assert.strictEqual(new Set(r.yukseklikler).size, 1, JSON.stringify(r.yukseklikler));
    });
    dene('⛔ ' + g + 'px: satır 150 pikselden belirgin ALÇAK', ()=>{
      assert.ok(r.yukseklikler[0] < 100,
        'ölçülen ' + r.yukseklikler[0] + ' px (eskiden 150)');
    });
    dene('⛔ ' + g + 'px: gövde SABİT yüksekliği bırakmış (gövde = paragraf)', ()=>{
      assert.deepStrictEqual(r.govdeEsit, [true, true, true], JSON.stringify(r.govdeEsit));
    });
    dene('⛔ ' + g + 'px: "Devamı" tam olarak TAŞAN satırlarda var', ()=>{
      assert.deepStrictEqual(r.devamGorunur, r.tasiyor,
        'görünür=' + JSON.stringify(r.devamGorunur) + ' taşıyor=' + JSON.stringify(r.tasiyor));
    });
    dene('★ ' + g + 'px: "Yeni fikir" kutusu küçüldü (≤ 56 px)', ()=>{
      assert.ok(r.ekleYuksek !== null && r.ekleYuksek <= 56,
        'ölçülen ' + r.ekleYuksek + ' px (eskiden 309)');
    });
    dene(g + 'px: sayfa yatay taşmıyor', ()=>{
      assert.ok(r.tasma <= 0, 'taşma ' + r.tasma);
    });
    dene(g + 'px: JS hatası yok', ()=>{
      assert.strictEqual(jsHata.length, 0, jsHata.join(' | '));
    });
    await p.close();
  }

  // ── 2 · "DEVAMI" DAVRANIŞI ───────────────────────────────────────
  const { p, jsHata } = await sayfa(b, 1366);
  const dvm = await p.evaluate(async ()=>{
    const kart = [...document.querySelectorAll('.fk-grid .fk-card:not(.fk-add)')][2];
    const dug = kart.querySelector('.fk-devam');
    const pEl = kart.querySelector('.fk-card-body > p');
    const once = { yuk: Math.round(kart.getBoundingClientRect().height),
                   metin: dug.textContent.trim(),
                   tasiyor: pEl.scrollHeight > pEl.clientHeight + 2,
                   genislet: dug.getAttribute('aria-expanded') };
    // ⚠ Kartin kendi tiklamasi DUZENLEMEYI aciyor: dugme onu
    //   durdurmali, yoksa "Devami"ya basan kullanici duzenleme
    //   kipine duser.
    // ⛔ ASIL DEGISMEZ: dugme `.fk-card-body`NIN DISINDA olmali.
    //    Duzenlemeyi acan dinleyici govdenin kendisinde; dugme ICERI
    //    tasinirsa "Devami"ya basan kullanici duzenleme kipine duser.
    //    ⚠ Olculdu: bugun disarida oldugu icin `stopPropagation`
    //      olmadan da acilmiyor -- yani iddia KONUMU olcmeli.
    const disarida = !dug.closest('.fk-card-body');
    dug.click();
    await new Promise(z=> setTimeout(z, 250));
    const sonra = { yuk: Math.round(kart.getBoundingClientRect().height),
                    metin: dug.textContent.trim(),
                    tasiyor: pEl.scrollHeight > pEl.clientHeight + 2,
                    genislet: dug.getAttribute('aria-expanded'),
                    acikSinif: kart.classList.contains('fk-acik'),
                    duzenleme: !!kart.querySelector('textarea'),
                    disarida };
    return { once, sonra };
  });
  dene('★ kapalıyken metin GERÇEKTEN taşıyor (ölçüm boşa düşmüyor)', ()=>{
    assert.strictEqual(dvm.once.tasiyor, true, JSON.stringify(dvm.once));
  });
  dene('★ "Devamı"ya basınca satır AÇILIYOR ve metin tamamlanıyor', ()=>{
    assert.strictEqual(dvm.sonra.acikSinif, true, JSON.stringify(dvm.sonra));
    assert.strictEqual(dvm.sonra.tasiyor, false, JSON.stringify(dvm.sonra));
  });
  dene('★ açılınca satır UZUYOR (metin görünür oldu)', ()=>{
    assert.ok(dvm.sonra.yuk > dvm.once.yuk,
      JSON.stringify({ once: dvm.once.yuk, sonra: dvm.sonra.yuk }));
  });
  dene('★ düğmenin yazısı ve aria durumu değişiyor', ()=>{
    assert.notStrictEqual(dvm.sonra.metin, dvm.once.metin, JSON.stringify(dvm));
    assert.strictEqual(dvm.once.genislet, 'false');
    assert.strictEqual(dvm.sonra.genislet, 'true');
  });
  dene('⛔ "Devamı" DÜZENLEME kipini açmıyor', ()=>{
    assert.strictEqual(dvm.sonra.duzenleme, false, JSON.stringify(dvm.sonra));
  });
  dene('⛔ "Devamı" gövdenin DIŞINDA (içeri taşınırsa düzenleme açılır)', ()=>{
    assert.strictEqual(dvm.sonra.disarida, true, JSON.stringify(dvm.sonra));
  });

  // ── 3 · DÜĞME SATIRLARI EŞİTSİZ YAPMIYOR ─────────────────────────
  // ⛔ İlk sürümün hatası: düğme akışa eklenince taşan satır 156,
  //    taşmayan 131 oluyordu.
  const esit = await p.evaluate(async ()=>{
    renderFikirler();
    await new Promise(z=> setTimeout(z, 400));
    const k = [...document.querySelectorAll('.fk-grid .fk-card:not(.fk-add)')];
    return { yuk: k.map(x=> Math.round(x.getBoundingClientRect().height)),
             devam: k.map(x=> !!x.querySelector('.fk-devam')) };
  });
  dene('⛔ "Devamı" olan satır, olmayanla AYNI yükseklikte', ()=>{
    assert.strictEqual(new Set(esit.yuk).size, 1, JSON.stringify(esit));
    assert.deepStrictEqual(esit.devam, [false, false, true], JSON.stringify(esit));
  });

  // ── 4 · İKİ KEZ ÇİZİLİNCE İKİNCİ DÜĞME YOK ───────────────────────
  // ⛔ Mekân kartlarında tam bu olmuştu (16 Kasım 2026).
  const ikikez = await p.evaluate(async ()=>{
    renderFikirler(); renderFikirler();
    await new Promise(z=> setTimeout(z, 400));
    return { adet: document.querySelectorAll('.fk-devam').length };
  });
  dene('⛔ aynı karede iki kez çizilince İKİNCİ düğme oluşmuyor', ()=>{
    assert.strictEqual(ikikez.adet, 1, JSON.stringify(ikikez));
  });

  // ── 5 · KART GÖRÜNÜMÜNDE DE KUTU KÜÇÜK ───────────────────────────
  const kart = await p.evaluate(async ()=>{
    fikirGorunumu = 'kart'; renderFikirler();
    await new Promise(z=> setTimeout(z, 350));
    const ekle = document.querySelector('.fk-card.fk-add');
    const kartlar = [...document.querySelectorAll('.fk-grid .fk-card:not(.fk-add)')];
    return { ekleYuksek: Math.round(ekle.getBoundingClientRect().height),
             enUzunKart: Math.max(...kartlar.map(k=> Math.round(k.getBoundingClientRect().height))),
             devamGorunur: kartlar.some(k=>{
               const d = k.querySelector('.fk-devam');
               return d && d.offsetParent !== null; }) };
  });
  dene('★ KART görünümünde de kutu küçük (komşusunun boyuna uzamıyor)', ()=>{
    assert.ok(kart.ekleYuksek <= 56,
      'kutu ' + kart.ekleYuksek + ' px, en uzun kart ' + kart.enUzunKart + ' px');
    assert.ok(kart.enUzunKart > kart.ekleYuksek + 40, JSON.stringify(kart));
  });
  dene('⛔ KART görünümünde "Devamı" ÇIKMIYOR (74b liste işi)', ()=>{
    assert.strictEqual(kart.devamGorunur, false, JSON.stringify(kart));
  });

  // ── 6 · TASLAK AÇILINCA KUTU YİNE TAM KART ───────────────────────
  const taslak = await p.evaluate(async ()=>{
    fikirGorunumu = 'liste'; renderFikirler();
    await new Promise(z=> setTimeout(z, 250));
    document.getElementById('fk_openAdd').click();
    await new Promise(z=> setTimeout(z, 300));
    const kutu = document.querySelector('.fk-card.fk-add');
    const st = getComputedStyle(kutu);
    const ta = document.getElementById('fk_new');
    return { acik: kutu.classList.contains('acik'),
             yuk: Math.round(kutu.getBoundingClientRect().height),
             metinAlani: !!ta,
             // ⛔ Taslak SUTUN olmali: metin alani ustte, dugmeler
             //    altta. Kucultme kurallari `.acik`e de uygulansaydi
             //    satir olur ve metin alani dugmelerin yanina
             //    sikisirdi.
             duzen: st.flexDirection,
             hizalama: st.alignSelf,
             metinGenis: ta ? Math.round(ta.getBoundingClientRect().width) : 0,
             kutuGenis: Math.round(kutu.getBoundingClientRect().width) };
  });
  dene('⛔ taslak açılınca kutu YİNE TAM KART (metin alanı sığıyor)', ()=>{
    assert.strictEqual(taslak.acik, true, JSON.stringify(taslak));
    assert.strictEqual(taslak.metinAlani, true, JSON.stringify(taslak));
    assert.ok(taslak.yuk > 100, 'taslak yüksekliği ' + taslak.yuk + ' px');
  });
  dene('⛔ taslak SÜTUN düzeninde (küçültme kuralları ona uygulanmıyor)', ()=>{
    assert.strictEqual(taslak.duzen, 'column', JSON.stringify(taslak));
    assert.notStrictEqual(taslak.hizalama, 'start', JSON.stringify(taslak));
  });
  dene('⛔ taslakta metin alanı kutunun TAMAMINI kaplıyor', ()=>{
    assert.ok(taslak.metinGenis > taslak.kutuGenis - 40,
      'metin ' + taslak.metinGenis + ' / kutu ' + taslak.kutuGenis);
  });

  // ── 7 · HER DİLDE (Bölüm 7) ──────────────────────────────────────
  const diller = await p.evaluate(()=>{
    const sonuc = {};
    for(const dil of Object.keys(LANG)){
      sonuc[dil] = ['fk_devam','fk_daha_az']
        .map(a=> (typeof LANG[dil][a] === 'string' && LANG[dil][a].trim()) ? LANG[dil][a].trim() : null);
    }
    return sonuc;
  });
  for(const dil of Object.keys(diller)){
    dene('★ ' + dil + ' sözlüğünde fk_devam ve fk_daha_az var', ()=>{
      assert.ok(diller[dil].every(Boolean), dil + ': ' + JSON.stringify(diller[dil]));
    });
  }
  dene('★ diller birbirinden FARKLI (çeviri atlanmamış)', ()=>{
    const dl = Object.keys(diller);
    if(dl.length < 2) return;
    assert.strictEqual(new Set(dl.map(d=> diller[d][0])).size, dl.length,
      JSON.stringify(diller));
  });
  dene('★ buraya kadar JS hatası yok', ()=>{
    assert.strictEqual(jsHata.length, 0, jsHata.join(' | '));
  });
  await p.close();

  // ── 8 · TELEFONDA GERİLEME YOK (Bölüm 8) ─────────────────────────
  for(const g of [360, 375, 390]){
    const m = await sayfa(b, g);
    const r = await satirOku(m.p);
    const izgara = await m.p.evaluate(()=>
      getComputedStyle(document.querySelector('.fk-grid')).display);
    dene('⛔ ' + g + 'px: dar ekranda düzen ızgara (kart düzeni korunuyor)', ()=>{
      assert.strictEqual(izgara, 'grid', 'düzen: ' + izgara);
    });
    dene('⛔ ' + g + 'px: "Devamı" GÖRÜNMÜYOR (orada liste yok)', ()=>{
      assert.deepStrictEqual(r.devamGorunur, [false, false, false],
        JSON.stringify(r.devamGorunur));
    });
    // ⛔ 19 KASIM 2026 KARARI TELEFONDA YERINDE: kart govdeleri
    //    SABIT ve BIRBIRINE ESIT yukseklikte (bes satir). 74b'nin
    //    liste kurallari buraya SIZMAMALI.
    //    ⚠ Ilk surumde iddia "govde paragrafa esit DEGIL" diye
    //      yazilmisti ve dustu: uzun fikir bes satiri TAM doldurunca
    //      govde ile paragraf dogal olarak esitleniyor. Testin
    //      iddiasi yanlisti, kod degil.
    dene('⛔ ' + g + 'px: kart gövdeleri BİRBİRİNE eşit ve sabit', ()=>{
      assert.strictEqual(new Set(r.govdeYuk).size, 1,
        'gövde yükseklikleri: ' + JSON.stringify(r.govdeYuk));
      assert.ok(r.govdeYuk[0] > 90,
        'gövde ' + r.govdeYuk[0] + ' px — beş satırlık sabit kutu beklenir');
    });
    dene('★ ' + g + 'px: "Yeni fikir" kutusu 44 px dokunma hedefi', ()=>{
      assert.ok(r.ekleYuksek >= 44, 'ölçülen ' + r.ekleYuksek + ' px');
    });
    dene(g + 'px: sayfa yatay taşmıyor', ()=>{
      assert.ok(r.tasma <= 0, 'taşma ' + r.tasma);
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
