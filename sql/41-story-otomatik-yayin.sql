-- 41 — Otomatik story yayını: veri modeli ve durum geçişleri
--
-- Şartname: "Shootboard Otomatik Story Yayını · Meta Graph API v21.0"
-- (21 Eylül 2026). Bu betik Bölüm 1'i (veri modeli) ve Bölüm 4 + 8'in
-- veritabanına düşen kısmını kuruyor.
--
-- KAPSAM: önce YALNIZCA Instagram. Facebook sayfa story'si (Bölüm 6)
-- ikinci aşamaya kaldı — kullanıcı kararı. Sütunlar ikisini de taşıyacak
-- şekilde adlandırıldı, ama bugün yalnızca Instagram yolu yazılıyor.
--
-- ══════════════════════════════════════════════════════════════════
-- NEDEN GERÇEK SÜTUN, NEDEN content İÇİNDE DEĞİL
-- ══════════════════════════════════════════════════════════════════
--
-- calendar_events.content bir jsonb ve yeni alan eklemek migration
-- gerektirmiyor -- yani ilk bakışta doğru yer orası görünüyor. DEĞİL.
--
-- app.html'deki toRow() bulut yazımında content'i BÜTÜN OLARAK
-- gönderiyor:  content: e.content || {}
--
-- Worker content.publishState'i yazsaydı, kullanıcı o kaydı bir kez
-- açıp kaydettiğinde tarayıcı kendi kopyasını üstüne yazar ve yayın
-- durumu sessizce kaybolurdu. Aynı sınıf hata bu depoda iki kez
-- yaşandı (çok dilli başlık, sonra MCP bayrağı), ikisinde de kayıp
-- sessizdi.
--
-- Ayrı sütunlar bu sorunu yapısal olarak çözüyor: toRow() o sütunları
-- payload'a hiç koymuyor, PostgREST de upsert'te yalnızca gönderilen
-- sütunları güncelliyor. Yani uygulama onlara DOKUNAMIYOR.
--
-- ══════════════════════════════════════════════════════════════════
-- ⛔ uploaded ALANI
-- ══════════════════════════════════════════════════════════════════
--
-- Şartname Bölüm 1: "Scheduler, worker, hiçbir kod uploaded alanını
-- YAZMAZ. Sadece okuyabilir. Bu kural bir veri kaybından doğdu."
--
--   publish_state = SİSTEMİN durumu
--   uploaded      = KULLANICININ durumu ("ben bunu portala yükledim")
--
-- Bu kural burada bir söz değil, bir YAPI: worker satırı doğrudan
-- UPDATE etmiyor, aşağıdaki security definer fonksiyonları çağırıyor.
-- O fonksiyonlar uploaded'a erişmiyor -- erişemiyor. Worker'ın iyi
-- niyetine bırakılan bir kural, bir gün birinin eklediği tek satırla
-- bozulur.

begin;

-- ── Bölüm 1: alanlar ──────────────────────────────────────────────
-- Adlar snake_case: tablonun geri kalanı öyle (post_date, project_id).
-- Şartnamedeki camelCase adlar uygulama katmanında eşleniyor.
alter table public.calendar_events
  -- Kullanıcı kutucuğu. false ise scheduler bu kayda DOKUNMAZ.
  add column if not exists auto_publish   boolean not null default false,
  -- Public HTTPS. Instagram dosyayı buradan ÇEKİYOR: yönlendirme
  -- olmamalı, Content-Type doğru olmalı, Content-Length dönmeli.
  add column if not exists media_url      text,
  add column if not exists media_bytes    bigint,
  add column if not exists media_mime     text,
  -- Render çıktısının dosya adı. PC yükleyicisi kaydı bununla buluyor
  -- (Bölüm 2, Seçenek B): 2026-10-05_story_konu_k1.mp4
  add column if not exists media_name     text,
  -- date + time'dan türetiliyor, UTC saklanıyor. Dönüşüm TEK BİR
  -- YERDE yapılıyor: bu sütun yazılırken.
  add column if not exists publish_at     timestamptz,
  add column if not exists publish_state  text not null default 'pending',
  add column if not exists published_at   timestamptz,
  -- IG media id (ileride FB post id).
  add column if not exists external_id    text,
  add column if not exists last_error     text,
  add column if not exists attempt_count  integer not null default 0,
  -- Kayıt oluşturulurken üretiliyor; çöküş sonrası eşleştirme için.
  add column if not exists idem_key        uuid default gen_random_uuid(),
  -- Kotaya ya da hız sınırına takılan kayıt ERTELENİYOR, başarısız
  -- sayılmıyor. Bu damga "ne zaman tekrar bak" demek.
  add column if not exists retry_after    timestamptz;

-- Durum kümesi kısıt olarak yazılıyor: yazım hatası bir kaydı sessizce
-- görünmez yapmasın (scheduler yalnızca 'pending' arıyor).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'calendar_events_publish_state_chk') then
    alter table public.calendar_events
      add constraint calendar_events_publish_state_chk
      check (publish_state in ('pending','in_progress','published','failed'));
  end if;
end $$;

-- Scheduler'ın sorgusu dakikada bir dönüyor: kısmi indeks, yalnızca
-- gerçekten sıradaki satırları tutuyor. Tabloda on bin kayıt olsa da
-- bu indeks birkaç satır taşır.
create index if not exists calendar_events_yayin_kuyrugu
  on public.calendar_events (publish_at)
  where auto_publish = true and publish_state = 'pending' and deleted_at is null;

-- PC yükleyicisinin "bu dosya hangi kayda ait" araması.
create index if not exists calendar_events_media_name_idx
  on public.calendar_events (user_id, media_name)
  where media_name is not null;

-- ── Bölüm 4 + 8: durum geçişleri ──────────────────────────────────
--
-- Hepsi security definer. Sebebi iki katlı:
--   1. uploaded'a erişilemiyor (yukarıdaki ⛔ kuralı yapısal oluyor).
--   2. Geçiş ATOMİK: "aldım" ile "işaretledim" arasında başka bir
--      worker araya giremiyor.

-- Sıradaki kayıtları AL ve aynı işlemde in_progress'e çevir.
-- FOR UPDATE SKIP LOCKED şart: iki worker aynı kaydı almasın.
create or replace function public.story_kuyruk_al(p_limit integer default 10)
returns table (
  id text, user_id uuid, media_url text, media_bytes bigint,
  media_mime text, publish_at timestamptz, attempt_count integer,
  idem_key uuid, external_id text, title text, content jsonb
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
       -- Ertelenmiş kayıt zamanı gelmeden alınmıyor (kota/hız sınırı).
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
     -- Ikinci kapi: arada durumu degismisse alinmiyor.
     and e.publish_state = 'pending'
  returning e.id, e.user_id, e.media_url, e.media_bytes, e.media_mime,
            e.publish_at, e.attempt_count, e.idem_key, e.external_id,
            e.title, e.content;
end $$;

-- Yayin BASARILI. external_id bir daha yazilmiyor: doluysa bu kayit
-- zaten yayinlanmis demektir (Bolum 8, ikinci katman).
create or replace function public.story_yayinlandi(
  p_id text, p_external_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.calendar_events
     set publish_state = 'published',
         published_at  = now(),
         external_id   = coalesce(external_id, p_external_id),
         last_error    = null,
         retry_after   = null,
         updated_at    = now()
   where id = p_id
     and publish_state = 'in_progress';
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Yayin BASARISIZ. kalici=true ise tekrar denenmiyor (Bolum 9'daki
-- #190/#200/#100 ve format hatalari); false ise attempt_count zaten
-- alinirken artmisti, kayit pending'e donuyor ve sirasini bekliyor.
create or replace function public.story_basarisiz(
  p_id text, p_hata text, p_kalici boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer; v_deneme integer;
begin
  select attempt_count into v_deneme
    from public.calendar_events where id = p_id;

  update public.calendar_events
     set publish_state = case
           when p_kalici then 'failed'
           when coalesce(v_deneme, 3) >= 3 then 'failed'
           else 'pending' end,
         last_error  = left(coalesce(p_hata, ''), 2000),
         -- Aralar: 1 dk -> 5 dk -> 15 dk (Bolum 9).
         retry_after = case
           when p_kalici then null
           when coalesce(v_deneme, 0) = 1 then now() + interval '1 minute'
           when coalesce(v_deneme, 0) = 2 then now() + interval '5 minutes'
           else now() + interval '15 minutes' end,
         updated_at  = now()
   where id = p_id
     and publish_state = 'in_progress';
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ERTELE. Kota dolu ya da hiz siniri: bu bir HATA DEGIL, bir bekleme.
-- attempt_count GERI ALINIYOR -- alinirken artmisti, oysa sartname
-- "attemptCount ARTIRILMAZ" diyor (Bolum 7 ve 9). Uc kez kota dolu
-- olan bir kayit denemelerini tuketip 'failed' olmamali.
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
         attempt_count = greatest(attempt_count - 1, 0),
         retry_after   = now() + make_interval(mins => greatest(p_dakika, 1)),
         last_error    = left(coalesce(p_sebep, ''), 2000),
         updated_at    = now()
   where id = p_id
     and publish_state = 'in_progress';
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Bu fonksiyonlar YALNIZCA sunucu tarafindan cagriliyor (worker, servis
-- rolu). Tarayiciya verilmiyor: kullanici kendi kaydini 'published'
-- isaretleyebilseydi durum artik sistemin durumu olmazdi.
revoke all on function public.story_kuyruk_al(integer)            from public, anon, authenticated;
revoke all on function public.story_yayinlandi(text, text)        from public, anon, authenticated;
revoke all on function public.story_basarisiz(text, text, boolean) from public, anon, authenticated;
revoke all on function public.story_ertele(text, integer, text)   from public, anon, authenticated;

commit;

-- Kontrol
select count(*) filter (where auto_publish)                as otomatik_acik,
       count(*) filter (where publish_state = 'pending')   as bekleyen,
       count(*) filter (where publish_state = 'published') as yayinlanmis,
       count(*) filter (where publish_state = 'failed')    as basarisiz
  from public.calendar_events
 where type = 'story';

-- NOT — ÜCRETSİZ KATMAN BU İŞİ TAŞIMIYOR.
-- Zamanlayıcı dakikada bir çalışmak zorunda (pg_cron + pg_net). Ücretsiz
-- Supabase projesi bir haftalık hareketsizlikte DURUYOR ve yedeği yok.
-- Duran bir projede zamanlayıcı yoktur; story 24 saatlik, kaçan gün geri
-- gelmez. Bu betik çalışır ama sistemin vaadi ücretli katmana geçmeden
-- tutmaz.
--
-- NOT — SAAT DİLİMİ.
-- publish_at UTC. Dönüşüm TEK BİR YERDE: uygulama bu sütunu yazarken.
-- Şartname "Türkiye sabit UTC+3, DST yazma" diyor; ama Shootboard
-- kayıtları kendi saat dilimini taşıyor (content.timezone) ve
-- kullanıcıları yalnızca Türkiye'de değil. Dönüşüm kaydın KENDİ
-- diliminden yapılıyor, sabit +3 varsayılmıyor -- aynı hesap zaten
-- paylaşım takvimi beslemesinde de böyle yapılıyor ve orada yaz saati
-- testle ölçülüyor.
