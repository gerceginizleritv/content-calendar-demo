const { chromium } = require('./araclar');
(async () => {
  const D = process.argv[2];
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:1000} });
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('templates'); });
  await page.waitForTimeout(300);

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('SABLONLAR — GENEL METIN + ISTISNALAR');

  // 1. Hesaplar
  const hesap = await page.evaluate(async ()=>{
    const ekle = (pf,h)=>{ document.getElementById('acc_platform').value = pf;
      document.getElementById('acc_url').value = h; document.getElementById('acc_add').click(); };
    ekle('instagram','gerceginizleri');
    ekle('youtube','youtube.com/@gerceginizleri');
    ekle('tiktok','@gerceginizleri');
    await new Promise(r=>setTimeout(r,200));
    return { adet: sablon.accounts.length, eller: sablon.accounts.map(a=>a.handle),
             genel: document.getElementById('tplGeneral').value };
  });
  k('üç hesap eklendi', hesap.adet === 3, hesap.eller.join(' | '));
  k('kullanıcı adına @ eklendi', hesap.eller[0] === '@gerceginizleri', hesap.eller[0]);
  k('bağlantı olduğu gibi kaldı', hesap.eller[1] === 'youtube.com/@gerceginizleri', hesap.eller[1]);
  k('hesaplar genel metin kutusuna düştü',
     /Instagram: @gerceginizleri/.test(hesap.genel) && /TikTok/.test(hesap.genel), JSON.stringify(hesap.genel));

  // 2. Genel metin
  const genel = await page.evaluate(async ()=>{
    const ta = document.getElementById('tplGeneral');
    ta.value = 'Beğendiysen kaydet, paylaş.\n\n' + ta.value;
    ta.dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,150));
    return { kayitli: sablon.general, yt: sablonMetni('youtube'), ig: sablonMetni('instagram'),
             fb: sablonMetni('facebook') };
  });
  k('genel metin kaydedildi', /Beğendiysen/.test(genel.kayitli));
  k('genel metin BÜTÜN platformlara gidiyor',
     genel.yt === genel.ig && genel.ig === genel.fb && /Beğendiysen/.test(genel.fb));

  // 3. YouTube ozellestir
  const ozel = await page.evaluate(async ()=>{
    document.getElementById('ovr_platform').value = 'youtube';
    document.getElementById('ovr_add').click();
    await new Promise(r=>setTimeout(r,150));
    const acikti = document.getElementById('tplOvrDraft').hidden === false;
    const onDolu = document.getElementById('tplOvrText').value;
    document.getElementById('tplOvrText').value = 'SADECE YOUTUBE METNİ\nInstagram: @gerceginizleri';
    document.getElementById('tplOvrSave').click();
    await new Promise(r=>setTimeout(r,200));
    return { acikti, onDolu,
             kapandi: document.getElementById('tplOvrDraft').hidden === true,
             kart: document.querySelectorAll('#tplOverrides .tpl-card').length,
             yt: sablonMetni('youtube'), ig: sablonMetni('instagram'), fb: sablonMetni('facebook') };
  });
  k('özelleştirme kutusu açıldı', ozel.acikti === true);
  k('kutu hesaplarla dolu geldi', /Instagram: @gerceginizleri/.test(ozel.onDolu), JSON.stringify(ozel.onDolu.slice(0,60)));
  k('kaydedince kart oluştu ve kutu kapandı', ozel.kapandi === true && ozel.kart === 1);
  k('YouTube sadece özel metni alıyor', /SADECE YOUTUBE/.test(ozel.yt) && !/Beğendiysen/.test(ozel.yt), JSON.stringify(ozel.yt.slice(0,40)));
  k('diğerleri genel metni almaya devam ediyor',
     /Beğendiysen/.test(ozel.ig) && /Beğendiysen/.test(ozel.fb) && ozel.ig === ozel.fb);

  // Ozellestirilmis platform secici listesinden dusmeli
  k('özelleştirilen platform seçicide kalmıyor', await page.evaluate(()=>
    ![...document.getElementById('ovr_platform').options].some(o=>o.value === 'youtube')));

  // 4. Modalde canli
  const canli = await page.evaluate(async ()=>{
    setPage('calendar');
    const pr = window.sor; window.sor = ()=> 'Test Projesi';
    openModal(null, '2026-09-20');
    const cap = document.getElementById('f_caption');
    cap.value = 'Bu posta özel metnim.';
    const yt = document.querySelector('#platformChecks input[value="youtube"]');
    yt.checked = true; yt.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,150));
    const ytHali = cap.value;
    yt.checked = false; yt.dispatchEvent(new Event('change'));
    const fb = document.querySelector('#platformChecks input[value="facebook"]');
    fb.checked = true; fb.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,150));
    const fbHali = cap.value;
    // Ikisi birden: metinler farkli, kutuya dokunulmamali, not cikmali
    yt.checked = true; yt.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,150));
    const ikisi = { metin: cap.value, not: !document.getElementById('captionTplNote').hidden };
    window.sor = pr;
    return { ytHali, fbHali, ikisi };
  });
  k('YouTube seçince özel metin düştü', /SADECE YOUTUBE/.test(canli.ytHali) && canli.ytHali.indexOf('Bu posta özel metnim.') === 0, JSON.stringify(canli.ytHali.slice(0,45)));
  k('Facebook seçince genel metin düştü', /Beğendiysen/.test(canli.fbHali) && !/SADECE YOUTUBE/.test(canli.fbHali));
  k('iki farklı metinli platform seçilince uyarı çıkıyor', canli.ikisi.not === true);

  // Kaydetme: her kayit kendi metnini almali
  const kaydet = await page.evaluate(async ()=>{
    const pr = window.sor; window.sor = ()=> 'Test Projesi';
    document.getElementById('f_title').value = 'İki platform testi';
    [...document.querySelectorAll('#typeChecks input')].forEach(x=>x.checked=false);
    document.querySelector('#typeChecks input[value="video"]').checked = true;
    document.getElementById('saveBtn').click();
    await new Promise(r=>setTimeout(r,350));
    window.sor = pr;
    const yt = events.find(e=>e.title==='İki platform testi' && e.platform==='youtube');
    const fb = events.find(e=>e.title==='İki platform testi' && e.platform==='facebook');
    return { yt: yt && yt.content.caption, fb: fb && fb.content.caption };
  });
  k('YouTube kaydı özel metni aldı', /SADECE YOUTUBE/.test(kaydet.yt) && !/Beğendiysen/.test(kaydet.yt));
  k('Facebook kaydı genel metni aldı', /Beğendiysen/.test(kaydet.fb) && !/SADECE YOUTUBE/.test(kaydet.fb));
  k('ikisinde de kendi metni üstte', (kaydet.yt||'').indexOf('Bu posta özel metnim.') === 0 && (kaydet.fb||'').indexOf('Bu posta özel metnim.') === 0);

  // Genel metne don
  const geriDon = await page.evaluate(async ()=>{
    setPage('templates');
    const c = window.onayla; window.onayla = ()=>true;
    document.querySelector('[data-ovr-sil]').click();
    await new Promise(r=>setTimeout(r,200));
    window.onayla = c;
    return { kart: document.querySelectorAll('#tplOverrides .tpl-card').length, yt: sablonMetni('youtube') };
  });
  k('genel metne dönüş çalışıyor', geriDon.kart === 0 && /Beğendiysen/.test(geriDon.yt));

  // Kalicilik
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(1400);
  const kal = await page.evaluate(()=>({ hesap: sablon.accounts.length, genel: sablon.general }));
  k('yenileyince duruyor', kal.hesap === 3 && /Beğendiysen/.test(kal.genel), kal.hesap);

  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('templates'); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: D+'/sablon3.png' });
  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,5).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
