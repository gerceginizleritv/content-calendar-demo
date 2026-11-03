// BAŞARISIZ KAYDIN GERİ DÖNÜŞ YOLU
//
// 27 Ekim 2026: bir Threads anketi `#100/4279063 Invalid parameter` ile
// reddedildi. Kayıt `failed` oldu, kullanıcıya e-posta gitti, kullanıcı
// içeriği düzeltti — ve orada TIKANDI. Geri dönüş yolu YOKTU:
//   · kuyruk yalnızca `publish_state = 'pending'` alıyor
//   · uygulama publish_state'e bilerek hiç dokunmuyor
//   · story_ertele yalnızca `in_progress` kayıtlara çalışıyor
// Kullanıcı Supabase panelinden ELLE `update` çalıştırmak zorunda kaldı.
//
// ⛔ EN ÖNEMLİ ÖLÇÜM: İZ TEMİZLENMİYOR.
// publish_ref / publish_called_at çöküş kurtarmasının okuduğu tek şey.
// Temizlenseydi, yayın çağrısı gerçekten gitmiş bir kayıt İKİNCİ KEZ
// yayınlanabilirdi — 26 Ekim'deki çift Facebook reel'i o kapıdan çıktı.
const { chromium } = require('./araclar');
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
const SQL = fs.readFileSync(yol.join(KOK, 'sql', '68-yayin-tekrar-dene.sql'), 'utf8');
const sqlYorumsuz = SQL.replace(/--[^\n]*/g, '');

let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); }
                            else { k++; console.log('  YOK '+ad+(ek!==undefined?' -> '+JSON.stringify(ek):'')); } };

(async () => {
  console.log('[sql/68 — işlevin kendisi]');
  bak('★ fonksiyon tanımlı', /create or replace function public\.story_tekrar_dene\(p_id text\)/.test(sqlYorumsuz));
  bak('★ YALNIZCA kendi kaydı (auth.uid şartı)', /and user_id = auth\.uid\(\)/.test(sqlYorumsuz));
  bak('★ YALNIZCA failed olan', /and publish_state = 'failed'/.test(sqlYorumsuz));
  bak('★ silinmiş kayda dokunmuyor', /and deleted_at is null/.test(sqlYorumsuz));
  bak('★ pending yapıyor', /set publish_state = 'pending'/.test(sqlYorumsuz));
  bak('★ deneme hakkı geri veriliyor', /attempt_count = 0/.test(sqlYorumsuz));
  bak('★ eski hata metni siliniyor', /last_error\s*=\s*null/.test(sqlYorumsuz));
  bak('★ bekleme kaldırılıyor', /retry_after\s*=\s*null/.test(sqlYorumsuz));
  // ⛔ ÇİFT YAYIN KAPISI: iz alanlarına DOKUNULMAMALI.
  bak('★★ publish_ref TEMİZLENMİYOR', !/publish_ref\s*=/.test(sqlYorumsuz), 'publish_ref yazılmamalı');
  bak('★★ publish_called_at TEMİZLENMİYOR', !/publish_called_at\s*=/.test(sqlYorumsuz));
  bak('★★ publish_ref_at TEMİZLENMİYOR', !/publish_ref_at\s*=/.test(sqlYorumsuz));
  bak('★ tarayıcıya açılıyor (düğmeye kullanıcı basıyor)',
      /grant execute on function public\.story_tekrar_dene\(text\) to authenticated/.test(sqlYorumsuz));
  bak('★ anon KAPALI', /revoke all on function public\.story_tekrar_dene\(text\) from public, anon/.test(sqlYorumsuz));
  // Öteki geçişler tarayıcıya açılmamalı: onlar sistemin kararı.
  bak('★ başka story_* geçişi tarayıcıya açılmıyor',
      !/grant execute on function public\.story_(yayinlandi|basarisiz|ertele|kuyruk_al)[^\n]*authenticated/.test(sqlYorumsuz));

  // ── ARAYÜZ ──────────────────────────────────────────────────────
  const b = await chromium.launch({ });
  const p = await b.newPage({ viewport:{ width:1280, height:900 } });
  p.sayfaHatalari = [];
  p.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); p.sayfaHatalari.push(String(e)); k++; });
  await p.addInitScript(()=>{ try{
    localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_tour_done','1');
  }catch(e){} });
  await p.route('**/supabase-js**', r=>r.fulfill({ status:200, contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};' }));
  await p.route('**/goatcounter**', r=>r.abort());
  await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });

  // Basarisiz bir kaydi ekrana kur ve paneli cizdir.
  const kur = (cevap)=> p.evaluate((c)=>{
    window.__rpc = [];
    window.__uyarilar = [];
    // ⚠ CIPLAK ATAMA, window.X DEGIL. app.html'de sb, session,
    // storyYayinAcik ve currentEvent `let` ile tanimli; `let` degiskeni
    // window'un ustunde DEGIL. Test ilk yazilista `window.sb = ...`
    // diyordu ve hicbiri yerine gecmiyordu: panel "otomatik yayin
    // hesabinizda acik degil" dalindan donuyor, dugme hic cizilmiyordu.
    // Hata kodda degil, testin kurulumundaydi.
    uyari = (m)=>{ window.__uyarilar.push(m); return Promise.resolve(true); };
    session = { user:{ id:'u1' } };
    storyYayinAcik = true;
    sb = { rpc: (ad, arg)=>{ window.__rpc.push({ ad, arg });
      return Promise.resolve(c.hata ? { data:null, error:c.hata } : { data:c.veri, error:null }); } };
    currentEvent = { id:'ev1', type:'reels', platform:'instagram',
      yayin:{ otomatik:true, durum:'failed', hata:'Anket seçeneği çok uzun', deneme:3 } };
    document.getElementById('f_type').value = 'reels';
    document.getElementById('f_platform').value = 'instagram';
    otoYayinTazele();
    return !!document.getElementById('oyTekrarBtn');
  }, cevap);

  const oku = ()=> p.evaluate(()=>({
    rpc: window.__rpc, uyarilar: window.__uyarilar,
    durum: currentEvent.yayin.durum, hata: currentEvent.yayin.hata,
    deneme: currentEvent.yayin.deneme,
    dugmeVar: !!document.getElementById('oyTekrarBtn')
  }));

  console.log('\n[arayüz — başarısız kayıtta düğme çıkıyor]');
  bak('★ DÜĞME GÖRÜNÜYOR', (await kur({ veri:true })) === true);
  bak('düğme metni okunur',
      (await p.evaluate(()=> (document.getElementById('oyTekrarBtn') || {}).textContent || '')).length > 3);
  // ⚠ DUGME DOGRU YERDE OLMALI. Sayfa ici click() CSS'i yok sayiyor,
  // yani dugme yanlislikla panelin disinda cizilse de olcum gecerdi.
  // Bu olcum onu tutuyor: yayin durumu panelinin icinde mi?
  bak('★ düğme yayın durumu panelinin içinde',
      await p.evaluate(()=> !!document.querySelector('#otoYayinDurum #oyTekrarBtn')));

  console.log('[başarılı tekrar]');
  {
    await kur({ veri:true });
    await p.evaluate(()=>{ const d = document.getElementById('oyTekrarBtn'); if(d) d.click(); });
    await p.waitForTimeout(400);
    const r = await oku();
    bak('★ doğru RPC çağrıldı', r.rpc.length === 1 && r.rpc[0].ad === 'story_tekrar_dene', r.rpc);
    bak('★ kaydın kimliği gönderildi', (r.rpc[0] || {}).arg && r.rpc[0].arg.p_id === 'ev1', (r.rpc[0]||{}).arg);
    bak('★ ekranda durum pending oldu', r.durum === 'pending', r.durum);
    bak('★ eski hata metni kalktı', !r.hata, r.hata);
    bak('deneme sayacı sıfırlandı', r.deneme === 0, r.deneme);
    bak('★ düğme kayboldu (artık failed değil)', r.dugmeVar === false);
    bak('kullanıcıya haber verildi', r.uyarilar.length === 1 && /[Kk]uyru/.test(r.uyarilar[0]), r.uyarilar);
  }

  console.log('[sql/68 kurulmamışsa — sebebi söylüyor]');
  {
    await kur({ hata:{ code:'42883', message:'function public.story_tekrar_dene(text) does not exist' } });
    await p.evaluate(()=>{ const d = document.getElementById('oyTekrarBtn'); if(d) d.click(); });
    await p.waitForTimeout(400);
    const r = await oku();
    bak('★ "sql/68 çalıştır" diyor',
        r.uyarilar.length === 1 && /sql\/68/.test(r.uyarilar[0]), r.uyarilar);
    bak('★ durum DEĞİŞMEDİ (hâlâ failed)', r.durum === 'failed', r.durum);
    bak('düğme duruyor, tekrar denenebilir', r.dugmeVar === true);
  }

  console.log('[kayıt artık failed değilse]');
  {
    await kur({ veri:false });
    await p.evaluate(()=>{ const d = document.getElementById('oyTekrarBtn'); if(d) d.click(); });
    await p.waitForTimeout(400);
    const r = await oku();
    bak('★ "bu arada değişmiş" deniyor',
        r.uyarilar.length === 1 && /değişmiş|tekrar denenmiş|yayınlanmış/.test(r.uyarilar[0]), r.uyarilar);
    bak('★ yerel durum UYDURULMUYOR', r.durum === 'failed', r.durum);
  }

  console.log('[ağ hatasında]');
  {
    await kur({ hata:{ message:'network' } });
    await p.evaluate(()=>{ const d = document.getElementById('oyTekrarBtn'); if(d) d.click(); });
    await p.waitForTimeout(400);
    const r = await oku();
    bak('★ genel hata mesajı veriliyor', r.uyarilar.length === 1, r.uyarilar);
    bak('★ sql/68 mesajı VERİLMİYOR (sebep o değil)', !/sql\/68/.test(r.uyarilar[0] || ''), r.uyarilar);
    bak('durum değişmedi', r.durum === 'failed', r.durum);
  }

  console.log('[gerileme — başarısız olmayan kayıtta düğme YOK]');
  {
    for(const d of ['pending','in_progress','published']){
      const varMi = await p.evaluate((durum)=>{
        currentEvent.yayin = { otomatik:true, durum, hata:null, deneme:1 };
        otoYayinTazele();
        return !!document.getElementById('oyTekrarBtn');
      }, d);
      bak('★ "' + d + '" durumunda düğme yok', varMi === false);
    }
  }

  bak('sayfa hatası yok', p.sayfaHatalari.length === 0, p.sayfaHatalari);
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  await b.close(); process.exit(k ? 1 : 0);
})();
