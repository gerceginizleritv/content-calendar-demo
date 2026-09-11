// AI PAKETI — DOGRULAMA (ai/dogrula.js).
//
// Tarayici yok: dogrula.js saf bir modul, Node ile dogrudan kosuyor.
// Olculen sey: bir yapay zekanin urettigi paket uygulamanin beyaz
// listesinden ayni kurallarla geciyor mu — bilinmeyen platform kaydi
// dusuruyor, bilinmeyen tur video'ya dusuyor, tarih gercekten tarih mi,
// Turkce ust anahtarlar (yedek dosyasi) da okunuyor mu, verilmeyen alan
// ciktida YOK mu (ada gore guncellemede ezmesin diye).
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const m = await import('../ai/dogrula.js');
  const { paketiCoz, basvuruCoz, adAnahtari, tarihGecerli, saatGecerli, kimlikUret, SINIRLAR } = m;

  // 1) Ornek paket: bes liste, hepsi okunuyor.
  const r = paketiCoz({
    shootboard: 1, source: '  ChatGPT ', note: 'Eylul',
    places: [{ name: ' Büyük Valide Han ', city: 'İstanbul', lat: '41,02', lon: 28.97, timezone: 'Europe/Istanbul' }],
    projects: [{ name: 'Hanlar', type: 'venue', shootDate: '2026-09-20', places: ['Büyük Valide Han', 'Büyük Valide Han'], steps: { script: 'true', filmed: false }, deadlines: { script: '2026-09-12', filmed: 'yarin' } }],
    entries: [
      { date: '2026-09-27', time: '9:00', type: 'Video', platform: 'YouTube', title: 'Hanlar', project: 'Hanlar', content: { caption: 'x', hashtags: '#a', slidePrompts: ['a', 2, 'c'], timezone: 'Mars/Olympus' } },
      { date: '2026-09-27', platform: 'instagram', type: 'reel', title: 'teaser' },
      { date: '2026-02-30', platform: 'x', title: 'gecersiz tarih' },
      { date: '2026-09-28', platform: 'myspace', title: 'bilinmeyen platform' }
    ],
    scripts: [{ title: 'VO v1', text: 'AÇILIŞ', project: 'Hanlar' }, { title: '', text: '  ' }],
    ideas: [{ text: 'fikir', due: '2026-10-01', done: 'yes' }, { text: '' }]
  });
  bak('paket okundu', r.ok === true, JSON.stringify(r.hatalar));
  bak('source ve note kirpildi', r.source === 'ChatGPT' && r.note === 'Eylul');
  bak('mekan adi kirpildi, lat virgullu okundu', r.places[0].name === 'Büyük Valide Han' && r.places[0].lat === 41.02 && r.places[0].lon === 28.97);
  bak('mekan tz gecti', r.places[0].timezone === 'Europe/Istanbul');
  bak('proje: tur, tarih, tekrarsiz mekan listesi', r.projects[0].type === 'venue' && r.projects[0].shootDate === '2026-09-20' && r.projects[0].placeRefs.length === 1);
  bak('proje adimlari: "true" metni de true, false false', r.projects[0].steps.script === true && r.projects[0].steps.filmed === false);
  bak('proje termini: gecersiz olan dustu, gecerli kaldi', r.projects[0].deadlines.script === '2026-09-12' && !('filmed' in r.projects[0].deadlines));
  bak('kayit: platform/tur kucuk harfe, saat 09:00', r.entries[0].platform === 'youtube' && r.entries[0].type === 'video' && r.entries[0].time === '09:00');
  bak('kayit: gecersiz tz dustu, slidePrompts 3 eleman (sayi bos metne)', r.entries[0].content.timezone === undefined && r.entries[0].content.slidePrompts.length === 3 && r.entries[0].content.slidePrompts[1] === '');
  bak('kayit: bilinmeyen tur video oldu + uyari', r.entries[1].type === 'video' && r.hatalar.some(h=> h.liste === 'entries' && h.sira === 1 && h.alan === 'type'));
  bak('kayit: 30 Subat atlandi', r.entries.length === 2 && r.hatalar.some(h=> h.liste === 'entries' && h.sira === 2 && h.alan === 'date'));
  bak('kayit: bilinmeyen platform atlandi', r.hatalar.some(h=> h.liste === 'entries' && h.sira === 3 && h.alan === 'platform'));
  bak('kayit: verilmeyen alan ciktida yok', !('uploaded' in r.entries[1]) && !('content' in r.entries[1]) && !('projectRef' in r.entries[1]));
  bak('script: bos olan atlandi', r.scripts.length === 1 && r.scripts[0].projectRefs[0] === 'Hanlar');
  bak('fikir: bos olan atlandi, done "yes" true', r.ideas.length === 1 && r.ideas[0].done === true && r.ideas[0].due === '2026-10-01');
  bak('toplam dogru', r.toplam === 1 + 1 + 2 + 1 + 1, String(r.toplam));

  // 2) Turkce ust anahtarlar (yedek dosyasi bicimi).
  const y = paketiCoz({ urun: 'shootboard', kayitlar: [{ date: '2026-01-05', platform: 'tiktok', title: 't' }], projeler: [{ name: 'P' }], fikirler: [{ text: 'f' }], mekanlar: [{ name: 'M' }], scriptler: [{ title: 'S' }] });
  bak('yedek dosyasi bicimi okunuyor', y.ok && y.entries.length === 1 && y.projects.length === 1 && y.ideas.length === 1 && y.places.length === 1 && y.scripts.length === 1);

  // 3) Bos ve bozuk paketler.
  bak('bos paket ok=false', paketiCoz({ shootboard: 1 }).ok === false);
  bak('dizi paket ok=false', paketiCoz([1]).ok === false);
  bak('null paket ok=false', paketiCoz(null).ok === false);
  bak('liste dizi degilse hata', paketiCoz({ entries: 'x', ideas: [{ text: 'a' }] }).hatalar.some(h=> h.liste === 'entries'));
  const cok = paketiCoz({ ideas: Array.from({ length: 101 }, (_, i)=> ({ text: 'f' + i })) });
  bak('liste siniri: fazlasi atiliyor, uyari var', cok.ideas.length === SINIRLAR.liste.ideas && cok.hatalar.some(h=> /at most/.test(h.sebep)));
  const asiri = paketiCoz({ entries: Array.from({ length: 150 }, (_, i)=> ({ date: '2026-01-01', platform: 'x' })), ideas: Array.from({ length: 100 }, ()=> ({ text: 'f' })) });
  bak('paket siniri 200: ok=false', asiri.ok === false && /200/.test(asiri.hatalar[0].sebep));

  // 4) Kimlik.
  const kim = paketiCoz({ ideas: [{ id: 'fk_1', text: 'a' }, { id: 'kötü kimlik!', text: 'b' }] });
  bak('gecerli kimlik kaliyor, gecersiz dusup uyari veriyor', kim.ideas[0].id === 'fk_1' && kim.ideas[1].id === undefined && kim.hatalar.some(h=> h.alan === 'id'));
  bak('kimlik uretimi: onekler ve uuid', /^pr_/.test(kimlikUret('projects')) && /^mk_/.test(kimlikUret('places')) && /^sc_/.test(kimlikUret('scripts')) && /^fk_/.test(kimlikUret('ideas')) && /^[0-9a-f-]{36}$/.test(kimlikUret('entries')));

  // 5) Yardimcilar.
  bak('adAnahtari Turkce kucuk harf ve bosluk', adAnahtari('  BÜYÜK  Valide HAN ') === 'büyük valide han' && adAnahtari('İSTANBUL') === 'istanbul');
  bak('tarihGecerli', tarihGecerli('2026-02-28') && !tarihGecerli('2026-02-29') && tarihGecerli('2028-02-29') && !tarihGecerli('2026-13-01') && !tarihGecerli('26-01-01'));
  bak('saatGecerli', saatGecerli('23:59') && !saatGecerli('24:00') && !saatGecerli('9:00'));
  const olanlar = [{ id: 'pr_a', name: 'Hanlar Bölgesi' }, { id: 'pr_b', name: 'Sahil' }];
  bak('basvuruCoz kimlikle', basvuruCoz('pr_b', olanlar).id === 'pr_b');
  bak('basvuruCoz adla, harf duyarsiz', basvuruCoz('hanlar bölgesi', olanlar).id === 'pr_a' && basvuruCoz('HANLAR BÖLGESİ', olanlar).id === 'pr_a');
  bak('basvuruCoz bulamazsa null', basvuruCoz('yok', olanlar) === null && basvuruCoz('', olanlar) === null);

  console.log(`\n${g} gecti, ${k} kaldi`);
  process.exit(k ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
