// AI ERISIMI — UYGULAMA TARAFI.
//
// Iki yol olculuyor:
//   1) Paket yapistirma (anonim): AI'nin verdigi JSON Ice Aktar kutusuna
//      yapistiriliyor; kayit/proje/mekan/script/fikir dogru yerlere dusuyor,
//      ayni adli proje GUNCELLENIYOR (ikinci kopya yok), "AI" rozeti
//      cikiyor, geri alma eklenenleri silip degiseni eski haline getiriyor,
//      defter sayfa yenilense de duruyor.
//   2) Anahtar yonetimi (girisli, Supabase taklit): Hesabim > AI erisimi'nde
//      yeni anahtar shb_ ile basliyor, buluta yalnizca SHA-256 ozeti
//      gidiyor, listede on eki gorunuyor, iptal revoked_at yaziyor, tablo
//      yoksa "kurulmadi" deniyor, buluttan yenile bulut kopyasini getiriyor.
const { chromium } = require('./araclar');
const crypto = require('crypto');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const bugun = (()=>{ const d = new Date(); const p = n=> String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; })();

async function sayfaAc(t, oncesi){
  const p = await (await t.newContext({ viewport:{ width:1280, height:1000 } })).newPage();
  const hatalar = [];
  p.on('pageerror', e=> hatalar.push(String(e)));
  p.on('console', m=>{ if(m.type() === 'error' && !/Failed to load resource|net::ERR|supabase/i.test(m.text())) hatalar.push(m.text()); });
  await p.route('**tile.openstreetmap.org**', r=> r.abort());
  await p.route('**goatcounter**', r=> r.abort());
  await p.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro', '1'); localStorage.setItem('demo_tour_done', '1'); localStorage.setItem('demo_nudge_off', '1'); }catch(e){} });
  if(oncesi) await p.addInitScript(oncesi);
  await p.goto(KOK + '/app.html', { waitUntil: 'networkidle' });
  await p.evaluate(()=>{
    document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open'));
    window.__uyarilar = [];
    window.onayla = async ()=> true;
    window.sor = async ()=> 'ChatGPT';
    window.uyari = async (m)=>{ window.__uyarilar.push(String(m)); };
  });
  return { p, hatalar };
}

(async () => {
  const t = await chromium.launch();

  // ================= 1) PAKET YAPISTIRMA (anonim) =================
  {
    const { p, hatalar } = await sayfaAc(t);
    // Var olan bir proje: paket ayni adi (kucuk harfle) tasiyor, GUNCELLENMELI.
    const onceki = await p.evaluate(()=>{
      const sahil = projeEkle('Sahil', '', '', 'outdoor', '');
      sahil.notes = 'eski not'; saveProjects();
      return { kayit: events.length, proje: projects.length, mekan: mekanlar.length, script: scriptler.length, fikir: fikirler.length, sahilId: sahil.id };
    });
    const paket = {
      shootboard: 1, source: 'ChatGPT', note: 'deneme',
      places: [{ name: 'Büyük Valide Han', city: 'İstanbul', district: 'Fatih', lat: 41.02, lon: 28.97 }],
      projects: [
        { name: 'Hanlar', type: 'venue', shootDate: bugun, places: ['büyük valide han', 'Olmayan Mekan'], steps: { script: true } },
        { name: 'sahil', notes: 'yeni not' }
      ],
      entries: [
        { date: bugun, time: '19:00', type: 'video', platform: 'youtube', title: 'AI kaydi 1', project: 'Hanlar', content: { caption: 'aciklama' } },
        { date: bugun, time: '20:00', type: 'reels', platform: 'instagram', title: 'AI kaydi 2', project: 'Hanlar' },
        { date: bugun, platform: 'threads', type: 'text_post', title: 'AI kaydi 3', project: 'Olmayan Proje' }
      ],
      scripts: [{ title: 'VO v1', text: 'ACILIS\nCati.', project: 'Hanlar' }],
      ideas: [{ text: 'fikir bir', project: 'Hanlar', due: bugun }, { text: 'fikir iki' }]
    };
    await p.click('#importBtn');
    await p.waitForSelector('#importOverlay.open');
    bak('ice aktar: paket ipucu ve ai/ baglantisi var', await p.$eval('.imp-paket-ipucu a', a=> a.getAttribute('href')) === 'ai/');
    bak('ice aktar: son aktarimlar blogu bos oldugu icin gizli', await p.$eval('#imp_aiBlok', el=> el.hidden));
    // Kod citi ile yapistirma: AI yanitindan kopyalanan metin boyle gelir.
    await p.fill('#imp_metin', '```json\n' + JSON.stringify(paket, null, 2) + '\n```');
    await p.waitForFunction(()=> !document.getElementById('imp_uygula').disabled, null, { timeout: 8000 });
    bak('paket taninip kaynagi yazildi', /ChatGPT/.test(await p.$eval('#imp_satirSay', el=> el.textContent)));
    bak('ozet sayilar: 3 kayit, 2 proje, 1 mekan, 1 script, 2 fikir', /3 entries, 2 projects, 1 place, 1 script, 2 ideas/.test(await p.$eval('#imp_ozet', el=> el.textContent)), await p.$eval('#imp_ozet', el=> el.textContent));
    bak('eslesme blogu gizli, onizleme acik', await p.$eval('#imp_eslesBlok', el=> el.hidden) && !(await p.$eval('#imp_onizlemeBlok', el=> el.hidden)));
    bak('onizleme kayit satirini gosteriyor', /AI kaydi 1/.test(await p.$eval('#imp_onizleme', el=> el.textContent)));
    bak('onizleme daha uygulamadan olmayan proje ve mekani soyluyor', /Olmayan Proje/.test(await p.$eval('#imp_uyari', el=> el.textContent)) && /Olmayan Mekan/.test(await p.$eval('#imp_uyari', el=> el.textContent)), await p.$eval('#imp_uyari', el=> el.textContent));
    await p.click('#imp_uygula');
    await p.waitForFunction(()=> !document.getElementById('importOverlay').classList.contains('open'), null, { timeout: 8000 });
    const sonra = await p.evaluate(()=>{
      const hanlar = projects.find(x=> x.name === 'Hanlar');
      const mekan = mekanlar.find(m=> m.name === 'Büyük Valide Han');
      const sahil = projects.filter(x=> x.name.toLowerCase() === 'sahil');
      const k1 = events.find(e=> e.title === 'AI kaydi 1');
      const k3 = events.find(e=> e.title === 'AI kaydi 3');
      return {
        kayit: events.length, proje: projects.length, mekan: mekanlar.length, script: scriptler.length, fikir: fikirler.length,
        hanlar: hanlar && { placeIds: hanlar.placeIds, placeId: hanlar.placeId, type: hanlar.type, shootDate: hanlar.shootDate, script: hanlar.script },
        mekanId: mekan && mekan.id, mekanSource: mekan && mekan.source, mekanLat: mekan && mekan.lat,
        sahilSayi: sahil.length, sahilNot: sahil[0] && sahil[0].notes, sahilTur: sahil[0] && sahil[0].type,
        k1: k1 && { projectId: k1.content.projectId, concept: k1.content.concept, caption: k1.content.caption, time: k1.time, uploaded: k1.uploaded },
        k3: k3 && { projectId: k3.content.projectId, concept: k3.content.concept },
        scriptDetay: scriptler[0] && { source: scriptler[0].source, projectId: scriptler[0].projectId, text: scriptler[0].text },
        fikirDetay: fikirler.find(f=> f.text === 'fikir bir'),
        defter: aiDefter.length, defterKaynak: aiDefter[0] && aiDefter[0].kaynak,
        defterOnceki: aiDefter[0] && aiDefter[0].onceki && aiDefter[0].onceki.projects && aiDefter[0].onceki.projects[0].notes,
        rozetProje: aiEklenenler.has('projects:' + (hanlar && hanlar.id)),
        uyarilar: window.__uyarilar
      };
    });
    bak('sayilar: +3 kayit, +1 proje, +1 mekan, +1 script, +2 fikir', sonra.kayit === onceki.kayit + 3 && sonra.proje === onceki.proje + 1 && sonra.mekan === onceki.mekan + 1 && sonra.script === onceki.script + 1 && sonra.fikir === onceki.fikir + 2, JSON.stringify([onceki, sonra.kayit, sonra.proje, sonra.mekan, sonra.script, sonra.fikir]));
    bak('proje: mekan adla bagli (ilk durak), tur, cekim gunu, script adimi', sonra.hanlar && sonra.hanlar.placeIds.length === 1 && sonra.hanlar.placeIds[0] === sonra.mekanId && sonra.hanlar.placeId === sonra.mekanId && sonra.hanlar.type === 'venue' && sonra.hanlar.shootDate === bugun && sonra.hanlar.script === true, JSON.stringify(sonra.hanlar));
    bak('mekan: koordinat ve source manual', sonra.mekanLat === 41.02 && sonra.mekanSource === 'manual');
    bak('ayni adli proje guncellendi, ikinci kopya yok, turu korundu', sonra.sahilSayi === 1 && sonra.sahilNot === 'yeni not' && sonra.sahilTur === 'outdoor');
    bak('kayit: proje bagi, concept, caption, saat, yayinlanmadi', sonra.k1 && sonra.k1.projectId && sonra.k1.concept === 'Hanlar' && sonra.k1.caption === 'aciklama' && sonra.k1.time === '19:00' && sonra.k1.uploaded === false, JSON.stringify(sonra.k1));
    bak('olmayan proje: kayit projesiz ve concept bos', sonra.k3 && sonra.k3.projectId === '' && sonra.k3.concept === '');
    bak('script: source ai, projeye bagli', sonra.scriptDetay && sonra.scriptDetay.source === 'ai' && sonra.scriptDetay.projectId && /ACILIS/.test(sonra.scriptDetay.text));
    bak('fikir: tarihli ve projeye bagli', sonra.fikirDetay && sonra.fikirDetay.due === bugun && sonra.fikirDetay.projectId);
    bak('defter: 1 satir, kaynak ChatGPT, onceki proje hali sakli', sonra.defter === 1 && sonra.defterKaynak === 'ChatGPT' && sonra.defterOnceki === 'eski not');
    bak('rozet kumesi projeyi iceriyor', sonra.rozetProje === true);
    bak('uyari penceresi: olmayan mekan ve proje soylendi', sonra.uyarilar.length === 1 && /Olmayan Mekan/.test(sonra.uyarilar[0]) && /Olmayan Proje/.test(sonra.uyarilar[0]), JSON.stringify(sonra.uyarilar));
    // Rozetler ekranda: projeler sayfasi ve takvim.
    await p.evaluate(()=>{ setPage('projects'); });
    bak('projeler sayfasinda AI rozeti', (await p.$$('#projectList .ai-rozet')).length >= 1);
    bak('rozet basligi kaynagi soyluyor', /ChatGPT/.test(await p.$eval('#projectList .ai-rozet', el=> el.title)));
    await p.evaluate(()=>{ setPage('calendar'); renderCal(); });
    bak('takvimde AI rozetli kartlar (3)', (await p.$$('.cal-chip .ai-rozet')).length === 3, String((await p.$$('.cal-chip .ai-rozet')).length));
    await p.evaluate(()=>{ setPage('scripts'); });
    bak('script kartinda AI rozeti', (await p.$$('#sc_list .ai-rozet')).length === 1);
    await p.evaluate(()=>{ setPage('places'); });
    bak('mekan kartinda AI rozeti', (await p.$$('#mk_list .ai-rozet')).length === 1);
    await p.evaluate(()=>{ setPage('ideas'); });
    bak('fikir kartlarinda AI rozeti (2)', (await p.$$('#fk_list .ai-rozet, .fk-card .ai-rozet')).length === 2, String((await p.$$('.fk-card .ai-rozet')).length));

    // Sayfa yenilenince defter ve rozetler yerelden geri geliyor.
    await p.reload({ waitUntil: 'networkidle' });
    await p.evaluate(()=>{ document.querySelectorAll('.overlay.open').forEach(o=> o.classList.remove('open')); window.onayla = async ()=> true; window.uyari = async ()=>{}; });
    const yenilenmis = await p.evaluate(()=> ({ defter: aiDefter.length, rozet: aiEklenenler.size }));
    bak('yenilemeden sonra defter ve rozetler duruyor', yenilenmis.defter === 1 && yenilenmis.rozet === 3 + 2 + 1 + 1 + 2, JSON.stringify(yenilenmis));

    // Geri alma: Ice Aktar penceresindeki listeden.
    await p.click('#importBtn');
    try{ await p.waitForSelector('#importOverlay.open', { timeout: 8000 }); }
    catch(e){
      console.log('TESHIS', JSON.stringify(await p.evaluate(()=>{
        let hata = ''; try{ impPenceresiniAc(); }catch(err){ hata = String(err && err.stack); }
        return { hata, acik: [...document.querySelectorAll('.overlay.open')].map(o=> o.id), sayfa: localStorage.getItem('demo_page'), defter: aiDefter.length };
      })));
    }
    bak('son aktarimlar blogu gorunur, 1 satir, Geri al dugmesi', !(await p.$eval('#imp_aiBlok', el=> el.hidden)) && (await p.$$('#imp_aiListe [data-ai-geri]')).length === 1);
    bak('satir kaynak ve sayilari yaziyor', /ChatGPT/.test(await p.$eval('#imp_aiListe', el=> el.textContent)) && /3 entries/.test(await p.$eval('#imp_aiListe', el=> el.textContent)));
    await p.click('#imp_aiListe [data-ai-geri]');
    await p.waitForFunction(()=> aiDefter[0] && !!aiDefter[0].geri_alindi_at, null, { timeout: 8000 });
    const geri = await p.evaluate(()=> ({
      kayit: events.length, proje: projects.length, mekan: mekanlar.length, script: scriptler.length, fikir: fikirler.length,
      hanlar: !!projects.find(x=> x.name === 'Hanlar'), sahilNot: (projects.find(x=> x.name.toLowerCase() === 'sahil') || {}).notes,
      rozet: aiEklenenler.size, liste: document.getElementById('imp_aiListe').textContent
    }));
    bak('geri al: eklenenler gitti, sayilar eski haline dondu', geri.kayit === onceki.kayit && geri.proje === onceki.proje && geri.mekan === onceki.mekan && geri.script === onceki.script && geri.fikir === onceki.fikir && !geri.hanlar, JSON.stringify(geri));
    bak('geri al: guncellenen proje eski notuna dondu', geri.sahilNot === 'eski not');
    bak('geri al: rozet kalmadi, listede "undone"', geri.rozet === 0 && /undone/.test(geri.liste));

    // Tablo yapistirma hala calisiyor (paket degil).
    await p.fill('#imp_metin', 'Date\tPlatform\tTitle\n' + bugun + '\tInstagram\tTablo satiri');
    await p.waitForFunction(()=> !document.getElementById('imp_uygula').disabled, null, { timeout: 5000 });
    bak('tablo yolu bozulmadi: eslesme blogu acik', !(await p.$eval('#imp_eslesBlok', el=> el.hidden)));
    bak('sayfa hatasi yok', hatalar.length === 0, hatalar.join(' | ').slice(0, 300));
    await p.context().close();
  }

  // ================= 2) ANAHTAR YONETIMI (girisli, Supabase taklit) =================
  {
    const { p, hatalar } = await sayfaAc(t);
    await p.evaluate(()=>{
      window.__db = { api_keys: [], ai_aktarimlar: [], calendar_events: [], projects: [], ideas: [], scripts: [], places: [], user_prefs: [], caption_templates: [] };
      window.__yazmalar = [];
      window.__tabloYok = {};
      const hata = (tablo)=> window.__tabloYok[tablo] ? { message: `relation "public.${tablo}" does not exist` } : null;
      function sorgu(tablo){
        const q = {
          _suzgec: [],
          select(){ return q; }, order(){ return q; }, limit(){ return q; }, is(){ return q; }, in(){ return q; },
          eq(alan, deger){ q._suzgec.push([alan, deger]); return q; },
          maybeSingle(){ return Promise.resolve({ data: null, error: hata(tablo) }); },
          insert(satir){
            window.__yazmalar.push({ tablo, islem: 'insert', satir });
            if(!hata(tablo)) (window.__db[tablo] = window.__db[tablo] || []).push(Object.assign({}, satir));
            return Promise.resolve({ data: null, error: hata(tablo) });
          },
          upsert(satirlar){ window.__yazmalar.push({ tablo, islem: 'upsert', adet: satirlar.length }); return Promise.resolve({ data: satirlar, error: hata(tablo) }); },
          update(alanlar){
            const p2 = Promise.resolve({ data: null, error: hata(tablo) });
            p2.eq = (alan, deger)=>{
              window.__yazmalar.push({ tablo, islem: 'update', alanlar, alan, deger });
              (window.__db[tablo] || []).forEach(r=>{ if(r[alan] === deger) Object.assign(r, alanlar); });
              return Promise.resolve({ data: null, error: hata(tablo) });
            };
            p2.in = ()=> Promise.resolve({ data: null, error: null });
            return p2;
          },
          delete(){ return { eq(){ return Promise.resolve({ error: null }); }, in(){ return Promise.resolve({ error: null }); } }; },
          then(res, rej){
            const e = hata(tablo);
            return Promise.resolve(e ? { data: null, error: e } : { data: (window.__db[tablo] || []).slice(), error: null }).then(res, rej);
          }
        };
        return q;
      }
      session = { user: { id: 'kim-1', email: 'a@b.c', app_metadata: { provider: 'email' }, user_metadata: {} } };
      sb = {
        from: sorgu,
        storage: { from(){ return { list(){ return Promise.resolve({ data: [], error: null }); }, upload(){ return Promise.resolve({ error: null }); }, remove(){ return Promise.resolve({ error: null }); } }; } },
        auth: { signOut(){ return Promise.resolve({}); }, updateUser(){ return Promise.resolve({ error: null }); } },
        rpc(){ return Promise.resolve({ error: null }); }
      };
      hesapPenceresiniAc();
    });
    await p.waitForSelector('#hesapOverlay.open');
    await p.waitForFunction(()=> /No keys yet/.test(document.getElementById('aiAnahtarListe').textContent), null, { timeout: 5000 }).catch(()=>{});
    bak('AI erisimi bolumu var ve "anahtar yok" yaziyor', await p.$eval('#hesapAi', el=> !el.hidden) && /No keys yet/.test(await p.$eval('#aiAnahtarListe', el=> el.textContent)));
    bak('anahtar kutusu kapali', await p.$eval('#aiAnahtarKutusu', el=> el.hidden));
    await p.click('#aiAnahtarYeni');
    await p.waitForFunction(()=> !document.getElementById('aiAnahtarKutusu').hidden, null, { timeout: 8000 });
    const anahtar = await p.$eval('#aiAnahtarMetin', el=> el.value);
    bak('anahtar shb_ ile basliyor, 36 karakter', /^shb_[A-Za-z0-9]{32}$/.test(anahtar), anahtar);
    const satir = await p.evaluate(()=> window.__db.api_keys[0]);
    const ozet = crypto.createHash('sha256').update(anahtar).digest('hex');
    bak('buluta yalnizca SHA-256 ozeti gitti', satir && satir.key_hash === ozet && satir.user_id === 'kim-1' && satir.label === 'ChatGPT' && satir.key_prefix === anahtar.slice(0, 12), JSON.stringify(satir));
    bak('satirda duz anahtar YOK', !JSON.stringify(satir).includes(anahtar));
    bak('yetkiler read+write', Array.isArray(satir.scopes) && satir.scopes.includes('read') && satir.scopes.includes('write'));
    await p.waitForFunction(()=> document.querySelectorAll('#aiAnahtarListe [data-ai-anahtar]').length === 1, null, { timeout: 5000 });
    bak('listede etiket ve on ek', /ChatGPT/.test(await p.$eval('#aiAnahtarListe', el=> el.textContent)) && (await p.$eval('#aiAnahtarListe', el=> el.textContent)).includes(anahtar.slice(0, 12)));
    bak('listede duz anahtar yok', !(await p.$eval('#aiAnahtarListe', el=> el.textContent)).includes(anahtar));
    await p.click('#aiAnahtarListe [data-ai-iptal]');
    await p.waitForFunction(()=> /No keys yet/.test(document.getElementById('aiAnahtarListe').textContent), null, { timeout: 5000 });
    const iptal = await p.evaluate(()=> window.__db.api_keys[0].revoked_at);
    bak('iptal: revoked_at yazildi, liste bosaldi', !!iptal);

    // Tablo kurulmamis: anlasilir mesaj.
    await p.evaluate(()=>{ window.__tabloYok.api_keys = true; aiBolumuCiz(); });
    await p.waitForFunction(()=> /not set up/.test(document.getElementById('aiAnahtarDurum').textContent), null, { timeout: 5000 }).catch(()=>{});
    bak('sql/35 yoksa "kurulmadi" uyarisi', /not set up/.test(await p.$eval('#aiAnahtarDurum', el=> el.textContent)), await p.$eval('#aiAnahtarDurum', el=> el.textContent));
    await p.evaluate(()=>{ window.__tabloYok.api_keys = false; });

    // Buluttan yenile: bulutta olan kayit ekrana geliyor.
    await p.evaluate(()=>{
      window.__db.calendar_events.push({ id: 'bulut-1', user_id: 'kim-1', type: 'video', platform: 'youtube', title: 'Bulut kaydi', post_date: '2026-09-15', post_time: '10:00', uploaded: false, content: {}, workspace_id: null, project_id: null, deleted_at: null });
      window.__db.ai_aktarimlar.push({ id: 'ak_bulut', user_id: 'kim-1', created_at: new Date().toISOString(), kaynak: 'Claude', ozet: { created: { entries: 1 }, updated: {} }, kayitlar: ['bulut-1'], projeler: [], mekanlar: [], scriptler: [], fikirler: [], onceki: {}, geri_alindi_at: null });
      dirtyIds.clear(); removedIds.clear(); projDirty.clear(); fikirDirty.clear(); scriptDirty.clear(); mekanDirty.clear();
    });
    await p.click('#aiYenile');
    await p.waitForFunction(()=> events.some(e=> e.id === 'bulut-1'), null, { timeout: 8000 });
    const yenile = await p.evaluate(()=> ({ var: events.some(e=> e.id === 'bulut-1'), rozet: aiEklenenler.has('entries:bulut-1'), liste: document.getElementById('aiAktarimListe').textContent }));
    bak('buluttan yenile: bulut kaydi geldi, AI rozeti ve defter satiri var', yenile.var && yenile.rozet && /Claude/.test(yenile.liste), JSON.stringify(yenile));
    bak('hesap silme tablolari yeni tablolari kapsiyor', await p.evaluate(()=> HESAP_TABLOLARI.includes('api_keys') && HESAP_TABLOLARI.includes('ai_aktarimlar')));
    bak('sayfa hatasi yok', hatalar.length === 0, hatalar.join(' | ').slice(0, 300));
    await p.context().close();
  }

  await t.close();
  console.log(`\n${g} gecti, ${k} kaldi`);
  process.exit(k ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
