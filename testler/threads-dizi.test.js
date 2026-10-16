// ÇOK PARÇALI THREADS DİZİSİ — ZİNCİR VE ALANLAR
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR
// ══════════════════════════════════════════════════════════════════
// 16 Ekim 2026. Threads'te "dizi" diye bir şey yok; zincir YANIT
// üzerinden kuruluyor (`reply_to_id`). 1. parça kaydın alt yazısı,
// sonraki parçalar `content.dizi` dizisinde ve her biri bir
// öncekinin ALTINA düşüyor.
//
// ⛔ BU DOSYA KAYNAĞA BAKIYOR. Kuyruğun DAVRANIŞINI (sıra şartı,
// zincirin bağlanması, "üçüncü parça patlarsa ilk ikisi yeniden
// gitmez") gerçek bir PostgreSQL'de koşturan ölçüm ayrı dosyada:
// testler/sql-yanit-kuyrugu.test.py
//
// O dosya yazılmasa iki gerçek hata canlıya giderdi ve ikisini de
// kaynağa bakan bir ölçüm göremezdi:
//   1. `ana_gonderi_id` NOT NULL'du -- 2. parçanın hedefi kuyruğa
//      girerken YOK, o yüzden kuyruğa alma işlevi hata veriyordu ve
//      anket cevapları da duruyordu (ikisi aynı işlevde).
//   2. Boş parça atlanırken numarada BOŞLUK kalıyordu (1,3,4) ve sıra
//      şartı olmayan 2. parçayı beklediği için zincir SESSİZCE
//      kilitleniyordu.
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

const WORKER = jsYorumsuz(oku('supabase/functions/story-yayin/index.ts'));
const SQL    = sqlYorumsuz(oku('sql/66-threads-dizi.sql'));
const HAMSQL = oku('sql/66-threads-dizi.sql');
const APP    = jsYorumsuz(oku('app.html'));
const HAMAPP = oku('app.html');
const MCP    = jsYorumsuz(oku('supabase/functions/mcp/index.ts'));
const TEK    = jsYorumsuz(oku('supabase/functions/mcp/tek-dosya.ts'));
const DOGRULA = jsYorumsuz(oku('ai/dogrula.js'));
const SEMA   = JSON.parse(oku('ai/sema.json'));

// ── 1. SQL: ZİNCİRİN KURALLARI ───────────────────────────────────
console.log('[sql/66]');
{
  bak('★ tur ve sira sütunları ekleniyor',
      /add column if not exists tur  text/.test(SQL) && /add column if not exists sira integer/.test(SQL));
  bak('★ kısıt (kayit, tur, sira) oldu',
      /unique \(kayit_id, tur, sira\)/.test(SQL));
  bak('★ eski tek-satır kısıtı düşürülüyor',
      /drop constraint threads_yanitlari_kayit_id_key/.test(SQL));
  // ⛔ GERÇEK KOŞUMUN BULDUĞU BİRİNCİ HATA.
  bak('★ hedef boş olabiliyor (2. parçanın hedefi kuyruğa girerken yok)',
      /alter column ana_gonderi_id drop not null/.test(SQL),
      (/ana_gonderi_id drop[^\n]*/.exec(SQL) || ['yok'])[0]);
  // ⛔ GERÇEK KOŞUMUN BULDUĞU İKİNCİ HATA: boşluksuz numaralandırma.
  bak('★ numaralandırma boşlukları attıktan SONRA (row_number)',
      /row_number\(\) over \(order by t\.sira\) as sira/.test(SQL),
      (/row_number[^\n]*/.exec(SQL) || ['yok'])[0]);
  bak('★ boş parçalar süzülüyor',
      /where btrim\(coalesce\(t\.metin, ''\)\) <> ''/.test(SQL));
  bak('★ on parça tavanı', /and p\.sira <= 10/.test(SQL));
  // ⛔ create or replace DÖNÜŞ TİPİNİ DEĞİŞTİREMİYOR: drop şart.
  // Bunu da gerçek koşum buldu; drop olmadan dosya hiç uygulanmıyor.
  bak('★ işlev drop edilip yeniden yaratılıyor',
      /drop function if exists public\.threads_yanit_al\(integer\);/.test(SQL));
  bak('★ dönüşte tur ve sira var',
      /id uuid, user_id uuid, kayit_id text, tur text, sira integer/.test(SQL));
  // SIRA ŞARTI: önceki parça yayınlanmadan bu parça alınmıyor.
  bak('★ önceki parça yayınlanmadan sıradaki alınmıyor',
      /o\.durum = 'published'/.test(SQL) && /coalesce\(o\.gonderi_id, ''\) <> ''/.test(SQL),
      (/o\.durum = 'published'[^\n]*/.exec(SQL) || ['yok'])[0]);
  // ZİNCİR: hedef, bir önceki parçanın ÇIKAN gönderisi.
  bak('★ hedef bir önceki parçanın gönderisi',
      /coalesce\(y\.ana_gonderi_id, o\.gonderi_id\) as hedef/.test(SQL));
  bak('★ hedef satıra yazılıyor (çöküş sonrası aynı hedef)',
      /ana_gonderi_id = s\.hedef/.test(SQL));
  bak('★ dizi parçaları beklemiyor (yayın anında)',
      /'dizi', p\.sira::integer[\s\S]{0,200}coalesce\(e\.published_at, now\(\)\)/.test(SQL));
  bak('★ yalnızca threads, yalnızca text_post/poll',
      /e\.platform = 'threads'/.test(SQL) && /e\.type in \('text_post', 'poll'\)/.test(SQL));
  // sql/65'i yeniden koşturmanın bu dosyayı geri aldığı YAZILI olmalı.
  bak('★ yeniden koşturma tuzağı dosyada yazılı',
      /sql\/65'i yeniden koşturursan/.test(HAMSQL) && /BU DOSYAYI da yeniden koştur/.test(HAMSQL));
}

// ── 2. WORKER ────────────────────────────────────────────────────
console.log('[worker]');
{
  const gy = jsGovde(WORKER, 'yanitiGonder') || '';
  // ⛔ EN KÖTÜ ARIZA: reply_to_id olmadan atılan bir parça, profilde
  // BAĞIMSIZ bir gönderi olarak çıkar ve geri alınamaz.
  bak('★ hedefi boş satır yayınlanmıyor',
      /if \(!hedef\)[\s\S]{0,260}p_kalici: true/.test(gy),
      (/if \(!hedef\)[^\n]*/.exec(gy) || ['yok'])[0]);
  bak('★ yanıt hedefe gidiyor', /reply_to_id: hedef/.test(gy));
  bak('★ hangi parçanın gittiği loga yazılıyor',
      /console\.log\('\[story\] yanıt gitti'[\s\S]{0,120}y\.sira/.test(gy));
  bak('★ dizi parçası ayrı sayılıyor', /'dizi-parcasi'/.test(gy));
  const gi = jsGovde(WORKER, 'yanitlariIsle') || '';
  // ⚠ ZİNCİR AYNI TURDA İLERLİYOR: sıra şartı yüzünden tek geçişte
  // yalnızca bir parça gidebilir; beş parçalı dizi beş dakikaya
  // yayılırsa okuyan için zincirin arası açılır.
  bak('★ parça gittikçe kuyruk yeniden soruluyor',
      /for \(let gecis = 0; gecis < 5/.test(gi),
      (/for \(let gecis[^\n]*/.exec(gi) || ['yok'])[0]);
  bak('★ bütçe bitince geçiş döngüsü kırılıyor',
      /if \(Date\.now\(\) > bitis - 20_000\) break;/.test(gi));
}

// ── 3. ALANLAR ───────────────────────────────────────────────────
console.log('[content.dizi — beyaz listeler]');
{
  bak('★ ai/dogrula.js süzgecinde',
      /dizi: Array\.isArray\(c\.dizi\)/.test(DOGRULA) && /slice\(0, 10\)/.test(DOGRULA));
  const gi = jsGovde(MCP, 'kayitIcerigi') || '';
  bak('★ MCP çıktısı taşıyor', /o\.dizi = c\.dizi/.test(gi));
  const c = SEMA.$defs.Entry.properties.content.properties;
  bak('★ ai/sema.json dizi tanımlı', !!c.dizi);
  bak('★ şemada en çok 10 parça', (c.dizi || {}).maxItems === 10, (c.dizi || {}).maxItems);
  bak('★ şemada parça 500 karakter', ((c.dizi || {}).items || {}).maxLength === 500);
  bak('★ şema açıklaması 1. parçanın caption olduğunu söylüyor',
      /Part 1 is "caption"/.test((c.dizi || {}).description || ''));
  bak('★ app bulut okumasında beyaz listede',
      /dizi: Array\.isArray\(c\.dizi\) \? c\.dizi\.slice\(0,10\)/.test(APP));
  // ⛔ content BAŞTAN kuruluyor: bu satır olmasa kaydı bir kez açıp
  // kaydetmek diziyi SESSİZCE silerdi.
  bak('★ app kaydetmede content\'e yazıyor', /dizi: diziKutusunuOku\(\)/.test(APP));
  bak('★ app kayıt açılınca kutuyu dolduruyor', /diziKutusunuYaz\(/.test(APP));
  bak('★ alan arayüzde var', /id="f_dizi"/.test(HAMAPP));
  bak('★ bölüm metin postu ve ankette görünüyor',
      /diziWrap'\)\.style\.display =\s*\n?\s*\(type==='text_post' \|\| type==='poll'\)/.test(APP),
      (/diziWrap[^\n]*/.exec(APP) || ['yok'])[0]);
  bak('★ not iki dilde', (HAMAPP.match(/f_dizi_not:/g) || []).length >= 2,
      'bulunan=' + (HAMAPP.match(/f_dizi_not:/g) || []).length);
}

// ── 4. AYIRICI ───────────────────────────────────────────────────
// ⛔ BOŞ SATIR AYIRICI DEĞİL. Threads gönderileri paragraflı yazılıyor
// (her alt yazıda boş satırlar var); boş satırı ayırıcı saymak her
// gönderiyi parçalara bölerdi. Ayırıcı yalnızca --- yazan bir satır.
// Bu, metne bakmakla ölçülemez: desen ÇALIŞTIRILIYOR.
console.log('[ayırıcı — çalıştırılarak]');
{
  const m = /const DIZI_AYIRICI = (\/[^\n]+\/m);/.exec(APP);
  bak('ayırıcı deseni bulunabiliyor', !!m, (m || ['yok'])[0]);
  if(m){
    const desen = new Function('return ' + m[1] + ';')();
    const bol = (metin)=> metin.split(new RegExp(desen.source, 'm'))
                               .map(x=>x.trim()).filter(Boolean);
    // Paragraflı bir gönderi TEK parça kalmalı.
    const paragrafli = '1. cümle\n\nikinci paragraf\n\nüçüncü paragraf';
    bak('★ boş satır parçalamıyor', bol(paragrafli).length === 1,
        'parça=' + bol(paragrafli).length);
    bak('★ --- parçalıyor', bol('a\n---\nb').length === 2);
    bak('★ uzun çizgi de ayırıcı', bol('a\n-----\nb').length === 2);
    bak('★ satır içindeki --- ayırıcı değil', bol('a --- b').length === 1);
    bak('★ paragraflı iki parça doğru bölünüyor',
        bol('1\n\n2\n---\n3\n\n4').length === 2);
  }
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
