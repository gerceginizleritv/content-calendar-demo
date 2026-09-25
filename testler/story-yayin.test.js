// OTOMATIK STORY YAYINI — worker.
//
// Sartname Bolum 11'deki test sirasi. Tarayici acmiyor: Edge Function
// Node icinde yukleniyor (Deno ve fetch sahte, gerisi GERCEK kod).
//
// SAHTE OLAN NE
//   · Graph API   -- komut dosyasi: her ucun ne dondurecegi testte
//   · PostgREST   -- bellekte birkac satir
//   · Resend      -- giden e-postalar bir diziye dusuyor
//   · SAAT        -- Date.now() testin kontrolunde. Gercek saatle
//                    "10 dakikadir asili" gibi bir sey olculemez.
//
// SQL fonksiyonlari burada JS olarak yeniden yaziliyor (sql/41 ve
// sql/42'deki semantikle). Bu bir zayiflik ve boyle biliniyor: SQL'in
// KENDISI burada olculmuyor, worker'in o fonksiyonlari DOGRU SIRAYLA
// ve dogru argumanlarla cagirdigi olculuyor. SQL tarafinin kontrolu
// sql/42'nin sonundaki sorgularda.
//
// ══════════════════════════════════════════════════════════════════
// EN ONEMLI OLCUM: 10. MADDE
// ══════════════════════════════════════════════════════════════════
// "Worker'i yayin cagrisinin ortasinda oldur -> cift yayin var mi"
//
// Sartname: "10. madde atlanirsa sistem er gec ayni story'yi iki kez
// atar." Asagida uc ayri coküs bicimi var ve UCUNUN DE olcusu ayni:
// media_publish cagri sayisi. Cift yayin geri alinamaz.
const yol = require('path');
const KOK_DIZIN = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const IG = 'ig_17841400000000000';
const SAYFA = '880482471822163';
const UID = 'user-aaaa';
const GIZLI = 'cron-gizli-anahtari';
const TOKEN = 'EAAG' + 'x'.repeat(40);

// ---- saat ------------------------------------------------------------------
// Worker'in butun zaman kararlari (tavan, butce, asili esigi) Date.now()
// uzerinden. Gercek saatle olculemezler.
let SAAT = Date.parse('2026-12-05T12:00:00Z');
const gercekNow = Date.now;
Date.now = ()=> SAAT;
const ilerlet = (ms)=> { SAAT += ms; };
const su = ()=> new Date(SAAT).toISOString();

// ---- sahte veritabani ------------------------------------------------------
let satirlar, durumlar, epostalar;
// sql/49: user_prefs.prefs.story_yayin bayragi olan hesaplar. Kuyruk
// YALNIZCA bunlarin kayitlarini aliyor -- worker tek bir Meta hesabina
// yayinladigi icin baskasinin kaydini almak, onun icerigini hesap
// sahibinin Instagram'ina cikarmak olurdu.
let yayinBayrakli;
function bosKayit(ek){
  return Object.assign({
    id:'st_1', user_id:UID, type:'story', platform:'instagram', title:'Balıklı story',
    uploaded:false, deleted_at:null, post_date:'2026-12-05', post_time:'15:00:00',
    auto_publish:true, publish_state:'pending', publish_at:'2026-12-05T12:00:00Z',
    published_at:null, external_id:null, last_error:null, attempt_count:0,
    retry_after:null, publish_ref:null, publish_ref_at:null, publish_called_at:null,
    media_url:'https://medya.test/2026-12-05_story.mp4', media_mime:'video/mp4',
    media_bytes:12345678, media_name:'2026-12-05_story.mp4',
    idem_key:'11111111-1111-1111-1111-111111111111',
    content:{ timezone:'Europe/Istanbul' }, updated_at: su()
  }, ek || {});
}
function tabloyuKur(ek, ekler){
  satirlar = [ bosKayit(ek) ];
  (ekler || []).forEach((x, i)=> satirlar.push(bosKayit(Object.assign({ id:'st_' + (i+2) }, x))));
  durumlar = {};
  epostalar = [];
  yayinBayrakli = [UID];
}

// ---- SQL fonksiyonlarinin JS karsiligi --------------------------------------
const bul = (id)=> satirlar.find(r=> r.id === id);
const dk = (n)=> n * 60 * 1000;

// sql/48'deki kalibin JS karsiligi: <kok>_k<N>.<uzanti>
const SERI_KALIP = /_k(\d+)\.[A-Za-z0-9]+$/;
const seriKok  = (ad)=> SERI_KALIP.test(String(ad || '')) ? String(ad).replace(SERI_KALIP, '') : null;
const seriSira = (ad)=> { const m = SERI_KALIP.exec(String(ad || '')); return m ? Number(m[1]) : null; };

const SQL = {
  story_seri_onceki({ p_id }){
    const k = bul(p_id); if(!k) return [];
    const kok = seriKok(k.media_name), sira = seriSira(k.media_name);
    if(kok === null || sira === null) return [];          // seri degil
    const onde = satirlar.filter(e=>
      e.type === 'story' && !e.deleted_at && e.id !== p_id
      && e.user_id === k.user_id && e.platform === k.platform
      && e.auto_publish === true
      && seriKok(e.media_name) === kok
      && seriSira(e.media_name) !== null && seriSira(e.media_name) < sira
      && e.publish_state !== 'published'
    ).sort((a,b)=> seriSira(a.media_name) - seriSira(b.media_name));
    if(!onde.length) return [];
    const e = onde[0];
    return [{ durum: e.publish_state === 'failed' ? 'basarisiz' : 'bekliyor',
              parca: e.media_name }];
  },
  story_asili_topla({ p_dakika }){
    let n = 0;
    for(const r of satirlar){
      if(r.type === 'story' && r.publish_state === 'in_progress' && !r.deleted_at
         && Date.parse(r.updated_at) < SAAT - dk(Math.max(p_dakika, 1))){
        r.publish_state = 'pending'; r.updated_at = su(); n++;
      }
    }
    return n;
  },
  story_kuyruk_al({ p_limit }){
    const aday = satirlar.filter(r=>
      r.type === 'story' && r.auto_publish === true && r.publish_state === 'pending'
      && !r.deleted_at && r.publish_at && Date.parse(r.publish_at) <= SAAT
      && (!r.retry_after || Date.parse(r.retry_after) <= SAAT)
      && r.attempt_count < 3
      // sql/49: sahip kontrolu
      && yayinBayrakli.includes(r.user_id)
    // sql/46: publish_at esitse dosya adi (parca sirasi), sonra id.
    ).sort((a,b)=>
      (Date.parse(a.publish_at) - Date.parse(b.publish_at))
      || String(a.media_name || '').localeCompare(String(b.media_name || ''))
      || String(a.id).localeCompare(String(b.id))
    ).slice(0, p_limit);
    return aday.map(r=>{
      r.publish_state = 'in_progress'; r.attempt_count += 1; r.updated_at = su();
      return { id:r.id, user_id:r.user_id, media_url:r.media_url, media_bytes:r.media_bytes,
        media_mime:r.media_mime, publish_at:r.publish_at, attempt_count:r.attempt_count,
        idem_key:r.idem_key, external_id:r.external_id, title:r.title, content:r.content,
        publish_ref:r.publish_ref, publish_ref_at:r.publish_ref_at,
        publish_called_at:r.publish_called_at, platform:r.platform };
    });
  },
  story_iz_konteyner({ p_id, p_ref }){
    const r = bul(p_id); if(!r || r.publish_state !== 'in_progress') return false;
    r.publish_ref = p_ref; r.publish_ref_at = su(); r.publish_called_at = null; r.updated_at = su();
    return true;
  },
  story_iz_yayin_cagrisi({ p_id }){
    const r = bul(p_id); if(!r || r.publish_state !== 'in_progress') return false;
    r.publish_called_at = su(); r.updated_at = su(); return true;
  },
  story_yayinlandi({ p_id, p_external_id }){
    const r = bul(p_id); if(!r || r.publish_state !== 'in_progress') return false;
    r.publish_state = 'published'; r.published_at = su();
    r.external_id = r.external_id || p_external_id;
    r.last_error = null; r.retry_after = null;
    r.publish_ref = null; r.publish_ref_at = null; r.publish_called_at = null;
    r.updated_at = su(); return true;
  },
  story_basarisiz({ p_id, p_hata, p_kalici }){
    const r = bul(p_id); if(!r || r.publish_state !== 'in_progress') return false;
    const son = !!p_kalici || r.attempt_count >= 3;
    r.publish_state = son ? 'failed' : 'pending';
    r.last_error = String(p_hata || '').slice(0, 2000);
    r.retry_after = p_kalici ? null
      : new Date(SAAT + (r.attempt_count === 1 ? dk(1) : r.attempt_count === 2 ? dk(5) : dk(15))).toISOString();
    if(son){ r.publish_ref = null; r.publish_ref_at = null; r.publish_called_at = null; }
    r.updated_at = su(); return true;
  },
  story_ertele({ p_id, p_dakika, p_sebep }){
    const r = bul(p_id); if(!r || r.publish_state !== 'in_progress') return false;
    r.publish_state = 'pending';
    r.attempt_count = Math.max(r.attempt_count - 1, 0);
    // sql/47: 0 (ya da negatif) = "bekleme yok, siradaki turda al".
    // Eskiden greatest(p_dakika,1) vardi ve bu, "bir dakika ertele"
    // demenin pratikte IKI dakikaya mal olmasi demekti: retry_after
    // dakika ortasina duser, bir sonraki turu iskalardi.
    r.retry_after = (Number(p_dakika) || 0) <= 0
      ? null
      : new Date(SAAT + dk(p_dakika)).toISOString();
    r.last_error = String(p_sebep || '').slice(0, 2000);
    r.updated_at = su(); return true;
  }
};

// ---- Graph komut dosyasi ----------------------------------------------------
// Her test bunu kendi senaryosuna gore kuruyor.
let META, cagrilar;
function metaKur(ek){
  cagrilar = { media:0, publish:0, durum:0, kota:0, stories:0, debug:0,
               fbBaslat:0, fbYukle:0, fbBitir:0, fbFoto:0, fbFotoStory:0,
               // Sayilar "kac kere" diyor, sira "hangi sirayla" diyor.
               // Konteynerlerin yayinlardan ONCE yaratildigi ancak
               // siradan okunabiliyor.
               sira: [] };
  META = Object.assign({
    token: { data:{ is_valid:true, expires_at:0 } },
    kota:  { data:[{ config:{ quota_total:25, quota_duration:86400 }, quota_usage:3 }] },
    // Yoklama sirasi: her cagrida bir sonraki. Bitince sonuncusu tekrar.
    durumSirasi: ['FINISHED'],
    storyler: [],           // /stories'in dondurecegi yayindaki story'ler
    mediaHatasi: null,      // konteyner yaratmada hata
    fbBaslatHatasi: null,
    fbYuklemeHatasi: false,
    medyaHatasi: 0,         // R2'den medya cekilirken donen HTTP kodu
    yayinDavranisi: 'ok'    // 'ok' | 'kaybolan-yanit' | {kod, altKod, mesaj}
  }, ek || {});
}
const grafHata = (kod, mesaj, altKod)=> ({
  __http: 400,
  error: { message:mesaj, type:'OAuthException', code:kod, error_subcode: altKod || undefined }
});

function grafCevap(adres, yontem, gonderi){
  const u = new URL(adres);
  const p = u.pathname.replace('/v21.0', '');

  if(p === '/debug_token'){ cagrilar.debug++; return META.token; }
  if(p === `/${IG}/content_publishing_limit`){ cagrilar.kota++; return META.kota; }
  if(p === `/${IG}/stories` || p === `/${SAYFA}/stories`){
    cagrilar.stories++;
    if(META.storiesHatasi) return META.storiesHatasi;
    return { data: META.storyler };
  }
  // ---- Facebook sayfa story'si (Bolum 6) ----
  if(p === `/${SAYFA}/video_stories` && yontem === 'POST'){
    const asama = /upload_phase=start/.test(gonderi || '') ? 'start' : 'finish';
    if(asama === 'start'){
      cagrilar.fbBaslat++;
      if(META.fbBaslatHatasi) return META.fbBaslatHatasi;
      return { video_id:'fbv_' + cagrilar.fbBaslat,
               upload_url:'https://rupload.test/video-upload/fbv_' + cagrilar.fbBaslat };
    }
    // BITIR = YAYINLAYAN cagri.
    cagrilar.fbBitir++;
    const d = META.yayinDavranisi;
    if(d === 'kaybolan-yanit'){
      META.storyler = META.storyler.concat([{ id:'fb_cokme', creation_time: su() }]);
      throw new Error('baglanti koptu');
    }
    if(d && typeof d === 'object') return grafHata(d.kod, d.mesaj, d.altKod);
    META.storyler = META.storyler.concat([{ id:'fbpost_' + cagrilar.fbBitir, creation_time: su() }]);
    return { success:true, post_id:'fbpost_' + cagrilar.fbBitir };
  }
  if(p === `/${SAYFA}/photos` && yontem === 'POST'){
    cagrilar.fbFoto++;
    return { id:'fbfoto_' + cagrilar.fbFoto };
  }
  if(p === `/${SAYFA}/photo_stories` && yontem === 'POST'){
    cagrilar.fbFotoStory++;
    META.storyler = META.storyler.concat([{ id:'fbfotopost', creation_time: su() }]);
    return { post_id:'fbfotopost' };
  }
  if(p === `/${IG}/media` && yontem === 'POST'){
    cagrilar.media++;
    cagrilar.sira.push('media');
    if(META.mediaHatasi) return META.mediaHatasi;
    return { id: 'cont_' + cagrilar.media };
  }
  if(p === `/${IG}/media_publish` && yontem === 'POST'){
    cagrilar.publish++;
    const kim = /creation_id=([^&]+)/.exec(gonderi || '');
    cagrilar.sira.push('publish:' + (kim ? decodeURIComponent(kim[1]) : '?'));
    const d = META.yayinDavranisi;
    if(d === 'kaybolan-yanit'){
      // ⚠ COKUS ANI. Cagri Meta'ya ULASTI, story CIKTI -- ama yanit
      // Shootboard'a donmedi. Sistemin en tehlikeli hali: kayit
      // "yayinlanmadi" gorunuyor, Instagram'da story duruyor.
      META.storyler = META.storyler.concat([{ id:'media_cokme', timestamp: su() }]);
      throw new Error('baglanti koptu');
    }
    if(d && typeof d === 'object') return grafHata(d.kod, d.mesaj, d.altKod);
    META.storyler = META.storyler.concat([{ id:'media_' + cagrilar.publish, timestamp: su() }]);
    return { id: 'media_' + cagrilar.publish };
  }
  // /{konteyner}?fields=status_code,status
  if(/^\/cont_\d+$/.test(p)){
    const i = Math.min(cagrilar.durum, META.durumSirasi.length - 1);
    cagrilar.durum++;
    const kod = META.durumSirasi[i];
    // Yoklama gercek zamanda beklemiyor; saati BURADA ilerletiyoruz ki
    // tavan/butce hesaplari olculebilsin.
    ilerlet(5000);
    return { status_code: kod, status: kod === 'ERROR' ? 'Medya formati desteklenmiyor' : kod };
  }
  return grafHata(100, 'bilinmeyen uc: ' + p);
}

// ---- sahte fetch ------------------------------------------------------------
const yanit = (govde, durum)=> Promise.resolve({
  ok: durum < 400, status: durum,
  text: ()=> Promise.resolve(typeof govde === 'string' ? govde : JSON.stringify(govde)),
  json: ()=> Promise.resolve(govde)
});

function sahteFetch(adres, secenek){
  const url = String(adres);
  const yontem = (secenek && secenek.method) || 'GET';

  // Medya dosyasi: worker onu R2'den cekip Facebook'a akitiyor.
  if(url.indexOf('https://medya.test') === 0){
    if(META.medyaHatasi) return yanit({}, META.medyaHatasi);
    return Promise.resolve({ ok:true, status:200,
      headers:new Map([['content-length','12345678']]),
      body:{ cancel(){ META.govdeIptal = (META.govdeIptal||0)+1; } },
      text:()=>Promise.resolve(''), json:()=>Promise.resolve({}) });
  }
  // Meta'nin ayri yukleme sunucusu (Graph degil).
  if(url.indexOf('https://rupload.test') === 0){
    cagrilar.fbYukle++;
    META.sonYukleme = { yetki: (secenek.headers||{})['Authorization'] || '',
                        boyut: (secenek.headers||{})['file_size'] || '',
                        ofset: (secenek.headers||{})['offset'] || '',
                        akiyor: !!(secenek.body && typeof secenek.body.cancel === 'function'),
                        duplex: secenek.duplex || '' };
    if(META.fbYuklemeHatasi) return yanit({ error:'yukleme reddedildi' }, 400);
    return yanit({ h:'upload_handle' }, 200);
  }

  if(url.indexOf('https://graf.test') === 0){
    let c;
    try { c = grafCevap(url, yontem, secenek && secenek.body); }
    catch(e){ return Promise.reject(e); }           // ag kopmasi
    const durum = c && c.__http ? c.__http : 200;
    return yanit(c, durum);
  }

  if(url.indexOf('/rest/v1/rpc/') > -1){
    const ad = url.split('/rest/v1/rpc/')[1];
    const args = JSON.parse(secenek.body || '{}');
    if(!SQL[ad]) return yanit({ message:'fonksiyon yok: ' + ad }, 404);
    return yanit(SQL[ad](args), 200);
  }
  if(url.indexOf('/rest/v1/sistem_durumu') > -1){
    if(yontem === 'POST'){
      for(const s of JSON.parse(secenek.body)) durumlar[s.anahtar] = s.veri;
      return yanit([], 201);
    }
    const es = /anahtar=eq\.([^&]+)/.exec(url);
    const ad = es ? decodeURIComponent(es[1]) : '';
    return yanit(durumlar[ad] ? [{ veri: durumlar[ad] }] : [], 200);
  }
  if(url.indexOf('/rest/v1/calendar_events') > -1){
    return yanit(satirlar.filter(r=> r.auto_publish).map(r=> ({ user_id:r.user_id })), 200);
  }
  if(url.indexOf('/auth/v1/admin/users/') > -1){
    return yanit({ email:'bostancioglum@example.test' }, 200);
  }
  if(url.indexOf('api.resend.com') > -1){
    epostalar.push(JSON.parse(secenek.body));
    return yanit({ id:'mail_1' }, 200);
  }
  return yanit({ message:'beklenmeyen adres: ' + url }, 500);
}

// ---- worker'i yukle ---------------------------------------------------------
const ORTAM = {
  SUPABASE_URL: 'https://sahte.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'servis-anahtari',
  STORY_WORKER_SECRET: GIZLI,
  META_PAGE_TOKEN: TOKEN,
  META_IG_USER_ID: IG,
  META_PAGE_ID: SAYFA,
  META_APP_ID: '1234567890',
  META_APP_SECRET: 'app-gizli-dizgesi-uzun',
  RESEND_API_KEY: 're_test',
  GRAF_TABANI: 'https://graf.test/v21.0',
  STORY_YOKLAMA_MS: '1',
  // Butce cagri aninda okunuyor; testler bunu degistirerek hem tavan
  // hem butce yolunu ayri ayri olcebiliyor.
  STORY_BUTCE_MS: '600000'
};
let ele;
async function workeriYukle(){
  globalThis.Deno = { env:{ get:(a)=> ORTAM[a] ?? '' }, serve:(h)=>{ ele = h; } };
  globalThis.fetch = sahteFetch;
  await import(yol.join(KOK_DIZIN, 'supabase', 'functions', 'story-yayin', 'index.ts'));
}
async function turAt(gizli){
  const r = await ele(new Request('https://sahte.supabase.co/functions/v1/story-yayin', {
    method:'POST', headers:{ 'x-webhook-secret': gizli === undefined ? GIZLI : gizli }
  }));
  const metin = await r.text();
  return { durum:r.status, govde: metin ? JSON.parse(metin) : null };
}

(async () => {
  await workeriYukle();
  bak('fonksiyon Deno.serve ile ayağa kalktı', typeof ele === 'function');

  // ----------------------------------------------------------- 0. kapı
  console.log('[kapı]');
  {
    const r = await ele(new Request('https://sahte.supabase.co/functions/v1/story-yayin'));
    const b = JSON.parse(await r.text());
    // Dağıtımın gerçekten yerine geçtiği başka türlü anlaşılmıyor: bir
    // kez eski sürüm "doğrulandı" sanılıp sorun günlerce yanlış yerde
    // arandı. Sürüm ve uçlar o yüzden GET'te.
    bak('GET sürümü söylüyor', typeof b.surum === 'string' && b.surum.length > 0, JSON.stringify(b));
    bak('GET uçları sayıyor', Array.isArray(b.uclar) && b.uclar.length === 2);
    bak('GET yapılandırmayı VAR/YOK olarak söylüyor, değerleri değil',
      b.yapilandirma.page_token === true && JSON.stringify(b).indexOf(TOKEN) === -1);
  }
  {
    tabloyuKur(); metaKur();
    const r = await turAt('yanlis-anahtar');
    bak('gizli anahtar uyuşmazsa 401', r.durum === 401, String(r.durum));
    bak('yanlış anahtarla kuyruğa DOKUNULMUYOR', satirlar[0].publish_state === 'pending');
  }

  // --------------------------------------------- 2. fotoğraf story'si
  console.log('[2 · fotoğraf story]');
  {
    tabloyuKur({ media_mime:'image/jpeg', media_url:'https://medya.test/a.jpg' });
    metaKur();
    const r = await turAt();
    bak('yayınlandı', satirlar[0].publish_state === 'published', satirlar[0].last_error || '');
    bak('externalId yazıldı', satirlar[0].external_id === 'media_1', String(satirlar[0].external_id));
    bak('fotoğrafta image_url gitti, video_url değil', cagrilar.media === 1 && cagrilar.publish === 1);
    bak('başarıda iz temizlendi',
      satirlar[0].publish_ref === null && satirlar[0].publish_called_at === null);
    bak('⛔ uploaded’a DOKUNULMADI', satirlar[0].uploaded === false);
  }

  // ------------------------------------------------- 3. video story'si
  console.log('[3 · video story]');
  {
    tabloyuKur(); metaKur({ durumSirasi:['IN_PROGRESS','IN_PROGRESS','FINISHED'] });
    await turAt();
    bak('hazır olana kadar yoklandı', cagrilar.durum === 3, String(cagrilar.durum));
    bak('hazır olmadan YAYINLANMADI — yoklama bitince yayın',
      satirlar[0].publish_state === 'published' && cagrilar.publish === 1);
  }

  // ------------------------------------------- 5. zamanlanmış kayıt
  console.log('[5 · zamanlama]');
  {
    tabloyuKur({ publish_at:'2026-12-05T12:05:00Z' });   // 5 dk sonrası
    metaKur();
    await turAt();
    bak('zamanı gelmemiş kayıt ALINMIYOR',
      satirlar[0].publish_state === 'pending' && cagrilar.media === 0);
    ilerlet(dk(6));
    await turAt();
    bak('zamanı gelince yayınlanıyor', satirlar[0].publish_state === 'published');
  }
  {
    tabloyuKur({ auto_publish:false }); metaKur();
    await turAt();
    bak('otomatik yayın kapalıysa DOKUNULMUYOR',
      satirlar[0].publish_state === 'pending' && cagrilar.media === 0);
  }

  // ------------------------------------------ 6. aynı kayıt iki kez
  console.log('[6 · tekrar]');
  {
    tabloyuKur(); metaKur();
    await turAt();
    const ilk = cagrilar.publish;
    await turAt();
    bak('yayınlanmış kayıt bir daha kuyruğa girmiyor', cagrilar.publish === ilk && ilk === 1);
  }
  {
    // Katman 2: externalId dolu ise hiçbir şey yapılmaz.
    tabloyuKur({ external_id:'media_onceki' }); metaKur();
    await turAt();
    bak('externalId doluysa YAYIN ÇAĞRISI YAPILMIYOR', cagrilar.publish === 0);
    bak('externalId doluysa kayıt yayınlanmış sayılıyor', satirlar[0].publish_state === 'published');
    bak('eski externalId korunuyor', satirlar[0].external_id === 'media_onceki');
  }

  // --------------------------------------------- 7. bozuk mediaUrl
  console.log('[7 · bozuk medya]');
  {
    tabloyuKur(); metaKur({ mediaHatasi: grafHata(100, 'The video file you uploaded could not be fetched') });
    await turAt();
    bak('#100 kalıcı: tek denemede failed', satirlar[0].publish_state === 'failed',
      satirlar[0].publish_state + ' / ' + satirlar[0].attempt_count);
    bak('bildirim gitti', epostalar.length === 1, JSON.stringify(epostalar));
    bak('bildirimde Meta’nın hata kodu var',
      epostalar.length > 0 && epostalar[0].text.indexOf('#100') > -1);
    bak('kalıcı hatada tekrar denenmiyor (retry_after yok)', satirlar[0].retry_after === null);
  }
  {
    tabloyuKur(); metaKur({ durumSirasi:['ERROR'] });
    await turAt();
    bak('konteyner ERROR → medya reddi, kalıcı', satirlar[0].publish_state === 'failed');
    bak('Meta’nın status metni lastError’a yazıldı',
      String(satirlar[0].last_error).indexOf('desteklenmiyor') > -1, satirlar[0].last_error);
    bak('★ medya reddi de BİLDİRİM üretiyor', epostalar.length === 1, String(epostalar.length));
  }
  {
    tabloyuKur({ media_url:null }); metaKur();
    await turAt();
    bak('medya bağlı değilse Meta’ya hiç gidilmiyor',
      cagrilar.media === 0 && satirlar[0].publish_state === 'failed');
    // ⛔ Bolum 9: sessiz basarisizlik yasak. Akisin ICINDE kalici olarak
    // basarisiz olan yollar bildirim uretmiyordu; en kesin
    // basarisizliklar, haber verilmeyen tek basarisizliklardi.
    bak('★ medyasız kayıt da BİLDİRİM üretiyor', epostalar.length === 1, String(epostalar.length));
  }
  {
    // Geçici hata: 3 deneme, 1dk → 5dk → 15dk.
    tabloyuKur(); metaKur({ yayinDavranisi:{ kod:2, mesaj:'An unexpected error has occurred' } });
    await turAt();
    bak('#2 geçici: pending’e dönüyor', satirlar[0].publish_state === 'pending');
    bak('1. denemeden sonra 1 dakika bekliyor',
      Date.parse(satirlar[0].retry_after) - SAAT === dk(1), satirlar[0].retry_after);
    bak('geçici hatada HENÜZ bildirim yok', epostalar.length === 0);
    ilerlet(dk(2)); await turAt();
    bak('2. denemeden sonra 5 dakika', Date.parse(satirlar[0].retry_after) - SAAT === dk(5));
    ilerlet(dk(6)); await turAt();
    bak('3 denemede failed', satirlar[0].publish_state === 'failed', String(satirlar[0].attempt_count));
    bak('failed olunca bildirim gidiyor', epostalar.length === 1);
  }

  // ══════════════════════════════════════════════════════════════
  // COK PARCALI STORY — SIRA
  // ══════════════════════════════════════════════════════════════
  // Birbirini takip eden kartlar ARKA ARKAYA cikmali: soru, hemen
  // ardindan cevap. Worker bir turda birden cok kaydi SIRAYLA
  // yayinliyor, yani ayni dakikadaki iki parca saniyeler arayla cikar
  // -- eksik olan tek sey SIRANIN KENDISIYDI.
  //
  // 'order by publish_at' iki parca ayni saatteyse BERABERE kaliyor ve
  // Postgres hangisini once verecegini garanti etmiyor: cevap karti
  // sorudan once cikabilirdi. Her seferinde degil, BAZEN -- boyle bir
  // hatayi uretimde fark etmek cok zor. sql/46 beraberligi dosya
  // adiyla boziyor, cunku _k1 / _k2 sirayi zaten tasiyor.
  console.log('[çok parçalı story · sıra]');
  {
    tabloyuKur(
      { id:'st_k2', media_name:'2026-12-05_story_sokollu_k2.mp4', title:'Cevap' },
      [{ id:'st_k1', media_name:'2026-12-05_story_sokollu_k1.mp4', title:'Soru' }]);
    metaKur();
    const r = await turAt();
    bak('ikisi de AYNI turda alındı', r.govde.alinan === 2, JSON.stringify(r.govde));
    bak('ikisi de yayınlandı',
      satirlar.every(x=> x.publish_state === 'published'),
      satirlar.map(x=> x.publish_state).join(','));
    // ★ SIRA: k1 once yayinlanmali. Meta'ya giden sira cagri
    // sirasiyla ayni oldugu icin external_id'ler bunu soyluyor.
    const k1 = satirlar.find(x=> x.id === 'st_k1');
    const k2 = satirlar.find(x=> x.id === 'st_k2');
    bak('★ k1 k2’den ÖNCE yayınlandı',
      k1.external_id === 'media_1' && k2.external_id === 'media_2',
      'k1:' + k1.external_id + ' k2:' + k2.external_id);
    // Ayni dakika: aralarinda dakikalar yok.
    bak('aynı saatte, arka arkaya', k1.publish_at === k2.publish_at, String(k1.publish_at));
  }

  // ══════════════════════════════════════════════════════════════
  // PLATFORM — YANLIS YERE YAYIN
  // ══════════════════════════════════════════════════════════════
  // Shootboard'da her sosyal medya AYRI kayit: ayni story hem IG'ye
  // hem FB'ye gidiyorsa takvimde iki kayit var. Kuyruk sorgusu
  // `type = 'story'` suzuyor, platform suzmuyor -- yani FB kaydi da
  // worker'a gelir. Kontrol olmasaydi o kayit INSTAGRAM'A yayinlanir,
  // kullanicinin Facebook'a koydugu story Instagram'da IKINCI KEZ
  // cikar ve hicbir yerde hata gorunmezdi.
  console.log('[platform · yanlış yere yayın]');
  {
    tabloyuKur({ platform:'facebook' }); metaKur();
    await turAt();
    bak('★ Facebook kaydı Instagram’a YAYINLANMADI',
      cagrilar.media === 0 && cagrilar.publish === 0,
      'media:' + cagrilar.media + ' publish:' + cagrilar.publish);
    bak('Facebook kendi akışına gitti', cagrilar.fbBitir === 1, String(cagrilar.fbBitir));
  }
  {
    // Desteklenmeyen platform: kayit bozuk degil, sira henuz gelmedi.
    tabloyuKur({ platform:'tiktok' }); metaKur();
    await turAt();
    bak('desteklenmeyen platform hiçbir yere yayınlanmıyor',
      cagrilar.media === 0 && cagrilar.publish === 0 && cagrilar.fbBaslat === 0);
    bak('hata değil, erteleme: kayıt pending kaldı', satirlar[0].publish_state === 'pending');
    bak('deneme hakkı harcanmadı', satirlar[0].attempt_count === 0, String(satirlar[0].attempt_count));
    // Sessizce dusmemeli: kullanici neden yayinlanmadigini gorebilmeli.
    bak('sebebi kayda yazıldı',
      /tiktok/i.test(String(satirlar[0].last_error)), satirlar[0].last_error);
    bak('bildirim üretmiyor (bu bir arıza değil)', epostalar.length === 0);
  }
  {
    tabloyuKur({ platform:'instagram' }); metaKur();
    await turAt();
    bak('Instagram kaydı normal yayınlanıyor', satirlar[0].publish_state === 'published');
  }

  // ══════════════════════════════════════════════════════════════
  // 4. FACEBOOK SAYFA STORY'Sİ — Bolum 6
  // ══════════════════════════════════════════════════════════════
  // Sartname: "TAMAMEN FARKLI BIR AKIS. Instagram koduyla
  // ortaklastirmaya calisma." Fark tek satirlik degil:
  //   Instagram dosyayi ADRESTEN CEKIYOR
  //   Facebook  dosyayi BIZE YUKLETIYOR
  console.log('[4 · Facebook sayfa story]');
  {
    tabloyuKur({ platform:'facebook' }); metaKur();
    await turAt();
    bak('üç aşama da çağrıldı (start → upload → finish)',
      cagrilar.fbBaslat === 1 && cagrilar.fbYukle === 1 && cagrilar.fbBitir === 1,
      `start:${cagrilar.fbBaslat} upload:${cagrilar.fbYukle} finish:${cagrilar.fbBitir}`);
    bak('yayınlandı', satirlar[0].publish_state === 'published', satirlar[0].last_error || '');
    bak('post_id externalId’ye yazıldı', satirlar[0].external_id === 'fbpost_1', String(satirlar[0].external_id));
    // Instagram akisi HIC calismamali: iki platform ortaklasmiyor.
    bak('★ Instagram akışı hiç çalışmadı', cagrilar.media === 0 && cagrilar.publish === 0,
      `media:${cagrilar.media} publish:${cagrilar.publish}`);
    // Sartname Bolum 7: content_publishing_limit IG hesabina ait,
    // sayfaya degil. Facebook'un ayri kotasi var.
    bak('Instagram kotası sorulmadı', cagrilar.kota === 0, String(cagrilar.kota));
    bak('⛔ uploaded’a dokunulmadı', satirlar[0].uploaded === false);
  }
  {
    // 100 MB'lik bir videoyu Edge Function'in bellegine koymak siniri
    // zorlar: govde AKITILMALI, kopyalanmamali.
    tabloyuKur({ platform:'facebook' }); metaKur();
    await turAt();
    bak('★ dosya belleğe alınmadan akıtıldı',
      META.sonYukleme && META.sonYukleme.akiyor === true && META.sonYukleme.duplex === 'half',
      JSON.stringify(META.sonYukleme));
    bak('file_size başlığı gönderildi', META.sonYukleme.boyut === '12345678', META.sonYukleme.boyut);
    bak('offset 0 ile başlıyor', META.sonYukleme.ofset === '0', META.sonYukleme.ofset);
    bak('yükleme OAuth başlığıyla gidiyor', /^OAuth /.test(META.sonYukleme.yetki));
    bak('token yükleme başlığında ama kayda sızmıyor',
      String(JSON.stringify(satirlar[0])).indexOf(TOKEN) === -1);
  }
  {
    tabloyuKur({ platform:'facebook', media_mime:'image/jpeg', media_url:'https://medya.test/a.jpg' });
    metaKur();
    await turAt();
    bak('fotoğrafta iki aşama: photos → photo_stories',
      cagrilar.fbFoto === 1 && cagrilar.fbFotoStory === 1 && cagrilar.fbBaslat === 0,
      `foto:${cagrilar.fbFoto} story:${cagrilar.fbFotoStory} video:${cagrilar.fbBaslat}`);
    bak('fotoğraf story’si yayınlandı', satirlar[0].publish_state === 'published');
  }
  {
    // ⛔ CIFT YAYIN — Facebook'ta da. Yayinlayan cagri "finish";
    // yanit kaybolursa bir sonraki tur Instagram'daki gibi ONCE
    // Facebook'a soruyor.
    tabloyuKur({ platform:'facebook' }); metaKur({ yayinDavranisi:'kaybolan-yanit' });
    await turAt();
    bak('yanıt kaybolunca pending’e döndü', satirlar[0].publish_state === 'pending');
    bak('çöküş izi duruyor', !!satirlar[0].publish_ref && !!satirlar[0].publish_called_at);
    const ilkBitir = cagrilar.fbBitir;
    META.yayinDavranisi = 'ok';
    ilerlet(dk(2));
    await turAt();
    bak('★ Facebook’a soruldu, İKİNCİ KEZ YAYINLANMADI',
      cagrilar.fbBitir === ilkBitir && cagrilar.stories === 1,
      `finish:${cagrilar.fbBitir} stories:${cagrilar.stories}`);
    bak('çıkan story kayda bağlandı',
      satirlar[0].publish_state === 'published' && satirlar[0].external_id === 'fb_cokme',
      String(satirlar[0].external_id));
  }
  {
    // Yukleme yayinlamiyor: aradaki cokus cift yayin uretemez, o yuzden
    // bastan baslamak guvenli ve yarim kalmis yuklemeyi kurtarmaya
    // calismaktan basit.
    tabloyuKur({ platform:'facebook', publish_state:'in_progress', attempt_count:1,
                 publish_ref:'fbv_eski', publish_ref_at: su(), publish_called_at: null,
                 updated_at: new Date(SAAT - dk(11)).toISOString() });
    metaKur();
    await turAt();
    bak('yarım kalmış yükleme baştan başlıyor',
      cagrilar.fbBaslat === 1 && satirlar[0].publish_state === 'published');
    bak('yeni video_id alındı', satirlar[0].external_id === 'fbpost_1');
  }
  {
    tabloyuKur({ platform:'facebook' }); metaKur({ medyaHatasi:404 });
    await turAt();
    bak('medya adresi ölüyse kalıcı hata', satirlar[0].publish_state === 'failed',
      satirlar[0].last_error);
    bak('Meta’ya hiç gidilmedi', cagrilar.fbBaslat === 0);
    bak('bildirim gitti', epostalar.length === 1);
    // Bildirimde platform SABIT yaziliydi ve ilk gercek Facebook
    // denemesinde "Platform: Instagram" dedi -- hatayi okuyan kisi
    // yanlis yerde arardi.
    bak('★ bildirim doğru platformu söylüyor',
      epostalar.length > 0 && /Platform *: *Facebook/.test(epostalar[0].text),
      (epostalar[0] || {}).text ? epostalar[0].text.split('\n').find(x=> /Platform/.test(x)) : '-');
  }
  {
    tabloyuKur({ platform:'facebook' }); metaKur();
    ORTAM.META_PAGE_ID = '';
    await turAt();
    ORTAM.META_PAGE_ID = SAYFA;
    bak('sayfa kimliği yoksa erteleniyor, hata değil',
      satirlar[0].publish_state === 'pending' && satirlar[0].attempt_count === 0,
      satirlar[0].last_error);
  }

  // ------------------------------------------------- 8. token ölü
  console.log('[8 · token]');
  {
    tabloyuKur(); metaKur({ token:{ data:{ is_valid:false, error:{ message:'Session has expired' } } } });
    const r = await turAt();
    bak('token geçersizse tur durakladı', r.govde.durakladi === 'token', JSON.stringify(r.govde));
    bak('KUYRUK HİÇ ALINMADI — kayıt pending kaldı', satirlar[0].publish_state === 'pending');
    bak('deneme hakkı harcanmadı', satirlar[0].attempt_count === 0);
    bak('kayıt failed YAPILMADI', satirlar[0].publish_state !== 'failed');
    bak('Meta’ya yayın çağrısı gitmedi', cagrilar.media === 0 && cagrilar.publish === 0);
    bak('kullanıcı uyarıldı', epostalar.length === 1, JSON.stringify(epostalar.map(e=> e.subject)));
    bak('uyarıda token’ın kendisi YOK',
      epostalar.length > 0 && JSON.stringify(epostalar[0]).indexOf(TOKEN) === -1);
    await turAt();
    bak('aynı uyarı gün içinde tekrar gitmiyor', epostalar.length === 1);
    bak('token kontrolü 6 saatte bir: ikinci turda tekrar sorulmadı', cagrilar.debug === 1);
  }
  {
    tabloyuKur();
    metaKur({ token:{ data:{ is_valid:true, expires_at: Math.floor((SAAT + dk(60*24*3)) / 1000) } } });
    await turAt();
    bak('süre 7 günden yakınsa uyarı gidiyor', epostalar.length === 1,
      JSON.stringify(epostalar.map(e=> e.subject)));
    bak('uyarıya rağmen yayın SÜRÜYOR', satirlar[0].publish_state === 'published');
  }

  // --------------------------------------------------- 9. kota
  console.log('[9 · kota]');
  {
    tabloyuKur();
    metaKur({ kota:{ data:[{ config:{ quota_total:25, quota_duration:86400 }, quota_usage:24 }] } });
    await turAt();
    bak('kota doluysa yayınlanmıyor', cagrilar.publish === 0);
    bak('kota doluysa pending kalıyor', satirlar[0].publish_state === 'pending');
    // Sartname Bolum 7: "attemptCount ARTIRILMAZ (bu bir hata degil,
    // bir bekleme)". Uc kez kota dolu olan kayit denemelerini tuketip
    // failed olmamali.
    bak('DENEME HAKKI HARCANMADI', satirlar[0].attempt_count === 0, String(satirlar[0].attempt_count));
    bak('bir saat sonraya ertelendi', Date.parse(satirlar[0].retry_after) - SAAT === dk(60));
    bak('kota ertelemesi bildirim ÜRETMİYOR', epostalar.length === 0);
  }
  {
    tabloyuKur(); metaKur({ yayinDavranisi:{ kod:4, mesaj:'Application request limit reached' } });
    await turAt();
    bak('#4 hız sınırı: erteleme, hata değil',
      satirlar[0].publish_state === 'pending' && satirlar[0].attempt_count === 0);
  }
  {
    // Kota ucu okunamadi diye 24 saatlik bir story kacirilmiyor.
    tabloyuKur(); metaKur({ kota: grafHata(2, 'temporary') });
    await turAt();
    bak('kota okunamazsa yayına devam ediliyor', satirlar[0].publish_state === 'published');
  }

  // ══════════════════════════════════════════════════════════════
  // 10. WORKER'I YAYIN ÇAĞRISININ ORTASINDA ÖLDÜR
  // ══════════════════════════════════════════════════════════════
  console.log('[10 · çöküş — çift yayın]');
  {
    // (a) Cagri Meta'ya ULASTI, story CIKTI, yanit KAYBOLDU.
    tabloyuKur(); metaKur({ yayinDavranisi:'kaybolan-yanit' });
    await turAt();
    bak('yanıt kaybolunca kayıt pending’e döndü', satirlar[0].publish_state === 'pending');
    bak('çöküş izi DURUYOR', !!satirlar[0].publish_ref && !!satirlar[0].publish_called_at);
    const ilkYayin = cagrilar.publish;

    META.yayinDavranisi = 'ok';
    ilerlet(dk(2));
    await turAt();
    bak('kurtarmada Instagram’a soruldu', cagrilar.stories === 1);
    bak('★ İKİNCİ KEZ YAYINLANMADI', cagrilar.publish === ilkYayin && ilkYayin === 1,
      'publish çağrısı: ' + cagrilar.publish);
    bak('çıkmış story kayda bağlandı', satirlar[0].publish_state === 'published'
      && satirlar[0].external_id === 'media_cokme', String(satirlar[0].external_id));
    bak('Instagram’da tek story var', META.storyler.length === 1);
  }
  {
    // (b) Worker gercekten OLDU: kayit 'in_progress' kaldi. Bu hal
    // sql/42'deki story_asili_topla olmadan HIC islenmez -- kuyruk
    // sorgusu yalnizca 'pending' ariyor.
    tabloyuKur({
      publish_state:'in_progress', attempt_count:1,
      publish_ref:'cont_1', publish_ref_at: su(), publish_called_at: su(),
      updated_at: new Date(SAAT - dk(11)).toISOString()
    });
    metaKur({ storyler:[{ id:'media_oldurulen', timestamp: su() }] });
    await turAt();
    bak('asılı kalan kayıt kuyruğa geri alındı', satirlar[0].publish_state === 'published',
      satirlar[0].publish_state);
    bak('★ öldürülen worker’ın story’si TEKRAR ATILMADI', cagrilar.publish === 0,
      'publish çağrısı: ' + cagrilar.publish);
    bak('çıkan story’nin kimliği kayda yazıldı', satirlar[0].external_id === 'media_oldurulen');
  }
  {
    // (c) Cagri yapildi ama Meta'ya HIC ULASMADI: /stories bos.
    // Burada tekrar yayinlamak DOGRU -- yoksa story hic cikmaz.
    tabloyuKur({
      publish_state:'in_progress', attempt_count:1,
      publish_ref:'cont_1', publish_ref_at: su(), publish_called_at: su(),
      updated_at: new Date(SAAT - dk(11)).toISOString()
    });
    metaKur({ storyler:[] });
    await turAt();
    bak('çıkmadığı anlaşılırsa yayın TEKRARLANIYOR', cagrilar.publish === 1);
    bak('aynı konteyner kullanıldı, yenisi yaratılmadı', cagrilar.media === 0);
    bak('sonunda yayınlandı', satirlar[0].publish_state === 'published');
  }
  {
    // (d) Instagram'a SORULAMIYOR. Bilmemek, ikinci kez atmaktan iyidir.
    tabloyuKur({
      publish_state:'in_progress', attempt_count:1,
      publish_ref:'cont_1', publish_ref_at: su(), publish_called_at: su(),
      updated_at: new Date(SAAT - dk(11)).toISOString()
    });
    metaKur({ storiesHatasi: grafHata(2, 'temporary') });
    await turAt();
    bak('★ sonuç bilinmiyorsa YAYINLANMIYOR', cagrilar.publish === 0);
    bak('beklemeye alındı', satirlar[0].publish_state === 'pending'
      && Date.parse(satirlar[0].retry_after) - SAAT === dk(5));
    bak('iz korundu — bir sonraki tur yine soracak', !!satirlar[0].publish_called_at);
  }
  {
    // (e) Konteyner yaratildi ama yayin cagrisi HIC yapilmadi.
    // Burada Instagram'a sormaya gerek yok: hicbir sey cikmis olamaz.
    tabloyuKur({
      publish_state:'in_progress', attempt_count:1,
      publish_ref:'cont_1', publish_ref_at: su(), publish_called_at: null,
      updated_at: new Date(SAAT - dk(11)).toISOString()
    });
    metaKur();
    await turAt();
    bak('yayın çağrısı yapılmamışsa Instagram’a SORULMUYOR', cagrilar.stories === 0);
    bak('aynı konteynerden devam edildi', cagrilar.media === 0 && cagrilar.publish === 1);
  }
  {
    // İz SIRASI: yayın çağrısından ÖNCE yazılmazsa üçüncü katman hiç
    // çalışmaz. Ölçü: publish çağrısı geldiğinde iz satırda olmalı.
    tabloyuKur(); metaKur();
    let izVarMiydi = null;
    const eskiYayin = META.yayinDavranisi;
    META.yayinDavranisi = 'ok';
    const asilFetch = globalThis.fetch;
    globalThis.fetch = (a, s)=>{
      if(String(a).indexOf('/media_publish') > -1 && izVarMiydi === null){
        izVarMiydi = !!bul('st_1').publish_called_at;
      }
      return asilFetch(a, s);
    };
    await turAt();
    globalThis.fetch = asilFetch; META.yayinDavranisi = eskiYayin;
    bak('★ iz, yayın çağrısından ÖNCE yazılıyor', izVarMiydi === true, String(izVarMiydi));
  }

  // ------------------------------------------- konteyner tavanı
  console.log('[tavan]');
  {
    // Bolum 5: "120 saniye sonra basarisiz say. Sonsuz dongu yazma."
    // Yoklamanin her cagrisi saati 5 sn ilerletiyor.
    tabloyuKur(); metaKur({ durumSirasi:['IN_PROGRESS'] });
    await turAt();
    bak('120 saniyede hazır olmayan konteyner bırakılıyor',
      satirlar[0].publish_state === 'pending' && cagrilar.publish === 0);
    bak('sonsuz döngü yok: yoklama sayısı sınırlı', cagrilar.durum <= 26, String(cagrilar.durum));
    bak('sebebi kayda yazıldı', String(satirlar[0].last_error).indexOf('120') > -1, satirlar[0].last_error);
    // İZ TEMİZLENMEZSE tekrar denemeler anlamsızlaşır: 2. deneme aynı
    // konteynerle başlar, yaşı zaten tavanı aşmıştır, anında düşer.
    // Üç deneme birkaç dakikada tükenir ve kullanıcı gerçek bir tekrar
    // denemesi hiç görmez.
    bak('★ tavan dolunca iz temizlendi — sonraki deneme yeni konteyner yapacak',
      satirlar[0].publish_ref === null, String(satirlar[0].publish_ref));
    const oncekiMedya = cagrilar.media;
    META.durumSirasi = ['FINISHED'];
    ilerlet(dk(2));
    await turAt();
    bak('2. deneme gerçekten yeni konteyner yarattı ve yayınladı',
      cagrilar.media === oncekiMedya + 1 && satirlar[0].publish_state === 'published');
  }
  {
    tabloyuKur(); metaKur({ durumSirasi:['EXPIRED'] });
    await turAt();
    bak('düşen konteyner baştan denenecek',
      satirlar[0].publish_state === 'pending' && satirlar[0].publish_ref === null);
  }
  {
    // TUR BUTCESI tavandan once dolarsa: bu bir hata DEGIL. Kayit
    // ertelenir, deneme hakki geri verilir, iz DURUR ve bir sonraki
    // tur ayni konteyneri kaldigi yerden yoklar -- tavan da kaldigi
    // yerden sayar.
    tabloyuKur(); metaKur({ durumSirasi:['IN_PROGRESS'] });
    ORTAM.STORY_BUTCE_MS = '30000';
    const r = await turAt();
    ORTAM.STORY_BUTCE_MS = '600000';
    bak('tur bütçesi dolunca ertelendi', r.govde.sonuc['butce-bitti'] === 1, JSON.stringify(r.govde));
    bak('bütçe bitişi HATA sayılmıyor: deneme hakkı geri verildi',
      satirlar[0].attempt_count === 0, String(satirlar[0].attempt_count));
    bak('iz DURUYOR — sonraki tur aynı konteynerden devam edecek',
      satirlar[0].publish_ref === 'cont_1', String(satirlar[0].publish_ref));
    const oncekiMedya = cagrilar.media;
    META.durumSirasi = ['FINISHED'];
    ilerlet(dk(1));
    await turAt();
    bak('sonraki turda yeni konteyner YARATILMADI', cagrilar.media === oncekiMedya);
    bak('aynı konteynerle yayınlandı', satirlar[0].publish_state === 'published');
  }

  // ═══════════════════════════════════════════════════════════════
  // ÇOK PARÇALI STORY — PARÇALAR ARKA ARKAYA ÇIKMALI
  // ═══════════════════════════════════════════════════════════════
  // 22 Eylul 2026, ilk gercek iki parcali video yayini:
  //   13:46:41  1/2 Instagram
  //   13:48:58  2/2 Instagram   -> 2 dk 17 sn
  // Parcalar birbirini takip ediyor; arada iki dakika olmasi icerigi
  // bozuyor. Sebep yayin sirasi DEGILDI (o dogruydu): her videonun
  // Instagram tarafindaki islenmesi SIRAYLA bekleniyordu, yani
  // beklemeler toplaniyordu.
  console.log('[parçalar arka arkaya]');
  {
    tabloyuKur({ media_name:'2026-12-05_story_k1.mp4', title:'Balıklı (1/2)' },
               [{ media_name:'2026-12-05_story_k2.mp4', title:'Balıklı (2/2)' }]);
    metaKur();
    const r = await turAt();
    const sira = cagrilar.sira.join(' > ');

    bak('iki parça da yayınlandı',
      satirlar[0].publish_state === 'published' && satirlar[1].publish_state === 'published',
      JSON.stringify(r.govde));
    bak('tur önden konteyner yarattığını söylüyor',
      r.govde.sonuc['konteyner-onden'] === 2, JSON.stringify(r.govde.sonuc));

    // ★ ASIL OLCUM. Iki konteyner de ILK yayindan once yaratilmis
    // olmali: 2. parcanin islenmesi, 1. parca yayinlanirken suruyor
    // olsun diye. Eski davranista sira soyleydi:
    //   media > publish:cont_1 > media > publish:cont_2
    // ve ortadaki "media" 2. videonun beklemesini BASLATIYORDU.
    const yayinlar = cagrilar.sira.map((x,i)=> x.indexOf('publish:') === 0 ? i : -1).filter(i=> i > -1);
    const medyalar = cagrilar.sira.map((x,i)=> x === 'media' ? i : -1).filter(i=> i > -1);
    bak('★ iki konteyner de İLK yayından ÖNCE yaratıldı',
      medyalar.length === 2 && yayinlar.length === 2 && medyalar[1] < yayinlar[0], sira);

    // Onden yaratmak SIRAYI bozmamali: 1/2 hala once cikiyor.
    bak('★ yayın sırası korundu — 1/2 önce, 2/2 sonra',
      cagrilar.sira.filter(x=> x.indexOf('publish:') === 0).join(',')
        === 'publish:cont_1,publish:cont_2', sira);
    bak('sıra kayda da yansıdı',
      Date.parse(satirlar[0].published_at) <= Date.parse(satirlar[1].published_at),
      satirlar[0].published_at + ' / ' + satirlar[1].published_at);
    bak('fazladan konteyner yaratılmadı', cagrilar.media === 2, String(cagrilar.media));
  }
  {
    // Tek kayitta ust uste binecek bir sey yok: bos yere istek atma.
    tabloyuKur(); metaKur();
    const r = await turAt();
    bak('tek kayıtta önden yaratma yapılmıyor',
      r.govde.sonuc['konteyner-onden'] === undefined && cagrilar.media === 1,
      JSON.stringify(r.govde.sonuc) + ' media=' + cagrilar.media);
  }
  {
    // Elinde konteyner olan kayit (onceki turdan kalma) ATLANMALI --
    // yoksa her turda yenisi yaratilir, eskisi bosa duser ve tavan
    // hesabi anlamsizlasir.
    // Uc kayit: birinin izi VAR (onceki turdan kalma konteyner),
    // ikisinin yok. Onden yaratma yalnizca izsiz ikisine dokunmali.
    tabloyuKur({ media_name:'k1.mp4', publish_ref:'cont_9', publish_ref_at: su() },
               [{ media_name:'k2.mp4' }, { media_name:'k3.mp4' }]);
    metaKur();
    await turAt();
    bak('★ izi olan kayda yeni konteyner yapılmadı',
      cagrilar.media === 2, String(cagrilar.media) + ' | ' + cagrilar.sira.join(' > '));
    bak('eski konteynerle yayınlandı',
      cagrilar.sira.filter(x=> x.indexOf('publish:') === 0)[0] === 'publish:cont_9',
      cagrilar.sira.join(' > '));
    bak('üçü de yayınlandı ve sıra bozulmadı',
      satirlar.every(r=> r.publish_state === 'published')
      && cagrilar.sira.filter(x=> x.indexOf('publish:') === 0).join(',')
         === 'publish:cont_9,publish:cont_1,publish:cont_2',
      cagrilar.sira.join(' > '));
  }
  {
    // Onden yaratma PATLARSA tur olmemeli: kayit kendi sirasi
    // geldiginde normal yoldan denenir ve hata ORADA siniflandirilir.
    tabloyuKur({ media_name:'k1.mp4' }, [{ media_name:'k2.mp4' }]);
    metaKur({ mediaHatasi: grafHata(100, 'Invalid parameter') });
    const r = await turAt();
    bak('önden yaratma patlasa da tur 200 dönüyor', r.durum === 200, String(r.durum));
    bak('kayıtlar sessizce kaybolmadı: hata kaydedildi',
      !!satirlar[0].last_error && !!satirlar[1].last_error,
      JSON.stringify([satirlar[0].last_error, satirlar[1].last_error]));
    bak('hiçbir şey yayınlanmadı', cagrilar.publish === 0, String(cagrilar.publish));
  }
  {
    // sql/47: butce bitisinde "0 dakika" = siradaki tur. retry_after
    // NULL kalmali; dolu kalirsa kayit bir sonraki turu iskalar ve
    // parcalar arasi bosluk geri gelir.
    tabloyuKur(); metaKur({ durumSirasi:['IN_PROGRESS'] });
    ORTAM.STORY_BUTCE_MS = '30000';
    await turAt();
    ORTAM.STORY_BUTCE_MS = '600000';
    bak('★ bütçe bitişinde retry_after NULL — sıradaki tur hemen alabilir',
      satirlar[0].retry_after === null, String(satirlar[0].retry_after));
    META.durumSirasi = ['FINISHED'];
    const r2 = await turAt();
    bak('gerçekten sıradaki turda alındı (saat ilerletilmeden)',
      satirlar[0].publish_state === 'published', JSON.stringify(r2.govde));
  }

  // ═══════════════════════════════════════════════════════════════
  // SERI — ONCEKI PARCA CIKMADAN SONRAKI CIKMAZ (sql/48)
  // ═══════════════════════════════════════════════════════════════
  // sql/46 sirayi cozdu, sql/47 arayi kapatti. Bu da ucuncu soru:
  // 1/2 hic cikmazsa 2/2 ne olacak? Eskiden cikiyordu -- izleyici
  // eksik olani degil, ANLAMSIZ olani goruyordu.
  console.log('[seri]');
  const K1 = '2026-12-05_story_yedikule_k1.mp4';
  const K2 = '2026-12-05_story_yedikule_k2.mp4';
  {
    // 1/2 KALICI patliyor (Instagram medyayi reddediyor) -> 2/2 CIKMAMALI.
    tabloyuKur({ media_name:K1, title:'Yedikule (1/2)' },
               [{ media_name:K2, title:'Yedikule (2/2)' }]);
    // ⚠ 'ERROR' SONRA 'FINISHED': 1/2'nin medyasi reddediliyor, 2/2'nin
    // medyasi SAGLAM. Ikisi de ERROR olsaydi "2/2 cikmadi" olcumu
    // yanlis sebeple gecerdi -- koruma kaldirilsa bile 2/2 kendi
    // medyasi yuzunden patlar, test yine yesil kalirdi.
    metaKur({ durumSirasi:['ERROR','FINISHED'] });
    const r = await turAt();
    bak('1/2 kalıcı hata aldı', satirlar[0].publish_state === 'failed', satirlar[0].last_error);
    bak('★ 2/2 TEK BAŞINA yayınlanmadı',
      cagrilar.publish === 0 && satirlar[1].publish_state === 'failed',
      JSON.stringify(r.govde.sonuc) + ' publish=' + cagrilar.publish);
    bak('sebep hangi parça olduğunu söylüyor',
      String(satirlar[1].last_error).indexOf('_k1') > -1, satirlar[1].last_error);
    bak('ikisi için de e-posta gitti', epostalar.length === 2, String(epostalar.length));
  }
  {
    // 1/2 henuz cikmamis (bir sonraki tura ertelenmis) -> 2/2 BEKLEMELI,
    // ama bu bir HATA degil: deneme hakki harcanmamali.
    tabloyuKur({ media_name:K1, retry_after: new Date(SAAT + dk(30)).toISOString() },
               [{ media_name:K2 }]);
    metaKur();
    const r = await turAt();
    bak('kuyruğa yalnızca 2/2 girdi', r.govde.alinan === 1, JSON.stringify(r.govde));
    bak('★ 1/2 çıkmadan 2/2 yayınlanmadı',
      cagrilar.publish === 0 && r.govde.sonuc['seri-bekliyor'] === 1, JSON.stringify(r.govde.sonuc));
    bak('bekleme HATA sayılmadı: deneme hakkı geri verildi',
      satirlar[1].publish_state === 'pending' && satirlar[1].attempt_count === 0,
      satirlar[1].publish_state + '/' + satirlar[1].attempt_count);
  }
  {
    // 1/2 cikmissa 2/2 normal yayinlanir -- koruma yolu KAPATMIYOR.
    tabloyuKur({ media_name:K1, publish_state:'published', published_at: su(), external_id:'media_onceki' },
               [{ media_name:K2 }]);
    metaKur();
    await turAt();
    bak('1/2 yayındaysa 2/2 çıkıyor',
      satirlar[1].publish_state === 'published' && cagrilar.publish === 1,
      satirlar[1].publish_state + ' publish=' + cagrilar.publish);
  }
  {
    // ★ PLATFORM SERIYE DAHIL. Instagram'daki 1/2 patlamis olabilir ama
    // Facebook'taki 1/2 cikmissa FACEBOOK'UN serisi saglamdir.
    // Platformu anahtara katmasaydik saglam seriyi de keserdik.
    tabloyuKur({ media_name:K1, platform:'instagram', publish_state:'failed' },
               [{ media_name:K1, platform:'facebook', publish_state:'published',
                  published_at: su(), external_id:'fb_onceki' },
                { media_name:K2, platform:'facebook' }]);
    metaKur();
    await turAt();
    bak('★ Instagram serisi kırık diye Facebook serisi kesilmedi',
      satirlar[2].publish_state === 'published', satirlar[2].publish_state + ' / ' + satirlar[2].last_error);
  }
  {
    // Adinda _k<N> olmayan dosya tek basina bir story: hicbir sey
    // onu bekletmemeli.
    tabloyuKur({ media_name:K1, publish_state:'failed' },
               [{ media_name:'2026-12-05_story_tek.mp4' }]);
    metaKur();
    await turAt();
    bak('serisiz dosya bekletilmiyor',
      satirlar[1].publish_state === 'published', satirlar[1].publish_state + ' / ' + satirlar[1].last_error);
  }
  {
    // Onceki parcanin autoPublish'i KAPALIYSA onu elle yayinlayacaksin
    // demektir; sistem ne zaman yaptigini bilemez. Bekletseydik sonraki
    // parca sonsuza kadar kuyrukta donerdi. Bilincli bosluk.
    tabloyuKur({ media_name:K1, auto_publish:false }, [{ media_name:K2 }]);
    metaKur();
    await turAt();
    bak('elle yayınlanacak önceki parça bekletmiyor',
      satirlar[1].publish_state === 'published', satirlar[1].publish_state + ' / ' + satirlar[1].last_error);
  }

  // ═══════════════════════════════════════════════════════════════
  // KUYRUK KIMIN KAYDINI ALIYOR (sql/49)
  // ═══════════════════════════════════════════════════════════════
  // Kuyruk sahibe bakmiyordu: `user_id` suzgeci yoktu ve worker TEK bir
  // Meta hesabina yayinliyor. Baska bir kullanici story kaydi acip
  // "Otomatik yayinla"yi isaretlerse kaydi hesap sahibinin
  // Instagram'ina cikardi. Bugun olmuyordu ama sebebi kuyruk degildi:
  // media_url yalnizca MCP'den yazilabiliyor ve MCP tek hesaba kilitli.
  // Yani koruma BASKA BIR ALT SISTEMDE ve tesadufen duruyordu.
  console.log('[kuyruk sahibi]');
  {
    tabloyuKur(); metaKur();
    // Kayit BASKASINA ait: bayrak listesinde yok.
    satirlar[0].user_id = 'user-baskasi';
    const r = await turAt();
    bak('★ başkasının kaydı kuyruğa ALINMIYOR', r.govde.alinan === 0, JSON.stringify(r.govde));
    bak('★ hiçbir şey yayınlanmadı', cagrilar.publish === 0 && cagrilar.media === 0,
      'publish=' + cagrilar.publish + ' media=' + cagrilar.media);
    bak('kayıt bekliyor durumda kaldı, bozulmadı',
      satirlar[0].publish_state === 'pending' && satirlar[0].attempt_count === 0,
      satirlar[0].publish_state + '/' + satirlar[0].attempt_count);
  }
  {
    // Bayragi olan hesabin kaydi eskisi gibi yayinlaniyor: koruma
    // calisani engellemiyor.
    tabloyuKur(); metaKur();
    const r = await turAt();
    bak('sahibin kaydı normal yayınlanıyor',
      r.govde.alinan === 1 && satirlar[0].publish_state === 'published', JSON.stringify(r.govde));
  }
  {
    // Ayni turda ikisi birden: yalnizca sahibinki cikmali.
    tabloyuKur({ media_name:'a.mp4' }, [{ media_name:'b.mp4', user_id:'user-baskasi' }]);
    metaKur();
    const r = await turAt();
    bak('★ karışık turda yalnızca sahibin kaydı alındı',
      r.govde.alinan === 1 && satirlar[0].publish_state === 'published'
      && satirlar[1].publish_state === 'pending',
      JSON.stringify(r.govde) + ' | ' + satirlar.map(x=> x.publish_state).join(','));
  }

  Date.now = gercekNow;
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})().catch(e=>{ Date.now = gercekNow; console.error(e); process.exit(1); });
