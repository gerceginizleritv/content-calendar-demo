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
const { SAYFALAR, adres, kaynakDosya } = require('./sayfalar.js');
const { ustMenu, BAS, SON } = require('./ust-menu.js');

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

async function sayfaUret(tarayici, sayfa, dil){
  const kaynak = kaynakDosya(sayfa, dil);
  const p = await tarayici.newPage({ viewport: { width: 1280, height: 900 } });
  const jsHatalari = [];
  p.on('pageerror', e=> jsHatalari.push(String(e.message)));

  // Dili ONCE kur: sayfanin kendi sozlugu acilista okuyor.
  await p.goto(SUNUCU + '/' + kaynak, { waitUntil: 'load' });
  await p.evaluate(d=>{ try{ localStorage.setItem('demo_ui_language', d); }catch(e){} }, dil);
  await p.goto(SUNUCU + '/' + kaynak + '?lang=' + dil, { waitUntil: 'load' });
  await p.waitForTimeout(600);

  const html = await p.evaluate(({ dil, menuHtml, BAS, SON,
                                  kokBaglanti, varsayilanDil, adresler }) => {
    document.documentElement.lang = dil;

    // ⛔ DILI ADRESE SABITLE. Olculdu 18 Kasim 2026: uretilen
    //    /tr/fiyatlar/ sayfasi, tarayici hafizasinda "en" yaziyorsa
    //    GOVDESINI Ingilizce'ye ceviriyordu -- menu Turkce, baslik ve
    //    h1 Ingilizce. Sayfanin kendi calisma zamani cevirisi uretilen
    //    dili eziyordu. Artik adres kazaniyor: head'in EN BASINA
    //    konan bu satir sayfanin dil tespitinden once kosuyor.
    // ARAMA MOTORU ETIKETLERI
    // canonical: bu sayfanin TEK dogru adresi.
    // alternate/hreflang: ayni sayfanin oteki dillerdeki adresi --
    //   Google iki adresi "kopya" degil "ceviri" diye okur.
    // x-default: dili bilinmeyen ziyaretci icin varsayilan.
    for(const el of document.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang], meta[name="robots"]')) el.remove();
    const kanonik = document.createElement('link');
    kanonik.rel = 'canonical'; kanonik.href = kokBaglanti + adresler[dil];
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
    const robot = document.createElement('meta');
    robot.name = 'robots'; robot.content = 'noindex, follow';
    document.head.appendChild(robot);

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
  }, { dil, menuHtml: ustMenu({ sayfa: sayfa.ad, dil }), BAS, SON,
       kokBaglanti: KOK_BAGLANTI, varsayilanDil: VARSAYILAN,
       adresler: Object.fromEntries(kodlar().map(k=> [k, adres(sayfa.ad, k)])) });

  await p.close();
  return { html: baglantilariCevir(html, dil), jsHatalari };
}

async function main(){
  const tarayici = await chromium.launch();
  const rapor = [];
  for(const sayfa of SAYFALAR){
    for(const dil of kodlar()){
      const { html, jsHatalari } = await sayfaUret(tarayici, sayfa, dil);
      const hedef = path.join(KOK, adres(sayfa.ad, dil).replace(/^\/|\/$/g, ''), 'index.html');
      fs.mkdirSync(path.dirname(hedef), { recursive: true });
      fs.writeFileSync(hedef, html, 'utf8');
      rapor.push({ sayfa: sayfa.ad, dil, hedef: path.relative(KOK, hedef),
                   bayt: html.length, jsHatasi: jsHatalari.length });
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
