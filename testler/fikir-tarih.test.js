// Fikirler artik yapilacak da olabiliyor: istegi olan karta bir teslim
// tarihi veriyor, kart o an bir yapilacaga donusuyor ve "bitti" tiki
// kazaniyor. Testin asil derdi ISTEGE BAGLILIK: tarih vermeyen biri
// icin sayfanin eskisinden farkli gorunmemesi lazim. Tik hep gorunse
// her fikir yapilmamis bir is gibi dururdu.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const TOHUM = ()=>{
  const gun = (fark)=>{ const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+fark); return fmtKey(d); };
  fikirler = [
    fikirTemizle({ id:'f1', text:'Tarihsiz fikir', parts:[{id:'a',text:'Tarihsiz fikir'}] }),
    fikirTemizle({ id:'f2', text:'Gecikmis is',    parts:[{id:'b',text:'Gecikmis is'}],    due: gun(-3) }),
    fikirTemizle({ id:'f3', text:'Bugunku is',     parts:[{id:'c',text:'Bugunku is'}],     due: gun(0) }),
    fikirTemizle({ id:'f4', text:'Sonraki is',     parts:[{id:'d',text:'Sonraki is'}],     due: gun(9) }),
    fikirTemizle({ id:'f5', text:'Bitmis is',      parts:[{id:'e',text:'Bitmis is'}],      due: gun(-1), done:true })
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

  // --- Once tarihi olmayan bir duvar: sayfa eskisi gibi mi? ---
  console.log('[tarih kullanmayan icin hicbir sey degismedi]');
  await p.evaluate(()=>{
    fikirler = [ fikirTemizle({ id:'x1', text:'Sade fikir', parts:[{id:'a',text:'Sade fikir'}] }) ];
    saveFikirler(); setPage('ideas'); renderFikirler();
  });
  await p.waitForTimeout(250);
  bak('ajanda cip satiri gizli', await p.$eval('#fk_ajanda', e=> e.hidden));
  bak('bitti tiki yok', (await p.$$('.fk-tik')).length === 0);
  bak('tarih dugmesi var ama sessiz',
      await p.$eval('.fk-due', e=> e.classList.contains('bos')));

  await p.evaluate(TOHUM);
  await p.waitForTimeout(300);
  const say = ()=> p.evaluate(()=> fikirleriSuz().length);
  const metinler = ()=> p.$$eval('.fk-card[data-fk-card] .fk-card-body', e=> e.map(x=> x.textContent.trim()));

  console.log('[kart gorunumu]');
  bak('tarihli kartta tik var', (await p.$$('.fk-tik')).length === 4, String((await p.$$('.fk-tik')).length));
  bak('gecikmis kirmizi',
      await p.$eval('[data-fk-card="f2"] .fk-due', e=> e.classList.contains('gec')));
  bak('bugunku uyarici',
      await p.$eval('[data-fk-card="f3"] .fk-due', e=> e.classList.contains('yakin')));
  bak('sonraki notr',
      await p.$eval('[data-fk-card="f4"] .fk-due', e=> !e.classList.contains('gec') && !e.classList.contains('yakin')));
  bak('bitmis kart soluk',
      await p.$eval('[data-fk-card="f5"]', e=> e.classList.contains('bitti')));
  bak('bitmis kart gecikmis gorunmuyor',
      await p.$eval('[data-fk-card="f5"] .fk-due', e=> !e.classList.contains('gec')));
  bak('tarih kartta yaziyor',
      /\d{2}\.\d{2}\.\d{2}/.test(await p.$eval('[data-fk-card="f2"] .fk-due', e=> e.textContent)),
      await p.$eval('[data-fk-card="f2"] .fk-due', e=> e.textContent.trim()));

  console.log('[ajanda cipleri]');
  bak('cip satiri gorunur', !(await p.$eval('#fk_ajanda', e=> e.hidden)));
  const cip = ()=> p.$$eval('#fk_ajanda .pfilt', e=> e.map(x=> x.textContent.trim()));
  bak('uc cip', (await cip()).length === 3, (await cip()).join(' | '));
  bak('yapilacak sayisi bitmisi saymiyor', /Yapılacaklar\s*3/.test((await cip())[0]), (await cip())[0]);
  bak('gecikmis 1', /Gecikmiş\s*1/.test((await cip())[1]), (await cip())[1]);
  bak('bugun 1', /Bugün\s*1/.test((await cip())[2]), (await cip())[2]);

  console.log('[suzme]');
  await p.click('#fk_ajanda [data-fk-ajanda="yapilacak"]');
  await p.waitForTimeout(250);
  bak('yapilacaklar suzuldu', await say() === 3, String(await say()));
  bak('tarihsiz fikir listede yok', !(await metinler()).some(x=> /Tarihsiz/.test(x)));
  bak('bitmis is listede yok', !(await metinler()).some(x=> /Bitmis/.test(x)));
  bak('sira TARIHTEN geliyor',
      (await metinler()).join('|') === 'Gecikmis is|Bugunku is|Sonraki is', (await metinler()).join('|'));
  await p.click('#fk_ajanda [data-fk-ajanda="gec"]');
  await p.waitForTimeout(250);
  bak('gecikmis suzgeci', await say() === 1 && (await metinler())[0] === 'Gecikmis is', (await metinler()).join('|'));
  await p.click('#fk_ajanda [data-fk-ajanda="gec"]');
  await p.waitForTimeout(250);
  bak('acik cipe yeniden basinca suzgec kalkti', await say() === 5, String(await say()));

  console.log('[son is bitince kapali kapi olmuyor]');
  await p.click('#fk_ajanda [data-fk-ajanda="gec"]');
  await p.waitForTimeout(250);
  await p.click('[data-fk-card="f2"] .fk-tik');
  await p.waitForTimeout(300);
  bak('gecikmis kalmadi', await say() === 0, String(await say()));
  bak('acik cip yine de tiklanabilir',
      await p.$eval('#fk_ajanda [data-fk-ajanda="gec"]', e=> !e.disabled));
  await p.click('#fk_ajanda [data-fk-ajanda="gec"]');
  await p.waitForTimeout(250);
  bak('suzgecten cikilabildi', await say() === 5, String(await say()));
  await p.click('[data-fk-card="f2"] .fk-tik');
  await p.waitForTimeout(300);

  console.log('[tik]');
  await p.click('[data-fk-card="f3"] .fk-tik');
  await p.waitForTimeout(300);
  bak('bitti isaretlendi', await p.$eval('[data-fk-card="f3"]', e=> e.classList.contains('bitti')));
  bak('yapilacak sayisi dustu', /Yapılacaklar\s*2/.test((await cip())[0]), (await cip())[0]);
  await p.click('[data-fk-card="f3"] .fk-tik');
  await p.waitForTimeout(300);
  bak('geri alindi', await p.$eval('[data-fk-card="f3"]', e=> !e.classList.contains('bitti')));

  console.log('[tarih verme ve kaldirma]');
  await p.click('[data-fk-card="f1"] .fk-due');
  await p.waitForTimeout(250);
  bak('yerinde tarih kutusu acildi', (await p.$$('[data-fk-card="f1"] .fk-tarih-in')).length === 1);
  const hedef = await p.evaluate(()=>{ const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+2); return fmtKey(d); });
  await p.fill('[data-fk-card="f1"] .fk-tarih-in', hedef);
  await p.waitForTimeout(400);
  bak('tarih kaydedildi', await p.evaluate(x=> fikirById('f1').due === x, hedef),
      await p.evaluate(()=> fikirById('f1').due));
  bak('tarihli kart tik kazandi', (await p.$$('[data-fk-card="f1"] .fk-tik')).length === 1);

  await p.click('[data-fk-card="f1"] .fk-tik');
  await p.waitForTimeout(250);
  await p.click('[data-fk-card="f1"] .fk-due');
  await p.waitForTimeout(250);
  await p.evaluate(()=>{
    const i = document.querySelector('[data-fk-card="f1"] .fk-tarih-in');
    i.value = ''; i.dispatchEvent(new Event('change', { bubbles:true }));
  });
  await p.waitForTimeout(350);
  bak('bos deger tarihi kaldirdi', await p.evaluate(()=> fikirById('f1').due === ''),
      await p.evaluate(()=> fikirById('f1').due));
  bak('tarih gidince bitti de gitti', await p.evaluate(()=> fikirById('f1').done === false));
  bak('kart yeniden sade', await p.$eval('[data-fk-card="f1"] .fk-due', e=> e.classList.contains('bos')));

  console.log('[kalicilik]');
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1600);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
                         setPage('ideas'); renderFikirler(); });
  await p.waitForTimeout(300);
  bak('tarih yeniden acilista duruyor', await p.evaluate(()=> !!(fikirById('f2') && fikirById('f2').due)),
      await p.evaluate(()=> fikirById('f2') ? fikirById('f2').due : 'yok'));
  bak('bitti hali duruyor', await p.evaluate(()=> !!(fikirById('f5') && fikirById('f5').done)));

  console.log('[proje filtresiyle birlikte]');
  await p.evaluate(()=>{
    projects = [sanitizeProject({ id:'pa', name:'Ahrida Sinagogu', type:'outdoor' })];
    saveProjects();
    fikirGuncelle('f2', { projectIds:['pa'] });
    setPage('ideas'); renderFikirler();
  });
  await p.waitForTimeout(300);
  await p.click('#fk_ajanda [data-fk-ajanda="yapilacak"]');
  await p.waitForTimeout(200);
  await p.selectOption('#fk_filter', 'pa');
  await p.waitForTimeout(300);
  bak('iki suzgec birlikte calisiyor', await say() === 1 && (await metinler())[0] === 'Gecikmis is',
      (await metinler()).join('|'));

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
