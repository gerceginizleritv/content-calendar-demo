-- 54 — "hangi türler yayınlanır" sorusu artık TEK YERDE
--
-- ══════════════════════════════════════════════════════════════════
-- BU DOSYA NEDEN VAR
-- ══════════════════════════════════════════════════════════════════
-- 29 Eylül 2026, sql/53'ten hemen sonra bulundu:
--
--   `story_asili_topla` -- worker çökerse `in_progress` kalan kaydı
--   kuyruğa geri alan işlev -- YALNIZCA `type = 'story'` süzüyordu.
--
-- sql/50 reels'i ekledi, sql/53 shorts'u ekledi; ikisi de bu işlevi
-- genişletmeyi unuttu. Sonucu şuydu: bir reels ya da shorts kaydı
-- yayın ortasında SERT bir çöküşe denk gelirse (worker öldürülür,
-- bellek biter) kayıt SONSUZA KADAR 'in_progress' kalıyordu. Ne
-- yayınlanır, ne hata verir, ne kuyruğa döner, ne de bir yerde
-- görünür. Kullanıcı yalnızca "yayın çıkmadı" der.
--
-- ⚠ VE BU EN KÖTÜ ANDA VURURDU: YouTube yüklemesi sistemdeki en uzun
-- süren iş, yani sert çöküşe en açık olan o.
--
-- ══════════════════════════════════════════════════════════════════
-- YAMA DEĞİL, KAYNAK
-- ══════════════════════════════════════════════════════════════════
-- Bu işlevi de elle genişletmek listeyi DÖRDÜNCÜ kez kopyalamak
-- olurdu ve bir sonraki tür eklendiğinde yine biri unutulurdu --
-- bugüne kadar tam olarak böyle oldu:
--
--   sql/50: kuyruk + tetikleyici eklendi, asılı toplayıcı unutuldu
--   sql/53: kuyruk + tetikleyici genişletildi, asılı toplayıcı yine
--
-- O yüzden liste bir İŞLEVE taşınıyor ve üç yer de ona soruyor.
-- Bundan sonra yeni bir tür eklemek SQL tarafında TEK satır.
--
-- ⚠ VERİTABANI DIŞINDAKİ ÜÇ KOPYA DURUYOR ve duruyor olması gerekiyor
-- (worker ile app.html veritabanına bu soruyu soramaz):
--   · app.html            -> YAYIN_TURLERI   (kutucuk görünür mü)
--   · mcp/index.ts        -> YAYIN_TURLERI   (boyut tavanı)
--   · story-yayin/index.ts-> TURLER          (tür/platform eşleşmesi)
-- testler/shorts-kuyruk.test.js dördünü birbirine eşitliyor.

begin;

-- ⚠ IMMUTABLE ve SQL: planlayıcı bunu bir sabit gibi ele alabiliyor,
-- yani kuyruk sorgusunda her satır için yeniden çağrılmıyor.
create or replace function public.story_yayin_turleri()
returns text[]
language sql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
  -- ⛔ `video` (uzun form) BİLEREK YOK. Eklenirse Facebook'un `video`
  -- kayıtları da kuyruğa girer ve worker onları `reels` saymadığı için
  -- STORY olarak yayınlar: uzun bir belgesel 24 saatte kaybolur.
  -- Uzun form için önce worker'da ayrı bir dal gerekiyor.
  select array['story', 'reels', 'shorts']::text[];
$$;

-- ⚠ `authenticated` BU LİSTEDE YOK ve olmayacak. Aşağıdaki (3/3)
-- `story_yayin_ani_tazele` tetikleyicisi calendar_events üzerinde BEFORE
-- INSERT/UPDATE olarak duruyor, `security definer` DEĞİL ve gövdesinde bu
-- işlevi çağırıyor -- yani tarayıcının `authenticated` rolüyle. Yetkiyi
-- almak, uygulamanın HİÇBİR kaydı buluta yazamaması demek:
-- "42501 permission denied for function story_yayin_turleri" (6 Ekim 2026,
-- ayrıntısı sql/57'de). İşlev sabit bir dizi döndürüyor; korunacak bir
-- şey yok. Gerçekten korunması gerekenler satır yazanlar:
-- story_kuyruk_al ve story_asili_topla.
revoke all   on function public.story_yayin_turleri() from public, anon;
grant execute on function public.story_yayin_turleri() to service_role, authenticated;

commit;


-- ═══ 1/3 ═══ ASILI TOPLAYICI — ASIL DÜZELTME ══════════════════════
-- Tek değişen: `type = 'story'` yerine tür kümesi.
begin;

create or replace function public.story_asili_topla(p_dakika integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.calendar_events
     set publish_state = 'pending',
         updated_at    = now()
   where type = any(public.story_yayin_turleri())
     and publish_state = 'in_progress'
     and deleted_at is null
     and updated_at < now() - make_interval(mins => greatest(p_dakika, 1));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all   on function public.story_asili_topla(integer) from public, anon, authenticated;
grant execute on function public.story_asili_topla(integer) to service_role;

commit;

-- ═══ 2/3 ═══ KUYRUK ═══════════════════════════════════════════════
-- Davranış sql/53 ile AYNI; yalnızca kümeyi artık işlevden okuyor.
--
-- ⛔ BU DOSYAYI YENİDEN KOŞTURMA. Aşağıdaki drop/create, kuyruğun BU
-- GÜNKÜ sürümünü yazıyor; sql/55 (hazır olunca yükle) ve sql/56
-- (Facebook reels kuyruktan çıkarıldı) ondan SONRA geldi ve aynı işlevi
-- yeniden tanımladı. Burayı tekrar koşturmak ikisini de geri alır --
-- hiçbir hata vermeden: Facebook'a reels gitmeye yeniden başlar ve
-- YouTube yüklemeleri "dosya hazır olunca" yerine yayın saatine döner.
-- Kuyruğun güncel hali DAİMA en yüksek numaralı dosyada. Yalnızca yetki
-- düzeltmesi gerekiyorsa sql/57'yi koştur.
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
       and e.publish_at <= now()
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

-- ═══ 3/3 ═══ YAYIN ANI TETİKLEYİCİSİ ══════════════════════════════
begin;

create or replace function public.story_yayin_ani_tazele()
returns trigger
language plpgsql
as $$
begin
  if new.type = any(public.story_yayin_turleri()) then
    new.publish_at := public.story_yayin_ani(new.post_date, new.post_time, new.content);
  else
    -- Tür yayınlanabilir kümeden çıkarıldıysa yayın anı da anlamını
    -- yitiriyor. (Örnek: kullanıcı shorts kaydını video'ya çeviriyor.)
    new.publish_at := null;
  end if;
  return new;
end $$;

commit;

notify pgrst, 'reload schema';

-- ═══ KONTROL ══════════════════════════════════════════════════════
-- Dördü de true dönmeli. Üçü kümeyi işlevden okuyor mu, ve işlev
-- doğru kümeyi mi veriyor?
select
  (select public.story_yayin_turleri()
     = array['story','reels','shorts']::text[])                          as kume_dogru,
  (select pg_get_functiondef(p.oid) like '%story_yayin_turleri()%'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'story_asili_topla')      as asili_baglandi,
  (select pg_get_functiondef(p.oid) like '%story_yayin_turleri()%'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'story_kuyruk_al')        as kuyruk_baglandi,
  (select pg_get_functiondef(p.oid) like '%story_yayin_turleri()%'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'story_yayin_ani_tazele') as tetik_baglandi;

-- ŞU AN ASILI KALMIŞ KAYIT VAR MI? (sql/54 öncesinde takılıp kalmış
-- reels/shorts kayıtları burada çıkar; bir sonraki turda kendiliğinden
-- kuyruğa dönerler.)
select type, platform, post_date, coalesce(media_name, '(dosyasız)') as dosya,
       updated_at, attempt_count
  from public.calendar_events
 where publish_state = 'in_progress'
   and deleted_at is null
 order by updated_at;
