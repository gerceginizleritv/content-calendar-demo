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
  // ⚠ JETON YOKSA ERTELENIYOR, KALICI HATA DEGIL: ayar gelince
  // kendiliginden akmali. Kontrol threadsYayinla'nin basinda --
  // kaydiYayinla'da ortama bakmak, tabloda gecerli jeton dururken
  // yayini durdurmak olurdu (sql/63).
  {
    const gy = jsGovde(WORKER, 'threadsYayinla') || '';
    bak('★ jeton yoksa erteleniyor (kalıcı hata değil)',
        /story_ertele/.test(gy) && /threadsJetonu\(k\)/.test(gy));
    bak('★ kaydiYayinla ortamdaki jetona BAKMIYOR',
        !/pf === 'threads' && !THREADS_TOKEN/.test(WORKER));
  }
}

// ── 5b. JETON: TABLODA DURUR, KENDI KENDINE YENILENIR (sql/63) ───
// ⛔ YENILEME PENCERESI KACIRILIRSA GERI DONUS YOK. Jeton 60 gun
// yenilenmeden gecerse KALICI oluyor; tek care panelden elle yeni
// jeton almak. O yuzden "son gune birakma" olcuyoruz.
console.log('[jeton yenileme]');
{
  const SQL63 = sqlYorumsuz(oku('sql/63-threads-jeton.sql'));
  bak('★ threads_hesaplari tablosu var', /create table[\s\S]*threads_hesaplari/.test(SQL63));
  // ⛔ TABLODA DUZ METIN JETON VAR. RLS acik ve ILKE YOK: anon ve
  // authenticated hicbir satir goremiyor. Bir ilke eklemek
  // "tarayiciya jeton verelim" demek olurdu.
  bak('★ RLS açık', /alter table public\.threads_hesaplari enable row level security/.test(SQL63));
  bak('★ anon/authenticated yetkisi alınmış',
      /revoke all on public\.threads_hesaplari from anon, authenticated/.test(SQL63));
  bak('★ ilke TANIMLI DEĞİL (jeton tarayıcıya açılmıyor)',
      !/create policy/i.test(SQL63));
  // Ayri bir yenileme jetonu YOK: Threads erisim jetonunun kendisiyle
  // yeniliyor. Sutun eklenirse bos durur ve "doldurmayi unuttuk"
  // sanilir.
  bak('★ ayrı yenileme jetonu sütunu YOK', !/yenileme_jetonu/.test(SQL63));

  const gj = jsGovde(WORKER, 'threadsJetonu');
  bak('threadsJetonu tanımlı', !!gj);
  if(gj){
    bak('★ jeton TABLODAN okunuyor', /threads_hesaplari\?user_id=eq/.test(gj));
    // Tabloda satir yoksa ortamdaki tohumlaniyor: bugunku kurulum
    // bozulmadan tabloya geciliyor.
    bak('★ tabloda satır yoksa ortamdan tohumlanıyor',
        /THREADS_TOKEN/.test(gj) && /method: 'POST'/.test(gj));
    // ⚠ SON GUNE BIRAKILMIYOR.
    bak('★ süreye kala yenileniyor (son güne bırakmıyor)',
        /THREADS_YENILEME_GUN/.test(gj));
    // Worker dakikada bir kosuyor; basarisiz yenilemeyi her turda
    // tekrar denemek Meta'yi dovmek olurdu.
    // ⚠ OLCUM SATIRIN KENDISINE BAKIYOR, kelimelerin varligina degil.
    // Ilk surum /son_yenileme/ && /86400_000/ ariyordu; o iki kelime
    // komsu satirlarda da geciyor ve guard silindiginde test GECIYORDU
    // (mutasyon hayatta kaldi). Simdi erken donusun kendisi araniyor.
    bak('★ günde bir deneniyor (başarısız yenileme Meta\'yı dövmüyor)',
        /sonDeneme\s*&&\s*Date\.now\(\)\s*-\s*sonDeneme\s*<\s*86400_000[\s\S]{0,40}return/.test(gj),
        (/sonDeneme[^\n]*/.exec(gj) || ['yok'])[0]);
  }

  const gt = jsGovde(WORKER, 'threadsJetonTazele');
  bak('threadsJetonTazele tanımlı', !!gt);
  if(gt){
    bak('★ doğru uç çağrılıyor (th_refresh_token)',
        /refresh_access_token/.test(gt) && /th_refresh_token/.test(gt));
    // ⚠ YENILEME BASARISIZ ≠ YAYIN DURUR. Suresi dolmadiysa eldeki
    // jetonla devam; yarin yine denenecek.
    bak('★ yenileme başarısızsa eldeki jetonla devam ediliyor',
        /bitis > Date\.now\(\)/.test(gt));
    // Sessiz basarisizlik yasak (Bolum 9).
    // ⚠ /son_hata/ ARAMAK YETMIYOR: basari dalinda da geciyor
    // (son_hata: null). Ilk surum oyleydi ve "sebebi silme"
    // mutasyonu HAYATTA KALDI. Simdi SEBEBIN KENDISI araniyor.
    bak('★ başarısızlık sebebi satıra yazılıyor',
        /son_hata:\s*`[^`]*\$\{sebep\}/.test(gt),
        (/son_hata:[^\n]*/.exec(gt) || ['yok'])[0]);
    bak('★ başarıda hata satırı temizleniyor', /son_hata:\s*null/.test(gt));
    bak('★ başarılı yenileme tabloya yazılıyor',
        /erisim_jetonu:/.test(gt) && /erisim_bitis:/.test(gt));
  }

  // Yenilenen jeton GERCEKTEN kullanilmali: cagrilar jetonu disaridan
  // almali, yoksa sabit THREADS_TOKEN'a geri duserdi ve yenileme
  // hicbir ise yaramazdi.
  // Durum ucu her platformun ayarini bildiriyor; Threads'inki
  // unutulmustu ve kullanici ayarini dogrulayamiyordu.
  bak('★ durum ucu threads_token bildiriyor',
      /threads_token:\s*!!THREADS_TOKEN/.test(WORKER));

  const gy = jsGovde(WORKER, 'threadsYayinla') || '';
  bak('★ yayın yolu jetonu threadsJetonu\'dan alıyor', /threadsJetonu\(k\)/.test(gy));
  bak('★ çağrılara jeton iletiliyor', /hesap\.jeton/.test(gy));
  const gc = jsGovde(WORKER, 'threadsCikmisMi') || '';
  bak('★ "çıktı mı" sorusu da tablodaki jetonu kullanıyor',
      /threadsJetonu\(k\)/.test(gc));
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

// ── 7. 16 EKIM 2026 — ILK GERCEK YAYIN PATLADI, UC EKSIK CIKTI ───
//
// OLAN. Kayit saatinde worker kaydi aldi, Threads'te kapsayiciyi
// yaratti (gorsel islendi, durum FINISHED), yayin cagrisini yapti ve
// cagri SESSIZCE sonucsuz kaldi: ne gonderi, ne hata e-postasi, ne
// log satiri. Teshis ancak Threads'e ELLE kapsayici durumu sorularak
// yapilabildi.
//
// UC AYRI EKSIK vardi ve ucu de burada olculuyor:
//   1. Yakalanan hata yalnizca last_error'a yaziliyordu; bir sonraki
//      tur ustune yazdi ve ASIL MESAJ YOK OLDU.
//   2. "Sonucu bilinmiyor" hali kendiliginden HIC cozulmuyordu: kayit
//      bes dakikada bir sonsuza kadar erteleniyordu.
//   3. Threads cagrilarinda zaman asimi yoktu; askida kalan istek
//      isolate'i oldurtuyor ve catch hic calismiyor.
console.log('[16 Ekim dersi — hata gorunur, kilit cozulur, cagri askida kalmaz]');
{
  // ---- 1. HATA LOGA DA YAZILIYOR --------------------------------
  const gi = jsGovde(WORKER, 'kaydiIsle') || '';
  bak('kaydiIsle tanımlı', !!gi);
  // ⚠ OLCUM console.error'UN KENDISINE BAKIYOR. 'mesaj' kelimesini
  // aramak yetmez: govdede zaten her dalda geciyor.
  bak('★ yakalanan hata loga yazılıyor',
      /console\.error\([\s\S]{0,200}?temizle\(mesaj\)/.test(gi),
      (/console\.(error|warn|log)\([^\n]*/.exec(gi) || ['yok'])[0]);
  // ⚠ KOTA DALINDAN ONCE. Log erken donuslerin ALTINA konursa kota
  // ertelemeleri loga hic dusmez -- 10 Ekim'de kota yuzunden kacan
  // bir yayinin izi yine kalmazdi.
  bak('★ log, erken dönüşlerden ÖNCE',
      gi.indexOf('console.error') > 0 &&
      gi.indexOf('console.error') < gi.indexOf("kova === 'kota'"),
      'log=' + gi.indexOf('console.error') + ' kota=' + gi.indexOf("kova === 'kota'"));

  // ---- 2. KILIT COZULUYOR: IKI TANIK ----------------------------
  const gc2 = jsGovde(WORKER, 'threadsCikmisMi') || '';
  bak('★ kapsayıcının durumu da soruluyor',
      /k\.publish_ref/.test(gc2) && /threadsDurum\(/.test(gc2));
  // 'PUBLISHED' = cikti. Liste gec kalmis olabilir; kapsayici kimligi
  // iz olarak yeterli.
  bak('★ PUBLISHED → çıktı sayılıyor',
      /durum === 'PUBLISHED'\s*\)?\s*return \{ biliniyor: true/.test(gc2),
      (/durum === 'PUBLISHED'[^\n]*/.exec(gc2) || ['yok'])[0]);
  // FINISHED/ERROR/EXPIRED = kesin cikmadi -> cagiran yeniden
  // yayinlayabilir. Bu satir olmadan kilit geri gelir.
  bak('★ FINISHED/ERROR/EXPIRED → kesin çıkmadı',
      /durum === 'FINISHED' \|\| durum === 'ERROR' \|\| durum === 'EXPIRED'[\s\S]{0,80}biliniyor: true, id: ''/.test(gc2),
      (/durum === 'FINISHED'[^\n]*/.exec(gc2) || ['yok'])[0]);
  // ⛔ SIRA. Once liste, SONRA kapsayici -- ve kapsayiciya yalnizca
  // liste OKUNDUYSA gidiliyor. Tersi, Meta durumu gec guncellerse
  // CIKMIS bir gonderiyi "cikmadi" sayip IKINCI kez yayinlamak demek
  // ve o gonderi profilde KALICI durur.
  bak('★ liste okunmadıysa kapsayıcıya hiç gidilmiyor',
      /!okundu\) return \{ biliniyor: false/.test(gc2) &&
      gc2.indexOf('!okundu') < gc2.indexOf('threadsDurum('),
      'okundu=' + gc2.indexOf('!okundu') + ' durum=' + gc2.indexOf('threadsDurum('));
  bak('★ liste sorusu kapsayıcı sorusundan ÖNCE',
      gc2.indexOf('/me/threads') > 0 &&
      gc2.indexOf('/me/threads') < gc2.indexOf('threadsDurum('));
  // "biliniyor: true" tam UC yerde: listede eslesme, PUBLISHED,
  // FINISHED grubu. Dorduncusu eklenirse yeni bir kesin cevap
  // uretilmis demektir ve bu test onu goruyor.
  bak('★ kesin "biliniyor" yalnızca üç yerde',
      (gc2.match(/biliniyor: true/g) || []).length === 3,
      'bulunan=' + (gc2.match(/biliniyor: true/g) || []).length);
  // IN_PROGRESS kesin cevap DEGIL: hala isleniyor demek.
  bak('★ IN_PROGRESS kesin cevap sayılmıyor', !/IN_PROGRESS/.test(gc2));

  // ---- 3. ZAMAN ASIMI -------------------------------------------
  bak('★ zaman aşımı süresi tanımlı',
      /const THREADS_ZAMAN_ASIMI_MS = [\d_]+;/.test(WORKER),
      (/THREADS_ZAMAN_ASIMI_MS = [^\n]*/.exec(WORKER) || ['yok'])[0]);
  const gf = jsGovde(WORKER, 'threadsFetch') || '';
  bak('★ threadsFetch isteği kesiyor',
      /AbortSignal\.timeout\(THREADS_ZAMAN_ASIMI_MS\)/.test(gf),
      (/signal[^\n]*/.exec(gf) || ['yok'])[0]);
  // ⛔ CIPLAK fetch KALMAMALI. Biri atlanirsa o cagri yine askida
  // kalabilir ve 16 Ekim'deki sessizlik aynen tekrarlanir.
  for(const ad of ['threadsCagir', 'threadsDurum', 'threadsJetonTazele', 'threadsCikmisMi']){
    const gv = jsGovde(WORKER, ad) || '';
    bak('★ ' + ad + ' zamanlı fetch kullanıyor',
        !!gv && /threadsFetch\(/.test(gv) && !/[^s]fetch\(/.test(gv.replace(/threadsFetch\(/g, 'X(')),
        (/\w*fetch\([^\n]*/.exec(gv) || ['yok'])[0]);
  }
  // Cevap gelmemesi GECICI hata: kalici isaretlenirse kayit yanar.
  const gca = jsGovde(WORKER, 'threadsCagir') || '';
  bak('★ cevap gelmemesi geçici hata (kayıt yanmıyor)',
      /catch[\s\S]{0,200}new GrafHata\(0,/.test(gca),
      (/new GrafHata\(0,[^\n]*/.exec(gca) || ['yok'])[0]);
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
