const { chromium } = require('./araclar');
(async () => {
  const browser = await chromium.launch({ });
  const page = await browser.newPage({ viewport:{width:1200,height:900} });
  const hatalar = [];
  page.on('pageerror', e => hatalar.push(String(e)));
  page.on('console', m => { if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r => r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r => r.abort());
  await page.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('SLATE — TABLO GORUNUMU');
  k('Table düğmesi var', await page.evaluate(()=> !!document.getElementById('viewTableBtn')));

  // Acilistaki bilgi pencerelerini kapat: testin konusu bunlar degil.
  // Uygulama artik projeler sayfasiyla aciliyor; takvim testleri once
  // takvim sekmesine geciyor.
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('calendar'); });
  await page.click('#viewTableBtn');
  await page.waitForTimeout(500);
  const t1 = await page.evaluate(()=>({
    izgaraGizli: getComputedStyle(document.getElementById('calGrid')).display === 'none',
    izgaraYuksekligi: document.getElementById('calGrid').getBoundingClientRect().height,
    tabloGorunur: getComputedStyle(document.getElementById('calTableWrap')).display !== 'none',
    aktif: document.getElementById('viewTableBtn').classList.contains('active'),
    satir: document.querySelectorAll('.cal-table tbody tr').length,
    basliklar: [...document.querySelectorAll('.cal-table thead th')].map(x=>x.textContent.trim()),
    rozet: document.querySelectorAll('.ct-chip').length,
    aralik: document.getElementById('rangeLabel').textContent
  }));
  k('ızgara gerçekten ekrandan kalktı', t1.izgaraGizli === true && t1.izgaraYuksekligi === 0, 'yükseklik ' + t1.izgaraYuksekligi);
  k('tablo göründü', t1.tabloGorunur === true);
  k('düğme aktif işaretlendi', t1.aktif === true);
  k('14 gün satırı', t1.satir === 14, t1.satir);
  k('tüm platformlar sütun oldu (8)', t1.basliklar.length === 9, t1.basliklar.join(' | '));
  k('aralık etiketi yazıldı', /\d/.test(t1.aralik), t1.aralik);
  k('kayıt rozetleri basıldı', t1.rozet > 0, t1.rozet);

  const d1 = await page.evaluate(()=>{
    document.querySelector('.ct-chip').click();
    return { acik: document.getElementById('editOverlay').classList.contains('open'),
             baslik: document.getElementById('f_title') ? document.getElementById('f_title').value : null };
  });
  k('rozete tıklayınca kayıt açıldı', d1.acik === true && !!d1.baslik, d1.baslik);

  const d2 = await page.evaluate(()=>{
    document.getElementById('editOverlay').classList.remove('open');
    const bos = document.querySelector('.ct-empty');
    const tarih = bos.dataset.date;
    bos.click();
    return { tarih, formTarih: document.getElementById('f_date').value,
             acik: document.getElementById('editOverlay').classList.contains('open') };
  });
  k('boş hücreye tıklayınca yeni kayıt açıldı', d2.acik === true);
  k('tıklanan günün tarihi doldu', d2.tarih === d2.formTarih, d2.tarih + ' = ' + d2.formTarih);

  const gez = await page.evaluate(()=>{
    document.getElementById('editOverlay').classList.remove('open');
    const al = ()=> document.querySelector('.cal-table tbody tr .ct-daynum').textContent;
    const once = al();
    document.getElementById('nextBtn').click(); const sonra = al();
    document.getElementById('prevBtn').click(); const geri = al();
    return { once, sonra, geri };
  });
  k('ileri gidince tablo değişti', gez.once !== gez.sonra, gez.once+' → '+gez.sonra);
  k('geri gelince aynı yere döndü', gez.once === gez.geri, gez.geri);

  await page.reload({ waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);
  k('yenileyince tablo modunda kaldı', await page.evaluate(()=> getComputedStyle(document.getElementById('calTableWrap')).display !== 'none'));
  k('yenilemeden sonra da ızgara görünmüyor', await page.evaluate(()=> document.getElementById('calGrid').getBoundingClientRect().height === 0));
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  k('sayfa yana kaymıyor', await page.evaluate(()=> document.documentElement.scrollWidth <= window.innerWidth + 1));

  await page.screenshot({ path: process.argv[2] + '/slate-tablo.png' });
  // Karanlik tema
  await page.emulateMedia({ colorScheme:'dark' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.argv[2] + '/slate-tablo-koyu.png' });

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await browser.close(); process.exit(hata?1:0);
})();
