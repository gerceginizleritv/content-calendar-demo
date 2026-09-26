// REELS — kaydın içindeki otomatik yayın görünümü
//
// Worker ve veritabanı reels'i öğrendi (sql/50, worker 1.5.0). Arayüz
// öğrenmezse kullanıcı için HİÇBİR ŞEY değişmiyor: reels kaydını açıyor,
// otomatik yayın bölümü hiç görünmüyor, tiki açamıyor.
//
// İkinci ölçüm daha sinsi: KAPAK. Kapak kaydın yayın bilgisinde
// taşınıyor ve beyaz listeden düşerse her yüklemede sessizce kayboluyor
// -- pencere "kapak yok" der, oysa Instagram kapağı almış olur. Bu
// depoda aynı sınıf hata çok dilli başlıkta, hesap bağında ve MCP
// bayrağında üç kez yaşandı.
const { chromium, ORNEKSIZ } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch();
  const page = await (await t.newContext({ viewport:{ width:1250, height:1000 }, locale:'tr-TR' })).newPage();
  const hata = []; page.on('pageerror', e=> hata.push(String(e)));
  await page.route('**accounts.google.com**', r=> r.abort());
  await page.route('**supabase.co**', r=> r.abort());
  await page.route('**/goatcounter**', r=> r.abort());
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await page.addInitScript(ORNEKSIZ);
  await page.goto(KOK + '/app.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    setLanguage('tr');
    // Otomatik yayın hesapta AÇIK: bayraksız hâli kendi testinde
    // (oto-yayin-bayrak). Buradaki konu türe göre davranış.
    storyYayinAcik = true;
  });

  // tur: kaydın türü · kapak: yayın bilgisindeki kapak adresi
  const goster = (tur, kapak)=> page.evaluate(({ tp, kp })=>{
    currentEvent = { id:'e1', type: tp, yayin:{ durum:'pending', otomatik:true,
      dosya: tp + '.mp4', bayt: 5 * 1048576, kapak: kp || '', hata:'', deneme:0 } };
    document.getElementById('f_type').value = tp;
    document.getElementById('f_time').value = '19:00';
    otoYayinTazele();
    return {
      gizli: document.getElementById('otoYayinWrap').hidden,
      metin: document.getElementById('otoYayinDurum').innerText
    };
  }, { tp: tur, kp: kapak });

  console.log('[bölüm hangi türlerde açılıyor]');
  bak('★ reels kaydında açılıyor', (await goster('reels')).gizli === false);
  bak('story kaydında açılıyor (gerileme)', (await goster('story')).gizli === false);
  bak('video kaydında KAPALI', (await goster('video')).gizli === true);
  bak('carousel kaydında KAPALI', (await goster('carousel')).gizli === true);

  console.log('[yeni kayıt: tür kutulardan geliyor]');
  const yeni = (deger)=> page.evaluate((v)=>{
    currentEvent = null;
    document.querySelectorAll('#typeChecks input').forEach(x=> x.checked = false);
    const kutu = document.querySelector('#typeChecks input[value="' + v + '"]');
    if(kutu) kutu.checked = true;
    document.getElementById('f_type').value = 'video';   // tek-tür alanı boşta
    otoYayinTazele();
    return { bulundu: !!kutu, gizli: document.getElementById('otoYayinWrap').hidden };
  }, deger);
  const yr = await yeni('reels');
  bak('reels kutusu var', yr.bulundu === true);
  bak('★ yeni kayıtta reels işaretliyse açılıyor', yr.gizli === false, JSON.stringify(yr));
  bak('yeni kayıtta story işaretliyse açılıyor (gerileme)', (await yeni('story')).gizli === false);
  bak('yeni kayıtta video işaretliyse KAPALI', (await yeni('video')).gizli === true);

  console.log('[kapak satırı]');
  const kapakli = await goster('reels', 'https://medya.test/kapak.jpg');
  bak('★ kapak bağlıysa söyleniyor', /Kapak bağlı/.test(kapakli.metin), kapakli.metin.slice(0, 120));
  const kapaksiz = await goster('reels', '');
  // Kapak YOKLUGU bir hata degil: yayin durmuyor. Satir bunu acikca
  // soylemezse kullanici eksik bir sey oldugunu sanip beklerdi.
  bak('★ kapak yoksa sebebi yazıyor',
      /Kapak dosyası yok/.test(kapaksiz.metin) && /kendi karesini/.test(kapaksiz.metin),
      kapaksiz.metin.slice(0, 160));
  const storyMetin = (await goster('story', '')).metin;
  bak('★ story\'de kapak satırı HİÇ YOK', !/Kapak/.test(storyMetin), storyMetin.slice(0, 160));

  console.log('[açıklama metni türe göre]');
  bak('reels açıklaması reel diyor', /reel'i/.test(kapaksiz.metin), kapaksiz.metin.slice(-180));
  bak('story açıklaması story diyor', /story'yi/.test(storyMetin), storyMetin.slice(-180));

  console.log('[ASIL OLCUM: kapak beyaz listeden düşmüyor]');
  const kalici = await page.evaluate(()=>{
    const ham = { id:'e2', type:'reels', platform:'instagram', title:'Reel',
      date:'2026-10-12', time:'19:00',
      yayin:{ durum:'pending', otomatik:true, dosya:'a.mp4', bayt:1,
              kapak:'https://medya.test/kapak.jpg', hata:'', deneme:0 },
      content:{} };
    const temiz = sanitizeEvent(ham);
    // Ikinci tur: kayit diskten geri okunuyormus gibi.
    const ikinci = sanitizeEvent(JSON.parse(JSON.stringify(temiz)));
    return { bir: (temiz.yayin || {}).kapak, iki: (ikinci.yayin || {}).kapak };
  });
  bak('★ sanitizeEvent kapağı düşürmüyor',
      kalici.bir === 'https://medya.test/kapak.jpg', String(kalici.bir));
  bak('★ ikinci turda da duruyor (her yüklemede kaybolmuyor)',
      kalici.iki === 'https://medya.test/kapak.jpg', String(kalici.iki));

  console.log('[tek liste]');
  // Turler UC yerde okunuyordu; tek listeye baglandi. Liste ile
  // gercek davranis ayrisirsa "kutucuk acik ama hicbir sey olmuyor"
  // hali doguyor.
  const liste = await page.evaluate(()=> YAYIN_TURLERI.slice());
  bak('yayınlanabilir türler tek listede', Array.isArray(liste) && liste.length === 2, JSON.stringify(liste));
  bak('liste sql/50 ile aynı küme',
      liste.includes('story') && liste.includes('reels'), JSON.stringify(liste));

  bak('js hatası yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
