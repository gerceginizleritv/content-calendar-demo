-- 46 — Aynı saatteki parçalar dosya adına göre sıralanıyor
--
-- ══════════════════════════════════════════════════════════════════
-- SORUN
-- ══════════════════════════════════════════════════════════════════
-- Birbirini takip eden çok parçalı story'ler ARKA ARKAYA çıkmalı:
-- soru kartı, hemen ardından cevap kartı. Aralarına dakikalar girerse
-- ikisi ayrı şeyler gibi görünür.
--
-- Worker bunu zaten yapabiliyor: bir turda birden çok kaydı alıyor ve
-- SIRAYLA yayınlıyor, yani aynı dakikadaki iki parça saniyeler arayla
-- çıkıyor. Eksik olan tek şey SIRANIN KENDİSİYDİ.
--
-- Kuyruk `order by publish_at` diyordu. İki parça aynı saatteyse bu
-- sıralama BERABERE kalıyor ve Postgres hangisini önce vereceğini
-- garanti etmiyor. Yani cevap kartı sorudan önce çıkabilirdi -- her
-- seferinde değil, bazen. Böyle bir hatanın testte görünmesi de zor.
--
-- Çözüm parçaları dakikalarla ayırmak DEĞİL (istenen şey tam tersi):
-- beraberliği bozacak ikinci bir ölçüt eklemek.
--
-- ══════════════════════════════════════════════════════════════════
-- NEDEN media_name
-- ══════════════════════════════════════════════════════════════════
-- Dosya adı parça sırasını zaten taşıyor:
--
--   2026-10-05_story_sokollu_k1.mp4
--   2026-10-05_story_sokollu_k2.mp4
--
-- Aynı önek, yalnızca kN değişiyor -- yani metin sıralaması parça
-- sırasıyla birebir aynı. Ayrı bir "sıra" sütunu açmak, aynı bilgiyi
-- ikinci bir yerde tutmak olurdu ve ikisi bir gün ayrışırdı.
--
-- media_name boş olan kayıtlar sona değil BAŞA alınıyor (nulls first):
-- dosyası bağlanmamış bir kayıt zaten yayınlanmıyor, sıralamada nerede
-- durduğu önemsiz; ama "boşlar sonda" demek, adı olan iki parçanın
-- arasına adsız bir kaydı sokabilirdi.
--
-- Son ölçüt id: iki kayıt her şeyiyle eşitse bile sıra HER TURDA AYNI
-- olsun. Belirsiz bir sıralama, ara sıra yanlış çalışan bir sistemdir.

begin;

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
     -- Beraberlik bozucu iki olcut: once dosya adi (parca sirasi),
     -- sonra id (her turda ayni sonuc).
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
            e.publish_called_at, e.platform;
end $$;

revoke all   on function public.story_kuyruk_al(integer) from public, anon, authenticated;
grant execute on function public.story_kuyruk_al(integer) to service_role;

commit;

notify pgrst, 'reload schema';

-- ⚠ KALAN AÇIK: 1. PARÇA BAŞARISIZ OLURSA 2. PARÇA YİNE ÇIKIYOR.
-- Sıra doğru ama bağ yok: cevap kartı, sorusu çıkmamışken tek başına
-- yayınlanabiliyor ve 24 saat öyle duruyor. Bunun çözümü "seri"
-- kavramı -- önceki parçası yayınlanmamış bir parçanın kuyruğa hiç
-- alınmaması. Ayrı bir iş olarak duruyor.

-- ═══ KONTROL ══════════════════════════════════════════════════════
select p.proname, pg_get_function_result(p.oid) like '%platform text%' as platform_var
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'story_kuyruk_al';
-- 1 satır, platform_var = true.

-- Aynı saatte birden çok parçası olan günler:
select post_date, post_time, count(*) as parca,
       string_agg(coalesce(media_name, '(dosyasız)'), ' → ' order by media_name nulls first) as sira
  from public.calendar_events
 where type = 'story' and deleted_at is null
 group by post_date, post_time
having count(*) > 1
 order by post_date, post_time;
-- "sira" sütunu parçaların hangi sırayla çıkacağını gösteriyor.
