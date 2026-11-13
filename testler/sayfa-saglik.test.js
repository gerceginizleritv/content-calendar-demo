// SAYFA SAGLIGI — butun pazarlama/belge sayfalari icin ortak olcumler
// 13 Kasim 2026
//
// NEDEN
// Kullanici "fiyatlar sayfasinda ve diger tum sayfalarda da tasarim
// yeni tasarima uygun sekilde guncelle" dedi. Bes sayfa ayri ayri
// renk tutuyordu; artik hepsi marka.css'ten besleniyor. Bu test o
// birligi ve okunabilirligi koruyor.
//
// ⚠ BURADA OLCULEN SEYLERIN HER BIRI GERCEK BIR HATADAN GELIYOR:
//
// · KONTRAST -- turuncu dugmede beyaz yazi 3.12, magenta blokta krem
//   yazi 3.22 idi. Goz "renkli ve neseli" diyordu, sayi "okunmuyor"
//   diyordu. Sayi hakliydi.
//   Zemin hesabi YARI SAYDAM katmanlari harmanliyor: ilk yazimda
//   rgba(...,.07) bir zemin duz renk sanildi ve oran 1.00 cikti.
//
// · GORSEL ORANI -- <img height="..."> ozniteligi CSS yukseklik
//   verilmediginde kullaniliyor ve gorsel dikey geriliyor. Yalnizca
//   genislige bakan olcum bunu GORMEDI (genislik dogruydu).
//   Ayrica offsetWidth/Height kullaniliyor, getBoundingClientRect
//   DEGIL: cihaz cerceveleri rotate() ile donduruluyor ve o islev
//   dondurulmus ogenin eksen hizali kutusunu veriyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); }
  else { k++; console.log('  YOK '+ad+(ek!==undefined?' -> '+ek:'')); } };

const SAYFALAR = ['fiyatlar.html','sartlar.html','privacy.html','kilavuz.html','guide.html'];
const EKRANLAR = [[1280,900],[390,844]];

async function olc(p){
  return await p.evaluate(()=>{
    const kat = c=>{ const m = c.match(/[\d.]+/g); if(!m) return null;
      return { rgb: m.slice(0,3).map(Number), a: m.length>3 ? parseFloat(m[3]) : 1 }; };
    const zemin = el=>{
      const y = [];
      for(let e = el; e && e !== document.documentElement; e = e.parentElement){
        const x = kat(getComputedStyle(e).backgroundColor);
        if(!x || x.a === 0) continue;
        y.push(x);
        if(x.a === 1) break;
      }
      let alt = y.length && y[y.length-1].a === 1 ? y.pop().rgb : [255,255,255];
      for(let i = y.length-1; i >= 0; i--){
        const x = y[i];
        alt = alt.map((v,j)=> Math.round(x.rgb[j]*x.a + v*(1-x.a)));
      }
      return alt;
    };
    const L = rgb=>{ const f = v=>{ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
      return 0.2126*f(rgb[0]) + 0.7152*f(rgb[1]) + 0.0722*f(rgb[2]); };
    const K = (a,b)=>{ const l1=L(a), l2=L(b), [h,d] = l1>l2 ? [l1,l2] : [l2,l1];
      return (h+0.05)/(d+0.05); };

    const kontrast = [];
    document.querySelectorAll('h1,h2,h3,h4,p,a,span,b,small,li,td,th,label,button,div')
      .forEach(el=>{
        const t = [...el.childNodes].filter(n=> n.nodeType===3 && n.textContent.trim().length>2);
        if(!t.length) return;
        const r = el.getBoundingClientRect();
        if(r.width < 2 || r.height < 2) return;
        const st = getComputedStyle(el);
        if(st.visibility === 'hidden' || st.opacity === '0') return;
        const yk = kat(st.color); if(!yk) return;
        // ⚠ YAZI DA YARI SAYDAM OLABILIR. Zemini harmanlayip yaziyi
        // harmanlamamak, soluk yaziyi tam opak saymak demekti ve
        // mutasyon bu yuzden ISIRMADI: rgba(255,249,240,.26) gorunmez
        // haldeyken olcum "gecti" diyordu.
        const zm = zemin(el);
        const y = { rgb: yk.rgb.map((v,i)=> Math.round(v*yk.a + zm[i]*(1-yk.a))) };
        const px = parseFloat(st.fontSize), kalin = parseInt(st.fontWeight,10) >= 700;
        const esik = (px >= 24 || (px >= 18.66 && kalin)) ? 3.0 : 4.5;
        const o = K(y.rgb, zm);
        if(o < esik) kontrast.push({ yazi: t[0].textContent.trim().slice(0,24),
          renk: st.color, px: Math.round(px), oran: +o.toFixed(2), esik });
      });

    const gorsel = [...document.querySelectorAll('img')].map(im=>{
      const en = im.offsetWidth, boy = im.offsetHeight;
      if(!en || !boy || !im.naturalWidth) return null;
      // ⚠ object-fit:cover/contain ASLA GERMEZ: kutu orani farkliysa
      // tarayici KIRPAR. Telefonda bantlar 4:3'e dusuyor ama gorseller
      // 21:9 -- bu kirpma, bozulma degil. Gerilme yalnizca object-fit
      // verilmemis (fill) gorsellerde olur ve asil hata da oydu.
      const uyum = getComputedStyle(im).objectFit;
      if(uyum === 'cover' || uyum === 'contain') return null;
      const sapma = Math.abs((en/boy) - (im.naturalWidth/im.naturalHeight))
                    / (im.naturalWidth/im.naturalHeight) * 100;
      return { src:(im.getAttribute('src')||'').split('/').pop(),
               en, boy, sapma:+sapma.toFixed(1),
               asim: Math.round(en - im.parentElement.clientWidth) };
    }).filter(Boolean);

    // ⚠ CUMLE ICINDEKI BAGLANTILAR HARIC. Bir paragrafin icinde gecen
    // baglantinin yuksekligi satir yuksekligidir; ondan 40px istemek
    // butun metni bozar ve erisilebilirlik kurali da bunu istemiyor
    // (satir ici baglantilar hedef boyutu kuralindan muaf). Olculen
    // sey DUGME gibi davranan ogeler: dugmeler, secimler, kutular ve
    // satir ici OLMAYAN baglantilar.
    const kucukHedef = [...document.querySelectorAll('a,button,select,input')]
      .filter(e=>{
        if(e.tagName !== 'A') return true;
        return getComputedStyle(e).display !== 'inline';
      })
      .map(e=>({ ad:(e.textContent||e.tagName).trim().slice(0,18),
                 y: Math.round(e.getBoundingClientRect().height),
                 g: Math.round(e.getBoundingClientRect().width) }))
      .filter(x=> x.g > 0 && x.y > 0 && x.y < 40);

    return {
      kontrast, gorsel, kucukHedef,
      kayma: document.documentElement.scrollWidth - window.innerWidth,
      zeminAcik: getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)',
      markaCss: !!document.querySelector('link[href="marka.css"]'),
      // Ayni paletten besleniyor mu: marka.css'in kok degiskeni okunabilmeli
      sinyal: getComputedStyle(document.documentElement).getPropertyValue('--sinyal').trim()
    };
  });
}

(async () => {
  const t = await chromium.launch();
  for(const sayfa of SAYFALAR){
    for(const [w,h] of EKRANLAR){
      const p = await (await t.newContext({ viewport:{width:w,height:h} })).newPage();
      const hata = []; p.on('pageerror', e=> hata.push(String(e)));
      const basarisiz = [];
      p.on('requestfailed', r=>{ const u = r.url();
        // ⚠ Google Fonts ve jsDelivr bu kum havuzunda ENGELLI.
        // Onlari "sayfa hatasi" saymak, her kosuda yanlis alarm uretir
        // ve zamanla gercek hatalari gorunmez yapar. Canlida ikisi de
        // calisiyor; canli adrese karsi kosuldugunda zaten yuklenirler.
        if(!/fonts\.(googleapis|gstatic)|cdn\.jsdelivr\.net/.test(u))
          basarisiz.push(u.split('/').pop()); });
      await p.goto(KOK + '/' + sayfa, { waitUntil:'domcontentloaded' });
      await p.waitForTimeout(1500);
      for(let i=0;i<20;i++){ await p.mouse.wheel(0,900); await p.waitForTimeout(80); }
      await p.evaluate(()=> window.scrollTo(0,0));
      await p.waitForTimeout(600);
      const o = await olc(p);
      const et = sayfa + ' ' + w + 'x' + h;
      console.log('[' + et + ']');
      bak(et + ': js hatasi yok', hata.length===0, hata.slice(0,2).join(' | '));
      bak(et + ': kaynaklar yuklendi', basarisiz.length===0, basarisiz.slice(0,3).join(','));
      bak(et + ': ortak paleti kullaniyor', o.markaCss && o.sinyal === '#FF5A1F',
          'marka.css=' + o.markaCss + ' sinyal=' + o.sinyal);
      bak(et + ': body zemini acikca verilmis', o.zeminAcik);
      bak(et + ': yatay kayma yok', o.kayma <= 1, o.kayma + 'px');
      bak(et + ': kontrast esigi geciliyor', o.kontrast.length===0,
          JSON.stringify(o.kontrast.slice(0,3)));
      bak(et + ': gorsel orani bozulmamis',
          o.gorsel.filter(x=> x.sapma > 2).length===0,
          JSON.stringify(o.gorsel.filter(x=> x.sapma > 2).slice(0,2)));
      bak(et + ': gorsel kutusunu tasirmiyor',
          o.gorsel.filter(x=> x.asim > 1).length===0,
          JSON.stringify(o.gorsel.filter(x=> x.asim > 1).slice(0,2)));
      if(w < 700){
        bak(et + ': dokunma hedefleri 40px+', o.kucukHedef.length===0,
            JSON.stringify(o.kucukHedef.slice(0,4)));
      }
      await p.close();
    }
  }
  await t.close();
  console.log('=== BITTI — ' + g + ' gecti, ' + k + ' kaldi ===');
  process.exit(k ? 1 : 0);
})();
