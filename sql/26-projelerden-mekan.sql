-- 26 — Projelerdeki adreslerden MEKANLARI oluştur
--
-- Neden: eski lokasyon uygulamasındaki her lokasyon sql/11 ile bir
-- projeye çevrilmişti; adres, ilçe, şehir, izin ve "burada dikkat
-- edilecekler" o projelerin içine yazıldı. sql/24 mekanlar tablosunu
-- kurdu ama tablo BOŞ doğdu — eski yerler orada görünmüyor.
--
-- Bu betik, adresi (ya da şehri/ilçesi/harita bağlantısı) olan her
-- projeden bir mekan çıkarıyor ve projeyi o mekana bağlıyor.
--
-- Aynı adreste birden çok proje varsa TEK mekan oluşuyor, hepsi ona
-- bağlanıyor: "aynı yerde ikinci çekim" derdi buydu zaten. Mekanın
-- bilgileri, o adresteki projelerden eski lokasyondan gelenin (loc_...),
-- yoksa en eskisinin bilgileri.
--
-- Kimlik adresten üretiliyor (pl_ + özet). Betik tekrar çalıştırılabilir:
-- ikinci çalıştırmada yeni mekan doğmuyor, var olan da değişmiyor.
-- Projede elle seçilmiş bir mekan varsa ona DOKUNULMUYOR.
--
-- İki sorgu birbirinden bağımsız: ilki mekanları kuruyor, ikincisi
-- projeleri bağlıyor. Aralarında geçici tablo YOK — Supabase panelinde
-- her sorgu ayrı çalıştığı için geçici tablo ikinci sorguya kalmıyordu.
--
-- ÖNCE sql/24-mekanlar.sql çalıştırılmış olmalı.
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.
-- Sonra uygulamayı bir kez yenile (Ctrl+Shift+R): mekanlar iner.

-- ---------------------------------------------------------------------
-- 1) Mekanları oluştur
-- ---------------------------------------------------------------------
with aday as (
  select
    p.user_id,
    -- Anahtar: önce adres, adres yoksa projenin adı. Boşluk farkları
    -- ("Edirnekapı  Mah." / "edirnekapı mah.") aynı yeri ikiye bölmesin.
    lower(regexp_replace(trim(coalesce(nullif(trim(p.address), ''), p.name)), '\s+', ' ', 'g')) as anahtar,
    -- Eski lokasyondan gelen kayıt öne geçiyor: mekan bilgisini en doğru
    -- taşıyan o.
    (case when p.id like 'loc\_%' then 0 else 1 end) as oncelik,
    p.created_at,
    p.name, p.city, p.district, p.address, p.permission, p.cautions,
    p.field_notes, p.maps_url, p.drive_url
  from public.projects p
  where coalesce(p.place_id, '') = ''
    and p.deleted_at is null
    and coalesce(trim(p.name), '') <> ''
    and (coalesce(trim(p.address), '')  <> ''
      or coalesce(trim(p.city), '')     <> ''
      or coalesce(trim(p.district), '') <> ''
      or coalesce(trim(p.maps_url), '') <> '')
),
secili as (
  select distinct on (user_id, anahtar)
    'pl_' || md5(user_id::text || '|' || anahtar) as mekan_id,
    user_id, name, city, district, address, permission, cautions,
    field_notes, maps_url, drive_url
  from aday
  order by user_id, anahtar, oncelik, created_at
)
-- Uzunluk sınırları uygulamanınkiyle aynı: uzun bir alan kırpılmadan
-- inerse uygulama onu ilk kayıtta zaten kırpıyordu.
insert into public.places
  (id, user_id, name, city, district, address, permission, cautions, notes,
   maps_url, drive_url, created_at, updated_at)
select
  mekan_id, user_id,
  left(name, 160),
  left(coalesce(city, ''), 120),
  left(coalesce(district, ''), 120),
  left(coalesce(address, ''), 400),
  left(coalesce(permission, ''), 400),
  left(coalesce(cautions, ''), 2000),
  left(coalesce(field_notes, ''), 4000),
  left(coalesce(maps_url, ''), 600),
  left(coalesce(drive_url, ''), 600),
  now(), now()
from secili
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) Projeleri mekanlarına bağla
-- ---------------------------------------------------------------------
-- Anahtar yukarıdakiyle birebir aynı; o yüzden ayrı sorgu olması sorun
-- değil, ikisi de aynı kimliği üretiyor.
update public.projects p
   set place_id = 'pl_' || md5(p.user_id::text || '|' ||
     lower(regexp_replace(trim(coalesce(nullif(trim(p.address), ''), p.name)), '\s+', ' ', 'g')))
 where coalesce(p.place_id, '') = ''
   and p.deleted_at is null
   and coalesce(trim(p.name), '') <> ''
   and (coalesce(trim(p.address), '')  <> ''
     or coalesce(trim(p.city), '')     <> ''
     or coalesce(trim(p.district), '') <> ''
     or coalesce(trim(p.maps_url), '') <> '')
   -- Karşılığı gerçekten oluşmuş mekanlara bağlanıyor; olmayan bir
   -- kimliği yazıp yabancı anahtarı patlatmıyor.
   and exists (
     select 1 from public.places m
      where m.id = 'pl_' || md5(p.user_id::text || '|' ||
        lower(regexp_replace(trim(coalesce(nullif(trim(p.address), ''), p.name)), '\s+', ' ', 'g')))
   );

-- ---------------------------------------------------------------------
-- 3) Kontrol: hangi mekan oluştu, kaç projesi var?
-- ---------------------------------------------------------------------
select m.name, m.city, m.district, left(m.address, 60) as adres,
       (select count(*) from public.projects p
         where p.place_id = m.id and p.deleted_at is null) as proje_sayisi
  from public.places m
 order by m.name;

-- GERI ALMAK icin (yalnizca bu betigin urettiklerini siler; elle
-- eklenen mekanlara dokunmaz):
--   update public.projects set place_id = null
--    where place_id ~ '^pl_[0-9a-f]{32}$';
--   delete from public.places
--    where id ~ '^pl_[0-9a-f]{32}$';

-- Eksik kalan var mi? Eski lokasyon tablosundaki bir kayit, karsiligi
-- olan proje silinmisse mekana donusmez. Gormek icin (eski tablo
-- duruyorsa) bunu ayrica calistir:
--   select l.name, l.city, l.address
--     from public.locations l
--    where l.deleted_at is null
--      and not exists (select 1 from public.projects p
--                       where p.id = l.id and p.deleted_at is null)
--    order by l.name;
