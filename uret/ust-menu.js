// UST MENU -- TEK KAYNAK.
//
// Kullanici 16 Kasim 2026: "ana sayfadan kilavuz sayfasina gecince
// ust menuler neden farkli? Kilavuz sayfasina gecince Basla tusu
// falan yok oluyor." Olculdu: alti yayin sayfasinda UC AYRI menu,
// ikisinde dil secici yok, ikisinde CTA yok, ikisinin menusu her iki
// dilde de Ingilizce.
//
// Cozum: menu artik hicbir sayfada ELLE yazilmiyor. Bu dosya uretiyor,
// `uret/uret.js` sayfalara gomuyor, `testler/ust-menu-birligi.test.js`
// bayatlarsa dusuyor.
//
// ⛔ URETILEN BLOGU SAYFA ICINDE ELLE DEGISTIRME. Isaretlerin arasi
//    her uretimde bastan yaziliyor; elle yapilan degisiklik kaybolur.
'use strict';

const { DILLER, kodlar } = require('./diller.js');
const { SAYFALAR, BOLUMLER, CTA, adres } = require('./sayfalar.js');

const BAS = '<!-- UST-MENU: URETILIYOR (uret/ust-menu.js) -- ELLE DEGISTIRME -->';
const SON = '<!-- /UST-MENU -->';

function kacir(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Ana sayfanin bolum capalari: ana sayfadaysak sade capa, degilsek
// ana sayfanin adresi + capa (yoksa dugme bulundugu sayfada hicbir
// yere gitmez -- 16 Kasim'da kilavuzda tam bu oluyordu).
function capaAdresi(sayfaAdi, dil, capa){
  return (sayfaAdi === 'ev' ? '' : adres('ev', dil)) + '#' + capa;
}

function ustMenu({ sayfa, dil }){
  if(!DILLER[dil]) throw new Error('bilinmeyen dil: ' + dil);
  const satir = [];
  satir.push(BAS);
  satir.push('<header class="ust">');
  satir.push('  <div class="sar ust-ic">');
  satir.push('    <a class="marka" href="' + kacir(adres('ev', dil)) + '">Shootboard</a>');
  satir.push('    <nav class="ust-nav">');
  for(const b of BOLUMLER){
    satir.push('      <a href="' + kacir(capaAdresi(sayfa, dil, b.capa)) + '">'
               + kacir(b.menu[dil]) + '</a>');
  }
  for(const s of SAYFALAR.filter(x=> x.menude)){
    const bu = (s.ad === sayfa);
    satir.push('      <a href="' + kacir(adres(s.ad, dil)) + '"'
               + (bu ? ' aria-current="page"' : '') + '>' + kacir(s.menu[dil]) + '</a>');
  }
  satir.push('    </nav>');
  satir.push('    <div class="ust-sag">');
  // DIL SECICI: urunun kendi kalibi (app.html:4301 langSelect).
  // Iki dugme yerine acilir liste -- 41. maddede alti dil daha
  // gelecek ve o gun burasi degismeyecek.
  satir.push('      <select class="dil-sec" aria-label="' + kacir(DILLER[dil].secEtiket) + '">');
  for(const k of kodlar()){
    satir.push('        <option value="' + kacir(adres(sayfa, k)) + '" data-dil="' + kacir(k) + '"'
               + (k === dil ? ' selected' : '') + '>'
               + kacir((DILLER[k].bayrak ? DILLER[k].bayrak + ' ' : '') + DILLER[k].ad)
               + '</option>');
  }
  satir.push('      </select>');
  // ⛔ 18 KASIM 2026 — SECICI OLUYDU. Cizilmisti ama hicbir sey
  //    dinlemiyordu: secmek sayfayi degistirmiyordu. Bekci de
  //    kacirdi, cunku "secici VAR" ve "dogru adresleri tasiyor"
  //    diye olcuyordu; "secince GIDIYOR" diye olcmuyordu.
  //    Artik oyle bir iddia da var.
  // ⚠ Dil TARAYICIYA DA YAZILIYOR: kullanici bir dahaki sefere
  //    duz adresten (shootboard.app) girdiginde kendi dilinde
  //    acilsin. Kullanici 18 Kasim 2026: "ingilizce secili iken
  //    ana sayfaya gidince Turkceye dondu."
  satir.push('      <script>(function(){');
  satir.push('        var s=document.currentScript.previousElementSibling;');
  satir.push('        if(!s||s.tagName!=="SELECT")s=document.querySelector("select.dil-sec");');
  satir.push('        if(!s)return;');
  satir.push('        s.addEventListener("change",function(){');
  satir.push('          var k=s.options[s.selectedIndex];');
  satir.push('          if(!k||!k.value)return;');
  satir.push('          try{localStorage.setItem("demo_ui_language",k.getAttribute("data-dil"));}catch(e){}');
  satir.push('          location.href=k.value;');
  satir.push('        });');
  satir.push('      })();<\/script>');
  satir.push('      <a class="dug dug-birincil dug-sm" href="'
             + kacir(capaAdresi(sayfa, dil, CTA.capa)) + '">');
  satir.push('        <span class="cta-uzun">' + kacir(CTA.uzun[dil]) + '</span>');
  satir.push('        <span class="cta-kisa">' + kacir(CTA.kisa[dil]) + '</span>');
  satir.push('      </a>');
  satir.push('    </div>');
  satir.push('  </div>');
  satir.push('</header>');
  satir.push(SON);
  return satir.join('\n');
}

module.exports = { ustMenu, BAS, SON };
