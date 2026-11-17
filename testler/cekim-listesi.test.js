// Çekim listesi: kütüphane + projenin listesi + mekandan gelen maddeler.
const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1100} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  page.on('dialog', d=>d.accept());
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('ÇEKİM LİSTESİ');

  const r = await page.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
    setLanguage('tr');
    localStorage.removeItem('demo_ihtiyaclar');
    ihtiyaclar = [];

    mekanlar = [
      { id:'m_kadirga', name:'Kadırga', city:'İstanbul', district:'Fatih', address:'',
        mapsUrl:'', imageUrl:'', notes:'',
        permission:'Görevliden izin al',
        cautions:'Namaz vakitleri dışında çek\nTripod içeride yasak',
        createdAt: Date.now() }
    ];
    saveMekanlar();
    projects = [{ id:'p_sokollu', name:'Sokollu', type:'outdoor', keywords:'', notes:'', address:'',
      shootDate:'', script:false, filmed:false, edited:false, approved:false, published:false,
      permission:'', cancelled:false, deadlines:{}, placeIds:['m_kadirga'], placeId:'m_kadirga',
      cautions:'Sıra: geniş → orta → çok yakın', checklist:[], createdAt: Date.now() }];
    saveProjects();
    setPage('projects'); renderProjects();
    await bekle(200);

    // 0) BOS LISTE: maddelerin nereden geldigini soyluyor. Bos ekran
    //    "bozuk" hissi vermemeli.
    const bosProje = { ...projects[0], id:'p_bos', name:'Boş proje', placeIds:[], placeId:'',
                       cautions:'', checklist:[] };
    projects.push(bosProje); saveProjects();
    cekimListesiAc('p_bos');
    await bekle(200);
    const bosMetin = document.getElementById('cl_liste').textContent.replace(/\s+/g,' ').trim();
    const bosMaddeSayisi = document.querySelectorAll('#cl_liste .cl-bos li').length;
    cekimListesiKapat();
    await bekle(150);

    // 1) Proje satirindaki cip listeyi aciyor
    const cip = document.querySelector('[data-proj-list="p_sokollu"]');
    const cipVar = !!cip;
    cip.click();
    await bekle(250);
    const acildi = document.getElementById('cekimListesiOverlay').classList.contains('open');

    // 2) Mekan karti notlari kendiliginden madde olmus
    const metinler = ()=> [...document.querySelectorAll('#cl_liste .cl-metin')].map(x=>x.textContent.trim());
    const ilkMaddeler = metinler();
    const mekandanSayi = projeListesi(projectById('p_sokollu')).filter(x=>x.kaynak==='mekan').length;
    const grupBasliklari = [...document.querySelectorAll('#cl_liste .cl-grup')].map(x=>x.textContent.trim());

    // 3) Projenin serbest "dikkat" metni pencerede okunuyor
    const dikkatGorunuyor = !document.getElementById('cl_dikkat').hidden;
    const dikkatMetni = document.getElementById('cl_dikkat').textContent;

    // 4) Elle madde ekleme
    document.getElementById('cl_yeni').value = 'Dört taşın da yakın planı';
    document.getElementById('cl_ekleBtn').click();
    await bekle(150);
    const elleEklendi = metinler().indexOf('Dört taşın da yakın planı') !== -1;
    // Ayni madde ikinci kez eklenmiyor
    document.getElementById('cl_yeni').value = 'dört taşın da YAKIN planı';
    document.getElementById('cl_ekleBtn').click();
    await bekle(150);
    const tekrarSayisi = metinler().filter(x=>/Dört taşın/i.test(x)).length;

    // 5) TIK = "bu madde listede". Tikten cikarmak maddeyi LISTEDEN
    //    CIKARIYOR ve bu ANINDA kaydediliyor (Kaydet'e basilmadan).
    // ⛔ 17 KASIM 2026 -- TIKIN ANLAMI DEGISTI.
    //    Eskiden tik "bu isi bitirdim" demekti ve bu olcu
    //    `checklist[].bitti === true` ariyordu. Kullanici bunu bir
    //    karisiklik olarak bildirdi: "kullanici burada listede yer alan
    //    araclari isaretlerse bu sefer onlari silmis oluyor". Karar:
    //    hepsi TIKLI gelir, tikten cikarmak maddeyi listeden cikarir.
    //    Olcunun ARKASINDAKI guvence degismedi: tiklamak Kaydet'i
    //    beklemeden tarayiciya yazilsin. Artik SILINME uzerinden olculuyor.
    // ⚠ ELLE EKLENEN maddeyi seciyoruz (4. adim). Rastgele ilk satiri
    //    tiklamak mekandan gelen ":izin" maddesini dusurebilir ve
    //    asagidaki 10. adim "izinMaddesi undefined" diye coker.
    const cikarilacak = [...document.querySelectorAll('#cl_liste .cl-satir')]
      .find(x=> /Dört taşın/i.test((x.querySelector('.cl-metin')||{}).textContent || ''));
    const tikOnceSayi = projeListesi(projectById('p_sokollu')).length;
    const tikOnceSayac = document.getElementById('cl_sayac').textContent;
    cikarilacak.querySelector('.cl-kutu').click();
    await bekle(150);
    const yereldeki = JSON.parse(localStorage.getItem('demo_projects_v2') || localStorage.getItem('demo_projects') || '[]');
    const yerelProje = (Array.isArray(yereldeki) ? yereldeki : []).find(x=>x.id==='p_sokollu');
    const yerelListe = (yerelProje && yerelProje.checklist) || [];
    // Kaydet'e basilmadi: tarayicida madde artik YOK.
    const yereldenCikti = !yerelListe.some(x=> /Dört taşın/i.test(x.metin || ''));
    const yereldeSayi = yerelListe.length;
    const tikSonraSayi = projeListesi(projectById('p_sokollu')).length;
    const ekrandaCikti = [...document.querySelectorAll('#cl_liste .cl-metin')]
      .every(x=> !/Dört taşın/i.test(x.textContent || ''));
    const sayacMetni = document.getElementById('cl_sayac').textContent;
    // Hepsi tikli mi: tiksiz satir KALMAMALI.
    const tiksizSatir = document.querySelectorAll('#cl_liste .cl-kutu:not(.on)').length;
    // "Isaretleri temizle" dugmesi ve satir sonundaki "×" KALKTI:
    // tik zaten cikarma isini yapiyor, iki ayri silme yolu karistiriyordu.
    const temizleDugmesi = !!document.getElementById('cl_temizle');
    const silDugmesi = document.querySelectorAll('#cl_liste [data-cl-sil]').length;

    // 6) Not yazmak (SAHADA DOLDUR). Bos not kutusu satirda DURMUYOR:
    //    once "+ not" dugmesi var, tiklaninca kutu aciliyor.
    const notKutusuOnce = document.querySelector('#cl_liste .cl-not');
    document.querySelector('#cl_liste .cl-notac').click();
    await bekle(150);
    const notKutusu = document.querySelector('#cl_liste .cl-not');
    notKutusu.value = 'Sanduka: 3';
    notKutusu.dispatchEvent(new Event('change'));
    await bekle(150);
    const notKaydedildi = projeListesi(projectById('p_sokollu')).some(x=>x.not === 'Sanduka: 3');

    // 7) Kütüphane: yeni madde hem kütüphaneye hem listeye giriyor
    document.getElementById('cl_kutuphane').click();
    await bekle(200);
    const kutuphaneAcildi = document.getElementById('ihtiyacOverlay').classList.contains('open');
    document.getElementById('ih_yeniAd').value = 'Powerbank';
    document.getElementById('ih_yeniGrup').value = 'Enerji';
    document.getElementById('ih_yeniBtn').click();
    await bekle(150);
    const kutuphanedeVar = ihtiyaclar.some(x=>x.ad === 'Powerbank');
    const listedeVar = projeListesi(projectById('p_sokollu')).some(x=>x.metin === 'Powerbank');

    // 8) Toplu yapıştırma: kutu/tire işaretleri temizleniyor, kütüphaneye giriyor
    document.getElementById('ih_topluMetin').value =
      '☐ Osmo Action 4\n- Yaka mikrofonu\n1. Yedek pil\n☐ Powerbank\n\n';
    document.getElementById('ih_topluBtn').click();
    await bekle(200);
    const topluAdlar = ihtiyaclar.map(x=>x.ad);
    const topluNot = document.getElementById('ih_topluNot').textContent;
    // Powerbank zaten vardı, ikinci kez girmemeli
    const powerbankSayisi = topluAdlar.filter(x=>x === 'Powerbank').length;
    // Toplu eklenenler LİSTEYE değil, yalnızca kütüphaneye girmeli
    const listeyeGirmedi = !projeListesi(projectById('p_sokollu')).some(x=>x.metin === 'Osmo Action 4');

    // 9) Kütüphaneden seçmek listeye ekliyor, tekrar basmak çıkarıyor
    const osmoKutu = [...document.querySelectorAll('#ih_liste .ih-satir')]
      .find(x=> x.textContent.indexOf('Osmo') !== -1).querySelector('[data-ih-sec]');
    osmoKutu.click(); await bekle(150);
    const osmoListede = projeListesi(projectById('p_sokollu')).some(x=>x.metin === 'Osmo Action 4');
    [...document.querySelectorAll('#ih_liste .ih-satir')]
      .find(x=> x.textContent.indexOf('Osmo') !== -1).querySelector('[data-ih-sec]').click();
    await bekle(150);
    const osmoCikti = !projeListesi(projectById('p_sokollu')).some(x=>x.metin === 'Osmo Action 4');
    // Kütüphanede DURUYOR: projeden çıkarmak kütüphaneyi bozmuyor
    const osmoKutuphanede = ihtiyaclar.some(x=>x.ad === 'Osmo Action 4');

    document.getElementById('ih_bitti').click(); await bekle(150);

    // 10) Mekan notu değişince madde tazeleniyor, işaret korunuyor
    const oncekiListe = projeListesi(projectById('p_sokollu'));
    const izinMaddesi = oncekiListe.find(x=>x.id.indexOf(':izin') !== -1);
    // izin maddesini işaretle
    projeListesiYaz(projectById('p_sokollu'),
      oncekiListe.map(x=> x.id === izinMaddesi.id ? { ...x, bitti:true } : x));
    mekanById('m_kadirga').permission = 'Vakıflardan izin al';
    saveMekanlar();
    listeyiMekanlardanTazele(projectById('p_sokollu'));
    const yeniIzin = projeListesi(projectById('p_sokollu')).find(x=>x.id === izinMaddesi.id);
    const izinMetniTazelendi = yeniIzin && yeniIzin.metin === 'Vakıflardan izin al';
    const izinIsaretiDuruyor = !!(yeniIzin && yeniIzin.bitti);

    // 11) Proje satırındaki çip sayıyı gösteriyor
    document.getElementById('cl_bitti').click();
    await bekle(200);
    const kapandi = !document.getElementById('cekimListesiOverlay').classList.contains('open');
    const cipYazi = (document.querySelector('[data-proj-list="p_sokollu"] b')||{}).textContent || '';

    // 12) Kütüphane tarayıcıya yazılıyor
    const kutuphaneYerel = JSON.parse(localStorage.getItem('demo_ihtiyaclar') || '[]');

    return { bosMetin, bosMaddeSayisi, cipVar, acildi, ilkMaddeler, mekandanSayi, grupBasliklari, dikkatGorunuyor, dikkatMetni,
             elleEklendi, tekrarSayisi, sayacMetni, notKaydedildi,
             tikOnceSayi, tikSonraSayi, tikOnceSayac, yereldenCikti, yereldeSayi,
             ekrandaCikti, tiksizSatir, temizleDugmesi, silDugmesi,
             notKutusuGizli: !notKutusuOnce,
             kutuphaneAcildi, kutuphanedeVar, listedeVar, topluAdlar, topluNot, powerbankSayisi,
             listeyeGirmedi, osmoListede, osmoCikti, osmoKutuphanede,
             izinMetniTazelendi, izinIsaretiDuruyor, kapandi, cipYazi,
             kutuphaneYerelSayi: kutuphaneYerel.length };
  });

  k('boş listede üç kaynak da anlatılıyor', r.bosMaddeSayisi === 3, r.bosMaddeSayisi);
  k('boş metin mekan kartını gösteriyor', /Mekan kartından/.test(r.bosMetin), r.bosMetin.slice(0,70));
  k('boş metin kütüphaneyi gösteriyor', /kütüphanenden/i.test(r.bosMetin));
  k('proje satırında çekim listesi çipi var', r.cipVar);
  k('çip listeyi açıyor', r.acildi);
  k('mekan kartının izin/dikkat notları madde olmuş', r.mekandanSayi === 3, r.mekandanSayi);
  k('izin notu listede', r.ilkMaddeler.indexOf('Görevliden izin al') !== -1, r.ilkMaddeler);
  k('çok satırlı dikkat notu ayrı maddelere bölünmüş',
     r.ilkMaddeler.indexOf('Tripod içeride yasak') !== -1, r.ilkMaddeler);
  k('grup başlığı mekan adını söylüyor', /Kadırga/.test(r.grupBasliklari.join('|')), r.grupBasliklari);
  k('projenin serbest "dikkat" metni pencerede', r.dikkatGorunuyor && /geniş/.test(r.dikkatMetni), r.dikkatMetni.slice(0,60));
  k('elle madde eklendi', r.elleEklendi);
  k('aynı madde ikinci kez eklenmiyor', r.tekrarSayisi === 1, r.tekrarSayisi);
  k('★ tikten çıkarmak maddeyi LİSTEDEN çıkarıyor',
     r.tikSonraSayi === r.tikOnceSayi - 1 && r.ekrandaCikti,
     r.tikOnceSayi + ' → ' + r.tikSonraSayi + ' · ekrandan gitti: ' + r.ekrandaCikti);
  k('★ çıkarma ANINDA tarayıcıya yazılıyor (Kaydet yok)',
     r.yereldenCikti && r.yereldeSayi === r.tikOnceSayi - 1,
     'yerelde ' + r.yereldeSayi + ' madde · gitti: ' + r.yereldenCikti);
  k('★ maddelerin HEPSİ tikli geliyor (tiksiz satır yok)',
     r.tiksizSatir === 0, 'tiksiz satır: ' + r.tiksizSatir);
  k('★ ikinci silme yolu YOK ("×" ve "İşaretleri temizle" kalktı)',
     r.temizleDugmesi === false && r.silDugmesi === 0,
     'temizle: ' + r.temizleDugmesi + ' · ×: ' + r.silDugmesi);
  k('sayaç listede kaç madde olduğunu yazıyor',
     r.sayacMetni !== r.tikOnceSayac && /\d/.test(r.sayacMetni),
     r.tikOnceSayac + ' → ' + r.sayacMetni);
  k('boş not kutusu satırda yer KAPLAMIYOR', r.notKutusuGizli);
  k('sahada yazılan not kaydediliyor', r.notKaydedildi);
  k('kütüphane penceresi açılıyor', r.kutuphaneAcildi);
  k('yeni madde kütüphaneye girdi', r.kutuphanedeVar);
  k('yeni madde açık listeye de girdi', r.listedeVar);
  k('toplu yapıştırmada kutu/tire/numara temizleniyor',
     r.topluAdlar.indexOf('Osmo Action 4') !== -1 && r.topluAdlar.indexOf('Yedek pil') !== -1, r.topluAdlar);
  k('zaten olan madde ikinci kez girmiyor', r.powerbankSayisi === 1, r.powerbankSayisi);
  k('toplu eklenenler listeye DEĞİL kütüphaneye giriyor', r.listeyeGirmedi);
  k('toplu ekleme kaç tane eklendiğini söylüyor', /3/.test(r.topluNot), r.topluNot);
  k('kütüphaneden seçmek listeye ekliyor', r.osmoListede);
  k('tekrar basmak listeden çıkarıyor', r.osmoCikti);
  k('projeden çıkarmak KÜTÜPHANEYİ bozmuyor', r.osmoKutuphanede);
  k('mekan notu değişince madde metni tazeleniyor', r.izinMetniTazelendi);
  k('tazelenirken işaret korunuyor', r.izinIsaretiDuruyor);
  k('pencere kapanıyor', r.kapandi);
  // ⛔ 17 KASIM 2026: cip "bitti/toplam" idi (orn. "3/17"). Tik artik
  //    "bitti" demedigi icin pay anlamsizdi; cip LISTEDEKI MADDE
  //    SAYISINI yaziyor. Guvence ayni: cip sayiyi gosteriyor.
  k('proje satırındaki çip listedeki madde sayısını gösteriyor',
     /^[0-9]+$/.test(r.cipYazi.trim()) && Number(r.cipYazi.trim()) > 0, r.cipYazi);
  k('kütüphane tarayıcıya yazılıyor', r.kutuphaneYerelSayi >= 4, r.kutuphaneYerelSayi);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close();
  process.exit(hata ? 1 : 0);
})();
