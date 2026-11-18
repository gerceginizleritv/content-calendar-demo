// UST MENU HER SAYFADA AYNI (YAPILACAKLAR 47. madde)
//
// Kullanici 16 Kasim 2026: "ana sayfadan kilavuz sayfasina gecince ust
// menuler neden farkli? Kilavuz sayfasina gecince Basla tusu falan yok
// oluyor."
//
// ⛔ BU TEST LISTE YAZMAZ. Dil listesini uret/diller.js'ten, sayfa
//    listesini uret/sayfalar.js'ten okuyor. Yeni bir dil ya da sayfa
//    eklenince kendiliginden kapsama giriyor (CLAUDE.md Bolum 7:
//    "listeyi elle yazmayan, kendi bulan bekci test").
'use strict';
const assert = require('node:assert');
const { ustMenu, BAS, SON } = require('../uret/ust-menu.js');
const { DILLER, kodlar } = require('../uret/diller.js');
const { SAYFALAR, BOLUMLER, CTA, adres } = require('../uret/sayfalar.js');

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

const DIL = kodlar();
const SAYFA = SAYFALAR.map(s=> s.ad);
// Her sayfa x her dil icin menuyu bir kez uret.
const M = {};
for(const d of DIL) for(const s of SAYFA) M[s + '@' + d] = ustMenu({ sayfa: s, dil: d });

dene('her sayfa her dilde menu uretiyor', ()=>{
  assert.ok(DIL.length >= 2, 'dil listesi bos ya da tek: ' + DIL.join(','));
  assert.ok(SAYFA.length >= 5, 'sayfa listesi beklenenden kisa: ' + SAYFA.join(','));
  for(const k of Object.keys(M)) assert.ok(M[k] && M[k].length > 100, k + ' bos');
});

dene('★ menu HER SAYFADA AYNI (yalnizca "buradasin" isareti farkli)', ()=>{
  for(const d of DIL){
    // Sayfaya ozel iki sey disinda metin birebir ayni olmali:
    //   aria-current="page"  ve  <option ... selected>
    const sadelestir = (t)=> t
      .replace(/ aria-current="page"/g, '')
      // Dil satirlari sayfaya gore farkli adres tasiyor; menunun
      // AYNI olup olmadigini olcerken adresi degil YAPIYI
      // karsilastiriyoruz.
      // ⚠ SIRA ONEMLI: once CAPALAR. Ana sayfada capa "#nasil",
      //   oteki sayfalarda "/tr/#nasil" -- ikisi de "?#nasil"
      //   olmali. Adres kurali once kosarsa "/tr/#nasil" tumden
      //   "?" oluyor ve iki menu farkli gorunuyor (18 Kasim 2026'da
      //   tam bu oldu, OLCU yaniliyordu).
      .replace(/href="[^"]*#/g, 'href="?#')
      .replace(/href="\/[a-z]{2}\/[^"]*"/g, 'href="?"')
      .replace(/ id="bk[a-z0-9]+"/g, ' id="?"')
      .replace(/url\(#bk[a-z0-9]+\)/g, 'url(#?)');
    const ilk = sadelestir(M[SAYFA[0] + '@' + d]);
    for(const s of SAYFA){
      assert.strictEqual(sadelestir(M[s + '@' + d]), ilk,
        d + ' dilinde "' + s + '" menusu "' + SAYFA[0] + '" menusundan farkli');
    }
  }
});

dene('★ HER sayfada CTA var (kullanicinin sikayeti buydu)', ()=>{
  for(const d of DIL) for(const s of SAYFA){
    assert.ok(M[s+'@'+d].includes(CTA.uzun[d]),
      s + '@' + d + ' icinde "' + CTA.uzun[d] + '" yok');
    assert.ok(M[s+'@'+d].includes('#' + CTA.capa),
      s + '@' + d + ' CTA hicbir yere gitmiyor');
  }
});

dene('★ HER sayfada dil secici var ve BUTUN dilleri tasiyor', ()=>{
  // ⛔ 18 KASIM 2026 — YERLI <select> BIRAKILDI. Kullanici:
  //    "cok amator duruyor". Yerine bayrakli ozel secici geldi:
  //    .dil-tetik dugmesi + role="listbox" panel + her dil icin
  //    bir <a class="dil-satir">. Satirlar GERCEK BAGLANTI, yani
  //    betik kapaliyken de calisiyor -- iddia da bunu olcuyor.
  for(const d of DIL) for(const s of SAYFA){
    const t = M[s+'@'+d];
    assert.ok(/<button type="button" class="dil-tetik"/.test(t),
      s+'@'+d+' dil tetikleyicisi yok');
    assert.ok(/aria-haspopup="listbox"/.test(t), s+'@'+d+' aria-haspopup yok');
    assert.ok(/<div class="dil-panel" role="listbox"/.test(t), s+'@'+d+' panel yok');
    for(const k of DIL){
      assert.ok(t.includes('>' + DILLER[k].ad + '</span>'),
        s+'@'+d+' icinde "' + DILLER[k].ad + '" satiri yok');
      assert.ok(t.includes('href="' + adres(s, k) + '"'),
        s+'@'+d+' · ' + k + ' satiri AYNI sayfanin ' + k + ' adresine gitmiyor');
    }
    // Bulunulan dil isaretli olsun.
    assert.ok(t.includes('class="dil-satir secili" role="option" aria-selected="true"'),
      s+'@'+d+' secili dil isaretlenmemis');
  }
});

dene('★ dil degistirmek AYNI sayfada kaliyor (ana sayfaya atmiyor)', ()=>{
  // 48. maddenin kok sebebi: baglantinin biri dile gore yeniden
  // yazilmayi kaciriyordu. Secici artik adresi tablodan uretiyor.
  for(const s of SAYFA) for(const a of DIL) for(const b of DIL){
    assert.ok(M[s+'@'+a].includes('href="' + adres(s, b) + '"'),
      s + ' sayfasinda ' + a + '->' + b + ' gecisi yanlis adrese gidiyor');
  }
});

dene('capa baglantilari bulunduklari sayfadan ANA SAYFAYA gidiyor', ()=>{
  for(const d of DIL) for(const s of SAYFA){
    for(const b of BOLUMLER){
      const beklenen = (s === 'ev' ? '' : adres('ev', d)) + '#' + b.capa;
      assert.ok(M[s+'@'+d].includes('href="' + beklenen + '"'),
        s+'@'+d+' · "' + b.capa + '" capasi "' + beklenen + '" degil');
    }
  }
});

dene('isaretler var (uretici blogu bulabilsin)', ()=>{
  for(const k of Object.keys(M)){
    assert.ok(M[k].startsWith(BAS), k + ' baslangic isareti yok');
    assert.ok(M[k].trimEnd().endsWith(SON), k + ' bitis isareti yok');
  }
});

dene('★ menude DOKUNULMAZ sayfa yok (tiktok/youtube geri donus adresleri)', ()=>{
  const { DOKUNULMAZ } = require('../uret/sayfalar.js');
  for(const k of Object.keys(M)) for(const d of DOKUNULMAZ){
    assert.ok(!M[k].includes(d), k + ' menusu dokunulmaz dosyaya baglaniyor: ' + d);
  }
});

console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
process.exit(kalan ? 1 : 0);
