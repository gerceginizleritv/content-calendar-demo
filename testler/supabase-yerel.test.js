// SUPABASE KÜTÜPHANESİ DEPODAN GELİYOR  (YAPILACAKLAR 62)
//
// NEDEN BU TEST VAR
//   ⛔ 20 KASIM 2026 — BİR GÜNDE DÖRT ARIZA, HEPSİ AYNI DOSYA.
//   Kullanıcı sırayla şunları yaşadı:
//     1. Google ile giriş çalışmadı ("cevap dönmüyor")
//     2. Yönetim paneli "Yükleniyor…" diye asılı kaldı
//     3. Kaydettiği değişiklik sunucuya hiç ulaşmadı
//     4. Herkese açık fiyatlar sayfası "Fiyatlar yüklenemedi" dedi
//
//   Ölçüldü: Supabase'in kendisi SAĞLAMDI (REST beş denemede de 200,
//   0,18–0,39 sn; auth ayakta; Google OAuth zinciri uçtan uca
//   çalışıyor; canlı app.html depodakiyle bayt bayt aynı).
//   Geriye tek ortak bağımlılık kaldı: `cdn.jsdelivr.net` üzerinden
//   gelen supabase-js. O dosya gelmezse `sb` boş kalıyor ve o sayfada
//   HİÇBİR ŞEY çalışmıyor.
//
// ⚠ DÜRÜST SINIR: CDN'in o anda gerçekten takıldığı kanıtlanmadı.
//   Ama Supabase'in sağlam olduğu ölçüldü ve arızalanan her şey bu
//   tek dosyaya bağlıydı. Kütüphaneyi kendi sitemizden sunmak,
//   hangisi olursa olsun bu arıza SINIFINI kaldırıyor.
//
// ⛔ İKİ AYRI ŞEY ÖLÇÜLÜYOR, İKİSİ DE GEREKLİ:
//   1. Hiçbir sayfa supabase-js'i DIŞARIDAN çekmiyor mu
//      (dosyaları tarayarak — liste elle yazılmıyor)
//   2. Sayfalar GERÇEKTEN açılıyor mu, `window.supabase` var mı
//      (tarayıcıda açarak)
//   ⚠ Yalnızca birincisi olsaydı yanlış bir yol yazmak testten
//     geçerdi ve o sayfa tamamen çalışmaz hâle gelirdi — yani tam
//     da düzeltmeye çalıştığımız arıza.

const assert = require('node:assert');
const fs = require('fs');
const yol = require('path');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';
const KOK = yol.join(__dirname, '..');

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

// ⛔ LİSTE ELLE YAZILMIYOR: depo taranıyor. Yarın eklenen bir sayfa
//   kendiliğinden kapsama giriyor.
const ATLA = new Set(['node_modules', '.git', 'ciktilar', 'vendor']);
function htmlBul(dizin, toplam){
  for(const ad of fs.readdirSync(dizin)){
    if(ATLA.has(ad)) continue;
    const tam = yol.join(dizin, ad);
    const st = fs.statSync(tam);
    if(st.isDirectory()) htmlBul(tam, toplam);
    else if(ad.endsWith('.html')) toplam.push(tam);
  }
  return toplam;
}

(async ()=>{
  const hepsi = htmlBul(KOK, []);
  dene('depoda html bulundu (tarama çalışıyor)', ()=>{
    assert.ok(hepsi.length > 10, 'bulunan: ' + hepsi.length);
  });

  // ── 1. HİÇBİR SAYFA DIŞARIDAN ÇEKMİYOR ──────────────────────────
  //
  // ⛔ 20 KASIM 2026 — BU LİSTE BİR KEZ YANLIŞ KURULMUŞTU, MUTASYON
  //   YAKALADI. İlk hâlinde sayfalar `vendor/supabase.js` geçenlerden
  //   seçiliyordu. Bir sayfada yol yanlış yazılınca (deneme:
  //   `vendor/supabase-YANLIS.js`) o sayfa listeden DÜŞÜYOR, iddia
  //   sayısı 20'den 19'a iniyor ve test YİNE GEÇİYORDU — yani tam da
  //   yakalaması gereken arızayı görmüyordu.
  //   ⚠ Ders: "doğru olanları topla" diye liste kurma. Liste
  //     "kütüphaneyi ÇAĞIRAN her sayfa" olmalı; doğruluk ayrı bir
  //     iddia olmalı. Yoksa bozulan şey ölçümün DIŞINA çıkıyor.
  const kullananlar = [];
  for(const dosya of hepsi){
    const metin = fs.readFileSync(dosya, 'utf8');
    // Script etiketiyle supabase CAGIRAN her sayfa; dogru ya da yanlis.
    if(!/<script[^>]+src="[^"]*supabase[^"]*"/.test(metin)) continue;
    kullananlar.push(yol.relative(KOK, dosya));
  }
  const disaridan = kullananlar.filter(b=>
    /<script[^>]+src="https?:\/\/[^"]*supabase/.test(
      fs.readFileSync(yol.join(KOK, b), 'utf8')));

  dene('★ hiçbir sayfa supabase-js\'i DIŞARIDAN çekmiyor', ()=>{
    assert.deepStrictEqual(disaridan, [],
      'disaridan ceken: ' + disaridan.join(', '));
  });
  dene('★ kütüphaneyi çağıran sayfalar bulundu (ölçüm boşa düşmüyor)', ()=>{
    assert.ok(kullananlar.length >= 8,
      'cagiranlar: ' + kullananlar.length + ' -> ' + kullananlar.join(', '));
  });

  // ── 2. DOSYA DEPODA GERÇEKTEN VAR ───────────────────────────────
  dene('★ vendor/supabase-js.js depoda duruyor ve boş değil', ()=>{
    const p = yol.join(KOK, 'vendor', 'supabase-js.js');
    assert.ok(fs.existsSync(p), 'dosya yok');
    assert.ok(fs.statSync(p).size > 50000, 'boyut: ' + fs.statSync(p).size);
  });
  dene('webpack parçası da yanında (tembel yükleme 404 almasın)', ()=>{
    assert.ok(fs.existsSync(yol.join(KOK, 'vendor', '591.supabase.js')));
  });

  // ── 3. SAYFALAR GERÇEKTEN AÇILIYOR MU ───────────────────────────
  // ⛔ Asil olcum bu. Yanlis bir yol 1. bolumden GECERDI.
  const b = await chromium.launch({});
  const sonuc = {};
  for(const bagil of kullananlar){
    // kaynak/ dosyalari ureticinin girdisi; uretilen hali zaten listede.
    const p = await b.newPage({ viewport:{ width:1280, height:800 } });
    const basarisiz = [];
    p.on('requestfailed', r=>{ if(/supabase/.test(r.url())) basarisiz.push(r.url()); });
    const adres = SUNUCU + '/' + bagil.split(yol.sep).join('/');
    try{
      await p.goto(adres, { waitUntil:'domcontentloaded', timeout: 20000 });
      await p.waitForTimeout(900);
      sonuc[bagil] = {
        varMi: await p.evaluate(()=> typeof window.supabase),
        basarisiz: basarisiz.length
      };
    }catch(e){
      sonuc[bagil] = { varMi: 'ACILMADI: ' + e.message.slice(0, 80), basarisiz: -1 };
    }
    await p.close();
  }
  await b.close();

  for(const bagil of kullananlar){
    dene('★ ' + bagil + ': window.supabase var', ()=>{
      assert.strictEqual(sonuc[bagil].varMi, 'object',
        'durum: ' + JSON.stringify(sonuc[bagil]));
    });
  }
  dene('★ hiçbir sayfada supabase dosyası 404 almıyor', ()=>{
    const kotu = Object.keys(sonuc).filter(k=> sonuc[k].basarisiz > 0);
    assert.deepStrictEqual(kotu, [], 'basarisiz yukleme: ' + kotu.join(', '));
  });

  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
