// "BUGÜN" DÜĞMESİ — bugüne KAYDIRIYOR mu?
//
// 27 Ekim 2026, kullanıcı bildirdi: ay görünümünde sayfanın üstündeyken
// "Today"e basınca hiçbir şey olmuyor gibi görünüyor. Sebep: düğme
// yalnızca hangi ayın çizileceğini sıfırlıyor, SAYFAYI KAYDIRMIYORDU.
// Zaten doğru aydaysan ekranda hiçbir şey değişmiyordu.
//
// ⚠ EN ÖNEMLİ ÖLÇÜM GERİLEME OLANI: renderCal() TEK BAŞINA kaydırmamalı.
// Kaydırmayı renderCal'a koymak kolay ve yanlış olurdu -- kullanıcı
// takvimin başka bir yerine bakarken her kayıt değişiminde sayfa bugüne
// zıplardı.
const { chromium } = require('./araclar');

(async () => {
  const b = await chromium.launch({ });
  let hata = 0;
  const k = (a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };

  async function ac(){
    const p = await b.newPage({ viewport:{ width:1280, height:700 } });
    // ⚠ SAYFA HATALARI AYRI SAYILIYOR. Bir kez genel `hata` sayacina
    // bakildi ve "sayfa hatasi yok" olcumu, ILGISIZ bir olcum dustugu
    // icin kirmizi oldu -- yani yanlis seyi olcuyordu.
    p.sayfaHatalari = [];
    p.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); p.sayfaHatalari.push(String(e)); hata++; });
    await p.addInitScript(()=>{ try{
      localStorage.setItem('demo_seen_intro','1');
      localStorage.setItem('demo_tour_done','1');
      localStorage.setItem('demo_pitch','kapali');
    }catch(e){} });
    await p.route('**/supabase-js**', r=>r.fulfill({ status:200, contentType:'application/javascript',
      body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};' }));
    await p.route('**/goatcounter**', r=>r.abort());
    await p.goto('http://127.0.0.1:8098/app.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
    return p;
  }

  // Kaydirma 'smooth': olcmeden once oturmasini bekliyoruz. Testin
  // "bazen geciyor" olmasi, olcmemesinden beterdir.
  const dur = (p)=> p.waitForTimeout(700);
  const bugunGorunur = (p, secici)=> p.evaluate((s)=>{
    const el = document.querySelector(s);
    if(!el) return null;
    const r = el.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0;
  }, secici);

  console.log('[ay görünümü · bugün ekran dışındayken]');
  {
    const p = await ac();
    await p.evaluate(()=>{ setView('month'); scrollTo(0,0); });
    await p.waitForTimeout(300);
    const oncekiY = await p.evaluate(()=> scrollY);
    const oncekiGorunur = await bugunGorunur(p, '#calGrid .cal-day.today');
    k('başlangıçta bugün ekran dışında', oncekiGorunur === false, oncekiGorunur);

    await p.click('#todayBtn');
    await dur(p);
    const sonrakiY = await p.evaluate(()=> scrollY);
    k('★ SAYFA KAYDI', sonrakiY > oncekiY, oncekiY + ' → ' + sonrakiY);
    k('★ BUGÜN ARTIK GÖRÜNÜYOR', (await bugunGorunur(p, '#calGrid .cal-day.today')) === true);
    k('görünüm DEĞİŞMEDİ (ay görünümünde kaldı)',
      (await p.evaluate(()=> viewMode)) === 'month', await p.evaluate(()=> viewMode));
    await p.close();
  }

  console.log('[buguneKaydir TEK BAŞINA · görünürken oynamamalı]');
  {
    // ⚠ BURADA DUGMEYE BASILMIYOR, fonksiyon DOGRUDAN cagriliyor --
    // ve sebebi olculdu: dugme once renderCal() calistiriyor, o da
    // #calGrid'i bastan kuruyor; izgara bir an yok olunca tarayici
    // kaydirma konumunu KIRPIYOR. Yani dugmeye basildiginda sayfa
    // zaten oynuyor ve bu ESKIDEN BERI boyle, eklenen kaydirmadan
    // degil. 'nearest' secimi yalnizca fonksiyonun KENDISINDE
    // olculebilir; prob ile dogrulandi (378 -> 378).
    const p = await ac();
    await p.evaluate(()=>{
      setView('month');
      const el = document.querySelector('#calGrid .cal-day.today');
      const r = el.getBoundingClientRect();
      // Bugunu ekranin ALT tarafina getir: RAHATCA tam gorunur ama
      // ORTALANMAMIS. 'nearest' burada kipirdamaz, 'center' ortalar.
      scrollTo(0, scrollY + r.top - (innerHeight - r.height - 80));
    });
    await dur(p);
    const once = await p.evaluate(()=> scrollY);
    k('hazırlıkta bugün tam görünür',
      (await p.evaluate(()=>{
        const r = document.querySelector('#calGrid .cal-day.today').getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      })) === true);
    k('hazırlıkta bugün ORTALANMADI (ölçüm anlamlı olsun)',
      (await p.evaluate(()=>{
        const r = document.querySelector('#calGrid .cal-day.today').getBoundingClientRect();
        return Math.abs((r.top + r.bottom) / 2 - innerHeight / 2) > 60;
      })) === true);
    await p.evaluate(()=> buguneKaydir());
    await dur(p);
    const sonra = await p.evaluate(()=> scrollY);
    k('★ GÖRÜNÜRKEN SAYFA OYNAMIYOR', sonra === once, once + ' → ' + sonra);
    await p.close();
  }

  console.log('[düğme · zaten bugündeyken de bugünü görünür bırakıyor]');
  {
    // Dugmeye basinca renderCal izgarayi bastan kuruyor ve kaydirma
    // kirpiliyor; o yuzden burada "sayfa oynamadi" DEGIL, "bugun
    // gorunur kaldi" olculuyor. Kullaniciya soz verilen de bu.
    const p = await ac();
    await p.evaluate(()=>{ setView('month'); buguneKaydir(); });
    await dur(p);
    await p.click('#todayBtn');
    await dur(p);
    k('★ bugün yine görünür', (await bugunGorunur(p, '#calGrid .cal-day.today')) === true);
    k('ay görünümünde kaldı', (await p.evaluate(()=> viewMode)) === 'month');
    await p.close();
  }

  console.log('[başka aya gidip dönmek]');
  {
    const p = await ac();
    await p.evaluate(()=>{ setView('month'); scrollTo(0,0); });
    await p.click('#nextBtn'); await p.click('#nextBtn');
    await p.waitForTimeout(300);
    k('ileri gidince bugün çizilmiyor',
      (await p.evaluate(()=> !document.querySelector('#calGrid .cal-day.today'))) === true);
    await p.click('#todayBtn');
    await dur(p);
    k('★ ay geri geldi VE bugün görünüyor',
      (await bugunGorunur(p, '#calGrid .cal-day.today')) === true);
    await p.close();
  }

  console.log('[tablo görünümü · fonksiyon doğrudan]');
  {
    // ⚠ DUGMEYE BASILMIYOR, fonksiyon DOGRUDAN cagriliyor. Ilk
    // yazilista dugmeye basiliyordu ve mutasyon testi yakaladi:
    // renderCal tabloyu bastan kurunca kaydirma 0'a KIRPILIYOR ve
    // bugunun satiri zaten 0'da gorunur oldugu icin olcum, secici
    // tamamen yanlis olsa bile geciyordu ("437 -> 0" kaydirma degil,
    // kirpmaydi). Simdi kirpma araya girmiyor.
    const p = await ac();
    await p.evaluate(()=>{ setView('table'); scrollTo(0, 0); });
    await p.waitForTimeout(400);
    await p.evaluate(()=>{
      const el = document.querySelector('#calTableWrap tr.ct-today');
      const r = el.getBoundingClientRect();
      scrollTo(0, scrollY + r.bottom + 120);   // bugunu ekranin USTUNDEN cikar
    });
    await p.waitForTimeout(300);
    const once = await p.evaluate(()=> scrollY);
    k('hazırlıkta bugün satırı ekran dışında',
      (await bugunGorunur(p, '#calTableWrap tr.ct-today')) === false);
    const sonuc = await p.evaluate(()=> buguneKaydir());
    await dur(p);
    k('★ tabloda bugün satırı bulundu', sonuc === true, sonuc);
    k('★ TABLODA SAYFA KAYDI', (await p.evaluate(()=> scrollY)) !== once,
      once + ' → ' + (await p.evaluate(()=> scrollY)));
    k('★ bugün satırı artık görünüyor',
      (await bugunGorunur(p, '#calTableWrap tr.ct-today')) === true);
    k('tablo görünümünde kaldı', (await p.evaluate(()=> viewMode)) === 'table');
    await p.close();
  }

  console.log('[hafta görünümü]');
  {
    const p = await ac();
    await p.evaluate(()=>{ setView('week'); scrollTo(0,0); });
    await p.waitForTimeout(400);
    const sonuc = await p.evaluate(()=> buguneKaydir());
    k('★ haftada bugün sütunu bulunuyor', sonuc === true, sonuc);
    // Yalnizca "true dondu" yetmiyordu: yanlis secici de bir sey bulup
    // true donebilirdi. Bulunan sey BUGUNUN sutun basligi mi?
    k('★ bulunan şey bugünün sütun başlığı',
      (await p.evaluate(()=>{
        const el = document.querySelector('.hg-dayhead.today');
        return !!el && el.classList.contains('hg-dayhead') && el.classList.contains('today');
      })) === true);
    k('hafta görünümünde kaldı', (await p.evaluate(()=> viewMode)) === 'week');
    await p.close();
  }

  console.log('[GERİLEME · renderCal TEK BAŞINA kaydırmamalı]');
  {
    const p = await ac();
    await p.evaluate(()=>{ setView('month'); scrollTo(0,0); });
    await p.waitForTimeout(300);
    const once = await p.evaluate(()=> scrollY);
    await p.evaluate(()=> renderCal());
    await dur(p);
    const sonra = await p.evaluate(()=> scrollY);
    k('★ renderCal sayfayı BUGÜNE ZIPLATMIYOR', sonra === once, once + ' → ' + sonra);
    await p.close();
  }

  console.log('[bugün yokken patlamıyor]');
  {
    const p = await ac();
    await p.evaluate(()=>{ setView('month'); });
    const sonuc = await p.evaluate(()=>{
      // Bugun hucresini elle kaldiriyoruz: suzgec gizlemis ya da pencere
      // bugunu kapsamiyor haliyle ayni.
      const el = document.querySelector('#calGrid .cal-day.today');
      if(el) el.classList.remove('today');
      return buguneKaydir();
    });
    k('★ bulamayınca false dönüyor, hata vermiyor', sonuc === false, sonuc);
    k('sayfa hatası yok', p.sayfaHatalari.length === 0, p.sayfaHatalari.join(' | '));
    await p.close();
  }

  console.log('[“Today 55” düğmesine DOKUNULMADI]');
  {
    // Kullanici acikca "ona dokunma" dedi. Ayri bir dugme, ayri is:
    // bugune ait kayitlari SUZUYOR, takvimi kaydirmiyor.
    const p = await ac();
    await p.evaluate(()=>{ setView('month'); scrollTo(0,0); });
    await p.waitForTimeout(300);
    const varMi = await p.evaluate(()=> !!document.querySelector('.bugun-btn'));
    k('süzgeç düğmesi hâlâ yerinde', varMi === true);
    const once = await p.evaluate(()=> scrollY);
    await p.evaluate(()=>{ const d = document.querySelector('.bugun-btn'); if(d) d.click(); });
    await dur(p);
    const sonra = await p.evaluate(()=> scrollY);
    k('★ süzgeç düğmesi takvimi KAYDIRMIYOR (davranışı değişmedi)',
      sonra === once, once + ' → ' + sonra);
    await p.close();
  }

  console.log(hata ? '\n' + hata + ' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata ? 1 : 0);
})();
