// YAYIN PAKETI TIKLENINCE TAKVIM KAYDI PENCERESI.
//
// Paket hazir olmak "icerik dagitilmaya hazir" demek; takvim kaydi
// acmanin dogal ani burasi. Kullanicinin kendi cumlesi: "cunku burada
// paketi de hazirlayabiliyor".
//
// TETIKLEYICI BILEREK 'package', 'published' DEGIL. Yayin adimi isin
// BITTIGINI soyluyor; o noktada kayitlar coktan acilmis olur ve pencere
// her tikte karsiya cikardi.
//
// UC KOSUL, ucu de burada olculuyor:
//
//   1. YALNIZCA O PROJENIN HIC KAYDI YOKSA. Kayitlari coktan acmis
//      birine pencere acmak yardim degil kesintidir -- bir kez ise
//      yarayan sey her seferinde tekrarlaninca rahatsiz eder.
//
//   2. YALNIZCA ISARETLERKEN. Tiki KALDIRMAK "paket hazir degilmis"
//      demek; o anda kayit acmayi teklif etmek anlamsiz.
//
//   3. BASKA ADIMLAR ACMAMALI. Yedi adimdan yalnizca biri bu pencereyi
//      aciyor; digerleri eskisi gibi sessizce isaretleniyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{ width:1400, height:1000 } })).newPage();
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
  await p.evaluate(()=>{ window.maybeAskFeedback = ()=>{}; window.maybeShowCloudNudge = ()=>{}; });

  // Iki proje: birinin yayin termini var, obürünün yok.
  const kur = (kayitVar)=> p.evaluate((kayitVar)=>{
    projects = [
      { id:'pr_a', name:'Trabzon Seferi', cancelled:false,
        deadlines:{ published:'2026-11-20' } },
      { id:'pr_b', name:'Terminsiz Proje', cancelled:false }
    ];
    saveProjects();
    events = kayitVar
      ? [{ id:'ev_1', type:'video', platform:'youtube', title:'Var olan kayıt',
           date:'2026-10-01', time:'19:00', uploaded:false,
           content:{ projectId:'pr_a', caption:'', hashtags:'' } }]
      : [];
    save();
    setPage('projects');
  }, kayitVar);

  const tikla = async (pid, adim)=>{
    await p.evaluate(({pid,adim})=>{
      const el = document.querySelector(`.pflag[data-proj="${pid}"][data-step="${adim}"]`);
      if(el) el.click();
    }, {pid, adim});
    await p.waitForTimeout(500);
  };
  const modal = ()=> p.evaluate(()=>({
    acik: document.getElementById('editOverlay').classList.contains('open'),
    proje: document.getElementById('f_project').value,
    tarih: document.getElementById('f_date').value,
    baslik: document.getElementById('modalTitle').textContent
  }));
  const kapat = ()=> p.evaluate(()=>{ closeModal(); });
  const adimDurumu = (pid, adim)=> p.evaluate(({pid,adim})=>{
    const pr = projectById(pid); return !!(pr && pr[adim]);
  }, {pid, adim});

  // ------------------------------------------- 1. kayit yokken aciliyor
  console.log('[kayıt yokken açılıyor]');
  await kur(false);
  await p.waitForTimeout(400);
  await tikla('pr_a', 'package');
  let m = await modal();
  bak('★ Yayın Paketi tiklenince kayıt penceresi açıldı', m.acik === true, JSON.stringify(m));
  bak('★ proje seçili geldi', m.proje === 'pr_a', JSON.stringify(m));
  bak('tarih yayın termininden geldi', m.tarih === '2026-11-20', m.tarih);
  bak('yeni kayıt penceresi (düzenleme değil)', /Yeni|New/i.test(m.baslik), m.baslik);
  bak('adım da işaretlendi', await adimDurumu('pr_a','package') === true);
  await kapat();

  // Termini olmayan projede bugun geliyor.
  await tikla('pr_b', 'package');
  m = await modal();
  const bugun = await p.evaluate(()=> fmtKey(new Date()));
  bak('termin yoksa bugün geliyor', m.acik === true && m.tarih === bugun, JSON.stringify(m));
  bak('o projenin kendisi seçili', m.proje === 'pr_b', m.proje);
  await kapat();

  // -------------------------------------------- 2. kayit varsa acilmiyor
  console.log('[kayıt varsa açılmıyor]');
  await kur(true);
  await p.waitForTimeout(400);
  await tikla('pr_a', 'package');
  m = await modal();
  bak('★ projenin kaydı varsa pencere AÇILMIYOR', m.acik === false, JSON.stringify(m));
  bak('ama adım yine de işaretlendi', await adimDurumu('pr_a','package') === true);
  // Ayni anda kaydi OLMAYAN proje icin hala aciliyor: kosul projeye ait,
  // takvimin tumune degil.
  await tikla('pr_b', 'package');
  m = await modal();
  bak('★ koşul projeye ait: kaydı olmayan proje için yine açılıyor',
    m.acik === true && m.proje === 'pr_b', JSON.stringify(m));
  await kapat();

  // --------------------------------------------- 3. kaldirirken acilmiyor
  console.log('[tiki kaldırırken açılmıyor]');
  await kur(false);
  await p.waitForTimeout(400);
  await tikla('pr_a', 'package');          // isaretle -> acilir
  await kapat();
  bak('işaretli duruma geldi', await adimDurumu('pr_a','package') === true);
  await tikla('pr_a', 'package');          // kaldir -> acilmamali
  m = await modal();
  bak('★ tik kaldırılırken pencere açılmıyor', m.acik === false, JSON.stringify(m));
  bak('adım gerçekten kaldırıldı', await adimDurumu('pr_a','package') === false);

  // ------------------------------------------- 4. baska adimlar acmiyor
  console.log('[diğer adımlar]');
  await kur(false);
  await p.waitForTimeout(400);
  for(const adim of ['script','filmed','audio','edited','approved','published']){
    await tikla('pr_a', adim);
    const mm = await modal();
    bak(adim + ' penceresi açmıyor', mm.acik === false, JSON.stringify(mm));
    if(mm.acik) await kapat();
  }
  bak('sayfa hatası yok', hata.length === 0, hata.join(' | '));
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
