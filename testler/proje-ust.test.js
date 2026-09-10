// Projeler sayfasinin ust bolumu: arama ile olusturma birbirine
// karismamali. Olusturma kendi penceresinde.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:900}, colorScheme:'light' });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1600);
  console.log('PROJELER SAYFASI — ÜST BÖLÜM');

  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); setPage('projects'); });
  await page.waitForTimeout(300);

  const r1 = await page.evaluate(()=>{
    const sayfa = document.getElementById('projectsPage');
    const kutular = [...sayfa.querySelectorAll('input[type="text"], input[type="search"]')].map(x=>x.id);
    return { kutular, bosDurum: !!document.getElementById('p_emptyNew'),
             yeniDugme: !!document.getElementById('p_openNew'),
             formSayfada: !!sayfa.querySelector('#p_name') };
  });
  k('Sayfada TEK metin kutusu var (arama)', r1.kutular.length===1 && r1.kutular[0]==='p_search', r1.kutular);
  k('Oluşturma formu sayfadan kalktı', r1.formSayfada===false);
  k('Araç çubuğunda "yeni proje" düğmesi var', r1.yeniDugme===true);
  k('Hiç proje yokken yol gösteren düğme var', r1.bosDurum===true);

  // Boş durumdaki düğme pencereyi açıyor
  await page.click('#p_emptyNew');
  await page.waitForTimeout(250);
  const r2 = await page.evaluate(()=>({
    acik: document.getElementById('projectNewOverlay').classList.contains('open'),
    odak: document.activeElement && document.activeElement.id,
    adres: document.getElementById('p_addressWrap').hidden,
    tur: document.getElementById('p_type').value
  }));
  k('Pencere açılıyor', r2.acik===true);
  k('İmleç ad kutusunda', r2.odak==='p_name', r2.odak);
  k('Saha işinde adres alanı görünüyor', r2.adres===false, r2);

  // Stüdyo seçilince adres gizleniyor
  await page.selectOption('#p_type', 'studio');
  await page.waitForTimeout(150);
  const r3 = await page.evaluate(()=> document.getElementById('p_addressWrap').hidden);
  k('Stüdyo işinde adres gizleniyor', r3===true);

  // Proje oluştur
  await page.evaluate(()=>{ window.onayla = ()=> Promise.resolve(false); });
  await page.fill('#p_name', 'Kariye Mozaikleri');
  await page.click('#p_add');
  await page.waitForTimeout(500);
  const r4 = await page.evaluate(()=>({
    kapandi: !document.getElementById('projectNewOverlay').classList.contains('open'),
    adet: projects.length,
    satir: [...document.querySelectorAll('.proj-table tbody .pname')].map(x=>x.textContent.trim()),
    bosDurum: !!document.getElementById('p_emptyNew')
  }));
  k('Oluşturunca pencere kapanıyor', r4.kapandi===true);
  k('Proje eklendi ve tabloda', r4.adet===1 && r4.satir[0]==='Kariye Mozaikleri', r4);
  k('Boş durum kalktı', r4.bosDurum===false);

  // Pencere temiz açılıyor (önceki ad kalmıyor)
  await page.click('#p_openNew');
  await page.waitForTimeout(250);
  const r5 = await page.evaluate(()=>({ ad: document.getElementById('p_name').value,
                                        adres: document.getElementById('p_address').value,
                                        tarih: document.getElementById('p_shoot').value }));
  k('Pencere boş açılıyor', r5.ad==='' && r5.adres==='' && r5.tarih==='', r5);
  await page.evaluate(()=> closeProjectNew());

  // Arama hâlâ çalışıyor
  await page.fill('#p_search', 'Kariye');
  await page.waitForTimeout(250);
  const r6 = await page.evaluate(()=> [...document.querySelectorAll('.proj-table tbody .pname')].map(x=>x.textContent.trim()));
  k('Arama çalışıyor', r6.length===1 && r6[0]==='Kariye Mozaikleri', r6);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
