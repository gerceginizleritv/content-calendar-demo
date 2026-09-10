// HESAP SILME.
//
// Sartlar sayfasi bir soz veriyor: "Hesabim -> Hesabini sil" deyince her
// sey sunucudan silinir. Gercek telefonda o soz tutulmuyordu:
//
//   Hesap silinemedi. Direct deletion from storage tables is not allowed.
//   Use the Storage API instead.
//
// SQL islevi depodaki dosyalari dogrudan storage.objects'ten siliyordu;
// Supabase buna izin vermiyor. Islev tek parca oldugu icin bu hata her
// seyi geri aliyordu: kullanici siliyorum saniyor, HICBIR SEY silinmiyor.
//
// Is ikiye bolundu: dosyalari uygulama siliyor (Storage API), tablolari
// ve hesabin kendisini islev siliyor. Burada Supabase TAKLIT ediliyor:
// olculen sey cagrilarin SIRASI ve dosya silme takilirsa ne oldugu.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

// Sahte bir Supabase: cagrilari kaydediyor.
const SAHTE = (secenek)=>{
  // Iz DISARIYA yaziliyor (izKaydet). Silme basarili olunca sayfa
  // index.html'e gidiyor ve sayfa icindeki her sey siliniyor; disarida
  // tutulan liste o gidisi atlatiyor.
  // DIKKAT: sb ve session `let` ile tanimli, yani window uzerinde DEGIL.
  // window.sb = ... yazmak hicbir sey yapmiyor; degiskenin kendisine
  // atamak gerekiyor.
  session = { user: { id: 'kim-1', email: 'a@b.c' } };
  sb = {
    storage: {
      from(kova){
        return {
          list(yol){
            izKaydet('list:' + kova);
            if(secenek.kovaYok && secenek.kovaYok.indexOf(kova) !== -1){
              return Promise.resolve({ data:null, error:{ message:'Bucket not found' } });
            }
            if(secenek.listeHata && secenek.listeHata.indexOf(kova) !== -1){
              return Promise.resolve({ data:null, error:{ message:'boom' } });
            }
            return Promise.resolve({ data:[{ name:'a.json' }, { name:'b.json' }], error:null });
          },
          remove(yollar){
            izKaydet('remove:' + kova + ':' + yollar.join('|'));
            if(secenek.silHata && secenek.silHata.indexOf(kova) !== -1){
              return Promise.resolve({ error:{ message:'silinemedi' } });
            }
            return Promise.resolve({ error:null });
          }
        };
      }
    },
    from(tablo){
      return { delete(){ return { eq(){
        izKaydet('sil:' + tablo);
        return Promise.resolve({ error: (secenek.tabloHata || []).indexOf(tablo) !== -1
                                        ? { message:'olmadi' } : null });
      } }; } };
    },
    rpc(ad){
      izKaydet('rpc:' + ad);
      return Promise.resolve({ error: secenek.rpcHata ? { message: secenek.rpcHata } : null });
    },
    auth: { signOut(){ izKaydet('signOut'); return Promise.resolve({}); } }
  };
};

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{ width:1280, height:900 } })).newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  let izler = [];
  await p.exposeFunction('izKaydet', (x)=> { izler.push(x); });
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });

  console.log('[önce dosyalar, sonra hesap]');
  await p.evaluate(SAHTE, { });
  izler = [];
  await p.evaluate(()=> hesapDosyalariniSil());
  const iz1 = izler;
  bak('üç kovanın da içine bakılıyor',
      ['takvim','paylasim','yedek'].every(x=> iz1.indexOf('list:'+x) !== -1), iz1.join(' '));
  bak('dosyalar kullanıcının klasöründen siliniyor',
      iz1.some(x=> x.indexOf('remove:takvim:kim-1/a.json|kim-1/b.json') === 0), iz1.join(' '));
  bak('her kovada siliniyor',
      ['takvim','paylasim','yedek'].every(x=> iz1.some(y=> y.indexOf('remove:'+x) === 0)),
      iz1.join(' '));

  console.log('[kurulmamış kova hata değil]');
  await p.evaluate(SAHTE, { kovaYok:['paylasim','yedek'] });
  const s2 = await p.evaluate(()=> hesapDosyalariniSil());
  bak('olmayan kova takılan sayılmıyor', s2.takilan.length === 0, JSON.stringify(s2));

  console.log('[silinemeyen kova bildiriliyor]');
  await p.evaluate(SAHTE, { silHata:['yedek'] });
  izler = [];
  const s3 = await p.evaluate(()=> hesapDosyalariniSil());
  bak('takılan kova söyleniyor', s3.takilan.join(',') === 'yedek', JSON.stringify(s3));
  bak('öteki kovalar yine de temizlendi',
      izler.some(x=> x.indexOf('remove:takvim') === 0), izler.join(' '));

  console.log('[gerçek düğme: sıra doğru mu]');
  await p.evaluate(SAHTE, { });
  await p.evaluate(()=>{
    // Onay penceresini ve sayfa degistirmeyi atliyoruz: olculen sey sira.
    // onayla ve track function bildirimi, yani ustune yazilabiliyor.
    onayla = ()=> Promise.resolve(true);
    track = ()=>{};
    // Dugme e-posta yazilmadan kapali geliyor.
    document.getElementById('hesapSilBtn').disabled = false;
  });
  izler = [];
  await p.evaluate(()=> document.getElementById('hesapSilBtn').click());
  for(let i = 0; i < 80 && izler.indexOf('rpc:hesabi_sil') === -1; i++) await p.waitForTimeout(100);
  const iz4 = izler.slice();
  const rpcSira = iz4.indexOf('rpc:hesabi_sil');
  const sonRemove = iz4.map((x,i)=> x.indexOf('remove:') === 0 ? i : -1)
                       .reduce((a,b)=> Math.max(a,b), -1);
  bak('işlev çağrıldı', rpcSira !== -1, iz4.join(' '));
  // SIRA ONEMLI: islev hesabi silince oturum oluyor, ondan sonra dosya
  // silinemez. Once dosyalar, sonra hesap.
  bak('dosyalar hesaptan ÖNCE silindi', sonRemove !== -1 && sonRemove < rpcSira,
      'son remove=' + sonRemove + ' rpc=' + rpcSira);

  console.log('[sunucu işlevi çalışmazsa kullanıcı yine de silebiliyor]');
  // KURAL: hesabini silmek isteyen kisiye "su betigi calistir" DENMEZ.
  // Islev calismazsa uygulama kullanicinin kendi yetkisiyle (RLS) verisini
  // siliyor ve geriye ne kaldigini oldugu gibi soyluyor.
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });
  await p.evaluate(SAHTE, { rpcHata:'Direct deletion from storage tables is not allowed. Use the Storage API instead.' });
  await p.evaluate(()=>{ onayla = ()=> Promise.resolve(true); track = ()=>{};
                         document.getElementById('hesapSilBtn').disabled = false; });
  izler = [];
  await p.evaluate(()=> document.getElementById('hesapSilBtn').click());
  await p.waitForTimeout(1200);
  const kismiDurum = await p.$eval('#hesapDurum', e=> e.textContent);
  bak('kullanıcıya SQL çalıştır DENMİYOR',
      !/sql\/|Supabase|betik/i.test(kismiDurum), kismiDurum);
  bak('ham İngilizce hata da basılmıyor', !/Direct deletion|storage/i.test(kismiDurum), kismiDurum);
  bak('verilerin silindiği söyleniyor', /silindi/i.test(kismiDurum), kismiDurum);
  bak('geriye ne kaldığı da söyleniyor', /giriş kaydın/i.test(kismiDurum), kismiDurum);
  bak('bütün tablolar gerçekten silindi',
      ['calendar_events','projects','ideas','scripts','places','caption_templates','user_prefs']
        .every(x=> izler.indexOf('sil:'+x) !== -1), izler.join(' '));
  bak('oturum kapatıldı', izler.indexOf('signOut') !== -1, izler.join(' '));

  console.log('[verisi bile silinemezse]');
  await p.evaluate(SAHTE, { rpcHata:'bir sey oldu', tabloHata:['projects'] });
  await p.evaluate(()=>{ onayla = ()=> Promise.resolve(true); track = ()=>{};
                         document.getElementById('hesapSilBtn').disabled = false; });
  await p.evaluate(()=> document.getElementById('hesapSilBtn').click());
  await p.waitForTimeout(1000);
  const kotuDurum = await p.$eval('#hesapDurum', e=> e.textContent);
  bak('"verilerin duruyor" deniyor', /duruyor/i.test(kotuDurum), kotuDurum);
  bak('ne yapacağı söyleniyor (tekrar dene / bize yaz)',
      /tekrar dene/i.test(kotuDurum), kotuDurum);
  bak('düğme yeniden kullanılabilir',
      !(await p.$eval('#hesapSilBtn', e=> e.disabled)));

  console.log('[işlev hiç kurulmamışsa da aynı yol]');
  await p.evaluate(SAHTE, { rpcHata:'function public.hesabi_sil() does not exist' });
  await p.evaluate(()=>{ onayla = ()=> Promise.resolve(true); track = ()=>{};
                         document.getElementById('hesapSilBtn').disabled = false; });
  izler = [];
  await p.evaluate(()=> document.getElementById('hesapSilBtn').click());
  await p.waitForTimeout(1100);
  const yokDurum = await p.$eval('#hesapDurum', e=> e.textContent);
  bak('yine SQL adı geçmiyor', !/sql\/|Supabase/i.test(yokDurum), yokDurum);
  bak('verisi yine de silindi', izler.indexOf('sil:calendar_events') !== -1, izler.join(' '));

  bak('sayfa hatası yok', hata.length === 0, hata.join(' | '));
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
