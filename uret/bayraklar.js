// BAYRAKLAR -- SATIR ICI SVG.
//
// ⛔ NEDEN EMOJI DEGIL. Windows bayrak emojilerini cizmiyor; onlarin
//    yerine iki harf gosteriyor ("TR" gibi). Kullanici 18 Kasim
//    2026'da bayrak istedi ve ilk hali emojiyle yapildi; ayni gun
//    "cok amator duruyor" dedi. SVG her isletim sisteminde AYNI
//    goruntuyu veriyor ve keskin cikiyor.
//
// ⚠ YENI DIL EKLERKEN: bayragi buraya ekle. Eksikse dil secici
//    bayraksiz ama CALISIR halde ciziliyor (asagidaki `bayrak()`
//    bos dizge donuyor) -- yani unutmak sayfayi kirmiyor, yalnizca
//    o dil bayraksiz kaliyor.
// ⚠ Bayrak bir dilin degil bir ULKENIN isareti; 41. maddede gelecek
//    diller (ispanyolca, arapca, rusca) coklu ulkeye yayiliyor.
//    Hangi dile hangi bayrak -- KULLANICIYA sorulacak.
'use strict';

// `benzersiz`: ayni sayfada birden cok kopya olabiliyor (tetikleyici
// + panel satiri). clipPath kimlikleri cakisirsa tarayici ilkini
// kullanip otekini bozuyor, bu yuzden her cagriya ek takiliyor.
const BAYRAK = {
  tr: (ek)=> `<svg class="bayrak" viewBox="0 0 60 40" aria-hidden="true" focusable="false">`
    + `<rect width="60" height="40" fill="#E30A17"/>`
    + `<circle cx="22" cy="20" r="10" fill="#fff"/>`
    + `<circle cx="25.5" cy="20" r="8" fill="#E30A17"/>`
    + `<path fill="#fff" d="M35.6 20 30.9 21.5l2.9 4-0.03-4.95 4.7 1.57-2.9-4 2.9-4-4.7 1.57 0.03-4.95-2.9 4z"/>`
    + `</svg>`,
  en: (ek)=> `<svg class="bayrak" viewBox="0 0 60 30" aria-hidden="true" focusable="false">`
    + `<clipPath id="bk${ek}"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>`
    + `<path d="M0,0 v30 h60 v-30 z" fill="#012169"/>`
    + `<path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>`
    + `<path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#bk${ek})" stroke="#C8102E" stroke-width="4"/>`
    + `<path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/>`
    + `<path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/>`
    + `</svg>`
};

function bayrak(kod, ek){
  const f = BAYRAK[kod];
  return f ? f(String(ek || kod).replace(/[^a-z0-9]/gi, '')) : '';
}

// ⛔ 19 KASIM 2026 — BU DOSYA IKI YERDEN OKUNUYOR (YAPILACAKLAR 58).
//    Site uretici (Node) `require` ile, uygulama (`app.html`) ise
//    <script src> ile aliyor. Bayraklari uygulamaya KOPYALAMAK en
//    kolay yoldu ama bu deponun TEKRARLAYAN HATASI tam o: bir yerde
//    yapip otekinde unutmak (otomatik yayin tablosu, palet degerleri,
//    ikon ailesi, hesap silme listesi... hepsi boyle ayristi).
//    Yeni bir dil eklendiginde bayragi BIR kez buraya yazilacak ve
//    iki yerde birden gorunecek.
//    ⚠ Bu yuzden dosya hem CommonJS hem tarayici icin disa aciliyor.
if(typeof module !== 'undefined' && module.exports){
  module.exports = { bayrak, BAYRAK };
}
if(typeof window !== 'undefined'){
  window.BAYRAKLAR = { bayrak, BAYRAK };
}
