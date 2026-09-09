// SCRIPT PENCERESINDE UZUN LISTE.
//
// Fikir listesi telefonda 118 piksele kapaniyor ve kendi icinde kayiyordu.
// Yani "asagiyi itmiyordu" — ama yuz fikre UC SATIRLIK bir pencereden
// bakmak, ustelik o pencere sayfanin kendi kaydirmasinin icindeyken,
// kullanilabilir bir sey degildi: telefonda hangisinin kaydigi karisiyor.
//
// Cozum: liste uzunsa blok KAPALI aciliyor, basliginda "3 secili" yaziyor;
// "Sec" deyince yarim ekran boyunda acilyor. Kisa listede hicbir sey
// degismiyor — dort fikri gormek icin dugmeye basmak gereksiz bir adim.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

async function ac(t, w){
  const p = await (await t.newContext({ viewport:{ width:w, height:844 },
                                        isMobile:w<700, hasTouch:w<700 })).newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });
  return p;
}
const kur = (p, n)=> p.evaluate((n)=>{
  fikirler = [];
  for(let i = 1; i <= n; i++) fikirler.push(fikirTemizle({ id:'f'+i, text:'Fikir ' + i }));
  saveFikirler(); setPage('scripts'); openScript(null, {});
}, n);
const durum = p => p.evaluate(()=>{
  const liste = document.getElementById('sc_ideasList');
  const blok = liste.closest('.sc-blok');
  const dugme = document.getElementById('sc_ideasToggle');
  return { kapali: blok.classList.contains('sc-kapali'),
           listeH: Math.round(liste.getBoundingClientRect().height),
           listeKayar: liste.scrollHeight > liste.clientHeight + 2,
           dugme: dugme.textContent.trim(),
           aria: dugme.getAttribute('aria-expanded'),
           sayac: document.getElementById('sc_ideasCount').textContent.trim(),
           aramaGorunur: !!document.getElementById('sc_ideaSearch').offsetParent,
           ekleGorunur: !!document.getElementById('sc_newIdea').offsetParent };
});

(async () => {
  const t = await chromium.launch();
  const p = await ac(t, 390);
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));

  console.log('[kısa liste: hiçbir şey değişmiyor]');
  await kur(p, 4);
  await p.waitForTimeout(600);
  let d = await durum(p);
  bak('dört fikirde blok AÇIK açılıyor', !d.kapali, JSON.stringify(d));
  bak('liste görünür', d.listeH > 20, d.listeH + 'px');
  bak('arama kutusu duruyor', d.aramaGorunur);

  console.log('[uzun liste: kapalı açılıyor]');
  await kur(p, 100);
  await p.waitForTimeout(600);
  d = await durum(p);
  bak('yüz fikirde blok KAPALI açılıyor', d.kapali, JSON.stringify(d));
  bak('liste yer kaplamıyor', d.listeH === 0, d.listeH + 'px');
  bak('düğme "Seç" diyor', /Seç/.test(d.dugme), d.dugme);
  bak('aria-expanded false', d.aria === 'false', d.aria);
  // Kapaliyken ikinci adim ekranda: itilme sorunu bu.
  const ikinci = await p.evaluate(()=>{
    // DIKKAT: .sc-blok sinifi CSV alma penceresinde de kullaniliyor.
    // Sorgu script penceresiyle sinirlanmazsa gizli bir blok donuyor.
    const b = document.querySelectorAll('#scriptOverlay .sc-blok')[1].getBoundingClientRect();
    return { top: Math.round(b.top), ekran: window.innerHeight };
  });
  bak('ikinci adım ekranda kalıyor', ikinci.top > 0 && ikinci.top < ikinci.ekran,
      ikinci.top + ' / ' + ikinci.ekran);

  console.log('[açınca yarım ekran boyunda]');
  await p.evaluate(()=> document.getElementById('sc_ideasToggle').click());
  await p.waitForTimeout(400);
  d = await durum(p);
  bak('açıldı', !d.kapali);
  bak('liste 118px değil, çok daha büyük', d.listeH > 250, d.listeH + 'px');
  bak('liste kendi içinde kayıyor', d.listeKayar);
  bak('düğme "Tamam" diyor', /Tamam/.test(d.dugme), d.dugme);
  bak('arama ve ekleme kutusu geri geldi', d.aramaGorunur && d.ekleGorunur,
      JSON.stringify({ a:d.aramaGorunur, e:d.ekleGorunur }));

  console.log('[seçim kapalıyken de görünüyor]');
  await p.evaluate(()=>{ document.querySelector('#sc_ideasList input[type=checkbox]').click(); });
  await p.waitForTimeout(250);
  await p.evaluate(()=> document.getElementById('sc_ideasToggle').click());
  await p.waitForTimeout(350);
  d = await durum(p);
  bak('kapandı', d.kapali);
  bak('kaç fikir seçildiği başlıkta yazıyor', /1/.test(d.sayac), d.sayac);
  // Secim KAYBOLMUYOR: kapatmak bir gorunum isi.
  bak('seçim korunuyor', await p.evaluate(()=> seciliFikirler.size) === 1);

  console.log('[dil değişince]');
  await p.evaluate(()=> setLanguage('en'));
  await p.waitForTimeout(500);
  d = await durum(p);
  bak('düğme İngilizce', /Choose/.test(d.dugme), d.dugme);
  bak('hâl korundu (hâlâ kapalı)', d.kapali);
  await p.evaluate(()=> setLanguage('tr'));
  await p.waitForTimeout(400);

  bak('sayfa hatası yok', hata.length === 0, hata.join(' | '));
  await p.close();

  // ---- Fikirden script: fikir SECILI gelmeli ----
  // Kart uzerindeki "script yaz" dugmesi fikri METNE dokuyordu ve 1. adimda
  // hicbir sey isaretli degildi: kullanici ayni fikri bir daha, bu sefer
  // listeden secmek zorunda kaliyordu. Sayfadaki "gosterilen fikirlerden
  // script" dugmesi zaten dogru calisiyordu; bu biri geride kalmisti.
  console.log('[fikirden script yazınca fikir seçili geliyor]');
  const f = await ac(t, 1280);
  const hataF = []; f.on('pageerror', e=> hataF.push(String(e)));
  await f.evaluate(()=>{
    projects = [];
    fikirler = [fikirTemizle({ id:'fa', text:'Balat sokaklarında sabah çekimi' }),
                fikirTemizle({ id:'fb', text:'Başka bir fikir' })];
    saveFikirler(); setPage('ideas'); renderFikirler();
  });
  await f.waitForTimeout(400);
  await f.evaluate(()=> document.querySelector('[data-fk-script="fa"]').click());
  await f.waitForTimeout(600);
  const sonuc = await f.evaluate(()=>({
    acik: !!document.querySelector('#scriptOverlay.open'),
    secili: [...seciliFikirler],
    isaretli: [...document.querySelectorAll('#sc_ideasList input:checked')]
                .map(e=> e.dataset.fikirSec),
    sayac: document.getElementById('sc_ideasCount').textContent.trim(),
    baslik: document.getElementById('sc_title').value,
    metin: document.getElementById('sc_text').value
  }));
  bak('script penceresi açıldı', sonuc.acik);
  bak('tıklanan fikir SEÇİLİ geldi',
      sonuc.secili.length === 1 && sonuc.secili[0] === 'fa', JSON.stringify(sonuc.secili));
  bak('kutucuğu da işaretli',
      sonuc.isaretli.length === 1 && sonuc.isaretli[0] === 'fa', JSON.stringify(sonuc.isaretli));
  bak('öteki fikir seçilmedi', sonuc.isaretli.indexOf('fb') === -1);
  bak('başlıkta fikrin metni var', /Balat/.test(sonuc.baslik), sonuc.baslik);
  // Fikir artik metne DOKULMUYOR: seçili duruyor, isteyen "metne dök" der.
  bak('fikir metne dökülmedi (iki kez görünmüyor)', sonuc.metin.trim() === '',
      JSON.stringify(sonuc.metin));
  bak('sayfa hatası yok (fikirden script)', hataF.length === 0, hataF.join(' | '));
  await f.close();

  console.log('[masaüstünde de aynı kural]');
  const m = await ac(t, 1280);
  await kur(m, 100);
  await m.waitForTimeout(600);
  const md = await durum(m);
  bak('uzun listede masaüstünde de kapalı', md.kapali, JSON.stringify(md));
  await m.close();

  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
