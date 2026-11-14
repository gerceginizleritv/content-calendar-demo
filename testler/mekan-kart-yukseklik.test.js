// MEKAN KARTLARI: uzun metin kartı sınırsız uzatmamalı.
//
// ⚠ 14 KASIM 2026 — KULLANICI BİLDİRDİ:
//   "mekanlar içerisinde metin ne eklenirse eklensin burada bu kadar
//    uzun olmamalı kutu ölçekleri sabit olmalı altında devamı yazar
//    tıklayınca"
//   Uzun izin/dikkat notu olan bir mekân kartı diğerlerinin beş katı
//   oluyordu ve ızgaradaki bütün satırı uzatıyordu.
//
// ⚠ İKİNCİ BİR KUSUR DA VARDI: solma katmanı önce HER föyde çiziliyordu,
//   yani taşmayan kartta da son satır yarı silik görünüyordu — "devamı
//   var" diye yanıltıyordu ama devamı yoktu. Kullanıcı gözüyle fark
//   etti, ilk ölçümüm fark etmedi. Artık `.tasiyor` sınıfına bağlı.
const { chromium } = require('./araclar');

const UZUN = Array.from({length:14},(_,i)=>
  'Dikkat satiri '+(i+1)+' — burada uzun bir aciklama var ve devam ediyor.').join('\n');

(async () => {
  const b = await chromium.launch({ });
  let kalan = 0, gecen = 0;
  const bak = (ad, kosul, ek) => {
    if (kosul) { gecen++; console.log('  ok  ' + ad); }
    else { kalan++; console.log('  YOK ' + ad + (ek !== undefined ? ' → ' + JSON.stringify(ek) : '')); }
  };

  const c = await b.newContext({ viewport:{width:1440,height:1000} });
  const p = await c.newPage();
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_ui_language','tr'); }catch(e){} });
  await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'networkidle' });
  await p.waitForTimeout(2000);
  const atla = await p.$('#tourSkip'); if (atla) { await atla.click(); await p.waitForTimeout(700); }
  for (let i=0;i<3;i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(150); }
  const sek = await p.$('#tabPlaces'); if (sek) { await sek.click(); await p.waitForTimeout(800); }

  await p.evaluate((uzun)=>{
    mekanlar.push({ id:'test-uzun', name:'Uzun Notlu Mekan', city:'İstanbul', district:'Fatih',
      address:'Bir adres',
      permission:'İzin için önce vakfı arayıp sormak gerekiyor; ayin saatleri öğrenilip dışına planlanacak.',
      cautions:uzun, createdAt:Date.now() });
    mekanlar.push({ id:'test-kisa', name:'Kisa Notlu Mekan', city:'İzmir', district:'Konak',
      address:'Baska adres', permission:'İzin gerekmiyor.',
      cautions:'Kalabalik saatlerden kacin.', createdAt:Date.now() });
    renderMekanlar();
  }, UZUN);
  await p.waitForTimeout(900);

  const d = await p.evaluate(()=>{
    const kart = (id)=> document.querySelector('.mk-kart[data-mk="'+id+'"]');
    const oku = (id)=>{
      const k = kart(id); if(!k) return null;
      const f = k.querySelector('.mk-foy');
      return {
        foyYuk: f ? Math.round(f.getBoundingClientRect().height) : 0,
        tasiyor: f ? f.classList.contains('tasiyor') : false,
        gercekTasma: f ? f.scrollHeight > f.clientHeight + 2 : false,
        dugme: !!k.querySelector('.mk-devam'),
      };
    };
    return { uzun: oku('test-uzun'), kisa: oku('test-kisa'),
             yukseklikler: [...document.querySelectorAll('.mk-kart')].map(k=>Math.round(k.getBoundingClientRect().height)) };
  });

  bak('uzun notlu kartin foyu SINIRLI', d.uzun && d.uzun.foyYuk <= 134, d.uzun && d.uzun.foyYuk);
  bak('uzun notlu kartta "Devami" dugmesi var', !!(d.uzun && d.uzun.dugme));
  bak('uzun notlu foy tasiyor olarak isaretli', !!(d.uzun && d.uzun.tasiyor));
  bak('KISA notlu kartta dugme YOK', !!(d.kisa && !d.kisa.dugme));
  bak('KISA notlu foy tasimiyor (solma cizilmemeli)', !!(d.kisa && !d.kisa.tasiyor && !d.kisa.gercekTasma));

  // ⚠ Kutu olcekleri esit olmali -- kullanicinin asil istegi buydu.
  const esit = d.yukseklikler.length > 1 &&
               Math.max(...d.yukseklikler) - Math.min(...d.yukseklikler) <= 2;
  bak('butun kartlar ayni yukseklikte', esit, d.yukseklikler);

  // ── Dugme calisiyor mu ve pencereyi ACMIYOR mu ──
  const dug = await p.$('.mk-devam');
  if (dug) {
    await dug.click();
    await p.waitForTimeout(400);
    const sonra = await p.evaluate(()=>{
      const k = document.querySelector('.mk-kart[data-mk="test-uzun"]');
      const f = k.querySelector('.mk-foy');
      return { acik: f.classList.contains('acik'),
               yuk: Math.round(f.getBoundingClientRect().height),
               yazi: k.querySelector('.mk-devam').textContent.trim(),
               pencere: !!document.querySelector('.overlay.open') };
    });
    bak('tiklayinca aciliyor', sonra.acik && sonra.yuk > 200, sonra.yuk);
    bak('dugme yazisi "Daha az" oluyor', sonra.yazi === 'Daha az', sonra.yazi);
    bak('dugme mekan PENCERESINI ACMIYOR', sonra.pencere === false);
  } else {
    bak('dugme bulundu', false);
  }

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
