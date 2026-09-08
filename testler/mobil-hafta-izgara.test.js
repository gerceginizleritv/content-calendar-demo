// Telefonda hafta gorunumu: yedi gun ekrana sigmiyor, izgara kendi
// icinde yana kayiyor. Iki sey karisikliga yol aciyordu.
//
// 1. Yana kaydirinca SAAT SUTUNU ekrandan cikiyordu. Kartlari
//    goruyorsun ama hangi saatte olduklarini goremiyorsun — "hafta
//    kaymis gibi" duruyor.
// 2. Izgara hep PAZARTESIDEN basliyordu. Persembe gunu uygulamayi acan
//    biri kendi gununu gormuyor, once saga kaydirmasi gerekiyordu; bu
//    da "kendi verime ulasamiyorum" demek.
//
// Ucuncu bir kural: ayni haftaya bakarken bir kayit acip kapatinca
// kaydirdigi yer KORUNMALI, pazartesiye firlamamali.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

// Haftanin her gunune bir kayit: hangi sutunun gorundugu izlenebilsin.
const TOHUM = ()=>{
  const bas = new Date(); bas.setHours(0,0,0,0);
  const pzt = new Date(bas); pzt.setDate(pzt.getDate() - ((pzt.getDay()+6)%7));
  events = [];
  for(let i=0;i<7;i++){
    const d = new Date(pzt); d.setDate(pzt.getDate()+i);
    events.push(sanitizeEvent({ id:'hg'+i, date: fmtKey(d), time:'10:00',
      title:'GUN'+(i+1), type:'video', platform:'instagram' }));
  }
  save(); setPage('calendar'); setView('week'); renderCal();
};

async function ac(t, w){
  const p = await (await t.newContext({ viewport:{width:w,height:900}, isMobile:w<700, hasTouch:w<700 })).newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
                              localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
                         setLanguage('tr'); });
  await p.evaluate(TOHUM);
  await p.waitForTimeout(700);
  return p;
}
const durum = p => p.evaluate(()=>{
  const kap = document.getElementById('calGridWrap');
  const k = kap.getBoundingClientRect();
  const icinde = e=>{ if(!e) return null; const r = e.getBoundingClientRect();
    return r.right > k.left + 0.5 && r.left < k.right - 0.5; };
  const saat = [...kap.querySelectorAll('.hg-hour')].filter(e=> !e.classList.contains('hg-early-label'))[0];
  const bugun = kap.querySelector('.hg-dayhead.today');
  return {
    kayabilir: kap.scrollWidth > kap.clientWidth + 1,
    kayma: Math.round(kap.scrollLeft),
    saatYapisik: saat ? getComputedStyle(saat).position === 'sticky' : false,
    saatGorunur: icinde(saat),
    saatX: saat ? Math.round(saat.getBoundingClientRect().left - k.left) : null,
    bugunVar: !!bugun,
    bugunGorunur: icinde(bugun),
    bugunX: bugun ? Math.round(bugun.getBoundingClientRect().left - k.left) : null
  };
});

(async () => {
  const t = await chromium.launch();
  const p = await ac(t, 390);
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));

  console.log('[hafta acilinca]');
  let d = await durum(p);
  bak('izgara yana kayabiliyor (yedi gun sigmiyor)', d.kayabilir);
  bak('saat sutunu YAPISIK', d.saatYapisik);
  bak('BUGUN gorunur halde aciliyor', d.bugunVar && d.bugunGorunur, JSON.stringify(d));

  console.log('[yana kaydirinca saat kayboluyor mu]');
  await p.evaluate(()=>{ const kap = document.getElementById('calGridWrap');
                         kap.scrollLeft = kap.scrollWidth; });
  await p.waitForTimeout(350);
  d = await durum(p);
  bak('sona kadar kaydirildi', d.kayma > 100, String(d.kayma));
  bak('SAAT SUTUNU HALA EKRANDA', d.saatGorunur, JSON.stringify(d));
  bak('saat sutunu solda duruyor', d.saatX !== null && Math.abs(d.saatX) <= 1, String(d.saatX));
  // Son gunun karti da okunabilir olmali.
  bak('son gunun karti gorunur',
      await p.evaluate(()=>{
        const kap = document.getElementById('calGridWrap').getBoundingClientRect();
        const c = [...document.querySelectorAll('.hg-chip')].find(x=> /GUN7/.test(x.textContent));
        if(!c) return false;
        const r = c.getBoundingClientRect();
        return r.left >= kap.left - 1 && r.right <= kap.right + 1;
      }));

  console.log('[ayni haftada yeniden cizim kaymayi bozmuyor]');
  await p.evaluate(()=>{ document.getElementById('calGridWrap').scrollLeft = 300; });
  await p.waitForTimeout(200);
  await p.evaluate(()=> renderCal());
  await p.waitForTimeout(450);
  d = await durum(p);
  bak('kaydirilan yer korundu', Math.abs(d.kayma - 300) <= 2, String(d.kayma));
  // Kayit kaydetmek de ayni yolu kullaniyor.
  await p.evaluate(()=>{ const e = events[0]; e.title = 'DEGISTI'; save(); renderCal(); });
  await p.waitForTimeout(450);
  bak('kayit kaydedince de korundu', Math.abs((await durum(p)).kayma - 300) <= 2);

  console.log('[hafta degisince]');
  await p.evaluate(()=> document.getElementById('nextBtn').click());
  await p.waitForTimeout(600);
  d = await durum(p);
  bak('yeni hafta basindan aciliyor', d.kayma === 0, String(d.kayma));
  bak('yeni haftada bugun yok', !d.bugunVar);

  console.log('["Bugun" dugmesi]');
  await p.evaluate(()=> document.getElementById('todayBtn').click());
  await p.waitForTimeout(600);
  d = await durum(p);
  bak('bugune donuldu ve gorunuyor', d.bugunVar && d.bugunGorunur, JSON.stringify(d));
  bak('bugun saat sutununun hemen saginda', d.bugunX !== null && d.bugunX >= 0 && d.bugunX <= 60,
      String(d.bugunX));

  console.log('[gun gorunumu tek sutun: kaydirma yok]');
  await p.evaluate(()=> setView('day'));
  await p.waitForTimeout(500);
  bak('tek gun ekrana sigiyor', !(await durum(p)).kayabilir);

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  await p.close();

  console.log('[masaustunde yedi gun zaten sigiyor]');
  const m = await ac(t, 1280);
  const md = await durum(m);
  bak('kaydirma gerekmiyor', !md.kayabilir);
  bak('saat sutunu yapiskan degil (gerek yok)', !md.saatYapisik);
  await m.close();

  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
