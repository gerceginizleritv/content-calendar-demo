// Bitmis ve iptal edilmis projeler aramada CIKMALI ve OKUNABILIR olmali.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  console.log('BİTMİŞ PROJE — ARAMA VE OKUNABİLİRLİK');
  for (const tema of ['light','dark']) {
    const page = await b.newPage({ viewport:{width:1440,height:900}, colorScheme:tema });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    const r = await page.evaluate(async ()=>{
      document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
      setLanguage('tr'); setPage('projects');
      const c=window.onayla; window.onayla=()=>false;
      // Tek pencere: "Yeni proje" de "Projeyi duzenle" de ayni yer.
      const kur = async ad=>{ openProjectNew(ad);
        document.getElementById('pe_type').value='studio';
        document.getElementById('pe_type').dispatchEvent(new Event('change'));
        document.getElementById('pe_save').click();
        await new Promise(r=>setTimeout(r,200)); };
      await kur('Kariye Mozaikleri'); await kur('Balat Sokakları'); await kur('Sirkeci Garı');
      await new Promise(r=>setTimeout(r,300)); window.onayla=c;
      const P = projects.find(p=>p.name==='Kariye Mozaikleri');
      PROJ_STEPS.forEach(x=> P[x]=true);
      projects.find(p=>p.name==='Balat Sokakları').cancelled = true;
      saveProjects(); renderProjects();
      await new Promise(r=>setTimeout(r,200));
      const ara = async q=>{
        const el=document.getElementById('p_search'); el.value=q; el.dispatchEvent(new Event('input'));
        await new Promise(r=>setTimeout(r,200));
        const satir = document.querySelector('.proj-table tbody tr');
        const ad = satir && satir.querySelector('.pname');
        return { adlar:[...document.querySelectorAll('.proj-table tbody .pname')].map(x=>x.textContent.trim()),
                 satirSaydam: satir ? getComputedStyle(satir).opacity : null,
                 adSaydam: ad ? getComputedStyle(ad).opacity : null,
                 adRengi: ad ? getComputedStyle(ad).color : null };
      };
      // Ayrica proje SECIM kutusunda da cikiyor mu (kayit eklerken)
      openModal(null);
      await new Promise(r=>setTimeout(r,200));
      const kutu = document.getElementById('f_projectSearch');
      kutu.value = 'Kariye'; kutu.dispatchEvent(new Event('input'));
      await new Promise(r=>setTimeout(r,200));
      const secenekler = [...document.getElementById('f_project').options].map(o=>o.textContent);
      closeModal();
      await new Promise(r=>setTimeout(r,150));
      return { bitmis: await ara('Kariye'), iptal: await ara('Balat'), normal: await ara('Sirkeci'), secenekler };
    });
    const t = ' ('+tema+')';
    k('Bitmiş proje aramada çıkıyor'+t, r.bitmis.adlar.length===1 && r.bitmis.adlar[0]==='Kariye Mozaikleri', r.bitmis.adlar);
    k('İptal edilen proje aramada çıkıyor'+t, r.iptal.adlar.length===1, r.iptal.adlar);
    k('Normal proje aramada çıkıyor'+t, r.normal.adlar.length===1, r.normal.adlar);
    k('Bitmiş satır SAYDAM DEĞİL'+t, r.bitmis.satirSaydam==='1', r.bitmis.satirSaydam);
    k('Proje adı saydam değil'+t, r.bitmis.adSaydam==='1', r.bitmis.adSaydam);
    k('Kayıt penceresindeki seçimde de çıkıyor'+t, r.secenekler.some(x=>/Kariye/.test(x)), r.secenekler);
    await page.close();
  }
  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
