// HESAP ETIKETLERI — veri katmani.
//
// Bir paylasimin "nereye" gidecegi bugune kadar yalnizca PLATFORM olarak
// tutuluyordu. Iki YouTube kanali olan uretici ayni platforma cikan iki
// paylasimi birbirinden ayiramiyordu.
//
// BU BIR BAGLANTI DEGIL, BIR ETIKET: saklanan sey kullanicinin yazdigi
// bir ad. OAuth yok, jeton yok, otomatik paylasim yok.
//
// Test arayuzu DEGIL veri katmanini olcuyor, cunku burada iki bilinen
// tuzak var:
//   1. content.hesapId sanitizeEvent beyaz listesine girmezse her sayfa
//      yenilemesinde sessizce duser -- "diller" ile birebir ayni hata,
//      bir kez yasandi.
//   2. Hesaplar yedege girmezse geri yukleyen kisi etiketlerini kaybeder
//      -- ihtiyac kutuphanesiyle birebir ayni hata, o da bir kez yasandi.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{ width:1280, height:1000 } })).newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**supabase.co**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());

  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1300);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });

  const kur = ()=> p.evaluate(()=>{
    hesaplar = [
      { id:'hs_a', name:'Gerçeğin İzleri', platform:'youtube', handle:'@gercegin', url:'https://youtube.com/@gercegin' },
      { id:'hs_b', name:'Kişisel', platform:'youtube', handle:'kisisel', url:'' },
      { id:'hs_c', name:'Marka', platform:'instagram', handle:'@marka', url:'' }
    ].map(hesapTemizle).filter(Boolean);
    saveHesaplar();
  });

  console.log('[temizleme]');
  const temiz = await p.evaluate(()=> [
    hesapTemizle({ name:'  Kanal  ', platform:'youtube', handle:'@@ad' }),
    hesapTemizle({ name:'', platform:'youtube' }),
    hesapTemizle({ name:'Bilinmeyen', platform:'myspace' }),
    hesapTemizle({ name:'x'.repeat(200), platform:'x' }),
    hesapTemizle('metin degil')
  ]);
  bak('ad kırpılıp temizleniyor', temiz[0].name === 'Kanal', JSON.stringify(temiz[0]));
  bak('baştaki @ atılıyor', temiz[0].handle === 'ad', temiz[0].handle);
  bak('adsız hesap düşüyor', temiz[1] === null);
  bak('bilinmeyen platform boşa düşüyor ama hesap kalıyor',
      temiz[2] && temiz[2].platform === '', JSON.stringify(temiz[2]));
  bak('uzun ad 80\'e kırpıldı', temiz[3].name.length === 80, temiz[3].name.length);
  bak('nesne olmayan düşüyor', temiz[4] === null);

  console.log('[şerit YALNIZCA ikiden fazla hesapta]');
  // Tek kanalli uretici hicbir ek tik gormemeli: alan ancak IKINCI hesap
  // eklenince ortaya cikiyor. Ozelligin ertelenmemesinin sebebi bu.
  await kur();
  const serit = await p.evaluate(()=> ({
    youtube: hesapSeritGerekir('youtube'),
    instagram: hesapSeritGerekir('instagram'),
    tiktok: hesapSeritGerekir('tiktok'),
    ytSayi: platformHesaplari('youtube').length,
    ytSirali: platformHesaplari('youtube').map(h=> h.name)
  }));
  bak('iki YouTube hesabı → şerit var', serit.youtube === true);
  bak('tek Instagram hesabı → şerit YOK', serit.instagram === false);
  bak('hiç TikTok hesabı yok → şerit YOK', serit.tiktok === false);
  bak('platform hesapları süzülüyor', serit.ytSayi === 2, serit.ytSayi);
  bak('ada göre sıralı', serit.ytSirali.join(',') === 'Gerçeğin İzleri,Kişisel',
      serit.ytSirali.join(','));

  console.log('[content.hesapId sanitizeEvent\'ten geçiyor]');
  // Birinci tuzak. Beyaz listeye eklenmeseydi bu alan her yuklemede
  // sessizce duserdi.
  const sz = await p.evaluate(()=> [
    sanitizeEvent({ id:'e1', type:'video', platform:'youtube', date:'2026-10-09',
                    content:{ hesapId:'hs_a' } }).content.hesapId,
    sanitizeEvent({ id:'e2', type:'video', platform:'youtube', date:'2026-10-09',
                    content:{ hesapId:'kötü kimlik!' } }).content.hesapId,
    JSON.stringify(sanitizeEvent({ id:'e3', type:'video', platform:'youtube',
                    date:'2026-10-09', content:{} }).content)
  ]);
  bak('geçerli kimlik hayatta', sz[0] === 'hs_a', String(sz[0]));
  bak('geçersiz kimlik düştü', sz[1] === undefined, String(sz[1]));
  bak('hesapsız kayıtta alan JSON\'a yazılmıyor', sz[2].indexOf('hesapId') === -1, sz[2].slice(0,120));

  console.log('[ASIL SENARYO: yenilemeden sonra duruyor mu]');
  await p.evaluate(()=>{
    events = [{ id:'ev_h', type:'video', platform:'youtube', title:'Kanal videosu',
                date:'2026-10-09', time:'19:00', uploaded:false,
                content:{ videoTitle:'Başlık', hesapId:'hs_a' } }];
    save();
  });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')); });
  const sonra = await p.evaluate(()=>{
    const e = events.find(x=> x.id === 'ev_h');
    return e ? (e.content||{}).hesapId : null;
  });
  bak('yenilemeden sonra hesap bağı duruyor', sonra === 'hs_a', String(sonra));

  console.log('[yedeğe giriyor ve geri geliyor]');
  // Ikinci tuzak. Ihtiyac kutuphanesi tam olarak bu yuzden yillar degil
  // ama aylarca yedegin disinda kalmisti.
  await kur();
  const yedek = await p.evaluate(()=>{
    const y = yedekGovdesi();
    return { adet: (y.hesaplar||[]).length, sayilar: yedekSayilari(y) };
  });
  bak('hesaplar gövdede', yedek.adet === 3, JSON.stringify(yedek));
  bak('özette hesap sayısı var', yedek.sayilar.hesap === 3, JSON.stringify(yedek.sayilar));

  const geri = await p.evaluate(async ()=>{
    const dosya = JSON.stringify(yedekGovdesi());
    hesaplar = []; saveHesaplar();
    const eskiOnay = window.onayla, eskiUyari = window.uyari;
    window.onayla = async ()=> true; window.uyari = ()=>{};
    await yedekGeriYukle(new Blob([dosya], { type:'application/json' }));
    window.onayla = eskiOnay; window.uyari = eskiUyari;
    return hesaplar.map(h=> h.name).sort();
  });
  bak('geri yükleyince hesaplar döndü', geri.length === 3, JSON.stringify(geri));
  bak('adlar bozulmadı', geri.indexOf('Gerçeğin İzleri') !== -1, JSON.stringify(geri));

  console.log('[silinmiş hesap kaydı boşaltmıyor]');
  // Proje silmedeki davranis: bag kopar, kayit "silinmis hesap" olarak
  // gorunur. Sessizce bosaltmak gecmisi yalanlamak olurdu.
  const silik = await p.evaluate(()=>{
    hesaplar = [];   // hepsi silindi
    const e = sanitizeEvent({ id:'ev_s', type:'video', platform:'youtube',
                              date:'2026-10-09', content:{ hesapId:'hs_a' } });
    return { kalan: e.content.hesapId, bulunan: hesapById('hs_a') };
  });
  bak('kimlik kayıtta duruyor', silik.kalan === 'hs_a', String(silik.kalan));
  bak('hesap bulunamıyor (silinmiş)', silik.bulunan === null);

  bak('js hatası yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
