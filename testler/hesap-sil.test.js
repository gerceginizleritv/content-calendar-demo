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

  // ══════════════════════════════════════════════════════════════════
  // ★ BEKCI: HESAP_TABLOLARI ile sql/ AYNI KUMEYI TASIYOR MU
  //
  // SQL tarafi (hesabi_sil) liste tutMUYOR: information_schema'yi
  // geziyor, cunku "yarin yeni bir tablo eklendiginde unutulmasin".
  // Yedek yol o korumayi tasiyamiyor -- tarayici information_schema'yi
  // gezemez -- ve liste elle duruyor. Elle tutulan her liste bu depoda
  // bir kez bayatladi; bu olcum onu gerceye BAGLIYOR.
  //
  // 27 Eylul 2026'da iki tablo eksikti (api_keys, accounts). api_keys
  // ozellikle pahaliydi: sql/36 tabloyu dusurmus, liste dogru sekilde
  // cikarmis, sonra sql/39 GERI GETIRMISTI -- ve ai-erisimi.test.js
  // "listede olmamali" diye kilitlemisti. Yani yesil yanan bir test
  // yanlis davranisi garanti ediyordu.
  console.log('[bekçi: liste sql/ ile uyumlu mu]');
  {
    const fs = require('fs'), yol = require('path');
    const sqlDizin = yol.join(__dirname, '..', 'sql');

    // Tarayici AYRI BIR ISLEV: boylece gercek sql/ ile DE sentetik bir
    // girdiyle DE cagrilabiliyor. Ilk yazimda govdeye gomuluydu ve
    // "yorumdaki drop aldatmiyor" olcumu KOR cikti -- depoda yorum
    // icindeki tek drop'un (calendar_events_yedek) user_id'si yok, yani
    // olcum bugunun dosya iceriğine bagli bir totolojiydi.
    //
    // ⚠ SON DURUM IZLENIYOR, ILK DURUM DEGIL. Ilk yazimda tablonun ILK
    // yaratildigi dosya kaydediliyordu ve bekci yine KOR cikti: api_keys
    // sql/35'te yaratilmis, sql/36'da dusurulmus, sql/39'da GERI
    // GETIRILMISTI -- ilk kayda bakan kod 36'yi gorup elemis, 39'u hic
    // gormemisti. Yani bekci, yakalamak icin yazildigi hatanin aynisina
    // dustu. Ikisi de mutasyonla ortaya cikti.
    const taraSql = (dosyalar)=>{
      const durum = new Map();            // tablo -> { var, dosya }
      for(const { ad, metin } of dosyalar){
        // Yorumlar atiliyor: sql/09'da "istersen sil" diye bir NOT var
        //     --   drop table public.calendar_events_yedek;
        // ve desen ona da uyuyor. Yarin biri canli bir tablo icin boyle
        // bir not yazsa bekci sessizce zayiflardi.
        const m = String(metin).replace(/--[^\n]*/g, '');
        const olaylar = [];
        const cre = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\n\s*\)\s*;/gi;
        let e;
        while((e = cre.exec(m))){
          if(/\buser_id\b/.test(e[2])) olaylar.push({ at: e.index, ad: e[1], vr: true });
        }
        const dro = /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_]+)/gi;
        while((e = dro.exec(m))) olaylar.push({ at: e.index, ad: e[1], vr: false });
        olaylar.sort((a, b)=> a.at - b.at);
        for(const o of olaylar){
          // Dusurme yalnizca daha once user_id'li gorulmus tabloyu eler.
          if(!o.vr && !durum.has(o.ad)) continue;
          durum.set(o.ad, { var: o.vr, dosya: ad });
        }
      }
      const acik = new Map();
      for(const [ad, s] of durum) if(s.var) acik.set(ad, s.dosya);
      return acik;
    };

    const bulunan = taraSql(
      fs.readdirSync(sqlDizin).filter(x=> x.endsWith('.sql')).sort()
        .map(ad=> ({ ad, metin: fs.readFileSync(yol.join(sqlDizin, ad), 'utf8') })));

    const liste = await p.evaluate(()=> HESAP_TABLOLARI);
    const eksik = [...bulunan.keys()].filter(t=> !liste.includes(t));
    bak('★ sql/ içindeki user_id tablolarının HEPSİ listede',
        eksik.length === 0,
        'eksik: ' + eksik.map(t=> t + ' (' + bulunan.get(t) + ')').join(', '));
    bak('bekçi gerçekten tablo buluyor (boş tarama sessizce geçmesin)',
        bulunan.size >= 9, 'bulunan: ' + bulunan.size);
    // Tarayicinin kor noktasi: calendar_events ve projects sql/ icinde
    // YARATILMIYOR (dosyalar 05'ten basliyor, o iki tablo daha eski).
    // Yani bu olcum "liste eksiksiz" demiyor, "sql/'de yaratilan hicbir
    // sey atlanmadi" diyor. Asil risk zaten yarin eklenecek tablolar.
    bak('kör nokta biliniyor: elle eklenmiş ikisi listede',
        liste.includes('calendar_events') && liste.includes('projects'), liste.join(','));

    // ---- Tarayicinin KENDI olcumleri (sentetik girdi) ----------------
    // Gercek sql/ ile olcmek yetmiyor: o dosyalarin bugunku icerigi
    // bazi dallari hic gezdirmiyor.
    bak('★ yorumdaki drop table aldatmıyor',
        taraSql([{ ad: 'a.sql', metin: 'create table public.x (\n  user_id uuid\n);' },
                 { ad: 'b.sql', metin: '--   drop table public.x;\n' }]).has('x'));
    bak('★ düşürülüp GERİ GETİRİLEN tablo kümede (api_keys hikâyesi)',
        taraSql([{ ad: 'a.sql', metin: 'create table public.y (\n  user_id uuid\n);' },
                 { ad: 'b.sql', metin: 'drop table if exists public.y;' },
                 { ad: 'c.sql', metin: 'create table public.y (\n  user_id uuid\n);' }]).has('y'));
    bak('gerçekten düşürülmüş tablo kümede DEĞİL',
        !taraSql([{ ad: 'a.sql', metin: 'create table public.z (\n  user_id uuid\n);' },
                  { ad: 'b.sql', metin: 'drop table public.z;' }]).has('z'));
    bak('user_id taşımayan tablo kümeye girmiyor',
        !taraSql([{ ad: 'a.sql', metin: 'create table public.w (\n  id text\n);' }]).has('w'));
  }

  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
