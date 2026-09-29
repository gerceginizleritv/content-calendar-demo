// OTOMATIK YAYINLANABILEN TURLER — DORT YER, TEK KUME
//
// ══════════════════════════════════════════════════════════════════
// NE OLCULUYOR
// ══════════════════════════════════════════════════════════════════
// "Hangi turler kendiliginden yayinlanir" sorusunun cevabi DORT ayri
// dosyada, dort ayri dilde yazili:
//
//   1. sql/53  -> story_kuyruk_al        (kayit kuyruga duser mi)
//   2. sql/53  -> story_yayin_ani_tazele (publish_at dolar mi)
//   3. app.html -> YAYIN_TURLERI         (kutucuk gorunur mu)
//   4. mcp/*   -> YAYIN_TURLERI          (boyut tavani hangisi)
//
// Dordu AYNI kumeyi yazmak zorunda ve biri eksik kaldiginda HICBIR
// YERDE HATA CIKMIYOR -- davranis sessizce yarim oluyor:
//
//   1 eksik -> kayit kuyruga hic dusmez
//   2 eksik -> publish_at null kalir, kayit yine dusmez
//   3 eksik -> kullanici kutucugu hic goremez
//   4 eksik -> yukleyici kayda dosya yazmaz
//
// Bu depoda "ayni liste iki yerde" hatasi bes kez yasandi. Bu dosya
// metin arayan bir test degil: dort listeyi AYRISTIRIP birbirine
// esitliyor. Yeni bir tur eklenirse hangisinin eksik kaldigini adiyla
// soyluyor.
//
// ══════════════════════════════════════════════════════════════════
// BESINCI YER: worker'in TUR TABLOSU
// ══════════════════════════════════════════════════════════════════
// story-yayin/index.ts'teki TURLER, kumeye degil PLATFORM ESLESMESINE
// bakiyor -- kuyruga dusen her turun oraya da yazilmasi gerekiyor,
// yoksa kayit "tur taninmiyor" diye ertelenir. O yuzden bu dosya
// TURLER'in anahtarlarini da ayni kumeye esitliyor.
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (p)=> fs.readFileSync(yol.join(KOK, p), 'utf8');

// ── Ayristiricilar ────────────────────────────────────────────────
// Hepsi YORUMLARI ATIYOR. 28 Eylul 2026'da bir olcum kodun kendi
// YORUMUYLA eslesip gecti: kod silinse test yine geciyordu. Yorum
// icindeki bir ornek listeyi kod sanmak ayni tuzak.
const sqlYorumsuz = (s)=> s.replace(/--[^\n]*/g, '');
const jsYorumsuz  = (s)=> s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// sql/54: kume ARTIK TEK ISLEVDE.
// `select array['a', 'b']::text[]` -> ['a','b']
function sqlDizi(metin){
  const m = /select\s+array\[([^\]]*)\]::text\[\]/.exec(metin);
  if(!m) return null;
  return m[1].split(',').map(x=> x.trim().replace(/^'|'$/g, '')).filter(Boolean);
}
// `create ... function public.<ad>` govdesi
function sqlGovde(metin, ad){
  const i = metin.indexOf('function public.' + ad);
  if(i < 0) return null;
  const son = metin.indexOf('end $$;', i);
  return metin.slice(i, son < 0 ? metin.length : son);
}
// `const YAYIN_TURLERI = ['a', 'b'];` -> ['a','b']
function jsKume(metin, ad){
  const m = new RegExp('const\\s+' + ad + '\\s*=\\s*\\[([^\\]]*)\\]').exec(metin);
  if(!m) return null;
  return m[1].split(',').map(x=> x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}
const ayni = (a, b)=> !!a && !!b
  && a.length === b.length
  && a.slice().sort().join('|') === b.slice().sort().join('|');

// ── Kaynaklar ─────────────────────────────────────────────────────
const SQL54 = sqlYorumsuz(oku('sql/54-yayin-turleri-tek-yer.sql'));
const APP   = jsYorumsuz(oku('app.html'));
const MCP   = jsYorumsuz(oku('supabase/functions/mcp/index.ts'));
const MCPTK = jsYorumsuz(oku('supabase/functions/mcp/tek-dosya.ts'));
const WORKER= oku('supabase/functions/story-yayin/index.ts');

console.log('[SQL tarafi: kume tek islevde]');

// TEK KAYNAK.
const kuyruk = sqlDizi(SQL54);
bak('sql/54 story_yayin_turleri kumesi okunabiliyor',
    Array.isArray(kuyruk) && kuyruk.length > 0, JSON.stringify(kuyruk));

// ⚠ UC ISLEV DE O KAYNAGA SORMALI.
// 29 Eylul 2026: story_asili_topla yalnizca 'story' suzuyordu ve iki
// tur ekleme turunda da (sql/50, sql/53) unutulmustu. Coken bir
// reels/shorts yayini kaydi sonsuza kadar 'in_progress' kaliyordu --
// ne yayin, ne hata, ne kuyruk, hicbir yerde goruntu yok.
for(const islev of ['story_asili_topla', 'story_kuyruk_al', 'story_yayin_ani_tazele']){
  const govde = sqlGovde(SQL54, islev);
  bak(islev + ' sql/54 icinde tanimli', !!govde);
  bak('★ ' + islev + ' kumeyi ISLEVDEN okuyor (elle yazmiyor)',
      !!govde && /story_yayin_turleri\(\)/.test(govde),
      govde ? (/type[^\n]*/.exec(govde) || [''])[0] : 'govde yok');
  // Ve elle yazilmis bir tur listesi KALMAMALI: biri isleve gecip
  // otekini birakmak, ikisinin ayrismasi demek.
  bak('★ ' + islev + " icinde elle yazilmis tur listesi yok",
      !!govde && !/type\s+in\s*\(/.test(govde),
      govde ? (/type\s+in\s*\([^)]*\)/.exec(govde) || [''])[0] : '');
}

// ── Veritabani disindaki uc kopya ─────────────────────────────────
console.log('[VT disindaki kopyalar ayni kumeyi biliyor mu]');
const app   = jsKume(APP,   'YAYIN_TURLERI');
const mcp   = jsKume(MCP,   'YAYIN_TURLERI');
const mcptk = jsKume(MCPTK, 'YAYIN_TURLERI');
bak('app.html YAYIN_TURLERI okunabiliyor', Array.isArray(app) && app.length > 0,
    JSON.stringify(app));
bak('mcp/index.ts YAYIN_TURLERI okunabiliyor', Array.isArray(mcp) && mcp.length > 0,
    JSON.stringify(mcp));
bak('★ app.html SQL ile AYNI kumeyi biliyor', ayni(app, kuyruk),
    JSON.stringify(app) + ' vs ' + JSON.stringify(kuyruk));
bak('★ MCP SQL ile AYNI kumeyi biliyor', ayni(mcp, kuyruk),
    JSON.stringify(mcp) + ' vs ' + JSON.stringify(kuyruk));
bak('★ mcp/index.ts ile tek-dosya.ts ayrismamis', ayni(mcp, mcptk),
    JSON.stringify(mcp) + ' vs ' + JSON.stringify(mcptk));

// ── Besinci yer: worker'in TURLER tablosu ─────────────────────────
console.log('[worker tur tablosu]');
const tabloM = /const TURLER[^=]*=\s*\{([\s\S]*?)\n\};/.exec(WORKER);
bak('worker TURLER tablosu bulunabiliyor', !!tabloM);
const tablo = tabloM ? jsYorumsuz(tabloM[1]) : '';
const turler = (tablo.match(/^\s*(\w+)\s*:\s*\{/gm) || [])
  .map(x=> x.trim().replace(/\s*:\s*\{$/, ''));
bak('★ worker TURLER anahtarlari kuyrukla AYNI', ayni(turler, kuyruk),
    JSON.stringify(turler) + ' vs ' + JSON.stringify(kuyruk));

// Her turun EN AZ BIR platformu olmali, yoksa o tur hic yayinlanmaz --
// ve sebebini yalnizca erteleme satirinda yazar.
console.log('[her turun platformu var mi]');
for(const t of turler){
  const m = new RegExp(t + "\\s*:\\s*\\{[^}]*platformlar:\\s*\\[([^\\]]*)\\]").exec(tablo);
  const pf = m ? m[1].split(',').map(x=> x.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
  bak("'" + t + "' turunun platformu tanimli", pf.length > 0, JSON.stringify(pf));
}

// ── shorts YouTube'a bagli mi ─────────────────────────────────────
// Bu tek olcum icin ozel bir sebep var: shorts kaydi Instagram'a
// dusseydi worker onu STORY olarak yayinlardi (reelMi false doner) ve
// 24 saatte kaybolurdu. Hicbir yerde hata gorunmezdi.
console.log('[shorts yalnizca YouTube]');
{
  const m = /shorts\s*:\s*\{[^}]*platformlar:\s*\[([^\]]*)\]/.exec(tablo);
  const pf = m ? m[1].split(',').map(x=> x.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
  bak('★ shorts YALNIZCA youtube', pf.length === 1 && pf[0] === 'youtube', JSON.stringify(pf));
  bak('★ youtube YAYINLANABILIR listesinde',
      /const YAYINLANABILIR = \[[^\]]*'youtube'/.test(jsYorumsuz(WORKER)));
}

// ── Denetim kapisi duruyor mu ─────────────────────────────────────
// ⛔ Denetimden gecmemis bir projeden yuklenen video KALICI olarak
// ozel kaliyor. Kapi kaldirilirsa kullanicinin gercek videolari geri
// alinamaz sekilde gomulur. Davranisin kendisi story-yayin.test.js'te
// olculuyor; burada kapinin VARLIGI olculuyor, cunku silinmesi tek
// satirlik bir is.
console.log('[youtube denetim kapisi]');
{
  const w = jsYorumsuz(WORKER);
  bak('denetim anahtari OKUNUYOR (tanim duruyor)',
      /ytDenetim\s*=\s*\(\)\s*=>\s*ayar\('YOUTUBE_DENETIM_GECTI'\)/.test(w),
      (/ytDenetim[^\n]*/.exec(w) || [''])[0]);
  bak('★ kapinin KOSULU yayin yolunda duruyor',
      /pf === 'youtube'\s*&&\s*!ytDenetim\(\)/.test(w),
      (/[^\n]*ytDenetim\(\)[^\n]*/g.exec(w) || [''])[0]);
  bak('★ gorunurluk varsayilani private',
      /ytGorunurluk[^\n]*\|\|\s*'private'/.test(w),
      (/ytGorunurluk[^\n]*/.exec(w) || [''])[0]);
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
