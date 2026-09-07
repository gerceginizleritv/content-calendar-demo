// Telefonda pencere acilinca ekran kendiliginden buyuyor, kapaninca da
// oyle kaliyordu: iOS Safari 16 pikselden kucuk yazili bir alana
// dokununca sayfayi yakinlastiriyor ve geri uzaklastirmiyor. Kullanici
// bundan sonra takvimi saga sola kaydirmak zorunda kaliyordu.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

async function sayfaAc(t, secenek){
  const p = await (await t.newContext(secenek)).newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
                              localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
                         setLanguage('tr'); });
  return p;
}
// Yazi kutularinin boyu: isaret kutulari disarida (metinleri yok).
const kucukler = (p)=> p.evaluate(()=>{
  const kucuk = [];
  document.querySelectorAll('input, select, textarea').forEach(e=>{
    if(e.type === 'checkbox' || e.type === 'radio') return;
    const boy = parseFloat(getComputedStyle(e).fontSize);
    if(boy < 16) kucuk.push((e.id || e.className || e.tagName) + ':' + boy);
  });
  return kucuk;
});

(async () => {
  const t = await chromium.launch();

  console.log('[yakinlastirma kapatilmadi]');
  {
    const p = await sayfaAc(t, { viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    const meta = await p.$eval('meta[name="viewport"]', e=> e.getAttribute('content'));
    // Kolay ama YANLIS cozum: yakinlastirmayi kapatmak. Az goren kullanici
    // sayfayi buyutemez hale gelir; o yuzden bu bir gerileme sayiliyor.
    bak('user-scalable=no YOK', !/user-scalable\s*=\s*no/i.test(meta), meta);
    bak('maximum-scale YOK', !/maximum-scale/i.test(meta), meta);
    await p.close();
  }

  console.log('[dokunmatik: alanlar 16px]');
  {
    const p = await sayfaAc(t, { viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    const once = await kucukler(p);
    bak('acilista 16px altinda alan yok', once.length === 0, once.slice(0,5).join(', '));

    // Pencereler acikken de: alanlarin cogu pencerelerin icinde.
    for(const komut of ["document.getElementById('addBtn').click()",
                        "openProjectNew()",
                        "setPage('places'); mekanPenceresiniAc(null)",
                        "openScript(null,{})",
                        "document.getElementById('importOverlay').classList.add('open')"]){
      await p.evaluate(kmt=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
                              setPage('calendar'); eval(kmt); }, komut);
      await p.waitForTimeout(300);
      const kalan = await kucukler(p);
      bak('pencere acikken de 16px: ' + komut.slice(0, 28), kalan.length === 0, kalan.slice(0,4).join(', '));
    }
    await p.close();
  }

  console.log('[masaustu sikisikligi korunuyor]');
  {
    const p = await sayfaAc(t, { viewport:{width:1280,height:900} });
    const kucuk = await kucukler(p);
    // Masaustunde kural GECERSIZ: arayuz gereksiz yere sismesin.
    bak('masaustunde kucuk alanlar duruyor', kucuk.length > 10, kucuk.length + ' alan');
    bak('dil secimi hala kucuk', kucuk.some(x=> x.indexOf('langSelect') === 0), kucuk[0]);
    await p.close();
  }

  console.log('[sayfa yana kaymiyor]');
  for(const [ad, w, h] of [['dar telefon',360,780], ['iPhone',390,844], ['Android',412,915]]){
    const p = await sayfaAc(t, { viewport:{width:w,height:h}, isMobile:true, hasTouch:true });
    const olc = ()=> p.evaluate(()=> document.documentElement.scrollWidth - window.innerWidth);
    await p.evaluate(()=> setPage('calendar'));
    await p.waitForTimeout(200);
    bak(ad + ': takvim yana kaymiyor', (await olc()) <= 0, String(await olc()));
    await p.evaluate(()=> document.getElementById('addBtn').click());
    await p.waitForTimeout(400);
    bak(ad + ': pencere acikken kaymiyor', (await olc()) <= 0, String(await olc()));
    await p.evaluate(()=> document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')));
    await p.waitForTimeout(300);
    bak(ad + ': pencere kapaninca kaymiyor', (await olc()) <= 0, String(await olc()));
    await p.close();
  }

  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
