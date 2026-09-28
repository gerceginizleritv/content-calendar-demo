// TIKTOK BAGLANTISI — sayfa, fonksiyon ve SQL
//
// ══════════════════════════════════════════════════════════════════
// BU DOSYANIN ASIL DERDI: JETON SIZINTISI
// ══════════════════════════════════════════════════════════════════
// TikTok erisim jetonu, o hesaba video yukleyebilen bir sirdir. Uc
// ayri yerden sizabilir ve ucu de SESSIZ sizar -- hicbir hata
// gorunmez, her sey calisiyor gorunur:
//
//   1. Tarayiciya donen cevapta (fonksiyon jetonu geri yazarsa)
//   2. Veritabanindan (RLS ilkesi "kendi satirini okusun" derse)
//   3. Statik sayfada (client_secret sayfaya gomulurse)
//
// Asagidaki olcumlerin cogu bunlari kovaliyor.
//
// Ayrica `state` kontrolu: olmazsa baska bir sitenin gonderdigi bir
// `code` ile kullanicinin hesabina YABANCI bir TikTok hesabi
// baglanabilir.
const { chromium } = require('./araclar');
const fs = require('fs');
const yol = require('path');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
const KOK_DIZIN = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (f)=> fs.readFileSync(yol.join(KOK_DIZIN, f), 'utf8');

(async () => {
  const sayfa = oku('tiktok.html');
  const islev = oku('supabase/functions/tiktok-baglan/index.ts');
  const sql   = oku('sql/51-tiktok.sql');

  console.log('[jeton sizmiyor]');
  {
    // 1) Statik sayfada sir yok.
    // ⚠ Kelimeyi aramak YETMIYOR: sayfanin yorumu "o is client_secret
    // istiyor, o yuzden burada yapilmiyor" diye aciklıyor ve bu dogru
    // bir cumle. Olculmek istenen sey KODDA sir olup olmadigi, o
    // yuzden once yorumlar ayiklaniyor.
    const sayfaKod = sayfa
      .replace(/<!--[\s\S]*?-->/g, '')     // HTML yorumlari
      .replace(/^\s*\/\/.*$/gm, '');       // satir basi JS yorumlari
    bak('★ sayfa KODUNDA client_secret geçmiyor',
        !/client_secret/i.test(sayfaKod));
    // Olcum bos gecmesin: ayiklama sayfayi tuketmemeli.
    bak('yorum ayıklama sayfayı boşaltmıyor (ölçüm kör değil)',
        sayfaKod.length > sayfa.length * 0.4, sayfaKod.length + '/' + sayfa.length);
    bak('★ sayfa jeton takası YAPMIYOR (token ucuna gitmiyor)',
        !/open\.tiktokapis\.com/.test(sayfa));

    // 2) Fonksiyonun cevabinda jeton yok. Basarili cevabin dondugu
    //    satiri okuyup icinde jeton alanlarini ariyoruz.
    const basarili = /return json\(\{ ok: true, bagli: true[^}]*\}\)/.exec(islev);
    bak('başarılı cevap satırı bulunuyor', !!basarili);
    if (basarili) {
      bak('★ cevapta access_token / refresh_token YOK',
          !/access_token|refresh_token|erisim_jetonu|yenileme_jetonu/.test(basarili[0]),
          basarili[0]);
    }

    // 3) GET ucu yapilandirmayi yalnizca "var mi yok mu" diye soyluyor.
    const blok = /yapilandirma:\s*\{([\s\S]*?)\}/.exec(islev);
    bak('GET ucunda yapılandırma bloğu var', !!blok);
    if (blok) {
      const degerler = blok[1].split(',').map(s => s.split(':')[1]).filter(Boolean).map(s => s.trim());
      bak('★ GET ucu gizli ayarların DEĞERİNİ döndürmüyor',
          degerler.length > 0 && degerler.every(v => v.startsWith('!!')),
          degerler.join(' | '));
    }
  }

  console.log('[ortam degiskenleri kirpiliyor]');
  {
    // 28 Eylul 2026: TIKTOK_CLIENT_KEY bir satir sonuyla yapistirildi.
    // Deger ekranda dogru gorunuyordu; GET ucu "\nsbaw7..." dondurunce
    // anlasildi. Kirpma olmasa yetkilendirme adresine %0A gidecek ve
    // TikTok'un "gecersiz client_key" hatasinin sebebi hicbir yerde
    // yazmayacakti.
    bak('★ ortam değişkenleri kırpılarak okunuyor',
        /Deno\.env\.get\(ad\) \?\? ''\)\.trim\(\)/.test(islev));
    const hamOkuma = islev.match(/Deno\.env\.get\([^)]*\)/g) || [];
    bak('★ kırpılmadan okunan değişken kalmadı',
        hamOkuma.length === 1, hamOkuma.join(' | '));
  }

  console.log('[veritabani: jeton tarayiciya acilmiyor]');
  {
    bak('tablo RLS ile korunuyor',
        /alter table public\.tiktok_hesaplari enable row level security/.test(sql));
    // ⚠ BU OLCUM TERS YONDE: burada ilke OLMAMASI dogru.
    // Bir gun biri "kullanici kendi satirini gorsun" diye ilke
    // eklerse, o satirda erisim jetonu duruyor.
    bak('★ tiktok_hesaplari için select ilkesi YOK (jeton sunucuda kalır)',
        !/create policy[^;]*on public\.tiktok_hesaplari/i.test(sql));
    bak('anon/authenticated yetkisi geri alınmış',
        /revoke all on public\.tiktok_hesaplari from anon, authenticated/.test(sql));
    bak('service_role erişebiliyor (worker çalışsın)',
        /grant all\s+on public\.tiktok_hesaplari to service_role/.test(sql));
    // Uygulamanin gordugu islev jeton dondurmemeli.
    const durum = /create or replace function public\.tiktok_durum\(\)[\s\S]*?\$\$;/.exec(sql);
    bak('tiktok_durum işlevi bulunuyor', !!durum);
    if (durum) {
      bak('★ tiktok_durum jeton sütunlarını seçmiyor',
          !/erisim_jetonu|yenileme_jetonu/.test(durum[0]));
    }
  }

  console.log('[oturum dogrulaniyor]');
  {
    // Govdeden gelen bir user_id'ye guvenilseydi, herhangi biri
    // baskasinin hesabina TikTok baglayabilirdi.
    bak('★ kullanıcı JWT\'den çözülüyor, gövdeden değil',
        /auth\/v1\/user/.test(islev) && !/govde\?\.user_id|govde\.user_id/.test(islev));
    bak('oturum yoksa 401 dönüyor',
        /Oturum dogrulanamadi[\s\S]{0,40}401/.test(islev));
  }

  console.log('[donus adresi]');
  {
    // TikTok kayitli adresle BIREBIR ayni olani bekliyor; sorgu
    // dizgesi kalirsa takas "redirect_uri mismatch" ile duser.
    bak('★ redirect_uri sorgu dizgesi atılarak üretiliyor',
        /location\.origin \+ location\.pathname/.test(sayfa));
    bak('sayfa adresi kayıtlı olanla aynı (tiktok.html)',
        fs.existsSync(yol.join(KOK_DIZIN, 'tiktok.html')));
  }

  console.log('[tarayicida: state olmadan baglanti kurulmuyor]');
  {
    const t = await chromium.launch({});
    try {
      const baglam = await t.newContext({ viewport: { width: 500, height: 700 } });
      const p = await baglam.newPage();

      // ⚠ OLCULEN SEY "hic istek atmasin" DEGIL.
      // Sayfa baslangic tarafini da yapiyor: code yokken GET ile
      // client_key'i soruyor, bu normal. Korunmasi gereken sey JETON
      // TAKASI: state dogrulanmadan POST atilmamali. O yuzden sayici
      // yontem basina ve her gezinmede sifirlaniyor.
      let get = 0, post = 0;
      await p.route('**/functions/v1/tiktok-baglan*', (r)=>{
        if (r.request().method() === 'POST') post++; else get++;
        r.abort();
      });

      // 1) code yok -> baslangic tarafi: GET var, POST YOK
      get = post = 0;
      await p.goto(KOK + '/tiktok.html', { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(400);
      let metin = await p.textContent('#durum');
      bak('★ code olmadan açılınca JETON TAKASI yapmıyor', post === 0, 'post=' + post);
      bak('code olmadan açılınca bağlantıyı başlatmayı deniyor (ölçüm boş değil)',
          get > 0, 'get=' + get);

      // 2) code var ama state yok -> guvenlik kontrolu, POST YOK
      get = post = 0;
      await p.goto(KOK + '/tiktok.html?code=SAHTE&state=YABANCI', { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(400);
      metin = await p.textContent('#durum');
      bak('★ state eşleşmezse jeton takası YAPILMIYOR',
          /güvenlik/i.test(metin || '') && post === 0, (metin || '') + ' | post=' + post);

      // 3) TikTok "iptal" ile donerse anlasilir mesaj
      await p.goto(KOK + '/tiktok.html?error=access_denied&error_description=Kullanici+iptal+etti',
                   { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(300);
      metin = await p.textContent('#durum');
      bak('iptal edilince anlaşılır mesaj', /tamamlanmadı/i.test(metin || ''), metin);

      // Sayfa yatay kaymamali (telefonda aciliyor).
      const yatay = await p.evaluate(()=> document.documentElement.scrollWidth - document.documentElement.clientWidth);
      bak('telefon genişliğinde yatay kayma yok', yatay <= 0, yatay);
    } finally {
      await t.close();
    }
  }

  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
