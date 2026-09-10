// CSV / Sheets / Excel / Notion'dan ice aktarma. Sheets ve Notion'dan
// KOPYALANAN sey sekmeyle ayrilmis metin, disa aktarilan sey CSV.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const SEKMELI = [
  'Tarih\tSaat\tPlatform\tTür\tBaşlık\tProje\tYayınlandı',
  '2026-09-10\t09:00\tInstagram\tReels\tMozaikler — teaser\tKariye\tEvet',
  '15.09.2026\t18:30\tYouTube\tVideo\tKariye: bir restorasyonun hikâyesi\tKariye\tHayır',
  '22 Eylül 2026\t\tTikTok\tShorts\tTek lamba ile ışık\tStüdyo\t'
].join('\n');

const CSV_TIRNAKLI = [
  'Date,Time,Platform,Title',
  '"September 10, 2026",09:00,YouTube,"Mosaics, part one"',
  '2026-09-11,,Instagram,"He said ""go"" and we went"',
  'bozuk-tarih,10:00,X,Atlanacak'
].join('\n');

(async () => {
  const t = await chromium.launch({ });
  const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e)));
  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  await p.evaluate(() => { try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'networkidle' });
  await p.evaluate(() => {
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    events = []; projects = []; save(); saveProjects(); setLanguage('tr');
    window.onayla = ()=> Promise.resolve(true);
  });

  console.log('[sekmeli yapistirma — Sheets/Notion kopyasi]');
  await p.click('#importBtn');
  await p.waitForSelector('#importOverlay.open');
  bak('pencere aciliyor', true);
  bak('baslangicta "Ice aktar" kapali', await p.$eval('#imp_uygula', e => e.disabled));
  await p.fill('#imp_metin', SEKMELI);
  await p.waitForTimeout(300);
  bak('satirlar okundu', /3/.test(await p.$eval('#imp_satirSay', e => e.textContent)),
      await p.$eval('#imp_satirSay', e => e.textContent));
  const esles = await p.$$eval('[data-imp-alan]', e => e.map(x => ({ alan: x.dataset.impAlan, deger: x.value })));
  const bul = a => (esles.find(x => x.alan === a) || {}).deger;
  bak('tarih sutunu tahmin edildi', bul('tarih') === '0', JSON.stringify(esles));
  bak('saat sutunu tahmin edildi', bul('saat') === '1');
  bak('platform tahmin edildi', bul('platform') === '2');
  bak('tur tahmin edildi', bul('tur') === '3');
  bak('baslik tahmin edildi', bul('baslik') === '4');
  bak('proje tahmin edildi', bul('proje') === '5');
  bak('yayinlandi tahmin edildi', bul('yayinlandi') === '6');
  bak('ozet uc kayit diyor', /3/.test(await p.$eval('#imp_ozet', e => e.textContent)));
  const onizleme = await p.$eval('#imp_onizleme', e => e.textContent);
  bak('nokta ile yazilan tarih cevrildi', onizleme.includes('2026-09-15'), onizleme);
  bak('turkce ay adi cevrildi', onizleme.includes('2026-09-22'), onizleme);
  bak('"Evet" yayinlandi sayildi', onizleme.includes('yayınlandı'));
  bak('proje adlari uyarida', /2 proje/.test(await p.$eval('#imp_uyari', e => e.textContent)),
      await p.$eval('#imp_uyari', e => e.textContent));

  await p.click('#imp_uygula');
  await p.waitForTimeout(500);
  const sonuc = await p.evaluate(() => ({
    kayit: events.length,
    proje: projects.map(x=>x.name).sort(),
    ilk: events.find(e=>e.date==='2026-09-10'),
    bagli: events.filter(e=>(e.content||{}).projectId).length
  }));
  bak('uc kayit eklendi', sonuc.kayit === 3, String(sonuc.kayit));
  bak('iki proje acildi', sonuc.proje.join(',') === 'Kariye,Stüdyo', sonuc.proje.join(','));
  bak('kayitlar projeye baglandi', sonuc.bagli === 3, String(sonuc.bagli));
  bak('platform ve tur dogru', sonuc.ilk.platform === 'instagram' && sonuc.ilk.type === 'reels',
      sonuc.ilk.platform + '/' + sonuc.ilk.type);
  bak('saat dogru', sonuc.ilk.time === '09:00', sonuc.ilk.time);
  bak('yayinlandi isaretlendi', sonuc.ilk.uploaded === true);
  bak('baslik durdu', sonuc.ilk.title === 'Mozaikler — teaser', sonuc.ilk.title);
  bak('pencere kapandi', !(await p.$('#importOverlay.open')));

  console.log('[tirnakli CSV ve atlanan satir]');
  await p.evaluate(() => { events = []; projects = []; save(); saveProjects(); });
  await p.click('#importBtn');
  await p.waitForSelector('#importOverlay.open');
  await p.fill('#imp_metin', CSV_TIRNAKLI);
  await p.waitForTimeout(300);
  const on2 = await p.$eval('#imp_onizleme', e => e.textContent);
  bak('tirnak icindeki virgul hucreyi bolmuyor', on2.includes('Mosaics, part one'), on2.slice(0,90));
  bak('cift tirnak tek tirnaga iniyor', on2.includes('He said "go" and we went'), on2.slice(0,140));
  bak('ingilizce ay adi cevrildi', on2.includes('2026-09-10'));
  bak('bozuk tarihli satir atlandi',
      /1 satır atlandı/.test(await p.$eval('#imp_uyari', e => e.textContent)),
      await p.$eval('#imp_uyari', e => e.textContent));
  await p.click('#imp_uygula');
  await p.waitForTimeout(400);
  bak('yalnizca iki kayit eklendi', (await p.evaluate(() => events.length)) === 2);

  console.log('[elle eslesme ve bozuk girdi]');
  await p.click('#importBtn');
  await p.waitForSelector('#importOverlay.open');
  await p.fill('#imp_metin', 'bir\niki\nuc');
  await p.waitForTimeout(250);
  const d = await p.$eval('#imp_durum', e => ({ y: e.textContent, c: e.className }));
  bak('tek sutunlu metinde tarih yok uyarisi', await p.$eval('#imp_uygula', e => e.disabled), JSON.stringify(d));
  await p.fill('#imp_metin', 'A;B\n01.02.2026;deneme');
  await p.waitForTimeout(250);
  bak('noktali virgul de ayirici sayiliyor', /1/.test(await p.$eval('#imp_satirSay', e => e.textContent)));
  await p.selectOption('[data-imp-alan="tarih"]', '0');
  await p.selectOption('[data-imp-alan="baslik"]', '1');
  await p.waitForTimeout(250);
  bak('elle eslesme onizlemeyi degistiriyor',
      (await p.$eval('#imp_onizleme', e => e.textContent)).includes('deneme'));
  bak('gun/ay dogru okundu (01.02 -> 1 Subat)',
      (await p.$eval('#imp_onizleme', e => e.textContent)).includes('2026-02-01'),
      await p.$eval('#imp_onizleme', e => e.textContent));

  bak('sayfa hatasi yok', hata.length === 0, hata[0]);
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
