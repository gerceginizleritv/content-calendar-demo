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

// Testler `chromium.launch({...})` diye cagiriyor; yol burada ekleniyor,
// testlerin icinde yazmiyor.
exports.chromium = {
  launch(secenek){
    const s = Object.assign({}, secenek || {});
    if(krom && !s.executablePath) s.executablePath = krom;
    return gercek.chromium.launch(s);
  },
  launchPersistentContext(dizin, secenek){
    const s = Object.assign({}, secenek || {});
    if(krom && !s.executablePath) s.executablePath = krom;
    return gercek.chromium.launchPersistentContext(dizin, s);
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
