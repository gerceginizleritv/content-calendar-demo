-- 56 — YouTube videoları DOSYA HAZIR OLUR OLMAZ yükleniyor
--
-- ══════════════════════════════════════════════════════════════════
-- sql/55'İN DEVAMI VE DÜZELTMESİ
-- ══════════════════════════════════════════════════════════════════
-- sql/55 YouTube yüklemesini yayından altı saat öne aldı. Altı saat
-- keyfî bir sayıydı ve asıl ihtiyacı karşılamıyordu:
--
--   Kullanıcı videoları son anda değil, İLERİ TARİHE hazırlıyor.
--   Elle çalışırken de böyle yapıyor: videoyu bugün YouTube'a yükleyip
--   3 Kasım 10:00'a zamanlıyor, Studio'da "Zamanlanmış" olarak duruyor.
--
-- Altı saat, bu alışkanlığın yerine geçmiyordu: video yayın sabahına
-- kadar YouTube'da görünmüyordu, kapağı ya da açıklaması kontrol
-- edilemiyordu, ve bir yükleme hatası ancak yayından altı saat önce
-- (sabaha karşı) ortaya çıkıyordu.
--
-- Artık dosya R2'ye çıktığı an video YouTube'a gidiyor ve gerçek yayın
-- anını YouTube'un kendi zamanlayıcısı tutuyor (status.publishAt).
-- Hata payı saatler değil GÜNLER.
--
-- ══════════════════════════════════════════════════════════════════
-- ⛔ YİNE YALNIZCA YOUTUBE
-- ══════════════════════════════════════════════════════════════════
-- Instagram, Facebook ve TikTok'ta zamanlama YOK: yüklediğin an
-- yayınlanıyor. Onlarda "hazır olunca yükle" demek "hazır olunca
-- YAYINLA" demek olurdu -- 3 Kasım'a planlanan bir story bugün çıkardı.
--
-- ══════════════════════════════════════════════════════════════════
-- ⚠ İKİNCİ DEĞİŞİKLİK: DOSYASIZ KAYITLAR KUYRUĞA GİRMİYOR
-- ══════════════════════════════════════════════════════════════════
-- "Hazır olur olmaz yükle" demek, kuyruğun artık HENÜZ HAZIR OLMAYAN
-- kayıtları da görmesi demek: 3 Kasım'a girilmiş ama dosyası daha
-- atılmamış bir kayıt, bugünden itibaren her turda kuyruğa düşerdi.
--
-- Kuyruk tur başına beş kayıt alıyor. Kasım'a kadar dosyasız bekleyen
-- yirmi kayıt, o beş kişilik yeri sürekli işgal eder ve HAZIR OLAN
-- kayıtları geciktirirdi. Hiçbir yerde hata görünmezdi; yalnızca
-- yayınlar gecikirdi.
--
-- O yüzden süzgece bir koşul daha giriyor: dosyası olmayan kayıt
-- kuyruğa girmiyor.
--
-- ⚠ AMA "YAYIN SAATİ GEÇMİŞSE" GİRİYOR. Bu dal olmadan, dosyası hiç
-- atılmamış bir kayıt sessizce HİÇ işlenmezdi: ne yayın, ne hata, ne
-- e-posta. Şartname Bölüm 9: sessiz başarısızlık yasak. Vakti geçmiş
-- ve hâlâ dosyasız bir kayıt kuyruğa girip kalıcı hata almalı ki
-- kullanıcıya e-posta gitsin.

begin;

-- ⚠ ARTIK "PAY" DEĞİL, DOĞRUDAN "YÜKLEME ANI".
-- sql/55'te `interval` döndüren bir işlev vardı; "hazır olunca" onunla
-- ancak on yıllık sahte bir pay yazarak anlatılabilirdi. Yükleme anını
-- doğrudan döndürmek hem dürüst hem okunur: -infinity, "beklenecek bir
-- saat yok" demek.
create or replace function public.story_yukleme_ani(
  p_publish_at timestamptz, p_type text, p_platform text)
returns timestamptz
language sql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
  select case
    -- YouTube: beklenecek saat yok. Gerçek yayın anını worker
    -- `status.publishAt` ile YouTube'a bildiriyor.
    when p_type = 'shorts' and p_platform = 'youtube' then '-infinity'::timestamptz
    -- ⛔ GERİ KALAN HER ŞEY YAYIN SAATİNDE. Zamanlaması olmayan bir
    -- platformda erken yüklemek, erken YAYINLAMAK demek.
    else p_publish_at
  end;
$$;

revoke all   on function public.story_yukleme_ani(timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.story_yukleme_ani(timestamptz, text, text) to service_role;

commit;

-- ═══ KUYRUK ═══════════════════════════════════════════════════════
begin;

drop function if exists public.story_kuyruk_al(integer);
create function public.story_kuyruk_al(p_limit integer default 5)
returns table(
  id text, user_id uuid, media_url text, media_bytes bigint,
  media_mime text, publish_at timestamptz, attempt_count integer,
  idem_key uuid, external_id text, title text, content jsonb,
  publish_ref text, publish_ref_at timestamptz, publish_called_at timestamptz,
  platform text, type text, cover_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with sira as (
    select e.id
      from public.calendar_events e
     where e.type = any(public.story_yayin_turleri())
       and e.auto_publish = true
       -- ⛔ FACEBOOK + REELS KUYRUĞA GİRMİYOR (5 Ekim 2026).
       --
       -- Facebook bu sayfada API ile yayınlanan reels'i dağıtmıyor.
       -- Ölçüm, aynı sayfada, aynı saatte, aynı dosyalarla:
       --
       --   elle atılan      4 Ekim 10:13 · 96 sn -> 127.672 görüntülenme
       --   elle atılan      2 Ekim 21:00         ->   1.461
       --   API ile (burası) 3 Ekim 10:01 · 100 sn ->     19  (1 tekil kişi)
       --   API ile (burası) 2 Ekim 10:01 ·  86 sn ->      3  (1 tekil kişi)
       --
       -- 4 Ekim'deki dosya Instagram'da -- o da BU kuyruktan gitti --
       -- 555.538 oynatma aldı. Yani sorun dosyada, kapakta, uzunlukta,
       -- başlıkta ya da bit hızında değil: hepsi tek tek ölçülüp elendi.
       -- Gönderi alanları da birebir aynı (privacy EVERYONE, status_type
       -- added_video, is_eligible_for_promotion true). Tek fark yol.
       --
       -- ⚠ FACEBOOK HİKÂYELERİ ETKİLENMİYOR, kasıtlı olarak dışarıda:
       -- onlar aynı worker'dan gidip 109-422 görüntülenme almaya devam
       -- ediyor. Koşul o yüzden platform VE tür birlikte; yalnız
       -- platforma bakan bir satır hikâyeleri de durdururdu.
       --
       -- GERİ ALMAK: Meta tarafı düzelirse bu üç satırı sil ve dosyayı
       -- yeniden koştur (işlev drop/create, yeniden koşmak güvenli).
       -- Kayıtların auto_publish'i açık kaldığı için başka bir şey
       -- yapmak gerekmiyor -- yayın kendiliğinden kaldığı yerden sürer.
       and not (e.platform = 'facebook' and e.type = 'reels')
       and e.publish_state = 'pending'
       and e.deleted_at is null
       and e.publish_at is not null
       -- YÜKLEME anı (yayın anı değil). YouTube dışında ikisi aynı.
       and public.story_yukleme_ani(e.publish_at, e.type, e.platform) <= now()
       -- ⚠ DOSYASIZ KAYIT KUYRUĞA GİRMİYOR -- yayın saati geçene kadar.
       -- Gerekçesi dosyanın başında: aksi halde ileri tarihli ve henüz
       -- dosyasız kayıtlar kuyruğun yerini işgal ederdi.
       and (
         (e.media_url is not null and e.media_url <> '')
         -- ...ama vakti geçmiş ve hâlâ dosyasızsa GİRMELİ: kalıcı hata
         -- alıp e-posta göndersin. Bu dal olmadan sessizce kaybolurdu.
         or e.publish_at <= now()
       )
       and (e.retry_after is null or e.retry_after <= now())
       and e.attempt_count < 3
       -- ⚠ SAHİP KONTROLÜ (sql/49). Bu satır olmadan kuyruk HERKESİN
       -- kaydını alıyordu ve worker hepsini aynı hesaba yayınlardı.
       and exists (select 1 from public.user_prefs p
                    where p.user_id = e.user_id
                      and p.prefs->>'story_yayin' = 'true')
     order by e.publish_at, e.media_name nulls first, e.id
     for update skip locked
     limit p_limit
  )
  update public.calendar_events e
     set publish_state = 'in_progress',
         attempt_count = e.attempt_count + 1,
         updated_at    = now()
    from sira
   where e.id = sira.id
     and e.publish_state = 'pending'
  returning e.id, e.user_id, e.media_url, e.media_bytes, e.media_mime,
            e.publish_at, e.attempt_count, e.idem_key, e.external_id,
            e.title, e.content, e.publish_ref, e.publish_ref_at,
            e.publish_called_at, e.platform, e.type, e.cover_url;
end $$;

revoke all   on function public.story_kuyruk_al(integer) from public, anon, authenticated;
grant execute on function public.story_kuyruk_al(integer) to service_role;

commit;

-- ═══ ESKİ İŞLEV KALDIRILIYOR ══════════════════════════════════════
-- ⚠ SONA BIRAKILDI: kuyruk artık onu çağırmıyor. Önce düşürseydik,
-- iki commit arasında kuyruk "fonksiyon yok" derdi.
--
-- İki kavram bırakmak ("pay" ve "yükleme anı") bir sonraki kişinin
-- yanlış olanı güncellemesi demekti -- bu depoda aynı şeyin iki yerde
-- durmasından kaynaklanan altı hata yaşandı.
begin;
drop function if exists public.story_onden_yukleme(text, text);
commit;

notify pgrst, 'reload schema';

-- ═══ KONTROL ══════════════════════════════════════════════════════
-- 1) YouTube beklemiyor, ötekiler yayın saatinde. İlk satır -infinity
--    olmalı, ötekiler verilen saatin aynısı.
select 'shorts/youtube'  as kayit,
       public.story_yukleme_ani('2026-11-03 10:00+03', 'shorts', 'youtube')  as yukleme_ani
union all select 'story/instagram',
       public.story_yukleme_ani('2026-11-03 10:00+03', 'story',  'instagram')
union all select 'reels/tiktok',
       public.story_yukleme_ani('2026-11-03 10:00+03', 'reels',  'tiktok')
union all select 'shorts/instagram (olmamali)',
       public.story_yukleme_ani('2026-11-03 10:00+03', 'shorts', 'instagram');

-- 2) Eski işlev gitti mi? 0 dönmeli.
select count(*) as eski_islev_kaldi
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'story_onden_yukleme';

-- 3) ŞU AN kuyruğa girmeye hazır YouTube kayıtları (dosyası olanlar).
--    Denetim kapısı açıkken bunlar yüklenmeye başlayacak olanlar.
select post_date, publish_at,
       coalesce(media_name, '(dosyasız)') as dosya,
       (media_url is not null and media_url <> '') as dosya_hazir,
       publish_state
  from public.calendar_events
 where type = 'shorts' and platform = 'youtube'
   and auto_publish = true
   and deleted_at is null
   and publish_state <> 'published'
 order by publish_at
 limit 25;
