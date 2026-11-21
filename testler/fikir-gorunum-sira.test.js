// FİKİRLER — GÖRÜNÜM SEÇİCİSİ VE SIRALAMA (YAPILACAKLAR 68 + 69)
//
// NEDEN BU TEST VAR
//   68 — Kullanıcı 20 Kasım 2026: "fikirleri de mekanlar gibi tablo
//   ve liste görünümü uygulayabilir miyiz?" Sonra netleştirdi:
//   "aynı mekanlar gibi İKİ görünüm olacak" — yani kart + liste.
//   69 — Aynı gün: "fikirleri öncelik sırasına göre sıralayabilmek
//   de olmalı". Öncelik o güne kadar yalnızca bir SÜZGEÇTİ.
//
// ⛔ AYNI KART HTML'İ, YALNIZCA BİÇİM DEĞİŞİYOR.
//   Mekânlarda satır için AYRI bir HTML üretiliyor; burada öyle
//   YAPILMADI. Fikir kartı onlarca `data-fk-*` bağı taşıyor
//   (sürükleme, birleştirme, parçaya ayırma, öncelik, script,
//   teslim tarihi); ikinci bir HTML yazmak hepsini ikinci kez
//   yazmak olurdu ve biri değiştiğinde öteki sessizce eskirdi.
//   ⚠ Aşağıda bu ayrı bir iddia: liste görünümünde de bütün
//     düğmeler yerinde mi.
//
// ⛔ ÖNCELİKSİZ EN ALTA — kullanıcının kararı (20 Kasım 2026).
//   "Önceliksiz" AYRI bir durum, "düşük" DEĞİL (52. madde), bu
//   yüzden '3'ten de sonra geliyor.
//
// ⛔ EŞİTLİKTE ELLE SIRA KORUNUYOR. Aynı öncelikteki fikirler
//   kullanıcının sürükleyerek kurduğu düzende kalıyor; öncelik
//   sırasına geçmek elle düzeni YOK ETMİYOR.
//
// ⛔ ÖNCELİK MODUNDA SÜRÜKLEYİNCE ELLE MODA DÖNÜLÜYOR.
//   ⚠ Benim önerim "sürükleme kapansın" idi; kullanıcı bunu seçti.
//     Sessizce işe yaramayan bir sürükleme, kartın neden yerinde
//     kaldığını anlatmazdı.
//
// ⚠ TELEFONDA LİSTE GÖRÜNÜMÜ KART DÜZENİNE DÖNÜYOR (CLAUDE.md
//   Bölüm 8): 360 pikselde yedi öge yan yana sığmaz.

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

const TOHUM = ()=>{
  projects = [{id:'p1',name:'Bir',type:'vlog',steps:[]},
              {id:'p2',name:'Iki',type:'vlog',steps:[]},
              {id:'p3',name:'Uc', type:'vlog',steps:[]}];
  fikirler = [
    fikirTemizle({id:'f1',text:'Onceliksiz',parts:[],projectIds:['p1','p2','p3']}),
    fikirTemizle({id:'f2',text:'Dusuk',     parts:[],projectIds:['p1'],oncelik:'3'}),
    fikirTemizle({id:'f3',text:'Yuksek',    parts:[],projectIds:[],   oncelik:'1'}),
    fikirTemizle({id:'f4',text:'Orta',      parts:[],projectIds:[],   oncelik:'2'})
  ];
  ozellikKapisi = { fikir_onceligi:true };
  setPage('ideas');
};

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
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
  });
  await p.evaluate(TOHUM);

  const sirala = (mod)=> p.evaluate((m)=>{
    fikirSirasi = m; fikirGorunumu = 'kart'; renderFikirler();
    return [...document.querySelectorAll('[data-fk-card]')].map(x=> x.dataset.fkCard);
  }, mod);

  // ── 69 · SIRALAMA ───────────────────────────────────────────────
  const elle = await sirala('elle');
  dene('elle sırada dört fikir çiziliyor (ölçüm boşa düşmüyor)', ()=>{
    assert.strictEqual(elle.length, 4, JSON.stringify(elle));
  });
  const onc = await sirala('oncelik');
  dene('★ öncelik sırası: 1 → 2 → 3', ()=>{
    assert.deepStrictEqual(onc.slice(0,3), ['f3','f4','f2'], JSON.stringify(onc));
  });
  dene('⛔ ÖNCELİKSİZ EN ALTA (kullanıcının kararı)', ()=>{
    assert.strictEqual(onc[onc.length-1], 'f1', JSON.stringify(onc));
  });

  // ⛔ Esitlikte elle sira korunuyor: ayni oncelikte iki fikir,
  //    kullanicinin surukledigi duzende kalmali.
  const esit = await p.evaluate(()=>{
    fikirler = [
      fikirTemizle({id:'a',text:'A',parts:[],projectIds:[],oncelik:'2'}),
      fikirTemizle({id:'b',text:'B',parts:[],projectIds:[],oncelik:'2'}),
      fikirTemizle({id:'c',text:'C',parts:[],projectIds:[],oncelik:'1'})
    ];
    fikirler[0].sort = 20; fikirler[1].sort = 10; fikirler[2].sort = 30;
    fikirSirasi = 'oncelik'; renderFikirler();
    return [...document.querySelectorAll('[data-fk-card]')].map(x=> x.dataset.fkCard);
  });
  dene('★ aynı öncelikte ELLE sıra korunuyor (b, a: sort 10 < 20)', ()=>{
    assert.deepStrictEqual(esit, ['c','b','a'], JSON.stringify(esit));
  });

  // ⛔ Oncelik modunda surukleyince elle moda donuyor.
  await p.evaluate(TOHUM);
  const surukle = await p.evaluate(()=>{
    fikirSirasi = 'oncelik'; renderFikirler();
    const dugmeOnce = document.getElementById('fk_sira').textContent;
    fikirSirala('f3','f2',true);
    renderFikirler();
    return { mod: fikirSirasi, dugmeOnce,
             dugmeSonra: document.getElementById('fk_sira').textContent,
             kayitli: (()=>{ try{ return localStorage.getItem('demo_fikir_sira'); }
                             catch(e){ return null; } })() };
  });
  dene('⛔ öncelik modunda sürükleyince ELLE moda dönülüyor', ()=>{
    assert.strictEqual(surukle.mod, 'elle', JSON.stringify(surukle));
  });
  dene('★ mod değişikliği EKRANDA görünüyor (düğme metni değişti)', ()=>{
    assert.notStrictEqual(surukle.dugmeOnce, surukle.dugmeSonra, JSON.stringify(surukle));
  });
  dene('mod değişikliği hatırlanıyor', ()=>{
    assert.strictEqual(surukle.kayitli, 'elle', String(surukle.kayitli));
  });

  // ── 68 · GÖRÜNÜM ───────────────────────────────────────────────
  await p.evaluate(TOHUM);
  const gor = await p.evaluate(()=>{
    fikirGorunumu = 'kart'; renderFikirler();
    const kap = document.getElementById('fk_list');
    const kartHali = { liste: kap.classList.contains('fk-liste'),
                       yon: getComputedStyle(document.querySelector('[data-fk-card]')).flexDirection };
    fikirGorunumu = 'liste'; renderFikirler();
    const listeHali = { liste: kap.classList.contains('fk-liste'),
                        display: getComputedStyle(kap).display,
                        yon: getComputedStyle(document.querySelector('[data-fk-card]')).flexDirection };
    return { kartHali, listeHali,
             dugmeSayisi: document.querySelectorAll('#fk_gorunum [data-fkgor]').length,
             basili: [...document.querySelectorAll('#fk_gorunum [data-fkgor]')]
                       .map(x=> x.getAttribute('aria-pressed')) };
  });
  dene('★ iki görünüm düğmesi var (kart · liste)', ()=>{
    assert.strictEqual(gor.dugmeSayisi, 2, JSON.stringify(gor));
  });
  dene('★ liste görünümünde kart SATIRA dönüyor', ()=>{
    assert.strictEqual(gor.kartHali.yon, 'column', JSON.stringify(gor.kartHali));
    assert.strictEqual(gor.listeHali.yon, 'row', JSON.stringify(gor.listeHali));
    assert.strictEqual(gor.listeHali.display, 'block', JSON.stringify(gor.listeHali));
  });
  dene('seçili görünüm aria-pressed ile belli', ()=>{
    assert.deepStrictEqual(gor.basili, ['false','true'], JSON.stringify(gor.basili));
  });

  // ⛔ ASIL RISK: liste gorunumunde dugmeler kaybolmasin.
  const dugmeler = await p.evaluate(()=>{
    const say = ()=> ({
      sil: document.querySelectorAll('[data-fk-del]').length,
      proj: document.querySelectorAll('[data-fk-projbtn]').length,
      onc: document.querySelectorAll('[data-fk-onc]').length,
      script: document.querySelectorAll('[data-fk-script]').length,
      due: document.querySelectorAll('[data-fk-due]').length
    });
    fikirGorunumu = 'kart'; renderFikirler(); const k = say();
    fikirGorunumu = 'liste'; renderFikirler(); const l = say();
    return { k, l };
  });
  dene('⛔ liste görünümünde HİÇBİR düğme kaybolmuyor', ()=>{
    assert.deepStrictEqual(dugmeler.l, dugmeler.k, JSON.stringify(dugmeler));
  });

  // ── ÇOKLU PROJE AÇ/KAPAT ───────────────────────────────────────
  const proj = await p.evaluate(()=>{
    fikirGorunumu = 'liste'; renderFikirler();
    const dug = document.querySelector('[data-fk-projac]');
    if(!dug) return { yok:true };
    const kutu = dug.closest('.fk-proj-kutu');
    const cip = [...kutu.querySelectorAll('.fk-proj-chip.bagli')];
    const gorunen = ()=> cip.filter(x=> getComputedStyle(x).display !== 'none').length;
    const kapali = gorunen(), metinKapali = dug.textContent;
    dug.click();
    const acik = gorunen(), metinAcik = dug.textContent;
    // TEK projeli fikirde dugme OLMAMALI
    const tekli = document.querySelector('[data-fk-card="f2"]');
    return { kapali, acik, metinKapali, metinAcik, toplamCip: cip.length,
             tekliDugme: tekli ? !!tekli.querySelector('[data-fk-projac]') : null,
             aria: dug.getAttribute('aria-expanded') };
  });
  dene('★ çoklu projede aç/kapat düğmesi var ve "+N" yazıyor', ()=>{
    assert.ok(!proj.yok, 'dugme yok');
    assert.strictEqual(proj.metinKapali, '+2', JSON.stringify(proj));
  });
  dene('★ kapalıyken yalnızca BİR çip görünüyor', ()=>{
    assert.strictEqual(proj.kapali, 1, JSON.stringify(proj));
  });
  dene('★ açınca HEPSİ görünüyor', ()=>{
    assert.strictEqual(proj.acik, proj.toplamCip, JSON.stringify(proj));
    assert.strictEqual(proj.aria, 'true', JSON.stringify(proj));
  });
  dene('⛔ TEK projeli fikirde aç/kapat düğmesi YOK', ()=>{
    assert.strictEqual(proj.tekliDugme, false, JSON.stringify(proj));
  });

  // ── HER DİLDE ──────────────────────────────────────────────────
  const diller = await p.evaluate(()=> Object.keys(LANG));
  const metin = {};
  for(const d of diller){
    metin[d] = await p.evaluate((dil)=>{
      setLanguage(dil); renderFikirler();
      return { sira: document.getElementById('fk_sira').textContent.trim(),
               gorunum: [...document.querySelectorAll('#fk_gorunum [data-fkgor]')]
                          .map(x=> x.title),
               ac: (document.querySelector('[data-fk-projac]')||{}).title || '' };
    }, d);
  }
  dene('★ sıra ve görünüm adları HER DİLDE dolu', ()=>{
    assert.ok(diller.every(d=> metin[d].sira.length > 3
      && metin[d].gorunum.length === 2 && metin[d].gorunum.every(x=> x && x.length > 2)
      && metin[d].ac.length > 3), JSON.stringify(metin));
  });
  dene('★ metinler iki dilde FARKLI (sözlüğe girmiş)', ()=>{
    assert.notStrictEqual(metin[diller[0]].sira, metin[diller[1]].sira, JSON.stringify(metin));
    assert.notStrictEqual(metin[diller[0]].ac, metin[diller[1]].ac, JSON.stringify(metin));
  });
  await p.evaluate(()=> setLanguage('tr'));

  // ── TELEFONDA KART DÜZENİ (CLAUDE.md Bölüm 8) ──────────────────
  await p.setViewportSize({ width:360, height:780 });
  await p.waitForTimeout(250);
  const tel = await p.evaluate(()=>{
    fikirGorunumu = 'liste'; renderFikirler();
    const kap = document.getElementById('fk_list');
    return { display: getComputedStyle(kap).display,
             yon: getComputedStyle(document.querySelector('[data-fk-card]')).flexDirection,
             govdeTasma: Math.round(document.documentElement.scrollWidth
                                    - document.documentElement.clientWidth) };
  });
  dene('⛔ 360px: liste görünümü KART düzenine dönüyor', ()=>{
    assert.strictEqual(tel.yon, 'column', JSON.stringify(tel));
    assert.strictEqual(tel.display, 'grid', JSON.stringify(tel));
  });
  dene('360px: sayfa yatay taşmıyor', ()=>{
    assert.strictEqual(tel.govdeTasma, 0, String(tel.govdeTasma));
  });

  dene('sayfa hatası yok', ()=> assert.strictEqual(jsHata.length, 0, jsHata.join(' | ')));
  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
