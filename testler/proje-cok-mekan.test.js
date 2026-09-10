// Bir projeye birden cok mekan: secim kutusundan her secim bir durak (cip),
// sira oklarla, cikarma carpiyla. placeIds sirali liste, placeId ilk durak;
// ona bakan eski yerler (kart, onay sorusu, bulut satiri) bozulmuyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch({ });
  const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e)));
  await p.route('**tile.openstreetmap.org**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  await p.evaluate(() => { try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'networkidle' });
  await p.evaluate(() => {
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    window.sorular = [];
    window.onayla = (g)=>{
      const y = typeof g === 'string' ? g : ((g && g.govde) || '');
      window.sorular.push(y);
      return Promise.resolve(/adres/i.test(y));
    };
    mekanlar = [
      mekanTemizle({ id:'m_han',   name:'Nuruosmaniye Han', city:'İstanbul', district:'Fatih', address:'Nuruosmaniye Cd. 12' }),
      mekanTemizle({ id:'m_carsi', name:'Kapalıçarşı',      city:'İstanbul', district:'Fatih', address:'Çarşı adresi 1' }),
      mekanTemizle({ id:'m_sahil', name:'Sahil',            city:'İstanbul' })
    ];
    saveMekanlar(); projects = []; saveProjects(); setPage('projects');
  });
  const cipler = (onek)=> p.$$eval('#' + onek + '_placeList [data-cip]', e=> e.map(x=> x.dataset.cip).join(','));
  const secili = (onek)=> p.$eval('#' + onek + '_place', e=> e.value);

  console.log('[olusturma: iki durak]');
  await p.click('#p_openNew');
  await p.waitForSelector('#projectNewOverlay.open');
  await p.selectOption('#p_type', 'venue');
  await p.fill('#p_name', 'Belgesel günü');
  await p.selectOption('#p_place', 'm_han');
  await p.waitForTimeout(100);
  bak('ilk secim tek cip', await cipler('p') === 'm_han', await cipler('p'));
  bak('tek cipte sira oku yok', await p.$$eval('#p_placeList [data-cip-yukari]', e=> e.length) === 0);
  await p.selectOption('#p_place', 'm_carsi');
  await p.waitForTimeout(100);
  bak('ikinci secim ikinci cip, ilki duruyor', await cipler('p') === 'm_han,m_carsi', await cipler('p'));
  bak('kutu son secileni gosteriyor', await secili('p') === 'm_carsi');
  bak('bilgi satiri son secilenin adresi', /Çarşı adresi/.test(await p.$eval('#p_placeBilgi', e=> e.textContent)));
  await p.click('#p_placeList [data-cip="m_carsi"] [data-cip-yukari]');
  await p.waitForTimeout(80);
  bak('yukari al sirayi degistiriyor', await cipler('p') === 'm_carsi,m_han', await cipler('p'));
  bak('ilk cipin yukari oku kapali', await p.$eval('#p_placeList [data-cip="m_carsi"] [data-cip-yukari]', e=> e.disabled));
  await p.selectOption('#p_place', 'm_han');
  await p.waitForTimeout(80);
  bak('ayni mekan ikinci kez eklenmiyor', await cipler('p') === 'm_carsi,m_han', await cipler('p'));
  await p.evaluate(()=>{ window.sorular = []; });
  await p.click('#p_add');
  await p.waitForTimeout(400);
  const pr = await p.evaluate(()=>{
    const x = projects[0]; if(!x) return null;
    const satir = projToRow(x, 'u1');
    return { ids: x.placeIds, ilk: x.placeId, satirListe: satir.place_ids, satirIlk: satir.place_id, sorular: window.sorular.slice() };
  });
  bak('proje iki durakla kaydedildi', !!pr && pr.ids.join(',') === 'm_carsi,m_han', pr && pr.ids.join(','));
  bak('placeId ilk durak', !!pr && pr.ilk === 'm_carsi');
  bak('buluta place_ids ve place_id gidiyor', !!pr && pr.satirListe.join(',') === 'm_carsi,m_han' && pr.satirIlk === 'm_carsi');
  bak('adres sorusu gelmedi (ilk duragin adresi var)', !!pr && !pr.sorular.some(s=> /adres/i.test(s)), pr && pr.sorular.join(' | '));
  const kart = await p.evaluate(()=>{
    const tr = document.querySelector('[data-proj-edit]').closest('tr');
    const meta = tr.querySelector('.pn-meta');
    const harita = tr.querySelector('.pn-harita');
    return { metin: meta.textContent, ipucu: meta.getAttribute('title') || '', harita: harita ? harita.getAttribute('title') : '' };
  });
  bak('kartta ilk durak ve +1', /Kapalıçarşı/.test(kart.metin) && /\+1/.test(kart.metin), kart.metin);
  bak('ipucunda iki durak sirayla', /Kapalıçarşı → Nuruosmaniye Han/.test(kart.ipucu), kart.ipucu);
  bak('harita dugmesi ilk duraga', /Kapalıçarşı/.test(kart.harita), kart.harita);
  const sayim = await p.evaluate(()=>({ han: mekanProjeleri('m_han').length, carsi: mekanProjeleri('m_carsi').length,
                                        sahil: mekanProjeleri('m_sahil').length, bekleyen: mekanBekleyenleri('m_han').length }));
  bak('iki mekan da projeyi sayiyor, ucuncusu saymiyor', sayim.han === 1 && sayim.carsi === 1 && sayim.sahil === 0 && sayim.bekleyen === 1, JSON.stringify(sayim));

  console.log('[duzenleme]');
  await p.evaluate(()=> openProjectEdit(projects[0].id));
  await p.waitForSelector('#projectEditOverlay.open');
  await p.waitForTimeout(100);
  bak('duzenlemede iki cip sirayla', await cipler('pe') === 'm_carsi,m_han', await cipler('pe'));
  bak('kutu ilk duragi gosteriyor', await secili('pe') === 'm_carsi', await secili('pe'));
  await p.selectOption('#pe_place', 'm_sahil');
  await p.waitForTimeout(80);
  bak('ucuncu durak eklendi', await cipler('pe') === 'm_carsi,m_han,m_sahil', await cipler('pe'));
  await p.click('#pe_placeList [data-cip="m_carsi"] [data-cip-sil]');
  await p.waitForTimeout(80);
  bak('carpi ile cikarildi', await cipler('pe') === 'm_han,m_sahil', await cipler('pe'));
  await p.click('#pe_placeList [data-cip="m_sahil"] [data-cip-sil]');
  await p.waitForTimeout(80);
  bak('kutudaki secim cikarilinca kutu ilk duraga donuyor', await secili('pe') === 'm_han' && await cipler('pe') === 'm_han', await secili('pe'));
  await p.selectOption('#pe_place', 'm_sahil');
  await p.waitForTimeout(80);
  await p.click('#pe_save');
  await p.waitForTimeout(300);
  const duz = await p.evaluate(()=> ({ ids: projects[0].placeIds.join(','), ilk: projects[0].placeId }));
  bak('kayit: han, sahil', duz.ids === 'm_han,m_sahil' && duz.ilk === 'm_han', JSON.stringify(duz));

  console.log('[mekan silinince]');
  await p.evaluate(()=> mekanSil('m_han'));
  const sil = await p.evaluate(()=> ({ ids: projects[0].placeIds.join(','), ilk: projects[0].placeId }));
  bak('silinen mekan listeden dusuyor, ilk durak kayiyor', sil.ids === 'm_sahil' && sil.ilk === 'm_sahil', JSON.stringify(sil));

  console.log('[eski veri ve bulut satiri]');
  const uyum = await p.evaluate(()=>({
    eski: sanitizeProject({ name:'Eski', placeId:'m_carsi' }),
    satir: projFromRow({ id:'r1', name:'Buluttan', place_id:'m_carsi', place_ids:['m_carsi','m_sahil'] }),
    yalnizTek: projFromRow({ id:'r2', name:'Tek', place_id:'m_sahil', place_ids: [] }),
    ham: projeMekanlari({ placeId:'m_x' }),
    sutunsuz: projSatirSutunsuz(projToRow(projects[0], 'u1')),
    bozuk: sanitizeProject({ name:'Bozuk', placeIds:['iyi_1', 'kötü id', 'iyi_1', 42] }).placeIds
  }));
  bak('eski kayit (yalniz placeId) listeye tasiniyor', uyum.eski.placeIds.join(',') === 'm_carsi' && uyum.eski.placeId === 'm_carsi');
  bak('buluttan gelen liste sirayla', uyum.satir.placeIds.join(',') === 'm_carsi,m_sahil' && uyum.satir.placeId === 'm_carsi', JSON.stringify(uyum.satir.placeIds));
  bak('bulutta liste bos, place_id doluysa tek durak', uyum.yalnizTek.placeIds.join(',') === 'm_sahil');
  bak('temizlenmemis nesnede de calisiyor', uyum.ham.join(',') === 'm_x');
  bak('sql/34 yokken place_ids satira girmiyor', !('place_ids' in uyum.sutunsuz) && 'place_id' in uyum.sutunsuz, Object.keys(uyum.sutunsuz).join(','));
  bak('bozuk ve tekrar eden kimlikler ayiklaniyor', uyum.bozuk.join(',') === 'iyi_1', uyum.bozuk.join(','));

  console.log('[adres sorusu ilk duraga bakiyor]');
  await p.click('#p_openNew');
  await p.waitForSelector('#projectNewOverlay.open');
  await p.selectOption('#p_type', 'venue');
  await p.fill('#p_name', 'Son durak adressiz');
  await p.selectOption('#p_place', 'm_carsi');
  await p.waitForTimeout(80);
  await p.selectOption('#p_place', 'm_sahil');   // son secilen adressiz, ilk duragin adresi var
  await p.waitForTimeout(80);
  await p.evaluate(()=>{ window.sorular = []; });
  await p.click('#p_add');
  await p.waitForTimeout(400);
  const sonDurak = await p.evaluate(()=> ({ var: !!projects.find(x=> x.name === 'Son durak adressiz'), sorular: window.sorular.slice() }));
  bak('ilk duragin adresi varken soru yok', sonDurak.var && !sonDurak.sorular.some(s=> /adres/i.test(s)), sonDurak.sorular.join(' | '));
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  await p.click('#p_openNew');
  await p.waitForSelector('#projectNewOverlay.open');
  await p.selectOption('#p_type', 'venue');
  await p.fill('#p_name', 'Yalniz sahil');
  await p.selectOption('#p_place', 'm_sahil');
  await p.waitForTimeout(80);
  await p.evaluate(()=>{ window.sorular = []; });
  await p.click('#p_add');
  await p.waitForTimeout(400);
  bak('tek durak adressizse soru geliyor', await p.evaluate(()=> window.sorular.some(s=> /adres/i.test(s))));
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });

  console.log('[yeni proje penceresi temiz aciliyor]');
  await p.click('#p_openNew');
  await p.waitForSelector('#projectNewOverlay.open');
  bak('cip yok, kutu bos, liste gizli', await cipler('p') === '' && await secili('p') === '' && await p.$eval('#p_placeList', e=> e.hidden));
  await p.evaluate(()=>{ document.getElementById('p_name').value = 'Program'; document.getElementById('p_type').value = 'studio';
                         document.getElementById('p_place').value = 'm_sahil'; });
  await p.click('#p_add');
  await p.waitForTimeout(300);
  bak('change tetiklenmeden secilen deger de tek durak sayiliyor',
      await p.evaluate(()=> (projects.find(x=> x.name === 'Program') || {}).placeId === 'm_sahil'));

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
