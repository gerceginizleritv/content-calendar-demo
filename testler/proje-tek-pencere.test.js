// Yeni proje ve Projeyi düzenle ARTIK TEK PENCERE.
// Kullanıcının şikâyeti: "oluşturma ekranında olmayan başlıklar düzenlemede
// çıkıyor, iki farklı yer gibi ama aslında tek bir alan olmalı."
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
  console.log('PROJE — TEK PENCERE');

  const r = await page.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    window.onayla = ()=> Promise.resolve(false);   // termin sorusuna "hayır"
    mekanlar = [ mekanTemizle({ id:'m1', name:'Kariye', city:'İstanbul', district:'Fatih',
                                address:'Dervişali', permission:'Müze izni' }) ];
    saveMekanlar(); projects = []; saveProjects(); setPage('projects'); renderProjects();
    await bekle(200);

    // Eski "Yeni proje" penceresi tamamen kalktı mı?
    const eskiPencere = !!document.getElementById('projectNewOverlay');
    const anahtarKelime = !!document.getElementById('pe_keywords');

    openProjectNew();
    await bekle(250);
    const varMi = id => !!document.getElementById(id) && !document.getElementById(id).hidden;
    const yeniHal = {
      baslik: document.getElementById('pe_baslik').textContent,
      kaydet: document.getElementById('pe_save').textContent,
      silGizli: document.getElementById('pe_delete').hidden,
      iptalGizli: document.getElementById('pe_cancelWrap').hidden,
      // Düzenlemede olan HER BAŞLIK oluştururken de var
      saha: varMi('pe_fieldFold'), fikir: varMi('pe_ideas'), script: varMi('pe_script'),
      liste: varMi('pe_liste'), termin: varMi('pe_deadlines'),
      mekanSecici: varMi('pe_placeSecenek'), arama: varMi('pe_placeAra')
    };

    // Oluştururken SAHA DETAYLARI da doldurulabiliyor
    document.getElementById('pe_name').value = 'Kariye Mozaikleri';
    // Stüdyo işi: adres sorusu çıkmasın (o soruya "hayır" diyen stub var).
    document.getElementById('pe_type').value = 'studio';
    document.getElementById('pe_fieldFold').open = true;
    const g = (id,v)=>{ const el=document.getElementById(id); el.value=v; el.dispatchEvent(new Event('input')); };
    g('pe_shotList','Giriş çekimi, kubbe detayı');
    g('pe_cautions','Tripod içeride yasak');
    document.getElementById('pe_save').click();
    await bekle(450);
    const kapandi = !document.getElementById('projectEditOverlay').classList.contains('open');
    const p1 = projects[0] || null;

    // Aynı projeyi açınca: düzenleme hali
    openProjectEdit(p1.id);
    await bekle(250);
    const duzenleHal = {
      baslik: document.getElementById('pe_baslik').textContent,
      kaydet: document.getElementById('pe_save').textContent,
      silGorunur: !document.getElementById('pe_delete').hidden,
      iptalGorunur: !document.getElementById('pe_cancelWrap').hidden,
      cekilecek: document.getElementById('pe_shotList').value,
      sayac: document.getElementById('pe_fieldCount').textContent
    };
    closeProjectEdit();
    await bekle(150);

    // YENİ projede "Çekim listesi" düğmesi: önce projeyi oluşturuyor,
    // sonra listeyi açıyor. Kullanıcı iki adımda düşünmek zorunda kalmıyor.
    openProjectNew();
    await bekle(200);
    document.getElementById('pe_name').value = 'Azapkapı';
    projeMekanEkle('pe', 'm1');
    document.getElementById('pe_liste').click();
    await bekle(500);
    const listeAcildi = document.getElementById('cekimListesiOverlay').classList.contains('open');
    const azapkapi = projects.find(x=> x.name === 'Azapkapı') || null;
    // Mekandan gelen izin maddesi listede
    const listeMaddeleri = azapkapi ? projeListesi(azapkapi).map(x=>x.metin) : [];
    cekimListesiKapat();
    await bekle(150);

    // Vazgeç yeni projeyi OLUŞTURMUYOR
    const oncekiAdet = projects.length;
    openProjectNew();
    await bekle(200);
    document.getElementById('pe_name').value = 'Kaydedilmeyecek';
    document.getElementById('pe_cancel').click();
    await bekle(200);
    const vazgecAdet = projects.length;

    return { eskiPencere, anahtarKelime, yeniHal, kapandi,
             ad: p1 && p1.name, cekilecek: p1 && p1.shotList, duzenleHal,
             listeAcildi, azapkapiVar: !!azapkapi, listeMaddeleri,
             oncekiAdet, vazgecAdet };
  });

  k('eski "Yeni proje" penceresi kalktı', r.eskiPencere === false);
  k('anahtar kelimeler alanı kalktı', r.anahtarKelime === false);
  k('yeni projede başlık "Yeni proje"', /Yeni proje/.test(r.yeniHal.baslik), r.yeniHal.baslik);
  k('yeni projede düğme "Proje oluştur"', /oluştur/i.test(r.yeniHal.kaydet), r.yeniHal.kaydet);
  k('yeni projede SİL yok', r.yeniHal.silGizli === true);
  k('yeni projede "iptal edildi" yok', r.yeniHal.iptalGizli === true);
  k('yeni projede Saha detayları VAR', r.yeniHal.saha === true);
  k('yeni projede Fikirler VAR', r.yeniHal.fikir === true);
  k('yeni projede Scriptler VAR', r.yeniHal.script === true);
  k('yeni projede Çekim listesi VAR', r.yeniHal.liste === true);
  k('yeni projede Adım terminleri VAR', r.yeniHal.termin === true);
  k('yeni projede mekan seçici ve arama VAR',
     r.yeniHal.mekanSecici === true && r.yeniHal.arama === true);
  k('oluşturunca pencere kapanıyor', r.kapandi === true);
  k('proje oluştu', r.ad === 'Kariye Mozaikleri', r.ad);
  k('OLUŞTURURKEN yazılan saha alanı da kaydedildi',
     /kubbe detayı/.test(r.cekilecek || ''), r.cekilecek);
  k('düzenlemede başlık "Projeyi düzenle"', /düzenle/i.test(r.duzenleHal.baslik), r.duzenleHal.baslik);
  k('düzenlemede düğme "Kaydet"', /Kaydet/i.test(r.duzenleHal.kaydet), r.duzenleHal.kaydet);
  k('düzenlemede SİL görünüyor', r.duzenleHal.silGorunur === true);
  k('düzenlemede "iptal edildi" görünüyor', r.duzenleHal.iptalGorunur === true);
  k('saha alanı geri geliyor', /kubbe detayı/.test(r.duzenleHal.cekilecek), r.duzenleHal.cekilecek);
  k('saha sayacı doğru', /2 dolu/.test(r.duzenleHal.sayac), r.duzenleHal.sayac);
  k('yeni projede "Çekim listesi" projeyi oluşturup listeyi açıyor',
     r.azapkapiVar && r.listeAcildi, { proje:r.azapkapiVar, liste:r.listeAcildi });
  k('mekanın izni listeye düştü', r.listeMaddeleri.indexOf('Müze izni') !== -1, r.listeMaddeleri);
  k('Vazgeç proje oluşturmuyor', r.vazgecAdet === r.oncekiAdet, { once:r.oncekiAdet, sonra:r.vazgecAdet });

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close();
  process.exit(hata ? 1 : 0);
})();
