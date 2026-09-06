const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1440,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1600);
  await page.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });
  console.log('FİKİR / SCRIPT — PROJEDEN BAĞIMSIZ AKIŞ');

  const r = await page.evaluate(async ()=>{
    const bekle = ms=> new Promise(r=>setTimeout(r,ms));
    const yaz = (id,v)=>{ const el=document.getElementById(id); el.value=v; return el; };

    // ---- 1) PROJESİZ FİKİR ----
    setPage('ideas');
    await bekle(150);
    document.getElementById('fk_openAdd').click();
    await bekle(120);
    yaz('fk_new','Metokhites kimdi — bürokrattan keşişe');
    document.getElementById('fk_add').click();
    await bekle(200);
    document.getElementById('fk_addCancel').click();
    await bekle(120);
    const projesizFikir = { adet: fikirler.length, bag: fikirler[0].projectId };

    // ---- 2) PROJESİZ SCRIPT ----
    setPage('scripts');
    const bosMesaj = document.getElementById('sc_list').textContent.trim();
    document.getElementById('sc_newBtn').click();
    await bekle(150);
    const yeniAcildi = document.getElementById('scriptOverlay').classList.contains('open');
    const silmeGizli = document.getElementById('sc_delete').hidden;
    yaz('sc_title','Kariye açılış');
    yaz('sc_text','AÇILIŞ — Kariye Camii, sabah ışığı.');
    document.getElementById('sc_save').click();
    await bekle(200);
    const projesizScript = { adet: scriptler.length, bag: scriptler[0].projectId, ad: scriptler[0].title };
    const kartSayisi = document.querySelectorAll('#sc_list .sc-card').length;

    // ---- 3) BOŞ TASLAK KAYDEDİLMİYOR ----
    document.getElementById('sc_newBtn').click();
    await bekle(120);
    document.getElementById('sc_save').click();
    await bekle(150);
    const bosTaslak = scriptler.length;

    // ---- 4) FİKRİ PROJEYE BAĞLA (yeni proje açarak) ----
    const eskiPrompt = window.sor; window.sor = ()=> 'Kariye Mozaikleri';
    const eskiConfirm = window.onayla; window.onayla = ()=> false;
    setPage('ideas');
    document.querySelector('#fk_list [data-fk-projbtn]').click();
    await bekle(120);
    const sel = document.querySelector('#fk_list .fk-proj-inline');
    sel.value = '__yeni__';
    sel.dispatchEvent(new Event('change'));
    await bekle(250);
    const proje = projects.find(p=>p.name==='Kariye Mozaikleri');
    const fikirBaglandi = proje && fikirler[0].projectId === proje.id;

    // ---- 5) SCRIPTİ AYNI PROJEYE BAĞLA → ADIM İŞARETLENSİN ----
    setPage('scripts');
    document.querySelector('#sc_list .sc-card').click();
    await bekle(200);
    seciliProjeler.clear(); seciliProjeler.add(proje.id);
    scriptProjeListesiCiz();
    await bekle(150);
    // Fikir listesi artik her zaman gorunur (projeye bagli degil).
    const seritGorundu = document.querySelectorAll('#sc_ideasList [data-fikir-sec]').length > 0;
    document.getElementById('sc_save').click();
    await bekle(200);
    const scriptBaglandi = scriptler[0].projectId === proje.id;
    const adimIsaretlendi = projects.find(p=>p.id===proje.id).script === true;

    // ---- 6) ADIM ELLE KALDIRILABİLİYOR, GERİ GELMİYOR ----
    const P = projects.find(p=>p.id===proje.id);
    P.script = false; saveProjects();
    scriptGuncelle(scriptler[0].id, { text: scriptler[0].text + ' Devam.' });
    await bekle(100);
    const kaldirilanIsaretGeriGelmedi = projects.find(p=>p.id===proje.id).script === false;
    P.script = true; saveProjects();

    // ---- 7) PROJE SAYFASINDA VURGULU ROZETLER ----
    setPage('projects');
    await bekle(150);
    const rozetler = [...document.querySelectorAll('.proj-table tbody tr:first-child .pn-islem > *')]
      .map(x=> x.className + '|' + x.textContent.trim());

    // ---- 8) ROZET → SÜZÜLMÜŞ SAYFA ----
    document.querySelector('[data-proj-ideas]').click();
    await bekle(200);
    const fikirSayfasi = { sayfa: !document.getElementById('ideasPage').hidden, filtre: fikirFiltresi };
    setPage('projects'); await bekle(120);
    document.querySelector('[data-proj-scripts]').click();
    await bekle(200);
    const scriptSayfasi = { sayfa: !document.getElementById('scriptsPage').hidden, filtre: scriptFiltresi };

    // ---- 9) FİLTRE ÇALIŞIYOR ----
    setPage('ideas');
    fikirEkle('Projesiz ikinci fikir', '');
    renderFikirler();
    await bekle(120);
    const filtreSel = document.getElementById('fk_filter');
    filtreSel.value = '-'; filtreSel.dispatchEvent(new Event('change'));
    await bekle(120);
    const projesizFiltre = document.querySelectorAll('#fk_list .fk-card[data-fk-card]').length;
    filtreSel.value = proje.id; filtreSel.dispatchEvent(new Event('change'));
    await bekle(120);
    const projeFiltre = document.querySelectorAll('#fk_list .fk-card[data-fk-card]').length;

    // ---- 10) "BU FİKİRLERDEN SCRIPT YAZ" ----
    document.getElementById('fk_toScript').click();
    await bekle(200);
    const iskelet = document.getElementById('sc_text').value;
    const iskeletSecili = seciliFikirler.size;
    const iskeletProje = [...seciliProjeler][0] || '';
    document.getElementById('sc_cancel').click();
    await bekle(120);
    const iskeletKaydedilmedi = scriptler.length === 1;

    // ---- 11) TEK FİKİRDEN SCRIPT ----
    document.querySelector('#fk_list [data-fk-script]').click();
    await bekle(200);
    const tekFikirMetni = document.getElementById('sc_text').value;
    document.getElementById('sc_cancel').click();

    // ---- 12) SCRIPT SİLME ----
    setPage('scripts');
    document.querySelector('#sc_list .sc-card').click();
    await bekle(150);
    window.onayla = ()=> true;
    document.getElementById('sc_delete').click();
    await bekle(200);
    const silindi = scriptler.length === 0;
    window.sor = eskiPrompt; window.onayla = eskiConfirm;

    // ---- 13) YEREL KAYIT ----
    const yerelF = JSON.parse(localStorage.getItem('demo_ideas') || '[]');
    const yerelS = JSON.parse(localStorage.getItem('demo_scripts_v2') || '[]');

    return { projesizFikir, bosMesaj, yeniAcildi, silmeGizli, projesizScript, kartSayisi,
             bosTaslak, fikirBaglandi, seritGorundu, scriptBaglandi, adimIsaretlendi,
             kaldirilanIsaretGeriGelmedi, rozetler, fikirSayfasi, scriptSayfasi,
             projesizFiltre, projeFiltre, iskelet, iskeletSecili, iskeletProje, iskeletKaydedilmedi,
             tekFikirMetni, silindi, yerelFikirAdet: yerelF.length, yerelScriptAdet: yerelS.length,
             projeKimlik: proje.id };
  });

  k('Proje olmadan fikir yazılabiliyor', r.projesizFikir.adet===1 && r.projesizFikir.bag==='', r.projesizFikir);
  k('Boş script sayfası yol gösteriyor', r.bosMesaj.length>20, r.bosMesaj.slice(0,50));
  k('Yeni script penceresi açılıyor', r.yeniAcildi);
  k('Yeni scriptte Sil düğmesi gizli', r.silmeGizli===true);
  k('Proje olmadan script yazılabiliyor', r.projesizScript.adet===1 && r.projesizScript.bag==='', r.projesizScript);
  k('Script listede kart olarak çıkıyor', r.kartSayisi===1, r.kartSayisi);
  k('BOŞ TASLAK KAYDEDİLMİYOR', r.bosTaslak===1, r.bosTaslak);
  k('Fikirden yeni proje açılıp bağlanıyor', r.fikirBaglandi===true);
  k('Fikir listesi pencerede duruyor', r.seritGorundu===true);
  k('Script projeye bağlanıyor', r.scriptBaglandi===true);
  k('SCRIPT ADIMI KENDİLİĞİNDEN İŞARETLENİYOR', r.adimIsaretlendi===true);
  k('Elle kaldırılan işaret geri gelmiyor', r.kaldirilanIsaretGeriGelmedi===true);
  k('Proje adının altında FİKİR ve SCRIPT vurgulu',
    r.rozetler.filter(x=>x.startsWith('pchip dolu')).length===2, r.rozetler);
  k('Fikir rozeti süzülmüş sayfaya götürüyor',
    r.fikirSayfasi.sayfa && r.fikirSayfasi.filtre===r.projeKimlik, r.fikirSayfasi);
  k('Script rozeti süzülmüş sayfaya götürüyor',
    r.scriptSayfasi.sayfa && r.scriptSayfasi.filtre===r.projeKimlik, r.scriptSayfasi);
  k('"Projesiz" filtresi 1 gösteriyor', r.projesizFiltre===1, r.projesizFiltre);
  k('Proje filtresi 1 gösteriyor', r.projeFiltre===1, r.projeFiltre);
  // Eskiden butun fikirler sormadan metne dokuluyordu; artik SECILI geliyor.
  k('Fikirler metne dökülmüyor', r.iskelet === '', r.iskelet.slice(0,60));
  k('Fikirler seçili geliyor', r.iskeletSecili > 0, String(r.iskeletSecili));
  k('İskeletli script projeye bağlı doğuyor', r.iskeletProje===r.projeKimlik, r.iskeletProje);
  k('Vazgeçilen iskelet kaydedilmiyor', r.iskeletKaydedilmedi===true);
  k('Tek fikirden script başlatılıyor', /Metokhites/.test(r.tekFikirMetni), r.tekFikirMetni.slice(0,50));
  k('Script silinebiliyor', r.silindi===true);
  k('Fikirler tarayıcıya yazılıyor', r.yerelFikirAdet===2, r.yerelFikirAdet);
  k('Scriptler tarayıcıya yazılıyor', r.yerelScriptAdet===0, r.yerelScriptAdet);

  console.log(hata? `\n${hata} BASARISIZ` : '\nHEPSI GECTI');
  await b.close(); process.exit(hata?1:0);
})();
