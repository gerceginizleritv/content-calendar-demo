const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:950} });
  const hatalar=[]; page.on('pageerror', e=>hatalar.push(String(e)));
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_lang','tr'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  const r = await page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setPage('projects');
    const c=window.onayla; window.onayla=()=>false;
    openProjectNew('Tarihsiz proje');
    document.getElementById('pe_type').value='studio';
    document.getElementById('pe_type').dispatchEvent(new Event('change'));
    document.getElementById('pe_shoot').value='';
    document.getElementById('pe_save').click();
    await new Promise(r=>setTimeout(r,300));
    window.onayla=c;
    setLanguage('tr');
    openDeadlines(projects[0].id);
    await new Promise(r=>setTimeout(r,150));
    const st=document.getElementById('dlStart');
    const rc=st.closest('.dl-start').getBoundingClientRect();
    return { metin: st.value, etiket: st.closest('.dl-start').textContent.trim(), gen: Math.round(rc.width),
             tasma: document.querySelector('#deadlineOverlay .modal').scrollWidth >
                    document.querySelector('#deadlineOverlay .modal').clientWidth + 1 };
  });
  k('boş projede tarih kutusu boş geliyor', r.metin === '', JSON.stringify(r.metin));
  k('TR etiket doğru', r.etiket === 'Başlangıç', r.etiket);
  k('başlık satırı taşmıyor', r.tasma === false);
  if(hatalar.length){ hatalar.slice(0,3).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
