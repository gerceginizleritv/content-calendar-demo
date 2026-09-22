// OTOMATIK STORY YAYINI — arayuz (sartname Bolum 10).
//
// Ekranda gosterilen sey worker'in yazdigi durum. Bu testin asil isi
// gorunumu degil, ICINDEN GECTIGI BORUYU olcmek: bu depoda ayni sinif
// hata uc kez yasandi ve ucunde de kayip SESSIZDI.
//
//   · cok dilli baslik  -> sanitizeEvent beyaz listesinde yoktu, her
//                          yuklemede dusuyordu
//   · MCP bayragi       -> prefs satiri butun olarak yeniden yaziliyordu
//   · yayin durumu      -> ayni tuzak, bu sefer onlendi
//
// UC OLCU:
//   1. toRow yayin sutunlarini GONDERMIYOR. Gonderseydi tarayicidaki
//      bayat kopya, worker'in yazdigi durumu ezerdi.
//   2. sanitizeEvent yayin bilgisini DUSURMUYOR. Duserdi ise kayit
//      acildiginda "otomatik kapali, dosya yok" gorunurdu -- sistem
//      yayinlamaya devam ediyorken.
//   3. uploaded ile durum AYRI. Kullanicinin isareti ile sistemin
//      durumu ayni yerden okunursa kural kagit uzerinde kalir.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1250,height:950} });
  const hatalar=[];
  page.on('pageerror', e=>hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });

  let hata=0;
  const k=(ad,s,ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('OTOMATIK STORY YAYINI — ARAYUZ');

  // ---- 1. BORU: toRow ve sanitizeEvent ------------------------------------
  console.log('[boru]');
  const boru = await page.evaluate(()=>{
    const satir = {
      id:'ev_oto', user_id:'u', type:'story', platform:'instagram', title:'Story',
      post_date:'2026-12-20', post_time:'11:53:00', uploaded:false, content:{ timezone:'Europe/Istanbul' },
      auto_publish:true, publish_state:'published', published_at:'2026-12-20T08:53:00Z',
      media_name:'2026-12-20_story_sokollu_k1.mp4', media_bytes:12582912,
      media_url:'https://medya.test/a.mp4', last_error:null, attempt_count:1,
      publish_at:'2026-12-20T08:53:00Z', workspace_id:null, project_id:null
    };
    const e = fromRow(satir);
    const temiz = sanitizeEvent(e);
    const geri = toRow(temiz, 'u');
    return {
      okundu: e.yayin,
      temizKaldi: temiz.yayin,
      geriAlanlar: Object.keys(geri),
      sifirdanTemiz: sanitizeEvent({ id:'x', type:'story', platform:'instagram',
        date:'2026-12-20', time:'11:53', yayin:{ otomatik:true, durum:'failed', dosya:'a.mp4',
        bayt:5, medyaVar:true, yayinAn:'', yayinlandi:'', hata:'#100 bozuk', deneme:3 } }).yayin
    };
  });
  k('satırdan okunuyor', !!boru.okundu && boru.okundu.otomatik === true
     && boru.okundu.durum === 'published', JSON.stringify(boru.okundu));
  k('dosya adı ve boyutu taşınıyor',
     boru.okundu && boru.okundu.dosya === '2026-12-20_story_sokollu_k1.mp4' && boru.okundu.bayt === 12582912);
  k('★ sanitizeEvent DÜŞÜRMÜYOR', !!boru.temizKaldi && boru.temizKaldi.durum === 'published',
     JSON.stringify(boru.temizKaldi));
  k('★ sanitizeEvent yerel kopyadan gelen bilgiyi de koruyor',
     !!boru.sifirdanTemiz && boru.sifirdanTemiz.durum === 'failed' && boru.sifirdanTemiz.deneme === 3,
     JSON.stringify(boru.sifirdanTemiz));
  // ASIL OLCU. Bu alanlardan biri toRow'a girerse, kullanici kaydi acip
  // kaydettiginde worker'in yazdigi durum sessizce geri sarar.
  const yasak = ['auto_publish','publish_state','published_at','media_name','media_bytes',
                 'media_url','media_mime','publish_at','external_id','last_error',
                 'attempt_count','publish_ref','publish_called_at','retry_after'];
  const sizan = yasak.filter(a=> boru.geriAlanlar.includes(a));
  k('★ toRow yayın sütunlarını GÖNDERMİYOR', sizan.length === 0, sizan.join(', ') || 'temiz');
  k('toRow beklenen alanları hâlâ gönderiyor',
     ['id','type','platform','title','post_date','post_time','uploaded','content'].every(a=> boru.geriAlanlar.includes(a)),
     boru.geriAlanlar.join(','));

  // ---- 2. Kayit penceresi -------------------------------------------------
  console.log('[kayıt penceresi]');
  const gorunum = await page.evaluate(async (satir)=>{
    // Kayitlari kendimiz kuruyoruz: demo verisinden bagimsiz olsun.
    // Tarih BUGUN: takvim icinde bulunulan haftayi ciziyor, baska bir
    // aya konan kaydin cipi hic olusmaz ve nokta olculemez.
    satir.post_date = fmtKey(new Date());
    events.length = 0;
    events.push(sanitizeEvent(fromRow(satir)));
    events.push(sanitizeEvent(fromRow(Object.assign({}, satir, {
      id:'ev_bekleyen', title:'OTO-BEKLEYEN', publish_state:'pending', published_at:null,
      media_name:null, media_bytes:null, media_url:null, attempt_count:0 }))));
    events.push(sanitizeEvent(fromRow(Object.assign({}, satir, {
      id:'ev_hatali', title:'OTO-HATALI', publish_state:'failed', published_at:null,
      last_error:'#100 The video file could not be fetched', attempt_count:3 }))));
    events.push(sanitizeEvent(fromRow(Object.assign({}, satir, {
      id:'ev_video', title:'OTO-VIDEO', type:'video', auto_publish:false }))));
    renderCal();

    const oku = (id)=>{
      openModal(events.find(e=> e.id === id));
      const kap = document.getElementById('otoYayinWrap');
      return { gizli: kap.hidden,
               isaretli: document.getElementById('otoYayinToggle').dataset.val === '1',
               metin: document.getElementById('otoYayinDurum').textContent };
    };
    const y = oku('ev_oto'), bek = oku('ev_bekleyen'), ht = oku('ev_hatali'), vd = oku('ev_video');
    openModal(null);
    // Yeni kayitta tur COKLU kutulardan geliyor. Story isaretli degilken
    // blogun gizli olmasi DOGRU: o kayit bir story olmayacak.
    const yeniStorysiz = document.getElementById('otoYayinWrap').hidden;
    const kutu = document.querySelector('#typeChecks input[value="story"]');
    if(kutu){ kutu.checked = true; otoYayinTazele(); }
    const yeni = { gizli: document.getElementById('otoYayinWrap').hidden,
                   storysiz: yeniStorysiz,
                   metin: document.getElementById('otoYayinDurum').textContent };
    closeModal();
    return { y, bek, ht, vd, yeni,
             noktalar: [...document.querySelectorAll('.ev-yayin')].map(n=> n.className) };
  }, {
    id:'ev_oto', user_id:'u', type:'story', platform:'instagram', title:'OTO-YAYINLANAN',
    post_date:'2026-12-20', post_time:'11:53:00', uploaded:false, content:{ timezone:'Europe/Istanbul' },
    auto_publish:true, publish_state:'published', published_at:'2026-12-20T08:53:00Z',
    media_name:'2026-12-20_story_sokollu_k1.mp4', media_bytes:12582912,
    media_url:'https://medya.test/a.mp4', last_error:null, attempt_count:1,
    publish_at:'2026-12-20T08:53:00Z', workspace_id:null, project_id:null
  });

  k('story kaydında görünüyor', gorunum.y.gizli === false);
  k('video kaydında GÖRÜNMÜYOR', gorunum.vd.gizli === true);
  k('kutucuk auto_publish’i yansıtıyor', gorunum.y.isaretli === true);
  k('yayınlandı durumu yazıyor', /Yayınland|Published/.test(gorunum.y.metin), gorunum.y.metin.slice(0,60));
  k('dosya adı ve MB görünüyor',
     /sokollu_k1\.mp4/.test(gorunum.y.metin) && /12\.0/.test(gorunum.y.metin), gorunum.y.metin.slice(0,120));
  k('dosya yokken sebebi yazıyor',
     /bağlı değil|No file linked/.test(gorunum.bek.metin), gorunum.bek.metin.slice(0,80));
  k('bekleyen kayıt "bekliyor" diyor', /Bekliyor|Waiting/.test(gorunum.bek.metin));
  k('hatalı kayıtta Meta’nın hatası görünüyor',
     /#100/.test(gorunum.ht.metin), gorunum.ht.metin.slice(0,120));
  k('3 deneme sayılıyor', /3 deneme|3 attempts/.test(gorunum.ht.metin), gorunum.ht.metin.slice(0,120));
  // Yeni kayitta satir daha veritabaninda yok: kutucugu calisiyormus gibi
  // gostermek, isaretleyip kaydeden birinin hicbir sey olmadigini ancak
  // yayin gunu anlamasi demek olurdu.
  k('yeni kayıtta story işaretli değilse görünmüyor', gorunum.yeni.storysiz === true);
  // Satir daha veritabaninda yok, auto_publish yazilamaz. Kutucugu
  // calisiyormus gibi gostermek, isaretleyip kaydeden birinin hicbir sey
  // olmadigini ancak yayin gunu anlamasi demek olurdu.
  k('yeni kayıtta önce kaydet deniyor',
     gorunum.yeni.gizli === false && /kaydet|Save the entry/.test(gorunum.yeni.metin),
     gorunum.yeni.metin.slice(0,80));

  // ---- 3. Takvimdeki nokta ------------------------------------------------
  console.log('[takvim noktası]');
  k('yayınlanan yeşil', gorunum.noktalar.some(c=> /yayinlandi/.test(c)), gorunum.noktalar.join(' | '));
  k('hatalı kırmızı', gorunum.noktalar.some(c=> /hata/.test(c)));
  // Otomatik yayini KAPALI kayitta nokta olmamali: sistemin o kayitla
  // ilgilendigini soylemek olurdu, ilgilenmiyor.
  const kapali = await page.evaluate(()=>{
    events.forEach(e=>{ if(e.yayin) e.yayin.otomatik = false; });
    renderCal();
    return document.querySelectorAll('.ev-yayin').length;
  });
  k('★ otomatik yayın kapalıyken nokta YOK', kapali === 0, String(kapali));

  // ---- 4. uploaded ile durum ayri -----------------------------------------
  console.log('[⛔ uploaded ile durum ayrı]');
  const ayrim = await page.evaluate(()=>{
    const e = events.find(x=> x.id === 'ev_oto');
    e.yayin.otomatik = true;
    openModal(e);
    const r = { uploadedKutu: document.getElementById('uploadToggle').dataset.val,
                yayinKutu: document.getElementById('otoYayinToggle').dataset.val,
                durum: document.getElementById('otoYayinDurum').textContent };
    closeModal();
    return r;
  });
  // Kayit YAYINLANMIS ama kullanici kendi isaretini koymamis. Ikisi ayri
  // sey; sistem kullanicinin isaretine dokunmuyor (sartname Bolum 1).
  k('★ sistem yayınladı ama kullanıcının işareti DEĞİŞMEDİ', ayrim.uploadedKutu === '0', ayrim.uploadedKutu);
  k('yayın kutusu ayrı ve açık', ayrim.yayinKutu === '1');
  k('durumda "yayınlandı" yazıyor', /Yayınland|Published/.test(ayrim.durum));

  // ---- 5. Sistem yayinladi = is bitti ------------------------------------
  // Kullanici bildirdi: sistem story'yi yayinladi, ama "Yuklendi"
  // kutucugu isaretli olmadigi icin "Henuz Yuklenmemis" listesi onu
  // hala yapilacak is sayiyor ve "saati coktan gecmis" diye KIRMIZI
  // gosteriyordu. Olan bitmis bir isi bitmemis gibi gostermek.
  //
  // ⛔ Cozum uploaded'a yazmak DEGIL: sartname Bolum 1 onu yasakliyor ve
  // o alan kullanicinin kendi defteri. Cozum, "bitti mi" sorusunu
  // uploaded'a degil ISIN KENDISINE sormak.
  console.log('[sistem yayınladı = iş bitti]');
  const bitti = await page.evaluate(async ()=>{
    const e = events.find(x=> x.id === 'ev_oto');
    e.uploaded = false;                       // kullanici isaretlememis
    e.yayin.durum = 'published';              // ama sistem yayinlamis
    const bekleyenler = ()=>{
      document.getElementById('pendingBtn').click();
      const g = document.getElementById('pendingBody').textContent;
      document.getElementById('pendingOverlay').classList.remove('open');
      return g;
    };
    const listeIle = bekleyenler();
    e.yayin.durum = 'pending';
    const listeOnce = bekleyenler();
    e.yayin.durum = 'published';

    openModal(e);
    const kutu = document.getElementById('uploadToggle');
    const modal = { gorunum: kutu.classList.contains('checked'),
                    sistemIsareti: kutu.classList.contains('sistem'),
                    deger: kutu.dataset.val,
                    not: !document.getElementById('uploadSistemNot').hidden };
    // ASIL OLCU: KAYDETMEK uploaded'i degistirmemeli. saveEvent kutunun
    // dataset.val'ini okuyup uploaded'a yaziyor; gorunumu '1' yapsaydik
    // sistemin isi kullanicinin isareti olarak kaydedilirdi.
    document.getElementById('saveBtn').click();
    await new Promise(r=> setTimeout(r, 300));
    const sonra = events.find(x=> x.id === 'ev_oto');
    return { listeIle, listeOnce, modal,
             uploadedSonra: sonra ? sonra.uploaded : null,
             durumSonra: sonra && sonra.yayin ? sonra.yayin.durum : null,
             bittiMi: kayitBitti(sonra) };
  });
  k('★ yayınlanan kayıt "henüz yüklenmemiş" listesinden ÇIKTI',
     !/OTO-YAYINLANAN/.test(bitti.listeIle) && /OTO-YAYINLANAN/.test(bitti.listeOnce),
     'yayınlıyken: ' + (/OTO-YAYINLANAN/.test(bitti.listeIle) ? 'VAR' : 'yok')
     + ' · beklerken: ' + (/OTO-YAYINLANAN/.test(bitti.listeOnce) ? 'var' : 'YOK'));
  k('kayıt bitmiş sayılıyor', bitti.bittiMi === true);
  k('kutucuk bitmiş görünüyor', bitti.modal.gorunum === true);
  k('sistemin işareti kullanıcınınkinden ayırt ediliyor', bitti.modal.sistemIsareti === true);
  k('sebebi yazıyor', bitti.modal.not === true);
  // ⛔ Sartname Bolum 1.
  k('★ kaydetmek uploaded’a YAZMIYOR', bitti.uploadedSonra === false, String(bitti.uploadedSonra));
  k('yayın durumu da korunuyor', bitti.durumSonra === 'published', String(bitti.durumSonra));

  k('sayfa hatası yok', hatalar.length === 0, hatalar.slice(0,2).join(' | '));
  await b.close();
  console.log(hata ? '\n' + hata + ' KALDI' : '\nhepsi gecti');
  process.exit(hata ? 1 : 0);
})();
