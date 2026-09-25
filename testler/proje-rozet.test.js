const { chromium } = require('./araclar');
let g=0,k=0; const ok=(a,c,e)=>{ if(c){g++;console.log('  ok  ',a);} else {k++;console.log('  YOK ',a, e===undefined?'':'→ '+e);} };

// Proje penceresinde UC satir rozet tasiyor: Fikirler… / Scriptler… /
// Çekim listesi. Ad solda, sayi ya da "boş" sagda durmali.
//
// Eskiden yalnizca #pe_script flex'e cevrilmisti -- oteki ikisinde rozet
// ada YAPISIK cikiyordu: "Fikirler…boş", "Çekim listesiboş". Kural artik
// rozeti TASIYAN her satira uyguluyor (.btn-wide:has(.btn-tag)), tek tek
// degil; yeni bir satir eklendiginde de kendiliginden dogru diziliyor.
//
// Olcum GORUNTUYE bakiyor, CSS metnine degil: ad ile rozet arasinda
// gercekten bosluk var mi, rozet satirin sagina yaslanmis mi.

const SATIRLAR = ['pe_ideas', 'pe_script', 'pe_liste'];

(async()=>{
  const b = await chromium.launch();
  const c = await b.newContext({ viewport:{ width:1500, height:900 }, locale:'tr-TR' });
  const p = await c.newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**/supabase-js**', r=> r.abort());
  await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);

  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    projects = [{ id:'pr_1', name:'Balıklı Meryem Ana Rum Manastırı', cancelled:false, type:'outdoor' }];
    saveProjects(); setPage('projects');
    openProjectEdit('pr_1');
  });
  await p.waitForTimeout(700);

  const olc = ()=> p.evaluate((idler)=> idler.map(id=>{
    const d = document.getElementById(id);
    if(!d) return { id, yok:true };
    const rozet = d.querySelector('.btn-tag');
    const ad    = d.querySelector('span:not(.btn-tag)');
    if(!rozet || !ad) return { id, yok:true };
    const dk = d.getBoundingClientRect(), rk = rozet.getBoundingClientRect(), ak = ad.getBoundingClientRect();
    return {
      id,
      rozetMetni: (rozet.textContent||'').trim(),
      // Ad ile rozet arasindaki bosluk (px). Yapisikken ~0 idi.
      aralik: Math.round(rk.left - ak.right),
      // Rozetin sag kenari satirin sag kenarina ne kadar uzak.
      sagBosluk: Math.round(dk.right - rk.right),
      dizilim: getComputedStyle(d).display
    };
  }), SATIRLAR);

  let olcum = await olc();
  ok('uc satir da bulundu', olcum.every(x=> !x.yok), JSON.stringify(olcum));
  ok('uc satirda da rozet DOLU (test bos degil)',
     olcum.every(x=> x.rozetMetni.length > 0), JSON.stringify(olcum.map(x=> x.rozetMetni)));

  for(const x of olcum){
    ok(x.id + ' · flex', x.dizilim === 'flex', x.dizilim);
    ok(x.id + ' · ad ile rozet yapisik degil', x.aralik >= 8, x.aralik);
    ok(x.id + ' · rozet saga yaslanmis', x.sagBosluk <= 20, x.sagBosluk);
  }

  // Ayni satirlarin hepsi ayni hizada bitsin -- biri otekilerden
  // kaymissa kural yine tek tek uygulanmis demektir.
  const sagUclar = olcum.map(x=> x.sagBosluk);
  ok('uc rozet ayni hizada', Math.max(...sagUclar) - Math.min(...sagUclar) <= 2, sagUclar.join(','));

  // Rozet BOSKEN de (sayi 0 degil, hic yokken) satir bozulmasin.
  await p.evaluate(()=>{ SATIRLAR_TEST = ['pe_ideasTag','pe_scriptTag','pe_listeTag'];
    SATIRLAR_TEST.forEach(id=>{ const e = document.getElementById(id); if(e) e.textContent = ''; }); });
  await p.waitForTimeout(200);
  olcum = await olc();
  ok('rozet bosken satirlar yine flex', olcum.every(x=> x.dizilim === 'flex'),
     JSON.stringify(olcum.map(x=> x.dizilim)));

  await b.close();
  console.log('\n=== gecen '+g+' / kalan '+k+' ===');
  process.exit(k?1:0);
})();
