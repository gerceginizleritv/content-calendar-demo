// ANKET SEÇENEĞİ SINIRI — PAYLAŞILAN SÜZGEÇ (ai/dogrula.js)
//
// Bu süzgeç İKİ yerde birden koşuyor: uygulamanın İçe Aktar penceresi
// (tarayıcıda) ve MCP sunucusu (Deno'da). Yani asistan bir anket
// yazdığında sınırı ilk burada görüyor.
//
// 27 Ekim 2026: bir anket `#100/4279063 Invalid parameter` ile reddedildi.
// Suçlu seçenek "İstanbul Arkeoloji Müzesi": 25 KARAKTER (sınırı aşmıyor)
// ama 27 BAYT. Süzgeç o gün karakter sayıyordu ve sessizce 25 karaktere
// KIRPIYORDU — yani hem yanlış ölçüyor hem anketin sorusunu değiştiriyordu.
//
// ⚠ Bu test o metni BİREBİR kullanıyor: uydurma uzun dize değil, gerçekten
// patlayan dize.
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); }
                            else { k++; console.log('  YOK '+ad+(ek!==undefined?' -> '+JSON.stringify(ek):'')); } };

const OLAY  = 'İstanbul Arkeoloji Müzesi';   // 25 karakter · 27 bayt
const CIKAN = 'İstanbul Arkeoloji';          // 18 karakter · 19 bayt (yayınlanan hâli)
const bayt  = (s)=> Buffer.byteLength(s, 'utf8');

(async () => {
  const D = await import(yol.join(KOK, 'ai', 'dogrula.js'));

  // Tek kayıtlık bir paket çöz, anket seçeneklerini ve hataları döndür.
  const coz = (secenekler)=>{
    const p = D.paketiCoz({ entries: [{
      date: '2026-12-01', time: '18:00', platform: 'threads', type: 'poll',
      title: 'deneme', content: { caption: 'soru', anketSecenekler: secenekler }
    }] });
    const kayit = (p.entries || [])[0] || {};
    const c = kayit.content || {};
    return { secenekler: c.anketSecenekler,
             hatalar: (p.hatalar || []).filter(h => /anketSecenekler/.test(h.alan || '')) };
  };

  console.log('[ölçü gerçekten bayt mı]');
  bak('olay dizesi 25 KARAKTER (sınırı aşmıyor)', OLAY.length === 25, OLAY.length);
  bak('★ ama 27 BAYT (sınırı aşıyor)', bayt(OLAY) === 27, bayt(OLAY));

  console.log('[27 Ekim olayı — süzgeç artık yakalıyor]');
  {
    const r = coz(["Datça'da, yerinde", OLAY, 'British Museum, Londra', 'Louvre, Paris']);
    bak('★ HATA BİLDİRİLİYOR', r.hatalar.length === 1, r.hatalar);
    bak('★ hangi seçenek olduğu yazıyor (dizin 1)',
        (r.hatalar[0] || {}).alan === 'content.anketSecenekler[1]', (r.hatalar[0] || {}).alan);
    bak('★ kaç birim fazla olduğu yazıyor',
        /^2 unit/.test((r.hatalar[0] || {}).sebep || ''), (r.hatalar[0] || {}).sebep);
    bak('aksanlı harf açıklaması var',
        /count as two/.test((r.hatalar[0] || {}).sebep || ''), (r.hatalar[0] || {}).sebep);
    // ⛔ KIRPMA YOK: kırpmak anketin SORUSUNU değiştirir.
    bak('★ METİN KIRPILMADI, olduğu gibi duruyor',
        Array.isArray(r.secenekler) && r.secenekler[1] === OLAY, (r.secenekler || [])[1]);
    bak('öteki seçenekler bozulmadı',
        Array.isArray(r.secenekler) && r.secenekler.length === 4
        && r.secenekler[3] === 'Louvre, Paris', r.secenekler);
  }

  console.log('[25 KARAKTERDEN de uzun olan — kırpma görünür olsun]');
  {
    // ⚠ BU VAKA MUTASYON TESTIYLE BULUNDU. Olay dizesi TAM 25 karakter,
    // yani eski `slice(0, 25)` onu hic degistirmiyor -- "kirpilmadi"
    // olcumu o dizeyle kirpmayi GOREMIYOR. 25 karakteri de asan bir
    // dize gerekiyor ki kirpma olursa fark edilsin.
    const UZUN = 'Topkapı Sarayı Müzesi ve Harem Dairesi';   // 38 karakter
    bak('deney dizesi 25 karakterden uzun', UZUN.length > 25, UZUN.length);
    const r = coz([UZUN, 'iki']);
    bak('★ hata bildiriliyor', r.hatalar.length === 1, r.hatalar);
    bak('★ METİN KIRPILMADI (slice(0,25) geri gelse burada yakalanır)',
        (r.secenekler || [])[0] === UZUN, (r.secenekler || [])[0]);
    bak('uzunluk aynen korundu', ((r.secenekler || [])[0] || '').length === UZUN.length,
        ((r.secenekler || [])[0] || '').length);
  }

  console.log('[yayınlanan hâli temiz geçiyor]');
  {
    const r = coz(["Datça'da, yerinde", CIKAN, 'British Museum, Londra', 'Louvre, Paris']);
    bak('★ kısaltılmış seçenekte hata YOK', r.hatalar.length === 0, r.hatalar);
    bak('dört seçenek de duruyor', (r.secenekler || []).length === 4, r.secenekler);
  }

  console.log('[sınır tam noktasında]');
  {
    bak('★ tam 25 bayt temiz geçiyor (sınır dahil)',
        coz(['abcdefghijklmnopqrstuvwxy', 'iki']).hatalar.length === 0);
    bak('★ 26 bayt yakalanıyor',
        coz(['abcdefghijklmnopqrstuvwxyz', 'iki']).hatalar.length === 1);
    // KARAKTER sayan kod tam burada YANILIR: 25 karakter ama 26 bayt.
    const kritik = 'ü' + 'abcdefghijklmnopqrstuvwx';
    bak('deney dizesi 25 karakter / 26 bayt', kritik.length === 25 && bayt(kritik) === 26,
        { kar: kritik.length, bayt: bayt(kritik) });
    bak('★ 25 KARAKTER ama 26 BAYT olan yakalanıyor', coz([kritik, 'iki']).hatalar.length === 1);
  }

  console.log('[gerileme — süzgecin öteki işleri bozulmadı]');
  {
    const r = coz(['bir','iki','uc','dort','BESINCI']);
    bak('beş seçenek dörde iniyor (eski tavan duruyor)', (r.secenekler || []).length === 4, r.secenekler);
    bak('fazlası sessizce atılıyor, hata üretmiyor', r.hatalar.length === 0, r.hatalar);
    const eski = coz(['Fil', 'Zürafa', 'Aslan']);
    bak('geçmişte yayınlanmış anket temiz', eski.hatalar.length === 0, eski.hatalar);
  }

  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
