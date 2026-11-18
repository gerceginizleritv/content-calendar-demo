// DUZ ADRESLERIN YONLENDIRICISI.
//
// shootboard.app · /fiyatlar.html · /kilavuz.html · /guide.html ·
// /privacy.html · /sartlar.html  -> dil agacindaki karsiligi.
//
// NEDEN YONLENDIRICI, NEDEN TAM SAYFA DEGIL:
//   Duz adresi tek dilde uretmek denendi ve IKI SEYI birden kirdi:
//   1. `?lang=en` sozlesmesi. app.html fiyat seridinden
//      "fiyatlar.html?lang=en" diye baglaniyor; sayfa tek dile
//      sabitlenince o adres Turkce aciliyordu.
//   2. Tarayici dili. Parametresiz gelen Ingilizce tarayicili
//      ziyaretci Turkce sayfa goruyordu.
//   Ikisi de `fiyat-baglantisi` testinde olculdu ve dustu.
//
// SIRALAMA (ustteki kazanir):
//   1. ?lang=xx        -- acikca istenmis
//   2. hafiza          -- daha once secmis (sureklilik)
//   3. tarayici dili   -- ilk kez geliyor
//   4. varsayilan      -- hicbiri tutmazsa
//
// ⚠ Dil agacindaki sayfalar bu betigi TASIMIYOR; donguye girmek
//   mumkun degil.
'use strict';

const { DILLER, VARSAYILAN, YABANCI, kodlar } = require('./diller.js');

function kacir(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Tanimadigimiz dil icin hedef: YABANCI varsa o, yoksa VARSAYILAN.
function H_YABANCI(adresler){
  return adresler[YABANCI] !== undefined ? YABANCI : VARSAYILAN;
}

function yonlendirici({ adresler, kokBaglanti, baslik }){
  const diller = kodlar();
  const satir = [];
  satir.push('<!DOCTYPE html>');
  satir.push('<html lang="' + kacir(DILLER[VARSAYILAN].htmlLang) + '">');
  satir.push('<head>');
  satir.push('<meta charset="utf-8">');
  satir.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
  satir.push('<title>' + kacir(baslik) + '</title>');
  // ⛔ IKON KUMESI BURADA DA DURUYOR. Yonlendirici kisa sure de olsa
  //    tarayicida aciliyor ve icinde "Shootboard" geciyor; eksik
  //    birakilirsa hem sekmede bos ikon gorunur hem de
  //    `ikon-ailesi` testi "ikon ailesi yine ayristi" diye duser.
  //    ⚠ Bu bes satir deponun ortak kumesi; degisirse HER yerde
  //    degisir (46. madde).
  satir.push('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
  satir.push('<link rel="icon" href="/favicon.ico" sizes="any">');
  satir.push('<link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">');
  satir.push('<link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png">');
  satir.push('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">');
  // Arama motoru: bu adres kopya degil, dillerin kapisi.
  satir.push('<link rel="canonical" href="' + kacir(kokBaglanti + adresler[VARSAYILAN]) + '">');
  for(const k of diller){
    satir.push('<link rel="alternate" hreflang="' + kacir(k) + '" href="'
               + kacir(kokBaglanti + adresler[k]) + '">');
  }
  // x-default: "dilini tanimadigimiz ziyaretci buraya" demek --
  // dolayisiyla YABANCI hedefiyle ayni yer.
  satir.push('<link rel="alternate" hreflang="x-default" href="'
             + kacir(kokBaglanti + adresler[H_YABANCI(adresler)]) + '">');
  satir.push('<script>(function(){');
  // V: tanimadigimiz dilden gelenin gidecegi yer. Bu VARSAYILAN
  // degil YABANCI: Turkce tarayici Turkce, oteki her dil Ingilizce.
  satir.push('  var H=' + JSON.stringify(adresler) + ',V=' + JSON.stringify(H_YABANCI(adresler)) + ';');
  satir.push('  var d=null;');
  satir.push('  try{var q=new URLSearchParams(location.search).get("lang");if(q&&H[q])d=q;}catch(e){}');
  satir.push('  if(!d){try{var m=localStorage.getItem("demo_ui_language");if(m&&H[m])d=m;}catch(e){}}');
  satir.push('  if(!d){try{var n=(navigator.language||"").toLowerCase().split("-")[0];if(H[n])d=n;}catch(e){}}');
  satir.push('  if(!d)d=V;');
  satir.push('  location.replace(H[d]+location.hash);');
  satir.push('})();<\/script>');
  satir.push('</head>');
  satir.push('<body>');
  // Betik kapaliysa ya da yavassa: elle gidilebilsin.
  satir.push('<noscript><p>' + kacir(baslik) + '</p><ul>');
  for(const k of diller){
    satir.push('<li><a href="' + kacir(adresler[k]) + '" hreflang="' + kacir(k) + '">'
               + kacir((DILLER[k].bayrak ? DILLER[k].bayrak + ' ' : '') + DILLER[k].ad)
               + '</a></li>');
  }
  satir.push('</ul></noscript>');
  satir.push('</body>');
  satir.push('</html>');
  return satir.join('\n') + '\n';
}

module.exports = { yonlendirici };
