// EKRANDA JS KAYNAK KODU GORUNMESIN.
//
// NEDEN BU TEST VAR
//   ⛔ 19 Kasim 2026. 49. madde olculurken cikti: hazir set cipindeki
//      "+" dugmesinin ipucu sunu gosteriyordu:
//
//        (n)=> `Isaretli ${n} maddeyi bu sete ekle`
//
//      Sebep: `set_add_here` sozlukte bir ISLEV ((n)=> ...) ve
//      `t('set_add_here')` cagrilmadan dogrudan metne gomulmustu.
//      AYNI anahtar kendi setlerinde DOGRU cagriliyordu
//      (`t('set_add_here')(sayfaSecimi.size)`); yalnizca bir yerde
//      unutulmustu.
//
// ⚠ SOZLUK PARITESI BUNU YAKALAYAMAZ. `sozluk-paritesi` iki sozlugun
//   AYNI anahtarlari ve ayni ariteyi tasidigini olcuyor -- burada iki
//   sozluk de dogruydu, hata KULLANIM yerindeydi. Bu yuzden ayri bir
//   bekci gerekti.
//
// ⚠ BEKCI LISTE YAZMIYOR: hangi dugmenin ipucuna bakacagini saymiyor.
//   Ekranda duran HER metni tasiyan ozniteligi tariyor; yarin eklenen
//   bir dugme kendiliginden olculuyor.
//
// NE ARIYOR
//   Bir islevin kaynak kodu metne gomuldugunde geriye su izler kalir:
//     "=>"      ok isareti
//     "${"      sablon degiskeni (cozulmemis)
//     "function"
//   Gercek bir arayuz metninde bunlarin hicbiri bulunmaz.

const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
const bak = (ad, kosul, ek)=>{
  if(kosul){ gecen++; console.log('  ok  ' + ad); }
  else { kalan++; console.log('  YOK ' + ad + (ek ? '\n      ' + ek : '')); }
};

// Metin tasiyan oznitelikler. `value` BILEREK disarida: kullanici
// kendi yazdigi metni oraya koyabilir ve icinde "=>" gecebilir.
const OZNITELIK = ['title', 'aria-label', 'placeholder', 'alt', 'aria-placeholder'];
const IZ = /=>|\$\{|^function\s|\bfunction\s*\(/;

(async ()=>{
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1400, height:1000 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  p.on('dialog', d=> d.accept());
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                   localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(2000);

  // Her dilde ayri bakiliyor: hata tek dilde de olabilir.
  const diller = await p.evaluate(()=> Object.keys(LANG));

  for(const dil of diller){
    // Ekranlari SIRAYLA aciyoruz ki geç çizilen yerler de taransin.
    // ⚠ Sadece acilis ekranina bakmak yetmez: hata tam da ancak cekim
    //   listesi acilinca cizilen bir cipte duruyordu.
    const kotu = await p.evaluate(async ({ d, ozn, iz })=>{
      setLanguage(d);
      document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
      const bekle = (ms)=> new Promise(r=> setTimeout(r, ms));
      const toplanan = [];
      const tara = (nereden)=>{
        document.querySelectorAll('*').forEach(el=>{
          ozn.forEach(a=>{
            const v = el.getAttribute && el.getAttribute(a);
            if(v && new RegExp(iz).test(v)){
              toplanan.push(nereden + ' · <' + el.tagName.toLowerCase() +
                (el.id ? '#' + el.id : '') + '> ' + a + '="' + v.slice(0, 70) + '"');
            }
          });
        });
      };
      // 1. Ana ekran ve her sayfa
      for(const [ad] of SAYFALAR){ setPage(ad); await bekle(60); tara('sayfa:' + ad); }
      // 2. Cekim listesi (hata buradaydi)
      if(typeof projects !== 'undefined' && projects[0]){
        cekimListesiAc(projects[0].id);
        await bekle(300);
        const f = document.getElementById('cl_hsetFold');
        if(f) f.open = true;
        await bekle(120);
        tara('cekim-listesi');
        if(typeof cekimListesiKapat === 'function') cekimListesiKapat();
      }
      // 3. Kendi setleri, onizleme paneli acikken
      ihtiyacSetleri = [{ id:'bekci', ad:'Bekci seti',
        maddeler:[{ metin:'tripod' }, { metin:'mikrofon' }] }];
      setPage('kit'); await bekle(200);
      const bakDug = document.querySelector('#ihs_setler [data-set-bak]');
      if(bakDug){ bakDug.click(); await bekle(200); }
      tara('cekim-setleri');
      return toplanan;
    }, { d: dil, ozn: OZNITELIK, iz: IZ.source });

    bak(dil + ': hicbir ekran metninde JS kaynak kodu yok',
        kotu.length === 0, kotu.slice(0, 6).join('\n      '));
  }

  bak('sayfa hatasi yok', jsHata.length === 0, jsHata.join(' | '));

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
