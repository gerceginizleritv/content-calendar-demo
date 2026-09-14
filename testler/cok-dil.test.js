// COK DILLI BASLIK VE ACIKLAMA.
//
// YouTube tek videoya birden cok dilde baslik/aciklama tasiyor, izleyici
// kendi dilinde goruyor. Uygulamada bunun hazirlandigi yer yoktu.
//
// Burada tutulan sey ucu: (1) serit YALNIZCA YouTube uzun video ve
// Shorts'ta cikiyor mu, (2) sekme degistirince yazilan kayboluyor mu,
// (3) kaydedince ana dil normal alanlarda, ekler content.diller'de mi
// duruyor. Ucuncusu en onemlisi: ana dili ek dille ezmek, kullanicinin
// Turkce aciklamasini sessizce silmek demek.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const durum = p => p.evaluate(()=>({
  gizli: document.getElementById('dilSeritWrap').hidden,
  sekmeler: [...document.querySelectorAll('#dilSerit .dil-sek')]
              .filter(e=> !e.classList.contains('dil-sek-ekle'))
              .map(e=> e.textContent.replace('×','').trim()),
  acik: (document.querySelector('#dilSerit .dil-sek.acik')||{textContent:''})
          .textContent.replace('×','').trim(),
  baslik: document.getElementById('f_videotitle').value,
  aciklama: document.getElementById('f_caption').value
}));

const alanlariDoldur = (p, baslik, aciklama) => p.evaluate(([b,a])=>{
  document.getElementById('f_videotitle').value = b;
  document.getElementById('f_caption').value = a;
}, [baslik, aciklama]);

(async () => {
  const t = await chromium.launch();
  const p = await (await t.newContext({ viewport:{ width:1280, height:1000 } })).newPage();
  const hata = []; p.on('pageerror', e=> hata.push(String(e)));
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**supabase.co**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());

  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });

  console.log('[serit yalnizca YouTube video/shorts icin]');
  await p.evaluate(()=>{ openModal(null, '2026-09-20', '10:00'); });
  await p.waitForTimeout(400);
  // Duzenleme kipindeki tekli secicileri kullanabilmek icin once bir kayit
  // acmak gerekiyor; yeni kayitta coklu kutular var. Ikisini de deniyoruz.
  const kip = async (tur, platform)=>{
    await p.evaluate(([tp,pf])=>{
      const t = document.getElementById('f_type'), q = document.getElementById('f_platform');
      document.getElementById('platformMultiWrap').style.display = 'none';
      t.value = tp; q.value = pf;
      t.dispatchEvent(new Event('change'));
      q.dispatchEvent(new Event('change'));
    }, [tur, platform]);
    await p.waitForTimeout(250);
    return durum(p);
  };
  bak('YouTube + uzun video → serit var',   (await kip('video','youtube')).gizli === false);
  bak('YouTube + shorts → serit var',       (await kip('shorts','youtube')).gizli === false);
  bak('YouTube + reels → serit yok',        (await kip('reels','youtube')).gizli === true);
  bak('Instagram + reels → serit yok',      (await kip('reels','instagram')).gizli === true);
  bak('Instagram + uzun video → serit yok', (await kip('video','instagram')).gizli === true);

  console.log('[sekmeler ve metinler]');
  await kip('video','youtube');
  await alanlariDoldur(p, 'Sokollu Köprüsü', 'Mimar Sinan\'ın köprüsü.');
  await p.evaluate(()=> dilSeridiCiz());
  let d = await durum(p);
  bak('tek sekme, ana dil açık', d.sekmeler.length === 1 && d.acik === 'Türkçe', d.sekmeler.join('|'));

  await p.evaluate(()=> dilEkle('en'));
  await p.waitForTimeout(200);
  d = await durum(p);
  bak('dil eklenince o dile geçildi', d.acik === 'English', d.acik);
  bak('yeni dilin kutuları boş', d.baslik === '' && d.aciklama === '', d.baslik + '|' + d.aciklama);

  await alanlariDoldur(p, 'The Bridge of Sokollu', 'Sinan\'s bridge.');
  await p.evaluate(()=> dileGec('_ana'));
  await p.waitForTimeout(200);
  d = await durum(p);
  bak('ana dile dönünce Türkçe metin yerinde',
      d.baslik === 'Sokollu Köprüsü' && d.aciklama === 'Mimar Sinan\'ın köprüsü.', d.baslik);

  await p.evaluate(()=> dileGec('en'));
  await p.waitForTimeout(200);
  d = await durum(p);
  bak('İngilizceye dönünce İngilizce metin yerinde',
      d.baslik === 'The Bridge of Sokollu', d.baslik);

  console.log('[kaydetme]');
  // Ingilizce sekmesi ACIKKEN kaydediliyor: ana dilin ezilmedigini gormek
  // icin en kritik an burasi.
  const paket = await p.evaluate(()=> dilleriTopla());
  bak('ana dil Türkçe metni taşıyor',
      paket.ana.videoTitle === 'Sokollu Köprüsü', paket.ana.videoTitle);
  bak('ek dil İngilizce metni taşıyor',
      paket.ek.en && paket.ek.en.videoTitle === 'The Bridge of Sokollu',
      JSON.stringify(paket.ek).slice(0,120));
  bak('ana dil kodu kayıtlı', paket.anaDil === 'tr', paket.anaDil);

  console.log('[boş dil kaydedilmiyor]');
  await p.evaluate(()=>{ dilEkle('de'); });
  await p.waitForTimeout(200);
  const paket2 = await p.evaluate(()=> dilleriTopla());
  bak('boş Almanca kaydedilmedi', !paket2.ek.de, JSON.stringify(Object.keys(paket2.ek)));

  console.log('[damga]');
  const rozet = await p.evaluate(()=> dilRozeti({
    type:'video', platform:'youtube',
    content:{ anaDil:'tr', diller:{ en:{ caption:'x' }, de:{} } } }));
  bak('damgada dolu diller var', /TR/.test(rozet) && /EN/.test(rozet), rozet);
  bak('damgada boş dil yok', !/DE/.test(rozet), rozet);
  const rozet2 = await p.evaluate(()=> dilRozeti({
    type:'reels', platform:'instagram',
    content:{ anaDil:'tr', diller:{ en:{ caption:'x' } } } }));
  bak('YouTube dışında damga yok', rozet2 === '', rozet2);

  console.log('[serit kapanınca veri durur]');
  await p.evaluate(()=> dileGec('en'));
  await kip('reels','instagram');
  const paket3 = await p.evaluate(()=> dilleriTopla());
  bak('platform değişince çeviri silinmedi',
      paket3.ek.en && paket3.ek.en.videoTitle === 'The Bridge of Sokollu',
      JSON.stringify(Object.keys(paket3.ek)));
  bak('serit kapanınca ana dil kutularda',
      (await durum(p)).baslik === 'Sokollu Köprüsü');

  console.log('[yeni kayıt: çeviri yalnızca uygun kayıtlara]');
  // Tek pencereden dört kayıt çıkıyor (video+shorts x youtube+instagram).
  // Çeviri yalnızca YouTube uzun video ve Shorts kayıtlarına yazılmalı;
  // Instagram kayıtlarına bulaşırsa kullanıcı asla kullanmayacağı veriyi
  // taşımaya başlar ve yedek boşuna şişer.
  await p.evaluate(()=>{
    projects = [{ id:'p1', name:'Deneme', type:'other', keywords:'', notes:'', address:'',
      shootDate:'', script:false, shot:false, edited:false, published:false, permit:false,
      cancelled:false, deadlines:{}, createdAt:Date.now() }];
    saveProjects(); events = []; save();
    openModal(null, '2026-09-21', '10:00');
  });
  await p.waitForTimeout(500);
  await p.evaluate(()=>{
    document.getElementById('f_project').value = 'p1';
    document.getElementById('f_project').dispatchEvent(new Event('change'));
    document.querySelectorAll('#typeChecks input').forEach(el=>{
      el.checked = (el.value === 'video' || el.value === 'reels');
    });
    document.querySelectorAll('#platformChecks input').forEach(el=>{
      el.checked = (el.value === 'youtube' || el.value === 'instagram');
    });
    document.getElementById('typeChecks').dispatchEvent(new Event('change'));
    document.getElementById('f_title').value = 'Sokollu';
  });
  await p.waitForTimeout(300);
  bak('çoklu seçimde de şerit çıkıyor',
      (await p.evaluate(()=> document.getElementById('dilSeritWrap').hidden)) === false);
  await p.evaluate(()=>{
    document.getElementById('f_videotitle').value = 'Sokollu Köprüsü';
    dilEkle('en');
    document.getElementById('f_videotitle').value = 'The Bridge of Sokollu';
  });
  await p.waitForTimeout(200);
  await p.click('#saveBtn');
  await p.waitForTimeout(700);
  const kayitlar = await p.evaluate(()=> events.map(e=>({
    tur:e.type, pf:e.platform, dil: e.content && e.content.diller ? Object.keys(e.content.diller) : [],
    baslik: e.content && e.content.videoTitle
  })));
  bak('dört kayıt oluştu', kayitlar.length === 4, JSON.stringify(kayitlar).slice(0,200));
  const yt = kayitlar.find(x=> x.pf==='youtube' && x.tur==='video');
  const ig = kayitlar.find(x=> x.pf==='instagram' && x.tur==='reels');
  bak('YouTube uzun videoda çeviri var', yt && yt.dil.indexOf('en') !== -1, JSON.stringify(yt));
  bak('YouTube kaydının ana dili Türkçe metin', yt && yt.baslik === 'Sokollu Köprüsü', yt && yt.baslik);
  bak('Instagram reels\'e çeviri bulaşmadı', ig && ig.dil.length === 0, JSON.stringify(ig));

  bak('js hatası yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
