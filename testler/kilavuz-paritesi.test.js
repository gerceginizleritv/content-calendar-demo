// KILAVUZLAR BİRBİRİYLE AYNI YAPIDA MI (CLAUDE.md Bölüm 7)
//
// NEDEN BU TEST VAR
//   Bölüm 7: *"Kılavuza bir bölüm mü eklendi? Her dilin kılavuzuna
//   eklenir."* 21 Kasım 2026'da 54. maddenin kılavuz bölümü
//   yazılırken fark edildi: `kilavuz-vurgu` her kılavuzu AYRI AYRI
//   denetliyor ("en az 10 bölüm var mı", "işaret görünüyor mu") ama
//   kılavuzları **birbiriyle karşılaştırmıyor.** Türkçeye bölüm
//   ekleyip İngilizceyi unutmak sessizce geçerdi.
//
// ⛔ BU DEPONUN TEKRARLAYAN HATASI: bir yerde yapıp ötekinde
//    unutmak. Çözüm her seferinde aynı: LİSTEYİ ELLE YAZMAYAN,
//    KENDİ BULAN bekçi.
//
// ⚠ KILAVUZ LİSTESİ SABİT YAZILMIYOR: `id="yanMenu"` taşıyan
//   dosyalar taranarak bulunuyor (`kilavuz-vurgu` ile aynı yöntem).
//   Yeni bir dilin kılavuzu kendiliğinden denetime giriyor.
//
// ⛔ METİN KARŞILAŞTIRILMIYOR, YAPI KARŞILAŞTIRILIYOR. İki dilin
//    metni aynı olamaz (çeviri). Ölçülen şey: bölüm KİMLİKLERİ aynı
//    sırada mı, her bölümdeki alt başlık (h3) SAYISI aynı mı, menü
//    bağlantısı sayısı bölüm sayısıyla tutuyor mu.

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

// ⚠ `kaynak/` ATLANIYOR: üretimin girdisi, çıktısı değil. Sayılsaydı
//   aynı kılavuz iki kez denetlenirdi (kilavuz-vurgu'daki aynı not).
const ATLA = new Set(['kaynak', 'testler', 'node_modules', '.git', 'denetim', 'docs']);
function htmlBul(dizin, derinlik){
  if(derinlik > 3) return [];
  let bulunan = [];
  for(const g of fs.readdirSync(dizin, { withFileTypes: true })){
    if(g.name.startsWith('.') || ATLA.has(g.name)) continue;
    const tam = path.join(dizin, g.name);
    if(g.isDirectory()) bulunan = bulunan.concat(htmlBul(tam, derinlik + 1));
    else if(g.name.endsWith('.html')) bulunan.push(tam);
  }
  return bulunan;
}

// Bir kılavuzun yapısı: bölüm kimlikleri ve her bölümdeki h3 sayısı.
function yapiCikar(metin){
  const bolumler = [];
  // <section class="bolum ..." id="...."> ... </section>
  // ⚠ SINIF TAM ESLESME DEGIL: SSS bolumu `class="bolum sss"` yaziyor
  //   ve ilk surumde kalip onu KACIRDI -- test "menude karsiligi
  //   olmayan baglanti: sss" diye dustu. Ayristiricinin hatasiydi,
  //   deponun degil; kalip artik sinif LISTESINE bakiyor.
  const re = /<section[^>]*class="[^"]*\bbolum\b[^"]*"[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g;
  let m;
  while((m = re.exec(metin)) !== null){
    const ic = m[2];
    bolumler.push({ id: m[1], h3: (ic.match(/<h3[\s>]/g) || []).length });
  }
  const menu = (metin.match(/<ol id="yanMenu">([\s\S]*?)<\/ol>/) || ['',''])[1];
  const baglar = (menu.match(/href="#([^"]+)"/g) || []).map(x=> x.slice(7, -1));
  return { bolumler, baglar };
}

(async ()=>{
  console.log('KILAVUZ YAPI PARİTESİ');
  const dosyalar = htmlBul(KOK, 0)
    .filter(f => fs.readFileSync(f, 'utf8').includes('id="yanMenu"'))
    .map(f => path.relative(KOK, f))
    .sort();

  dene('★ bekçi: en az iki kılavuz BULUNDU (boş tarama değil)', ()=>{
    assert.ok(dosyalar.length >= 2,
      'id="yanMenu" taşıyan ' + dosyalar.length + ' dosya bulundu: '
      + (dosyalar.join(', ') || '(hiç)'));
  });
  console.log('  Kılavuzlar: ' + dosyalar.join(', '));

  const yapilar = {};
  for(const d of dosyalar){
    yapilar[d] = yapiCikar(fs.readFileSync(path.join(KOK, d), 'utf8'));
  }

  dene('★ bekçi: her kılavuzda bölüm BULUNDU (boş ayrıştırma değil)', ()=>{
    for(const d of dosyalar){
      assert.ok(yapilar[d].bolumler.length >= 10,
        d + ': ' + yapilar[d].bolumler.length + ' bölüm ayrıştırıldı, 10+ bekleniyordu');
    }
  });

  const ilk = dosyalar[0];
  for(const d of dosyalar.slice(1)){
    dene('⛔ ' + d + ': bölüm KİMLİKLERİ ' + ilk + ' ile aynı ve aynı sırada', ()=>{
      assert.deepStrictEqual(
        yapilar[d].bolumler.map(x=> x.id),
        yapilar[ilk].bolumler.map(x=> x.id),
        'Bir dile eklenip ötekine eklenmemiş bölüm var (Bölüm 7).');
    });
    dene('⛔ ' + d + ': her bölümdeki ALT BAŞLIK sayısı ' + ilk + ' ile aynı', ()=>{
      const a = yapilar[d].bolumler, b = yapilar[ilk].bolumler;
      const fark = [];
      for(let i = 0; i < Math.min(a.length, b.length); i++){
        if(a[i].h3 !== b[i].h3)
          fark.push(b[i].id + ': ' + ilk + '=' + b[i].h3 + ', ' + d + '=' + a[i].h3);
      }
      assert.deepStrictEqual(fark, [],
        'Alt başlık bir dile eklenip ötekine eklenmemiş (Bölüm 7): ' + fark.join(' | '));
    });
  }

  for(const d of dosyalar){
    dene('★ ' + d + ': yan menü bağlantıları bölümlerle tutuyor', ()=>{
      const kimlikler = new Set(yapilar[d].bolumler.map(x=> x.id));
      const olu = yapilar[d].baglar.filter(x=> !kimlikler.has(x));
      assert.deepStrictEqual(olu, [], 'menüde karşılığı olmayan bağlantı: ' + olu.join(', '));
      assert.ok(yapilar[d].baglar.length >= 10,
        d + ': ' + yapilar[d].baglar.length + ' menü bağlantısı bulundu');
    });
  }

  console.log('  ---- ' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
