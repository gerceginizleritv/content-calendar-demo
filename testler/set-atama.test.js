// SET ATAMASI: KULLANICI HANGİ SETİN HANGİ TÜRDE TİKLİ GELECEĞİNİ SEÇER
// (YAPILACAKLAR 54b, aşama 1 — veri katmanı ve türetme)
//
// NEDEN BU TEST VAR
//   Kullanıcı istedi (17 Kasım 2026): *"hangi tip videoya atamak
//   istiyorsa düzenleme arayüzü vermeliyiz"*. Kararı (21 Kasım 2026,
//   4. karar): *"Set önerileri HAZIR türlerde de değiştirilebilir.
//   Bugünkü SET_ONERI değerleri başlangıç olarak kalır; kullanıcı
//   dokunmazsa hiçbir şey değişmez."*
//
// ⛔ EN BÜYÜK RİSK: BUGÜNKÜ DAVRANIŞI SESSİZCE DEĞİŞTİRMEK.
//   "Kullanıcı dokunmazsa hiçbir şey değişmez" ölçülebilir bir
//   iddiadır ve aşağıda ayrı ayrı ölçülüyor: atama yokken yedi türün
//   HEPSİ bugünkü tabloyla aynı listeyi veriyor, Masabaşı/grafik
//   türünde bölüm yine HİÇ çıkmıyor.
//
// ⛔ İKİNCİ RİSK: 8. MADDEDE KAZANILAN NOTU KAYBETMEK.
//   Kullanıcının kendi seti artık öneri listesine girebiliyor. O
//   setin maddesi kütüphaneden gelir ve NOTU taşır ("Powerbank —
//   çantanın yan cebinde"). Hazır setin maddesi ise 'canta'/'yap'.
//   İki biçimi tek biçime düzleştirmek notu sessizce silerdi;
//   aşağıda ayrı bir iddia bunu ölçüyor.
//
// ⛔ ÜÇÜNCÜ RİSK: DOĞRULAMANIN YÜKLENME SIRASINA BAĞLANMASI.
//   54c'nin dersi. Hazır setlerin anahtarları SÖZLÜKTEN geliyor
//   (`t('hset')`); listeye bakan bir doğrulama, dil yüklenmeden önce
//   kullanıcının atamasını SESSİZCE SİLERDİ. Doğrulama BİÇİME
//   bakıyor ve aşağıda bu ayrıca ölçülüyor.

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

(async ()=>{
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1280, height:1000 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                   localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1700);
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    turSetleri = {}; kendiTurler = []; ihtiyacSetleri = [];
  });
  console.log('SET ATAMASI (54b aşama 1)');

  // Türetmeyi tek yerden okuyan yardımcı.
  const oneri = (tur, atama, kendiSetler)=> p.evaluate((k)=>{
    turSetleri = k.atama || {};
    if(k.kendiSetler) ihtiyacSetleri = k.kendiSetler;
    const l = setOnerisiListesi({ type: k.tur, setOneri: { soruldu:false, eklenen: k.eklenmis || [] } });
    return { tikli: l.filter(x=> x.tikli).map(x=> x.k),
             tiksiz: l.filter(x=> !x.tikli).map(x=> x.k),
             adlar: l.map(x=> x.ad),
             kendiBayrak: l.filter(x=> x.kendi).map(x=> x.k),
             adet: l.length };
  }, { tur, atama, kendiSetler, eklenmis: undefined });

  // ── 1 · DOKUNMAZSA HİÇBİR ŞEY DEĞİŞMEZ ───────────────────────────
  const tabloya = await p.evaluate(()=>{
    turSetleri = {};
    const sonuc = {};
    // ⚠ TÜR LİSTESİ SABİT YAZILMIYOR: PROJ_TYPES'tan okunuyor, yeni
    //   hazır tür kendiliğinden girer.
    PROJ_TYPES.forEach(tur=>{
      const l = setOnerisiListesi({ type: tur, setOneri:{ soruldu:false, eklenen:[] } });
      sonuc[tur] = { tikli: l.filter(x=> x.tikli).map(x=> x.k),
                     tiksiz: l.filter(x=> !x.tikli).map(x=> x.k) };
    });
    return { sonuc, tablo: JSON.parse(JSON.stringify(SET_ONERI)),
             genel: SET_ONERI_GENEL.slice(), turler: PROJ_TYPES.slice() };
  });
  dene('⛔ ATAMA YOKKEN her türün TİKLİ listesi bugünkü tabloyla AYNI', ()=>{
    for(const tur of tabloya.turler){
      const bek = tabloya.tablo[tur] ? tabloya.tablo[tur].tikli : [];
      assert.deepStrictEqual(tabloya.sonuc[tur].tikli, bek,
        tur + ': ' + JSON.stringify(tabloya.sonuc[tur]));
    }
  });
  dene('⛔ ATAMA YOKKEN Masabaşı/grafik türünde bölüm HİÇ çıkmıyor', ()=>{
    assert.deepStrictEqual(tabloya.sonuc.desk, { tikli: [], tiksiz: [] },
      JSON.stringify(tabloya.sonuc.desk));
  });
  dene('★ kullanıcının kararı: vlog\'da "konuşmalı" ve "dış" TİKLİ geliyor', ()=>{
    assert.deepStrictEqual(tabloya.sonuc.vlog.tikli.slice().sort(),
      ['dis','konusmali'], JSON.stringify(tabloya.sonuc.vlog));
  });
  dene('★ ATAMA YOKKEN üç genel set her türde TİKSİZ listede duruyor', ()=>{
    for(const tur of tabloya.turler){
      if(!tabloya.tablo[tur]) continue;     // desk: bölüm hiç yok
      for(const g of tabloya.genel){
        assert.ok(tabloya.sonuc[tur].tiksiz.indexOf(g) !== -1,
          tur + ' içinde ' + g + ' yok: ' + JSON.stringify(tabloya.sonuc[tur]));
      }
    }
  });

  // ── 2 · ATAMA TİKLİ LİSTEYİ DEĞİŞTİRİYOR ─────────────────────────
  const a1 = await oneri('vlog', { vlog: ['telefon'] });
  dene('★ atama TİKLİ listeyi değiştiriyor (yalnızca "telefon")', ()=>{
    assert.deepStrictEqual(a1.tikli, ['telefon'], JSON.stringify(a1));
  });
  dene('⛔ tablodaki eski tikliler KAYBOLMUYOR, TİKSİZ olarak duruyor', ()=>{
    assert.ok(a1.tiksiz.indexOf('konusmali') !== -1, JSON.stringify(a1));
    assert.ok(a1.tiksiz.indexOf('dis') !== -1, JSON.stringify(a1));
  });
  dene('⛔ hiçbir set listede İKİ KEZ yazmıyor', ()=>{
    const hepsi = a1.tikli.concat(a1.tiksiz);
    assert.strictEqual(new Set(hepsi).size, hepsi.length, JSON.stringify(hepsi));
  });

  // ── 3 · BOŞ DİZİ DE BİR KARAR ────────────────────────────────────
  const a2 = await oneri('vlog', { vlog: [] });
  dene('★ boş dizi = "bu türde hiçbir set tikli gelmesin"', ()=>{
    assert.deepStrictEqual(a2.tikli, [], JSON.stringify(a2));
  });
  dene('⛔ boş dizide bölüm YİNE ÇIKIYOR (tiksizler duruyor)', ()=>{
    assert.ok(a2.tiksiz.length >= 3, JSON.stringify(a2));
  });

  // ── 4 · MASABAŞI'NA ATAMA YAPILIRSA BÖLÜM AÇILIYOR ───────────────
  const a3 = await oneri('desk', { desk: ['dis'] });
  dene('★ kullanıcı Masabaşı\'na set atarsa bölüm AÇILIYOR', ()=>{
    assert.deepStrictEqual(a3.tikli, ['dis'], JSON.stringify(a3));
  });
  dene('⛔ Masabaşı\'na atama yapılınca da ÜÇ GENEL set tiksiz geliyor', ()=>{
    for(const g of tabloya.genel){
      assert.ok(a3.tiksiz.indexOf(g) !== -1, g + ' yok: ' + JSON.stringify(a3));
    }
  });

  // ── 5 · KENDİ ÇEKİM TÜRÜNE ATAMA (54c ile birlikte) ──────────────
  const a4 = await p.evaluate(()=>{
    kendiTurler = [{ k:'ct_podcast1', ad:'Podcast — iki kişi', adres:false }];
    turSetleri = { ct_podcast1: ['konusmali'] };
    const l = setOnerisiListesi({ type:'ct_podcast1', setOneri:{ soruldu:false, eklenen:[] } });
    return { tikli: l.filter(x=> x.tikli).map(x=> x.k), adet: l.length };
  });
  dene('★ KENDİ çekim türüne de set atanabiliyor (54c ile birlikte)', ()=>{
    assert.deepStrictEqual(a4.tikli, ['konusmali'], JSON.stringify(a4));
  });

  // ── 6 · KULLANICININ KENDİ SETİ ÖNERİ LİSTESİNE GİRİYOR ──────────
  const KENDI = [{ id:'st_benim1', ad:'Benim setim',
                   maddeler:[{ metin:'Powerbank', not:'çantanın yan cebinde' },
                             { metin:'Yedek kart', not:'' }] }];
  const a5 = await oneri('vlog', { vlog: ['st_benim1'] }, KENDI);
  dene('★ kullanıcının KENDİ seti öneri listesine giriyor', ()=>{
    assert.deepStrictEqual(a5.tikli, ['st_benim1'], JSON.stringify(a5));
  });
  dene('★ kendi setinin ADI listede yazıyor', ()=>{
    assert.ok(a5.adlar.indexOf('Benim setim') !== -1, JSON.stringify(a5.adlar));
  });
  dene('★ kendi seti "kendi" olarak işaretli (arayüz ayırt edebilsin)', ()=>{
    assert.deepStrictEqual(a5.kendiBayrak, ['st_benim1'], JSON.stringify(a5));
  });
  const a5m = await p.evaluate(()=> setOnerisiMaddeleri('st_benim1'));
  dene('★ kendi setinin madde sayısı ve metinleri doğru okunuyor', ()=>{
    assert.strictEqual(a5m.length, 2, JSON.stringify(a5m));
    assert.strictEqual(a5m[0].metin, 'Powerbank', JSON.stringify(a5m));
  });

  // ── 7 · 8. MADDENİN NOTU KAYBOLMUYOR ─────────────────────────────
  const uyg = await p.evaluate(()=>{
    ihtiyacSetleri = [{ id:'st_benim1', ad:'Benim setim',
                        maddeler:[{ metin:'Powerbank', not:'çantanın yan cebinde' }] }];
    ihtiyaclar = [{ id:'ih1', ad:'Powerbank', grup:'Enerji' }];
    const pr = { id:'pp1', name:'Deneme', type:'vlog', steps:{}, createdAt:Date.now() };
    projects = [pr];
    const eklenen = setOnerisiUygula(pr, ['st_benim1'], {});
    const liste = projeListesi(pr);
    return { eklenen, liste: liste.map(x=> ({ metin:x.metin, kaynak:x.kaynak,
                                              not:x.not, grup:x.grup, set:x.set })) };
  });
  dene('⛔ 8. MADDE: kendi setinin NOTU çekim listesine taşınıyor', ()=>{
    assert.strictEqual(uyg.eklenen, 1, JSON.stringify(uyg));
    assert.strictEqual(uyg.liste[0].not, 'çantanın yan cebinde', JSON.stringify(uyg));
  });
  dene('★ kendi setinin maddesi KÜTÜPHANE maddesi olarak giriyor', ()=>{
    assert.strictEqual(uyg.liste[0].kaynak, 'kutuphane', JSON.stringify(uyg));
  });
  dene('★ kütüphanedeki GRUBU da taşınıyor', ()=>{
    assert.strictEqual(uyg.liste[0].grup, 'Enerji', JSON.stringify(uyg));
  });
  dene('★ madde hangi setten geldiğini biliyor', ()=>{
    assert.strictEqual(uyg.liste[0].set, 'st_benim1', JSON.stringify(uyg));
  });

  // ── 8 · HAZIR SETİN MADDE TÜRÜ BOZULMADI ─────────────────────────
  const uyg2 = await p.evaluate(()=>{
    const pr = { id:'pp2', name:'Deneme2', type:'vlog', steps:{}, createdAt:Date.now() };
    projects = [pr];
    const eklenen = setOnerisiUygula(pr, ['dis'], {});
    const liste = projeListesi(pr);
    return { eklenen, kaynaklar: [...new Set(liste.map(x=> x.kaynak))],
             notlar: [...new Set(liste.map(x=> x.not))] };
  });
  dene('⛔ HAZIR setin maddeleri yine "canta"/"yap" olarak giriyor', ()=>{
    assert.ok(uyg2.eklenen > 0, JSON.stringify(uyg2));
    for(const k of uyg2.kaynaklar){
      assert.ok(k === 'canta' || k === 'yap', 'beklenmeyen kaynak: ' + k);
    }
  });
  dene('★ hazır setin maddesinde not YOK (uydurulmuş not girmiyor)', ()=>{
    assert.deepStrictEqual(uyg2.notlar, [''], JSON.stringify(uyg2.notlar));
  });

  // ── 9 · TANIMADIĞI ANAHTAR LİSTEYİ TOPLUCA DÜŞÜRMÜYOR ────────────
  const a6 = await oneri('vlog', { vlog: ['yok_boyle_set','telefon'] }, []);
  dene('⛔ tanımadığı anahtar SESSİZCE atlanıyor, liste düşmüyor', ()=>{
    assert.deepStrictEqual(a6.tikli, ['telefon'], JSON.stringify(a6));
  });

  // ── 10 · BEYAZ LİSTELİ TEMİZLEYİCİ ───────────────────────────────
  const tem = await p.evaluate(()=> ({
    tanimsizTur: turSetTemizle({ uydurma_tur: ['dis'] }),
    gecerliTur:  turSetTemizle({ vlog: ['dis'] }),
    kendiTurYok: turSetTemizle({ ct_yokboyle: ['dis'] }),
    diziDegil:   turSetTemizle({ vlog: 'dis' }),
    tekrar:      turSetTemizle({ vlog: ['dis','dis','telefon'] }),
    bozukAnahtar:turSetTemizle({ vlog: ['dis','<script>','a'.repeat(50)] }),
    bosDizi:     turSetTemizle({ vlog: [] }),
    copGiris:    turSetTemizle('merhaba')
  }));
  dene('⛔ tanımadığı TÜR anahtarı düşüyor', ()=>{
    assert.deepStrictEqual(tem.tanimsizTur, {}, JSON.stringify(tem.tanimsizTur));
  });
  dene('★ geçerli hazır tür duruyor', ()=>{
    assert.deepStrictEqual(tem.gecerliTur, { vlog:['dis'] }, JSON.stringify(tem.gecerliTur));
  });
  dene('⛔ BİÇİME uyan ct_ anahtarı, TANIMI OLMASA DA duruyor (54c dersi)', ()=>{
    assert.deepStrictEqual(tem.kendiTurYok, { ct_yokboyle:['dis'] },
      JSON.stringify(tem.kendiTurYok));
  });
  dene('⛔ dizi olmayan değer düşüyor', ()=>{
    assert.deepStrictEqual(tem.diziDegil, {}, JSON.stringify(tem.diziDegil));
  });
  dene('★ aynı set iki kez yazılmışsa bir kez kalıyor', ()=>{
    assert.deepStrictEqual(tem.tekrar, { vlog:['dis','telefon'] }, JSON.stringify(tem.tekrar));
  });
  dene('⛔ biçime uymayan set anahtarı düşüyor, ötekiler duruyor', ()=>{
    assert.deepStrictEqual(tem.bozukAnahtar, { vlog:['dis'] },
      JSON.stringify(tem.bozukAnahtar));
  });
  dene('⛔ BOŞ DİZİ KORUNUYOR (bir karar, "dokunmadı" değil)', ()=>{
    assert.deepStrictEqual(tem.bosDizi, { vlog:[] }, JSON.stringify(tem.bosDizi));
  });
  dene('⛔ çöp giriş boş nesne veriyor (çökmüyor)', ()=>{
    assert.deepStrictEqual(tem.copGiris, {}, JSON.stringify(tem.copGiris));
  });

  // ── 11 · DOĞRULAMA YÜKLENME SIRASINDAN BAĞIMSIZ (54c dersi) ──────
  const sira = await p.evaluate(()=>{
    // Sözlük hiç okunmamış gibi: hazır set listesi BOŞ.
    const asil = window.hazirSetler;
    window.hazirSetler = ()=> [];
    const temiz = turSetTemizle({ vlog: ['dis','st_benim1'] });
    window.hazirSetler = asil;
    return temiz;
  });
  dene('⛔ hazır set listesi BOŞKEN de atama SİLİNMİYOR (biçim doğrulaması)', ()=>{
    assert.deepStrictEqual(sira, { vlog:['dis','st_benim1'] }, JSON.stringify(sira));
  });

  // ── 12 · ZATEN EKLENMİŞ SET LİSTEYE GİRMİYOR ─────────────────────
  const a7 = await p.evaluate(()=>{
    turSetleri = { vlog: ['telefon','dis'] };
    const l = setOnerisiListesi({ type:'vlog',
      setOneri:{ soruldu:true, eklenen:['telefon'] } });
    return { tikli: l.filter(x=> x.tikli).map(x=> x.k),
             hepsi: l.map(x=> x.k) };
  });
  dene('⛔ zaten eklenmiş set listeye GİRMİYOR (bugünkü davranış)', ()=>{
    assert.ok(a7.hepsi.indexOf('telefon') === -1, JSON.stringify(a7));
    assert.deepStrictEqual(a7.tikli, ['dis'], JSON.stringify(a7));
  });

  // ── 13 · YEREL VE BULUT GİDİŞ-DÖNÜŞ ──────────────────────────────
  const tasima = await p.evaluate(()=>{
    turSetleri = { vlog:['dis'], desk:[] };
    saveTurSetleri();
    const yerel = readTurSetleri();
    const prefsDolu = tercihPrefsYap().tur_setleri;
    turSetleri = {};
    const prefsBos = tercihPrefsYap().tur_setleri;
    turSetleriBuluttan({ vlog:['telefon'], uydurma:['x'] });
    const buluttan = JSON.parse(JSON.stringify(turSetleri));
    return { yerel, prefsDolu, prefsBosVar: prefsBos !== undefined, buluttan };
  });
  dene('★ yerel gidiş-dönüş: kaydedilen aynen geri okunuyor', ()=>{
    assert.deepStrictEqual(tasima.yerel, { vlog:['dis'], desk:[] },
      JSON.stringify(tasima.yerel));
  });
  dene('★ hesaba taşınıyor (prefs.tur_setleri)', ()=>{
    assert.deepStrictEqual(tasima.prefsDolu, { vlog:['dis'], desk:[] },
      JSON.stringify(tasima.prefsDolu));
  });
  dene('⛔ atama yokken prefs satırına HİÇ yazılmıyor', ()=>{
    assert.strictEqual(tasima.prefsBosVar, false);
  });
  dene('⛔ buluttan gelen de TEMİZLENİYOR (tanımadığı tür düşüyor)', ()=>{
    assert.deepStrictEqual(tasima.buluttan, { vlog:['telefon'] },
      JSON.stringify(tasima.buluttan));
  });

  // ── 14 · SEÇİLEBİLİR SETLER (asama 2'nin zemini) ─────────────────
  const sec = await p.evaluate(()=>{
    ihtiyacSetleri = [{ id:'st_a', ad:'A seti', maddeler:[{metin:'x',not:''}] }];
    const l = secilebilirSetler();
    return { adet: l.length, hazir: l.filter(x=> !x.kendi).length,
             kendi: l.filter(x=> x.kendi).map(x=> x.k) };
  });
  dene('★ seçilebilir setler = hazır sekiz + kendi setleri', ()=>{
    assert.strictEqual(sec.hazir, 8, JSON.stringify(sec));
    assert.deepStrictEqual(sec.kendi, ['st_a'], JSON.stringify(sec));
  });

  dene('★ hiç JS hatası yok', ()=>{
    assert.strictEqual(jsHata.length, 0, jsHata.join(' | '));
  });

  await p.close(); await b.close();
  console.log('  ---- ' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
