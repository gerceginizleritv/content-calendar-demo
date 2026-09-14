// Takvimde tarih etiketleri: gün + ay + (gerekince) yıl.
// Kullanıcının şikâyeti iki taneydi:
//   1. "Bazı yerlerde hangi ayda olduğu anlaşılmıyor" — telefonda ay adı
//      gizleniyordu.
//   2. "Yıl değiştiğinde aralık ve ocak karışabilir" — yıl hiçbir yerde
//      yazmıyordu.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  let hata = 0;
  const k = (a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };

  async function ac(genislik){
    const p = await (await b.newContext({ viewport:{width:genislik,height:900},
      isMobile: genislik < 700, hasTouch: genislik < 700 })).newPage();
    p.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
    await p.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
    await p.route('**/goatcounter**', r=>r.abort());
    await p.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await p.waitForTimeout(1500);
    return p;
  }
  // Pencereyi verilen tarihe taşıyor ve etiketleri döndürüyor.
  const git = (p, gorunum, tarih)=> p.evaluate(({gorunum,tarih})=>{
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    setView(gorunum);
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    const hedef = new Date(tarih); hedef.setHours(0,0,0,0);
    const gunFark = Math.round((hedef - bugun) / 86400000);
    haftaGunKaymasi = 0; gunKaymasi = 0; ayKaymasi = 0;
    if(gorunum === 'month'){
      ayKaymasi = (hedef.getFullYear()-bugun.getFullYear())*12 + (hedef.getMonth()-bugun.getMonth());
    } else if(gorunum === 'day'){ gunKaymasi = gunFark; } else { haftaGunKaymasi = gunFark; }
    renderCal();
    const al = s => [...document.querySelectorAll(s)].map(x=>x.textContent.replace(/\s+/g,' ').trim());
    const gorunuyor = s => { const e = document.querySelector(s);
      return !!e && getComputedStyle(e).display !== 'none'; };
    return { baslik: document.getElementById('rangeLabel').textContent,
             hafta: al('.hg-dayhead'), ay: al('.cal-day-num'), tablo: al('.ct-date'),
             ayGorunur: gorunuyor('.hg-mon'),
             kirpik: [...document.querySelectorAll('.hg-mon')].some(x=> x.scrollWidth > x.clientWidth + 1) };
  }, {gorunum,tarih});

  console.log('TAKVİM — TARİH ETİKETLERİ');
  const bu = new Date().getFullYear();

  // --- MASAÜSTÜ
  const masa = await ac(1280);
  let r = await git(masa, 'week', bu + '-12-30');
  k('hafta başlığında ay adı var', /Ara/.test(r.hafta[0]), r.hafta[0]);
  k('YIL SINIRINDA yıl yazıyor', r.hafta.some(x=> x.indexOf(String(bu+1)) !== -1), r.hafta);
  k('yıl SADECE geçiş gününde (tekrarlamıyor)',
     r.hafta.filter(x=> x.indexOf(String(bu+1)) !== -1).length === 1, r.hafta);

  k('başlıkta İKİ YIL da yazıyor', r.baslik.indexOf(String(bu)) !== -1
     && r.baslik.indexOf(String(bu+1)) !== -1, r.baslik);

  r = await git(masa, 'week', bu + '-09-14');
  k('BU YILA bakarken yıl yazmıyor (tablo genişlemiyor)',
     r.hafta.every(x=> !/\d{4}/.test(x)), r.hafta);
  // Ayni aya dusen aralik: ay adi TEK KEZ. Elle birlestirilince
  // "Sep 14 - Sep 20" oluyordu ve 320 piksellik ekranda kirpiliyordu.
  k('aynı aydaki aralıkta ay adı bir kez yazılıyor',
     (r.baslik.match(/Eyl/g) || []).length === 1, r.baslik);

  r = await git(masa, 'week', (bu+1) + '-01-13');
  k('tamamı gelecek yılda olan haftada ilk sütun yılı taşıyor',
     r.hafta[0].indexOf(String(bu+1)) !== -1
     && r.hafta.filter(x=> x.indexOf(String(bu+1)) !== -1).length === 1, r.hafta);

  r = await git(masa, 'month', bu + '-12-15');
  k('ay ızgarasında 1 Ocak yılıyla çıkıyor',
     r.ay.some(x=> /Oca/.test(x) && x.indexOf(String(bu+1)) !== -1), r.ay.filter(x=>/[A-Za-zÇĞİÖŞÜ]/.test(x)));

  r = await git(masa, 'table', bu + '-12-28');
  k('tablo görünümünde de yıl geçişte yazıyor',
     r.tablo.some(x=> /Oca/.test(x) && x.indexOf(String(bu+1)) !== -1), r.tablo.slice(0,8));
  k('tabloda yıl tekrarlamıyor',
     r.tablo.filter(x=> x.indexOf(String(bu+1)) !== -1).length === 1, r.tablo.slice(0,8));
  await masa.close();

  // --- TELEFON
  const tel = await ac(390);
  r = await git(tel, 'week', bu + '-12-30');
  k('TELEFONDA ay adı gizlenmiyor', r.ayGorunur === true);
  k('telefonda ay adı okunuyor', /Ara/.test(r.hafta[0]), r.hafta[0]);
  k('telefonda yıl İKİ HANE (kırpılmasın diye)',
     r.hafta.some(x=> /Oca ?\d{2}\b/.test(x)) && r.hafta.every(x=> !/\d{4}/.test(x)), r.hafta);
  k('telefonda ay adı kırpılmıyor', r.kirpik === false);
  await tel.close();

  // --- TEK BİÇİM: aynı sıra her görünümde (Çar 30 Ara)
  const m2 = await ac(1280);
  const sira = {};
  for(const gor of ['week','day','table','month']){
    const x = await git(m2, gor, bu + '-12-30');
    sira[gor] = gor === 'month' ? x.ay.filter(y=>/Ara/.test(y))[0]
              : gor === 'table' ? x.tablo[0]
              : gor === 'day'   ? x.baslik : x.hafta[0];
  }
  k('hafta: gün adı, gün, ay', /^Çar\s*30\s*Ara/.test(sira.week), sira.week);
  // Gün görünümünde masaüstünde UZUN biçim var ("Çarşamba 30 Aralık 2026").
  // Önemli olan kısaltma değil SIRA: gün adı, gün sayısı, ay.
  k('gün görünümü AYNI sırada', /^Çar(şamba)?\s*30\s*Ara(lık)?/.test(sira.day), sira.day);
  k('tablo AYNI sırada', /^Çar\s*30\s*Ara/.test(sira.table), sira.table);
  // Hücre metni artık gün damgasıyla başlıyor (telefonda görünür, geniş
  // ekranda gizli ama metinde var): "Sal 1 Ara".
  k('ay ızgarasında HER hücrede ay adı', /\d+\s*Ara/.test(sira.month), sira.month);
  // Ay ızgarasının üst satırı: dile göre
  const gunAdlari = await m2.evaluate(()=>{
    setLanguage('tr'); setView('month'); renderCal();
    return [...document.querySelectorAll('.cal-dow')].map(x=>x.textContent);
  });
  k('gün adları TÜRKÇE (koda gömülü değil)',
     gunAdlari[0] === 'PZT' && gunAdlari[2] === 'ÇAR', gunAdlari);
  const en = await m2.evaluate(()=>{
    setLanguage('en'); setView('month'); renderCal();
    return [...document.querySelectorAll('.cal-dow')].map(x=>x.textContent);
  });
  k('İngilizcede de doğru', en[0] === 'MON' && en[6] === 'SUN', en);
  await m2.close();

  // --- GÜN DAMGASI: hangi ekranda nereden geliyor
  // Telefonda ay görünümü tek sütunlu bir liste ve ızgaranın üst satırı
  // gizli; gün adını taşıyan tek yer hücrenin kendisi. Geniş ekranda ise
  // üst satır zaten "PZT SAL ÇAR..." diyor, damga her hücrede onun
  // tekrarı olurdu.
  const damga = p => p.evaluate(()=>{
    setLanguage('tr'); setPage('calendar'); setView('month'); renderCal();
    const dw = document.querySelector('.cal-day-dow');
    const ust = document.querySelector('.cal-dow');
    return { hucre: !!dw && getComputedStyle(dw).display !== 'none',
             ustSatir: !!ust && getComputedStyle(ust).display !== 'none',
             metin: (document.querySelector('.cal-day-num')||{}).textContent || '' };
  });
  const m3 = await ac(1280);
  const dMasa = await damga(m3);
  await m3.close();
  const t3 = await ac(390);
  const dTel = await damga(t3);
  await t3.close();
  k('geniş ekranda gün adı ÜST SATIRDA', dMasa.ustSatir === true && dMasa.hucre === false, dMasa);
  k('telefonda gün adı HÜCREDE', dTel.hucre === true && dTel.ustSatir === false, dTel);
  k('hücrede sıra: gün adı, gün, ay', /^[A-Za-zÇĞİÖŞÜçğıöşü]{3}\d+/.test(dTel.metin), dTel.metin);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close();
  process.exit(hata ? 1 : 0);
})();
