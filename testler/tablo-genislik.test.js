// Proje tablosu: sutunlar dile ve pencere genisligine gore KAYMAMALI,
// tablonun sagida bos bir alan KALMAMALI, dar ekranda yana kaymali.
// 700px ve altinda tablo yok — orada kart listesi var, ayri test.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  console.log('PROJE TABLOSU — GENİŞLİK');
  const olcum = {};
  for (const w of [760, 900, 1440, 1900]) {
    const page = await b.newPage({ viewport:{width:w,height:900} });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    for (const dil of ['tr','en']) {
      olcum[w+'/'+dil] = await page.evaluate(async (dil)=>{
        document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
        setLanguage(dil); setPage('projects');
        if(!projects.length){
          const c=window.onayla; window.onayla=()=>false;
          for(const [ad,tur] of [['Nuruosmaniye Camii','outdoor'],
                                 ['İmrahor İlyas Bey Camii (Stüdyos Manastırı)','outdoor']]){
            openProjectNew(ad);
            document.getElementById('pe_type').value=tur;
            document.getElementById('pe_type').dispatchEvent(new Event('change'));
            document.getElementById('pe_address').value='İstanbul';
            document.getElementById('pe_save').click();
            await new Promise(r=>setTimeout(r,250));
          }
          await new Promise(r=>setTimeout(r,300)); window.onayla=c;
        }
        renderProjects();
        await new Promise(r=>setTimeout(r,250));
        const sar = document.querySelector('.proj-table-wrap');
        const tab = document.querySelector('.proj-table');
        const ad  = document.querySelector('.proj-table tbody th.pname-col');
        const yuvaGenislik = sar.parentElement.getBoundingClientRect().width;
        return {
          sutun: Math.round(ad.getBoundingClientRect().width),
          tablo: Math.round(tab.getBoundingClientRect().width),
          sarmal: Math.round(sar.getBoundingClientRect().width),
          yuva: Math.round(yuvaGenislik),
          kaydirir: sar.scrollWidth > sar.clientWidth + 1,
          sayfaKayar: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          bosSutun: document.querySelectorAll('.proj-table .pfill').length
        };
      }, dil);
    }
    await page.close();
  }
  Object.entries(olcum).forEach(([ad,v])=> console.log('   ', ad.padEnd(9), JSON.stringify(v)));

  const hepsi = Object.values(olcum);
  k('Proje sütunu her yerde aynı', new Set(hepsi.map(x=>x.sutun)).size === 1, [...new Set(hepsi.map(x=>x.sutun))]);
  k('Boş dolgu sütunu kalmadı', hepsi.every(x=>x.bosSutun === 0));
  k('Tablo genişliği dolduruyor (sağda boşluk yok)',
    hepsi.every(x=> x.yuva < 920 ? true : Math.abs(x.tablo - (x.yuva - 2)) <= 3),
    hepsi.map(x=>({tablo:x.tablo, yuva:x.yuva})));
  k('Dar ekranda tablo kendi içinde kayıyor', olcum['760/tr'].kaydirir === true, olcum['760/tr']);
  k('Sayfa yana kaymıyor', hepsi.every(x=>x.sayfaKayar === false), hepsi.map(x=>x.sayfaKayar));
  k('Geniş ekranda kaydırma yok', olcum['1900/tr'].kaydirir === false, olcum['1900/tr']);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
