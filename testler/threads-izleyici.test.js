// THREADS IZLEYICISI — UC IZLEYICI, UC AYRI KURAL
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR
// ══════════════════════════════════════════════════════════════════
// 16 Ekim 2026: Threads yayini acildi ama izleyicisi yoktu, yani her
// gorsel icin PowerShell'de elle yukleme gerekiyordu. story ve reels'te
// bu isi Gorev Zamanlayici + klasor izleyicisi yapiyor.
//
// Tek izleyiciyi uc klasore yoneltmek teklif edildi; kullanici
// "uc izleyici dosyasinin birbirinden tamamen ayri olmasini tercih
// ediyorum" dedi. Ayri dosyanin bedeli KOPYA RISKI: ucu de ayni ise
// benzer sekilde bakiyor ve biri duzeltilince oteki geride kaliyor.
// Bu olcumler o bedeli odenebilir tutuyor -- her izleyicinin KENDI
// kuralinin gercekten kendisine ait oldugunu ve paylasilmasi gereken
// seyin (otomatik yayin politikasi) kopyalanmadigini olcuyorlar.
//
// ⚠ UC KLASOR, UC DEFTER, UC GOREV. Biri otekinin klasorune bakarsa
// dosyalar yanlis kurala tabi olur: Threads'e 47 MB'lik bir reel
// gonderilmeye calisilir, ya da story 8 MB'de reddedilir.
//
// Yorumlar VE belge metinleri atiliyor. 28 Eylul 2026'da bir olcum
// kodun kendi yorumuyla eslesip gecti; bu dosyalarda uzun belge
// metinleri var ve "8 MB", "video" gibi ifadeler orada da geciyor.
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (p)=> fs.readFileSync(yol.join(KOK, p), 'utf8');

// ⚠ UC TIRNAKLI METINLER DE SILINIYOR. Yalnizca `#` satirlari
// silinseydi, modulun basindaki belge metni ("Threads gorsel siniri
// 8 MB", "VIDEO yok") olcumleri KENDI BASINA gecirirdi -- kod silinse
// bile test yesil kalirdi.
const pyKodu = (s)=> s.replace(/"""[\s\S]*?"""/g, '')
                      .replace(/'''[\s\S]*?'''/g, '')
                      .replace(/^[ \t]*#[^\n]*\n/gm, '')
                      .replace(/(^|[^:])#[^\n]*/g, '$1');

// Python govdesi: `def ad(` satirindan, sutun 0'daki bir sonraki
// `def`/`if __name__` satirina kadar.
function pyGovde(metin, ad){
  const i = metin.indexOf('def ' + ad + '(');
  if(i < 0) return null;
  const kalan = metin.slice(i);
  const son = kalan.slice(1).search(/\n(def |if __name__)/);
  return son < 0 ? kalan : kalan.slice(0, son + 1);
}

const IZLE    = pyKodu(oku('pc/threads-izle.py'));
const HAM     = oku('pc/threads-izle.py');
const BAT     = oku('pc/threads-izle.bat');
const STORYIZ = pyKodu(oku('pc/story-izle.py'));
const REELSIZ = pyKodu(oku('pc/reels-izle.py'));
const YUKLE   = pyKodu(oku('pc/story-yukle.py'));

// ── 1. UC AYRI KLASOR ────────────────────────────────────────────
console.log('[klasorler ayri]');
{
  bak('★ Threads izleyicisi kendi klasorunu izliyor',
      /VARSAYILAN_KLASOR\s*=\s*r'E:\\CLAUDE VIDEOS\\TESLIM\\THREADS'/.test(IZLE),
      (/VARSAYILAN_KLASOR[^\n]*/.exec(IZLE) || ['yok'])[0]);
  bak('★ kendi ortam degiskeni (THREADS_KLASOR)',
      /environ\.get\('THREADS_KLASOR'/.test(IZLE));
  // ⛔ OTEKILERIN DEGISKENINI OKUMUYOR. Okursa, story klasoru
  // tanimliyken Threads izleyicisi oraya bakar ve 47 MB'lik reels
  // dosyalarini Threads'e gondermeye calisir.
  bak('★ story/reels degiskenlerini OKUMUYOR',
      !/STORY_KLASOR|REELS_KLASOR/.test(IZLE));
  // Otekiler de yerinde durmali: "yonlendirme" diye bir sey yok.
  bak('★ story izleyicisi kendi klasorunde kaldi',
      /STORY_KLASOR'?,\s*r'E:\\CLAUDE VIDEOS\\story\\cikti'/.test(STORYIZ)
      || /environ\.get\('STORY_KLASOR'/.test(STORYIZ));
  bak('★ reels izleyicisi kendi klasorunde kaldi',
      /REELS_V2/.test(REELSIZ) && /environ\.get\('REELS_KLASOR'/.test(REELSIZ));
  // ⚠ UC DEFTER AYRI. Ayni ad kullanilsa, bir klasore iki izleyici
  // bakarsa defterler birbirini ezer ve dosyalar yeniden yuklenir.
  const d = [IZLE, STORYIZ, REELSIZ].map((s)=> (/DEFTER_ADI\s*=\s*'([^']+)'/.exec(s) || [,''])[1]);
  bak('★ uc defter adi da ayri', new Set(d).size === 3, d.join(' / '));
}

// ── 2. THREADS KURALI: GORSEL, 8 MB ──────────────────────────────
console.log('[Threads kurallari]');
{
  // Threads kapsayicisi IMAGE ya da TEXT; video yok.
  bak('★ yalnizca jpg/jpeg/png kabul ediliyor',
      /IZINLI_TUR\s*=\s*\{[^}]*'\.jpg'[^}]*'\.png'[^}]*\}/.test(IZLE)
      && !/IZINLI_TUR\s*=\s*\{[^}]*\.mp4/.test(IZLE),
      (/IZINLI_TUR\s*=[^\n]*/.exec(IZLE) || ['yok'])[0]);
  // ⚠ SINIR KENDISININ. story-yukle.py'deki EN_BUYUK 100 MB ve o
  // dogru -- Instagram siniri. Threads'te 8 MB (Meta belgesi).
  // Yukleyicinin sinirini kullanmak, reddedilecek bir gorseli
  // yuklemek demek.
  bak('★ 8 MB siniri KENDI sabiti',
      /EN_BUYUK\s*=\s*8\s*\*\s*1024\s*\*\s*1024/.test(IZLE),
      (/EN_BUYUK\s*=[^\n]*/.exec(IZLE) || ['yok'])[0]);
  bak('★ yukleyicinin 100 MB siniri kullanilmiyor',
      !/y\.EN_BUYUK|yukleyici\.EN_BUYUK/.test(IZLE));
  bak('★ story tarafindaki 100 MB siniri yerinde',
      /EN_BUYUK\s*=\s*100\s*\*\s*1024\s*\*\s*1024/.test(YUKLE));
  const gd = pyGovde(IZLE, 'dosyayi_isle') || '';
  bak('★ boyut GERCEKTEN olculuyor',
      /boyut > EN_BUYUK/.test(gd) && /return \('hata'/.test(gd),
      (/boyut > [^\n]*/.exec(gd) || ['yok'])[0]);
  // Tur suzgeci dongude: desteklenmeyen uzanti ise islenmiyor.
  const gt = pyGovde(IZLE, 'bir_tur') || '';
  bak('★ uzanti suzgeci kendi listesine bakiyor',
      /uzanti not in IZINLI_TUR/.test(gt),
      (/uzanti not in[^\n]*/.exec(gt) || ['yok'])[0]);
  // ⛔ ATLAMA SESSIZ DEGIL (Bolum 9). Klasore dusen bir video
  // sonsuza kadar bekleyecekse kullanici bunu bilmeli.
  // ⚠ OLCUM SUZGECIN KENDI BLOGUNA BAKIYOR. Ilk surum suzgecten
  // sonraki 200 karakterde bir `print` ariyordu; o mesafede KOMSU
  // blogun (story/reels atlamasi) print'i de vardi ve video
  // mesajini silen mutasyon HAYATTA KALDI. Simdi yalnizca
  // suzgec ile kendi `continue`'su arasina bakiliyor.
  const videoBlok = (/uzanti not in IZINLI_TUR:([\s\S]*?)continue/.exec(gt) || [, ''])[1];
  bak('★ atlanan video sebebiyle yaziliyor',
      /print\(/.test(videoBlok), videoBlok.trim().slice(0, 50) || '(bos blok)');
  bak('★ story/reels dosyasi atlaniyor ve sebebi yaziliyor',
      /ad_turu\(ad\) in \('story', 'reels'\)[\s\S]{0,200}print\(/.test(gt),
      (/ad_turu\(ad\) in[^\n]*/.exec(gt) || ['yok'])[0]);
}

// ── 3. PAYLASILMASI GEREKEN SEY KOPYALANMADI ─────────────────────
// ⚠ AYRI DOSYA OLMAK, HER SEYI KOPYALAMAK DEMEK DEGIL. Otomatik yayin
// politikasi (OTOMATIK_YAYIN) tek yerde: story-yukle.py. 10 Ekim
// 2026'da o karar tek bir global bayrakken 66 kayit otomatik yayinda
// kalmisti; uc izleyiciye uc kopya cikarmak ayni sinifta bir hata.
console.log('[politika tek yerde]');
{
  bak('★ politika tablosu bu dosyada YOK',
      !/OTOMATIK_YAYIN\s*=/.test(IZLE));
  bak('★ karar yukleyicinin otomatik_mi\'sine soruluyor',
      /y\.otomatik_mi\(aday\.get\('platform'\), aday\.get\('type'\)/.test(IZLE),
      (/otomatik_mi[^\n]*/.exec(IZLE) || ['yok'])[0]);
  bak('★ yukleme ve kayit baglama da yukleyiciden',
      /y\.r2_yukle\(/.test(IZLE) && /y\.kayda_yaz\(/.test(IZLE)
      && /y\.kaydi_bul\(/.test(IZLE));
  // ⛔ SARTNAME BOLUM 1: hicbir kod `uploaded` sutununa yazmaz.
  bak('★ uploaded sutununa hic dokunulmuyor', !/uploaded/.test(IZLE));
}

// ── 4. SIRA: ONCE KAYIT, SONRA YUKLEME ───────────────────────────
// Izleyici, kaydin var oldugunu bilmiyor (gorsel kayittan once hazir
// olabilir). Once yukleseydi, kayit acilana kadar HER TURDA ayni
// dosyayi R2'ye bir daha koyardi.
console.log('[sira ve tekrar koruması]');
{
  const gd = pyGovde(IZLE, 'dosyayi_isle') || '';
  bak('★ kayit aramasi yuklemeden ONCE',
      gd.indexOf('kaydi_bul') > 0 && gd.indexOf('kaydi_bul') < gd.indexOf('r2_yukle'),
      'kaydi_bul=' + gd.indexOf('kaydi_bul') + ' r2_yukle=' + gd.indexOf('r2_yukle'));
  // Gecen turda yuklenmis adres deftere yazili: ayni dosya iki kez
  // yuklenmiyor.
  bak('★ defterdeki adres yeniden kullaniliyor',
      /onceki\.get\('url'\)/.test(gd));
  const gt = pyGovde(IZLE, 'bir_tur') || '';
  bak('★ adres durum ne olursa olsun deftere yaziliyor',
      /sonuc_ek\.get\('url'\)[\s\S]{0,120}girdi\['url'\]/.test(gt));
  // Dosya yazilirken alinmiyor: iki olcumde boyut ayni kalmali.
  bak('★ yarim yazilmis dosya alinmiyor',
      /durdu_mu\(yol\)/.test(gt) && /os\.path\.getsize/.test(pyGovde(IZLE, 'durdu_mu') || ''));
  // Basarisiz olan 'baglandi' sayilmiyor; kayit sonradan acilinca
  // bir sonraki tur buluyor.
  bak('★ yalnizca baglanmis dosya atlaniyor',
      /onceki\.get\('durum'\) == 'baglandi'/.test(gt));
}

// ── 5. GOREV ZAMANLAYICI SARMALAYICISI ───────────────────────────
console.log('[threads-izle.bat]');
{
  bak('★ kendi gunlugune yaziyor', /threads-izle\.log/.test(BAT));
  bak('★ story/reels gunlugune DOKUNMUYOR', !/story-izle\.log|reels-izle\.log/.test(BAT));
  bak('★ tek tur kosuyor (--bir-kez)', /threads-izle\.py --bir-kez/.test(BAT));
  // ⛔ BU DOSYA DEPODA DURUYOR: icinde anahtar olamaz.
  bak('★ icinde gizli anahtar yok',
      !/(R2_SECRET|SHOOTBOARD_KEY\s*=|THREADS_TOKEN\s*=)/.test(BAT));
  bak('★ cikis kodu Zamanlayiciya donuyor', /exit \/b %KOD%/.test(BAT));
}

// ── 6. PLATFORM SUZGECI — YANLIS PLATFORMA BAGLANMAZ ─────────────
//
// ⚠ 16 EKIM 2026'DA OLCULDU, VARSAYILMADI. Izleyicinin ilk kosumunda
// klasordeki bir gorselin kaydi henuz yoktu; kaydi_bul TARIHE dustu ve
// 25 Ekim icin ON aday dondurdu: instagram, facebook, youtube, tiktok.
// Hicbiri threads degildi.
//
// O gun zarar olmadi cunku aday BIRDEN COKKEN yukleyici durup soruyor.
// Acik TEK aday halinde: izleyici "demek ki bu" deyip Threads
// gorselini ornegin bir Instagram story kaydina baglar ve politika
// geregi ONUN tikini acardi -- Threads icin hazirlanan gorsel
// Instagram'a story olarak cikardi. Yayin geri alinamaz.
console.log('[platform suzgeci]');
{
  const gd = pyGovde(IZLE, 'dosyayi_isle') || '';
  // Suzgec GERCEKTEN platforma bakiyor -- ve ture de: worker Threads'te
  // yalnizca text_post yayinliyor.
  bak('★ yalnizca threads adaylari aliniyor',
      /platform'\)\s*or\s*''\)\.lower\(\)\s*==\s*'threads'/.test(gd),
      (/platform'\)[^\n]*/.exec(gd) || ['yok'])[0]);
  bak('★ tur de denetleniyor (text_post)',
      /type'\)\s*or\s*''\)\.lower\(\)\s*==\s*'text_post'/.test(gd),
      (/type'\)[^\n]*/.exec(gd) || ['yok'])[0]);
  // ⛔ SUZGECIN SONUCU KULLANILMALI. Listeyi hesaplayip kullanmamak,
  // olcumu gecip arizayi yerinde birakmak olurdu.
  bak('★ suzgecin sonucu kayit listesinin YERINE geciyor',
      /kayitlar = uygun/.test(gd));
  // Hic threads adayi yoksa: hicbir seye baglanmiyor.
  bak('★ threads adayi yoksa bagla(n)miyor',
      /if not uygun:[\s\S]{0,400}return \('kayit-yok'/.test(gd),
      (/if not uygun:[^\n]*/.exec(gd) || ['yok'])[0]);
  // Mesaj NE YAPILACAGINI soyluyor (Bolum 9: sessiz basarisizlik yasak,
  // ama anlasilmaz mesaj da bilgi degil).
  // ⚠ DEGISKENIN ADINI ARAMAK YETMIYOR. Ilk surum /gorulen/ ariyordu;
  // atamayi silen mutasyon GECTI, cunku ad f-string icinde hala
  // duruyordu -- oysa kod calisma aninda NameError veriyordu. Simdi
  // ATAMANIN kendisi araniyor; davranisi threads-izleyici.test.py
  // ayrica olcuyor.
  bak('★ mesaj gorulen platformlari ve ne yapilacagini yaziyor',
      /gorulen = sorted\(\{[\s\S]{0,80}platform/.test(gd)
      && /join\(gorulen\)/.test(gd) && /dosya adini yaz/.test(gd),
      (/gorulen[^\n]*/.exec(gd) || ['yok'])[0]);
  // ⛔ SIRA: suzgec YUKLEMEDEN once. Yanlis gunde R2'ye bayt gitmiyor.
  bak('★ suzgec r2 yuklemesinden ONCE',
      gd.indexOf('uygun = [') > 0 &&
      gd.indexOf('uygun = [') < gd.indexOf('r2_yukle'),
      'suzgec=' + gd.indexOf('uygun = [') + ' r2_yukle=' + gd.indexOf('r2_yukle'));
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
