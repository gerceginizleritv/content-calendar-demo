// SITENIN DIL LISTESI -- TEK KAYNAK.
//
// ⛔ Yeni dil eklemek icin YALNIZCA burasi ve sayfalar.js'teki
//    `parca` tablosu degisir. Uretici, bekci test ve dil secici
//    listeyi buradan okuyor; hicbiri dil adini kendi icine yazmiyor.
//    (CLAUDE.md Bolum 7: "listeyi elle yazmayan, kendi bulan bekci".)
//
// `ad` = dil secicide gorunen ad, o dilin KENDI dilinde yazili
//        (Ingilizce konusan biri "Turkish" degil "Türkçe" arar).
'use strict';

const DILLER = {
  // ⚠ BAYRAK BIR DILIN DEGIL BIR ULKENIN isareti. Ingilizce
  //    yalnizca Birlesik Krallik'ta konusulmuyor; 41. maddede
  //    gelecek diller (ispanyolca, arapca, rusca...) coklu ulkeye
  //    yayiliyor. Kullanici 18 Kasim 2026'da bayrak istedi, eklendi;
  //    yeni dil eklerken hangi bayragin konacagi KULLANICIYA
  //    sorulacak, tahmin edilmeyecek.
  tr: { ad: 'Türkçe',  bayrak: '🇹🇷', htmlLang: 'tr', secEtiket: 'Dil' },
  en: { ad: 'English', bayrak: '🇬🇧', htmlLang: 'en', secEtiket: 'Language' }
};

const VARSAYILAN = 'tr';

module.exports = { DILLER, VARSAYILAN, kodlar: () => Object.keys(DILLER) };
