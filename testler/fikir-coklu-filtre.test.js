// Fikirler sayfasinda proje filtresi TEK proje seciyordu; "su uc projenin
// fikirlerini bir arada goreyim" demenin yolu yoktu. Acilir liste artik
// "sec" degil "EKLE": secilenler cip olarak birikiyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const TOHUM = ()=>{
  projects = [{id:'pa',name:'Ahrida Sinagogu'},{id:'pb',name:'Anadolu Hisarı'},{id:'pc',name:'Galata Kulesi'}]
    .map(x=> sanitizeProject({ ...x, type:'outdoor' }));
  saveProjects();
  fikirler = [
    fikirTemizle({ id:'f1', text:'Ahrida fikri',  parts:[{id:'a',text:'Ahrida fikri'}],  projectId:'pa' }),
    fikirTemizle({ id:'f2', text:'Hisar fikri',   parts:[{id:'b',text:'Hisar fikri'}],   projectId:'pb' }),
    fikirTemizle({ id:'f3', text:'Galata fikri',  parts:[{id:'c',text:'Galata fikri'}],  projectId:'pc' }),
    fikirTemizle({ id:'f4', text:'Projesiz fikir',parts:[{id:'d',text:'Projesiz fikir'}] })
  ];
  saveFikirler(); setPage('ideas'); renderFikirler();
};

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
                              localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
  await p.evaluate(TOHUM);
  await p.waitForTimeout(300);
  const say = ()=> p.evaluate(()=> fikirleriSuz().length);
  const cipler = ()=> p.$$eval('.fk-cip', e=> e.map(x=> x.textContent.replace('×','').trim()));

  console.log('[baslangic]');
  bak('hepsi gorunuyor', await say() === 4, String(await say()));
  bak('cip seridi gizli', await p.$eval('#fk_secili', e=> e.hidden));
  bak('acilir liste "ekle" diyor',
      /ekle/i.test(await p.$eval('#fk_filter option', e=> e.textContent)),
      await p.$eval('#fk_filter option', e=> e.textContent));

  console.log('[cok proje]');
  await p.selectOption('#fk_filter', 'pa');
  await p.waitForTimeout(250);
  bak('bir proje secilince suzuldu', await say() === 1, String(await say()));
  bak('cip cikti', (await cipler()).join(',') === 'Ahrida Sinagogu', (await cipler()).join(','));
  bak('secilen proje listede kalmadi',
      !(await p.$$eval('#fk_filter option', e=> e.map(x=>x.value))).includes('pa'));
  await p.selectOption('#fk_filter', 'pc');
  await p.waitForTimeout(250);
  bak('IKINCI proje EKLENDI (degistirmedi)', await say() === 2, String(await say()));
  bak('iki cip birden', (await cipler()).length === 2, (await cipler()).join(','));
  bak('acilir liste bosa dondu', await p.$eval('#fk_filter', e=> e.value) === '');

  console.log('[projesiz]');
  await p.selectOption('#fk_filter', '-');
  await p.waitForTimeout(250);
  bak('projesiz de eklenebiliyor', await say() === 3, String(await say()));
  bak('projesiz cipi var', (await cipler()).some(x=> /Projesiz/i.test(x)), (await cipler()).join(','));

  console.log('[cikarma]');
  await p.click('[data-filtre-sil="pa"]');
  await p.waitForTimeout(250);
  bak('cip cikarilinca suzgec daraldi', await say() === 2, String(await say()));
  bak('cikarilan proje listeye geri dondu',
      (await p.$$eval('#fk_filter option', e=> e.map(x=>x.value))).includes('pa'));
  await p.click('#fk_filtreTemizle');
  await p.waitForTimeout(250);
  bak('hepsini goster', await say() === 4, String(await say()));
  bak('cip seridi yine gizli', await p.$eval('#fk_secili', e=> e.hidden));

  console.log('[proje sayfasindan gelince]');
  await p.evaluate(()=>{ setPage('projects'); renderProjects(); });
  await p.waitForTimeout(300);
  await p.click('[data-proj-ideas="pb"]');
  await p.waitForTimeout(350);
  bak('o projeye suzulmus geldi', await say() === 1, String(await say()));
  bak('tek cip', (await cipler()).join(',') === 'Anadolu Hisarı', (await cipler()).join(','));
  bak('fikirler sayfasi acildi', !(await p.$eval('#ideasPage', e=> e.hidden)));

  console.log('[arama ile birlikte]');
  await p.selectOption('#fk_filter', 'pc');
  await p.waitForTimeout(200);
  await p.fill('#fk_search', 'Galata');
  await p.waitForTimeout(300);
  bak('arama ve coklu filtre birlikte calisiyor', await say() === 1, String(await say()));
  await p.fill('#fk_search', '');
  await p.waitForTimeout(200);
  bak('arama temizlenince iki proje kaldi', await say() === 2, String(await say()));

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
