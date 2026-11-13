// FIYAT SAYFASI BAGLANTISI — 13 Kasim 2026
//
// NEDEN BU TEST VAR
// `fiyatlar.html` 12 Kasim'da yazildi, canliya cikti ve calisiyordu ---
// ama HICBIR YERDEN BAGLANTISI YOKTU. Yani adresi elle yazan kisi
// goruyordu, baska kimse gormuyordu. Kullanici bunu sordu:
// "Fiyatlandirma sayfasi nerede? Link menuye eklendi mi? Ayrica login
// olduktan sonra da iceride yer almali!"
//
// Bir sayfanin VAR OLMASI, ULASILABILIR OLMASI demek degil. Bu test
// tam o farki olcuyor: baglanti serittte mi, oturum acik/kapali iki
// durumda da gorunuyor mu, dogru adrese mi gidiyor.
//
// ⚠ "40px dokunma hedefi" MASAUSTUNDE ARANMIYOR ve bu bilerek:
// degistirilmemis dosyada olculdu, masaustunde serit baglantilarinin
// HEPSI 30px (fare hedefi), telefonda 43px. Burada masaustu icin 44px
// istemek, var olan ve dogru calisan tasarimi "hata" diye isaretlerdi.
// Olculen sey: YENI baglanti komsularindan FARKLI DEGIL.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); }
  else { k++; console.log('  YOK '+ad+(ek!==undefined?' -> '+ek:'')); } };

async function ac(t, w, h){
  const p = await (await t.newContext({ viewport:{width:w,height:h} })).newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
                              localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')); });
  return p;
}

(async () => {
  const t = await chromium.launch();

  // ════════════════════════════════════════════════════════════
  console.log('[baglanti menude ve ULASILABILIR]');
  const p = await ac(t, 1280, 900);
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));

  bak('fiyatLink var', await p.evaluate(()=> !!document.getElementById('fiyatLink')));
  bak('menu seridinin icinde',
      await p.evaluate(()=> !!document.getElementById('fiyatLink').closest('#railFoot')));
  // Oturum KAPALI hal: ziyaretci de gorecek. Odeme karari veren kisi
  // hesap acmadan once fiyati gormek istiyor.
  bak('oturum KAPALIYKEN gorunuyor', await p.isVisible('#fiyatLink'));
  bak('yeni sekmede aciliyor (uygulamadan cikarmiyor)',
      await p.evaluate(()=>{ const a = document.getElementById('fiyatLink');
        return a.target === '_blank' && /noopener/.test(a.rel || ''); }));

  // Komsu baglantiyla AYNI boyda mi: tek basina bir px sayisi
  // anlamsiz, kiyas anlamli.
  const boy = await p.evaluate(()=>{
    const a = document.getElementById('fiyatLink').getBoundingClientRect();
    const b = document.getElementById('kilavuzLink').getBoundingClientRect();
    return { fiyat: Math.round(a.height), kilavuz: Math.round(b.height) };
  });
  bak('komsusuyla ayni yuksekligte', Math.abs(boy.fiyat - boy.kilavuz) <= 1,
      boy.fiyat + ' vs ' + boy.kilavuz);

  // ════════════════════════════════════════════════════════════
  console.log('[iki dil: metin ve adres]');
  for(const dil of ['tr','en']){
    await p.evaluate(x=> setLanguage(x), dil);
    await p.waitForTimeout(250);
    const o = await p.evaluate(()=>({
      metin: document.getElementById('fiyatLink').textContent.trim(),
      serit: document.getElementById('fiyatLink').getAttribute('href'),
      hesap: document.getElementById('hesapPlanLink').getAttribute('href'),
      baslik: document.querySelector('#hesapPlanAd').closest('.hesap-satir')
                .querySelector('.hesap-ad').textContent.trim(),
      dugme: document.getElementById('hesapPlanLink').textContent.trim()
    }));
    // Eksik ceviri anahtari ekranda anahtarin KENDISINI yazar
    // ("btn_fiyat") ve kimse fark etmez.
    bak(dil + ': serit metni cevrilmis',
        o.metin.length > 2 && !/^btn_/.test(o.metin), o.metin);
    bak(dil + ': plan basligi cevrilmis',
        o.baslik.length > 2 && !/^hesap_/.test(o.baslik), o.baslik);
    bak(dil + ': plan dugmesi cevrilmis',
        o.dugme.length > 2 && !/^hesap_/.test(o.dugme), o.dugme);
    // ⚠ Fiyat sayfasi dili ADRESTEN aliyor. Bu olmazsa uygulamayi
    // Turkce kullanan ama tarayicisi Ingilizce olan kisi Ingilizce
    // sayfaya dusuyor.
    bak(dil + ': serit adresi dili tasiyor',
        o.serit === 'fiyatlar.html?lang=' + dil, o.serit);
    bak(dil + ': hesap dugmesi de ayni dili tasiyor',
        o.hesap === 'fiyatlar.html?lang=' + dil, o.hesap);
  }

  // Iki dilde de metinler TANIMLI mi (t() anahtari geri yazmasin)
  const eksik = await p.evaluate(()=>{
    const anahtar = ['btn_fiyat','hesap_plan','hesap_plan_gor',
                     'hesap_plan_okunuyor','hesap_plan_hata'];
    const s = {};
    ['tr','en'].forEach(d=>{ setLanguage(d);
      s[d] = anahtar.filter(a=>{ const v = t(a);
        return v === undefined || v === null || v === a; }); });
    // plan_ad bir NESNE: dort anahtari da olmali.
    ['tr','en'].forEach(d=>{ setLanguage(d);
      const pa = t('plan_ad') || {};
      ['starter','creator_pro','studio','founding'].forEach(x=>{
        if(!pa[x]) s[d].push('plan_ad.' + x); }); });
    setLanguage('tr'); return s;
  });
  bak('Turkce metinlerin hepsi var', eksik.tr.length === 0, JSON.stringify(eksik.tr));
  bak('Ingilizce metinlerin hepsi var', eksik.en.length === 0, JSON.stringify(eksik.en));

  // ════════════════════════════════════════════════════════════
  console.log('[hesap penceresinde PLAN satiri]');
  await p.evaluate(()=> setLanguage('tr'));
  await p.evaluate(()=> hesapPenceresiniAc());
  await p.waitForTimeout(700);
  const hp = await p.evaluate(()=>{
    const a = document.getElementById('hesapPlanAd');
    const b = document.getElementById('hesapPlanLink');
    const r = b.getBoundingClientRect();
    const c = document.getElementById('hesapCikisBtn').getBoundingClientRect();
    return { acik: document.getElementById('hesapOverlay').classList.contains('open'),
             ad: a.textContent.trim(), gorunur: r.width > 0 && r.height > 0,
             boy: Math.round(r.height), komsu: Math.round(c.height) };
  });
  bak('pencere acildi', hp.acik);
  bak('plan satiri gorunuyor', hp.gorunur);
  bak('pencerenin kendi dugmeleriyle ayni boyda',
      Math.abs(hp.boy - hp.komsu) <= 1, hp.boy + ' vs ' + hp.komsu);
  // Oturum yok -> sunucuya hic gitmiyor, dogrudan Starter.
  bak('oturumsuzken Starter yaziyor', hp.ad === 'Starter', hp.ad);
  // ⛔ ILK YAZIMDA BU UC OLCUM SESSIZCE BOSA GECTI ve bu not o yuzden
  // burada: `window.sb = {...}` ile sahte bir istemci verilmeye
  // calisildi, ama `sb` ve `session` modul kapanisinda duruyor
  // (`'sb' in window` -> false). Atama yeni bir degisken yaratti,
  // gercek `sb` null kaldi, her uc olcum de 'Starter' okudu ve
  // "gecti" demeye hazirdi. Olcumun KENDISI yanlisti.
  //
  // Simdi iki ayri sey olculuyor:
  //   1) `planAdiMetni` SAF bir islev -- sahte hicbir seye gerek yok.
  //   2) `planSatiriCiz(oku)` okuma islevini disaridan aliyor; dikis
  //      yalnizca test icin var, uygulama hicbir yerde gecmiyor.
  const esleme = await p.evaluate(()=>{
    const s = {};
    ['tr','en'].forEach(d=>{ setLanguage(d);
      s[d] = { pro: planAdiMetni('creator_pro'),
               kurucu: planAdiMetni('founding'),
               bilinmez: planAdiMetni('yeni_plan_2027'),
               bos: planAdiMetni(null),
               bossuz: planAdiMetni('') }; });
    setLanguage('tr'); return s;
  });
  bak('tr: creator_pro -> "Creator Pro"', esleme.tr.pro === 'Creator Pro', esleme.tr.pro);
  bak('tr: founding -> "Kurucu Üye"', esleme.tr.kurucu === 'Kurucu Üye', esleme.tr.kurucu);
  bak('en: founding -> "Founding Member"',
      esleme.en.kurucu === 'Founding Member', esleme.en.kurucu);
  // Yeni bir plan eklenip adi yazilmazsa SESSIZCE kaybolmasin.
  bak('taninmayan anahtar bos BIRAKMIYOR, anahtari yaziyor',
      esleme.tr.bilinmez === 'yeni_plan_2027', esleme.tr.bilinmez);
  bak('bos deger Starter\'a dusuyor',
      esleme.tr.bos === 'Starter' && esleme.tr.bossuz === 'Starter',
      esleme.tr.bos + '/' + esleme.tr.bossuz);

  // Sunucu plan dondurunce ADI yaziliyor (dikis uzerinden, gercek kod).
  const basarili = await p.evaluate(async ()=>{
    await planSatiriCiz(()=> Promise.resolve({ data:'creator_pro', error:null }));
    return document.getElementById('hesapPlanAd').textContent.trim();
  });
  bak('sunucu creator_pro derse "Creator Pro" yaziyor',
      basarili === 'Creator Pro', basarili);

  // ⛔ KURALIN KENDISI: okunamadiysa plan adi UYDURULMAZ. "Starter"
  // yazmak, odenmis bir plani yok gostermek olurdu.
  const agYok = await p.evaluate(async ()=>{
    await planSatiriCiz(()=> Promise.reject(new Error('ag yok')));
    return document.getElementById('hesapPlanAd').textContent.trim();
  });
  bak('ag kopuksa "Starter" DEMIYOR', agYok !== 'Starter', agYok);
  bak('ag kopuksa sebebi yaziyor', agYok.length > 5, agYok);
  // PostgREST hatayi `error` alaninda dondurur, atmaz. Ikisi de ayni
  // yere dusmeli.
  const rlsRed = await p.evaluate(async ()=>{
    await planSatiriCiz(()=> Promise.resolve({ data:null, error:{ message:'permission denied' } }));
    return document.getElementById('hesapPlanAd').textContent.trim();
  });
  bak('error alani dolu gelirse de "Starter" DEMIYOR', rlsRed !== 'Starter', rlsRed);
  bak('error alani dolu gelirse sebebi yaziyor', rlsRed.length > 5, rlsRed);

  bak('masaustu: js hatasi yok', hata.length === 0, hata.join(' | '));
  await p.close();

  // ════════════════════════════════════════════════════════════
  // Menu alta yapisik ve YUKARI dogru buyuyor: yeni bir baglanti
  // eklenince en ustteki ekrandan tasabilir. En kisa yaygin telefonda
  // olculuyor, 844'te degil.
  console.log('[telefon: menu hala siginiyor]');
  for(const [w, h] of [[390,844],[360,640],[320,568]]){
    const m = await ac(t, w, h);
    const mh = []; m.on('pageerror', e=> mh.push(String(e)));
    await m.evaluate(()=> setLanguage('tr'));
    await m.waitForTimeout(200);
    bak(w+'x'+h+': kapaliyken yana kayma yok',
        await m.$eval('#railFoot', e=> e.scrollWidth <= e.clientWidth + 1),
        await m.$eval('#railFoot', e=> e.scrollWidth+'/'+e.clientWidth));
    await m.click('#railMoreBtn');
    await m.waitForTimeout(400);
    const IDS = ['tourBtn','fiyatLink','aiSettingsBtn','remindersBtn',
                 'hesapEtiketBtn','kilavuzLink','feedbackBtn'];
    const ol = await m.evaluate(ids=> ids.map(id=>{
      const r = document.getElementById(id).getBoundingClientRect();
      return { id, y:Math.round(r.height), ust:Math.round(r.top),
               ic: r.top >= -1 && r.bottom <= innerHeight + 1 };
    }), IDS);
    bak(w+'x'+h+': yedi baglanti da EKRANDA',
        ol.every(x=> x.ic), ol.filter(x=> !x.ic).map(x=> x.id+'@'+x.ust).join(','));
    bak(w+'x'+h+': hepsi 40px+ (dokunma)',
        ol.every(x=> x.y >= 40), ol.filter(x=> x.y < 40).map(x=> x.id+':'+x.y).join(','));
    // Geometri yetmez: kendi ::after alani kendini kirpabiliyor.
    // Daha once tam bu oldu, o yuzden gercek dokunma noktasi olculuyor.
    bak(w+'x'+h+': ortasina dokunmak baglantiya gidiyor',
        await m.evaluate(()=>{
          const r = document.getElementById('fiyatLink').getBoundingClientRect();
          const e = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
          return !!(e && e.closest('#fiyatLink'));
        }));
    bak(w+'x'+h+': js hatasi yok', mh.length === 0, mh.join(' | '));
    await m.close();
  }

  // ════════════════════════════════════════════════════════════
  // Sayfanin kendisi adresteki dili OKUYOR mu. Baglanti dogru adresi
  // verse bile sayfa onu yok sayarsa is yarim kalir.
  console.log('[fiyatlar.html adresten dil okuyor]');
  for(const [q, yer, bekle] of [['?lang=tr','en-US','tr'], ['?lang=en','tr-TR','en'],
                                ['','tr-TR','tr'], ['','en-US','en'],
                                ['?lang=xx','en-US','en']]){
    const s = await (await t.newContext({ viewport:{width:1100,height:800}, locale:yer })).newPage();
    const sh = []; s.on('pageerror', e=> sh.push(String(e)));
    await s.goto(KOK + '/fiyatlar.html' + q, { waitUntil:'domcontentloaded' });
    await s.waitForTimeout(1200);
    const d = await s.evaluate(()=> document.documentElement.lang);
    bak('"'+(q||'(parametresiz)')+'" + tarayici '+yer+' -> '+bekle, d === bekle, d);
    bak('"'+(q||'(parametresiz)')+'" js hatasi yok', sh.length === 0, sh.join(' | '));
    await s.close();
  }
  // ⚠ PARA BIRIMI DILDEN BAGIMSIZ. Dil ne okudugunu, para birimi nerede
  // odeyecegini soyluyor. ?lang=en ile gelen Turkiye'deki kisinin parasi
  // dolara donmemeli.
  {
    const s = await (await t.newContext({ viewport:{width:1100,height:800}, locale:'tr-TR' })).newPage();
    await s.goto(KOK + '/fiyatlar.html?lang=en', { waitUntil:'domcontentloaded' });
    await s.waitForTimeout(1500);
    const o = await s.evaluate(()=>({
      dil: document.documentElement.lang,
      secili: [...document.querySelectorAll('[data-para]')]
        .filter(b=> b.getAttribute('aria-pressed') === 'true').map(b=> b.dataset.para).join(',')
    }));
    bak('?lang=en dili degistiriyor ama PARA BIRIMINE dokunmuyor',
        o.dil === 'en' && o.secili === 'TRY', o.dil + ' / ' + o.secili);
    await s.close();
  }

  await t.close();
  console.log('=== BITTI — ' + g + ' gecti, ' + k + ' kaldi ===');
  process.exit(k ? 1 : 0);
})();
