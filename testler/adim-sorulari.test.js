// HER ADIMDA SOR — adim adinin yanindaki "?" (Asama 4, 12 Kasim 2026).
//
// BU TESTIN ASIL ISI "dugme var mi" degil, UC SESSIZ KAYBI olcmek:
//
//  1. SORU KUTUYA DONUSUYOR MU. Dugme adim hucresinin ICINDE, isaret
//     kutusunun yanindan geciyor. Tiklamanin adimin durumunu
//     degistirmesi tam olarak beklenen hata: kullanici soruya bakmak
//     icin basiyor, sistem "bu adim bitti" sanmaya basliyor. Oradan
//     geriye donus yok -- kayit kaydediliyor.
//
//  2. BIR DILDE EKSIK SORU. Sorular iki LANG nesnesinde ayri ayri
//     duruyor. Birine soru eklenip otekine eklenmemesi bu depoda ayni
//     sinif hatanin tekrari olur ve EKRANDA HICBIR SEY PATLAMAZ:
//     Ingilizce pencere bir soru eksik acilir, o kadar.
//
//  3. TELEFONDA ERISILEMEZ OLMA. Masaustunde dugme sutun basliginda
//     duruyor; sutun basliklari TELEFONDA GIZLI (olculdu: 0x0). Yani
//     yalnizca baslikta olsaydi telefonda ozellik hic olmazdi. Iki yer
//     ayri ayri olculuyor.
//
// Olculmeyen sey: sorularin IYI olup olmadigi. Onu kullanici soyler.
const { chromium, ORNEKSIZ } = require('./araclar');
const PORT = process.argv[2] || '8098';
const ADRES = 'http://127.0.0.1:' + PORT + '/app.html';
const ADIM = ['script','filmed','audio','edited','approved','package','published'];

async function sayfa(b, genislik){
  const page = await b.newPage({ viewport:{width:genislik, height:950} });
  const hatalar = [];
  page.on('pageerror', e=> hatalar.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/goatcounter**', r=> r.abort());
  await page.goto(ADRES, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr'); setPage('projects');
  });
  await page.waitForTimeout(400);
  return { page, hatalar };
}

(async () => {
  const b = await chromium.launch({ });
  let hata = 0;
  const k = (ad, s, ek)=>{ console.log((s?'  ✔ ':'  ✖ ')+ad+(ek!==undefined?' → '+ek:'')); if(!s) hata++; };
  console.log('HER ADIMDA SOR');

  // ───────── MASAUSTU ─────────
  const m = await sayfa(b, 1250);
  const mo = await m.page.evaluate((ADIM)=>{
    const bas = [...document.querySelectorAll('.proj-table thead th .adim-soru')];
    const huc = [...document.querySelectorAll('.proj-table td.pcell .adim-soru')];
    const gor = e=> e.getBoundingClientRect().width > 0;
    return {
      baslikSayi: bas.length,
      baslikGorunur: bas.filter(gor).length,
      hucreGorunur: huc.filter(gor).length,
      // Yedi dugme ayni adi tasirsa ekran okuyucu ikisini ayirt edemez.
      ayriEtiket: new Set(bas.map(e=> e.getAttribute('aria-label'))).size,
      adimSirasi: bas.map(e=> e.dataset.soru).join(','),
      boyut: bas[0] ? Math.round(bas[0].getBoundingClientRect().width)+'x'
                    + Math.round(bas[0].getBoundingClientRect().height) : '-',
      // Fikir sorulari proje ADIMI DEGIL: tabloda yeri olmamali.
      tablodaFikir: !!document.querySelector('.proj-table [data-soru="fikir"]')
    };
  }, ADIM);
  k('masaüstünde yedi başlık düğmesi', mo.baslikSayi === 7 && mo.baslikGorunur === 7,
     mo.baslikSayi + ' / görünür ' + mo.baslikGorunur);
  k('masaüstünde hücre düğmesi görünmüyor', mo.hucreGorunur === 0, String(mo.hucreGorunur));
  k('★ yedi düğmenin etiketi AYRI', mo.ayriEtiket === 7, String(mo.ayriEtiket));
  k('düğmeler adım sırasında', mo.adimSirasi === ADIM.join(','), mo.adimSirasi);
  k('fikir soruları tabloda DEĞİL', mo.tablodaFikir === false);

  // ASIL OLCU 1: tiklamak adimin durumunu DEGISTIRMIYOR.
  const durum = await m.page.evaluate(async (ADIM)=>{
    const al = ()=> JSON.stringify(projects.map(p=> ADIM.map(x=> !!p[x])));
    const once = al();
    for(const d of document.querySelectorAll('.proj-table thead th .adim-soru')){
      d.click();
      await new Promise(r=> setTimeout(r, 30));
      document.getElementById('dlgOk').click();
      await new Promise(r=> setTimeout(r, 30));
    }
    return { once, sonra: al() };
  }, ADIM);
  k('★ "?" ADIMIN DURUMUNU DEĞİŞTİRMİYOR', durum.once === durum.sonra,
     durum.once === durum.sonra ? 'yedi tıklama, hiçbiri değişmedi' : durum.sonra.slice(0,60));

  // Pencere bir SORU, bir KARAR degil: iptal dugmesi olmamali.
  const pen = await m.page.evaluate(()=>{
    adimSorulariAc('script');
    return { acik: document.getElementById('dlgOverlay').classList.contains('open'),
             baslik: document.getElementById('dlgTitle').textContent,
             iptalGizli: document.getElementById('dlgCancel').hidden,
             notVar: document.getElementById('dlgNot').textContent.length > 20,
             girisGizli: document.getElementById('dlgInput').hidden };
  });
  k('pencere açılıyor, başlıkta adım adı', pen.acik && pen.baslik === 'Script', pen.baslik);
  k('iptal düğmesi yok (karar değil, soru)', pen.iptalGizli === true);
  k('giriş kutusu yok', pen.girisGizli === true);
  k('altında "bunlar öneri" notu var', pen.notVar === true);
  await m.page.keyboard.press('Escape');
  await m.page.waitForTimeout(200);
  k('Escape kapatıyor', await m.page.evaluate(()=>
     !document.getElementById('dlgOverlay').classList.contains('open')));

  // ASIL OLCU 2: iki dilde AYNI SAYIDA soru.
  const dil = await m.page.evaluate((ADIM)=>{
    const anahtarlar = ADIM.concat(['fikir']).map(x=> 'soru_' + x);
    const oku = d=>{ setLanguage(d); const o={};
      for(const a of anahtarlar) o[a] = t(a); return o; };
    const tr = oku('tr'), en = oku('en');
    setLanguage('tr');
    const rapor = anahtarlar.map(a=>{
      const x = tr[a], y = en[a];
      return { a,
        dizi: Array.isArray(x) && Array.isArray(y),
        trSayi: Array.isArray(x) ? x.length : -1,
        enSayi: Array.isArray(y) ? y.length : -1,
        // Cevirisi yapilmamis soru: iki dilde birebir ayni metin.
        ayni: Array.isArray(x) && Array.isArray(y)
              ? x.filter((s,i)=> s === y[i]).length : -1,
        bos: [].concat(x||[], y||[]).filter(s=> !String(s||'').trim()).length };
    });
    return { rapor, notTR: oku('tr').length, uyum: (()=>{ setLanguage('tr'); return 1; })() };
  }, ADIM);
  const r = dil.rapor;
  k('sekiz anahtar da dizi', r.every(x=> x.dizi), r.filter(x=> !x.dizi).map(x=> x.a).join(',') || 'hepsi');
  k('★ İKİ DİLDE AYNI SAYIDA SORU', r.every(x=> x.trSayi === x.enSayi),
     r.filter(x=> x.trSayi !== x.enSayi).map(x=> x.a+' tr:'+x.trSayi+' en:'+x.enSayi).join(' | ') || 'hepsi eşit');
  k('boş soru yok', r.every(x=> x.bos === 0));
  k('hiçbir soru çevrilmemiş kalmamış', r.every(x=> x.ayni === 0),
     r.filter(x=> x.ayni > 0).map(x=> x.a).join(',') || 'hepsi çevrildi');
  // published UCTE KALDI: dorduncu soru ("Platformun yayin gunu listesi
  // tamam mi?") Asama 2'ye birakildi, cunku o liste henuz yok.
  // Asama 2 bu sayiyi 4 yapacak; test >= 3 diyor, sayiyi KILITLEMIYOR.
  k('her adımda en az üç soru', r.every(x=> x.trSayi >= 3),
     r.map(x=> x.a.replace('soru_','')+':'+x.trSayi).join(' '));

  // ───────── KIRPILMA ─────────
  // ⚠ BU OLCU SONRADAN EKLENDI, CUNKU GOZDEN KACTI. Dugme once adin
  // YANINA konuldu. Tablo table-layout:fixed ve baslik nowrap: Ingilizce
  // "PUBLISHED ?" 74 piksellik sutuna sigmiyor ve soru isareti
  // KIRPILIYORDU -- ekran goruntusunde gorulene kadar fark edilmedi.
  //
  // Niye ilk olcum goremedi: belge seviyesinde yatay kaydirma CIKMIYOR
  // (scrollWidth - clientWidth = 0). Kirpilma hucrenin kendi icinde.
  // Dogru olcu asagidaki: her cocugun kutusu, hucrenin IC kutusunun
  // icinde mi. Bu yuzden genislik ve dil birlikte taraniyor.
  const GENISLIK = [701, 860, 1024, 1250, 1440];
  const tasmalar = [];
  for(const w of GENISLIK){
    const t = await sayfa(b, w);
    for(const d of ['tr','en']){
      await t.page.evaluate(x=>{ setLanguage(x); setPage('projects'); }, d);
      await t.page.waitForTimeout(250);
      const kotu = await t.page.evaluate(()=>{
        let en = { ad:'-', t:-999 };
        for(const th of document.querySelectorAll('.proj-table thead th:not(.pname-col)')){
          const r = th.getBoundingClientRect(), cs = getComputedStyle(th);
          const sag = r.right - parseFloat(cs.paddingRight);
          const sol = r.left + parseFloat(cs.paddingLeft);
          for(const c of [...th.childNodes]){
            let cr;
            if(c.nodeType === 3){ const g = document.createRange(); g.selectNodeContents(c);
              cr = g.getBoundingClientRect(); }
            else if(c.getBoundingClientRect) cr = c.getBoundingClientRect();
            else continue;
            if(!cr.width) continue;
            const t = Math.round(Math.max(cr.right - sag, sol - cr.left));
            if(t > en.t) en = { ad: th.textContent.replace('?','').trim(), t };
          }
        }
        return en;
      });
      if(kotu.t > 0) tasmalar.push(w+'px/'+d+' '+kotu.ad+' +'+kotu.t);
    }
    await t.page.close();
  }
  k('★ BAŞLIKTA HİÇBİR ŞEY KIRPILMIYOR (5 genişlik × 2 dil)',
     tasmalar.length === 0, tasmalar.join(' | ') || '10 ölçümün hepsi temiz');

  k('masaüstünde sayfa hatası yok', m.hatalar.length === 0, m.hatalar.slice(0,2).join(' | '));
  await m.page.close();

  // ───────── TELEFON ─────────
  // ASIL OLCU 3: baslik gizli, dugme hucrede ve parmakla basilabilir.
  const f = await sayfa(b, 390);
  const fo = await f.page.evaluate(()=>{
    const bas = [...document.querySelectorAll('.proj-table thead th .adim-soru')];
    // Telefonda ADIN KENDISI dugme; ayri bir "?" yok.
    const huc = [...document.querySelectorAll('.proj-table td.pcell .adim-soru-ad')];
    const gor = e=> e.getBoundingClientRect().width > 0;
    const d = huc.find(gor);
    const r = d.getBoundingClientRect();
    const nokta = (x,y)=>{ const e = document.elementFromPoint(Math.round(x), Math.round(y));
      return e ? e.closest('button, [role="button"]') : null; };
    // ⚠ DOKUNMA ALANI KUTUDAN DEGIL, GERCEK NOKTADAN olculuyor. Ilk
    // surumde bir ::after'in kutusu okunuyordu ve "47 px" diyordu;
    // dugmede overflow:hidden oldugu icin o ::after kendi icinde
    // kirpiliyordu, basilabilen yer 25 pikseldi. Kutu yalan soyledi.
    // Asagidaki dikey tarama elementFromPoint ile gercekten basiyor.
    const merkezX = r.left + r.width/2;
    let ust = Math.round(r.top + r.height/2), alt = ust;
    while(ust > 0 && nokta(merkezX, ust - 1) === d) ust--;
    while(alt < innerHeight - 1 && nokta(merkezX, alt + 1) === d) alt++;
    let sol = Math.round(merkezX), sag = sol;
    const orta = Math.round(r.top + r.height/2);
    while(sol > 0 && nokta(sol - 1, orta) === d) sol--;
    while(sag < innerWidth - 1 && nokta(sag + 1, orta) === d) sag++;
    const alan = { y: alt - ust + 1, x: sag - sol + 1 };
    const hucre = d.closest('td.pcell');
    const bayrak = hucre.querySelector('.pflag');
    const br = bayrak.getBoundingClientRect();
    // ⚠ ASIL SEBEP BU OLCU: once adin YANINA ayri bir "?" konuldu ve
    // adlar kirpildi (360 pikselde 23 piksele, 460'ta 8 piksele). Her
    // genislikte ve iki dilde adin TAM gorundugu olculuyor.
    const kesik = [];
    for(const td of document.querySelectorAll('.proj-table td.pcell')){
      // Kisaltma IC SPAN'da: dugme flex, ellipsis orada duramaz.
      const a = td.querySelector('.adim-soru-ad .ad-yazi');
      if(a && a.scrollWidth > a.clientWidth + 1)
        kesik.push(a.textContent.trim() + ' ' + a.clientWidth + '/' + a.scrollWidth);
    }
    return {
      baslikGorunur: bas.filter(gor).length,
      hucreGorunur: huc.filter(gor).length,
      ayriSoru: [...document.querySelectorAll('.proj-table td.pcell .adim-soru')].filter(gor).length,
      gorunen: Math.round(r.width)+'x'+Math.round(r.height),
      dokunmaY: Math.round(alan.y), dokunmaX: Math.round(alan.x),
      hucreY: Math.round(hucre.getBoundingClientRect().height),
      kesik,
      // ⛔ TIKLANABILIR OLDUGUNU SOYLEYEN TEK ISARET. Once noktali cizgi
      // dugmenin kendisine yazildi ve EKRANDA HIC CIKMADI (dugme flex
      // kabi, yazi flex ogesinin icinde; ust ogenin cizgisi oraya
      // cizilmiyor). Isaret yoksa ozellik gorunmez demektir.
      cizgi: (()=>{ const y = d.querySelector('.ad-yazi');
        const c = getComputedStyle(y);
        return c.textDecorationLine + ' ' + c.textDecorationStyle; })(),
      bayrakSolKenar: (nokta(br.left + 1, br.top + br.height/2) || {}).className || 'yok',
      adMerkez: (nokta(r.left + r.width/2, r.top + r.height/2) || {}).className || 'yok'
    };
  });
  k('telefonda başlık düğmesi gizli', fo.baslikGorunur === 0, String(fo.baslikGorunur));
  k('telefonda adım adı düğme', fo.hucreGorunur > 0, String(fo.hucreGorunur));
  k('telefonda ayrı "?" yok', fo.ayriSoru === 0, String(fo.ayriSoru));
  k('★ ADIM ADLARI KIRPILMIYOR', fo.kesik.length === 0, fo.kesik.join(', ') || 'yedisi de tam');
  k('★ dokunma hedefi ≥44 px yüksek (gerçek basma)', fo.dokunmaY >= 44,
     fo.dokunmaY + '×' + fo.dokunmaX + ' px (çip ' + fo.hucreY + ' px)');
  k('adın merkezi düğmeyi alıyor', /adim-soru-ad/.test(fo.adMerkez), fo.adMerkez);
  k('★ adın altında noktalı çizgi var (tek görünür işaret)',
     /underline/.test(fo.cizgi) && /dotted/.test(fo.cizgi), fo.cizgi);
  k('★ komşu işaret kutusunun tıklaması ÇALINMIYOR',
     /pflag/.test(fo.bayrakSolKenar), fo.bayrakSolKenar);

  // Dokunma alani cipin KENDI yuksekligini (39 px) asiyor: 47 px icin
  // 11'er piksel yukari ve asagi tasiyor. O tasan parca UST VE ALT
  // SIRADAKI cipin uzerine geliyor. Olculen sey: YEDI cipin de kendi
  // isaret kutusu ve kendi tarih dugmesi hala kendisine ait mi.
  const calinan = await f.page.evaluate(async ()=>{
    const bozuk = [];
    for(const td of document.querySelectorAll('.proj-table td.pcell')){
      // Cip gorunur alanin ortasina getiriliyor. Yoksa sayfanin altindaki
      // SABIT menu seridi hucreyi ortuyor ve elementFromPoint onu
      // donduruyor -- o bir calma degil, olcum hatasi olurdu. (Ilk
      // surumde tam bu oldu: son cip "tab" dondurdu.)
      td.scrollIntoView({ block:'center' });
      await new Promise(r=> setTimeout(r, 20));
      for(const [ad, sec] of [['kutu','.pflag'],['tarih','.pdate']]){
        const el = td.querySelector(sec); if(!el) continue;
        const r = el.getBoundingClientRect();
        const n = [[r.left+r.width/2, r.top+r.height/2], [r.left+1, r.top+2],
                   [r.right-1, r.bottom-2]];
        for(const [x,y] of n){
          const bulunan = document.elementFromPoint(Math.round(x), Math.round(y));
          const dug = bulunan && bulunan.closest('button');
          if(!dug || !dug.matches(sec))
            bozuk.push(td.querySelector('.adim-soru-ad').textContent.trim()+'/'+ad);
        }
      }
    }
    return [...new Set(bozuk)];
  });
  k('★ HİÇBİR ÇİPİN kutusu/tarihi çalınmıyor (7 çip × 2 düğme × 3 nokta)',
     calinan.length === 0, calinan.join(', ') || '42 ölçümün hepsi temiz');

  // Telefonda da tiklamak durumu degistirmiyor.
  const fdurum = await f.page.evaluate(async (ADIM)=>{
    const al = ()=> JSON.stringify(projects.map(p=> ADIM.map(x=> !!p[x])));
    const once = al();
    const d = [...document.querySelectorAll('.proj-table td.pcell .adim-soru-ad')]
      .find(e=> e.getBoundingClientRect().width > 0);
    d.click();
    await new Promise(r=> setTimeout(r, 250));
    const acildi = document.getElementById('dlgOverlay').classList.contains('open');
    document.getElementById('dlgOk').click();
    await new Promise(r=> setTimeout(r, 120));
    return { ayni: once === al(), acildi };
  }, ADIM);
  k('telefonda pencere açılıyor', fdurum.acildi === true);
  k('★ telefonda da adımın durumu DEĞİŞMİYOR', fdurum.ayni === true);

  // Fikirler sayfasi: ayri dugme, kendi adi yazili.
  const fk = await f.page.evaluate(()=>{
    setPage('ideas');
    const d = document.querySelector('.fk-soru-satir .adim-soru');
    if(!d) return { yok:true };
    d.click();
    return { yok:false,
      etiket: d.getAttribute('aria-label'),
      yazi: (document.querySelector('.fk-soru-et')||{}).textContent,
      baslik: document.getElementById('dlgTitle').textContent,
      sayi: document.getElementById('dlgMsg').textContent.split('\n').filter(x=> x.trim()).length };
  });
  k('Fikirler sayfasında kendi düğmesi var', fk.yok === false);
  k('düğmenin adı yanında yazılı', !fk.yok && fk.yazi === fk.etiket && fk.yazi.length > 4, fk.yazi);
  k('fikir penceresi açılıyor', !fk.yok && fk.baslik === 'Fikir' && fk.sayi >= 4,
     fk.baslik + ' / ' + fk.sayi);

  k('telefonda sayfa hatası yok', f.hatalar.length === 0, f.hatalar.slice(0,2).join(' | '));
  await f.page.close();

  await b.close();
  console.log(hata ? '\n' + hata + ' KALDI' : '\nhepsi gecti');
  process.exit(hata ? 1 : 0);
})();
