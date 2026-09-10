// Karsilama sayfasinda olcum. "Kac kisi geldi, kaci uygulamaya gecti"
// sorusunun cevabi burasi olmadan yoktu: sayac yalnizca app.html'e
// bagliydi. Test gercek GoatCounter'a gitmiyor — count.js'i sahte bir
// nesneyle degistirip HANGI olaylarin atildigina bakiyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

async function sayfaAc(t, genislik){
  const p = await (await t.newContext({ viewport:{width:genislik||1280,height:900} })).newPage();
  // Disariya cikan her sey kesiliyor: sayac da, Supabase de.
  await p.route('**gc.zgo.at**', r=> r.abort());
  await p.route('**goatcounter.com**', r=> r.abort());
  await p.route('**supabase.co**', r=> r.abort());
  // Sahte sayac: count.js yerine, atilan olaylari toplayan bir nesne.
  await p.addInitScript(()=>{
    window.__olaylar = [];
    window.goatcounter = { count: function(o){ window.__olaylar.push(o && o.path); } };
  });
  await p.goto(KOK + '/index.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(900);
  return p;
}
const olaylar = p => p.evaluate(()=> window.__olaylar.slice());

(async () => {
  const t = await chromium.launch();

  console.log('[sayac sayfaya bagli]');
  const ham = await (await fetch(KOK + '/index.html')).text();
  bak('GoatCounter betigi index.html icinde',
      /data-goatcounter="https:\/\/slate-demo\.goatcounter\.com\/count"/.test(ham));
  bak('count.js cagriliyor', /gc\.zgo\.at\/count\.js/.test(ham));

  console.log('[uygulamaya gecis olcuuluyor]');
  let p = await sayfaAc(t);
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  bak('acilista bosuna olay atilmiyor', (await olaylar(p)).length === 0, (await olaylar(p)).join(','));
  // "Hesapsiz devam et": hem misafir hem uygulamaya gecis sayilmali.
  await p.evaluate(()=>{ document.querySelector('a[data-i18n="guest_link"]').click(); });
  await p.waitForTimeout(100);
  let o = await olaylar(p);
  bak('misafir girisi ayrica sayiliyor', o.includes('funnel/landing-guest'), o.join(','));
  bak('uygulamaya gecis sayiliyor', o.includes('funnel/landing-to-app'), o.join(','));
  bak('gidis hemen olmadi (olay yolda kalmasin)',
      p.url().indexOf('/index.html') !== -1, p.url());
  await p.waitForTimeout(400);
  bak('sonra uygulamaya gidildi', p.url().indexOf('/app.html') !== -1, p.url());
  await p.close();

  console.log('[sayfa ici caparlar geciktirilmiyor]');
  p = await sayfaAc(t);
  await p.evaluate(()=>{ document.querySelector('a[href="#giris"]').click(); });
  await p.waitForTimeout(150);
  o = await olaylar(p);
  bak('giris bolumu acildi olayi', o.includes('funnel/landing-signin-opened'), o.join(','));
  bak('sayfa degismedi', p.url().indexOf('/index.html') !== -1, p.url());

  console.log('[okundu mu]');
  await p.evaluate(()=> window.scrollTo(0, window.innerHeight * 2));
  await p.waitForTimeout(300);
  o = await olaylar(p);
  bak('asagi inince okundu sayiliyor', o.includes('funnel/landing-scrolled'), o.join(','));
  await p.evaluate(()=> window.scrollTo(0, window.innerHeight * 3));
  await p.waitForTimeout(250);
  o = await olaylar(p);
  bak('bir kez atiliyor', o.filter(x=> x === 'funnel/landing-scrolled').length === 1, o.join(','));

  console.log('[kilavuz baglantisi]');
  await p.evaluate(()=> window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(200);
  await p.evaluate(()=>{ document.getElementById('dipKilavuz').click(); });
  await p.waitForTimeout(100);
  o = await olaylar(p);
  bak('kilavuza gidis sayiliyor', o.includes('funnel/landing-guide'), o.join(','));
  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  await p.close();

  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
