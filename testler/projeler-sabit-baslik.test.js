// PROJELER TABLOSU — ÜST BAŞLIK SABİT  (YAPILACAKLAR 70)
//
// NEDEN BU TEST VAR
//   Kullanıcı 20 Kasım 2026'da ekran görüntüsüyle istedi:
//     "projeler sayfasında proje sayısı çok olduğunda aşağı scroll
//      edince üst başlıklar doğal olarak kayboluyor acaba üst başlık
//      bölümünü sabitlesek"
//   72 projesi var; aşağı inince hangi sütuna baktığı anlaşılmıyordu.
//
// ⛔ `position:sticky` ZATEN YAZILIYDI, ÇALIŞMIYORDU.
//   Sebep `.proj-table-wrap`: `overflow-x:auto` verilince tarayıcı
//   `overflow-y`yi de `auto` yapıyor (şartname: bir eksen `visible`
//   değilse öteki de olamaz). Böylece o kutu bir KAYDIRMA KUTUSU
//   oluyor ve başlık SAYFAYA değil ONA yapışıyor. Kutu dikey
//   kaymadığı için (yüksekliği 2357 piksel ölçüldü) başlık sayfayla
//   birlikte yukarı kayıp gidiyordu.
//
// ⚠ EŞİK ÖLÇÜLDÜ, SEÇİLMEDİ: tablo 1180 pikselde 10 piksel taşıyor,
//   1220'de hiç taşmıyor. 1220'den itibaren yatay kaydırmaya gerek
//   olmadığı için kutunun kaydırma kutusu olmasına da gerek yok.
//
// ⛔ BU TESTİN ASIL İŞİ KIRILGANLIĞI TUTMAK. Eşik sabit bir sayı;
//   tablo bir gün genişlerse (yeni sütun, uzun bir dil, daha geniş
//   proje sütunu) 1220'de yatay taşma başlar ve `overflow:visible`
//   yüzünden içerik DIŞARI TAŞAR. Aşağıdaki "taşma yok" iddiası tam
//   bu yüzden var ve tam eşikte ölçüyor.
//
// ⚠ TELEFON AYRICA ÖLÇÜLÜYOR (CLAUDE.md Bölüm 8). Orada tablo zaten
//   karta dönüşüyor ve `thead` gizli; bu düzeltme ona dokunmamalı.

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

const ESIK = 1220;   // CSS'teki min-width degeri

async function olc(b, gen){
  const p = await b.newPage({ viewport:{ width:gen, height:800 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(gen + 'px: ' + e.message));
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1');
                                   localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(SUNUCU + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1600);
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    // Ekrandan UZUN bir tablo: sabitlenme ancak kaydirinca olculur.
    projects = Array.from({length:40}, (_,i)=> ({ id:'p'+i, name:'Proje '+i,
      type:'vlog', steps:[] }));
    setPage('projects');
    if(typeof renderProjects === 'function') renderProjects();
  });
  await p.waitForTimeout(400);
  const once = await p.evaluate(()=>{
    const sar = document.querySelector('.proj-table-wrap');
    const th  = document.querySelector('.proj-table thead th');
    const thead = document.querySelector('.proj-table thead');
    return {
      sarVar: !!sar,
      yatayTasma: sar ? Math.round(sar.scrollWidth - sar.clientWidth) : null,
      theadGorunur: thead ? getComputedStyle(thead).display !== 'none' : null,
      thPos: th ? getComputedStyle(th).position : null,
      // ⚠ Saydam bir baslik satirlari KAPATMAZ: altindaki satir
      //   yazisi basligin icinden gorunur. Arka plan ayrica olculuyor.
      thZemin: th ? getComputedStyle(th).backgroundColor : null,
      basliklar: [...document.querySelectorAll('.proj-table thead th')]
                   .map(x=> x.textContent.trim().split('\n')[0])
    };
  });
  await p.evaluate(()=> window.scrollTo(0, 1200));
  await p.waitForTimeout(350);
  const sonra = await p.evaluate(()=>{
    const th = document.querySelector('.proj-table thead th');
    if(!th) return null;
    const k = th.getBoundingClientRect();
    return { ust: Math.round(k.top), gorunur: k.bottom > 0 && k.top < innerHeight,
             govdeTasma: Math.round(document.documentElement.scrollWidth
                                    - document.documentElement.clientWidth) };
  });
  await p.close();
  return { once, sonra, jsHata };
}

(async ()=>{
  const b = await chromium.launch({});
  const genis   = await olc(b, 1400);
  const esikte  = await olc(b, ESIK);
  const esikAlt = await olc(b, 1024);
  const telefon = await olc(b, 375);
  await b.close();

  // ── 1. GENİŞ EKRANDA BAŞLIK SABİT ───────────────────────────────
  for(const [ad, o] of [['1400px', genis], [ESIK + 'px', esikte]]){
    dene('★ ' + ad + ': kaydırdıktan sonra başlık HÂLÂ görünür', ()=>{
      assert.ok(o.sonra && o.sonra.gorunur, JSON.stringify(o.sonra));
    });
    dene('★ ' + ad + ': başlık ekranın tepesine yapışıyor', ()=>{
      assert.ok(Math.abs(o.sonra.ust) <= 2, 'ust: ' + o.sonra.ust);
    });
    // ⛔ KIRILGANLIK BEKCISI: tablo genislerse burasi duser.
    dene('⛔ ' + ad + ': tablo yatay TAŞMIYOR (overflow:visible güvenli)', ()=>{
      assert.strictEqual(o.once.yatayTasma, 0,
        'tasma: ' + o.once.yatayTasma + ' — tablo genisledi, esik gozden gecirilmeli');
    });
    dene(ad + ': sayfa yatay taşmıyor', ()=>{
      assert.strictEqual(o.sonra.govdeTasma, 0, String(o.sonra.govdeTasma));
    });
    dene('★ ' + ad + ': başlığın arka planı saydam DEĞİL', ()=>{
      assert.ok(!/rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(o.once.thZemin || ''),
        'zemin: ' + o.once.thZemin);
    });
  }
  dene('başlıklar gerçekten çizilmiş (ölçüm boşa düşmüyor)', ()=>{
    assert.ok(genis.once.basliklar.length >= 7,
      JSON.stringify(genis.once.basliklar));
  });

  // ── 2. EŞİĞİN ALTINDA BUGÜNKÜ HÂL BOZULMUYOR ────────────────────
  // ⚠ Orada yatay kaydirma GEREKIYOR; kutu kaydirma kutusu kalmali.
  dene('★ 1024px: yatay kaydırma hâlâ mümkün (dar ekran bozulmadı)', ()=>{
    assert.ok(esikAlt.once.yatayTasma > 0,
      'dar ekranda tasma beklenirdi: ' + esikAlt.once.yatayTasma);
  });
  dene('1024px: sayfa yatay taşmıyor', ()=>{
    assert.strictEqual(esikAlt.sonra.govdeTasma, 0, String(esikAlt.sonra.govdeTasma));
  });

  // ── 3. TELEFONDA KART DÜZENİ DURUYOR (CLAUDE.md Bölüm 8) ────────
  dene('⛔ 375px: tablo başlığı gizli — kart düzeni bozulmadı', ()=>{
    assert.strictEqual(telefon.once.theadGorunur, false,
      'thead gorunur: ' + telefon.once.theadGorunur);
  });
  dene('375px: sayfa yatay taşmıyor', ()=>{
    assert.strictEqual(telefon.sonra.govdeTasma, 0, String(telefon.sonra.govdeTasma));
  });

  const hatalar = [genis, esikte, esikAlt, telefon].flatMap(o=> o.jsHata);
  dene('sayfa hatası yok', ()=> assert.strictEqual(hatalar.length, 0, hatalar.join(' | ')));

  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
