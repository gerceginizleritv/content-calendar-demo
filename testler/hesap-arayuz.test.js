// HESAP ETIKETLERI — arayuz: pencere, kayit penceresindeki alan, filtre.
//
// hesap-veri.test.js veri katmanini olcuyor (temizleme, yedek, sanitize).
// Bu test kullanicinin GORDUGU uc yeri olcuyor ve ucunun de kendine ait
// bir tuzagi var:
//
//   1. Alan KOSULLU. Tek kanali olan uretici hicbir ek tik gormemeli,
//      yoksa ozellik herkesin uzerine yikilmis olur. Ama kosul fazla
//      dar olursa tam tersi olur: iki hesaptan biri SILININCE kosul
//      artik saglanmaz, alan gizlenir ve kayit hala bagli oldugu halde
//      kullanici bunu goremez, degistiremez.
//
//   2. saveEvent content'i BASTAN kuruyor. Alan gizliyken hesapId
//      acikca tasinmazsa her kaydetmede sessizce duser -- "diller" ile
//      birebir ayni hata, bir kez yasandi.
//
//   3. Filtre satiri VERIDEN turemeli, tanimli hesaplardan degil. Uc
//      hesap tanimlayip hicbirini kullanmamis birine bos bir filtre
//      gostermenin anlami yok; silinmis bir hesaba bagli kayitlar ise
//      listede DURMALI, yoksa o kayitlar filtreyle bir daha hic
//      bulunamaz.
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

  // Geri bildirim ve bulut cagrisi kaydetmeden SONRA kendiliginden bir
  // pencere aciyor ve o pencere Kaydet dugmesinin onune geciyor. Ikisi de
  // bu testin konusu degil; kendi testleri var.
  const sus = ()=> p.evaluate(()=>{
    window.maybeAskFeedback = ()=>{};
    window.maybeShowCloudNudge = ()=>{};
  });
  await sus();

  // Kaydet'e basmadan once onu ortebilecek her sey kapaniyor.
  const kaydet = async ()=>{
    await p.evaluate(()=>{
      document.querySelectorAll('.overlay.open').forEach(o=>{
        if(o.id !== 'editOverlay') o.classList.remove('open');
      });
    });
    await p.click('#saveBtn');
    await p.waitForTimeout(650);
    await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')); });
  };

  const kur = ()=> p.evaluate(()=>{
    hesaplar = [
      { id:'hs_a', name:'Gerçeğin İzleri', platform:'youtube', handle:'gercegin', url:'', notes:'' },
      { id:'hs_b', name:'Kişisel', platform:'youtube', handle:'kisisel', url:'', notes:'' },
      { id:'hs_c', name:'Marka', platform:'instagram', handle:'marka', url:'', notes:'' }
    ].map(hesapTemizle).filter(Boolean);
    saveHesaplar();
    projects = [{ id:'pr_1', name:'Deneme projesi', cancelled:false, steps:[] }];
    saveProjects();
    events = []; save();
  });

  // ---------------------------------------------------------------- pencere
  console.log('[hesap penceresi]');
  // Pencere SERITTEN aciliyor, menuden degil: bu her gun acilan bir sey
  // degil, bir kez kurulup unutulan bir ayar. Menuye sekiz numarali sekme
  // koymak alt cubukta zaten verilmis yer savasini yeniden acardi.
  const menude = await p.evaluate(()=>
    !!document.querySelector('.rail-nav #hesapEtiketBtn'));
  bak('menuye sekme OLARAK eklenmemis', menude === false);
  bak('serit baglantisi var', await p.evaluate(()=>
    !!document.querySelector('.rail-foot #hesapEtiketBtn')));

  await p.evaluate(()=>{ hesaplar = []; saveHesaplar(); });
  await p.click('#hesapEtiketBtn');
  await p.waitForTimeout(350);
  const bos = await p.evaluate(()=>({
    acik: document.getElementById('hesapOverlay2').classList.contains('open'),
    bosNot: !!document.querySelector('#hs_liste .hs-bos'),
    ekle: document.getElementById('hs_kaydet').textContent,
    vazgec: document.getElementById('hs_vazgec').hidden
  }));
  bak('pencere aciliyor', bos.acik === true);
  bak('hesap yokken bos not cikiyor', bos.bosNot === true);
  bak('dugme "Ekle" diyor', bos.ekle === 'Ekle', bos.ekle);
  bak('Vazgec gizli (yeni kayit)', bos.vazgec === true);

  // Metinler iki dilde de tanimli olmali: eksik anahtar ekranda anahtarin
  // kendisini yazar ("hs_bos") ve kimse fark etmez.
  const eksik = await p.evaluate(()=>{
    const anahtar = ['hs_btn','hs_title','hs_intro','hs_ad','hs_ad_ph','hs_platform',
      'hs_kullanici','hs_adres','hs_not','hs_not_ph','hs_ekle','hs_bos','hs_platformsuz',
      'hs_ad_gerek','hs_limit','hs_sil','hs_sil_bagli','btn_edit',
      'f_hesap_label','f_hesap_not','f_hesap_yok','f_hesap_silinmis',
      'filter_hesap','filter_hesapsiz'];
    const sonuc = {};
    ['tr','en'].forEach(dil=>{ setLanguage(dil);
      sonuc[dil] = anahtar.filter(a=>{ const v = t(a); return v === undefined || v === null || v === a; }); });
    setLanguage('tr'); return sonuc;
  });
  bak('Turkce metinlerin hepsi var', eksik.tr.length === 0, JSON.stringify(eksik.tr));
  bak('Ingilizce metinlerin hepsi var', eksik.en.length === 0, JSON.stringify(eksik.en));

  console.log('[pencereden hesap eklemek]');
  await p.fill('#hs_ad', 'Gerçeğin İzleri');
  await p.selectOption('#hs_platform', 'youtube');
  await p.fill('#hs_handle', '@gercegin');
  await p.click('#hs_kaydet');
  await p.waitForTimeout(250);
  const ekli = await p.evaluate(()=>({
    adet: hesaplar.length, ad: (hesaplar[0]||{}).name,
    handle: (hesaplar[0]||{}).handle,
    id: (hesaplar[0]||{}).id,
    kutuBos: document.getElementById('hs_ad').value === ''
  }));
  bak('hesap eklendi', ekli.adet === 1, JSON.stringify(ekli));
  bak('baştaki @ atılmış', ekli.handle === 'gercegin', ekli.handle);
  // Paylasim sablonundaki hesap satirlarinin da bir kimlik ureteci var ve
  // ikisi ayni adi tasisaydi sonraki oncekini sessizce ezerdi.
  bak('kimlik hs_ ile basliyor (ac_ ile karismamis)',
      /^hs_/.test(ekli.id || ''), ekli.id);
  bak('form temizlendi', ekli.kutuBos === true);

  console.log('[adsiz hesap eklenmiyor]');
  const adsiz = await p.evaluate(async ()=>{
    const eskiUyari = window.uyari; let mesaj = null;
    window.uyari = (m)=>{ mesaj = m; };
    document.getElementById('hs_ad').value = '   ';
    hesapKaydet();
    window.uyari = eskiUyari;
    return { adet: hesaplar.length, mesaj };
  });
  bak('adsiz hesap eklenmedi', adsiz.adet === 1, String(adsiz.adet));
  bak('sebebi soyleniyor', !!adsiz.mesaj && adsiz.mesaj.length > 5, String(adsiz.mesaj));

  console.log('[duzenleme]');
  await p.evaluate(()=>{ hesapFormuTemizle(); hesaplariCiz(); });
  await p.click('[data-hs-duzen]');
  await p.waitForTimeout(250);
  const duzen = await p.evaluate(()=>({
    ad: document.getElementById('hs_ad').value,
    dugme: document.getElementById('hs_kaydet').textContent,
    vazgec: document.getElementById('hs_vazgec').hidden
  }));
  bak('form doldu', duzen.ad === 'Gerçeğin İzleri', duzen.ad);
  bak('dugme "Kaydet"e dondu', duzen.dugme === 'Kaydet', duzen.dugme);
  bak('Vazgec gorunur oldu', duzen.vazgec === false);
  await p.fill('#hs_ad', 'Gerçeğin İzleri TV');
  await p.click('#hs_kaydet');
  await p.waitForTimeout(250);
  const sonrasi = await p.evaluate(()=>({ adet: hesaplar.length, ad: hesaplar[0].name }));
  bak('duzenleme YENI hesap acmadi', sonrasi.adet === 1, String(sonrasi.adet));
  bak('ad degisti', sonrasi.ad === 'Gerçeğin İzleri TV', sonrasi.ad);

  await p.evaluate(()=> document.getElementById('hesapOverlay2').classList.remove('open'));

  // ------------------------------------------------- kayit penceresi (alan)
  console.log('[kayit penceresi: alan KOSULLU]');
  await kur();
  await p.evaluate(()=> openModal(null, '2026-10-09', '19:00'));
  await p.waitForTimeout(350);

  const tekli = await p.evaluate(()=>{
    document.querySelectorAll('#platformChecks input').forEach(el=>{ el.checked = el.value === 'instagram'; });
    document.getElementById('platformChecks').dispatchEvent(new Event('change', { bubbles:true }));
    return document.getElementById('hesapMultiWrap').hidden;
  });
  bak('tek Instagram hesabi -> alan GIZLI', tekli === true);

  const ikili = await p.evaluate(()=>{
    document.querySelectorAll('#platformChecks input').forEach(el=>{ if(el.value === 'youtube') el.checked = true; });
    document.getElementById('platformChecks').dispatchEvent(new Event('change', { bubbles:true }));
    return {
      gizli: document.getElementById('hesapMultiWrap').hidden,
      grup: [...document.querySelectorAll('#hesapGruplar .hs-grup')].length,
      kutu: [...document.querySelectorAll('#hesapGruplar input')].map(x=> x.value)
    };
  });
  bak('iki YouTube hesabi -> alan GORUNUR', ikili.gizli === false);
  bak('yalnizca cok hesapli platform grup aciyor', ikili.grup === 1, String(ikili.grup));
  bak('o platformun hesaplari listeleniyor',
      ikili.kutu.join(',') === 'hs_a,hs_b', ikili.kutu.join(','));

  console.log('[coklu secim -> coklu kayit]');
  // Platform kutulariyla birebir ayni kural: her isaret bir kayit.
  await p.evaluate(()=>{
    document.querySelectorAll('#hesapGruplar input').forEach(el=> el.checked = true);
    document.querySelectorAll('#typeChecks input').forEach(el=>{ el.checked = el.value === 'video'; });
    document.getElementById('f_title').value = 'Sokollu';
    const s = document.getElementById('f_project');
    if(s){ s.value = 'pr_1'; s.dispatchEvent(new Event('change', { bubbles:true })); }
  });
  await kaydet();
  const cikan = await p.evaluate(()=> events.map(e=>
    e.platform + ':' + ((e.content||{}).hesapId || '-')).sort());
  bak('iki YouTube hesabi iki kayit uretti',
      cikan.filter(x=> x.indexOf('youtube:') === 0).length === 2, JSON.stringify(cikan));
  bak('her kayit KENDI hesabini tasiyor',
      cikan.indexOf('youtube:hs_a') !== -1 && cikan.indexOf('youtube:hs_b') !== -1,
      JSON.stringify(cikan));
  bak('isaretlenmemis platform hesapsiz TEK kayit uretti',
      cikan.filter(x=> x === 'instagram:-').length === 1, JSON.stringify(cikan));
  // Hesap kaydin kendi platformuna ait: content kopyalandigi icin YouTube
  // hesabinin Instagram kaydina bulasmasi cok kolay bir hata olurdu.
  bak('hesap baska platformun kaydina bulasmadi',
      cikan.every(x=> x.indexOf('instagram:hs_') !== 0), JSON.stringify(cikan));

  console.log('[duzenlemede tek secim]');
  await p.evaluate(()=>{ openModal(events.find(e=> (e.content||{}).hesapId === 'hs_a')); });
  await p.waitForTimeout(350);
  const tek = await p.evaluate(()=>({
    cokGizli: document.getElementById('hesapMultiWrap').hidden,
    gizli: document.getElementById('hesapSingleWrap').hidden,
    deger: document.getElementById('f_hesap').value,
    secenek: [...document.getElementById('f_hesap').options].map(o=> o.value)
  }));
  bak('duzenlemede coklu kutular kapali', tek.cokGizli === true);
  bak('duzenlemede tek secim acik', tek.gizli === false);
  bak('kaydin hesabi secili geliyor', tek.deger === 'hs_a', tek.deger);
  bak('"belirtilmedi" secenegi var', tek.secenek.indexOf('') !== -1, JSON.stringify(tek.secenek));

  console.log('[ASIL TUZAK: hesap silinince alan gizlenmiyor]');
  // Iki YouTube hesabindan biri silinirse hesapSeritGerekir artik false
  // doner. Alan yalnizca ona baksaydi gizlenirdi ve kullanici kaydin hala
  // bir hesaba bagli oldugunu ne gorebilir ne degistirebilirdi.
  await p.evaluate(()=>{
    hesaplar = hesaplar.filter(h=> h.id !== 'hs_b'); saveHesaplar();
    openModal(events.find(e=> (e.content||{}).hesapId === 'hs_a'));
  });
  await p.waitForTimeout(350);
  const dustu = await p.evaluate(()=>({
    gizli: document.getElementById('hesapSingleWrap').hidden,
    deger: document.getElementById('f_hesap').value
  }));
  bak('tek hesaba dusse de bagli kayitta alan GORUNUR', dustu.gizli === false);
  bak('bag hala secili', dustu.deger === 'hs_a', dustu.deger);

  console.log('[ASIL TUZAK 2: alan gizliyken kaydetmek bagi DUSURMUYOR]');
  // saveEvent content'i bastan kuruyor. Instagram kaydina elle bir hesap
  // yazip kaydediyoruz: o platformda tek hesap var, alan gizli kalacak.
  // Gizli olmasi "hesabi kaldir" demek DEGIL.
  await p.evaluate(()=>{
    const e = events.find(x=> x.platform === 'instagram');
    e.content = Object.assign({}, e.content, { hesapId:'hs_c' });
    save(); openModal(e);
  });
  await p.waitForTimeout(350);
  const gizliKayit = await p.evaluate(()=> document.getElementById('hesapSingleWrap').hidden);
  await kaydet();
  const korundu = await p.evaluate(()=>
    (events.find(e=> e.platform === 'instagram').content || {}).hesapId);
  bak('tek hesapli platformda bag varken alan gorunur (bag gorulebilir)',
      gizliKayit === false, String(gizliKayit));
  bak('kaydettikten sonra bag duruyor', korundu === 'hs_c', String(korundu));

  console.log('[yenilemeden sonra]');
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')); });
  await sus();
  const yenileme = await p.evaluate(()=> events.map(e=>
    e.platform + ':' + ((e.content||{}).hesapId || '-')).sort());
  bak('baglar yenilemeden sonra duruyor',
      yenileme.indexOf('youtube:hs_a') !== -1 && yenileme.indexOf('instagram:hs_c') !== -1,
      JSON.stringify(yenileme));

  // ----------------------------------------------------------------- filtre
  console.log('[takvim filtresi]');
  await p.evaluate(()=>{
    hesaplar = [
      { id:'hs_a', name:'Gerçeğin İzleri', platform:'youtube', handle:'', url:'', notes:'' },
      { id:'hs_b', name:'Kişisel', platform:'youtube', handle:'', url:'', notes:'' }
    ].map(hesapTemizle).filter(Boolean);
    saveHesaplar();
    events = [{ id:'e1', type:'video', platform:'youtube', title:'A', date:'2026-10-09',
                time:'19:00', uploaded:false, content:{} }];
    save(); renderCal();
  });
  await p.waitForTimeout(400);
  bak('hesap tanimli ama hicbiri KULLANILMIYORSA satir yok',
      await p.evaluate(()=> document.querySelector('[data-drop="hesap"]').hidden) === true);

  await p.evaluate(()=>{
    events = [
      { id:'e1', type:'video', platform:'youtube', title:'A', date:'2026-10-09', time:'19:00', uploaded:false, content:{ hesapId:'hs_a' } },
      { id:'e2', type:'video', platform:'youtube', title:'B', date:'2026-10-09', time:'20:00', uploaded:false, content:{ hesapId:'hs_b' } },
      { id:'e3', type:'video', platform:'youtube', title:'C', date:'2026-10-10', time:'19:00', uploaded:false, content:{ hesapId:'hs_a' } },
      { id:'e4', type:'reels', platform:'instagram', title:'D', date:'2026-10-10', time:'19:00', uploaded:false, content:{} },
      { id:'e5', type:'video', platform:'youtube', title:'E', date:'2026-10-11', time:'19:00', uploaded:false, content:{ hesapId:'hs_yok' } }
    ];
    save(); renderCal();
  });
  await p.waitForTimeout(400);
  const cipler = await p.evaluate(()=>({
    gizli: document.querySelector('[data-drop="hesap"]').hidden,
    metin: [...document.querySelectorAll('#hesapLegend .legend-item')]
             .map(x=> x.textContent.replace(/\s+/g,' ').trim()),
    kimlik: [...document.querySelectorAll('#hesapLegend .legend-item')].map(x=> x.dataset.hesap)
  }));
  bak('kullanilan hesap varsa satir cikiyor', cipler.gizli === false);
  bak('kullanilan hesaplar listede',
      cipler.kimlik.indexOf('hs_a') !== -1 && cipler.kimlik.indexOf('hs_b') !== -1,
      JSON.stringify(cipler.kimlik));
  // Silinmis hesaba bagli kayitlar listede DURMALI: yoksa o kayitlari
  // filtreyle bir daha hic bulamazsin.
  bak('silinmis hesap da listede', cipler.kimlik.indexOf('hs_yok') !== -1,
      JSON.stringify(cipler.kimlik));
  bak('silinmis hesabin adi soyleniyor',
      cipler.metin.some(x=> /silinmi/.test(x)), JSON.stringify(cipler.metin));
  bak('"Hesapsiz" secenegi var', cipler.kimlik.indexOf('') !== -1, JSON.stringify(cipler.kimlik));
  bak('sayilar dogru', /Gerçeğin İzleri\s*2/.test(cipler.metin.join('|')),
      JSON.stringify(cipler.metin));

  const suzme = await p.evaluate(()=>{
    const al = (kume)=>{ activeHesapFilters = new Set(kume);
                         return events.filter(gecerliKayit).map(e=> e.id); };
    const bir = al(['hs_a']);
    const hic = al(['']);
    const iki = al(['hs_a','hs_b']);
    const silik = al(['hs_yok']);
    activeHesapFilters.clear(); renderLegend(); renderCal();
    return { bir, hic, iki, silik };
  });
  bak('tek hesap suzuluyor', suzme.bir.join(',') === 'e1,e3', JSON.stringify(suzme.bir));
  bak('"Hesapsiz" yalnizca bagsizlari getiriyor',
      suzme.hic.join(',') === 'e4', JSON.stringify(suzme.hic));
  bak('iki hesap birlikte seciliyor (VEYA)',
      suzme.iki.join(',') === 'e1,e2,e3', JSON.stringify(suzme.iki));
  bak('silinmis hesabin kayitlari bulunabiliyor',
      suzme.silik.join(',') === 'e5', JSON.stringify(suzme.silik));

  const rozet = await p.evaluate(()=>{
    activeHesapFilters = new Set(['hs_a']); renderLegend(); renderCal();
    const kap = document.querySelector('[data-drop="hesap"]');
    return { sayi: kap.querySelector('.fbadge').textContent,
             gizliRozet: kap.querySelector('.fbadge').hidden,
             acik: kap.querySelector('.fbtn').classList.contains('on'),
             ozet: document.getElementById('filterSummary').textContent,
             temizle: !document.getElementById('filterClearAll').hidden };
  });
  bak('rozet sayiyi gosteriyor', rozet.sayi === '1' && rozet.gizliRozet === false,
      JSON.stringify(rozet));
  bak('dugme acik gorunuyor', rozet.acik === true);
  bak('ozet metnine sayiliyor', /1/.test(rozet.ozet), rozet.ozet);
  bak('"hepsini temizle" cikiyor', rozet.temizle === true);

  console.log('[bag kalmayinca filtre kendini topluyor]');
  // Acik bir filtre, verisi ortadan kalkinca takvimi bos gosterip
  // kullaniciyi "kayitlarim nerede" diye birakabilirdi.
  const topland = await p.evaluate(()=>{
    events = events.map(e=> Object.assign({}, e, { content:{} }));
    save(); renderCal();
    return { gizli: document.querySelector('[data-drop="hesap"]').hidden,
             kume: activeHesapFilters.size,
             gorunen: events.filter(gecerliKayit).length };
  });
  bak('satir yeniden gizlendi', topland.gizli === true);
  bak('acik filtre temizlendi', topland.kume === 0, String(topland.kume));
  bak('kayitlar gorunur kaldi', topland.gorunen === 5, String(topland.gorunen));

  bak('js hatası yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
