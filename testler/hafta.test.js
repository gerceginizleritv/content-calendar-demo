const { chromium } = require('./araclar');
const fs = require('fs');
(async () => {
  const D = process.argv[2];
  const satirlar = JSON.parse(fs.readFileSync(D + '/satirlar.json', 'utf8'));
  const veri = { workspaces:[{id:'00000000-0000-0000-0000-000000000001',name:'Test'}],
                 locations: satirlar.L, calendar_events: satirlar.E };
  const stub = fs.readFileSync(D + '/sahte-supabase.js', 'utf8');
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1200,height:900} });
  const hatalar = [];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(({veri,stub})=>{ window.__VERI__=veri;
    window.__OTURUM__={user:{id:'00000000-0000-0000-0000-000000000002',email:'t@o.com'}};
    window.eval(stub); }, {veri,stub});
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.goto('http://127.0.0.1:8099/index.html', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1300);

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('LOKASYON UYGULAMASI — HAFTA GORUNUMU');

  // Acilistaki "Bekleyenler" penceresi tiklamalari engelliyor; testin konusu o degil.
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open, #pendingOverlay').forEach(o=>o.classList.remove('open'));
    [...document.querySelectorAll('button,a')].find(x=>/Yayın Takvimi/.test(x.textContent)).click(); });
  await page.waitForTimeout(500);

  const bas = await page.evaluate(()=>({
    dugmeler: [...document.querySelectorAll('.cal-toggle-btn')].map(x=>x.textContent.trim()),
    hucre: document.querySelectorAll('#calGridView .cal-day').length,
    aralik: document.getElementById('calNavRange').textContent
  }));
  k('üç görünüm düğmesi var', bas.dugmeler.length === 3, bas.dugmeler.join(' | '));
  k('başlangıçta 21 gün', bas.hucre === 21, bas.hucre);

  await page.evaluate(()=>document.getElementById('calBtnWeek').click());
  await page.waitForTimeout(400);
  const hafta = await page.evaluate(()=>({
    hucre: document.querySelectorAll('#calGridView .cal-day').length,
    aktif: document.getElementById('calBtnWeek').classList.contains('active'),
    izgaraGorunur: getComputedStyle(document.getElementById('calGridView')).display !== 'none',
    tabloGizli: getComputedStyle(document.getElementById('calTableView')).display === 'none',
    aralik: document.getElementById('calNavRange').textContent,
    genisMod: document.getElementById('calGridView').classList.contains('cal-week-mode')
  }));
  k('hafta modunda 7 gün', hafta.hucre === 7, hafta.hucre);
  k('düğme aktif', hafta.aktif === true);
  k('ızgara görünür, tablo gizli', hafta.izgaraGorunur && hafta.tabloGizli);
  k('hücreler genişledi', hafta.genisMod === true);
  k('aralık 7 günlük yazıyor', hafta.aralik !== bas.aralik, bas.aralik + '  →  ' + hafta.aralik);

  await page.evaluate(()=>document.getElementById('calBtnTable').click());
  await page.waitForTimeout(400);
  const tablo = await page.evaluate(()=>({
    satir: document.querySelectorAll('#calTableView tbody tr').length,
    izgaraGizli: getComputedStyle(document.getElementById('calGridView')).display === 'none',
    tabloGorunur: getComputedStyle(document.getElementById('calTableView')).display !== 'none',
    aralik: document.getElementById('calNavRange').textContent
  }));
  k('tabloda 14 satır', tablo.satir === 14, tablo.satir);
  k('ızgara gerçekten gizlendi', tablo.izgaraGizli && tablo.tabloGorunur);
  k('aralık 14 güne göre', /\d/.test(tablo.aralik), tablo.aralik);

  // Secim hatirlaniyor mu
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1300);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open, #pendingOverlay').forEach(o=>o.classList.remove('open'));
    [...document.querySelectorAll('button,a')].find(x=>/Yayın Takvimi/.test(x.textContent)).click(); });
  await page.waitForTimeout(300);
  const hatirla = await page.evaluate(()=>({
    aktif: [...document.querySelectorAll('.cal-toggle-btn')].find(x=>x.classList.contains('active')).textContent.trim(),
    tabloGorunur: getComputedStyle(document.getElementById('calTableView')).display !== 'none'
  }));
  k('yenileyince tablo görünümü hatırlandı', hatirla.tabloGorunur === true, hatirla.aktif);

  // Hafta modunda ileri/geri
  await page.evaluate(()=>document.getElementById('calBtnWeek').click()); await page.waitForTimeout(300);
  const gez = await page.evaluate(()=>{
    const al=()=>document.querySelector('#calGridView .cal-day-num').textContent;
    const o=al(); document.getElementById('calNavNext').click(); const s=al();
    document.getElementById('calNavPrev').click(); const g=al();
    return {o,s,g};
  });
  k('hafta modunda ileri gidiyor', gez.o !== gez.s, gez.o+' → '+gez.s);
  k('geri dönünce aynı yer', gez.o === gez.g);

  if(hatalar.length){ console.log('SAYFA HATALARI:'); hatalar.slice(0,4).forEach(h=>console.log('  '+h)); hata+=hatalar.length; }
  console.log(hata ? '\n'+hata+' SORUN' : '\nHepsi geçti.');
  await b.close(); process.exit(hata?1:0);
})();
