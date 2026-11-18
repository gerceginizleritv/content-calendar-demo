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

const { DILLER, VARSAYILAN, kodlar } = require('./diller.js');

function kacir(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
  // Arama motoru: bu adres kopya degil, dillerin kapisi.
  satir.push('<link rel="canonical" href="' + kacir(kokBaglanti + adresler[VARSAYILAN]) + '">');
  for(const k of diller){
    satir.push('<link rel="alternate" hreflang="' + kacir(k) + '" href="'
               + kacir(kokBaglanti + adresler[k]) + '">');
  }
  satir.push('<link rel="alternate" hreflang="x-default" href="'
             + kacir(kokBaglanti + adresler[VARSAYILAN]) + '">');
  satir.push('<script>(function(){');
  satir.push('  var H=' + JSON.stringify(adresler) + ',V=' + JSON.stringify(VARSAYILAN) + ';');
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
