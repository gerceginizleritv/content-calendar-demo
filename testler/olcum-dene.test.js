// GÖRÜNTÜLENME SONDASI — SALT OKUR VE JETON SIZDIRMIYOR
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR
// ══════════════════════════════════════════════════════════════════
// 19 Ekim 2026: "görüntülenmeleri Shootboard toplasın" işine
// başlarken, metrik adlarını hafızadan yazmak yerine önce gerçek
// gönderilere soran bir sonda yazıldı (supabase/functions/olcum-dene).
//
// Sonda küçük bir şey ama iki ağır riski var ve ikisi de SESSİZ:
//
//   1. JETON SIZMASI. Denenen adresi tabloya yazıyor. Adres jetonla
//      birlikte yazılırsa, Meta sayfa jetonu bir veritabanı satırında
//      düz metin durur. Tablo bir günlüktür; günlüğe düşen jeton
//      açıktır.
//   2. YANLIŞLIKLA YAZMA. Yayın worker'ıyla aynı jetonları ve aynı
//      API'leri kullanıyor. Bir POST, bir yayın ucu, bir durum
//      değiştiren rpc çağrısı -- hepsi bu dosyada BİR SATIR uzaklıkta
//      ve hiçbiri test edilmezse fark edilmez.
//
// Üçüncü ölçüm Bölüm 4'ün tekrarı: `basarili` alanı "cevap geldi mi"
// demek, "sayı sıfırdan büyük mü" demek DEĞİL. 5 Ekim 2026'da
// doğrulanmamış bir görüntülenme sayısı yazıldı ve aynı arızayı sekiz
// gün görünmez yaptı. Sıfır ile "bilinmiyor" aynı şey değil; ayrım
// kodun en başında, sondada kuruluyor.
//
// ⚠ YORUMLAR ATILIYOR. Bu dosyanın yorumlarında "jeton", "salt okur",
// "yayın" gibi kelimeler bolca geçiyor; yorum üzerinden eşleşen bir
// ölçüm, kod silinse bile yeşil kalırdı.
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (p)=> fs.readFileSync(yol.join(KOK, p), 'utf8');

// // ve /* */ yorumlarını at (metin içindeki // için kaba ama bu
// dosyada URL'ler şablon dizgesi içinde ve https:// geçiyor -- onu
// korumak için yalnızca satır başındaki yorumlar siliniyor).
const tsKodu = (s)=> s.replace(/\/\*[\s\S]*?\*\//g, '')
                      .split('\n').filter(r=> !/^\s*\/\//.test(r)).join('\n');

const HAM = oku('supabase/functions/olcum-dene/index.ts');
const SRC = tsKodu(HAM);
const SQL = oku('sql/67-olcum-denemesi.sql');
const sqlKodu = SQL.split('\n').filter(r=> !/^\s*--/.test(r)).join('\n');

// ── 1. SALT OKUR ─────────────────────────────────────────────────
console.log('[salt okur]');
{
  // Dışarıya giden tek fetch, aday adresine yapılan fetch. Method
  // verilmiyorsa GET. Bir `method: 'POST'` bu fetch'e eklenirse
  // sonda yazan bir şeye dönüşür.
  const disFetch = SRC.match(/fetch\(tamAdres[^)]*\)/);
  bak('aday adresine fetch var', !!disFetch);
  if (disFetch) bak('o fetch GET (method verilmiyor)', !/method/.test(disFetch[0]), disFetch[0]);

  // Yayın uçları ve durum değiştiren çağrılar hiç geçmemeli.
  for (const yasak of ['threads_publish', 'media_publish', 'story_yayinlandi',
                       'video_reels', 'story_kuyruk_al', 'auto_publish', 'uploaded'])
    bak('"' + yasak + '" geçmiyor', !SRC.includes(yasak));

  // Supabase'e giden tek POST kendi deneme tablosu olmalı.
  const postlar = [...SRC.matchAll(/rest\(\s*'([^']+)'\s*,\s*\{\s*method:\s*'POST'/g)].map(m=> m[1]);
  bak('REST POST yalnız /olcum_denemesi',
      postlar.length > 0 && postlar.every(p=> p === '/olcum_denemesi'), postlar.join(' '));
}

// ── 2. JETON SIZMIYOR ────────────────────────────────────────────
console.log('[jeton sizmiyor]');
{
  // Tabloya yazılan adres, jetonsuz olan `aday.adres` olmalı --
  // `tamAdres` DEĞİL. Bu tek harflik fark jetonu veritabanına yazar.
  const satirBloku = SRC.slice(SRC.indexOf('const satir'), SRC.indexOf('if (!jeton)'));
  bak('tabloya yazılan adres aday.adres', /adres:\s*`?\$\{aday\.ad\}/.test(satirBloku) || /aday\.adres/.test(satirBloku), satirBloku.slice(0,200));
  bak('tabloya tamAdres YAZILMIYOR', !/adres:[^\n]*tamAdres/.test(SRC));

  // Jeton yalnızca isteğin kendisinde.
  const jetonKullanim = [...SRC.matchAll(/\bjeton\b/g)].length;
  bak('jeton değişkeni kullanılıyor', jetonKullanim > 0);
  bak('ham cevap süzülerek yazılıyor', /\bham\s*[:=]\s*temizle\(/.test(SRC));
  // ⚠ HER hata ataması süzülmeli, biri değil. İlk yazılışında ölçüm
  // yalnızca "bir yerde temizle var mı" diye bakıyordu; iki atamadan
  // birinden temizle kaldırılınca mutasyon KAÇTI. Hepsi taranıyor.
  const hataAtamalari = [...SRC.matchAll(/satir\.hata\s*=\s*([^\n;]+);/g)].map(m=> m[1].trim());
  bak('hata ataması var', hataAtamalari.length >= 2, hataAtamalari.length + ' adet');
  bak('HER hata ataması süzülüyor ya da sabit metin',
      hataAtamalari.every(d=> d.startsWith('temizle(') || /^['"`][^'"`]*['"`]$/.test(d)),
      hataAtamalari.filter(d=> !(d.startsWith('temizle(') || /^['"`][^'"`]*['"`]$/.test(d))).join(' | '));

  // temizle() gerçekten access_token'ı siliyor mu.
  const tem = SRC.slice(SRC.indexOf('function temizle'), SRC.indexOf('function json'));
  bak('temizle access_token parametresini siliyor', /access_token=/.test(tem) && /replace\(/.test(tem));
  bak('temizle sayfa jetonunu da siliyor', /PAGE_TOKEN/.test(tem));
  bak('temizle metni kırpıyor', /slice\(/.test(tem));

  // Günlüğe de süzülmeden metin gitmemeli.
  const logSatirlari = [...SRC.matchAll(/console\.(log|warn|error)\([^\n]*/g)].map(m=> m[0]);
  bak('günlükte süzülmemiş hata metni yok',
      logSatirlari.every(s=> !/\.message/.test(s) || /temizle\(/.test(s)),
      logSatirlari.filter(s=> /\.message/.test(s) && !/temizle\(/.test(s)).join(' | '));
}

// ── 3. SIFIR İLE BİLİNMİYOR AYRI ─────────────────────────────────
// Bölüm 4'ün kod hali. `basarili` cevabın GELDİĞİNİ söylüyor;
// değerin büyüklüğünü değil.
console.log('[sifir != bilinmiyor]');
{
  bak('basarili = r.ok', /basarili\s*=\s*r\.ok/.test(SRC));
  bak('basarili bir değer karşılaştırmasına bağlanmamış',
      !/basarili\s*=\s*[^\n;]*[><]/.test(SRC));
  bak('tabloda varsayılan false', /basarili:\s*false/.test(SRC));
  bak('jeton yokken basarili açılmıyor',
      !/jeton yok[\s\S]{0,200}basarili\s*=\s*true/.test(SRC));
}

// ── 4. KAPSAM: HİKÂYE YOK ────────────────────────────────────────
// Kullanıcı 19 Ekim 2026'da kalıcı içerikleri seçti. Hikâye
// insights'ı 24 saatte kayboluyor; sondaya girerse "ölçülemedi"
// satırları gerçek bir izin sorunuymuş gibi görünür.
console.log('[kapsam]');
{
  const sorgu = SRC.slice(SRC.indexOf('const sorgu'), SRC.indexOf('let kayitlar'));
  bak('sorgu yalnız yayınlanmışları alıyor', /publish_state=eq\.published/.test(sorgu));
  bak('external_id dolu olanlar', /external_id=not\.is\.null/.test(sorgu));
  bak('reels ya da threads', /type\.eq\.reels/.test(sorgu) && /platform\.eq\.threads/.test(sorgu));
  bak("sorguda 'story' geçmiyor", !/story/.test(sorgu), sorgu.slice(0,200));
}

// ── 5. ADAY LİSTESİ TAHMİNE YASLANMIYOR ──────────────────────────
// Instagram'da metrik adı sürümle değişti (plays -> views). Tek ada
// yaslanmak, yanlış sürümde sessizce boş sonuç demek.
console.log('[aday listesi]');
{
  const ad = SRC.slice(SRC.indexOf('function adaylar'), SRC.indexOf('function alanAdlari'));
  bak('instagram icin views denenıyor', /metric=views/.test(ad));
  bak('instagram icin plays da denenıyor', /metric=plays/.test(ad));
  bak('threads insights denenıyor', /threads/.test(ad) && /insights/.test(ad));
  bak('facebook icin birden çok yol', (ad.match(/fb\//g) || []).length >= 2);
  bak('aday adreslerinde access_token YOK', !/access_token/.test(ad));
}

// ── 6. YETKİ ─────────────────────────────────────────────────────
console.log('[yetki]');
{
  bak('x-webhook-secret isteniyor', /x-webhook-secret/.test(SRC));
  bak('eşleşmezse 401', /yetkisiz'\s*\}\s*,\s*401/.test(SRC));
  bak('secret boşsa da reddediyor', /!WORKER_SECRET\s*\|\|/.test(SRC));
}

// ── 7. SQL DOSYASI ───────────────────────────────────────────────
console.log('[sql/67]');
{
  bak('tablo yaratılıyor', /create table if not exists public\.olcum_denemesi/.test(sqlKodu));
  bak('RLS açık', /alter table public\.olcum_denemesi enable row level security/.test(sqlKodu));
  bak('anon/authenticated yetkisi alınmış', /revoke all on public\.olcum_denemesi from anon, authenticated/.test(sqlKodu));
  bak('politika tanımlanmamış (yalnız servis rolü)', !/create policy/.test(sqlKodu));
  bak('basarili sütunu var', /basarili\s+boolean/.test(sqlKodu));
  bak('mevcut işlev değiştirilmiyor', !/create or replace function/.test(sqlKodu));
  bak('silme yok', !/\bdrop\s+(table|function)\b/i.test(sqlKodu));
}

console.log('\ngecti: ' + g + '   kaldi: ' + k);
process.exit(k ? 1 : 0);
