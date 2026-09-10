-- 34 — Bir projeye birden çok mekan (sıralı duraklar)
--
-- Neden: aynı günde aynı video için iki üç lokasyon oluyor (sabah han,
-- öğlen çarşı, akşam sahil). Proje tek mekan tutuyordu; ya üç proje
-- açılıyor ya da diğerleri notlara yazılıyordu ve mekan kartındaki
-- "bekleyen iş" sayısı yanlış çıkıyordu.
--
-- Desen sql/23 (script ↔ proje) ve sql/30 (fikir ↔ proje) ile aynı:
-- place_ids dizisi tam listeyi ve sırayı tutuyor, eski place_id sütunu
-- ilk durak olarak kalıyor. Eski istemciler ve sql/26 bozulmuyor.
--
-- Uygulama bu betik çalıştırılmadan da çalışır: sütun yoksa listesiz
-- yazar, yalnızca ilk durak buluta gider, gerisi o tarayıcıda kalır.
-- Betik çalışınca sonraki kayıtlarda tam liste gider.
--
-- ÖNCE sql/24 ve sql/26 çalıştırılmış olmalı. Tekrar çalıştırılabilir.
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.

alter table public.projects
  add column if not exists place_ids text[] not null default '{}';

-- Eski tek bağ listeye taşınıyor; dolu listeye dokunulmuyor.
update public.projects
   set place_ids = array[place_id]
 where place_id is not null
   and cardinality(place_ids) = 0;

select count(*)                                         as proje_sayisi,
       count(*) filter (where cardinality(place_ids) > 0) as mekanli_proje,
       count(*) filter (where cardinality(place_ids) > 1) as cok_mekanli_proje
  from public.projects
 where deleted_at is null;
