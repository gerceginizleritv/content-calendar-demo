-- =====================================================================
-- NURUOSMANIYE UZUN VIDEO -> 18 EYLUL 2026, YOUTUBE + YAYIN PAKETI
-- =====================================================================
-- Nuruosmaniye Camii projesinin uzun (YouTube) videosunu takvime koyar ve
-- yayin paketini (aciklama, etiketler, video basligi, kapak yazisi, kapak
-- gorseli tarifi) kaydin icine yazar. Paket, Drive'daki "Nuruosmaniye
-- Camii — Video Metni (v1)" scriptinden turetildi.
--
-- Slate'in kendisi bunu tarayicidan yazar; bu betik ayni satiri SQL
-- Editor'den yaziyor, cunku kayit sohbet uzerinden hazirlandi ve
-- oturum anahtari sohbette yok.
--
-- Tekrar calistirilabilir: kayit varsa PAKETI GUNCELLER, tarihi ve
-- "yayinlandi" bayragini ellemez (Slate'te sonradan degistirdigin
-- tarih/saat ezilmesin).
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- Yayin saatini degistirmek icin asagidaki YAYIN_SAATI degerini duzelt.
-- =====================================================================

begin;

do $$
declare
  proje      record;
  yayin_gunu date := date '2026-09-18';
  yayin_saati time := time '18:00';   -- YAYIN_SAATI
  kayit_id   text := 'ev_nuruosmaniye_yt_20260918';
  paket      jsonb;
begin
  -- Proje: lokasyon uygulamasindan gelen kimlik (loc_...) korunuyor,
  -- o yuzden ada gore bulunuyor. Birden fazla eslesme varsa is duruyor.
  select id, user_id, workspace_id, name
    into proje
    from public.projects
   where name ilike 'Nuruosmaniye%';

  if proje.id is null then
    raise exception 'Nuruosmaniye projesi bulunamadi. Once Projeler sayfasinda projeyi olustur ya da sql/11 calistirilmis mi bak.';
  end if;
  if (select count(*) from public.projects where name ilike 'Nuruosmaniye%') > 1 then
    raise exception 'Birden fazla Nuruosmaniye projesi var; where kosulunu proje kimligiyle daralt.';
  end if;

  paket := jsonb_build_object(
    'projectId', proje.id,
    'concept',   proje.name,
    'timezone',  '',
    'slidePrompts', '[]'::jsonb,

    'videoTitle', 'İki Padişah Kendine Türbe Yaptırdı, İkisi de Yatmıyor | Nuruosmaniye''nin 270 Yıllık Sırrı',

    'shortTitle', 'İKİSİ DE YATMIYOR',

    'caption',
$c$Kapalıçarşı'ya girmeden önce yanından geçtiğiniz bu cami, iki padişahın hiç yatmadığı bir türbeyi saklıyor.

I. Mahmud 1749'da Nuruosmaniye Külliyesi'ni yaptırmaya başladı, tamamlanmasını göremeden 1754'te öldü. Adını caminin üstüne yazdıran III. Osman da üç yıl sonra öldü. İkisi için hazırlanan türbe boş kaldı: ikisi de Eminönü'ndeki Turhan Sultan Türbesi'ne gömüldü. Bugün içinde yalnızca Şehsuvar Sultan ve birkaç şehzadenin sandukası var.

Bu videoda:
• Bir Rum kalfanın, Simeon'un, günlük olarak yönettiği imparatorluk camisi (bina emini Ahmed Efendi'nin risalesi sayesinde yapım süreci en iyi belgelenen Osmanlı yapılarından biri)
• Binlerce ahşap kazık üzerine kurulan, 1766 ve 1894 depremlerini neredeyse hasarsız atlatan temel
• İstanbul'un ilk Osmanlı Barok camisi: dışarıdan Avrupa, içeriden klasik Osmanlı
• Avlunun altında 270 yıldır asıl amacına uygun hiç kullanılmamış mahzen

Bu mahzen gerçekten bir çarşı olarak mı tasarlanmıştı, yoksa başka bir amacı mı vardı? Yorumlarda buluşalım.

Bu belgesel serimizde İstanbul'un tarihini kanıtla anlatıyoruz.

Rivayet değil, kayıt.

📍 Kaynaklar:
TDV İslâm Ansiklopedisi ("Nuruosmaniye Külliyesi"), Vikipedi, Özhan Öztürk Makaleleri (2019), İslam Düşünce Atlası (Ahmed Efendi risalesi), Anadolu Ajansı (2023), Türk Diyanet Vakıf-Sen — saha ziyaretinde doğrulanan bilgiler dahil edilmiştir.

🔔 Abone ol, her hafta yeni bir gizem: youtube.com/@gerceginizleritv
📸 Instagram: instagram.com/gerceginizleritv
🎵 TikTok: @gerceginizleritv
📱 Facebook: facebook.com/gerceginizleritv

#belgesel #tarih #nuruosmaniyecamii #tarihidedektif #osmanlıtarihi #istanbultarihi #kapalıçarşı #rivayetdeğilkayıt$c$,

    -- Slate bu alani "virgulle ayrilmis, # olmadan" bekliyor.
    'hashtags',
    'nuruosmaniyecamii, tarihidedektif, osmanlıtarihi, istanbultarihi, rivayetdeğilkayıt, belgesel, tarih, istanbul, kapalıçarşı, osmanlıbarok, I. Mahmud, III. Osman, simeon kalfa, boş türbe, mahzen',

    'thumbPrompt',
$t$YouTube kapak görseli, 16:9, yüksek kontrast. Nuruosmaniye Camii'nin yarım daire (elips) avlusu alçak açıdan, dramatik altın saat ışığıyla aydınlatılmış; Barok kemerler ve oymalar keskin. Ön planda, gölgede kalmış boş bir mermer sanduka silueti (türbenin içi, kimse yok). Üstte kalın, beyaz, büyük harf metin: "İKİSİ DE YATMIYOR". Sağ altta küçük "270 YIL" rozeti. Marka renkleri: mürekkep siyahı zemin, antika altın #C8A24A vurgu. Gizemli, sinematik belgesel atmosferi; yüz yok, kalabalık yok, metin dışında yazı yok.$t$
  );

  insert into public.calendar_events
    (id, user_id, workspace_id, project_id, type, platform, title,
     post_date, post_time, uploaded, content)
  values
    (kayit_id, proje.user_id, proje.workspace_id, proje.id, 'video', 'youtube',
     'Nuruosmaniye — İki Padişahın Yatmadığı Türbe',
     yayin_gunu, yayin_saati, false, paket)
  on conflict (id) do update
    set content    = excluded.content,
        title      = excluded.title,
        project_id = excluded.project_id;
    -- post_date / post_time / uploaded bilerek guncellenmiyor.

  raise notice 'Kayit yazildi: % -> % % (proje %)', kayit_id, yayin_gunu, yayin_saati, proje.name;
end $$;

commit;

-- Kontrol
select id, post_date, post_time, platform, type, title,
       content->>'videoTitle' as video_basligi,
       length(content->>'caption') as aciklama_uzunlugu
  from public.calendar_events
 where id = 'ev_nuruosmaniye_yt_20260918';
