-- =====================================================================
-- SCRIPT TABLOSU
-- =====================================================================
-- Script neden projenin bir sutunu DEGIL de kendi tablosu:
--
-- 1) Proje satiri her kucuk degisiklikte (bir termin, bir isaret) butun
--    olarak buluta gidiyor. Script o satirin icinde olsaydi, telefondaki
--    eski kopya masaustunde yazilan yeni scripti ezerdi. Ayri tabloda
--    script YALNIZCA script degistiginde gidiyor — ezme ihtimali
--    yapisal olarak yok. Tehlike "bos uzerine yazar" degil, "eski
--    uzerine yazar".
--
-- 2) Script buyuk. Bir metin 12.000 karakter olabilir; proje satirinin
--    icinde olsaydi her isaret degisikliginde kilobaytlar bosa giderdi.
--
-- Proje silinince scripti de gidiyor (on delete cascade): projesiz bir
-- script kimsenin bakmayacagi bir kalinti olurdu.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- Tekrar calistirilabilir.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.projects') is null then
    raise exception 'projects tablosu yok.';
  end if;
end $$;

create table if not exists public.project_scripts (
  project_id  text primary key references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null default '',
  -- Metin nereden geldi: elle yazildi, Drive'dan getirildi, AI uretti.
  -- Bugun hepsi 'manual'; diger iki kapi acildiginda dolacak. Kisit
  -- konmuyor, yeni bir kaynak eklemek veritabani degisikligi gerektirmesin.
  source      text not null default 'manual',
  updated_at  timestamptz not null default now()
);

create index if not exists project_scripts_user_idx
  on public.project_scripts (user_id);

alter table public.project_scripts enable row level security;

drop policy if exists project_scripts_own on public.project_scripts;
create policy project_scripts_own on public.project_scripts
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.project_scripts to authenticated;
  end if;
end $$;

commit;

-- Kontrol
select count(*) as script_sayisi from public.project_scripts;
