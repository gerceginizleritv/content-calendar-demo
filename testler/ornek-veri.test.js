// ÖRNEK VERİ — işaretli mi, kullanıcının dilinde mi, toplu kalkıyor mu?
//
// Boş bir takvim hiçbir şey anlatmıyor, o yüzden ilk açılışta örnekler
// duruyor. Ama eski hâlinde üç ayrı sorun vardı:
//
//   · Hiçbir işaret taşımıyorlardı ve kullanıcının kendi kayıtlarıymış
//     gibi hesaba yazılıyorlardı -- "ben başkasının hesabına mı girdim?"
//   · Tek tek silmek gerekiyordu; ürünün ilk beş dakikası temizlik işi.
//   · 8 kayıt vardı ama 0 proje, 0 mekân. Tur "önce projeni aç, mekânını
//     seç" diye anlatırken ekranda ne proje ne mekân görünüyordu.
//
// Ölçülen şey işaretin VARLIĞI değil, KALICILIĞI ve KAPSAMI: yeniden
// yüklemede duruyor mu, "kaldır" tam olarak örnekleri mi alıyor,
// kaldırıldıktan sonra geri geliyor mu.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const say = (p)=> p.evaluate(()=> ({
  kayit: events.length,          ornekKayit: events.filter(ornekKayitMi).length,
  proje: projects.length,        ornekProje: projects.filter(ornekProjeMi).length,
  mekan: mekanlar.length,        ornekMekan: mekanlar.filter(ornekMekanMi).length,
  bagli: events.filter(e=> e.content && e.content.projectId).length,
  ornekVar: ornekVarMi(),
  basliklar: events.map(e=> e.title),
  projeAdlari: projects.map(x=> x.name)
}));

async function ac(t, locale, oncesi){
  const c = await t.newContext({ viewport:{ width:1280, height:900 }, locale });
  const p = await c.newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**supabase.co**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());
  if(oncesi) await p.addInitScript(oncesi);
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1600);
  await p.evaluate(()=> document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')));
  return { c, p };
}

(async () => {
  const t = await chromium.launch();

  console.log('[ilk açılış: gerçek bir akış kuruluyor]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    const s = await say(p);
    bak('8 örnek kayıt', s.kayit === 8 && s.ornekKayit === 8, JSON.stringify(s));
    // Eski hâlin asıl kusuru buydu: kayıt vardı, proje yoktu.
    bak('2 örnek proje de var', s.proje === 2 && s.ornekProje === 2, JSON.stringify(s));
    bak('1 örnek mekân da var', s.mekan === 1 && s.ornekMekan === 1, JSON.stringify(s));
    bak('kayıtların HEPSİ bir projeye bağlı', s.bagli === 8, String(s.bagli));
    bak('proje mekâna bağlı',
        await p.evaluate(()=> (projects[0].placeIds||[]).length === 1
                           && projects[0].placeIds[0] === mekanlar[0].id));
    await c.close();
  }

  console.log('[kullanıcının dilinde]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    const s = await say(p);
    bak('türkçe tarayıcı → türkçe kayıt', /Ürün Tanıtımı/.test(s.basliklar[0]), s.basliklar[0]);
    bak('türkçe proje adı', s.projeAdlari.join('|') === 'Ürün Tanıtımı|Kısa İpuçları', s.projeAdlari.join('|'));
    await c.close();
  }
  {
    const { c, p } = await ac(t, 'en-US');
    const s = await say(p);
    bak('ingilizce tarayıcı → ingilizce kayıt', /Product Launch/.test(s.basliklar[0]), s.basliklar[0]);
    bak('ingilizce proje adı', s.projeAdlari.join('|') === 'Product Launch|Quick Tips', s.projeAdlari.join('|'));
    await c.close();
  }

  console.log('[yapı tek kopya, metin dile göre]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    const olcu = await p.evaluate(()=> ({
      yapi: ORNEK_YAPI.length,
      tr: { k: ORNEK_METIN.tr.kayitlar.length, p: ORNEK_METIN.tr.projeler.length, m: ORNEK_METIN.tr.mekanlar.length },
      en: { k: ORNEK_METIN.en.kayitlar.length, p: ORNEK_METIN.en.projeler.length, m: ORNEK_METIN.en.mekanlar.length },
      // Yapıdaki proje numaraları gerçekten var olan projeleri göstermeli.
      projeNo: ORNEK_YAPI.map(y=> y.proje)
    }));
    // Yapı ile metin ayrışırsa bazı kayıtlar başlıksız doğar; ölçüm bunu
    // sayı eşitliğiyle yakalıyor.
    bak('metin listeleri yapıyla aynı uzunlukta',
        olcu.tr.k === olcu.yapi && olcu.en.k === olcu.yapi, JSON.stringify(olcu));
    bak('iki dilde aynı sayıda proje ve mekân',
        olcu.tr.p === olcu.en.p && olcu.tr.m === olcu.en.m, JSON.stringify(olcu));
    bak('yapıdaki proje numaraları mevcut',
        olcu.projeNo.every(n=> n < olcu.tr.p), JSON.stringify(olcu.projeNo));
    bak('hiçbir örnek başlıksız doğmadı',
        (await say(p)).basliklar.every(x=> x && x.length > 3));
    await c.close();
  }

  console.log('[ASIL OLCUM: işaret yeniden yüklemede duruyor]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    await p.reload({ waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1600);
    const s = await say(p);
    // sanitizeEvent beyaz listesinden düşerse işaret burada kaybolur ve
    // "Örnekleri kaldır" hiçbir şey bulamaz.
    bak('kayıt işareti hayatta', s.ornekKayit === 8, JSON.stringify(s));
    bak('proje işareti hayatta', s.ornekProje === 2, JSON.stringify(s));
    bak('mekân işareti hayatta', s.ornekMekan === 1, JSON.stringify(s));
    await c.close();
  }

  console.log('[toplu kaldırma: tam olarak örnekler]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    // Kullanıcının KENDİ kaydı, üstelik örnek projeye bağlı.
    await p.evaluate(()=>{
      events.push(sanitizeEvent({ id:'benim1', type:'video', platform:'youtube',
        title:'Benim gerçek kaydım', date:'2026-10-01', time:'10:00',
        content:{ projectId: projects[0].id } }));
      save();
    });
    const sonuc = await p.evaluate(()=> ornekleriKaldir());
    bak('kaç şey kalktığı dönüyor',
        sonuc.kayit === 8 && sonuc.proje === 2 && sonuc.mekan === 1, JSON.stringify(sonuc));
    const s = await say(p);
    bak('örnek kalmadı', s.ornekVar === false, JSON.stringify(s));
    bak('kullanıcının kaydı DURUYOR',
        s.kayit === 1 && s.basliklar[0] === 'Benim gerçek kaydım', JSON.stringify(s.basliklar));
    // Örnek proje giderken kullanıcının kaydını da götüremez; bağ kopuyor,
    // kayıt kalıyor.
    bak('giden projenin bağı koptu',
        await p.evaluate(()=> !events[0].content.projectId),
        await p.evaluate(()=> events[0].content.projectId));

    await p.reload({ waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1600);
    const s2 = await say(p);
    bak('kaldırılan örnekler GERİ GELMİYOR', s2.ornekVar === false, JSON.stringify(s2));
    bak('kullanıcının kaydı hâlâ yerinde', s2.kayit === 1, JSON.stringify(s2.basliklar));
    await c.close();
  }

  // ⚠ Yukarıdaki "geri gelmiyor" ölçümü TEK BAŞINA yeterli değil:
  // kullanıcının kendi kaydı durduğu için boş-mu kontrolü zaten yeniden
  // kurmayı engelliyor ve kaldırma işareti ölçülmeden geçiyordu
  // (mutasyonla görüldü). Burada ekran TAMAMEN boşaltılıyor; geri
  // gelmemesinin tek sebebi artık işaretin kendisi.
  console.log('[her şey silindikten sonra da geri gelmiyor]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    await p.evaluate(()=>{
      ornekleriKaldir();
      events.forEach(e=> markRemoved(e.id));
      events = []; save();
    });
    let s = await say(p);
    bak('ekran gerçekten boş (ölçüm boş değil)',
        s.kayit === 0 && s.proje === 0 && s.mekan === 0, JSON.stringify(s));
    await p.reload({ waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1600);
    s = await say(p);
    bak('bomboş ekrana örnekler GERİ GELMİYOR',
        s.kayit === 0 && s.proje === 0 && s.mekan === 0, JSON.stringify(s));
    await c.close();
  }

  console.log('[işaret düzenlemede kalıyor, KOPYAYA geçmiyor]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    // Bir örneği açıp Kaydet'e basmak onu sessizce "gerçek kayda"
    // çevirseydi, "Örnekleri kaldır" onu geride bırakırdı. content
    // formdan baştan kuruluyor; işaret açıkça taşınıyor.
    const duzenle = await p.evaluate(async ()=>{
      const ornek = events.find(ornekKayitMi);
      openModal(ornek);
      document.getElementById('f_title').value = 'Başlığı değiştirdim';
      document.getElementById('saveBtn').click();
      await new Promise(r=> setTimeout(r, 700));
      const e = events.find(x=> x.title === 'Başlığı değiştirdim');
      return { bulundu: !!e, hala: e ? ornekKayitMi(e) : null };
    });
    bak('düzenlenen örnek kaydedildi', duzenle.bulundu === true);
    bak('düzenlenince işaret DURUYOR', duzenle.hala === true, JSON.stringify(duzenle));

    // Klonlama ise YENİ bir kayıt ve işareti taşımamalı, yoksa
    // kullanıcının kendi kaydı "Örnekleri kaldır" ile silinirdi.
    // Güvence tek bir satırda değil, kaydetme yolundaki content
    // nesnesinin kendisinde: alanları tek tek sayıyor, eski content'i
    // yaymıyor. Bu ölçüm o tasarımın bekçisi -- biri content'i
    // currentEvent.content üzerinden kurmaya kalkarsa burada düşer.
    const klon = await p.evaluate(async ()=>{
      const ornek = events.find(ornekKayitMi);
      openModal(ornek);
      document.getElementById('cloneBtn').click();
      await new Promise(r=> setTimeout(r, 300));
      document.getElementById('f_title').value = 'Kopyam';
      document.getElementById('f_date').value = '2026-09-25';
      document.getElementById('f_time').value = '09:00';
      document.querySelectorAll('#typeChecks input').forEach(x=> x.checked = false);
      document.querySelector('#typeChecks input').checked = true;
      document.querySelectorAll('#platformChecks input').forEach(x=> x.checked = false);
      document.querySelector('#platformChecks input').checked = true;
      document.getElementById('saveBtn').click();
      await new Promise(r=> setTimeout(r, 700));
      const e = events.find(x=> x.title === 'Kopyam');
      return { bulundu: !!e, ornek: e ? ornekKayitMi(e) : null };
    });
    bak('klon kaydedildi', klon.bulundu === true, JSON.stringify(klon));
    bak('klon ÖRNEK DEĞİL', klon.ornek === false, JSON.stringify(klon));
    await c.close();
  }

  console.log('[elinde veri olana karışılmıyor]');
  {
    const { c, p } = await ac(t, 'tr-TR', `try{
      localStorage.setItem('demo_content_calendar_v1', JSON.stringify([
        { id:'x1', type:'video', platform:'youtube', title:'Eski kaydım', date:'2026-10-02', time:'09:00', content:{} }
      ]));
    }catch(e){}`);
    const s = await say(p);
    bak('var olan kayıtların üstüne örnek eklenmiyor',
        s.kayit === 1 && s.ornekKayit === 0, JSON.stringify(s));
    bak('örnek proje de eklenmiyor', s.proje === 0 && s.mekan === 0, JSON.stringify(s));
    await c.close();
  }

  console.log('[demoyu sıfırla: tam takım geri, iki kopya değil]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    await p.evaluate(()=> ornekleriKaldir());
    await p.evaluate(()=>{ window.onayla = async ()=> true; });
    await p.click('#resetBtn'); await p.waitForTimeout(600);
    let s = await say(p);
    bak('sıfırlayınca örnekler geri geliyor',
        s.kayit === 8 && s.proje === 2 && s.mekan === 1, JSON.stringify(s));
    bak('sıfırlanan kayıtlar da projeye bağlı', s.bagli === 8, String(s.bagli));
    await p.click('#resetBtn'); await p.waitForTimeout(600);
    s = await say(p);
    bak('ikinci sıfırlama ikinci takım eklemiyor',
        s.kayit === 8 && s.proje === 2 && s.mekan === 1, JSON.stringify(s));
    await c.close();
  }

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
