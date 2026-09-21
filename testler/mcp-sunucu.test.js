// MCP SUNUCUSU — protokol, kimlik, dört araç.
//
// Bu test tarayıcı açmıyor. Edge Function'ın kendisini Node içinde
// yüklüyor: `Deno` nesnesi ve `fetch` sahte, gerisi GERÇEK kod. Yani
// ölçülen şey "index.ts derleniyor mu" değil, "gelen bir MCP isteğine ne
// cevap veriyor".
//
// Sahte olan tek şey PostgREST: bellekte birkaç tablo. Sorgu dizgelerini
// okuyup süzüyor, çünkü süzgeçlerin doğru kurulup kurulmadığı da ölçülmek
// isteniyor -- user_id süzgeci düşerse başka hesabın verisi sızar.
//
// DÖRT TUZAK ölçülüyor:
//
//   1. KİMLİK YOLUN İÇİNDE. claude.ai'da API anahtarı kutusu yok, anahtar
//      adresin parçası. Yol ayrıştırması yanlışsa ya herkes girer ya da
//      kimse giremez.
//
//   2. HESAP AYRIMI. Anahtar hangi hesabınsa yalnız o hesabın verisi
//      görünmeli. Her sorguda user_id süzgeci olmalı.
//
//   3. TEKRAR. Aynı paketi iki kez göndermek kayıtları ÇOĞALTMAMALI.
//      Şemanın kendisi "kayıtların doğal anahtarı yok" diyor, yani koruma
//      buraya konmazsa hiç yok.
//
//   4. SİLME YOK. Kullanıcı kararı. Ne araç listesinde ne de çağrılabilir
//      olarak bir silme ucu bulunmamalı.
const yol = require('path');
const KOK_DIZIN = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

// ---- sahte PostgREST -------------------------------------------------------
const ANAHTAR_A = 'shb_' + 'a'.repeat(32);
const ANAHTAR_B = 'shb_' + 'b'.repeat(32);
const IPTAL     = 'shb_' + 'c'.repeat(32);
const UID_A = 'user-aaaa', UID_B = 'user-bbbb';

const crypto = require('crypto');
const ozetle = (s)=> crypto.createHash('sha256').update(s).digest('hex');

let tablolar, yazilanlar;
function tablolariKur(){
  yazilanlar = [];
  tablolar = {
    api_keys: [
      { id:'k_a', user_id:UID_A, key_hash:ozetle(ANAHTAR_A), scopes:['read','write'], last_used_at:new Date().toISOString(), revoked_at:null },
      { id:'k_b', user_id:UID_B, key_hash:ozetle(ANAHTAR_B), scopes:['read','write'], last_used_at:new Date().toISOString(), revoked_at:null },
      { id:'k_c', user_id:UID_A, key_hash:ozetle(IPTAL),     scopes:['read','write'], last_used_at:null, revoked_at:'2026-01-01T00:00:00Z' }
    ],
    user_prefs: [{ user_id:UID_A, entry_limit:100, project_limit:100, prefs:{ lang:'tr' } }],
    projects: [
      { id:'pr_1', user_id:UID_A, name:'Sokollu Köprüsü', type:'outdoor', deleted_at:null, created_at:'2026-01-01T00:00:00Z', steps:{}, deadlines:{} },
      { id:'pr_2', user_id:UID_A, name:'Kariye', type:'venue', deleted_at:null, created_at:'2026-01-02T00:00:00Z', steps:{}, deadlines:{} },
      { id:'pr_9', user_id:UID_B, name:'Baskasinin projesi', type:'other', deleted_at:null, created_at:'2026-01-01T00:00:00Z', steps:{}, deadlines:{} }
    ],
    places: [],
    calendar_events: [
      { id:'ev_1', user_id:UID_A, project_id:'pr_1', post_date:'2026-10-09', post_time:'19:00:00', type:'video', platform:'youtube',
        title:'Sokollu tanıtım', uploaded:false, deleted_at:null,
        content:{ caption:'Merhaba', videoTitle:'Sokollu Köprüsü', anaDil:'tr',
                  diller:{ en:{ videoTitle:'The Bridge of Sokollu' } }, hesapId:'hs_a', timezone:'Europe/Istanbul' } },
      { id:'ev_2', user_id:UID_A, project_id:'pr_2', post_date:'2026-10-12', post_time:'09:30:00', type:'reels', platform:'instagram',
        title:'Kariye teaser', uploaded:true, deleted_at:null, content:{ caption:'Mozaik' } },
      { id:'ev_3', user_id:UID_A, project_id:null, post_date:'2026-11-20', post_time:null, type:'shorts', platform:'youtube',
        title:'Uzaktaki', uploaded:false, deleted_at:null, content:{} },
      { id:'ev_sil', user_id:UID_A, project_id:null, post_date:'2026-10-10', post_time:null, type:'video', platform:'youtube',
        title:'Silinmis', uploaded:false, deleted_at:'2026-02-02T00:00:00Z', content:{} },
      { id:'ev_b', user_id:UID_B, project_id:'pr_9', post_date:'2026-10-09', post_time:'12:00:00', type:'video', platform:'youtube',
        title:'BASKASININ KAYDI', uploaded:false, deleted_at:null, content:{} }
    ],
    scripts: [], ideas: [], ai_aktarimlar: []
  };
}

// Sorgu dizgesini kaba biçimde uyguluyoruz: eq, gte, lte, is.null.
// Amac tam bir PostgREST taklidi degil; SUZGECLERIN KURULDUGUNU
// dogrulamak. user_id suzgeci dusmusse bu suzme onu yakalar.
function suz(satirlar, sorgu){
  const parcalar = sorgu.split('&').filter(x=> x.includes('='));
  let sonuc = satirlar;
  for(const p of parcalar){
    const [alanHam, ...kalan] = p.split('=');
    const deger = decodeURIComponent(kalan.join('='));
    const alan = decodeURIComponent(alanHam);
    if(['select','order','limit','offset'].includes(alan)) continue;
    if(deger === 'is.null')      sonuc = sonuc.filter(r=> r[alan] === null || r[alan] === undefined);
    else if(deger.startsWith('eq.'))  { const v = deger.slice(3); sonuc = sonuc.filter(r=> String(r[alan]) === v); }
    else if(deger.startsWith('gte.')) { const v = deger.slice(4); sonuc = sonuc.filter(r=> String(r[alan]) >= v); }
    else if(deger.startsWith('lte.')) { const v = deger.slice(4); sonuc = sonuc.filter(r=> String(r[alan]) <= v); }
  }
  return sonuc;
}

function sahteFetch(url, secenek = {}){
  const u = new URL(url);
  const tablo = u.pathname.replace('/rest/v1/', '');
  const sorgu = u.search.slice(1);
  const yontem = (secenek.method || 'GET').toUpperCase();
  const govde = secenek.body ? JSON.parse(secenek.body) : null;
  if(!tablolar[tablo]) tablolar[tablo] = [];

  if(yontem === 'GET'){
    let satirlar = suz(tablolar[tablo], sorgu);
    const toplam = satirlar.length;
    const off = Number((/(?:^|&)offset=(\d+)/.exec(sorgu) || [])[1] || 0);
    const lim = Number((/(?:^|&)limit=(\d+)/.exec(sorgu) || [])[1] || 1000);
    satirlar = satirlar.slice(off, off + lim);
    return Promise.resolve({
      ok: true, status: 200,
      headers: new Map([['content-range', `${off}-${off+satirlar.length}/${toplam}`]]),
      text: ()=> Promise.resolve(JSON.stringify(satirlar))
    });
  }
  if(yontem === 'POST'){
    const satirlar = Array.isArray(govde) ? govde : [govde];
    yazilanlar.push({ tablo, yontem, satirlar });
    // Tekil dizin taklidi: ai_aktarimlar'da ayni (user_id, paket_ozeti)
    // ikinci kez yazilamaz.
    for(const s of satirlar){
      if(tablo === 'ai_aktarimlar' && s.paket_ozeti){
        const var_ = tablolar[tablo].some(r=> r.user_id === s.user_id && r.paket_ozeti === s.paket_ozeti);
        if(var_) return Promise.resolve({ ok:false, status:409, headers:new Map(),
          text: ()=> Promise.resolve(JSON.stringify({ message:'duplicate key value violates unique constraint' })) });
      }
      const i = tablolar[tablo].findIndex(r=> r.id === s.id);
      if(i >= 0) tablolar[tablo][i] = { ...tablolar[tablo][i], ...s }; else tablolar[tablo].push({ ...s });
    }
    return Promise.resolve({ ok:true, status:201, headers:new Map(), text: ()=> Promise.resolve('') });
  }
  if(yontem === 'PATCH'){
    const hedef = suz(tablolar[tablo], sorgu);
    yazilanlar.push({ tablo, yontem, sorgu, govde, adet: hedef.length });
    hedef.forEach(r=> Object.assign(r, govde));
    return Promise.resolve({ ok:true, status:204, headers:new Map(), text: ()=> Promise.resolve('') });
  }
  return Promise.resolve({ ok:true, status:200, headers:new Map(), text: ()=> Promise.resolve('[]') });
}

// ---- sunucuyu yükle --------------------------------------------------------
let ele;   // Deno.serve'e verilen istek işleyicisi
async function sunucuyuYukle(){
  globalThis.Deno = {
    env: { get:(a)=> a === 'SUPABASE_URL' ? 'https://sahte.supabase.co'
                   : a === 'SUPABASE_SERVICE_ROLE_KEY' ? 'servis-anahtari' : '' },
    serve: (h)=>{ ele = h; }
  };
  globalThis.fetch = sahteFetch;
  await import(yol.join(KOK_DIZIN, 'supabase', 'functions', 'mcp', 'index.ts'));
}

const ADRES = (anahtar)=> 'https://sahte.supabase.co/functions/v1/mcp' + (anahtar ? '/' + anahtar : '');

async function rpc(anahtar, yontem, params, id = 1){
  const r = await ele(new Request(ADRES(anahtar), {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ jsonrpc:'2.0', id, method:yontem, params })
  }));
  const metin = await r.text();
  return { durum: r.status, govde: metin ? JSON.parse(metin) : null };
}
async function arac(anahtar, ad, args){
  const { govde } = await rpc(anahtar, 'tools/call', { name:ad, arguments:args });
  if(govde.error) return { hataRpc: govde.error };
  return govde.result.structuredContent;
}

(async () => {
  tablolariKur();
  await sunucuyuYukle();
  bak('fonksiyon Deno.serve ile ayağa kalktı', typeof ele === 'function');

  // ------------------------------------------------------------- protokol
  console.log('[protokol]');
  const ini = await rpc(ANAHTAR_A, 'initialize', { protocolVersion:'2025-06-18', capabilities:{} });
  bak('initialize cevap veriyor', ini.durum === 200 && !!ini.govde.result, JSON.stringify(ini.govde).slice(0,120));
  bak('istemcinin istediği sürüm aynen dönüyor',
      ini.govde.result.protocolVersion === '2025-06-18', ini.govde.result.protocolVersion);
  bak('araç yeteneği bildiriliyor', !!ini.govde.result.capabilities.tools);
  bak('sunucu adı var', ini.govde.result.serverInfo.name === 'shootboard', JSON.stringify(ini.govde.result.serverInfo));
  // Asistana ne yapacagini soyleyen metin: "once takvime bak" buradan
  // geliyor, kullanicinin asil derdi buydu.
  bak('yönerge takvime bakmayı söylüyor',
      /list_entries/.test(ini.govde.result.instructions || ''), (ini.govde.result.instructions||'').slice(0,80));

  const bilinmeyen = await rpc(ANAHTAR_A, 'initialize', { protocolVersion:'1999-01-01', capabilities:{} });
  bak('tanınmayan sürümde kendi sürümümüz dönüyor',
      bilinmeyen.govde.result.protocolVersion === '2025-11-25', bilinmeyen.govde.result.protocolVersion);

  // 2026-07-28 ve sonrasi el sikismasiz calisiyor.
  const kesif = await rpc(ANAHTAR_A, 'server/discover', {});
  bak('server/discover (durumsuz istemciler) çalışıyor',
      !!kesif.govde.result && !!kesif.govde.result.capabilities, JSON.stringify(kesif.govde).slice(0,100));

  const bildirim = await ele(new Request(ADRES(ANAHTAR_A), { method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ jsonrpc:'2.0', method:'notifications/initialized' }) }));
  bak('bildirime gövdesiz 202', bildirim.status === 202, String(bildirim.status));

  const bilinmeyenYontem = await rpc(ANAHTAR_A, 'hicboylebirsey', {});
  bak('bilinmeyen yöntem -32601', bilinmeyenYontem.govde.error.code === -32601,
      JSON.stringify(bilinmeyenYontem.govde.error));

  const getSse = await ele(new Request(ADRES(ANAHTAR_A), { method:'GET', headers:{ accept:'text/event-stream' } }));
  bak('SSE isteyen GET 405 alıyor (spec izin veriyor)', getSse.status === 405, String(getSse.status));

  // ---------------------------------------------------------------- araçlar
  console.log('[araç listesi]');
  const liste = await rpc(ANAHTAR_A, 'tools/list', {});
  const adlar = liste.govde.result.tools.map(t=> t.name);
  bak('dört araç var', adlar.length === 4, JSON.stringify(adlar));
  ['shootboard_list_entries','shootboard_list_projects','shootboard_import','shootboard_update_entry']
    .forEach(a=> bak('araç var: ' + a, adlar.includes(a), JSON.stringify(adlar)));
  // KULLANICI KARARI: silme yok.
  bak('SİLME aracı YOK', !adlar.some(a=> /delete|remove|sil/i.test(a)), JSON.stringify(adlar));
  bak('her aracın girdi şeması var',
      liste.govde.result.tools.every(t=> t.inputSchema && t.inputSchema.type === 'object'));
  // Sema ai/sema.json'dan turemeli: platform enum'u elle yazilmis olsaydi
  // sema degisince burasi eskirdi.
  const girisSema = liste.govde.result.tools.find(t=> t.name === 'shootboard_list_entries').inputSchema;
  const semaJson = require(yol.join(KOK_DIZIN, 'ai', 'sema.json'));
  bak('platform enum\'u sema.json ile aynı',
      JSON.stringify(girisSema.properties.platform.enum) ===
      JSON.stringify(semaJson.$defs.Entry.properties.platform.enum),
      JSON.stringify(girisSema.properties.platform.enum));
  const impSema = liste.govde.result.tools.find(t=> t.name === 'shootboard_import').inputSchema;
  bak('import paket şeması sema.json gövdesini taşıyor',
      !!impSema.properties.package.properties && !!impSema.properties.package.properties.entries);

  // ---------------------------------------------------------------- kimlik
  console.log('[kimlik: anahtar yolun içinde]');
  const anahtarsiz = await rpc('', 'tools/call', { name:'shootboard_list_projects', arguments:{} });
  bak('anahtarsız çağrı reddediliyor', !!anahtarsiz.govde.error, JSON.stringify(anahtarsiz.govde).slice(0,100));
  bak('reddetme sebebi anlaşılır',
      /unauthorized|key/i.test(anahtarsiz.govde.error.message), anahtarsiz.govde.error.message.slice(0,90));
  const iptalli = await rpc(IPTAL, 'tools/call', { name:'shootboard_list_projects', arguments:{} });
  bak('iptal edilmiş anahtar geçmiyor', !!iptalli.govde.error);
  const bozuk = await rpc('shb_kisa', 'tools/call', { name:'shootboard_list_projects', arguments:{} });
  bak('bozuk anahtar geçmiyor', !!bozuk.govde.error);
  // Arac listesi anahtarsiz da verilebiliyor: istemci once baglaniyor,
  // sonra kimlik soruluyor. Veri sizdirmiyor.
  bak('araç listesi anahtarsız da alınabiliyor',
      !!(await rpc('', 'tools/list', {})).govde.result);

  // ------------------------------------------------------------ list_entries
  console.log('[list_entries — asıl araç]');
  const giris = await arac(ANAHTAR_A, 'shootboard_list_entries', { since:'2026-10-01', until:'2026-10-31' });
  bak('kayıtlar dönüyor', giris.ok === true && Array.isArray(giris.entries), JSON.stringify(giris).slice(0,120));
  bak('aralıktaki iki kayıt', giris.entries.length === 2, JSON.stringify(giris.entries.map(e=>e.id)));
  bak('silinmiş kayıt gelmiyor', !giris.entries.some(e=> e.id === 'ev_sil'));
  // ASIL SINIR: baska hesabin kaydi.
  bak('BAŞKA HESABIN kaydı gelmiyor',
      !giris.entries.some(e=> e.id === 'ev_b' || /BASKASININ/.test(e.title||'')),
      JSON.stringify(giris.entries.map(e=>e.title)));
  const e1 = giris.entries.find(e=> e.id === 'ev_1');
  bak('istenen alanlar var',
      e1 && e1.date === '2026-10-09' && e1.time === '19:00' && e1.platform === 'youtube'
      && e1.type === 'video' && e1.title === 'Sokollu tanıtım' && e1.uploaded === false,
      JSON.stringify(e1));
  bak('proje ADI çözülüyor', e1.project === 'Sokollu Köprüsü', e1.project);
  // Saat oldugu gibi donuyor: baska bir dilime cevrilmiyor.
  bak('saat kayıttaki gibi, çevrilmemiş', e1.time === '19:00', e1.time);
  // OKUMA TARAFINDAKI BEYAZ LISTE: dogrula.js'te yasanan hatanin aynisi
  // burada da vardi -- ceviriler disariya hic cikmiyordu.
  bak('çok dilli başlık okumada da geliyor',
      !!(e1.content.diller && e1.content.diller.en), JSON.stringify(e1.content));
  bak('anaDil geliyor', e1.content.anaDil === 'tr', String(e1.content.anaDil));
  bak('hesap etiketi geliyor', e1.content.hesapId === 'hs_a', String(e1.content.hesapId));
  const e2 = giris.entries.find(e=> e.id === 'ev_2');
  bak('çevirisi olmayan kayıt boş diller taşımıyor',
      e2 && e2.content.diller === undefined, JSON.stringify(e2.content));

  const suzPf = await arac(ANAHTAR_A, 'shootboard_list_entries', { since:'2026-10-01', until:'2026-10-31', platform:'instagram' });
  bak('platform süzgeci', suzPf.entries.length === 1 && suzPf.entries[0].id === 'ev_2', JSON.stringify(suzPf.entries.map(e=>e.id)));
  const suzPr = await arac(ANAHTAR_A, 'shootboard_list_entries', { since:'2026-10-01', until:'2026-10-31', project:'sokollu köprüsü' });
  bak('proje süzgeci ada göre, büyük/küçük harf farketmiyor',
      suzPr.entries.length === 1 && suzPr.entries[0].id === 'ev_1', JSON.stringify(suzPr.entries.map(e=>e.id)));
  const yokPr = await arac(ANAHTAR_A, 'shootboard_list_entries', { since:'2026-10-01', until:'2026-10-31', project:'Olmayan' });
  bak('bilinmeyen proje: hata VE bilinenler sayılıyor',
      yokPr.ok === false && /Sokollu/.test(yokPr.error), String(yokPr.error).slice(0,110));

  console.log('[list_entries — sınırlar ve sayfalama]');
  const genis = await arac(ANAHTAR_A, 'shootboard_list_entries', { since:'2026-01-01', until:'2026-12-31' });
  bak('90 günden geniş aralık reddediliyor', genis.ok === false, JSON.stringify(genis).slice(0,80));
  bak('kaç gün istendiği söyleniyor', /\d+ days/.test(genis.error), genis.error);
  const ters = await arac(ANAHTAR_A, 'shootboard_list_entries', { since:'2026-10-10', until:'2026-10-01' });
  bak('ters aralık reddediliyor', ters.ok === false && /before/.test(ters.error), String(ters.error));
  const bozukTarih = await arac(ANAHTAR_A, 'shootboard_list_entries', { since:'9 Ekim' });
  bak('bozuk tarih: hangi alan olduğu yazıyor',
      bozukTarih.ok === false && /since/.test(bozukTarih.error), String(bozukTarih.error));

  const sayfa1 = await arac(ANAHTAR_A, 'shootboard_list_entries', { since:'2026-10-01', until:'2026-10-31', limit:1 });
  bak('limit uygulanıyor', sayfa1.entries.length === 1, String(sayfa1.entries.length));
  bak('toplam sayı bildiriliyor', sayfa1.total === 2, String(sayfa1.total));
  bak('sonraki sayfa imleci var', !!sayfa1.nextCursor, String(sayfa1.nextCursor));
  const sayfa2 = await arac(ANAHTAR_A, 'shootboard_list_entries',
    { since:'2026-10-01', until:'2026-10-31', limit:1, cursor:sayfa1.nextCursor });
  bak('ikinci sayfa farklı kayıt getiriyor',
      sayfa2.entries[0].id !== sayfa1.entries[0].id,
      sayfa1.entries[0].id + ' / ' + sayfa2.entries[0].id);
  bak('son sayfada imleç kapanıyor', sayfa2.nextCursor === null, String(sayfa2.nextCursor));

  // --------------------------------------------------------- list_projects
  console.log('[list_projects]');
  const pro = await arac(ANAHTAR_A, 'shootboard_list_projects', {});
  bak('projeler dönüyor', pro.ok === true && pro.projects.length === 2, JSON.stringify(pro.projects.map(p=>p.name)));
  bak('id ve ad var', pro.projects[0].id === 'pr_1' && pro.projects[0].name === 'Sokollu Köprüsü', JSON.stringify(pro.projects[0]));
  bak('BAŞKA HESABIN projesi gelmiyor',
      !pro.projects.some(p=> p.id === 'pr_9'), JSON.stringify(pro.projects.map(p=>p.id)));

  const proB = await arac(ANAHTAR_B, 'shootboard_list_projects', {});
  bak('ikinci hesap KENDİ projesini görüyor',
      proB.projects.length === 1 && proB.projects[0].id === 'pr_9', JSON.stringify(proB.projects.map(p=>p.id)));

  // ---------------------------------------------------------------- import
  console.log('[import]');
  const paket = { shootboard:1, source:'Claude', note:'deneme',
    entries:[{ date:'2026-10-20', time:'18:00', type:'video', platform:'youtube', title:'Yeni video',
               content:{ caption:'metin', anaDil:'tr', diller:{ en:{ videoTitle:'New video' } } } }] };
  const ilk = await arac(ANAHTAR_A, 'shootboard_import', { package: paket });
  bak('paket kabul edildi', ilk.ok === true, JSON.stringify(ilk).slice(0,160));
  bak('oluşan kimlikler dönüyor',
      Array.isArray(ilk.created.entries) && ilk.created.entries.length === 1, JSON.stringify(ilk.created));
  bak('kayıt gerçekten yazıldı',
      yazilanlar.some(y=> y.tablo === 'calendar_events' && y.yontem === 'POST'),
      JSON.stringify(yazilanlar.map(y=>y.tablo+':'+y.yontem)));
  // Cok dilli baslik paket yolundan da gecebilmeli -- kullanicinin elle
  // yapistirdigi sey tam olarak buydu.
  const yazilanKayit = (yazilanlar.find(y=> y.tablo === 'calendar_events' && y.yontem === 'POST') || {}).satirlar[0];
  bak('İngilizce başlık pakete girebiliyor',
      !!(yazilanKayit.content.diller && yazilanKayit.content.diller.en), JSON.stringify(yazilanKayit.content));

  console.log('[ASIL TUZAK: aynı paket iki kez]');
  const yaziAdedi = yazilanlar.filter(y=> y.tablo === 'calendar_events').length;
  const ikinci = await arac(ANAHTAR_A, 'shootboard_import', { package: paket });
  bak('ikinci gönderim duplicate diyor', ikinci.duplicate === true, JSON.stringify(ikinci).slice(0,140));
  bak('ikinci gönderim HİÇBİR ŞEY yazmadı',
      yazilanlar.filter(y=> y.tablo === 'calendar_events').length === yaziAdedi,
      String(yazilanlar.filter(y=> y.tablo === 'calendar_events').length) + ' vs ' + String(yaziAdedi));
  bak('ilk aktarımın kimlikleri geri dönüyor',
      JSON.stringify(ikinci.created.entries) === JSON.stringify(ilk.created.entries),
      JSON.stringify(ikinci.created.entries));
  bak('sebebi açıkça söyleniyor',
      /already imported/i.test(JSON.stringify(ikinci.warnings || '')), JSON.stringify(ikinci.warnings));
  // Kacis yolu: bilerek tekrar gondermek isteyen kendi anahtarini verir.
  const bilerek = await arac(ANAHTAR_A, 'shootboard_import', { package: paket, idempotencyKey:'bilerek-2' });
  bak('kendi anahtarıyla bilerek tekrar YAZILABİLİYOR',
      bilerek.ok === true && !bilerek.duplicate, JSON.stringify(bilerek).slice(0,120));

  const bozukPaket = await arac(ANAHTAR_A, 'shootboard_import',
    { package:{ shootboard:1, source:'Claude', entries:[{ date:'yarın', type:'video', platform:'youtube' }] } });
  bak('bozuk paket reddediliyor', bozukPaket.ok === false, JSON.stringify(bozukPaket).slice(0,120));
  bak('hangi alanın neden reddedildiği yazıyor',
      /date/.test(JSON.stringify(bozukPaket)), JSON.stringify(bozukPaket).slice(0,200));
  const paketsiz = await arac(ANAHTAR_A, 'shootboard_import', {});
  bak('paket yoksa sebebi söyleniyor', paketsiz.ok === false && /package/.test(paketsiz.error), String(paketsiz.error));

  // ----------------------------------------------------------- update_entry
  console.log('[update_entry]');
  const guncel = await arac(ANAHTAR_A, 'shootboard_update_entry', { id:'ev_2', date:'2026-10-15', time:'20:00' });
  bak('güncelleme kabul edildi', guncel.ok === true, JSON.stringify(guncel).slice(0,140));
  bak('yeni tarih dönüyor', guncel.entry.date === '2026-10-15', JSON.stringify(guncel.entry));
  bak('yeni saat dönüyor', guncel.entry.time === '20:00', guncel.entry.time);
  // DOKUNULMAYAN ALAN DEGISMEMELI: kismi guncelleme boyle olur.
  bak('dokunulmayan başlık aynı kaldı', guncel.entry.title === 'Kariye teaser', guncel.entry.title);
  bak('dokunulmayan uploaded aynı kaldı', guncel.entry.uploaded === true, String(guncel.entry.uploaded));
  bak('hangi alanların değiştiği bildiriliyor',
      JSON.stringify(guncel.changed) === JSON.stringify(['date','time']), JSON.stringify(guncel.changed));

  const icerik = await arac(ANAHTAR_A, 'shootboard_update_entry', { id:'ev_1', content:{ caption:'Yeni açıklama' } });
  bak('content kısmi güncelleniyor', icerik.entry.content.caption === 'Yeni açıklama', JSON.stringify(icerik.entry.content).slice(0,80));
  // Birlestirme: content'in gonderilmeyen alanlari KORUNMALI, yoksa
  // "aciklamayi degistir" demek cevirileri silerdi.
  bak('content birleştiriliyor, ÜZERİNE YAZMIYOR',
      !!(icerik.entry.content.diller && icerik.entry.content.diller.en), JSON.stringify(icerik.entry.content));
  bak('videoTitle korundu', icerik.entry.content.videoTitle === 'Sokollu Köprüsü', icerik.entry.content.videoTitle);

  const yokId = await arac(ANAHTAR_A, 'shootboard_update_entry', { id:'hic_boyle_bir_kayit', date:'2026-10-01' });
  bak('olmayan kimlik reddediliyor', yokId.ok === false && /no entry/.test(yokId.error), String(yokId.error).slice(0,90));
  // ASIL SINIR: baska hesabin kaydini guncelleyememeli.
  const baskasi = await arac(ANAHTAR_A, 'shootboard_update_entry', { id:'ev_b', title:'ELE GECIRILDI' });
  bak('BAŞKA HESABIN kaydı güncellenemiyor', baskasi.ok === false, JSON.stringify(baskasi).slice(0,100));
  bak('o kayıt gerçekten değişmedi',
      tablolar.calendar_events.find(r=> r.id === 'ev_b').title === 'BASKASININ KAYDI',
      tablolar.calendar_events.find(r=> r.id === 'ev_b').title);
  const bosGuncel = await arac(ANAHTAR_A, 'shootboard_update_entry', { id:'ev_2' });
  bak('değiştirilecek alan yoksa söyleniyor',
      bosGuncel.ok === false && /nothing to change/.test(bosGuncel.error), String(bosGuncel.error));
  const bozukTur = await arac(ANAHTAR_A, 'shootboard_update_entry', { id:'ev_2', platform:'myspace' });
  bak('geçersiz platform reddediliyor, sebebi yazıyor',
      bozukTur.ok === false && /platform/.test(JSON.stringify(bozukTur)), JSON.stringify(bozukTur).slice(0,140));

  console.log('[silme gerçekten yok]');
  const silDene = await arac(ANAHTAR_A, 'shootboard_delete_entry', { id:'ev_1' });
  bak('silme aracı çağrılamıyor', silDene.ok === false && /unknown tool/.test(silDene.error), String(silDene.error).slice(0,90));
  bak('hiçbir DELETE isteği gitmedi', !yazilanlar.some(y=> y.yontem === 'DELETE'));

  console.log('[üretilen dosyalar güncel mi]');
  // tek-dosya.ts panelden kuranin yapistirdigi sey. Kaynaklar degisip bu
  // yeniden uretilmezse panele eski surum yapistirilir ve "duzelttim ama
  // duzelmedi" denir.
  const fs = require('fs');
  const mcpDizin = yol.join(KOK_DIZIN, 'supabase', 'functions', 'mcp');
  const oku = (a)=> fs.readFileSync(yol.join(mcpDizin, a), 'utf8');
  const beklenen = crypto.createHash('sha256').update(
      fs.readFileSync(yol.join(KOK_DIZIN, 'ai', 'dogrula.js'), 'utf8')
      + oku('sema.ts') + oku('index.ts')).digest('hex');
  bak('tek-dosya.ts kaynaklarla aynı sürümde',
      oku('.kaynak-ozeti').trim() === beklenen,
      'birlestir.py yeniden çalıştırılmalı');
  bak('dogrula.js ai/ ile aynı',
      oku('dogrula.js').includes(fs.readFileSync(yol.join(KOK_DIZIN, 'ai', 'dogrula.js'), 'utf8')));
  bak('tek-dosya.ts içe aktarma satırı taşımıyor',
      !/^import .* from '\.\//m.test(oku('tek-dosya.ts')));

  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})().catch(e=>{ console.error('TEST ÇÖKTÜ:', e); process.exit(1); });
