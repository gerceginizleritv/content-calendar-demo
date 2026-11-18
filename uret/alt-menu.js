// ALT MENU (SAYFA ALTLIGI) -- TEK KAYNAK.
//
// Kullanici 18 Kasim 2026: "ust ve alt menu hicbir sayfada yer
// degistirmesin kaybolmasin! Her sayfada ust ve alt menu mutlaka
// ayni olsun. (app haric)"
//
// ⛔ OLCULDU, HAKLIYDI. On uretilen sayfa 1280px'te:
//      /tr/ · /en/                  161,2 px · 5 baglanti
//      /tr/fiyatlar/ · /en/pricing/ 122,0 px · 4 baglanti
//      /tr/kilavuz/ · /en/guide/    104,3 px · 5 baglanti
//      /tr/gizlilik/                 23,1 px · 1 baglanti
//      /tr/sartlar/                  23,1 px · 2 baglanti
//      /en/privacy/ · /en/terms/     ALTLIK HIC YOK
//    47. maddede UST menu birlestirildi ama alta dokunulmadi.
//    Ingilizce gizlilik/sartlar'da altligin HIC olmamasinin sebebi
//    ayrica olculdu: o iki dosya iki dili UST USTE tasiyor, altlik
//    Turkce yarinin icinde kaliyor ve Ingilizce uretilirken o yari
//    atilinca altlik da gidiyor.
//
// ⛔ URETILEN BLOGU SAYFA ICINDE ELLE DEGISTIRME. Her uretimde
//    bastan yaziliyor; elle yapilan degisiklik kaybolur.
'use strict';

const { DILLER } = require('./diller.js');
const { SAYFALAR, adres } = require('./sayfalar.js');

const ALT_BAS = '<!-- ALT-MENU: URETILIYOR (uret/alt-menu.js) -- ELLE DEGISTIRME -->';
const ALT_SON = '<!-- /ALT-MENU -->';

// ⚠ BU IKI CUMLE UYDURULMADI. kaynak/index.html'in kendi sozlugunden
//   alindi: data-m="alt_son" (Turkce) ve EN.alt_son (Ingilizce).
//   Yeni bir dil eklenirse karsiligi BURAYA yazilacak -- ceviri
//   uydurulmayacak, kullanicidan gelecek (Bolum 7 + Bolum 4).
const SON_CUMLE = {
  tr: 'Video üreticileri için içerik takvimi. Planı tutar; yayınlayan sensin.',
  en: 'A content calendar for video creators. It keeps the plan; you do the publishing.'
};

function kacir(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function altMenu({ dil }){
  if(!DILLER[dil]) throw new Error('bilinmeyen dil: ' + dil);
  if(!SON_CUMLE[dil]) throw new Error('alt-menu: ' + dil + ' icin son cumle yok');

  const satir = [];
  satir.push(ALT_BAS);

  // ⛔ OLCU DE TEK KAYNAKTAN. Bu blok altligin HEMEN yaninda, belge
  //    sirasinda EN SONDA -- ayni belirginlikteki sayfa kurallarini
  //    ezer. marka.css'e konsaydi <head>'de, sayfanin kendi
  //    <style>'indan ONCE yuklenirdi ve sayfa onu ezerdi.
  satir.push('<style>');
  // ⛔ KENARLIK VE DIS BOSLUK DA SIFIRLANIYOR. Olculdu: kilavuz
  //    sayfasinda `footer{border-top:1px solid; margin-top:56px;}`
  //    vardi. Kenarlik altligi TAM 1 piksel uzatiyordu (174,8'e
  //    karsi 175,8) ve 56 pikselllik dis bosluk onu asagi itiyordu
  //    -- kullanicinin "yer degistirmesin" dedigi seyin parcasi.
  //    ⚠ Olcu burada bitti: `.alt-ic` iki sayfada da 96,8 px cikti,
  //      yani ICERIK zaten aynidir; kalan fark KABIN kendisindendi.
  satir.push('.alt{background:var(--gece);color:rgba(255,249,240,.6);'
           + 'padding:34px 0 44px;font-size:14px;border:0;margin:0;}');
  satir.push('.alt .alt-ic{display:flex;flex-wrap:wrap;gap:14px 26px;'
           + 'align-items:center;}');
  satir.push('.alt a{text-decoration:none;opacity:.8;color:inherit;}');
  satir.push('.alt a:hover{opacity:1;text-decoration:underline;}');
  // ⛔ SATIR YUKSEKLIGI CIVILENDI. Olculdu: sayfanin kendi
  //    line-height'i 1,6 ya da 1,7 oluyordu; altlik 22,4 px ile
  //    23,8 px arasinda gidip geliyordu. Oran sayfadan gelmeyecek.
  satir.push('.alt{line-height:1.6;}');
  // ⛔ DOKUNMA HEDEFI HER SAYFADA. Bu kural bugune kadar YALNIZCA
  //    kaynak/fiyatlar.html:214'te vardi; orada altlik baglantilari
  //    44 px, oteki sayfalarda 22-24 px idi. Kurali KIRMAK degil
  //    HER SAYFAYA YAYMAK dogrusu: 44 px telefonda dokunulabilir
  //    en kucuk olcu, oteki sayfalar eksikti.
  satir.push('.alt .alt-ic a{min-height:44px;display:inline-flex;'
           + 'align-items:center;}');
  // ⛔ SON CUMLE KENDI SATIRINDA, VE ALT BOSLUGU SIFIR.
  //    Iki ayri olcu hatasi buradan cikti:
  //    1. `width:100%` tek basina yetmiyor -- kilavuzda son cumle
  //       baglantilarla AYNI satira giriyordu (genislik 530 px,
  //       sol 535). Sayfanin kendi `flex` kisayolu temel olcuyu
  //       eziyordu. `flex:0 0 100%` uc degeri birden yaziyor.
  //    2. Paragrafin VARSAYILAN alt boslugu sartlar/gizlilikte
  //       duruyordu (ana sayfada sayfa CSS'i sifirliyordu):
  //       altlik 12 px daha uzundu. `margin` kisayoluyla dort
  //       kenar birden yaziliyor.
  //    ⚠ Ikisi de "ayni gorunuyordu ama degildi" ailesinden:
  //      baglantilar uc sayfada da bire bir aynidir, fark yalnizca
  //      bu paragraftan geliyordu.
  //    3. ⛔ UCUNCU SEBEP, EN SINSISI: kilavuz sayfasinda
  //       `p{max-width:68ch}` var -- govde metni icin konmus bir
  //       OKUNABILIRLIK kurali. O sinir son cumleyi 530,4 px'e
  //       kirpiyordu, dolayisiyla `flex:0 0 100%` hicbir zaman
  //       tasmiyor ve satir atlamiyordu. Yani "flex calismiyor"
  //       gibi gorunen sey aslinda bir max-width idi.
  //       ⚠ Bu, olcmeden bulunamayacak turden bir sebep: hesaplanan
  //         `flex` degeri DOGRU okunuyordu (0 0 100%); yanlis olan
  //         `max-width`ti. Tahminle "flex kisayolu eziliyor" denip
  //         yanlis yer duzeltilebilirdi.
  satir.push('.alt .alt-son{flex:0 0 100%;width:100%;max-width:none;'
           + 'margin:18px 0 0;opacity:.5;font-size:13px;}');
  satir.push('</style>');

  satir.push('<footer class="alt">');
  satir.push('  <div class="sar alt-ic">');
  // Marka eve goturuyor; o yuzden asagidaki listede 'ev' YOK.
  satir.push('    <a class="marka" href="' + kacir(adres('ev', dil))
           + '" style="color:var(--kagit);">Shootboard</a>');

  // ⛔ BAGLANTI LISTESI BURADA YAZILI DEGIL: SAYFALAR tablosundaki
  //    'ev' disindaki HER sayfa giriyor. Yarin eklenecek sayfalar
  //    (65. madde: hakkimizda, iletisim) kendiliginden girecek --
  //    elle eklenmesi gereken bir liste olsaydi unutulurdu. Bu
  //    deponun tekrarlayan hatasi tam bu (CLAUDE.md Bolum 7).
  SAYFALAR.filter(s=> s.ad !== 'ev').forEach(s=>{
    satir.push('    <a href="' + kacir(adres(s.ad, dil)) + '">'
             + kacir(s.menu[dil]) + '</a>');
  });

  satir.push('    <p class="alt-son">' + kacir(SON_CUMLE[dil]) + '</p>');
  satir.push('  </div>');
  satir.push('</footer>');
  satir.push(ALT_SON);
  return satir.join('\n');
}

module.exports = { altMenu, ALT_BAS, ALT_SON, SON_CUMLE };
