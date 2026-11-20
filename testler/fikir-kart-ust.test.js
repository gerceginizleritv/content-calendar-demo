// FİKİR KARTININ ÜST SATIRI — proje kutusu ve öncelik seçicisi.
//
// NEDEN BU TEST VAR
//   20 Kasım 2026, kullanıcı ekran görüntüsüyle iki şey sordu:
//     1. "öncelikle 1 ●●●, 2 ●●○, 3 ●○○. bunlar yok."
//     2. "her bir fikir kutucuğunda proje ekle olan bazı beyaz
//         kutucuklar var bazılarında bu kutucuklar gri, burada ne
//         olduğunu anlayamadım."
//
//   Ölçüm ikisinin de kökünü gösterdi:
//
//   1. Göstergeler VARDI, kapalı açılır kutunun içindeydi; kutu
//      kapalıyken yalnızca "—" yazıyordu ve ne olduğunu söylemiyordu.
//      ⚠ Yani "görünmüyor" şikâyeti bir ETİKET eksikliğiydi, veri
//        ya da kapı sorunu değil. Kapalı kutu artık "— Öncelik"
//        yazıyor; metin `fk_onc_filtre` anahtarından geliyor, yeni
//        bir sözlük anahtarı açılmadı ki iki kopya ayrışamasın.
//
//   2. O "gri boş kutu" bir DÜĞMEYDİ: ikinci projeyi bağlayan "+".
//      `.fk-proj-chip{flex:1}` ona da uyguluyordu; tek projeli kartta
//      proje çipi satırı doldurunca "+" alt satıra düşüyor ve 110
//      piksele yayılıyordu (iki projeli kartta aynı düğme 24 piksel).
//      Davranış doğruydu, GÖRÜNÜŞ yanlıştı.
//
//   Üçüncüsü ölçüm sırasında çıktı: 360 pikselde "— proje yok —"
//   düğmesi 24 piksele iniyor, yazı tamamen üç noktaya dönüşüyordu.
//   ⚠ Bu kusur önceliklerden ÖNCE de vardı (ölçüldü); seçicinin
//     genişlemesi onu 20 piksele düşürdü, açan o değil.
//
// ⛔ BU TEST "GENİŞLİK ŞU KADAR OLSUN" DEMİYOR. Piksel sabiti yazmak
//   yazı tipi değişince kırılır ve asıl soruyu ölçmez. Ölçülen üç şey:
//     · "+" düğmesi proje çipinden belirgin olarak DAR mı (yayılmıyor)
//     · "— proje yok —" yazısı KIRPILIYOR mu (scrollWidth > clientWidth)
//     · sayfa yatay taşıyor mu
//   Üçü de birer SORU; cevapları yazı tipinden bağımsız.
//
// ⚠ DİL LİSTESİ SABİT YAZILMIYOR (CLAUDE.md Bölüm 7): diller LANG'dan
//   okunuyor, yeni bir dil kendiliğinden bu testin içine giriyor.

const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
const bak = (ad, kosul, ek)=>{
  if(kosul){ gecen++; console.log('  ok  ' + ad); }
  else { kalan++; console.log('  YOK ' + ad + (ek ? '\n      ' + ek : '')); }
};

// Dar telefon, dar telefon+, masaüstü. 360 en dar gerçek cihaz.
const GENISLIKLER = [360, 375, 1280];

(async ()=>{
  const b = await chromium.launch({});
  const jsHata = [];
  const olcumler = {};

  for(const gen of GENISLIKLER){
    const p = await b.newPage({ viewport:{ width:gen, height:900 } });
    p.on('pageerror', e=> jsHata.push(gen + 'px: ' + e.message));
    await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                     localStorage.setItem('demo_tour_done','1'); }catch(e){} });
    await p.route('**/goatcounter**', r=> r.abort());
    await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1600);

    olcumler[gen] = await p.evaluate(()=>{
      document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
      // Üç kart: projesiz · tek projeli · iki projeli. Tek projeli olan
      // kritik: çip satırı doldurunca "+" alt satıra düşüyor.
      projects = [{ id:'p1', name:'Süleymaniye Çekimi', type:'vlog', steps:[] },
                  { id:'p2', name:'Deneme', type:'desk', steps:[] }];
      fikirler = [
        fikirTemizle({ id:'f1', text:'Projesiz fikir',   parts:[], projectIds:[] }),
        fikirTemizle({ id:'f2', text:'Tek projeli fikir', parts:[], projectIds:['p1'] }),
        fikirTemizle({ id:'f3', text:'İki projeli fikir', parts:[], projectIds:['p1','p2'] })
      ];
      proAcik = true;
      setPage('ideas');

      const sonuc = {};
      Object.keys(LANG).forEach(dil=>{
        setLanguage(dil);
        renderFikirler();
        const kartlar = [...document.querySelectorAll('[data-fk-card]')];
        const sel = document.querySelector('[data-fk-onc]');
        sonuc[dil] = {
          kapaliMetin: sel ? sel.options[sel.selectedIndex].textContent.trim() : '',
          secenekler: sel ? [...sel.options].map(o=> o.textContent.trim()) : [],
          kartlar: kartlar.map(k=>{
            const btn = k.querySelector('[data-fk-projbtn]');
            const cip = k.querySelector('.fk-proj-chip.bagli');
            const ust = k.querySelector('.fk-card-top');
            return {
              bagliSayi: k.querySelectorAll('.fk-proj-chip.bagli').length,
              bos: btn ? btn.classList.contains('bos') : null,
              ekleGen: btn ? Math.round(btn.getBoundingClientRect().width) : 0,
              cipGen: cip ? Math.round(cip.getBoundingClientRect().width) : 0,
              kirpik: btn ? btn.scrollWidth > btn.clientWidth + 1 : null,
              ustTasma: ust ? Math.round(ust.scrollWidth - ust.clientWidth) : 0
            };
          }),
          govdeTasma: Math.round(document.documentElement.scrollWidth
                                 - document.documentElement.clientWidth)
        };
      });
      setLanguage('tr');
      return sonuc;
    });
    await p.close();
  }

  const diller = Object.keys(olcumler[GENISLIKLER[0]]);
  bak('en az iki dil ölçüldü', diller.length >= 2, diller.join(','));

  for(const gen of GENISLIKLER){
    for(const dil of diller){
      const o = olcumler[gen][dil];
      const etiket = gen + 'px/' + dil + ': ';

      // ── 1. "+" DÜĞMESİ YAYILMIYOR ────────────────────────────────
      // Projesi olan kartlarda düğme "+" ve ÇİPTEN belirgin dar olmalı.
      const projeli = o.kartlar.filter(k=> k.bagliSayi > 0);
      bak(etiket + 'projeli kart ölçüldü', projeli.length === 2,
          JSON.stringify(o.kartlar));
      bak('★ ' + etiket + '"+" düğmesi proje çipinden dar (satıra yayılmıyor)',
          projeli.length > 0 && projeli.every(k=> k.ekleGen < k.cipGen / 2),
          projeli.map(k=> 'ekle=' + k.ekleGen + ' cip=' + k.cipGen).join('  '));

      // ── 2. "— PROJE YOK —" KIRPILMIYOR ───────────────────────────
      // ⛔ Asıl kullanıcı şikâyeti buydu: okunmayan bir kutu.
      const bos = o.kartlar.filter(k=> k.bos);
      bak(etiket + 'projesiz kart ölçüldü', bos.length === 1, JSON.stringify(bos));
      bak('★ ' + etiket + '"— proje yok —" yazısı kırpılmıyor',
          bos.length > 0 && bos.every(k=> k.kirpik === false),
          JSON.stringify(bos));

      // ── 3. TAŞMA YOK ─────────────────────────────────────────────
      bak(etiket + 'kart üst satırı taşmıyor',
          o.kartlar.every(k=> k.ustTasma <= 0),
          o.kartlar.map(k=> k.ustTasma).join(','));
      bak(etiket + 'sayfa yatay taşmıyor', o.govdeTasma <= 0, String(o.govdeTasma));
    }
  }

  // ── 4. ÖNCELİK KUTUSU KAPALIYKEN KENDİNİ TANITIYOR ──────────────
  // ⛔ Kullanıcının "bunlar yok" dediği yer. Kutu kapalıyken tek bir
  //    tire ne olduğunu söylemiyordu.
  for(const dil of diller){
    const o = olcumler[1280][dil];
    bak('★ ' + dil + ': kapalı kutu yalnızca tire değil, bir SÖZCÜK taşıyor',
        /\p{L}{3,}/u.test(o.kapaliMetin), JSON.stringify(o.kapaliMetin));
    bak('★ ' + dil + ': üç düzeyin göstergeleri seçeneklerde duruyor',
        ['●●●','●●○','●○○'].every(im=> o.secenekler.some(x=> x.indexOf(im) !== -1)),
        JSON.stringify(o.secenekler));
    bak(dil + ': dört seçenek var (önceliksiz + üç düzey)',
        o.secenekler.length === 4, JSON.stringify(o.secenekler));
  }
  // ⚠ Sözlüğe girmeyen anahtar iki dilde AYNI metni verir.
  bak('★ kapalı kutu metni iki dilde FARKLI',
      olcumler[1280][diller[0]].kapaliMetin !== olcumler[1280][diller[1]].kapaliMetin,
      diller.map(d=> d + '=' + olcumler[1280][d].kapaliMetin).join('  '));

  bak('sayfa hatası yok', jsHata.length === 0, jsHata.join(' | '));

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
