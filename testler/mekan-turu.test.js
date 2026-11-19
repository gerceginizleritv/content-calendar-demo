// MEKÂN TÜRÜ — hangi projede hangi mekânlar listeleniyor.  (YAPILACAKLAR 51)
//
// NEDEN BU TEST VAR
//   Kullanıcı 16 Kasım 2026'da ekran görüntüsüyle sordu:
//     "Masabaşı çekimde neden altta mekanlar çıkıyor? Çekim türüne
//      göre gelmesi gerekmiyor mu bu mekanların?"
//   Mekân kaydında tür alanı yoktu. sql/74 onu açtı, `PROJE_MEKAN_TURU`
//   eşlemeyi tutuyor.
//
// ⚠ EŞLEME KODDAN OKUNUYOR, TESTE KOPYALANMIYOR. Test
//   `PROJE_MEKAN_TURU` tablosunu sayfadan alıp her proje türü için
//   BEKLENENİ kendisi hesaplıyor. Tabloyu teste de yazsaydım iki kopya
//   olurdu ve biri değiştiğinde öteki sessizce eskirdi — bu deponun
//   tekrarlayan hatası.
//   ⛔ Ama "tablo neyse o" demek testi boşa düşürür: aşağıda ayrıca
//     KULLANICININ KENDİ SÖZLERİYLE verdiği üç satır elle doğrulanıyor
//     (masabaşı ve ürün incelemede hiçbiri, stüdyoda yalnızca stüdyo).
//     Yani tablo yanlış değiştirilirse test düşer.
//
// ⚠ TÜRÜ BOŞ OLAN MEKÂN HER PROJEDE GÖRÜNÜR — kullanıcının kararı
//   (19 Kasım 2026). Tersi seçilseydi bugünkü bütün mekânlar
//   projelerden birden kaybolurdu.
//
// ⚠ SEÇİLİ MEKÂNLAR SİLİNMİYOR. Proje türü sonradan değişirse bağ
//   duruyor, yerine sebebini söyleyen bir satır çıkıyor ("dursun,
//   uyarı çıksın" — kullanıcının kararı).

const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
const bak = (ad, kosul, ek)=>{
  if(kosul){ gecen++; console.log('  ok  ' + ad); }
  else { kalan++; console.log('  YOK ' + ad + (ek ? '\n      ' + ek : '')); }
};

// Her türden bir mekân + türü BOŞ bir mekân.
const MEKANLAR = [
  { id:'m_dis',    name:'Sahil',    tur:'dis' },
  { id:'m_mekan',  name:'Han',      tur:'mekan' },
  { id:'m_studyo', name:'Stüdyo A', tur:'studyo' },
  { id:'m_diger',  name:'Depo',     tur:'diger' },
  { id:'m_bos',    name:'Türsüz',   tur:'' }
];

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

  const olcum = await p.evaluate((mekanListesi)=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    mekanlar = mekanListesi.map(m=> ({ ...m, city:'', district:'' }));
    projeFormunuDoldur(null);
    // İki mekân seçili: tür değişince silinmediklerini ölçmek için.
    projeMekanSecimi.pe = ['m_dis', 'm_studyo'];
    const sonuc = {};
    PROJ_TYPES.forEach(pt=>{
      document.getElementById('pe_type').value = pt;
      mekanSecimListesiCiz('pe');
      mekanCipleriCiz('pe');
      sonuc[pt] = {
        listelenen: [...document.querySelectorAll('#pe_placeSecenek [data-mk-sec]')]
                      .map(e=> e.dataset.mkSec).sort(),
        bosMetin: (document.querySelector('#pe_placeSecenek .mk-sec-bos') || {}).textContent || '',
        cip: document.querySelectorAll('#pe_placeCip [data-mk-cip], #pe_placeCip .mk-cip').length
      };
    });
    return { sonuc, tablo: PROJE_MEKAN_TURU, turler: PROJ_TYPES, secili: projeMekanSecimi.pe.length };
  }, MEKANLAR);

  // ── 1. TABLO NE DİYORSA O ──────────────────────────────────────
  // Beklenen liste tablodan HESAPLANIYOR, teste yazılmıyor.
  for(const pt of olcum.turler){
    const izin = olcum.tablo[pt];
    let beklenen;
    if(izin === null) beklenen = [];
    else if(izin === '*') beklenen = MEKANLAR.map(m=> m.id).sort();
    else beklenen = MEKANLAR.filter(m=> !m.tur || izin.indexOf(m.tur) !== -1)
                            .map(m=> m.id).sort();
    const g = olcum.sonuc[pt].listelenen;
    bak(pt + ': listelenenler tabloya uyuyor',
        JSON.stringify(g) === JSON.stringify(beklenen),
        'gelen=' + g.join(',') + '  beklenen=' + beklenen.join(','));
  }

  // ── 2. KULLANICININ KENDİ SÖZLERİ ──────────────────────────────
  // ⛔ Bunlar tablodan türetilmiyor, ELLE yazılı: tablo yanlış
  //    değiştirilirse 1. bölüm yine geçerdi, bunlar geçmez.
  bak('★ MASABAŞI: hiçbir mekân listelenmiyor ("mekanlara gerek yok")',
      olcum.sonuc.desk.listelenen.length === 0,
      olcum.sonuc.desk.listelenen.join(','));
  bak('★ ÜRÜN İNCELEME: hiçbir mekân listelenmiyor',
      olcum.sonuc.review.listelenen.length === 0,
      olcum.sonuc.review.listelenen.join(','));
  bak('★ STÜDYO: yalnızca stüdyo (+ türü boş olan)',
      JSON.stringify(olcum.sonuc.studio.listelenen) === JSON.stringify(['m_bos','m_studyo']),
      olcum.sonuc.studio.listelenen.join(','));
  bak('★ VLOG: hepsi geliyor (kullanıcının kararı, 19 Kasım)',
      olcum.sonuc.vlog.listelenen.length === MEKANLAR.length,
      olcum.sonuc.vlog.listelenen.join(','));

  // ── 3. TÜRÜ BOŞ MEKÂN HER YERDE ────────────────────────────────
  // Bu kullanıcının kararı ve en kolay sessizce bozulacak şey:
  // bozulursa kullanıcının BÜTÜN mevcut mekânları kaybolur.
  const gorunduguYer = olcum.turler.filter(pt=>
    olcum.sonuc[pt].listelenen.indexOf('m_bos') !== -1);
  const beklenenYer = olcum.turler.filter(pt=> olcum.tablo[pt] !== null);
  bak('★ türü BOŞ mekân, mekân soran her türde görünüyor',
      JSON.stringify(gorunduguYer) === JSON.stringify(beklenenYer),
      'göründü=' + gorunduguYer.join(',') + '  beklenen=' + beklenenYer.join(','));

  // ── 4. SEÇİLİ MEKÂNLAR SİLİNMİYOR ──────────────────────────────
  bak('★ mekân sormayan türde SEBEP yazıyor',
      /mekân listelenmiyor/i.test(olcum.sonuc.desk.bosMetin),
      olcum.sonuc.desk.bosMetin);
  bak('★ seçili mekânlar duruyor (silinmedi)',
      olcum.secili === 2, String(olcum.secili));

  // ── 5. HER DİLDE ───────────────────────────────────────────────
  const diller = await p.evaluate(()=> Object.keys(LANG));
  const metin = {};
  for(const d of diller){
    metin[d] = await p.evaluate((dil)=>{
      setLanguage(dil);
      mekanTurSecenekleri();
      const sel = document.getElementById('mk_tur');
      document.getElementById('pe_type').value = 'desk';
      mekanSecimListesiCiz('pe');
      return { secenek: [...sel.options].map(o=> o.textContent.trim()),
               uyari: (document.querySelector('#pe_placeSecenek .mk-sec-bos') || {}).textContent || '' };
    }, d);
  }
  bak('★ tür adları HER DİLDE dolu', diller.every(d=>
        metin[d].secenek.length === 5 && metin[d].secenek.every(x=> x && !/^mk_tur/.test(x))),
      JSON.stringify(metin));
  // ⚠ Sözlüğe girmeyen anahtar iki dilde AYNI metni verir.
  bak('★ tür adları iki dilde FARKLI',
      JSON.stringify(metin[diller[0]].secenek) !== JSON.stringify(metin[diller[1]].secenek),
      JSON.stringify(metin[diller[0]].secenek));
  bak('★ uyarı cümlesi iki dilde FARKLI ve dolu',
      metin[diller[0]].uyari && metin[diller[1]].uyari
      && metin[diller[0]].uyari !== metin[diller[1]].uyari,
      JSON.stringify([metin[diller[0]].uyari, metin[diller[1]].uyari]));

  bak('sayfa hatası yok', jsHata.length === 0, jsHata.join(' | '));

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
