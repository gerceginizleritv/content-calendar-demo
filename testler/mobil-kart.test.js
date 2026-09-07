// Telefonda proje sayfasi TABLO olarak duruyordu: yedi adim sutunu bir
// telefon ekranina sigmiyor, tablo yana kayiyor, hangi kutunun hangi adim
// oldugu gorunmuyordu. Sayfa ustundeki arac cubuklari da tek satirdaydi:
// arama kutusu eziliyor, "+ Mekan ekle" ekranin disina tasiyordu.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const PROJELER = ()=>{
  projects = [
    { id:'p1', name:'Kuş Sarayları (Kuş Evleri)', type:'outdoor', keywords:'', notes:'',
      address:'Üsküdar (Ayazma, Yenimahalle)', shootDate:'2026-09-05', script:true, filmed:true,
      audio:true, edited:false, approved:false, package:false, published:false,
      cancelled:false, deadlines:{}, createdAt:Date.now() },
    { id:'p2', name:'Kapalıçarşı Cevahir Bedesteni', type:'outdoor', keywords:'', notes:'',
      address:'Beyazıt', shootDate:'', script:false, filmed:false, audio:false, edited:false,
      approved:false, package:false, published:false, cancelled:false, deadlines:{}, createdAt:Date.now() }
  ].map(sanitizeProject);
  saveProjects();
  mekanlar = [mekanTemizle({ id:'m1', name:'Kariye', city:'İstanbul' })];
  saveMekanlar();
};

async function ac(b, w, h){
  const p = await (await b.newContext({ viewport:{width:w,height:h}, isMobile:true, hasTouch:true })).newPage();
  p.hatalar = []; p.on('pageerror', e=> p.hatalar.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**tile.openstreetmap.org**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
                              localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
                         setLanguage('tr'); });
  await p.evaluate(PROJELER);
  return p;
}
// Bir ogenin kendi kapsayicisinin disinda kalip kalmadigi: "ekranin
// disina tasti" sikayetinin olculebilir hali.
const disarida = (p, secici)=> p.evaluate(s=>{
  const e = document.querySelector(s);
  if(!e) return 'yok';
  const k = e.getBoundingClientRect();
  return k.right > window.innerWidth + 1 || k.left < -1 ? Math.round(k.left)+'..'+Math.round(k.right) : '';
}, secici);

(async () => {
  const t = await chromium.launch();

  console.log('[telefon: proje sayfasi kart listesi]');
  {
    const p = await ac(t, 390, 844);
    await p.evaluate(()=>{ setPage('projects'); renderProjects(); });
    await p.waitForTimeout(400);
    const r = await p.evaluate(()=>{
      const sar = document.querySelector('.proj-table-wrap');
      const tr = document.querySelector('.proj-table tbody tr');
      const cip = [...document.querySelectorAll('.proj-table tbody tr:first-child td.pcell')];
      const ilk = cip[0].getBoundingClientRect(), son = cip[cip.length-1].getBoundingClientRect();
      return {
        tabloKayar: sar.scrollWidth > sar.clientWidth + 1,
        sayfaKayar: document.documentElement.scrollWidth > window.innerWidth + 1,
        kartMi: getComputedStyle(tr).display === 'block',
        cipSayisi: cip.length,
        // Cipler saran satirlar halinde: sonuncusu ilkinden ASAGIDA.
        sariyor: son.top > ilk.top + 5,
        hepsiIcerde: cip.every(c=> c.getBoundingClientRect().right <= window.innerWidth + 1),
        etiketGorunur: getComputedStyle(document.querySelector('.pcell-et')).display !== 'none',
        etiketMetni: document.querySelector('.pcell-et').textContent
      };
    });
    bak('proje satiri KART', r.kartMi === true);
    bak('tablo yana KAYMIYOR', r.tabloKayar === false);
    bak('sayfa yana kaymiyor', r.sayfaKayar === false);
    bak('yedi adim da duruyor', r.cipSayisi === 7, String(r.cipSayisi));
    bak('cipler alt satira sariyor', r.sariyor === true);
    bak('hicbir cip ekran disinda degil', r.hepsiIcerde === true);
    bak('her cip adimin adini yaziyor', r.etiketGorunur === true && !!r.etiketMetni, r.etiketMetni);
    // Cipe dokunmak adimi isaretliyor: kartta da islev duruyor.
    const once = await p.evaluate(()=> projectById('p2').script);
    await p.click('.proj-table tbody tr:nth-child(2) td.pcell:first-of-type .pflag');
    await p.waitForTimeout(300);
    bak('cipe dokunmak adimi isaretliyor',
        (await p.evaluate(()=> projectById('p2').script)) === !once);
    bak('js hatasi yok', p.hatalar.length === 0, p.hatalar.join(' | '));
    await p.close();
  }

  console.log('[telefon: arac cubuklari]');
  {
    const p = await ac(t, 390, 844);
    for(const [ad, sayfa, dugme] of [['projeler','projects','#p_openNew'],
                                     ['mekanlar','places','#mk_new'],
                                     ['fikirler','ideas','#fk_new'],
                                     ['scriptler','scripts','#sc_newBtn']]){
      await p.evaluate(s=> setPage(s), sayfa);
      await p.waitForTimeout(300);
      const d = await disarida(p, dugme);
      bak(ad + ': ekleme dugmesi ekranda', d === '' || d === 'yok', d);
    }
    // Mekanlarda ikinci dugme de var: fotografsiz mekan varken cikiyor.
    await p.evaluate(()=> setPage('places'));
    await p.waitForTimeout(300);
    bak('mekanlar: "fotografi olmayanlara bak" da ekranda',
        (await disarida(p, '#mk_fotoHepsi')) === '');
    bak('mekanlar: arama kutusu ezilmedi',
        (await p.$eval('#mk_search', e=> e.getBoundingClientRect().width)) > 200,
        String(Math.round(await p.$eval('#mk_search', e=> e.getBoundingClientRect().width))));
    await p.close();
  }

  console.log('[masaustunde tablo duruyor]');
  {
    const p = await (await t.newContext({ viewport:{width:1280,height:900} })).newPage();
    await p.route('**accounts.google.com**', r=> r.abort());
    await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
    await p.reload({ waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    await p.evaluate(PROJELER);
    await p.evaluate(()=>{ setPage('projects'); renderProjects(); });
    await p.waitForTimeout(300);
    const r = await p.evaluate(()=>({
      satir: getComputedStyle(document.querySelector('.proj-table tbody tr')).display,
      baslik: getComputedStyle(document.querySelector('.proj-table thead')).display,
      etiket: getComputedStyle(document.querySelector('.pcell-et')).display
    }));
    bak('masaustunde satir hala tablo satiri', r.satir === 'table-row', r.satir);
    bak('masaustunde sutun basliklari duruyor', r.baslik !== 'none', r.baslik);
    bak('masaustunde cip etiketi gizli', r.etiket === 'none', r.etiket);
    await p.close();
  }

  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
