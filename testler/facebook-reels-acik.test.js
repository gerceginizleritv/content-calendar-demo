// FACEBOOK REELS OTOMATIK YAYINA GERI ALINDI — UC YER, AYNI KARAR
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR
// ══════════════════════════════════════════════════════════════════
// Bu dosya once "facebook-reels-kapali.test.js" idi ve kapatmanin iki
// yerde birden yazili oldugunu olcuyordu. 13 Ekim 2026'da karar TERSINE
// dondu; dosya da onunla birlikte dondu, silinmedi: ayni uc yer hala
// birbirine bagli ve biri eksik kalirsa davranis yine sessizce yarim
// kaliyor -- sadece yon degisti.
//
// NE OLDU
// 5 Ekim'de facebook/reels kapatildi. Gerekce: ayni dosya, ayni
// dakika, ayni hat -- elle 127.672 goruntulenme, API ile 19 (1 tekil
// kisi). Olcum DOGRUYDU, teshis YANLISTI: Facebook reels'i dagitmiyor
// degilmis, META UYGULAMASI HIC YAYINLANMAMISTI (In development). O
// durumda Facebook icerigi yalnizca uygulamada rolu olan kisilere
// gosteriyor; "19 goruntuleme, 1 tekil kisi" tam olarak bunun imzasi.
// Uygulama Live yapildi, 13 Ekim'deki reels goruntulenme aldi.
//
// ⛔ VE HIKAYELER DE ETKILENMISTI. Bu dosyanin eski surumunde
// "Facebook hikayeleri etkilenmiyor, 109-422 goruntulenme almaya devam
// ediyorlar" yaziyordu. O sayi dogrulanmadan yazilmisti ve yanlisti:
// Business Suite 15 Eylul - 12 Ekim arasi hikayelerde DUZ 0
// gosteriyor. Ayni hikaye dosyalari Instagram'da izlenmisti (dosya
// saglam), sayfanin 15 bin takipcisi var (kitle var). Uygulama Live
// olduktan sonraki ilk olcum: 39 ve 14 goruntuleyen.
//
// ══════════════════════════════════════════════════════════════════
// NE OLCULUYOR — UC YER, UCU DE GEREKLI
// ══════════════════════════════════════════════════════════════════
//   1. sql/58          -> story_kuyruk_al   (kayit kuyruga DUSUYOR)
//   2. pc/story-yukle  -> OTOMATIK_YAYIN    (kaydin tiki ACILIYOR)
//   3. app.html        -> otoYayinTazele    (kutucuk CALISIYOR)
//
// Biri eksik kalirsa hicbir yerde hata cikmiyor:
//   1 eksik -> tik acik gorunur ama kuyruk kaydi hic almaz; kullanici
//              yayini bekler, hicbir sey gitmez. 12 Ekim 2026'da tam
//              olarak bu atlandi: kaydin tiki acildi, kuyruktaki
//              dislama satiri gorulmedi.
//   2 eksik -> her yeni dosyada tik kapali gelir; kullanici her kaydi
//              elle acmak zorunda kalir ve biri mutlaka unutulur.
//   3 eksik -> kutucuk calisan bir yayinda KAPALI gorunur. Yine yalan,
//              sadece ters yonde.
//
// ⚠ sql/56 HALA DISLAMAYI TASIYOR ve bu KASITLI: geri alma yolu o.
// Asagida ayrica olculuyor -- biri "temizlik" diye silerse deneyi
// kapatmanin yolu kaybolur.
//
// Yorumlar ATILIYOR. 28 Eylul 2026'da bir olcum kodun kendi YORUMUYLA
// eslesip gecti: kod silinse test yine geciyordu. Bu dosyanin
// ustundeki anlatim da ayni tuzak.
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (p)=> fs.readFileSync(yol.join(KOK, p), 'utf8');

const sqlYorumsuz = (s)=> s.replace(/--[^\n]*/g, '');
const jsYorumsuz  = (s)=> s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const pyYorumsuz  = (s)=> s.replace(/^[ \t]*#[^\n]*\n/gm, '');

// `create ... function public.<ad>` govdesi
function sqlGovde(metin, ad){
  const i = metin.indexOf('function public.' + ad);
  if(i < 0) return null;
  const son = metin.indexOf('end $$;', i);
  return metin.slice(i, son < 0 ? metin.length : son);
}
// `function <ad>(){ ... }` govdesi -- suslu parantez sayarak.
function jsGovde(metin, ad){
  const i = metin.indexOf('function ' + ad + '(');
  if(i < 0) return null;
  let a = metin.indexOf('{', i);
  if(a < 0) return null;
  let derinlik = 0;
  for(let j = a; j < metin.length; j++){
    if(metin[j] === '{') derinlik++;
    else if(metin[j] === '}'){ derinlik--; if(!derinlik) return metin.slice(a, j + 1); }
  }
  return null;
}

// Dislama kosulu: tek satirda, platform VE tur birlikte, olumsuzlanmis.
const DISLAMA = /and\s+not\s*\(\s*e\.platform\s*=\s*'facebook'\s+and\s+e\.type\s*=\s*'reels'\s*\)/i;

// ── 1. KUYRUK: sql/58 dislamayi KALDIRMIS olmali ──────────────────
console.log('[sql/58 — kuyruk açık]');
{
  const govde = sqlGovde(sqlYorumsuz(oku('sql/58-facebook-reels-kuyruga-geri.sql')), 'story_kuyruk_al');
  bak('story_kuyruk_al bulundu', !!govde);
  if(govde){
    bak('★ facebook + reels dışlaması YOK', !DISLAMA.test(govde),
        (DISLAMA.exec(govde) || [''])[0]);
    // Hikayeler de durmamis olmali: platforma TEK BASINA bakan kosul yok.
    const yalnizPlatform = /e\.platform\s*(<>|!=|=)\s*'facebook'/i.test(govde);
    bak('★ hikâyeler de serbest (platforma tek başına bakan koşul yok)',
        !yalnizPlatform,
        yalnizPlatform ? (/[^\n]*e\.platform[^\n]*/i.exec(govde) || [''])[0] : '');
    // Tur kumesi yerinde: acilan sey yalnizca facebook/reels, kuyrugun
    // kendisi degil.
    bak('tür kümesi yerinde (kuyruk gevşetilmedi)',
        /e\.type\s*=\s*any\(public\.story_yayin_turleri\(\)\)/.test(govde));
    // Sahip kontrolu DURUYOR: sql/49. Bu satir dusese kuyruk HERKESIN
    // kaydini alir ve worker hepsini ayni hesaba yayinlar.
    bak('★ sahip kontrolü duruyor (sql/49 kaybolmadı)',
        /p\.prefs->>'story_yayin'\s*=\s*'true'/.test(govde));
  }
}

// ── 2. GERI ALMA YOLU: sql/56 dislamayi HALA TASIYOR olmali ───────
console.log('[sql/56 — geri alma yolu duruyor]');
{
  const govde = sqlGovde(sqlYorumsuz(oku('sql/56-hazir-olunca-yukle.sql')), 'story_kuyruk_al');
  bak('story_kuyruk_al bulundu', !!govde);
  if(govde){
    bak('★ sql/56 hâlâ dışlamayı taşıyor (deneyi kapatma yolu)',
        DISLAMA.test(govde));
  }
}

// ── 3. POLITIKA: tabloda facebook/reels ACIK ──────────────────────
console.log('[pc/story-yukle.py — politika]');
{
  const kaynak = pyYorumsuz(oku('pc/story-yukle.py'));
  const i = kaynak.indexOf('OTOMATIK_YAYIN = {');
  bak('OTOMATIK_YAYIN bulundu', i >= 0);
  if(i >= 0){
    const tablo = kaynak.slice(i, kaynak.indexOf('}', i) + 1);
    bak('★ facebook/reels AÇIK',
        /\(\s*'facebook'\s*,\s*'reels'\s*\)\s*:\s*True/.test(tablo),
        (/\(\s*'facebook'\s*,\s*'reels'\s*\)\s*:\s*\w+/.exec(tablo) || ['yok'])[0]);
    bak('★ facebook/story AÇIK kaldı',
        /\(\s*'facebook'\s*,\s*'story'\s*\)\s*:\s*True/.test(tablo));
    // ⛔ Acilan sey yalnizca Facebook. TikTok'un video.publish onayi
    // yok, YouTube'un denetim kapisi kapali -- ikisi de ACILMAMALI.
    bak('★ tiktok/reels KAPALI kaldı (video.publish onayı yok)',
        /\(\s*'tiktok'\s*,\s*'reels'\s*\)\s*:\s*False/.test(tablo));
    bak('★ youtube/shorts KAPALI kaldı (denetim kapısı)',
        /\(\s*'youtube'\s*,\s*'shorts'\s*\)\s*:\s*False/.test(tablo));
  }
}

// ── 4. ARAYUZ: sert kapatma dali KALKMIS olmali ───────────────────
console.log('[app.html — otoYayinTazele]');
{
  const ham = oku('app.html');
  const govde = jsGovde(jsYorumsuz(ham), 'otoYayinTazele');
  bak('otoYayinTazele bulundu', !!govde);
  if(govde){
    const kosul = /currentEvent\.platform[^\n]*===\s*'facebook'\s*&&\s*tur\s*===\s*'reels'/;
    bak('★ facebook + reels dalı KALKTI', !kosul.test(govde),
        (kosul.exec(govde) || [''])[0]);
    // Kutucuk artik auto_publish'i OKUYARAK ciziliyor olmali.
    bak('★ kutucuk auto_publish\'ten çiziliyor',
        /setOtoYayinToggle\(!!\(y && y\.otomatik\)/.test(govde));
  }
  // Artik kullanilmayan metin iki dilden de kalkmis olmali: duran bir
  // ceviri anahtari, dalin geri geldigini dusunduren olu bir iz birakir.
  bak('★ oy_fb_reels metni hiçbir dilde kalmadı',
      !/oy_fb_reels/.test(ham),
      (/[^\n]*oy_fb_reels[^\n]*/.exec(ham) || [''])[0].slice(0, 80));
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
