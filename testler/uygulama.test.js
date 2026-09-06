const { chromium } = require('./araclar');
const fs = require('fs');
const D = process.argv[2];

(async () => {
  const satirlar = JSON.parse(fs.readFileSync(D + '/satirlar.json', 'utf8'));
  const veri = { workspaces: [{ id: '00000000-0000-0000-0000-000000000001', name: 'Gerçeğin İzleri' }],
                 locations: satirlar.L, calendar_events: satirlar.E };
  const stub = fs.readFileSync(D + '/sahte-supabase.js', 'utf8');

  const browser = await chromium.launch({ });
  const page = await browser.newPage();
  const hatalar = [];
  page.on('pageerror', e => hatalar.push(String(e)));
  const agHatasi = [];
  page.on('console', m => { if(m.type()!=='error') return;
    const t=m.text();
    if(/Failed to load resource/.test(t)) agHatasi.push(t); else hatalar.push('console: '+t); });

  await page.addInitScript(({veri, stub}) => {
    window.__VERI__ = veri;
    window.__OTURUM__ = { user: { id: '00000000-0000-0000-0000-000000000002', email: 'test@ornek.com' } };
    // Gercek CDN'e cikamadigimiz icin kutuphaneyi biz koyuyoruz.
    window.eval(stub);
  }, {veri, stub});

  // CDN istegini bosa cikar: stub zaten yerinde.
  await page.route('**/supabase-js**', r => r.fulfill({ status:200, contentType:'application/javascript', body:'' }));

  await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const sonuc = await page.evaluate(() => ({
    lokasyon: typeof locations!=='undefined' ? locations.length : -1,
    kayit: typeof calendarEvents!=='undefined' ? calendarEvents.length : -1,
    girisPerdesi: !!document.getElementById('girisPerde'),
    kartSayisi: document.getElementById('grid') ? document.getElementById('grid').children.length : 0,
    ilkAd: typeof locations!=='undefined' && locations[0] ? locations[0].name : null,
    yayinlanmis: typeof locations!=='undefined' ? locations.filter(l=>l.published==='E').length : -1,
    yuklenmis: typeof calendarEvents!=='undefined' ? calendarEvents.filter(e=>e.uploaded).length : -1,
    izinE: typeof locations!=='undefined' ? locations.filter(l=>l.permission==='E').length : -1,
    yazmalar: window.__yazmalar.length
  }));

  if(agHatasi.length) console.log('(bu ortamda erisilemeyen dis kaynak: '+agHatasi.length+' — lokasyon fotograflari, uygulama hatasi degil)');
  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,6).forEach(h=>console.log('  '+h)); }
  let hata = 0;
  const k = (ad, s, ek) => { console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('UYGULAMA — TARAYICI TESTI');
  k('giriş perdesi kapandı', sonuc.girisPerdesi === false);
  k('43 lokasyon yüklendi', sonuc.lokasyon === 43, sonuc.lokasyon);
  k('99 yayın kaydı yüklendi', sonuc.kayit === 99, sonuc.kayit);
  k('bayraklar E/H biçimine döndü (11 yayınlanmış)', sonuc.yayinlanmis === 11, sonuc.yayinlanmis);
  k('izin verilmiş 3 lokasyon', sonuc.izinE === 3, sonuc.izinE);
  k('87 yüklenmiş kayıt', sonuc.yuklenmis === 87, sonuc.yuklenmis);
  k('ekrana 43 kart basıldı', sonuc.kartSayisi === 43, sonuc.kartSayisi);
  k('ilk lokasyonun adı bozulmadı', /[çğıöşüÇĞİÖŞÜ]/.test(sonuc.ilkAd||'') || (sonuc.ilkAd||'').length>3, sonuc.ilkAd);
  k('açılışta gereksiz yazma yok', sonuc.yazmalar === 0, sonuc.yazmalar);

  // Tek bir lokasyonu degistir: yalnizca O satir yazilmali.
  await page.evaluate(() => {
    window.__yazmalar.length = 0;
    locations[0].notes = 'test notu ' + Date.now();
    return window.persistNow();
  });
  await page.waitForTimeout(600);
  const y = await page.evaluate(() => window.__yazmalar);
  k('tek değişiklik → tek yazma işlemi', y.length === 1, JSON.stringify(y.map(x=>x.tablo+':'+x.islem)));
  k('yalnızca 1 satır gönderildi', y.length===1 && y[0].adet === 1, y[0] && y[0].adet);
  k('doğru tablo', y.length===1 && y[0].tablo === 'locations', y[0] && y[0].tablo);

  // Hicbir sey degismeden kaydet: hic yazma olmamali.
  await page.evaluate(() => { window.__yazmalar.length = 0; return window.persistNow(); });
  await page.waitForTimeout(400);
  const y2 = await page.evaluate(() => window.__yazmalar.length);
  k('değişiklik yokken hiç yazma yok', y2 === 0, y2);

  // Bir lokasyon sil: silme islemi gitmeli.
  await page.evaluate(() => {
    window.__yazmalar.length = 0;
    locations.splice(0,1);
    return window.persistNow();
  });
  await page.waitForTimeout(600);
  const y3 = await page.evaluate(() => window.__yazmalar);
  k('silme işlemi gönderildi', y3.length===1 && y3[0].islem==='sil', JSON.stringify(y3.map(x=>x.islem)));

  if(hatalar.length){ console.log('\nSAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata += hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await page.screenshot({ path: process.argv[2] + '/uygulama.png', fullPage: false });
  await browser.close();
  process.exit(hata?1:0);
})();
