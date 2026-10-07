// FACEBOOK REELS OTOMATIK YAYINDAN CIKARILDI — IKI YER, AYNI KOSUL
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR
// ══════════════════════════════════════════════════════════════════
// 5 Ekim 2026: Facebook bu sayfada API ile atilan reels'i dagitmiyor.
// Olcum, ayni sayfada, ayni saatte, ayni dosyalarla:
//
//   elle atilan      4 Ekim 10:13 ·  96 sn -> 127.672 goruntulenme
//   elle atilan      2 Ekim 21:00          ->   1.461
//   API ile          3 Ekim 10:01 · 100 sn ->      19  (1 tekil kisi)
//   API ile          2 Ekim 10:01 ·  86 sn ->       3  (1 tekil kisi)
//
// 4 Ekim'deki dosya Instagram'da -- o da ayni kuyruktan gitti --
// 555.538 oynatma aldi. Dosya, kapak, uzunluk, baslik, bit hizi, telif,
// gizlilik, en/boy orani, uc ve token tek tek olculup elendi.
//
// ══════════════════════════════════════════════════════════════════
// NE OLCULUYOR
// ══════════════════════════════════════════════════════════════════
// Kosul IKI YERDE yazili ve ikisi de gerekli:
//
//   1. sql/56  -> story_kuyruk_al   (kayit kuyruga DUSMUYOR)
//   2. app.html -> otoYayinTazele   (kutucuk sebebiyle KAPALI duruyor)
//
// Biri eksik kalirsa HICBIR YERDE HATA CIKMIYOR, davranis sessizce
// yarim oluyor:
//
//   1 eksik -> reels yine Facebook'a gider ve yine 19 goruntulenme alir
//   2 eksik -> kutucuk ACIK gorunur, durum "Bekliyor" yazar; kullanici
//              yayini bekler, hicbir sey gitmez. Kayitlarin
//              auto_publish'i acik KALDIGI icin bu dal olmadan ekranda
//              duz yalan yaziyor.
//
// ══════════════════════════════════════════════════════════════════
// ⚠ ASIL TUZAK: HIKAYELERI DE DURDURMAK
// ══════════════════════════════════════════════════════════════════
// Facebook HIKAYELERI etkilenmiyor: ayni worker'dan gidip 109-422
// goruntulenme almaya devam ediyorlar. Kosul o yuzden platform VE tur
// birlikte olmak zorunda. Yalniz platforma bakan bir satir -- yazmasi
// daha kolay olani -- calisan 61 hikaye kaydini da sessizce durdururdu.
// Asagidaki iki olcum tam olarak bunu kontrol ediyor.
//
// Yorumlar ATILIYOR. 28 Eylul 2026'da bir olcum kodun kendi YORUMUYLA
// eslesip gecti: kod silinse test yine geciyordu. Bu dosyanin ustundeki
// olcum ornekleri de ayni tuzak.
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (p)=> fs.readFileSync(yol.join(KOK, p), 'utf8');

const sqlYorumsuz = (s)=> s.replace(/--[^\n]*/g, '');
const jsYorumsuz  = (s)=> s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

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

// ── 1. KUYRUK ────────────────────────────────────────────────────
console.log('[sql/56 — kuyruk]');
{
  const govde = sqlGovde(sqlYorumsuz(oku('sql/56-hazir-olunca-yukle.sql')), 'story_kuyruk_al');
  bak('story_kuyruk_al bulundu', !!govde);
  if(govde){
    // Tek satirda, platform VE tur birlikte, olumsuzlanmis.
    const kosul = /and\s+not\s*\(\s*e\.platform\s*=\s*'facebook'\s+and\s+e\.type\s*=\s*'reels'\s*\)/i;
    bak('★ facebook + reels kuyruktan ÇIKARILMIŞ', kosul.test(govde),
        (/and\s+not\s*\([^)]*\)/i.exec(govde) || ['yok'])[0]);
    // ⚠ Hikayeler durmamis olmali: platforma TEK BASINA bakan bir
    // kosul olmayacak.
    const yalnizPlatform = /e\.platform\s*(<>|!=)\s*'facebook'/i.test(govde);
    bak('★ hikâyeler DURDURULMAMIŞ (yalnız platforma bakan koşul yok)',
        !yalnizPlatform,
        yalnizPlatform ? (/[^\n]*e\.platform[^\n]*/i.exec(govde) || [''])[0] : '');
    // Kosulun kendisi hala tur kumesini kullaniyor olmali: reels
    // Instagram'da CALISIYOR, kume degismedi.
    bak('tür kümesi yerinde (Instagram reels etkilenmedi)',
        /e\.type\s*=\s*any\(public\.story_yayin_turleri\(\)\)/.test(govde));
  }
}

// ── 2. ARAYUZ ────────────────────────────────────────────────────
console.log('[app.html — otoYayinTazele]');
{
  const ham = oku('app.html');
  const govde = jsGovde(jsYorumsuz(ham), 'otoYayinTazele');
  bak('otoYayinTazele bulundu', !!govde);
  if(govde){
    const kosul = /currentEvent\.platform[^\n]*===\s*'facebook'\s*&&\s*tur\s*===\s*'reels'/;
    bak('★ facebook + reels dalı duruyor', kosul.test(govde),
        (/[^\n]*'facebook'[^\n]*/.exec(govde) || ['yok'])[0]);
    // Dal kutucugu KAPALI ve DEVRE DISI birakmali: acik gorunen bir
    // kutucuk, hicbir sey yayinlamayan bir kayitta yalan.
    const i = govde.search(kosul);
    const dal = i < 0 ? '' : govde.slice(i, i + 400);
    bak('★ kutucuk kapalı VE devre dışı', /setOtoYayinToggle\(false,\s*true\)/.test(dal),
        (/setOtoYayinToggle\([^)]*\)/.exec(dal) || ['yok'])[0]);
    bak('★ sebebi ekranda yazıyor', /oy_fb_reels/.test(dal));
    // Dal, auto_publish'i okuyan satirdan ONCE olmali -- sonra olsa
    // kutucuk once acik cizilirdi.
    const acikSatir = govde.indexOf('setOtoYayinToggle(!!(y && y.otomatik)');
    bak('★ dal, auto_publish okunmadan ÖNCE', i >= 0 && acikSatir > i,
        'dal=' + i + ' auto=' + acikSatir);
  }
  // Iki dilde de metin olmali: eksik dilde ekranda anahtar adi cikar.
  bak('metin İngilizce var', /oy_fb_reels:\s*"[^"]{40,}"/.test(ham));
  bak('metin Türkçe var',
      (ham.match(/oy_fb_reels:\s*"[^"]{40,}"/g) || []).length >= 2);
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
