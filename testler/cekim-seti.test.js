// Hazır setler: çekim tipine göre malzeme paketleri.
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
  console.log('HAZIR SETLER');

  const r = await page.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    localStorage.removeItem('demo_ihtiyaclar');
    localStorage.removeItem('demo_ihtiyac_setleri');
    ihtiyaclar = []; ihtiyacSetleri = [];
    mekanlar = []; saveMekanlar();
    const bos = { type:'studio', keywords:'', notes:'', address:'', script:false, filmed:false,
      edited:false, approved:false, published:false, permission:'', cancelled:false,
      deadlines:{}, cautions:'', checklist:[] };
    projects = [{ ...bos, id:'p1', name:'Sokak videosu', createdAt:Date.now() },
                { ...bos, id:'p2', name:'İkinci video', createdAt:Date.now() }];
    saveProjects();
    setPage('projects'); renderProjects();
    await bekle(200);

    // Kütüphaneyi kur
    cekimListesiAc('p1');
    await bekle(150);
    ihtiyacPenceresiAc();
    await bekle(150);
    ['Osmo Action 4','Gimbal','Yedek pil','Makyaj çantası'].forEach(ad=>{
      document.getElementById('ih_yeniAd').value = ad;
      document.getElementById('ih_yeniGrup').value = 'Kamera';
      document.getElementById('ih_yeniBtn').click();
    });
    await bekle(200);
    const listeBasta = projeListesi(projectById('p1')).length;

    // Makyaj çantasını listeden çıkar: set SADECE seçili olanlardan yapılmalı
    const makyaj = projeListesi(projectById('p1')).find(x=>x.metin === 'Makyaj çantası');
    projeListesiYaz(projectById('p1'), projeListesi(projectById('p1')).filter(x=>x.id !== makyaj.id));
    ihtiyacListesiCiz();
    await bekle(100);

    // Set yap (sor() penceresi açılıyor, adı yazıp Tamam)
    document.getElementById('ih_setYap').click();
    await bekle(200);
    const sorAcik = document.getElementById('dlgOverlay').classList.contains('open');
    document.getElementById('dlgInput').value = 'Sokak çekimi seti';
    document.getElementById('dlgOk').click();
    await bekle(250);
    const setSayisi = ihtiyacSetleri.length;
    const setAdi = setSayisi ? ihtiyacSetleri[0].ad : '';
    const setMaddeleri = setSayisi ? ihtiyacSetleri[0].maddeler.slice() : [];
    const cipMetni = (document.querySelector('#ih_setler .ih-set')||{}).textContent || '';
    const yereldeSet = JSON.parse(localStorage.getItem('demo_ihtiyac_setleri') || '[]');

    document.getElementById('ih_bitti').click(); await bekle(100);
    document.getElementById('cl_bitti').click(); await bekle(150);

    // İKİNCİ projede set tek tıkla düşüyor mu
    cekimListesiAc('p2');
    await bekle(150);
    ihtiyacPenceresiAc();
    await bekle(150);
    const ikinciBoslukta = projeListesi(projectById('p2')).length;
    document.querySelector('#ih_setler .ih-set[data-set-ekle]').click();
    await bekle(200);
    const ikinciDolu = projeListesi(projectById('p2')).map(x=>x.metin);
    const notMetni = document.getElementById('ih_topluNot').textContent;
    // İkinci kez basınca ikilenmiyor
    document.querySelector('#ih_setler .ih-set[data-set-ekle]').click();
    await bekle(200);
    const ikinciTekrar = projeListesi(projectById('p2')).length;

    // Seti sil: maddeler kütüphanede kalıyor
    let soruldu = false;
    document.querySelector('#ih_setler .ih-set-sil').click();
    await bekle(200);
    soruldu = document.getElementById('dlgOverlay').classList.contains('open');
    document.getElementById('dlgOk').click();
    await bekle(200);
    const setKalmadi = ihtiyacSetleri.length === 0;
    const kutuphaneDuruyor = ihtiyaclar.length;

    return { listeBasta, sorAcik, setSayisi, setAdi, setMaddeleri, cipMetni,
             yereldeSetSayisi: yereldeSet.length, ikinciBoslukta, ikinciDolu, notMetni,
             ikinciTekrar, soruldu, setKalmadi, kutuphaneDuruyor };
  });

  k('kütüphaneye eklenen madde listeye de giriyor', r.listeBasta === 4, r.listeBasta);
  k('set adı soruluyor', r.sorAcik);
  k('set kaydedildi', r.setSayisi === 1 && r.setAdi === 'Sokak çekimi seti', r.setAdi);
  k('set SADECE listedeki malzemeden yapılıyor',
     r.setMaddeleri.length === 3 && r.setMaddeleri.indexOf('Makyaj çantası') === -1, r.setMaddeleri);
  k('çip adı ve sayıyı gösteriyor', /Sokak çekimi seti/.test(r.cipMetni) && /3/.test(r.cipMetni), r.cipMetni.trim());
  k('set tarayıcıya yazılıyor', r.yereldeSetSayisi === 1);
  k('ikinci proje boş başlıyor', r.ikinciBoslukta === 0);
  k('set tek tıkla listeye düşüyor', r.ikinciDolu.length === 3, r.ikinciDolu);
  k('kaç madde eklendiği söyleniyor', /3/.test(r.notMetni), r.notMetni);
  k('ikinci tık madde İKİLEMİYOR', r.ikinciTekrar === 3, r.ikinciTekrar);
  k('set silinmeden önce soruluyor', r.soruldu);
  k('set silindi', r.setKalmadi);
  k('set silmek KÜTÜPHANEYİ bozmuyor', r.kutuphaneDuruyor === 4, r.kutuphaneDuruyor);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close();
  process.exit(hata ? 1 : 0);
})();
