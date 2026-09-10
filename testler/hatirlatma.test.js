const { chromium } = require('./araclar');
let g=0,k=0; const ok=(a,c,e)=>{ if(c){g++;console.log('  ok  ',a);} else {k++;console.log('  YOK ',a,e===undefined?'':'→ '+e);} };

const SB = `window.supabase={createClient(){return {
  auth:{ getSession:()=>Promise.resolve({data:{session: window.__oturum||null}}),
         onAuthStateChange(f){ window.__authCb=f; return {data:{subscription:{unsubscribe(){}}}}; } },
  from(){ return { select(){return {eq(){return {maybeSingle:()=>Promise.resolve({data: window.__prefs||null, error:null})}}}},
                   upsert(r){ window.__upsert=(window.__upsert||[]).concat(r); return Promise.resolve({error:null}); } }; },
  storage:{ from(){ return {
    upload(yol, govde, o){ window.__yuk=(window.__yuk||[]).concat([{yol, tip:o&&o.contentType}]);
      return govde.text().then(m=>{ window.__ics=m; return {error: window.__yukHata||null}; }); },
    remove(yollar){ window.__sil=(window.__sil||[]).concat(yollar); return Promise.resolve({error:null}); }
  }; } }
};}};`;

async function ac(b, ayar={}) {
  const p = await b.newPage({ viewport:{width:1400,height:1000},
    permissions: ayar.izin ? ['notifications'] : [] });
  p.hatalar=[];
  p.on('pageerror', e=>p.hatalar.push('PAGEERROR: '+e.message));
  p.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|ERR_/.test(m.text())) p.hatalar.push('CONSOLE: '+m.text()); });
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); localStorage.setItem('demo_pitch','kapali'); }catch(e){} });
  if(ayar.oturum) await p.addInitScript(`window.__oturum=${JSON.stringify(ayar.oturum)};`);
  if(ayar.prefs)  await p.addInitScript(`window.__prefs=${JSON.stringify(ayar.prefs)};`);
  if(ayar.yerel)  await p.addInitScript(`try{localStorage.setItem('demo_reminders',${JSON.stringify(JSON.stringify(ayar.yerel))});}catch(e){}`);
  await p.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:SB}));
  await p.route('**/goatcounter**', r=>r.abort());
  await p.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
  return p;
}

(async()=>{
  const b = await chromium.launch({ });

  console.log('\n1. Uygulama hâlâ açılıyor (TDZ hatası yok)');
  {
    const p = await ac(b);
    ok('js hatası yok', p.hatalar.length===0, p.hatalar.join(' | '));
    ok('sol menüde hatırlatmalar var', await p.isVisible('#remindersBtn'));
    ok('takvim çizildi', (await p.$$('#calGrid .cal-day')).length > 0);
    await p.close();
  }

  console.log('\n2. Varsayılan ayarlar');
  {
    const p = await ac(b);
    await p.click('#remindersBtn');
    await p.waitForTimeout(300);
    ok('pencere açıldı', await p.isVisible('#remindersOverlay'));
    ok('bir gün önce AÇIK', await p.isChecked('#rm_once'));
    ok('termin günü KAPALI', !(await p.isChecked('#rm_gun')));
    ok('geciktiğinde AÇIK', await p.isChecked('#rm_gecikti'));
    ok('tarayıcı kanalı kapalı', !(await p.isChecked('#rm_tarayici')));
    ok('takvim kanalı kapalı', !(await p.isChecked('#rm_takvim')));
    ok('adres satırı gizli', !(await p.isVisible('#rm_adresSatir')));
    await p.close();
  }

  console.log('\n3. Zaman anahtarları kaydediliyor, hiçbiri seçilmezse uyarı');
  {
    const p = await ac(b);
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    await p.uncheck('#rm_once'); await p.uncheck('#rm_gecikti');
    await p.waitForTimeout(300);
    ok('uyarı çıktı', await p.isVisible('#rm_when_warn'));
    await p.check('#rm_gun'); await p.waitForTimeout(300);
    ok('uyarı kalktı', !(await p.isVisible('#rm_when_warn')));
    const kayit = await p.evaluate(()=>JSON.parse(localStorage.getItem('demo_reminders')));
    ok('yerelde saklandı', kayit.gun===true && kayit.once===false && kayit.gecikti===false, JSON.stringify(kayit));
    await p.close();
  }

  console.log('\n4. Takvim aboneliği: adres oluşturma');
  {
    const p = await ac(b, { oturum:{ user:{ id:'11111111-1111-1111-1111-111111111111', email:'a@b.c' } } });
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    await p.check('#rm_takvim'); await p.waitForTimeout(300);
    ok('kur düğmesi göründü', await p.isVisible('#rm_kurBtn'));
    await p.click('#rm_kurBtn'); await p.waitForTimeout(600);
    const y = await p.evaluate(()=>window.__yuk);
    ok('Storage\'a yazıldı', !!y && y.length===1, JSON.stringify(y));
    ok('doğru Content-Type', y && /text\/calendar/.test(y[0].tip), y && y[0].tip);
    ok('yol kullanıcı klasöründe', y && y[0].yol.startsWith('11111111-1111-1111-1111-111111111111/'), y && y[0].yol);
    ok('dosya adı jeton', y && /^[0-9a-f-]{36}\.ics$/i.test(y[0].yol.split('/')[1]), y && y[0].yol);
    const adres = await p.inputValue('#rm_adres');
    ok('adres gösterildi', /\/storage\/v1\/object\/public\/takvim\//.test(adres), adres);
    ok('durum "açık"', (await p.textContent('#rm_takvimDurum')).length>0);
    await p.close();
  }

  console.log('\n5. .ics içeriği');
  {
    const p = await ac(b, { oturum:{ user:{ id:'22222222-2222-2222-2222-222222222222', email:'a@b.c' } } });
    // Termini olan bir proje kur
    await p.evaluate(async ()=>{
      const p2 = projeEkle('Sümela Manastırı', '', '', 'location', '');
      adimTarihiYaz(p2, 'filmed', '2026-09-20');
      adimTarihiYaz(p2, 'edited', '2026-09-25');
      saveProjects();
    });
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    await p.check('#rm_takvim'); await p.waitForTimeout(200);
    await p.click('#rm_kurBtn'); await p.waitForTimeout(700);
    const ics = await p.evaluate(()=>window.__ics);
    ok('VCALENDAR sarmalı', /^BEGIN:VCALENDAR/.test(ics) && /END:VCALENDAR\r\n$/.test(ics));
    ok('iki olay var', (ics.match(/BEGIN:VEVENT/g)||[]).length===2, (ics.match(/BEGIN:VEVENT/g)||[]).length);
    ok('gün boyu tarih biçimi', /DTSTART;VALUE=DATE:20260920/.test(ics));
    ok('bitiş ertesi gün', /DTEND;VALUE=DATE:20260921/.test(ics));
    ok('UID adıma sabit', /UID:slate-[^\r\n]*-filmed@slate/.test(ics));
    ok('proje adı geçiyor', /S[^\r\n]*mela/.test(ics));
    ok('bir gün önce alarmı var', /TRIGGER;VALUE=DURATION:-PT15H/.test(ics));
    ok('termin günü alarmı YOK (kapalı)', !/TRIGGER;VALUE=DURATION:PT9H/.test(ics));
    ok('satırlar CRLF', ics.indexOf('\r\n') > 0 && !/[^\r]\n/.test(ics));
    const uzun = ics.split('\r\n').filter(l=>Buffer.byteLength(l,'utf8')>75);
    ok('hiçbir satır 75 okteti geçmiyor', uzun.length===0, uzun.slice(0,2).join(' // '));
    ok('script metni SIZMIYOR', !/DESCRIPTION:.*http/i.test(ics));
    await p.close();
  }

  console.log('\n6. Termin günü açılınca alarm ekleniyor');
  {
    const p = await ac(b, { oturum:{ user:{ id:'33333333-3333-3333-3333-333333333333', email:'a@b.c' } },
                            yerel:{ once:false, gun:true, gecikti:true, takvim:false } });
    await p.evaluate(()=>{ const x=projeEkle('Test','', '', 'studio',''); adimTarihiYaz(x,'script','2026-10-01'); saveProjects(); });
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    await p.check('#rm_takvim'); await p.waitForTimeout(200);
    await p.click('#rm_kurBtn'); await p.waitForTimeout(700);
    const ics = await p.evaluate(()=>window.__ics);
    ok('termin günü alarmı var', /TRIGGER;VALUE=DURATION:PT9H/.test(ics));
    ok('bir gün önce alarmı yok', !/TRIGGER;VALUE=DURATION:-PT15H/.test(ics));
    await p.close();
  }

  console.log('\n7. Bitmiş adım takvime GİRMİYOR');
  {
    const p = await ac(b, { oturum:{ user:{ id:'44444444-4444-4444-4444-444444444444', email:'a@b.c' } } });
    await p.evaluate(()=>{
      const x = projeEkle('Bitti','', '', 'studio','');
      adimTarihiYaz(x,'script','2026-10-05'); adimTarihiYaz(x,'filmed','2026-10-06');
      x.script = true; saveProjects();
    });
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    await p.check('#rm_takvim'); await p.waitForTimeout(200);
    await p.click('#rm_kurBtn'); await p.waitForTimeout(700);
    const ics = await p.evaluate(()=>window.__ics);
    ok('yalnızca bitmemiş adım var', (ics.match(/BEGIN:VEVENT/g)||[]).length===1, (ics.match(/BEGIN:VEVENT/g)||[]).length);
    ok('işaretli adım yok', !/-script@slate/.test(ics));
    await p.close();
  }

  console.log('\n8. İptal: adres ÖLÜYOR');
  {
    const p = await ac(b, { oturum:{ user:{ id:'55555555-5555-5555-5555-555555555555', email:'a@b.c' } } });
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    await p.check('#rm_takvim'); await p.waitForTimeout(200);
    await p.click('#rm_kurBtn'); await p.waitForTimeout(600);
    const eskiYol = (await p.evaluate(()=>window.__yuk))[0].yol;
    // Uygulama artik kendi onayla() penceresini kullaniyor.
    await p.evaluate(()=>{ window.onayla = ()=> Promise.resolve(true); });
    await p.uncheck('#rm_takvim'); await p.waitForTimeout(600);
    const silinen = await p.evaluate(()=>window.__sil);
    ok('eski dosya silindi', !!silinen && silinen.includes(eskiYol), JSON.stringify(silinen));
    const kayit = await p.evaluate(()=>JSON.parse(localStorage.getItem('demo_reminders')));
    ok('jeton temizlendi', kayit.jeton === '', kayit.jeton);
    ok('adres satırı gizlendi', !(await p.isVisible('#rm_adresSatir')));
    await p.close();
  }

  console.log('\n9. Yenile: yeni yazılıp SONRA eski siliniyor');
  {
    const p = await ac(b, { oturum:{ user:{ id:'66666666-6666-6666-6666-666666666666', email:'a@b.c' } } });
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    await p.check('#rm_takvim'); await p.waitForTimeout(200);
    await p.click('#rm_kurBtn'); await p.waitForTimeout(600);
    const ilkYol = (await p.evaluate(()=>window.__yuk))[0].yol;
    // Uygulama artik kendi onayla() penceresini kullaniyor.
    await p.evaluate(()=>{ window.onayla = ()=> Promise.resolve(true); });
    await p.click('#rm_yenileBtn'); await p.waitForTimeout(800);
    const y = await p.evaluate(()=>window.__yuk);
    const sil = await p.evaluate(()=>window.__sil);
    ok('yeni adres yazıldı', y.length===2 && y[1].yol!==ilkYol, y.map(x=>x.yol).join(' , '));
    ok('eski adres silindi', !!sil && sil.includes(ilkYol), JSON.stringify(sil));
    ok('abonelik açık kaldı', await p.isVisible('#rm_adresSatir'));
    await p.close();
  }

  console.log('\n10. Kova yoksa sebebi söyleniyor');
  {
    const p = await ac(b, { oturum:{ user:{ id:'77777777-7777-7777-7777-777777777777', email:'a@b.c' } } });
    await p.evaluate(()=>{ window.__yukHata = { message:'Bucket not found' }; });
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    await p.check('#rm_takvim'); await p.waitForTimeout(200);
    await p.click('#rm_kurBtn'); await p.waitForTimeout(700);
    const m = await p.textContent('#rm_takvimDurum');
    ok('sql/19 söyleniyor', /sql\/19/.test(m), m);
    await p.close();
  }

  console.log('\n11. Girişsizken takvim kanalı sebebini söylüyor');
  {
    const p = await ac(b);
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    await p.check('#rm_takvim'); await p.waitForTimeout(300);
    const m = await p.textContent('#rm_takvimDurum');
    ok('giriş yap deniyor', m.length > 0, m);
    await p.close();
  }

  // 12. bolum kaldirildi: "ayarlar buluta gidiyor, tarayici anahtari
  // gitmiyor" kontrolu dil-bulut.test.js'e tasindi — oradaki fikstur
  // tercih akisinin tamamini tasiyor, buradaki ince taklit tasimiyordu.

  console.log('\n13. Buluttan gelen ayar uygulanıyor');
  {
    const p = await ac(b, { oturum:{ user:{ id:'99999999-9999-9999-9999-999999999999', email:'a@b.c' } },
                            prefs:{ prefs:{ lang:'tr', reminders:{ takvim:true, once:false, gun:true, gecikti:false, jeton:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
                                    updated_at:new Date().toISOString() } });
    await p.click('#remindersBtn'); await p.waitForTimeout(400);
    ok('termin günü buluttan geldi', await p.isChecked('#rm_gun'));
    ok('bir gün önce kapandı', !(await p.isChecked('#rm_once')));
    ok('takvim açık geldi', await p.isChecked('#rm_takvim'));
    ok('adres buluttaki jetondan', (await p.inputValue('#rm_adres')).includes('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
    await p.close();
  }

  console.log('\n13b. Adres oluşunca talimat kendiliğinden açılıyor');
  {
    const p = await ac(b, { oturum:{ user:{ id:'11111111-1111-1111-1111-111111111111', email:'a@b.c' } } });
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    ok('talimat başta kapalı', !(await p.evaluate(()=>document.querySelector('.rm-nasil').open)));
    await p.check('#rm_takvim'); await p.waitForTimeout(300);
    await p.click('#rm_kurBtn'); await p.waitForTimeout(700);
    ok('adres oluştu', (await p.inputValue('#rm_adres')).startsWith('http'));
    ok('talimat KENDİLİĞİNDEN açıldı', await p.evaluate(()=>document.querySelector('.rm-nasil').open));
    ok('adres etiketi görünür', await p.isVisible('.rm-adres-et'));
    const g = await p.textContent('[data-i18n-html="rm_cal_how_g"]');
    ok('Google adımı adresi yapıştırmayı söylüyor', /yapıştır|paste/i.test(g), g.slice(0,50));
    const k = await p.evaluate(()=>document.querySelector('[data-i18n-html="rm_cal_how_0"]').textContent);
    ok('kalın etiket düz metin DEĞİL', !/<b>|&lt;b&gt;/.test(k), k.slice(0,50));
    ok('ilk çekim gecikmesi yazıyor', (await p.textContent('.rm-ilk')).length > 30);
    await p.close();
  }

  console.log('\n14. Dosya indirme: uyarı katlı, boşken söylüyor');
  {
    const p = await ac(b);
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    const uyariGorunur = await p.isVisible('.rm-uyari');
    ok('uyarı başta GİZLİ (katlı)', !uyariGorunur);
    // Katı, indirme dügmesini ICEREN details'a bakarak ac: metne ya da
    // siraya gore secmek dile ve yerlesime bagli, kirilgan.
    await p.evaluate(()=>{
      const d = document.getElementById('rm_dosyaBtn').closest('details');
      d.open = true;
    });
    await p.waitForTimeout(200);
    ok('kat açılınca uyarı görünüyor', await p.isVisible('.rm-uyari'));
    await p.click('#rm_dosyaBtn'); await p.waitForTimeout(300);
    ok('termin yokken söylüyor', (await p.textContent('#rm_dosyaDurum')).length>0);
    await p.close();
  }

  console.log('\n15. Bozuk yerel ayar uygulamayı kırmıyor');
  {
    const p = await b.newPage();
    p.hatalar=[]; p.on('pageerror', e=>p.hatalar.push(e.message));
    await p.addInitScript(()=>{ try{
      localStorage.setItem('demo_seen_intro','1');
      localStorage.setItem('demo_reminders','{bozuk json');
    }catch(e){} });
    await p.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',body:SB}));
    await p.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
    await p.waitForTimeout(1500);
    ok('js hatası yok', p.hatalar.length===0, p.hatalar.join(' | '));
    await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });
    await p.click('#remindersBtn'); await p.waitForTimeout(200);
    ok('varsayılana döndü', await p.isChecked('#rm_once'));
    await p.close();
  }

  console.log('\n16. Jeton yol gezinmesi taşımıyor');
  {
    const p = await ac(b, { oturum:{ user:{ id:'aaaaaaaa-0000-0000-0000-000000000000', email:'a@b.c' } },
                            yerel:{ takvim:true, jeton:'../../gizli' } });
    await p.click('#remindersBtn'); await p.waitForTimeout(300);
    const adres = await p.inputValue('#rm_adres').catch(()=>'');
    ok('bozuk jeton reddedildi', !adres.includes('..'), adres);
    await p.close();
  }

  await b.close();
  console.log('\n=== gecen ' + g + ' / kalan ' + k + ' ===');
  process.exit(k?1:0);
})();
