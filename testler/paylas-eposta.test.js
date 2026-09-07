// Salt-okunur baglantiyi kopyala-yapistir yerine dogrudan yollamak.
// Posta KULLANICININ kendi adresinden gidiyor: alan kisi tanidigi bir
// adresten aliyor, biz kimsenin adina posta gondermiyoruz ve alan adimiz
// bir gonderim listesine dusmuyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
const UID = '11111111-1111-1111-1111-111111111111';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const SB = `window.supabase={createClient(){return {
  auth:{ getSession:()=>Promise.resolve({data:{session: window.__oturum||null}}),
         onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
         updateUser(){ return Promise.resolve({error:null}); } },
  from(){ return { select(){ return { eq(){ return { maybeSingle:()=>Promise.resolve({data:null,error:null}) }; },
                                      is(){ return Promise.resolve({data:[],error:null}); } }; },
                   upsert(){ return Promise.resolve({error:null}); },
                   update(){ return { in(){return Promise.resolve({error:null});}, eq(){return Promise.resolve({error:null});} }; } }; },
  storage:{ from(){ return { upload:()=>Promise.resolve({error:null}), list:()=>Promise.resolve({data:[],error:null}),
                             remove:()=>Promise.resolve({error:null}), download:()=>Promise.resolve({data:null,error:'x'}) }; } }
};}};`;

(async () => {
  const t = await chromium.launch();
  const p = await t.newPage({ viewport:{width:1280,height:1000} });
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.addInitScript(`try{ localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_tour_done','1');
    localStorage.setItem('demo_cal_${UID}', JSON.stringify([{id:'e1',date:'2026-10-01',time:'09:00',
      type:'reels',platform:'instagram',title:'x',uploaded:false,content:{}}])); }catch(e){}`);
  await p.addInitScript(`window.__oturum=${JSON.stringify({user:{id:UID,email:'ben@ornek.com',
    app_metadata:{provider:'email'}, user_metadata:{full_name:'Murat B.'}}})};`);
  await p.route('**/supabase-js**', r=> r.fulfill({status:200,contentType:'application/javascript',body:SB}));
  await p.route('**/goatcounter**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });

  console.log('[baglanti yokken]');
  await p.evaluate(()=>{ paylasim = { jeton:'', zaman:0 }; paylasEkraniTazele();
                         document.getElementById('paylasOverlay').classList.add('open'); });
  await p.waitForTimeout(200);
  bak('baglanti yokken posta alani da gizli', await p.$eval('#pay_postaSatir', e=> e.hidden));

  console.log('[baglanti varken]');
  await p.evaluate(()=>{ paylasim = { jeton:'abc123def', zaman: Date.now() }; paylasEkraniTazele(); });
  await p.waitForTimeout(200);
  bak('posta alani aciliyor', !(await p.$eval('#pay_postaSatir', e=> e.hidden)));
  bak('kopyalanacak adres de duruyor',
      /paylas\.html#/.test(await p.$eval('#pay_adres', e=> e.value)),
      await p.$eval('#pay_adres', e=> e.value));

  console.log('[gecersiz adres]');
  await p.fill('#pay_kime', 'abc');
  await p.click('#pay_postala');
  await p.waitForTimeout(200);
  bak('gecersiz adres uyariyor',
      /doğru görünmüyor/.test(await p.$eval('#pay_durum', e=> e.textContent)),
      await p.$eval('#pay_durum', e=> e.textContent));

  console.log('[hazirlanan posta]');
  await p.fill('#pay_kime', 'kurgucu@ornek.com');
  await p.fill('#pay_not', 'Perşembe çekimini kaçırma.');
  const mail = decodeURIComponent(await p.evaluate(()=> paylasPostaAdresi()));
  bak('alici adresi yerinde', mail.indexOf('mailto:kurgucu@ornek.com') === 0, mail.slice(0,40));
  bak('konuda gonderenin adi var', /Murat B\. seninle bir yayın planı paylaştı/.test(mail),
      (mail.match(/subject=([^&]*)/) || [])[1]);
  bak('BAGLANTI govdede', /paylas\.html#/.test(mail));
  bak('kullanicinin notu en ustte', /Perşembe çekimini kaçırma/.test(mail));
  bak('"hesap gerekmiyor" yaziyor', /hesap açmana, kayıt olmana gerek yok/.test(mail));
  bak('kendiliginden guncellendigi yaziyor', /Kendiliğinden güncelleniyor/.test(mail));
  bak('imza var', /shootboard\.app/.test(mail));

  console.log('[not bos birakilabiliyor]');
  await p.fill('#pay_not', '');
  const mail2 = decodeURIComponent(await p.evaluate(()=> paylasPostaAdresi()));
  bak('notsuz da duzgun', /Merhaba,/.test(mail2) && !/Perşembe/.test(mail2));

  console.log('[ingilizce]');
  await p.evaluate(()=> setLanguage('en'));
  await p.waitForTimeout(300);
  const mail3 = decodeURIComponent(await p.evaluate(()=> paylasPostaAdresi()));
  bak('ingilizce govde', /no account, no sign-up/.test(mail3), mail3.slice(0,80));
  bak('ingilizce konu', /shared a publishing plan/.test(mail3));

  console.log('[alan kisi uye olmak zorunda mi]');
  {
    const g0 = new Date();
    const iki = n=> String(n).padStart(2,'0');
    const bugun = g0.getFullYear() + '-' + iki(g0.getMonth()+1) + '-' + iki(g0.getDate());
    const p2 = await t.newPage({ viewport:{width:1280,height:900} });
    const istekler = [];
    p2.on('request', r=> istekler.push(r.url()));
    // Sahte paylasim dosyasi: bagimsiz bir tarayici, hesap yok, cerez yok.
    await p2.route('**/storage/v1/object/public/paylasim/**', r=> r.fulfill({
      status:200, contentType:'application/json', body: JSON.stringify({
        v:1, olusturuldu:'2026-09-07T08:00:00.000Z', dil:'tr',
        // Kayit BU AYDA olmali: gorunum acilista bu ayi gosteriyor.
        kayitlar:[{ tarih: bugun, saat:'09:00', tur:'reels', platform:'instagram',
                    baslik:'Kariye açılış', yayinlandi:false, proje:'Kariye' }] }) }));
    await p2.goto(KOK + '/paylas.html#' + UID + '/abc123def', { waitUntil:'domcontentloaded' });
    await p2.waitForFunction(()=> !document.getElementById('govde').hidden, null, { timeout: 8000 });
    const govde = await p2.$eval('#govde', e=> e.textContent);
    bak('plan hesapsiz aciliyor', /Kariye açılış/.test(govde), govde.replace(/\s+/g,' ').slice(0,90));
    bak('yukleniyor yazisi kalkti', await p2.$eval('#durum', e=> e.hidden));
    bak('giris/kayit istenmiyor', !/Giriş yap|Sign in|Kayıt ol/.test(await p2.evaluate(()=> document.body.textContent)));
    bak('supabase-js yuklenmiyor (kimlik yok)',
        !istekler.some(u=> /supabase-js/.test(u)), istekler.filter(u=>/supabase/.test(u)).join(' '));
    bak('yalnizca PUBLIC adresten okuyor',
        istekler.filter(u=> /storage\/v1/.test(u)).every(u=> /\/object\/public\//.test(u)),
        istekler.filter(u=> /storage\/v1/.test(u)).join(' '));
    await p2.close();
  }

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
