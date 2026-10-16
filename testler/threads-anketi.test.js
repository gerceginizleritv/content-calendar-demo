// THREADS ANKETİ — ALTI YER, TEK KARAR
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR
// ══════════════════════════════════════════════════════════════════
// 16 Ekim 2026: Threads anketi eklendi. `poll` türü veri modelinde
// 2 Eylül'den beri duruyordu (eski Facebook anketlerinden kaldı) ama
// YAYIN HATTI YOKTU ve seçenekleri yazacak alan da yoktu. Kullanıcı
// "anket ile başlayalım ama sadece Threads için" dedi.
//
// Karar ALTI yerde birden yazılı ve altısı da gerekli; biri eksik
// kalırsa HİÇBİR YERDE HATA ÇIKMIYOR, davranış sessizce yarım oluyor:
//
//   1. sql/54 + sql/64   -> story_yayin_turleri()  (kayıt kuyruğa düşer)
//   2. pc/story-yukle    -> OTOMATIK_YAYIN         (politika kararı)
//   3. worker TURLER     -> poll/threads           (tür tanınır)
//   4. worker yayın yolu -> poll_attachment        (anket gerçekten gider)
//   5. app.html          -> YAYIN_TURLERI + alanlar + not
//   6. MCP + ai/sema     -> content.anketSecenekler (asistan yazabilir)
//
// ⛔ YEDİNCİ YER YOK AMA BEYAZ LİSTE ÜÇ YERDE: içeriği süzen üç ayrı
// işlev var (ai/dogrula.js, app.html'in bulut okuması, MCP'nin çıktısı)
// ve listede olmayan alan HER ÜÇÜNDE SESSİZCE DÜŞÜYOR. `diller` ve
// `anaDil` tam bunu yaşadı: kullanıcı yazıyor, kaydediliyor, sayfa
// yenilenince yok. Ölçümler bu yüzden üçünü ayrı ayrı yokluyor.
//
// Yorumlar ATILIYOR. 28 Eylül 2026'da bir ölçüm kodun kendi yorumuyla
// eşleşip geçti: kod silinse test yine geçiyordu.
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (p)=> fs.readFileSync(yol.join(KOK, p), 'utf8');

const sqlYorumsuz = (s)=> s.replace(/--[^\n]*/g, '');
// ⚠ `://` YORUM DEĞİL: düz bir silgi "https://developers.facebook.com"
// adresini de yer ve "belgeye atıf var mı" ölçümü kodda duran bir
// adresi görmez.
const jsYorumsuz  = (s)=> s.replace(/\/\*[\s\S]*?\*\//g, '')
                          .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const pyYorumsuz  = (s)=> s.replace(/"""[\s\S]*?"""/g, '')
                          .replace(/^[ \t]*#[^\n]*\n/gm, '');

function jsGovde(metin, ad){
  const i = metin.indexOf('function ' + ad + '(');
  if(i < 0) return null;
  let j = metin.indexOf('(', i), p = 0;
  for(; j < metin.length; j++){
    if(metin[j] === '(') p++;
    else if(metin[j] === ')'){ p--; if(!p){ j++; break; } }
  }
  let a = -1;
  for(let d = 0; j < metin.length; j++){
    if(metin[j] === '<') d++;
    else if(metin[j] === '>') d--;
    else if(metin[j] === '{' && d <= 0){ a = j; break; }
  }
  if(a < 0) return null;
  let d = 0;
  for(let q = a; q < metin.length; q++){
    if(metin[q] === '{') d++;
    else if(metin[q] === '}'){ d--; if(!d) return metin.slice(a, q + 1); }
  }
  return null;
}

// ⚠ SÜRÜM ÖLÇÜMÜ TAM EŞLEŞME DEĞİL, "EN AZ". İlk sürüm `1.18.x`
// arıyordu ve aynı gün gelen bir sonraki iş (anket cevabı, 1.19.0)
// testi KIRMIZI yaptı -- oysa davranış yerindeydi. Aynı sınıftan bir
// hata TikTok testinde vardı ve günlerce kırmızı kalmıştı: ölçüm
// davranışa değil, yazılışa bakıyordu.
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

const WORKER = jsYorumsuz(oku('supabase/functions/story-yayin/index.ts'));
const HAMWORKER = oku('supabase/functions/story-yayin/index.ts');
const APP    = jsYorumsuz(oku('app.html'));
const HAMAPP = oku('app.html');
const MCP    = jsYorumsuz(oku('supabase/functions/mcp/index.ts'));
const TEK    = jsYorumsuz(oku('supabase/functions/mcp/tek-dosya.ts'));
const DOGRULA = jsYorumsuz(oku('ai/dogrula.js'));
const SEMA   = JSON.parse(oku('ai/sema.json'));
const YUKLE  = pyYorumsuz(oku('pc/story-yukle.py'));

// ── 1. KUYRUK ────────────────────────────────────────────────────
console.log('[sql — tür kümesi]');
// ⚠ ÖLÇÜM DİZİNİN İÇİNE BAKIYOR, DOSYANIN TAMAMINA DEĞİL. İlk sürüm
// dosyada 'poll' kelimesini arıyordu; sql/64'ün KONTROL sorgusunda
// `where type = 'poll'` yazılı olduğu için diziden 'poll'u SİLEN
// mutasyon HAYATTA KALDI -- dosya hâlâ kelimeyi taşıyordu, oysa
// işlevin döndürdüğü küme eksikti ve anket kuyruğa hiç girmezdi.
for(const d of ['sql/54-yayin-turleri-tek-yer.sql', 'sql/64-threads-anketi.sql']){
  const t = sqlYorumsuz(oku(d));
  const dizi = (/select array\[([^\]]*)\]::text\[\]/.exec(t) || [, ''])[1];
  bak('★ ' + d + " dizisinde 'poll' var", /'poll'/.test(dizi), dizi.trim() || '(dizi bulunamadı)');
}
// ⛔ sql/62 BİLEREK DOKUNULMADI: o dosya 'poll' olmadan yazıldı ve
// yeniden koşturulursa sql/64'ün işini geri alır. Bunu BİLMEK, sessizce
// kaybetmekten iyi -- sql/64'ün başında yazılı. Ölçüm, o uyarının
// dosyada durduğunu kontrol ediyor.
{
  const s62 = sqlYorumsuz(oku('sql/62-threads-metin-postu.sql'));
  bak('★ sql/62 hâlâ poll içermiyor (geri alma tuzağı bilinçli)',
      !/'poll'/.test(s62));
  const s64 = oku('sql/64-threads-anketi.sql');
  bak('★ sql/64 hangi dosyanın işini geri aldığını yazıyor',
      /sql\/62 yeniden koşturulursa|sql\/62'ye/.test(s64) && /GERİ AL/.test(s64));
}

// ── 2. POLİTİKA ──────────────────────────────────────────────────
console.log('[politika — pc/story-yukle.py]');
bak('★ threads/poll politikada açık',
    /\('threads',\s*'poll'\):\s*True/.test(YUKLE),
    (/\('threads',[^\n]*/.exec(YUKLE) || ['yok'])[0]);
// ⚠ TikTok ve YouTube'un kapalı olması bu işten etkilenmemeli.
bak('★ tiktok/reels hâlâ kapalı', /\('tiktok',\s*'reels'\):\s*False/.test(YUKLE));
bak('★ youtube/shorts hâlâ kapalı', /\('youtube',\s*'shorts'\):\s*False/.test(YUKLE));

// ── 3. WORKER: TÜR VE PLATFORM ───────────────────────────────────
console.log('[worker — tür]');
bak('★ TURLER poll tanıyor', /\bpoll:\s*\{[^}]*platformlar:\s*\[([^\]]*)\]/.test(WORKER),
    (/\bpoll:\s*\{[\s\S]{0,160}?\}/.exec(WORKER) || ['yok'])[0].replace(/\s+/g,' ').slice(0,90));
// ⛔ YALNIZCA THREADS. Kullanıcının isteği buydu ("sadece threads için
// yapıyorsun değil mi") ve teknik gerekçesi de var: bu worker'da
// Facebook anket ucu HİÇ YOK. Platformu buraya yazmak, olmayan bir yolu
// varmış gibi göstermek olurdu.
{
  const m = /\bpoll:\s*\{[\s\S]{0,200}?platformlar:\s*\[([^\]]*)\]/.exec(WORKER);
  const liste = m ? m[1].replace(/['\s]/g,'').split(',').filter(Boolean) : [];
  bak('★ poll YALNIZCA threads platformunda', liste.length === 1 && liste[0] === 'threads',
      liste.join(','));
}
bak('★ poll kalıcı gönderi sayılıyor (story gibi 24 saatlik değil)',
    /\bpoll:\s*\{[\s\S]{0,200}?kalici:\s*true/.test(WORKER));

// ── 4. WORKER: ANKET GERÇEKTEN GİDİYOR ───────────────────────────
console.log('[worker — yayın yolu]');
{
  const gy = jsGovde(WORKER, 'threadsYayinla') || '';
  bak('threadsYayinla tanımlı', !!gy);
  // Meta'nın alan adı: poll_attachment. Yanlış adla giden anket sessizce
  // DÜŞER -- gönderi çıkar, anket çıkmaz.
  bak('★ poll_attachment alanı gönderiliyor', /alan\.poll_attachment\s*=/.test(gy),
      (/poll_attachment[^\n]*/.exec(gy) || ['yok'])[0]);
  bak('★ seçenekler option_a..option_d anahtarlarına yazılıyor',
      /option_a[\s\S]{0,60}option_d/.test(gy));
  // ⛔ GÖRSELLİ ANKET OLMUYOR (Meta kuralı). Görseli sessizce atmak da
  // olmaz: kullanıcı onu oraya bilerek koymuş.
  bak('★ görselli ankette kalıcı hata',
      /if \(gorsel\)[\s\S]{0,300}kaliciHata/.test(gy),
      (/if \(gorsel\)[^\n]*/.exec(gy) || ['yok'])[0]);
  // 2-4 seçenek sınırı.
  bak('★ seçenek sayısı denetleniyor',
      /secenekler\.length < ANKET_EN_AZ \|\| secenekler\.length > ANKET_EN_COK/.test(gy),
      (/secenekler\.length[^\n]*/.exec(gy) || ['yok'])[0]);
  // ⛔ UZUN SEÇENEK KIRPILMIYOR: 25 karakteri aşanı kırpmak anketin
  // sorusunu değiştirir ve kullanıcı neyi oyladığını bilmez.
  bak('★ uzun seçenek kırpılmıyor, kalıcı hata veriyor',
      /x\.length > ANKET_SECENEK_TAVAN[\s\S]{0,200}kaliciHata/.test(gy),
      (/ANKET_SECENEK_TAVAN[^\n]*/.exec(gy) || ['yok'])[0]);
  bak('★ sınırlar sabit olarak yazılı (2, 4, 25)',
      /ANKET_EN_AZ = 2/.test(WORKER) && /ANKET_EN_COK = 4/.test(WORKER)
      && /ANKET_SECENEK_TAVAN = 25/.test(WORKER),
      (/ANKET_SECENEK_TAVAN = [^\n]*/.exec(WORKER) || ['yok'])[0]);
  // Tür anket değilken seçenek yazılıysa anket GİTMİYOR ama sessiz de
  // kalmıyor (Bölüm 9).
  bak('★ tür anket değilken anket gönderilmiyor ve loga yazılıyor',
      /else if \(secenekler\.length\)[\s\S]{0,200}console\.warn/.test(gy));
  // Seçenekler kayıttan okunuyor; boşlar atılıyor.
  const go = jsGovde(WORKER, 'anketSecenekleri') || '';
  bak('★ seçenekler content.anketSecenekler alanından okunuyor',
      /c\.anketSecenekler/.test(go), (/anketSecenekler[^\n]*/.exec(go) || ['yok'])[0]);
  bak('★ boş seçenekler atılıyor', /filter\(Boolean\)/.test(go));
  // Sınırların kaynağı YAZILI: uydurulmuş sayı olmadığı belli olsun.
  bak('★ Meta belgesine atıf var (sayılar uydurulmadı)',
      /developers\.facebook\.com\/documentation\/threads\/create-posts\/polls/.test(HAMWORKER));
  // Sürüm artmalı: "dağıtılan sürüm yerine geçti mi" sorusu.
  bak('★ worker sürümü anketi taşıyan sürümden geri değil', surumEnAz(WORKER, [1,18,0]),
      (/const SURUM = '[^']*'/.exec(WORKER) || ['yok'])[0]);
}

// ── 5. ARAYÜZ ────────────────────────────────────────────────────
console.log('[app.html]');
{
  bak('★ YAYIN_TURLERI poll biliyor',
      /YAYIN_TURLERI\s*=\s*\[[^\]]*'poll'/.test(APP));
  bak('★ dört seçenek kutusu var',
      /id="f_anket1"/.test(HAMAPP) && /id="f_anket4"/.test(HAMAPP));
  // Threads sınırı kutunun kendisinde: 25 karakter.
  bak('★ kutular 25 karakterle sınırlı',
      (HAMAPP.match(/id="f_anket\d" maxlength="25"/g) || []).length === 4,
      'bulunan=' + (HAMAPP.match(/id="f_anket\d" maxlength="25"/g) || []).length);
  bak('★ bölüm yalnızca anket türünde görünüyor',
      /anketWrap'\)\.style\.display = \(type==='poll'\)/.test(APP));
  // ⛔ ASIL TUZAK: content form alanlarından BAŞTAN kuruluyor. Bu satır
  // olmasa, planlama sohbetinin yazdığı seçenekler kaydı uygulamada bir
  // kez açıp kaydetmekle SESSİZCE silinirdi -- `diller`, `hesapId` ve
  // örnek işaretiyle birebir aynı tuzak, üçü de yaşandı.
  bak('★ kaydetmede content\'e yazılıyor (sessiz silinme yok)',
      /anketSecenekler: anketKutulariOku\(\)/.test(APP));
  bak('★ kayıt açılınca kutulara yazılıyor', /anketKutulariYaz\(/.test(APP));
  // Buluttan okuma beyaz listesi.
  bak('★ bulut okumasında beyaz listede',
      /anketSecenekler: Array\.isArray\(c\.anketSecenekler\)/.test(APP));
  // Anket kendi notunu istiyor: oy_not_metin "görseli varsa onunla
  // birlikte" diyor, oysa ankette görsel OLAMIYOR.
  bak('★ anketin kendi yayın notu var',
      /tur === 'poll'\s*\?\s*t\('oy_not_anket'\)/.test(APP));
  bak('★ not iki dilde de tanımlı',
      (HAMAPP.match(/oy_not_anket:\s*\(p\)=>/g) || []).length >= 2,
      'bulunan=' + (HAMAPP.match(/oy_not_anket:\s*\(p\)=>/g) || []).length);
  bak('★ notta platform adı sabit değil', !/oy_not_anket:\s*"/.test(HAMAPP));
  // Eksik anket yayına gidemez: iki ayrı yerde denetim.
  const ge = jsGovde(APP, 'anketEngeli') || '';
  bak('★ en az iki seçenek denetimi', /anketKutulariOku\(\)\.length < 2/.test(ge),
      (/length < 2[^\n]*/.exec(ge) || ['yok'])[0]);
  bak('★ dosyası olan ankette engel', /yayin\.dosya/.test(ge));
  bak('★ denetim Kaydet ve otomatik yayın anahtarında birden çağrılıyor',
      (APP.match(/anketEngeli\(/g) || []).length >= 3,
      'çağrı=' + (APP.match(/anketEngeli\(/g) || []).length);
}

// ── 6. MCP VE AI ŞEMASI ──────────────────────────────────────────
console.log('[MCP + ai/sema.json]');
{
  bak('★ MCP YAYIN_TURLERI poll biliyor',
      /YAYIN_TURLERI = \[[^\]]*'poll'\]/.test(MCP));
  // ⛔ ÇIKTIDA OLMAZSA ASİSTAN GÖRMEZ: "yok" sanıp üstüne yazar.
  const gi = jsGovde(MCP, 'kayitIcerigi') || '';
  bak('★ MCP çıktısı anketSecenekler taşıyor', /o\.anketSecenekler = c\.anketSecenekler/.test(gi),
      (/anketSecenekler[^\n]*/.exec(gi) || ['yok'])[0]);
  bak('★ boş dizi çıktıya yazılmıyor',
      /Array\.isArray\(c\.anketSecenekler\) && c\.anketSecenekler\.length/.test(gi));
  // ⛔ SÜZGEÇTE OLMAZSA İÇE AKTARMADA DÜŞER.
  bak('★ ai/dogrula.js süzgecinde', /anketSecenekler: Array\.isArray\(c\.anketSecenekler\)/.test(DOGRULA));
  bak('★ süzgeçte tavanlar (4 seçenek, 25 karakter)',
      /slice\(0, 4\)[\s\S]{0,80}slice\(0, 25\)/.test(DOGRULA),
      (/anketSecenekler[\s\S]{0,160}/.exec(DOGRULA) || ['yok'])[0].replace(/\s+/g,' ').slice(0,100));
  // Şema: hem asistanın gördüğü belge hem MCP'nin girdi şeması buradan.
  const c = SEMA.$defs.Entry.properties.content.properties;
  bak('★ ai/sema.json anketSecenekler tanımlı', !!c.anketSecenekler);
  if(c.anketSecenekler){
    bak('★ şemada en çok 4 seçenek', c.anketSecenekler.maxItems === 4, c.anketSecenekler.maxItems);
    bak('★ şemada seçenek 25 karakter', (c.anketSecenekler.items||{}).maxLength === 25,
        (c.anketSecenekler.items||{}).maxLength);
    // Asistan "2-4" ve "görsel olmaz" kurallarını BİLMELİ: şemadaki
    // açıklama onun tek kaynağı.
    bak('★ şema açıklaması 2-4 sınırını söylüyor',
        /2 to 4/.test(c.anketSecenekler.description || ''));
    bak('★ şema açıklaması görselsiz olduğunu söylüyor',
        /image/i.test(c.anketSecenekler.description || ''));
  }
  bak('★ poll türü şemada zaten vardı',
      (SEMA.$defs.Entry.properties.type.enum || []).includes('poll'));
  // Tek dosya paketi yeniden üretilmiş olmalı: panele yapıştırılan
  // sürüm eskiyse bütün bu iş canlıda YOK.
  bak('★ tek-dosya.ts yeniden üretildi (anketSecenekler içinde)',
      /anketSecenekler/.test(TEK));
  bak('★ MCP sürümü anketi taşıyan sürümden geri değil', surumEnAz(MCP, [1,11,0]),
      (/const SURUM = '[^']*'/.exec(MCP) || ['yok'])[0]);
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
