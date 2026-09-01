-- =====================================================================
-- YAYIN KAYITLARINI SLATE SOZLUGUNE CEVIR
-- =====================================================================
-- Lokasyon uygulamasi kayitlari eski kodlarla tutuyordu: platform 'yt',
-- 'ig', 'fb_poll' gibi; tur cogu satirda bos. Slate bu kodlari tanimiyor
-- ve tanimadigini varsayilana cevirir — yani tasima yapilmadan Slate'e
-- baglanirsa 63 kaydin turu/hesabi YANLIS gorunur.
--
-- Bu betik kodlari bir kez cozup asil sutunlara yaziyor. Sonrasinda iki
-- uygulama da ayni degeri okuyor: lokasyon uygulamasi zaten "platform
-- saf bir deger ise oldugu gibi kullan" diyor, yani geri donus noktasi
-- olarak calismaya devam ediyor.
--
-- Tekrar calistirilabilir: cevrilmis satir ikinci kez cevrilmez.
-- ONCE YEDEK AL: Supabase panelinde Database -> Backups.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- =====================================================================

begin;

-- Eski ham kod kayboluyor olmasin: bir kereye mahsus saklaniyor.
alter table public.calendar_events
  add column if not exists legacy_platform text;

update public.calendar_events
   set legacy_platform = platform
 where legacy_platform is null
   and platform not in ('youtube','instagram','tiktok','facebook');

with cozum as (
  select
    e.id,
    -- Hesap: once elle konmus ustdeger, sonra zaten saf olan deger,
    -- sonra eski kodun karsiligi.
    coalesce(
      nullif(e.platform_override, ''),
      case when e.platform in ('youtube','instagram','tiktok','facebook') then e.platform end,
      case e.platform
        when 'yt' then 'youtube'  when 'yts' then 'youtube'
        when 'ig' then 'instagram' when 'ig_car' then 'instagram'
        when 'story' then 'instagram'
        when 'tt' then 'tiktok'
        when 'fb' then 'facebook' when 'fb_car' then 'facebook'
        when 'fb_text' then 'facebook' when 'fb_poll' then 'facebook'
      end
    ) as yeni_platform,
    -- Tur: ustdeger, sonra zaten gecerli olan deger, sonra eski koddan.
    -- 'ig' ve 'fb' iki turlu kullanilmis: basligi "reel" iceriyorsa Reels.
    coalesce(
      nullif(e.type_override, ''),
      case when e.type in ('video','shorts','reels','carousel','story','text_post','poll') then e.type end,
      case e.platform
        when 'yt' then 'video'
        when 'yts' then 'shorts'
        when 'tt' then 'video'
        when 'ig' then case when e.title ~* 'reel' then 'reels' else 'video' end
        when 'fb' then case when e.title ~* 'reel' then 'reels' else 'video' end
        when 'ig_car' then 'carousel'
        when 'fb_car' then 'carousel'
        when 'story' then 'story'
        when 'fb_text' then 'text_post'
        when 'fb_poll' then 'poll'
      end
    ) as yeni_tur
  from public.calendar_events e
)
update public.calendar_events e
   set platform = c.yeni_platform,
       type     = c.yeni_tur,
       -- Ustdegerler asil sutuna islendi; ikisinin ayni anda durmasi
       -- ileride "hangisi dogru?" sorusuna yol acar.
       type_override = null,
       platform_override = null
  from cozum c
 where c.id = e.id
   -- Cozulemeyen (taninmayan kod) satira DOKUNULMUYOR: tahminle veri
   -- yazmaktansa oldugu gibi birakmak iyidir.
   and c.yeni_platform is not null
   and c.yeni_tur is not null
   and (e.platform is distinct from c.yeni_platform
        or e.type is distinct from c.yeni_tur
        or e.type_override is not null
        or e.platform_override is not null);

commit;

-- Kontrol: hepsi Slate'in sozlugunde mi?
select platform as hesap, type as tur, count(*)
  from public.calendar_events
 group by 1,2 order by 1,2;

select count(*) filter (where platform not in ('youtube','instagram','tiktok','facebook')) as cozulemeyen_hesap,
       count(*) filter (where type not in ('video','shorts','reels','carousel','story','text_post','poll')) as cozulemeyen_tur,
       count(*) as toplam
  from public.calendar_events;
