// Proje penceresinde "Drive'dan seç": Google'ın kendi Picker penceresi.
// Google çağrıları taklit ediliyor — testte gerçek Drive'a gidilmiyor.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1100} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log("DRİVE KLASÖR SEÇİCİ");

  const r = await page.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    projects = [{ id:'p1', name:'Sokollu', type:'studio', keywords:'', notes:'', address:'',
      shootDate:'', script:false, filmed:false, edited:false, approved:false, published:false,
      permission:'', cancelled:false, deadlines:{}, checklist:[], createdAt:Date.now() }];
    saveProjects();

    // Google taklidi
    let istenenKlasor = null;
    driveBetikleri = ()=> Promise.resolve();
    driveIzinIste = ()=> Promise.resolve('sahte-token');
    drivePickerAc = (token, klasor)=>{ istenenKlasor = klasor;
      return Promise.resolve({ id:'1AbCdEf', name:'Sokollu çekimleri' }); };

    openProjectEdit('p1');
    await bekle(200);
    document.getElementById('pe_fieldFold').open = true;
    document.getElementById('pe_driveSec').click();
    await bekle(300);
    const url = document.getElementById('pe_driveUrl').value;
    const not = document.getElementById('pe_driveNot');
    const notMetni = not.textContent;
    const notGorunuyor = !not.hidden;
    const sayac = document.getElementById('pe_fieldCount').textContent;

    // Kaydedince bağlantı projeye yazılıyor
    document.getElementById('pe_save').click();
    await bekle(250);
    const kayitli = projectById('p1').driveUrl;

    // İPTAL: kullanıcı pencereyi kapatırsa alan değişmiyor
    drivePickerAc = ()=> Promise.resolve(null);
    openProjectEdit('p1');
    await bekle(200);
    document.getElementById('pe_driveSec').click();
    await bekle(250);
    const iptalSonrasi = document.getElementById('pe_driveUrl').value;
    const iptalNotGizli = document.getElementById('pe_driveNot').hidden;

    // HATA: Drive'a ulaşılamazsa elle yapıştırma yolu açık kalıyor
    drivePickerAc = ()=> Promise.reject(new Error('ag yok'));
    document.getElementById('pe_driveSec').click();
    await bekle(250);
    const hataNotu = document.getElementById('pe_driveNot').textContent;
    const dugmeAcik = !document.getElementById('pe_driveSec').disabled;
    const kutuYazilabilir = !document.getElementById('pe_driveUrl').disabled;

    return { istenenKlasor, url, notMetni, notGorunuyor, sayac, kayitli,
             iptalSonrasi, iptalNotGizli, hataNotu, dugmeAcik, kutuYazilabilir };
  });

  k('KLASÖR kipinde açılıyor (belge değil)', r.istenenKlasor === true, r.istenenKlasor);
  k('seçilen klasörün bağlantısı yazılıyor', /drive\.google\.com\/drive\/folders\/1AbCdEf/.test(r.url), r.url);
  k('klasörün ADI gösteriliyor', r.notGorunuyor && /Sokollu çekimleri/.test(r.notMetni), r.notMetni);
  k('saha sayacı güncelleniyor', /1 dolu/.test(r.sayac), r.sayac);
  k('kaydedince projeye yazılıyor', /1AbCdEf/.test(r.kayitli || ''), r.kayitli);
  k('İPTAL edilince bağlantı değişmiyor', /1AbCdEf/.test(r.iptalSonrasi), r.iptalSonrasi);
  k('iptalde not gizleniyor', r.iptalNotGizli === true);
  k('Drive açılmazsa açıklama çıkıyor', /ula/.test(r.hataNotu), r.hataNotu);
  k('hatadan sonra düğme yine basılabilir', r.dugmeAcik);
  k('elle yapıştırma yolu hep açık', r.kutuYazilabilir);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close();
  process.exit(hata ? 1 : 0);
})();
