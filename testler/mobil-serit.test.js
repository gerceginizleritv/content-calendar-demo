// Telefonda ust serit TEK SATIR olmali: marka solda, hesap sagda.
// Onceki halde ikisi ayni satira sigmiyordu; hesap alt satira dusup saga
// yapisiyor, ortada kocaman bir bosluk kaliyordu ve serit 179 piksele
// cikip takvimi asagi itiyordu. Bu test o gerilemenin geri gelmesini
// engelliyor: olculen sey "guzel mi" degil, AYNI SATIRDA MI ve serit ne
// kadar yer kapliyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

// Serit yuksekligi icin ust sinir. Olculen deger 96px; 120 pay birakiyor
// ama ikinci satira dusen bir duzen (179px) buradan gecemiyor.
const SINIR = 120;

async function olc(t, w, dil){
  const p = await (await t.newContext({ viewport:{width:w,height:900} })).newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
                              localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  // Oturum acilmis hali: en uzun durum bu — fotograf, ad ve "Hesabim".
  await p.evaluate((d)=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage(d);
    document.getElementById('railAvatar').classList.remove('bos');
    const n = document.getElementById('railName');
    n.hidden = false; n.textContent = 'Murat Bostancıoğlu';
    document.getElementById('authBtn').textContent = d === 'tr' ? '☁ Hesabım' : '☁ My account';
  }, dil);
  await p.waitForTimeout(300);
  const o = await p.evaluate(()=>{
    const g = s=>{ const e = document.querySelector(s); if(!e) return null;
      const r = e.getBoundingClientRect();
      return { y:Math.round(r.top), h:Math.round(r.height), x:Math.round(r.left), sag:Math.round(r.right) }; };
    return { rail:g('.rail'), marka:g('.rail-brand'), hesap:g('.rail-me'), ana:g('.rail-main'),
             tasma: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  await p.close();
  o.ayriSatir = (o.hesap.y >= o.marka.y + o.marka.h) || (o.marka.y >= o.hesap.y + o.hesap.h);
  return o;
}

(async () => {
  const t = await chromium.launch();
  for(const [w, dil, ad] of [[360,'tr','kucuk Android'], [390,'en','iPhone'], [430,'tr','buyuk telefon']]){
    console.log('['+ad+' '+w+'px]');
    const o = await olc(t, w, dil);
    bak('marka ve hesap AYNI satirda', !o.ayriSatir,
        'marka y='+o.marka.y+' h='+o.marka.h+' / hesap y='+o.hesap.y);
    bak('hesap sagda duruyor', o.hesap.sag > o.marka.sag - 1, 'hesap sag='+o.hesap.sag);
    bak('serit '+SINIR+'px altinda', o.rail.h < SINIR, o.rail.h+'px');
    bak('yatay kayma yok', o.tasma === false);
  }

  console.log('[masaustunde serit hala dikey sutun]');
  const m = await olc(t, 1280, 'tr');
  bak('marka ile hesap alt alta', m.ayriSatir, 'marka y='+m.marka.y+' hesap y='+m.hesap.y);
  bak('serit solda dar bir sutun', m.rail.sag - m.rail.x < 260, String(m.rail.sag - m.rail.x));

  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
