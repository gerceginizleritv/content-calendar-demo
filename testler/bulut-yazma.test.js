// BULUTA YAZMA HATASI — SEBEBİ EKRANDA YAZIYOR MU, OTURUM TAZELENİYOR MU
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR — 6 Ekim 2026
// ══════════════════════════════════════════════════════════════════
// Kullanici takvimde bir kayit kaydetti ve su bildirimi aldi:
//
//   "Buluta ulaşılamadı — sebebi yukarıdaki kırmızı şeritte."
//
// Kirmizi serit ORTADA YOKTU. Cunku seridi `bulutHatasiUygula` ciziyor
// ve onu yalnizca OKUMA yolu (afterSignIn) cagiriyor; yazma yolunun
// catch bloğu sadece setCloudStatus('error') diyordu. Acilis basarili
// oldugu icin serit hic gorunmemisti ve bildirim OLMAYAN bir seyi
// isaret ediyordu. Sebebi (42501 permission denied for function
// story_yayin_turleri -- bkz. sql/57) bulmak icin tarayici konsolunu
// acmak gerekti.
//
// Ikinci kusur ayni yerdeydi: okuma yolu suresi dolmus belirteci BIR KEZ
// kendiliginden tazeliyordu, yazma yolu tazelemiyordu. Oturum zaman
// asimina ugradiginda her kaydetme hata veriyor, geriye cikip girmek
// kaliyordu -- ve cikip girmek buluttaki surumu esas aldigi icin
// (afterSignIn'de `events = uzak`) gonderilememis degisikligi
// KAYBETTIRIYORDU.
//
// ══════════════════════════════════════════════════════════════════
// NE ÖLÇÜLÜYOR
// ══════════════════════════════════════════════════════════════════
//   1. Yazma patlayinca bildirim SEBEBI soyluyor mu (ve sunucunun kendi
//      cumlesini de tasiyor mu).
//   2. "Kirmizi serit" cumlesi artik CIKMIYOR mu.
//   3. ⛔ Yazma hatasi kullaniciyi KILITLEMIYOR mu: serit cikmamali,
//      ekleme dugmesi acik kalmali, bulutOkumaBasarisiz false kalmali.
//      bulutHatasiUygula(true) cagrilsaydi save() erken donerdi ve
//      kullanici artik HICBIR SEYI kaydedemezdi -- kaybi onlemek yerine
//      buyuturdu. Bu dosyadaki en onemli olcum bu.
//   4. Veri kaybolmuyor mu: yerel kopya yazilmis olmali.
//   5. Oturum hatasinda tazeleme BIR KEZ deneniyor, basariliysa yazma
//      kendiliginden tamamlaniyor; basarisizsa tekrarlamiyor.
const { chromium } = require('./araclar');

// Sahte Supabase. Okuma hep 'dolu' (bir kayit gelir, serit cikmaz);
// asil degisken YAZMA modu.
// __yazmaModu: 'ok' | 'oturum' | 'sunucu'
// __yazmaSonrasi: tazeleme basarili olduktan SONRA gecilecek yazma modu.
const sahte = (yazmaModu, yazmaSonrasi, tazeCalisiyor)=>`
window.__pushlar = []; window.__tazeSayisi = 0;
window.__yazmaModu = ${JSON.stringify(yazmaModu)};
window.__yazmaSonrasi = ${JSON.stringify(yazmaSonrasi)};
window.__tazeCalisiyor = ${JSON.stringify(!!tazeCalisiyor)};
window.supabase = { createClient(){ return {
  auth: {
    getSession: ()=> Promise.resolve({ data:{ session:{ user:{ id:'kul-1', email:'a@b.c' } } } }),
    onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; },
    signOut(){ return Promise.resolve({}); },
    refreshSession(){
      window.__tazeSayisi++;
      if(!window.__tazeCalisiyor) return Promise.resolve({ data:null, error:{ message:'refresh failed' } });
      window.__yazmaModu = window.__yazmaSonrasi;
      return Promise.resolve({ data:{ session:{ user:{ id:'kul-1', email:'a@b.c' } } }, error:null });
    }
  },
  from(tablo){
    const z = {
      select(){ return z; }, is(){ return z; }, eq(){ return z; },
      in(){ return Promise.resolve({ data:[], error:null }); },
      upsert(satirlar){
        const m = window.__yazmaModu;
        if(tablo === 'calendar_events'){
          if(m === 'oturum') return Promise.resolve({ data:null, error:{ message:'JWT expired', code:'PGRST301' } });
          if(m === 'sunucu') return Promise.resolve({ data:null,
            error:{ message:'permission denied for function story_yayin_turleri', code:'42501' } });
        }
        window.__pushlar.push({tablo, satirlar});
        return Promise.resolve({ data:null, error:null });
      },
      delete(){ return z; },
      maybeSingle(){ return Promise.resolve({ data:null, error:null }); },
      single(){ return Promise.resolve({ data:null, error:null }); },
      then(coz, red){
        if(tablo === 'calendar_events'){
          return Promise.resolve({ data:[{ id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            type:'video', platform:'youtube', title:'GERÇEK KAYIT', post_date:'2026-09-10',
            post_time:'20:00:00', uploaded:false, workspace_id:null, project_id:null, content:{} }],
            error:null }).then(coz, red);
        }
        return Promise.resolve({ data:[], error:null }).then(coz, red);
      }
    };
    return z;
  }
};}};`;

(async () => {
  const b = await chromium.launch({ });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };

  const ac = async (yazmaModu, yazmaSonrasi, tazeCalisiyor)=>{
    const page = await b.newPage({ serviceWorkers:'block', viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
    await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
    await page.route('**/gelen/kayitlar.json', r=>r.fulfill({status:404,body:''}));
    await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
      body: sahte(yazmaModu, yazmaSonrasi, tazeCalisiyor)}));
    await page.route('**/goatcounter**', r=>r.abort());
    await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1800);
    await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
    await page.waitForTimeout(250);
    return page;
  };

  // Bir kaydi degistirip save() cagiriyor. pushTimer 400 ms, bekleme ondan uzun.
  const kaydet = async (page)=>{
    await page.evaluate(()=>{
      // Acilistaki hareket bulasmasin: afterSignIn projeleri, sablonlari
      // ve tercihleri de yaziyor, onlar da upsert.
      window.__tazeSayisi = 0; window.__pushlar = [];
      events[0].title = 'DEĞİŞTİ ' + Date.now();
      dirtyIds.add(events[0].id);
      save();
    });
    await page.waitForTimeout(1100);
  };

  const oku = page => page.evaluate(()=>({
    bildirim: (document.getElementById('toast')||{}).textContent || '',
    bildirimGorunur: !!document.querySelector('#toast.show'),
    seritGorunur: getComputedStyle(document.getElementById('cloudError')).display !== 'none',
    eklemeKapali: !!document.getElementById('addBtn').disabled,
    okumaBasarisiz: window.bulutOkumaBasarisiz === true,
    taze: window.__tazeSayisi,
    // ⚠ YALNIZCA calendar_events. __pushlar her tabloyu topluyor;
    // projeler/sablonlar/tercihler de upsert ediyor ve sayimi kaydiriyor.
    pushSayisi: window.__pushlar.filter(p=> p.tablo === 'calendar_events').length,
    yerelBaslik: (()=>{ try{
      const y = JSON.parse(localStorage.getItem(storageKey())||'[]');
      return (y[0]&&y[0].title)||''; }catch(e){ return 'OKUNAMADI'; } })(),
    kuyrukta: dirtyIds.size
  }));

  // ── 1. SUNUCU GERİ ÇEVİRDİ (42501) ──────────────────────────────
  console.log('YAZMA REDDEDİLDİ (izin hatası) — sebebi söylüyor mu');
  let page = await ac('sunucu');
  await kaydet(page);
  let r = await oku(page);
  k('★ bildirim "kırmızı şerit" DEMİYOR', !/kırmızı şerit/i.test(r.bildirim), r.bildirim.slice(0,70));
  k('★ sebep yazıyor', /Sunucu isteği geri çevirdi/.test(r.bildirim), r.bildirim.slice(0,90));
  k('★ sunucunun kendi cümlesi de yazıyor',
     /permission denied for function story_yayin_turleri/.test(r.bildirim), r.bildirim.slice(-60));
  k('değişikliğin kaybolmadığı söyleniyor', /Bu cihazda duruyor/.test(r.bildirim));
  k('bildirim ekranda', r.bildirimGorunur);
  // ⛔ En onemli olcum: kullanici kilitlenmiyor.
  k('★ kırmızı şerit ÇIKMIYOR (yazma hatası okuma hatası değil)', r.seritGorunur === false);
  k('★ ekleme düğmesi AÇIK kalıyor', r.eklemeKapali === false);
  k('★ bulutOkumaBasarisiz false — save() çalışmaya devam ediyor', r.okumaBasarisiz === false);
  // Veri ve kuyruk
  k('yerel kopya yazılmış (veri kaybolmadı)', /DEĞİŞTİ/.test(r.yerelBaslik), r.yerelBaslik);
  k('kayıt kuyrukta kaldı, sonra tekrar denenecek', r.kuyrukta === 1, r.kuyrukta);
  k('hiçbir takvim satırı geçmedi', r.pushSayisi === 0, r.pushSayisi);
  k('izin hatasında oturum tazelenmiyor', r.taze === 0, r.taze);
  await page.close();

  // ── 2. OTURUM DOLMUŞ, TAZELEME ÇALIŞIYOR ────────────────────────
  console.log('\nOTURUM SÜRESİ DOLMUŞ — yazma yolunda kendiliğinden tazeleniyor');
  page = await ac('oturum', 'ok', true);
  await kaydet(page);
  r = await oku(page);
  k('★ tazeleme denendi', r.taze === 1, r.taze);
  k('★ tazelendikten sonra yazma TAMAMLANDI', r.pushSayisi === 1, r.pushSayisi);
  k('★ kuyruk boşaldı', r.kuyrukta === 0, r.kuyrukta);
  k('hata bildirimi çıkmadı', !/buluta gitmedi/.test(r.bildirim), r.bildirim.slice(0,60));
  await page.close();

  // ── 3. OTURUM DOLMUŞ, TAZELEME DE OLMUYOR ───────────────────────
  console.log('\nOTURUM DOLMUŞ — tazeleme de başarısız');
  page = await ac('oturum', 'ok', false);
  await kaydet(page);
  r = await oku(page);
  k('★ tazeleme BİR KEZ denendi, döngüye girmedi', r.taze === 1, r.taze);
  k('sebep OTURUM olarak yazıyor', /süresi dolmuştu/.test(r.bildirim), r.bildirim.slice(0,90));
  k('★ yine de kilitlenmiyor (şerit yok, düğme açık)',
     r.seritGorunur === false && r.eklemeKapali === false);
  k('kayıt kuyrukta duruyor', r.kuyrukta === 1, r.kuyrukta);
  await page.close();

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
