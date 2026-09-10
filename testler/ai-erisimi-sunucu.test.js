// AI ERISIMI — EDGE FUNCTION (supabase/functions/ai/tek-dosya.ts), sunucusuz.
//
// Deno yok, Supabase yok: tek dosyalik surum TypeScript'ten JS'e cevrilip
// bu surecte calistiriliyor; Deno.serve ve fetch taklit. fetch'in arkasinda
// bellekte kucuk bir PostgREST var (eq/is/in/gte/lte, order, limit,
// count=exact, upsert, PATCH, eksik sutun hatasi). Olculen sey uclarin
// butun akisi: anahtar -> kullanici, paketten satirlara donusum, ada gore
// eslesme, sahiplik, hesap siniri, defter, geri alma, hiz siniri.
//
// typescript modulu gerekiyor (npm i typescript ya da /opt/node22 altinda).
const fs = require('fs'), path = require('path');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

function tsYukle(){
  try{ return require('typescript'); }catch(e){}
  for(const y of ['/opt/node22/lib/node_modules/typescript', '/usr/lib/node_modules/typescript', '/usr/local/lib/node_modules/typescript']){
    try{ return require(y); }catch(e){}
  }
  return null;
}

// ---- bellekte PostgREST ------------------------------------------------
const db = { api_keys: [], ai_aktarimlar: [], calendar_events: [], projects: [], places: [], scripts: [], ideas: [], user_prefs: [] };
const eksikSutun = {};        // { projects: ['place_ids'] } -> PGRST204 taklidi
const istekler = [];          // [{method, tablo, prefer}]
function esles(r, kk, v){
  const i = v.indexOf('.'); const op = v.slice(0, i), val = v.slice(i + 1);
  const x = r[kk];
  if(op === 'eq') return String(x) === val;
  if(op === 'neq') return String(x) !== val;
  if(op === 'is') return val === 'null' ? (x === null || x === undefined) : (val === 'true' ? x === true : x === false);
  if(op === 'in') return val.replace(/^\(|\)$/g, '').split(',').includes(String(x));
  if(op === 'gte') return String(x) >= val;
  if(op === 'lte') return String(x) <= val;
  throw new Error('bilinmeyen op ' + op);
}
function suz(tablo, sp){
  let rows = db[tablo].filter(r=>{
    for(const [kk, v] of sp){ if(['select','order','limit','offset'].includes(kk)) continue; if(!esles(r, kk, v)) return false; }
    return true;
  });
  const order = sp.get('order');
  if(order){
    const parcalar = order.split(',').map(p=>{ const [col, yon] = p.split('.'); return { col, ters: yon === 'desc' }; });
    rows = rows.slice().sort((a, b)=>{
      for(const p of parcalar){
        const x = a[p.col] ?? '', y = b[p.col] ?? '';
        if(x < y) return p.ters ? 1 : -1;
        if(x > y) return p.ters ? -1 : 1;
      }
      return 0;
    });
  }
  const limit = Number(sp.get('limit'));
  return { hepsi: rows, sinirli: limit ? rows.slice(0, limit) : rows };
}
function yanit(govde, durum = 200, basliklar = {}){
  return new Response(govde === null ? null : JSON.stringify(govde), { status: durum, headers: { 'content-type': 'application/json', ...basliklar } });
}
async function sahteFetch(url, init = {}){
  const u = new URL(url);
  const tablo = u.pathname.replace('/rest/v1/', '');
  const method = (init.method || 'GET').toUpperCase();
  const h = new Headers(init.headers || {});
  const prefer = h.get('prefer') || '';
  istekler.push({ method, tablo, prefer });
  if(h.get('apikey') !== 'servis') return yanit({ message: 'servis anahtari yok' }, 401);
  if(!(tablo in db)) return yanit({ code: 'PGRST205', message: `Could not find the table 'public.${tablo}' in the schema cache` }, 404);
  const sp = u.searchParams;
  if(method === 'GET'){
    const { hepsi, sinirli } = suz(tablo, sp);
    const ek = /count=exact/.test(prefer) ? { 'content-range': `0-${Math.max(0, sinirli.length - 1)}/${hepsi.length}` } : {};
    return yanit(sinirli, 200, ek);
  }
  const govde = init.body ? JSON.parse(init.body) : null;
  if(method === 'POST'){
    const rows = Array.isArray(govde) ? govde : [govde];
    const eksik = (eksikSutun[tablo] || []).find(s=> rows.some(r=> s in r));
    if(eksik) return yanit({ code: 'PGRST204', message: `Could not find the '${eksik}' column of '${tablo}' in the schema cache` }, 400);
    const cikti = [];
    for(const r of rows){
      const i = db[tablo].findIndex(x=> x.id === r.id);
      if(i >= 0){
        if(!/merge-duplicates/.test(prefer)) return yanit({ code: '23505', message: 'duplicate key value violates unique constraint' }, 409);
        db[tablo][i] = Object.assign({}, db[tablo][i], r);
        cikti.push(db[tablo][i]);
      }else{
        db[tablo].push(Object.assign({}, r)); cikti.push(r);
      }
    }
    return /return=representation/.test(prefer) ? yanit(cikti, 201) : yanit(null, 201);
  }
  if(method === 'PATCH'){
    const { hepsi } = suz(tablo, sp);
    hepsi.forEach(r=> Object.assign(r, govde));
    return yanit(null, 204);
  }
  return yanit({ message: 'yontem yok' }, 405);
}

// ---- fonksiyonu yukle --------------------------------------------------
(async () => {
  const ts = tsYukle();
  if(!ts){ console.log('typescript modulu yok: bu test atlandi (npm i typescript)'); process.exit(0); }
  const kaynak = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'ai', 'tek-dosya.ts'), 'utf8');
  const js = ts.transpileModule(kaynak, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  let isleyici = null;
  globalThis.Deno = { env: { get: kk=> ({ SUPABASE_URL: 'http://sahte.local', SUPABASE_SERVICE_ROLE_KEY: 'servis' })[kk] },
                      serve: h=> { isleyici = h; } };
  globalThis.fetch = sahteFetch;
  const eskiUyari = console.warn, eskiHata = console.error;
  console.warn = ()=>{}; console.error = ()=>{};
  new Function(js)();
  bak('Deno.serve isleyiciyi verdi', typeof isleyici === 'function');

  const KOK = 'http://sahte.local/functions/v1/ai';
  const ANAHTAR = 'shb_' + 'a'.repeat(32);
  const istek = async (yol, secenek = {})=>{
    const h = Object.assign({ 'content-type': 'application/json' }, secenek.anahtar === null ? {} : { authorization: 'Bearer ' + (secenek.anahtar || ANAHTAR) }, secenek.baslik || {});
    const r = await isleyici(new Request(KOK + yol, { method: secenek.method || (secenek.govde ? 'POST' : 'GET'), headers: h,
                                                      body: secenek.govde ? JSON.stringify(secenek.govde) : undefined }));
    let j = null; try{ j = await r.json(); }catch(e){}
    return { durum: r.status, j, r };
  };
  const sha = async (m)=> Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m))), b=> b.toString(16).padStart(2, '0')).join('');

  // -- anahtarsiz ve yanlis anahtar
  let c = await istek('/', { anahtar: null });
  bak('kok: anahtarsiz uc listesi', c.durum === 200 && Array.isArray(c.j.endpoints));
  c = await istek('/schema', { anahtar: null });
  bak('schema: anahtarsiz, $defs var', c.durum === 200 && c.j.$defs && c.j.$defs.Entry);
  c = await istek('/me', { anahtar: null });
  bak('me: anahtarsiz 401', c.durum === 401 && c.j.error === 'unauthorized');
  c = await istek('/me', { anahtar: 'shb_' + 'b'.repeat(32) });
  bak('me: bilinmeyen anahtar 401', c.durum === 401);
  c = await istek('/me', { anahtar: 'yanlis-bicim' });
  bak('me: bicimsiz anahtar 401', c.durum === 401);
  const preflight = await isleyici(new Request(KOK + '/import', { method: 'OPTIONS' }));
  bak('OPTIONS 204 + CORS', preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === '*');

  // -- anahtar tablosu yoksa 503
  const apiKeysYedek = db.api_keys; delete db.api_keys;
  c = await istek('/me');
  bak('sql/35 calistirilmamissa 503 not_installed', c.durum === 503 && c.j.error === 'not_installed');
  db.api_keys = apiKeysYedek;

  // -- anahtar kur
  db.api_keys.push({ id: 'ak1', user_id: 'u1', key_hash: await sha(ANAHTAR), scopes: ['read', 'write'], revoked_at: null, last_used_at: null });
  c = await istek('/me');
  bak('me: sayilar sifir, varsayilan sinirlar', c.durum === 200 && c.j.counts.entries === 0 && c.j.limits.entries === 100 && c.j.limits.projects === 100 && c.j.limits.ideas === 500, JSON.stringify(c.j));
  bak('me: last_used_at yazildi', !!db.api_keys[0].last_used_at);
  c = await istek('/me', { baslik: { authorization: '' , 'x-api-key': ANAHTAR } });
  bak('x-api-key basligi da gecerli', c.durum === 200);

  // -- baskasinin projesi (sahiplik) ve hesabin kendi projesi
  db.projects.push({ id: 'pr_baska', user_id: 'u2', name: 'Baskasinin', deleted_at: null, steps: {}, deadlines: {} });
  db.projects.push({ id: 'pr_var', user_id: 'u1', name: 'Sahil', notes: 'eski not', type: 'outdoor', place_ids: [], place_id: null, deleted_at: null, steps: { script: true }, deadlines: { script: '2026-01-01' }, created_at: '2026-01-01T00:00:00Z' });

  // -- ilk aktarim
  const paket = {
    shootboard: 1, source: 'Test AI', note: 'ilk',
    places: [{ name: 'Büyük Valide Han', city: 'İstanbul', lat: 41.02, lon: 28.97 }],
    projects: [
      { name: 'Hanlar', type: 'venue', shootDate: '2026-09-20', places: ['büyük valide han', 'Olmayan Mekan'], steps: { script: true } },
      { name: 'sahil', notes: 'yeni not', places: ['Büyük Valide Han'] },
      { id: 'pr_baska', name: 'Ele gecirme' }
    ],
    entries: [
      { date: '2026-09-27', time: '19:00', type: 'video', platform: 'youtube', title: 'Hanlar video', project: 'Hanlar', content: { caption: 'aciklama', hashtags: '#han' } },
      { date: '2026-09-28', platform: 'threads', type: 'text_post', title: 'thread', project: 'Olmayan Proje' },
      { date: '2026-09-29', platform: 'instagram', type: 'reels', title: 'projesiz' }
    ],
    scripts: [{ title: 'VO', text: 'metin', project: 'Hanlar' }],
    ideas: [{ text: 'fikir 1', project: 'Hanlar', due: '2026-10-01' }, { text: 'fikir 2' }]
  };
  c = await istek('/import', { govde: paket });
  bak('import ok', c.durum === 200 && c.j.ok === true, JSON.stringify(c.j).slice(0, 300));
  const y = c.j;
  bak('import: sayilar (1 mekan, 1 proje yeni + 1 guncel, 3 kayit, 1 script, 2 fikir)',
      y.counts.created.places === 1 && y.counts.created.projects === 1 && y.counts.updated.projects === 1 &&
      y.counts.created.entries === 3 && y.counts.created.scripts === 1 && y.counts.created.ideas === 2, JSON.stringify(y.counts));
  bak('import: baskasinin kimligi atlandi + uyari', y.warnings.some(w=> /another account/.test(w.message)) && !db.projects.find(p=> p.id === 'pr_baska' && p.name === 'Ele gecirme'));
  bak('import: olmayan mekan ve olmayan proje uyarilari', y.warnings.some(w=> /place "Olmayan Mekan" not found/.test(w.message)) && y.warnings.some(w=> /project "Olmayan Proje" not found/.test(w.message)));
  const mekan = db.places.find(m=> m.name === 'Büyük Valide Han');
  const hanlar = db.projects.find(p=> p.name === 'Hanlar');
  const sahil = db.projects.find(p=> p.id === 'pr_var');
  bak('mekan satiri: user_id, koordinat, source manual, created_at', mekan && mekan.user_id === 'u1' && mekan.lat === 41.02 && mekan.source === 'manual' && !!mekan.created_at);
  bak('proje satiri: place_ids ilk durak, place_id, start_date, steps', hanlar && hanlar.place_ids.length === 1 && hanlar.place_ids[0] === mekan.id && hanlar.place_id === mekan.id && hanlar.start_date === '2026-09-20' && hanlar.steps.script === true && hanlar.steps.filmed === false);
  bak('ada gore guncelleme: sahil notu degisti, turu korundu, adimlar birlesti', sahil.notes === 'yeni not' && sahil.type === 'outdoor' && sahil.steps.script === true && sahil.place_ids[0] === mekan.id && sahil.name === 'sahil');
  bak('proje sayisi artmadi (ikinci Sahil yok)', db.projects.filter(p=> p.user_id === 'u1').length === 2);
  const kayit = db.calendar_events.find(e=> e.title === 'Hanlar video');
  bak('kayit satiri: post_date/post_time, project_id, content.projectId + concept', kayit && kayit.post_date === '2026-09-27' && kayit.post_time === '19:00' && kayit.project_id === hanlar.id && kayit.content.projectId === hanlar.id && kayit.content.concept === 'Hanlar' && kayit.content.caption === 'aciklama' && kayit.uploaded === false);
  const thread = db.calendar_events.find(e=> e.title === 'thread');
  bak('projesi bulunmayan kayit: project_id null, concept bos (gocurme proje uretmesin)', thread && thread.project_id === null && thread.content.concept === '' && thread.content.projectId === '' && thread.post_time === null);
  bak('kayit kimligi uuid', /^[0-9a-f-]{36}$/.test(kayit.id));
  const script = db.scripts[0];
  bak('script satiri: source ai, content, project_ids', script && script.source === 'ai' && script.content === 'metin' && script.project_ids[0] === hanlar.id && script.project_id === hanlar.id);
  const fikir = db.ideas.find(f=> f.text === 'fikir 1');
  bak('fikir satiri: parts, due_date, project_ids, sort_index negatif', fikir && fikir.parts[0].text === 'fikir 1' && fikir.due_date === '2026-10-01' && fikir.project_ids[0] === hanlar.id && fikir.sort_index < 0);
  const defter = db.ai_aktarimlar[0];
  bak('defter: kaynak, kimlikler, onceki proje hali', defter && defter.kaynak === 'Test AI' && defter.kayitlar.length === 3 && defter.projeler.length === 2 && defter.mekanlar.length === 1 &&
      defter.onceki.projects && defter.onceki.projects[0].notes === 'eski not' && defter.ozet.note === 'ilk');
  bak('yanit: importId defterle ayni, created kimlikleri dolu', y.importId === defter.id && y.created.entries.length === 3 && y.updated.projects[0] === 'pr_var');

  // -- okumalar
  c = await istek('/projects');
  bak('GET /projects: mekan adlari cozuluyor', c.j.projects.find(p=> p.name === 'Hanlar').places[0] === 'Büyük Valide Han');
  c = await istek('/entries?from=2026-09-27&to=2026-09-28');
  bak('GET /entries: aralik ve proje adi (bulunmayan proje bos)', c.j.entries.length === 2 && c.j.entries[0].project === 'Hanlar' && c.j.entries[1].project === '');
  c = await istek('/entries?from=2026-9-1');
  bak('GET /entries: bozuk tarih 400', c.durum === 400);
  c = await istek('/scripts');
  bak('GET /scripts: text ve proje', c.j.scripts[0].text === 'metin' && c.j.scripts[0].project === 'Hanlar');
  c = await istek('/ideas');
  bak('GET /ideas: 2 fikir', c.j.ideas.length === 2);
  c = await istek('/imports');
  bak('GET /imports: 1 satir, undone false', c.j.imports.length === 1 && c.j.imports[0].undone === false && c.j.imports[0].counts.created.entries === 3);
  c = await istek('/me');
  bak('me: sayilar guncel', c.j.counts.entries === 3 && c.j.counts.projects === 2 && c.j.counts.places === 1);

  // -- kimlikle guncelleme (ayni kimlik ikinci kez): tekrar yok, onceki saklandi
  c = await istek('/import', { govde: { entries: [{ id: kayit.id, date: '2026-09-27', platform: 'youtube', title: 'Hanlar video v2', content: { hashtags: '#yeni' } }] } });
  bak('kimlikle guncelleme: updated, kayit sayisi ayni', c.j.ok && c.j.counts.updated.entries === 1 && db.calendar_events.length === 3);
  const k2 = db.calendar_events.find(e=> e.id === kayit.id);
  bak('guncelleme: baslik degisti, caption korundu, hashtags degisti', k2.title === 'Hanlar video v2' && k2.content.caption === 'aciklama' && k2.content.hashtags === '#yeni');

  // -- geri alma: son aktarim (kimlikle guncelleme) -> baslik eski haline
  c = await istek('/undo', { govde: {} });
  bak('undo son aktarim: ok', c.durum === 200 && c.j.ok && c.j.reverted.entries === 1, JSON.stringify(c.j));
  bak('undo: kayit basligi geri geldi', db.calendar_events.find(e=> e.id === kayit.id).title === 'Hanlar video');
  bak('undo: ikinci kez 404', (await istek('/undo', { govde: { importId: c.j.importId } })).durum === 404);
  // -- ilk aktarimi kimlikle geri al: eklenenler silindi, Sahil eski notuna dondu
  c = await istek('/undo', { govde: { importId: defter.id } });
  bak('undo ilk aktarim: ok', c.j.ok === true, JSON.stringify(c.j));
  bak('undo: eklenen kayit/mekan/script/fikir deleted_at aldi', db.calendar_events.every(e=> !!e.deleted_at) && !!mekan.deleted_at && !!script.deleted_at && db.ideas.every(f=> !!f.deleted_at) && !!hanlar.deleted_at);
  bak('undo: Sahil eski notuna dondu, defter isaretlendi', db.projects.find(p=> p.id === 'pr_var').notes === 'eski not' && !!defter.geri_alindi_at);
  c = await istek('/me');
  bak('me: undo sonrasi sayilar', c.j.counts.entries === 0 && c.j.counts.projects === 1 && c.j.counts.places === 0);

  // -- Turkce ust anahtarlar + eksik sutun (sql/34 yokmus gibi)
  eksikSutun.projects = ['place_ids'];
  c = await istek('/import', { govde: { kaynak: 'Yedek', projeler: [{ name: 'Yeni Proje', places: [] }], kayitlar: [{ date: '2026-10-01', platform: 'x', title: 'x' }] } });
  bak('Turkce anahtarlar + eksik sutun: yine ok', c.durum === 200 && c.j.ok && c.j.counts.created.projects === 1 && c.j.counts.created.entries === 1, JSON.stringify(c.j).slice(0, 200));
  bak('eksik sutun satirdan dustu', !('place_ids' in db.projects.find(p=> p.name === 'Yeni Proje')));
  delete eksikSutun.projects;

  // -- hesap siniri: 2 kayit hakki varken 3 kayit
  db.user_prefs.push({ user_id: 'u1', entry_limit: 2, project_limit: 100, prefs: { lang: 'tr' } });
  const onceKayit = db.calendar_events.length;
  c = await istek('/import', { govde: { entries: [1, 2, 3].map(i=> ({ date: '2026-11-0' + i, platform: 'youtube', title: 'k' + i })), ideas: [{ text: 'sinir fikri' }] } });
  bak('sinir: 422 limit, hicbir sey yazilmadi', c.durum === 422 && c.j.error === 'limit' && db.calendar_events.length === onceKayit && !db.ideas.find(f=> f.text === 'sinir fikri'), JSON.stringify(c.j));
  c = await istek('/me');
  bak('me: sinir ve dil hesaptan', c.j.limits.entries === 2 && c.j.lang === 'tr');

  // -- bozuk paket
  c = await istek('/import', { govde: { shootboard: 1 } });
  bak('bos paket 422 invalid_package', c.durum === 422 && c.j.error === 'invalid_package');
  const r = await isleyici(new Request(KOK + '/import', { method: 'POST', headers: { authorization: 'Bearer ' + ANAHTAR }, body: '{bozuk' }));
  bak('bozuk JSON 400', r.status === 400);
  c = await istek('/yok');
  bak('bilinmeyen uc 404', c.durum === 404);

  // -- hiz siniri: saatte 60
  for(let i = 0; i < 60; i++) db.ai_aktarimlar.push({ id: 'ak_h' + i, user_id: 'u1', created_at: new Date().toISOString(), kayitlar: [], projeler: [], mekanlar: [], scriptler: [], fikirler: [], onceki: {}, ozet: {} });
  c = await istek('/import', { govde: { ideas: [{ text: 'fazla' }] } });
  bak('hiz siniri 429', c.durum === 429 && c.j.error === 'rate_limited');

  // -- salt okunur anahtar ve iptal
  db.api_keys[0].scopes = ['read'];
  c = await istek('/import', { govde: { ideas: [{ text: 'x' }] } });
  bak('salt okunur anahtar yazamaz 403', c.durum === 403);
  db.api_keys[0].revoked_at = new Date().toISOString();
  c = await istek('/me');
  bak('iptal edilmis anahtar 401', c.durum === 401);

  console.warn = eskiUyari; console.error = eskiHata;
  console.log(`\n${g} gecti, ${k} kaldi`);
  process.exit(k ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
