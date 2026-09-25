// OTOMATIK YAYIN TIKI — hesapta acik degilse CALISMAMALI
//
// Tik herkese tiklanabilir gorunuyordu. Bayragi olmayan biri aciyor,
// hicbir sey olmuyor, ekranda yalnizca "Bekliyor" yaziyordu. Calismayan
// bir dugme, sebebini soylemeyen bir dugmeden daha kotu: kullanici
// hatanin kendisinde oldugunu dusunuyor ve arayacak bir yer bulamiyor.
//
// Otomatik yayin uc seye bagli ve ucu de uygulamanin disinda:
//   · Meta hesabinin baglanmis olmasi (jeton Vault'ta)
//   · PC'deki yukleyicinin dosyayi baglamasi (media_url)
//   · kayitta bir saat olmasi (sql/45)
// Bunlarin hicbiri kullanicinin kendi acabilecegi sey degil, o yuzden
// kurulum hesap hesap yapiliyor ve bayrak veritabaninda duruyor
// (user_prefs.prefs.story_yayin -- sql/49 ayni bayraga bakiyor).
//
// ⚠ Bayrak buradan YAZILMIYOR. PREFS_BIZIM'de de yok: tercihPrefsYap
// onu yabanci defterde oldugu gibi koruyor (prefs-koruma.test.js).
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{ width:1280, height:1000 }, locale:'tr-TR' })).newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**supabase.co**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());

  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });

  // bayrak: hesapta acik mi · kayitli: kayit veritabaninda var mi
  const kur = (bayrak, kayitli)=> p.evaluate(({b, kv})=>{
    session = { user:{ id:'00000000-0000-4000-8000-000000000001', email:'deneme@ornek.com' } };
    bulutOkumaBasarisiz = false;
    gelenAlinanOku({ prefs: b ? { lang:'tr', story_yayin:true } : { lang:'tr' } });
    currentEvent = kv ? { id:'e1', type:'story',
      yayin:{ durum:'pending', otomatik:false, dosya:'', bayt:0, hata:'', deneme:0 } } : null;
    document.getElementById('f_type').value = 'story';
    document.getElementById('f_time').value = '16:45';
    otoYayinTazele();
    const tg = document.getElementById('otoYayinToggle');
    return {
      gizli:  document.getElementById('otoYayinWrap').hidden,
      kapali: tg.dataset.kapali === '1',
      isaret: tg.dataset.val === '1',
      metin:  document.getElementById('otoYayinDurum').innerText,
      madde:  document.querySelectorAll('#otoYayinDurum .oy-sart li').length
    };
  }, { b: bayrak, kv: kayitli });

  console.log('[bayrak okunuyor]');
  await kur(false, true);
  bak('bayraksiz hesapta kapali', await p.evaluate(()=> storyYayinAcik === false));
  await kur(true, true);
  bak('bayrakli hesapta acik', await p.evaluate(()=> storyYayinAcik === true));
  await p.evaluate(()=> gelenAlinanOku(null));
  bak('yeni hesapta (satir yok) kapali', await p.evaluate(()=> storyYayinAcik === false));

  console.log('[ASIL OLCUM: bayraksiz hesapta tik CALISMIYOR]');
  let s = await kur(false, true);
  bak('bolum yine gorunuyor (ozellik saklanmiyor)', s.gizli === false);
  bak('tik kilitli', s.kapali === true);
  bak('tik isaretli DEGIL', s.isaret === false);

  // Tiklama denemesi: gercekten hicbir sey yazmamali.
  const yazildi = await p.evaluate(async ()=>{
    let cagrildi = false;
    const eski = otomatikYayinYaz;
    otomatikYayinYaz = async ()=>{ cagrildi = true; return true; };
    document.getElementById('otoYayinToggle').click();
    await new Promise(r=> setTimeout(r, 250));
    otomatikYayinYaz = eski;
    return cagrildi;
  });
  bak('tiklayinca veritabanina yazilmiyor', yazildi === false);

  console.log('[SEBEP yaziyor]');
  s = await kur(false, true);
  bak('kapali oldugu yaziyor', /kapal/i.test(s.metin), s.metin.slice(0, 60));
  bak('uc sart da sayiliyor', s.madde === 3, String(s.madde));
  bak('Meta hesabi geciyor', /Instagram|Facebook/.test(s.metin));
  bak('yukleyici geciyor', /yükleyici/i.test(s.metin));
  bak('saat geciyor', /saat/i.test(s.metin));
  bak('nasil acilacagi yaziyor', /geri bildirim/i.test(s.metin));
  // "Bekliyor" DEMIYOR: eski hatanin belirtisi tam olarak buydu.
  bak('yaniltici "Bekliyor" yazmiyor', !/Bekliyor/.test(s.metin), s.metin.slice(0, 80));

  console.log('[bayrakli hesapta eskisi gibi]');
  s = await kur(true, true);
  bak('tik calisiyor', s.kapali === false);
  bak('durum satiri geri geldi', /Bekliyor/.test(s.metin), s.metin.slice(0, 40));
  bak('sart listesi yok', s.madde === 0, String(s.madde));

  // Bayrak VARSA ama kayit henuz kaydedilmemisse eski mesaj gecerli.
  s = await kur(true, false);
  bak('yeni kayitta "once kaydet" mesaji', /kaydet/i.test(s.metin), s.metin.slice(0, 60));
  bak('yeni kayitta tik kilitli', s.kapali === true);
  // Bayraksiz birine "once kaydet" demek, kaydettiginde calisacagini
  // soylemek olurdu; o yuzden bayrak kontrolu ONCE geliyor.
  s = await kur(false, false);
  bak('bayraksiz + yeni kayitta "once kaydet" DEMIYOR', !/kaydet/i.test(s.metin), s.metin.slice(0, 60));

  console.log('[Ingilizce]');
  await p.evaluate(()=> setLanguage('en'));
  s = await kur(false, true);
  bak('Ingilizce metin geliyor', /account/i.test(s.metin) && !/hesap/i.test(s.metin), s.metin.slice(0, 60));
  bak('Ingilizcede de uc madde', s.madde === 3, String(s.madde));

  bak('js hatasi yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
