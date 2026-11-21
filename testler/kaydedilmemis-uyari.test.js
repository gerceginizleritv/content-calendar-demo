// KAYDEDILMEMIS DEGISIKLIK UYARISIZ KAYBOLUYORDU (YAPILACAKLAR 77).
//
// Olculdu (21 Kasim 2026, duzeltmeden ONCE): kayit penceresinde
// basligi degistirip Vazgec / Escape / geri seridinden cikildiginda
// HICBIR SEY sorulmuyor ve yazilan metin sessizce gidiyordu --
// kayittaki baslik eski kaliyordu. Proje ve script pencerelerinde de
// ayni. `beforeunload` da yoktu. Veri kaybi sinifi bir hata.
//
// Cozum: pencere acilirken formun TEMIZ HALI aliniyor; kullanicinin
// vazgectigi yollarda yeniden alinip karsilastiriliyor ve farkliysa
// uc secenekli bir soru soruluyor: Kaydet / Kaydetmeden cik / Burada kal.
//
// ⛔ SORU `closeModal` ICINE KONULAMAZ. O fonksiyondan kaydettikten
//    sonra da, silindikten sonra da, sayfa degisiminde de geciliyor.
//    Bu test onu da olcuyor: "Kaydet" secilince pencere KAPANIYOR ve
//    ikinci bir soru CIKMIYOR.
//
// ⛔ PENCERE LISTESI ELLE YAZILMIYOR. Uygulamanin kendi
//    `KIRLI_PENCERELER` haritasi okunuyor; yeni bir pencere
//    eklenirse asagidaki "acici" tablosu eksik kalir ve test onu
//    soyler (CLAUDE.md 7/8: listeyi kendi bulan bekci).
//
// ⚠ Playwright gercek bir telefon degil (CLAUDE.md 8): dokunma
//   noktalari `elementFromPoint` ile olculuyor, kutu okunmuyor.
//   Son soz 71. maddedeki gercek cihaz gecisinde.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';

let g = 0, k = 0;
const bak = (ad, ko, ek)=>{
  if(ko){ g++; console.log('  ok  ' + ad); }
  else { k++; console.log('  YOK ' + ad + (ek !== undefined ? ' -> ' + ek : '')); }
};

async function ac(t, w, dil){
  const c = await t.newContext({ viewport:{ width:w, height:900 },
                                 isMobile:w < 700, hasTouch:w < 700 });
  const p = await c.newPage();
  await p.addInitScript((d)=>{ try{
    localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_tour_done','1');
    localStorage.setItem('demo_ui_language', d);
  }catch(e){} }, dil || 'tr');
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());
  const hata = [];
  p.on('pageerror', e=> hata.push(String(e && e.message || e)));
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
  });
  return { p, hata };
}

// Sayfayi acan ve "gercek alanini" degistiren adimlar. Siniflari elle
// eklemek yetmiyor: proje sayfasi `#projectsPage`in icine TASINIYOR.
// ⚠ `openModal` NESNE aliyor, id DEGIL -- id gecilince bos bir YENI
//   kayit formu aciliyor ve olculen sey o kaydin formu olmuyor.
const SENARYO = {
  editOverlay: {
    alan: '#f_title', kaydet: '#dlgOk',
    cikislar: { vazgec: '#cancelBtn', geri: '#ev_geri', escape: 'ESCAPE' },
    ac: async (p)=>{
      await p.evaluate(()=>{
        const d = new Date(); d.setHours(0,0,0,0);
        events = [{ id:'e77', date:fmtKey(d), time:'10:00', platform:'instagram',
                    type:'story', title:'Ilk baslik', projectId: projects[0].id,
                    content:{}, publish_state:'planned' }];
        setPage('calendar');
      });
      await p.waitForTimeout(300);
      await p.evaluate(()=> openModal(events.find(e=> e.id === 'e77')));
      await p.waitForTimeout(600);
    },
    kayitOku: (p)=> p.evaluate(()=> (events[0] || {}).title)
  },
  projectEditOverlay: {
    alan: '#pe_name', kaydet: '#dlgOk',
    cikislar: { vazgec: '#pe_cancel', geri: '#pe_geri' },
    ac: async (p)=>{
      await p.evaluate(()=> setPage('projects'));
      await p.waitForTimeout(400);
      await p.click('#p_openNew');
      await p.waitForTimeout(700);
    }
  },
  scriptOverlay: {
    alan: '#sc_title', kaydet: '#dlgOk',
    cikislar: { vazgec: '#sc_cancel', geri: '#sc_geri' },
    ac: async (p)=>{
      await p.evaluate(()=> openScript(null));
      await p.waitForTimeout(700);
    }
  }
};

const dlgAcik = (p)=> p.evaluate(()=>
  document.getElementById('dlgOverlay').classList.contains('open'));
const pencereAcik = (p, id)=> p.evaluate((x)=>
  document.getElementById(x).classList.contains('open'), id);
const temizle = async (p)=>{
  await p.evaluate(async ()=>{
    const bekle = ms=> new Promise(z=> setTimeout(z, ms));
    let n = 0;
    while(document.getElementById('dlgOverlay').classList.contains('open') && n++ < 6){
      document.getElementById('dlgCancel').click(); await bekle(180);
    }
    document.querySelectorAll('.open').forEach(o=> o.classList.remove('open'));
    document.body.classList.remove('sheet-open','menu-open');
  });
  await p.waitForTimeout(250);
};
// \u26d4 DIYALOG DUGMESINE DOGRUDAN TIKLANMIYOR. Mutasyon denemesinde
//    ("kirliMi hep false") diyalog HIC acilmadi, dogrudan tiklama
//    zaman asimina dustu ve test CODU -- hata temiz bir "YOK" olarak
//    degil Node yigin izi olarak cikti. Yokluk artik VERI olarak
//    donuyor ve iddia ediliyor.
// \u26d4 TESTIN KENDI ALAN OKUYUCUSU. Beklentiyi uygulamanin kendi
//    `formHaritasi`sindan TURETMEK DONGUSELDI: mutasyon denemesinde
//    (`data-kirli-sayma` yok sayildi) uygulamanin "sayilan alan"
//    tanimi degisti, testin beklentisi de onunla degisti ve mutasyon
//    176/0 ile KACTI. Artik karar burada veriliyor:
//      · kimlik semasi uygulamayla ayni (id / name / data-* + value),
//      · ama "degisiklik var mi" kurali TESTIN kendi kurali:
//        yalnizca IKI OLCUMDE DE DURAN alanlarin degerleri.
//    DOM'dan cikan alan sayilmiyor -- suzgec listeyi daraltinca
//    "degisti" demek yanlis olurdu (M7 mutasyonu tam bunu yapiyor).
const alanlariOku = (p, kapId, haricSec)=> p.evaluate(([id, h])=>{
  const kap = document.getElementById(id);
  const kutu = kap && kap.querySelector(':scope > .modal');
  const out = {};
  if(!kutu) return out;
  kutu.querySelectorAll('input, textarea, select').forEach(el=>{
    if(el.closest('.modal') !== kutu) return;
    if(h && el.matches(h)) return;
    const nitelik = Object.keys(el.dataset).sort()
      .map(x=> x + '=' + el.dataset[x]).join(',');
    const kimlik = el.id || el.name || (nitelik + ':' + (el.value || ''));
    out[kimlik] = (el.type === 'checkbox' || el.type === 'radio')
      ? (el.checked ? '1' : '0') : el.value;
  });
  return out;
}, [kapId, haricSec]);

const dlgBas = (p, id)=> p.evaluate((x)=>{
  const ov = document.getElementById('dlgOverlay');
  if(!ov.classList.contains('open')) return 'diyalog kapali';
  const el = document.getElementById(x);
  if(!el) return 'dugme yok';
  if(el.hidden) return 'dugme gizli';
  const r = el.getBoundingClientRect();
  if(r.width < 1 || r.height < 1) return 'dugme olcusuz';
  el.click();
  return 'ok';
}, id);

const yaz = (p, sec, deger)=> p.evaluate(([s, d])=>{
  const el = document.querySelector(s);
  if(!el) return false;
  el.value = d;
  el.dispatchEvent(new Event('input', { bubbles:true }));
  return true;
}, [sec, deger]);
const cik = async (p, yol)=>{
  if(yol === 'ESCAPE'){
    await p.evaluate(()=> document.dispatchEvent(
      new KeyboardEvent('keydown', { key:'Escape', bubbles:true })));
  } else {
    const var_ = await p.evaluate((s)=>{
      const el = document.querySelector(s);
      if(!el) return false;
      el.click(); return true;
    }, yol);
    if(!var_) return false;
  }
  await p.waitForTimeout(450);
  return true;
};

(async ()=>{
  const t = await chromium.launch({});
  try{

  // ⚠ DAVRANIS TEK GENISLIKTE, DUZEN UC GENISLIKTE. Ilk surum butun
  //   matrisi 360 ve 375'te kosuyordu ve test tek basina 112 SANIYE
  //   suruyordu; `hizli.sh` uc isciyle paralel kostugu icin 200
  //   saniyelik tavana dayanma riski vardi (zaman asimi = sebebi
  //   olmayan bir kirmizi). Davranis genislige bagli degil; genislige
  //   bagli olan DUZEN, o da asagida 360/375/390'da olculuyor.
  for(const w of [375]){
    console.log('\n[' + w + 'px]');
    const { p, hata } = await ac(t, w);

    // Pencere listesi uygulamanin kendisinden okunuyor.
    const pencereler = await p.evaluate(()=> Object.keys(KIRLI_PENCERELER));
    bak('KIRLI_PENCERELER okunuyor', pencereler.length >= 3, JSON.stringify(pencereler));
    const senaryosuz = pencereler.filter(id=> !SENARYO[id]);
    bak('her pencerenin senaryosu tanimli', senaryosuz.length === 0, senaryosuz.join(', '));

    for(const id of pencereler){
      const S = SENARYO[id];
      if(!S) continue;

      // 1) HIC DEGISMEDEN cikis: sormamali (yanlis alarm bekcisi)
      await temizle(p); await S.ac(p);
      await cik(p, S.cikislar.vazgec);
      bak(id + ': degismeden cikista sormuyor', (await dlgAcik(p)) === false);
      bak(id + ': degismeden cikista pencere kapandi',
          (await pencereAcik(p, id)) === false);

      // 1b) \u26d4 TEMIZ CIKIS AYNI TIKTE OLMALI. Ilk surum korumayi
      //     `await` ile bekliyordu: soru olmasa bile kapanis bir
      //     mikro-goreve erteleniyordu. `akis.test.js` bunu TESADUFEN
      //     yakaladi (Vazgec'ten hemen sonraki `setPage` pencere hala
      //     acikken kostu, script silme hic olmadi). Tesadufe
      //     birakilmasin diye kendi bekcisi burada: tiklamadan SONRA
      //     hic beklemeden okunuyor.
      if(S.cikislar.vazgec !== 'ESCAPE'){
        await temizle(p); await S.ac(p);
        const senkron = await p.evaluate(([kapId, sec])=>{
          const kap = document.getElementById(kapId);
          const dug = document.querySelector(sec);
          if(!kap || !dug) return { yok:true };
          dug.click();
          return { kapandi: !kap.classList.contains('open') };
        }, [id, S.cikislar.vazgec]);
        bak(id + ': temiz cikis ayni tikte kapaniyor',
            senkron.kapandi === true, JSON.stringify(senkron));
      }

      // 2) Her cikis yolunda SORUYOR ve pencere ACIK kaliyor
      for(const [ad, yol] of Object.entries(S.cikislar)){
        await temizle(p); await S.ac(p);
        bak(id + '/' + ad + ': alan bulundu', await yaz(p, S.alan, 'DEGISTI ' + ad));
        await p.waitForTimeout(120);
        bak(id + '/' + ad + ': cikis yolu var', await cik(p, yol));
        bak(id + '/' + ad + ': soru cikti', (await dlgAcik(p)) === true);
        bak(id + '/' + ad + ': pencere hala acik', (await pencereAcik(p, id)) === true);
      }

      // 3) "Burada kal": pencere acik, yazilan metin DURUYOR
      await temizle(p); await S.ac(p);
      await yaz(p, S.alan, 'KALSIN'); await p.waitForTimeout(120);
      await cik(p, S.cikislar.vazgec);
      bak(id + ': "kal" dugmesine basilabildi', (await dlgBas(p, 'dlgCancel')) === 'ok');
      await p.waitForTimeout(350);
      bak(id + ': "kal" pencereyi acik tutuyor', (await pencereAcik(p, id)) === true);
      bak(id + ': "kal" yazilani koruyor',
          (await p.evaluate((s)=> document.querySelector(s).value, S.alan)) === 'KALSIN');

      // 4) "Kaydetmeden cik": pencere kapaniyor, IKINCI soru cikmiyor
      await cik(p, S.cikislar.vazgec);
      bak(id + ': "kaydetmeden cik" dugmesine basilabildi',
          (await dlgBas(p, 'dlgAlt')) === 'ok');
      await p.waitForTimeout(500);
      bak(id + ': "kaydetmeden cik" pencereyi kapatiyor',
          (await pencereAcik(p, id)) === false);
      bak(id + ': "kaydetmeden cik" ikinci soru sormuyor', (await dlgAcik(p)) === false);
    }

    // 5) KAYIT penceresinde "Kaydet": kayit guncelleniyor, pencere kapaniyor.
    //    ⛔ Bu, sorunun `closeModal` icine konulmadiginin kaniti: oraya
    //       konsa kaydettikten sonra YINE sorulurdu.
    await temizle(p);
    await SENARYO.editOverlay.ac(p);
    await yaz(p, '#f_title', 'KAYDEDILDI'); await p.waitForTimeout(120);
    await cik(p, '#cancelBtn');
    bak('editOverlay: "kaydet" oncesi soru cikti', (await dlgAcik(p)) === true);
    bak('editOverlay: "kaydet" dugmesine basilabildi', (await dlgBas(p, 'dlgOk')) === 'ok');
    await p.waitForTimeout(1100);
    bak('editOverlay: "kaydet" pencereyi kapatti',
        (await pencereAcik(p, 'editOverlay')) === false);
    bak('editOverlay: "kaydet" kayda yazdi',
        (await SENARYO.editOverlay.kayitOku(p)) === 'KAYDEDILDI',
        await SENARYO.editOverlay.kayitOku(p));

    // 6) SORMAMASI gereken alanlar. Liste elle yazilmiyor: arama
    //    kutulari ve `data-kirli-sayma="hayir"` isaretli alanlar
    //    pencerenin kendisinden bulunuyor.
    await temizle(p);
    const saymayan = await p.evaluate(()=>{
      const out = [];
      Object.keys(KIRLI_PENCERELER).forEach(kapId=>{
        const kutu = document.getElementById(kapId).querySelector(':scope > .modal');
        if(!kutu) return;
        kutu.querySelectorAll('input, textarea').forEach(el=>{
          if(el.closest('.modal') !== kutu) return;
          if(el.type !== 'search' && el.dataset.kirliSayma !== 'hayir') return;
          if(!el.id) return;
          out.push({ kapId, sec: '#' + el.id, tip: el.type });
        });
      });
      return out;
    });
    bak('saymayan alan bulundu (test bos gecmiyor)', saymayan.length >= 3,
        saymayan.length + ' tane');
    // \u26d4 IDDIA KESIN OLMALI, "hic sormaz" DEGIL. Ilk surum
    //    "arama kutusuna yazinca sormaz" diyordu ve DUSTU --
    //    hakliydi: kayit penceresinde proje aramasina yazmak listeyi
    //    daraltiyor ve `#f_project` secimi "+ yeni proje"ye DUSUYOR
    //    (olculdu: pr_... -> __yeni__). Yani form gercekten
    //    degisiyor; orada sormamak VERI KAYBI olurdu.
    //    Dogru iddia su: alanin KENDI yazisi sayilmaz. Kiyas
    //    sayilan alanlarin degerleri uzerinden yapiliyor: hicbiri
    //    degismediyse soru CIKMAMALI, degistiyse CIKMALI.
    // \u26a0 FIKIRLER ONCE EKLENIYOR: fikir arama kutusu ancak liste
    //    DOLUYSA suzuyor. Bos listede yazmak hicbir sey degistirmiyor
    //    ve "eski birebir kiyas" mutasyonu (M7) sinanmamis kaliyordu
    //    -- 176/0 ile kacti.
    await p.evaluate(()=>{
      fikirler = [{ id:'f1', text:'Alfa', createdAt: Date.now() },
                  { id:'f2', text:'Beta', createdAt: Date.now() },
                  { id:'f3', text:'Gama', createdAt: Date.now() }];
    });
    for(const a of saymayan){
      const S = SENARYO[a.kapId];
      if(!S) continue;
      await temizle(p); await S.ac(p);
      // Kendi okumamiz: alanin KENDISI haric, baska bir alan degisti mi?
      const once = await alanlariOku(p, a.kapId, a.sec);
      const yazildi = await yaz(p, a.sec, 'arastiriyorum');
      if(!yazildi){ bak(a.kapId + ' ' + a.sec + ': alan bulundu', false); continue; }
      await p.waitForTimeout(350);
      const sonra = await alanlariOku(p, a.kapId, a.sec);
      const degisen = Object.keys(sonra)
        .filter(k=> (k in once) && once[k] !== sonra[k])
        .map(k=> k + ': ' + once[k] + ' -> ' + sonra[k]);
      await cik(p, S.cikislar.vazgec);
      const sordu = await dlgAcik(p);
      if(degisen.length === 0){
        // Hicbir baska alan degismedi: soru CIKMAMALI.
        bak(a.kapId + ' ' + a.sec + ' (' + a.tip + '): kendi yazisi soru acmiyor',
            sordu === false);
      } else {
        // Baska bir alani gercekten degistirdi: sormak ZORUNDA.
        bak(a.kapId + ' ' + a.sec + ' (' + a.tip + '): baska alani degistirdi, soruyor',
            sordu === true, degisen.join(' | '));
      }
    }

    // 7) TERS YON: bir fikri tikle, sonra suzgecle DOM'dan cikar --
    //    yine sormali. Ilk surum yalnizca imzalari karsilastiriyordu
    //    ve bu hem bos yere soruyor hem bu hali KACIRIYORDU.
    await temizle(p);
    await p.evaluate(()=>{
      fikirler = [{ id:'f1', text:'Alfa', createdAt: Date.now() },
                  { id:'f2', text:'Beta', createdAt: Date.now() }];
    });
    await SENARYO.scriptOverlay.ac(p);
    const tikli = await p.evaluate(async ()=>{
      const bekle = ms=> new Promise(z=> setTimeout(z, ms));
      const tik = document.querySelector('#scriptOverlay [data-fikir-sec="f2"]');
      if(!tik) return { yok:true };
      tik.click(); await bekle(220);
      const ara = document.getElementById('sc_ideaSearch');
      ara.value = 'Alfa'; ara.dispatchEvent(new Event('input', { bubbles:true }));
      await bekle(350);
      return { gizlendi: !document.querySelector('#scriptOverlay [data-fikir-sec="f2"]') };
    });
    bak('fikir kutucugu bulundu', !tikli.yok, JSON.stringify(tikli));
    bak('tiklenen kutucuk suzgecle DOM dan cikti', tikli.gizlendi === true);
    await cik(p, '#sc_cancel');
    bak('gizlenmis ama DEGISTIRILMIS kutucuk icin yine soruyor',
        (await dlgAcik(p)) === true);
    await temizle(p);

    bak(w + 'px sayfa hatasi yok', hata.length === 0, hata.join(' | '));
    await p.close();
  }


  // ── DUZEN: uc dugme 360 · 375 · 390'da (CLAUDE.md 8) ──────────
  for(const w of [360, 375, 390]){
    console.log('\n[' + w + 'px duzen]');
    const { p, hata } = await ac(t, w);
    // 8) Telefon duzeni: uc dugme alt alta, 44px, kirpilma/tasma yok.
    await SENARYO.editOverlay.ac(p);
    await yaz(p, '#f_title', 'OLCUM'); await p.waitForTimeout(120);
    await cik(p, '#cancelBtn');
    const d = await p.evaluate(()=>{
      const ucu = ['dlgCancel','dlgAlt','dlgOk'].map(id=>{
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        const n = document.elementFromPoint(Math.round(r.left + r.width / 2),
                                            Math.round(r.top + r.height / 2));
        return { id, metin: el.textContent, y: Math.round(r.height),
                 ust: Math.round(r.top), gizli: el.hidden,
                 dokunus: !!(n && (n === el || el.contains(n))),
                 kirpik: el.scrollWidth > el.clientWidth + 1 };
      });
      return { ucu,
        yatayTasma: document.documentElement.scrollWidth > window.innerWidth + 1,
        serit: document.querySelector('#dlgOverlay .modal-actions').className,
        ortaKirmizi: document.getElementById('dlgAlt').classList.contains('btn-danger') };
    });
    bak('uc dugme de gorunur', d.ucu.every(x=> !x.gizli && x.y > 0),
        JSON.stringify(d.ucu.map(x=> x.id + ':' + x.gizli)));
    bak('uc dugme de 44px', d.ucu.every(x=> x.y >= 44),
        d.ucu.map(x=> x.id + '=' + x.y).join(' '));
    bak('uc dugmeye de dokunulabiliyor', d.ucu.every(x=> x.dokunus),
        d.ucu.filter(x=> !x.dokunus).map(x=> x.id).join(', '));
    bak('hicbir dugmenin yazisi kirpilmiyor', d.ucu.every(x=> !x.kirpik),
        d.ucu.filter(x=> x.kirpik).map(x=> x.id + ':' + x.metin).join(', '));
    bak('sayfa yana tasmiyor', d.yatayTasma === false);
    bak('telefonda uc dugme ALT ALTA',
        new Set(d.ucu.map(x=> x.ust)).size === 3, d.ucu.map(x=> x.ust).join('/'));
    bak('serit uc-secenek sinifini aliyor', /uc-secenek/.test(d.serit), d.serit);
    bak('yikici secenek kirmizi', d.ortaKirmizi === true);

    // 9) IKI dugmeli diyaloglar bozulmadi ve sinif/etiket ASILI KALMIYOR.
    await dlgBas(p, 'dlgCancel'); await p.waitForTimeout(300);
    await temizle(p);
    const iki = await p.evaluate(async ()=>{
      const bekle = ms=> new Promise(z=> setTimeout(z, ms));
      onayla('Silinsin mi?'); await bekle(400);
      const r = { serit: document.querySelector('#dlgOverlay .modal-actions').className,
                  ortaGizli: document.getElementById('dlgAlt').hidden,
                  ortaMetin: document.getElementById('dlgAlt').textContent,
                  ortaKirmizi: document.getElementById('dlgAlt').classList.contains('btn-danger'),
                  iptal: document.getElementById('dlgCancel').textContent };
      document.getElementById('dlgCancel').click(); await bekle(250);
      return r;
    });
    bak('iki dugmeli diyalogda orta dugme gizli', iki.ortaGizli === true);
    bak('iki dugmeli diyalogda uc-secenek sinifi yok', !/uc-secenek/.test(iki.serit), iki.serit);
    bak('orta dugmenin yazisi asili kalmiyor', iki.ortaMetin === '', '"' + iki.ortaMetin + '"');
    bak('orta dugmenin kirmizisi asili kalmiyor', iki.ortaKirmizi === false);
    bak('iptal dugmesinin yazisi geri donuyor', iki.iptal.length > 0 && iki.iptal !== 'Burada kal',
        iki.iptal);

    bak(w + 'px duzen sayfa hatasi yok', hata.length === 0, hata.join(' | '));
    await p.close();
  }

  // ── Masaustu: uc dugme TEK SATIRDA (telefon kurali sizmasin) ──────
  console.log('\n[1280px masaustu]');
  const { p: md } = await ac(t, 1280);
  await SENARYO.editOverlay.ac(md);
  await yaz(md, '#f_title', 'MASAUSTU'); await md.waitForTimeout(120);
  await cik(md, '#cancelBtn');
  bak('masaustunde de soru cikiyor', (await dlgAcik(md)) === true);
  const dm = await md.evaluate(()=> ['dlgCancel','dlgAlt','dlgOk']
    .map(id=> Math.round(document.getElementById(id).getBoundingClientRect().top)));
  bak('masaustunde uc dugme TEK SATIRDA', new Set(dm).size === 1, dm.join('/'));
  await md.close();

  // ── Her dilde metin var mi? Dil listesi SABIT YAZILMIYOR. ────────
  console.log('\n[diller]');
  const { p: dp } = await ac(t, 375);
  const diller = await dp.evaluate(()=> Object.keys(LANG));
  await dp.close();
  bak('dil listesi okundu', diller.length >= 2, diller.join(', '));
  for(const dil of diller){
    const { p: lp, hata: lh } = await ac(t, 375, dil);
    await SENARYO.editOverlay.ac(lp);
    await yaz(lp, '#f_title', 'DIL ' + dil); await lp.waitForTimeout(120);
    await cik(lp, '#cancelBtn');
    const m = await lp.evaluate(()=> ({
      acik: document.getElementById('dlgOverlay').classList.contains('open'),
      baslik: document.getElementById('dlgTitle').textContent.trim(),
      govde: document.getElementById('dlgMsg').textContent.trim(),
      not: document.getElementById('dlgNot').textContent.trim(),
      kal: document.getElementById('dlgCancel').textContent.trim(),
      cikis: document.getElementById('dlgAlt').textContent.trim(),
      kaydet: document.getElementById('dlgOk').textContent.trim()
    }));
    bak(dil + ': soru cikti', m.acik === true);
    const bos = Object.entries(m).filter(([a, v])=> a !== 'acik' && !v).map(([a])=> a);
    bak(dil + ': butun metinler dolu', bos.length === 0, bos.join(', '));
    // \u26d4 IPTAL DUGMESININ YAZISI OZEL OLMALI. "Vazgec" burada
    //    neyden vazgectigini soylemiyor -- uc secenekli soruda
    //    "Burada kal" diyor. `iptalAd` kaldirilirsa bu duser.
    const genelIptal = await lp.evaluate(()=> t('btn_cancel').trim());
    bak(dil + ': "kal" dugmesi genel Vazgec DEGIL',
        m.kal !== genelIptal, m.kal + ' / ' + genelIptal);
    bak(dil + ': "kal" sozlukten geliyor',
        m.kal === (await lp.evaluate(()=> t('kyb_kal').trim())), m.kal);
    // Sozluk anahtari eksik olsa `t()` `en`e dusuyor; o yuzden BOS
    // olmamasi yetmiyor, Ingilizce DISINDAKI dilde Ingilizce metnin
    // aynisi cikmamali.
    if(dil !== 'en'){
      bak(dil + ': metin Ingilizceden farkli',
          m.cikis !== 'Leave without saving', m.cikis);
    }
    bak(dil + ' sayfa hatasi yok', lh.length === 0, lh.join(' | '));
    await lp.close();
  }

  }catch(e){
    // Beklenmeyen hata da BASARISIZLIK: sayiya giriyor ve "test
    // cokmus mu, dusmus mu" belirsizligi kalmiyor.
    bak('beklenmeyen hata yok', false, String(e && e.message || e));
  }
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  try{ await t.close(); }catch(e){}
  process.exit(k ? 1 : 0);
})();
