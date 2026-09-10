// Script bicimlendirme. Metin DUZ METIN olarak kaliyor; dugmeler yalnizca
// isaret ekliyor. Onizleme o isaretleri ciziyor.
const { chromium } = require('./araclar');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

(async () => {
  const t = await chromium.launch({ });
  const p = await (await t.newContext({ viewport:{width:1280,height:1000} })).newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e)));
  await p.goto(KOK + '/app.html', { waitUntil:'networkidle' });
  await p.evaluate(() => { try{ localStorage.setItem('demo_tour_done','1'); }catch(e){} });
  await p.reload({ waitUntil:'networkidle' });
  await p.evaluate(() => { document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); setPage('scripts'); openScript(null, {}); });
  await p.waitForSelector('#scriptOverlay.open');

  const yaz = async (v) => p.evaluate((x)=>{ const a=document.getElementById('sc_text'); a.value=x; a.dispatchEvent(new Event('input')); }, v);
  const sec = async (b, e) => p.evaluate(([x,y])=>{ const a=document.getElementById('sc_text'); a.focus(); a.setSelectionRange(x,y); }, [b,e]);
  const oku = () => p.$eval('#sc_text', e => e.value);

  console.log('[kalin ve egik]');
  await yaz('Merhaba dünya');
  await sec(8, 13);
  await p.click('[data-bicim="kalin"]');
  bak('secili sozcuk kalinlasiyor', (await oku()) === 'Merhaba **dünya**', await oku());
  await p.click('[data-bicim="kalin"]');
  bak('ikinci basista geri aliniyor', (await oku()) === 'Merhaba dünya', await oku());
  await sec(0, 7);
  await p.click('[data-bicim="egik"]');
  bak('egik de calisiyor', (await oku()) === '*Merhaba* dünya', await oku());
  await p.click('[data-bicim="egik"]');
  bak('egik geri alinabiliyor', (await oku()) === 'Merhaba dünya');

  console.log('[klavye]');
  await sec(0, 7);
  await p.keyboard.press('Control+b');
  bak('Ctrl+B kalinlastiriyor', (await oku()) === '**Merhaba** dünya', await oku());
  await p.keyboard.press('Control+b');
  bak('Ctrl+B geri aliyor', (await oku()) === 'Merhaba dünya');

  console.log('[satir isaretleri]');
  await yaz('Açılış\nGelişme\nKapanış');
  await sec(0, 6);
  await p.click('[data-bicim="baslik"]');
  bak('baslik isareti ekleniyor', (await oku()).startsWith('## Açılış'), (await oku()).split('\n')[0]);
  await p.click('[data-bicim="baslik"]');
  bak('baslik geri alinabiliyor', (await oku()).startsWith('Açılış'));
  await sec(0, 22);
  await p.click('[data-bicim="liste"]');
  bak('cok satirda madde isareti', (await oku()) === '- Açılış\n- Gelişme\n- Kapanış', JSON.stringify(await oku()));
  await p.click('[data-bicim="liste"]');
  bak('madde isareti geri alinabiliyor', (await oku()) === 'Açılış\nGelişme\nKapanış');
  await sec(0, 22);
  await p.click('[data-bicim="sirali"]');
  bak('numarali liste sirayla', (await oku()) === '1. Açılış\n2. Gelişme\n3. Kapanış', JSON.stringify(await oku()));

  console.log('[onizleme]');
  await yaz('# Bölüm bir\n\nBu **önemli** ve bu *vurgulu*.\n\n- ilk\n- ikinci\n\n1. bir\n2. iki\n\nSon paragraf.');
  await p.click('#sc_onizleDug');
  await p.waitForTimeout(200);
  const on = await p.$eval('#sc_onizleme', e => e.innerHTML);
  bak('baslik ciziliyor', /<h2>Bölüm bir<\/h2>/.test(on), on.slice(0,80));
  bak('kalin ciziliyor', on.includes('<strong>önemli</strong>'));
  bak('egik ciziliyor', on.includes('<em>vurgulu</em>'));
  bak('madde listesi ciziliyor', /<ul><li>ilk<\/li><li>ikinci<\/li><\/ul>/.test(on), on);
  bak('numarali liste ciziliyor', /<ol><li>bir<\/li><li>iki<\/li><\/ol>/.test(on));
  bak('paragraf ciziliyor', on.includes('<p>Son paragraf.</p>'));
  bak('yazma alani gizlendi', await p.$eval('#sc_text', e => e.hidden));
  bak('dugme "Yaz" diyor', /yaz|write/i.test(await p.$eval('#sc_onizleDug', e => e.textContent)));
  await p.click('#sc_onizleDug');
  bak('geri donunce yazilabiliyor', !(await p.$eval('#sc_text', e => e.hidden)));

  console.log('[guvenlik ve kayit]');
  await yaz('<img src=x onerror=alert(1)> ve **kalın**');
  await p.click('#sc_onizleDug');
  await p.waitForTimeout(200);
  const on2 = await p.$eval('#sc_onizleme', e => e.innerHTML);
  bak('HTML calistirilmiyor, kacirilyor', !on2.includes('<img') && on2.includes('&lt;img'), on2.slice(0,80));
  bak('kacirmaya ragmen bicim calisiyor', on2.includes('<strong>kalın</strong>'));
  await p.click('#sc_onizleDug');
  await yaz('## Başlık\n\n- madde');
  await p.fill('#sc_title', 'Biçimli script');
  await p.click('#sc_save');
  await p.waitForTimeout(300);
  const kayit = await p.evaluate(() => scriptler[scriptler.length-1]);
  bak('metin DUZ METIN olarak kaydedildi', kayit.text === '## Başlık\n\n- madde', JSON.stringify(kayit.text));
  bak('HTML kaydedilmedi', !/[<>]/.test(kayit.text));

  console.log('[pencere kipi]');
  await p.evaluate((id) => openScript(id), kayit.id);
  await p.waitForSelector('#scriptOverlay.open');
  bak('pencere YAZMA kipinde aciliyor', !(await p.$eval('#sc_text', e => e.hidden)) && await p.$eval('#sc_onizleme', e => e.hidden));

  bak('sayfa hatasi yok', hata.length === 0, hata[0]);
  await t.close();
  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
