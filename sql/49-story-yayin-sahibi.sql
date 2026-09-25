-- ═══════════════════════════════════════════════════════════════════
-- sql/49 · KUYRUK KIMIN KAYDINI ALIYOR?
-- ═══════════════════════════════════════════════════════════════════
-- 25 Eylul 2026, uygulamayi bastan sona gozden gecirirken cikti.
--
-- story_kuyruk_al SU ANA KADAR SAHIBE BAKMIYORDU:
--
--   where e.type = 'story' and e.auto_publish = true
--     and e.publish_state = 'pending' and e.publish_at <= now()
--
-- `user_id` yok. Worker ise TEK bir hesaba yayinliyor -- adres
-- META_IG_USER_ID ve META_PAGE_ID gizli ayarlarindan geliyor. Ve
-- "Otomatik yayinla" kutusu oturum acmis HERKESE gorunuyor.
--
-- Yani mantiken: baska bir kullanici story kaydi acip o kutuyu
-- isaretlerse, kaydi hesap sahibinin Instagram'ina cikardi.
--
-- ⚠ BUGUN BU OLMUYOR ama sebebi kuyruk degil. Worker media_url
-- olmadan yayinlamiyor; media_url yalnizca MCP'den yaziliyor; MCP
-- anahtari uretmek de sql/40'taki RLS kuraliyla prefs.mcp='true' olan
-- hesaplara kilitli ve o bayrak tek bir hesapta. Yani koruma BASKA BIR
-- ALT SISTEMDE ve tesadufen. MCP bir gun ikinci bir kullaniciya
-- acilirsa kapi kendiliginden acilir.
--
-- COZUM: sql/40'taki kalibin aynisi. Yeni gizli ayar yok; bayrak
-- user_prefs'te duruyor ve "kim otomatik yayin yapabiliyor" tek
-- sorguyla goruluyor.
--
-- ⚠ BU TEK KIRACILI BIR KORUMA. Bugun tek worker, tek Meta jetonu var
-- ve bayrak "bu hesap otomatik yayin yapabilir" demek. Ileride ikinci
-- bir jetonla ikinci bir worker olursa bayrak hangi jetona ait
-- oldugunu SOYLEMEZ; o gun bayrak degil, jeton basina sahiplik gerekir.
-- ═══════════════════════════════════════════════════════════════════

begin;

create or replace function public.story_kuyruk_al(p_limit integer default 5)
returns table(
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
       -- ⚠ SAHIP KONTROLU. Bu satir olmadan kuyruk HERKESIN kaydini
       -- aliyordu ve worker hepsini ayni Instagram hesabina yayinlardi.
       and exists (select 1 from public.user_prefs p
                    where p.user_id = e.user_id
                      and p.prefs->>'story_yayin' = 'true')
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

-- Bayragi hesap sahibine ver. E-postayla yaziliyor ki uuid aramak
-- gerekmesin; yanlis satira yazma ihtimali de boylece kalkiyor.
insert into public.user_prefs (user_id, prefs)
select u.id, jsonb_build_object('story_yayin', true)
  from auth.users u
 where u.email = 'bostancioglum@gmail.com'
on conflict (user_id) do update
  set prefs = jsonb_set(coalesce(public.user_prefs.prefs, '{}'::jsonb),
                        '{story_yayin}', 'true'::jsonb);

commit;

notify pgrst, 'reload schema';

-- ═══ KONTROL ═══════════════════════════════════════════════════════
-- 1) Bayrak kimde? YALNIZCA olmasi gerekenler donmeli.
select u.email, p.prefs->>'story_yayin' as story_yayin
  from public.user_prefs p
  join auth.users u on u.id = p.user_id
 where p.prefs->>'story_yayin' = 'true';

-- 2) ⚠ SESSIZ KALMASIN. Bayragi olmayan bir hesabin zamani gelmis
-- kaydi varsa burada gorunur. Sifir donmeli; donmezse o kayit
-- kuyruga hic girmiyor ve kimse fark etmiyor demektir.
select count(*) as bayraksiz_bekleyen
  from public.calendar_events e
 where e.type = 'story' and e.auto_publish = true
   and e.publish_state = 'pending' and e.deleted_at is null
   and e.publish_at is not null and e.publish_at <= now()
   and not exists (select 1 from public.user_prefs p
                    where p.user_id = e.user_id
                      and p.prefs->>'story_yayin' = 'true');
