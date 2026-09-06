const { chromium } = require('./araclar');
const KOK = 'http://127.0.0.1:8098/';
let gecen = 0, kalan = 0;
function ok(ad, kosul, ek){ if(kosul){ gecen++; console.log('  ok  ', ad); } else { kalan++; console.log('  YOK ', ad, ek===undefined?'':'→ '+ek); } }

// Sahte supabase-js: gercek CDN sandbox'ta engelli, ayrica giris akisini
// tarayicidan cikmadan sinamak istiyoruz.
const SAHTE = `
window.__cagri = [];
window.supabase = {
  createClient: function(){
    var dinleyici = null;
    var oturum = window.__oturum || null;
    return {
      auth: {
        getSession: function(){ return Promise.resolve({ data: { session: oturum } }); },
        onAuthStateChange: function(f){ dinleyici = f; return { data:{ subscription:{ unsubscribe:function(){} } } }; },
        signInWithOAuth: function(o){ window.__cagri.push(['oauth', o]); return Promise.resolve({ error:null }); },
        signInWithOtp: function(o){ window.__cagri.push(['otp', o]); return Promise.resolve({ error:null }); },
        signOut: function(){ oturum = null; window.__cagri.push(['signout']); return Promise.resolve({}); }
      }
    };
  }
};
`;

async function sayfa(b, ayar = {}) {
  const p = await b.newPage({ viewport: ayar.viewport || {width:1280,height:900}, colorScheme: ayar.tema || 'light' });
  p.hatalar = [];
  p.on('pageerror', e => p.hatalar.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if(m.type()==='error' && !/ERR_|404|Failed to load resource/.test(m.text())) p.hatalar.push('CONSOLE: '+m.text()); });
  // CDN'leri kes: fontlar bos, supabase sahte
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
  await p.route('**/supabase-js**', r => r.fulfill({ status:200, contentType:'application/javascript', body: SAHTE }));
  if(ayar.oturum) await p.addInitScript(`window.__oturum = ${JSON.stringify(ayar.oturum)};`);
  if(ayar.dil) await p.addInitScript(`try{localStorage.setItem('demo_ui_language','${ayar.dil}');}catch(e){}`);
  if(ayar.kayitliTema) await p.addInitScript(`try{localStorage.setItem('demo_theme','${ayar.kayitliTema}');}catch(e){}`);
  return p;
}

(async () => {
  const b = await chromium.launch({ });

  // ---- 1. Varsayilan Ingilizce ----
  console.log('\n1. Varsayilan dil');
  {
    const p = await sayfa(b);
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(400);
    ok('h1 Ingilizce', (await p.textContent('h1')).includes('One shoot becomes ten posts'));
    ok('dil dugmesi EN', (await p.textContent('#dilDug')).trim() === 'EN');
    ok('html lang=en', await p.getAttribute('html','lang') === 'en');
    ok('konsol temiz', p.hatalar.length === 0, p.hatalar.join(' | '));
    await p.close();
  }

  // ---- 2. Dil dugmesi ----
  console.log('\n2. Dil degistirme');
  {
    const p = await sayfa(b);
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(300);
    await p.click('#dilDug');
    await p.waitForTimeout(200);
    ok('h1 Turkce', (await p.textContent('h1')).includes('Tek çekim on paylaşıma'));
    ok('dugme TR', (await p.textContent('#dilDug')).trim() === 'TR');
    ok('html lang=tr', await p.getAttribute('html','lang') === 'tr');
    ok('kalin etiket korundu (innerHTML)', (await p.innerHTML('[data-i18n-html="what_p1"]')).includes('<strong>'));
    ok('SVG metni cevrildi', (await p.textContent('[data-i18n="g1a"]')) === 'birleştir');
    ok('placeholder cevrildi', await p.getAttribute('#ePosta','placeholder') === 'ad@ornek.com');
    ok('localStorage tr', await p.evaluate(()=>localStorage.getItem('demo_ui_language')) === 'tr');
    // geri don
    await p.click('#dilDug');
    await p.waitForTimeout(200);
    ok('geri Ingilizce', (await p.textContent('h1')).includes('One shoot becomes ten posts'));
    ok('kalin etiket geri geldi', (await p.innerHTML('[data-i18n-html="what_p1"]')).includes('<strong>'));
    ok('placeholder geri geldi', await p.getAttribute('#ePosta','placeholder') === 'you@example.com');
    ok('konsol temiz', p.hatalar.length === 0, p.hatalar.join(' | '));
    await p.close();
  }

  // ---- 3. Uygulamadan gelen dil secimi ----
  console.log('\n3. Uygulamayla ortak dil anahtari');
  {
    const p = await sayfa(b, { dil:'tr' });
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(300);
    ok('kayitli tr ile aciliyor', (await p.textContent('h1')).includes('Tek çekim'));
    await p.close();
  }

  // ---- 4. Tema ----
  console.log('\n4. Tema');
  {
    const p = await sayfa(b);
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(300);
    ok('basta data-theme yok', await p.getAttribute('html','data-theme') === null);
    await p.click('#temaDug');
    await p.waitForTimeout(200);
    ok('koyuya gecti', await p.getAttribute('html','data-theme') === 'dark');
    ok('localStorage dark', await p.evaluate(()=>localStorage.getItem('demo_theme')) === 'dark');
    ok('theme-color guncellendi', await p.getAttribute('meta[name="theme-color"]','content') === '#0F151D');
    const zemin = await p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
    ok('govde zemini koyu', zemin === 'rgb(15, 21, 29)', zemin);
    await p.close();
  }
  {
    const p = await sayfa(b, { kayitliTema:'dark' });
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    ok('kayitli tema ilk boyamada uygulandi', await p.getAttribute('html','data-theme') === 'dark');
    await p.close();
  }

  // ---- 5. Ozellik baglantilari ----
  console.log('\n5. Ozellik dizini baglantilari');
  {
    const p = await sayfa(b);
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(300);
    const kart = await p.$$('.dizin-kart');
    ok('dokuz kart var', kart.length === 9, kart.length);
    let hepsiVar = true, eksik = [];
    for(const k of kart){
      const h = await k.getAttribute('href');
      const hedef = await p.$(h);
      if(!hedef){ hepsiVar = false; eksik.push(h); }
    }
    ok('her kartin hedefi var', hepsiVar, eksik.join(','));
    // tiklayinca gercekten kayiyor mu
    await p.click('.dizin-kart[href="#o05"]');
    await p.waitForTimeout(700);
    const ust = await p.evaluate(()=>document.getElementById('o05').getBoundingClientRect().top);
    ok('05 bolumu ekrana geldi', ust > -5 && ust < 200, ust);
    await p.close();
  }

  // ---- 6. Uygulama baglantilari ----
  console.log('\n6. app.html baglantilari');
  {
    const p = await sayfa(b);
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    // Buyuk dugmeler artik dogrudan uygulamaya degil giris/kayit kartina
    // gidiyor (#giris). Uygulamaya "hesapsiz devam" baglantilari kaldi.
    const hrefler = await p.$$eval('a[href="app.html"]', a => a.length);
    ok('app.html baglantilari var', hrefler >= 2, hrefler);
    const giris = await p.$$eval('a[href="#giris"]', a => a.length);
    ok('buyuk dugmeler girise goturuyor', giris >= 2, giris);
    const yanit = await p.goto(KOK + 'app.html', { waitUntil:'domcontentloaded' });
    ok('app.html aciliyor', yanit.status() === 200);
    await p.close();
  }

  // ---- 7. Giris: e-posta linki ----
  console.log('\n7. Giris — e-posta linki');
  {
    const p = await sayfa(b);
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(400);
    ok('form gorunur', await p.isVisible('#girisFormu'));
    ok('oturum bloku gizli', !(await p.isVisible('#acikOturum')));
    // Kart artik iki sekmeli aciliyor ve "Kayit ol" onde. E-posta ile
    // giris "Giris yap" sekmesinde.
    await p.click('#sekmeGiris');
    await p.waitForTimeout(150);
    ok('giris sekmesi acildi', await p.isVisible('#ePosta'));
    // gecersiz adres
    await p.fill('#ePosta','abc');
    await p.click('#linkDug');
    await p.waitForTimeout(200);
    ok('gecersiz adres uyarisi', (await p.textContent('#girisDurum')).includes("doesn't look right"));
    ok('cagri yapilmadi', (await p.evaluate(()=>window.__cagri.length)) === 0);
    // gecerli adres
    await p.fill('#ePosta','biri@ornek.com');
    await p.click('#linkDug');
    await p.waitForTimeout(300);
    const c = await p.evaluate(()=>window.__cagri);
    ok('otp cagrildi', c.length === 1 && c[0][0] === 'otp');
    ok('adres dogru', c[0][1].email === 'biri@ornek.com');
    ok('donus adresi karsilama sayfasi', /\/index\.html$|\/$/.test(c[0][1].options.emailRedirectTo), c[0][1].options.emailRedirectTo);
    ok('gonderildi mesaji', (await p.textContent('#girisDurum')).includes('Link sent'));
    await p.close();
  }

  // ---- 8. Giris: Google ----
  console.log('\n8. Giris — Google');
  {
    const p = await sayfa(b);
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(400);
    ok('kayit sekmesinde de Google var', await p.isVisible('#googleKayitDug'));
    await p.click('#sekmeGiris');
    await p.waitForTimeout(150);
    await p.click('#googleDug');
    await p.waitForTimeout(300);
    const c = await p.evaluate(()=>window.__cagri);
    ok('oauth cagrildi', c.length === 1 && c[0][0] === 'oauth');
    ok('saglayici google', c[0][1].provider === 'google');
    ok('donus bayragi kondu', (await p.evaluate(()=>sessionStorage.getItem('slate_giris_donus'))) === '1');
    await p.close();
  }

  // ---- 9. Oturum acikken karsilama sayfasi ----
  console.log('\n9. Oturum acikken');
  {
    const p = await sayfa(b, { oturum: { user: { email:'kisi@ornek.com' } } });
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(500);
    ok('uygulamaya ZORLA gonderilmedi', p.url().indexOf('app.html') === -1, p.url());
    ok('oturum bloku gorunur', await p.isVisible('#acikOturum'));
    ok('form gizli', !(await p.isVisible('#girisFormu')));
    ok('e-posta yazili', (await p.textContent('#oturumEposta')) === 'kisi@ornek.com');
    await p.click('#cikisDug');
    await p.waitForTimeout(300);
    ok('cikis sonrasi form geri geldi', await p.isVisible('#girisFormu'));
    await p.close();
  }

  // ---- 10. Girisden donunce uygulamaya gecis ----
  console.log('\n10. Girisden donus');
  {
    const p = await sayfa(b, { oturum: { user: { email:'kisi@ornek.com' } } });
    await p.goto(KOK + '#access_token=sahte&type=magiclink', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(900);
    ok('app.html acildi', p.url().indexOf('app.html') !== -1, p.url());
    await p.close();
  }
  {
    // OAuth: adres cubugu temiz ama bayrak var
    const p = await sayfa(b, { oturum: { user: { email:'kisi@ornek.com' } } });
    await p.addInitScript(`try{sessionStorage.setItem('slate_giris_donus','1');}catch(e){}`);
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(900);
    ok('bayrakla da app.html acildi', p.url().indexOf('app.html') !== -1, p.url());
    await p.close();
  }

  // ---- 11. Bulut yuklenemezse ----
  console.log('\n11. Bulut kutuphanesi yuklenemezse');
  {
    const p = await b.newPage();
    p.hatalar = [];
    p.on('pageerror', e => p.hatalar.push(e.message));
    await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
    await p.route('**/supabase-js**', r => r.abort());
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(500);
    ok('sayfa yine de calisiyor', (await p.textContent('h1')).length > 10);
    ok('dugmeler kapali', await p.isDisabled('#googleDug') && await p.isDisabled('#linkDug'));
    ok('sebep yazildi', (await p.textContent('#girisDurum')).includes('cloud connection'));
    ok('js hatasi yok', p.hatalar.length === 0, p.hatalar.join(' | '));
    await p.close();
  }

  // ---- 12. Yatay tasma ----
  console.log('\n12. Yerlesim');
  for(const [ad, w, h] of [['masaustu',1280,900],['tablet',820,1100],['telefon',390,844]]){
    const p = await sayfa(b, { viewport:{width:w,height:h} });
    await p.goto(KOK, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(400);
    const tasma = await p.evaluate(()=>document.documentElement.scrollWidth - window.innerWidth);
    ok(ad + ' yatay tasma yok', tasma <= 1, tasma);
    await p.close();
  }

  await b.close();
  console.log('\n=== gecen ' + gecen + ' / kalan ' + kalan + ' ===');
  process.exit(kalan ? 1 : 0);
})();
