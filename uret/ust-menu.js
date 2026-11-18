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
const { bayrak } = require('./bayraklar.js');

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
  // ⛔ 18 KASIM 2026 — YERLESIM DE TEK KAYNAKTAN.
  //    Kullanici: "menude sayfalar arasinda gezindigimde menude yer
  //    alan yazilar ust alanda saga sola dogru kayiyor, tum
  //    sayfalarda sabit durmali."
  //    Olculdu ve hakliydi: menunun ISARETLEMESI tek kaynaktan
  //    geliyordu ama YERLESIMI hala her sayfanin kendi stilinden:
  //      /tr/          .ust-ic gap 14px · .ust-sag margin-left 22px
  //      /tr/fiyatlar/ .ust-ic gap 12px · .ust-sag margin-left AUTO
  //    Ikinci durumda hem menu hem sag blok "auto" ile sola
  //    yasliyor, bos alani ikiye boluyor ve menu ORTAYA kayiyordu
  //    (ilk madde 503 yerine 378 pikselde).
  //
  // ⚠ NEDEN BURADA, marka.css'te DEGIL: marka.css <head>'de,
  //    sayfanin kendi <style>'indan ONCE yukleniyor; ayni
  //    belirginlikteki sayfa kurali onu ezerdi. Bu blok menunun
  //    hemen yaninda, belge sirasinda EN SONDA -- dolayisiyla
  //    kazaniyor. Tek kaynak olmasi da boylece korunuyor.
  satir.push('<style>');
  // ⛔ 18 KASIM 2026 — MENUNUN KENDI YUKSEKLIGI DE TEK KAYNAKTAN.
  //    Kullanici bildirdi: "kullanim sartlari linkine gittigimde
  //    ust menu genisliyor gibi geldi bana ... ust ve alt menu
  //    hicbir sayfada yer degistirmesin kaybolmasin!"
  //    Olculdu, hakliydi: 1280px'te ust menu ana/fiyatlar/kilavuz
  //    sayfalarinda 63 px, gizlilik/sartlar/privacy/terms'te 85 px.
  //    Sebep: o sayfalarda `.ust`un KENDI `padding-bottom:22px`i
  //    vardi. Icerik (.ust-ic 62 px) ve cagri dugmesi (44 px) her
  //    sayfada zaten aynidir -- fark yalnizca o dolgudandi.
  //    ⚠ 47. madde tam bu aileyi kapatmisti (bir sayfanin kendi
  //      menu stili olmasi); bu bir tanesi kalmis.
  //    ⚠ Bu 22 piksel SEKIZ GUN gorunmedi cunku bekci yalnizca
  //      YATAY konumu olcuyordu. Artik yukseklik de olculuyor.
  satir.push('.ust{padding-top:0;padding-bottom:0;}');
  satir.push('.ust .ust-ic{display:flex;align-items:center;gap:14px;}');
  satir.push('.ust .ust-nav{margin-left:auto;}');
  satir.push('.ust .ust-sag{margin-left:0;display:flex;align-items:center;gap:8px;}');
  satir.push('@media(max-width:879px){.ust .ust-sag{margin-left:auto;}}');
  // ⛔ CAGRI DUGMESININ OLCUSU DE TEK KAYNAKTAN.
  //    Olculdu: ana sayfada 13px yazi / 44px yukseklik / 121px
  //    genislik, oteki sayfalarda 14.5px / 42px / 135px. Yani ayni
  //    dugme her sayfada baska boydaydi ve sag blok 14 piksel
  //    kayiyordu -- kullanicinin gordugu "yazilar saga sola
  //    kayiyor"un ikinci sebebi buydu.
  // ⚠ KUCUK OLAN HALI DOGRU OLAN: kullanici 17 Kasim 2026'da
  //    "bu tus bir miktar kuculebilir ve yaninda yer alan dil
  //    tuslari buyuklugune gelebilir" dedi (45. madde) ve o
  //    duzeltme yalnizca ana sayfaya girmisti. Artik her sayfada.
  satir.push('.ust .ust-sag .dug-sm{min-height:44px;padding:9px 16px;'
             + 'font-size:13px;border-radius:9px;}');
  satir.push('@media(max-width:879px){.ust .ust-sag .dug-sm{padding:9px 12px;}}');
  satir.push('</style>');
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
  // ─────────────────────────────────────────────────────────────
  // DIL SECICI
  // ⛔ 18 KASIM 2026 — YERLI <select> BIRAKILDI. Kullanici:
  //    "bu gercekten kotu gorunuyor, cok amator duruyor. Bu alani
  //    farklilastirmamiz ve siteye yarasir sekilde premium
  //    gorunmesi lazim." Hakliydi: beyaz cerceveli kutu bir FORM
  //    ALANI gibi duruyordu, turuncu cagri tusuyla ayni agirlikta
  //    yarisiyordu ve menunun sade diline hic akraba degildi.
  //
  // Yeni yapi: SESSIZ tetikleyici (menu baglantilariyla ayni ton)
  // + tasarlanmis panel. Satirlar <a> -- yani BETIK KAPALIYKEN DE
  // calisiyor; betik yalnizca paneli acip klavyeyi yonetiyor.
  // ─────────────────────────────────────────────────────────────
  satir.push('      <div class="dil" data-dil-kutu>');
  satir.push('        <button type="button" class="dil-tetik" aria-haspopup="listbox"'
             + ' aria-expanded="false" aria-label="' + kacir(DILLER[dil].secEtiket) + '">');
  satir.push('          ' + bayrak(dil, 'tetik' + dil));
  satir.push('          <span class="dil-ad">' + kacir(DILLER[dil].ad) + '</span>');
  satir.push('          <svg class="dil-ok" viewBox="0 0 12 8" aria-hidden="true" focusable="false">'
             + '<path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor"'
             + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  satir.push('        </button>');
  satir.push('        <div class="dil-panel" role="listbox" hidden'
             + ' aria-label="' + kacir(DILLER[dil].secEtiket) + '">');
  for(const k of kodlar()){
    const bu = (k === dil);
    satir.push('          <a class="dil-satir' + (bu ? ' secili' : '') + '" role="option"'
               + ' aria-selected="' + (bu ? 'true' : 'false') + '"'
               + ' hreflang="' + kacir(k) + '" data-dil="' + kacir(k) + '"'
               + ' href="' + kacir(adres(sayfa, k)) + '">');
    satir.push('            ' + bayrak(k, 'satir' + k + dil));
    satir.push('            <span>' + kacir(DILLER[k].ad) + '</span>');
    satir.push('            <svg class="dil-tik" viewBox="0 0 14 14" aria-hidden="true" focusable="false">'
               + '<path d="M2 7.5 5.5 11 12 3.5" fill="none" stroke="currentColor"'
               + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    satir.push('          </a>');
  }
  satir.push('        </div>');
  satir.push('      </div>');
  // ⛔ SECICININ CALISTIGI OLCULUYOR. Ilk surumde <select> cizilmis
  //    ama hicbir sey dinlemiyordu: secmek sayfayi degistirmiyordu.
  //    Bekci "secici VAR" diyordu, "secince GIDIYOR" demiyordu.
  // ⚠ Dil TARAYICIYA DA yaziliyor: kullanici bir dahaki sefere duz
  //    adresten girdiginde kendi dilinde acilsin.
  satir.push('      <script>(function(){');
  satir.push('        var k=document.currentScript.previousElementSibling;');
  satir.push('        if(!k||!k.hasAttribute("data-dil-kutu"))return;');
  satir.push('        var t=k.querySelector(".dil-tetik"),pnl=k.querySelector(".dil-panel");');
  satir.push('        if(!t||!pnl)return;');
  satir.push('        var sat=[].slice.call(pnl.querySelectorAll(".dil-satir"));');
  satir.push('        function ac(v){pnl.hidden=!v;t.setAttribute("aria-expanded",v?"true":"false");');
  satir.push('          if(v){var s=pnl.querySelector(".dil-satir.secili")||sat[0];if(s)s.focus();}}');
  satir.push('        t.addEventListener("click",function(e){e.stopPropagation();ac(pnl.hidden);});');
  satir.push('        sat.forEach(function(a){a.addEventListener("click",function(){');
  satir.push('          try{localStorage.setItem("demo_ui_language",a.getAttribute("data-dil"));}catch(e){}});});');
  satir.push('        document.addEventListener("click",function(e){if(!k.contains(e.target))ac(false);});');
  satir.push('        k.addEventListener("keydown",function(e){');
  satir.push('          if(e.key==="Escape"){ac(false);t.focus();return;}');
  satir.push('          if(e.key!=="ArrowDown"&&e.key!=="ArrowUp")return;');
  satir.push('          e.preventDefault();');
  satir.push('          if(pnl.hidden){ac(true);return;}');
  satir.push('          var i=sat.indexOf(document.activeElement);');
  satir.push('          var y=e.key==="ArrowDown"?i+1:i-1;');
  satir.push('          if(y<0)y=sat.length-1; if(y>=sat.length)y=0;');
  satir.push('          if(sat[y])sat[y].focus();');
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
