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

import { paketiCoz, basvuruCoz, kimlikUret, kimlikGecerli, tarihGecerli, adAnahtari, SINIRLAR, PROJE_ADIMLARI } from './dogrula.js';
import { SEMA } from './sema.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVIS_ANAHTARI = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// Surum, dagitimin tuttugunu ANLAMAK icin var. Bir kez su oldu:
// fonksiyon yeniden dagitilmadi ama GET cevabi eski ve yeni surumde
// birebir ayniydi, yani kontrol hicbir sey olcmedi ve hata baska
// yerde arandi. Surum ve uc listesi artik cevapta.
const SURUM = '1.1.0';

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
  const o: any = { id: r.id, date: r.post_date, time: (r.post_time || '').slice(0, 5), type: r.type, platform: r.platform,
           title: r.title || '', uploaded: !!r.uploaded, project: projeAdi(pid, projeler) || c.concept || '', projectId: pid,
           content: kayitIcerigi(c) };
  // Otomatik yayin alanlari YALNIZCA story kayitlarinda. Oteki turlerde
  // her kayda bes bos alan eklemek cevabi sisirir ve asistana "burada bir
  // sey var" dedirtir -- yok.
  //
  // uploaded ve publishState AYRI SEYLER ve ikisi de burada:
  //   uploaded     = kullanicinin isareti ("portala yukledim")
  //   publishState = sistemin durumu (bekliyor / yayinlandi / hata)
  // Ikisi karistirilmasin diye yan yana duruyorlar.
  // mediaName TUR AYRIMI YAPMADAN veriliyor: artik yazilabilir bir alan
  // (shootboard_import ve shootboard_update_entry). Yalnizca story'de
  // gosterilseydi, baska bir ture yazan asistan yazdigini geri okuyamaz,
  // alan da yazilip okunamayan bir sey olurdu.
  if (r.media_name) o.mediaName = r.media_name;
  if (r.type === 'story') {
    o.autoPublish  = r.auto_publish === true;
    o.publishState = r.publish_state || 'pending';
    o.mediaUrl     = r.media_url || '';
    o.mediaName    = r.media_name || '';
    if (r.published_at) o.publishedAt = r.published_at;
    if (r.last_error)   o.lastError   = r.last_error;
    if (r.attempt_count) o.attemptCount = r.attempt_count;
  }
  return o;
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
                           post_time: k.time === undefined ? undefined : (k.time || null), uploaded: k.uploaded,
                           // Gercek sutun, content'in icinde degil: uygulama content'i
                           // butun olarak yaziyor ve orada dursa bir kayit acilip
                           // kaydedildiginde sessizce silinirdi.
                           media_name: k.mediaName };
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
                            media_name: k.mediaName || null,
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
      'stored them, in their own local calendar \u2014 do not shift them into another time zone. ' +
      'Story entries also carry their auto-publish state: autoPublish says whether the ' +
      'scheduler will post it, publishState is where it stands (pending / in_progress / ' +
      'published / failed), and mediaUrl says whether a file is attached yet. Do not ' +
      'confuse publishState with uploaded \u2014 uploaded is the user\u0027s own mark, ' +
      'publishState belongs to the system.',
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
      'Change one existing calendar entry — its date, time, title, upload state, ' +
      'media file name or text fields. Only the fields you pass are changed; ' +
      'everything else is left alone. Find the id with shootboard_list_entries. ' +
      'There is no delete tool: entries can only be removed by the user, inside the app.',
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
        mediaName: alan('mediaName'),
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

  const degisti = ['date', 'time', 'title', 'type', 'platform', 'uploaded', 'mediaName', 'content'].filter(k => a[k] !== undefined);
  if (!degisti.length) return aracHata('nothing to change: pass at least one of date, time, title, type, platform, uploaded, mediaName, content.');

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
    mediaName: a.mediaName !== undefined ? a.mediaName : (satir.media_name || ''),
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
  // Bos dizge "adi kaldir" demek: bagi koparmanin baska yolu olmasin.
  if (a.mediaName !== undefined) yama.media_name = temiz.mediaName || null;
  if (a.content !== undefined) yama.content = { ...eski, ...(temiz.content || {}) };

  await rest(`/calendar_events?id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}`,
             { method: 'PATCH', govde: yama, prefer: 'return=minimal' });

  const projeler = await projeleriOku(uid);
  const { veri: sonra } = await rest(`/calendar_events?id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}&select=*&limit=1`);
  const yeni = Array.isArray(sonra) && sonra[0];
  return { ok: true, changed: degisti, entry: yeni ? kayitDisari(yeni, projeler) : null,
           warnings: paket.hatalar.map((x: any) => ({ field: x.alan || '', reason: x.sebep })) };
}


// ---- PC yükleyicisi için REST uçları ---------------------------------------
// Şartname Bölüm 2, Seçenek B: render bitince PC'de çalışan küçük bir
// script dosyayı R2'ye koyuyor ve Shootboard kaydına mediaUrl yazıyor.
// Shootboard'a upload arayüzü EKLENMİYOR (kullanıcı kararı).
//
// Bu uçlar MCP değil, düz REST: bir betik Authorization başlığı
// gönderebiliyor, claude.ai gönderemiyor. İkisi aynı anahtarı kullanıyor.
//
// Adres:  .../functions/v1/mcp/api/entries/...
//         Authorization: Bearer shb_...

// Dosya adından tarih: "2026-10-05_story_konu_k1.mp4" -> "2026-10-05"
function dosyaAdindanTarih(ad: string): string {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(String(ad || ''));
  return m && tarihGecerli(m[1]) ? m[1] : '';
}

// Kaydın yayın alanlarını dışarı verilen hali. uploaded BİLEREK burada
// da yok: bu uçların işi yayın durumu, kullanıcının işareti değil.
function yayinDisari(r: any) {
  return {
    id: r.id, date: r.post_date, time: (r.post_time || '').slice(0, 5),
    type: r.type, platform: r.platform, title: r.title || '',
    autoPublish: r.auto_publish === true,
    mediaUrl: r.media_url || '', mediaName: r.media_name || '',
    mediaBytes: r.media_bytes ?? null, mediaMime: r.media_mime || '',
    publishAt: r.publish_at || null, publishState: r.publish_state || 'pending',
    publishedAt: r.published_at || null, externalId: r.external_id || '',
    lastError: r.last_error || '', attemptCount: r.attempt_count ?? 0
  };
}

// Kaydın kendi saat dilimindeki tarih+saati UTC'ye çeviriyor.
// ŞARTNAMEDEN SAPMA (bilerek): şartname "Türkiye sabit UTC+3, DST yazma"
// diyor. Shootboard kayıtları kendi saat dilimini taşıyor
// (content.timezone) ve kullanıcıları yalnızca Türkiye'de değil; sabit
// +3 yazmak başka dilimdeki her kaydı yanlış saate koyardı. Dönüşüm
// kaydın KENDİ diliminden yapılıyor -- paylaşım takvimi beslemesinde de
// aynısı yapılıyor ve orada yaz saati testle ölçülüyor.
function yayinAniHesapla(tarih: string, saat: string, tz: string): string | null {
  if (!tarihGecerli(tarih)) return null;
  const [y, ay, g] = tarih.split('-').map(Number);
  const [ss, dd] = String(saat || '00:00').split(':').map(Number);
  const tahmin = Date.UTC(y, ay - 1, g, ss || 0, dd || 0, 0);
  const ofset = (an: Date): number => {
    try {
      const b = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const o: any = {};
      b.formatToParts(an).forEach(x => { if (x.type !== 'literal') o[x.type] = x.value; });
      const gibi = Date.UTC(+o.year, +o.month - 1, +o.day, (+o.hour) % 24, +o.minute, +o.second);
      return Math.round((gibi - an.getTime()) / 60000);
    } catch { return 0; }
  };
  const o1 = ofset(new Date(tahmin));
  let an = new Date(tahmin - o1 * 60000);
  const o2 = ofset(an);
  if (o2 !== o1) an = new Date(tahmin - o2 * 60000);
  return isNaN(an.getTime()) ? null : an.toISOString();
}

// GET /api/entries/find?file=2026-10-05_story_konu_k1.mp4
// Once tam dosya adi, sonra adin icindeki tarihteki story kayitlari.
async function apiKayitBul(uid: string, dosya: string) {
  const ad = String(dosya || '').trim();
  if (!ad) return { durum: 400, govde: { ok: false, error: 'file: required, e.g. ?file=2026-10-05_story_konu_k1.mp4' } };

  const { veri: tam } = await rest(
    `/calendar_events?user_id=eq.${uid}&deleted_at=is.null&media_name=eq.${encodeURIComponent(ad)}&select=*&limit=5`);
  if (Array.isArray(tam) && tam.length) {
    return { durum: 200, govde: { ok: true, matchedBy: 'mediaName', count: tam.length, entries: tam.map(yayinDisari) } };
  }

  const tarih = dosyaAdindanTarih(ad);
  if (!tarih) {
    return { durum: 404, govde: { ok: false,
      error: `no entry carries the file name "${ad}", and no date could be read from it. Name files like 2026-10-05_story_topic.mp4, or set mediaName on the entry first.` } };
  }
  const { veri } = await rest(
    `/calendar_events?user_id=eq.${uid}&deleted_at=is.null&type=eq.story&post_date=eq.${tarih}&select=*&order=post_time.asc.nullsfirst&limit=20`);
  const satirlar = Array.isArray(veri) ? veri : [];
  if (!satirlar.length) {
    return { durum: 404, govde: { ok: false,
      error: `no story entry on ${tarih}. Create the entry in Shootboard first, then run the uploader.` } };
  }
  // Birden cok aday varsa SECIM YAPILMIYOR: yanlis kayda yazmak,
  // yazmamaktan kotu. Betik kullaniciya soruyor.
  return { durum: 200, govde: { ok: true, matchedBy: 'date', date: tarih,
    count: satirlar.length, entries: satirlar.map(yayinDisari),
    note: satirlar.length > 1 ? 'more than one story on that date; pick one by id' : undefined } };
}

// PATCH /api/entries/{id}
async function apiKaydiYama(uid: string, id: string, govde: any) {
  if (!id) return { durum: 400, govde: { ok: false, error: 'id: required in the path, /api/entries/{id}' } };
  const { veri } = await rest(
    `/calendar_events?id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}&deleted_at=is.null&select=*&limit=1`);
  const satir = Array.isArray(veri) && veri[0];
  if (!satir) return { durum: 404, govde: { ok: false, error: `no entry "${id}" in this account.` } };

  const yama: any = { updated_at: simdi() };
  const hatalar: string[] = [];

  if (govde.mediaUrl !== undefined) {
    const u = String(govde.mediaUrl || '');
    // Graph API dosyayi BU adresten cekiyor: https sart, yonlendirme
    // kabul etmiyor. Sema dogrulamasi burada yapilamaz (Meta cekmeden
    // belli olmuyor) ama en azindan bicim denetleniyor.
    if (u && !/^https:\/\/[^\s]+$/i.test(u)) hatalar.push('mediaUrl: must be a plain https:// URL (Instagram fetches the file from it; redirects are not followed)');
    else yama.media_url = u || null;
  }
  if (govde.mediaName !== undefined) yama.media_name = String(govde.mediaName || '').slice(0, 300) || null;
  if (govde.mediaMime !== undefined) yama.media_mime = String(govde.mediaMime || '').slice(0, 100) || null;
  if (govde.mediaBytes !== undefined) {
    const n = Number(govde.mediaBytes);
    if (!Number.isFinite(n) || n < 0) hatalar.push('mediaBytes: must be a positive number');
    // 100 MB Instagram'in siniri. Buyugu reddediliyor: yayin aninda
    // ogrenmek, yukleme aninda ogrenmekten cok daha pahali.
    else if (n > 100 * 1024 * 1024) hatalar.push(`mediaBytes: ${Math.round(n / 1048576)} MB is over Instagram's 100 MB limit for stories`);
    else yama.media_bytes = Math.round(n);
  }
  if (govde.autoPublish !== undefined) yama.auto_publish = govde.autoPublish === true;

  if (hatalar.length) return { durum: 422, govde: { ok: false, error: hatalar[0], details: hatalar } };

  // publish_at kaydin KENDI tarih/saat/diliminden tureiyor. Cagiranin
  // gonderdigi bir deger kabul edilmiyor: donusum TEK BIR YERDE olsun.
  const c = (satir.content && typeof satir.content === 'object') ? satir.content : {};
  const an = yayinAniHesapla(satir.post_date, (satir.post_time || '').slice(0, 5), c.timezone || 'UTC');
  if (an) yama.publish_at = an;

  // ⛔ uploaded YAMAYA GIRMIYOR ve girmeyecek. O alan kullanicinin kendi
  // isareti; bu uc otomasyonun parcasi. Sartname Bolum 1.
  delete yama.uploaded;

  await rest(`/calendar_events?id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}`,
             { method: 'PATCH', govde: yama, prefer: 'return=minimal' });
  const { veri: sonra } = await rest(
    `/calendar_events?id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}&select=*&limit=1`);
  const yeni = Array.isArray(sonra) && sonra[0];
  return { durum: 200, govde: { ok: true, entry: yeni ? yayinDisari(yeni) : null } };
}

// ---- MCP protokol katmanı --------------------------------------------------
const MCP_SURUM = '2025-11-25';
// Tanıdığımız sürümler. İstemci bunlardan birini isterse aynen geri
// veriliyor; istemediğini dayatmak uyumu kırar.
const BILINEN_SURUMLER = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25', '2026-07-28'];

const SUNUCU_BILGISI = { name: 'shootboard', title: 'Shootboard', version: SURUM };
// Dagitilan surumun NE YAPABILDIGI. Bir uc eksikse buradan gorunuyor.
const UCLAR = ['POST /(mcp)', 'GET /api/entries/find?file=', 'PATCH /api/entries/{id}'];

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
  // Fonksiyonun ADI yoldan cikariliyor ama ADA BAKILMIYOR: Supabase'te
  // slug olusturulduktan sonra degistirilemiyor ve yanlis adla kurulan
  // bir fonksiyon, sabit bir '/mcp' beklendiginde anahtari bulamayip
  // "unauthorized" diyordu -- yani hata, adresi degil anahtari
  // suclatiyordu. Ilk segment neyse atiliyor.
  let yol = url.pathname.replace(/^\/functions\/v1/, '').replace(/^\/[^/]+/, '').replace(/\/+$/, '');

  // Anahtar yolun ilk parcasinda olabilir: /<anahtar>/... claude.ai icin
  // TEK yol bu, cunku orada API anahtari yapistirilacak bir kutu yok.
  // Betikler (PC yukleyicisi, curl) Authorization basligi da kullanabilir.
  let yoldakiAnahtar = '';
  const ayrim = /^\/(shb_[A-Za-z0-9]{20,80})(\/.*)?$/.exec(yol);
  if (ayrim) { yoldakiAnahtar = ayrim[1]; yol = (ayrim[2] || '').replace(/\/+$/, ''); }

  let kim: Kim | null = null;
  try { kim = await kimBu(req, yoldakiAnahtar ? '/' + yoldakiAnahtar : ''); }
  catch (e) {
    console.error('[mcp] anahtar bakılamadı', e);
    const m = e instanceof RestHata ? String(e.message) : '';
    if (/api_keys/.test(m) && /schema cache|does not exist|relation/.test(m)) {
      return hata(503, 'not_installed', 'sql/39-mcp-erisimi.sql has not been run yet');
    }
    return hata(500, 'server', 'key lookup failed');
  }

  // ---- REST uclari (PC yukleyicisi) ----------------------------------
  // MCP'den ONCE bakiliyor: /api/... yolu JSON-RPC degil.
  if (yol.startsWith('/api/')) {
    if (!kim) {
      return hata(401, 'unauthorized',
        'missing or revoked key. Send "Authorization: Bearer shb_..." or put the key in the path.');
    }
    try {
      if (req.method === 'GET' && yol === '/api/entries/find') {
        const r = await apiKayitBul(kim.user_id, url.searchParams.get('file') || '');
        return json(r.govde, r.durum);
      }
      const yama = /^\/api\/entries\/([^/]+)$/.exec(yol);
      if (yama && req.method === 'PATCH') {
        if (!kim.scopes.includes('write')) return hata(403, 'forbidden', 'this key cannot write');
        let g: any;
        try { g = await req.json(); } catch { return hata(400, 'bad_json', 'body must be JSON'); }
        const r = await apiKaydiYama(kim.user_id, decodeURIComponent(yama[1]), g || {});
        return json(r.govde, r.durum);
      }
      return hata(404, 'not_found',
        `unknown endpoint ${req.method} ${yol}. Available: GET /api/entries/find?file=..., PATCH /api/entries/{id}`);
    } catch (e) {
      console.error('[api] hata', yol, e);
      const m = e instanceof RestHata ? String(e.message) : String((e as any)?.message || e);
      if (/publish_state|media_url|auto_publish|story_/.test(m) && /does not exist|schema cache|column/.test(m)) {
        return hata(503, 'not_installed', 'sql/41-story-otomatik-yayin.sql has not been run yet');
      }
      return hata(500, 'server', 'database: ' + m.slice(0, 200));
    }
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
                    endpoints: UCLAR,
                    hint: 'Add your key to the URL: /functions/v1/mcp/shb_...  Generate one in Shootboard → Account.' });
    }
    const s = await sinirlar(kim.user_id);
    const [kayit, proje] = await Promise.all([
      sayim('calendar_events', `user_id=eq.${kim.user_id}&deleted_at=is.null`),
      sayim('projects', `user_id=eq.${kim.user_id}&deleted_at=is.null`)
    ]);
    return json({ ok: true, service: 'shootboard-mcp', version: SURUM, endpoints: UCLAR,
                  keyId: kim.id, scopes: kim.scopes,
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
