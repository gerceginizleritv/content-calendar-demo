// pushChanges'i app.html'den birebir cikarip stub'larla kosuyoruz.
const fs = require('fs');
const { KOK: DEPO } = require('./araclar');
const src = fs.readFileSync(DEPO + '/app.html','utf8');
// ⚠ IMZA PARAMETRE ALABILIR. Kalip once `pushChanges()` diye sabitti;
// fonksiyon `pushChanges(derinlik)` olunca test 'pushChanges bulunamadi'
// diye PATLIYORDU -- ve bu, gecelik turda aylarca kirmizi kaldi.
// Parametre listesi artik serbest.
const m = src.match(/async function pushChanges\([^)]*\)\s*\{[\s\S]*?\n\}/);
if(!m) throw new Error('pushChanges bulunamadi');

// bulutHataCinsi TAKLIT EDILMIYOR, app.html'den birebir cikariliyor.
// Taklit etseydik "oturum hatasini taniyor mu" sorusunu test degil
// taklit cevaplardi; hatanin cinsini ayiran asil mantik olculmemis
// olurdu. Fonksiyon kendi kendine yetiyor (disaridan hicbir sey
// cagirmiyor), o yuzden boyle cikarilabiliyor.
const mc = src.match(/function bulutHataCinsi\([^)]*\)\s*\{[\s\S]*?\n\}/);
if(!mc) throw new Error('bulutHataCinsi bulunamadi');
const bulutHataCinsi = new Function(mc[0] + '; return bulutHataCinsi;')();

// t(): ceviri. Anahtari aynen donduruyor ki hangi anahtarin secildigi
// olculebilsin -- metnin kendisi bu testin konusu degil.
const t = (k)=> String(k);

// Fonksiyonu verilen cevreyle kuran tek yer. Parametre listesi TEK
// yerde dursun diye: app.html yeni bir sey kullanmaya baslarsa burasi
// degisir, uc ayri cagri degil.
function uret(sb, session, events, dirtyIds, removedIds, toRow, setCloudStatus, kons){
  return new Function('sb','session','events','dirtyIds','removedIds','toRow',
                      'setCloudStatus','console','bulutOkumaBasarisiz',
                      'bulutHataCinsi','t',
    m[0] + '; return pushChanges;')(sb, session, events, dirtyIds, removedIds,
      toRow, setCloudStatus, kons, false, bulutHataCinsi, t);
}

function kur(){
  const durum = { log: [], gecikme: 300 };
  const dirtyIds = new Set(), removedIds = new Set();
  let events = [];
  const sb = { from(){ return {
    upsert(rows){ durum.log.push('upsert:'+rows.map(r=>r.id).join(','));
      return new Promise(r=>setTimeout(()=>r({error:null}), durum.gecikme)); },
    delete(){ return { in(col, ids){ durum.log.push('delete:'+ids.join(','));
      return new Promise(r=>setTimeout(()=>r({error:null}), durum.gecikme)); } }; }
  }; } };
  const session = { user:{ id:'user-1' } };
  const ctx = { sb, session, events, dirtyIds, removedIds,
    toRow:(e,uid)=>({id:e.id,user_id:uid}), setCloudStatus:()=>{},
    console:{error:()=>{}}, setTimeout };
  // Bulut okumasi basarisizken yazma duruyor; testte okuma basarili sayiliyor.
  const fn = uret(sb, session, ctx.events, dirtyIds, removedIds, ctx.toRow,
                  ctx.setCloudStatus, ctx.console);
  return { fn, dirtyIds, removedIds, events: ctx.events, durum };
}

(async ()=>{
  let hata = 0;
  const kontrol = (k,msg)=>{ if(!k){ hata++; console.log('  BASARISIZ: '+msg); } };

  // 1) Yazma SIRASINDA isaretlenen kayit kuyrukta kalmali
  {
    const t = kur();
    t.events.push({id:'AAA'}); t.dirtyIds.add('AAA');
    const sozu = t.fn();
    await new Promise(r=>setTimeout(r,120));
    t.events.push({id:'BBB'}); t.dirtyIds.add('BBB');   // upsert hala surerken
    await sozu;
    kontrol(t.dirtyIds.has('BBB'), 'yazma sirasinda eklenen BBB kuyruktan dusuruldu (VERI KAYBI)');
    kontrol(!t.dirtyIds.has('AAA'), 'gonderilen AAA kuyrukta kaldi');
    kontrol(t.durum.log.join('|')==='upsert:AAA', 'beklenmeyen cagri: '+t.durum.log.join('|'));
    console.log('1) yazma sirasinda eklenen kayit:', t.dirtyIds.has('BBB') ? 'KORUNDU ✓' : 'KAYBOLDU ✗');
  }

  // 2) Ikinci tur, kalan kaydi gondermeli
  {
    const t = kur();
    t.events.push({id:'AAA'},{id:'BBB'});
    t.dirtyIds.add('AAA');
    const s1 = t.fn();
    await new Promise(r=>setTimeout(r,120));
    t.dirtyIds.add('BBB');
    await s1;
    await t.fn();
    kontrol(t.durum.log.join('|')==='upsert:AAA|upsert:BBB', 'ikinci tur BBB gondermedi: '+t.durum.log.join('|'));
    kontrol(t.dirtyIds.size===0, 'iki turdan sonra kuyruk bos degil');
    console.log('2) ikinci tur:', t.durum.log.join(' -> '));
  }

  // 3) Silme sirasinda isaretlenen silme de kalmali
  {
    const t = kur();
    t.removedIds.add('X1');
    const sozu = t.fn();
    await new Promise(r=>setTimeout(r,120));
    t.removedIds.add('X2');
    await sozu;
    kontrol(t.removedIds.has('X2') && !t.removedIds.has('X1'), 'silme kuyrugu yanlis: '+[...t.removedIds]);
    console.log('3) silme kuyrugu:', [...t.removedIds].length===1 && t.removedIds.has('X2') ? 'DOGRU ✓' : 'YANLIS ✗');
  }

  // 4) Hata durumunda kuyruk korunmali (tekrar denenebilsin)
  {
    const t = kur();
    t.events.push({id:'AAA'}); t.dirtyIds.add('AAA');
    t.durum.gecikme = 10;
    // upsert'i hata dondurecek sekilde degistir
    const orij = t.fn;
    const sbHata = { from(){ return { upsert(){ return Promise.resolve({error:{message:'RLS'}}); },
      delete(){ return { in(){ return Promise.resolve({error:null}); } }; } }; } };
    const fn2 = uret(sbHata, {user:{id:'u'}}, t.events, t.dirtyIds, t.removedIds,
      (e,u)=>({id:e.id}), ()=>{}, {error:()=>{}});
    await fn2();
    kontrol(t.dirtyIds.has('AAA'), 'hata sonrasi kayit kuyruktan dustu, bir daha denenmeyecek');
    console.log('4) yazma hatasinda kuyruk:', t.dirtyIds.has('AAA') ? 'KORUNDU ✓' : 'KAYBOLDU ✗');
  }

  // 5) OTURUM HATASINDA TAZELEME. Bu yol testte HIC olculmemisti:
  //    test 'pushChanges bulunamadi' diye patlarken eklenmis.
  //    Onemi kodun kendi yorumunda yazili -- oturum zaman asimina
  //    ugrayinca kullanici her kaydetmede hata aliyor, cikip girmek
  //    de gonderilememis degisikligi KAYBETTIRIYOR.
  {
    const cagri = [];
    let turSayisi = 0;
    const sbOturum = {
      auth: { refreshSession(){ cagri.push('tazele');
                                return Promise.resolve({ error: null }); } },
      from(){ return {
        upsert(rows){ turSayisi++; cagri.push('upsert:'+rows.map(r=>r.id).join(','));
          // Ilk tur oturum hatasi, tazelemeden sonraki tur basarili.
          return Promise.resolve(turSayisi === 1
            ? { error: { status: 401, message: 'JWT expired' } }
            : { error: null }); },
        delete(){ return { in(){ return Promise.resolve({error:null}); } }; }
      }; } };
    const dirty = new Set(['AAA']), removed = new Set();
    const evs = [{id:'AAA'}];
    const fn = uret(sbOturum, {user:{id:'u'}}, evs, dirty, removed,
      (e,u)=>({id:e.id}), ()=>{}, {error:()=>{}});
    await fn();
    kontrol(cagri.filter(x=>x==='tazele').length === 1,
      'oturum hatasinda refreshSession CAGRILMADI: '+cagri.join('|'));
    kontrol(turSayisi === 2, 'tazelemeden sonra tekrar denenmedi: '+turSayisi+' tur');
    kontrol(dirty.size === 0, 'tazeleme sonrasi kayit kuyrukta kaldi (iki kez gonderilir)');
    console.log('5) oturum hatasinda tazeleme:', cagri.join(' -> '));
  }

  // 6) TAZELEME DE BASARISIZSA tekrar DENENMEMELI ve kuyruk KORUNMALI.
  //    Sonsuz dongu ve veri kaybi arasindaki denge burada.
  {
    const cagri = [];
    let turSayisi = 0;
    const sbOturum = {
      auth: { refreshSession(){ cagri.push('tazele');
                                return Promise.resolve({ error: { message: 'no session' } }); } },
      from(){ return {
        upsert(rows){ turSayisi++; cagri.push('upsert');
          return Promise.resolve({ error: { status: 401, message: 'JWT expired' } }); },
        delete(){ return { in(){ return Promise.resolve({error:null}); } }; }
      }; } };
    const dirty = new Set(['AAA']), removed = new Set();
    const fn = uret(sbOturum, {user:{id:'u'}}, [{id:'AAA'}], dirty, removed,
      (e,u)=>({id:e.id}), ()=>{}, {error:()=>{}});
    await fn();
    kontrol(turSayisi === 1, 'tazeleme basarisizken yine de tekrar denendi: '+turSayisi);
    kontrol(dirty.has('AAA'), 'tazeleme basarisizken kayit kuyruktan dustu (VERI KAYBI)');
    console.log('6) tazeleme basarisiz:', cagri.join(' -> '));
  }

  console.log(hata ? `\n${hata} kontrol BASARISIZ` : '\nTum kontroller gecti.');
  process.exit(hata?1:0);
})();
