const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ serviceWorkers:'block', viewport:{width:1440,height:1000}, colorScheme:'light' });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  // Gelen kutusu bu testin konusu degil: kutuyu yoldan cekiyoruz,
  // yoksa acilista eklenen kayitlar sayimlari kaydiriyor.
  await page.route('**/gelen/kayitlar.json', r=>r.fulfill({status:404,body:''}));
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1600);
  console.log('FİKİR DUVARI');

  const r = await page.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    const c=window.onayla; window.onayla=()=>false;
    openProjectNew('Kariye');
    document.getElementById('pe_type').value='studio';
    document.getElementById('pe_type').dispatchEvent(new Event('change'));
    document.getElementById('pe_save').click();
    await bekle(350); window.onayla=c;
    const P=projects[0];
    setPage('ideas');
    await bekle(200);

    // --- Ekleme karti ---
    const kapaliHal = { ekleKarti: !!document.getElementById('fk_openAdd'), alan: !!document.getElementById('fk_new') };
    document.getElementById('fk_openAdd').click();
    await bekle(150);
    const acikHal = { alan: !!document.getElementById('fk_new'), sel: !!document.getElementById('fk_newProj') };
    // Varsayilan proje BOS olmali
    const varsayilanProje = document.getElementById('fk_newProj').value;
    document.getElementById('fk_new').value = 'Metokhites kimdi';
    document.getElementById('fk_add').click();
    await bekle(200);
    const ilkFikir = { adet: fikirler.length, bag: fikirler[0].projectId, acikKaldi: !!document.getElementById('fk_new') };

    // Enter ile ekle, Shift+Enter satir atlar
    const alan = document.getElementById('fk_new');
    alan.value = 'İkinci fikir';
    alan.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
    await bekle(200);
    const enterEkledi = fikirler.length === 2;
    const alan2 = document.getElementById('fk_new');
    alan2.value = 'Üçüncü';
    const shiftOlay = new KeyboardEvent('keydown', {key:'Enter', shiftKey:true, bubbles:true, cancelable:true});
    alan2.dispatchEvent(shiftOlay);
    const shiftEklemedi = fikirler.length === 2 && !shiftOlay.defaultPrevented;
    document.getElementById('fk_addCancel').click();
    await bekle(150);

    fikirEkle('Sabah ışığı kubbeye ne zaman vuruyor', P.id);
    fikirEkle('Restorasyon ekibi', P.id);
    renderFikirler();
    await bekle(150);
    const kartSayisi = document.querySelectorAll('.fk-card[data-fk-card]').length;

    // --- Renk kimlikten: iki cizimde ayni ---
    const renk1 = [...document.querySelectorAll('.fk-card[data-fk-card]')].map(x=>x.className);
    renderFikirler(); await bekle(100);
    const renk2 = [...document.querySelectorAll('.fk-card[data-fk-card]')].map(x=>x.className);
    const renkKarali = JSON.stringify(renk1) === JSON.stringify(renk2);

    // --- ARAMA ---
    const ara = document.getElementById('fk_search');
    ara.value = 'metokhites'; ara.dispatchEvent(new Event('input'));
    await bekle(150);
    const aramaSonuc = document.querySelectorAll('.fk-card[data-fk-card]').length;
    // Proje adiyla da bulunmali
    ara.value = 'kariye'; ara.dispatchEvent(new Event('input'));
    await bekle(150);
    const projeAdiylaArama = document.querySelectorAll('.fk-card[data-fk-card]').length;
    ara.value = ''; ara.dispatchEvent(new Event('input'));
    await bekle(120);

    // --- PROJE FILTRESI ---
    const fil = document.getElementById('fk_filter');
    const filtreIlkSecenek = fil.options[0].textContent;
    fil.value = '-'; fil.dispatchEvent(new Event('change'));
    await bekle(150);
    const projesizAdet = document.querySelectorAll('.fk-card[data-fk-card]').length;
    // Acilir liste artik "sec" degil "EKLE": secilenler cip olarak
    // birikiyor. Ikinci projeyi olcmeden once cipler temizleniyor.
    fikirFiltreleri = []; renderFikirler();
    await bekle(120);
    fil.value = P.id; fil.dispatchEvent(new Event('change'));
    await bekle(150);
    const projeliAdet = document.querySelectorAll('.fk-card[data-fk-card]').length;
    fikirFiltreleri = []; renderFikirler();
    await bekle(120);

    // --- BIRLESTIRME ---
    const liste = fikirSiraliListe();
    const hedefId = liste[0].id, kaynakId = liste[1].id;
    const kaynakMetin = liste[1].text;
    fikirBirlestir(hedefId, kaynakId);
    renderFikirler(); await bekle(150);
    const birlesme = {
      adet: fikirler.length,
      parca: fikirById(hedefId).parts.length,
      metinIceriyor: fikirById(hedefId).text.includes(kaynakMetin),
      kaynakGitti: !fikirById(kaynakId),
      mezarTasi: fikirRemoved.has(kaynakId),
      ekrandaBirlesik: document.querySelectorAll('.fk-card.birlesik').length,
      ayirDugmesi: !!document.querySelector('[data-fk-split]')
    };

    // --- AYIRMA: birlesmeden ONCEKI hale donmeli ---
    fikirAyir(hedefId);
    renderFikirler(); await bekle(150);
    const ayirma = {
      adet: fikirler.length,
      kaynakGeriGeldi: !!fikirById(kaynakId),
      kaynakMetni: fikirById(kaynakId) && fikirById(kaynakId).text,
      hedefTekParca: fikirById(hedefId).parts.length === 1,
      mezarTasiKalkti: !fikirRemoved.has(kaynakId)
    };

    // --- SIRALAMA ---
    const s = fikirSiraliListe();
    const sonId = s[s.length-1].id;
    fikirSirala(sonId, s[0].id, true);
    const siraDegisti = fikirSiraliListe()[0].id === sonId;

    // --- YEREL KAYIT: parcalar ve sira duruyor mu ---
    const yerel = JSON.parse(localStorage.getItem('demo_ideas') || '[]');
    const yereldeParca = yerel.every(x=> Array.isArray(x.parts) && x.parts.length >= 1);
    const yereldeSira = yerel.every(x=> typeof x.sort === 'number');

    return { kapaliHal, acikHal, varsayilanProje, ilkFikir, enterEkledi, shiftEklemedi,
             kartSayisi, renkKarali, aramaSonuc, projeAdiylaArama, filtreIlkSecenek,
             projesizAdet, projeliAdet, birlesme, ayirma, siraDegisti,
             yereldeParca, yereldeSira };
  });

  k('Kapalıyken sadece ekleme kartı var', r.kapaliHal.ekleKarti && !r.kapaliHal.alan, r.kapaliHal);
  k('Tıklayınca yazma alanı açılıyor', r.acikHal.alan && r.acikHal.sel, r.acikHal);
  k('VARSAYILAN PROJE BOŞ', r.varsayilanProje === '', r.varsayilanProje);
  k('Fikir ekleniyor, projesiz', r.ilkFikir.adet===1 && r.ilkFikir.bag==='', r.ilkFikir);
  k('Ekledikten sonra kart açık kalıyor', r.ilkFikir.acikKaldi===true);
  k('Enter ekliyor', r.enterEkledi===true);
  k('Shift+Enter eklemiyor (satır atlıyor)', r.shiftEklemedi===true);
  k('Dört kart çizildi', r.kartSayisi===4, r.kartSayisi);
  k('Kart rengi kimlikten — çizimler arası kararlı', r.renkKarali===true);
  k('Arama metinde çalışıyor', r.aramaSonuc===1, r.aramaSonuc);
  k('Arama proje adında da çalışıyor', r.projeAdiylaArama===2, r.projeAdiylaArama);
  k('Filtre "proje ekle" diyor', /ekle/i.test(r.filtreIlkSecenek), r.filtreIlkSecenek);
  k('Projesiz filtresi doğru', r.projesizAdet===2, r.projesizAdet);
  k('Proje filtresi doğru', r.projeliAdet===2, r.projeliAdet);
  k('BİRLEŞTİRME: iki kart bir kart oldu', r.birlesme.adet===3 && r.birlesme.parca===2, r.birlesme);
  k('Birleşen metin korundu', r.birlesme.metinIceriyor===true);
  k('Kaynak kart kalktı', r.birlesme.kaynakGitti===true);
  k('Ekranda birleşik olarak görünüyor', r.birlesme.ekrandaBirlesik===1 && r.birlesme.ayirDugmesi, r.birlesme);
  k('AYIRMA: kart sayısı geri döndü', r.ayirma.adet===4, r.ayirma);
  k('Ayrılan fikir AYNI kimlikle geri geldi', r.ayirma.kaynakGeriGeldi===true);
  k('Metni birleşmeden önceki hali', r.ayirma.kaynakMetni && r.ayirma.kaynakMetni.length>0, r.ayirma.kaynakMetni);
  k('Hedef tek parçaya döndü', r.ayirma.hedefTekParca===true);
  k('MEZAR TAŞI KALKTI (bulutta geri gelir)', r.ayirma.mezarTasiKalkti===true);
  k('Sürükleyerek sıralama çalışıyor', r.siraDegisti===true);
  k('Parçalar tarayıcıya yazılıyor', r.yereldeParca===true);
  k('Sıra tarayıcıya yazılıyor', r.yereldeSira===true);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
