// TIKTOK DOĞRUDAN YAYIN — kaynak üzerinden ölçüm.
//
// Worker bir Deno Edge Function; burada çalıştırılamıyor. Ölçülen şey
// KAYNAĞIN TAŞIDIĞI KURALLAR: hangi uç hangi koşulda çağrılıyor,
// gizlilik seviyesi nereden geliyor, denetim kapısı kapalı mı.
//
// 12 Ekim 2026'da yazıldı. O güne kadar TikTok'a yalnızca TASLAK
// gidiyordu: video kullanıcının gelen kutusuna düşüyor, alt yazı hiç
// gitmiyordu (taslak ucunun gövdesinde post_info yok).
//
// ⚠ EN ÖNEMLİ ÜÇ ÖLÇÜM (yıldızlı):
//  · gizlilik seviyesi TikTok'un verdiği listeden seçiliyor — kod kendi
//    kararını dayatmıyor. Listede olmayan değer init'i reddettiriyor.
//  · liste boş/tanınmazsa SELF_ONLY — geniş bir varsayılan, kullanıcının
//    görmediği bir videoyu herkese açardı.
//  · video.publish kapsamı YOKSA taslak yoluna düşülüyor — yoksa yayın
//    o gün kaçardı.
const fs = require('fs');
const path = require('path');

const KOK = path.dirname(__dirname);
let gecen = 0, kalan = 0;
function bak(ad, kosul, ek) {
  if (kosul) { gecen++; console.log('  ok  ' + ad); }
  else { kalan++; console.log('  YOK ' + ad + (ek !== undefined ? ' -> ' + ek : '')); }
}

const worker = fs.readFileSync(
  path.join(KOK, 'supabase/functions/story-yayin/index.ts'), 'utf8');
const baglan = fs.readFileSync(
  path.join(KOK, 'supabase/functions/tiktok-baglan/index.ts'), 'utf8');

// tiktokYayinla gövdesini ayır: ölçümler başka işlevlere kaymasın.
const yBas = worker.indexOf('async function tiktokYayinla(');
const yiv = worker.slice(yBas, worker.indexOf('\n}\n', worker.indexOf("return 'dogrudan-yayinlandi';", yBas)));

console.log('[uçlar]');
bak('doğrudan yayın ucu tanımlı',
  /TT_DIREKT\s*=\s*'https:\/\/open\.tiktokapis\.com\/v2\/post\/publish\/video\/init\/'/.test(worker));
bak('creator_info ucu tanımlı',
  /TT_KISI\s*=\s*'https:\/\/open\.tiktokapis\.com\/v2\/post\/publish\/creator_info\/query\/'/.test(worker));
bak('taslak ucu DURUYOR (geri düşüş yolu)',
  /TT_INBOX\s*=.*inbox\/video\/init/.test(worker));

console.log('\n[hangi yol seçiliyor]');
bak('★ karar video.publish KAPSAMINDAN veriliyor',
  /const dogrudan = \(hesap\?\.kapsamlar \|\| \[\]\)\.includes\('video\.publish'\)/.test(yiv));
bak('★ kapsam yoksa TASLAK ucu çağrılıyor',
  /if \(!dogrudan\) \{[\s\S]*?TT_INBOX/.test(yiv));
bak('★ kapsam varsa DOĞRUDAN uç çağrılıyor', /fetch\(TT_DIREKT/.test(yiv));
bak('taslak yolu post_info GÖNDERMİYOR (o uçta alan yok)',
  /body: JSON\.stringify\(\{ source_info: kaynak \}\)/.test(yiv));

console.log('\n[gizlilik seviyesi]');
bak('★ creator_info sorgulanıyor (atlanırsa init reddediliyor)',
  /const bilgi = await tiktokKisiBilgisi\(jeton\)/.test(yiv));
bak('★ gizlilik TikTok\'un verdiği listeden seçiliyor',
  /privacy_level: tiktokGizlilik\(bilgi\.privacy_level_options\)/.test(yiv));
bak('creator_info alınamazsa ERTELENİYOR, tahmin edilmiyor',
  /if \(!bilgi\) \{[\s\S]*?story_ertele/.test(yiv));

// tiktokGizlilik saf bir işlev: mantığını kaynaktan çıkarıp çalıştır.
const gBas = worker.indexOf('const TT_GIZLILIK_SIRASI');
const gSon = worker.indexOf('\n}', worker.indexOf('function tiktokGizlilik')) + 2;
const tiktokGizlilik = new Function(
  worker.slice(gBas, gSon).replace(/: unknown/g, '').replace(/: string/g, '')
  + '\nreturn tiktokGizlilik;')();

bak('★ herkese açık varsa onu seçiyor',
  tiktokGizlilik(['SELF_ONLY', 'PUBLIC_TO_EVERYONE']) === 'PUBLIC_TO_EVERYONE');
bak('★ yalnızca SELF_ONLY varsa (denetimsiz) ona düşüyor',
  tiktokGizlilik(['SELF_ONLY']) === 'SELF_ONLY');
bak('★ BOŞ listede SELF_ONLY — geniş varsayılan yok',
  tiktokGizlilik([]) === 'SELF_ONLY');
bak('★ tanınmayan değerlerde SELF_ONLY',
  tiktokGizlilik(['BILINMEYEN']) === 'SELF_ONLY');
bak('dizi değilse çökmüyor', tiktokGizlilik(undefined) === 'SELF_ONLY');
bak('arkadaşlar herkese açıktan sonra geliyor',
  tiktokGizlilik(['MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR']) === 'FOLLOWER_OF_CREATOR');

console.log('\n[alt yazı ve etiketler]');
bak('★ doğrudan yayında title = altYazi() (caption + hashtag)',
  /title: altYazi\(k, TT_BASLIK\)/.test(yiv));
bak('tavan adlandırılmış sabit', /const TT_BASLIK = \d+;/.test(worker));
bak('tavanın doğrulanmadığı YAZILI (uydurma sayı değil)',
  /TAVANI DOGRULANMIS DEGIL/.test(worker));

console.log('\n[hesabın ayarları dayatılmıyor]');
bak('★ disable_comment hesabın ayarından',
  /disable_comment: bilgi\.comment_disabled === true/.test(yiv));
bak('disable_duet hesabın ayarından',
  /disable_duet:\s+bilgi\.duet_disabled\s+=== true/.test(yiv));
bak('disable_stitch hesabın ayarından',
  /disable_stitch:\s+bilgi\.stitch_disabled\s+=== true/.test(yiv));

console.log('\n[denetim kapısı]');
bak('★ unaudited hatası ADIYLA yakalanıyor',
  /unaudited_client_can_only_post_to_private_accounts/.test(yiv));
bak('★ yakalanınca ERTELENİYOR (kalıcı hata değil — onay gelince akar)',
  /unaudited_client_can_only_post_to_private_accounts'\) \{[\s\S]*?story_ertele/.test(yiv));
bak('mesaj ham JSON değil, ne yapılacağını söylüyor',
  /denetimi henüz onaylanmadı[\s\S]*?elle at/.test(yiv));

console.log('\n[bağlanma: video.publish varsayılanda İSTENMİYOR]');
bak('★ varsayılan kapsam listesinde video.publish YOK',
  /\|\| 'user\.info\.basic,video\.upload'/.test(baglan)
  && !/'user\.info\.basic,video\.upload,video\.publish'/.test(baglan));
// ⚠ 16 Ekim 2026: ÖLÇÜM YAZILIŞA ÇAKILIYDI. Kod o gün `ayar()`
// üzerinden okumaya geçti (Deno.env'i o işlev okuyor, böylece eksik
// değişken tek yerden raporlanıyor) ve bu satır KIRMIZI kaldı -- oysa
// davranış doğruydu. Aranan şey artık okumanın KENDİSİ: iki yazılıştan
// biri yeterli, hiçbiri yoksa liste sabitlenmiş demektir.
bak('★ liste ortam değişkeninden genişletilebiliyor',
  /(ayar|Deno\.env\.get)\('TIKTOK_KAPSAMLAR'\)/.test(baglan));
bak('neden varsayılanda olmadığı YAZILI',
  /tanımlı OLMAYAN bir kapsam istenirse yetkilendirmeyi/.test(baglan));

console.log('\n[kırılmaması gerekenler]');
bak('parçalı yükleme TEK KOPYA (iki yol da aynı işlevi çağırıyor)',
  (worker.match(/tiktokParcalariYukle\(/g) || []).length === 3);
bak('★ dosya belleğe alınmıyor (Range ile akış)',
  /headers: \{ range: `bytes=\$\{basBayt\}-\$\{sonBayt\}` \}/.test(worker));
bak('tiktokCikmisMi yeni dönüş şekline uyarlanmış',
  /const hesap = await tiktokJetonu\(k\);\n  if \(!hesap\?\.jeton\)/.test(worker));
bak('⛔ uploaded sütununa dokunulmuyor', !/uploaded/.test(yiv));
bak('iki yol da story_yayinlandi çağırıyor',
  (yiv.match(/story_yayinlandi/g) || []).length === 2);

console.log('\n%d gecti, %d kaldi', gecen, kalan);
process.exit(kalan ? 1 : 0);
