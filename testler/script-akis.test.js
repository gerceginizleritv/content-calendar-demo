// "Bu fikirlerden script yaz" akisi. Eskiden butun fikirleri sormadan tek
// bir metne dokuyor ve tek projeye bagliyordu. Artik: fikirler secilebilir,
// projeler coklu, metin bos baslar, secim kayitta durur.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const TOHUM = () => {
  try{ localStorage.setItem('demo_tour_done','1'); }catch(e){}
};
const KUR = () => {
  document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
  const p1 = projeEkle('Kariye Belgeseli','','','other','');
  const p2 = projeEkle('Studyo Serisi','','','studio','');
  fikirEkle('Mozaikler nasil restore edildi', p1.id);
  fikirEkle('Drone izin sureci', p1.id);
  fikirEkle('Tek lamba ile isik', p2.id);
  fikirEkle('Projesiz bir fikir', '');
  renderFikirler(); renderProjects();
  return { p1: p1.id, p2: p2.id };
};

(async () => {
  const t = await chromium.launch({ });
  const p = await (await t.newContext({ viewport:{width:1200,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e)));
  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  await p.evaluate(TOHUM);
  await p.reload({ waitUntil:'networkidle' });
  const kim = await p.evaluate(KUR);

  console.log('[pencere duzeni]');
  await p.evaluate(() => { setPage('scripts'); openScript(null, {}); });
  await p.waitForSelector('#scriptOverlay.open');
  const sira = await p.$$eval('#scriptOverlay .sc-blok-bas > span:first-child', e => e.map(x => x.textContent.trim()));
  bak('alti adim sirayla', sira.length === 6, sira.join(' | '));
  bak('1. adim fikirler', /fikir|idea/i.test(sira[0]), sira[0]);
  bak('2. adim projeler', /proje|project/i.test(sira[1]), sira[1]);
  bak('3. adim baslik', /başlık|title/i.test(sira[2]), sira[2]);
  bak('4. adim Drive', /drive/i.test(sira[3]), sira[3]);
  bak('5. adim AI tarifi', /ai/i.test(sira[4]), sira[4]);
  bak('6. adim script metni', /script/i.test(sira[5]), sira[5]);
  bak('baslik yaninda AI dugmesi', await p.$('.sc-baslik-satir #sc_titleAi') !== null);
  bak('AI tarifi cok satirli kutu',
      (await p.$eval('#sc_aiBrief', e => e.tagName)) === 'TEXTAREA');
  bak('tarif kutusu genis', (await p.$eval('#sc_aiBrief', e => e.getBoundingClientRect().height)) > 50);

  console.log('[fikir listesi]');
  const fs = await p.$$eval('#sc_ideasList [data-fikir-sec]', e => e.length);
  bak('TUM fikirler listeleniyor (projesiz dahil)', fs === 4, fs + ' fikir');
  bak('fikirlerin yaninda proje adi',
      (await p.$$eval('#sc_ideasList .sc-idea-proje', e => e.map(x=>x.textContent))).includes('Kariye Belgeseli'));
  await p.fill('#sc_ideaSearch', 'drone');
  bak('arama suzuyor', (await p.$$eval('#sc_ideasList [data-fikir-sec]', e => e.length)) === 1);
  await p.fill('#sc_ideaSearch', 'Kariye');
  bak('proje adiyla da aranabiliyor', (await p.$$eval('#sc_ideasList [data-fikir-sec]', e => e.length)) === 2);
  await p.fill('#sc_ideaSearch', 'zzzz');
  bak('eslesme yoksa aciklama var', (await p.$eval('#sc_ideasList', e => e.textContent)).trim().length > 5);
  await p.fill('#sc_ideaSearch', '');

  console.log('[coklu secim]');
  await p.click('#sc_ideasList [data-fikir-sec]:nth-of-type(1)');
  await p.evaluate(() => {
    document.querySelectorAll('#sc_ideasList [data-fikir-sec]').forEach((el,i)=>{ if(i<2 && !el.checked) el.click(); });
    document.querySelectorAll('#sc_projList [data-proje-sec]').forEach(el=> el.click());
  });
  bak('iki fikir secili', (await p.evaluate(() => seciliFikirler.size)) === 2);
  bak('iki proje secili', (await p.evaluate(() => seciliProjeler.size)) === 2);
  bak('sayac fikir sayisini yaziyor', /2/.test(await p.$eval('#sc_ideasCount', e => e.textContent)));
  bak('sayac proje sayisini yaziyor', /2/.test(await p.$eval('#sc_projCount', e => e.textContent)));

  console.log('[metin]');
  bak('metin BOS basliyor (dokulmuyor)', (await p.$eval('#sc_text', e => e.value)) === '');
  await p.click('#sc_toText');
  const metin = await p.$eval('#sc_text', e => e.value);
  bak('istenince secilenler metne dokuluyor', metin.split('\n').filter(x=>/^\d+\./.test(x)).length === 2, JSON.stringify(metin.slice(0,60)));
  await p.click('#sc_toText');
  const metin2 = await p.$eval('#sc_text', e => e.value);
  bak('ikinci basista var olan metin SILINMIYOR', metin2.length > metin.length);

  console.log('[kaydetme ve geri acma]');
  await p.fill('#sc_title', 'Iki projeyi birlestiren script');
  await p.click('#sc_save');
  await p.waitForTimeout(300);
  const kayit = await p.evaluate(() => {
    const s = scriptler[scriptler.length - 1];
    return { pid: s.projectId, pids: s.projectIds, fikir: s.ideaIds.length, baslik: s.title, id: s.id };
  });
  bak('iki proje de kaydedildi', kayit.pids.length === 2, JSON.stringify(kayit.pids));
  bak('projectId listenin ilki', kayit.pid === kayit.pids[0]);
  bak('secili fikirler kaydedildi', kayit.fikir === 2, String(kayit.fikir));
  bak('script IKI projede de gorunuyor',
      await p.evaluate((id) => projeScriptleri(id).length, kim.p1) === 1 &&
      await p.evaluate((id) => projeScriptleri(id).length, kim.p2) === 1);
  await p.evaluate((id) => openScript(id), kayit.id);
  await p.waitForSelector('#scriptOverlay.open');
  bak('geri acilinca ayni fikirler isaretli', (await p.evaluate(() => seciliFikirler.size)) === 2);
  bak('geri acilinca ayni projeler isaretli', (await p.evaluate(() => seciliProjeler.size)) === 2);
  await p.click('#sc_cancel');

  console.log('[fikirler sayfasindan gelis]');
  await p.evaluate(() => { setPage('ideas'); fikirFiltresi = ''; fikirArama = ''; renderFikirler(); });
  await p.click('#fk_toScript');
  await p.waitForSelector('#scriptOverlay.open');
  bak('metin yine BOS (eski hali hepsini dokuyordu)', (await p.$eval('#sc_text', e => e.value)) === '');
  bak('gelen fikirler SECILI', (await p.evaluate(() => seciliFikirler.size)) === 4);
  bak('fikirlerin projeleri de secili', (await p.evaluate(() => seciliProjeler.size)) === 2);
  await p.click('#sc_cancel');

  bak('sayfa hatasi yok', hata.length === 0, hata[0]);
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
