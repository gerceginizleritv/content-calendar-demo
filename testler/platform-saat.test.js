// PLATFORM BASINA SAAT — ayni icerik, farkli mecralarda farkli saatlerde.
//
// Veri bunu ZATEN destekliyordu: her kayit kendi `time` degerini tasiyor.
// Eksik olan tek sey, coklu platform seciminin hepsine ayni saati
// damgalamasiydi. Kullanici once kaydi olusturup sonra tek tek duzeltmek
// zorunda kaliyordu -- kullanicinin kendi cumlesi: "ben youtube ve
// facebook a ayni videoyu farkli saatlerde upload ediyorum".
//
// UC TUZAK, ucu de burada olculuyor:
//
//   1. ALAN KOSULLU OLMALI. Tek platforma gonderen uretici hicbir yeni
//      tik gormemeli. Kosul "iki ya da daha fazla platform secili" --
//      hesap etiketindeki kuralin aynisi. Kosul unutulursa ozelligin
//      bedelini ona ihtiyaci olmayan herkes oder.
//
//   2. YENIDEN CIZIM YAZILANI SILMEMELI. Ucuncu platform isaretlenince
//      satirlar yeniden ciziliyor; ilk ikisine girilmis saatler
//      durmali. Naif bir innerHTML yenilemesi onlari sessizce silerdi
//      ve kullanici bunu ancak kaydettikten sonra fark ederdi.
//
//   3. ANAHTAR KAPALIYKEN ESKI DAVRANIS AYNEN SURMELI. Bu bir ekleme,
//      bir degisiklik degil. Kapali anahtarla dort kayit da ustteki
//      saati almali.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{ width:1280, height:1000 } })).newPage();
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

  // ⚠ saveEvent proje secimini await ile cozuyor ve proje yoksa bir
  // diyalog aciyor. Bassiz tarayicida o diyalog hic kapanmadigi icin
  // kaydetme SESSIZCE asili kaliyor: hata yok, uyari yok, hicbir sey
  // degismiyor. Bu testi ilk yazdigimda tam olarak oyle oldu ve butun
  // "kayit" olcumleri bos kaldi. Proje cozumu sabitleniyor; olculen sey
  // saatlerin kayda nasil dustugu, projenin nasil secildigi degil.
  const kaydet = async ()=>{
    await p.evaluate(async ()=>{
      document.querySelectorAll('.overlay.open').forEach(o=>{
        if(o.id !== 'editOverlay') o.classList.remove('open'); });
      const eski = window.secilenProjeyiCoz;
      window.secilenProjeyiCoz = async ()=> ({ id:'pr_test', name:'Test Projesi' });
      document.getElementById('saveBtn').click();
      await new Promise(r=> setTimeout(r, 500));
      window.secilenProjeyiCoz = eski;
    });
    await p.waitForTimeout(250);
    await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')); });
  };
  const sifirla = ()=> p.evaluate(()=>{ events = []; save(); });

  // Pencereyi ac, turu ve platformlari isaretle.
  const pencere = async (tipler, platformlar, saat)=>{
    await p.click('#addBtn');
    await p.waitForTimeout(400);
    await p.evaluate(({ tipler, platformlar, saat })=>{
      document.querySelectorAll('#typeChecks input').forEach(el=>{
        el.checked = tipler.includes(el.value);
        el.dispatchEvent(new Event('change', { bubbles:true }));
      });
      document.querySelectorAll('#platformChecks input').forEach(el=>{
        el.checked = platformlar.includes(el.value);
        el.dispatchEvent(new Event('change', { bubbles:true }));
      });
      document.getElementById('f_time').value = saat;
      document.getElementById('f_title').value = 'Trabzon Seferi';
    }, { tipler, platformlar, saat });
    await p.waitForTimeout(250);
  };
  const anahtarAc = async ()=>{
    await p.evaluate(()=>{
      const a = document.getElementById('f_saat_farkli');
      a.checked = true; a.dispatchEvent(new Event('change', { bubbles:true }));
    });
    await p.waitForTimeout(250);
  };
  const saatYaz = (pf, deger)=> p.evaluate(({pf,deger})=>{
    const el = document.querySelector('#platformSaatSatirlari input[data-pf="'+pf+'"]');
    if(el) el.value = deger;
  }, {pf, deger});
  const durum = ()=> p.evaluate(()=>({
    wrapGizli: document.getElementById('platformSaatWrap').hidden,
    satirGizli: document.getElementById('platformSaatSatirlari').hidden,
    anahtar: document.getElementById('f_saat_farkli').checked,
    satirlar: Array.from(document.querySelectorAll('#platformSaatSatirlari input[data-pf]'))
                .map(el=> ({ pf: el.dataset.pf, saat: el.value }))
  }));
  const kayitlar = ()=> p.evaluate(()=>
    events.map(e=> ({ platform:e.platform, type:e.type, time:e.time })).sort((a,b)=>
      (a.platform+a.type).localeCompare(b.platform+b.type)));

  // ------------------------------------------------------- 1. kosullu alan
  console.log('[koşullu alan]');
  await sifirla();
  await pencere(['video'], ['youtube'], '19:00');
  let d = await durum();
  bak('★ tek platformda alan hiç görünmüyor', d.wrapGizli === true, JSON.stringify(d));

  await p.evaluate(()=>{
    const el = document.querySelector('#platformChecks input[value="facebook"]');
    el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true }));
  });
  await p.waitForTimeout(250);
  d = await durum();
  bak('iki platformda alan çıkıyor', d.wrapGizli === false, JSON.stringify(d));
  bak('ama satırlar hâlâ kapalı: anahtar kendiliğinden açılmıyor',
    d.satirGizli === true && d.anahtar === false, JSON.stringify(d));

  await anahtarAc();
  d = await durum();
  bak('anahtar açılınca her platform için bir satır',
    d.satirlar.length === 2 && d.satirlar.map(x=>x.pf).sort().join(',') === 'facebook,youtube',
    JSON.stringify(d.satirlar));
  bak('satırlar üstteki saatle dolu geliyor',
    d.satirlar.every(x=> x.saat === '19:00'), JSON.stringify(d.satirlar));

  // Platform sayisi ikinin altina dusunce alan da anahtar da kapanmali:
  // acik kalan bir anahtar, gorunmeyen bir satirdan saat okumaya
  // calisirdi.
  await p.evaluate(()=>{
    const el = document.querySelector('#platformChecks input[value="facebook"]');
    el.checked = false; el.dispatchEvent(new Event('change', { bubbles:true }));
  });
  await p.waitForTimeout(250);
  d = await durum();
  bak('platform tekе düşünce alan kapanıyor ve anahtar sıfırlanıyor',
    d.wrapGizli === true && d.anahtar === false, JSON.stringify(d));

  // ------------------------------------------------- 2. yazilan kaybolmasin
  console.log('[yeniden çizim]');
  await p.evaluate(()=>{ closeModal(); });
  await sifirla();
  await pencere(['video'], ['youtube','facebook'], '19:00');
  await anahtarAc();
  await saatYaz('youtube', '19:00');
  await saatYaz('facebook', '21:30');
  await p.evaluate(()=>{
    const el = document.querySelector('#platformChecks input[value="instagram"]');
    el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true }));
  });
  await p.waitForTimeout(250);
  d = await durum();
  const yaz = Object.fromEntries(d.satirlar.map(x=> [x.pf, x.saat]));
  bak('★ üçüncü platform eklenince yazılan saatler duruyor',
    yaz.youtube === '19:00' && yaz.facebook === '21:30', JSON.stringify(yaz));
  bak('yeni platform üstteki saatle geliyor', yaz.instagram === '19:00', JSON.stringify(yaz));

  // ------------------------------------------------------- 3. kayda yansima
  console.log('[kayıt]');
  await p.evaluate(()=>{ closeModal(); });
  await sifirla();
  await pencere(['video'], ['youtube','facebook'], '19:00');
  await anahtarAc();
  await saatYaz('facebook', '21:30');
  await kaydet();
  let kk = await kayitlar();
  bak('iki kayıt oluştu', kk.length === 2, JSON.stringify(kk));
  bak('★ her platform kendi saatini aldı',
    kk.find(x=>x.platform==='youtube').time === '19:00' &&
    kk.find(x=>x.platform==='facebook').time === '21:30', JSON.stringify(kk));

  // Bos birakilan satir ustteki saati kullanmali -- ipucu metni bunu
  // soyluyor, davranis da oyle olmali.
  await sifirla();
  await pencere(['video'], ['youtube','facebook'], '08:15');
  await anahtarAc();
  await saatYaz('facebook', '');
  await kaydet();
  kk = await kayitlar();
  bak('boş bırakılan satır üstteki saati kullanıyor',
    kk.length === 2 && kk.every(x=> x.time === '08:15'), JSON.stringify(kk));

  // ------------------------------------------------- 4. eski davranis sursun
  console.log('[anahtar kapalı — eski davranış]');
  await sifirla();
  await pencere(['reels','story'], ['instagram','facebook'], '09:00');
  await kaydet();
  kk = await kayitlar();
  bak('tür × platform çarpımı bozulmadı: 4 kayıt', kk.length === 4, JSON.stringify(kk));
  bak('★ anahtar kapalıyken dördü de üstteki saatte',
    kk.every(x=> x.time === '09:00'), JSON.stringify(kk));

  // Anahtar ACIK ve iki tur secili: saat PLATFORM seviyesinde, tur x
  // platform ciftinde degil. Ayni platformun iki turu ayni saati alir.
  await sifirla();
  await pencere(['reels','story'], ['instagram','facebook'], '09:00');
  await anahtarAc();
  await saatYaz('facebook', '18:45');
  await kaydet();
  kk = await kayitlar();
  const fb = kk.filter(x=> x.platform === 'facebook');
  const ig = kk.filter(x=> x.platform === 'instagram');
  bak('★ saat platform seviyesinde: aynı platformun iki türü aynı saatte',
    kk.length === 4 && fb.length === 2 && fb.every(x=> x.time === '18:45')
    && ig.every(x=> x.time === '09:00'), JSON.stringify(kk));

  // ------------------------------------------------------- 5. duzenlemede yok
  console.log('[düzenleme]');
  await p.evaluate(()=>{ openModal(events[0]); });
  await p.waitForTimeout(400);
  d = await durum();
  bak('düzenleme penceresinde alan görünmüyor', d.wrapGizli === true, JSON.stringify(d));
  await p.evaluate(()=>{ closeModal(); });

  // ------------------------------------------------------------ 6. metinler
  console.log('[metinler]');
  const eksik = await p.evaluate(()=>{
    const anahtar = ['f_saat_farkli_label','f_saat_farkli_not'];
    const sonuc = {};
    ['tr','en'].forEach(dil=>{
      setLanguage(dil);
      anahtar.forEach(a=>{ const v = t(a); if(!v || v === a) sonuc[dil+':'+a] = String(v); });
    });
    setLanguage('tr');
    return sonuc;
  });
  bak('iki dilde de metinler tanımlı', Object.keys(eksik).length === 0, JSON.stringify(eksik));

  bak('sayfa hatası yok', hata.length === 0, hata.join(' | '));
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
