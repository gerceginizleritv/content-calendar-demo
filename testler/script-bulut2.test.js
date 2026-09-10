const { chromium } = require('./araclar');
(async () => {
  const b = await chromium.launch({ });
  const page = await b.newPage({ viewport:{width:1280,height:1000} });
  let hata=0; const k=(a,s,e)=>{ console.log((s?'  ✔ ':'  ✖ ')+a+(e!==undefined?' → '+JSON.stringify(e):'')); if(!s) hata++; };
  page.on('pageerror', e=>{ console.log('  SAYFA HATASI: '+e); hata++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('demo_seen_intro','1'); }catch(e){} });
  await page.route('**/supabase-js**', r=>r.fulfill({status:200,contentType:'application/javascript',
    body:'window.supabase={createClient(){return {auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};}};'}));
  await page.route('**/goatcounter**', r=>r.abort());
  await page.goto('http://127.0.0.1:8098/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('SCRIPT / FİKİR — BULUT SATIRI DÖNÜŞÜMÜ');

  const r = await page.evaluate(()=>{
    const s = { id:'11111111-1111-4111-8111-111111111111', title:'Kariye — bölüm 1',
      text:'Mozaikler üzerine.', source:'ai', projectId:'p_kariye',
      driveFileId:'DOSYA1', driveFileName:'Kariye.docx', driveModified:'2026-09-01T10:00:00Z',
      createdAt: Date.parse('2026-09-01T09:00:00Z'), updatedAt: Date.parse('2026-09-02T09:00:00Z') };
    const satir = scriptRowYap(s, 'kullanici-1');
    const geri  = scriptRowOku(satir);

    // Buluttan gelen satirda proje YALNIZCA sutunda olabiliyor
    const yalnizSutun = scriptRowOku({ id:'22222222-2222-4222-8222-222222222222',
      title:'Balat', content:'metin', source:'drive', project_id:'p_balat',
      created_at:'2026-09-01T09:00:00Z', updated_at:'2026-09-02T09:00:00Z' });

    // Bozuk satir uygulamayi dusurmuyor
    let bozukHata = null, bozuk = null;
    try{ bozuk = scriptRowOku({ id:'33333333-3333-4333-8333-333333333333' }); }
    catch(e){ bozukHata = String(e); }

    const f = { id:'44444444-4444-4444-8444-444444444444', text:'Bir fikir',
      parts:[{id:'a', text:'Bir fikir'},{id:'b', text:'İkinci parça'}],
      projectId:'p_kariye', sort:3,
      createdAt: Date.parse('2026-09-01T09:00:00Z'), updatedAt: Date.parse('2026-09-02T09:00:00Z') };
    const fSatir = fikirRowYap(f, 'kullanici-1');
    const fGeri  = fikirRowOku(fSatir);

    return { satir, geri, yalnizSutun, bozuk, bozukHata, fSatir, fGeri };
  });

  k('script satırı user_id taşıyor', r.satir.user_id === 'kullanici-1');
  k('metin "content" sütununa gidiyor', r.satir.content === 'Mozaikler üzerine.', r.satir.content);
  k('proje ayrı sütunda', r.satir.project_id === 'p_kariye', r.satir.project_id);
  k('MEZAR TAŞI temizleniyor (deleted_at null)', r.satir.deleted_at === null);
  k('Drive bağı satırda duruyor', r.satir.drive_file_id === 'DOSYA1' && r.satir.drive_file_name === 'Kariye.docx');
  k('zaman damgaları ISO', /^2026-09-02T/.test(r.satir.updated_at), r.satir.updated_at);

  k('gidip gelince metin aynı', r.geri.text === 'Mozaikler üzerine.', r.geri.text);
  k('gidip gelince başlık aynı', r.geri.title === 'Kariye — bölüm 1', r.geri.title);
  k('gidip gelince proje aynı', r.geri.projectId === 'p_kariye', r.geri.projectId);
  k('kaynak "ai" korunuyor', r.geri.source === 'ai', r.geri.source);
  k('Drive bağı korunuyor', r.geri.driveFileId === 'DOSYA1' && r.geri.driveModified === '2026-09-01T10:00:00Z');
  k('updatedAt korunuyor', r.geri.updatedAt === Date.parse('2026-09-02T09:00:00Z'), r.geri.updatedAt);

  k('proje YALNIZCA sütunda olsa da okunuyor', r.yalnizSutun.projectId === 'p_balat', r.yalnizSutun.projectId);
  k('eksik alanlı satır uygulamayı düşürmüyor', r.bozukHata === null, r.bozukHata);
  // Basligi da metni de bos olan satir bir sey ifade etmiyor: hayalet
  // script uretmek yerine dusuruluyor.
  k('boş satır hayalet script üretmiyor', r.bozuk === null, r.bozuk);

  k('fikir satırı parçaları taşıyor', Array.isArray(r.fSatir.parts) && r.fSatir.parts.length === 2);
  k('fikir sırası sütunda', r.fSatir.sort_index === 3, r.fSatir.sort_index);
  k('fikir gidip gelince parçalar duruyor', r.fGeri.parts.length === 2 && r.fGeri.parts[1].text === 'İkinci parça', r.fGeri.parts);
  k('fikir projesi korunuyor', r.fGeri.projectId === 'p_kariye', r.fGeri.projectId);

  console.log(hata ? '\n'+hata+' HATA' : '\nHEPSİ GEÇTİ');
  await b.close(); process.exit(hata?1:0);
})();
