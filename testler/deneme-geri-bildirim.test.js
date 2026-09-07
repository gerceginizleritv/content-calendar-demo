// Deneme geri bildirimi: bolum bolum, uzun form. Kisa form ("iki soru")
// urunu HENUZ denememis ziyaretciye soruluyor; bu ise deneyene. Ikisini
// birlestirmek ziyaretciyi on soruyla kacirir, deneyiciyi de iki soruyla
// yetersiz birakirdi.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
const UID = '11111111-1111-1111-1111-111111111111';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const SB = `window.supabase={createClient(){return {
  auth:{ getSession:()=>Promise.resolve({data:{session: window.__oturum||null}}),
         onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
         updateUser(){ return Promise.resolve({error:null}); } },
  from(){ return { select(){ return { eq(){ return { maybeSingle:()=>Promise.resolve({data:null,error:null}) }; },
                                      is(){ return Promise.resolve({data:[],error:null}); } }; },
                   upsert(){ return Promise.resolve({error:null}); },
                   update(){ return { in(){return Promise.resolve({error:null});}, eq(){return Promise.resolve({error:null});} }; } }; },
  storage:{ from(){ return { upload:()=>Promise.resolve({error:null}), list:()=>Promise.resolve({data:[],error:null}),
                             remove:()=>Promise.resolve({error:null}), download:()=>Promise.resolve({data:null,error:'x'}) }; } }
};}};`;

async function ac(b, oturumlu){
  const p = await b.newPage({ viewport:{width:1280,height:1100} });
  p.hatalar = []; p.on('pageerror', e=> p.hatalar.push(String(e)));
  p.giden = [];
  await p.addInitScript(`try{ localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_tour_done','1');
    localStorage.setItem('demo_cal_${UID}', JSON.stringify([{id:'e1',date:'2026-10-01',time:'09:00',
      type:'reels',platform:'instagram',title:'x',uploaded:false,content:{}}])); }catch(e){}`);
  if(oturumlu){
    await p.addInitScript(`window.__oturum=${JSON.stringify({user:{id:UID,email:'deneme@ornek.com',
      app_metadata:{provider:'email'}, user_metadata:{}}})};`);
  }
  await p.route('**/supabase-js**', r=> r.fulfill({status:200,contentType:'application/javascript',body:SB}));
  await p.route('**/goatcounter**', r=> r.abort());
  await p.route('**api.web3forms.com**', r=>{
    p.giden.push(JSON.parse(r.request().postData() || '{}'));
    return r.fulfill({ status:200, contentType:'application/json', body:'{"success":true}' });
  });
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
  return p;
}

(async () => {
  const b = await chromium.launch();

  console.log('[kime soruluyor]');
  {
    const p = await ac(b, false);
    bak('oturum YOKKEN uzun form gizli', await p.$eval('#trialFbBtn', e=> e.hidden));
    bak('kisa form yerinde', await p.$('#feedbackBtn') !== null);
    await p.close();
  }
  const p = await ac(b, true);
  bak('oturum acikken gorunuyor', !(await p.$eval('#trialFbBtn', e=> e.hidden)));

  console.log('[form]');
  await p.click('#trialFbBtn');
  await p.waitForSelector('#dfbOverlay.open');
  bak('on bir bolum listeleniyor', (await p.$$('.dfb-satir')).length === 11,
      String((await p.$$('.dfb-satir')).length));
  bak('bolum adlari cevrildi', /Projeler/.test(await p.$eval('.dfb-ad', e=> e.textContent)),
      await p.$eval('.dfb-ad', e=> e.textContent));
  bak('oy dugmeleri ayni genislikte',
      new Set(await p.$$eval('.dfb-oy', e=> e.map(x=> Math.round(x.getBoundingClientRect().width)))).size === 1);
  bak('etiketler kirpilmadi', await p.$eval('.dfb-oy', e=> e.scrollWidth <= e.clientWidth + 1));
  bak('not kutulari BASTA GIZLI', await p.$$eval('.dfb-not', e=> e.every(x=> x.hidden)));
  bak('e-posta hesaptan geldi', await p.$eval('#dfbEmail', e=> e.value) === 'deneme@ornek.com');
  bak('0-10 arasi on bir dugme', (await p.$$('.dfb-nps button')).length === 11);

  console.log('[isaretleme]');
  await p.click('[data-dfb-oy="ideas"][data-dfb-deger="iyi"]');
  await p.waitForTimeout(200);
  bak('isaret secildi', await p.$eval('[data-dfb-oy="ideas"][data-dfb-deger="iyi"]',
      e=> e.className.indexOf('secili') !== -1));
  bak('isaretlenince NOT kutusu aciliyor',
      !(await p.$eval('[data-dfb-not="ideas"]', e=> e.hidden)));
  bak('oteki bolumlerin notu hala gizli', await p.$eval('[data-dfb-not="scripts"]', e=> e.hidden));
  await p.fill('[data-dfb-not="ideas"]', 'Çoklu proje bağı çok işime yaradı.');
  await p.click('[data-dfb-nps="9"]');
  await p.waitForTimeout(200);
  bak('puan secildi', await p.$eval('[data-dfb-nps="9"]', e=> e.className.indexOf('secili') !== -1));
  // Ayni dugmeye tekrar basmak secimi kaldiriyor.
  await p.click('[data-dfb-oy="ideas"][data-dfb-deger="iyi"]');
  await p.waitForTimeout(200);
  bak('tekrar basinca isaret kalkiyor', await p.$eval('[data-dfb-oy="ideas"][data-dfb-deger="iyi"]',
      e=> e.className.indexOf('secili') === -1));
  bak('yazilan not silinmiyor',
      /işime yaradı/i.test(await p.$eval('[data-dfb-not="ideas"]', e=> e.value)));
  await p.click('[data-dfb-oy="ideas"][data-dfb-deger="iyi"]');
  await p.waitForTimeout(150);

  console.log('[yarim form kaybolmuyor]');
  await p.click('#dfbLater');
  await p.waitForTimeout(200);
  await p.click('#trialFbBtn');
  await p.waitForTimeout(300);
  bak('kapanip acilinca isaret duruyor', await p.$eval('[data-dfb-oy="ideas"][data-dfb-deger="iyi"]',
      e=> e.className.indexOf('secili') !== -1));
  bak('kapanip acilinca not duruyor',
      /işime yaradı/i.test(await p.$eval('[data-dfb-not="ideas"]', e=> e.value)));
  bak('kapanip acilinca puan duruyor', await p.$eval('[data-dfb-nps="9"]',
      e=> e.className.indexOf('secili') !== -1));

  console.log('[gonderim]');
  await p.fill('#dfbBest', 'Takvim ve yedi adım.');
  await p.fill('#dfbWorst', 'Mekan fotoğrafı bulmak zor.');
  p.giden.length = 0;
  await p.click('#dfbSend');
  await p.waitForFunction(()=> /Teşekkürler/.test(document.getElementById('dfbStatus').textContent),
                          null, { timeout: 8000 });
  bak('bir istek gitti', p.giden.length === 1, String(p.giden.length));
  const y = p.giden[0] || {};
  bak('konuda NPS var', /NPS 9/.test(y.subject || ''), y.subject);
  bak('bolum bolum cevaplar INGILIZCE gidiyor',
      /Ideas: Useful/.test(y['Section by section'] || ''), (y['Section by section']||'').slice(0,60));
  bak('bolum notu da gidiyor',
      /Çoklu proje/.test(y['Section by section'] || ''));
  bak('serbest metinler gidiyor',
      /yedi adım/.test(y['Earned its place'] || '') && /fotoğraf/.test(y['Got in the way'] || ''));
  bak('e-posta gidiyor', y['Email'] === 'deneme@ornek.com', y['Email']);
  bak('gonderince taslak temizlendi',
      await p.evaluate(()=> !localStorage.getItem('demo_dfb_taslak')));

  console.log('[bos gonderim]');
  await p.waitForTimeout(1600);
  await p.click('#trialFbBtn');
  await p.waitForTimeout(300);
  p.giden.length = 0;
  await p.click('#dfbSend');
  await p.waitForTimeout(400);
  bak('bos form gonderilmiyor', p.giden.length === 0);
  bak('sebebi yaziyor', /Gönderilecek/.test(await p.$eval('#dfbStatus', e=> e.textContent)),
      await p.$eval('#dfbStatus', e=> e.textContent));

  bak('sayfa hatasi yok', p.hatalar.length === 0, p.hatalar.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await b.close();
  process.exit(k ? 1 : 0);
})();
