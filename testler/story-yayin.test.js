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
    media_bytes:12345678, media_name:'2026-12-05_story.mp4', cover_url:null,
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

// ⚠ KUME SQL DOSYASINDAN OKUNUYOR, ELLE YAZILMIYOR.
// Elle yazsaydik taklit ile gercek yine ayrisabilirdi -- ve bu
// dosyanin butun derdi tam olarak o ayrisma.
const YAYIN_TURLERI_SQL = (()=>{
  const ham = require('fs').readFileSync(
    yol.join(KOK_DIZIN, 'sql', '54-yayin-turleri-tek-yer.sql'), 'utf8');
  const m = /select\s+array\[([^\]]*)\]::text\[\]/.exec(ham);
  if(!m) throw new Error('sql/54 icindeki tur kumesi okunamadi');
  return m[1].split(',').map(x=> x.trim().replace(/^'|'$/g, '')).filter(Boolean);
})();

// ⚠ YUKLEME KURALI DA SQL DOSYASINDAN OKUNUYOR.
// sql/56: YouTube kayitlari DOSYA HAZIR OLUR OLMAZ yukleniyor
// ('-infinity' = beklenecek saat yok); gercek yayin anini YouTube'un
// kendi zamanlayicisi tutuyor (status.publishAt). Oteki platformlarda
// zamanlama YOK -- orada erken yuklemek erken YAYINLAMAK demek, o
// yuzden onlar yayin saatini bekliyor.
//
// (sql/55 alti saatlik sabit bir pay koymustu; sql/56 onu da, ondan
// once kullanilan story_onden_yukleme islevini de kaldirdi.)
//
// Kurali elle yazsaydik sahte kuyruk ile gercek kuyruk ayrisabilirdi
// ve bu dosyanin butun derdi o ayrisma.
const YUKLEME = (()=>{
  const ham = require('fs').readFileSync(
    yol.join(KOK_DIZIN, 'sql', '56-hazir-olunca-yukle.sql'), 'utf8');
  const m = /when p_type = '([^']+)' and p_platform = '([^']+)' then '-infinity'/.exec(ham);
  if(!m) throw new Error('sql/56 yukleme ani kurali okunamadi');
  return { tur: m[1], platform: m[2] };
})();
// Kaydin YUKLEME ani (yayin ani degil). YouTube icin -Infinity.
const yuklemeAni = (tur, pf, yayinAni)=>
  (String(tur) === YUKLEME.tur && String(pf) === YUKLEME.platform)
    ? -Infinity : Date.parse(yayinAni);

// sql/56'nin "dosyasiz kayit kuyruga girmiyor" suzgeci. Kapatilabiliyor
// ki worker'daki AYNI korumanin kendisi de olculebilsin: dagitim sirasi
// ters giderse (worker yeni, SQL eski) tek koruma o.
let sql56Suzgeci = true;

const SQL = {
  story_seri_onceki({ p_id }){
    const k = bul(p_id); if(!k) return [];
    const kok = seriKok(k.media_name), sira = seriSira(k.media_name);
    if(kok === null || sira === null) return [];          // seri degil
    const onde = satirlar.filter(e=>
      // sql/50: seri AYNI TUR icinde. Ayni cekimden cikan bir story,
      // ayni koku paylasan bir reel'i bekletmemeli.
      e.type === k.type && !e.deleted_at && e.id !== p_id
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
      // sql/54: tur kumesi TEK YERDE (public.story_yayin_turleri).
      // 29 Eylul 2026'ya kadar burada da, SQL'de de yalnizca 'story'
      // yaziyordu -- yani taklit sadikti ve hata ikisinde birden
      // duruyordu. Cöken bir reels/shorts yayini kaydi sonsuza kadar
      // 'in_progress' birakiyordu: ne yayin, ne hata, ne kuyruk.
      if(YAYIN_TURLERI_SQL.includes(r.type) && r.publish_state === 'in_progress' && !r.deleted_at
         && Date.parse(r.updated_at) < SAAT - dk(Math.max(p_dakika, 1))){
        r.publish_state = 'pending'; r.updated_at = su(); n++;
      }
    }
    return n;
  },
  story_kuyruk_al({ p_limit }){
    const aday = satirlar.filter(r=>
      // sql/54: kume TEK YERDE
      YAYIN_TURLERI_SQL.includes(r.type)
      && r.auto_publish === true && r.publish_state === 'pending'
      && !r.deleted_at && r.publish_at
      // sql/56: yayin ani DEGIL, YUKLEME ani.
      && yuklemeAni(r.type, r.platform, r.publish_at) <= SAAT
      // sql/56: DOSYASIZ KAYIT KUYRUGA GIRMIYOR -- yayin saati gecene
      // kadar. Aksi halde ileri tarihli ve henuz dosyasiz kayitlar
      // kuyrugun tur basina aldigi bes kisilik yeri isgal ederdi.
      // Vakti gecmisse GIRIYOR: kalici hata alip e-posta gondersin.
      && (!sql56Suzgeci || !!r.media_url || Date.parse(r.publish_at) <= SAAT)
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
        publish_called_at:r.publish_called_at, platform:r.platform,
        // sql/50: worker konteynere STORIES mi REELS mi yazacagini
        // buradan okuyor. Donmezse her reel story olarak yayinlanir.
        type:r.type, cover_url:r.cover_url };
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
               // Reels: hangi uca gidildi ve konteynere NE yazildi.
               // Sayilar yetmiyor -- "REELS mi STORIES mi" ancak
               // govdeden okunuyor ve yanlisi hata vermiyor.
               fbReelsBaslat:0, fbReelsBitir:0,
               // Reel kapagi: kac kere denendi, hangi video kimligi
               // uzerinde, ve kapak dosyasi kac kere cekildi.
               fbKapak:0, fbKapakVideoId:'', kapakCekildi:0,
               mediaGovde: [], fbBitirGovde: [], igMediaListe:0,
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
    medyalar: [],           // /media'nin dondurecegi yayindaki gonderiler (reels)
    fbReeller: [],          // /video_reels'in dondurecegi yayindaki reel'ler
    mediaHatasi: null,      // konteyner yaratmada hata
    fbBaslatHatasi: null,
    fbYuklemeHatasi: false,
    fbKapakHatasi: false,   // /{video_id}/thumbnails patlasin mi
    kapakAlinamaz: false,   // kapak dosyasi R2'den cekilemesin mi
    medyaHatasi: 0,         // R2'den medya cekilirken donen HTTP kodu
    yayinDavranisi: 'ok'    // 'ok' | 'kaybolan-yanit' | {kod, altKod, mesaj}
  }, ek || {});
}
// urlencoded govdeyi nesneye cevirir. Konteynere ne yazildigini
// olcmenin tek yolu bu: alan adi yanlissa Meta hata vermiyor, yalnizca
// baska bir sey yayinliyor.
function alanlar(gonderi){
  const o = {};
  String(gonderi || '').split('&').forEach(par=>{
    if(!par) return;
    const i = par.indexOf('=');
    const ad = decodeURIComponent((i < 0 ? par : par.slice(0, i)).replace(/\+/g, ' '));
    const dg = i < 0 ? '' : decodeURIComponent(par.slice(i + 1).replace(/\+/g, ' '));
    o[ad] = dg;
  });
  return o;
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
  // Reel kapagi: /{video_id}/thumbnails. Sayfa degil VIDEO kimligi
  // uzerinde duruyor, o yuzden kalibi ayri.
  if(/^\/fbr_\d+\/thumbnails$/.test(p) && yontem === 'POST'){
    cagrilar.fbKapak++;
    cagrilar.fbKapakVideoId = p.split('/')[1];
    if(META.fbKapakHatasi) return grafHata(100, 'thumbnail reddedildi');
    return { success:true };
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
    // GOVDE SAKLANIYOR: media_type, caption, cover_url, share_to_feed
    // ancak buradan okunabiliyor ve yanlisi hicbir yerde hata vermiyor.
    cagrilar.mediaGovde.push(alanlar(gonderi));
    if(META.mediaHatasi) return META.mediaHatasi;
    return { id: 'cont_' + cagrilar.media };
  }
  // Yayindaki gonderiler. Reels'te cikmisMi buraya bakiyor, /stories'e degil.
  if(p === `/${IG}/media` && yontem === 'GET'){
    cagrilar.igMediaListe++;
    return { data: META.medyalar };
  }
  // ---- Facebook sayfa REEL'i ----
  if(p === `/${SAYFA}/video_reels`){
    if(yontem !== 'POST'){ return { data: META.fbReeller }; }
    const asama = /upload_phase=start/.test(gonderi || '') ? 'start' : 'finish';
    if(asama === 'start'){
      cagrilar.fbReelsBaslat++;
      if(META.fbBaslatHatasi) return META.fbBaslatHatasi;
      return { video_id:'fbr_' + cagrilar.fbReelsBaslat,
               upload_url:'https://rupload.test/video-upload/fbr_' + cagrilar.fbReelsBaslat };
    }
    cagrilar.fbReelsBitir++;
    cagrilar.fbBitirGovde.push(alanlar(gonderi));
    const d = META.yayinDavranisi;
    if(d === 'kaybolan-yanit'){
      META.fbReeller = META.fbReeller.concat([{ id:'fbr_cokme', creation_time: su() }]);
      throw new Error('baglanti koptu');
    }
    if(d && typeof d === 'object') return grafHata(d.kod, d.mesaj, d.altKod);
    META.fbReeller = META.fbReeller.concat([{ id:'fbreel_' + cagrilar.fbReelsBitir, creation_time: su() }]);
    return { success:true, post_id:'fbreel_' + cagrilar.fbReelsBitir };
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

// ── SAHTE TIKTOK ──────────────────────────────────────────────────
// Uc ayri uc: jeton, yukleme baslatma, parca PUT'lari. Parcalarin
// Content-Range basliklari toplaniyor -- olculmek istenen sey "yukledi
// mi" degil, DOSYAYI DOGRU BOLDU MU.
// ⚠ BASLANGICTA KURULU. Baska bir olcum yanlislikla tiktok_hesaplari
// uctasini cagirirsa "null okunamadi" diye COKMESIN -- coken test, kor
// testle ayni goruntuyu verir.
let TT = null;
function ttKur(ek){
  TT = Object.assign({
    hesap: { user_id:'u1', open_id:'oid', kullanici_adi:'Test',
             erisim_jetonu:'tok_gecerli',
             erisim_bitis: new Date(Date.now() + 3600e3).toISOString(),
             yenileme_jetonu:'yen_1',
             yenileme_bitis: new Date(Date.now() + 30*864e5).toISOString() },
    baslatHatasi: 0, parcaHatasi: 0, durum: 'SEND_TO_USER_INBOX',
    yenilemeSuskun: false,
    yenilemeCalisti: 0, init: null, parcalar: [], jetonlar: []
  }, ek || {});
}

// ── SAHTE YOUTUBE ─────────────────────────────────────────────────
// Google'in surdurulebilir (resumable) yukleme protokolu: once oturum
// (POST, cevabin Location basliginda adres), sonra parca parca PUT.
// ARA parcalarin cevabi 308, SON parcanin cevabi 200 + video kimligi.
//
// ⚠ 308'i dogru taklit etmek testin butun degeri: worker ara parcada
// 200 gorse "bitti" sanardi ve bu sahte sunucu her seye 200 dondurse
// hicbir zaman fark edilmezdi.
// ⚠ BASLANGICTA KURULU (TT ile ayni gerekce): baska bir olcum
// youtube_hesaplari uctasini cagirirsa COKMESIN -- coken test, kor
// testle ayni goruntuyu verir.
let YT = null;
function ytKur(ek){
  YT = Object.assign({
    hesap: { user_id:'u1', kanal_id:'UC_test', kanal_adi:'Gerçeğin İzleri',
             erisim_jetonu:'ytok_gecerli',
             erisim_bitis: new Date(Date.now() + 3600e3).toISOString(),
             yenileme_jetonu:'ytyen_1' },
    oturumHatasi: 0,        // oturum acmada donen HTTP kodu
    hataSebebi: '',         // Google'in `error.errors[0].reason` degeri
    // Her parca PUT'u saati BU KADAR ilerletiyor. Sahte fetch aninda
    // donuyor ve saat donmus: gecikme olmadan "butce ortada doldu"
    // yolu HIC calismiyor, yani olculemiyor.
    parcaGecikmesiMs: 0,
    oturumLocation: 'https://yt-oturum.test/sess-1',
    parcaHatasi: 0,         // son parcada donen HTTP kodu
    araParcaKodu: 308,      // ARA parcalarin donecegi kod
    videoId: 'ytv_1',
    sonParcaKimliksiz: false,
    durumKodu: 200,         // youtubeCikmisMi sorgusunun donecegi kod
    yenilemeCalisti: 0, yenilemeHatasi: 0,
    ustveri: null, parcalar: [], jetonlar: [], durumSorgulari: [],
    hesapYazmalari: []
  }, ek || {});
}

// Google'in hata govdesi. `reason` HATA DIZISININ ILK ogesinde duruyor,
// govdenin kokunde degil -- yanlis yerden okumak butun triyaji
// "bilinmeyen sebep" dalina dusurur ve hicbir yerde gorunmez.
const ytHataGovdesi = ()=> ({
  error: { code: YT.oturumHatasi || YT.parcaHatasi, message:'reddedildi',
           errors: YT.hataSebebi ? [{ reason: YT.hataSebebi, message:'reddedildi' }] : [] }
});

function sahteFetch(adres, secenek){
  const url = String(adres);
  const yontem = (secenek && secenek.method) || 'GET';

  // Kapak gorseli: fbReelKapagi arrayBuffer() istiyor, medya
  // mock'undaki akan govde bunu karsilamiyor -- ayri dal.
  if(url.indexOf('https://kapak.test') === 0){
    cagrilar.kapakCekildi++;
    if(META.kapakAlinamaz) return yanit({}, 404);
    return Promise.resolve({ ok:true, status:200,
      headers:new Map([['content-type','image/jpeg']]),
      arrayBuffer:()=>Promise.resolve(new ArrayBuffer(2048)),
      text:()=>Promise.resolve(''), json:()=>Promise.resolve({}) });
  }
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

  // --- TikTok ---
  if(url.indexOf('open.tiktokapis.com/v2/oauth/token') > -1){
    TT.yenilemeCalisti++;
    // TikTok normalde YENI bir yenileme jetonu donduruyor. `yenilemeSuskun`
    // ise dondurmedigi hali kuruyor: o halde worker ESKI degeri korumak
    // zorunda. Bu secenek olmadan `?? eski deger` dali hic calismiyordu
    // -- silinse hicbir olcum bunu gormezdi.
    return yanit(Object.assign({ access_token:'tok_yeni', expires_in:86400 },
      TT.yenilemeSuskun ? {} : { refresh_token:'yen_2' }), 200);
  }
  if(url.indexOf('open.tiktokapis.com/v2/post/publish/inbox/video/init') > -1){
    TT.jetonlar.push(((secenek.headers||{}).authorization) || '');
    if(TT.baslatHatasi) return yanit({ error:{ code:'x' } }, TT.baslatHatasi);
    TT.init = JSON.parse(secenek.body || '{}');
    return yanit({ data:{ upload_url:'https://tt-yukle.test/abc', publish_id:'pub_1' } }, 200);
  }
  if(url.indexOf('open.tiktokapis.com/v2/post/publish/status/fetch') > -1){
    return yanit({ data:{ status: TT.durum } }, 200);
  }
  if(url.indexOf('https://tt-yukle.test') === 0){
    TT.parcalar.push({
      aralik: (secenek.headers||{})['content-range'] || '',
      uzunluk: (secenek.headers||{})['content-length'] || '',
      tur: (secenek.headers||{})['content-type'] || ''
    });
    if(TT.parcaHatasi) return yanit({}, TT.parcaHatasi);
    return yanit({}, 200);
  }
  // --- YouTube ---
  if(url.indexOf('oauth2.googleapis.com/token') > -1){
    YT.yenilemeCalisti++;
    if(YT.yenilemeHatasi) return yanit({ error:'invalid_grant' }, YT.yenilemeHatasi);
    // ⚠ GOOGLE YENILEMEDE refresh_token DONDURMUYOR. Sahtesi de
    // dondurmuyor: dondurse, worker'in eksik alani dogru ele aldigi
    // hic olculmezdi.
    return yanit({ access_token:'ytok_yeni', expires_in:3600 }, 200);
  }
  if(url.indexOf('googleapis.com/upload/youtube/v3/videos') > -1){
    YT.jetonlar.push(((secenek.headers||{}).authorization) || '');
    if(YT.oturumHatasi) return yanit(ytHataGovdesi(), YT.oturumHatasi);
    YT.ustveri = JSON.parse(secenek.body || '{}');
    YT.oturumBasliklari = {
      boyut: (secenek.headers||{})['x-upload-content-length'] || '',
      tur:   (secenek.headers||{})['x-upload-content-type'] || ''
    };
    // ⚠ OTURUM ADRESI CEVABIN `Location` BASLIGINDA, govdesinde DEGIL.
    // Sahtesinde govdeye de koysaydik, worker'in yanlis yerden okumasi
    // gorunmez kalirdi. `yanit()` baslik tasimadigi icin cevap burada
    // elle kuruluyor.
    return Promise.resolve({
      ok:true, status:200,
      headers: new Map(YT.oturumLocation ? [['location', YT.oturumLocation]] : []),
      text:()=>Promise.resolve('{}'), json:()=>Promise.resolve({})
    });
  }
  if(url.indexOf('https://yt-oturum.test') === 0){
    const bas = secenek.headers || {};
    const aralik = bas['content-range'] || '';
    // Govdesiz PUT + `bytes * /toplam` = DURUM SORGUSU (cokus kurtarmasi).
    if(/^bytes \*\//.test(aralik)){
      YT.durumSorgulari.push(aralik);
      if(YT.durumKodu !== 200) return yanit({}, YT.durumKodu);
      return yanit({ id: YT.videoId }, 200);
    }
    YT.parcalar.push({ aralik, uzunluk: bas['content-length'] || '', tur: bas['content-type'] || '' });
    if(YT.parcaGecikmesiMs) ilerlet(YT.parcaGecikmesiMs);
    const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(aralik);
    const sonParca = m && Number(m[2]) === Number(m[3]) - 1;
    if(!sonParca) return yanit({}, YT.araParcaKodu);
    if(YT.parcaHatasi) return yanit(ytHataGovdesi(), YT.parcaHatasi);
    return yanit(YT.sonParcaKimliksiz ? {} : { id: YT.videoId }, 200);
  }
  if(url.indexOf('/rest/v1/youtube_hesaplari') > -1){
    if(!YT) ytKur();
    if(yontem === 'PATCH'){
      const y = JSON.parse(secenek.body || '{}');
      YT.hesapYazmalari.push(y);
      Object.assign(YT.hesap, y);
      return yanit([], 200);
    }
    return yanit(YT.hesap ? [YT.hesap] : [], 200);
  }
  if(url.indexOf('/rest/v1/tiktok_hesaplari') > -1){
    if(!TT) ttKur();
    if(yontem === 'PATCH'){
      Object.assign(TT.hesap, JSON.parse(secenek.body || '{}'));
      return yanit([], 200);
    }
    return yanit(TT.hesap ? [TT.hesap] : [], 200);
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
  TIKTOK_CLIENT_KEY: 'ck_test',
  TIKTOK_CLIENT_SECRET: 'cs_test',
  YOUTUBE_CLIENT_ID: 'yt_id_test',
  YOUTUBE_CLIENT_SECRET: 'yt_secret_test',
  // ⛔ DENETIM KAPISI ACIK. Gercekte 29 Eylul 2026'da KAPALI ve
  // kapalilik ayri ayri olculuyor (asagida); testlerin cogu yukleme
  // yolunu olctugu icin burada acik duruyor.
  YOUTUBE_DENETIM_GECTI: '1',
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
    // ⚠ ORNEK PLATFORM 28 Eylul 2026'da DEGISTI: burada 'tiktok'
    // yaziyordu ve TikTok desteklenince bu olcum sessizce anlamini
    // yitirdi -- "desteklenmeyen platform" testi DESTEKLENEN bir
    // platformu olcmeye baslamisti. Yeni platform eklerken buraya bak.
    tabloyuKur({ platform:'threads' }); metaKur();
    await turAt();
    bak('desteklenmeyen platform hiçbir yere yayınlanmıyor',
      cagrilar.media === 0 && cagrilar.publish === 0 && cagrilar.fbBaslat === 0);
    bak('hata değil, erteleme: kayıt pending kaldı', satirlar[0].publish_state === 'pending');
    bak('deneme hakkı harcanmadı', satirlar[0].attempt_count === 0, String(satirlar[0].attempt_count));
    // Sessizce dusmemeli: kullanici neden yayinlanmadigini gorebilmeli.
    bak('sebebi kayda yazıldı',
      /threads/i.test(String(satirlar[0].last_error)), satirlar[0].last_error);
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

  // ══════════════════════════════════════════════════════════════
  // REELS (sql/50 + worker 1.5.0)
  // ══════════════════════════════════════════════════════════════
  // Reels ile story arasindaki fark KONTEYNERDE ve BITIS CAGRISINDA
  // duruyor. Ikisi de hata vermiyor: yanlis yazilirsa Instagram sessizce
  // BASKA BIR SEY yayinliyor -- bir reel bekleyen kullanici 24 saatte
  // kaybolan bir story aliyor. O yuzden burada sayilar degil GOVDELER
  // olculuyor.
  const reelKayit = (ek)=> Object.assign({
    type:'reels', media_name:'2026-12-05_reels_konu.mp4',
    media_url:'https://medya.test/2026-12-05_reels_konu.mp4',
    content:{ timezone:'Europe/Istanbul', caption:'Balıklı Meryem Ana · kısa anlatım' }
  }, ek || {});

  console.log('[reels · instagram konteyneri]');
  {
    tabloyuKur(reelKayit({ cover_url:'https://medya.test/2026-12-05_reels_konu.jpg' }));
    metaKur();
    const r = await turAt();
    const gv = cagrilar.mediaGovde[0] || {};
    bak('★ konteyner REELS diyor', gv.media_type === 'REELS', JSON.stringify(gv));
    bak('video_url veriliyor', gv.video_url === 'https://medya.test/2026-12-05_reels_konu.mp4', gv.video_url);
    bak('★ kapak konteynere geçiyor',
      gv.cover_url === 'https://medya.test/2026-12-05_reels_konu.jpg', gv.cover_url);
    bak('alt yazı kaydın içeriğinden geliyor',
      gv.caption === 'Balıklı Meryem Ana · kısa anlatım', gv.caption);
    bak('akışta da paylaşılıyor (varsayılan)', gv.share_to_feed === 'true', gv.share_to_feed);
    bak('image_url YOK (reels video)', gv.image_url === undefined, gv.image_url);
    bak('yayınlandı', satirlar[0].publish_state === 'published', JSON.stringify(r.govde));
  }
  {
    // ── ETIKETLER ────────────────────────────────────────────────
    // Shootboard kaydinda etiketler AYRI alanda (content.hashtags) ve
    // 27 Eylul 2026'ya kadar hicbir yayina girmiyordu. Gonderi cikiyor,
    // etiketler yok, hicbir yerde hata gorunmuyor -- yalnizca erisim
    // dusuyor. Bu yuzden olcum govdenin KENDISINE bakiyor.
    tabloyuKur(reelKayit({ content:{ timezone:'Europe/Istanbul',
      caption:'Balıklı Meryem Ana · kısa anlatım',
      hashtags:'#tarih #belgesel #arkeoloji' } }));
    metaKur();
    await turAt();
    const gv = cagrilar.mediaGovde[0] || {};
    bak('★ etiketler alt yazıya giriyor',
      gv.caption === 'Balıklı Meryem Ana · kısa anlatım\n\n#tarih #belgesel #arkeoloji',
      JSON.stringify(gv.caption));
  }
  {
    // Virgullu yazim da kabul: "#a, #b" -> "#a #b".
    tabloyuKur(reelKayit({ content:{ timezone:'Europe/Istanbul',
      caption:'metin', hashtags:'#tarih, #belgesel' } }));
    metaKur();
    await turAt();
    bak('★ virgüller temizleniyor',
      (cagrilar.mediaGovde[0] || {}).caption === 'metin\n\n#tarih #belgesel',
      JSON.stringify((cagrilar.mediaGovde[0] || {}).caption));
  }
  {
    // Kullanici etiketleri alt yaziya ELLE yazdiysa ikinci kez eklenmiyor.
    tabloyuKur(reelKayit({ content:{ timezone:'Europe/Istanbul',
      caption:'metin\n\n#tarih #belgesel', hashtags:'#tarih #belgesel' } }));
    metaKur();
    await turAt();
    bak('★ elle yazılmış etiket tekrarlanmıyor',
      (cagrilar.mediaGovde[0] || {}).caption === 'metin\n\n#tarih #belgesel',
      JSON.stringify((cagrilar.mediaGovde[0] || {}).caption));
  }
  {
    // ⚠ 2200 SINIRI ETIKETIN ORTASINDAN GECMEMELI.
    const uzun = 'a'.repeat(2180);
    tabloyuKur(reelKayit({ content:{ timezone:'Europe/Istanbul',
      caption:uzun, hashtags:'#kisa #cokdahauzunbiretiket' } }));
    metaKur();
    await turAt();
    const c2 = (cagrilar.mediaGovde[0] || {}).caption || '';
    bak('★ sınırda yarım etiket bırakılmıyor',
      c2.length <= 2200 && !/#[a-z]*$/.test(c2.replace(/#kisa$/, '')) && c2.endsWith('#kisa'),
      JSON.stringify(c2.slice(-40)) + ' uzunluk=' + c2.length);
  }
  {
    // Etiket alani bossa davranis degismiyor (gerileme korumasi).
    tabloyuKur(reelKayit({ content:{ timezone:'Europe/Istanbul',
      caption:'yalnız metin', hashtags:'' } }));
    metaKur();
    await turAt();
    bak('etiketsiz kayıt aynı kalıyor',
      (cagrilar.mediaGovde[0] || {}).caption === 'yalnız metin',
      JSON.stringify((cagrilar.mediaGovde[0] || {}).caption));
  }
  {
    // Kapak isteğe bağlı: yoksa alan hiç gitmiyor ve yayın DURMUYOR.
    tabloyuKur(reelKayit()); metaKur();
    await turAt();
    const gv = cagrilar.mediaGovde[0] || {};
    bak('kapaksız reel: cover_url gönderilmiyor', gv.cover_url === undefined, gv.cover_url);
    bak('kapaksız reel yine de yayınlanıyor', satirlar[0].publish_state === 'published');
  }
  {
    // Kayıt bazında kapatılabiliyor.
    tabloyuKur(reelKayit({ content:{ timezone:'Europe/Istanbul', shareToFeed:false } }));
    metaKur();
    await turAt();
    bak('shareToFeed:false konteynere yansıyor',
      (cagrilar.mediaGovde[0] || {}).share_to_feed === 'false',
      JSON.stringify(cagrilar.mediaGovde[0]));
  }
  {
    // ⚠ GERILEME KORUMASI: story hâlâ story.
    tabloyuKur(); metaKur();
    await turAt();
    const gv = cagrilar.mediaGovde[0] || {};
    bak('★ story konteyneri STORIES kalıyor', gv.media_type === 'STORIES', JSON.stringify(gv));
    bak('story konteynerine caption GİRMİYOR', gv.caption === undefined, gv.caption);
  }

  console.log('[reels · video olmak zorunda]');
  {
    tabloyuKur(reelKayit({ media_mime:'image/jpeg',
      media_url:'https://medya.test/2026-12-05_reels_konu.jpg' }));
    metaKur();
    await turAt();
    bak('★ fotoğraf reel olamaz: kalıcı hata',
      satirlar[0].publish_state === 'failed', satirlar[0].publish_state);
    bak('hiç konteyner yaratılmadı', cagrilar.media === 0, String(cagrilar.media));
    bak('kullanıcıya bildirildi', epostalar.length === 1, String(epostalar.length));
  }

  console.log('[reels · facebook ayrı bir uç]');
  {
    tabloyuKur(reelKayit({ platform:'facebook' })); metaKur();
    await turAt();
    // video_stories bir reel URETMIYOR; uc yanlissa story cikar.
    bak('★ video_reels ucuna gidildi', cagrilar.fbReelsBaslat === 1, String(cagrilar.fbReelsBaslat));
    bak('★ video_stories ucuna GİDİLMEDİ', cagrilar.fbBaslat === 0, String(cagrilar.fbBaslat));
    const bt = cagrilar.fbBitirGovde[0] || {};
    bak('★ video_state PUBLISHED (yoksa taslakta kalır)',
      bt.video_state === 'PUBLISHED', JSON.stringify(bt));
    bak('açıklama gönderildi', bt.description === 'Balıklı Meryem Ana · kısa anlatım', bt.description);
    bak('yayınlandı', satirlar[0].publish_state === 'published', satirlar[0].publish_state);
  }

  console.log('[reels · facebook KAPAGI (30 Eylul 2026)]');
  {
    // ⛔ NEDEN: video_reels finish cagrisi kapak ALMIYOR (Meta'nin kendi
    // ornek koleksiyonu yalnizca video_state/description/title listeliyor).
    // Instagram cover_url aliyor, Facebook almiyor -- o yuzden Facebook
    // reels'lari kapaksiz cikiyordu, kapak dosyasi R2'de dururken.
    tabloyuKur(reelKayit({ platform:'facebook',
      cover_url:'https://kapak.test/2026-12-05_reels_konu.jpg' }));
    metaKur();
    await turAt();
    bak('★ kapak icin ayri cagri yapildi', cagrilar.fbKapak === 1, String(cagrilar.fbKapak));
    // SAYFA kimligi degil VIDEO kimligi: yanlis kimlige giden cagri
    // sessizce baska bir seyin kapagini degistirir.
    bak('★ kapak VIDEO kimligine gitti (sayfaya degil)',
      cagrilar.fbKapakVideoId === 'fbr_1', cagrilar.fbKapakVideoId);
    bak('kapak dosyasi gercekten cekildi', cagrilar.kapakCekildi === 1, String(cagrilar.kapakCekildi));
    bak('yayin tamamlandi', satirlar[0].publish_state === 'published', satirlar[0].publish_state);
  }
  {
    // Kapak yoksa cagri HIC yapilmamali: bos bir thumbnails cagrisi
    // Facebook'un kendi sectigi kareyi bozabilir.
    tabloyuKur(reelKayit({ platform:'facebook' })); metaKur();
    await turAt();
    bak('★ kapaksiz kayitta thumbnails cagrisi YOK', cagrilar.fbKapak === 0, String(cagrilar.fbKapak));
    bak('kapaksiz reel yine yayinlandi', satirlar[0].publish_state === 'published', satirlar[0].publish_state);
  }
  {
    // ⛔ EN ONEMLI OLCUM: KAPAK PATLASA DA YAYIN DEVAM EDER.
    // Kapak kozmetik; yayin degil. Bu cagriyi hataya baglamak,
    // yayinlanabilecek bir gonderiyi kozmetik bir eksik yuzunden
    // cope atmak olurdu -- ve kullanici o gunu geri alamaz.
    tabloyuKur(reelKayit({ platform:'facebook',
      cover_url:'https://kapak.test/2026-12-05_reels_konu.jpg' }));
    metaKur({ fbKapakHatasi:true });
    await turAt();
    bak('★ kapak cagrisi PATLADI ama reel YAYINLANDI',
      satirlar[0].publish_state === 'published', satirlar[0].publish_state);
    bak('kapak denendi', cagrilar.fbKapak === 1, String(cagrilar.fbKapak));
    bak('finish cagrisi yine yapildi', cagrilar.fbReelsBitir === 1, String(cagrilar.fbReelsBitir));
    bak('kalici hata yazilmadi', !satirlar[0].last_error, String(satirlar[0].last_error));
  }
  {
    // Kapak dosyasinin KENDISI cekilemezse de ayni sey: yayin devam.
    tabloyuKur(reelKayit({ platform:'facebook',
      cover_url:'https://kapak.test/yok.jpg' }));
    metaKur({ kapakAlinamaz:true });
    await turAt();
    bak('★ kapak dosyasi 404 olsa da reel YAYINLANDI',
      satirlar[0].publish_state === 'published', satirlar[0].publish_state);
    bak('kapak ucuna hic gidilmedi (dosya yok)', cagrilar.fbKapak === 0, String(cagrilar.fbKapak));
  }

  console.log('[reels · facebook başlığı (27 Eylül 2026)]');
  {
    // shortTitle kayıtta doluydu ve HİÇBİR YERE gitmiyordu. video_reels
    // ucu `title` kabul ediyor; alan boşa duruyordu.
    tabloyuKur(reelKayit({ platform:'facebook',
      content:{ timezone:'Europe/Istanbul', caption:'Balıklı Meryem Ana · kısa anlatım',
                shortTitle:'Balıklı Meryem Ana — kısa' } }));
    metaKur();
    await turAt();
    const bt = cagrilar.fbBitirGovde[0] || {};
    bak('★ shortTitle title olarak gidiyor',
      bt.title === 'Balıklı Meryem Ana — kısa', JSON.stringify(bt));
    bak('açıklama da bozulmadı',
      bt.description === 'Balıklı Meryem Ana · kısa anlatım', bt.description);
  }
  {
    // ⚠ BOŞ BAŞLIK ALANI HİÇ GÖNDERİLMİYOR. Boş bir title yazmak,
    // Facebook'un kendi varsayılanını bozabilir; yazmamaktan farklı.
    tabloyuKur(reelKayit({ platform:'facebook' })); metaKur();
    await turAt();
    const bt = cagrilar.fbBitirGovde[0] || {};
    bak('★ shortTitle yoksa title alanı HİÇ yok', bt.title === undefined, JSON.stringify(bt));
  }
  {
    // Instagram'ın title alanı YOK: oraya sızmamalı.
    tabloyuKur(reelKayit({ platform:'instagram',
      content:{ timezone:'Europe/Istanbul', caption:'metin', shortTitle:'başlık' } }));
    metaKur();
    await turAt();
    const gv = cagrilar.mediaGovde[0] || {};
    bak('★ instagram konteynerine title GİRMİYOR', gv.title === undefined, JSON.stringify(gv));
  }
  {
    // Facebook STORY'de de olmamalı: video_stories title kabul etmiyor.
    tabloyuKur({ platform:'facebook',
      content:{ timezone:'Europe/Istanbul', shortTitle:'başlık' } });
    metaKur();
    await turAt();
    const bt = cagrilar.fbBitirGovde[0] || {};
    bak('★ facebook story bitişinde title YOK', bt.title === undefined, JSON.stringify(bt));
  }
  {
    // ⚠ GERILEME KORUMASI: Facebook story hâlâ video_stories.
    tabloyuKur({ platform:'facebook' }); metaKur();
    await turAt();
    bak('★ facebook story video_stories kalıyor',
      cagrilar.fbBaslat === 1 && cagrilar.fbReelsBaslat === 0,
      'stories=' + cagrilar.fbBaslat + ' reels=' + cagrilar.fbReelsBaslat);
    bak('story bitişinde video_state YOK',
      (cagrilar.fbBitirGovde[0] || {}).video_state === undefined,
      JSON.stringify(cagrilar.fbBitirGovde[0] || {}));
  }

  console.log('[reels · önden yaratılan konteyner de REELS]');
  {
    // ⚠ ASIL TUZAK: konteyner alanlari IKI yerde uretiliyordu. Onden
    // yaratilan konteyner yayinda KULLANILIYOR, yani o kopya yanlissa
    // kazanan yanlis olan olur ve hicbir yerde hata gorunmez.
    tabloyuKur(reelKayit({ id:'st_1', media_name:'a_reels.mp4' }),
               [reelKayit({ media_name:'b_reels.mp4' })]);
    metaKur();
    await turAt();
    bak('iki konteyner de önden yaratıldı', cagrilar.media === 2, String(cagrilar.media));
    bak('★ önden yaratılan konteynerlerin İKİSİ de REELS',
      cagrilar.mediaGovde.every(x=> x.media_type === 'REELS'),
      JSON.stringify(cagrilar.mediaGovde.map(x=> x.media_type)));
    bak('ikisi de yayınlandı',
      satirlar.every(x=> x.publish_state === 'published'),
      satirlar.map(x=> x.publish_state).join(','));
  }

  console.log('[reels · konteyner tavanı story\'den uzun]');
  {
    // Reels'in islenmesi dakikalar surebiliyor. 120 saniyelik story
    // tavani uygulansaydi hazir olmak uzere olan her video dusurulurdu.
    // Yoklama her cagrida 5 sn ilerletiyor; 40 yoklama = 200 sn.
    tabloyuKur(reelKayit()); metaKur({ durumSirasi: Array(40).fill('IN_PROGRESS').concat(['FINISHED']) });
    await turAt();
    bak('★ 200 saniyede düşürülmedi (story tavanı 120 sn)',
      !/saniyede hazır olmadı/.test(satirlar[0].last_error || ''),
      satirlar[0].publish_state + ' | ' + satirlar[0].last_error);
  }
  {
    // Story AYNI kosulda dusuyor: tavan gercekten ture bagli.
    tabloyuKur(); metaKur({ durumSirasi: Array(40).fill('IN_PROGRESS').concat(['FINISHED']) });
    await turAt();
    bak('★ story aynı koşulda 120 saniyede düşüyor',
      /120 saniyede hazır olmadı/.test(satirlar[0].last_error || ''),
      satirlar[0].publish_state + ' | ' + satirlar[0].last_error);
  }

  console.log('[reels · çöküş kurtarması doğru listeye bakıyor]');
  {
    // Cagri gitti, yanit donmedi, reel CIKTI. /stories'e bakilsaydi
    // "cikmamis" denir ve reel IKINCI KEZ yayinlanirdi -- kalici bir
    // gonderi, elle silmek gerekir.
    tabloyuKur(reelKayit({ publish_ref:'cont_eski', publish_called_at: su() }));
    metaKur();
    ilerlet(dk(5));                     // taze pencere kapansin
    META.medyalar = [{ id:'media_reel_cikti', timestamp: su() }];
    await turAt();
    bak('★ /media listesine bakıldı', cagrilar.igMediaListe === 1, String(cagrilar.igMediaListe));
    bak('★ çıkmış reel bulundu, İKİNCİ KEZ yayınlanmadı',
      satirlar[0].publish_state === 'published' && cagrilar.publish === 0,
      satirlar[0].publish_state + ' publish=' + cagrilar.publish);
    bak('dış kimlik kaydedildi', satirlar[0].external_id === 'media_reel_cikti', satirlar[0].external_id);
  }
  {
    // Liste BOS ama cagri taze: "cikmadi" DEME. /media birkac saniye
    // gecikebiliyor ve yanlis "cikmadi" cevabi cift reel demek.
    tabloyuKur(reelKayit({ publish_ref:'cont_eski', publish_called_at: su() }));
    metaKur();
    META.medyalar = [];
    await turAt();
    bak('★ taze çağrıda boş liste "çıkmadı" sayılmıyor',
      cagrilar.publish === 0 && satirlar[0].publish_state === 'pending',
      'publish=' + cagrilar.publish + ' durum=' + satirlar[0].publish_state);
    bak('deneme hakkı geri verildi', satirlar[0].attempt_count === 0, String(satirlar[0].attempt_count));
  }

  console.log('[tiktok · taslaga birakma]');
  let ttKayit;
  {
    // 150 MB'lik bir reel. Olculen sey "yukledi mi" degil: dosyayi
    // DOGRU boldu mu, ve alt yazi GITMEDI mi.
    ttKayit = (ek)=> Object.assign({
      type:'reels', platform:'tiktok', media_name:'2026-12-05_reels_konu.mp4',
      media_url:'https://medya.test/2026-12-05_reels_konu.mp4',
      // ⚠ BOYUT BILEREK TAM BOLUNMUYOR: 114 MB / 10 MB = 11 parca + artan.
      // Ilk yazdigimda 150 MB secmistim ve 150 tam bolundugu icin
      // "son parca artani alir" ile "esit bol", floor ile ceil AYNI
      // sonucu veriyordu -- iki mutasyon da yakalanmadi. Kor olcum.
      // 114 MB, 28 Eylul'de gercekten yuklenen aizanoi dosyasinin boyutu.
      media_bytes: 114 * 1024 * 1024, media_mime:'video/mp4',
      content:{ timezone:'Europe/Istanbul', caption:'metin', hashtags:'#a #b' }
    }, ek || {});

    tabloyuKur(ttKayit()); metaKur(); ttKur();
    await turAt();
    const init = TT.init || {};
    const si = init.source_info || {};
    bak('★ TikTok GELEN KUTUSU ucu kullanıldı (yayın değil, taslak)',
        !!TT.init, JSON.stringify(TT.init));
    bak('kaynak FILE_UPLOAD', si.source === 'FILE_UPLOAD', si.source);
    bak('boyut olduğu gibi bildiriliyor', si.video_size === 114*1024*1024, si.video_size);
    // floor: 114/10 = 11 (ceil olsaydi 12 olurdu)
    bak('★ parça sayısı floor(boyut/parça)', si.total_chunk_count === 11,
        si.chunk_size + ' x ' + si.total_chunk_count);
    // ⛔ EN ONEMLI OLCUM: alt yazi bu uctan GITMIYOR. Gittigini sanmak,
    // kullanicinin TikTok'ta bos bir taslak bulmasi demek.
    bak('★ gövdede alt yazı/etiket alanı YOK (uç taşımıyor)',
        !/caption|post_info|title|hashtag/i.test(JSON.stringify(TT.init)),
        JSON.stringify(TT.init));

    bak('★ 11 parça gönderildi', TT.parcalar.length === 11, TT.parcalar.length);
    bak('ilk parça 0\'dan başlıyor',
        TT.parcalar[0] && TT.parcalar[0].aralik === 'bytes 0-10485759/119537664',
        TT.parcalar[0] && TT.parcalar[0].aralik);
    // ⚠ SON PARCA ARTANI DA ALIYOR. Esit bolseydik son 10 MB hic
    // gitmez, TikTok "eksik dosya" derdi.
    const son = TT.parcalar[TT.parcalar.length - 1];
    bak('★ son parça dosyanın sonuna kadar gidiyor',
        son && son.aralik === 'bytes 104857600-119537663/119537664', son && son.aralik);
    bak('parçalar bitişik ve boşluksuz', (()=>{
      let bekle = 0;
      for(const p of TT.parcalar){
        const m = /^bytes (\d+)-(\d+)\//.exec(p.aralik || '');
        if(!m || Number(m[1]) !== bekle) return false;
        bekle = Number(m[2]) + 1;
      }
      return bekle === 119537664;
    })());
    bak('kayıt tamamlandı olarak işaretlendi',
        satirlar[0].publish_state === 'published', satirlar[0].publish_state);
    bak('publish_id kayda yazıldı', satirlar[0].external_id === 'pub_1', satirlar[0].external_id);
  }
  {
    // Hesap bagli degilse: HATA DEGIL ERTELEME. Deneme hakki yanmamali.
    tabloyuKur(ttKayit()); metaKur(); ttKur({ hesap: null });
    await turAt();
    bak('★ hesap bağlı değilse kayıt ERTELENİYOR (hata değil)',
        satirlar[0].publish_state === 'pending', satirlar[0].publish_state);
    bak('ertelemede TikTok bağlama adresi söyleniyor',
        /tiktok\.html/.test(String(satirlar[0].last_error || '')), satirlar[0].last_error);
    bak('hiç yükleme denenmedi', TT.parcalar.length === 0, TT.parcalar.length);
  }
  {
    // Jetonun suresi dolmussa yenileniyor ve yukleme YINE yapiliyor.
    tabloyuKur(ttKayit()); metaKur();
    ttKur();
    TT.hesap.erisim_bitis = new Date(Date.now() - 1000).toISOString();
    await turAt();
    bak('★ süresi dolmuş jeton yenileniyor', TT.yenilemeCalisti === 1, TT.yenilemeCalisti);
    bak('yenilenen jetonla yükleme yapılıyor',
        TT.jetonlar.some(j=> String(j).indexOf('tok_yeni') > -1), TT.jetonlar.join('|'));
    bak('yenileme sonrası kayıt tamamlandı',
        satirlar[0].publish_state === 'published', satirlar[0].publish_state);
    bak('dönen yeni yenileme jetonu saklandı', TT.hesap.yenileme_jetonu === 'yen_2',
        TT.hesap.yenileme_jetonu);
  }
  {
    // TikTok yenileme jetonu DONDURMEZSE eskisi korunmali. 29 Eylul
    // 2026'da YouTube yolunu yazarken farkedildi: bu dal hic
    // olculmuyordu ve silinse hicbir test dusmezdi.
    tabloyuKur(ttKayit()); metaKur(); ttKur({ yenilemeSuskun: true });
    TT.hesap.erisim_bitis = new Date(Date.now() - 1000).toISOString();
    await turAt();
    bak('★ TikTok yenileme jetonu dönmezse ESKİSİ korunuyor',
        TT.hesap.yenileme_jetonu === 'yen_1', TT.hesap.yenileme_jetonu);
    bak('susan yenilemede yükleme yine yapıldı',
        satirlar[0].publish_state === 'published', satirlar[0].publish_state);
  }

  // ══════════════════════════════════════════════════════════════
  // YOUTUBE SHORTS
  // ══════════════════════════════════════════════════════════════
  console.log('[youtube · surdurulebilir yukleme]');
  let ytKayit;
  {
    ytKayit = (ek)=> Object.assign({
      type:'shorts', platform:'youtube', title:'Aizanoi',
      media_name:'2026-12-05_shorts_aizanoi.mp4',
      media_url:'https://medya.test/2026-12-05_shorts_aizanoi.mp4',
      // ⚠ BOYUT BILEREK 8 MB'IN TAM KATI DEGIL: 114 MB / 8 MB = 14
      // parca + 2 MB artan. Tam kat secseydik ceil ile floor AYNI
      // sonucu verirdi ve TikTok formulunun buraya kopyalanmasi
      // yakalanmazdi -- TT testinde tam bu hata yapildi.
      media_bytes: 114 * 1024 * 1024, media_mime:'video/mp4',
      content:{ timezone:'Europe/Istanbul',
                videoTitle:'Aizanoi: Zeus Tapınağının Altındaki Tünel',
                caption:'Kütahya\'da bir tapınağın altında...', hashtags:'#arkeoloji, #aizanoi' }
    }, ek || {});

    tabloyuKur(ytKayit()); metaKur(); ytKur();
    await turAt();

    const TOPLAM = 114 * 1024 * 1024;              // 119537664
    const PARCA  = 8 * 1024 * 1024;                // 8388608
    bak('★ oturum acildi (uc /upload/ onekli)', !!YT.ustveri, JSON.stringify(YT.ustveri));
    bak('oturum boyutu x-upload-content-length ile bildiriliyor',
        (YT.oturumBasliklari||{}).boyut === String(TOPLAM), (YT.oturumBasliklari||{}).boyut);
    bak('oturum dosya turunu bildiriyor',
        (YT.oturumBasliklari||{}).tur === 'video/mp4', (YT.oturumBasliklari||{}).tur);

    // ⚠ ceil, floor DEGIL. 114/8 = 14.25 -> 15 parca. floor olsaydi 14
    // parca cikardi ve son 2 MB HIC gitmezdi.
    bak('★ parca sayisi ceil(boyut/parca) = 15', YT.parcalar.length === 15, YT.parcalar.length);
    bak('ilk parca 0\'dan basliyor',
        YT.parcalar[0] && YT.parcalar[0].aralik === 'bytes 0-' + (PARCA-1) + '/' + TOPLAM,
        YT.parcalar[0] && YT.parcalar[0].aralik);
    const ytSon = YT.parcalar[YT.parcalar.length - 1];
    bak('★ son parca dosyanin SONUNA kadar gidiyor',
        ytSon && ytSon.aralik === 'bytes ' + (14*PARCA) + '-' + (TOPLAM-1) + '/' + TOPLAM,
        ytSon && ytSon.aralik);
    bak('★ ara parcalarin hepsi 256 KB\'in kati', (()=>{
      for(let i = 0; i < YT.parcalar.length - 1; i++){
        if(Number(YT.parcalar[i].uzunluk) % 262144 !== 0) return false;
      }
      return true;
    })(), YT.parcalar.map(p=>p.uzunluk).join(','));
    bak('parcalar bitisik ve bosluksuz', (()=>{
      let bekle = 0;
      for(const p of YT.parcalar){
        const m = /^bytes (\d+)-(\d+)\//.exec(p.aralik || '');
        if(!m || Number(m[1]) !== bekle) return false;
        bekle = Number(m[2]) + 1;
      }
      return bekle === TOPLAM;
    })(), YT.parcalar.length + ' parca');

    // ---- ustveri ----
    const sn = (YT.ustveri || {}).snippet || {};
    const st = (YT.ustveri || {}).status || {};
    bak('baslik content.videoTitle\'dan geliyor',
        sn.title === 'Aizanoi: Zeus Tapınağının Altındaki Tünel', sn.title);
    bak('aciklama alt yazi + etiketler', /arkeoloji/.test(sn.description || '')
        && /tapınağın altında/.test(sn.description || ''), (sn.description||'').slice(0,80));
    // ⚠ tags dizisinde '#' YOK -- YouTube onu etiketin parcasi sayiyor
    // ve "#arkeoloji" diye bir etiket olusturuyor.
    bak('★ tags dizisinde # YOK', Array.isArray(sn.tags)
        && sn.tags.join(',') === 'arkeoloji,aizanoi', JSON.stringify(sn.tags));
    // ...ama ACIKLAMADA var: Shorts'ta kesfi ilk uc etiket tasiyor.
    bak('★ aciklamada # DURUYOR', /#arkeoloji/.test(sn.description || ''), sn.description);
    bak('★ categoryId 27 (Egitim) -- kanalin bolumu', sn.categoryId === '27', sn.categoryId);
    bak('★ gorunurluk private (varsayilan)', st.privacyStatus === 'private', st.privacyStatus);
    // ⛔ private iken publishAt YAZILMAMALI: zamanlama YouTube'da
    // "herkese aciga cevir" demek ve private kalmasini istedigimiz bir
    // videoda anlamsiz.
    bak('★ private iken publishAt YOK', st.publishAt === undefined, String(st.publishAt));
    bak('cocuklara yonelik beyani acikca false',
        st.selfDeclaredMadeForKids === false, String(st.selfDeclaredMadeForKids));

    bak('kayit tamamlandi', satirlar[0].publish_state === 'published',
        satirlar[0].publish_state + ' / ' + satirlar[0].last_error);
    bak('video kimligi kayda yazildi', satirlar[0].external_id === 'ytv_1', satirlar[0].external_id);
    bak('basarida iz temizlendi',
        satirlar[0].publish_ref === null && satirlar[0].publish_called_at === null);
    bak('⛔ uploaded\'a DOKUNULMADI', satirlar[0].uploaded === false);
  }
  {
    // ⛔ EN ONEMLI OLCUM: DENETIM KAPISI.
    // Denetimden gecmemis projeden yuklenen video KALICI olarak ozel
    // kaliyor. Yani kapi acik kalirsa kullanicinin gercek videolari
    // geri alinamaz sekilde gomulur.
    const onceki = ORTAM.YOUTUBE_DENETIM_GECTI;
    ORTAM.YOUTUBE_DENETIM_GECTI = '';
    tabloyuKur(ytKayit()); metaKur(); ytKur();
    await turAt();
    bak('★ denetim onaylanmadan GERCEK kayit YUKLENMIYOR',
        YT.parcalar.length === 0 && !YT.ustveri, YT.parcalar.length);
    bak('★ hata degil ERTELEME (kayit bekliyor)',
        satirlar[0].publish_state === 'pending', satirlar[0].publish_state);
    bak('deneme hakki geri verildi', satirlar[0].attempt_count === 0, String(satirlar[0].attempt_count));
    bak('sebep "kalici ozel" tehlikesini yaziyor',
        /özel/.test(String(satirlar[0].last_error || '')), satirlar[0].last_error);

    // ⛔ KACIS DELIGI KAPATILDI (30 Eylul 2026).
    // Onceden content.youtubeDeneme=true olan kayit kapiyi GECIYORDU.
    // Delik kapandi: artik o bayrak hicbir sey yapmiyor. Bu olcum
    // deligin geri acilmasini engelliyor -- birisi kapiyi "kolaylik
    // olsun" diye gevsetirse burada kirmizi yanar.
    tabloyuKur(ytKayit({ content: Object.assign({}, ytKayit().content, { youtubeDeneme:true }) }));
    metaKur(); ytKur();
    await turAt();
    bak('★ content.youtubeDeneme=true kapiyi ARTIK ACMIYOR: hic yuklenmedi',
        YT.parcalar.length === 0 && !YT.ustveri, YT.parcalar.length);
    bak('★ bayrakli kayit da ERTELENDI, yayinlanmadi',
        satirlar[0].publish_state === 'pending', satirlar[0].publish_state);

    // Kapinin TEK anahtari ortam degiskeni: tanimlandiginda aciliyor.
    // Bu olcum olmasa "hicbir sey yuklenmiyor" olcumu, kapi kalici
    // olarak bozulsa bile yesil kalirdi.
    ORTAM.YOUTUBE_DENETIM_GECTI = '1';
    tabloyuKur(ytKayit()); metaKur(); ytKur();
    await turAt();
    bak('★ YOUTUBE_DENETIM_GECTI tanimliyken YUKLENIYOR (kapi kalici bozuk degil)',
        satirlar[0].publish_state === 'published' && YT.parcalar.length === 15,
        satirlar[0].publish_state + ' / ' + YT.parcalar.length);
    ORTAM.YOUTUBE_DENETIM_GECTI = onceki;
  }
  {
    // ⛔ IKINCI EN ONEMLI OLCUM: TUR/PLATFORM UYUMU.
    // shorts kaydi Instagram'a dusmusse, worker'in eski hali onu
    // Instagram'a STORY olarak yayinlardi: 24 saatte kaybolan, hicbir
    // yerde hata vermeyen bir yayin.
    tabloyuKur(ytKayit({ platform:'instagram' })); metaKur(); ytKur();
    await turAt();
    bak('★ shorts kaydi Instagram\'a YAYINLANMIYOR',
        cagrilar.media === 0 && cagrilar.publish === 0,
        'media=' + cagrilar.media + ' publish=' + cagrilar.publish);
    bak('★ hata degil ERTELEME', satirlar[0].publish_state === 'pending', satirlar[0].publish_state);
    bak('sebep hangi platformlarin gecerli oldugunu soyluyor',
        /youtube/.test(String(satirlar[0].last_error || '')), satirlar[0].last_error);
    bak('deneme hakki geri verildi', satirlar[0].attempt_count === 0, String(satirlar[0].attempt_count));
  }
  {
    // ⚠ GERILEME: reels kaydi YouTube'a da yayinlanmiyor. Ters yon de
    // olculmeli, yoksa kontrol "yalnizca shorts'u durduruyor" olurdu.
    tabloyuKur(reelKayit({ platform:'youtube' })); metaKur(); ytKur();
    await turAt();
    bak('★ reels kaydi YouTube\'a YUKLENMIYOR',
        YT.parcalar.length === 0 && satirlar[0].publish_state === 'pending',
        satirlar[0].publish_state + ' / ' + YT.parcalar.length);
  }
  {
    // ⚠ GERILEME: story/reels yollari BOZULMADI. Tur tablosu eklendi;
    // eklerken instagram'i kumeden dusurmek sessizce her seyi durdururdu.
    tabloyuKur(); metaKur(); ytKur();
    await turAt();
    bak('★ story hala Instagram\'a yayinlaniyor (tur tablosu bozmadi)',
        satirlar[0].publish_state === 'published', satirlar[0].publish_state);
  }
  {
    // Hesap bagli degilse: HATA DEGIL ERTELEME.
    tabloyuKur(ytKayit()); metaKur(); ytKur({ hesap: null });
    await turAt();
    bak('★ hesap bagli degilse kayit ERTELENIYOR (hata degil)',
        satirlar[0].publish_state === 'pending', satirlar[0].publish_state);
    bak('ertelemede youtube.html adresi soyleniyor',
        /youtube\.html/.test(String(satirlar[0].last_error || '')), satirlar[0].last_error);
    bak('hic yukleme denenmedi', YT.parcalar.length === 0, YT.parcalar.length);
  }
  {
    // Jeton yenileme. Google'da erisim jetonu BIR SAAT yasiyor, yani
    // bu yol neredeyse her yuklemede calisiyor.
    tabloyuKur(ytKayit()); metaKur(); ytKur();
    YT.hesap.erisim_bitis = new Date(Date.now() - 1000).toISOString();
    await turAt();
    bak('★ suresi dolmus jeton yenileniyor', YT.yenilemeCalisti === 1, YT.yenilemeCalisti);
    bak('yenilenen jetonla yukleme yapiliyor',
        YT.jetonlar.some(j=> String(j).indexOf('ytok_yeni') > -1), YT.jetonlar.join('|'));
    bak('yeni erisim suresi bir saat', (()=>{
      const y = YT.hesapYazmalari.find(x=> x.erisim_jetonu === 'ytok_yeni');
      if(!y) return false;
      const fark = Date.parse(y.erisim_bitis) - Date.now();
      return fark > 3500e3 && fark <= 3600e3;
    })(), JSON.stringify(YT.hesapYazmalari[0] || {}));
    // ⚠ GOOGLE YENILEMEDE refresh_token DONDURMUYOR, sahtesi de
    // dondurmuyor -- yani bu olcum `?? eski deger` dalini sinamis
    // oluyor. Bu dal bozulursa alan 'undefined' dizgesi olur ve hesap
    // BUGUN calisir, BIR SAAT SONRA olur: gorunmez bir kayip.
    bak('★ yenileme jetonu SILINMEDI/bozulmadi',
        YT.hesap.yenileme_jetonu === 'ytyen_1', YT.hesap.yenileme_jetonu);
    bak('yenileme sonrasi kayit tamamlandi',
        satirlar[0].publish_state === 'published', satirlar[0].publish_state);
  }
  {
    // Yenileme reddedildi (invalid_grant): izin ekrani Testing'e
    // alinmissa Google jetonlari yedi gunde iptal ediyor (sql/52).
    tabloyuKur(ytKayit()); metaKur(); ytKur({ yenilemeHatasi: 400 });
    YT.hesap.erisim_bitis = new Date(Date.now() - 1000).toISOString();
    await turAt();
    bak('★ jeton yenilenemezse ERTELEME', satirlar[0].publish_state === 'pending',
        satirlar[0].publish_state);
    bak('★ sebep HESAP SATIRINA da yaziliyor (kullanici ekranda gorsun)',
        YT.hesapYazmalari.some(y=> /invalid_grant/.test(String(y.son_hata || ''))),
        JSON.stringify(YT.hesapYazmalari));
  }
  {
    // ARA parca 308 yerine 200 dondurse: bizim hesabimiz bozuk demektir.
    // Sessiz gecmek, dosyanin yarisini yukleyip "yayinlandi" demek olurdu.
    tabloyuKur(ytKayit()); metaKur(); ytKur({ araParcaKodu: 200 });
    await turAt();
    bak('★ ara parcada beklenmeyen 200 HATA sayiliyor',
        satirlar[0].publish_state !== 'published', satirlar[0].publish_state);
    bak('yalnizca ilk parca gonderildi, gerisi denenmedi',
        YT.parcalar.length === 1, YT.parcalar.length);
  }
  {
    // COKUS IZI: son parcadan ONCE isaretlenmis olmali, yoksa
    // "cagri yapildi mi" sorusuna yanlis cevap verilir.
    tabloyuKur(ytKayit()); metaKur(); ytKur({ parcaHatasi: 500 });
    await turAt();
    bak('★ son parca yukleme cagrisi ISARETLENDI (cokus izi)',
        !!satirlar[0].publish_called_at, String(satirlar[0].publish_called_at));
    bak('oturum adresi publish_ref\'te duruyor',
        String(satirlar[0].publish_ref || '').indexOf('yt-oturum.test') > -1,
        satirlar[0].publish_ref);
  }
  {
    // COKUS KURTARMASI: iz + cagri var, sonuc bilinmiyor. Oturum
    // adresine sorulup kimlik bulunuyor -- IKINCI YUKLEME YAPILMIYOR.
    tabloyuKur(ytKayit({ publish_ref:'https://yt-oturum.test/sess-1',
                         publish_ref_at: su(), publish_called_at: su() }));
    metaKur(); ytKur({ videoId:'ytv_kurtarilan' });
    await turAt();
    bak('★ durum SORULDU (bytes */toplam)',
        YT.durumSorgulari.length === 1 && /^bytes \*\/119537664$/.test(YT.durumSorgulari[0]),
        YT.durumSorgulari.join('|'));
    bak('★ CIFT YUKLEME YAPILMADI', YT.parcalar.length === 0, YT.parcalar.length);
    bak('kurtarilan kimlik kayda yazildi',
        satirlar[0].external_id === 'ytv_kurtarilan', satirlar[0].external_id);
    bak('kayit yayinlandi sayildi', satirlar[0].publish_state === 'published',
        satirlar[0].publish_state);
  }
  {
    // Oturum 308 dediyse yukleme BITMEMIS: hicbir video olusmadi,
    // bastan yuklenebilir.
    tabloyuKur(ytKayit({ publish_ref:'https://yt-oturum.test/sess-1',
                         publish_ref_at: su(), publish_called_at: su() }));
    metaKur(); ytKur({ durumKodu: 308 });
    await turAt();
    bak('★ 308 (yarim) ise BASTAN yukleniyor', YT.parcalar.length === 15, YT.parcalar.length);
    bak('bastan yuklemede kayit tamamlaniyor',
        satirlar[0].publish_state === 'published', satirlar[0].publish_state);
  }
  {
    // Oturum sorusu cevapsiz kaldi: BILMIYORUZ. Yuklemek cift video
    // demek olabilir -- beklemek daha iyi.
    tabloyuKur(ytKayit({ publish_ref:'https://yt-oturum.test/sess-1',
                         publish_ref_at: su(), publish_called_at: su() }));
    metaKur(); ytKur({ durumKodu: 500 });
    await turAt();
    bak('★ sonuc bilinmiyorsa YUKLENMIYOR, erteleniyor',
        YT.parcalar.length === 0 && satirlar[0].publish_state === 'pending',
        satirlar[0].publish_state + ' / ' + YT.parcalar.length);
  }
  {
    // Baslik bos: YouTube zorunlu tutuyor ve reddi yukleme BITTIKTEN
    // sonra donuyor. KALICI hata -- tekrar denemek ise yaramaz.
    tabloyuKur(ytKayit({ title:'', content:{ timezone:'Europe/Istanbul' } }));
    metaKur(); ytKur();
    await turAt();
    bak('★ basliksiz kayit yuklenmeden KALICI hata',
        satirlar[0].publish_state === 'failed' && YT.parcalar.length === 0,
        satirlar[0].publish_state + ' / ' + YT.parcalar.length);
    bak('hata hangi alani doldurmasi gerektigini soyluyor',
        /başlı[kğ]/i.test(String(satirlar[0].last_error || '')), satirlar[0].last_error);
  }
  {
    // Baslikta '<' veya '>': YouTube reddediyor (invalidVideoMetadata).
    tabloyuKur(ytKayit({ content:{ timezone:'Europe/Istanbul',
                                   videoTitle:'Aizanoi <b>tapinak</b>' } }));
    metaKur(); ytKur();
    await turAt();
    bak('★ baslikta < > atiliyor',
        ((YT.ustveri||{}).snippet||{}).title === 'Aizanoi btapinak/b',
        ((YT.ustveri||{}).snippet||{}).title);
  }
  {
    // Fotograf: Shorts video olmak zorunda.
    tabloyuKur(ytKayit({ media_mime:'image/jpeg' })); metaKur(); ytKur();
    await turAt();
    bak('★ fotograf kaydi KALICI hata, oturum bile acilmiyor',
        satirlar[0].publish_state === 'failed' && !YT.ustveri, satirlar[0].publish_state);
  }
  {
    // Gorunurluk elle acildiysa ustveriye o geciyor.
    const onceki = ORTAM.YOUTUBE_GORUNURLUK;
    ORTAM.YOUTUBE_GORUNURLUK = 'public';
    tabloyuKur(ytKayit()); metaKur(); ytKur();
    await turAt();
    bak('YOUTUBE_GORUNURLUK ustveriye geciyor',
        (((YT.ustveri||{}).status)||{}).privacyStatus === 'public',
        (((YT.ustveri||{}).status)||{}).privacyStatus);
    ORTAM.YOUTUBE_GORUNURLUK = onceki;
  }
  {
    // Butce yuklemenin ORTASINDA doluyor. Olculen sey: kayit
    // 'in_progress' ASILI KALMIYOR ve sebebi satirda yaziyor.
    // (Butce cagri aninda okunuyor, o yuzden ORTAM'dan degistirilebiliyor.)
    const onceki = ORTAM.STORY_BUTCE_MS;
    // Tur dongusu kaydi ALMAYA yetecek kadar (bitis - 15sn gecilmemis),
    // ama 15 parcayi bitirmeye yetmeyecek kadar butce.
    ORTAM.STORY_BUTCE_MS = '20000';
    tabloyuKur(ytKayit()); metaKur();
    // Her parca 3 saniye: 10 saniyelik pay dorduncu parcada asiliyor.
    ytKur({ parcaGecikmesiMs: 3000 });
    await turAt();
    bak('★ butce ortada dolunca kayit ASILI KALMIYOR',
        satirlar[0].publish_state === 'pending', satirlar[0].publish_state);
    bak('★ sebep hangi parcada kaldigini ve dosya boyutunu soyluyor',
        /parçada doldu/.test(String(satirlar[0].last_error || ''))
        && /114 MB/.test(String(satirlar[0].last_error || '')), satirlar[0].last_error);
    bak('yayin cagrisi izi YAZILMADI (yanlis kurtarma olmasin)',
        !satirlar[0].publish_called_at, String(satirlar[0].publish_called_at));
    ORTAM.STORY_BUTCE_MS = onceki;
  }
  {
    // ══════════════════════════════════════════════════════════════
    // ASILI KALAN KAYIT: HER TUR ICIN
    // ══════════════════════════════════════════════════════════════
    // 29 Eylul 2026'da bulundu: story_asili_topla YALNIZCA
    // type='story' suzuyordu. sql/50 reels'i ekledi, sql/53 shorts'u
    // ekledi, ikisi de bu islevi unuttu.
    //
    // Sonucu: yayin ortasinda SERT bir cokuse denk gelen bir reels ya
    // da shorts kaydi SONSUZA KADAR 'in_progress' kaliyordu. Ne yayin,
    // ne hata, ne kuyruk, ne de bir yerde goruntu. Kullanici yalnizca
    // "yayin cikmadi" diyebilirdi.
    //
    // ⚠ EN KOTU ANDA VURURDU: YouTube yuklemesi sistemdeki en uzun
    // suren is, yani sert cokuse en acik olan o.
    for(const durum of [{ tur:'story', kur:()=> ({}) },
                        { tur:'reels', kur:()=> reelKayit({}) },
                        { tur:'shorts', kur:()=> ytKayit({}) }]){
      const ek = Object.assign(durum.kur(), {
        publish_state:'in_progress', attempt_count:1,
        // On bir dakika once dokunulmus: asili esigi (10 dk) asildi.
        updated_at: new Date(SAAT - dk(11)).toISOString()
      });
      tabloyuKur(ek); metaKur(); ttKur(); ytKur();
      await turAt();
      bak('★ asili kalan ' + durum.tur + ' kaydi kuyruga GERI ALINIYOR',
          satirlar[0].publish_state !== 'in_progress',
          durum.tur + ' -> ' + satirlar[0].publish_state);
    }
  }
  console.log('[dosya henuz hazir degil]');
  {
    // sql/56'dan beri "dosya yok" ileri tarihli bir kayit icin NORMAL:
    // kaydi bugun girip dosyayi yarin atabiliyorsun. Eskisi gibi kalici
    // hata yazmak o kaydi YAKARDI -- dosya sonradan gelse bile bir daha
    // denenmezdi.
    tabloyuKur(ytKayit({ media_url:null,
                         publish_at: new Date(Date.now() + 3 * 3600e3).toISOString() }));
    metaKur(); ttKur(); ytKur();
    await turAt();
    // sql/56: kayit KUYRUGA HIC GIRMIYOR. Girseydi her turda bir yer
    // isgal eder ve hazir olan kayitlari geciktirirdi.
    bak('★ ileri tarihli + dosyasiz kayit KUYRUGA GIRMIYOR',
        satirlar[0].publish_state === 'pending' && satirlar[0].attempt_count === 0,
        satirlar[0].publish_state + ' / ' + satirlar[0].attempt_count);
    bak('dokunulmadigi icin hata da yazilmiyor',
        !satirlar[0].last_error, String(satirlar[0].last_error));
    bak('hic yukleme denenmedi', YT.parcalar.length === 0, YT.parcalar.length);

    // ⚠ WORKER'IN KENDI KORUMASI: SQL henuz calistirilmamissa (dagitim
    // sirasi ters gittiyse) kayit worker'a ULASIR. O zaman da
    // YAKILMAMALI -- eskisi gibi kalici hata yazsaydi, dosyayi sonradan
    // atsan bile kayit bir daha denenmezdi.
    sql56Suzgeci = false;
    tabloyuKur(ytKayit({ media_url:null,
                         publish_at: new Date(Date.now() + 3 * 3600e3).toISOString() }));
    metaKur(); ttKur(); ytKur();
    await turAt();
    bak('★ SQL eskiyse bile worker kaydi YAKMIYOR (erteliyor)',
        satirlar[0].publish_state === 'pending', satirlar[0].publish_state);
    bak('deneme hakki geri verildi', satirlar[0].attempt_count === 0,
        String(satirlar[0].attempt_count));
    bak('sebep yukleyiciyi calistirmayi soyluyor',
        /yükleyici/i.test(String(satirlar[0].last_error || '')), satirlar[0].last_error);
    sql56Suzgeci = true;

    // ...ama YAYIN SAATI GECTIYSE son sans: kalici hata + e-posta.
    tabloyuKur(ytKayit({ media_url:null,
                         publish_at: new Date(Date.now() - 3600e3).toISOString() }));
    metaKur(); ttKur(); ytKur(); epostalar = [];
    await turAt();
    bak('★ vakti gecmis + dosyasiz kayit KALICI hata (sessiz kalmiyor)',
        satirlar[0].publish_state === 'failed', satirlar[0].publish_state);
    bak('kalici hatada e-posta gitti', epostalar.length === 1, String(epostalar.length));
  }
  {
    // ⚠ GERILEME: story/reels de ayni sekilde korunuyor. Onlarda kuyruk
    // zaten yayin saatinde veriyor, yani bu dal yalnizca dagitim sirasi
    // ters gittiginde devreye girer -- ama girmeli.
    tabloyuKur({ media_url:null,
                 publish_at: new Date(Date.now() - 3600e3).toISOString() });
    metaKur(); ttKur(); ytKur();
    await turAt();
    bak('story dosyasiz ve vakti gecmis -> KALICI hata (eskisi gibi)',
        satirlar[0].publish_state === 'failed', satirlar[0].publish_state);
  }

  console.log('[yukleme ani · erken yukleme YALNIZCA YouTube]');
  {
    // ⛔ BU OLCUM sql/55'IN HAYATI TARAFI.
    // Instagram, Facebook ve TikTok'ta zamanlama YOK: yukledigin an
    // yayinlaniyor. Onlari erken almak, story'yi ALTI SAAT ERKEN
    // YAYINLAMAK demek -- 24 saatlik bir story icin gunun yanlis
    // yarisinda yayin demek. Pay bu yuzden ture VE platforma bagli.
    const ileri = ()=> new Date(Date.now() + 3 * 3600e3).toISOString();  // 3 saat sonra

    tabloyuKur({ publish_at: ileri() }); metaKur(); ttKur(); ytKur();
    await turAt();
    bak('⛔ story 3 saat once ALINMIYOR (erken yayin olurdu)',
        satirlar[0].publish_state === 'pending' && cagrilar.media === 0,
        satirlar[0].publish_state + ' / media=' + cagrilar.media);

    tabloyuKur(reelKayit({ publish_at: ileri() })); metaKur(); ttKur(); ytKur();
    await turAt();
    bak('⛔ reels 3 saat once ALINMIYOR',
        satirlar[0].publish_state === 'pending' && cagrilar.media === 0,
        satirlar[0].publish_state);

    tabloyuKur(reelKayit({ platform:'tiktok', publish_at: ileri() }));
    metaKur(); ttKur(); ytKur();
    await turAt();
    bak('⛔ tiktok 3 saat once ALINMIYOR (taslak erken duserdi)',
        satirlar[0].publish_state === 'pending' && TT.parcalar.length === 0,
        satirlar[0].publish_state);

    // ...ve YouTube ALINIYOR: alti saatlik pencerenin icinde.
    tabloyuKur(ytKayit({ publish_at: ileri() })); metaKur(); ttKur(); ytKur();
    await turAt();
    bak('★ YouTube 3 saat once ALINIYOR (onden yukleme penceresi)',
        satirlar[0].publish_state === 'published' && YT.parcalar.length === 15,
        satirlar[0].publish_state + ' / ' + YT.parcalar.length);

    // sql/56: YouTube icin PENCERE YOK -- dosya hazirsa ne kadar ileri
    // tarihli olursa olsun yukleniyor. sql/55'te alti saatlik bir
    // pencere vardi; kullanici videolari haftalar oncesinden
    // hazirladigi icin o pencere ihtiyaci karsilamiyordu.
    tabloyuKur(ytKayit({ publish_at: new Date(Date.now() + 30 * 864e5).toISOString() }));
    metaKur(); ttKur(); ytKur();
    await turAt();
    bak('★ YouTube 30 GUN once bile ALINIYOR (hazir olunca yukle)',
        satirlar[0].publish_state === 'published' && YT.parcalar.length === 15,
        satirlar[0].publish_state + ' / ' + YT.parcalar.length);
  }

  console.log('[youtube · gorunurluk ve zamanlama]');
  {
    // ⛔ EN SESSIZ TUZAK: publishAt, privacyStatus 'private' DEGILSE
    // YOK SAYILIYOR -- ve YouTube HATA VERMIYOR. Yani "zamanladim"
    // sanip public gonderirsen video zamanlanmaz, yuklendigi an
    // herkese acik cikar. Hicbir yerde uyari yok.
    //
    // Bu yuzden asagidaki olcum ikisini BIRLIKTE sinuyor: publishAt
    // yazan her cevapta privacyStatus 'private' olmak zorunda.
    const onceki = ORTAM.YOUTUBE_GORUNURLUK;
    ORTAM.YOUTUBE_GORUNURLUK = 'public';

    // Yayin ani GELECEKTE: zamanlanmali.
    const ileri = new Date(Date.now() + 6 * 3600e3).toISOString();
    tabloyuKur(ytKayit({ publish_at: ileri })); metaKur(); ytKur();
    await turAt();
    const st1 = ((YT.ustveri || {}).status) || {};
    bak('★ ileri tarihli kayit ZAMANLANIYOR (publishAt var)',
        st1.publishAt === ileri, String(st1.publishAt) + ' / ' + ileri);
    bak('⛔ publishAt varken privacyStatus PRIVATE (yoksa sessizce yok sayilir)',
        st1.privacyStatus === 'private', st1.privacyStatus);

    // Yayin ani GECMISTE: zamanlanacak bir sey yok, dogrudan yayin.
    const geri = new Date(Date.now() - 3600e3).toISOString();
    tabloyuKur(ytKayit({ publish_at: geri })); metaKur(); ytKur();
    await turAt();
    const st2 = ((YT.ustveri || {}).status) || {};
    bak('★ gecmis tarihli kayitta publishAt YOK (gecmis publishAt reddedilir)',
        st2.publishAt === undefined, String(st2.publishAt));
    bak('gecmis tarihlide gorunurluk dogrudan public', st2.privacyStatus === 'public',
        st2.privacyStatus);

    // Yayin anina SANIYELER kala: bir dakikalik pay yuzunden
    // zamanlanmamali -- istek Google'a vardiginda o an gecmis olabilir.
    const nerdeyse = new Date(Date.now() + 20e3).toISOString();
    tabloyuKur(ytKayit({ publish_at: nerdeyse })); metaKur(); ytKur();
    await turAt();
    const st3 = ((YT.ustveri || {}).status) || {};
    bak('★ yayin anina saniyeler kala publishAt YAZILMIYOR (bir dakikalik pay)',
        st3.publishAt === undefined, String(st3.publishAt));

    ORTAM.YOUTUBE_GORUNURLUK = onceki;
  }
  {
    // ⚠ GERILEME: gorunurluk 'unlisted' ise zamanlama YOK. YouTube'da
    // zamanlama yalnizca "herkese aciga cevir" demek; unlisted bir
    // videoyu zamanlamak diye bir sey yok ve publishAt gondermek
    // videoyu beklenmedik sekilde HERKESE ACIK yapardi.
    const onceki = ORTAM.YOUTUBE_GORUNURLUK;
    ORTAM.YOUTUBE_GORUNURLUK = 'unlisted';
    tabloyuKur(ytKayit({ publish_at: new Date(Date.now() + 6 * 3600e3).toISOString() }));
    metaKur(); ytKur();
    await turAt();
    const st = ((YT.ustveri || {}).status) || {};
    bak('★ unlisted iken publishAt YOK', st.publishAt === undefined, String(st.publishAt));
    bak('unlisted oldugu gibi gidiyor', st.privacyStatus === 'unlisted', st.privacyStatus);
    ORTAM.YOUTUBE_GORUNURLUK = onceki;
  }
  {
    // Kategori ayardan okunuyor mu?
    const onceki = ORTAM.YOUTUBE_KATEGORI;
    ORTAM.YOUTUBE_KATEGORI = '24';
    tabloyuKur(ytKayit()); metaKur(); ytKur();
    await turAt();
    bak('YOUTUBE_KATEGORI ayari ustveriye geciyor',
        (((YT.ustveri||{}).snippet)||{}).categoryId === '24',
        (((YT.ustveri||{}).snippet)||{}).categoryId);
    ORTAM.YOUTUBE_KATEGORI = onceki;
    // Kayit bazinda ezme ayardan da guclu olmali.
    tabloyuKur(ytKayit({ content: Object.assign({}, ytKayit().content,
                          { youtubeCategory: '10' }) }));
    metaKur(); ytKur();
    await turAt();
    bak('★ kayit bazinda youtubeCategory ayari EZIYOR',
        (((YT.ustveri||{}).snippet)||{}).categoryId === '10',
        (((YT.ustveri||{}).snippet)||{}).categoryId);
  }

  console.log('[youtube · hata triyaji]');
  {
    // ⛔ KOTA. YouTube gunde ~6 yukleme veriyor (videos.insert 1600
    // birim, gunluk kota 10.000). Kotayi "gecici hata" saymak, yedinci
    // kaydi uc denemede yakip BASARISIZ isaretlemek demek -- oysa
    // yapilacak tek sey yarini beklemek.
    tabloyuKur(ytKayit()); metaKur();
    ytKur({ oturumHatasi: 403, hataSebebi:'quotaExceeded' });
    await turAt();
    bak('★ kota hatasi ERTELEME (failed DEGIL)',
        satirlar[0].publish_state === 'pending', satirlar[0].publish_state);
    bak('★ kota hatasinda deneme hakki geri verildi',
        satirlar[0].attempt_count === 0, String(satirlar[0].attempt_count));
    bak('sebep gunluk kotayi soyluyor',
        /kota/i.test(String(satirlar[0].last_error || '')), satirlar[0].last_error);
    bak('kotada hic parca gonderilmedi', YT.parcalar.length === 0, YT.parcalar.length);
  }
  {
    // Ustveri reddi KALICI: tekrar denemek ayni sonucu verir ve her
    // deneme 114 MB'i bosa gonderir.
    tabloyuKur(ytKayit()); metaKur();
    ytKur({ parcaHatasi: 400, hataSebebi:'invalidVideoMetadata' });
    await turAt();
    bak('★ ustveri reddi KALICI hata (uc kez denenmiyor)',
        satirlar[0].publish_state === 'failed', satirlar[0].publish_state);
    bak('hatada Google\'in sebebi yaziyor',
        /invalidVideoMetadata/.test(String(satirlar[0].last_error || '')), satirlar[0].last_error);
  }
  {
    // 5xx GECICI: Google'in kendi sunucusu. Tekrar denenmeli.
    tabloyuKur(ytKayit()); metaKur();
    ytKur({ oturumHatasi: 503, hataSebebi:'backendError' });
    await turAt();
    bak('★ 5xx GECICI hata (tekrar denenecek)',
        satirlar[0].publish_state === 'pending' && satirlar[0].attempt_count === 1,
        satirlar[0].publish_state + ' / ' + satirlar[0].attempt_count);
  }
  {
    // Sebep dizgesi OLMASA da 4xx kalici sayiliyor: bilinmeyen bir
    // 4xx'i uc kez denemek dosyayi uc kez bosa gondermek demek.
    tabloyuKur(ytKayit()); metaKur();
    ytKur({ oturumHatasi: 401, hataSebebi:'' });
    await turAt();
    bak('sebepsiz 4xx de KALICI', satirlar[0].publish_state === 'failed',
        satirlar[0].publish_state);
  }

  {
    // Bildirim dili: Short kalici, "24 saatlik" telasi olmamali.
    tabloyuKur(ytKayit({ media_url:null })); metaKur(); ytKur();
    await turAt();
    const e = epostalar[0] || {};
    bak('konu "Short yayınlanamadı" diyor', /Short yayınlanamadı/.test(e.subject || ''), e.subject);
    bak('★ "24 saatlik" telası YOK (Short kalıcı)',
        !/24 saatlik/.test(e.text || ''), (e.text || '').slice(0, 120));
    bak('türü Shorts yazıyor', /Tür\s*:\s*Shorts/.test(e.text || ''), (e.text || '').slice(0, 200));
    bak('★ platformu YouTube yazıyor (kod adı değil)',
        /Platform\s*:\s*YouTube/.test(e.text || ''), (e.text || '').slice(0, 220));
  }

  console.log('[reels · bildirim dili]');
  {
    tabloyuKur(reelKayit({ media_url:null })); metaKur();
    await turAt();
    // Resend govdesi: { from, to, subject, text }
    const e = epostalar[0] || {};
    bak('konu "Reel yayınlanamadı" diyor', /Reel yayınlanamadı/.test(e.subject || ''), e.subject);
    bak('★ "24 saatlik" telaşı YOK (reel kalıcı)',
      !/24 saatlik/.test(e.text || ''), (e.text || '').slice(0, 120));
    bak('türü yazıyor', /Tür\s*:\s*Reels/.test(e.text || ''), (e.text || '').slice(0, 160));
  }

  {
    // ⚠ GERILEME: story bildirimi eskisi gibi acele ettiriyor.
    tabloyuKur({ media_url:null }); metaKur();
    await turAt();
    const e = epostalar[0] || {};
    bak('story bildiriminde "Story yayınlanamadı"', /Story yayınlanamadı/.test(e.subject || ''), e.subject);
    bak('story bildiriminde 24 saat uyarısı DURUYOR',
      /24 saatlik/.test(e.text || ''), (e.text || '').slice(0, 160));
  }

  Date.now = gercekNow;
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})().catch(e=>{ Date.now = gercekNow; console.error(e); process.exit(1); });
