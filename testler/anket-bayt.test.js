// ANKET SEÇENEĞİ SINIRI — KARAKTER DEĞİL BAYT
//
// 27 Ekim 2026: bir Threads anketi `#100/4279063 Invalid parameter` ile
// reddedildi ve kayıt `failed` oldu. Suçlu seçenek:
//
//     "İstanbul Arkeoloji Müzesi"   25 KARAKTER  ·  27 BAYT
//
// Threads'in sınırı 25. Karakter saydığımız için bu seçenek üç yerden
// de (kutunun maxlength'i, uygulamanın kontrolü, worker'ın kontrolü)
// SESSİZCE geçti ve hata ancak YAYIN SAATİNDE ortaya çıktı. Seçenek
// kısaltılınca aynı anket dört seçeneğiyle yayınlandı.
//
// ⚠ Bu test o metni BİREBİR kullanıyor. Uydurma bir uzun dize değil:
// gerçekten patlayan dize.
const { chromium } = require('./araclar');

(async () => {
  const b = await chromium.launch({ });
  let hata = 0;
  const k = (a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };

  const p = await b.newPage({ viewport:{ width:1280, height:900 } });
  p.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await p.addInitScript(()=>{ try{
    localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_tour_done','1');
  }catch(e){} });
  await p.route('**/supabase-js**', r=>r.fulfill({ status:200, contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};' }));
  await p.route('**/goatcounter**', r=>r.abort());
  await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });

  // Secenekleri kutulara yazip engeli soruyor.
  const engel = (liste)=> p.evaluate((l)=>{
    anketKutulariYaz(l);
    const e = anketEngeli('poll', null);
    // Sayfa tarafinda da patlamasin: mutasyonlu kodda anketEngelMesaji
    // beklenmedik bir sey dondurebilir ve test COKMEK yerine OLCMELI.
    let m = '';
    try { m = e ? String(anketEngelMesaji(e)) : ''; } catch(x){ m = 'HATA: ' + x; }
    return { ham: e, mesaj: m };
  }, liste);

  const OLAY = 'İstanbul Arkeoloji Müzesi';      // 25 karakter, 27 bayt
  const CIKAN = 'İstanbul Arkeoloji';            // 18 karakter, 19 bayt — yayınlanan hâli

  console.log('[ölçü gerçekten bayt mı]');
  {
    const o = await p.evaluate((s)=>({ karakter: s.length, bayt: anketBayt(s) }), OLAY);
    k('olay dizesi 25 KARAKTER (sınırı aşmıyor)', o.karakter === 25, o.karakter);
    k('★ ama 27 BAYT (sınırı aşıyor)', o.bayt === 27, o.bayt);
  }

  console.log('[27 Ekim olayı — artık KAYIT ANINDA yakalanıyor]');
  {
    const r = await engel(["Datça'da, yerinde", OLAY, 'British Museum, Londra', 'Louvre, Paris']);
    k('★ ENGELLENİYOR', !!r.ham && r.ham.anahtar === 'anket_uzun', r.ham);
    k('★ HANGİ seçenek olduğunu söylüyor', (r.mesaj || '').indexOf(OLAY) > -1, r.mesaj);
    k('★ KAÇ birim fazla olduğunu söylüyor', /2 birim fazla/.test(r.mesaj || ''), r.mesaj);
    k('Türkçe harf açıklaması var', /iki birim/.test(r.mesaj || ''), (r.mesaj || '').slice(-80));
    k('fazlalık doğru hesaplanıyor',
       !!(r.ham && r.ham.ek) && r.ham.ek.fazla === 2, r.ham);
  }

  console.log('[yayınlanan hâli geçiyor]');
  {
    const r = await engel(["Datça'da, yerinde", CIKAN, 'British Museum, Londra', 'Louvre, Paris']);
    k('★ kısaltılmış seçenekle engel YOK', r.ham === '', r.ham);
  }

  console.log('[sınır tam noktasında]');
  {
    // 25 bayt ASCII: tam sinirda, GECMELI.
    const r25 = await engel(['abcdefghijklmnopqrstuvwxy', 'iki']);
    k('★ tam 25 bayt geçiyor (sınır dahil)', r25.ham === '', r25.ham);
    // 26 bayt ASCII: bir fazla, KALMALI.
    const r26 = await engel(['abcdefghijklmnopqrstuvwxyz', 'iki']);
    k('★ 26 bayt engelleniyor', !!r26.ham && r26.ham.anahtar === 'anket_uzun', r26.ham);
    // 25 KARAKTER ama 26 BAYT: karakter sayan kod burada YANILIR.
    const rkar = await engel(['ü' + 'abcdefghijklmnopqrstuvwx', 'iki']);
    const olc = await p.evaluate(()=>({ kar: anketKutulariOku()[0].length, bayt: anketBayt(anketKutulariOku()[0]) }));
    k('deney dizesi 25 karakter / 26 bayt', olc.kar === 25 && olc.bayt === 26, olc);
    k('★ 25 KARAKTER ama 26 BAYT olan engelleniyor',
       !!rkar.ham && rkar.ham.anahtar === 'anket_uzun', rkar.ham);
  }

  console.log('[gerileme — eski kurallar duruyor]');
  {
    const az = await engel(['tek']);
    k('tek seçenekte hâlâ "en az 2" uyarısı', az.ham === 'anket_az', az.ham);
    k('o mesaj da okunur çıkıyor',
       (az.mesaj || '').length > 10 && (az.mesaj || '').indexOf('[object') < 0, (az.mesaj || '').slice(0,60));
    const iyi = await engel(['Fil', 'Zürafa', 'Aslan']);
    k('geçmişte yayınlanmış anket hâlâ geçiyor', iyi.ham === '', iyi.ham);
  }

  console.log('[İngilizce karşılığı var]');
  {
    await p.evaluate(()=> setLanguage('en'));
    const r = await engel(['abcdefghijklmnopqrstuvwxyz', 'two']);
    k('★ İngilizce mesaj da parametreli',
       /too long/.test(r.mesaj || '') && /abcdefghij/.test(r.mesaj || ''), r.mesaj);
    await p.evaluate(()=> setLanguage('tr'));
  }

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
