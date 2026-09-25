// ÖRNEK ŞERİDİ — kullanıcıya söyleniyor mu, çıkış yolu var mı?
//
// Veri tarafı ornek-veri.test.js'te: işaret, dil, toplu kaldırma.
// Burada ölçülen şey ARAYÜZ: kullanıcı bunların örnek olduğunu nereden
// anlıyor ve nasıl kurtuluyor.
//
// Üç ayrı yerden:
//   · takvimin üstündeki şerit (zaten baktığı yer),
//   · alttaki kalıcı düğme (şerit gizlenmiş olsa bile duruyor),
//   · kendi ilk kaydını girdiğinde bir kez sorulan soru.
//
// Şerit örnek kalmadığı an kayboluyor -- kullanıcı örnekleri tek tek de
// silebiliyor ve o yolların hiçbiri şeridi ayrıca güncellemiyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const durum = (p)=> p.evaluate(()=> ({
  serit:  !document.getElementById('ornekSerit').hidden,
  metin:  document.getElementById('ornekSeritMetin').textContent,
  dip:    !document.getElementById('ornekKaldirBtn').hidden,
  ornekCip: document.querySelectorAll('#calGrid .cal-chip.ornek').length,
  toplamCip: document.querySelectorAll('#calGrid .cal-chip').length,
  ornekVar: ornekVarMi()
}));

async function ac(t, locale, oncesi){
  const c = await t.newContext({ viewport:{ width:1280, height:1000 }, locale: locale || 'tr-TR' });
  const p = await c.newPage();
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**supabase.co**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());
  if(oncesi) await p.addInitScript(oncesi);
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1700);
  await p.evaluate(()=> document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')));
  await p.waitForTimeout(250);
  return { c, p };
}

(async () => {
  const t = await chromium.launch();

  console.log('[şerit ilk açılışta duruyor]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    const s = await durum(p);
    bak('şerit görünür', s.serit === true);
    bak('kaç örnek olduğunu söylüyor', /8/.test(s.metin), s.metin);
    bak('"senin işin değil" diyor', /senin işin değil/i.test(s.metin), s.metin);
    bak('alttaki kalıcı düğme de açık', s.dip === true);
    // Takvimde de ayırt ediliyor: kullanıcı kendi kayıtlarını girdikten
    // sonra hangisinin örnek olduğunu görebilmeli.
    bak('örnek çipler işaretli', s.ornekCip === 8 && s.ornekCip === s.toplamCip,
        s.ornekCip + '/' + s.toplamCip);
    bak('çipin üstünde açıklama var',
        await p.evaluate(()=> document.querySelector('#calGrid .cal-chip.ornek').title.length > 3));
    await c.close();
  }

  console.log('[ASIL OLCUM: düğme örnekleri kaldırıyor]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    await p.evaluate(()=>{ window.onayla = async ()=> true; });
    await p.click('#ornekKaldirBtn2');
    await p.waitForTimeout(500);
    const s = await durum(p);
    bak('örnek kalmadı', s.ornekVar === false, JSON.stringify(s));
    bak('şerit kendiliğinden kayboldu', s.serit === false);
    bak('alttaki düğme de kayboldu', s.dip === false);
    bak('takvim boşaldı', s.toplamCip === 0, String(s.toplamCip));
    bak('kaç şey kalktığı söyleniyor',
        await p.evaluate(()=> (document.querySelector('.toast, #toast') || {}).textContent || '')
          .then(x=> /8/.test(x)),
        await p.evaluate(()=> (document.querySelector('.toast, #toast') || {}).textContent || ''));
    await c.close();
  }

  console.log('[vazgeçilirse hiçbir şey olmuyor]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    await p.evaluate(()=>{ window.onayla = async ()=> false; });
    await p.click('#ornekKaldirBtn2');
    await p.waitForTimeout(400);
    const s = await durum(p);
    bak('hayır denince örnekler duruyor', s.ornekVar === true && s.serit === true, JSON.stringify(s));
    await c.close();
  }

  console.log('[× şeridi gizliyor ama çıkış yolunu kapatmıyor]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    await p.click('#ornekSeritX');
    await p.waitForTimeout(300);
    let s = await durum(p);
    bak('şerit gizlendi', s.serit === false);
    bak('örnekler DURUYOR (× silmiyor)', s.ornekVar === true);
    // Asıl mesele: gizleyen kişi kaldırma yolunu kaybetmemeli.
    bak('alttaki düğme hâlâ açık', s.dip === true);
    await p.reload({ waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1700);
    await p.evaluate(()=> document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')));
    s = await durum(p);
    bak('gizleme hatırlanıyor', s.serit === false);
    bak('yeniden yüklemede de düğme açık', s.dip === true);
    await c.close();
  }

  console.log('[ilk gerçek kayıtta bir kez soruluyor]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    const soru = await p.evaluate(async ()=>{
      let sorulan = '';
      window.onayla = async (m)=>{ sorulan = String(m); return true; };
      openModal(null, '2026-09-20');
      document.getElementById('f_title').value = 'Benim ilk kaydım';
      document.querySelector('#typeChecks input').checked = true;
      document.querySelector('#platformChecks input').checked = true;
      document.getElementById('f_time').value = '10:00';
      document.getElementById('saveBtn').click();
      await new Promise(r=> setTimeout(r, 900));
      return sorulan;
    });
    bak('ilk kayıttan sonra soruluyor', /örnek/i.test(soru), soru);
    const s = await durum(p);
    bak('evet denince örnekler kalktı', s.ornekVar === false, JSON.stringify(s));
    bak('kullanıcının kaydı DURUYOR',
        await p.evaluate(()=> events.length === 1 && events[0].title === 'Benim ilk kaydım'),
        await p.evaluate(()=> events.map(e=> e.title).join(',')));

    // İkinci kayıtta bir daha sorulmuyor.
    const ikinci = await p.evaluate(async ()=>{
      let sorulan = '';
      window.onayla = async (m)=>{ sorulan = String(m); return true; };
      openModal(null, '2026-09-21');
      document.getElementById('f_title').value = 'İkinci kayıt';
      document.querySelector('#typeChecks input').checked = true;
      document.querySelector('#platformChecks input').checked = true;
      document.getElementById('f_time').value = '11:00';
      document.getElementById('saveBtn').click();
      await new Promise(r=> setTimeout(r, 900));
      return sorulan;
    });
    bak('ikinci kayıtta bir daha sorulmuyor', ikinci === '', ikinci);
    await c.close();
  }

  console.log('["hayır" de bir cevap: bir daha sorulmuyor]');
  {
    const { c, p } = await ac(t, 'tr-TR');
    const r = await p.evaluate(async ()=>{
      let kac = 0;
      window.onayla = async ()=>{ kac++; return false; };
      const kaydet = async (baslik, tarih)=>{
        openModal(null, tarih);
        document.getElementById('f_title').value = baslik;
        document.querySelector('#typeChecks input').checked = true;
        document.querySelector('#platformChecks input').checked = true;
        document.getElementById('f_time').value = '10:00';
        document.getElementById('saveBtn').click();
        await new Promise(x=> setTimeout(x, 900));
      };
      await kaydet('Bir', '2026-09-20');
      await kaydet('İki', '2026-09-21');
      return { kac, ornekVar: ornekVarMi() };
    });
    bak('yalnızca bir kez soruldu', r.kac === 1, String(r.kac));
    bak('hayır denince örnekler duruyor', r.ornekVar === true);
    const s = await durum(p);
    bak('şerit de duruyor (yol açık kalıyor)', s.serit === true);
    await c.close();
  }

  console.log('[ingilizce]');
  {
    const { c, p } = await ac(t, 'en-US');
    const s = await durum(p);
    bak('ingilizce metin', /sample/i.test(s.metin) && !/örnek/i.test(s.metin), s.metin);
    bak('düğme ingilizce',
        await p.evaluate(()=> /remove/i.test(document.getElementById('ornekKaldirBtn2').textContent)),
        await p.evaluate(()=> document.getElementById('ornekKaldirBtn2').textContent));
    await c.close();
  }

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
