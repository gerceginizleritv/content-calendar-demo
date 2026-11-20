// YÖNETİM PANELİ — ASILI KALMA VE SESSİZ BAŞARISIZLIK
//
// NEDEN BU TEST VAR
//   Kullanıcı 20 Kasım 2026'da ekran görüntüsüyle gösterdi: Planlar
//   sekmesi açık, üstte "Yükleniyor…" asılı, iki tablo da BOŞ.
//   Yenileyince giriş sayfasına atıyordu; kaydettiği değişiklik de
//   denetim kaydına DÜŞMEMİŞTİ.
//
//   Kök sebep: `cagir()` fonksiyonunun hiçbir zaman aşımı yoktu.
//   Ne `sb.auth.getSession()` ne de `fetch` bir süreye bağlıydı.
//   Biri cevapsız kalınca `await` sonsuza kadar bekliyor, `yukle`nin
//   catch'i HİÇ çalışmıyor ve ekranda "Yükleniyor…" kalıyordu.
//   ⚠ Bu kusur matristen ÖNCE de vardı — her sekme aynı fonksiyonu
//     kullanıyor. Matris sekmesinde fark edildi, orada doğmadı.
//
// ⛔ İKİNCİ KUSUR: BAŞARISIZ KAYITTAN SONRA TABLO YENİLENİYORDU.
//   Kaydetme başarısız olsa bile tablo sunucudan baştan çiziliyor ve
//   kullanıcının değişiklikleri EKRANDAN SİLİNİYORDU. Kullanıcının
//   "kaydettim, yenileyince yoktu" demesinin yarısı tam buydu:
//   ekranda kaydedilmiş gibi duran bir tablo, arkada yazılmamış bir
//   sunucu.
//
// ⛔ ÜÇÜNCÜ KUSUR: 403 HER ZAMAN "Bu hesap yönetici değil" DİYORDU.
//   Oysa sunucu oturumu düşmüş kullanıcıya da 403 dönüyor. O cümle
//   yanıltıcıydı ve asıl sebebi gizliyordu.
//
// ⚠ BU TEST BİLEREK YAVAŞ. Zaman aşımı 15 saniye ve gerçek süre
//   ölçülüyor. Süreyi teste özel kısaltmak, ölçülen şeyi ölçmez
//   hâle getirirdi.

const assert = require('node:assert');
const { chromium } = require('./araclar');
const SUNUCU = process.env.URET_SUNUCU || 'http://127.0.0.1:8098';

let gecen = 0, kalan = 0;
function dene(ad, fn){
  try { fn(); gecen++; console.log('  ok  ' + ad); }
  catch(e){ kalan++; console.log('  XX  ' + ad + '\n      ' + e.message); }
}

const VERI = {
  planlar: [
    { key:'starter',     visible:true, badge:null, sort:10 },
    { key:'creator_pro', visible:true, badge:null, sort:20 }
  ],
  ozellikler: [
    { plan_key:'starter',     feature_key:'drive_script', enabled:true },
    { plan_key:'creator_pro', feature_key:'drive_script', enabled:true }
  ],
  limitler: [
    { plan_key:'starter',     limit_key:'projects', limit_value:2 },
    { plan_key:'creator_pro', limit_key:'projects', limit_value:null }
  ]
};

// Tek bir senaryo kuruyor. `sunucu` her istege ne yapacagini soyluyor.
async function sahne({ oturum = true, getSessionAsili = false, sunucu }){
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport:{ width:1400, height:900 } });
  const jsHata = [];
  p.on('pageerror', e=> jsHata.push(String(e.message)));
  p.on('dialog', async d=> await d.accept());

  const oturumKodu = getSessionAsili
    ? 'getSession:()=>new Promise(()=>{}),'
    : ('getSession:()=>Promise.resolve({data:{session:'
       + (oturum ? '{access_token:"T",user:{email:"a@b.c"}}' : 'null') + '}}),');
  await p.route('**/supabase-js**', r=> r.fulfill({ status:200,
    contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{' + oturumKodu
       + 'onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}'
       + '}};}};' }));

  const cagrilar = [];
  await p.route('**/functions/v1/yonetim', async r=>{
    const g = JSON.parse(r.request().postData() || '{}');
    cagrilar.push(g);
    await sunucu(r, g);
  });

  await p.goto(SUNUCU + '/yonetim.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(700);
  return { b, p, cagrilar, jsHata };
}

const durumu = (p)=> p.evaluate(()=> (document.getElementById('durum')||{}).textContent || '');

(async ()=>{
  // ── 1. SUNUCU HİÇ CEVAP VERMEZSE ────────────────────────────────
  {
    const { b, p, jsHata } = await sahne({ sunucu: async ()=>{ /* hic cevap verme */ } });
    const basla = Date.now();
    await p.evaluate(()=> { yukle('planlar', true); });
    // 15sn zaman asimi + pay
    await p.waitForFunction(
      ()=> !/Yükleniyor/.test(document.getElementById('durum').textContent || ''),
      null, { timeout: 25000 }).catch(()=>{});
    const gecenSure = Date.now() - basla;
    const d = await durumu(p);

    dene('★ cevap gelmezse "Yükleniyor…" ASILI KALMIYOR', ()=>{
      assert.ok(!/Yükleniyor/.test(d), 'durum hala: ' + d);
    });
    dene('★ sebebini söylüyor: sunucu cevap vermedi', ()=>{
      assert.ok(/cevap vermedi/i.test(d), 'durum: ' + d);
    });
    dene('zaman aşımı 15 saniye civarında (sonsuz değil)', ()=>{
      assert.ok(gecenSure >= 14000 && gecenSure <= 24000, 'süre: ' + gecenSure + 'ms');
    });
    dene('sayfa hatası yok (1)', ()=> assert.strictEqual(jsHata.length, 0, jsHata.join(' | ')));
    await b.close();
  }

  // ── 2. getSession ASILI KALIRSA ─────────────────────────────────
  {
    const { b, p } = await sahne({ getSessionAsili:true, sunucu: async (r)=>
      r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(VERI) }) });
    await p.evaluate(()=> { yukle('planlar', true); });
    await p.waitForFunction(
      ()=> !/Yükleniyor/.test(document.getElementById('durum').textContent || ''),
      null, { timeout: 25000 }).catch(()=>{});
    const d = await durumu(p);
    dene('★ oturum okuması asılı kalırsa da kurtuluyor', ()=>{
      assert.ok(!/Yükleniyor/.test(d), 'durum hala: ' + d);
      assert.ok(/cevap vermedi/i.test(d), 'durum: ' + d);
    });
    await b.close();
  }

  // ── 3. OTURUM YOKSA: DOĞRU CÜMLE ────────────────────────────────
  {
    const { b, p } = await sahne({ oturum:false, sunucu: async (r)=>
      r.fulfill({ status:200, contentType:'application/json', body:'{}' }) });
    await p.evaluate(()=> yukle('planlar', true)).catch(()=>{});
    await p.waitForTimeout(600);
    const d = await durumu(p);
    dene('★ oturum düşmüşse "oturumun düşmüş" diyor', ()=>{
      assert.ok(/[Oo]turumun düşmüş/.test(d), 'durum: ' + d);
    });
    await b.close();
  }

  // ── 4. SUNUCU ESKİ SÜRÜMSE: ADIYLA SÖYLÜYOR ─────────────────────
  // ⛔ Bu, 20 Kasım'daki arizanin TESHIS edilebilmesi icin kondu:
  //    Edge Function dagitilmadiysa panel bunu EKRANDA soylemeli,
  //    yoksa sebep gorunmez kaliyor.
  {
    const { b, p } = await sahne({ sunucu: async (r)=>
      r.fulfill({ status:400, contentType:'application/json',
                  body: JSON.stringify({ hata:'bilinmeyen_islem' }) }) });
    await p.evaluate(()=> yukle('planlar', true)).catch(()=>{});
    await p.waitForTimeout(800);
    const d = await durumu(p);
    dene('★ sunucu işlemi tanımıyorsa "ESKİ sürüm" diyor', ()=>{
      assert.ok(/ESKİ sürüm/.test(d), 'durum: ' + d);
      assert.ok(/dağıtıl/i.test(d), 'durum: ' + d);
    });
  await b.close();
  }

  // ── 5. 403: YANILTICI CÜMLE YOK ─────────────────────────────────
  {
    const { b, p } = await sahne({ sunucu: async (r)=>
      r.fulfill({ status:403, contentType:'application/json',
                  body: JSON.stringify({ hata:'yetkisiz' }) }) });
    await p.evaluate(()=> yukle('planlar', true)).catch(()=>{});
    await p.waitForTimeout(800);
    const d = await durumu(p);
    dene('★ 403 artık yalnızca "yönetici değil" demiyor', ()=>{
      assert.ok(/[Oo]turumun düşmüş olabilir/.test(d), 'durum: ' + d);
    });
    await b.close();
  }

  // ── 6. KAYDETME BAŞARISIZSA TABLO SİLİNMİYOR ────────────────────
  // ⛔ Kullanicinin "kaydettim ama yoktu" dediginin yarisi buydu.
  {
    const { b, p, cagrilar } = await sahne({ sunucu: async (r, g)=>{
      if(g.islem === 'matris'){
        return r.fulfill({ status:200, contentType:'application/json',
                           body: JSON.stringify(VERI) });
      }
      return r.fulfill({ status:403, contentType:'application/json',
                         body: JSON.stringify({ hata:'yetkisiz' }) });
    }});
    await p.evaluate(()=> yukle('planlar', true));
    await p.waitForFunction(()=> document.querySelectorAll('#ozellikTablo tbody tr').length > 0,
                            null, { timeout: 10000 });
    cagrilar.length = 0;
    await p.evaluate(()=>{
      document.querySelector('[data-oz="starter|drive_script"]').checked = false;
      document.getElementById('matrisKaydet').click();
    });
    await p.waitForTimeout(1500);

    const son = await p.evaluate(()=>({
      tik: document.querySelector('[data-oz="starter|drive_script"]').checked,
      satir: document.querySelectorAll('#ozellikTablo tbody tr').length,
      durum: (document.getElementById('durum')||{}).textContent || ''
    }));

    dene('★ kaydetme başarısızsa kullanıcının değişikliği EKRANDA duruyor', ()=>{
      assert.strictEqual(son.tik, false,
        'tik sunucudan gelen degerle EZILMIS: ' + JSON.stringify(son));
    });
    dene('★ başarısız kayıttan sonra tablo yeniden ÇEKİLMİYOR', ()=>{
      const tekrar = cagrilar.filter(c=> c.islem === 'matris');
      assert.strictEqual(tekrar.length, 0, JSON.stringify(cagrilar));
    });
    dene('★ kırmızı yazı sebebi söylüyor, "hata" demiyor', ()=>{
      assert.ok(/KAYDEDİLEMEDİ/.test(son.durum), son.durum);
      assert.ok(/[Oo]turumun düşmüş olabilir/.test(son.durum), son.durum);
    });
    dene('★ değişikliklerin durduğu kullanıcıya söyleniyor', ()=>{
      assert.ok(/tekrar deneyebilirsin/.test(son.durum), son.durum);
    });
    await b.close();
  }

  console.log('\n' + gecen + ' gecti, ' + kalan + ' kaldi');
  process.exit(kalan ? 1 : 0);
})();
