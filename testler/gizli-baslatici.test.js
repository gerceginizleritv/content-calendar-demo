// GIZLI BASLATICI — PENCERE KAPANDI DIYE ARIZA KAPANMASIN
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR
// ══════════════════════════════════════════════════════════════════
// 17 Ekim 2026: uc izleyici gorevi bes dakikada bir kosuyor ve her
// kosuda bir cmd.exe penceresi one firliyordu. Kullanicinin sozleri:
// "ben cekim yaparken surekli elimin altinda ekrana cikiyor".
// Cozum pc/gizli-calistir.vbs: .bat'i gizli pencerede calistiriyor.
//
// ⚠ BU DEGISIKLIGIN TEHLIKESI GORUNURLUGU KAYBETMEK.
// Pencere zaten tanisik bir isaretti: aksam hic acilmadiysa gorev
// kosmuyordu. Onu kapatiyoruz. Geriye iki gozlem yeri kaliyor ve
// IKISI DE kolayca sessizce bozulabilir:
//
//   1. Gorev Zamanlayici'nin "Last Run Result" sutunu. Sarmalayici
//      Run(..., 0, False) yazsaydi ya da WScript.Quit'i atlasaydi,
//      gorev HER KOSUYU 0x0 (basarili) gosterirdi -- izleyici
//      aylarca patlasa bile. Yalanci yesil, hic isiktan daha kotu.
//   2. .bat'lerin kendi gunlukleri. Pencere gizlenince tek okunur
//      kayit onlar; bir .bat gunlugu yazmayi birakirsa ariza hicbir
//      yerde gorunmez olur.
//
// Bu dosya ikisini de olcuyor. Olculen sey DAVRANIS DEGIL KAYNAK:
// VBScript burada kosturulamiyor (Windows gerekir), bu yuzden
// sarmalayicinin verdigi sozler metinden okunuyor.
//
// ⚠ YORUMLAR ATILIYOR. Bu dosyalarin yorumlari uzun ve icinde
// "cikis kodu", "0x0", "gizli" gibi ifadeler geciyor; yorum uzerinden
// eslesen bir olcum, kod silinse bile yesil kalirdi.
const fs = require('fs');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (p)=> fs.readFileSync(yol.join(KOK, p), 'utf8');

// VBScript yorumu: satir basindaki tek tirnak.
const vbsKodu = (s)=> s.split('\n').filter(r=> !/^[ \t]*'/.test(r)).join('\n');

const HAM = oku('pc/gizli-calistir.vbs');
const VBS = vbsKodu(HAM);

const BATLAR = ['threads-izle.bat', 'story-izle.bat', 'reels-izle.bat'];

// ── 1. PENCERE GERCEKTEN GIZLI ───────────────────────────────────
console.log('[pencere gizli]');
{
  const cagri = VBS.match(/\.Run\s*\(([^)]*)\)/);
  bak('Run cagrisi var', !!cagri);
  if(cagri){
    const arg = cagri[1].split(',').map(s=> s.trim());
    bak('pencere stili 0 (gorunmez)', arg[1] === '0', 'stil: ' + arg[1]);
  }
}

// ── 2. ARIZA GORUNUR KALIYOR ─────────────────────────────────────
// Bu bolum kapinin kendisi: sarmalayici beklemezse ya da kodu geri
// vermezse Gorev Zamanlayici her kosuyu basarili gosterir.
console.log('[ariza gorunur kaliyor]');
{
  const cagri = VBS.match(/\.Run\s*\(([^)]*)\)/);
  if(cagri){
    const arg = cagri[1].split(',').map(s=> s.trim());
    bak('bitmesini bekliyor (True)', /^true$/i.test(arg[2] || ''), 'bekleme: ' + arg[2]);
  }
  // Donen kod bir degiskene alinip Quit'e verilmeli. `kabuk.Run ...`
  // seklinde (atamasiz) yazilsaydi kod hic okunmazdi.
  const atama = VBS.match(/(\w+)\s*=\s*\w+\.Run\s*\(/);
  bak('donen kod bir degiskene aliniyor', !!atama);
  if(atama){
    const d = atama[1];
    bak('ayni degisken WScript.Quit ile donuyor',
        new RegExp('WScript\\.Quit\\s+' + d + '\\b').test(VBS));
  }
  // Sabit sifirla cikmak en sinsi mutasyon: her sey calisiyor
  // gorunur, hicbir ariza yukari ulasmaz.
  bak('sabit sifirla cikilmiyor', !/WScript\.Quit\s+0\b/.test(VBS));
}

// ── 3. DOSYA VERILMEZSE SESSIZ BASARI YOK ────────────────────────
console.log('[bos cagri sessizce gecmiyor]');
{
  const dal = VBS.match(/If\s+WScript\.Arguments\.Count\s*=\s*0\s+Then([\s\S]*?)End If/i);
  bak('argumansiz cagri icin dal var', !!dal);
  if(dal) bak('o dal sifirdan farkli bir kodla cikiyor',
              /WScript\.Quit\s+[1-9]/.test(dal[1]), dal[1].trim());
}

// ── 4. BOSLUKLU YOL BOZULMUYOR ───────────────────────────────────
// "E:\CLAUDE VIDEOS\..." gibi bir yol tirnaksiz gecirilirse cmd onu
// iki ayri arguman sanar ve is sessizce yanlis dosyayi arar.
console.log('[bosluklu yol]');
{
  bak('calistirilacak dosya tirnak icine aliniyor', /"""" & WScript\.Arguments\(0\) & """"/.test(VBS));
  bak('ek argumanlar da tirnaklaniyor', /For\s+i\s*=\s*1\s+To\s+WScript\.Arguments\.Count\s*-\s*1/i.test(VBS));
}

// ── 5. GUNLUKLER TEK GOZLEM YERI, UCUNDE DE DURUYOR ──────────────
// Pencere gizlendigi icin bu dosyalar artik tek okunur iz.
console.log('[gunlukler duruyor]');
for(const b of BATLAR){
  const m = oku('pc/' + b).split('\n').filter(r=> !/^\s*rem\b/i.test(r)).join('\n');
  bak(b + ' gunluge yaziyor', /%PY%[^\n]*>>"%GUNLUK%"/.test(m));
  bak(b + ' cikis kodunu geri veriyor', /exit\s*\/b\s*%KOD%/i.test(m));
}

// ── 6. ANAHTAR YOK ───────────────────────────────────────────────
// Sarmalayici depoya giriyor; icine anahtar sizarsa herkese acilir.
console.log('[anahtar yok]');
{
  // Isimler KODDA aranıyor, yorumda degil: "bu dosyada anahtar yok"
  // diyen bir yorum satiri sizinti degil, tam tersi.
  for(const ad of ['SHOOTBOARD_KEY', 'R2_SECRET', 'R2_ACCESS', 'SERVICE_ROLE'])
    bak(ad + ' kodda gecmiyor', !VBS.includes(ad));
  // Deger gibi gorunen seyler DOSYANIN TAMAMINDA aranıyor: bir
  // anahtar yanlislikla yoruma yapistirilsa da yakalansin.
  bak('jeton gibi bir dizge yok', !/eyJ[A-Za-z0-9_-]{10}/.test(HAM));
  bak('uzun gizli gibi bir dizge yok', !/["'][A-Za-z0-9_\-]{32,}["']/.test(HAM));
}

// ── 7. SADE ASCII ────────────────────────────────────────────────
// wscript dosyayi sistem kod sayfasiyla okuyor; UTF-8 Turkce karakter
// sozdizimi hatasi verdirebiliyor ve gorev hic kosmaz.
console.log('[sade ascii]');
{
  const disi = [...HAM].filter(c=> c.charCodeAt(0) > 126);
  bak('ASCII disi karakter yok', disi.length === 0, disi.slice(0,5).join(' '));
}

console.log('\ngecti: ' + g + '   kaldi: ' + k);
process.exit(k ? 1 : 0);
