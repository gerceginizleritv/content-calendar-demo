// Eski bicim (projeye gomulu harita) yeni bicime tasiniyor mu?
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{
    try{
      localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali');
      // Eski surumden kalmis gibi: iki proje, biri scriptli ve fikirli
      localStorage.setItem('demo_projects', JSON.stringify([
        { id:'pr_a', name:'Kariye', type:'studio', createdAt:1 },
        { id:'pr_b', name:'Balat',  type:'studio', createdAt:2 }
      ]));
      localStorage.setItem('demo_scripts', JSON.stringify({
        pr_a: { text:'ESKİ SCRIPT METNİ', ts: 1700000000000, source:'manual',
                ideas:[{id:'fk_1', text:'Eski fikir bir', ts:1},{id:'fk_2', text:'Eski fikir iki', ts:2}], ideasTs: 1700000000000 },
        pr_b: { text:'', ts:0, source:'manual', ideas:[{id:'fk_3', text:'Balat fikri', ts:3}], ideasTs: 1700000000000 }
      }));
    }catch(e){}
  });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1600);
  const r = await page.evaluate(()=>({
    fikirAdet: fikirler.length,
    fikirMetinleri: fikirler.map(f=>f.text).sort(),
    fikirBaglari: fikirler.map(f=>f.projectId).sort(),
    scriptAdet: scriptler.length,
    scriptMetni: scriptler[0] && scriptler[0].text,
    scriptBasligi: scriptler[0] && scriptler[0].title,
    scriptProjesi: scriptler[0] && scriptler[0].projectId,
    eskiAnahtarKalkti: localStorage.getItem('demo_scripts') === null,
    yedekDuruyor: !!localStorage.getItem('demo_scripts_v1_tasindi'),
    projeAdimi: projects.find(p=>p.id==='pr_a').script
  }));
  k('Üç fikir taşındı', r.fikirAdet===3, r.fikirAdet);
  k('Metinler korundu', JSON.stringify(r.fikirMetinleri)===JSON.stringify(['Balat fikri','Eski fikir bir','Eski fikir iki']), r.fikirMetinleri);
  k('Proje bağları korundu', JSON.stringify(r.fikirBaglari)===JSON.stringify(['pr_a','pr_a','pr_b']), r.fikirBaglari);
  k('Script taşındı (boş olan taşınmadı)', r.scriptAdet===1, r.scriptAdet);
  k('Script metni korundu', r.scriptMetni==='ESKİ SCRIPT METNİ', r.scriptMetni);
  k('Başlık proje adından kondu', r.scriptBasligi==='Kariye', r.scriptBasligi);
  k('Script projesine bağlı', r.scriptProjesi==='pr_a', r.scriptProjesi);
  k('Eski anahtar kaldırıldı', r.eskiAnahtarKalkti===true);
  k('YEDEK DURUYOR (geri dönülebilir)', r.yedekDuruyor===true);

  // Ikinci acilista tekrarlamamali
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  const r2 = await page.evaluate(()=>({ fikirAdet: fikirler.length, scriptAdet: scriptler.length }));
  k('İkinci açılışta tekrar taşımıyor', r2.fikirAdet===3 && r2.scriptAdet===1, r2);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
