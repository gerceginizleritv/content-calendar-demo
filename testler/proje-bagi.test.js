const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  console.log('KAYIT–PROJE BAĞI YÜKLEMEDE KORUNUYOR MU');

  // Gercek senaryo: Tekfur Sarayi projesine bagli bir kayit
  await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    projects = [
      { id:'loc_1787569962484_26', name:'Tekfur Sarayı', type:'other', keywords:'', notes:'', address:'',
        shootDate:'', script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
        deadlines:{}, createdAt:Date.now() },
      { id:'loc_1787569962484_01', name:'Ahrida Sinagogu', type:'other', keywords:'', notes:'', address:'',
        shootDate:'', script:false, shot:false, edited:false, published:false, permit:false, cancelled:false,
        deadlines:{}, createdAt:Date.now() }
    ];
    saveProjects();
    events = [{ id:'11111111-1111-4111-8111-111111111111', type:'video', platform:'youtube',
      title:'Tekfur Sarayı — bölüm 1', date:'2026-09-10', time:'20:00', uploaded:false, workspaceId:null,
      content:{ projectId:'loc_1787569962484_26', concept:'Tekfur Sarayı', caption:'', hashtags:'',
                videoTitle:'', shortTitle:'', thumbPrompt:'', timezone:'', slidePrompts:[] } }];
    save();
  });
  await page.waitForTimeout(300);

  // 1) YEREL AYNA: sayfa yenilenince bag duruyor mu
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  const y = await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    const e = events.find(x=>x.title.indexOf('Tekfur') === 0);
    return { pid: e ? (e.content||{}).projectId : '(kayıt yok)',
             sayi: projeIcinKayitlar('loc_1787569962484_26').length };
  });
  k('yenilemeden sonra kaydın projesi duruyor', y.pid === 'loc_1787569962484_26', String(y.pid));
  k('Projeler sayfasında “0 kayıt” yazmıyor', y.sayi === 1, y.sayi+' kayıt');

  // 2) BULUTTAN GELEN SATIR: project_id sutunu content'e geri yaziliyor mu
  const bulut = await page.evaluate(()=>{
    const satir = { id:'22222222-2222-4222-8222-222222222222', type:'video', platform:'instagram',
      title:'Tekfur Sarayı — bölüm 2', post_date:'2026-09-11', post_time:'20:00:00', uploaded:false,
      workspace_id:null, project_id:'loc_1787569962484_26',
      // Lokasyon uygulamasindan gelen satirda content icinde projectId YOK
      content:{ caption:'', concept:'Tekfur Sarayı' } };
    const temiz = sanitizeEvents([fromRow(satir)])[0];
    return { pid: (temiz.content||{}).projectId };
  });
  k('bulut satırındaki project_id kayda geçiyor', bulut.pid === 'loc_1787569962484_26', String(bulut.pid));

  // 3) Kayit formunu acinca DOGRU proje secili geliyor mu
  const form = await page.evaluate(async ()=>{
    const e = events.find(x=>x.title.indexOf('Tekfur') === 0);
    openModal(e);
    await new Promise(r=>setTimeout(r,250));
    const v = document.getElementById('f_project').value;
    document.getElementById('editOverlay').classList.remove('open');
    return v;
  });
  k('form doğru projeyle açılıyor (ilk sıradaki değil)', form === 'loc_1787569962484_26', String(form));

  // 3b) ASIL SENARYO: content.concept bos. Ad eslesmesiyle kurtarma
  //     calismiyor, tek dayanak projectId'nin kendisi.
  await page.evaluate(()=>{
    events = [{ id:'44444444-4444-4444-8444-444444444444', type:'video', platform:'youtube',
      title:'Tekfur Sarayı — bölüm 3', date:'2026-09-13', time:'20:00', uploaded:false, workspaceId:null,
      content:{ projectId:'loc_1787569962484_26', concept:'', caption:'', hashtags:'',
                videoTitle:'', shortTitle:'', thumbPrompt:'', timezone:'', slidePrompts:[] } }];
    save();
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  const bos = await page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    const e = events[0];
    openModal(e);
    await new Promise(r=>setTimeout(r,250));
    const v = document.getElementById('f_project').value;
    document.getElementById('editOverlay').classList.remove('open');
    return { pid:(e.content||{}).projectId, secili:v,
             sayi: projeIcinKayitlar('loc_1787569962484_26').length };
  });
  k('proje ADI boşken de bağ duruyor', bos.pid === 'loc_1787569962484_26', String(bos.pid));
  k('proje adı boşken form doğru projeyi seçiyor', bos.secili === 'loc_1787569962484_26', String(bos.secili));
  k('proje adı boşken sayaç doğru', bos.sayi === 1, bos.sayi+' kayıt');

  // 4) Bozuk deger sizmiyor
  const kotu = await page.evaluate(()=> sanitizeEvents([{ id:'33333333-3333-4333-8333-333333333333',
      type:'video', platform:'youtube', date:'2026-09-12', time:'10:00',
      content:{ projectId:{evil:1} } }])[0].content.projectId);
  k('geçersiz projectId boşa düşüyor', kotu === '', JSON.stringify(kotu));

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
