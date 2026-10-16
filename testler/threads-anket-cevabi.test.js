// ANKETİN CEVABI — 24 SAAT SONRA, ANKETİN ALTINA
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR
// ══════════════════════════════════════════════════════════════════
// 16 Ekim 2026, ilk anket çıktıktan sonra kullanıcı eksiği gördü:
// "benim gibi bir kanalda sorunun doğru bir cevabı olmalı ve o cevap
// 24 saat sonra threads altına hiç bir cevap gelmediyse bile gitmeli".
// Kanalın iddiası "rivayet değil, kayıt"; soruyu sorup kaydı vermemek
// o iddianın tersi.
//
// NASIL. Threads'te "dizi" yok; zincir YANIT üzerinden kuruluyor
// (`reply_to_id`). Cevap, anketin altına yanıt olarak düşüyor.
//
// ⛔ CEVAP AYRI BİR TAKVİM KAYDI DEĞİL -- anketin kendi içinde
// (`content.anketCevap`). TEK TİK, İKİ GÖNDERİ. Ayrı kayıt olsaydı
// kullanıcı her anket için ikinci bir tik açmak zorunda kalırdı ve
// biri açılmazsa cevap SESSİZCE düşerdi. Kullanıcının kendi sorusu da
// buydu: "bunu da otomatik yayın olarak açmak gerekiyor tümünü" --
// cevap: gerekmiyor, anketin tiki ikisini birden yürütüyor.
//
// ⚠ ÇİFT YANIT, ÇİFT GÖNDERİDEN FARKSIZ: profilde kalıcı durur.
// Ölçümlerin ağırlığı orada: üç katman (unique, atomik alma, çöküş
// izi) ve "sorulamadıysa BEKLE" kuralı.
//
// Yorumlar atılıyor; 28 Eylül 2026'da bir ölçüm kodun kendi yorumuyla
// eşleşip geçmişti.
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (p)=> fs.readFileSync(yol.join(KOK, p), 'utf8');

const sqlYorumsuz = (s)=> s.replace(/--[^\n]*/g, '');
const jsYorumsuz  = (s)=> s.replace(/\/\*[\s\S]*?\*\//g, '')
                          .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

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
// SQL işlev gövdesi: `create ... function <ad>(` ile bir sonraki
// `$$;` arası.
function sqlGovde(metin, ad){
  const i = metin.indexOf('function public.' + ad + '(');
  if(i < 0) return null;
  const son = metin.indexOf('$$;', i);
  return son < 0 ? metin.slice(i) : metin.slice(i, son);
}

const WORKER = jsYorumsuz(oku('supabase/functions/story-yayin/index.ts'));
const HAMWORKER = oku('supabase/functions/story-yayin/index.ts');
const SQL = sqlYorumsuz(oku('sql/65-threads-anket-cevabi.sql'));
const HAMSQL = oku('sql/65-threads-anket-cevabi.sql');
const APP = jsYorumsuz(oku('app.html'));
const HAMAPP = oku('app.html');
const MCP = jsYorumsuz(oku('supabase/functions/mcp/index.ts'));
const DOGRULA = jsYorumsuz(oku('ai/dogrula.js'));
const SEMA = JSON.parse(oku('ai/sema.json'));

// ── 1. TABLO ─────────────────────────────────────────────────────
console.log('[sql/65 — kuyruk tablosu]');
{
  bak('★ threads_yanitlari tablosu var',
      /create table if not exists public\.threads_yanitlari/.test(SQL));
  // ⛔ BİRİNCİ KATMAN: aynı kayıt için ikinci bir yanıt satırı
  // açılamıyor. Kuyruğa alma her turda koşuyor; bu kısıt olmasa her
  // turda bir satır daha eklenir ve cevap ONLARCA KEZ giderdi.
  bak('★ kayıt başına TEK satır (unique)', /unique \(kayit_id\)/.test(SQL));
  bak('★ gönderilecek an ve ana gönderi kimliği taşınıyor',
      /ana_gonderi_id\s+text not null/.test(SQL) && /gonderilecek_an\s+timestamptz not null/.test(SQL));
  // Çöküş izi: çağrı yapıldı mı?
  bak('★ çöküş izi sütunu var (cagri_ani)', /cagri_ani\s+timestamptz/.test(SQL));
  bak('★ durum kümesi kısıtlı',
      /check \(durum in \('pending', 'in_progress', 'published', 'failed'\)\)/.test(SQL));
  // RLS: jeton yok ama bu tablo sistemin iç kuyruğu; tarayıcıya
  // açmanın faydası yok, riski var.
  bak('★ RLS açık', /alter table public\.threads_yanitlari enable row level security/.test(SQL));
  bak('★ ilke TANIMLI DEĞİL', !/create policy[\s\S]{0,120}threads_yanitlari/.test(SQL));
  bak('★ anon/authenticated yetkisi alınmış',
      /revoke all on public\.threads_yanitlari from anon, authenticated/.test(SQL));
  bak('★ service_role yetkili', /grant all  on public\.threads_yanitlari to service_role/.test(SQL));
}

// ── 2. KUYRUĞA ALMA ──────────────────────────────────────────────
console.log('[sql/65 — kuyruğa alma]');
{
  const gk = sqlGovde(SQL, 'threads_yanit_kuyruga_al') || '';
  bak('threads_yanit_kuyruga_al tanımlı', !!gk);
  // ⛔ YAYINLANMAYAN ANKETİN CEVABI GİTMEZ: altına yanıt yazılacak
  // gönderi yok.
  bak('★ yalnızca YAYINLANMIŞ anketler',
      /publish_state = 'published'/.test(gk) && /external_id is not null/.test(gk),
      (/publish_state[^\n]*/.exec(gk) || ['yok'])[0]);
  bak('★ yalnızca threads anketleri',
      /e\.type = 'poll'/.test(gk) && /e\.platform = 'threads'/.test(gk));
  // Cevap alanı boşsa yanıt YOK -- kullanıcı istemediyse gitmemeli.
  bak('★ cevabı boş olan kayıt kuyruğa girmiyor',
      /btrim\(coalesce\(e\.content->>'anketCevap', ''\)\) <> ''/.test(gk),
      (/anketCevap[^\n]*/.exec(gk) || ['yok'])[0]);
  // ⚠ İKİNCİ SATIRI ENGELLEYEN İKİNCİ KATMAN.
  bak('★ çakışmada yeni satır yazılmıyor', /on conflict \(kayit_id\) do nothing/.test(gk));
  // ⛔ ESKİ ANKETLERİ DİRİLTME. Bu dosya canlıya uygulandığı an
  // haftalar öncesinin cevapları bir arada gitmesin.
  bak('★ 7 günden eski yayınlar kuyruğa alınmıyor',
      /now\(\) - interval '7 days'/.test(gk),
      (/7 days[^\n]*/.exec(gk) || ['yok'])[0]);
  // Gecikme: varsayılan 24, 1-168 arasına sıkıştırılıyor.
  bak('★ gecikme varsayılanı 24 saat', /coalesce\(\(e\.content->>'anketCevapGecikme'\)::numeric, 24\)/.test(gk));
  bak('★ gecikme 1-168 arasına sıkıştırılıyor',
      /least\(greatest\([\s\S]{0,120}, 1\), 168\)/.test(gk),
      (/least\(greatest[^\n]*/.exec(gk) || ['yok'])[0]);
}

// ── 3. ATOMİK ALMA VE SONUÇ ──────────────────────────────────────
console.log('[sql/65 — alma ve sonuç]');
{
  const ga = sqlGovde(SQL, 'threads_yanit_al') || '';
  // ⛔ ÜÇÜNCÜ KATMAN: iki tur üst üste binerse (bir tur 60 saniyeyi
  // aşabiliyor) aynı yanıtı iki kez göndermemenin yolu bu.
  bak('★ atomik alma (for update skip locked)', /for update skip locked/.test(ga));
  bak('★ yalnızca vakti geleni alıyor', /gonderilecek_an <= now\(\)/.test(ga));
  bak('★ alınan satır in_progress oluyor ve deneme artıyor',
      /durum = 'in_progress'/.test(ga) && /deneme = y\.deneme \+ 1/.test(ga));
  bak('★ üç denemeden sonra almıyor', /deneme < 3/.test(ga));
  bak('★ erteleme vakti geçmeden almıyor',
      /tekrar_sonra is null or y\.tekrar_sonra <= now\(\)/.test(ga));

  const gi = sqlGovde(SQL, 'threads_yanit_iz') || '';
  bak('★ iz işlevi çağrı anını damgalıyor', /cagri_ani = now\(\)/.test(gi));

  const gb = sqlGovde(SQL, 'threads_yanit_bitti') || '';
  bak('★ bitti işlevi gönderi kimliğini saklıyor',
      /durum = 'published'/.test(gb) && /gonderi_id = coalesce\(gonderi_id, p_gonderi_id\)/.test(gb));

  const gh = sqlGovde(SQL, 'threads_yanit_hata') || '';
  // ⚠ İZ SİLİNİYOR: hata sınıflandırılmış demektir. İz kalsaydı
  // sonraki tur "sonucu bilinmiyor" dalına girip beklerdi.
  bak('★ hata izi temizliyor', /cagri_ani = null/.test(gh));
  bak('★ üçüncü denemede failed', /p_kalici or coalesce\(d, 0\) >= 3/.test(gh));
  bak('★ geçici hatada yarım saat bekliyor', /interval '30 minutes'/.test(gh));

  const ge = sqlGovde(SQL, 'threads_yanit_ertele') || '';
  // ⚠ ERTELEME DENEME HAKKINI GERİ VERİYOR: bütçe ya da jeton
  // yüzünden bekleyen bir yanıt üç turda hakkını tüketmemeli
  // (sql/47'deki story_ertele ile aynı gerekçe).
  bak('★ erteleme deneme hakkını geri veriyor', /deneme = greatest\(deneme - 1, 0\)/.test(ge));
  // ⛔ VE İZE DOKUNMUYOR: erteleme "bilmiyorum" demek olabilir.
  bak('★ erteleme çöküş izini silmiyor', !/cagri_ani/.test(ge));

  const gt = sqlGovde(SQL, 'threads_yanit_asili_topla') || '';
  bak('★ asılı kalan satırlar geri alınıyor',
      /durum = 'in_progress'/.test(gt) && /durum = 'pending'/.test(gt));

  // Yetkiler: hiçbir işlev tarayıcıya açık değil.
  for(const f of ['threads_yanit_kuyruga_al', 'threads_yanit_al', 'threads_yanit_iz',
                  'threads_yanit_bitti', 'threads_yanit_hata', 'threads_yanit_ertele',
                  'threads_yanit_asili_topla']){
    const satir = new RegExp('revoke all on function public\\.' + f + '\\([^)]*\\)\\s+from public, anon, authenticated');
    bak('★ ' + f + ' anon/authenticated\'tan alınmış', satir.test(SQL));
  }
}

// ── 4. WORKER ────────────────────────────────────────────────────
console.log('[worker — yanıt yolu]');
{
  const gy = jsGovde(WORKER, 'yanitiGonder') || '';
  bak('yanitiGonder tanımlı', !!gy);
  // Yanıt, kapsayıcıya reply_to_id verilerek kuruluyor.
  bak('★ reply_to_id ile yanıt yaratılıyor',
      /reply_to_id: String\(y\.ana_gonderi_id\)/.test(gy),
      (/reply_to_id[^\n]*/.exec(gy) || ['yok'])[0]);
  bak('★ metin gönderisi olarak gidiyor', /media_type: 'TEXT'/.test(gy));
  bak('★ 500 karakterde kırpılıyor (Threads sınırı)', /slice\(0, 500\)/.test(gy));
  bak('★ jeton tablodan alınıyor', /threadsJetonu\(\{ user_id: y\.user_id \}\)/.test(gy));
  // ⚠ İZ, YAYINLAYAN ÇAĞRIDAN HEMEN ÖNCE: kapsayıcı yaratmak
  // yayınlamıyor, oradaki çöküş çift yanıt üretemez.
  bak('★ iz, yayın çağrısından hemen önce',
      gy.indexOf("threads_yanit_iz") > 0 &&
      gy.indexOf("threads_yanit_iz") < gy.indexOf('threads_publish'),
      'iz=' + gy.indexOf('threads_yanit_iz') + ' publish=' + gy.indexOf('threads_publish'));
  bak('★ çıkmışsa yeniden gönderilmiyor',
      /if \(id\) \{[\s\S]{0,200}threads_yanit_bitti/.test(gy));
  // ⛔ SORULAMADIYSA BEKLE. Yanlış "çıkmadı" kararı çift yanıt demek.
  bak('★ sonuç bilinmiyorsa erteleniyor',
      /if \(!biliniyor\)[\s\S]{0,260}threads_yanit_ertele/.test(gy));
  bak('★ hata loga da yazılıyor', /console\.error\([\s\S]{0,160}temizle\(mesaj\)/.test(gy));
  bak('★ kalıcı/geçici ayrımı korunuyor', /p_kalici: kova === 'kalici'/.test(gy));

  const gc = jsGovde(WORKER, 'yanitCikmisMi') || '';
  bak('★ gönderinin yanıtları okunuyor', /\/replies/.test(gc));
  // ⚠ İKİ TANIK: zaman damgası VE metin. Yalnızca zamana bakmak, o
  // anda gelen BAŞKA birinin yanıtını bizim sanmak olurdu -- ve
  // cevabımız hiç gitmezdi.
  bak('★ iki tanık: zaman damgası ve metnin kendisi',
      /t >= esik && \(!bizim \|\| metin\.startsWith\(bizim\)\)/.test(gc),
      (/t >= esik[^\n]*/.exec(gc) || ['yok'])[0]);
  bak('★ liste okunamazsa bilinmiyor dönüyor',
      (gc.match(/return \{ biliniyor: false, id: '' \}/g) || []).length >= 2);
  bak('★ liste okundu ve yanıt yoksa KESİN çıkmadı',
      /return \{ biliniyor: true, id: '' \};\s*\}$/.test(gc.trim()));

  const gi = jsGovde(WORKER, 'yanitlariIsle') || '';
  bak('★ her turda eksikler kuyruğa alınıyor', /threads_yanit_kuyruga_al/.test(gi));
  bak('★ asılı yanıtlar toplanıyor', /threads_yanit_asili_topla/.test(gi));
  // ⚠ sql/65 çalıştırılmamışsa story yayını BOZULMAMALI.
  bak('★ kuyruk yoksa tur devam ediyor',
      /catch[\s\S]{0,260}console\.warn[\s\S]{0,160}return sonuc/.test(gi));
  // Bütçe dolduğunda ERTELEME (deneme harcanmıyor), hata değil.
  bak('★ bütçe dolunca erteleniyor, hata yazılmıyor',
      /butce[\s\S]{0,80}/.test(gi) && /threads_yanit_ertele[\s\S]{0,160}Tur bütçesi/.test(gi),
      (/Tur bütçesi[^\n]*/.exec(gi) || ['yok'])[0]);

  // ⚠ YANITLAR YAYINLARDAN SONRA: yayın saatinde olmak zorunda olan iş
  // yayın; bir cevabın beş dakika gecikmesi önemsiz, kaçan story geri
  // gelmiyor.
  const gt = jsGovde(WORKER, 'turuKos') || jsGovde(WORKER, 'tur') || WORKER;
  bak('★ yanıtlar ana kuyruktan SONRA işleniyor',
      WORKER.indexOf('kaydiIsle(k, bitis)') < WORKER.indexOf('yanitlariIsle(bitis)'),
      'kayit=' + WORKER.indexOf('kaydiIsle(k, bitis)') + ' yanit=' + WORKER.indexOf('yanitlariIsle(bitis)'));
  bak('★ Meta belgesine atıf var',
      /developers\.facebook\.com\/documentation\/threads\/retrieve-and-manage-replies\/create-replies/.test(HAMWORKER));
}

// ── 5. ALANLAR: DÖRT BEYAZ LİSTE ─────────────────────────────────
console.log('[content.anketCevap — beyaz listeler]');
{
  bak('★ ai/dogrula.js süzgecinde', /anketCevap: metin\(c\.anketCevap, 500\)/.test(DOGRULA));
  // ⚠ SAYI OLMAYAN GECİKME DÜŞÜYOR: 'yarın' gibi bir metin SQL
  // tarafında tip hatası verirdi.
  bak('★ gecikme sayı değilse düşüyor',
      /Number\.isFinite\(Number\(c\.anketCevapGecikme\)\)/.test(DOGRULA));
  const gi = jsGovde(MCP, 'kayitIcerigi') || '';
  bak('★ MCP çıktısı cevabı taşıyor', /o\.anketCevap = c\.anketCevap/.test(gi));
  bak('★ MCP çıktısı gecikmeyi taşıyor', /o\.anketCevapGecikme = c\.anketCevapGecikme/.test(gi));
  const c = SEMA.$defs.Entry.properties.content.properties;
  bak('★ ai/sema.json anketCevap tanımlı', !!c.anketCevap);
  bak('★ şemada cevap 500 karakter', (c.anketCevap || {}).maxLength === 500,
      (c.anketCevap || {}).maxLength);
  // Asistan "24 saat sonra, yanıt olarak" kuralını BİLMELİ.
  bak('★ şema açıklaması 24 saati ve yanıt olduğunu söylüyor',
      /24 hours/.test((c.anketCevap || {}).description || '')
      && /reply/.test((c.anketCevap || {}).description || ''));
  bak('★ şemada gecikme 1-168 arası',
      (c.anketCevapGecikme || {}).minimum === 1 && (c.anketCevapGecikme || {}).maximum === 168);
  // app.html: BAŞTAN kurulan content'e yazılmalı, yoksa kaydı
  // uygulamada bir kez açıp kaydetmek cevabı SESSİZCE silerdi.
  bak('★ app kaydetmede content\'e yazıyor',
      /anketCevap: document\.getElementById\('f_anketcevap'\)\.value\.trim\(\)/.test(APP));
  bak('★ app gecikmeyi content\'e yazıyor', /anketCevapGecikme: anketGecikmeOku\(\)/.test(APP));
  bak('★ app bulut okumasında beyaz listede', /anketCevap: str\(c\.anketCevap, 500\)/.test(APP));
  bak('★ app kayıt açılınca alanı dolduruyor',
      /getElementById\('f_anketcevap'\)\.value = c\.anketCevap/.test(APP));
  bak('★ cevap alanı arayüzde var', /id="f_anketcevap" maxlength="500"/.test(HAMAPP));
  bak('★ gecikme alanı 1-168 ile sınırlı',
      /id="f_anketgecikme" type="number" min="1" max="168"/.test(HAMAPP));
  // ⛔ KULLANICININ SORUSU: "bunu da otomatik yayın olarak açmak
  // gerekiyor tümünü?" -- Hayır. Ekranda bunu YAZIYOR olmalı, yoksa
  // herkes aynı soruyu sorar.
  bak('★ not "ayrı tik gerekmiyor" diyor (iki dilde)',
      (HAMAPP.match(/ayrı bir tik gerekmiyor|no second toggle needed/g) || []).length >= 2,
      'bulunan=' + (HAMAPP.match(/ayrı bir tik gerekmiyor|no second toggle needed/g) || []).length);
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
