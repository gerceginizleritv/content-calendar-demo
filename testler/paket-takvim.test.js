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
//
//   4. PENCERE BOS KAPANIRSA TIK SORULMALI. Tik "dagitim planlandi"
//      demek ve o anlam kayitlarin VARLIGINA bagli; pencereyi bos
//      kapatan kullanicida tik kalirsa proje satiri gercek olmayan bir
//      sey soyler. Kullanicinin bildirdigi kusur tam olarak buydu.
//      Tik KENDILIGINDEN geri alinmiyor, SORULUYOR: paketi isaretleyip
//      kayitlari sonra acmak mesru bir sira.
const { chromium, ORNEKSIZ } = require('./araclar');
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

  // Bu test KAYDETMEDEN SONRA hangi sorunun cikacagini olcuyor. Ornekler
  // dururken ilk gercek kayitta "ornekleri kaldirayim mi" da soruluyor ve
  // olcum yanlis soruyu yakaliyordu. Ornek veri bu testin konusu degil.
  await p.addInitScript(ORNEKSIZ);
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

  // ------------------------------------ 4. bos kapaninca tik soruluyor
  console.log('[boş kapanınca tik soruluyor]');
  await p.evaluate(()=>{
    window.__onaySayi = 0; window.__onayMetin = []; window.__onayCevap = true;
    window.onayla = async (o)=>{
      window.__onaySayi++;
      window.__onayMetin.push(typeof o === 'string' ? o : JSON.stringify(o));
      return window.__onayCevap;
    };
  });
  const onay = ()=> p.evaluate(()=>({ sayi: window.__onaySayi, metin: window.__onayMetin }));
  const onaySifirla = (c)=> p.evaluate((c)=>{ window.__onaySayi = 0; window.__onayMetin = []; window.__onayCevap = c; }, c);

  await kur(false); await p.waitForTimeout(400);
  await onaySifirla(true);                 // "İşareti kaldır" deniyor
  await tikla('pr_a', 'package');
  bak('pencere açıldı', (await modal()).acik === true);
  await kapat();
  await p.waitForTimeout(400);
  let o = await onay();
  bak('★ boş kapanınca soruldu', o.sayi === 1, JSON.stringify(o));
  bak('soru neyin kaldırılacağını söylüyor',
    /paket_bos|Paket|Package/i.test(o.metin.join(' ')), o.metin.join(' ').slice(0,160));
  bak('★ "kaldır" denince tik geri alındı',
    await adimDurumu('pr_a','package') === false);

  // Vazgec: tik KALMALI. Varsayilan davranis tiki korumali, yoksa paketi
  // bilerek isaretleyip kayitlari sonra acacak kisi onu kaybeder.
  await kur(false); await p.waitForTimeout(400);
  await onaySifirla(false);                // "Vazgeç" deniyor
  await tikla('pr_a', 'package');
  await kapat();
  await p.waitForTimeout(400);
  bak('★ "vazgeç" denince tik DURUYOR', await adimDurumu('pr_a','package') === true);

  // Kaydedilirse hic sorulmamali: tik artik dogruyu soyluyor.
  await kur(false); await p.waitForTimeout(400);
  await onaySifirla(true);
  await tikla('pr_a', 'package');
  await p.evaluate(async ()=>{
    document.querySelectorAll('#typeChecks input').forEach(el=>{
      if(el.value === 'video'){ el.checked = true; el.dispatchEvent(new Event('change',{bubbles:true})); }
    });
    document.querySelectorAll('#platformChecks input').forEach(el=>{
      if(el.value === 'youtube'){ el.checked = true; el.dispatchEvent(new Event('change',{bubbles:true})); }
    });
    document.getElementById('f_title').value = 'Yeni gönderi';
    const eski = window.secilenProjeyiCoz;
    window.secilenProjeyiCoz = async ()=> ({ id:'pr_a', name:'Trabzon Seferi' });
    document.getElementById('saveBtn').click();
    await new Promise(r=> setTimeout(r, 600));
    window.secilenProjeyiCoz = eski;
  });
  await p.waitForTimeout(400);
  o = await onay();
  bak('kayıt gerçekten oluştu', await p.evaluate(()=> events.length) > 0,
    String(await p.evaluate(()=> events.length)));
  bak('★ kaydedilince hiç sorulmuyor', o.sayi === 0, JSON.stringify(o));
  bak('tik duruyor', await adimDurumu('pr_a','package') === true);

  // Normal "+" dugmesinden acilan pencere bos kapanirsa hicbir sey
  // sorulmamali: o pencerenin tikle ilgisi yok.
  //
  // ⚠ PAKET BURADA ISARETLI OLMALI. Ilk yazdigimda isaretsizdi ve olcum
  // BOSA GECIYORDU: diyalogu engelleyen sey olctugum koruma degil,
  // "tik zaten isaretli degil" kontroluydu. Mutasyon bunu yakaladi --
  // pencere kaynagi kontrolunu kaldirdigimda test yine yesil kaldi.
  await kur(false); await p.waitForTimeout(400);
  await p.evaluate(()=>{ const pr = projectById('pr_a'); pr.package = true; saveProjects(); renderProjects(); });
  await p.waitForTimeout(250);
  await onaySifirla(true);
  await p.evaluate(()=>{ openModal(null); });
  await p.waitForTimeout(300);
  await kapat();
  await p.waitForTimeout(400);
  bak('★ normal pencere boş kapanınca sorulmuyor', (await onay()).sayi === 0,
    JSON.stringify(await onay()));

  // ------------------------------------------- 5. baska adimlar acmiyor
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
