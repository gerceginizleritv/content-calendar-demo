// "Kaydet" dugmesi telefonda ALT MENUNUN ALTINDA kaliyordu
// (YAPILACAKLAR 76). Olculdu (375x812): Kaydet 750-798, alt serit
// 754-806; dugmenin TAM ORTASINA basinca `elementFromPoint`
// `BUTTON.tab` donuyordu -- yani dokunus menuye gidiyordu, dugmeye
// degil. Kullanici ancak formu en dibe (1402 px) kadar kaydirirsa
// kaydedebiliyordu.
//
// SEBEP: kayit/proje/script sayfalarinin Kaydet seridi
// `position:sticky; bottom:0`, alt menu ise `position:fixed;
// bottom:0` -- ikisi ayni yere oturuyor. Serit menunun yuksekligi
// kadar YUKARI kaldirildi (`--alt-serit-h`).
//
// ⛔ BU TEST SAYFA LISTESI TUTMUYOR. Hangi seridin kaldirilmasi
//    gerektigini Z-INDEX YIGININDAN buluyor:
//      - menunun z-index'i 40;
//      - bir pencere ondan BUYUK bir yiginda ise (gercek `.overlay`,
//        z-index 50) menu onun ARKASINDA kalir -> serit kaldirilmaz,
//        yoksa dipte menu kadar BOS BANT acilir;
//      - yigin degeri `auto` olan sayfalar menunun ALTINDA kalir
//        -> serit kaldirilmali.
//    Yeni bir pencere/sayfa eklenince kendiliginden olculur.
//
// ⛔ TARAMA PENCERELER ACILDIKTAN SONRA YAPILIYOR. Ilk surum once
//    tariyordu ve `#cekimListesiOverlay`i "kaldirilmamis" diye
//    bildirdi -- YANLIS ALARMDI: o bolum calisma aninda proje
//    sayfasinin kutusunun sonuna TASINIYOR (`cekimListesiAc`), yani
//    kurali ancak tasindiktan sonra aliyor. Olculdu: tasindiktan
//    sonra `bottom` 65px, cakisma 0, dokunus `cl_bitti`ye gidiyor.
//
// ⚠ Playwright gercek bir telefon degil (CLAUDE.md 8): bu test
//   dokunma NOKTASINI `elementFromPoint` ile oluyor, kutu okumuyor
//   -- ustte duran bir katman kutuyu dogru gosterip dokunusu baska
//   yere goturebiliyor. 71. madde gercek cihaz gecisi icin duruyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
const GENISLIKLER = [360, 375, 390];

let g = 0, k = 0;
const bak = (ad, ko, ek)=>{
  if(ko){ g++; console.log('  ok  ' + ad); }
  else { k++; console.log('  YOK ' + ad + (ek !== undefined ? ' -> ' + ek : '')); }
};

async function ac(t, w){
  const c = await t.newContext({ viewport:{ width:w, height:800 },
                                 isMobile:w < 700, hasTouch:w < 700 });
  const p = await c.newPage();
  await p.addInitScript(()=>{ try{
    localStorage.setItem('demo_seen_intro','1');
    localStorage.setItem('demo_tour_done','1');
    localStorage.setItem('demo_ui_language','tr');
  }catch(e){} });
  await p.route('**accounts.google.com**', r=> r.abort());
  await p.route('**/goatcounter**', r=> r.abort());
  const hata = [];
  p.on('pageerror', e=> hata.push(String(e && e.message || e)));
  await p.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1800);
  await p.evaluate(()=> document.querySelectorAll('.overlay.open')
                          .forEach(o=> o.classList.remove('open')));
  return { p, hata };
}

// Sayfalari KULLANICININ actigi gibi aciyor. Siniflari elle eklemek
// yetmiyor: proje sayfasi `#projectsPage`in icine TASINIYOR
// (`sayfaKipineTasi`), o sayfa kapaliyken olculen kutu 0x0 geliyor --
// ilk denemede tam bu oldu ve "dugme yok" sanildi.
const ACICILAR = {
  editOverlay: {
    dugme: '#saveBtn',
    ac: async (p)=>{
      await p.evaluate(()=>{
        const d = new Date(); d.setHours(0,0,0,0);
        events = [{ id:'e76', date:fmtKey(d), time:'10:00', platform:'instagram',
                    type:'story', title:'Deneme', content:{}, publish_state:'planned' }];
        setPage('calendar');
      });
      await p.waitForTimeout(350);
      await p.evaluate(()=> openModal('e76'));
      await p.waitForTimeout(600);
    }
  },
  projectEditOverlay: {
    dugme: '#pe_save',
    ac: async (p)=>{
      await p.evaluate(()=> setPage('projects'));
      await p.waitForTimeout(450);
      await p.click('#p_openNew');
      await p.waitForTimeout(700);
    }
  },
  scriptOverlay: {
    dugme: '#sc_save',
    ac: async (p)=>{
      await p.evaluate(()=> openScript(null));
      await p.waitForTimeout(700);
    }
  },
  // ⚠ id ALIYOR, nesne degil: ilk denemede `projects[0]` gecildi,
  //   `projectById` undefined dondu, fonksiyon sessizce cikti ve
  //   olculen kutu 0x0 geldi.
  cekimListesiOverlay: {
    dugme: '#cl_bitti',
    ac: async (p)=>{
      const kod = await p.evaluate(()=>{
        if(typeof projects === 'undefined' || !projects.length) return 'proje-yok';
        cekimListesiAc(projects[0].id);
        return 'tamam';
      });
      if(kod !== 'tamam') return kod;
      await p.waitForTimeout(900);
    }
  }
};

// Dugmenin tam ortasina basinca oraya DUGMENIN cevap verdigini olcer.
// Iki kaydirma konumunda olculuyor: acilis hali ve sayfanin EN DIBI --
// sticky serit asil orada menuyle cakisiyordu.
const olc = (p, kapSec, dugSec)=> p.evaluate(async ([ks, ds])=>{
  const kap = document.querySelector(ks);
  const dug = kap && kap.querySelector(ds);
  const sr = document.querySelector('.alt-serit');
  if(!kap || !dug || !sr) return { eksik:true, kapVar:!!kap, dugVar:!!dug };
  const bekle = (ms)=> new Promise(z=> setTimeout(z, ms));
  const kaydirici = (()=>{           // pencere kendi icinde de kayiyor
    let a = dug.parentElement;
    while(a && a !== document.documentElement){
      const st = getComputedStyle(a);
      if(/auto|scroll/.test(st.overflowY) && a.scrollHeight > a.clientHeight + 4) return a;
      a = a.parentElement;
    }
    return null;
  })();
  const konumlar = [];
  const bir = async (ad)=>{
    await bekle(260);
    const kr = dug.getBoundingClientRect();
    if(kr.width < 1 || kr.height < 1){ konumlar.push({ ad, gorunmez:true }); return; }
    const ny = Math.round(kr.top + kr.height / 2);
    if(ny < 0 || ny > window.innerHeight){ konumlar.push({ ad, ekranDisi:true }); return; }
    const s = sr.getBoundingClientRect();
    const n = document.elementFromPoint(Math.round(kr.left + kr.width / 2), ny);
    konumlar.push({ ad,
      cakisma: Math.max(0, Math.round(kr.bottom - s.top)),
      dugmeMi: !!(n && (n === dug || dug.contains(n))),
      noktadaki: n ? (n.tagName + (n.className ? '.' + String(n.className).split(' ')[0] : '')) : null,
      yuk: Math.round(kr.height),
      dugmeAlt: Math.round(kr.bottom), seritUst: Math.round(s.top) });
  };
  await bir('acilis');
  if(kaydirici) kaydirici.scrollTop = kaydirici.scrollHeight;
  else window.scrollTo(0, document.documentElement.scrollHeight);
  await bir('en dip');
  return { konumlar };
}, [kapSec, dugSec]);

// Her `sticky` seridi tarar ve z-index yiginina gore iki kumeye ayirir.
const tara = (p)=> p.evaluate(()=>{
  const sr = document.querySelector('.alt-serit');
  if(!sr) return { seritYok:true };
  const sz = getComputedStyle(sr);
  const menuZ = parseInt(sz.zIndex, 10);
  const yiginDegeri = (el)=>{
    let a = el.parentElement;
    while(a && a !== document.documentElement){
      const st = getComputedStyle(a);
      const z = parseInt(st.zIndex, 10);
      if(!Number.isNaN(z) && st.position !== 'static') return z;
      a = a.parentElement;
    }
    return null; // auto: menunun ALTINDA
  };
  const kaldirilmali = [], kaldirilmamali = [];
  document.querySelectorAll('.modal-actions').forEach(ma=>{
    const cs = getComputedStyle(ma);
    if(cs.position !== 'sticky') return;
    const kap = ma.closest('[id]');
    const kayit = { id: kap ? kap.id : '(idsiz)', bottom: cs.bottom,
                    padAlt: cs.paddingBottom };
    const z = yiginDegeri(ma);
    if(z === null || z < menuZ) kaldirilmali.push(kayit);
    else kaldirilmamali.push(kayit);
  });
  return { menuZ, menuDisplay: sz.display,
           menuYuk: Math.round(sr.getBoundingClientRect().height),
           degisken: getComputedStyle(document.documentElement)
                       .getPropertyValue('--alt-serit-h').trim(),
           kaldirilmali, kaldirilmamali };
});

(async ()=>{
  const t = await chromium.launch({});

  for(const w of GENISLIKLER){
    console.log('\n[' + w + 'px]');
    const { p, hata } = await ac(t, w);

    // 1) GERCEK DOKUNUS. Ayni zamanda calisma aninda tasinan
    //    bolumleri yerine koyuyor; tarama bu yuzden SONRA.
    let olculenKonum = 0;
    for(const id of Object.keys(ACICILAR)){
      const a = ACICILAR[id];
      await p.evaluate(()=>{
        document.querySelectorAll('.open').forEach(o=> o.classList.remove('open'));
        document.body.classList.remove('sheet-open','menu-open');
        window.scrollTo(0, 0);
      });
      await p.waitForTimeout(250);
      const sonuc = await a.ac(p);
      if(sonuc){ bak(id + ' acildi', false, sonuc); continue; }
      const m = await olc(p, '#' + id, a.dugme);
      if(m.eksik){ bak(id + ' acildi', false, JSON.stringify(m)); continue; }
      for(const kn of m.konumlar){
        if(kn.gorunmez){ bak(id + ' (' + kn.ad + ') gorunur', false, 'kutu 0x0'); continue; }
        if(kn.ekranDisi) continue;      // kullanici kaydirarak ulasir
        olculenKonum++;
        bak(id + ' ' + a.dugme + ' (' + kn.ad + '): menuyle cakismiyor',
            kn.cakisma === 0, 'dugme alti ' + kn.dugmeAlt + ', menu ustu ' + kn.seritUst);
        bak(id + ' ' + a.dugme + ' (' + kn.ad + '): dokunus dugmeye gidiyor',
            kn.dugmeMi === true, kn.noktadaki);
        bak(id + ' ' + a.dugme + ' (' + kn.ad + '): dokunma hedefi 44px',
            kn.yuk >= 44, kn.yuk + 'px');
      }
    }
    // Hicbir konum olculmediyse yukaridaki dongu sessizce bos gecerdi.
    bak('en az bir gercek dokunus olculdu', olculenKonum >= Object.keys(ACICILAR).length,
        olculenKonum + ' konum');

    // 2) YAPISAL TARAMA (listesiz).
    const d = await tara(p);
    if(d.seritYok){ bak('alt serit bulundu', false, 'yok'); await p.close(); continue; }
    bak('alt menu telefonda gorunur kutu aciyor',
        d.menuDisplay !== 'contents' && d.menuYuk > 0, d.menuDisplay + ' / ' + d.menuYuk + 'px');
    // Degisken OLCULMUS olmali: JS calismadiysa 0 kalir ve kural
    // sessizce eski (bozuk) haline doner.
    bak('--alt-serit-h menunun gercek boyuna esit',
        d.degisken === d.menuYuk + 'px', d.degisken + ' / ' + d.menuYuk + 'px');

    bak('menunun altinda kalan serit var (test bos gecmiyor)',
        d.kaldirilmali.length >= 4, d.kaldirilmali.length + ' tane');
    const kalkmayan = d.kaldirilmali.filter(r=> r.bottom !== d.menuYuk + 'px');
    bak('menunun altindaki her serit menu boyu kadar kaldirilmis',
        kalkmayan.length === 0, kalkmayan.map(r=> r.id + '=' + r.bottom).join(', '));
    // safe-area payi menunun kendi dolgusunda; serit onun USTUNDE
    // oldugu icin ikinci kez eklenmemeli.
    // ⚠ BU IDDIANIN SINIRI VAR: Playwright'ta `env(safe-area-
    //   inset-bottom)` SIFIR cozuluyor, yani `calc(14px + env(...))`
    //   da 14px veriyor. Mutasyon denendi: `padding-bottom:48px`
    //   YAKALANDI, ama satirin TAMAMEN silinmesi yakalanamiyor --
    //   notch'suz ekranda ikisi ayni sonucu veriyor. Notch'lu
    //   telefondaki ~34px fazlalik ancak gercek cihazda gorunur
    //   (YAPILACAKLAR 71).
    const ciftPay = d.kaldirilmali.filter(r=> r.padAlt !== '14px');
    bak('kaldirilmis seritte safe-area payi tekrar eklenmiyor',
        ciftPay.length === 0, ciftPay.map(r=> r.id + '=' + r.padAlt).join(', '));
    // Her kaldirilmis seride gercek dokunusla da bakilmis olmali.
    const aciciysiz = d.kaldirilmali.map(r=> r.id).filter(id=> !ACICILAR[id]);
    bak('kaldirilan her sayfanin acicisi tanimli', aciciysiz.length === 0, aciciysiz.join(', '));

    bak('menunun ustunde duran pencere var (test bos gecmiyor)',
        d.kaldirilmamali.length >= 5, d.kaldirilmamali.length + ' tane');
    const bosaKalkan = d.kaldirilmamali.filter(r=> r.bottom !== '0px');
    bak('menunun ustundeki pencerelerde serit dipte kaliyor',
        bosaKalkan.length === 0, bosaKalkan.map(r=> r.id + '=' + r.bottom).join(', '));

    bak(w + 'px sayfa hatasi yok', hata.length === 0, hata.join(' | '));
    await p.close();
  }

  // Masaustu: menu `display:contents` -- kutusu yok, kaldirilacak bir
  // sey de yok. Olculmeyen deger 0 kalmali, yoksa genis ekranda
  // seridin altinda bos bir bant acilir.
  console.log('\n[1280px masaustu]');
  const { p: md } = await ac(t, 1280);
  const dm = await tara(md);
  bak('masaustunde menu kutu acmiyor', dm.menuDisplay === 'contents', dm.menuDisplay);
  bak('masaustunde --alt-serit-h sifir', dm.degisken === '0px' || dm.degisken === '',
      '"' + dm.degisken + '"');
  await md.close();

  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
