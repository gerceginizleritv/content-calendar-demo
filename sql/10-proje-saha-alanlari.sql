-- =====================================================================
-- PROJELERE SAHA ALANLARI
-- =====================================================================
-- Lokasyon uygulamasindaki alanlar Slate'in proje kaydina tasiniyor:
-- ilce, sehir, konu, format, izin durumu, script linki, Drive klasoru,
-- saha notlari, cekimde dikkat edilecekler, sahada cekilecekler.
--
-- Hepsi ISTEGE BAGLI. Bos olan alan arayuzde gorunmuyor; boylece bu
-- alanlari kullanmayan biri icin urun kalabalik olmuyor.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- Tekrar calistirilabilir.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.projects') is null then
    raise exception 'Once sql/04-projeler.sql calistirilmali: projects tablosu yok.';
  end if;
end $$;

alter table public.projects
  add column if not exists topic        text,   -- konu
  add column if not exists district     text,   -- ilce
  add column if not exists city         text,   -- sehir
  add column if not exists format       text,   -- Saha / Masabasi / Hibrit
  add column if not exists permission   text,   -- izin durumu
  add column if not exists script_url   text,   -- script Drive baglantisi
  add column if not exists drive_url    text,   -- Drive klasoru
  add column if not exists maps_url     text,   -- adresten turetilen degil, elle konan harita baglantisi
  add column if not exists field_notes  text,   -- sahada soylenenlerin ozeti
  add column if not exists cautions     text,   -- cekimde dikkat edilecekler
  add column if not exists shot_list    text;   -- sahada cekilmesi gerekenler

commit;

-- Kontrol
select column_name as sutun, data_type as tip
  from information_schema.columns
 where table_schema = 'public' and table_name = 'projects'
 order by ordinal_position;
