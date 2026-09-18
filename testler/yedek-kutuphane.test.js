// YEDEK NEYI TASIYOR — ihtiyac kutuphanesi, setler, hatirlatma.
//
// Uzun sure sessiz bir boşluk vardı: kutuphane ve setler user_prefs.prefs
// icinde durdugu icin yedek govdesine hic girmemislerdi. Ikisi de
// kullanicinin ELLE yazdigi icerik. Supabase'te durduklari icin gunluk
// kullanimda kaybolmuyorlardi -- ama yedekten donen kisi takvimini geri
// aliyor, kutuphanesini almiyordu; disa aktardigi dosya da eksik
// cikiyordu ve bunu kimse soylemiyordu.
//
// Hatirlatma daha da tuhaftı: yedege YAZILIYOR ama hic geri
// YUKLENMIYORDU. Yazilip bir daha okunmayan bir alan, "yedeklendi" diye
// yanlis bir guven veriyordu.
//
// Test bu yuzden iki yonu de olcuyor: govdeye giriyor mu VE geri
// yuklenince gercekten donuyor mu. Birincisi tek basina yetmez.
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

  console.log('[gövdeye giriyor mu]');
  const govde = await p.evaluate(()=>{
    ihtiyaclar = [{ id:'ih_1', ad:'Powerbank', grup:'Elektrik' },
                  { id:'ih_2', ad:'Tripod', grup:'Destek' }];
    ihtiyacSetleri = [{ id:'st_1', ad:'Sokak çekimi seti', maddeler:['Powerbank','Tripod'] }];
    saveIhtiyaclar(); saveSetler();
    hatirlatma.gecikti = false; hatirlatma.saat = '07:30'; hatirlatmaKaydet();
    const y = yedekGovdesi();
    return { ihtiyac: y.ihtiyaclar, set: y.setler, hatirlatma: y.hatirlatma,
             anahtarlar: Object.keys(y), metin: JSON.stringify(y) };
  });
  bak('kütüphane gövdede', (govde.ihtiyac||[]).length === 2, JSON.stringify(govde.anahtarlar));
  bak('setler gövdede', (govde.set||[]).length === 1, JSON.stringify(govde.set));
  bak('hatırlatma gövdede', !!govde.hatirlatma && govde.hatirlatma.saat === '07:30',
      JSON.stringify(govde.hatirlatma));

  // Sirlar BILEREK disarida. Bunlar yedek dosyasina girseydi, dosyasini
  // birine gonderen kisi Gemini anahtarini ve paylasim jetonunu da
  // gondermis olurdu.
  console.log('[sırlar gövdeye SIZMIYOR]');
  const sir = await p.evaluate(()=>{
    const y = JSON.stringify(yedekGovdesi());
    return { aiVar: y.indexOf('"ai"') !== -1, shareVar: y.indexOf('"share"') !== -1,
             prefsVar: y.indexOf('"prefs"') !== -1 };
  });
  bak('Gemini anahtarı yedekte yok', sir.aiVar === false);
  bak('paylaşım jetonu yedekte yok', sir.shareVar === false);
  bak('prefs olduğu gibi kopyalanmamış', sir.prefsVar === false);

  console.log('[özet sayıları doğruyu söylüyor]');
  const ozet = await p.evaluate(()=>{
    const s = yedekSayilari(yedekGovdesi());
    return { s, metin: t('yedek_ozet')(s) };
  });
  bak('özette malzeme sayısı var', ozet.s.ihtiyac === 2, JSON.stringify(ozet.s));
  bak('özette set sayısı var', ozet.s.set === 1, JSON.stringify(ozet.s));
  bak('özet metninde görünüyor', /malzeme/.test(ozet.metin) && /set/.test(ozet.metin), ozet.metin);

  console.log('[ASIL SORU: geri yükleyince dönüyor mu]');
  // Kullanicinin yasadigi sey: yedegi al, her seyi kaybet, geri yukle.
  const geri = await p.evaluate(async ()=>{
    const dosyaMetni = JSON.stringify(yedekGovdesi());
    // Her sey gitti.
    ihtiyaclar = []; ihtiyacSetleri = []; saveIhtiyaclar(); saveSetler();
    hatirlatma.gecikti = true; hatirlatma.saat = '09:00'; hatirlatmaKaydet();
    // onayla() penceresini gecici olarak "evet" yapiyoruz: olculen sey
    // onay degil, geri yuklemenin kendisi.
    const eskiOnay = window.onayla, eskiUyari = window.uyari;
    window.onayla = async ()=> true; window.uyari = ()=>{};
    await yedekGeriYukle(new Blob([dosyaMetni], { type:'application/json' }));
    window.onayla = eskiOnay; window.uyari = eskiUyari;
    return { ihtiyac: ihtiyaclar.map(x=> x.ad).sort(),
             set: ihtiyacSetleri.map(x=> x.ad),
             saat: hatirlatma.saat, gecikti: hatirlatma.gecikti };
  });
  bak('kütüphane geri geldi',
      geri.ihtiyac.join(',') === 'Powerbank,Tripod', JSON.stringify(geri.ihtiyac));
  bak('setler geri geldi',
      geri.set.join(',') === 'Sokak çekimi seti', JSON.stringify(geri.set));
  bak('hatırlatma ayarı geri geldi', geri.gecikti === false, JSON.stringify(geri));

  console.log('[geri yükleme SILMIYOR, birleştiriyor]');
  // Oteki listelerle ayni kural: yedek mevcut kutuphaneyi silmiyor,
  // uzerine ekliyor. Silmek geri alinamaz, eklemek geri alinabilir.
  const birlesme = await p.evaluate(async ()=>{
    const dosyaMetni = JSON.stringify(yedekGovdesi());
    ihtiyaclar = [{ id:'ih_9', ad:'Yeni bir madde', grup:'' }];
    saveIhtiyaclar();
    const eskiOnay = window.onayla, eskiUyari = window.uyari;
    window.onayla = async ()=> true; window.uyari = ()=>{};
    await yedekGeriYukle(new Blob([dosyaMetni], { type:'application/json' }));
    window.onayla = eskiOnay; window.uyari = eskiUyari;
    return ihtiyaclar.map(x=> x.ad).sort();
  });
  bak('yedektekiler eklendi', birlesme.indexOf('Powerbank') !== -1, JSON.stringify(birlesme));
  bak('mevcut madde SİLİNMEDİ', birlesme.indexOf('Yeni bir madde') !== -1, JSON.stringify(birlesme));

  console.log('[bozuk veri sızmıyor]');
  const suz = await p.evaluate(async ()=>{
    ihtiyaclar = []; ihtiyacSetleri = []; saveIhtiyaclar(); saveSetler();
    const eskiOnay = window.onayla, eskiUyari = window.uyari;
    window.onayla = async ()=> true; window.uyari = ()=>{};
    await yedekGeriYukle(new Blob([JSON.stringify({
      urun:'shootboard',
      ihtiyaclar:[{ id:'ih_a', ad:'  ' }, { id:'ih_b', ad:'x'.repeat(300) }, 'metin degil'],
      setler:[{ id:'st_a', ad:'Boş set', maddeler:[] }]
    })], { type:'application/json' }));
    window.onayla = eskiOnay; window.uyari = eskiUyari;
    return { adet: ihtiyaclar.length, uzunluk: (ihtiyaclar[0]||{}).ad
               ? ihtiyaclar[0].ad.length : 0, set: ihtiyacSetleri.length };
  });
  bak('boş adlı madde düştü', suz.adet === 1, JSON.stringify(suz));
  bak('uzun ad 120\'ye kırpıldı', suz.uzunluk === 120, suz.uzunluk);
  bak('maddesiz set düştü', suz.set === 0, suz.set);

  bak('js hatası yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
