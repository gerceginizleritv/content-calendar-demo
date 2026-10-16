// ASİSTAN TİKİ AÇABİLİR — AMA YALNIZCA THREADS'TE
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR
// ══════════════════════════════════════════════════════════════════
// 16 Ekim 2026. Ankette ve metin postunda GÖRSEL YOK, yani PC'deki
// klasör izleyicisi hiç koşmuyor -- oysa `auto_publish` tikini açan
// yer odur. Sonuç: her anket için kullanıcı uygulamadan elle
// tiklemek zorundaydı. Kullanıcı "anketler otomatik planlandığında
// gitsin" dedi ve iki seçenekten KAPILI olanı seçti.
//
// ⛔ TİK, "PLANLANDI" İLE "YAYINA GİDECEK" ARASINDAKİ SON KAPI.
// Asistanın her kaydın tikini açabilmesi; bir TikTok reels kaydının
// yayın denemesine girmesi (video.publish onayı yok) ya da bir
// YouTube kaydının denetim kapısına dayanması demek olurdu. İkisi de
// worker'da ayrıca engelli -- ama "ayrıca engelli" bir şeyi denemek
// gürültü üretir ve hata e-postası gönderir.
//
// Bu dosyanın işi o kapıyı ölçmek. Kapı davranışı METİN OLARAK
// değil, GERÇEKTEN koşturularak ölçülüyor: izin işlevi dosyadan
// çıkarılıp çalıştırılıyor.
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (p)=> fs.readFileSync(yol.join(KOK, p), 'utf8');
const jsYorumsuz = (s)=> s.replace(/\/\*[\s\S]*?\*\//g, '')
                         .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const HAM = oku('supabase/functions/mcp/index.ts');
const MCP = jsYorumsuz(HAM);
const TEK = jsYorumsuz(oku('supabase/functions/mcp/tek-dosya.ts'));

function surumEnAz(metin, enAz){
  const m = /const SURUM = '(\d+)\.(\d+)\.(\d+)'/.exec(metin);
  if(!m) return false;
  const v = [Number(m[1]), Number(m[2]), Number(m[3])];
  for(let i = 0; i < 3; i++){
    if(v[i] > enAz[i]) return true;
    if(v[i] < enAz[i]) return false;
  }
  return true;
}

// ── 1. KAPI DAVRANIŞI — GERÇEKTEN KOŞTURULUYOR ───────────────────
// ⚠ METNE BAKAN BİR ÖLÇÜM BURADA YETMEZDİ: liste doğru yazılmış olup
// karşılaştırma yanlış olabilir (büyük/küçük harf, eksik trim). O
// yüzden işlev dosyadan çıkarılıp çağrılıyor.
console.log('[kapı — çalıştırılarak]');
let otoIzinli = null, liste = null;
{
  const mListe = /const OTO_IZINLI: Array<\[string, string\]> = (\[[\s\S]*?\]);/.exec(MCP);
  const mIslev = /const otoIzinli = ([\s\S]*?);\n/.exec(MCP);
  bak('izin listesi ve işlevi dosyada bulunabiliyor', !!mListe && !!mIslev);
  if(mListe && mIslev){
    const kod = 'const OTO_IZINLI = ' + mListe[1] + ';\n'
              + 'const otoIzinli = ' + mIslev[1].replace(/:\s*any/g, '') + ';\n'
              + 'return { OTO_IZINLI, otoIzinli };';
    const r = new Function(kod)();
    otoIzinli = r.otoIzinli; liste = r.OTO_IZINLI;
  }
}
if(otoIzinli){
  bak('★ threads/poll açılabiliyor', otoIzinli('threads', 'poll') === true);
  bak('★ threads/text_post açılabiliyor', otoIzinli('threads', 'text_post') === true);
  // Büyük/küçük harf: planlama sohbeti "Threads" yazabilir.
  bak('★ büyük harfle de tanınıyor', otoIzinli('Threads', 'Poll') === true);
  // ⛔ KAPALI OLANLAR. Bunların tikini izleyici açıyor ya da kapı
  // kullanıcıda; asistan buraya uzanmıyor.
  bak('★ instagram/story açılamıyor', otoIzinli('instagram', 'story') === false);
  bak('★ facebook/reels açılamıyor', otoIzinli('facebook', 'reels') === false);
  bak('★ youtube/shorts açılamıyor', otoIzinli('youtube', 'shorts') === false);
  bak('★ tiktok/reels açılamıyor', otoIzinli('tiktok', 'reels') === false);
  // Threads'in kendi öteki türleri de kapalı: liste cift bazinda.
  bak('★ threads/reels açılamıyor (çift bazında)', otoIzinli('threads', 'reels') === false);
  bak('★ boş/eksik çift açılamıyor',
      otoIzinli(undefined, undefined) === false && otoIzinli('', '') === false);
  // Liste iki çiftten uzun olmamalı: büyüdüğünde bu ölçüm kırmızıya
  // döner ve ekleyen kişi gerekçesini yazmak zorunda kalır.
  bak('★ izinli çift sayısı iki', Array.isArray(liste) && liste.length === 2,
      JSON.stringify(liste));
}

// ── 2. İSTEK YOLU ────────────────────────────────────────────────
console.log('[istek yolu]');
{
  // Alan araç şemasında olmasa planlama sohbeti onu hiç gönderemezdi
  // (additionalProperties: false).
  bak('★ autoPublish araç şemasında', /autoPublish: \{ type: 'boolean'/.test(MCP));
  bak('★ şema açıklaması yalnızca Threads dediğini söylüyor',
      /Only allowed for Threads polls and/.test(HAM));
  // "nothing to change" listesine girmemişse alan sessizce yutulurdu.
  bak('★ değişen alanlar listesinde',
      /'content', 'autoPublish'\]\.filter/.test(MCP),
      (/const degisti = [^\n]*/.exec(MCP) || ['yok'])[0].slice(0, 80));
  // Asıl yazma.
  bak('★ sütuna yazılıyor', /yama\.auto_publish = a\.autoPublish === true/.test(MCP));
  // ⛔ KAPI: yalnızca AÇMAK denetleniyor; kapatmak her zaman serbest.
  bak('★ açarken izin denetleniyor',
      /if \(a\.autoPublish === true && !otoIzinli\(pf, tr\)\)/.test(MCP),
      (/a\.autoPublish === true &&[^\n]*/.exec(MCP) || ['yok'])[0]);
  bak('★ reddetme sebebi yazılı (hangi çift, ne yapılacak)',
      /cannot be turned on for/.test(HAM) && /the user opens the toggle in the app/.test(HAM));
  // ⛔ EN SİNSİ KAÇAK: "platformu threads yap VE tiki aç" diyen tek
  // bir çağrı. Çift DEĞİŞİKLİKTEN SONRAKİ halden okunmazsa, eski
  // platformu threads olmayan bir kayıt kapıdan geçerdi -- ya da
  // tersi: threads'ten çıkarılan bir kayıt açık kalırdı.
  bak('★ çift, değişiklikten SONRAKİ halden okunuyor',
      /const pf = a\.platform !== undefined \? temiz\.platform : satir\.platform/.test(MCP)
      && /const tr = a\.type !== undefined \? temiz\.type : satir\.type/.test(MCP),
      (/const pf = [^\n]*/.exec(MCP) || ['yok'])[0]);
  bak('★ MCP sürümü kapıyı taşıyan sürümden geri değil', surumEnAz(MCP, [1,13,0]),
      (/const SURUM = '[^']*'/.exec(MCP) || ['yok'])[0]);
  // Panele yapıştırılan sürüm eskiyse bu işin tamamı canlıda YOK.
  bak('★ tek-dosya.ts yeniden üretildi', /OTO_IZINLI/.test(TEK) && surumEnAz(TEK, [1,13,0]));
}

// ── 3. PC TARAFI BOZULMADI ───────────────────────────────────────
// ⚠ Bu liste pc/story-yukle.py'deki politika tablosunun KOPYASI
// DEĞİL, alt kümesi. Orada açık olan instagram/facebook çiftleri
// burada yok, çünkü onların tikini izleyici açıyor. Ölçüm, iki
// tarafın birbirine karışmadığını kontrol ediyor.
console.log('[PC politikası bozulmadı]');
{
  const YUKLE = oku('pc/story-yukle.py').replace(/^[ \t]*#[^\n]*\n/gm, '');
  bak('★ PC tablosunda threads/poll hâlâ açık', /\('threads',\s*'poll'\):\s*True/.test(YUKLE));
  bak('★ PC tablosunda tiktok hâlâ kapalı', /\('tiktok',\s*'reels'\):\s*False/.test(YUKLE));
  // MCP listesi PC'de KAPALI olan bir çifti içermemeli: oradan kapalı,
  // buradan açık olsa kapı anlamsızlaşırdı.
  if(liste){
    const pcKapali = [['tiktok','reels'], ['youtube','shorts']];
    bak('★ MCP listesi PC\'de kapalı bir çift içermiyor',
        !liste.some(([p,t]) => pcKapali.some(([a,b]) => a===p && b===t)),
        JSON.stringify(liste));
  }
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
