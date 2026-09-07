// Yedek eskiden YALNIZCA takvim kayitlarini aliyordu; projeler, fikirler,
// scriptler, mekanlar ve sablonlar disarida kaliyordu. "Yedegim var"
// diyen kullanici isinin kucuk bir parcasini yedekliyordu.
const { chromium } = require('./araclar');
const fs = require('fs');
const os = require('os');
const path = require('path');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const TOHUM = ()=>{
  events = [{ id:'ev1', date:'2026-10-01', time:'09:00', type:'reels', platform:'instagram',
              title:'Kayit bir', uploaded:false, content:{} }].map(sanitizeEvent).filter(Boolean);
  projects = [sanitizeProject({ id:'pr1', name:'Proje bir', type:'outdoor' })];
  fikirler = [fikirTemizle({ id:'fk1', text:'Fikir bir', parts:[{id:'a',text:'Fikir bir'}] })];
  scriptler = [scriptTemizle({ id:'sc1', title:'Script bir', text:'metin' })];
  mekanlar = [mekanTemizle({ id:'mk1', name:'Mekan bir', city:'İstanbul' })];
  sablon = { accounts:[{platform:'instagram', url:'@ben'}], general:'Sablon metni',
             overrides:{}, updatedAt: 1000 };
  save(); saveProjects(); saveFikirler(); saveScriptler(); saveMekanlar(); saveSablon();
  renderCal(); renderProjects();
};

(async () => {
  const t = await chromium.launch();
  const ctx = await t.newContext({ viewport:{width:1280,height:1000}, acceptDownloads:true });
  const p = await ctx.newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1');
    localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_ai_settings', JSON.stringify({provider:'gemini', key:'AIzaGIZLI_ANAHTAR_123'}));
  }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
  await p.evaluate(TOHUM);

  console.log('[yedegin icerigi]');
  const y = await p.evaluate(()=> yedekGovdesi());
  bak('takvim kayitlari var',  (y.kayitlar  || []).length === 1);
  bak('PROJELER var',          (y.projeler  || []).length === 1);
  bak('FIKIRLER var',          (y.fikirler  || []).length === 1);
  bak('SCRIPTLER var',         (y.scriptler || []).length === 1);
  bak('MEKANLAR var',          (y.mekanlar  || []).length === 1);
  bak('SABLON var',            !!(y.sablon && y.sablon.general === 'Sablon metni'));
  bak('urun ve surum yazili',  y.urun === 'shootboard' && y.surum >= 1, y.urun + '/' + y.surum);
  bak('ne zaman alindigi yazili', !!y.alindi && !isNaN(Date.parse(y.alindi)), y.alindi);
  // Indirilen dosya e-postayla dolasabiliyor: anahtar icinde olmamali.
  bak('AI ANAHTARI yedege GIRMIYOR', JSON.stringify(y).indexOf('AIzaGIZLI') === -1);

  console.log('[indirme]');
  const [inen] = await Promise.all([
    p.waitForEvent('download'),
    p.click('#exportBtn')
  ]);
  const ad = inen.suggestedFilename();
  bak('dosya adinda tarih var', /^shootboard-yedek-\d{4}-\d{2}-\d{2}\.json$/.test(ad), ad);
  const inenYol = path.join(os.tmpdir(), 'yedek-testi-' + Date.now() + '.json');
  await inen.saveAs(inenYol);
  const inenVeri = JSON.parse(fs.readFileSync(inenYol, 'utf8'));
  bak('inen dosya da tam', (inenVeri.projeler||[]).length === 1 && (inenVeri.mekanlar||[]).length === 1);

  console.log('[geri yukleme birlestiriyor]');
  // Yedegi degistirip geri yukluyoruz: bir kayit DEGISMIS, bir kayit YENI.
  const yedek = JSON.parse(JSON.stringify(inenVeri));
  yedek.kayitlar[0].title = 'Kayit bir — düzeltildi';
  yedek.projeler.push({ id:'pr2', name:'Proje iki', type:'studio', steps:{}, deadlines:{}, createdAt:Date.now() });
  yedek.mekanlar.push({ id:'mk2', name:'Mekan iki', city:'Ankara' });
  const yedekYol = path.join(os.tmpdir(), 'yedek-degisik-' + Date.now() + '.json');
  fs.writeFileSync(yedekYol, JSON.stringify(yedek));

  // Geri yuklemeden ONCE elde olan, dosyada OLMAYAN bir kayit: silinmemeli.
  await p.evaluate(()=>{
    projects.push(sanitizeProject({ id:'pr_elde', name:'Elde duran proje', type:'other' }));
    saveProjects();
    window.onayla = ()=> Promise.resolve(true);
    window.uyari  = (m)=>{ window.__sonMesaj = m; return Promise.resolve(true); };
  });
  await p.setInputFiles('#yedekDosya', yedekYol);
  await p.waitForFunction(()=> !!window.__sonMesaj, null, { timeout: 8000 });

  const sonuc = await p.evaluate(()=>({
    kayitAdet: events.length,
    baslik: (events.find(e=>e.id==='ev1')||{}).title,
    projeler: projects.map(x=>x.id).sort(),
    mekanlar: mekanlar.map(x=>x.id).sort(),
    mesaj: window.__sonMesaj
  }));
  bak('degismis kayit guncellendi', sonuc.baslik === 'Kayit bir — düzeltildi', sonuc.baslik);
  bak('yeni proje eklendi', sonuc.projeler.indexOf('pr2') !== -1, sonuc.projeler.join(','));
  bak('DOSYADA OLMAYAN kayit silinmedi', sonuc.projeler.indexOf('pr_elde') !== -1, sonuc.projeler.join(','));
  bak('yeni mekan eklendi', sonuc.mekanlar.join(',') === 'mk1,mk2', sonuc.mekanlar.join(','));
  bak('kayit sayisi sismedi (kopya yok)', sonuc.kayitAdet === 1, String(sonuc.kayitAdet));
  bak('kac yeni kac guncel soyleniyor', /1 yeni|2 yeni|3 yeni/.test(sonuc.mesaj || ''), sonuc.mesaj);

  console.log('[eski sablon bugunkunu ezmiyor]');
  await p.evaluate(()=>{ sablon.general = 'BUGUNKU sablon'; sablon.updatedAt = 9999; saveSablon(); window.__sonMesaj = ''; });
  await p.setInputFiles('#yedekDosya', yedekYol);   // yedekteki damga 1000
  await p.waitForFunction(()=> !!window.__sonMesaj, null, { timeout: 8000 });
  bak('daha eski sablon uygulanmadi',
      await p.evaluate(()=> sablon.general) === 'BUGUNKU sablon',
      await p.evaluate(()=> sablon.general));

  console.log('[bozuk dosya]');
  const bozukYol = path.join(os.tmpdir(), 'bozuk-' + Date.now() + '.json');
  fs.writeFileSync(bozukYol, '{"urun":"baska-sey","kayitlar":[]}');
  await p.evaluate(()=>{ window.__sonMesaj = ''; });
  await p.setInputFiles('#yedekDosya', bozukYol);
  await p.waitForFunction(()=> !!window.__sonMesaj, null, { timeout: 8000 });
  bak('yedek olmayan dosya reddediliyor',
      /Shootboard yedeği değil/.test(await p.evaluate(()=> window.__sonMesaj)),
      await p.evaluate(()=> window.__sonMesaj));
  bak('reddedilince veri bozulmadi', await p.evaluate(()=> projects.length) === 3,
      String(await p.evaluate(()=> projects.length)));

  console.log('[vazgecince]');
  await p.evaluate(()=>{ window.onayla = ()=> Promise.resolve(false); window.__sonMesaj = ''; projects.push(sanitizeProject({id:'pr_x', name:'X', type:'other'})); saveProjects(); });
  await p.setInputFiles('#yedekDosya', yedekYol);
  await p.waitForTimeout(600);
  bak('hayir denince hicbir sey olmuyor',
      await p.evaluate(()=> projects.length) === 4 && !(await p.evaluate(()=> window.__sonMesaj)));

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
