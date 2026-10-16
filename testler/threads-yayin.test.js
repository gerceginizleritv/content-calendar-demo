// THREADS YAYINI — BES YER, TEK KARAR
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR
// ══════════════════════════════════════════════════════════════════
// 16 Ekim 2026: Threads yayini eklendi. Karar BES yerde birden
// yazili ve besi de gerekli; biri eksik kalirsa HICBIR YERDE HATA
// CIKMIYOR, davranis sessizce yarim oluyor:
//
//   1. sql/54 + sql/62 -> story_yayin_turleri()  (kayit kuyruga duser)
//   2. pc/story-yukle  -> OTOMATIK_YAYIN         (kaydin tiki acilir)
//   3. worker TURLER   -> text_post/threads      (tur taninir)
//   4. worker YAYINLANABILIR + yayin yolu        (gercekten gider)
//   5. app.html        -> YAYIN_TURLERI + not    (ekran dogru soyler)
//
// 12 Ekim 2026 dersi: Facebook reels'te kaydin tiki acildi ama
// kuyruktaki dislama gorulmedi ve yayin gitmeyecekti. Iki kapi var
// ve ikisi birbirinden habersiz.
//
// ⚠ AYRI UYGULAMA, AYRI JETON. Threads'in kendi Meta uygulamasi var
// ("Shootboard Threads"). Facebook/Instagram yayinimiz META_PAGE_TOKEN
// ile graph.facebook.com'a gidiyor; Threads THREADS_TOKEN ile
// graph.threads.net'e. Ikisinin karismasi, calisan Facebook yayinini
// bozmak demek -- asagida ayri ayri olculuyor.
//
// Yorumlar ATILIYOR. 28 Eylul 2026'da bir olcum kodun kendi YORUMUYLA
// eslesip gecti: kod silinse test yine geciyordu.
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (p)=> fs.readFileSync(yol.join(KOK, p), 'utf8');

const sqlYorumsuz = (s)=> s.replace(/--[^\n]*/g, '');
// ⚠ `://` YORUM DEGIL. Duz bir /\/\/[^\n]*/ silgisi
// "https://graph.threads.net" adresini de yiyordu ve "taban adres
// dogru mu" olcumu kodda duran bir adresi GORMUYORDU. Oncesindeki
// karakter iki nokta ise dokunulmuyor.
const jsYorumsuz  = (s)=> s.replace(/\/\*[\s\S]*?\*\//g, '')
                          .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const pyYorumsuz  = (s)=> s.replace(/^[ \t]*#[^\n]*\n/gm, '');

// ⚠ DONUS TIPI GOVDE DEGIL. `Promise<{ biliniyor: boolean }>`
// icindeki susluyu govde baslangici sanan ilk surum, yanlis blogu
// okuyup "biliniyor: false yok" diyordu -- oysa kod dogruydu.
// Parametre listesi ve donus tipi atlanip ASIL govde bulunuyor.
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

const WORKER = jsYorumsuz(oku('supabase/functions/story-yayin/index.ts'));
const HAMWORKER = oku('supabase/functions/story-yayin/index.ts');

// ── 1. KUYRUK ────────────────────────────────────────────────────
console.log('[sql — tür kümesi]');
for(const d of ['sql/54-yayin-turleri-tek-yer.sql', 'sql/62-threads-metin-postu.sql']){
  const t = sqlYorumsuz(oku(d));
  bak('★ ' + d + " text_post'u tanıyor", /'text_post'/.test(t),
      (/array\[[^\]]*\]/.exec(t) || [''])[0]);
}
// ⚠ sql/54'te DE olmali: yeniden kosturulursa sql/62'nin isini geri
// almasin. Tuzak tam olarak boyle calisiyor (bkz. sql/56 - sql/58).
{
  const t = sqlYorumsuz(oku('sql/54-yayin-turleri-tek-yer.sql'));
  const dizi = (/array\[([^\]]*)\]/.exec(t) || ['', ''])[1];
  bak('★ sql/54 yeniden koşturulsa text_post KAYBOLMUYOR',
      /text_post/.test(dizi), dizi.trim());
}

// ── 2. POLITIKA ──────────────────────────────────────────────────
console.log('[pc/story-yukle.py — politika]');
{
  const kaynak = pyYorumsuz(oku('pc/story-yukle.py'));
  const i = kaynak.indexOf('OTOMATIK_YAYIN = {');
  const tablo = i < 0 ? '' : kaynak.slice(i, kaynak.indexOf('}', i) + 1);
  bak("★ threads/text_post AÇIK",
      /\(\s*'threads'\s*,\s*'text_post'\s*\)\s*:\s*True/.test(tablo),
      (/\(\s*'threads'[^)]*\)\s*:\s*\w+/.exec(tablo) || ['yok'])[0]);
  // ⛔ Acilan sey YALNIZCA threads. TikTok'un onayi yok, YouTube'un
  // denetim kapisi kapali -- ikisi de kapali KALMALI.
  bak('★ tiktok/reels KAPALI kaldı',
      /\(\s*'tiktok'\s*,\s*'reels'\s*\)\s*:\s*False/.test(tablo));
  bak('★ youtube/shorts KAPALI kaldı',
      /\(\s*'youtube'\s*,\s*'shorts'\s*\)\s*:\s*False/.test(tablo));
}

// ── 3. WORKER: TUR ───────────────────────────────────────────────
console.log('[worker — tür ve platform]');
{
  const m = /const TURLER[^=]*=\s*\{([\s\S]*?)\n\};/.exec(WORKER);
  bak('TURLER tablosu bulunabiliyor', !!m);
  const tablo = m ? m[1] : '';
  bak('★ text_post türü tanımlı', /text_post\s*:\s*\{/.test(tablo));
  // ⛔ text_post YALNIZCA threads. Instagram'a dusen bir metin postu
  // reelMi false dondugu icin STORY olarak cikardi -- 24 saatte
  // kaybolan, hicbir yerde hata vermeyen bir yayin.
  const pf = /text_post\s*:\s*\{[\s\S]*?platformlar:\s*\[([^\]]*)\]/.exec(tablo);
  const liste = pf ? pf[1].split(',').map(x=> x.trim().replace(/^'|'$/g,'')).filter(Boolean) : [];
  bak('★ text_post YALNIZCA threads',
      liste.length === 1 && liste[0] === 'threads', JSON.stringify(liste));
  bak('★ threads YAYINLANABILIR listesinde',
      /const YAYINLANABILIR\s*=\s*\[[^\]]*'threads'/.test(WORKER),
      (/const YAYINLANABILIR\s*=\s*\[[^\]]*\]/.exec(WORKER) || [''])[0]);
}

// ── 4. WORKER: YAYIN YOLU ────────────────────────────────────────
console.log('[worker — yayın yolu]');
{
  bak('★ kaydiYayinla threads dalını çağırıyor',
      /pf === 'threads'\)\s*return await threadsYayinla\(k\)/.test(WORKER));

  const govde = jsGovde(WORKER, 'threadsYayinla');
  bak('threadsYayinla tanımlı', !!govde);
  if(govde){
    // Iki adim: kapsayici sonra yayin. Tek adim olsaydi gorsel
    // islenmeden yayin cagrilir ve hata donerdi.
    bak('★ kapsayıcı ucu çağrılıyor', /\/me\/threads'/.test(govde));
    bak('★ yayın ucu çağrılıyor', /\/me\/threads_publish'/.test(govde));
    // ⚠ IZ YAYINDAN ONCE. Kapsayici yaratmak yayinlamiyor; oradaki
    // bir cokus cift gonderi uretemez. Sira bozulursa uretebilir.
    const izSira = govde.indexOf("story_iz_yayin_cagrisi");
    const yayinSira = govde.indexOf("threads_publish");
    bak('★ yayın izi, yayın çağrısından ÖNCE',
        izSira > 0 && yayinSira > izSira, 'iz=' + izSira + ' yayin=' + yayinSira);
    // Metin de gorsel de yoksa gonderilecek bir sey yok: KALICI hata,
    // cunku kendiliginden duzelmiyor.
    bak('★ boş gönderi kalıcı hata veriyor', /kaliciHata\(/.test(govde));
    // Threads metin siniri 500. Instagram'da 2200'de kirpiliyor.
    bak('★ metin 500 karakterde kırpılıyor', /altYazi\(k,\s*500\)/.test(govde),
        (/altYazi\([^)]*\)/.exec(govde) || ['yok'])[0]);
  }

  // ⚠ CIFT GONDERI KORUMASI. Cokus sonrasi "cikti mi" sorulabilmeli;
  // sorulamazsa tekrar yayinlariz ve Threads gonderisi profilde
  // KALICI durur.
  bak('★ çöküş sonrası threads sorulabiliyor',
      /pf === 'threads'\)\s*return await threadsCikmisMi\(/.test(WORKER));
  const ck = jsGovde(WORKER, 'threadsCikmisMi');
  bak('threadsCikmisMi tanımlı', !!ck);
  if(ck){
    // SORULAMADI ≠ CIKMADI. Yanlis "cikmadi" cevabi cift gonderi demek.
    bak('★ sorulamayınca "bilinmiyor" dönüyor',
        /biliniyor:\s*false/.test(ck));
    bak('★ boş liste "çıkmadı" sayılmıyor',
        (ck.match(/biliniyor:\s*false/g) || []).length >= 2,
        'biliniyor:false sayisi=' + (ck.match(/biliniyor:\s*false/g) || []).length);
  }
}

// ── 5. AYRI UYGULAMA / AYRI JETON ────────────────────────────────
console.log('[Facebook ile karışmıyor]');
{
  bak('★ THREADS_TOKEN ayrı okunuyor',
      /const THREADS_TOKEN\s*=\s*ayar\('THREADS_TOKEN'\)/.test(WORKER));
  bak('★ taban adres graph.threads.net',
      /graph\.threads\.net/.test(WORKER));
  const govde = jsGovde(WORKER, 'threadsYayinla') || '';
  const cagir = jsGovde(WORKER, 'threadsCagir') || '';
  const ck = jsGovde(WORKER, 'threadsCikmisMi') || '';
  const hepsi = govde + cagir + ck;
  // ⛔ Threads yolu Facebook'un jetonunu ve tabanini ASLA kullanmaz.
  bak('★ Threads yolu PAGE_TOKEN kullanmıyor', !/PAGE_TOKEN/.test(hepsi));
  bak('★ Threads yolu graph.facebook.com\'a gitmiyor',
      !/GRAF_TABANI|graph\.facebook/.test(hepsi));
  bak('★ Threads yolu graf() yardımcısını çağırmıyor',
      !/\bawait graf\(/.test(hepsi));
  // Jeton tanimli degilse ERTELENIYOR, hata degil: ayar gelince
  // kendiliginden akmali.
  bak('★ jeton yoksa erteleniyor (kalıcı hata değil)',
      /THREADS_TOKEN tanımlı değil/.test(HAMWORKER)
      && /pf === 'threads' && !THREADS_TOKEN/.test(WORKER));
}

// ── 6. ARAYUZ ────────────────────────────────────────────────────
console.log('[app.html]');
{
  const ham = oku('app.html');
  bak('★ YAYIN_TURLERI text_post biliyor',
      /YAYIN_TURLERI\s*=\s*\[[^\]]*'text_post'/.test(jsYorumsuz(ham)));
  // ⚠ METIN POSTU KENDI METNINI ISTIYOR. Bu dal olmasa oy_not'a
  // duserdi ve ekranda "bu STORY'yi atiyor" yazardi.
  bak('★ metin postunun kendi notu var',
      /tur === 'text_post'\s*\?\s*t\('oy_not_metin'\)/.test(jsYorumsuz(ham)));
  bak('★ not iki dilde de tanımlı',
      (ham.match(/oy_not_metin:\s*\(p\)=>/g) || []).length >= 2,
      'bulunan=' + (ham.match(/oy_not_metin:\s*\(p\)=>/g) || []).length);
  // Platform adi sabit yazilmamali -- 13 Ekim dersi.
  bak('★ notta platform adı sabit değil',
      !/oy_not_metin:\s*"/.test(ham));
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
