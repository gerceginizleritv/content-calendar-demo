const { chromium } = require('./araclar');
const fs = require('fs');
const D = process.argv[2];
(async () => {
  const satirlar = JSON.parse(fs.readFileSync(D + '/satirlar.json', 'utf8'));
  const veri = { workspaces:[{id:'00000000-0000-0000-0000-000000000001',name:'Test'}],
                 locations: satirlar.L, calendar_events: satirlar.E };
  const stub = fs.readFileSync(D + '/sahte-supabase.js', 'utf8');
  const browser = await chromium.launch({ });
  const page = await browser.newPage();
  const hatalar = [];
  page.on('pageerror', e => hatalar.push(String(e)));
  await page.addInitScript(({veri, stub}) => {
    window.__VERI__ = veri;
    window.__OTURUM__ = { user:{ id:'00000000-0000-0000-0000-000000000002', email:'test@ornek.com' } };
    window.eval(stub);
  }, {veri, stub});
  await page.route('**/supabase-js**', r => r.fulfill({status:200, contentType:'application/javascript', body:''}));
  await page.goto('http://127.0.0.1:8099/index.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);

  let hata = 0;
  const k = (ad, s, ek) => { console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('DUZELTME TESTLERI');

  // Takvim sekmesine gec
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button,a')].find(x=>/Yayın Takvimi/.test(x.textContent));
    if(b) b.click();
  });
  await page.waitForTimeout(600);

  const gridVar = await page.evaluate(() => !!document.querySelector('.cal-day'));
  k('takvim ızgarası çizildi', gridVar);

  // 1) Tarih/saat kutusunda color-scheme
  const cs = await page.evaluate(() => getComputedStyle(document.getElementById('cal_date')).colorScheme);
  k('tarih kutusu koyu temaya ayarlı (ikon görünür)', cs === 'dark', cs);

  // 2) Bos bir gun hucresine tikla
  const sonuc = await page.evaluate(() => {
    const hucreler = [...document.querySelectorAll('.cal-day')];
    // icinde kayit olmayan bir gun bul
    const bos = hucreler.find(h => !h.querySelector('.cal-chip'));
    if(!bos) return { yok:true };
    const gun = bos.querySelector('.cal-day-num').textContent;
    bos.click();
    return {
      gun,
      acildi: document.getElementById('calOverlay').classList.contains('open'),
      tarih: document.getElementById('cal_date').value,
      isaretliSayisi: [...document.querySelectorAll('#calPlatformMultiWrap input[type=checkbox]')].filter(c=>c.checked).length,
      kutuSayisi: document.querySelectorAll('#calPlatformMultiWrap input[type=checkbox]').length
    };
  });
  k('boş güne tıklayınca yeni giriş açıldı', sonuc.acildi === true, sonuc.gun);
  k('tıklanan günün tarihi doldu', /^\d{4}-\d{2}-\d{2}$/.test(sonuc.tarih||''), sonuc.tarih);
  k('hiçbir platform önceden işaretli değil', sonuc.isaretliSayisi === 0,
     sonuc.isaretliSayisi + '/' + sonuc.kutuSayisi);

  // Tiklanan gun ile modaldaki tarih ayni mi
  const ayniMi = await page.evaluate(() => {
    document.getElementById('calOverlay').classList.remove('open');
    const hucreler = [...document.querySelectorAll('.cal-day')];
    const bos = hucreler.filter(h => !h.querySelector('.cal-chip'));
    const hedef = bos[bos.length-1];
    const yazi = hedef.querySelector('.cal-day-num').textContent;   // "12 Eyl · Cum"
    hedef.click();
    const gun = parseInt(document.getElementById('cal_date').value.split('-')[2], 10);
    return { yazi, gun, esit: yazi.trim().startsWith(String(gun)) };
  });
  k('açılan tarih tıklanan günle aynı', ayniMi.esit === true, ayniMi.yazi + ' → ' + ayniMi.gun);

  // 3) Kayit rozetine tiklayinca YENI giris degil, o kayit acilmali
  const rozet = await page.evaluate(() => {
    document.getElementById('calOverlay').classList.remove('open');
    const c = document.querySelector('.cal-chip');
    if(!c) return { yok:true };
    c.click();
    return {
      acildi: document.getElementById('calOverlay').classList.contains('open'),
      baslik: document.getElementById('cal_title').value,
      // mevcut kayitta coklu platform kutulari gizli olmali
      cokluGizli: document.getElementById('calPlatformMultiWrap').style.display === 'none'
    };
  });
  k('kayda tıklayınca o kayıt açıldı (yeni giriş değil)', rozet.acildi && rozet.cokluGizli && !!rozet.baslik, rozet.baslik);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,4).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await browser.close();
  process.exit(hata?1:0);
})();
