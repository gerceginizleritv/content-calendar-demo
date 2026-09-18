// BUGUN SAYFASI: her satir bir KAPI olmali.
//
// Bu sayfanin butun meselesi bu. Ayni bilgiyi duz metin olarak da
// basabilirdik -- basmistik da -- ama o zaman okunan bir rapor oluyor:
// kullanici "geciken adim" satirini goruyor, sonra menuden projeyi
// bulup aramaya gidiyor. "Arada kopukluk var" hissi tam olarak orada
// doguyor.
//
// Bu yuzden test sayfanin GORUNUSUNU degil, satirlara basilinca DOGRU
// YERIN acilip acilmadigini olcuyor. Bir satirin yanlis yere gitmesi,
// hic gitmemesinden daha kotu.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const gunler = (n)=> {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
};

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{ width:1280, height:1100 } })).newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**supabase.co**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());

  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1300);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });

  // Her bolumden en az bir satir cikaracak veri.
  await p.evaluate(([bugun, yarin, dun, eski])=>{
    projects = [
      { id:'pA', name:'Rumeli Hisarı', type:'outdoor', shootDate:yarin, deadlines:{ script:dun } },
      { id:'pB', name:'Kariye Mozaikleri', type:'studio', shootDate:'', deadlines:{ edited:bugun } }
    ].map(sanitizeProject).filter(Boolean);
    events = [
      { id:'eBugun', type:'reels', platform:'instagram', title:'Hisar teaser',
        date:bugun, time:'23:50', uploaded:false, content:{ projectId:'pA' } },
      { id:'eGec', type:'video', platform:'youtube', title:'Geçen haftaki',
        date:eski, time:'10:00', uploaded:false, content:{} }
    ];
    saveProjects(); save(); setPage('bugun');
  }, [gunler(0), gunler(1), gunler(-3), gunler(-7)]);
  await p.waitForTimeout(400);

  const basliklar = ()=> p.evaluate(()=>
    [...document.querySelectorAll('#bugunGovde .bg-baslik')].map(e=> e.firstChild.textContent.trim()));
  const satirlar = ()=> p.evaluate(()=>
    [...document.querySelectorAll('#bugunGovde .bg-satir')].map(e=> ({
      ad: (e.querySelector('.bg-ad')||{}).textContent,
      ne: (e.querySelector('.bg-ne')||{}).textContent,
      yan: (e.querySelector('.bg-yan')||{}).textContent,
      sinif: e.className })));
  const acikPencere = ()=> p.evaluate(()=>{
    const o = document.querySelector('.overlay.open');
    return o ? o.id : (document.querySelector('#bugunPage:not([hidden])') ? 'bugunPage' : 'yok');
  });
  const acikSayfa = ()=> p.evaluate(()=>{
    const a = [...document.querySelectorAll('.rail-main > div[id$="Page"]')].find(d=> !d.hidden);
    return a ? a.id : 'yok';
  });
  const kapat = ()=> p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setPage('bugun');
  });

  console.log('[bolumler ciziliyor]');
  const bas = await basliklar();
  bak('geciken adimlar bolumu var', bas.indexOf('GECİKEN ADIMLAR') !== -1, bas.join(' | '));
  bak('bugun biten terminler bolumu var', bas.indexOf('BUGÜN BİTEN TERMİNLER') !== -1, bas.join(' | '));
  bak('isaretlenmeyi bekleyen bolumu var', bas.indexOf('İŞARETLENMEYİ BEKLEYEN') !== -1, bas.join(' | '));
  bak('bugun takvimde bolumu var', bas.indexOf('BUGÜN TAKVİMDE') !== -1, bas.join(' | '));
  bak('yaklasan cekimler bolumu var', bas.indexOf('YAKLAŞAN ÇEKİMLER') !== -1, bas.join(' | '));
  bak('eksikler bolumu var', bas.indexOf('ÇEKİMDEN ÖNCE EKSİK') !== -1, bas.join(' | '));
  // En acil olan en ustte: gecikme, listenin dibinde durursa gorulmez.
  bak('geciken adimlar EN USTTE', bas[0] === 'GECİKEN ADIMLAR', bas[0]);

  const sat = await satirlar();
  bak('geciken satir kirmizi serit tasiyor',
      (sat[0].sinif||'').indexOf('gec') !== -1, sat[0].sinif);
  bak('tarih rakam sutununda', /\d/.test(sat[0].ne || ''), sat[0].ne);
  bak('adim adi yan bilgide', (sat[0].yan||'').length > 0, sat[0].yan);

  console.log('[HER SATIR BIR KAPI]');
  // 1. Geciken adim -> o projenin termin penceresi.
  await p.click('#bugunGovde .bg-satir.gec');
  await p.waitForTimeout(350);
  bak('geciken adim → termin penceresi', (await acikPencere()) === 'deadlineOverlay', await acikPencere());
  bak('termin penceresi DOGRU projeyi acti',
      (await p.evaluate(()=> (document.getElementById('dlWho')||{}).textContent || '')).indexOf('Rumeli') !== -1,
      await p.evaluate(()=> (document.getElementById('dlWho')||{}).textContent || ''));
  await kapat();

  // 2. Bugun biten termin -> yine termin penceresi, ama oteki proje.
  await p.evaluate(()=>{
    const b = [...document.querySelectorAll('#bugunGovde .bg-blok')]
      .find(x=> x.querySelector('.bg-baslik').textContent.indexOf('BUGÜN BİTEN') === 0);
    b.querySelector('.bg-satir').click();
  });
  await p.waitForTimeout(350);
  bak('bugunku termin → termin penceresi', (await acikPencere()) === 'deadlineOverlay', await acikPencere());
  bak('bugunku termin DOGRU projeyi acti',
      (await p.evaluate(()=> (document.getElementById('dlWho')||{}).textContent || '')).indexOf('Kariye') !== -1,
      await p.evaluate(()=> (document.getElementById('dlWho')||{}).textContent || ''));
  await kapat();

  // 3. Isaretlenmeyi bekleyen kayit -> kayit penceresi, DOGRU kayitla.
  await p.evaluate(()=>{
    const b = [...document.querySelectorAll('#bugunGovde .bg-blok')]
      .find(x=> x.querySelector('.bg-baslik').textContent.indexOf('İŞARETLENMEYİ') === 0);
    b.querySelector('.bg-satir').click();
  });
  await p.waitForTimeout(350);
  bak('bekleyen kayit → kayit penceresi', (await acikPencere()) === 'editOverlay', await acikPencere());
  bak('kayit penceresinde DOGRU kayit',
      (await p.evaluate(()=> document.getElementById('f_title').value)) === 'Geçen haftaki',
      await p.evaluate(()=> document.getElementById('f_title').value));
  await kapat();

  // 4. Bugun takvimde -> kayit penceresi, oteki kayitla.
  await p.evaluate(()=>{
    const b = [...document.querySelectorAll('#bugunGovde .bg-blok')]
      .find(x=> x.querySelector('.bg-baslik').textContent.indexOf('BUGÜN TAKVİMDE') === 0);
    b.querySelector('.bg-satir').click();
  });
  await p.waitForTimeout(350);
  bak('bugunku kayit → DOGRU kayit',
      (await p.evaluate(()=> document.getElementById('f_title').value)) === 'Hisar teaser',
      await p.evaluate(()=> document.getElementById('f_title').value));
  await kapat();

  // 5. Yaklasan cekim -> cekim listesi, dogru projeyle.
  await p.evaluate(()=>{
    const b = [...document.querySelectorAll('#bugunGovde .bg-blok')]
      .find(x=> x.querySelector('.bg-baslik').textContent.indexOf('YAKLAŞAN') === 0);
    b.querySelector('.bg-satir').click();
  });
  await p.waitForTimeout(350);
  bak('yaklasan cekim → cekim listesi',
      (await acikPencere()) === 'cekimListesiOverlay', await acikPencere());
  bak('cekim listesi DOGRU projeyi acti',
      (await p.evaluate(()=> (document.getElementById('cl_proje')||{}).textContent || '')).indexOf('Rumeli') !== -1,
      await p.evaluate(()=> (document.getElementById('cl_proje')||{}).textContent || ''));
  await kapat();

  console.log('[her eksik KENDI yerine gidiyor]');
  const cipler = await p.evaluate(()=>
    [...document.querySelectorAll('#bugunGovde .bg-cip')].map(e=> e.dataset.bgNe));
  bak('eksik cipleri ayri ayri duruyor', cipler.length >= 3, cipler.join(','));

  const cipeBas = (ne)=> p.evaluate((n)=>{
    const c = document.querySelector('#bugunGovde .bg-cip[data-bg-ne="'+n+'"]');
    if(c) c.click();
  }, ne);

  await cipeBas('script'); await p.waitForTimeout(300);
  bak('"scripti yok" → script sayfasi', (await acikSayfa()) === 'scriptsPage', await acikSayfa());
  bak('script sayfasi O projeye suzuldu',
      (await p.evaluate(()=> scriptFiltresi)) === 'pA', await p.evaluate(()=> String(scriptFiltresi)));
  await kapat();

  await cipeBas('yer'); await p.waitForTimeout(300);
  bak('"adresi yok" → proje penceresi', (await acikPencere()) === 'projectEditOverlay', await acikPencere());
  await kapat();

  await cipeBas('liste'); await p.waitForTimeout(300);
  bak('"çekim listesi yok" → çekim listesi',
      (await acikPencere()) === 'cekimListesiOverlay', await acikPencere());
  await kapat();

  console.log('[bos haller AYRI]');
  // Hic verisi olmayan kullaniciya "her sey tamam" demek, uygulamayi
  // bos yere bitmis gosterir.
  await p.evaluate(()=>{ projects = []; events = []; saveProjects(); save(); setPage('bugun'); });
  await p.waitForTimeout(300);
  const bosYeni = await p.evaluate(()=> (document.querySelector('#bugunGovde .bg-bos')||{}).textContent || '');
  bak('yeni kullaniciya "başla" deniyor', /ilk kaydını|proje oluştur/i.test(bosYeni), bosYeni.slice(0,70));

  await p.evaluate(()=>{
    projects = [{ id:'z', name:'Bitmiş', type:'desk', shootDate:'', script:true, filmed:true,
      audio:true, edited:true, approved:true, package:true, published:true, deadlines:{} }]
      .map(sanitizeProject).filter(Boolean);
    events = []; saveProjects(); save(); setPage('bugun');
  });
  await p.waitForTimeout(300);
  const bosTemiz = await p.evaluate(()=> (document.querySelector('#bugunGovde .bg-bos')||{}).textContent || '');
  bak('verisi olana "temiz" deniyor', /bekleyen bir iş yok/i.test(bosTemiz), bosTemiz.slice(0,70));
  bak('iki bos hal FARKLI metin', bosYeni !== bosTemiz);
  bak('bos halde de tarih yaziyor',
      (await p.evaluate(()=> !!document.querySelector('#bugunGovde .bg-gun'))) === true);

  console.log('[açılış sayfası]');
  // Bugün artık ön kapı. Hatirlanan sayfa OTURUMLUK: sekme icinde yenileme
  // yeri koruyor ama yeni bir ziyaret Bugun'den basliyor. Kalici olsaydi,
  // bir kez Projeler'e gecen kullanici Bugun'u bir daha hic gormezdi.
  const temizSayfa = async (once)=>{
    const s2 = await t.newContext({ viewport:{ width:1280, height:1000 } });
    const q = await s2.newPage();
    await q.route('**supabase.co**', r=> r.abort());
    await q.route('**accounts.google.com**', r=> r.abort());
    await q.route('**/goatcounter**', r=> r.abort());
    await q.addInitScript(`try{ localStorage.setItem('demo_tour_done','1');
      ${once || ''} }catch(e){}`);
    await q.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
    await q.waitForTimeout(1300);
    const ad = await q.evaluate(()=>{
      const a = [...document.querySelectorAll('.rail-main > div[id$="Page"]')].find(d=> !d.hidden);
      return a ? a.id : 'yok';
    });
    await s2.close();
    return ad;
  };
  // Acilis KIME gore degisiyor: girisli kullanici is yapmaya geliyor
  // (Bugun), ziyaretci urunu degerlendirmeye geliyor ve demonun anlattigi
  // sey dolu takvim. Ziyaretciye Bugun acilsaydi neredeyse bos bir ekran
  // gorurdu -- demo kayitlari yarindan basliyor.
  bak('ziyaretçi Takvim ile açılıyor', (await temizSayfa()) === 'calendarPage',
      await temizSayfa());
  bak('girişli kullanıcı Bugün ile açılıyor',
      (await temizSayfa("localStorage.setItem('demo_girisli','1');")) === 'bugunPage',
      await temizSayfa("localStorage.setItem('demo_girisli','1');"));
  // Eski surumden kalan kalici anahtar acilisi ele gecirmemeli.
  bak('eski kalıcı demo_page açılışı ele geçirmiyor',
      (await temizSayfa("localStorage.setItem('demo_girisli','1'); localStorage.setItem('demo_page','templates');")) === 'bugunPage');
  // Ama sekme icinde yenileme yeri koruyor.
  bak('oturum içinde hatırlanan sayfa korunuyor',
      (await temizSayfa("localStorage.setItem('demo_girisli','1'); sessionStorage.setItem('demo_page','templates');")) === 'templatesPage');

  // Butun ozellik bu bayraga dayaniyor: yanlis yazilirsa ya ziyaretci
  // Bugun'e duser (bos ekran) ya da girisli kullanici Takvim'e.
  console.log('[giriş bayrağı]');
  bak('ziyaretçide bayrak yok',
      (await p.evaluate(()=> localStorage.getItem('demo_girisli'))) === null);
  await p.evaluate(()=> oturumBildirildi({ user:{ id:'11111111-1111-1111-1111-111111111111' } }));
  await p.waitForTimeout(300);
  bak('oturum gelince bayrak yazılıyor',
      (await p.evaluate(()=> localStorage.getItem('demo_girisli'))) === '1');
  await p.evaluate(()=> oturumBildirildi(null));
  await p.waitForTimeout(300);
  bak('çıkınca bayrak siliniyor',
      (await p.evaluate(()=> localStorage.getItem('demo_girisli'))) === null);

  console.log('[yeni kullanıcı boş ekranda yol buluyor]');
  await p.evaluate(()=>{ projects = []; events = []; saveProjects(); save(); setPage('bugun'); });
  await p.waitForTimeout(300);
  bak('boş Bugün ekranında proje düğmesi var',
      (await p.evaluate(()=> !!document.getElementById('bg_yeniProje'))) === true);
  await p.click('#bg_yeniProje');
  await p.waitForTimeout(400);
  bak('düğme proje penceresini açıyor',
      (await p.evaluate(()=> !!document.querySelector('#projectEditOverlay.open'))) === true);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')); });
  // "Her sey tamam" hali BASKA: veri var, bugun is yok. Orada dugme
  // olmamali -- kullaniciya yapacak is uydurmus oluruz.
  await p.evaluate(()=>{
    projects = [{ id:'z', name:'Bitmiş', type:'desk', shootDate:'', script:true, filmed:true,
      audio:true, edited:true, approved:true, package:true, published:true, deadlines:{} }]
      .map(sanitizeProject).filter(Boolean);
    events = []; saveProjects(); save(); setPage('bugun');
  });
  await p.waitForTimeout(300);
  bak('"her şey tamam" halinde düğme YOK',
      (await p.evaluate(()=> !!document.getElementById('bg_yeniProje'))) === false);

  // UCUNCU bos hal: plan dolu ama bugune denk gelmiyor. En sik olani ve
  // en cok yanlis anlasilani -- yalnizca "bekleyen is yok" deseydi, dolu
  // bir takvimi olan kullanici uygulamayi bos sanirdi. Demo ziyaretcisi
  // tam olarak bu halde: sekiz kayit var, hepsi ileri tarihli.
  await p.evaluate((yarin)=>{
    projects = []; events = [{ id:'ileri', type:'reels', platform:'instagram',
      title:'Yarınki', date:yarin, time:'10:00', uploaded:false, content:{} }];
    saveProjects(); save(); setPage('bugun');
  }, gunler(3));
  await p.waitForTimeout(300);
  const ileriMetin = await p.evaluate(()=> (document.querySelector('#bugunGovde .bg-bos')||{}).textContent || '');
  bak('boş gün "sıradaki ne zaman" diyor', /Sıradaki kayıt/.test(ileriMetin), ileriMetin.slice(0,90));
  bak('takvime götüren düğme var',
      (await p.evaluate(()=> !!document.getElementById('bg_takvim'))) === true);
  await p.click('#bg_takvim');
  await p.waitForTimeout(350);
  bak('düğme takvimi açıyor', (await acikSayfa()) === 'calendarPage', await acikSayfa());
  await kapat();

  bak('js hatası yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
