const { chromium } = require('./araclar');
const PORT = process.argv[2] || '8098';
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+e:'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:'+PORT+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('ARAMA KUTUSUNA YENİ PROJE ADI YAZMA');

  const r = await page.evaluate(async ()=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    // Once iki proje kur ki acilir listede secili bir proje olsun
    setPage('projects');
    const kur = (ad)=>{ const c=window.onayla; window.onayla=()=>false;
      document.getElementById('p_type').value='studio';
      document.getElementById('p_type').dispatchEvent(new Event('change'));
      document.getElementById('p_name').value=ad;
      document.getElementById('p_add').click(); window.onayla=c; };
    kur('Zeyrek Camii'); kur('Rumeli Hisarı');
    await new Promise(r=>setTimeout(r,250));
    const onceP = projects.length;

    setPage('calendar');
    document.getElementById('addBtn').click(); await new Promise(r=>setTimeout(r,250));
    const varsayilan = (document.getElementById('f_project').selectedOptions[0]||{}).textContent;

    // Kullanici arama kutusuna OLMAYAN bir proje adi yaziyor
    const kutu = document.getElementById('f_projectSearch');
    kutu.value = 'Ekim Studyo Cekimi';
    kutu.dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,200));
    const sel = document.getElementById('f_project');
    const durum = { secim: sel.value, secimMetni:(sel.selectedOptions[0]||{}).textContent,
                    ipucu: document.getElementById('f_projectHint').textContent,
                    secenekler: [...sel.options].map(o=>o.textContent) };

    // Kaydet
    const p2=n=>String(n).padStart(2,'0'); const bg=new Date();
    document.getElementById('f_title').value='Yeni kayıt';
    document.getElementById('f_date').value=`${bg.getFullYear()}-${p2(bg.getMonth()+1)}-${p2(bg.getDate())}`;
    document.getElementById('f_time').value='18:00';
    document.querySelector('#platformChecks input[value="youtube"]').checked=true;
    const tp=document.querySelector('#typeChecks input[value="video"]'); if(tp) tp.checked=true;
    let soruldu=false; window.sor=(m,v)=>{ soruldu=true; return v || 'ELLE YAZILDI'; };
    const up=[]; const ea=window.uyari; window.uyari=m=>up.push(m);
    document.getElementById('saveBtn').click(); await new Promise(r=>setTimeout(r,350));
    window.uyari=ea;
    const son = events[events.length-1];
    return { varsayilan, durum, soruldu, onceP, sonraP: projects.length,
             adlar: projects.map(p=>p.name), baglananProje: son.content.concept, uyarilar:up };
  });
  console.log('  modal açılınca seçili:', JSON.stringify(r.varsayilan));
  console.log('  arama sonrası:', JSON.stringify(r.durum));
  k('ne olacağını söylüyor (kaydedince oluşacak)', /oluşturul|creates it/i.test(r.durum.ipucu||''), r.durum.ipucu);
  k('adı tekrar SORMUYOR', r.soruldu === false, r.soruldu ? 'sordu' : 'sormadı');
  k('EŞLEŞME YOKKEN "+ yeni proje" seçili olmalı', /yeni|new|oluştur|create/i.test(r.durum.secimMetni||''), r.durum.secimMetni);
  k('YAZILAN ADLA PROJE OLUŞMALI', r.sonraP === r.onceP+1, r.onceP+' → '+r.sonraP+' ('+r.adlar.join(' | ')+')');
  k('kayıt YAZILAN projeye bağlanmalı', /Ekim/.test(r.baglananProje||''), 'bağlandığı proje: '+r.baglananProje);
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
