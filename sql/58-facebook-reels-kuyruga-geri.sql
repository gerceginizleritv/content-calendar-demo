-- ═══════════════════════════════════════════════════════════════════
-- 58 — FACEBOOK REELS KUYRUĞA GERİ ALINIYOR (DENEY, 12 Ekim 2026)
-- ═══════════════════════════════════════════════════════════════════
--
-- NE DEĞİŞİYOR
--   story_kuyruk_al'dan ŞU TEK SATIR çıkıyor:
--       and not (e.platform = 'facebook' and e.type = 'reels')
--   Başka hiçbir şey değişmiyor; gövde sql/56'dan birebir alındı.
--
-- NEDEN
--   5 Ekim'de o satırı koyarken sebebi "Facebook API ile yayınlanan
--   reels'i dağıtmıyor" idi (IG 8.148 / FB 19, aynı dosya aynı dakika).
--   12 Ekim'de gerçek sebep bulundu: Meta uygulaması (Shootboard Story,
--   1418493033553513) HİÇ YAYINLANMAMIŞTI -- `In development`,
--   `Unpublished`, bütün izinler "Ready for testing" yani Standard
--   Access. Böyle bir uygulamanın ürettiği içeriği Meta büyük ölçüde
--   yalnızca uygulamada rolü olan kişiye açıyor. Ölçtüğümüz "1 tekil
--   görüntüleyen" tam olarak buydu: kullanıcının kendisi.
--
--   Uygulama 12 Ekim'de Live'a alındı. Bu dosya, düzelip düzelmediğini
--   ÖLÇMEK için kuyruğu açıyor.
--
-- ⚠ BU BİR DENEY, KALICI KARAR DEĞİL
--   Deney yüzeyi TEK GÖNDERİ: 12 Ekim itibarıyla auto_publish'i açık
--   olan tek facebook+reels kaydı 13 Ekim 10:00 (Kurul Kalesi). Geri
--   kalan 16 facebook reels kaydının tiki 10 Ekim'de kapatıldı, yani
--   bu satır kalksa da onlar kuyruğa girmiyor.
--
--   Aşağıdaki KONTROL bölümü bunu koşmadan önce saydırıyor. Sayı 1
--   değilse DUR: beklemediğin kayıtlar yayına girecek demektir.
--
-- ⛔ GERİ ALMAK: sql/56-hazir-olunca-yukle.sql'i yeniden koştur.
--   O dosya aynı işlevi dışlama satırıyla birlikte yeniden yaratıyor
--   ve yeniden koşmak güvenli (drop/create). Yani:
--       deney AÇIK  = bu dosya
--       deney KAPALI = sql/56
--   Deney başarısız olursa (Facebook yine ~19 görüntülenme / 1 tekil
--   kişi) yapılacak tek şey sql/56'yı yeniden koşturmaktır.
--
-- ⚠ sql/56'yı YENİDEN KOŞTURMADAN ÖNCE bunu bil: o dosya bu işlevi
--   dışlama satırıyla geri getirir. İstediğin buysa doğru dosya;
--   değilse koşturma.
--
-- Bu dosya story_yayin_turleri()'ne DOKUNMUYOR, yani sql/57'deki
-- `grant execute ... to authenticated` yerinde kalıyor (42501 hatası
-- geri gelmez).
-- ═══════════════════════════════════════════════════════════════════


-- ═══ KONTROL — ÖNCE BUNU KOŞTUR ═══════════════════════════════════
-- Dışlama kalkınca kuyruğa girmeye aday olan facebook+reels kayıtları.
-- BEKLENEN: tam olarak 1 satır (2026-10-13 10:00, Kurul Kalesi).
-- Başka bir şey görüyorsan AŞAĞIYI KOŞTURMA, önce o kayıtların tikini
-- kapat.
select post_date, post_time, title,
       coalesce(media_name, '(dosyasız)') as dosya,
       publish_state
  from public.calendar_events
 where platform = 'facebook'
   and type     = 'reels'
   and auto_publish = true
   and deleted_at is null
   and publish_state <> 'published'
 order by post_date, post_time;


-- ═══ DEĞİŞİKLİK ═══════════════════════════════════════════════════
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

notify pgrst, 'reload schema';


-- ═══ DOĞRULAMA ════════════════════════════════════════════════════
-- Dışlama satırı gerçekten gitti mi? 0 dönmeli.
select count(*) as dislama_hala_var
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'story_kuyruk_al'
   and pg_get_functiondef(p.oid) like '%platform = ''facebook'' and e.type = ''reels''%';
