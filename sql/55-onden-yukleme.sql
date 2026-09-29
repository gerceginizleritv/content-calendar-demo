-- 55 — YouTube videoları yayın saatinden ÖNCE yükleniyor
--
-- ══════════════════════════════════════════════════════════════════
-- NEDEN
-- ══════════════════════════════════════════════════════════════════
-- Şimdiye kadar yükleme ile yayın AYNI andı: worker videoyu yayın
-- saatinde yüklüyordu. Sonucu doğruydu ama iki bedeli vardı:
--
--   1. YÜKLEME BAŞARISIZ OLURSA HABERİ YAYIN SAATİNDE ALIYORDUK.
--      Gönderi o gün gecikiyordu ve elle düzeltecek vakit kalmıyordu.
--      Otomasyonun bütün anlamı burada kayboluyor.
--   2. YouTube videoyu işlerken birkaç dakika geçiyor; 10:00'da
--      yüklenen bir Short akışa 10:0X'te düşüyordu.
--
-- Artık YouTube kayıtları yayın saatinden ÖNCE yükleniyor ve gerçek
-- yayın anını YouTube'un kendi zamanlayıcısı (status.publishAt)
-- tutuyor. Yükleme sabaha karşı başarısız olursa e-posta sabah
-- geliyor ve yayın saatine kadar vakit oluyor.
--
-- ══════════════════════════════════════════════════════════════════
-- ⛔ BU YALNIZCA YOUTUBE İÇİN -- VE BU KISIM HAYATİ
-- ══════════════════════════════════════════════════════════════════
-- Instagram, Facebook ve TikTok'ta zamanlama YOK: yüklediğin an
-- yayınlanıyor (TikTok'ta taslağa düşüyor). Onları erken almak,
-- story'yi ALTI SAAT ERKEN YAYINLAMAK demekti -- 24 saatlik bir
-- story için bu, günün yanlış yarısında yayın demek.
--
-- Bu yüzden önden yükleme süresi TÜRE VE PLATFORMA bağlı bir işlevden
-- geliyor ve YouTube dışında her şey için SIFIR. Sabit bir sayı
-- yazsaydık, birinin bir gün "6 saat" değerini bütün kuyruğa
-- uygulaması an meselesiydi.
--
-- ══════════════════════════════════════════════════════════════════
-- ⚠ BUNUN BİR BEDELİ VAR: ERKEN YÜKLENEN VİDEO ARTIK DONDU
-- ══════════════════════════════════════════════════════════════════
-- Video yayın saatinden altı saat önce YouTube'a gidiyor. O andan
-- sonra Shootboard'daki başlığı/açıklamayı değiştirmek videoyu
-- DEĞİŞTİRMİYOR -- video çoktan yüklenmiş oluyor. Düzeltme YouTube
-- Studio'dan yapılmak zorunda.
--
-- Süreyi kısaltmak bu riski azaltır, uzatmak hata payını artırır.
-- Değeri aşağıdaki işlevde TEK YERDE: değiştirmek tek satır.

begin;

-- ⚠ IMMUTABLE: kuyruk sorgusunda her satır için yeniden çalışmasın.
create or replace function public.story_onden_yukleme(p_type text, p_platform text)
returns interval
language sql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
  select case
    -- YouTube: yayın saatinden ALTI SAAT önce yükle, gerçek yayın
    -- anını worker `status.publishAt` ile YouTube'a bildiriyor.
    when p_type = 'shorts' and p_platform = 'youtube' then interval '6 hours'
    -- ⛔ GERİ KALAN HER ŞEY SIFIR. Zamanlaması olmayan bir platformda
    -- erken yüklemek, erken YAYINLAMAK demek.
    else interval '0 seconds'
  end;
$$;

revoke all   on function public.story_onden_yukleme(text, text) from public, anon, authenticated;
grant execute on function public.story_onden_yukleme(text, text) to service_role;

commit;

-- ═══ KUYRUK ═══════════════════════════════════════════════════════
-- Tek değişen satır: `e.publish_at <= now()` yerine önden yükleme
-- payı düşülmüş hâli. Gerisi sql/54 ile birebir aynı.
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
       and e.publish_state = 'pending'
       and e.deleted_at is null
       and e.publish_at is not null
       -- ⚠ ÖNDEN YÜKLEME. YouTube dışında pay SIFIR, yani öteki
       -- platformlar için bu satır eskisiyle birebir aynı davranıyor.
       and e.publish_at - public.story_onden_yukleme(e.type, e.platform) <= now()
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

notify pgrst, 'reload schema';

-- ═══ KONTROL ══════════════════════════════════════════════════════
-- 1) Paylar doğru mu? İlk satır 6 saat, ötekiler 0 olmalı.
select 'shorts/youtube'     as kayit, public.story_onden_yukleme('shorts', 'youtube')     as pay
union all select 'story/instagram', public.story_onden_yukleme('story',  'instagram')
union all select 'reels/instagram', public.story_onden_yukleme('reels',  'instagram')
union all select 'reels/tiktok',    public.story_onden_yukleme('reels',  'tiktok')
union all select 'shorts/instagram (olmamalı)', public.story_onden_yukleme('shorts', 'instagram');

-- 2) Kuyruk payı okuyor mu? true dönmeli.
select pg_get_functiondef(p.oid) like '%story_onden_yukleme%' as kuyruk_baglandi
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'story_kuyruk_al';

-- 3) ŞİMDİ hangi kayıtlar erken alınabilir hâle geldi?
--    (Yayınlamıyor, yalnızca gösteriyor. YouTube kayıtları yayın
--    saatinden altı saat önce burada görünmeye başlar.)
select type, platform, publish_at,
       publish_at - public.story_onden_yukleme(type, platform) as yukleme_ani,
       coalesce(media_name, '(dosyasız)') as dosya,
       publish_state
  from public.calendar_events
 where type = any(public.story_yayin_turleri())
   and auto_publish = true
   and deleted_at is null
   and publish_state <> 'published'
   and publish_at is not null
 order by publish_at
 limit 25;
