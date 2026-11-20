// HESAPLAR PENCERESİ — platform başına sınır ve üç düzeltme
// (YAPILACAKLAR 53, 53a, 53b, 53c)
//
// NEDEN BU TEST VAR
//   Kullanıcının kararı (16 Kasım 2026): aynı platformda en fazla
//   iki hesap. Starter 1, Creator Pro 2. Sayı 20 Kasım 2026'da
//   kullanıcının seçimiyle **yönetim panelinden** yönetiliyor
//   (`plan_limits.accounts_per_platform`, sql/77) — kodda sabit değil.
//
// ⛔ EN BÜYÜK RİSK: MEVCUT VERİYİ BOZMAK.
//   Kullanıcının kararı: sınırın üstünde hesabı olanın hesapları
//   SİLİNMEZ, kayıt bağları kopmaz; yalnızca yenisi eklenemez.
//   Aşağıda ayrı bir iddia: sınır aşılmışken kaydet denince liste
//   olduğu gibi duruyor mu.
//   ⚠ Ayrıca DÜZENLEME engellenmemeli: sınırın üstünde kalmış biri
//     kendi mevcut hesabını düzenleyemez hale gelmemeli.
//
// ⛔ 53a — ENTER SESSİZCE YUTULUYORDU. `hs_kaydet` `type="button"`
//   ve etrafında `<form>` yok; alanlarda Enter hiçbir şey yapmıyor,
//   ne kayıt oluşuyor ne uyarı çıkıyordu. Alanları doldurup Enter'a
//   basan kullanıcı hesabın eklendiğini sanıyordu.
//   ⚠ Alanlar bir `<form>` içine ALINMADI: form Enter'da sayfayı
//     yenileyebilir ve yenilenme kaydı kaybeder.
//
// ⛔ 53b — AÇIKLAMA ŞARTI SÖYLEMİYORDU. "Aynı platformda birden çok
//   hesabın varsa buraya ekle" diyordu ama seçimin ancak İKİ hesapta
//   çıkacağını söylemiyordu; tek hesaplı kullanıcı kayıt ekranında
//   neden seçim görmediğini anlayamıyordu.
//
// ⛔ 53c — ZORUNLU ALAN BASMADAN ÖNCE BELLİ DEĞİLDİ. Ad alanı
//   zorunluydu ama kullanıcı bunu ancak "Ekle"ye BASTIKTAN sonra
//   görüyordu.
//
// ⚠ DİL LİSTESİ SABİT YAZILMIYOR (CLAUDE.md Bölüm 7): LANG'dan
//   okunuyor, yeni bir dil kendiliğinden giriyor.

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
  const uyarilar = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                   localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1700);

  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    // Uyarilari yakala: ekrana cikan metni olcecegiz.
    window.__uyarilar = [];
    window.uyari = (m)=> window.__uyarilar.push(String(m));
    hesaplar = [];
    setPage('ayarlar');
    hesapPlatformDoldur(); hesaplariCiz();
  });

  const doldurVeKaydet = (ad, platform, enterIle)=> p.evaluate(async (k)=>{
    document.getElementById('hs_ad').value = k.ad;
    document.getElementById('hs_platform').value = k.platform;
    if(k.enterIle){
      document.getElementById('hs_ad').dispatchEvent(
        new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
    }else{
      document.getElementById('hs_kaydet').click();
    }
    await new Promise(z=> setTimeout(z, 120));
    return { adet: hesaplar.length,
             platformlar: hesaplar.map(h=> h.platform),
             uyarilar: window.__uyarilar.slice() };
  }, { ad, platform, enterIle });

  // ── 53a · ENTER KAYDEDİYOR ──────────────────────────────────────
  await p.evaluate(()=>{ planSinirlari = { accounts_per_platform: 2 }; });
  const e1 = await doldurVeKaydet('Birinci', 'instagram', true);
  dene('★ 53a: Enter kaydediyor (eskiden sessizce yutuluyordu)', ()=>{
    assert.strictEqual(e1.adet, 1, JSON.stringify(e1));
  });
  dene('★ 53a: Enter sayfayı YENİLEMİYOR (form yok, veri kaybı yok)', ()=>{
    assert.strictEqual(jsHata.length, 0, jsHata.join(' | '));
  });

  // ── SINIR: 2. hesap geçiyor, 3. geçmiyor ────────────────────────
  const e2 = await doldurVeKaydet('Ikinci', 'instagram', false);
  dene('★ sınır 2 iken ikinci hesap ekleniyor', ()=>{
    assert.strictEqual(e2.adet, 2, JSON.stringify(e2));
  });
  const e3 = await doldurVeKaydet('Ucuncu', 'instagram', false);
  dene('★ sınır dolunca ÜÇÜNCÜ hesap eklenmiyor', ()=>{
    assert.strictEqual(e3.adet, 2, JSON.stringify(e3));
  });
  dene('★ engellenince sebep EKRANDA yazıyor (platform adı + sayı)', ()=>{
    const son = e3.uyarilar[e3.uyarilar.length - 1] || '';
    assert.ok(/Instagram/.test(son), 'uyari: ' + son);
    assert.ok(/\b2\b/.test(son), 'uyari: ' + son);
  });
  dene('⛔ engellenince MEVCUT hesaplar duruyor (silinmedi)', ()=>{
    assert.deepStrictEqual(e3.platformlar, ['instagram','instagram'],
      JSON.stringify(e3.platformlar));
  });

  // ── SINIR PLATFORM BAŞINA, TOPLAM DEĞİL ─────────────────────────
  const e4 = await doldurVeKaydet('Baska', 'youtube', false);
  dene('★ sınır PLATFORM BAŞINA: başka platforma eklenebiliyor', ()=>{
    assert.strictEqual(e4.adet, 3, JSON.stringify(e4));
  });

  // ── SINIR 1 OLUNCA (Starter) ────────────────────────────────────
  const e5 = await p.evaluate(async ()=>{
    hesaplar = []; window.__uyarilar = [];
    planSinirlari = { accounts_per_platform: 1 };
    document.getElementById('hs_ad').value = 'Tek';
    document.getElementById('hs_platform').value = 'tiktok';
    document.getElementById('hs_kaydet').click();
    await new Promise(z=> setTimeout(z, 100));
    const birinci = hesaplar.length;
    document.getElementById('hs_ad').value = 'Ikinci';
    document.getElementById('hs_platform').value = 'tiktok';
    document.getElementById('hs_kaydet').click();
    await new Promise(z=> setTimeout(z, 100));
    return { birinci, ikinci: hesaplar.length };
  });
  dene('★ Starter (sınır 1): ikinci hesap eklenmiyor', ()=>{
    assert.strictEqual(e5.birinci, 1, JSON.stringify(e5));
    assert.strictEqual(e5.ikinci, 1, JSON.stringify(e5));
  });

  // ── DÜZENLEME ENGELLENMİYOR ─────────────────────────────────────
  // ⛔ Sinirin USTUNDE kalmis biri kendi hesabini duzenleyebilmeli.
  const e6 = await p.evaluate(async ()=>{
    hesaplar = [
      hesapTemizle({ id:'h1', name:'Bir', platform:'instagram' }),
      hesapTemizle({ id:'h2', name:'Iki', platform:'instagram' }),
      hesapTemizle({ id:'h3', name:'Uc',  platform:'instagram' })
    ].filter(Boolean);
    planSinirlari = { accounts_per_platform: 1 };   // sinir ALTINDA kalmis
    hesapDuzenId = 'h2';
    document.getElementById('hs_ad').value = 'Iki DUZENLENDI';
    document.getElementById('hs_platform').value = 'instagram';
    document.getElementById('hs_kaydet').click();
    await new Promise(z=> setTimeout(z, 120));
    return { adet: hesaplar.length,
             ad: (hesaplar.find(h=> h.id === 'h2') || {}).name };
  });
  dene('⛔ sınırın üstünde kalmış hesap DÜZENLENEBİLİYOR', ()=>{
    assert.strictEqual(e6.ad, 'Iki DUZENLENDI', JSON.stringify(e6));
  });
  dene('⛔ düzenleme hiçbir hesabı silmiyor', ()=>{
    assert.strictEqual(e6.adet, 3, JSON.stringify(e6));
  });

  // ── SINIR OKUNMAMIŞSA BUGÜNKÜ HÂL ───────────────────────────────
  // ⚠ Varsayilan 2; 1 yapmak bir ag kesintisinde ikinci hesabi
  //   eklemeyi engellerdi.
  const e7 = await p.evaluate(async ()=>{
    hesaplar = []; planSinirlari = null;
    for(const ad of ['A','B']){
      document.getElementById('hs_ad').value = ad;
      document.getElementById('hs_platform').value = 'x';
      hesapDuzenId = null;
      document.getElementById('hs_kaydet').click();
      await new Promise(z=> setTimeout(z, 100));
    }
    return hesaplar.length;
  });
  dene('★ sınır okunmamışsa iki hesap yine eklenebiliyor', ()=>{
    assert.strictEqual(e7, 2, String(e7));
  });

  // ── 53b ve 53c · HER DİLDE ──────────────────────────────────────
  const diller = await p.evaluate(()=> Object.keys(LANG));
  const metin = {};
  for(const d of diller){
    metin[d] = await p.evaluate((dil)=>{
      setLanguage(dil);
      const im = document.getElementById('hs_adZorunlu');
      const alan = document.getElementById('hs_ad');
      return {
        intro: (document.querySelector('[data-i18n="hs_intro"]')||{}).textContent || '',
        imVar: !!im, imBaslik: im ? im.title : '',
        gerekli: alan ? alan.required : null,
        ariaGerekli: alan ? alan.getAttribute('aria-required') : null
      };
    }, d);
  }
  dene('★ 53c: zorunlu işareti var ve alan required', ()=>{
    assert.ok(metin[diller[0]].imVar, 'isaret yok');
    assert.strictEqual(metin[diller[0]].gerekli, true);
    assert.strictEqual(metin[diller[0]].ariaGerekli, 'true');
  });
  dene('★ 53c: işaretin başlığı HER DİLDE dolu', ()=>{
    assert.ok(diller.every(d=> metin[d].imBaslik && metin[d].imBaslik.length > 2),
      JSON.stringify(diller.map(d=> metin[d].imBaslik)));
  });
  dene('★ 53c: başlık iki dilde FARKLI (sözlüğe girmiş)', ()=>{
    assert.notStrictEqual(metin[diller[0]].imBaslik, metin[diller[1]].imBaslik,
      JSON.stringify(diller.map(d=> metin[d].imBaslik)));
  });
  dene('★ 53b: açıklama İKİ HESAP şartını söylüyor — her dilde', ()=>{
    assert.ok(diller.every(d=> /iki hesab|two accounts/i.test(metin[d].intro)),
      JSON.stringify(diller.map(d=> metin[d].intro.slice(0, 90))));
  });
  // ⛔ MARKA.md: "senin adina gonderi atmaz" iddiasi DOGRU ve kalmali.
  dene('⛔ açıklamada "bağlanmaz / göndermez" cümlesi duruyor', ()=>{
    assert.ok(diller.every(d=> /bağlanmaz|never connects/i.test(metin[d].intro)),
      JSON.stringify(diller.map(d=> metin[d].intro.slice(-90))));
  });

  await p.evaluate(()=> setLanguage('tr'));
  dene('sayfa hatası yok', ()=> assert.strictEqual(jsHata.length, 0, jsHata.join(' | ')));

  await b.close();
  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
