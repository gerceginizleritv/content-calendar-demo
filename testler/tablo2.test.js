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
  console.log('PROJE TABLOSU');

  // Tur secimi ve adres alani
  const tur = await page.evaluate(async ()=>{
    const sel = document.getElementById('p_type');
    const out = { secenek: [...sel.options].map(o=>o.value), ilk: sel.value,
                  adresAcik: !document.getElementById('p_addressWrap').hidden };
    sel.value = 'studio'; sel.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,80));
    out.studyoAdres = !document.getElementById('p_addressWrap').hidden;
    sel.value = 'outdoor'; sel.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,80));
    out.disCekimAdres = !document.getElementById('p_addressWrap').hidden;
    return out;
  });
  k('tür listesi geldi', tur.secenek.length === 7, tur.secenek.join(','));
  k('dış çekimde adres alanı açık', tur.disCekimAdres === true);
  k('stüdyoda adres alanı kapalı', tur.studyoAdres === false);

  // Adressiz saha isi: uyariyor
  const uyar = await page.evaluate(async ()=>{
    const c = window.onayla; window.__soruldu=false; window.onayla = ()=>{ window.__soruldu=true; return false; };
    document.getElementById('p_name').value = 'NESTLE - UGC';
    document.getElementById('p_add').click();
    await new Promise(r=>setTimeout(r,150));
    window.onayla = c;
    return { soruldu: window.__soruldu, adet: projects.length };
  });
  k('saha işinde adres sorulup duruluyor', uyar.soruldu === true && uyar.adet === 0);

  // Adresli olustur
  const olus = await page.evaluate(async ()=>{
    document.getElementById('p_address').value = 'Yedikule Hisarı, Fatih, İstanbul';
    document.getElementById('p_shoot').value = '2026-09-06';
    document.getElementById('p_add').click();
    await new Promise(r=>setTimeout(r,200));
    return { adet: projects.length, tur: projects[0].type, adres: projects[0].address,
             satir: document.querySelectorAll('.proj-table tbody tr').length,
             sutun: document.querySelectorAll('.proj-table thead th').length,
             basliklar: [...document.querySelectorAll('.proj-table thead th')].map(x=>x.textContent.trim()),
             harita: document.querySelector('.pmap') ? document.querySelector('.pmap').href : null };
  });
  k('proje oluştu', olus.adet === 1 && olus.satir === 1, olus.tur + ' · ' + olus.adres);
  k('sütunlar: proje + 7 adım', olus.sutun === 8, olus.basliklar.join(' | '));
  k('harita bağlantısı adresi taşıyor', /maps\/search/.test(olus.harita||'') && /Yedikule/.test(decodeURIComponent(olus.harita||'')), (olus.harita||'').slice(0,60));

  // Teslim tarihi: gecmis tarih girince uyari
  const dl = await page.evaluate(async ()=>{
    openDeadlines(projects[0].id);
    document.querySelector('[data-dl-step="script"]').value = '2020-01-01';
    document.getElementById('dlSave').click();
    await new Promise(r=>setTimeout(r,250));
    return { kayitli: projects[0].deadlines.script,
             gec: !!document.querySelector('.pdate.late'),
             serit: !document.getElementById('p_overdue').hidden,
             metin: document.getElementById('p_overdue').textContent.slice(0,60) };
  });
  k('teslim tarihi kaydedildi', dl.kayitli === '2020-01-01', dl.kayitli);
  k('geçmiş tarih hücrede kırmızı', dl.gec === true);
  k('üstte uyarı şeridi çıktı', dl.serit === true, dl.metin);

  // Adim isaretlenince uyari kalkmali
  const bitir = await page.evaluate(async ()=>{
    document.querySelector('.pflag').click();
    await new Promise(r=>setTimeout(r,200));
    return { script: projects[0].script, gec: !!document.querySelector('.pdate.late'),
             serit: !document.getElementById('p_overdue').hidden };
  });
  k('adım bitince gecikme uyarısı kalkıyor', bitir.script === true && bitir.gec === false && bitir.serit === false);

  // Gelecek tarih uyari vermemeli
  const ileri = await page.evaluate(async ()=>{
    openDeadlines(projects[0].id);
    document.querySelector('[data-dl-step="audio"]').value = '2030-01-01';
    document.getElementById('dlSave').click();
    await new Promise(r=>setTimeout(r,250));
    return { gec: !!document.querySelector('.pdate.late'), serit: !document.getElementById('p_overdue').hidden };
  });
  k('gelecek tarih uyarı vermiyor', ileri.gec === false && ileri.serit === false);

  // Proje adina tiklayinca duzenleme
  const duz = await page.evaluate(async ()=>{
    document.querySelector('.pname').click();
    await new Promise(r=>setTimeout(r,150));
    const acik = document.getElementById('projectEditOverlay').classList.contains('open');
    document.getElementById('pe_name').value = 'NESTLE — UGC 2. Faz';
    document.getElementById('pe_save').click();
    await new Promise(r=>setTimeout(r,200));
    return { acik, ad: projects[0].name, kapandi: !document.getElementById('projectEditOverlay').classList.contains('open') };
  });
  k('proje adına tıklayınca düzenleme açılıyor', duz.acik === true);
  k('ad değişikliği kaydedildi', duz.ad === 'NESTLE — UGC 2. Faz', duz.ad);
  k('pencere kapandı', duz.kapandi === true);

  // Kalicilik
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(1400);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  const kal = await page.evaluate(()=>({ adet: projects.length, adres: projects[0].address,
    dl: projects[0].deadlines.script, tur: projects[0].type, script: projects[0].script }));
  k('yenileyince her şey duruyor', kal.adet===1 && kal.adres && kal.dl==='2020-01-01' && kal.tur==='outdoor' && kal.script===true,
     JSON.stringify(kal));

  // Bilgisayarda yana kaydirma olmamali
  const sig = await page.evaluate(()=>{
    const w = document.querySelector('.proj-table-wrap');
    return { kaydirir: w.scrollWidth > w.clientWidth + 1, sayfa: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  k('tablo ekrana sığıyor (yana kaydırma yok)', sig.kaydirir === false && sig.sayfa === false, JSON.stringify(sig));

  // Baslangic tarihi proje adinin altinda
  const bas2 = await page.evaluate(()=>{
    const hucre = document.querySelector('.proj-table tbody .pname-col');
    const meta = hucre.querySelector('.pn-meta');
    return { metin: meta ? meta.textContent.trim() : null };
  });
  k('başlangıç tarihi metin olarak adın altında', /\d/.test(bas2.metin||''), bas2.metin);

  // Silme artik duzenleme penceresinde
  const sil = await page.evaluate(()=>({
    satirda: !!document.querySelector('.proj-table [data-proj-del]'),
    pencerede: !!document.getElementById('pe_delete')
  }));
  k('sil düğmesi satırdan kalktı', sil.satirda === false);
  k('sil düğmesi düzenleme penceresinde', sil.pencerede === true);

  // Sabit sutun
  const sabit = await page.evaluate(()=>{
    const w = document.querySelector('.proj-table-wrap');
    const c = document.querySelector('.pname-col');
    const once = Math.round(c.getBoundingClientRect().left);
    w.scrollLeft = 400;
    return { once, sonra: Math.round(c.getBoundingClientRect().left), kaydirir: w.scrollWidth > w.clientWidth };
  });
  k('sol sütun kaydırırken sabit', Math.abs(sabit.once - sabit.sonra) < 2, sabit.once+' → '+sabit.sonra);

  // Silme gercekten calisiyor mu
  const silme = await page.evaluate(async ()=>{
    const c = window.onayla; window.onayla = ()=>true;
    document.querySelector('.pname').click();
    await new Promise(r=>setTimeout(r,150));
    document.getElementById('pe_delete').click();
    await new Promise(r=>setTimeout(r,250));
    window.onayla = c;
    return { adet: projects.length, satir: document.querySelectorAll('.proj-table tbody tr').length,
             depo: JSON.parse(localStorage.getItem('demo_projects')||'[]').length };
  });
  k('proje silinebiliyor', silme.adet === 0 && silme.depo === 0, JSON.stringify(silme));

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
