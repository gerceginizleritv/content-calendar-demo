// MEKAN FOTOGRAF TARAMASI: CUMLE NE SOYLUYOR + "FOTOGRAFI OLMAYANLAR"
//                                        (YAPILACAKLAR 59)
//
// NEDEN BU TEST VAR
//   Kullanici 18 Kasim 2026, ekran goruntusuyle: "O yazi ne anlama
//   geliyor anlamadim. Ayrica 'fotografi olmayanlara bak' tusu
//   calisiyor mu? Ben tikladim ama bir sonuc donmedi."
//
//   ✅ TUS CALISIYORDU. Durum yeniden uretildi: 54 mekan, fotografi
//      olmayan 1 tane. Tus o bir mekana bakmis, Vikipedi'de bir sey
//      bulamamis ve bunu soylemis. Kusur ISLEVDE degil ANLATIMDA:
//      cumle "1 mekana bakildi, bir sey cikmadi" diyordu ve 54
//      mekani olan kullanici "neden yalnizca 1?" diye sordu. Sayi
//      FOTOGRAFI EKSIK olanlarin sayisiydi, cumle bunu soylemiyordu;
//      hangi mekan oldugu da yazmiyordu.
//
//   ⛔ TARAMA SONRASI IZ DE KALMIYORDU: hangi mekanin hala fotografsiz
//      oldugu hicbir yerde gorunmuyordu, kullanici 54 karti tek tek
//      gezmeden bulamiyordu. Kullanici suzgec secenegini sectı.
//
// ⚠ BIR ONCEKI OTURUMDA YANLIS BIR IDDIA YAZILDI VE OLCU CURUTTU:
//   "fotografsiz mekan yokken tus sessizce oluyor" denmisti
//   (`if(!liste.length) return;` satirina bakarak). Olculdu:
//   renderMekanlar tusu ZATEN gizliyor (yukseklik 0). Yani o satir
//   bir emniyet kemeri, gorunen bir kusur degil. Bu test o gizlemeyi
//   de olcuyor ki iddia bir daha kodu okuyarak tartisilmasin.
//
// NE OLCUYOR
//   1. Tek mekana bakildiysa cumle MEKANIN ADINI soyluyor
//   2. Coklu durumda ad GECMIYOR (hepsi cumleye sigmaz; suzgec var)
//   3. Bes durum bes AYRI cumle uretiyor (bulundu/bulunamadi/karisik)
//   4. Suzgec listeyi fotografsizlara daraltiyor
//   5. Fotografsiz kalmayinca suzgec ve tarama dugmesi GIZLENIYOR,
//      acik kalan suzgec KAPANIYOR (yoksa bos listeye bakilirdi)
//   6. Bolum 7: iki dil ayri metin

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

const AD = 'Balıklı Meryem Ana';

(async () => {
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1280, height:900 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  p.on('dialog', d=> d.accept());
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.route('**/supabase-js**', r=> r.fulfill({ status:200,
    contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};' }));
  await p.route('**/goatcounter**', r=> r.abort());
  // ⚠ Sahte fotograf adresleri gercekten istenmesin.
  await p.route('**ornek/**', r=> r.abort());
  await p.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);

  const diller = await p.evaluate(()=> Object.keys(LANG));

  const kur = (dil, fotosuz, toplam)=> p.evaluate(({ dil, fotosuz, toplam, AD })=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage(dil);
    mekanlar = Array.from({ length: toplam }, (_, i)=>({
      id:'m'+i, name: i >= (toplam - fotosuz) ? AD + ' ' + i : 'Mekan ' + (i+1),
      city:'Istanbul', district:'', address:'', note:'', mapUrl:'',
      imageUrl: i < (toplam - fotosuz) ? 'https://ornek/f'+i+'.jpg' : '',
      createdAt: Date.now() }));
    saveMekanlar(); setPage('places'); renderMekanlar();
  }, { dil, fotosuz, toplam, AD });

  const durum = ()=> p.evaluate(()=>{
    const d = document.getElementById('mk_fotosuzSuz');
    const tara = document.getElementById('mk_fotoHepsi');
    return { suzGizli: d.hidden, suzAcik: d.getAttribute('aria-pressed'),
             taraGizli: tara.hidden,
             kart: document.querySelectorAll('#mk_list .mk-kart, #mk_list .mk-satir').length };
  });
  const cumle = (bul, top, ad)=> p.evaluate(({ bul, top, ad })=>
    t('mk_photo_scan_done')(bul, top, ad), { bul, top, ad });

  const sonuc = {};
  for(const d of diller){
    await kur(d, 1, 54);
    const kapali = await durum();
    await p.click('#mk_fotosuzSuz');
    const acik = await durum();
    const c = {
      tekBulunamadi: await cumle(0, 1, AD),
      tekBulundu:    await cumle(1, 1, AD),
      cokBulunamadi: await cumle(0, 5, null),
      cokKarisik:    await cumle(2, 5, null),
      cokBulundu:    await cumle(5, 5, null)
    };
    await kur(d, 0, 54);
    const bos = await durum();
    sonuc[d] = { kapali, acik, bos, c };
  }

  for(const d of diller){
    const o = sonuc[d];

    dene('★ ' + d + ': tek mekanda cumle MEKANIN ADINI soyluyor', ()=>{
      assert.ok(o.c.tekBulunamadi.includes(AD),
        'ad gecmiyor: ' + JSON.stringify(o.c.tekBulunamadi));
      assert.ok(o.c.tekBulundu.includes(AD),
        'bulundugunda da ad gecmeli: ' + JSON.stringify(o.c.tekBulundu));
    });

    dene('★ ' + d + ': coklu durumda ad GECMIYOR', ()=>{
      // Hepsini cumleye sigdirmak olmaz; orada suzgec devreye giriyor.
      for(const k of ['cokBulunamadi','cokKarisik','cokBulundu']){
        assert.ok(!o.c[k].includes(AD), k + ' icinde ad var: ' + JSON.stringify(o.c[k]));
      }
    });

    dene('★ ' + d + ': bakilan sayi cumlede YAZIYOR', ()=>{
      assert.ok(/\b5\b/.test(o.c.cokBulunamadi),
        'bakilan sayi yok: ' + JSON.stringify(o.c.cokBulunamadi));
    });

    dene('★ ' + d + ': bes durum BES AYRI cumle', ()=>{
      const hepsi = Object.values(o.c);
      assert.strictEqual(new Set(hepsi).size, hepsi.length,
        'ayni cumle tekrar ediyor: ' + JSON.stringify(hepsi));
    });

    dene('★ ' + d + ': suzgec listeyi FOTOGRAFSIZLARA daraltiyor', ()=>{
      assert.strictEqual(o.kapali.kart, 54, 'kapaliyken: ' + o.kapali.kart);
      assert.strictEqual(o.acik.kart, 1, 'acikken: ' + o.acik.kart);
      assert.strictEqual(o.acik.suzAcik, 'true', 'dugme basili gorunmuyor');
    });

    dene('★ ' + d + ': fotografsiz kalmayinca ikisi de GIZLENIYOR', ()=>{
      // ⚠ Bir onceki oturumda "tus sessizce oluyor" denmisti; olcu
      //   curuttu. Bu iddia o gizlemeyi kayit altina aliyor.
      assert.strictEqual(o.bos.taraGizli, true, 'tarama dugmesi duruyor');
      assert.strictEqual(o.bos.suzGizli, true, 'suzgec dugmesi duruyor');
    });

    dene('★ ' + d + ': acik suzgec, fotografsiz kalmayinca KAPANIYOR', ()=>{
      // Yoksa kullanici bos bir listeye bakardi.
      assert.strictEqual(o.bos.suzAcik, 'false', 'suzgec acik kalmis');
      assert.strictEqual(o.bos.kart, 54, 'liste bos kalmis: ' + o.bos.kart);
    });
  }

  dene('★ Bolum 7: iki dil AYRI metin kullaniyor', ()=>{
    // Sayi ve ad atiliyor, kalan SOZCUKLER karsilastiriliyor.
    const sade = (x)=> String(x).replace(new RegExp(AD, 'g'), '')
                                .replace(/[\d().—-]+/g, ' ').replace(/\s+/g,' ').trim();
    assert.notStrictEqual(sade(sonuc.tr.c.tekBulunamadi), sade(sonuc.en.c.tekBulunamadi),
      'iki dilde AYNI SOZCUKLER -- sozluge girmemis olabilir');
  });

  dene('sayfa hatasi yok', ()=>{
    assert.deepStrictEqual(jsHata, [], jsHata.join(' | '));
  });

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
