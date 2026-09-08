// Fotografi olmayan mekanlar icin Vikipedi'den fotograf arama.
// Vikipedi burada TAKLIT ediliyor: testin agi yok, ayrica gercek
// sonuclar zamanla degisir.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const FOTO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tekfur_Sarayi.jpg/900px-Tekfur_Sarayi.jpg';

(async () => {
  const t = await chromium.launch({ });
  const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e)));
  await p.route('**tile.openstreetmap.org**', r=> r.abort());
  // ornek.com uydurma bir adres. Kesmezsek tarayici gercekten aga
  // cikiyor: CI'da DNS/baglanti denemesi 8 saniyeyi asabiliyor ve
  // "acilmayan adres soyleniyor" kontrolu zaman asimina dusuyordu.
  // Kesince onerror aninda tetikleniyor; olculen sey degismiyor.
  await p.route('**ornek.com**', r=> r.abort());
  // Gorseli KESMIYORUZ: kesilirse onizleme "acilmadi" der ve testin
  // olcmek istedigi sey kaybolur. Kucuk bir PNG donuyoruz.
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await p.route('**upload.wikimedia.org**', r=> r.fulfill({ status:200, contentType:'image/png', body: PNG }));

  const istekler = [];
  await p.route('**wikipedia.org/w/api.php**', r=>{
    const u = r.request().url();
    istekler.push(u);
    const arama = decodeURIComponent((u.match(/gsrsearch=([^&]*)/) || [])[1] || '');
    // Yalnizca "Tekfur" gecen aramada sonuc var; oteki mekanlar bos donuyor.
    if(/Tekfur/i.test(arama)){
      return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
        query:{ pages:{ '4242':{ pageid:4242, title:'Tekfur Sarayı',
          fullurl:'https://tr.wikipedia.org/wiki/Tekfur_Saray%C4%B1',
          thumbnail:{ source:FOTO, width:900, height:600 } } } } }) });
    }
    if(/Bo%C5%9F|Bos|Ev st/i.test(arama) || true){
      // sonucsuz arama: MediaWiki "query" bile dondurmuyor
      return r.fulfill({ status:200, contentType:'application/json',
                         body: JSON.stringify({ batchcomplete:'' }) });
    }
  });

  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  await p.evaluate(() => { try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'networkidle' });
  await p.evaluate(() => { document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setLanguage('tr'); });

  console.log('[kaynak baglantisi]');
  const kaynak = await p.evaluate((f)=>({
    thumb: wikiKaynak(f),
    tam:   wikiKaynak('https://upload.wikimedia.org/wikipedia/commons/a/ab/Tekfur_Sarayi.jpg'),
    baska: wikiKaynak('https://ornek.com/foto.jpg'),
    bos:   wikiKaynak('')
  }), FOTO);
  bak('kucuk resimden dosya sayfasi cikiyor',
      kaynak.thumb === 'https://commons.wikimedia.org/wiki/File:Tekfur_Sarayi.jpg', kaynak.thumb);
  bak('tam boy adresten de cikiyor',
      kaynak.tam === 'https://commons.wikimedia.org/wiki/File:Tekfur_Sarayi.jpg', kaynak.tam);
  bak('baska sitede kaynak yazisi yok', kaynak.baska === '');
  bak('bos adres sorun degil', kaynak.bos === '');

  console.log('[tek mekan icin arama]');
  await p.evaluate(()=>{
    mekanlar = [
      mekanTemizle({ id:'m_tekfur', name:'Tekfur Sarayı', city:'İstanbul', district:'Fatih' }),
      mekanTemizle({ id:'m_ev', name:'Ev stüdyosu', city:'İstanbul' }),
      mekanTemizle({ id:'m_dolu', name:'Zaten fotoğraflı', city:'İzmir',
                     imageUrl:'https://ornek.com/var.jpg' })
    ];
    saveMekanlar(); setPage('places'); renderMekanlar();
  });
  await p.waitForTimeout(150);
  bak('fotografsiz varken toplu dugme gorunuyor', !(await p.$eval('#mk_fotoHepsi', e=> e.hidden)));

  await p.click('[data-mk="m_tekfur"]');
  await p.waitForSelector('#placeOverlay.open');
  istekler.length = 0;
  await p.click('#mk_fotoAra');
  await p.waitForFunction(()=> !document.getElementById('mk_fotoNot').hidden
                              && !/aran/i.test(document.getElementById('mk_fotoNot').textContent));
  bak('bulunan fotograf kutuya yazildi', await p.$eval('#mk_image', e=> e.value) === FOTO);
  // "Bir bak, sonra kaydet" diyorsak bakacak bir sey olmali: fotograf
  // KAYDETMEDEN once pencerede gorunuyor.
  bak('fotograf kaydetmeden once pencerede gorunuyor', await p.evaluate(()=>{
    const k = document.getElementById('mk_onizleme');
    const g = k.querySelector('img');
    return !k.hidden && !!g;
  }));
  bak('onizlemedeki adres bulunanla ayni',
      await p.$eval('#mk_onizleme img', e=> e.getAttribute('src')) === FOTO);
  bak('hangi sayfadan geldigi soyleniyor',
      /Tekfur/.test(await p.$eval('#mk_fotoNot', e=> e.textContent)));
  bak('once sehirle birlikte arandi', /gsrsearch=Tekfur[^&]*Fatih/.test(istekler[0] || ''), istekler[0]);
  bak('once TR Vikipedi denendi', /^https:\/\/tr\.wikipedia\.org/.test(istekler[0] || ''));
  bak('bulununca fazladan istek gitmedi', istekler.length === 1, String(istekler.length));
  await p.click('#mk_save');
  await p.waitForTimeout(200);
  bak('kaydedildi', await p.evaluate(()=> (mekanById('m_tekfur')||{}).imageUrl) === FOTO);
  const kart = await p.$eval('[data-mk="m_tekfur"]', e=> e.innerHTML);
  bak('kartta Vikipedi kaynagi yaziyor', /mk-wiki/.test(kart) && /commons\.wikimedia\.org\/wiki\/File:/.test(kart));
  bak('kaynak yazisina tiklamak pencereyi acmiyor', /data-dis/.test(kart));

  console.log('[bulunamayan]');
  await p.click('[data-mk="m_ev"]');
  await p.waitForSelector('#placeOverlay.open');
  istekler.length = 0;
  await p.click('#mk_fotoAra');
  await p.waitForFunction(()=> /yok|bir şey/i.test(document.getElementById('mk_fotoNot').textContent));
  bak('bulunamayinca ne yapilacagi yaziliyor',
      /bağlantı|harita/i.test(await p.$eval('#mk_fotoNot', e=> e.textContent)));
  bak('kutu bos kaldi', await p.$eval('#mk_image', e=> e.value) === '');
  bak('bulunamayinca onizleme de yok', await p.$eval('#mk_onizleme', e=> e.hidden));
  // TR icin sehirli/sehirsiz iki sorgu, EN icin ayrica CEVRILMIS ad
  // ("Ev studyosu" -> "Ev Studio") sehirli/sehirsiz: toplam alti.
  bak('sehirli/sehirsiz, iki dil ve cevrilmis ad denendi', istekler.length === 6, String(istekler.length));
  bak('ikinci dil EN', /en\.wikipedia\.org/.test(istekler[2] || ''), istekler[2]);
  await p.click('#mk_cancel');

  console.log('[elle yapistirma]');
  await p.click('[data-mk="m_ev"]');
  await p.waitForSelector('#placeOverlay.open');
  await p.fill('#mk_image', 'https://upload.wikimedia.org/wikipedia/commons/x/xy/Elle.jpg');
  await p.waitForTimeout(200);
  await p.waitForFunction(()=> !!document.querySelector('#mk_onizleme img'), null, { timeout: 5000 });
  bak('elle yapistirilan da hemen gorunuyor',
      !(await p.$eval('#mk_onizleme', e=> e.hidden)));
  await p.fill('#mk_image', '');
  await p.waitForTimeout(150);
  bak('adres silinince onizleme kapaniyor', await p.$eval('#mk_onizleme', e=> e.hidden));
  await p.fill('#mk_image', 'javascript:alert(1)');
  await p.waitForTimeout(150);
  bak('javascript: adresi onizlemeye girmiyor', await p.$eval('#mk_onizleme', e=> e.hidden));
  await p.fill('#mk_image', 'https://ornek.com/olmayan.jpg');
  await p.waitForFunction(()=> /görsel açmadı/.test(document.getElementById('mk_onizleme').textContent),
                          null, { timeout: 5000 });
  bak('acilmayan adres soyleniyor', true);
  await p.click('#mk_cancel');
  await p.waitForTimeout(150);
  await p.click('[data-mk="m_ev"]');
  await p.waitForSelector('#placeOverlay.open');
  bak('vazgecilince kaydedilmedi', await p.$eval('#mk_image', e=> e.value) === '');
  bak('pencere yeniden acilinca onizleme sifirlandi', await p.$eval('#mk_onizleme', e=> e.hidden));
  await p.click('#mk_cancel');

  console.log('[toplu arama]');
  istekler.length = 0;
  await p.evaluate(()=>{
    mekanlar = [
      mekanTemizle({ id:'m_tekfur', name:'Tekfur Sarayı', city:'İstanbul' }),
      mekanTemizle({ id:'m_ev', name:'Ev stüdyosu', city:'İstanbul' }),
      mekanTemizle({ id:'m_dolu', name:'Zaten fotoğraflı', city:'İzmir',
                     imageUrl:'https://ornek.com/var.jpg' })
    ];
    saveMekanlar(); renderMekanlar();
  });
  await p.click('#mk_fotoHepsi');
  await p.waitForFunction(()=> /bakıldı/.test(document.getElementById('mk_fotoDurum').textContent), null, { timeout: 15000 });
  const ozet = await p.$eval('#mk_fotoDurum', e=> e.textContent);
  bak('ozet dogru sayiyor', /2 mekana bakıldı, 1 fotoğraf/.test(ozet), ozet);
  bak('bulunan mekana yazildi', await p.evaluate(()=> (mekanById('m_tekfur')||{}).imageUrl) === FOTO);
  bak('bulunamayan bos kaldi', await p.evaluate(()=> (mekanById('m_ev')||{}).imageUrl) === '');
  bak('zaten fotografli olana DOKUNULMADI',
      await p.evaluate(()=> (mekanById('m_dolu')||{}).imageUrl) === 'https://ornek.com/var.jpg');
  bak('fotografli mekan icin istek gitmedi', !istekler.some(u=> /Zaten/.test(decodeURIComponent(u))));
  bak('hepsi bulununca dugme gizlendi mi (hala fotografsiz var)',
      !(await p.$eval('#mk_fotoHepsi', e=> e.hidden)));

  console.log('[hata dayanikliligi]');
  await p.unroute('**wikipedia.org/w/api.php**');
  await p.route('**wikipedia.org/w/api.php**', r=> r.abort());
  await p.click('[data-mk="m_ev"]');
  await p.waitForSelector('#placeOverlay.open');
  await p.click('#mk_fotoAra');
  await p.waitForFunction(()=> /yok|bir şey/i.test(document.getElementById('mk_fotoNot').textContent));
  bak('ag koptugunda da sakin davraniyor', true);
  bak('dugme tekrar kullanilabilir', !(await p.$eval('#mk_fotoAra', e=> e.disabled)));
  await p.click('#mk_cancel');

  bak('sayfa hatasi yok', hata.length === 0, hata.join(' | '));
  console.log('\n'+g+' gecti, '+k+' kaldi');
  await t.close();
  process.exit(k ? 1 : 0);
})();
