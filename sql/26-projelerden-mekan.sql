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
-- ÖNCE sql/24-mekanlar.sql çalıştırılmış olmalı.
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.
-- Sonra uygulamayı bir kez yenile (Ctrl+Shift+R): mekanlar iner.

begin;

do $$
begin
  if to_regclass('public.places') is null then
    raise exception 'places tablosu yok. Once sql/24-mekanlar.sql calistirilmali.';
  end if;
end $$;

-- Once eslesme cikariliyor: hangi proje hangi mekana gidecek.
-- Gecici tablo, islem bitince kendiliginden dusuyor.
create temp table mekan_esleme on commit drop as
select
  p.id                                    as proje_id,
  p.user_id,
  -- Anahtar: once adres, adres yoksa projenin adi. Bosluk farklari
  -- ("Edirnekapi  Mah." / "edirnekapi mah.") ayni yeri ikiye bolmesin.
  lower(regexp_replace(trim(coalesce(nullif(trim(p.address), ''), p.name)), '\s+', ' ', 'g')) as anahtar,
  'pl_' || md5(p.user_id::text || '|' ||
    lower(regexp_replace(trim(coalesce(nullif(trim(p.address), ''), p.name)), '\s+', ' ', 'g'))) as mekan_id,
  -- Eski lokasyondan gelen kayit one geciyor: mekan bilgisini en dogru
  -- tasiyan o.
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
    or coalesce(trim(p.maps_url), '') <> '');

-- Mekanlar. Uzunluk sinirlari uygulamanindakiyle ayni: uzun bir alan
-- kirpilmadan inerse uygulama onu ilk kayitta zaten kirpiyordu.
insert into public.places
  (id, user_id, name, city, district, address, permission, cautions, notes,
   maps_url, drive_url, created_at, updated_at)
select distinct on (mekan_id)
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
from mekan_esleme
order by mekan_id, oncelik, created_at
on conflict (id) do nothing;

-- Projeleri bagla.
update public.projects p
   set place_id = e.mekan_id
  from mekan_esleme e
 where p.id = e.proje_id
   and coalesce(p.place_id, '') = '';

commit;

-- Kontrol: hangi mekan olustu, kac projesi var?
select m.name, m.city, m.district, left(m.address, 60) as adres,
       (select count(*) from public.projects p
         where p.place_id = m.id and p.deleted_at is null) as proje_sayisi
  from public.places m
 order by m.name;

-- GERI ALMAK icin (yalnizca bu betigin urettiklerini siler; elle
-- eklenen mekanlara dokunmaz):
--   begin;
--   update public.projects set place_id = null
--    where place_id ~ '^pl_[0-9a-f]{32}$';
--   delete from public.places
--    where id ~ '^pl_[0-9a-f]{32}$';
--   commit;

-- Eksik kalan var mi? Eski lokasyon tablosundaki bir kayit, karsiligi
-- olan proje silinmisse mekana donusmez. Sayisini gormek icin (eski
-- tablo duruyorsa) bunu ayrica calistir:
--   select l.name, l.city, l.address
--     from public.locations l
--    where l.deleted_at is null
--      and not exists (select 1 from public.projects p
--                       where p.id = l.id and p.deleted_at is null)
--    order by l.name;
