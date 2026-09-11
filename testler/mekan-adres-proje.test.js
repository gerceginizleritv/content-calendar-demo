// Saha projesinde "adres girmedin" sorusu ve karttaki "Adres yok" rozeti
// projenin KENDI adres alanina bakiyordu; secili mekanin adresi ya da
// harita baglantisi sayilmiyordu. Mekani secip adresini bir daha yazmak
// istenmiyordu, yazmayinca da soru geliyordu.
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
    // Sorulan her onay kaydediliyor. Adres sorusuna cevap window.adresCevap;
    // diger sorulara (termin) her zaman "hayir".
    window.sorular = []; window.adresCevap = false;
    window.onayla = (g)=>{
      const y = typeof g === 'string' ? g : ((g && g.govde) || '');
      window.sorular.push(y);
      if(/adres/i.test(y)) return Promise.resolve(window.adresCevap);
      return Promise.resolve(false);
    };
    mekanlar = [
      mekanTemizle({ id:'m_kariye', name:'Kariye Müzesi', city:'İstanbul', district:'Fatih',
                     address:'Dervişali, Kariye Cami Sk. No:8' }),
      mekanTemizle({ id:'m_harita', name:'Balat İskelesi', city:'İstanbul',
                     mapsUrl:'https://www.google.com/maps/@41.0312,28.9489,17z' }),
      mekanTemizle({ id:'m_ev', name:'Ev stüdyosu', city:'İstanbul' })
    ];
    saveMekanlar(); projects = []; saveProjects(); setPage('projects');
  });

  // Saha (venue) turunde proje kuruyor; sonucu ve kartin harita dugmesini
  // donduruyor. Soru "hayir"la bitince pencere acik kaliyor; kapatiliyor.
  async function projeKur(ad, mekan, adres){
    await p.click('#p_openNew');
    await p.waitForSelector('#projectEditOverlay.open');
    await p.selectOption('#pe_type', 'venue');
    await p.fill('#pe_name', ad);
    // Adres ONCE yaziliyor: mekan secilince adres alani gizleniyor
    // (bilgi mekan kartindan geliyor), yazilan deger kayitta duruyor.
    await p.fill('#pe_address', adres || '');
    if(mekan) await p.click(`[data-mk-sec="${mekan}"]`);
    await p.waitForTimeout(100);
    await p.evaluate(()=>{ window.sorular = []; });
    await p.click('#pe_save');
    await p.waitForTimeout(450);
    await p.evaluate(()=>{ document.getElementById('projectEditOverlay').classList.remove('open'); });
    return p.evaluate((ad)=>{
      const pr = projects.find(x=> x.name === ad) || null;
      const dugme = pr ? document.querySelector(`[data-proj-edit="${pr.id}"]`) : null;
      const tr = dugme ? dugme.closest('tr') : null;
      const harita = tr ? tr.querySelector('.pn-harita') : null;
      return { var: !!pr, sorular: window.sorular.slice(),
               harita: harita ? { href: harita.getAttribute('href'), title: harita.getAttribute('title') } : null,
               eksik: !!(tr && tr.querySelector('.pn-eksik')) };
    }, ad);
  }
  const adresSoruldu = r => r.sorular.some(s=> /adres/i.test(s));

  console.log('[adresi olan mekan]');
  let r = await projeKur('Kariye — bölüm 1', 'm_kariye', '');
  bak('adres sorusu gelmiyor', !adresSoruldu(r), r.sorular.join(' | '));
  bak('proje olustu', r.var);
  bak('kartta Harita dugmesi var', !!r.harita);
  bak('ipucunda mekanin adi ve adresi',
      !!r.harita && /Kariye/.test(r.harita.title) && /Kariye Cami Sk/.test(r.harita.title), r.harita && r.harita.title);
  bak('baglanti adresi haritada aratiyor',
      !!r.harita && /google\.com\/maps\/search/.test(r.harita.href) && /Kariye Cami Sk/.test(decodeURIComponent(r.harita.href)),
      r.harita && r.harita.href);
  bak('"Adres yok" rozeti yok', !r.eksik);

  console.log('[yalniz harita baglantisi olan mekan]');
  r = await projeKur('Balat sabah', 'm_harita', '');
  bak('adres sorusu gelmiyor', !adresSoruldu(r), r.sorular.join(' | '));
  bak('baglanti mekanin harita baglantisi',
      !!r.harita && r.harita.href === 'https://www.google.com/maps/@41.0312,28.9489,17z', r.harita && r.harita.href);
  bak('ipucunda mekanin adi', !!r.harita && /Balat İskelesi/.test(r.harita.title), r.harita && r.harita.title);

  console.log('[adressiz mekan: yalniz sehir]');
  r = await projeKur('Ev çekimi', 'm_ev', '');
  bak('adres sorusu geliyor', adresSoruldu(r), r.sorular.join(' | '));
  bak('"hayir" denince proje olusmuyor', !r.var);
  await p.evaluate(()=>{ window.adresCevap = true; });
  r = await projeKur('Ev çekimi', 'm_ev', '');
  bak('"yine de olustur" denince olusuyor', r.var);
  bak('kartta "Adres yok" rozeti, harita dugmesi yok', r.eksik && !r.harita);

  console.log('[projenin kendi adresi once gelir]');
  r = await projeKur('Kariye — bölüm 2', 'm_kariye', 'Kendi adresi 5');
  bak('adres sorusu gelmiyor', !adresSoruldu(r));
  bak('ipucunda projenin adresi', !!r.harita && r.harita.title === 'Kendi adresi 5', r.harita && r.harita.title);

  console.log('[mekansiz saha projesi]');
  r = await projeKur('Sokak çekimi', '', '');
  bak('adres sorusu hala geliyor', adresSoruldu(r), r.sorular.join(' | '));

  console.log('[mekan silinince]');
  await p.evaluate(()=>{ mekanSil('m_kariye'); renderProjects(); });
  const sonra = await p.evaluate(()=>{
    const pr = projects.find(x=> x.name === 'Kariye — bölüm 1');
    const tr = document.querySelector(`[data-proj-edit="${pr.id}"]`).closest('tr');
    return { harita: !!tr.querySelector('.pn-harita'), eksik: !!tr.querySelector('.pn-eksik') };
  });
  bak('bag kopunca kart "Adres yok" diyor', !sonra.harita && sonra.eksik, JSON.stringify(sonra));

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
