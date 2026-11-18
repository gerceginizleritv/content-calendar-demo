#!/usr/bin/env node
// SAYFA URETICISI -- /tr/ ve /en/ altina GERCEK dosya yazar.
//
// NEDEN GERCEK DOSYA: site GitHub Pages'te duruyor ve orada
// "su adresi su dosyaya bagla" diye bir kural YOK. /tr/fiyatlar/
// adresinin calismasi icin depoda gercekten tr/fiyatlar/index.html
// bulunmasi gerekiyor. (Cloudflare'e tasinirsa da aynen calisir.)
//
// NEDEN TARAYICIDA ACIP KAYDEDIYOR: sayfalarin metni bugun
// TARAYICIDA ceviriliyor (data-m + sozluk). Dosyanin icinde yalnizca
// Turkcesi duruyor. Arama motoru /en/pricing/ adresini actiginda
// Ingilizce metni DOSYADA gormeli -- yoksa her dile ayri adres
// vermenin anlami kalmaz. Bu yuzden uretici sayfayi Chromium'da
// aciyor, dili uyguluyor, sonra olusan HTML'i yaziyor.
//
// ⛔ URETILEN DOSYALARI ELLE DEGISTIRME. Her uretimde bastan
//    yaziliyorlar. Degisiklik KAYNAK dosyaya ya da uret/ altina.
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { DILLER, VARSAYILAN, kodlar } = require('./diller.js');

// Sitenin canli koku. canonical ve hreflang MUTLAK adres ister.
const KOK_BAGLANTI = process.env.URET_KOK || 'https://shootboard.app';
const { SAYFALAR, KAYNAK_DIZIN, adres, kaynakDosya } = require('./sayfalar.js');
const { ustMenu, BAS, SON } = require('./ust-menu.js');
const { altMenu } = require('./alt-menu.js');
const { yonlendirici } = require('./yonlendirici.js');

const KOK = path.join(__dirname, '..');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

// Goreli adresleri koke cevir: /tr/fiyatlar/ icinden "app.html"
// yazarsa tarayici /tr/fiyatlar/app.html arar ve bulamaz.
// ⚠ "#capa" DOKUNULMAZ: koke cevrilirse sayfa ici baglanti
//    baska sayfaya gider.
function kokeCevir(deger){
  if(!deger) return deger;
  if(/^(#|\/|https?:|mailto:|tel:|data:|javascript:)/i.test(deger)) return deger;
  return '/' + deger.replace(/^\.\//, '');
}

// KAYNAK DOSYA ADI -> SAYFA ADI. Sayfalarin icinde hala duz dosya
// adlari yazili ("kilavuz.html", "sartlar.html" ...). Uretilen
// sayfada bunlar o dilin adresine cevriliyor; yoksa /en/ icinden
// "guide.html" yazan bir baglanti /en/guide.html arar ve 404 alir.
// ⛔ 18 Kasim 2026'da olculdu: /en/ sayfasinda UC baglanti boyleydi
//    (sartlar.html, privacy.html, guide.html).
function dosyaEslemesi(){
  const es = {};
  for(const s of SAYFALAR){
    for(const d of kodlar()){
      const dosya = kaynakDosya(s, d);
      if(dosya) es[dosya] = s.ad;
    }
  }
  es['index.html'] = 'ev';
  return es;
}

// Serilestirilmis HTML uzerinde son gecis: hem DOM'dan gelen
// href="/kilavuz.html" hem de SOZLUK ICINDEKI href=\"sartlar.html\"
// bicimini yakalar. Sozlukteki bicim onemli: o metin sayfaya
// CALISMA ANINDA giriyor, uretim sirasinda DOM'da yok.
function baglantilariCevir(html, dil){
  const es = dosyaEslemesi();
  for(const dosya of Object.keys(es)){
    const hedef = adres(es[dosya], dil);
    const kacisli = dosya.replace(/\./g, '\\.');
    // href="/dosya.html"  ·  href="dosya.html"  ·  href="./dosya.html"
    html = html.replace(new RegExp('href="(?:\\.?/)?' + kacisli + '(\\?[^"]*)?"', 'g'),
                        'href="' + hedef + '"');
    // Sozluk icindeki kacisli bicim: href=\"dosya.html\"
    html = html.replace(new RegExp('href=\\\\"(?:\\.?/)?' + kacisli + '(\\?[^"\\\\]*)?\\\\"', 'g'),
                        'href=\\"' + hedef + '\\"');
  }
  return html;
}

async function sayfaUret(tarayici, sayfa, dil, secenek){
  const { bol = true, dizine = false, kanonik = null } = secenek || {};
  const kaynak = kaynakDosya(sayfa, dil);
  const p = await tarayici.newPage({ viewport: { width: 1280, height: 900 } });
  const jsHatalari = [];
  p.on('pageerror', e=> jsHatalari.push(String(e.message)));

  // Dili ONCE kur: sayfanin kendi sozlugu acilista okuyor.
  await p.goto(SUNUCU + '/' + KAYNAK_DIZIN + '/' + kaynak, { waitUntil: 'load' });
  await p.evaluate(d=>{ try{ localStorage.setItem('demo_ui_language', d); }catch(e){} }, dil);
  await p.goto(SUNUCU + '/' + KAYNAK_DIZIN + '/' + kaynak + '?lang=' + dil, { waitUntil: 'load' });
  await p.waitForTimeout(600);

  const html = await p.evaluate(({ dil, menuHtml, altMenuHtml, BAS, SON, trCapa, dizine, sureklilik,
                                  kanonikHedef, kokBaglanti, varsayilanDil, adresler }) => {
    document.documentElement.lang = dil;

    // ⛔ DILI ADRESE SABITLE. Olculdu 18 Kasim 2026: uretilen
    //    /tr/fiyatlar/ sayfasi, tarayici hafizasinda "en" yaziyorsa
    //    GOVDESINI Ingilizce'ye ceviriyordu -- menu Turkce, baslik ve
    //    h1 Ingilizce. Sayfanin kendi calisma zamani cevirisi uretilen
    //    dili eziyordu. Artik adres kazaniyor: head'in EN BASINA
    //    konan bu satir sayfanin dil tespitinden once kosuyor.
    // ⛔ TEK DOSYADA IKI DIL -> O DILIN YARISINI BIRAK.
    //    privacy.html ve sartlar.html once Ingilizce yariyi, sonra
    //    <hr>, sonra id="turkce" ile Turkce yariyi tasiyor. Turkce
    //    okuyan kisi sayfanin BASINDA Ingilizce metinle karsilasiyor
    //    ve kaydirmak zorunda kaliyordu.
    let bolundu = false;
    if(trCapa){
      const sinir = document.getElementById(trCapa);
      if(sinir){
        bolundu = true;
        if(dil === 'tr'){
          // Turkce yari: sinirdan ONCEKI her sey gitsin.
          let o = sinir.previousSibling;
          while(o){ const onceki = o.previousSibling; o.remove(); o = onceki; }
          sinir.removeAttribute('id');
          sinir.removeAttribute('style');
        } else {
          // Ingilizce yari: sinir ve SONRASI gitsin, ayirici <hr> dahil.
          let o = sinir.nextSibling;
          while(o){ const sonraki = o.nextSibling; o.remove(); o = sonraki; }
          let onceki = sinir.previousElementSibling;
          sinir.remove();
          if(onceki && onceki.tagName === 'HR') onceki.remove();
        }
      }
      // Sayfa ici dil cubugu artik gereksiz: dil secici ust menude.
      for(const el of document.querySelectorAll('.langbar')) el.remove();

      // ⛔ BASLIK VE ACIKLAMA DA O DILDE OLSUN.
      //    Olculdu 18 Kasim 2026: tr/gizlilik/ sayfasinin govdesi
      //    Turkce ama <title> hala "Privacy Policy — Shootboard"
      //    idi -- arama sonucunda Turkce sayfa Ingilizce gorunurdu.
      // ⚠ METIN UYDURULMUYOR: baslik sayfanin KENDI <h1>'inden,
      //    aciklama sayfanin KENDI "Kisacasi/In short" ozetinden
      //    aliniyor. Ikisini de kullanici yazmis.
      if(bolundu){
        const h1 = document.querySelector('h1');
        if(h1 && h1.textContent.trim()){
          document.title = h1.textContent.trim() + ' — Shootboard';
        }
        const ozet = [...document.querySelectorAll('.wrap p')]
          .map(x=> x.textContent.replace(/\s+/g, ' ').trim())
          .find(x=> x.length > 60);
        const md = document.querySelector('meta[name="description"]');
        if(md && ozet){
          let k = ozet.length > 155 ? ozet.slice(0, 155) : ozet;
          if(ozet.length > 155){ k = k.slice(0, k.lastIndexOf(' ')) + '…'; }
          md.setAttribute('content', k);
        }
      }
    }

    // ARAMA MOTORU ETIKETLERI
    // canonical: bu sayfanin TEK dogru adresi.
    // alternate/hreflang: ayni sayfanin oteki dillerdeki adresi --
    //   Google iki adresi "kopya" degil "ceviri" diye okur.
    // x-default: dili bilinmeyen ziyaretci icin varsayilan.
    for(const el of document.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang], meta[name="robots"]')) el.remove();
    const kanonik = document.createElement('link');
    kanonik.rel = 'canonical'; kanonik.href = kokBaglanti + (kanonikHedef || adresler[dil]);
    document.head.appendChild(kanonik);
    for(const k of Object.keys(adresler)){
      const alt = document.createElement('link');
      alt.rel = 'alternate'; alt.hreflang = k; alt.href = kokBaglanti + adresler[k];
      document.head.appendChild(alt);
    }
    const xdef = document.createElement('link');
    xdef.rel = 'alternate'; xdef.hreflang = 'x-default';
    xdef.href = kokBaglanti + adresler[varsayilanDil];
    document.head.appendChild(xdef);

    // ⛔ GECICI noindex -- AGAC HENUZ YARIM.
    //    gizlilik/sartlar hala tek dosyada iki dil tasiyor, kilavuz
    //    hala iki ayri dosya. Bunlar bitene kadar arama motoru bu
    //    adresleri dizine ALMASIN; yarim sayfa indekslenip sonra
    //    degisirse sira kaybedilir.
    //    ⚠ GECIS ADIMINDA BU SATIR KALKACAK (uret/uret.js).
    if(!dizine){
      const robot = document.createElement('meta');
      robot.name = 'robots'; robot.content = 'noindex, follow';
      document.head.appendChild(robot);
    }

    // ⛔ DUZ ADRESTE DIL SUREKLILIGI.
    //    Kullanici 18 Kasim 2026: "ingilizce secili iken ana sayfaya
    //    gidince Turkceye dondu." Duz adresler (shootboard.app,
    //    /fiyatlar.html) tek dilde uretiliyor; daha once Ingilizce
    //    secmis biri buraya gelince kendi dilini kaybediyordu.
    //    Artik hafizada baska bir dil varsa o dilin adresine gidiyor.
    // ⚠ Hafiza BOSSA hicbir sey olmuyor: sayfa oldugu gibi aciliyor.
    //    Dil agacindaki sayfalar bu betigi TASIMIYOR, dolayisiyla
    //    donguye girmek mumkun degil.
    if(sureklilik){
      const sur = document.createElement('script');
      sur.textContent =
        '(function(){try{var d=localStorage.getItem("demo_ui_language");'
        + 'var h=' + JSON.stringify(sureklilik) + ';'
        + 'if(d&&h[d]&&d!==' + JSON.stringify(dil) + '){location.replace(h[d]);}'
        + '}catch(e){}})();';
      document.head.insertBefore(sur, document.head.firstChild);
    }

    const kilit = document.createElement('script');
    kilit.textContent = 'window.SAYFA_DILI=' + JSON.stringify(dil) + ';';
    document.head.insertBefore(kilit, document.head.firstChild);

    // 1) Ust menuyu DEGISTIR. Sayfalar uc ayri kalip kullaniyor:
    //    <header class="ust">, <div class="ust">, ya da hicbiri.
    const eski = document.querySelector('header.ust, .ust');
    const yuva = document.createElement('div');
    yuva.setAttribute('data-ust-menu', '1');
    if(eski && eski.parentNode) eski.parentNode.replaceChild(yuva, eski);
    else document.body.insertBefore(yuva, document.body.firstChild);
    yuva.outerHTML = menuHtml;

    // 1b) ALT MENUYU DEGISTIR (64. madde).
    // ⛔ YERINDE DEGISTIRMIYORUZ, SILIP SONA EKLIYORUZ. Sebep
    //    olculdu: kilavuzun altligi bir KAPSAYICININ ICINDE duruyor
    //    (kaynak/kilavuz.html:857, girintili). Yerinde degistirilse
    //    uretilen altlik o dar sutunun icinde kalir ve oteki
    //    sayfalardan baska gorunurdu -- yani birlestirme isini
    //    yapmis olmazdik. Govdenin sonuna koymak her sayfada ayni
    //    yeri garanti ediyor.
    // ⚠ Altligin ardindan gelen <script>'ler etkilenmiyor.
    for(const f of document.querySelectorAll('footer')){
      if(f.parentNode) f.parentNode.removeChild(f);
    }
    const altYuva = document.createElement('div');
    altYuva.setAttribute('data-alt-menu', '1');
    document.body.appendChild(altYuva);
    altYuva.outerHTML = altMenuHtml;

    // ⛔ GORELI ADRESLERI KOKE CEVIR. Olculdu: /en/pricing/ sayfasi
    //    "marka.css" diye aradigi icin tarayici /en/pricing/marka.css
    //    istiyor ve 404 aliyordu -- sayfa STILSIZ aciliyordu.
    // ⚠ "#capa" DOKUNULMAZ: koke cevrilirse sayfa ici baglanti
    //    baska sayfaya gider.
    const kokeCevir = (d)=> (!d || /^(#|\/|https?:|mailto:|tel:|data:|javascript:)/i.test(d))
      ? d : '/' + d.replace(/^\.\//, '');
    for(const el of document.querySelectorAll('[href]')){
      const y = kokeCevir(el.getAttribute('href'));
      if(y !== el.getAttribute('href')) el.setAttribute('href', y);
    }
    for(const el of document.querySelectorAll('[src]')){
      const y = kokeCevir(el.getAttribute('src'));
      if(y !== el.getAttribute('src')) el.setAttribute('src', y);
    }

    return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  }, { dil, menuHtml: ustMenu({ sayfa: sayfa.ad, dil }),
       altMenuHtml: altMenu({ dil }), BAS, SON,
       trCapa: (bol ? (sayfa.trCapa || null) : null),
       dizine, kanonikHedef: kanonik,
       sureklilik: secenek && secenek.sureklilik ? secenek.sureklilik : null,
       kokBaglanti: KOK_BAGLANTI, varsayilanDil: VARSAYILAN,
       adresler: Object.fromEntries(kodlar().map(k=> [k, adres(sayfa.ad, k)])) });

  await p.close();
  return { html: baglantilariCevir(html, dil), jsHatalari };
}

async function main(){
  const tarayici = await chromium.launch();
  const rapor = [];
  // 1) DIL AGACI: /tr/... ve /en/...
  //    ⚠ Simdilik noindex: kilavuz hala iki ayri kaynak dosya.
  for(const sayfa of SAYFALAR){
    for(const dil of kodlar()){
      const { html, jsHatalari } = await sayfaUret(tarayici, sayfa, dil,
        { bol: true, dizine: false });
      const hedef = path.join(KOK, adres(sayfa.ad, dil).replace(/^\/|\/$/g, ''), 'index.html');
      fs.mkdirSync(path.dirname(hedef), { recursive: true });
      fs.writeFileSync(hedef, html, 'utf8');
      rapor.push({ sayfa: sayfa.ad, dil, hedef: path.relative(KOK, hedef),
                   bayt: html.length, jsHatasi: jsHatalari.length });
    }
  }
  // 2) DUZ ADRESLER: shootboard.app, /fiyatlar.html ...
  //    ⛔ Eski adresler CALISMAYA DEVAM EDIYOR. Yalnizca yeni menuyu
  //    tasiyorlar ve baglantilari dil agacina gidiyor. Boylece
  //    kullanici hangi adresten girerse girsin ayni menuyu goruyor
  //    (47. madde) ve ilk tiklamada dil agacina giriyor (48. madde).
  //    Dizine giriyorlar (canli sayfalar bunlar) ama canonical dil
  //    agacini gosteriyor: Google ikisini kopya saymasin.
  //    ⚠ BOLME YOK: gizlilik/sartlar duz adreste bugunku gibi iki
  //    dili birden tasimaya devam ediyor -- eski bir baglantiyla
  //    gelen kisi metnin yarisini kaybetmesin.
  for(const sayfa of SAYFALAR){
    const duzler = sayfa.duzCok || (sayfa.duz ? [sayfa.duz] : []);
    for(const d of duzler){
      const html = yonlendirici({
        adresler: Object.fromEntries(kodlar().map(k=> [k, adres(sayfa.ad, k)])),
        kokBaglanti: KOK_BAGLANTI,
        baslik: 'Shootboard'
      });
      const hedef = path.join(KOK, d.dosya);
      fs.writeFileSync(hedef, html, 'utf8');
      rapor.push({ sayfa: sayfa.ad + ' (yonlendirici)', dil: d.dil, hedef: d.dosya,
                   bayt: html.length, jsHatasi: 0 });
    }
  }
  await tarayici.close();
  for(const r of rapor){
    console.log(('  ' + r.dil + ' · ' + r.sayfa).padEnd(22)
      + r.hedef.padEnd(26) + String(r.bayt).padStart(8) + ' bayt'
      + (r.jsHatasi ? '   ⛔ ' + r.jsHatasi + ' JS hatasi' : ''));
  }
}

if(require.main === module) main().catch(e=>{ console.error(e); process.exit(1); });
module.exports = { kokeCevir };
