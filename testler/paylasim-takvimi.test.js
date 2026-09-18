// PAYLASIM TAKVIMI — Google Takvim'e giden ikinci besleme.
//
// Terminler zaten bir .ics adresi olarak yayinlaniyordu; yayin
// takvimindeki PAYLASIMLAR hic girmiyordu. "Shootboard'daki planim neden
// telefonumun takviminde yok" sorusunun cevabi buydu.
//
// Neden AYRI bir dosya: Google, abone olunan bir takvimde olay basina
// renk desteklemiyor -- iCalendar'daki COLOR alanini gormezden geliyor,
// renk ABONELIK basina veriliyor. Tek dosya olsaydi "terminlerimi
// kapatip yalnizca paylasimlara bakayim" ya da "paylasimlar baska renk
// olsun" diye bir sey mumkun olmazdi.
//
// Uc sey olculuyor:
//   1. SAAT. Kayit kendi saat diliminde giriliyor, dosyaya UTC yaziliyor.
//      Ofset kaydin KENDI TARIHINE gore hesaplanmali: "simdiki ofset"
//      kullanilsaydi yaz saati sinirinin obur tarafindaki her kayit bir
//      saat kayardi.
//   2. SIZINTI. Abonelik adresi herkese acik. Aciklama, hashtag, yayin
//      basligi, proje adi ve mekan dosyaya GIRMEMELI -- terminler
//      dosyasindaki kuralin aynisi.
//   3. TAZELENME. Besleme kayitlardan besleniyor; save() tazelemeyi
//      cagirmazsa yeni girilen paylasim aboneye hic ulasmaz. Bu cagri
//      gercekten yoktu, bu is sirasinda eklendi.
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

  // ------------------------------------------------------------- saat
  console.log('[saat dilimi UTC\'ye dogru ceviriliyor]');
  const tz = await p.evaluate(()=>({
    ist:    icsZaman(yerelSaatiAn('2026-10-09','19:00','Europe/Istanbul')),
    berYaz: icsZaman(yerelSaatiAn('2026-07-15','12:00','Europe/Berlin')),
    berKis: icsZaman(yerelSaatiAn('2026-12-15','12:00','Europe/Berlin')),
    ny:     icsZaman(yerelSaatiAn('2026-10-09','09:00','America/New_York')),
    utc:    icsZaman(yerelSaatiAn('2026-10-09','09:00','UTC')),
    gecesi: icsZaman(yerelSaatiAn('2026-10-09','00:00','Europe/Istanbul')),
    bozukTarih: yerelSaatiAn('', '19:00', 'UTC'),
    bozukTz: icsZaman(yerelSaatiAn('2026-10-09','19:00','Yok/Boyle_Bir_Yer'))
  }));
  bak('Istanbul +3', tz.ist === '20261009T160000Z', tz.ist);
  // ASIL OLCUM: ayni sehir, iki farkli tarih, IKI FARKLI ofset. "Simdiki
  // ofseti" kullanan bir cozum bu ikisini ayni yazardi.
  bak('Berlin YAZ saati +2', tz.berYaz === '20260715T100000Z', tz.berYaz);
  bak('Berlin KIS saati +1', tz.berKis === '20261215T110000Z', tz.berKis);
  bak('yaz/kis gercekten farkli hesaplanmis',
      tz.berYaz.slice(9,11) !== tz.berKis.slice(9,11), tz.berYaz + ' | ' + tz.berKis);
  bak('New York yaz saati (EDT) -4', tz.ny === '20261009T130000Z', tz.ny);
  bak('UTC oldugu gibi', tz.utc === '20261009T090000Z', tz.utc);
  bak('gece yarisi bir onceki gune tasiyor', tz.gecesi === '20261008T210000Z', tz.gecesi);
  bak('tarihsiz kayit null donuyor', tz.bozukTarih === null, String(tz.bozukTarih));
  // Bilinmeyen dilim COKMEMELI: tek bozuk kayit butun beslemeyi
  // dusurmemeli, o kayit UTC sayilip gecilmeli.
  bak('bilinmeyen dilim cokmuyor, UTC sayiliyor',
      tz.bozukTz === '20261009T190000Z', tz.bozukTz);

  // ---------------------------------------------------------- baslik
  console.log('[baslik: ikon + platform + tur + baslik]');
  const bas = await p.evaluate(()=>({
    yt:   paylasimBasligi({ platform:'youtube',   type:'video',     title:'Sokollu Köprüsü', uploaded:false }),
    ig:   paylasimBasligi({ platform:'instagram', type:'carousel',  title:'Mimar Sinan',     uploaded:true  }),
    bos:  paylasimBasligi({ platform:'tiktok',    type:'reels',     title:'',                uploaded:false }),
    x:    paylasimBasligi({ platform:'x',         type:'text_post', title:'Kısa not',        uploaded:false })
  }));
  bak('platform ikonu basta', bas.yt.indexOf('▶') === 0, bas.yt);
  bak('platform adi var', /YouTube/.test(bas.yt), bas.yt);
  bak('tur etiketi var', /Video/.test(bas.yt), bas.yt);
  bak('kaydin basligi var', /Sokollu/.test(bas.yt), bas.yt);
  // Yayinlanmis olan takvimde KALIYOR ama isaretli: gecmis ile onundeki
  // is ayni goruntude karismasin.
  bak('yayinlanmisin basinda onay isareti', bas.ig.indexOf('✓') === 0, bas.ig);
  bak('yayinlanmamista isaret YOK', bas.yt.indexOf('✓') === -1, bas.yt);
  bak('basliksiz kayit yine de tanimli', /TikTok/.test(bas.bos) && /Reels/.test(bas.bos), bas.bos);
  bak('basliksizda bosta kalan tire yok', bas.bos.indexOf('—') === -1, bas.bos);
  bak('her platformun kendi ikonu', bas.ig.indexOf('\u{1F4F8}') !== -1, bas.ig);

  // -------------------------------------------------------- .ics govdesi
  console.log('[.ics govdesi]');
  const dosya = await p.evaluate(()=>{
    events = [
      { id:'e1', type:'video', platform:'youtube', title:'Sokollu Köprüsü',
        date:'2026-10-09', time:'19:00', uploaded:false,
        content:{ timezone:'Europe/Istanbul', caption:'GIZLI ACIKLAMA', hashtags:'#gizlietiket',
                  videoTitle:'GIZLI YAYIN BASLIGI', shortTitle:'GIZLI KISA',
                  thumbPrompt:'GIZLI PROMPT', projectId:'pr_1', concept:'GIZLI PROJE',
                  hesapId:'hs_gizli' } },
      { id:'e2', type:'carousel', platform:'instagram', title:'Mimar Sinan',
        date:'2026-10-10', time:'09:30', uploaded:true,
        content:{ timezone:'Europe/Istanbul' } },
      // Tarihsiz kayit: dosyaya girmemeli ama otekileri de dusurmemeli.
      { id:'e3', type:'reels', platform:'tiktok', title:'Bozuk', date:'', time:'',
        uploaded:false, content:{} }
    ];
    save();
    return icsPaylasimMetni();
  });
  bak('takvim basligi paylasimlar', /X-WR-CALNAME:Shootboard/.test(dosya)
      && /payla/i.test(dosya.split('X-WR-CALNAME:')[1].split('\r\n')[0]),
      dosya.split('X-WR-CALNAME:')[1].split('\r\n')[0]);
  bak('iki olay var, bozuk olan dusmus',
      (dosya.match(/BEGIN:VEVENT/g)||[]).length === 2,
      String((dosya.match(/BEGIN:VEVENT/g)||[]).length));
  bak('saatli olay (gun boyu DEGIL)',
      /DTSTART:20261009T160000Z/.test(dosya) && dosya.indexOf('VALUE=DATE') === -1,
      (dosya.match(/DTSTART[^\r\n]*/g)||[]).join(' | '));
  bak('otuz dakika suruyor', /DURATION:PT30M/.test(dosya));
  bak('gunu mesgul gostermiyor', /TRANSP:TRANSPARENT/.test(dosya));
  // Alarm BILEREK yok: hatirlatma ayarlari proje adimlari icin. Her
  // paylasima alarm basmak bildirim yagmuru olurdu.
  bak('paylasimlarda alarm YOK', dosya.indexOf('BEGIN:VALARM') === -1);
  bak('UID kayit kimligine sabit', /UID:slate-pay-e1@slate/.test(dosya));
  bak('terminlerin UID kalibindan ayri',
      dosya.indexOf('UID:slate-e1') === -1, 'cakisma olurdu');

  console.log('[ASIL SINIR: icerik dosyaya SIZMIYOR]');
  // Abonelik adresi herkese acik. Adres sizsa bile kullanicinin icerigi
  // disariya cikmamali -- terminler dosyasindaki kuralin aynisi.
  ['GIZLI ACIKLAMA','#gizlietiket','GIZLI YAYIN BASLIGI','GIZLI KISA',
   'GIZLI PROMPT','GIZLI PROJE','pr_1','hs_gizli'].forEach(s=>{
    bak('sizmadi: ' + s, dosya.indexOf(s) === -1);
  });
  bak('yalnizca kullanicinin yazdigi baslik var', /Sokollu/.test(dosya));

  console.log('[terminler dosyasi bozulmadi]');
  // Iki besleme ayri: paylasimlar eklendi diye terminler dosyasina
  // paylasim kacmamali.
  const terminDosya = await p.evaluate(()=>{
    projects = [{ id:'pr_1', name:'Deneme projesi', cancelled:false,
                  script_date:'2026-10-05', steps:[] }];
    saveProjects();
    return icsMetni();
  });
  bak('terminlerde paylasim yok', terminDosya.indexOf('slate-pay-') === -1);
  bak('terminlerde Sokollu yok', terminDosya.indexOf('Sokollu') === -1);
  bak('terminler hala gun boyu olay',
      terminDosya.indexOf('VALUE=DATE') !== -1 || terminDosya.indexOf('BEGIN:VEVENT') === -1,
      'gun boyu kalmali');

  console.log('[adresler ayri ve tahmin edilebilir]');
  const adres = await p.evaluate(()=>{
    // Oturum taklidi: adres uretimi yalnizca kimlik ve jetona bakiyor.
    // "session" ust duzey bir let; window.session ona DEGMEZ, duz atama sart.
    session = { user:{ id:'u123' } };
    hatirlatma.jeton = 'jtn';
    return { termin: takvimAdresi(), pay: paylasimTakvimAdresi(),
             yolT: takvimYolu(), yolP: paylasimTakvimYolu() };
  });
  bak('iki adres FARKLI', adres.termin !== adres.pay, adres.termin + ' | ' + adres.pay);
  bak('ikisi de .ics ile bitiyor',
      /\.ics$/.test(adres.termin) && /\.ics$/.test(adres.pay), adres.pay);
  bak('paylasim dosyasi ayirt edilebilir', /-paylasim\.ics$/.test(adres.pay), adres.pay);
  bak('ayni jetonu paylasiyorlar (tek iptal dugmesi)',
      adres.pay.indexOf('jtn') !== -1 && adres.termin.indexOf('jtn') !== -1, adres.pay);
  bak('yollar da ayri', adres.yolT !== adres.yolP, adres.yolT + ' | ' + adres.yolP);

  const oturumsuz = await p.evaluate(()=>{
    session = null;
    return { termin: takvimAdresi(), pay: paylasimTakvimAdresi() };
  });
  bak('oturum yokken adres uretilmiyor',
      oturumsuz.termin === '' && oturumsuz.pay === '', JSON.stringify(oturumsuz));

  // ------------------------------------------------------- tazelenme
  console.log('[ASIL TUZAK: kayit degisince besleme tazeleniyor]');
  // Bu cagri save() icinde YOKTU: yalnizca proje kaydi tazeliyordu.
  // Paylasim beslemesi kayitlardan beslendigi icin, eklenmeseydi yeni
  // girilen hicbir paylasim aboneye ulasmazdi.
  const tazele = await p.evaluate(()=>{
    let sayac = 0;
    const eski = window.takvimTazeleKuyrukla;
    window.takvimTazeleKuyrukla = ()=>{ sayac++; };
    save();
    const kayitta = sayac;
    saveProjects();
    const projede = sayac;
    window.takvimTazeleKuyrukla = eski;
    return { kayitta, projede };
  });
  bak('save() beslemeyi tazeliyor', tazele.kayitta === 1, String(tazele.kayitta));
  bak('saveProjects() de tazeliyor (eskiden beri)',
      tazele.projede === 2, String(tazele.projede));

  // ---------------------------------------------------------- arayuz
  console.log('[hatirlatmalar penceresi iki adres gosteriyor]');
  const arayuz = await p.evaluate(()=>{
    session = { user:{ id:'u123' } };
    hatirlatma.jeton = 'jtn';
    hatirlatma.takvim = true;
    hatirlatma.yayinlandi = true;
    hatirlatmaEkraniTazele();
    return {
      satirGorunur: !document.getElementById('rm_adresSatir').hidden,
      termin: document.getElementById('rm_adres').value,
      pay: document.getElementById('rm_adresPay').value,
      etiket: [...document.querySelectorAll('.rm-adres-alt')].map(x=> x.textContent.trim()),
      kopyaDugme: document.querySelectorAll('#rm_adresSatir .btn').length
    };
  });
  bak('adres satiri gorunuyor', arayuz.satirGorunur === true);
  bak('termin adresi dolu', /\/jtn\.ics$/.test(arayuz.termin), arayuz.termin);
  bak('paylasim adresi dolu', /jtn-paylasim\.ics$/.test(arayuz.pay), arayuz.pay);
  bak('hangisi hangisi yaziyor', arayuz.etiket.length === 2, JSON.stringify(arayuz.etiket));
  bak('her adresin kendi kopyala dugmesi var', arayuz.kopyaDugme === 2,
      String(arayuz.kopyaDugme));

  const metinler = await p.evaluate(()=>{
    const anahtar = ['rm_cal_name_pay','rm_adres_termin','rm_adres_paylasim','rm_adres_iki'];
    const sonuc = {};
    ['tr','en'].forEach(dil=>{ setLanguage(dil);
      sonuc[dil] = anahtar.filter(a=>{ const v = t(a); return v === undefined || v === null || v === a; }); });
    setLanguage('tr'); return sonuc;
  });
  bak('Turkce metinler var', metinler.tr.length === 0, JSON.stringify(metinler.tr));
  bak('Ingilizce metinler var', metinler.en.length === 0, JSON.stringify(metinler.en));

  console.log('[RFC 5545 bicimi]');
  const bicim = await p.evaluate(()=>{
    events = [{ id:'e_uzun', type:'video', platform:'youtube',
                title:'Çok uzun bir başlık ' + 'ığüşöç'.repeat(20),
                date:'2026-10-09', time:'19:00', uploaded:false,
                content:{ timezone:'Europe/Istanbul' } }];
    const m = icsPaylasimMetni();
    const kod = new TextEncoder();
    return { satirlar: m.split('\r\n'),
             enUzun: Math.max(...m.split('\r\n').map(s=> kod.encode(s).length)),
             crlf: m.indexOf('\n') !== -1 && m.split('\n').every(s=> s === '' || s.endsWith('\r')) };
  });
  // Turkce harfler iki oktet: satir KARAKTER degil OKTET sayiliyor.
  bak('hicbir satir 75 okteti asmiyor', bicim.enUzun <= 75, String(bicim.enUzun));
  bak('satir sonlari CRLF', bicim.crlf === true);
  bak('VCALENDAR kapaniyor',
      bicim.satirlar.indexOf('END:VCALENDAR') !== -1, bicim.satirlar.slice(-3).join('|'));

  bak('js hatası yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
