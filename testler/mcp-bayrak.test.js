// MCP BAYRAGI — okunuyor VE kaydedilirken korunuyor mu?
//
// Ozellik yalnizca hesabin tercihlerinde mcp bayragi olanlarda gorunmeli.
// Ama asil olculen sey bayragin GORUNMESI degil, KALMASI.
//
// Yasanan sey: bayrak Supabase'ten elle acildi, ekran acildi, sonra
// "anahtar uret" veritabani kuralina takildi. Sebep, tercihPrefsYap()
// satirin TAMAMINI yeniden yazmasi ve mcp'yi atlamasiydi -- uygulama ilk
// prefs yaziminda bayragi kendi silmisti. Ekran bellekteki degerle acik
// kalmaya devam ettigi icin hata, bayragin gittigini degil anahtarin
// bozuk oldugunu dusundurttu.
//
// Ayni tuzak gelen_kutusu icin daha once yasanmis ve kodda uyari notu
// birakilmis; o notu okumama ragmen ayni hataya dusuldu. Bu yuzden olcum
// artik burada.
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
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
                         setLanguage('tr'); });

  const kur = (bayrak)=> p.evaluate((b)=>{
    session = { user:{ id:'00000000-0000-4000-8000-000000000001', email:'deneme@ornek.com' } };
    bulutOkumaBasarisiz = false;
    gelenAlinanOku(b === null ? null : { prefs: b });
  }, bayrak);

  console.log('[bayrak okunuyor]');
  await kur({ lang:'tr' });
  bak('bayraksiz hesapta kapali', await p.evaluate(()=> mcpAcik === false));
  await kur(null);
  bak('yeni hesapta (satir yok) kapali', await p.evaluate(()=> mcpAcik === false));
  await kur({ lang:'tr', mcp:true });
  bak('bayrakli hesapta acik', await p.evaluate(()=> mcpAcik === true));

  console.log('[ASIL OLCUM: kaydedilirken KORUNUYOR]');
  // tercihPrefsYap() satirin tamamini yeniden yaziyor. Bayrak burada
  // yazilmiyor, yalnizca korunuyor; atlanirsa ilk kaydetmede silinir ve
  // bunu kimse fark etmez -- ekran bellekteki degerle acik kalir.
  bak('bayrakli hesapta prefs.mcp yazilan satirda duruyor',
      await p.evaluate(()=> tercihPrefsYap().mcp === true),
      JSON.stringify(await p.evaluate(()=> tercihPrefsYap())));
  await kur({ lang:'tr' });
  bak('bayraksiz hesapta prefs.mcp YAZILMIYOR',
      await p.evaluate(()=> tercihPrefsYap().mcp === undefined),
      JSON.stringify(await p.evaluate(()=> tercihPrefsYap())));

  // Kardes bayrak da ayni satirda: biri otekini dusurmemeli.
  await kur({ lang:'tr', mcp:true, gelen_kutusu:true });
  const ikisi = await p.evaluate(()=> tercihPrefsYap());
  bak('iki bayrak birlikte korunuyor',
      ikisi.mcp === true && ikisi.gelen_kutusu === true, JSON.stringify(ikisi));
  bak('dil ve hatirlatmalar da yerinde',
      !!ikisi.lang && !!ikisi.reminders, JSON.stringify(Object.keys(ikisi)));

  console.log('[ekran]');
  await kur({ lang:'tr' });
  await p.evaluate(()=> mcpBolumuCiz());
  bak('bayraksiz hesapta bolum gizli',
      await p.evaluate(()=> document.getElementById('hesapMcp').hidden === true));
  await kur({ lang:'tr', mcp:true });
  await p.evaluate(()=> { mcpBolumuCiz(); });
  await p.waitForTimeout(200);
  bak('bayrakli hesapta bolum gorunur',
      await p.evaluate(()=> document.getElementById('hesapMcp').hidden === false));

  console.log('[anahtar bicimi]');
  const an = await p.evaluate(async ()=>{
    const a = mcpAnahtarUret(), b = mcpAnahtarUret();
    return { bicim: /^shb_[A-Za-z0-9]{32}$/.test(a), farkli: a !== b,
             ozetUzunluk: (await mcpOzet(a)).length, uc: MCP_UC };
  });
  // Sunucu tarafi bu kalibi bekliyor: uymayan anahtar hic aranmiyor.
  bak('anahtar sunucunun bekledigi kalipta', an.bicim === true);
  bak('her uretim farkli', an.farkli === true);
  bak('ozet SHA-256 (64 karakter)', an.ozetUzunluk === 64, String(an.ozetUzunluk));
  // Fonksiyonun slug'i 'mcp' OLMAK ZORUNDA: adres burada kuruluyor.
  // Supabase'te slug sonradan degistirilemiyor, o yuzden yanlis adla
  // kurulan fonksiyon sessizce yanlis adres uretir.
  bak('adres /functions/v1/mcp/ ile bitiyor',
      /\/functions\/v1\/mcp\/$/.test(an.uc), an.uc);

  bak('js hatasi yok', hata.length === 0, hata.slice(0,2).join(' | '));

  await t.close();
  console.log('\n' + g + ' geçti, ' + k + ' kaldı');
  process.exit(k ? 1 : 0);
})();
