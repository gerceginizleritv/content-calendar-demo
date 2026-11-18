// SAYFA TABLOSU -- TEK KAYNAK.
//
// Her yayin sayfasinin: kaynak dosyasi, her dildeki adres parcasi ve
// ust menude gorunup gorunmeyecegi. Uretici ve bekci test bu tabloyu
// okuyor; ikisi de sayfa adini kendi icine YAZMIYOR.
//
// ⛔ BU TABLODA OLMAYAN KOK DOSYALARA URETICI DOKUNMAZ. Ozellikle:
//      tiktok.html · youtube.html  -> TikTok ve Google panellerinde
//        KAYITLI geri donus adresleri. Adresleri degisirse hesap
//        baglama kirilir. (docs/isim-marka-alanadi-kararlari.md:107)
//      app.html · yonetim.html · aktar.html · paylas.html
//      deneme.html · lokasyon.html · index-eski.html
//
// `kaynak` dile gore ayri dosya olabilir (kilavuz bugun oyle);
// tek dosyaysa dizge, dile goreyse nesne yazilir.
'use strict';

const SAYFALAR = [
  { ad: 'ev',       kaynak: 'index.html',
    parca:   { tr: '',          en: '' },
    // ⚠ menude:false -- marka ("Shootboard") zaten eve goturuyor.
    //   Ornek alinan menu index.html'inki ve orada "Ana sayfa"
    //   maddesi YOK; iki kez ayni yere giden baglanti olmasin.
    menu:    { tr: 'Ana sayfa', en: 'Home' },        menude: false },

  { ad: 'fiyatlar', kaynak: 'fiyatlar.html',
    parca:   { tr: 'fiyatlar',  en: 'pricing' },
    menu:    { tr: 'Fiyatlar',  en: 'Pricing' },     menude: true },

  { ad: 'kilavuz',  kaynak: { tr: 'kilavuz.html', en: 'guide.html' },
    parca:   { tr: 'kilavuz',   en: 'guide' },
    menu:    { tr: 'Kılavuz',   en: 'Guide' },       menude: true },

  { ad: 'gizlilik', kaynak: 'privacy.html',
    parca:   { tr: 'gizlilik',  en: 'privacy' },
    menu:    { tr: 'Gizlilik',  en: 'Privacy' },     menude: false },

  { ad: 'sartlar',  kaynak: 'sartlar.html',
    parca:   { tr: 'sartlar',   en: 'terms' },
    menu:    { tr: 'Şartlar',   en: 'Terms' },       menude: false }
];

// ⛔ URETICININ ELINI SURMEYECEGI KOK DOSYALAR -- gerekcesi yukarida.
const DOKUNULMAZ = [
  'tiktok.html', 'youtube.html', 'app.html', 'yonetim.html',
  'aktar.html', 'paylas.html', 'deneme.html', 'lokasyon.html',
  'index-eski.html'
];

// Ana sayfadaki bolum baglantilari: menude duruyorlar ama bir
// SAYFA degiller, ana sayfanin icindeki yerler.
const BOLUMLER = [
  { capa: 'nasil',    menu: { tr: 'Nasıl çalışır', en: 'How it works' } },
  { capa: 'parcalar', menu: { tr: 'Neler var',     en: "What's inside" } },
  { capa: 'degil',    menu: { tr: 'Ne değildir',   en: 'What it is not' } }
];

// Cagri dugmesi (CTA). Kullanici 16 Kasim 2026: "Kilavuz sayfasina
// gecince Basla tusu falan yok oluyor" -- artik HER sayfada duruyor.
const CTA = {
  capa: 'giris',
  uzun: { tr: 'Ücretsiz başla', en: 'Start free' },
  kisa: { tr: 'Başla',          en: 'Start' }
};

function sayfaBul(ad){ return SAYFALAR.find(s=> s.ad === ad); }

// Bir sayfanin bir dildeki adresi: /tr/fiyatlar/ · /en/ · /en/pricing/
function adres(sayfaAdi, dil){
  const s = sayfaBul(sayfaAdi);
  if(!s) throw new Error('bilinmeyen sayfa: ' + sayfaAdi);
  const p = s.parca[dil];
  if(p === undefined) throw new Error(sayfaAdi + ' icin ' + dil + ' adres parcasi yok');
  return '/' + dil + '/' + (p ? p + '/' : '');
}

// Kaynak dosya: dile gore ayri olabilir.
function kaynakDosya(sayfa, dil){
  return typeof sayfa.kaynak === 'string' ? sayfa.kaynak : sayfa.kaynak[dil];
}

module.exports = { SAYFALAR, DOKUNULMAZ, BOLUMLER, CTA, sayfaBul, adres, kaynakDosya };
