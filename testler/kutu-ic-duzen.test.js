// KUTU IC DUZENI: hafta, gun ve ay gorunumunde AYNI olmali.
//
// ⚠ 15 KASIM 2026 — KULLANICI BILDIRDI:
//   "hafta gorunum ok ama ay gorunum de ayni olmaliydi"
//   1320 pikselin ustunde kutu sol seritli duzene geciyor (saat / ikon /
//   tur alt alta, sagda basligin iki satiri). Hafta gorunumunde calisti,
//   AY gorunumunde calismadi.
//
// ⚠ SEBEP, BU DOSYADA UCUNCU KEZ: secici `.cal-day .cal-chip` (0,2,0) ile
//   ay kutusunun kendi izgara kurallari ESIT ozgullukte ve onlar dosyada
//   DAHA SONRA geliyor; esitlikte sonra gelen kazaniyor.
//   Belirtisi ogreticiydi: saat seridinin RENGI tutuyordu ama YERLESIMI
//   tutmuyordu -- ay kurali background yazmiyor, yalnizca grid-column.
//
// ⛔ BU KUSUR TAM KOSUDAN GECTI. 199 testin hicbiri kutunun IC duzenine
//   bakmiyordu; kullanici gozuyle yakaladi. Bu dosya o bosluk icin var.
//
// Olculen sey: sol seritteki uc oge (saat, platform ikonu, tur etiketi)
// AYNI genislikte ve AYNI merkezde mi. Piksel degeri sabitlenmiyor --
// sutun genisligi ekrana gore degisiyor; olculen sey UCUNUN BIRBIRINE
// hizali olmasi.
const { chromium } = require('./araclar');

const ESIK_USTU = 1440;   // sol seritli duzenin gecerli oldugu genislik
const ESIK_ALTI = 1200;   // bugunku duzenin korundugu genislik

(async () => {
  const b = await chromium.launch({ });
  let kalan = 0, gecen = 0;
  const bak = (ad, kosul, ek) => {
    if (kosul) { gecen++; console.log('  ok  ' + ad); }
    else { kalan++; console.log('  YOK ' + ad + (ek !== undefined ? ' → ' + JSON.stringify(ek) : '')); }
  };

  // Kayit uretip takvime koyuyoruz: bos takvimde olculecek kutu olmaz.
  const tohum = (gun) => ({
    id:'t'+gun, type:'story', platform:'instagram', title:'Olcum kaydi '+gun,
    date:gun, time:'09:30', uploaded:false,
    content:{ projectId:'', caption:'', hashtags:'', videoTitle:'',
              shortTitle:'', thumbPrompt:'', slidePrompts:[] }
  });

  async function olc(genislik, gorunum) {
    const c = await b.newContext({ viewport:{width:genislik,height:1000} });
    const p = await c.newPage();
    const bugun = new Date();
    const gunler = [0,1,2].map(k=>{
      const d = new Date(bugun); d.setDate(d.getDate()+k);
      return d.toISOString().slice(0,10);
    });
    await p.addInitScript(([kayitlar, gor])=>{ try{
      localStorage.setItem('demo_ui_language','tr');
      localStorage.setItem('demo_content_calendar_v1', kayitlar);
      localStorage.setItem('demo_ornek_kaldirildi','1');
      localStorage.setItem('demo_view', gor);
    }catch(e){} }, [JSON.stringify(gunler.map(tohum)), gorunum]);
    await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1600);
    const atla = await p.$('#tourSkip'); if (atla) { await atla.click(); await p.waitForTimeout(500); }
    for (let i=0;i<3;i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(140); }
    await p.evaluate(()=> document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')));
    const sek = await p.$('#tabCalendar'); if (sek) { await sek.click(); await p.waitForTimeout(400); }
    await p.click(gorunum==='month' ? '#viewMonthBtn' : gorunum==='day' ? '#viewDayBtn' : '#viewWeekBtn');
    await p.waitForTimeout(700);
    const r = await p.evaluate(()=>{
      const R = e => e.getBoundingClientRect();
      const k = [...document.querySelectorAll('.hg-chip, .cal-day .cal-chip')]
                  .filter(e=> R(e).height > 0)[0];
      if(!k) return null;
      const al = s => { const e = k.querySelector(s); if(!e) return null;
        const r = R(e); return { gen: Math.round(r.width), merkez: Math.round(r.left + r.width/2) }; };
      return { saat: al('.cal-time'), ikon: al('.cal-pico'), tur: al('.cal-badge') };
    });
    await c.close();
    return r;
  }

  for (const gorunum of ['week','day','month']) {
    const r = await olc(ESIK_USTU, gorunum);
    if(!r || !r.saat || !r.ikon || !r.tur){
      bak(gorunum + ' · olculecek kutu bulundu', false, r);
      continue;
    }
    bak(gorunum + ' · saat, ikon ve tur AYNI genislikte',
        r.saat.gen === r.ikon.gen && r.ikon.gen === r.tur.gen,
        { saat:r.saat.gen, ikon:r.ikon.gen, tur:r.tur.gen });
    // Merkezlerde 1 piksel pay var: tek sayili genislikteki svg yarim
    // piksele dusebiliyor.
    const enBuyukFark = Math.max(
      Math.abs(r.saat.merkez - r.ikon.merkez),
      Math.abs(r.ikon.merkez - r.tur.merkez));
    bak(gorunum + ' · ucu de AYNI merkezde', enBuyukFark <= 1,
        { saat:r.saat.merkez, ikon:r.ikon.merkez, tur:r.tur.merkez });
  }

  // Esigin ALTINDA bugunku duzen korunuyor: oradaki kutuda uc oge YAN YANA,
  // yani ayni merkezde DEGIL. Bu olcum, medya sorgusunun kazara her
  // genislige yayilmasini yakalar.
  {
    const r = await olc(ESIK_ALTI, 'week');
    const ayniMi = r && r.saat && r.ikon && r.tur &&
      r.saat.merkez === r.ikon.merkez && r.ikon.merkez === r.tur.merkez;
    bak('esigin altinda (1200) bugunku duzen korunuyor', !ayniMi, r);
  }

  await b.close();
  console.log('\n=== gecen ' + gecen + ' / kalan ' + kalan + ' ===');
  process.exit(kalan ? 1 : 0);
})();
