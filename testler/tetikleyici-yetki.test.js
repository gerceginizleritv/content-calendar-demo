// TETIKLEYICININ CAGIRDIGI ISLEVE UYGULAMANIN YETKISI VAR MI
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR — 6 Ekim 2026, uygulama hicbir seyi kaydedemedi
// ══════════════════════════════════════════════════════════════════
// Takvimde herhangi bir kayit kaydedilince buluta yazma patliyordu:
//
//   [bulut] yazma hatasi
//   code: "42501"  message: "permission denied for function
//   story_yayin_turleri"
//
// Sebep TEK DOSYADA, iki satirin birbirini kesmesiydi (sql/54):
//
//   satir  59: revoke all on function public.story_yayin_turleri()
//              from public, anon, authenticated;
//   satir 153: story_yayin_ani_tazele() tetikleyicisi, govdesinde
//              public.story_yayin_turleri() CAGIRACAK sekilde yazildi.
//
// O tetikleyici calendar_events uzerinde BEFORE INSERT/UPDATE duruyor ve
// `security definer` DEGIL -- yani tarayicinin `authenticated` rolu ile
// calisiyor. Yani her yazma denemesi, yetkisi az once alinmis bir islevi
// cagiriyordu. Onceki surum (sql/53) listeyi govdesinde duz yazi
// tutuyordu; cagri yoktu, sorun da yoktu.
//
// ⚠ HEMEN PATLAMADI. plpgsql planlari baglanti basina onbellekliyor ve
// SQL dilinde yazilmis IMMUTABLE bir islev plana gomulebiliyor
// (gomuldugunde yetki denetimi de planda kalmiyor). Baska bir DDL
// planlari gecersiz kilinca denetim calisti. Yani bu kusur "bir kez
// kostur, gec" ile YAKALANMIYOR: aylar sonra, alakasiz bir degisiklikten
// sonra ortaya cikiyor. Testle yakalanmasinin sebebi bu.
//
// ══════════════════════════════════════════════════════════════════
// NE OLCULUYOR
// ══════════════════════════════════════════════════════════════════
// Kural genel: calendar_events uzerindeki tetikleyici `security definer`
// DEGILSE, govdesinde cagirdigi HER public islev `authenticated` rolune
// acik olmak zorunda. Tetikleyiciye yeni bir cagri eklendiginde ve o
// islev kisitli oldugunda bu dosya duser.
//
// Yetkiler dosya numarasi sirasina gore okunuyor: son soz en yuksek
// numarali dosyanin. (sql/57 sql/54'u duzeltiyor.)
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const sqlYorumsuz = (s)=> s.replace(/--[^\n]*/g, '');

// sql/ dosyalari NUMARA sirasina gore: 9 < 10. Alfabetik siralamak
// "sql/9" dosyasini "sql/10"dan sonraya atardi ve son soz yanlis
// dosyanin olurdu.
const dosyalar = fs.readdirSync(yol.join(KOK, 'sql'))
  .filter(f => f.endsWith('.sql'))
  .map(f => ({ ad: f, no: parseInt((/^(\d+)/.exec(f) || [0, '0'])[1], 10) }))
  .sort((a, b) => a.no - b.no || a.ad.localeCompare(b.ad))
  .map(x => ({ ...x, metin: sqlYorumsuz(fs.readFileSync(yol.join(KOK, 'sql', x.ad), 'utf8')) }));

bak('sql/ dosyalari okundu', dosyalar.length > 0, String(dosyalar.length));

// ── Tetikleyicinin SON surumu ────────────────────────────────────
// En yuksek numarali dosyadaki tanim gecerli olan.
const TETIK = 'story_yayin_ani_tazele';
function govdeAl(metin, ad){
  const i = metin.indexOf('function public.' + ad + '(');
  if(i < 0) return null;
  const son = metin.indexOf('end $$;', i);
  return metin.slice(i, son < 0 ? metin.length : son);
}
let tetikGovde = null, tetikDosya = '';
for(const d of dosyalar){
  const gv = govdeAl(d.metin, TETIK);
  if(gv){ tetikGovde = gv; tetikDosya = d.ad; }
}
console.log('[tetikleyici: ' + TETIK + ']');
bak('son tanim bulundu', !!tetikGovde, tetikDosya);

if(tetikGovde){
  // `security definer` ise sahip yetkisiyle kosuyor, cagirdigi seyin
  // yetkisi onemli degil. DEGILSE kural isliyor.
  const sahipYetkisi = /\bsecurity\s+definer\b/i.test(tetikGovde);
  console.log('  (security definer: ' + sahipYetkisi + ')');

  // Govdedeki public.<ad>( cagrilari. Kendi adi haric.
  const cagrilar = [...new Set(
    [...tetikGovde.matchAll(/\bpublic\.([a-z0-9_]+)\s*\(/gi)].map(m => m[1])
  )].filter(ad => ad !== TETIK);
  bak('çağrılan public işlevler bulundu', cagrilar.length > 0, cagrilar.join(', '));

  for(const ad of cagrilar){
    // Yetkinin SON hali: dosyalar numara sirasinda taranip her
    // revoke/grant uygulaniyor. Varsayilan: PUBLIC'e acik (Postgres
    // yeni islevlere execute'u public'e verir).
    let acik = true, nerede = '(varsayılan)';
    for(const d of dosyalar){
      const satirlar = d.metin.split('\n');
      for(const s of satirlar){
        if(!new RegExp('function\\s+public\\.' + ad + '\\s*\\(').test(s)) continue;
        if(/^\s*revoke\b/i.test(s) && /\b(authenticated|public)\b/.test(s)){
          acik = false; nerede = d.ad;
        }else if(/^\s*grant\b/i.test(s) && /\bauthenticated\b/.test(s)){
          acik = true; nerede = d.ad;
        }
      }
    }
    bak('★ ' + ad + ' → authenticated çalıştırabiliyor',
        sahipYetkisi || acik,
        acik ? nerede : 'son söz: ' + nerede + ' (revoke) — uygulama KAYDEDEMEZ');
  }
}

// ── sql/54 tuzagi ────────────────────────────────────────────────
// sql/54 kuyrugun ESKI surumunu de tanimliyor. Yeniden kosturmak
// sql/55 ve sql/56'yi geri alir -- hicbir hata vermeden. Uyarinin
// dosyada DURDUGU olculuyor; silinmesi tek satirlik bir is.
console.log('[sql/54 — yeniden koşturma uyarısı]');
{
  const ham = fs.readFileSync(yol.join(KOK, 'sql/54-yayin-turleri-tek-yer.sql'), 'utf8');
  bak('kuyruğun eski sürümü hâlâ bu dosyada (uyarı gerekli)',
      /drop function if exists public\.story_kuyruk_al/.test(sqlYorumsuz(ham)));
  bak('★ uyarı duruyor', /YENİDEN KOŞTURMA/.test(ham));
}

console.log('\n' + g + ' gecti, ' + k + ' kaldi');
process.exit(k ? 1 : 0);
