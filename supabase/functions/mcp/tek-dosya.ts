// Shootboard MCP sunucusu — TEK DOSYALIK sürüm.
//
// Supabase panelindeki "Via Editor" yolunda ikinci bir dosya oluşturmak
// gerekmesin diye dogrula.js, sema.ts ve index.ts bu dosyada birleştirildi.
// Panelden kuruyorsan YALNIZCA bu dosyayı yapıştır. Komut satırından
// kuruyorsan çok dosyalı sürüm kullanılır.
//
// İçeriği elle değiştirme: kaynaklar değişirse şu komutla yeniden üretilir:
//   python3 supabase/functions/mcp/birlestir.py
//

// ---- dogrula.js ----

// ai/dogrula.js KOPYASI — elle düzenleme, birlestir.py üretir.
// Değişiklik ai/dogrula.js üzerinde yapılır: İçe Aktar penceresi ve bu
// sunucu AYNI doğrulayıcıyı çalıştırmalı, yoksa aynı paket iki yerde
// iki farklı sonuç verir.
// Shootboard AI erişimi — paket doğrulama.
//
// Deno (Edge Function) ve Node (testler) ikisinde de çalışır: düz ESM, tip
// yok, dış bağımlılık yok. Uygulamanın kendisi de aynı kuralları taşıyor
// (app.html: aiPaketiCoz); iki taraf aynı paketi aynı biçimde okumalı.
//
// Kurallar app.html'deki sanitizeEvent / sanitizeProject / mekanTemizle /
// scriptTemizle / fikirTemizle ile birebir. Oradaki bir sınır ya da liste
// değişirse burası da değişmeli: beyaz listede olmayan alan sessizce düşer
// (YAPILACAKLAR'daki ders).
//
// Çıktı "yalnızca verilen alanlar": bir öğede olmayan alan çıktıda da yok.
// Böylece ada göre eşleşen bir proje güncellenirken paketin sustuğu alan
// (ör. notes) ezilmiyor, yalnızca söylenen alanlar değişiyor.

const CAL_TYPES = ['video', 'shorts', 'reels', 'carousel', 'story', 'text_post', 'poll'];
const PLATFORMLAR = ['youtube', 'instagram', 'tiktok', 'facebook', 'threads', 'x', 'pinterest', 'linkedin'];
const PROJE_TURLERI = ['outdoor', 'venue', 'studio', 'vlog', 'review', 'desk', 'other'];
const PROJE_ADIMLARI = ['script', 'filmed', 'audio', 'edited', 'approved', 'package', 'published'];

// Paket başına ve hesap başına sınırlar. Kayıt ve proje sınırı hesaptan
// (user_prefs.entry_limit / project_limit) gelir; buradakiler varsayılan.
const SINIRLAR = {
  paket: 200,
  liste: { places: 100, projects: 100, entries: 200, scripts: 50, ideas: 100 },
  hesap: { entries: 100, projects: 100, places: 400, scripts: 300, ideas: 500 }
};

const KIMLIK = /^[A-Za-z0-9_-]{1,64}$/;
const TARIH = /^\d{4}-\d{2}-\d{2}$/;
const SAAT = /^\d{2}:\d{2}$/;

// Üst düzey listeler: İngilizce asıl ad, Türkçe takma ad (yedek dosyası).
const LISTELER = [
  ['places', 'mekanlar'], ['projects', 'projeler'], ['entries', 'kayitlar'],
  ['scripts', 'scriptler'], ['ideas', 'fikirler']
];

function adAnahtari(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
}
function kimlikGecerli(x) { return typeof x === 'string' && KIMLIK.test(x); }
function tarihGecerli(s) {
  if (typeof s !== 'string' || !TARIH.test(s)) return false;
  const [y, a, g] = s.split('-').map(Number);
  if (a < 1 || a > 12 || g < 1) return false;
  return g <= new Date(Date.UTC(y, a, 0)).getUTCDate();
}
function saatGecerli(s) {
  if (typeof s !== 'string' || !SAAT.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h <= 23 && m <= 59;
}
function tzGecerli(z) {
  if (typeof z !== 'string' || !z || z.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch { return false; }
}
function rastgele(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, b => (b % 36).toString(36)).join('');
}
// Kimlik üretimi uygulamayla aynı önekler: pr_, mk_, sc_, fk_; kayıtlar UUID.
function kimlikUret(liste) {
  if (liste === 'entries') return crypto.randomUUID();
  const onek = { projects: 'pr_', places: 'mk_', scripts: 'sc_', ideas: 'fk_' }[liste];
  return onek + Date.now().toString(36) + '_' + rastgele(6);
}

// ---- alan okuyucular ---------------------------------------------------
// Verilmeyen alan undefined döner (çıktıda yer almaz); verilen alan kırpılır.
function metin(v, n) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number' || typeof v === 'boolean') v = String(v);
  if (typeof v !== 'string') return undefined;
  return v.slice(0, n);
}
function mantik(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1' || v === 'yes' || v === 'evet') return true;
  if (v === 'false' || v === 0 || v === '0' || v === 'no' || v === 'hayir' || v === 'hayır') return false;
  return undefined;
}
function sayi(v, sinir) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && Math.abs(n) <= sinir ? n : undefined;
}
function tarih(v) { return v === undefined || v === null ? undefined : (tarihGecerli(v) ? v : null); }
function saat(v) {
  if (v === undefined || v === null) return undefined;
  if (v === '') return '';
  if (typeof v === 'string' && /^\d:\d{2}$/.test(v)) v = '0' + v;
  if (typeof v === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(v)) v = v.slice(0, 5);
  return saatGecerli(v) ? v : null;
}
// Proje/mekan başvurusu: ad ya da kimlik. Liste ya da tek değer.
function basvurular(tek, liste, n) {
  const dizi = Array.isArray(liste) ? liste : (tek === undefined || tek === null ? undefined : [tek]);
  if (dizi === undefined) return undefined;
  const cikti = [];
  dizi.forEach(x => {
    if (typeof x !== 'string' && typeof x !== 'number') return;
    const s = String(x).trim().slice(0, 160);
    if (s && !cikti.includes(s)) cikti.push(s);
  });
  return cikti.slice(0, n);
}
function temizNesne(o) {
  Object.keys(o).forEach(k => { if (o[k] === undefined) delete o[k]; });
  return o;
}
function kimlikAl(ham, hatalar, liste, sira) {
  if (ham.id === undefined || ham.id === null || ham.id === '') return undefined;
  if (kimlikGecerli(ham.id)) return ham.id;
  hatalar.push({ liste, sira, alan: 'id', sebep: 'id must match ^[A-Za-z0-9_-]{1,64}$; dropped' });
  return undefined;
}

// ---- öğe okuyucular -----------------------------------------------------
function mekanOku(ham, sira, hatalar) {
  const name = metin(ham.name, 160);
  if (!name || !name.trim()) { hatalar.push({ liste: 'places', sira, alan: 'name', sebep: 'name is required' }); return null; }
  const tz = metin(ham.timezone, 64);
  if (tz && !tzGecerli(tz)) hatalar.push({ liste: 'places', sira, alan: 'timezone', sebep: 'not an IANA time zone; dropped' });
  return temizNesne({
    id: kimlikAl(ham, hatalar, 'places', sira),
    name: name.trim(),
    city: metin(ham.city, 120), district: metin(ham.district, 120),
    address: metin(ham.address, 400), country: metin(ham.country, 80),
    lat: sayi(ham.lat, 85), lon: sayi(ham.lon, 180),
    timezone: tz && tzGecerli(tz) ? tz : undefined,
    mapsUrl: metin(ham.mapsUrl, 600), driveUrl: metin(ham.driveUrl, 600),
    permission: metin(ham.permission, 400), cautions: metin(ham.cautions, 2000),
    notes: metin(ham.notes, 4000)
  });
}

function projeOku(ham, sira, hatalar) {
  const name = metin(ham.name, 120);
  if (!name || !name.trim()) { hatalar.push({ liste: 'projects', sira, alan: 'name', sebep: 'name is required' }); return null; }
  let type = metin(ham.type, 20);
  if (type !== undefined && !PROJE_TURLERI.includes(type)) {
    hatalar.push({ liste: 'projects', sira, alan: 'type', sebep: `unknown type "${type}"; using other` });
    type = 'other';
  }
  const shootDate = tarih(ham.shootDate);
  if (shootDate === null) hatalar.push({ liste: 'projects', sira, alan: 'shootDate', sebep: 'not YYYY-MM-DD; dropped' });
  let steps, deadlines;
  if (ham.steps && typeof ham.steps === 'object') {
    steps = {};
    PROJE_ADIMLARI.forEach(k => { const b = mantik(ham.steps[k]); if (b !== undefined) steps[k] = b; });
  }
  if (ham.deadlines && typeof ham.deadlines === 'object') {
    deadlines = {};
    PROJE_ADIMLARI.forEach(k => {
      const d = ham.deadlines[k];
      if (d === undefined || d === null) return;
      if (d === '' ) { deadlines[k] = ''; return; }
      if (tarihGecerli(d)) deadlines[k] = d;
      else hatalar.push({ liste: 'projects', sira, alan: 'deadlines.' + k, sebep: 'not YYYY-MM-DD; dropped' });
    });
  }
  return temizNesne({
    id: kimlikAl(ham, hatalar, 'projects', sira),
    name: name.trim(),
    type,
    shootDate: shootDate === null ? undefined : shootDate,
    keywords: metin(ham.keywords, 200), notes: metin(ham.notes, 2000),
    address: metin(ham.address, 300),
    placeRefs: basvurular(ham.place, ham.places, 20),
    topic: metin(ham.topic, 300), city: metin(ham.city, 120), district: metin(ham.district, 120),
    format: metin(ham.format, 60), permission: metin(ham.permission, 300),
    scriptUrl: metin(ham.scriptUrl, 600), driveUrl: metin(ham.driveUrl, 600), mapsUrl: metin(ham.mapsUrl, 600),
    fieldNotes: metin(ham.fieldNotes, 4000), cautions: metin(ham.cautions, 4000), shotList: metin(ham.shotList, 4000),
    cancelled: mantik(ham.cancelled),
    steps, deadlines
  });
}

// Cok dilli baslik/aciklama. YouTube tek videoya birden cok dilde baslik
// tasiyor; kayit bunlari content.diller altinda tutuyor.
//
// Sinirlar app.html'deki sanitizeEvent ile AYNI olmak zorunda: burada
// gecen ama orada dusen bir alan, kullaniciya "aktarildi" denip sonra
// sessizce kaybolur.
function dillerOku(c, sira, hatalar) {
  if (!c.diller || typeof c.diller !== 'object' || Array.isArray(c.diller)) return undefined;
  const cikti = {};
  let sayi = 0;
  Object.keys(c.diller).forEach(k => {
    if (!/^[a-z]{2}$/.test(k)) {
      hatalar.push({ liste: 'entries', sira, alan: `content.diller.${k}`,
                     sebep: 'language key must be a two-letter code; dropped' });
      return;
    }
    const d = c.diller[k];
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      hatalar.push({ liste: 'entries', sira, alan: `content.diller.${k}`,
                     sebep: 'must be an object; dropped' });
      return;
    }
    if (sayi >= 8) {
      hatalar.push({ liste: 'entries', sira, alan: `content.diller.${k}`,
                     sebep: 'at most 8 languages; dropped' });
      return;
    }
    const t = temizNesne({
      videoTitle: metin(d.videoTitle, 300), caption: metin(d.caption, 5000),
      hashtags: metin(d.hashtags, 1000), shortTitle: metin(d.shortTitle, 300)
    });
    // Bos dil dusuyor: sekmesi acilip hicbir sey yazilmamis bir dil
    // damgada gorunup kullaniciyi yaniltir.
    if (Object.keys(t).some(a => (t[a] || '').trim())) { cikti[k] = t; sayi++; }
  });
  return sayi ? cikti : undefined;
}

// Ana dil: cevirilerin hangi dilden yapildigi. Gecersiz deger sessizce
// dusmuyor, hatalar listesine yaziliyor -- dosyadaki oteki alanlarin
// (timezone, type, id) davranisiyla ayni.
function anaDilOku(c, sira, hatalar) {
  const v = metin(c.anaDil, 8);
  if (v === undefined || v === '') return undefined;
  if (/^[a-z]{2}$/.test(v)) return v;
  hatalar.push({ liste: 'entries', sira, alan: 'content.anaDil',
                 sebep: 'must be a two-letter language code; dropped' });
  return undefined;
}

function kayitOku(ham, sira, hatalar) {
  const date = tarih(ham.date);
  if (!date) { hatalar.push({ liste: 'entries', sira, alan: 'date', sebep: 'date is required, YYYY-MM-DD' }); return null; }
  let platform = metin(ham.platform, 20);
  platform = platform === undefined ? undefined : platform.trim().toLowerCase();
  if (platform === undefined || !PLATFORMLAR.includes(platform)) {
    hatalar.push({ liste: 'entries', sira, alan: 'platform', sebep: `platform "${platform ?? ''}" is not one of ${PLATFORMLAR.join(', ')}` });
    return null;
  }
  let type = metin(ham.type, 20);
  type = type === undefined ? 'video' : type.trim().toLowerCase();
  if (!CAL_TYPES.includes(type)) {
    hatalar.push({ liste: 'entries', sira, alan: 'type', sebep: `unknown type "${type}"; using video` });
    type = 'video';
  }
  const time = saat(ham.time);
  if (time === null) hatalar.push({ liste: 'entries', sira, alan: 'time', sebep: 'not HH:MM; dropped' });
  let content;
  if (ham.content && typeof ham.content === 'object') {
    const c = ham.content;
    const tz = metin(c.timezone, 64);
    if (tz && !tzGecerli(tz)) hatalar.push({ liste: 'entries', sira, alan: 'content.timezone', sebep: 'not an IANA time zone; dropped' });
    content = temizNesne({
      caption: metin(c.caption, 5000), hashtags: metin(c.hashtags, 1000),
      videoTitle: metin(c.videoTitle, 300), shortTitle: metin(c.shortTitle, 300),
      thumbPrompt: metin(c.thumbPrompt, 5000),
      slidePrompts: Array.isArray(c.slidePrompts)
        ? c.slidePrompts.slice(0, 9).map(x => typeof x === 'string' ? x.slice(0, 2000) : '') : undefined,
      timezone: tz && tzGecerli(tz) ? tz : undefined,
      diller: dillerOku(c, sira, hatalar),
      anaDil: anaDilOku(c, sira, hatalar),
      // Hesap etiketi. Paketi ureten AI kullanicinin hesap KIMLIKLERINI
      // bilemez; ad da kabul ediliyor ve uygulama ice aktarirken ada gore
      // cozuyor (projeler ve mekanlarla ayni kalip). Burada yalnizca
      // tasiniyor: gecerli bir kimlik degilse ad olarak birakiliyor,
      // eslesmezse uygulama sessizce bos birakir.
      hesapId: metin(c.hesapId, 64),
      hesap: metin(c.hesap, 80)
    });
  }
  const projectRef = basvurular(ham.project, undefined, 1);
  return temizNesne({
    id: kimlikAl(ham, hatalar, 'entries', sira),
    date, time: time === null ? undefined : time, type, platform,
    title: metin(ham.title, 300),
    projectRef: projectRef ? projectRef[0] : undefined,
    uploaded: mantik(ham.uploaded),
    content
  });
}

function scriptOku(ham, sira, hatalar) {
  const title = metin(ham.title, 160), text = metin(ham.text, 40000);
  if (!(title && title.trim()) && !(text && text.trim())) {
    hatalar.push({ liste: 'scripts', sira, alan: 'text', sebep: 'title or text is required' }); return null;
  }
  return temizNesne({
    id: kimlikAl(ham, hatalar, 'scripts', sira),
    title, text,
    projectRefs: basvurular(ham.project, ham.projects, 20)
  });
}

function fikirOku(ham, sira, hatalar) {
  const text = metin(ham.text, 600);
  if (!text || !text.trim()) { hatalar.push({ liste: 'ideas', sira, alan: 'text', sebep: 'text is required' }); return null; }
  const due = tarih(ham.due);
  if (due === null) hatalar.push({ liste: 'ideas', sira, alan: 'due', sebep: 'not YYYY-MM-DD; dropped' });
  return temizNesne({
    id: kimlikAl(ham, hatalar, 'ideas', sira),
    text: text.trim(),
    projectRefs: basvurular(ham.project, ham.projects, 20),
    due: due === null ? undefined : due,
    done: mantik(ham.done)
  });
}

const OKUYUCU = { places: mekanOku, projects: projeOku, entries: kayitOku, scripts: scriptOku, ideas: fikirOku };

// ---- paket ----------------------------------------------------------------
// Dönen: { ok, source, note, places, projects, entries, scripts, ideas,
//          hatalar: [{liste, sira, alan, sebep}], toplam }
// ok=false yalnızca paketin kendisi okunamadığında (nesne değil, sınır
// aşıldı); öğe düzeyindeki sorunlar hatalar listesinde, öğe atlanır ya da
// alan düşer, gerisi alınır.
function paketiCoz(ham) {
  const sonuc = { ok: true, source: '', note: '', places: [], projects: [], entries: [], scripts: [], ideas: [], hatalar: [], toplam: 0 };
  if (!ham || typeof ham !== 'object' || Array.isArray(ham)) {
    return { ...sonuc, ok: false, hatalar: [{ liste: '', sira: -1, alan: '', sebep: 'package must be a JSON object' }] };
  }
  sonuc.source = (metin(ham.source, 60) || metin(ham.kaynak, 60) || '').trim();
  sonuc.note = (metin(ham.note, 300) || metin(ham.not, 300) || '').trim();
  let toplam = 0;
  LISTELER.forEach(([ad, takma]) => {
    let liste = ham[ad] !== undefined ? ham[ad] : ham[takma];
    if (liste === undefined || liste === null) return;
    if (!Array.isArray(liste)) { sonuc.hatalar.push({ liste: ad, sira: -1, alan: '', sebep: ad + ' must be an array' }); return; }
    if (liste.length > SINIRLAR.liste[ad]) {
      sonuc.hatalar.push({ liste: ad, sira: -1, alan: '', sebep: `${ad}: at most ${SINIRLAR.liste[ad]} per package; extra items ignored` });
      liste = liste.slice(0, SINIRLAR.liste[ad]);
    }
    liste.forEach((h, i) => {
      if (!h || typeof h !== 'object' || Array.isArray(h)) { sonuc.hatalar.push({ liste: ad, sira: i, alan: '', sebep: 'item must be an object' }); return; }
      const o = OKUYUCU[ad](h, i, sonuc.hatalar);
      if (o) { o.sira = i; sonuc[ad].push(o); toplam++; }
    });
  });
  sonuc.toplam = toplam;
  if (toplam > SINIRLAR.paket) {
    sonuc.ok = false;
    sonuc.hatalar.unshift({ liste: '', sira: -1, alan: '', sebep: `a package holds at most ${SINIRLAR.paket} items (got ${toplam}); split it` });
  }
  if (!toplam && sonuc.ok) {
    sonuc.ok = false;
    sonuc.hatalar.unshift({ liste: '', sira: -1, alan: '', sebep: 'nothing to import: no places, projects, entries, scripts or ideas' });
  }
  return sonuc;
}

// Ad ya da kimlikle proje/mekan bulma. `olanlar`: [{id, name}] (hesaptakiler
// + bu pakette yaratılanlar). Önce kimlik, sonra tam ad. Bulunamazsa null.
function basvuruCoz(ref, olanlar) {
  if (!ref) return null;
  const s = String(ref).trim();
  const kimlikle = olanlar.find(x => x.id === s);
  if (kimlikle) return kimlikle;
  const k = adAnahtari(s);
  return olanlar.find(x => adAnahtari(x.name) === k) || null;
}

// ---- sema.ts ----

// ai/sema.json kopyası — elle düzenleme, birlestir.py üretir.
const SEMA = {
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://shootboard.app/ai/sema.json",
 "title": "Shootboard transfer package",
 "description": "A batch of content for a Shootboard account: calendar entries, projects (shoots), places, scripts and ideas. Produced by any AI assistant or tool. Either pasted into Shootboard (Import window) or sent to POST /import of the Shootboard AI API. Field names match Shootboard's own data model; Turkish top-level aliases (kayitlar, projeler, mekanlar, scriptler, fikirler) are accepted so a Shootboard backup file is also a valid package.",
 "type": "object",
 "properties": {
  "shootboard": {
   "type": "integer",
   "const": 1,
   "description": "Package format version. Always 1."
  },
  "source": {
   "type": "string",
   "maxLength": 60,
   "description": "Who produced the package, e.g. \"ChatGPT\", \"Claude\", \"Zapier\". Shown in the account's import log; used for the AI badge and undo."
  },
  "note": {
   "type": "string",
   "maxLength": 300,
   "description": "Optional one-line summary of what this batch is (\"September plan, 3 shoots\"). Shown in the import log."
  },
  "projects": {
   "type": "array",
   "maxItems": 100,
   "items": {
    "$ref": "#/$defs/Project"
   }
  },
  "places": {
   "type": "array",
   "maxItems": 100,
   "items": {
    "$ref": "#/$defs/Place"
   }
  },
  "entries": {
   "type": "array",
   "maxItems": 200,
   "items": {
    "$ref": "#/$defs/Entry"
   }
  },
  "scripts": {
   "type": "array",
   "maxItems": 50,
   "items": {
    "$ref": "#/$defs/Script"
   }
  },
  "ideas": {
   "type": "array",
   "maxItems": 100,
   "items": {
    "$ref": "#/$defs/Idea"
   }
  },
  "projeler": {
   "$ref": "#/properties/projects",
   "description": "Turkish alias of projects (backup file format)."
  },
  "mekanlar": {
   "$ref": "#/properties/places",
   "description": "Turkish alias of places."
  },
  "kayitlar": {
   "$ref": "#/properties/entries",
   "description": "Turkish alias of entries."
  },
  "scriptler": {
   "$ref": "#/properties/scripts",
   "description": "Turkish alias of scripts."
  },
  "fikirler": {
   "$ref": "#/properties/ideas",
   "description": "Turkish alias of ideas."
  }
 },
 "additionalProperties": true,
 "x-order": "Places are imported first, then projects (so a project can name its places), then entries, scripts and ideas (so they can name their project). Within one package a project may be referenced by name before it is created.",
 "x-limits": {
  "perPackage": 200,
  "perAccount": {
   "entries": "100 by default (trial accounts); the account's own limit is returned by GET /me",
   "projects": "100 by default",
   "places": 400,
   "scripts": 300,
   "ideas": 500
  }
 },
 "x-idempotency": "Projects and places are matched by name (case-insensitive, trimmed): sending the same name again updates that row instead of creating a second one. Entries, scripts and ideas have no natural key: sending them twice creates them twice, unless you set the same id both times. If you set ids, make them unique to this package (e.g. add a random suffix); an id that already belongs to another account is rejected.",
 "$defs": {
  "Id": {
   "type": "string",
   "pattern": "^[A-Za-z0-9_-]{1,64}$",
   "description": "Optional stable identifier. Omit it and Shootboard generates one; the response tells you which id each item received. Set it only when you want to resend the same item later to update it."
  },
  "DateYMD": {
   "type": "string",
   "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
   "description": "Calendar date, YYYY-MM-DD, in the creator's local calendar."
  },
  "TimeHM": {
   "type": "string",
   "pattern": "^\\d{2}:\\d{2}$",
   "description": "Local time of day, 24-hour HH:MM."
  },
  "ProjectRef": {
   "type": "string",
   "maxLength": 120,
   "description": "The project this item belongs to: the project's name (case-insensitive) or its id. When the name matches nothing in the account and nothing in this package, the item is still imported without a project link and a warning is returned. To create the project, include it in `projects`."
  },
  "Entry": {
   "type": "object",
   "description": "One planned post on the calendar: what goes out, where, when. Shootboard never publishes anything itself; `uploaded` is a checkbox the creator ticks after posting by hand.",
   "required": [
    "date",
    "platform"
   ],
   "properties": {
    "id": {
     "$ref": "#/$defs/Id"
    },
    "date": {
     "$ref": "#/$defs/DateYMD"
    },
    "time": {
     "$ref": "#/$defs/TimeHM"
    },
    "type": {
     "type": "string",
     "enum": [
      "video",
      "shorts",
      "reels",
      "carousel",
      "story",
      "text_post",
      "poll"
     ],
     "default": "video",
     "description": "Post format. video = long-form (YouTube video, Facebook video); shorts = YouTube Shorts; reels = Instagram/Facebook Reels or TikTok clip; carousel = multi-image post; story = 24-hour story; text_post = text-only post (Threads, X, LinkedIn, Facebook); poll = poll post. Unknown values fall back to video."
    },
    "platform": {
     "type": "string",
     "enum": [
      "youtube",
      "instagram",
      "tiktok",
      "facebook",
      "threads",
      "x",
      "pinterest",
      "linkedin"
     ],
     "description": "Where it will be posted. One entry per platform: a video announced on four platforms is four entries. Unknown values fall back to youtube."
    },
    "title": {
     "type": "string",
     "maxLength": 300,
     "description": "Short label shown on the calendar card. Keep it under ~60 characters."
    },
    "project": {
     "$ref": "#/$defs/ProjectRef"
    },
    "uploaded": {
     "type": "boolean",
     "default": false,
     "description": "Already posted. Leave false for anything planned."
    },
    "content": {
     "type": "object",
     "description": "What actually goes out. All optional.",
     "properties": {
      "caption": {
       "type": "string",
       "maxLength": 5000,
       "description": "Post text / description for this platform."
      },
      "hashtags": {
       "type": "string",
       "maxLength": 1000,
       "description": "Hashtags as one string, space separated, each starting with #."
      },
      "videoTitle": {
       "type": "string",
       "maxLength": 300,
       "description": "YouTube video title (long-form)."
      },
      "shortTitle": {
       "type": "string",
       "maxLength": 300,
       "description": "Title for shorts / reels."
      },
      "thumbPrompt": {
       "type": "string",
       "maxLength": 5000,
       "description": "Thumbnail idea or image-generation prompt."
      },
      "slidePrompts": {
       "type": "array",
       "maxItems": 9,
       "items": {
        "type": "string",
        "maxLength": 2000
       },
       "description": "Carousel only: one prompt/description per slide, in order."
      },
      "timezone": {
       "type": "string",
       "maxLength": 64,
       "description": "IANA time zone the date/time are given in (e.g. Europe/Istanbul). Leave empty for the creator's own zone."
      },
      "hesap": {
       "type": "string",
       "maxLength": 80,
       "description": "Which of the creator's own accounts on that platform this post goes to, BY NAME (e.g. \"Kişisel\", \"Marka\"). Only useful when the creator has more than one account on the same platform. This is a label the creator typed in Shootboard, not a connection: Shootboard never signs in to any account and never posts anything. Unknown names are ignored."
      },
      "hesapId": {
       "type": "string",
       "maxLength": 64,
       "description": "The account's id, if you happen to know it (e.g. it came from an export). Prefer \"hesap\" with the name; the id is resolved from the name on import."
      },
      "anaDil": {
       "type": "string",
       "pattern": "^[a-z]{2}$",
       "description": "Two-letter code of the language the main videoTitle/caption/hashtags/shortTitle are written in (e.g. tr). Only meaningful together with diller."
      },
      "diller": {
       "type": "object",
       "maxProperties": 8,
       "propertyNames": {
        "pattern": "^[a-z]{2}$"
       },
       "additionalProperties": {
        "type": "object",
        "properties": {
         "videoTitle": {
          "type": "string",
          "maxLength": 300
         },
         "caption": {
          "type": "string",
          "maxLength": 5000
         },
         "hashtags": {
          "type": "string",
          "maxLength": 1000
         },
         "shortTitle": {
          "type": "string",
          "maxLength": 300
         }
        },
        "additionalProperties": false
       },
       "description": "Extra languages for the same post, keyed by two-letter code (e.g. en, de). The main language stays in the plain content fields; only the translations go here. YouTube shows each viewer the title and description in their own language, so this is used for YouTube long-form video and Shorts. Empty languages are dropped."
      }
     },
     "additionalProperties": false
    }
   },
   "additionalProperties": false
  },
  "Project": {
   "type": "object",
   "description": "A shoot: one filming effort that later becomes many posts. Entries, scripts and ideas link to it by name.",
   "required": [
    "name"
   ],
   "properties": {
    "id": {
     "$ref": "#/$defs/Id"
    },
    "name": {
     "type": "string",
     "minLength": 1,
     "maxLength": 120,
     "description": "Unique within the account (case-insensitive). Reusing a name updates that project."
    },
    "type": {
     "type": "string",
     "enum": [
      "outdoor",
      "venue",
      "studio",
      "vlog",
      "review",
      "desk",
      "other"
     ],
     "default": "other",
     "description": "Where the work happens. outdoor = on location outside; venue = inside a place (museum, shop, restaurant); studio; vlog; review = product review; desk = screen/desk work; other. Outdoor and venue shoots expect an address or a place."
    },
    "shootDate": {
     "$ref": "#/$defs/DateYMD",
     "description": "Planned filming day."
    },
    "keywords": {
     "type": "string",
     "maxLength": 200,
     "description": "Search terms / tags for this shoot, comma separated."
    },
    "notes": {
     "type": "string",
     "maxLength": 2000
    },
    "address": {
     "type": "string",
     "maxLength": 300,
     "description": "Free-text address when the shoot is not tied to a saved place."
    },
    "places": {
     "type": "array",
     "maxItems": 20,
     "items": {
      "type": "string",
      "maxLength": 160
     },
     "description": "Ordered stops of the shoot, each a place name (case-insensitive) or place id. Names that match nothing are reported as warnings; add them to `places` in the same package to create them."
    },
    "topic": {
     "type": "string",
     "maxLength": 300,
     "description": "What the video is about."
    },
    "city": {
     "type": "string",
     "maxLength": 120
    },
    "district": {
     "type": "string",
     "maxLength": 120
    },
    "format": {
     "type": "string",
     "maxLength": 60,
     "description": "Free text: documentary, interview, walk-and-talk..."
    },
    "permission": {
     "type": "string",
     "maxLength": 300,
     "description": "Filming permission status / who to ask."
    },
    "scriptUrl": {
     "type": "string",
     "maxLength": 600,
     "format": "uri"
    },
    "driveUrl": {
     "type": "string",
     "maxLength": 600,
     "format": "uri"
    },
    "mapsUrl": {
     "type": "string",
     "maxLength": 600,
     "format": "uri"
    },
    "fieldNotes": {
     "type": "string",
     "maxLength": 4000
    },
    "cautions": {
     "type": "string",
     "maxLength": 4000,
     "description": "Things to watch out for on the day."
    },
    "shotList": {
     "type": "string",
     "maxLength": 4000,
     "description": "Shots to get, one per line."
    },
    "cancelled": {
     "type": "boolean",
     "default": false
    },
    "steps": {
     "type": "object",
     "description": "Production checklist. true = done.",
     "properties": {
      "script": {
       "type": "boolean"
      },
      "filmed": {
       "type": "boolean"
      },
      "audio": {
       "type": "boolean"
      },
      "edited": {
       "type": "boolean"
      },
      "approved": {
       "type": "boolean"
      },
      "package": {
       "type": "boolean"
      },
      "published": {
       "type": "boolean"
      }
     },
     "additionalProperties": false
    },
    "deadlines": {
     "type": "object",
     "description": "Optional due date per checklist step, YYYY-MM-DD.",
     "properties": {
      "script": {
       "$ref": "#/$defs/DateYMD"
      },
      "filmed": {
       "$ref": "#/$defs/DateYMD"
      },
      "audio": {
       "$ref": "#/$defs/DateYMD"
      },
      "edited": {
       "$ref": "#/$defs/DateYMD"
      },
      "approved": {
       "$ref": "#/$defs/DateYMD"
      },
      "package": {
       "$ref": "#/$defs/DateYMD"
      },
      "published": {
       "$ref": "#/$defs/DateYMD"
      }
     },
     "additionalProperties": false
    }
   },
   "additionalProperties": false
  },
  "Place": {
   "type": "object",
   "description": "A filming location that is reused across shoots: address, permission notes, what to watch out for.",
   "required": [
    "name"
   ],
   "properties": {
    "id": {
     "$ref": "#/$defs/Id"
    },
    "name": {
     "type": "string",
     "minLength": 1,
     "maxLength": 160,
     "description": "Unique within the account (case-insensitive). Reusing a name updates that place."
    },
    "city": {
     "type": "string",
     "maxLength": 120
    },
    "district": {
     "type": "string",
     "maxLength": 120
    },
    "address": {
     "type": "string",
     "maxLength": 400,
     "description": "Street address. Do not invent one; leave empty if unknown, the creator can look it up in Shootboard."
    },
    "country": {
     "type": "string",
     "maxLength": 80
    },
    "lat": {
     "type": "number",
     "minimum": -85,
     "maximum": 85
    },
    "lon": {
     "type": "number",
     "minimum": -180,
     "maximum": 180
    },
    "timezone": {
     "type": "string",
     "maxLength": 64,
     "description": "IANA time zone of the place."
    },
    "mapsUrl": {
     "type": "string",
     "maxLength": 600,
     "format": "uri",
     "description": "Google Maps / OpenStreetMap link."
    },
    "driveUrl": {
     "type": "string",
     "maxLength": 600,
     "format": "uri"
    },
    "permission": {
     "type": "string",
     "maxLength": 400,
     "description": "Who grants filming permission, what it costs, how long it takes."
    },
    "cautions": {
     "type": "string",
     "maxLength": 2000
    },
    "notes": {
     "type": "string",
     "maxLength": 4000
    }
   },
   "additionalProperties": false
  },
  "Script": {
   "type": "object",
   "description": "A script or long text for a shoot. Stored with source = \"ai\" so the creator can see where it came from.",
   "anyOf": [
    {
     "required": [
      "title"
     ]
    },
    {
     "required": [
      "text"
     ]
    }
   ],
   "properties": {
    "id": {
     "$ref": "#/$defs/Id"
    },
    "title": {
     "type": "string",
     "maxLength": 160
    },
    "text": {
     "type": "string",
     "maxLength": 40000,
     "description": "Plain text or light Markdown. Keep scene headings and speaker labels as plain lines."
    },
    "project": {
     "$ref": "#/$defs/ProjectRef"
    },
    "projects": {
     "type": "array",
     "maxItems": 20,
     "items": {
      "$ref": "#/$defs/ProjectRef"
     },
     "description": "A script can belong to several shoots. Overrides `project` when given."
    }
   },
   "additionalProperties": false
  },
  "Idea": {
   "type": "object",
   "description": "A loose idea on the ideas board. Short. Can be turned into a shoot later.",
   "required": [
    "text"
   ],
   "properties": {
    "id": {
     "$ref": "#/$defs/Id"
    },
    "text": {
     "type": "string",
     "minLength": 1,
     "maxLength": 600,
     "description": "One idea, a sentence or two."
    },
    "project": {
     "$ref": "#/$defs/ProjectRef"
    },
    "projects": {
     "type": "array",
     "maxItems": 20,
     "items": {
      "$ref": "#/$defs/ProjectRef"
     }
    },
    "due": {
     "$ref": "#/$defs/DateYMD",
     "description": "Optional: gives the idea a due date, turning it into a to-do."
    },
    "done": {
     "type": "boolean",
     "default": false
    }
   },
   "additionalProperties": false
  }
 },
 "examples": [
  {
   "shootboard": 1,
   "source": "ChatGPT",
   "note": "Istanbul hans: one shoot, four posts",
   "places": [
    {
     "name": "Büyük Valide Han",
     "city": "İstanbul",
     "district": "Fatih",
     "permission": "Ask the han management on the ground floor; rooftop needs the caretaker."
    }
   ],
   "projects": [
    {
     "name": "Hanlar bölgesi",
     "type": "venue",
     "shootDate": "2026-09-20",
     "topic": "The last working hans of the old city",
     "places": [
      "Büyük Valide Han"
     ],
     "shotList": "Rooftop pan at golden hour\nCourtyard wide\nCraftsman hands close-up"
    }
   ],
   "entries": [
    {
     "date": "2026-09-27",
     "time": "19:00",
     "type": "video",
     "platform": "youtube",
     "title": "Hans of Istanbul",
     "project": "Hanlar bölgesi",
     "content": {
      "videoTitle": "The Last Working Hans of Istanbul",
      "caption": "Four centuries of trade under one roof...",
      "hashtags": "#istanbul #history #documentary"
     }
    },
    {
     "date": "2026-09-27",
     "time": "19:30",
     "type": "reels",
     "platform": "instagram",
     "title": "Hans teaser",
     "project": "Hanlar bölgesi",
     "content": {
      "shortTitle": "Rooftop of a 400-year-old han",
      "caption": "Full film on YouTube tonight."
     }
    },
    {
     "date": "2026-09-28",
     "time": "12:00",
     "type": "text_post",
     "platform": "threads",
     "title": "Hans thread",
     "project": "Hanlar bölgesi",
     "content": {
      "caption": "Three things I did not know about hans before this shoot:"
     }
    }
   ],
   "scripts": [
    {
     "title": "Hanlar bölgesi — voice-over v1",
     "text": "COLD OPEN\nRooftop, golden hour.\nNARRATOR: Four hundred years ago...",
     "project": "Hanlar bölgesi"
    }
   ],
   "ideas": [
    {
     "text": "Follow one craftsman for a full day; separate short film.",
     "project": "Hanlar bölgesi"
    }
   ]
  }
 ]
};

// ---- index.ts ----

// Shootboard MCP sunucusu — Supabase Edge Function.
//
// NE YAPAR. Claude'u (ya da MCP konuşan başka bir istemciyi) kullanıcının
// içerik takvimine bağlar: takvimi OKUR, paket YAZAR, tek kaydı GÜNCELLER.
// Böylece asistan "hangi gün boş" sorusunu kullanıcıya sormadan cevaplar
// ve ürettiği paketi elle yapıştırmaya gerek kalmadan hesaba yazar.
//
// SİLME UCU YOK ve eklenmeyecek. Kullanıcı kararı: "Claude'un takvimden
// kayıt silmesini istemiyorum." Geri alma uygulamanın kendi ekranından
// yapılıyor; bu fonksiyonun yazdığı defter satırı onu besliyor.
//
// ---- Kimlik: anahtar ADRESİN İÇİNDE -------------------------------------
// claude.ai'ın "özel connector ekle" penceresinde API anahtarı
// yapıştırılacak bir kutu yok; yalnızca URL ve gelişmiş ayarlarda OAuth
// var. Tam bir OAuth sunucusu (authorize, token, istemci kaydı, onay
// ekranı) bu işin geri kalanından büyük olduğu için anahtar yolun bir
// parçası:
//
//   https://<proje>.supabase.co/functions/v1/mcp/shb_xxxxxxxx
//
// Bunun doğrudan sonucu: BU ADRES BİR SIRDIR. Yazma yetkisi taşıyor,
// paylaşılmaz. Uygulamadaki ekran bunu açıkça yazıyor, iptal düğmesi
// anahtarın yanında duruyor. Geriye dönük uyum için Authorization başlığı
// ve x-api-key de kabul ediliyor (curl ile denemek isteyen için).
//
// ---- Protokol: iki sürüm birden -----------------------------------------
// MCP taşıması "Streamable HTTP": tek uç, POST zorunlu, GET isteğe bağlı
// (desteklenmiyorsa 405). İki farklı istemci davranışı var ve hangisiyle
// karşılaşacağımızı garanti edemeyiz:
//
//   2025-11-25 ve öncesi : initialize + notifications/initialized el
//                          sıkışması, sonra tools/list, tools/call.
//   2026-07-28 ve sonrası: el sıkışma YOK (durumsuz), server/discover +
//                          tools/list + tools/call; yönlendirme için
//                          Mcp-Method / Mcp-Name başlıkları.
//
// İkisi de karşılanıyor. protocolVersion olarak istemcinin istediği sürüm
// tanıdıksa aynen geri veriliyor, değilse kendi varsayılanımız. Yönlendirme
// başlıkları okunuyor ama DAYATILMIYOR: onlar ara katmanlar için, bizim
// için gövde yeterli ve katı davranmak uyumu kırar.
//
// ---- Ortak kod ------------------------------------------------------------
// Doğrulama ve yazma mantığı sıfırdan yazılmadı: sql/35 döneminde yazılan
// ve sql/36 ile kaldırılan Edge Function'ın aynısı. Kaldırılma gerekçesi
// "anahtarı bağlayacak bir yer yok" idi; MCP tam olarak o eksik parça.
// paketiCoz() ai/dogrula.js'in kopyası -- İçe Aktar penceresi de AYNI
// doğrulayıcıyı çalıştırıyor, iki ayrı doğruluk olmasın diye.
//
// Gizli ayar GEREKMEZ: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase
// tarafından fonksiyona kendiliğinden verilir.
//
// Dağıtım: supabase functions deploy mcp --no-verify-jwt
// (--no-verify-jwt şart: çağıran taraf Supabase oturumu değil, bizim
//  anahtarımızı taşıyor.)
//
// Önce sql/39-mcp-erisimi.sql çalıştırılmış olmalı (api_keys geri gelir,
// defterde tekrar koruması sütunu açılır). Kurulum: README.md.


const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVIS_ANAHTARI = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SURUM = '1.0.0';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
  'Access-Control-Max-Age': '86400'
};

function json(govde: unknown, durum = 200): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
function hata(durum: number, kod: string, mesaj: string, ek: Record<string, unknown> = {}): Response {
  return json({ ok: false, error: kod, message: mesaj, ...ek }, durum);
}

// ---- PostgREST ------------------------------------------------------------
class RestHata extends Error {
  durum: number; govde: any;
  constructor(durum: number, govde: any) {
    super(typeof govde === 'object' && govde && govde.message ? govde.message : ('rest ' + durum));
    this.durum = durum; this.govde = govde;
  }
}
async function rest(yol: string, secenek: { method?: string; govde?: unknown; prefer?: string; baslik?: Record<string, string> } = {}) {
  const h = new Headers({
    'apikey': SERVIS_ANAHTARI,
    'Authorization': `Bearer ${SERVIS_ANAHTARI}`,
    'Content-Type': 'application/json',
    ...(secenek.baslik || {})
  });
  if (secenek.prefer) h.set('Prefer', secenek.prefer);
  const r = await fetch(`${SUPABASE_URL}/rest/v1${yol}`, {
    method: secenek.method || 'GET',
    headers: h,
    body: secenek.govde === undefined ? undefined : JSON.stringify(secenek.govde)
  });
  const metin = await r.text();
  let veri: any = null;
  try { veri = metin ? JSON.parse(metin) : null; } catch { veri = metin; }
  if (!r.ok) throw new RestHata(r.status, veri);
  return { veri, baslik: r.headers };
}
// Satır sayısı, satırları çekmeden.
async function sayim(tablo: string, suzgec: string): Promise<number> {
  const { baslik } = await rest(`/${tablo}?select=id&${suzgec}&limit=1`, { prefer: 'count=exact' });
  const cr = baslik.get('content-range') || '';
  const n = Number(cr.split('/')[1]);
  return Number.isFinite(n) ? n : 0;
}
// Eksik sütun yüzünden bütün yazma durmasın (sql/33, sql/34 henüz
// çalıştırılmamış olabilir). PostgREST "Could not find the 'x' column"
// deyince o sütun satırlardan çıkarılıp yeniden denenir.
async function yazYinele(tablo: string, satirlar: any[], prefer: string): Promise<any[]> {
  let deneme = 0;
  let rows = satirlar;
  while (true) {
    try {
      const { veri } = await rest(`/${tablo}`, { method: 'POST', govde: rows, prefer });
      return Array.isArray(veri) ? veri : [];
    } catch (e) {
      const m = e instanceof RestHata ? String(e.message || '') : '';
      const es = /Could not find the '([A-Za-z0-9_]+)' column/.exec(m);
      if (!es || deneme++ > 6) throw e;
      const sutun = es[1];
      console.warn(`[ai] ${tablo}.${sutun} sütunu yok, o alan olmadan yeniden deneniyor`);
      rows = rows.map(r => { const k = { ...r }; delete k[sutun]; return k; });
    }
  }
}
function simdi(): string { return new Date().toISOString(); }
function idListesi(ids: string[]): string { return `id=in.(${ids.join(',')})`; }

// ---- Kimlik ---------------------------------------------------------------
async function sha256(metin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(metin));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
type Kim = { id: string; user_id: string; scopes: string[]; last_used_at: string | null };
// Anahtar UC yerden gelebilir, bu sirayla:
//   1. Yolun icinden: /functions/v1/mcp/shb_xxx  -- claude.ai icin TEK yol,
//      cunku orada API anahtari yapistirilacak bir kutu yok.
//   2. Authorization: Bearer shb_xxx  -- curl ile denemek icin.
//   3. x-api-key  -- eski istemciler icin.
async function kimBu(req: Request, yol = ''): Promise<Kim | null> {
  let anahtar = '';
  const yoldan = /^\/(shb_[A-Za-z0-9]{20,80})$/.exec(yol || '');
  if (yoldan) anahtar = yoldan[1];
  if (!anahtar) {
    const auth = req.headers.get('authorization') || '';
    if (/^bearer\s+/i.test(auth)) anahtar = auth.replace(/^bearer\s+/i, '').trim();
  }
  if (!anahtar) anahtar = (req.headers.get('x-api-key') || '').trim();
  if (!anahtar || !/^shb_[A-Za-z0-9]{20,80}$/.test(anahtar)) return null;
  const ozet = await sha256(anahtar);
  const { veri } = await rest(`/api_keys?key_hash=eq.${ozet}&revoked_at=is.null&select=id,user_id,scopes,last_used_at&limit=1`);
  const k = Array.isArray(veri) && veri[0];
  if (!k) return null;
  // Son kullanım: beş dakikada bir yazılır, her istekte değil.
  const son = k.last_used_at ? Date.parse(k.last_used_at) : 0;
  if (Date.now() - son > 5 * 60 * 1000) {
    try { await rest(`/api_keys?id=eq.${k.id}`, { method: 'PATCH', govde: { last_used_at: simdi() }, prefer: 'return=minimal' }); }
    catch (e) { console.warn('[ai] last_used_at yazılamadı', e); }
  }
  return { id: k.id, user_id: k.user_id, scopes: Array.isArray(k.scopes) ? k.scopes : ['read', 'write'], last_used_at: k.last_used_at };
}

// ---- Dışarı verilen biçimler ---------------------------------------------
function projeAdi(id: string | null | undefined, projeler: any[]): string {
  if (!id) return '';
  const p = projeler.find(x => x.id === id);
  return p ? p.name : '';
}
function kayitDisari(r: any, projeler: any[]) {
  const c = (r.content && typeof r.content === 'object') ? r.content : {};
  const pid = r.project_id || c.projectId || '';
  return { id: r.id, date: r.post_date, time: (r.post_time || '').slice(0, 5), type: r.type, platform: r.platform,
           title: r.title || '', uploaded: !!r.uploaded, project: projeAdi(pid, projeler) || c.concept || '', projectId: pid,
           content: kayitIcerigi(c) };
}
// content'in disariya verilen hali. ai/sema.json'daki Entry.content ile
// AYNI alan kumesi olmali: bir alan burada eksik kalirsa asistan onu hic
// gormez, "yok" sanip ustune yazar. dogrula.js'te tam olarak bu oldu --
// diller ve anaDil beyaz listede yoktu ve her yuklemede sessizce dusuyordu.
// Orasi duzeltildi; burasi da ayni listeyi tasimali.
function kayitIcerigi(c: any) {
  const o: any = {
    caption: c.caption || '', hashtags: c.hashtags || '', videoTitle: c.videoTitle || '',
    shortTitle: c.shortTitle || '', thumbPrompt: c.thumbPrompt || '',
    slidePrompts: Array.isArray(c.slidePrompts) ? c.slidePrompts : [],
    timezone: c.timezone || ''
  };
  // Bos olanlar JSON'a HIC yazilmiyor: cevirisi olmayan kayit bos bir
  // "diller" tasimasin, asistan "burada bir sey var" sanmasin.
  if (c.diller && typeof c.diller === 'object' && !Array.isArray(c.diller)
      && Object.keys(c.diller).length) o.diller = c.diller;
  if (c.anaDil) o.anaDil = c.anaDil;
  if (c.hesapId) o.hesapId = c.hesapId;
  if (c.hesap) o.hesap = c.hesap;
  return o;
}
function projeDisari(r: any, mekanlar: any[]) {
  const ids: string[] = Array.isArray(r.place_ids) && r.place_ids.length ? r.place_ids : (r.place_id ? [r.place_id] : []);
  return { id: r.id, name: r.name || '', type: r.type || 'other', shootDate: r.start_date || '', keywords: r.keywords || '',
           notes: r.notes || '', address: r.address || '',
           places: ids.map(id => { const m = mekanlar.find(x => x.id === id); return m ? m.name : id; }), placeIds: ids,
           topic: r.topic || '', city: r.city || '', district: r.district || '', format: r.format || '', permission: r.permission || '',
           scriptUrl: r.script_url || '', driveUrl: r.drive_url || '', mapsUrl: r.maps_url || '',
           fieldNotes: r.field_notes || '', cautions: r.cautions || '', shotList: r.shot_list || '',
           cancelled: r.cancelled === true, steps: r.steps || {}, deadlines: r.deadlines || {}, createdAt: r.created_at || null };
}

async function projeleriOku(uid: string) {
  const { veri } = await rest(`/projects?user_id=eq.${uid}&deleted_at=is.null&select=*&order=created_at.asc`);
  return Array.isArray(veri) ? veri : [];
}
async function mekanlariOku(uid: string) {
  const { veri } = await rest(`/places?user_id=eq.${uid}&deleted_at=is.null&select=*&order=name.asc`);
  return Array.isArray(veri) ? veri : [];
}
async function sinirlar(uid: string) {
  let entry = SINIRLAR.hesap.entries, project = SINIRLAR.hesap.projects, lang = '';
  try {
    const { veri } = await rest(`/user_prefs?user_id=eq.${uid}&select=entry_limit,project_limit,prefs&limit=1`);
    const s = Array.isArray(veri) && veri[0];
    const oku = (v: unknown, varsayilan: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : varsayilan; };
    if (s) { entry = oku(s.entry_limit, entry); project = oku(s.project_limit, project); lang = (s.prefs && s.prefs.lang) || ''; }
  } catch (e) { console.warn('[ai] user_prefs okunamadı', e); }
  return { entries: entry, projects: project, places: SINIRLAR.hesap.places, scripts: SINIRLAR.hesap.scripts, ideas: SINIRLAR.hesap.ideas, lang };
}

// ---- Aktarım ---------------------------------------------------------------
const TABLO: Record<string, string> = { entries: 'calendar_events', projects: 'projects', places: 'places', scripts: 'scripts', ideas: 'ideas' };
const DEFTER_SUTUNU: Record<string, string> = { entries: 'kayitlar', projects: 'projeler', places: 'mekanlar', scripts: 'scriptler', ideas: 'fikirler' };

type Uyari = { list: string; index: number; message: string };

// Verilen kimlikleri tek sorguda getir; başkasınınsa reddet.
async function sahiplik(liste: string, ogeler: any[], uid: string, uyarilar: Uyari[]) {
  const ids = ogeler.map(o => o.id).filter(Boolean);
  const sahip: Record<string, any> = {};
  if (!ids.length) return sahip;
  const { veri } = await rest(`/${TABLO[liste]}?${idListesi(ids)}&select=*`);
  (Array.isArray(veri) ? veri : []).forEach((r: any) => { sahip[r.id] = r; });
  ogeler.forEach(o => {
    if (!o.id) return;
    const r = sahip[o.id];
    if (r && r.user_id !== uid) {
      uyarilar.push({ list: liste, index: o.sira, message: `id "${o.id}" belongs to another account; item skipped. Omit the id.` });
      o.atla = true;
    }
  });
  return sahip;
}
function birlesikJson(eski: any, yeni: any) {
  return { ...((eski && typeof eski === 'object') ? eski : {}), ...((yeni && typeof yeni === 'object') ? yeni : {}) };
}

// ozet: paketin icerik ozeti ya da cagiranin verdigi idempotency anahtari.
// null ise tekrar korumasi YOK (yapistirma yolunda oyleydi).
async function aktar(kim: Kim, ham: unknown, ozet: string | null = null) {
  const uid = kim.user_id;

  // TEKRAR KORUMASI. Bir asistanin ayni paketi iki kez gondermesi siradan
  // bir olay: baglanti koptu sanir, tekrarlar. Sema (x-idempotency) acikca
  // "kayitlarin dogal anahtari yok, iki kez gonderirsen iki kez olusur"
  // diyor -- yani koruma buraya konmazsa hic yok.
  //
  // Hicbir sey YAZILMADAN once bakiliyor ve ilk aktarimin kimlikleri geri
  // donuyor: cagiran taraf ayni cevabi alsin, "oldu mu olmadi mi" diye
  // ikinci kez denemesin.
  if (ozet) {
    try {
      const { veri } = await rest(`/ai_aktarimlar?user_id=eq.${uid}&paket_ozeti=eq.${encodeURIComponent(ozet)}&select=id,created_at,ozet,kayitlar,projeler,mekanlar,scriptler,fikirler,geri_alindi_at&limit=1`);
      const d = Array.isArray(veri) && veri[0];
      if (d) {
        return json({ ok: true, duplicate: true, importId: d.id, at: d.created_at,
                      undone: !!d.geri_alindi_at,
                      created: { entries: d.kayitlar || [], projects: d.projeler || [], places: d.mekanlar || [],
                                 scripts: d.scriptler || [], ideas: d.fikirler || [] },
                      counts: (d.ozet && d.ozet.created) || {},
                      warnings: [{ list: '', index: -1,
                                   message: 'this exact package was already imported; nothing was written again. Pass a different idempotencyKey to import it deliberately a second time.' }] });
      }
    } catch (e) {
      // Sutun henuz yoksa (sql/39 calistirilmadi) koruma calismaz ama
      // aktarim durmaz: kullanici veri kaybetmesin.
      console.warn('[mcp] tekrar korumasi bakilamadi', e);
    }
  }

  const paket: any = paketiCoz(ham);
  const uyarilar: Uyari[] = paket.hatalar.map((h: any) => ({ list: h.liste, index: h.sira, message: (h.alan ? h.alan + ': ' : '') + h.sebep }));
  if (!paket.ok) return json({ ok: false, error: 'invalid_package', message: paket.hatalar[0]?.sebep || 'invalid package', warnings: uyarilar }, 422);

  const sinir = await sinirlar(uid);
  const [projeler, mekanlar] = await Promise.all([projeleriOku(uid), mekanlariOku(uid)]);

  const yaratilan: Record<string, string[]> = { entries: [], projects: [], places: [], scripts: [], ideas: [] };
  const guncellenen: Record<string, string[]> = { entries: [], projects: [], places: [], scripts: [], ideas: [] };
  const onceki: Record<string, any[]> = {};
  const ts = simdi();

  // -- mekanlar
  const mekanSahip = await sahiplik('places', paket.places, uid, uyarilar);
  const mekanSatirlari: any[] = [];
  for (const m of paket.places) {
    if (m.atla) continue;
    let eski = m.id ? mekanSahip[m.id] : null;
    if (!eski) { const b = basvuruCoz(m.name, mekanlar); if (b) eski = b; }
    const degisen: any = {
      name: m.name, city: m.city, district: m.district, address: m.address, country: m.country,
      lat: m.lat, lon: m.lon, timezone: m.timezone, maps_url: m.mapsUrl, drive_url: m.driveUrl,
      permission: m.permission, cautions: m.cautions, notes: m.notes
    };
    Object.keys(degisen).forEach(k => { if (degisen[k] === undefined) delete degisen[k]; });
    if (m.lat !== undefined && m.lon !== undefined) degisen.source = 'manual';
    if (eski) {
      (onceki.places ||= []).push(eski);
      mekanSatirlari.push({ ...eski, ...degisen, deleted_at: null, updated_at: ts });
      guncellenen.places.push(eski.id);
      // Ad değiştiyse sonraki başvurular yeni adı da bulsun.
      const i = mekanlar.findIndex(x => x.id === eski.id);
      if (i >= 0) mekanlar[i] = { ...mekanlar[i], ...degisen };
    } else {
      const id = m.id || kimlikUret('places');
      const satir = { id, user_id: uid, name: m.name, city: '', district: '', address: '', permission: '', cautions: '', notes: '',
                      maps_url: '', drive_url: '', image_url: '', lat: null, lon: null, country: '', timezone: '', source: '',
                      external_id: '', deleted_at: null, created_at: ts, updated_at: ts, ...degisen };
      mekanSatirlari.push(satir);
      yaratilan.places.push(id);
      mekanlar.push(satir);
    }
  }
  if (mekanlar.length > sinir.places) return hata(422, 'limit', `places: the account holds at most ${sinir.places}`);

  // -- projeler
  const projeSahip = await sahiplik('projects', paket.projects, uid, uyarilar);
  const projeSatirlari: any[] = [];
  for (const p of paket.projects) {
    if (p.atla) continue;
    let eski = p.id ? projeSahip[p.id] : null;
    if (!eski) { const b = basvuruCoz(p.name, projeler); if (b) eski = b; }
    let placeIds: string[] | undefined;
    if (p.placeRefs) {
      placeIds = [];
      p.placeRefs.forEach((ref: string) => {
        const m = basvuruCoz(ref, mekanlar);
        if (m) { if (!placeIds!.includes(m.id)) placeIds!.push(m.id); }
        else uyarilar.push({ list: 'projects', index: p.sira, message: `place "${ref}" not found; add it to places to create it` });
      });
    }
    const degisen: any = {
      name: p.name, type: p.type, keywords: p.keywords, notes: p.notes, address: p.address,
      start_date: p.shootDate === undefined ? undefined : (p.shootDate || null),
      topic: p.topic, city: p.city, district: p.district, format: p.format, permission: p.permission,
      script_url: p.scriptUrl, drive_url: p.driveUrl, maps_url: p.mapsUrl,
      field_notes: p.fieldNotes, cautions: p.cautions, shot_list: p.shotList, cancelled: p.cancelled
    };
    Object.keys(degisen).forEach(k => { if (degisen[k] === undefined) delete degisen[k]; });
    if (placeIds !== undefined) { degisen.place_ids = placeIds; degisen.place_id = placeIds[0] || null; }
    if (eski) {
      (onceki.projects ||= []).push(eski);
      const satir = { ...eski, ...degisen, deleted_at: null };
      if (p.steps) satir.steps = birlesikJson(eski.steps, p.steps);
      if (p.deadlines) satir.deadlines = birlesikJson(eski.deadlines, p.deadlines);
      projeSatirlari.push(satir);
      guncellenen.projects.push(eski.id);
      const i = projeler.findIndex(x => x.id === eski.id);
      if (i >= 0) projeler[i] = satir;
    } else {
      const id = p.id || kimlikUret('projects');
      const adimlar: any = {}, tarihler: any = {};
      PROJE_ADIMLARI.forEach(k => { adimlar[k] = !!(p.steps && p.steps[k]); tarihler[k] = (p.deadlines && p.deadlines[k]) || ''; });
      const satir = { id, user_id: uid, name: p.name, keywords: '', notes: '', address: '', type: 'other',
                      place_id: null, place_ids: [], start_date: null, cancelled: false, steps: adimlar, deadlines: tarihler,
                      topic: '', district: '', city: '', format: '', permission: '', script_url: '', drive_url: '', maps_url: '',
                      field_notes: '', cautions: '', shot_list: '', deleted_at: null, ...degisen };
      projeSatirlari.push(satir);
      yaratilan.projects.push(id);
      projeler.push(satir);
    }
  }
  if (projeler.length > sinir.projects) return hata(422, 'limit', `projects: the account holds at most ${sinir.projects}`, { limit: sinir.projects });

  // -- kayıtlar
  const kayitSahip = await sahiplik('entries', paket.entries, uid, uyarilar);
  const kayitSatirlari: any[] = [];
  let yeniKayit = 0;
  const projeBul = (ref: string | undefined, liste: string, sira: number) => {
    if (!ref) return null;
    const p = basvuruCoz(ref, projeler);
    if (!p) uyarilar.push({ list: liste, index: sira, message: `project "${ref}" not found; item imported without a project. Add it to projects to create it.` });
    return p;
  };
  for (const k of paket.entries) {
    if (k.atla) continue;
    const eski = k.id ? kayitSahip[k.id] : null;
    const proje = projeBul(k.projectRef, 'entries', k.sira);
    const icerik: any = { ...(k.content || {}) };
    // Proje bulunamazsa concept de boş: dolu olsaydı uygulama (projeleriGocur)
    // bir sonraki açılışta o addan sessizce proje üretirdi. Uyarı yeter.
    if (k.projectRef !== undefined) { icerik.projectId = proje ? proje.id : ''; icerik.concept = proje ? proje.name : ''; }
    const degisen: any = { type: k.type, platform: k.platform, title: k.title, post_date: k.date,
                           post_time: k.time === undefined ? undefined : (k.time || null), uploaded: k.uploaded };
    Object.keys(degisen).forEach(kk => { if (degisen[kk] === undefined) delete degisen[kk]; });
    if (k.projectRef !== undefined) degisen.project_id = proje ? proje.id : null;
    if (eski) {
      (onceki.entries ||= []).push(eski);
      kayitSatirlari.push({ ...eski, ...degisen, content: birlesikJson(eski.content, icerik), deleted_at: null });
      guncellenen.entries.push(eski.id);
    } else {
      const id = k.id || kimlikUret('entries');
      kayitSatirlari.push({ id, user_id: uid, type: k.type, platform: k.platform, title: k.title || '', post_date: k.date,
                            post_time: k.time || null, uploaded: k.uploaded === true, workspace_id: null,
                            project_id: proje ? proje.id : null, deleted_at: null,
                            content: { caption: '', hashtags: '', videoTitle: '', shortTitle: '', thumbPrompt: '', timezone: '',
                                       concept: proje ? proje.name : '',
                                       projectId: proje ? proje.id : '', slidePrompts: [], ...icerik } });
      yaratilan.entries.push(id);
      yeniKayit++;
    }
  }
  if (yeniKayit) {
    const var_ = await sayim('calendar_events', `user_id=eq.${uid}&deleted_at=is.null`);
    if (var_ + yeniKayit > sinir.entries) {
      return hata(422, 'limit', `entries: the account holds at most ${sinir.entries} (${var_} used, ${yeniKayit} new)`, { limit: sinir.entries, used: var_ });
    }
  }

  // -- scriptler
  const scriptSahip = await sahiplik('scripts', paket.scripts, uid, uyarilar);
  const scriptSatirlari: any[] = [];
  let yeniScript = 0;
  for (const s of paket.scripts) {
    if (s.atla) continue;
    const eski = s.id ? scriptSahip[s.id] : null;
    let pids: string[] | undefined;
    if (s.projectRefs) { pids = []; s.projectRefs.forEach((ref: string) => { const p = projeBul(ref, 'scripts', s.sira); if (p && !pids!.includes(p.id)) pids!.push(p.id); }); }
    const degisen: any = { title: s.title, content: s.text, source: 'ai', updated_at: ts };
    Object.keys(degisen).forEach(k => { if (degisen[k] === undefined) delete degisen[k]; });
    if (pids !== undefined) { degisen.project_ids = pids; degisen.project_id = pids[0] || null; }
    if (eski) {
      (onceki.scripts ||= []).push(eski);
      scriptSatirlari.push({ ...eski, ...degisen, deleted_at: null });
      guncellenen.scripts.push(eski.id);
    } else {
      const id = s.id || kimlikUret('scripts');
      scriptSatirlari.push({ id, user_id: uid, title: '', content: '', project_id: null, project_ids: [], idea_ids: [],
                             drive_file_id: null, drive_file_name: null, drive_modified: null, deleted_at: null,
                             created_at: ts, ...degisen });
      yaratilan.scripts.push(id);
      yeniScript++;
    }
  }
  if (yeniScript) {
    const var_ = await sayim('scripts', `user_id=eq.${uid}&deleted_at=is.null`);
    if (var_ + yeniScript > sinir.scripts) return hata(422, 'limit', `scripts: the account holds at most ${sinir.scripts}`, { limit: sinir.scripts, used: var_ });
  }

  // -- fikirler
  const fikirSahip = await sahiplik('ideas', paket.ideas, uid, uyarilar);
  const fikirSatirlari: any[] = [];
  let yeniFikir = 0;
  let sira = -Date.now();   // en yeni en üstte; uygulama en küçük sırayı üste koyuyor
  for (const f of paket.ideas) {
    if (f.atla) continue;
    const eski = f.id ? fikirSahip[f.id] : null;
    let pids: string[] | undefined;
    if (f.projectRefs) { pids = []; f.projectRefs.forEach((ref: string) => { const p = projeBul(ref, 'ideas', f.sira); if (p && !pids!.includes(p.id)) pids!.push(p.id); }); }
    const degisen: any = { text: f.text, due_date: f.due === undefined ? undefined : (f.due || null), done: f.done, updated_at: ts };
    Object.keys(degisen).forEach(k => { if (degisen[k] === undefined) delete degisen[k]; });
    if (pids !== undefined) { degisen.project_ids = pids; degisen.project_id = pids[0] || null; }
    if (eski) {
      (onceki.ideas ||= []).push(eski);
      const parcalar = Array.isArray(eski.parts) && eski.parts.length ? eski.parts : [{ id: eski.id, text: eski.text || '' }];
      // Tek parçalı fikirde metin değişince parça da değişir; çok parçalıda
      // ilk parça güncellenir, diğerleri durur.
      const yeniParcalar = parcalar.map((p: any, i: number) => i === 0 ? { ...p, text: f.text } : p);
      fikirSatirlari.push({ ...eski, ...degisen, parts: yeniParcalar, text: yeniParcalar.map((p: any) => String(p.text || '').trim()).join('\n\n'), deleted_at: null });
      guncellenen.ideas.push(eski.id);
    } else {
      const id = f.id || kimlikUret('ideas');
      fikirSatirlari.push({ id, user_id: uid, text: f.text, parts: [{ id, text: f.text }], project_id: null, project_ids: [],
                            due_date: null, done: false, sort_index: sira++, deleted_at: null, created_at: ts, ...degisen });
      yaratilan.ideas.push(id);
      yeniFikir++;
    }
  }
  if (yeniFikir) {
    const var_ = await sayim('ideas', `user_id=eq.${uid}&deleted_at=is.null`);
    if (var_ + yeniFikir > sinir.ideas) return hata(422, 'limit', `ideas: the account holds at most ${sinir.ideas}`, { limit: sinir.ideas, used: var_ });
  }

  // -- yaz: mekan, proje, kayıt, script, fikir sırasıyla (yabancı anahtarlar)
  const PREFER = 'resolution=merge-duplicates,return=minimal';
  if (mekanSatirlari.length) await yazYinele('places', mekanSatirlari, PREFER);
  if (projeSatirlari.length) await yazYinele('projects', projeSatirlari, PREFER);
  if (kayitSatirlari.length) await yazYinele('calendar_events', kayitSatirlari, PREFER);
  if (scriptSatirlari.length) await yazYinele('scripts', scriptSatirlari, PREFER);
  if (fikirSatirlari.length) await yazYinele('ideas', fikirSatirlari, PREFER);

  // -- defter
  const say = (o: Record<string, string[]>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.length]));
  const importId = 'ak_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const oncekiSatirlar: Record<string, any[]> = {};
  Object.keys(onceki).forEach(k => { oncekiSatirlar[TABLO[k]] = onceki[k]; });
  const defter: any = {
    id: importId, user_id: uid, key_id: kim.id, created_at: ts, paket_ozeti: ozet,
    kaynak: paket.source, ozet: { note: paket.note, created: say(yaratilan), updated: say(guncellenen), warnings: uyarilar.length },
    onceki: oncekiSatirlar, geri_alindi_at: null
  };
  Object.keys(DEFTER_SUTUNU).forEach(k => { defter[DEFTER_SUTUNU[k]] = yaratilan[k].concat(guncellenen[k]); });
  try { await rest('/ai_aktarimlar', { method: 'POST', govde: defter, prefer: 'return=minimal' }); }
  catch (e) { console.error('[ai] defter yazılamadı', e); uyarilar.push({ list: '', index: -1, message: 'import log could not be written; undo is not available for this import' }); }

  return json({ ok: true, importId, source: paket.source, note: paket.note,
                created: yaratilan, updated: guncellenen, counts: { created: say(yaratilan), updated: say(guncellenen) },
                warnings: uyarilar });
}


// ---- Geri alma BURADA DEGIL -----------------------------------------------
// sql/35 dönemindeki fonksiyonda bir /undo ucu vardı; bu sunucuda yok.
// Sebebi kullanıcı kararı: "Claude'un takvimden kayıt silmesini
// istemiyorum." Geri alma uygulamanın kendi ekranından yapılıyor ve
// aktar() burada yazdığı ai_aktarimlar satırıyla onu besliyor -- yani
// MCP ile gelen bir aktarım da uygulamadan geri alınabiliyor.

// ---- Araç şemaları: ai/sema.json'dan TÜRETİLİYOR ---------------------------
// Elle yazılmıyor. Şema değişince araçların girdi şeması kendiliğinden
// değişsin diye: iki yerde iki ayrı doğruluk olmasın. Asistan kartı,
// İçe Aktar penceresi ve bu sunucu aynı tanımı okuyor.
const DEFS: any = (SEMA as any).$defs || {};
const ENTRY: any = DEFS.Entry || {};
const ENTRY_P: any = ENTRY.properties || {};
const ICERIK: any = ENTRY_P.content || { type: 'object' };

function alan(ad: string, ek: Record<string, unknown> = {}) {
  const k = ENTRY_P[ad] || {};
  return { ...k, ...ek };
}

const ARACLAR = [
  {
    name: 'shootboard_list_entries',
    title: 'List calendar entries',
    description:
      'List the posts planned on the Shootboard content calendar in a date range. ' +
      'Use this before proposing a plan: it is how you find which days are already ' +
      'taken and which are free. Dates and times are returned exactly as the user ' +
      'stored them, in their own local calendar — do not shift them into another time zone.',
    inputSchema: {
      type: 'object',
      properties: {
        since: { ...(DEFS.DateYMD || {}), description: 'First day to include (YYYY-MM-DD). Defaults to 7 days ago.' },
        until: { ...(DEFS.DateYMD || {}), description: 'Last day to include (YYYY-MM-DD). Defaults to 60 days ahead. At most 90 days after "since".' },
        platform: alan('platform', { description: 'Only entries for this platform. Omit for all.' }),
        project: { type: 'string', maxLength: 120, description: 'Only entries of this project, matched by name (case-insensitive) or by project id.' },
        limit: { type: 'integer', minimum: 1, maximum: 500, description: 'How many entries to return at most. Default 100.' },
        cursor: { type: 'string', maxLength: 64, description: 'Pass the nextCursor from the previous call to get the following page.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'shootboard_list_projects',
    title: 'List projects',
    description:
      'List the user\'s projects with their ids and names. Use this before writing a ' +
      'package so that entries attach to an existing project instead of creating a ' +
      'near-duplicate with a slightly different name.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'shootboard_import',
    title: 'Import a package',
    description:
      'Write a Shootboard package into the account: entries, projects, places, scripts ' +
      'and ideas. This is the same package format the user can paste into the app\'s ' +
      'Import window, and it goes through the same validation. Returns the ids of ' +
      'everything created. Sending the identical package twice does not create ' +
      'duplicates — the second call reports duplicate:true and writes nothing.',
    inputSchema: {
      type: 'object',
      properties: {
        package: { ...(SEMA as any), $schema: undefined, $id: undefined, examples: undefined,
                   description: 'The package. Format: ' + ((SEMA as any).description || 'see shootboard.app/ai/sema.json') },
        idempotencyKey: { type: 'string', maxLength: 120,
                          description: 'Optional. Repeat calls carrying the same key are ignored after the first. If omitted, a hash of the package itself is used, so an accidental retry is caught automatically. Pass a fresh key when you deliberately want to import the same content a second time.' }
      },
      required: ['package'],
      additionalProperties: false
    }
  },
  {
    name: 'shootboard_update_entry',
    title: 'Update one entry',
    description:
      'Change one existing calendar entry — its date, time, title, upload state or ' +
      'text fields. Only the fields you pass are changed; everything else is left ' +
      'alone. Find the id with shootboard_list_entries. There is no delete tool: ' +
      'entries can only be removed by the user, inside the app.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { ...(DEFS.Id || { type: 'string' }), description: 'Id of the entry to change, as returned by shootboard_list_entries.' },
        date: alan('date'),
        time: alan('time'),
        title: alan('title'),
        type: alan('type'),
        platform: alan('platform'),
        uploaded: alan('uploaded'),
        content: { ...ICERIK, description: 'Text fields to change. Fields you leave out keep their current value.' }
      },
      required: ['id'],
      additionalProperties: false
    }
  }
];

// ---- Araçların gövdeleri ---------------------------------------------------
const GUN_MS = 86400000;
function gunEkle(temel: Date, n: number): string {
  return new Date(temel.getTime() + n * GUN_MS).toISOString().slice(0, 10);
}
// Sayfalama imleci: icinde yalnizca atlanacak satir sayisi var. Opak
// tutuluyor ki ileride anahtar tabanliya cevrilince cagiran taraf
// etkilenmesin.
function imlecYaz(n: number): string { return 'o' + n; }
function imlecOku(v: unknown): number {
  const m = /^o(\d{1,7})$/.exec(String(v || ''));
  return m ? Number(m[1]) : 0;
}

async function araclistEntries(uid: string, a: any) {
  const bugun = new Date();
  const since = a.since ? String(a.since) : gunEkle(bugun, -7);
  const until = a.until ? String(a.until) : gunEkle(bugun, 60);
  if (!tarihGecerli(since)) return aracHata(`since: "${a.since}" is not a date. Use YYYY-MM-DD.`);
  if (!tarihGecerli(until)) return aracHata(`until: "${a.until}" is not a date. Use YYYY-MM-DD.`);
  if (until < since) return aracHata(`until (${until}) is before since (${since}).`);
  // 90 gun siniri: daha genisi hem yavas hem de asistanin isine yaramiyor
  // -- bir seferde okudugu seyi zaten tasiyamiyor.
  const aralik = Math.round((Date.parse(until + 'T00:00:00Z') - Date.parse(since + 'T00:00:00Z')) / GUN_MS);
  if (aralik > 90) return aracHata(`the range is ${aralik} days; at most 90 are allowed. Ask for a narrower window, or page through it.`);

  const limit = Math.min(Math.max(Number(a.limit) || 100, 1), 500);
  const atla = imlecOku(a.cursor);

  let suzgec = `user_id=eq.${uid}&deleted_at=is.null&post_date=gte.${since}&post_date=lte.${until}`;
  if (a.platform) {
    const pf = String(a.platform);
    const izin: string[] = (ENTRY_P.platform && ENTRY_P.platform.enum) || [];
    if (izin.length && !izin.includes(pf)) return aracHata(`platform: "${pf}" is not one of ${izin.join(', ')}.`);
    suzgec += `&platform=eq.${encodeURIComponent(pf)}`;
  }

  const projeler = await projeleriOku(uid);
  if (a.project) {
    const q = String(a.project).trim().toLocaleLowerCase('tr');
    const p = projeler.find((x: any) => x.id === String(a.project) || String(x.name || '').trim().toLocaleLowerCase('tr') === q);
    if (!p) {
      return aracHata(`project: no project named "${a.project}". Known projects: ` +
        (projeler.length ? projeler.map((x: any) => x.name).join(', ') : '(none yet)'));
    }
    suzgec += `&project_id=eq.${encodeURIComponent(p.id)}`;
  }

  const { veri, baslik } = await rest(
    `/calendar_events?${suzgec}&select=*&order=post_date.asc,post_time.asc.nullsfirst,id.asc&offset=${atla}&limit=${limit}`,
    { prefer: 'count=exact' });
  const satirlar = Array.isArray(veri) ? veri : [];
  const cr = baslik.get('content-range') || '';
  const toplam = Number(cr.split('/')[1]);
  const kalan = Number.isFinite(toplam) ? Math.max(toplam - (atla + satirlar.length), 0) : 0;

  return {
    ok: true, since, until,
    count: satirlar.length,
    total: Number.isFinite(toplam) ? toplam : satirlar.length,
    nextCursor: kalan > 0 ? imlecYaz(atla + satirlar.length) : null,
    entries: satirlar.map((r: any) => kayitDisari(r, projeler))
  };
}

async function aracListProjects(uid: string) {
  const [projeler, mekanlar] = await Promise.all([projeleriOku(uid), mekanlariOku(uid)]);
  return { ok: true, count: projeler.length, projects: projeler.map((r: any) => projeDisari(r, mekanlar)) };
}

async function aracUpdateEntry(kim: Kim, a: any) {
  const uid = kim.user_id;
  const id = String(a.id || '');
  if (!id) return aracHata('id: required. Get it from shootboard_list_entries.');

  const { veri } = await rest(`/calendar_events?id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}&deleted_at=is.null&select=*&limit=1`);
  const satir = Array.isArray(veri) && veri[0];
  if (!satir) return aracHata(`id: no entry "${id}" in this account. It may have been deleted, or it belongs to someone else.`);

  const degisti = ['date', 'time', 'title', 'type', 'platform', 'uploaded', 'content'].filter(k => a[k] !== undefined);
  if (!degisti.length) return aracHata('nothing to change: pass at least one of date, time, title, type, platform, uploaded, content.');

  // DOGRULAMA YENIDEN YAZILMIYOR. Mevcut satirla gelen alanlar birlestirilip
  // TEK KAYITLIK bir paket kuruluyor ve paketiCoz'dan geciriliyor -- Ice
  // Aktar penceresinin calistirdigi doğrulayıcının aynısı. Boylece alan
  // adlari, uzunluk sinirlari ve beyaz liste tek yerde kaliyor.
  const eski = (satir.content && typeof satir.content === 'object') ? satir.content : {};
  const birlesikIcerik = (a.content && typeof a.content === 'object') ? { ...eski, ...a.content } : eski;
  const aday = {
    id,
    date: a.date !== undefined ? a.date : satir.post_date,
    time: a.time !== undefined ? a.time : (satir.post_time || '').slice(0, 5),
    type: a.type !== undefined ? a.type : satir.type,
    platform: a.platform !== undefined ? a.platform : satir.platform,
    title: a.title !== undefined ? a.title : (satir.title || ''),
    uploaded: a.uploaded !== undefined ? a.uploaded : !!satir.uploaded,
    content: birlesikIcerik
  };
  const paket: any = paketiCoz({ shootboard: 1, source: 'mcp', entries: [aday] });
  if (!paket.ok) {
    const h = paket.hatalar[0] || {};
    return aracHata((h.alan ? h.alan + ': ' : '') + (h.sebep || 'the entry is not valid'),
                    paket.hatalar.map((x: any) => ({ field: x.alan || '', reason: x.sebep })));
  }
  const temiz = paket.entries[0];

  const yama: any = { updated_at: simdi() };
  if (a.date !== undefined) yama.post_date = temiz.date;
  if (a.time !== undefined) yama.post_time = temiz.time || null;
  if (a.title !== undefined) yama.title = temiz.title || '';
  if (a.type !== undefined) yama.type = temiz.type;
  if (a.platform !== undefined) yama.platform = temiz.platform;
  if (a.uploaded !== undefined) yama.uploaded = !!temiz.uploaded;
  if (a.content !== undefined) yama.content = { ...eski, ...(temiz.content || {}) };

  await rest(`/calendar_events?id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}`,
             { method: 'PATCH', govde: yama, prefer: 'return=minimal' });

  const projeler = await projeleriOku(uid);
  const { veri: sonra } = await rest(`/calendar_events?id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}&select=*&limit=1`);
  const yeni = Array.isArray(sonra) && sonra[0];
  return { ok: true, changed: degisti, entry: yeni ? kayitDisari(yeni, projeler) : null,
           warnings: paket.hatalar.map((x: any) => ({ field: x.alan || '', reason: x.sebep })) };
}

// ---- MCP protokol katmanı --------------------------------------------------
const MCP_SURUM = '2025-11-25';
// Tanıdığımız sürümler. İstemci bunlardan birini isterse aynen geri
// veriliyor; istemediğini dayatmak uyumu kırar.
const BILINEN_SURUMLER = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25', '2026-07-28'];

const SUNUCU_BILGISI = { name: 'shootboard', title: 'Shootboard', version: SURUM };

type AracSonuc = { ok: boolean; [k: string]: unknown };
function aracHata(mesaj: string, ayrinti?: unknown): AracSonuc {
  // Hata METNI asistan icin yazilmis: hangi alan, neden reddedildi, ne
  // yapmali. "invalid input" demek asistani ayni hatayi tekrarlamaya
  // birakir; kendini duzeltebilmesi icin sebebi gormesi lazim.
  return ayrinti === undefined ? { ok: false, error: mesaj } : { ok: false, error: mesaj, details: ayrinti };
}

function rpcYanit(id: unknown, sonuc: unknown) {
  return json({ jsonrpc: '2.0', id, result: sonuc });
}
function rpcHata(id: unknown, kod: number, mesaj: string, veri?: unknown) {
  return json({ jsonrpc: '2.0', id, error: veri === undefined ? { code: kod, message: mesaj } : { code: kod, message: mesaj, data: veri } });
}
// Araç sonucu MCP biçiminde. Hem content (her istemci okur) hem
// structuredContent (yeni istemciler nesneyi olduğu gibi alır) veriliyor.
function aracYanit(id: unknown, sonuc: AracSonuc) {
  const metin = JSON.stringify(sonuc, null, 1);
  return rpcYanit(id, { content: [{ type: 'text', text: metin }], structuredContent: sonuc, isError: sonuc.ok === false });
}

async function aracCalistir(kim: Kim, ad: string, arg: any): Promise<AracSonuc> {
  const uid = kim.user_id;
  const a = (arg && typeof arg === 'object') ? arg : {};
  switch (ad) {
    case 'shootboard_list_entries':
      if (!kim.scopes.includes('read')) return aracHata('this key cannot read');
      return await araclistEntries(uid, a);
    case 'shootboard_list_projects':
      if (!kim.scopes.includes('read')) return aracHata('this key cannot read');
      return await aracListProjects(uid);
    case 'shootboard_import': {
      if (!kim.scopes.includes('write')) return aracHata('this key cannot write');
      if (!a.package || typeof a.package !== 'object') {
        return aracHata('package: required, and must be the package object itself (not a string).');
      }
      // Hız sınırı: hesap başına saatte 60 aktarım.
      const birSaatOnce = new Date(Date.now() - 3600000).toISOString();
      const n = await sayim('ai_aktarimlar', `user_id=eq.${uid}&created_at=gte.${birSaatOnce}`);
      if (n >= 60) return aracHata('rate limit: at most 60 imports per hour for this account. Try again later.');
      // Anahtar verilmediyse paketin KENDISINDEN uretiliyor: kaza eseri
      // tekrar gonderim kendiliginden yakalansin.
      const ozet = a.idempotencyKey
        ? 'k:' + String(a.idempotencyKey).slice(0, 120)
        : 'h:' + (await sha256(JSON.stringify(a.package)));
      const yanit = await aktar(kim, a.package, ozet);
      return await yanit.json() as AracSonuc;
    }
    case 'shootboard_update_entry':
      if (!kim.scopes.includes('write')) return aracHata('this key cannot write');
      return await aracUpdateEntry(kim, a);
    default:
      return aracHata(`unknown tool "${ad}". Available: ${ARACLAR.map(x => x.name).join(', ')}.`);
  }
}

// ---- Yönlendirme -----------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!SUPABASE_URL || !SERVIS_ANAHTARI) return hata(500, 'config', 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');

  const url = new URL(req.url);
  const yol = url.pathname.replace(/^\/functions\/v1/, '').replace(/^\/mcp/, '').replace(/\/+$/, '');

  // Kimlik: once yolun icinden, sonra basliktan. Yol icindeki sekil
  // claude.ai icin -- orada anahtar yapistirilacak bir kutu yok.
  let kim: Kim | null = null;
  try { kim = await kimBu(req, yol); }
  catch (e) {
    console.error('[mcp] anahtar bakılamadı', e);
    const m = e instanceof RestHata ? String(e.message) : '';
    if (/api_keys/.test(m) && /schema cache|does not exist|relation/.test(m)) {
      return hata(503, 'not_installed', 'sql/39-mcp-erisimi.sql has not been run yet');
    }
    return hata(500, 'server', 'key lookup failed');
  }

  if (req.method === 'GET') {
    // Bir MCP istemcisi GET'i sunucudan gelen akis icin kullanir; biz
    // sunucudan istemciye mesaj gondermiyoruz, o yuzden 405. Spec buna
    // acikca izin veriyor.
    const kabul = req.headers.get('accept') || '';
    if (/text\/event-stream/.test(kabul)) {
      return new Response('this server does not open server-to-client streams', { status: 405, headers: CORS });
    }
    // Tarayicidan ya da curl'den bakan insan icin: anahtar dogru mu?
    if (!kim) {
      return json({ ok: true, service: 'shootboard-mcp', version: SURUM, transport: 'streamable-http',
                    protocolVersions: BILINEN_SURUMLER,
                    hint: 'Add your key to the URL: /functions/v1/mcp/shb_...  Generate one in Shootboard → Account.' });
    }
    const s = await sinirlar(kim.user_id);
    const [kayit, proje] = await Promise.all([
      sayim('calendar_events', `user_id=eq.${kim.user_id}&deleted_at=is.null`),
      sayim('projects', `user_id=eq.${kim.user_id}&deleted_at=is.null`)
    ]);
    return json({ ok: true, service: 'shootboard-mcp', version: SURUM, keyId: kim.id, scopes: kim.scopes,
                  counts: { entries: kayit, projects: proje },
                  limits: { entries: s.entries, projects: s.projects },
                  today: new Date().toISOString().slice(0, 10),
                  tools: ARACLAR.map(x => x.name) });
  }

  if (req.method !== 'POST') return hata(405, 'method', 'only GET and POST');

  const uzunluk = Number(req.headers.get('content-length') || 0);
  if (uzunluk > 1_500_000) return hata(413, 'too_large', 'body must be under 1.5 MB');

  let govde: any;
  try { govde = await req.json(); } catch { return rpcHata(null, -32700, 'body must be JSON'); }

  // Toplu istek: dizi gelirse her biri ayri ayri islenip dizi donuyor.
  const tekil = !Array.isArray(govde);
  const istekler: any[] = tekil ? [govde] : govde;
  if (!istekler.length) return rpcHata(null, -32600, 'empty batch');

  const yanitlar: any[] = [];
  for (const istek of istekler) {
    const id = istek && istek.id !== undefined ? istek.id : null;
    const yontem = istek && typeof istek.method === 'string' ? istek.method : '';
    if (!yontem) { yanitlar.push({ jsonrpc: '2.0', id, error: { code: -32600, message: 'method is required' } }); continue; }

    // Bildirimler (id yok) yanıt beklemiyor.
    if (istek.id === undefined) {
      if (yontem === 'notifications/initialized' || yontem.startsWith('notifications/')) continue;
    }

    try {
      if (yontem === 'initialize') {
        const istenen = istek.params && istek.params.protocolVersion;
        const surum = BILINEN_SURUMLER.includes(String(istenen)) ? String(istenen) : MCP_SURUM;
        yanitlar.push({ jsonrpc: '2.0', id, result: {
          protocolVersion: surum,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SUNUCU_BILGISI,
          instructions: 'Shootboard is the user\'s content calendar. Before proposing dates, call ' +
            'shootboard_list_entries to see which days are already taken. Call shootboard_list_projects ' +
            'so entries attach to existing projects. Write with shootboard_import; fix a single entry ' +
            'with shootboard_update_entry. There is no delete tool — only the user removes entries, ' +
            'inside the app. Dates and times belong to the user\'s own local calendar; return and send ' +
            'them exactly as stored, never converted into another time zone.'
        } });
        continue;
      }
      // 2026-07-28 ve sonrası: el sıkışma yok, yetenekler buradan sorulur.
      if (yontem === 'server/discover') {
        yanitlar.push({ jsonrpc: '2.0', id, result: {
          protocolVersion: MCP_SURUM, capabilities: { tools: { listChanged: false } }, serverInfo: SUNUCU_BILGISI
        } });
        continue;
      }
      if (yontem === 'ping') { yanitlar.push({ jsonrpc: '2.0', id, result: {} }); continue; }

      if (yontem === 'tools/list') {
        yanitlar.push({ jsonrpc: '2.0', id, result: { tools: ARACLAR } });
        continue;
      }

      if (yontem === 'tools/call') {
        if (!kim) {
          yanitlar.push({ jsonrpc: '2.0', id, error: { code: -32001, message:
            'unauthorized: the key in the URL is missing, wrong or revoked. The address must end with /mcp/shb_... — generate a new key in Shootboard → Account.' } });
          continue;
        }
        const ad = istek.params && istek.params.name;
        const arg = istek.params && istek.params.arguments;
        const sonuc = await aracCalistir(kim, String(ad || ''), arg);
        const metin = JSON.stringify(sonuc, null, 1);
        yanitlar.push({ jsonrpc: '2.0', id, result: {
          content: [{ type: 'text', text: metin }], structuredContent: sonuc, isError: sonuc.ok === false } });
        continue;
      }

      // Desteklemediğimiz yetenekler: boş liste dönmek, hata dönmekten iyi
      // -- istemci "bu sunucuda kaynak yok" deyip yoluna devam etsin.
      if (yontem === 'resources/list') { yanitlar.push({ jsonrpc: '2.0', id, result: { resources: [] } }); continue; }
      if (yontem === 'prompts/list') { yanitlar.push({ jsonrpc: '2.0', id, result: { prompts: [] } }); continue; }

      yanitlar.push({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${yontem}` } });
    } catch (e) {
      console.error('[mcp] hata', yontem, e);
      const m = e instanceof RestHata ? String(e.message) : String((e as any)?.message || e);
      const kurulmamis = /schema cache|does not exist|relation/.test(m) && /ai_aktarimlar|api_keys/.test(m);
      yanitlar.push({ jsonrpc: '2.0', id, error: { code: -32603, message: kurulmamis
        ? 'sql/39-mcp-erisimi.sql has not been run yet'
        : ('server error: ' + m.slice(0, 200)) } });
    }
  }

  // Yalnızca bildirim geldiyse gövdesiz 202.
  if (!yanitlar.length) return new Response(null, { status: 202, headers: CORS });
  return json(tekil ? yanitlar[0] : yanitlar);
});
