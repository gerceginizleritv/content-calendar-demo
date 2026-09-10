-- 33 — Mekanlara koordinat, ülke, saat dilimi ve kaynak
--
-- Neden: mekan adı yazılınca adres ve konum artık haritadan bulunuyor
-- (OpenStreetMap / Nominatim, "Bul" düğmesi). Bulunan noktanın koordinatı
-- mekanda saklanıyor ki kart karosu ve hava bloğu her açılışta yeniden
-- aramasın; ülke aynı aramadan, saat dilimi hava servisinden geliyor.
-- source aramadan mı (osm) elle mi (manual) geldiğini, external_id
-- OpenStreetMap kimliğini (ör. W123456) tutuyor.
--
-- Uygulama bu betik çalıştırılmadan da çalışır: sütun yoksa bu alanları
-- buluta yazmadan devam eder, koordinat yalnızca o tarayıcıda kalır.
-- Betik çalışınca sonraki kayıtlarda dolar.
--
-- ÖNCE sql/24 çalıştırılmış olmalı. Tekrar çalıştırılabilir.
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.

alter table public.places
  add column if not exists lat         double precision,
  add column if not exists lon         double precision,
  add column if not exists country     text not null default '',
  add column if not exists timezone    text not null default '',
  add column if not exists source      text not null default '',
  add column if not exists external_id text not null default '';

select count(*)   as mekan_sayisi,
       count(lat) as koordinatli_mekan
  from public.places
 where deleted_at is null;
