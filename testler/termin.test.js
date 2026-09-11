const { chromium } = require('./araclar');
(async () => {
  const D = process.argv[2];
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:950} });
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('projects'); });

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('TERMIN PENCERESI + KOMPAKT TABLO');

  // Proje olustur -> termin soruluyor
  const olus = await page.evaluate(async ()=>{
    const c = window.onayla; window.__soruldu = null;
    window.onayla = (m)=>{ window.__soruldu = m; return true; };   // evet de
    openProjectNew('Saha Çekimi — Trabzon');
    document.getElementById('pe_type').value = 'studio';
    document.getElementById('pe_type').dispatchEvent(new Event('change'));
    document.getElementById('pe_shoot').value = '2026-09-19';
    document.getElementById('pe_save').click();
    await new Promise(r=>setTimeout(r,350));
    window.onayla = c;
    return { soru: window.__soruldu,
             acik: document.getElementById('deadlineOverlay').classList.contains('open'),
             satir: document.querySelectorAll('#dlRows .dl-row').length,
             kim: document.getElementById('dlWho').textContent };
  });
  k('proje kurulunca termin soruluyor', /teslim tarihi|deadline/i.test(olus.soru||''), (olus.soru||'').slice(0,50));
  k('evet deyince pencere açıldı', olus.acik === true);
  k('pencerede yedi adım var', olus.satir === 7, olus.satir);
  k('hangi proje olduğu yazıyor', /Trabzon/.test(olus.kim||''), olus.kim);

  // Baslik satiri: baslangic tarihi kutularin ustunde, proje adiyla ayni hizada
  const bas = await page.evaluate(()=>{
    const ad = document.getElementById('dlWho').getBoundingClientRect();
    const bt = document.getElementById('dlStart').closest('.dl-start').getBoundingClientRect();
    const adim = document.querySelector('#dlRows .dl-step').getBoundingClientRect();
    const kutu = document.querySelector('#dlRows input[type=date]').getBoundingClientRect();
    return { metin: document.getElementById('dlStart').value,
             adSol: Math.round(ad.left), adimSol: Math.round(adim.left),
             basSag: Math.round(bt.right), kutuSag: Math.round(kutu.right),
             ustte: bt.bottom <= kutu.top };
  });
  k('başlangıç tarihi yazıyor', bas.metin === '2026-09-19', bas.metin);
  k('proje adı ile aynı satırda', Math.abs(bas.adSol - bas.adimSol) <= 1, bas.adSol + ' / ' + bas.adimSol);
  k('tarih kutularının üstünde ve hizasında', bas.ustte && Math.abs(bas.basSag - bas.kutuSag) <= 2, bas.basSag + ' / ' + bas.kutuSag);

  // Tarihleri gir ve kaydet
  const kaydet = await page.evaluate(async ()=>{
    const g = (k,v)=>{ const el = document.querySelector(`[data-dl-step="${k}"]`); el.value = v; };
    g('script','2020-01-01');          // gecmis
    g('filmed','2026-09-19');
    g('edited','2030-01-01');          // gelecek
    document.getElementById('dlSave').click();
    await new Promise(r=>setTimeout(r,250));
    const p = projects[0];
    return { kapandi: !document.getElementById('deadlineOverlay').classList.contains('open'),
             dl: p.deadlines,
             kutuSayisi: document.querySelectorAll('.proj-table .pdl').length,
             metinler: [...document.querySelectorAll('.proj-table .pdate')].map(x=>x.textContent.trim()),
             gecikmis: document.querySelectorAll('.proj-table .pdate.late').length,
             serit: !document.getElementById('p_overdue').hidden };
  });
  k('pencere kapandı, tarihler kaydedildi', kaydet.kapandi && kaydet.dl.script === '2020-01-01' && kaydet.dl.edited === '2030-01-01', JSON.stringify(kaydet.dl.script));
  k('TABLODA ARTIK TARİH KUTUSU YOK', kaydet.kutuSayisi === 0, kaydet.kutuSayisi);
  k('tarihler metin olarak görünüyor', kaydet.metinler.filter(x=>/\d/.test(x)).length === 3, kaydet.metinler.filter(x=>/\d/.test(x)).join(' | '));
  k('geçmiş tarih kırmızı kutuda', kaydet.gecikmis === 1, kaydet.gecikmis);
  k('gelecek tarih kırmızı değil', kaydet.gecikmis === 1);
  k('üstte uyarı şeridi çıktı', kaydet.serit === true);

  // Tarih metnine tiklayinca pencere yeniden acilmali
  const yeniden = await page.evaluate(async ()=>{
    document.querySelector('.pdate').click();
    await new Promise(r=>setTimeout(r,200));
    const dolu = document.querySelector('[data-dl-step="script"]').value;
    return { acik: document.getElementById('deadlineOverlay').classList.contains('open'), dolu };
  });
  k('tarihe tıklayınca pencere açılıyor', yeniden.acik === true);
  k('mevcut tarihler dolu geliyor', yeniden.dolu === '2020-01-01', yeniden.dolu);

  // Hepsini temizle
  const temizle = await page.evaluate(async ()=>{
    document.getElementById('dlClear').click();
    document.getElementById('dlSave').click();
    await new Promise(r=>setTimeout(r,250));
    return { dl: JSON.stringify(projects[0].deadlines), gecikmis: document.querySelectorAll('.pdate.late').length,
             serit: !document.getElementById('p_overdue').hidden, shoot: projects[0].shootDate };
  });
  k('hepsini temizle çalışıyor', !/2020|2026|2030/.test(temizle.dl) && temizle.gecikmis === 0 && temizle.serit === false);
  k('temizle PROJE BAŞLANGICINA dokunmuyor', temizle.shoot === '2026-09-19', temizle.shoot);

  // Adim bitince gecikme kalkmali
  const bitir = await page.evaluate(async ()=>{
    openDeadlines(projects[0].id);
    document.querySelector('[data-dl-step="script"]').value = '2020-01-01';
    document.getElementById('dlSave').click();
    await new Promise(r=>setTimeout(r,200));
    const oncesi = document.querySelectorAll('.pdate.late').length;
    document.querySelector('.pflag').click();
    await new Promise(r=>setTimeout(r,200));
    return { oncesi, sonrasi: document.querySelectorAll('.pdate.late').length };
  });
  k('adım işaretlenince kırmızı kalkıyor', bitir.oncesi === 1 && bitir.sonrasi === 0);

  // Sol sutun kompakt
  const sol = await page.evaluate(()=>{
    const h = document.querySelector('.proj-table tbody .pname-col');
    return { genislik: Math.round(h.getBoundingClientRect().width),
             yukseklik: Math.round(h.getBoundingClientRect().height),
             tarihKutusu: h.querySelectorAll('input[type=date]').length,
             meta: (h.querySelector('.pn-meta')||{}).textContent };
  });
  k('sol sütunda tarih kutusu yok', sol.tarihKutusu === 0);
  k('başlangıç tarihi metin olarak duruyor', /\d/.test(sol.meta||''), (sol.meta||'').trim());
  k('satır kompakt (üç satırlık içerik)', sol.yukseklik <= 100, sol.yukseklik + 'px yükseklik');

  const sig = await page.evaluate(()=>{
    const w = document.querySelector('.proj-table-wrap');
    return { kaydirir: w.scrollWidth > w.clientWidth + 1, sayfa: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  k('tablo ekrana sığıyor', sig.kaydirir === false && sig.sayfa === false, JSON.stringify(sig));

  // Kalicilik
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(1400);
  const kal = await page.evaluate(()=>({ dl: projects[0].deadlines.script, script: projects[0].script }));
  k('yenileyince duruyor', kal.dl === '2020-01-01' && kal.script === true, kal.dl);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
