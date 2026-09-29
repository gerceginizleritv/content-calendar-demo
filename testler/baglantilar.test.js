// TIKTOK VE YOUTUBE BAGLANTILARI — sayfa, fonksiyon ve SQL
//
// ══════════════════════════════════════════════════════════════════
// NEDEN TEK DOSYA VE NEDEN DONGU
// ══════════════════════════════════════════════════════════════════
// Iki baglayici AYNI degismezleri tasiyor. Ayri test dosyalari
// yazilsaydi, birinde duzeltilen bir acik otekinde kalirdi -- bugun
// tam bu sinifta bes hata yasandi (ayni liste iki yerde, ayni mantik
// iki dosyada). Yeni bir baglayici eklenince asagidaki diziye bir
// satir yaziliyor ve butun olcumler ona da uyguluyor.
//
// ══════════════════════════════════════════════════════════════════
// BU DOSYANIN ASIL DERDI: JETON SIZINTISI
// ══════════════════════════════════════════════════════════════════
// Erisim jetonu, o hesaba video yukleyebilen bir sirdir. Uc ayri
// yerden sizabilir ve ucu de SESSIZ sizar:
//   1. Tarayiciya donen cevapta (fonksiyon jetonu geri yazarsa)
//   2. Veritabanindan (RLS ilkesi "kendi satirini okusun" derse)
//   3. Statik sayfada (client_secret sayfaya gomulurse)
//
// Ayrica `state` kontrolu: olmazsa baska bir sitenin gonderdigi bir
// `code` ile kullanicinin hesabina YABANCI bir hesap baglanabilir.
const { chromium } = require('./araclar');
const fs = require('fs');
const yol = require('path');
const KOK = process.argv[2] || 'http://127.0.0.1:8098';
const KOK_DIZIN = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };
const oku = (f)=> fs.readFileSync(yol.join(KOK_DIZIN, f), 'utf8');

const BAGLAYICILAR = [
  {
    ad: 'TikTok',
    sayfa: 'tiktok.html',
    islevYolu: 'supabase/functions/tiktok-baglan/index.ts',
    sqlYolu: 'sql/51-tiktok.sql',
    fonksiyon: 'tiktok-baglan',
    tablo: 'tiktok_hesaplari',
    durumIslevi: 'tiktok_durum',
    kimlikAlani: 'client_id',          // GET ucunda donen ACIK alan
    kimlikAlaniGercek: 'client_key',   // TikTok'ta adi boyle
    saglayiciJetonUcu: 'open.tiktokapis.com'
  },
  {
    ad: 'YouTube',
    sayfa: 'youtube.html',
    islevYolu: 'supabase/functions/youtube-baglan/index.ts',
    sqlYolu: 'sql/52-youtube.sql',
    fonksiyon: 'youtube-baglan',
    tablo: 'youtube_hesaplari',
    durumIslevi: 'youtube_durum',
    kimlikAlani: 'client_id',
    kimlikAlaniGercek: 'client_id',
    saglayiciJetonUcu: 'oauth2.googleapis.com'
  }
];

(async () => {
  for (const b of BAGLAYICILAR) {
    const sayfa = oku(b.sayfa);
    const islev = oku(b.islevYolu);
    const sql   = oku(b.sqlYolu);

    console.log('[' + b.ad + ' · jeton sizmiyor]');
    {
      // ⚠ Kelimeyi aramak YETMIYOR: sayfanin yorumu "o is client_secret
      // istiyor, o yuzden burada yapilmiyor" diye aciklıyor ve bu dogru
      // bir cumle. Olculmek istenen sey KODDA sir olup olmadigi.
      const sayfaKod = sayfa
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      bak(b.ad + ': sayfa KODUNDA client_secret geçmiyor ★',
          !/client_secret/i.test(sayfaKod));
      bak(b.ad + ': yorum ayıklama sayfayı boşaltmıyor (ölçüm kör değil)',
          sayfaKod.length > sayfa.length * 0.4, sayfaKod.length + '/' + sayfa.length);
      bak(b.ad + ': sayfa jeton takası YAPMIYOR ★',
          !(new RegExp(b.saglayiciJetonUcu.replace(/\./g, '\\.'))).test(sayfa));

      const basarili = /return json\(\{ ok: true, bagli: true[^}]*\}\)/.exec(islev);
      bak(b.ad + ': başarılı cevap satırı bulunuyor', !!basarili);
      if (basarili) {
        bak(b.ad + ': cevapta jeton YOK ★',
            !/access_token|refresh_token|erisim_jetonu|yenileme_jetonu/.test(basarili[0]),
            basarili[0]);
      }

      const blok = /yapilandirma:\s*\{([\s\S]*?)\}/.exec(islev);
      bak(b.ad + ': GET ucunda yapılandırma bloğu var', !!blok);
      if (blok) {
        const degerler = blok[1].split(',').map(s => s.split(':')[1]).filter(Boolean).map(s => s.trim());
        bak(b.ad + ': GET ucu gizli ayarların DEĞERİNİ döndürmüyor ★',
            degerler.length > 0 && degerler.every(v => v.startsWith('!!')),
            degerler.join(' | '));
      }
    }

    console.log('[' + b.ad + ' · ortam degiskenleri kirpiliyor]');
    {
      // 28 Eylul 2026: TIKTOK_CLIENT_KEY bir satir sonuyla yapistirildi.
      // Deger ekranda dogru gorunuyordu; GET ucu "\nsbaw7..." dondurunce
      // anlasildi. Kirpma olmasa yetkilendirme adresine %0A gider ve
      // "gecersiz anahtar" hatasinin sebebi hicbir yerde yazmazdi.
      bak(b.ad + ': ortam değişkenleri kırpılarak okunuyor ★',
          /Deno\.env\.get\(ad\) \?\? ''\)\.trim\(\)/.test(islev));
      const hamOkuma = islev.match(/Deno\.env\.get\([^)]*\)/g) || [];
      bak(b.ad + ': kırpılmadan okunan değişken kalmadı ★',
          hamOkuma.length === 1, hamOkuma.join(' | '));
    }

    console.log('[' + b.ad + ' · veritabani: jeton tarayiciya acilmiyor]');
    {
      const t = (s)=> new RegExp(s.replace(/\{T\}/g, b.tablo));
      bak(b.ad + ': tablo RLS ile korunuyor',
          t('alter table public\\.{T} enable row level security').test(sql));
      // ⚠ TERS YONDE OLCUM: burada ilke OLMAMASI dogru.
      bak(b.ad + ': select ilkesi YOK (jeton sunucuda kalır) ★',
          !t('create policy[^;]*on public\\.{T}').test(sql));
      bak(b.ad + ': anon/authenticated yetkisi geri alınmış',
          t('revoke all on public\\.{T} from anon, authenticated').test(sql));
      bak(b.ad + ': service_role erişebiliyor (worker çalışsın)',
          t('grant all\\s+on public\\.{T} to service_role').test(sql));

      const durum = new RegExp('create or replace function public\\.' + b.durumIslevi + '\\(\\)[\\s\\S]*?\\$\\$;').exec(sql);
      bak(b.ad + ': durum işlevi bulunuyor', !!durum);
      if (durum) {
        bak(b.ad + ': durum işlevi jeton sütunlarını seçmiyor ★',
            !/erisim_jetonu|yenileme_jetonu/.test(durum[0]));
      }
    }

    console.log('[' + b.ad + ' · oturum dogrulaniyor]');
    {
      bak(b.ad + ': kullanıcı JWT\'den çözülüyor, gövdeden değil ★',
          /auth\/v1\/user/.test(islev) && !/govde\?\.user_id|govde\.user_id/.test(islev));
      bak(b.ad + ': oturum yoksa 401 dönüyor',
          /Oturum dogrulanamadi[\s\S]{0,40}401/.test(islev));
    }

    console.log('[' + b.ad + ' · donus adresi]');
    {
      // Saglayici, jeton takasindaki redirect_uri ile yetkilendirmedekini
      // karsilastiriyor; sorgu dizgesi kalirsa "mismatch" ile duser.
      bak(b.ad + ': redirect_uri sorgu dizgesi atılarak üretiliyor ★',
          /location\.origin \+ location\.pathname/.test(sayfa));
      bak(b.ad + ': sayfa dosyası var (' + b.sayfa + ')',
          fs.existsSync(yol.join(KOK_DIZIN, b.sayfa)));
    }

    console.log('[' + b.ad + ' · tarayicida: state olmadan baglanti kurulmuyor]');
    {
      const t = await chromium.launch({});
      try {
        const baglam = await t.newContext({ viewport: { width: 500, height: 700 } });
        const p = await baglam.newPage();

        // ⚠ OLCULEN SEY "hic istek atmasin" DEGIL.
        // Sayfa baslangic tarafini da yapiyor: code yokken GET ile
        // istemci kimligini soruyor, bu normal. Korunmasi gereken sey
        // JETON TAKASI: state dogrulanmadan POST atilmamali.
        let get = 0, post = 0;
        await p.route('**/functions/v1/' + b.fonksiyon + '*', (r)=>{
          if (r.request().method() === 'POST') post++; else get++;
          r.abort();
        });

        get = post = 0;
        await p.goto(KOK + '/' + b.sayfa, { waitUntil: 'domcontentloaded' });
        await p.waitForTimeout(400);
        bak(b.ad + ': code olmadan açılınca JETON TAKASI yapmıyor ★', post === 0, 'post=' + post);
        bak(b.ad + ': code olmadan bağlantıyı başlatmayı deniyor (ölçüm boş değil)',
            get > 0, 'get=' + get);

        get = post = 0;
        await p.goto(KOK + '/' + b.sayfa + '?code=SAHTE&state=YABANCI', { waitUntil: 'domcontentloaded' });
        await p.waitForTimeout(400);
        let metin = await p.textContent('#durum');
        bak(b.ad + ': state eşleşmezse jeton takası YAPILMIYOR ★',
            /güvenlik/i.test(metin || '') && post === 0, (metin || '') + ' | post=' + post);

        await p.goto(KOK + '/' + b.sayfa + '?error=access_denied&error_description=Kullanici+iptal+etti',
                     { waitUntil: 'domcontentloaded' });
        await p.waitForTimeout(300);
        metin = await p.textContent('#durum');
        bak(b.ad + ': iptal edilince anlaşılır mesaj', /tamamlanmadı/i.test(metin || ''), metin);

        const yatay = await p.evaluate(()=> document.documentElement.scrollWidth - document.documentElement.clientWidth);
        bak(b.ad + ': telefon genişliğinde yatay kayma yok', yatay <= 0, yatay);
      } finally {
        await t.close();
      }
    }
  }

  // ── SAGLAYICIYA OZEL: GOOGLE'IN YENILEME JETONU TUZAGI ───────────
  console.log('[youtube · yenileme jetonu tuzagi]');
  {
    const sayfa = oku('youtube.html');
    const islev = oku('supabase/functions/youtube-baglan/index.ts');
    // ⚠ IKISI BIRLIKTE OLMAK ZORUNDA.
    // access_type=offline yoksa Google yenileme jetonu VERMIYOR;
    // prompt=consent yoksa, hesap daha once izin verdiyse BIR DAHA
    // vermiyor. Ikisinden biri eksikse erisim jetonu bir saat sonra
    // oluyor ve yukleme sessizce duruyor -- hata "yetkisiz" der,
    // sebebi gorunmez.
    // ⚠ YORUMLAR AYIKLANIYOR. Sayfanin kendi yorumu bu iki parametreyi
    // ADIYLA anlatiyor ("access_type=offline VE prompt=consent birlikte
    // olmak zorunda"). Ham metinde arasaydik, kod satiri silinse bile
    // yorum olcumu tatmin ederdi -- ve mutasyon turunda tam bu oldu.
    const sayfaKod = sayfa
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    bak('yorum ayıklama sayfayı boşaltmıyor (ölçüm kör değil)',
        sayfaKod.length > sayfa.length * 0.4, sayfaKod.length + '/' + sayfa.length);
    bak('★ yetkilendirme adresinde access_type=offline var',
        /access_type=offline/.test(sayfaKod));
    bak('★ yetkilendirme adresinde prompt=consent var',
        /prompt=consent/.test(sayfaKod));
    // Jeton gelmezse BAGLANTI KURULMUS SAYILMAMALI.
    bak('★ yenileme jetonu gelmezse bağlantı reddediliyor',
        /!veri\.refresh_token/.test(islev));

    // ══════════════════════════════════════════════════════════════
    // ⛔ ISTENEN KAPSAM: TEK SATIR, VE GENISLEMEMELI
    // ══════════════════════════════════════════════════════════════
    // 29 Eylul 2026, ilk gercek baglantida: kanal adi bos geldi. Sebep
    // `channels.list?mine=true`in OKUMA kapsami istemesi; bizde yok, o
    // yuzden 403 donuyor. Akla gelen ilk "cozum" `youtube.readonly`
    // eklemek -- tek satir, hemen calisir, ve kullanicidan
    // istatistiklerini ve kanalindaki her seyi okuma izni ISTER.
    //
    // privacy.html tam tersini soz veriyor: "yuklemeye yeten en dar
    // izin" ve "istatistiklerinizi, yorumlarinizi, abonelerinizi
    // cekmiyoruz". Kapsami genisletmek o sozu sessizce bozardi --
    // kullaniciya gosterilen izin ekrani degisir ama belge aynen kalir.
    //
    // Bu olcum kapsami BELGEYE bagliyor: kapsam tam olarak
    // youtube.upload olmak zorunda ve gizlilik metni de onu adiyla
    // yazmak zorunda.
    const kapsamM = /const KAPSAM\s*=\s*'([^']+)'/.exec(islev);
    bak('YouTube kapsami koddan okunabiliyor', !!kapsamM, String(kapsamM && kapsamM[1]));
    const kapsamlar = kapsamM ? kapsamM[1].split(/[\s,]+/).filter(Boolean) : [];
    bak('★ TEK kapsam isteniyor', kapsamlar.length === 1, JSON.stringify(kapsamlar));
    bak('★ istenen kapsam youtube.upload (okuma kapsami YOK)',
        kapsamlar[0] === 'https://www.googleapis.com/auth/youtube.upload',
        JSON.stringify(kapsamlar));
    // Okuma kapsamlarinin ADI hicbir yerde gecmemeli: gecerse biri
    // eklemis demektir.
    bak('★ kodda okuma kapsami izi yok (readonly / force-ssl / tam youtube)',
        !/auth\/youtube\.readonly/.test(islev)
        && !/auth\/youtube\.force-ssl/.test(islev)
        && !/auth\/youtube['"\s]/.test(islev),
        (/auth\/youtube[^']*/.exec(islev) || [''])[0]);
    // ⛔ OKUMA UCU CAGRILMAMALI.
    // 29 Eylul 2026: burada bir `channels.list?mine=true` cagrisi vardi
    // ve HER ZAMAN 403 donuyordu -- okuma kapsami istiyor, bizde yok.
    // "Bir gun okuma kapsami gerekirse kendiliginden calisir" diye
    // birakilmisti; ayni gun bu dosyaya okuma kapsami eklenmesini
    // YASAKLAYAN olcum kondu, yani o senaryo kendi elimizle kapandi.
    // Geriye her seferinde yetki hatasi veren bir istek kalmisti.
    //
    // Kaldirildi ve geri gelmesin: denetim basvurusunda "kullandigimiz
    // uclar" derken surekli hata veren bir uc saymak zorunda kaliyorduk.
    bak('★ baglayici YouTube okuma ucu cagirmiyor',
        !/youtube\/v3\/channels/.test(islev) && !/channels\?part/.test(islev),
        (/[^\n]*youtube\/v3[^\n]*/.exec(islev) || [''])[0]);
    // Tek YouTube ucu kalmali: jeton takasi. Yukleme worker'in isi.
    bak('★ baglayici yalnizca jeton ucunu kullaniyor',
        /oauth2\.googleapis\.com\/token/.test(islev)
        && !/googleapis\.com\/youtube/.test(islev));

    // Belge ile kod ayni kapsami sayiyor mu?
    const gizlilik = oku('privacy.html');
    bak('★ gizlilik metni de youtube.upload diyor',
        /youtube\.upload/.test(gizlilik));
    // ⚠ VE BELGE "KANAL ADINI SAKLIYORUZ" DEMEMELI: o alan bu kapsamla
    // her zaman bos kaliyor. Fazla soylemek de yanlis soylemektir.
    bak('★ gizlilik metni kanal adinin BOS kaldigini soyluyor',
        /stay <strong>empty<\/strong>/.test(gizlilik)
        && /<strong>boş<\/strong>/.test(gizlilik),
        'privacy.html');
  }

  // ══════════════════════════════════════════════════════════════════
  // ⛔ BAGLANTIYI KESME: BELGE SOZ VERIYOR, SAYFA TUTMAK ZORUNDA
  // ══════════════════════════════════════════════════════════════════
  // 29 Eylul 2026, denetim basvurusunu doldururken bulundu: privacy.html
  // "Shootboard'un YouTube sayfasindan baglantiyi kesebilirsin" diyordu
  // ve OYLE BIR DUGME YOKTU. Sunucu ucu (`?kes=1`) ve SQL islevi bastan
  // beri duruyordu; eksik olan yalnizca arayuzdu. Yani canli bir hukuki
  // belge, var olmayan bir yolu tarif ediyordu.
  //
  // YouTube API denetimi de bunun ekran goruntusunu istiyor
  // ("OAuth Flow Screenshots -- consent screen, scopes, revocation").
  //
  // Bu olcum sozu KODA bagliyor: belge kesmeyi anlatiyorsa sayfa onu
  // yapabilmek zorunda.
  console.log('[baglantiyi kesme]');
  for (const b of BAGLAYICILAR) {
    const sayfa = oku(b.sayfa)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const islev = oku(b.islevYolu);

    bak('★ ' + b.ad + ' sayfasinda kesme yolu var (?kes=1)',
        /\?kes=1/.test(sayfa), b.sayfa);
    bak('★ ' + b.ad + ' kesme dugmesi ekranda',
        /Bağlantıyı kes/.test(sayfa), b.sayfa);
    // ⚠ KAZA KORUMASI: kesmek, planlanan yayinlarin cikmamasi demek.
    bak(b.ad + ' kesmeden once onay soruluyor',
        /confirm\(/.test(sayfa), b.sayfa);
    // Sunucu tarafi da duruyor mu? Dugme varken uc olmazsa 404 alirdi.
    bak('★ ' + b.ad + ' fonksiyonu kes ucunu tasiyor',
        /searchParams\.get\('kes'\)/.test(islev), b.islevYolu);
    // ⚠ SAYFA ONCE "BAGLI MIYIM" DIYE SORMALI: sormadan dogrudan
    // baglama dugmesi gosterirse, zaten bagli olan biri kesme yolunu
    // HIC goremez -- yani dugme var ama ulasilamaz olur.
    bak('★ ' + b.ad + ' sayfasi bagli durumunu soruyor (' + b.durumIslevi + ')',
        new RegExp("rpc\\('" + b.durumIslevi + "'\\)").test(sayfa), b.sayfa);
  }
  {
    // Ve belge bunu anlatiyor olmali -- iki dilde.
    const gizlilik = oku('privacy.html');
    bak('★ gizlilik metni kesme yolunu anlatiyor (en)',
        /from Shootboard's YouTube page/.test(gizlilik));
    bak('★ gizlilik metni kesme yolunu anlatiyor (tr)',
        /Shootboard'un YouTube\s*\n?\s*sayfasından/.test(gizlilik),
        (/Shootboard'un YouTube[^<]*/.exec(gizlilik) || [''])[0].slice(0, 60));
  }

  console.log('\n' + g + ' gecti, ' + k + ' kaldi');
  process.exit(k ? 1 : 0);
})();
