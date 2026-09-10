// Otomatik gunluk yedek. Elle yedek almak yalnizca alan kisiyi korur;
// deneme kullanicilarinin cogu hic almaz. Yedek artik kullanicidan
// bagimsiz: gunde bir kez, acilista, hesabin kendi klasorune yaziliyor.
const { chromium } = require('./araclar');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const UID = '11111111-1111-1111-1111-111111111111';
const SB = `window.supabase={createClient(){return {
  auth:{ getSession:()=>Promise.resolve({data:{session: window.__oturum||null}}),
         onAuthStateChange(f){ window.__authCb=f; return {data:{subscription:{unsubscribe(){}}}}; },
         updateUser(){ return Promise.resolve({error:null}); } },
  from(t){ return {
    select(){ return { eq(){ return { maybeSingle:()=>Promise.resolve({data: window.__prefs||null, error:null}) }; },
                       is(){ return Promise.resolve({data: [], error: null}); } }; },
    upsert(r){ window.__upsert=(window.__upsert||[]).concat([{tablo:t, satir:r}]); return Promise.resolve({error:null}); },
    update(){ return { in(){ return Promise.resolve({error:null}); },
                       eq(){ return Promise.resolve({error:null}); } }; }
  }; },
  storage:{ from(kova){ return {
    upload(yol, govde, o){
      window.__yuk = (window.__yuk||[]).concat([{kova, yol, ustune: !!(o&&o.upsert)}]);
      return govde.text().then(m=>{ window.__sonGovde = m; return { error: window.__yukHata||null }; });
    },
    list(klasor, o){ window.__list=(window.__list||[]).concat([{kova, klasor, o}]);
      return Promise.resolve({ data: (window.__dosyalar||[]).map(n=>({name:n})), error:null }); },
    remove(yollar){ window.__sil=(window.__sil||[]).concat(yollar); return Promise.resolve({error:null}); },
    download(yol){ window.__indir = yol;
      return Promise.resolve({ data: new Blob([JSON.stringify(window.__yedekDosya||{})],
                                              {type:'application/json'}), error:null }); }
  }; } }
};}};`;

async function ac(b, ayar){
  const p = await b.newPage({ viewport:{width:1280,height:1000} });
  p.hatalar = [];
  p.on('pageerror', e=> p.hatalar.push(String(e)));
  // Hesabin KENDI yerel kopyasi hazir birakiliyor: yoksa uygulama
  // "tarayicidaki calismayi hesaba tasiyayim mi" diye soruyor ve akis
  // cevap bekleyip duruyor.
  await p.addInitScript(`try{
    localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_tour_done','1');
    localStorage.setItem('demo_cal_${UID}', JSON.stringify([
      { id:'ev_test', date:'2026-10-01', time:'09:00', type:'reels',
        platform:'instagram', title:'Kayit', uploaded:false, content:{} }
    ]));
  }catch(e){}`);
  await p.addInitScript(`window.__oturum=${JSON.stringify(ayar.oturum||null)};`);
  await p.addInitScript(`window.__dosyalar=${JSON.stringify(ayar.dosyalar||[])};`);
  await p.route('**/supabase-js**', r=> r.fulfill({status:200,contentType:'application/javascript',body:SB}));
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
  return p;
}
const OTURUM = { user:{ id: UID, email:'a@b.c', app_metadata:{provider:'email'}, user_metadata:{} } };

(async () => {
  const b = await chromium.launch();

  console.log('[giristen sonra kendiliginden aliniyor]');
  {
    const p = await ac(b, { oturum: OTURUM });
    // Yedek 4 saniye gecikmeli: her sey yerine oturduktan sonra alinmali.
    await p.waitForFunction(()=> (window.__yuk||[]).some(x=> x.kova === 'yedek'), null, { timeout: 15000 });
    const yuk = await p.evaluate(()=> window.__yuk.filter(x=> x.kova === 'yedek'));
    bak('yedek kovasina yazildi', yuk.length === 1, JSON.stringify(yuk));
    bak('yol kullanicinin klasoru', yuk[0].yol.indexOf(UID + '/') === 0, yuk[0].yol);
    bak('dosya adi gun', /\/\d{4}-\d{2}-\d{2}\.json$/.test(yuk[0].yol), yuk[0].yol);
    bak('gun ici tekrar acilista ustune yaziliyor', yuk[0].ustune === true);
    const govde = JSON.parse(await p.evaluate(()=> window.__sonGovde));
    bak('yedek TAM (alti bolum de var)',
        ['kayitlar','projeler','fikirler','scriptler','mekanlar','sablon'].every(x=> x in govde),
        Object.keys(govde).join(','));
    bak('urun damgasi var', govde.urun === 'shootboard');
    bak('js hatasi yok', p.hatalar.length === 0, p.hatalar.join(' | '));
    await p.close();
  }

  console.log('[gunde bir kez]');
  {
    const p = await ac(b, { oturum: OTURUM });
    await p.waitForFunction(()=> (window.__yuk||[]).some(x=> x.kova === 'yedek'), null, { timeout: 15000 });
    // Ikinci kez cagrildiginda yazmamali: damga yerelde duruyor.
    await p.evaluate(()=> otomatikYedek());
    await p.waitForTimeout(400);
    bak('ayni gun ikinci yedek alinmiyor',
        (await p.evaluate(()=> window.__yuk.filter(x=> x.kova==='yedek').length)) === 1);
    // Damga eskitilince yeniden aliyor.
    await p.evaluate(()=> localStorage.setItem(yedekSonAnahtar(), '0'));
    await p.evaluate(()=> otomatikYedek());
    await p.waitForTimeout(600);
    bak('damga eskiyince yeniden aliniyor',
        (await p.evaluate(()=> window.__yuk.filter(x=> x.kova==='yedek').length)) === 2);
    await p.close();
  }

  console.log('[yedi taneden fazlasi siliniyor]');
  {
    const gunler = ['2026-09-07','2026-09-06','2026-09-05','2026-09-04','2026-09-03',
                    '2026-09-02','2026-09-01','2026-08-31','2026-08-30'].map(x=> x + '.json');
    const p = await ac(b, { oturum: OTURUM, dosyalar: gunler });
    await p.waitForFunction(()=> !!window.__sil, null, { timeout: 15000 });
    const sil = await p.evaluate(()=> window.__sil);
    bak('en eski ikisi siliniyor', sil.length === 2, JSON.stringify(sil));
    bak('silinenler en eskiler',
        sil.every(x=> /2026-08-3[01]\.json$/.test(x)), JSON.stringify(sil));
    bak('silinen yollar kullanicinin klasorunde',
        sil.every(x=> x.indexOf(UID + '/') === 0));
    await p.close();
  }

  console.log('[hesap penceresinde listeleniyor]');
  {
    const gunler = ['2026-09-07.json','2026-09-06.json','2026-09-05.json'];
    const p = await ac(b, { oturum: OTURUM, dosyalar: gunler });
    await p.waitForTimeout(1200);
    await p.evaluate(()=> hesapPenceresiniAc());
    await p.waitForFunction(()=> document.querySelectorAll('#yedekListe [data-yedek]').length > 0,
                            null, { timeout: 8000 });
    const satirlar = await p.$$eval('#yedekListe li', e=> e.map(x=> x.textContent.trim()));
    bak('yedekler listeleniyor', satirlar.length === 3, JSON.stringify(satirlar));
    bak('gun okunabilir yaziyor', /2026-09-07/.test(satirlar[0]), satirlar[0]);

    // Geri yukleme: dosyayi indirip birlestiriyor.
    await p.evaluate((uid)=>{
      window.__yedekDosya = { urun:'shootboard', surum:1, alindi:'2026-09-07T10:00:00.000Z',
        kayitlar:[], projeler:[{ id:'pr_yedek', name:'Yedekten gelen', type:'other',
                                 steps:{}, deadlines:{}, createdAt: Date.now() }],
        fikirler:[], scriptler:[], mekanlar:[] };
      window.onayla = ()=> Promise.resolve(true);
      window.uyari = (m)=>{ window.__mesaj = m; return Promise.resolve(true); };
    }, UID);
    await p.click('#yedekListe [data-yedek]');
    await p.waitForFunction(()=> !!window.__mesaj, null, { timeout: 10000 });
    bak('dogru dosya indirildi', /2026-09-07\.json$/.test(await p.evaluate(()=> window.__indir)),
        await p.evaluate(()=> window.__indir));
    bak('yedekteki proje geri geldi',
        await p.evaluate(()=> projects.some(x=> x.id === 'pr_yedek')));
    bak('hesap penceresi kapandi',
        !(await p.$eval('#hesapOverlay', e=> e.classList.contains('open'))));
    await p.close();
  }

  console.log('[oturum yokken]');
  {
    const p = await ac(b, { oturum: null });
    await p.waitForTimeout(1500);
    bak('giris yokken yedek alinmiyor', !(await p.evaluate(()=> (window.__yuk||[]).length)));
    await p.close();
  }

  console.log('[kova kurulmamissa uygulama durmuyor]');
  {
    const p = await ac(b, { oturum: OTURUM });
    await p.evaluate(()=>{ window.__yukHata = { message:'Bucket not found' }; });
    await p.evaluate(()=> localStorage.setItem(yedekSonAnahtar(), '0'));
    await p.evaluate(()=> otomatikYedek());
    await p.waitForTimeout(800);
    bak('hata sayfayi kirmiyor', p.hatalar.length === 0, p.hatalar.join(' | '));
    bak('damga yazilmadi (sonra tekrar denenecek)',
        (await p.evaluate(()=> Number(localStorage.getItem(yedekSonAnahtar())||0))) === 0);
    await p.close();
  }

  console.log('\n'+g+' gecti, '+k+' kaldi');
  await b.close();
  process.exit(k ? 1 : 0);
})();
