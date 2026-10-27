// GEZINME TAVANI — araclar.js'teki tek merkez gercekten uyguluyor mu?
//
// 27 Ekim 2026: ayni commit'in iki CI kosusunda iki AYRI test yalnizca
// "Timeout 30000ms exceeded" ile kaldi; kod dogruydu, CI kosucusu ~4 kat
// yavasti. araclar.js acilan her sayfaya tek yerden tavan koyuyor.
//
// Bu test tavanin KONULDUGUNU 30 saniye bekleyerek degil, tavani kucuk
// bir degere cekip HATA METNINDEKI sayiyi okuyarak olcuyor: "Timeout
// 1500ms exceeded" yaziyorsa bizim degerimiz uygulanmis demektir. Metin
// 30000 derse tavan hic konulmamis.
process.env.GEZINME_TAVANI_MS = '1500';
const { chromium, GEZINME_TAVANI_MS } = require('./araclar');
const { execFileSync } = require('child_process');

let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); }
                            else { k++; console.log('  YOK '+ad+(ek!==undefined?' -> '+ek:'')); } };

// Asla cevap vermeyen bir adres: istek tarayicida yakalaniyor, aga hic
// cikmiyor. Yani test ne sunucuya ne de aga bagli.
async function takilanGezinme(sayfa){
  await sayfa.route('**/asla', ()=>{});
  const basladi = Date.now();
  let hata = null;
  try { await sayfa.goto('http://sahte.test/asla'); }
  catch(e){ hata = e; }
  return { hata, surdu: Date.now() - basladi };
}

(async () => {
  console.log('[deger]');
  bak('cevre degiskeni okunuyor', GEZINME_TAVANI_MS === 1500, GEZINME_TAVANI_MS);

  // Varsayilan degeri AYRI bir surecte okuyoruz: bu surecte degisken
  // zaten kurulu, buradan varsayilan gorunmez.
  const varsayilan = Number(execFileSync(process.execPath,
    ['-e', "process.env.GEZINME_TAVANI_MS='';console.log(require('./araclar').GEZINME_TAVANI_MS)"],
    { cwd: __dirname, env: Object.assign({}, process.env, { GEZINME_TAVANI_MS: '' }) }
  ).toString().trim());
  bak('varsayilan 60 saniye', varsayilan === 60000, varsayilan);
  bak('varsayilan Playwright\'in 30 saniyesinden yuksek', varsayilan > 30000, varsayilan);

  const t = await chromium.launch();

  console.log('[newPage]');
  {
    const s = await t.newPage();
    const { hata, surdu } = await takilanGezinme(s);
    bak('takilan gezinme hata veriyor', !!hata);
    bak('hata zaman asimi', hata && hata.name === 'TimeoutError', hata && hata.name);
    bak('TAVAN BIZIM DEGERIMIZ (metinde 1500 yaziyor)',
        !!hata && /1500ms/.test(hata.message), hata && hata.message.split('\n')[0]);
    bak('30000 YAZMIYOR (tavan konulmus)',
        !!hata && !/30000ms/.test(hata.message), hata && hata.message.split('\n')[0]);
    bak('30 saniye beklemedi', surdu < 10000, surdu + 'ms');
    await s.close();
  }

  console.log('[newContext -> newPage]');
  {
    const b = await t.newContext();
    const s = await b.newPage();
    const { hata } = await takilanGezinme(s);
    bak('baglamdan dogan sayfa da tavani devraldi',
        !!hata && /1500ms/.test(hata.message), hata && hata.message.split('\n')[0]);
    await b.close();
  }

  console.log('[normal gezinme bozulmadi]');
  {
    const s = await t.newPage();
    await s.route('**/tamam', r=> r.fulfill({ status:200, contentType:'text/html',
                                              body:'<!doctype html><title>T</title><p id=x>tamam' }));
    await s.goto('http://sahte.test/tamam');
    bak('sayfa normal yukleniyor', (await s.textContent('#x')) === 'tamam');
    await s.close();
  }
  await t.close();

  console.log('[launchPersistentContext]');
  {
    const dizin = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'gt-'));
    const b = await chromium.launchPersistentContext(dizin, {});
    const s = await b.newPage();
    const { hata } = await takilanGezinme(s);
    bak('kalici baglamda da tavan var',
        !!hata && /1500ms/.test(hata.message), hata && hata.message.split('\n')[0]);
    await b.close();
    require('fs').rmSync(dizin, { recursive:true, force:true });
  }

  console.log('\n'+g+' gecti, '+k+' kaldi');
  process.exit(k ? 1 : 0);
})();
