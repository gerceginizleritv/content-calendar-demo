// FİYAT SAYFASI: PLAN ÖZELLİK LİSTELERİ HER DİLDE AYNI
//
// NEDEN BU TEST VAR
//   CLAUDE.md Bölüm 7: *"Yeni bir arayüz dizesi mi eklendi? Her
//   dilin sözlüğüne eklenir."* App.html'in sözlüğünü
//   `sozluk-paritesi` koruyor; **fiyat sayfasının kendi sözlüğünü
//   hiçbir şey korumuyordu.** 21 Kasım 2026'da 54. maddenin satırı
//   eklenirken fark edildi: satır Türkçe eklenip İngilizce
//   unutulsa kimse görmeyecekti.
//
// ⛔ BU DEPONUN TEKRARLAYAN HATASI TAM BU: bir yerde yapıp
//    ötekinde unutmak (otomatik yayın tablosu, palet değerleri,
//    ikon ailesi, hesap silme listesi...). Çözüm her seferinde
//    aynı: LİSTEYİ ELLE YAZMAYAN, KENDİ BULAN bekçi.
//
// ⚠ DİL VE PLAN LİSTESİ SABİT YAZILMIYOR: ikisi de sayfanın kendi
//   `M` sözlüğünden okunuyor. Yeni bir dil ya da yeni bir plan
//   kendiliğinden giriyor.
//
// ⛔ METNİ ÖLÇMÜYOR, SAYIYI ÖLÇÜYOR. Bir dildeki madde metninin
//    ötekiyle aynı olması beklenemez (çeviri). Ölçülen şey: aynı
//    planın madde SAYISI her dilde eşit mi, ve hiçbir madde boş mu.

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
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(SUNUCU + '/kaynak/fiyatlar.html', { waitUntil:'domcontentloaded' });
  await p.waitForFunction(()=> typeof M === 'object' && M, { timeout: 20000 });
  console.log('FİYAT SAYFASI ÖZELLİK PARİTESİ');

  const veri = await p.evaluate(()=>{
    const diller = Object.keys(M);
    const planlar = {};
    diller.forEach(d=>{
      Object.keys((M[d] && M[d].ozellik) || {}).forEach(k=> { planlar[k] = true; });
    });
    const sonuc = { diller, planlar: Object.keys(planlar), sayilar: {}, bos: [], tanim: {} };
    sonuc.planlar.forEach(k=>{
      sonuc.sayilar[k] = {};
      diller.forEach(d=>{
        const l = (M[d].ozellik || {})[k];
        sonuc.sayilar[k][d] = Array.isArray(l) ? l.length : null;
        (Array.isArray(l) ? l : []).forEach((x, i)=>{
          if(typeof x !== 'string' || !x.trim()) sonuc.bos.push(d + '/' + k + '[' + i + ']');
        });
      });
    });
    // Plan tanimlari (kart altindaki tek satir) da her dilde olmali.
    sonuc.planlar.forEach(k=>{
      sonuc.tanim[k] = {};
      diller.forEach(d=>{ sonuc.tanim[k][d] = !!((M[d].tanim || {})[k] || '').trim(); });
    });
    return sonuc;
  });

  dene('★ sayfada en az iki dil var (parite ölçülebilir)', ()=>{
    assert.ok(veri.diller.length >= 2, JSON.stringify(veri.diller));
  });
  dene('★ sayfada plan listesi bulundu', ()=>{
    assert.ok(veri.planlar.length >= 2, JSON.stringify(veri.planlar));
  });

  for(const k of veri.planlar){
    dene('⛔ ' + k + ': madde sayısı HER DİLDE eşit', ()=>{
      const say = veri.sayilar[k];
      const degerler = veri.diller.map(d=> say[d]);
      for(const d of veri.diller){
        assert.notStrictEqual(say[d], null,
          d + ' dilinde ' + k + ' listesi YOK: ' + JSON.stringify(say));
      }
      assert.strictEqual(new Set(degerler).size, 1,
        k + ' sayıları: ' + JSON.stringify(say));
    });
    dene('★ ' + k + ': plan tanımı her dilde dolu', ()=>{
      for(const d of veri.diller){
        assert.strictEqual(veri.tanim[k][d], true,
          d + ' dilinde ' + k + ' tanımı boş: ' + JSON.stringify(veri.tanim[k]));
      }
    });
  }

  dene('⛔ hiçbir özellik maddesi BOŞ değil', ()=>{
    assert.deepStrictEqual(veri.bos, [], veri.bos.join(', '));
  });

  // ── EKRANDA DA AYNI SAYI ─────────────────────────────────────────
  // ⛔ SOZLUKTE DOGRU OLUP EKRANDA CIZILMEMESI DE BIR HATA: cizim
  //    `m.ozellik[p.key] || []` okuyor, yani eksik bir anahtar
  //    SESSIZCE bos bir liste veriyor.
  // ⚠ Olculen sey SAYI: her plan kartindaki <li> sayisi, o dilin
  //   sozlugundeki madde sayisiyla ayni mi. Gorunur plan sayisi
  //   sozlukteki plan sayisindan az olabilir (kart `visible=false`
  //   olabiliyor), bu yuzden kartlar kendi sayisiyla eslesiyor.
  for(const dil of veri.diller){
    const yeniSekme = await b.newPage({ viewport:{ width:1280, height:1400 } });
    yeniSekme.on('pageerror', e=> jsHata.push(dil + ': ' + String(e.message)));
    await yeniSekme.route('**/goatcounter**', r=> r.abort());
    await yeniSekme.goto(SUNUCU + '/kaynak/fiyatlar.html?lang=' + dil,
      { waitUntil:'domcontentloaded' });
    // ⚠ BEKLEME COKERTMIYOR. Cizim hic madde yazmazsa burasi zaman
    //   asimina ugrar ve test COKER; cokme sonraki iddialari
    //   durdurur, yani kucuk bir gerileme her seyi gizler. Yokluk
    //   asagida IDDIA olarak olculuyor.
    await yeniSekme.waitForFunction(
      ()=> document.querySelectorAll('.kart').length > 0, { timeout: 25000 }).catch(()=>{});
    await yeniSekme.waitForTimeout(400);
    const olcum = await yeniSekme.evaluate((d)=>{
      const kartlar = [...document.querySelectorAll('.kart')]
        .map(k=> k.querySelectorAll('ul li').length);
      // Sozlukteki sayilar, buyukten kucuge: kart sirasina bagli
      // kalmamak icin ikisi de siralanip karsilastiriliyor.
      const sozluk = Object.keys(M[d].ozellik || {})
        .map(k=> (M[d].ozellik[k] || []).length);
      return { kartlar: kartlar.slice().sort((a,b)=> b-a),
               sozluk: sozluk.slice().sort((a,b)=> b-a),
               bosKart: kartlar.filter(n=> n === 0).length };
    }, dil);
    dene('⛔ ' + dil + ': her plan kartinin madde sayisi SOZLUKLE ayni', ()=>{
      // Gorunmeyen planlar sozlukte olup kartta olmayabilir: kartlarin
      // sayisi sozlugun bir ON EKI olmali (buyukten kucuge siralanmis).
      const k = olcum.kartlar, z = olcum.sozluk;
      assert.ok(k.length >= 2, dil + ' kart sayisi: ' + k.length);
      for(const n of k){
        const yer = z.indexOf(n);
        assert.notStrictEqual(yer, -1,
          dil + ': ' + n + ' maddeli bir kart var ama sozlukte yok — '
          + JSON.stringify(olcum));
        z.splice(yer, 1);
      }
    });
    dene('⛔ ' + dil + ': hicbir plan karti BOS liste cizmiyor', ()=>{
      assert.strictEqual(olcum.bosKart, 0, JSON.stringify(olcum));
    });
    await yeniSekme.close();
  }

  dene('★ sayfa hatası yok', ()=>{
    assert.strictEqual(jsHata.length, 0, jsHata.join(' | '));
  });

  await p.close(); await b.close();
  console.log('  ---- ' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
