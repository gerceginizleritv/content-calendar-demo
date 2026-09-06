// Projeler sayfası: durum filtresi, okunur adres, Drive/script rozetleri.
const { chromium } = require('./araclar');
let k=0; const ok=(a,c,e)=>{ if(c) console.log('  ok  ',a); else { k++; console.log('  YOK ',a, e===undefined?'':'→ '+e); } };

async function ac(b){
  const p = await b.newPage({ viewport:{width:1500,height:1000} });
  p.hatalar=[]; p.on('pageerror', e=>p.hatalar.push(String(e)));
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_pitch','kapali'); localStorage.setItem('demo_ui_language','tr'); }catch(e){} });
  await p.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await p.route('**/goatcounter**', r=>r.abort());
  await p.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('projects'); });
  await p.waitForTimeout(300);
  return p;
}

(async()=>{
  const b = await chromium.launch({ });
  const p = await ac(b);

  // Bilinen veri kur
  await p.evaluate(()=>{
    projects.length = 0;
    const mk = (ad, ayar)=>{ const x = projeEkle(ad,'','','studio',''); Object.assign(x, ayar); return x; };
    mk('Bitmis',   { script:true, filmed:true, audio:true, edited:true, approved:true, package:true, published:true });
    mk('Devam',    { script:true });
    mk('Cekildi',  { script:true, filmed:true });
    mk('Iptal',    { cancelled:true });
    const g = mk('Geciken', {});
    adimTarihiYaz(g,'script','2020-01-01');
    const a = mk('Adresli', {});
    a.address = 'Sümela Manastırı, Maçka / Trabzon';
    a.scriptUrl = 'https://docs.google.com/document/d/abc';
    a.driveUrl  = 'https://drive.google.com/drive/folders/xyz';
    saveProjects(); renderProjects();
  });
  await p.waitForTimeout(400);

  console.log('\n1. Filtre satırı');
  ok('filtre satırı var', await p.isVisible('#p_filtre'));
  const etiketler = await p.$$eval('.pfilt', els=>els.map(e=>e.textContent.replace(/\d+$/,'').trim()));
  ok('sekiz filtre', etiketler.length === 8, etiketler.join(' | '));
  ok('istenen filtreler var', ['Tümü','Devam eden','Scripti hazır','Çekimi bitti','Tamamlanan','İptal']
      .every(x=>etiketler.includes(x)), etiketler.join(' | '));
  ok('başta "Tümü" açık', await p.evaluate(()=>document.querySelector('.pfilt.acik').dataset.filt === 'hepsi'));

  const say = async f => p.evaluate(k2=>{
    const el=[...document.querySelectorAll('.pfilt')].find(x=>x.dataset.filt===k2);
    return Number(el.querySelector('.pfilt-n').textContent); }, f);
  ok('tümü = 6',        await say('hepsi')    === 6, await say('hepsi'));
  ok('tamamlanan = 1',  await say('bitti')    === 1, await say('bitti'));
  ok('iptal = 1',       await say('iptal')    === 1, await say('iptal'));
  ok('scripti hazır = 3', await say('script') === 3, await say('script'));
  ok('çekimi bitti = 2',  await say('filmed') === 2, await say('filmed'));
  ok('geciken = 1',     await say('geciken')  === 1, await say('geciken'));

  console.log('\n2. Filtre gerçekten süzüyor');
  await p.click('.pfilt[data-filt="filmed"]'); await p.waitForTimeout(300);
  let adlar = await p.$$eval('.pname', e=>e.map(x=>x.textContent));
  ok('çekimi bitenler geldi', adlar.length === 2 && adlar.includes('Cekildi'), adlar.join(', '));
  ok('sayaç daraldığını yazıyor', /2\s*\/\s*6|2 \/ 6/.test(await p.textContent('#p_count')), await p.textContent('#p_count'));

  console.log('\n3. Filtre + arama birlikte');
  await p.fill('#p_search','Bitmis'); await p.waitForTimeout(350);
  adlar = await p.$$eval('.pname', e=>e.map(x=>x.textContent));
  ok('ikisi birlikte çalışıyor', adlar.length === 1 && adlar[0] === 'Bitmis', adlar.join(', '));
  await p.fill('#p_search',''); await p.click('.pfilt[data-filt="hepsi"]'); await p.waitForTimeout(300);

  console.log('\n4. Adres okunur, bağlantılar görünür');
  const adresMetni = await p.textContent('.pn-yer');
  ok('adres METNİ satırda', /Sümela Manastırı/.test(adresMetni), adresMetni.trim());
  // Baglantilar simge; ne olduklari ERISILEBILIR ADDA (aria-label).
  const linkler = await p.$$eval('.plink', e=>e.map(x=>({t:x.getAttribute('aria-label')||'', h:x.getAttribute('href'), s:x.textContent.trim()})));
  ok('script bağlantısı var', linkler.some(x=>/Script/i.test(x.t) && x.h.includes('docs.google')), JSON.stringify(linkler));
  ok('script simgesi 📄', linkler.some(x=>x.s === '📄'), JSON.stringify(linkler.map(x=>x.s)));
  ok('drive bağlantısı var',  linkler.some(x=>/Drive/i.test(x.t) && x.h.includes('drive.google')), JSON.stringify(linkler));
  ok('drive simgesi 📁', linkler.some(x=>x.s === '📁'), JSON.stringify(linkler.map(x=>x.s)));
  ok('bağlantısı olmayanda rozet YOK', linkler.length === 2, linkler.length);

  console.log('\n5. Ad sütunu kalabalık değil');
  const yukseklik = await p.evaluate(()=>{
    const th=[...document.querySelectorAll('.pname-col')].find(x=>/Sümela/.test(x.textContent));
    return th ? Math.round(th.getBoundingClientRect().height) : -1;
  });
  ok('en dolu satır 130 pikselin altında', yukseklik > 0 && yukseklik < 130, yukseklik + 'px');
  const satirSayisi = await p.evaluate(()=>{
    const th=[...document.querySelectorAll('.pname-col')].find(x=>/Sümela/.test(x.textContent));
    return th ? [...th.children].length : -1;
  });
  ok('ad sütununda en fazla 4 blok', satirSayisi > 0 && satirSayisi <= 4, satirSayisi);
  // Hiyerarsi: ad > konum > islem > kunye. Esit boyutlu dort satir
  // tam olarak kullanicinin 'cok karisik' dedigi seydi.
  const boyut = await p.evaluate(()=>{
    const th=[...document.querySelectorAll('.pname-col')].find(x=>/Sümela/.test(x.textContent));
    const px=el=>el?parseFloat(getComputedStyle(el).fontSize):0;
    return { ad:px(th.querySelector('.pname')), yer:px(th.querySelector('.pn-yer')),
             islem:px(th.querySelector('.pchip')), kunye:px(th.querySelector('.pn-meta')) };
  });
  ok('ad en büyük', boyut.ad > boyut.yer, JSON.stringify(boyut));
  ok('konum işlemden büyük', boyut.yer > boyut.islem, JSON.stringify(boyut));
  ok('künye en küçük', boyut.kunye <= boyut.islem, JSON.stringify(boyut));
  const kalin = await p.evaluate(()=>{
    const th=[...document.querySelectorAll('.pname-col')].find(x=>/Sümela/.test(x.textContent));
    return [...th.querySelectorAll('*')].filter(e=>Number(getComputedStyle(e).fontWeight)>=650).length;
  });
  ok('tek kalın öge (ad)', kalin === 1, kalin);

  ok('js hatası yok', p.hatalar.length === 0, p.hatalar.join(' | '));
  await p.close(); await b.close();
  console.log(k ? '\n'+k+' SORUN' : '\nHEPSİ GEÇTİ');
  process.exit(k?1:0);
})();
