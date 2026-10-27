// Testlerin ortak takozu: Playwright'i ve tarayiciyi NEREDE bulacagini
// bilen tek yer. Onceden her testin ilk satirinda bu makinedeki mutlak
// yollar yaziliydi; depoya alinca baska bir bilgisayarda hicbiri
// calismazdi.
//
// Sirasiyla bakiyor:
//   1. PLAYWRIGHT_YOLU / KROM_YOLU cevre degiskenleri (elle isaret etmek icin)
//   2. depodaki node_modules (npm i -D playwright yapildiysa)
//   3. sistemdeki bilinen kurulum yerleri
const fs = require('fs');
const path = require('path');

function ilkVarOlan(adaylar){
  for(const a of adaylar){ try{ if(a && fs.existsSync(a)) return a; }catch(e){} }
  return '';
}

function playwrightYukle(){
  if(process.env.PLAYWRIGHT_YOLU) return require(process.env.PLAYWRIGHT_YOLU);
  try{ return require('playwright'); }catch(e){}
  const yol = ilkVarOlan([
    '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright',
    '/usr/local/lib/node_modules/playwright'
  ]);
  if(yol) return require(yol);
  throw new Error('Playwright bulunamadi. "npm i -D playwright" ya da PLAYWRIGHT_YOLU=... ');
}

// Tarayici: cevre degiskeni > PLAYWRIGHT_BROWSERS_PATH altindaki chromium
// klasoru > Playwright'in kendi buldugu (bos birakiliyor).
function kromYolu(){
  if(process.env.KROM_YOLU) return process.env.KROM_YOLU;
  const kok = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try{
    const klasorler = fs.readdirSync(kok).filter(x=> x.indexOf('chromium') === 0).sort();
    for(let i = klasorler.length - 1; i >= 0; i--){
      const aday = ilkVarOlan([
        path.join(kok, klasorler[i], 'chrome-linux', 'chrome'),
        path.join(kok, klasorler[i], 'chrome-mac', 'Chromium.app/Contents/MacOS/Chromium'),
        path.join(kok, klasorler[i], 'chrome-win', 'chrome.exe')
      ]);
      if(aday) return aday;
    }
  }catch(e){}
  return ilkVarOlan([kok + '/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser']);
}

const gercek = playwrightYukle();
const krom = kromYolu();

// GEZINME ZAMAN ASIMI -- NEDEN TEK YERDEN YUKSELTILDI.
// 27 Ekim 2026: ayni commit'in (988fbb8) iki CI kosusunda IKI AYRI test
// kaldi -- mobil-alt-menu "page.goto: Timeout 30000ms", mekan-gorsel
// "page.reload: Timeout 30000ms". Ayni agac push kosusunda yesildi, iki
// test de yerelde ve ayni sabahin gece kosusunda geciyordu. Yani kod
// dogruydu, olcum kaldi.
//
// Sebep olculdu, tahmin degil: CI kosucusu bu testleri ~4 kat yavas
// kosuyor.
//     mekan-gorsel      yerel  5sn   CI 28sn
//     mobil-alt-menu    yerel 19sn   CI 44sn
// Playwright'in varsayilan gezinme tavani 30 saniye; 1,1 MB'lik app.html
// yuklu bir kosucuda bu sinira dayaniyor.
//
// ⛔ BU BIR TESTI ATLAMAK DEGIL. Gercekten acilmayan bir sayfa yine
// kaliyor, yalnizca daha gec. Hicbir test devre disi birakilmadi.
// Tavani kucultmek testi hizlandirmaz, yalnizca kirilgan yapar.
const GEZINME_TAVANI_MS = Number(process.env.GEZINME_TAVANI_MS) || 60000;
exports.GEZINME_TAVANI_MS = GEZINME_TAVANI_MS;

// Tavan sayfaya ya da baglama konuluyor: baglama konuldugunda ondan
// dogan sayfalar da devraliyor.
function tavanKoy(nesne){
  try{ nesne.setDefaultNavigationTimeout(GEZINME_TAVANI_MS); }catch(e){}
  return nesne;
}

// Tarayici nesnesinin newContext'i sarmalaniyor: testlerin icinde tek
// satir degismiyor, acilan her sayfa tavani aliyor.
//
// newPage AYRICA sarilmiyor, cunku Playwright'in browser.newPage()'i
// iceride kendi newContext()'ini cagiriyor -- yani bu sarmaldan geciyor
// ve ayrica sarmak OLU KOD olur. Mutasyon testi bunu boyle buldu:
// newPage sarmalini kaldiran mutasyon yakalanamadi, cunku davranis
// gercekten degismiyordu.
//
// ⚠ Bu bir Playwright IC AYRINTISINA yaslaniyor. Varsayimi testin
// [newPage] bolumu civiliyor: Playwright bir gun devretmeyi birakirsa o
// bolum "metinde 1500 yaziyor" diye kalir ve haber verir.
function tarayiciyiSar(t){
  const baglam = t.newContext.bind(t);
  t.newContext = async function(secenek){ return tavanKoy(await baglam(secenek)); };
  return t;
}

// Testler `chromium.launch({...})` diye cagiriyor; yol burada ekleniyor,
// testlerin icinde yazmiyor.
exports.chromium = {
  async launch(secenek){
    const s = Object.assign({}, secenek || {});
    if(krom && !s.executablePath) s.executablePath = krom;
    return tarayiciyiSar(await gercek.chromium.launch(s));
  },
  async launchPersistentContext(dizin, secenek){
    const s = Object.assign({}, secenek || {});
    if(krom && !s.executablePath) s.executablePath = krom;
    return tavanKoy(await gercek.chromium.launchPersistentContext(dizin, s));
  }
};
exports.devices = gercek.devices;

// Telefonda seridin ikincil baglantilari "..." dugmesinin actigi alt
// sayfada duruyor. Masaustunde dogrudan gorunuyorlar, o yuzden dugme de
// yok. Test bir serit baglantisina basmadan once bunu cagiriyor:
// genisligi bilmesine gerek kalmiyor.
exports.menuAc = async function(page){
  const dug = await page.$('#railMoreBtn');
  if(!dug) return false;
  if(!(await dug.isVisible())) return false;
  const serit = await page.$('#railFoot');
  if(serit && await serit.evaluate(e=> e.classList.contains('acik'))) return true;
  await dug.click();
  await page.waitForTimeout(300);
  return true;
};
// Depo koku: testler app.html'i diskten okurken kullaniyor.
exports.KOK = path.resolve(__dirname, '..');

// ORNEKSIZ BASLANGIC.
// Uygulama ilk acilista ornek kayit, proje ve mekan kuruyor (ornek-veri
// testi bunu olcuyor). Bos liste bekleyen testler icin o kurulum gurultu:
// "mekan listesi bos" diyen bir olcum, ekranda ornek mekan dururken
// dogru olamaz.
//
// Bu takoz ornekleri "zaten kaldirilmis" sayiyor -- kurulumu bastiran
// gercek bayrak da bu. Testin kendi durumunu acikca kurmasini sagliyor;
// ornekleri ISTEYEN test bunu cagirmiyor.
//
//   await p.addInitScript(ORNEKSIZ);   // goto'dan ONCE
exports.ORNEKSIZ = `try{ localStorage.setItem('demo_ornek_kaldirildi','1'); }catch(e){}`;
