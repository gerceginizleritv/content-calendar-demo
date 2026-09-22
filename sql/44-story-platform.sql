-- 44 — Kuyruk hangi platforma gideceğini de söylüyor
--
-- ══════════════════════════════════════════════════════════════════
-- NEDEN
-- ══════════════════════════════════════════════════════════════════
-- sql/41 ve sql/42'deki story_kuyruk_al yalnızca `type = 'story'`
-- süzüyor. Platform sütununa hiç bakmıyor ve worker'a da söylemiyor.
--
-- Bugüne kadar zararsızdı: yayınlanabilir tek platform Instagram'dı,
-- takvimde de başka platformda story yoktu. Ama Shootboard'ın kendi
-- modeli "HER SOSYAL MEDYA AYRI KAYIT" -- şemanın kendi sözleriyle,
-- "a video announced on four platforms is four entries". Yani aynı
-- story Facebook'a da gidecekse takvimde `platform = 'facebook'` olan
-- ikinci bir kayıt açılacak.
--
-- O kayıt bugünkü kuyruğa girerdi ve worker onu INSTAGRAM'A YAYINLARDI.
-- Kullanıcının Facebook için planladığı story, Instagram'da ikinci kez
-- çıkardı. Geri alınamaz bir hata ve sessiz: hiçbir yerde "yanlış
-- platform" yazmazdı, her şey başarılı görünürdü.
--
-- ══════════════════════════════════════════════════════════════════
-- NE DEĞİŞİYOR
-- ══════════════════════════════════════════════════════════════════
-- Kuyruk `platform` sütununu da döndürüyor. Süzme SQL'e konmuyor:
-- worker platformu görüp kendi karar veriyor.
--
-- Sebebi şu: `and platform = 'instagram'` yazsaydık, Facebook kayıtları
-- kuyruğa hiç girmez ve HİÇBİR ŞEY OLMAZDI -- ne yayın, ne hata, ne
-- kayıt. Kullanıcı "otomatik yayınla"yı işaretlemiş, kayıt 'pending'de
-- sonsuza kadar bekliyor olurdu. Şartname Bölüm 9'un yasakladığı sessiz
-- başarısızlık tam olarak budur.
--
-- Worker desteklemediği bir platformu görünce kaydı ERTELİYOR ve
-- sebebini `last_error`'a yazıyor: "Facebook yayını henüz kurulmadı".
-- Deneme hakkı harcanmıyor. Facebook desteği geldiği gün o kayıtlar
-- kendiliğinden yayınlanmaya başlıyor -- elle hiçbir şey düzeltmek
-- gerekmiyor.

begin;

-- Dönüş tipi değişiyor, "create or replace" yetmiyor.
drop function if exists public.story_kuyruk_al(integer);
create function public.story_kuyruk_al(p_limit integer default 10)
returns table (
  id text, user_id uuid, media_url text, media_bytes bigint,
  media_mime text, publish_at timestamptz, attempt_count integer,
  idem_key uuid, external_id text, title text, content jsonb,
  publish_ref text, publish_ref_at timestamptz, publish_called_at timestamptz,
  platform text
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
     where e.type = 'story'
       and e.auto_publish = true
       and e.publish_state = 'pending'
       and e.deleted_at is null
       and e.publish_at is not null
       and e.publish_at <= now()
       and (e.retry_after is null or e.retry_after <= now())
       and e.attempt_count < 3
     order by e.publish_at
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
            e.publish_called_at, e.platform;
end $$;

revoke all   on function public.story_kuyruk_al(integer) from public, anon, authenticated;
grant execute on function public.story_kuyruk_al(integer) to service_role;

commit;

notify pgrst, 'reload schema';

-- ═══ KONTROL ══════════════════════════════════════════════════════
-- Fonksiyon platform sütununu döndürüyor mu?
select p.proname, pg_get_function_result(p.oid) like '%platform text%' as platform_var
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'story_kuyruk_al';
-- 1 satır, platform_var = true olmalı.

-- Takvimdeki story kayıtları platforma göre.
select platform, publish_state, count(*)
  from public.calendar_events
 where type = 'story' and deleted_at is null
 group by platform, publish_state
 order by platform, publish_state;
