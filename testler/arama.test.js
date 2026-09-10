const { chromium } = require('./araclar');
const fs = require('fs');
(async () => {
  const D = process.argv[2];
  const satirlar = JSON.parse(fs.readFileSync(D+'/satirlar.json','utf8'));
  const veri = { workspaces:[{id:'00000000-0000-0000-0000-000000000001',name:'T'}],
                 locations: satirlar.L, calendar_events: satirlar.E };
  const stub = fs.readFileSync(D+'/sahte-supabase.js','utf8');
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:900} });
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(({veri,stub})=>{ window.__VERI__=veri;
    window.__OTURUM__={user:{id:'00000000-0000-0000-0000-000000000002',email:'t@o.com'}}; window.eval(stub); },{veri,stub});
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.goto('http://127.0.0.1:8099/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1300);
  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('LOKASYON ARAMA');
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open,#pendingOverlay').forEach(o=>o.classList.remove('open'));
    [...document.querySelectorAll('button,a')].find(x=>/Yayın Takvimi/.test(x.textContent)).click(); });
  await page.waitForTimeout(400);

  const bas = await page.evaluate(()=>{ document.getElementById('calAddBtn').click();
    return { adet: document.getElementById('cal_locationId').options.length,
             ipucu: document.getElementById('cal_locationHint').textContent,
             ilk: document.getElementById('cal_locationId').options[0].textContent }; });
  k('43 lokasyon listelendi', bas.adet === 43, bas.adet);
  k('ipucu sayıyı gösteriyor', /43/.test(bas.ipucu), bas.ipucu);
  k('seçeneklerde ilçe/il de yazıyor', /—/.test(bas.ilk), bas.ilk);

  const ara = async (q)=> page.evaluate(async (q)=>{
    const kutu = document.getElementById('cal_locationSearch');
    kutu.value = q; kutu.dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,60));
    const sel = document.getElementById('cal_locationId');
    return { adet: sel.options.length, ipucu: document.getElementById('cal_locationHint').textContent,
             ilk: sel.options.length ? sel.options[0].textContent : null };
  }, q);

  const r1 = await ara('yedikule');
  k('isimle arama — sonuç en üstte', /Yedikule/i.test(r1.ilk||''), r1.adet + ' seçenek, ilk: ' + r1.ilk);
  const r2 = await ara('fatih');
  k('ilçeyle arama', r2.adet > 1 && r2.adet < 43, r2.adet + ' sonuç · ' + r2.ipucu);
  const r3 = await ara('mumya');
  k('konuyla arama (isimde geçmeyen kelime)',
    /Yedikule/i.test(r3.ilk||'') && !/\(seçili\)/.test(r3.ilk||''),
    r3.adet + ' → ' + r3.ilk + ' · ' + r3.ipucu);
  const r4 = await ara('zzzzz');
  k('eşleşme yoksa haber veriyor', /Eşleşen lokasyon yok/.test(r4.ipucu), r4.ipucu);
  const r5 = await ara('YEDİKULE');
  k('büyük/küçük harf farketmiyor', r5.adet >= 1, r5.adet);

  // Mevcut bir kaydi duzenlerken: arama yazinca kaydin lokasyonu listeden dusmemeli
  const koru = await page.evaluate(async ()=>{
    document.getElementById('calOverlay').classList.remove('open');
    document.querySelector('.cal-chip').click();
    const sel = document.getElementById('cal_locationId');
    const secili = sel.value;
    const kutu = document.getElementById('cal_locationSearch');
    kutu.value = 'zzzzz'; kutu.dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,60));
    return { once: secili, sonra: sel.value, listede: [...sel.options].some(o=>o.value===secili) };
  });
  k('düzenlenen kaydın lokasyonu listede kalıyor', koru.listede === true && koru.once === koru.sonra,
    koru.once === koru.sonra ? 'seçim korundu' : koru.once+' → '+koru.sonra);

  // Modal yeniden acilinca arama sifirlanmali
  const sifir = await page.evaluate(()=>{
    document.getElementById('calOverlay').classList.remove('open');
    document.getElementById('calAddBtn').click();
    return { kutu: document.getElementById('cal_locationSearch').value,
             adet: document.getElementById('cal_locationId').options.length };
  });
  k('yeniden açınca arama sıfırlandı', sifir.kutu === '' && sifir.adet === 43, sifir.adet);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,4).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
