// Shootboard AI erişimi — TEK DOSYALIK sürüm.
//
// Supabase panelindeki "Via Editor" yolunda ikinci bir dosya oluşturmak
// gerekmesin diye dogrula.js, sema.ts ve index.ts bu dosyada birleştirildi.
// Panelden kuruyorsan YALNIZCA bu dosyayı yapıştır. Komut satırından
// kuruyorsan çok dosyalı sürüm kullanılır.
//
// İçeriği elle değiştirme: kaynaklar değişirse şu komutla yeniden üretilir:
//   python3 supabase/functions/ai/birlestir.py
//

// ---- dogrula.js ----

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
      timezone: tz && tzGecerli(tz) ? tz : undefined
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

// Shootboard AI erişimi — Supabase Edge Function.
//
// Ne yapar: herhangi bir yapay zekâ (ChatGPT, Claude, bir otomasyon aracı)
// kullanıcının verdiği anahtarla hesaba plan, script, fikir aktarır ve
// hesaptakileri okur. Biçim: ai/sema.json (GET /schema da döndürür).
//
// Kimlik: "Authorization: Bearer shb_..." (ya da x-api-key). Anahtarın
// SHA-256 özeti api_keys tablosunda bulunur -> user_id. Yazma ve okuma
// servis rolüyle ama HER sorguda user_id süzgeci; verilen kimliklerde
// sahiplik denetimi. Anahtar iptal edilince (revoked_at) anında geçersiz.
//
// Uçlar (hepsi /ai altında):
//   GET  /me        sınırlar, sayılar, dil
//   GET  /schema    paketin JSON şeması
//   GET  /projects  /places  /scripts  /ideas
//   GET  /entries?from=YYYY-MM-DD&to=YYYY-MM-DD
//   POST /import    gövde = paket; yanıt: kimlikler, uyarılar, importId
//   POST /undo      {importId?}  o aktarımı geri alır (yoksa sonuncuyu)
//   GET  /imports   son aktarımlar
//
// Gizli ayar GEREKMEZ: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase
// tarafından fonksiyona kendiliğinden verilir.
//
// Dağıtım: supabase functions deploy ai --no-verify-jwt
// (--no-verify-jwt şart: çağıran taraf Supabase oturumu değil, bizim
//  anahtarımızı taşıyor.)
//
// Önce sql/35-ai-erisimi.sql çalıştırılmış olmalı (api_keys, ai_aktarimlar).
// sql/33 ve sql/34 çalıştırılmadıysa o sütunlar yazımdan düşürülüp
// yeniden denenir (PGRST204), aktarım durmaz.


const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVIS_ANAHTARI = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SURUM = '1';

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
async function kimBu(req: Request): Promise<Kim | null> {
  let anahtar = '';
  const auth = req.headers.get('authorization') || '';
  if (/^bearer\s+/i.test(auth)) anahtar = auth.replace(/^bearer\s+/i, '').trim();
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
           content: { caption: c.caption || '', hashtags: c.hashtags || '', videoTitle: c.videoTitle || '', shortTitle: c.shortTitle || '',
                      thumbPrompt: c.thumbPrompt || '', slidePrompts: Array.isArray(c.slidePrompts) ? c.slidePrompts : [], timezone: c.timezone || '' } };
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
function mekanDisari(r: any) {
  return { id: r.id, name: r.name || '', city: r.city || '', district: r.district || '', address: r.address || '',
           country: r.country || '', lat: r.lat ?? null, lon: r.lon ?? null, timezone: r.timezone || '',
           mapsUrl: r.maps_url || '', driveUrl: r.drive_url || '', permission: r.permission || '', cautions: r.cautions || '',
           notes: r.notes || '', updatedAt: r.updated_at || null };
}
function scriptDisari(r: any, projeler: any[]) {
  const ids: string[] = Array.isArray(r.project_ids) && r.project_ids.length ? r.project_ids : (r.project_id ? [r.project_id] : []);
  return { id: r.id, title: r.title || '', text: r.content || '', source: r.source || 'manual',
           project: projeAdi(ids[0], projeler), projects: ids.map(id => projeAdi(id, projeler) || id), projectIds: ids,
           updatedAt: r.updated_at || null };
}
function fikirDisari(r: any, projeler: any[]) {
  const ids: string[] = Array.isArray(r.project_ids) && r.project_ids.length ? r.project_ids : (r.project_id ? [r.project_id] : []);
  return { id: r.id, text: r.text || '', project: projeAdi(ids[0], projeler), projectIds: ids,
           due: r.due_date || '', done: r.done === true, updatedAt: r.updated_at || null };
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

async function aktar(kim: Kim, ham: unknown) {
  const uid = kim.user_id;
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
    if (k.projectRef !== undefined) { icerik.projectId = proje ? proje.id : ''; icerik.concept = proje ? proje.name : String(k.projectRef).slice(0, 120); }
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
                                       concept: proje ? proje.name : (k.projectRef ? String(k.projectRef).slice(0, 120) : ''),
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
    id: importId, user_id: uid, key_id: kim.id, created_at: ts,
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

// ---- Geri alma -------------------------------------------------------------
async function geriAl(kim: Kim, govde: any) {
  const uid = kim.user_id;
  const istenen = govde && typeof govde.importId === 'string' ? govde.importId : '';
  if (istenen && !kimlikGecerli(istenen)) return hata(400, 'bad_request', 'importId is not valid');
  const suzgec = istenen ? `id=eq.${istenen}` : 'order=created_at.desc&limit=1';
  const { veri } = await rest(`/ai_aktarimlar?user_id=eq.${uid}&geri_alindi_at=is.null&${suzgec}&select=*`);
  const d = Array.isArray(veri) && veri[0];
  if (!d) return hata(404, 'not_found', istenen ? 'no such import, or it is already undone' : 'nothing to undo');
  const ts = simdi();
  const geriAlinan: Record<string, number> = {};
  const onceki = (d.onceki && typeof d.onceki === 'object') ? d.onceki : {};
  for (const liste of Object.keys(TABLO)) {
    const tablo = TABLO[liste];
    const hepsi: string[] = Array.isArray(d[DEFTER_SUTUNU[liste]]) ? d[DEFTER_SUTUNU[liste]] : [];
    const eskiler: any[] = Array.isArray(onceki[tablo]) ? onceki[tablo] : [];
    const eskiIds = new Set(eskiler.map(r => r.id));
    const yaratilan = hepsi.filter(id => kimlikGecerli(id) && !eskiIds.has(id));
    let n = 0;
    if (yaratilan.length) {
      await rest(`/${tablo}?user_id=eq.${uid}&${idListesi(yaratilan)}`, { method: 'PATCH', govde: { deleted_at: ts }, prefer: 'return=minimal' });
      n += yaratilan.length;
    }
    const geriYaz = eskiler.filter(r => r && r.user_id === uid && kimlikGecerli(r.id));
    if (geriYaz.length) {
      await yazYinele(tablo, geriYaz.map(r => ({ ...r, updated_at: r.updated_at || undefined })), 'resolution=merge-duplicates,return=minimal');
      n += geriYaz.length;
    }
    if (n) geriAlinan[liste] = n;
  }
  await rest(`/ai_aktarimlar?id=eq.${d.id}&user_id=eq.${uid}`, { method: 'PATCH', govde: { geri_alindi_at: ts }, prefer: 'return=minimal' });
  return json({ ok: true, importId: d.id, reverted: geriAlinan });
}

// ---- Yönlendirme -----------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!SUPABASE_URL || !SERVIS_ANAHTARI) return hata(500, 'config', 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');

  const url = new URL(req.url);
  let yol = url.pathname.replace(/^\/functions\/v1/, '').replace(/^\/ai/, '').replace(/\/+$/, '') || '/';
  if (yol === '/' || yol === '') {
    return json({ ok: true, service: 'shootboard-ai', version: SURUM,
                  docs: 'https://shootboard.app/ai/', schema: 'https://shootboard.app/ai/sema.json',
                  endpoints: ['GET /me', 'GET /schema', 'GET /projects', 'GET /places', 'GET /entries?from&to', 'GET /scripts', 'GET /ideas', 'POST /import', 'POST /undo', 'GET /imports'] });
  }
  if (yol === '/schema' && req.method === 'GET') return json(SEMA);

  let kim: Kim | null;
  try { kim = await kimBu(req); }
  catch (e) {
    console.error('[ai] anahtar bakılamadı', e);
    const m = e instanceof RestHata ? String(e.message) : '';
    if (/api_keys/.test(m) && /schema cache|does not exist|relation/.test(m)) return hata(503, 'not_installed', 'sql/35-ai-erisimi.sql has not been run yet');
    return hata(500, 'server', 'key lookup failed');
  }
  if (!kim) return hata(401, 'unauthorized', 'missing or revoked API key. Send "Authorization: Bearer shb_..."');

  const okuma = req.method === 'GET';
  if (okuma && !kim.scopes.includes('read')) return hata(403, 'forbidden', 'this key cannot read');
  if (!okuma && !kim.scopes.includes('write')) return hata(403, 'forbidden', 'this key cannot write');
  const uid = kim.user_id;

  try {
    if (okuma) {
      if (yol === '/me') {
        const s = await sinirlar(uid);
        const [kayit, proje, mekan, script, fikir] = await Promise.all([
          sayim('calendar_events', `user_id=eq.${uid}&deleted_at=is.null`),
          sayim('projects', `user_id=eq.${uid}&deleted_at=is.null`),
          sayim('places', `user_id=eq.${uid}&deleted_at=is.null`),
          sayim('scripts', `user_id=eq.${uid}&deleted_at=is.null`),
          sayim('ideas', `user_id=eq.${uid}&deleted_at=is.null`)
        ]);
        return json({ ok: true, keyId: kim.id, scopes: kim.scopes, lang: s.lang || 'en',
                      counts: { entries: kayit, projects: proje, places: mekan, scripts: script, ideas: fikir },
                      limits: { entries: s.entries, projects: s.projects, places: s.places, scripts: s.scripts, ideas: s.ideas },
                      today: new Date().toISOString().slice(0, 10) });
      }
      if (yol === '/projects') {
        const [projeler, mekanlar] = await Promise.all([projeleriOku(uid), mekanlariOku(uid)]);
        return json({ ok: true, projects: projeler.map(r => projeDisari(r, mekanlar)) });
      }
      if (yol === '/places') return json({ ok: true, places: (await mekanlariOku(uid)).map(mekanDisari) });
      if (yol === '/entries') {
        const bugun = new Date();
        const gun = (n: number) => new Date(bugun.getTime() + n * 86400000).toISOString().slice(0, 10);
        const from = url.searchParams.get('from') || gun(-7);
        const to = url.searchParams.get('to') || gun(60);
        if (!tarihGecerli(from) || !tarihGecerli(to)) return hata(400, 'bad_request', 'from/to must be YYYY-MM-DD');
        const [{ veri }, projeler] = await Promise.all([
          rest(`/calendar_events?user_id=eq.${uid}&deleted_at=is.null&post_date=gte.${from}&post_date=lte.${to}&select=*&order=post_date.asc,post_time.asc.nullsfirst&limit=2000`),
          projeleriOku(uid)
        ]);
        return json({ ok: true, from, to, entries: (Array.isArray(veri) ? veri : []).map(r => kayitDisari(r, projeler)) });
      }
      if (yol === '/scripts') {
        const [{ veri }, projeler] = await Promise.all([
          rest(`/scripts?user_id=eq.${uid}&deleted_at=is.null&select=*&order=updated_at.desc&limit=500`), projeleriOku(uid)]);
        return json({ ok: true, scripts: (Array.isArray(veri) ? veri : []).map(r => scriptDisari(r, projeler)) });
      }
      if (yol === '/ideas') {
        const [{ veri }, projeler] = await Promise.all([
          rest(`/ideas?user_id=eq.${uid}&deleted_at=is.null&select=*&order=sort_index.asc&limit=1000`), projeleriOku(uid)]);
        return json({ ok: true, ideas: (Array.isArray(veri) ? veri : []).map(r => fikirDisari(r, projeler)) });
      }
      if (yol === '/imports') {
        const { veri } = await rest(`/ai_aktarimlar?user_id=eq.${uid}&select=id,created_at,kaynak,ozet,geri_alindi_at,kayitlar,projeler,mekanlar,scriptler,fikirler&order=created_at.desc&limit=20`);
        return json({ ok: true, imports: (Array.isArray(veri) ? veri : []).map((r: any) => ({
          importId: r.id, at: r.created_at, source: r.kaynak, note: r.ozet?.note || '', counts: { created: r.ozet?.created || {}, updated: r.ozet?.updated || {} },
          ids: { entries: r.kayitlar, projects: r.projeler, places: r.mekanlar, scripts: r.scriptler, ideas: r.fikirler },
          undone: !!r.geri_alindi_at })) });
      }
      return hata(404, 'not_found', `unknown endpoint ${req.method} ${yol}`);
    }

    if (req.method !== 'POST') return hata(405, 'method', 'only GET and POST');
    const uzunluk = Number(req.headers.get('content-length') || 0);
    if (uzunluk > 1_500_000) return hata(413, 'too_large', 'body must be under 1.5 MB');
    let govde: any;
    try { govde = await req.json(); } catch { return hata(400, 'bad_json', 'body must be JSON'); }

    if (yol === '/import') {
      // Hız sınırı: anahtar başına saatte 60 aktarım.
      const birSaatOnce = new Date(Date.now() - 3600000).toISOString();
      const n = await sayim('ai_aktarimlar', `user_id=eq.${uid}&created_at=gte.${birSaatOnce}`);
      if (n >= 60) return hata(429, 'rate_limited', 'at most 60 imports per hour; try again later');
      return await aktar(kim, govde);
    }
    if (yol === '/undo') return await geriAl(kim, govde);
    return hata(404, 'not_found', `unknown endpoint ${req.method} ${yol}`);
  } catch (e) {
    console.error('[ai] hata', yol, e);
    const m = e instanceof RestHata ? String(e.message) : '';
    if (/schema cache|does not exist|relation/.test(m) && /ai_aktarimlar|api_keys/.test(m)) return hata(503, 'not_installed', 'sql/35-ai-erisimi.sql has not been run yet');
    return hata(500, 'server', m ? 'database: ' + m.slice(0, 200) : 'unexpected error');
  }
});
