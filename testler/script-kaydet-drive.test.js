// KAYDET -> DRIVE'A GONDER AKISI.
//
// "Drive'a yaz" dugmesi 4. adimda, pencerenin tepesinde duruyor. Kullanici
// 6. adimda, en altta script yaziyor ve oraya coktan kaydirmis oluyor:
// dugme VAR ama bulundugu yerden YOK. Kaydedip yeniden acinca pencere
// yukaridan basladigi icin "ancak kaydedince cikiyor" gibi hissettiriyor.
//
// Cozum eylemi isin bittigi yere getirmek: Kaydet -> pencere kapanmaz ->
// "Script kaydedildi, Drive'a gondermek ister misin?" -> gonderilince
// "Drive'a kaydedildi" -> pencere kapanir.
//
// SINIR: bu soru yalnizca METIN VARSA ve script Drive'a HIC GONDERILMEMISSE
// cikiyor. Drive kullanmayan biri her kayitta gereksiz bir soru gormesin.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

async function ac(t){
  const p = await (await t.newContext({ viewport:{ width:1280, height:1000 } })).newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); scriptler = []; saveScriptler(); setPage('scripts'); });
  return p;
}
const durum = p => p.evaluate(()=>({
  acik: !!document.querySelector('#scriptOverlay.open'),
  sor: !document.getElementById('sc_saveNote').hidden,
  adet: scriptler.length,
  acikId: acikScriptId
}));
const yaz = (p, metin, baslik)=> p.evaluate(([m, b])=>{
  const t = document.getElementById('sc_text');
  t.value = m; t.dispatchEvent(new Event('input', { bubbles:true }));
  document.getElementById('sc_title').value = b || '';
}, [metin, baslik]);

(async () => {
  const t = await chromium.launch();
  const p = await ac(t);
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));

  console.log('[kaydet: pencere kapanmiyor, soru cikiyor]');
  await p.evaluate(()=> openScript(null, {}));
  await p.waitForTimeout(300);
  bak('açılışta soru yok', !(await durum(p)).sor);
  await yaz(p, 'Balat sokaklarında sabah çekimi', 'Balat');
  await p.click('#sc_save');
  await p.waitForTimeout(400);
  let d = await durum(p);
  bak('pencere AÇIK kaldı', d.acik, JSON.stringify(d));
  bak('script kaydedildi', d.adet === 1, String(d.adet));
  bak('soru çıktı', d.sor);
  bak('soruda "Drive\'a gönder" düğmesi var', await p.$('#sc_saveDrive') !== null);
  bak('metin soruyor, emir vermiyor',
      /ister misin/i.test(await p.$eval('#sc_saveNote', e=> e.textContent)),
      await p.$eval('#sc_saveNote', e=> e.textContent.trim()));

  // Ikinci kez Kaydet: AYNI kaydi guncellemeli, ikinci kopya olusmamali.
  console.log('[ikinci kaydet kopya üretmiyor]');
  const ilkId = d.acikId;
  await yaz(p, 'Balat sokaklarında sabah çekimi — ikinci hâli', 'Balat');
  await p.click('#sc_save');
  await p.waitForTimeout(400);
  d = await durum(p);
  bak('hâlâ tek script', d.adet === 1, String(d.adet));
  bak('aynı kayıt güncellendi', d.acikId === ilkId, d.acikId + ' / ' + ilkId);
  bak('metin kayda işlendi',
      /ikinci hâli/.test(await p.evaluate(()=> scriptler[0].text)),
      await p.evaluate(()=> scriptler[0].text));
  await p.evaluate(()=> closeScript());

  console.log('[boş taslakta eskisi gibi kapanıyor]');
  await p.evaluate(()=> openScript(null, {}));
  await p.waitForTimeout(250);
  await p.click('#sc_save');
  await p.waitForTimeout(350);
  d = await durum(p);
  bak('pencere kapandı', !d.acik);
  bak('boş taslak kaydedilmedi', d.adet === 1, String(d.adet));

  console.log('[Drive\'a bağlı scriptte soru çıkmıyor]');
  // Drive kullanan biri her kayitta ayni soruyu gormemeli.
  await p.evaluate(()=>{
    scriptler = [scriptTemizle({ id:'sc_drv', title:'Drive\'da', text:'metin',
                                 driveFileId:'dosya-1', driveFileName:'Drive\'da' })];
    saveScriptler(); openScript('sc_drv');
  });
  await p.waitForTimeout(350);
  await yaz(p, 'metin degisti', 'Drive\'da');
  await p.click('#sc_save');
  await p.waitForTimeout(400);
  d = await durum(p);
  bak('pencere kapandı (zaten Drive\'da)', !d.acik, JSON.stringify(d));
  bak('soru çıkmadı', !d.sor);

  console.log('[Drive\'a gönder: yazınca pencere kapanıyor]');
  await p.evaluate(()=>{
    scriptler = []; saveScriptler();
    // Google'a cikmiyoruz: uc fonksiyon taklit ediliyor. Olculen sey
    // AKIS — yazma bitince ne oluyor.
    window.__yazilan = null;
    driveBetikleri = ()=> Promise.resolve();
    driveIzinIste  = ()=> Promise.resolve('sahte-jeton');
    driveYeniBelge = (ad, metin)=>{ window.__yazilan = { ad, metin };
      return Promise.resolve({ id:'yeni-1', name: ad, modifiedTime:'2026-09-11T10:00:00Z' }); };
    openScript(null, {});
  });
  await p.waitForTimeout(300);
  await yaz(p, 'Drive\'a gidecek metin', 'Gönderilecek');
  await p.click('#sc_save');
  await p.waitForTimeout(400);
  bak('önce soru çıktı', (await durum(p)).sor);
  await p.click('#sc_saveDrive');
  await p.waitForSelector('#driveWriteOverlay.open', { timeout: 5000 });
  bak('Drive penceresi açıldı', true);
  bak('belge adı hazır geliyor',
      (await p.$eval('#dw_name', e=> e.value)).length > 0,
      await p.$eval('#dw_name', e=> e.value));
  await p.click('#dw_go');
  await p.waitForFunction(()=> !document.querySelector('#scriptOverlay.open'), null, { timeout: 8000 });
  d = await durum(p);
  bak('Drive\'a yazıldı', await p.evaluate(()=> !!window.__yazilan));
  bak('yazılan metin doğru',
      /Drive'a gidecek metin/.test(await p.evaluate(()=> window.__yazilan.metin)),
      await p.evaluate(()=> window.__yazilan.metin));
  bak('script penceresi KENDİLİĞİNDEN kapandı', !d.acik);
  bak('Drive penceresi de kapandı',
      await p.$('#driveWriteOverlay.open') === null);
  // Bag KAYDA yazilmali: yoksa bir dahaki sefere "yeni belge" onerilir.
  const kayit = await p.evaluate(()=> scriptler[0]);
  bak('Drive bağı kayda işlendi', kayit && kayit.driveFileId === 'yeni-1',
      JSON.stringify(kayit && { id:kayit.driveFileId, ad:kayit.driveFileName }));
  bak('"Drive\'a kaydedildi" bildirimi çıktı',
      /Drive'a kaydedildi/.test(await p.$eval('#toast', e=> e.textContent).catch(()=> '')),
      await p.$eval('#toast', e=> e.textContent).catch(()=> '(toast yok)'));

  bak('sayfa hatası yok', hata.length === 0, hata.join(' | '));
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
