-- ═══════════════════════════════════════════════════════════════════
-- sql/47 · ERTELEME "HEMEN" DIYEBILSIN
-- ═══════════════════════════════════════════════════════════════════
-- 22 Eylul 2026, ilk cok parcali video yayini. Iki parca ayni saniyeye
-- planliydi, Instagram'a 2 dakika 17 saniye arayla cikti:
--
--   13:46:41  1/2 Instagram
--   13:48:58  2/2 Instagram      <- 2 dk 17 sn
--
-- Iki ayri sebep ust uste bindi. Bu dosya IKINCISINI cozuyor.
--
-- BIRINCI SEBEP (worker'da, surum 1.3.0): video konteynerleri sirayla
-- bekleniyordu, beklemeler TOPLANIYORDU. Artik konteynerler turun
-- basinda hep birlikte yaratiliyor, beklemeler UST USTE biniyor.
--
-- IKINCI SEBEP (burada): tur butcesi bitince kalan kayitlar
-- `story_ertele(p_dakika => 1)` ile erteleniyordu. Kulaga "bir dakika
-- sonra" gibi geliyor, ama olan su:
--
--   13:45:00  tur basliyor
--   13:46:50  butce bitti, erteleniyor -> retry_after = 13:47:50
--   13:47:00  TUR CALISIYOR ama kayit 13:47:50'den once gorunmez
--   13:48:00  ancak simdi aliniyor
--
-- Yani "bir dakika" pratikte IKI dakikaya mal oluyordu, cunku
-- retry_after dakika ortasina dusuyor ve bir sonraki turu iskaliyor.
--
-- Cozum: p_dakika 0 (ya da negatif) verilirse retry_after NULL kalsin
-- -- yani "bekleme yok, siradaki turda al". Kuyruk zaten dakikada bir
-- calistigi icin bu bir dongu riski tasimiyor: kayit en erken bir
-- sonraki dakika aliniyor.
--
-- ⚠ Varsayilan DEGISMIYOR. Cagrilarin buyuk cogunlugu gercek bir
-- bekleme istiyor (kota doldu -> 60 dakika, platform yok -> 180
-- dakika, kurtarma belirsiz -> 5 dakika). Sifir YALNIZCA "hata yok,
-- sadece vakit kalmadi" durumunda anlamli.
--
-- Bu dosya sql/41'deki fonksiyonun uzerine yaziyor; imza ayni oldugu
-- icin cagiran taraf degismiyor ve worker'in eski surumu de calismaya
-- devam ediyor (0 gonderdiginde eski fonksiyon 1 dakika anlar).
-- ═══════════════════════════════════════════════════════════════════

begin;

create or replace function public.story_ertele(
  p_id text, p_dakika integer default 60, p_sebep text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.calendar_events
     set publish_state = 'pending',
         -- attempt_count GERI ALINIYOR: erteleme bir hata degil.
         -- (Bolum 7 ve 9 -- "attemptCount ARTIRILMAZ".)
         attempt_count = greatest(attempt_count - 1, 0),
         retry_after   = case
                           when coalesce(p_dakika, 0) <= 0 then null
                           else now() + make_interval(mins => p_dakika)
                         end,
         last_error    = left(coalesce(p_sebep, ''), 2000),
         updated_at    = now()
   where id = p_id
     and publish_state = 'in_progress';
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Yetkiler: `create or replace` mevcut yetkileri korur, ama sql/41'de
-- grant'i unutup worker'i 403'e dusurdugumuz icin bir daha yazmiyoruz
-- sayilmaz -- acikca tekrarlaniyor.
revoke all    on function public.story_ertele(text, integer, text) from public, anon, authenticated;
grant execute on function public.story_ertele(text, integer, text) to service_role;

commit;

-- PostgREST onbellegi tazelensin.
notify pgrst, 'reload schema';

-- ═══ KONTROL ═══════════════════════════════════════════════════════
-- Fonksiyon yerinde mi ve sifiri "hemen" olarak mi okuyor?
-- Iki satir donmeli: sifir_bekletmiyor = true, bir_dakika_bekletiyor = true
select
  position('when coalesce(p_dakika, 0) <= 0 then null' in pg_get_functiondef(p.oid)) > 0
    as sifir_bekletmiyor,
  position('make_interval(mins => p_dakika)' in pg_get_functiondef(p.oid)) > 0
    as bir_dakika_bekletiyor
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'story_ertele';
