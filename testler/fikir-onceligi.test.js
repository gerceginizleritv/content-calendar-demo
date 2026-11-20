// FİKİR ÖNCELİĞİ — üç düzey, isteğe bağlı, yalnızca Creator Pro.
// (YAPILACAKLAR 52)
//
// NEDEN BU TEST VAR
//   Kullanıcının kararı (16 Kasım 2026): fikirlere üç düzeyli öncelik.
//     '1' Çok Öncelikli · '2' Orta Öncelik · '3' Düşük Öncelik
//   İsteğe bağlı, varsayılan yok; "önceliksiz" AYRI bir durum.
//
// ⛔ EN BÜYÜK RİSK VERİ KAYBI, VE O SESSİZ OLUR.
//   `fikirTemizle` beyaz listeli bir nesne kuruyor: listede olmayan
//   alan **sessizce düşer**. `oncelik` oraya yazılmasaydı yedekten
//   geri yükleme, bulut eşitlemesi ve eski sürümle açık kalmış ikinci
//   bir sekme kullanıcının verdiği önceliği SİLERDİ. Aynı tuzak
//   `setTemizle`de (8. madde) ve mekân koordinatlarında yaşandı.
//   ⚠ Bu yüzden aşağıda "temizleyiciden geçince duruyor mu" ayrı bir
//     iddia — ekranda görünmesi yetmez.
//
// ⚠ KAPI (Creator Pro) TARAYICIDA. Gerçek bir sınır değil; ölçülen şey
//   GÖRÜNÜRLÜK. Asıl zorlama ödeme duvarı gelince sunucuda olacak
//   (29. madde). ⛔ Kapı kapalıyken veri SİLİNMİYOR — planı düşen
//   birinin yazdığı şeyi yok etmek olurdu; test bunu da ölçüyor.

const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
const bak = (ad, kosul, ek)=>{
  if(kosul){ gecen++; console.log('  ok  ' + ad); }
  else { kalan++; console.log('  YOK ' + ad + (ek ? '\n      ' + ek : '')); }
};

const FIKIRLER = `fikirler = ['bir','iki','uc','dort'].map((x,i)=>
  fikirTemizle({ id:'f'+i, text:x, parts:[{id:'p'+i, text:x}], sort:i }));`;

(async ()=>{
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1280, height:1000 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                   localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1800);

  // ── 1. KAPI ────────────────────────────────────────────────────
  const kapi = await p.evaluate((kur)=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    eval(kur);
    proAcik = false; setPage('ideas');
    const kapali = { rozet: document.querySelectorAll('.fk-onc').length,
                     kart: document.querySelectorAll('.fk-card:not(.fk-add)').length,
                     filtre: [...document.getElementById('fk_filter').options]
                               .filter(o=> o.value.indexOf('onc:') === 0).length };
    proAcik = true; renderFikirler();
    const acik = { rozet: document.querySelectorAll('.fk-onc').length,
                   filtre: [...document.getElementById('fk_filter').options]
                             .filter(o=> o.value.indexOf('onc:') === 0).length };
    return { kapali, acik };
  }, FIKIRLER);

  bak('★ kapı KAPALIYKEN öncelik rozeti yok',
      kapi.kapali.rozet === 0 && kapi.kapali.kart === 4,
      JSON.stringify(kapi.kapali));
  bak('★ kapı kapalıyken öncelik SÜZGECİ de yok',
      kapi.kapali.filtre === 0, String(kapi.kapali.filtre));
  bak('★ kapı AÇIKKEN her kartta rozet var',
      kapi.acik.rozet === 4, String(kapi.acik.rozet));
  bak('★ kapı açıkken dört süzgeç seçeneği (önceliksiz + 1/2/3)',
      kapi.acik.filtre === 4, String(kapi.acik.filtre));

  // ── 2. İŞARETLER: RENGE DAYANMIYOR ─────────────────────────────
  const im = await p.evaluate(()=>{
    const sel = document.querySelector('.fk-onc');
    return { secenek: [...sel.options].map(o=> o.textContent.trim()),
             ipucu: sel.title, aria: sel.getAttribute('aria-label') };
  });
  bak('★ her düzeyde RAKAM ve dolu/boş nokta var (renk körlüğü)',
      /1 ●●●/.test(im.secenek[1]) && /2 ●●○/.test(im.secenek[2]) && /3 ●○○/.test(im.secenek[3]),
      JSON.stringify(im.secenek));
  bak('★ ekran okuyucuya düzeyin ADI gidiyor',
      /Öncelik:/.test(im.aria) && im.aria === im.ipucu, JSON.stringify(im));

  // ── 3. KAYDETME ve BEYAZ LİSTE ─────────────────────────────────
  const kayit = await p.evaluate(()=>{
    const sel = document.querySelector('.fk-onc');
    const id = sel.dataset.fkOnc;
    sel.value = '1'; sel.dispatchEvent(new Event('change', { bubbles:true }));
    const f = fikirById(id);
    return { veri: f.oncelik,
             // ⛔ ASIL İDDİA: temizleyiciden geçince DURUYOR mu.
             temizlikSonrasi: fikirTemizle(JSON.parse(JSON.stringify(f))).oncelik,
             // Geçersiz bir değer sessizce kabul edilmemeli.
             gecersiz: fikirTemizle({ id:'x', text:'y', parts:[{id:'z',text:'y'}], oncelik:'9' }).oncelik,
             rozet: document.querySelector(`[data-fk-onc="${id}"]`).dataset.d };
  });
  bak('★ seçilen düzey veriye yazıldı', kayit.veri === '1', kayit.veri);
  bak('⛔ TEMİZLEYİCİDEN GEÇİNCE DURUYOR (sessiz veri kaybı yok)',
      kayit.temizlikSonrasi === '1', String(kayit.temizlikSonrasi));
  bak('★ geçersiz düzey "önceliksiz"e düşüyor', kayit.gecersiz === '', kayit.gecersiz);
  bak('★ rozet seçilen düzeyi gösteriyor', kayit.rozet === '1', kayit.rozet);

  // ── 4. KAPI KAPANINCA VERİ SİLİNMİYOR ──────────────────────────
  const kapanis = await p.evaluate(()=>{
    proAcik = false; renderFikirler();
    return { rozet: document.querySelectorAll('.fk-onc').length,
             veriDuruyor: fikirler.filter(f=> f.oncelik).length };
  });
  bak('⛔ kapı kapanınca rozet gidiyor ama VERİ DURUYOR',
      kapanis.rozet === 0 && kapanis.veriDuruyor === 1, JSON.stringify(kapanis));

  // ── 5. BİRLEŞMEDE BÜYÜK ÖNCELİK KAZANIR ────────────────────────
  // Kullanıcının kuralı: 1+2→1, 2+3→2, 2+2→2; öncelikli+önceliksiz→öncelikli
  const birlesme = await p.evaluate(()=>({
    '1+2': oncelikKazanan('1','2'), '2+1': oncelikKazanan('2','1'),
    '2+3': oncelikKazanan('2','3'), '2+2': oncelikKazanan('2','2'),
    'yok+2': oncelikKazanan('','2'), '3+yok': oncelikKazanan('3',''),
    'yok+yok': oncelikKazanan('','')
  }));
  bak('★ 1+2→1 · 2+3→2 · 2+2→2',
      birlesme['1+2'] === '1' && birlesme['2+1'] === '1'
      && birlesme['2+3'] === '2' && birlesme['2+2'] === '2', JSON.stringify(birlesme));
  bak('★ öncelikli + önceliksiz → ÖNCELİKLİ',
      birlesme['yok+2'] === '2' && birlesme['3+yok'] === '3', JSON.stringify(birlesme));
  bak('★ ikisi de önceliksizse önceliksiz kalıyor',
      birlesme['yok+yok'] === '', JSON.stringify(birlesme));

  // Kuralın GERÇEK birleştirmede de uygulandığı:
  const gercek = await p.evaluate(()=>{
    fikirler = [
      fikirTemizle({ id:'a', text:'a', parts:[{id:'pa',text:'a'}], oncelik:'2' }),
      fikirTemizle({ id:'b', text:'b', parts:[{id:'pb',text:'b'}], oncelik:'1' })
    ];
    fikirBirlestir('a','b');
    return (fikirById('a') || {}).oncelik;
  });
  bak('⛔ gerçek birleştirmede de büyük öncelik kazanıyor',
      gercek === '1', String(gercek));

  // ── 6. SÜZME ───────────────────────────────────────────────────
  const suzme = await p.evaluate((kur)=>{
    eval(kur);
    fikirler[0].oncelik = '1'; fikirler[1].oncelik = '2'; fikirler[2].oncelik = '';
    fikirler[3].oncelik = '1';
    proAcik = true;
    const say = (f)=>{ fikirFiltreleri = f; return fikirleriSuz().map(x=> x.id); };
    const sonuc = { bir: say(['onc:1']), yok: say(['onc:yok']),
                    birVeIki: say(['onc:1','onc:2']), hepsi: say([]) };
    fikirFiltreleri = [];
    return sonuc;
  }, FIKIRLER);
  bak('★ "1" süzgeci yalnızca 1. düzeyi getiriyor',
      JSON.stringify(suzme.bir.sort()) === JSON.stringify(['f0','f3']), JSON.stringify(suzme.bir));
  bak('★ "önceliksiz" süzgeci önceliksizleri getiriyor',
      JSON.stringify(suzme.yok) === JSON.stringify(['f2']), JSON.stringify(suzme.yok));
  bak('★ iki düzey birden seçilince ikisi de geliyor',
      suzme.birVeIki.length === 3, JSON.stringify(suzme.birVeIki));
  bak('★ süzgeçsiz hepsi geliyor', suzme.hepsi.length === 4, String(suzme.hepsi.length));

  // ── 7. PAYLAŞIMDA GÖRÜNMEZ ─────────────────────────────────────
  // ⚠ Bugün paylaşım akışı fikirleri HİÇ taşımıyor; bu iddia ileride
  //   bir paylaşım özelliği fikirleri eklerse önceliğin sızmasını
  //   yakalasın diye var.
  const paylasim = await p.evaluate(()=>{
    fikirler[0].oncelik = '1';
    const metin = (typeof icsMetni === 'function') ? icsMetni() : '';
    return { oncelikIzi: /oncelik|\bONCELIK\b|●/i.test(metin), uzunluk: metin.length };
  });
  bak('★ paylaşım akışında öncelik izi yok',
      paylasim.oncelikIzi === false, JSON.stringify(paylasim));

  // ── 8. HER DİLDE ───────────────────────────────────────────────
  const diller = await p.evaluate(()=> Object.keys(LANG));
  const metin = {};
  for(const d of diller){
    metin[d] = await p.evaluate((dil)=>{
      setLanguage(dil); proAcik = true; renderFikirler();
      const sel = document.querySelector('.fk-onc');
      return { adlar: ['', '1', '2', '3'].map(k=> oncelikAdi(k)),
               ipucu: sel ? sel.title : '' };
    }, d);
  }
  bak('★ düzey adları HER DİLDE dolu',
      diller.every(d=> metin[d].adlar.every(x=> x && !/^fk_onc/.test(x))),
      JSON.stringify(metin));
  // ⚠ Sözlüğe girmeyen anahtar iki dilde AYNI metni verir.
  bak('★ düzey adları iki dilde FARKLI',
      JSON.stringify(metin[diller[0]].adlar) !== JSON.stringify(metin[diller[1]].adlar),
      JSON.stringify(metin[diller[0]].adlar));

  // ── 9. KONTRAST, İKİ TEMADA ────────────────────────────────────
  // ⚠ Şartname: "Kontrastlar uygulanmadan ÖLÇÜLECEK" (Bölüm 4).
  //   Ölçüm teste kondu ki palet işi (C grubu) yapıldığında
  //   kendiliğinden denetlensin.
  // ⚠ Rozet KENDİ zeminini boyuyor (background:var(--surface)), bu
  //   yüzden kıyas kartın değil ROZETİN kendi arka planıyla.
  // ⛔ --red KULLANILMIYOR: uygulamada hata ve gecikme demek. Test
  //   rengin --red olmadığını da ölçüyor.
  const kontrast = {};
  for(const tema of ['light', 'dark']){
    kontrast[tema] = await p.evaluate((tm)=>{
      document.documentElement.setAttribute('data-theme', tm);
      fikirler = ['a','b','c'].map((x,i)=> fikirTemizle(
        { id:'k'+i, text:x, parts:[{ id:'q'+i, text:x }], oncelik:String(i+1) }));
      proAcik = true; renderFikirler();
      const kok = getComputedStyle(document.documentElement);
      const kirmizi = (kok.getPropertyValue('--red') || '').trim();
      return [...document.querySelectorAll('.fk-onc')].map(el=>{
        const st = getComputedStyle(el);
        return { duzey: el.dataset.d, renk: st.color, zemin: st.backgroundColor,
                 kirmiziMi: !!kirmizi && st.color.trim() === kirmizi };
      });
    }, tema);
  }
  const say = (c)=> (String(c).match(/\d+(\.\d+)?/g) || []).slice(0,3).map(Number);
  const parlak = (r,g,b)=>{ const f = (c)=>{ c /= 255;
      return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };
  const oran = (a, c)=>{ const L1 = parlak(...say(a)), L2 = parlak(...say(c));
    const [y, d] = L1 > L2 ? [L1, L2] : [L2, L1]; return (y + 0.05) / (d + 0.05); };

  for(const tema of ['light', 'dark']){
    const dusuk = kontrast[tema].filter(x=> oran(x.renk, x.zemin) < 4.5);
    bak('★ ' + tema + ' temada üç düzey de 4.5 kontrastın üstünde',
        dusuk.length === 0,
        kontrast[tema].map(x=> x.duzey + ':' + oran(x.renk, x.zemin).toFixed(2)).join('  '));
    bak('⛔ ' + tema + ' temada hiçbir düzey --red kullanmıyor',
        kontrast[tema].every(x=> !x.kirmiziMi),
        JSON.stringify(kontrast[tema].map(x=> x.renk)));
  }
  await p.evaluate(()=> document.documentElement.removeAttribute('data-theme'));

  bak('sayfa hatası yok', jsHata.length === 0, jsHata.join(' | '));

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
