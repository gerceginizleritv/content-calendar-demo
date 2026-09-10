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

export const CAL_TYPES = ['video', 'shorts', 'reels', 'carousel', 'story', 'text_post', 'poll'];
export const PLATFORMLAR = ['youtube', 'instagram', 'tiktok', 'facebook', 'threads', 'x', 'pinterest', 'linkedin'];
export const PROJE_TURLERI = ['outdoor', 'venue', 'studio', 'vlog', 'review', 'desk', 'other'];
export const PROJE_ADIMLARI = ['script', 'filmed', 'audio', 'edited', 'approved', 'package', 'published'];

// Paket başına ve hesap başına sınırlar. Kayıt ve proje sınırı hesaptan
// (user_prefs.entry_limit / project_limit) gelir; buradakiler varsayılan.
export const SINIRLAR = {
  paket: 200,
  liste: { places: 100, projects: 100, entries: 200, scripts: 50, ideas: 100 },
  hesap: { entries: 100, projects: 100, places: 400, scripts: 300, ideas: 500 }
};

export const KIMLIK = /^[A-Za-z0-9_-]{1,64}$/;
const TARIH = /^\d{4}-\d{2}-\d{2}$/;
const SAAT = /^\d{2}:\d{2}$/;

// Üst düzey listeler: İngilizce asıl ad, Türkçe takma ad (yedek dosyası).
export const LISTELER = [
  ['places', 'mekanlar'], ['projects', 'projeler'], ['entries', 'kayitlar'],
  ['scripts', 'scriptler'], ['ideas', 'fikirler']
];

export function adAnahtari(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
}
export function kimlikGecerli(x) { return typeof x === 'string' && KIMLIK.test(x); }
export function tarihGecerli(s) {
  if (typeof s !== 'string' || !TARIH.test(s)) return false;
  const [y, a, g] = s.split('-').map(Number);
  if (a < 1 || a > 12 || g < 1) return false;
  return g <= new Date(Date.UTC(y, a, 0)).getUTCDate();
}
export function saatGecerli(s) {
  if (typeof s !== 'string' || !SAAT.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h <= 23 && m <= 59;
}
export function tzGecerli(z) {
  if (typeof z !== 'string' || !z || z.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch { return false; }
}
function rastgele(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, b => (b % 36).toString(36)).join('');
}
// Kimlik üretimi uygulamayla aynı önekler: pr_, mk_, sc_, fk_; kayıtlar UUID.
export function kimlikUret(liste) {
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
export function paketiCoz(ham) {
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
export function basvuruCoz(ref, olanlar) {
  if (!ref) return null;
  const s = String(ref).trim();
  const kimlikle = olanlar.find(x => x.id === s);
  if (kimlikle) return kimlikle;
  const k = adAnahtari(s);
  return olanlar.find(x => adAnahtari(x.name) === k) || null;
}
