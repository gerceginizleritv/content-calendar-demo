// Paylasilabilir salt-okunur takvim. Uygulamada baglanti uretiliyor,
// paylas.html onu okuyup ciziyor. Aciklama ve kapak tarifleri BILEREK
// disariya gitmiyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const UID = '11111111-2222-4333-8444-555555555555';

(async () => {
  const t = await chromium.launch({ });
  const c = await t.newContext({ viewport:{width:1280,height:1000} });
  const p = await c.newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e)));
  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  await p.evaluate(() => { try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'networkidle' });

  // Sahte oturum + depolama taklidi: yuklenen govde yakalaniyor.
  const yuklenen = [];
  await p.exposeFunction('__yuklendi', (yol, govde) => yuklenen.push({ yol, govde }));
  await p.evaluate((uid) => {
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    session = { user: { id: uid, email:'a@b.c', app_metadata:{provider:'email'} } };
    sb = { storage: { from: () => ({
      upload: async (yol, blob) => { window.__yuklendi(yol, await blob.text()); return { error: null }; },
      remove: async (yollar) => { window.__yuklendi('SILINDI:' + yollar[0], ''); return { error: null }; }
    }) } };
    // Icinde her sey olan bir kayit: disariya ne gittigi olculecek.
    events = [{ id:'ev1', type:'reels', platform:'instagram', date:'2026-09-10', time:'09:00',
                uploaded:false, title:'Mozaikler', projectId:'',
                content:{ caption:'GIZLI ACIKLAMA', hashtags:'gizlietiket',
                          videoTitle:'gizli video basligi', shortTitle:'GIZLI KAPAK',
                          thumbPrompt:'gizli kapak tarifi', slidePrompts:[] } }];
    save();
    setPage('calendar');
  }, UID);

  console.log('[baglanti uretme]');
  await p.click('#paylasBtn');
  await p.waitForSelector('#paylasOverlay.open');
  bak('pencere aciliyor', true);
  bak('baglanti yokken adres satiri gizli', await p.$eval('#pay_adresSatir', e => e.hidden));
  bak('kapatma dugmesi gizli', await p.$eval('#pay_kapat', e => e.hidden));
  await p.click('#pay_olustur');
  await p.waitForTimeout(500);
  bak('adres satiri acildi', !(await p.$eval('#pay_adresSatir', e => e.hidden)));
  const adres = await p.$eval('#pay_adres', e => e.value);
  bak('adres paylas.html ve jeton iceriyor', /paylas\.html#/.test(adres) && adres.includes(UID), adres);
  bak('dosya yuklendi', yuklenen.length === 1 && yuklenen[0].yol.startsWith(UID + '/'), JSON.stringify(yuklenen[0]||{}).slice(0,60));

  console.log('[ne gonderiliyor]');
  const govde = JSON.parse(yuklenen[0].govde);
  bak('kayit disariya gitti', govde.kayitlar.length === 1);
  bak('tarih, saat, tur, platform, baslik var',
      govde.kayitlar[0].tarih === '2026-09-10' && govde.kayitlar[0].saat === '09:00' &&
      govde.kayitlar[0].tur === 'reels' && govde.kayitlar[0].platform === 'instagram' &&
      govde.kayitlar[0].baslik === 'Mozaikler', JSON.stringify(govde.kayitlar[0]));
  const ham = yuklenen[0].govde;
  bak('AÇIKLAMA gitmiyor', !ham.includes('GIZLI ACIKLAMA'));
  bak('HASHTAG gitmiyor', !ham.includes('gizlietiket'));
  bak('KAPAK TARİFİ gitmiyor', !ham.includes('gizli kapak tarifi'));
  bak('video başlığı gitmiyor', !ham.includes('gizli video basligi'));

  console.log('[degisiklikte tazeleme]');
  const oncekiSayi = yuklenen.length;
  await p.evaluate(() => { events.push({ id:'ev2', type:'video', platform:'youtube', date:'2026-09-12',
                                         time:'', uploaded:true, title:'Ikinci', projectId:'', content:{} }); save(); });
  await p.waitForTimeout(3200);
  bak('kayıt değişince kopya kendiliğinden tazeleniyor', yuklenen.length > oncekiSayi, yuklenen.length + ' yükleme');
  const son = JSON.parse(yuklenen[yuklenen.length-1].govde);
  bak('yeni kayıt kopyada', son.kayitlar.length === 2);

  console.log('[goruntuleyici sayfa]');
  const veriUrl = 'https://dyemvzmpnlpnzwebuciu.supabase.co/storage/v1/object/public/paylasim/' + UID + '/*';
  const p2 = await c.newPage();
  const hata2 = []; p2.on('pageerror', e => hata2.push(String(e)));
  await p2.route('**/storage/v1/object/public/paylasim/**', r =>
    r.fulfill({ status:200, contentType:'application/json', body: yuklenen[yuklenen.length-1].govde }));
  const jeton = yuklenen[0].yol.split('/')[1].replace('.json','');
  await p2.goto(KOK + '/paylas.html#' + UID + '/' + jeton, { waitUntil:'networkidle' });
  await p2.waitForTimeout(500);
  bak('sayfa açıldı', !(await p2.$eval('#govde', e => e.hidden)));
  bak('"salt okunur" yazıyor', /okunur|read only/i.test(await p2.$eval('#rozet', e => e.textContent)));
  bak('takvimde kayıt görünüyor', (await p2.$eval('#izgara', e => e.textContent)).includes('Mozaikler'));
  await p2.click('#sonraki'); await p2.waitForTimeout(200);
  await p2.click('#onceki'); await p2.waitForTimeout(200);
  bak('ay ileri geri gidiyor', (await p2.$eval('#ayAdi', e => e.textContent)).length > 3);
  bak('arama motorlarına kapalı',
      (await p2.$eval('meta[name="robots"]', e => e.content)).includes('noindex'));
  bak('düzenleme alanı YOK', (await p2.$$('input, textarea, [contenteditable]')).length === 0);
  bak('sayfa hatası yok', hata2.length === 0, hata2[0]);

  console.log('[bozuk ve kapali baglanti]');
  const p3 = await c.newPage();
  await p3.goto(KOK + '/paylas.html#bozuk', { waitUntil:'networkidle' });
  await p3.waitForTimeout(300);
  bak('eksik adreste anlaşılır mesaj', (await p3.$eval('#durum', e => e.className)) === 'hata');
  await p3.route('**/storage/v1/object/public/paylasim/**', r => r.fulfill({ status:404, body:'' }));
  await p3.goto(KOK + '/paylas.html#' + UID + '/' + jeton, { waitUntil:'networkidle' });
  await p3.waitForTimeout(400);
  bak('kapatılmış bağlantıda "yenisini iste" diyor',
      /kapat|closed|expired/i.test(await p3.$eval('#durum', e => e.textContent)),
      await p3.$eval('#durum', e => e.textContent));

  console.log('[kapatma]');
  await p.evaluate(() => { window.onayla = ()=> Promise.resolve(true); });
  await p.click('#pay_kapat');
  await p.waitForTimeout(400);
  bak('dosya silindi', yuklenen.some(x => x.yol.startsWith('SILINDI:')));
  bak('adres satırı kapandı', await p.$eval('#pay_adresSatir', e => e.hidden));
  bak('jeton temizlendi', (await p.evaluate(() => paylasim.jeton)) === '');

  bak('uygulamada sayfa hatası yok', hata.length === 0, hata[0]);
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
