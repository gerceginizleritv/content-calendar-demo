-- =====================================================================
-- FIKIRLER VE SCRIPTLER KENDI TABLOLARINDA
-- =====================================================================
-- Onceki halde script ve fikirler projeye gomuluydu (project_scripts,
-- birincil anahtari project_id). Artik ikisi de KENDI BASINA kayit;
-- proje bagi istege bagli bir sutun.
--
-- Sebep kullanicidan geldi: is her zaman ayni sirayla gelmiyor. Bazen
-- once bir fikir not ediliyor, projesi gunler sonra aciliyor. Bazen once
-- script yaziliyor. Proje bagi zorunlu oldugu surece bunlarin hicbiri
-- yapilamiyordu.
--
-- ONCE sql/14-scriptler.sql ve sql/15-fikirler.sql calistirilmis olmali
-- (eski veri onlardan tasiniyor). Calistirilmadiysa da sorun degil:
-- tasima bolumu tablo yoksa atlaniyor.
--
-- ONEMLI SIRA: yeni surum tarayicida acilmadan ONCE calistirilmali.
-- Tablolar yokken uygulama buluta yazamaz — veri kaybolmaz (yerelde
-- durur, kuyrukta bekler) ama senkron durur.
--
-- Eski tablo SILINMIYOR: bir hafta sorunsuz gidene kadar geri donus yolu
-- acik kalsin.
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

-- Proje bagi: proje silinirse fikir/script SILINMIYOR, bagi kopuyor.
-- Bir fikri, projesi iptal oldu diye yok etmek dogru degil.
create table if not exists public.ideas (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null default '',
  project_id  text references public.projects(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.scripts (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  content     text not null default '',
  -- Metin nereden geldi: elle yazildi, Drive'dan getirildi, AI uretti.
  -- Bugun hepsi 'manual'; diger kapilar acildiginda dolacak.
  source      text not null default 'manual',
  project_id  text references public.projects(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists ideas_user_idx   on public.ideas   (user_id) where deleted_at is null;
create index if not exists scripts_user_idx on public.scripts (user_id) where deleted_at is null;

alter table public.ideas   enable row level security;
alter table public.scripts enable row level security;

drop policy if exists ideas_own on public.ideas;
create policy ideas_own on public.ideas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists scripts_own on public.scripts;
create policy scripts_own on public.scripts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.ideas   to authenticated;
    grant select, insert, update, delete on public.scripts to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Eski bicimden tasima. Tekrar calistirmak zararsiz: kimlikler sabit
-- turetiliyor ve catisma atlanyor.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.project_scripts') is null then
    raise notice 'project_scripts yok, tasinacak eski veri de yok.';
    return;
  end if;

  -- Scriptler: her projenin metni bir script oluyor. Basligi proje adi.
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='project_scripts' and column_name='content') then
    insert into public.scripts (id, user_id, title, content, source, project_id, created_at, updated_at)
    select 'sc_' || ps.project_id, ps.user_id, coalesce(p.name, ''), ps.content,
           coalesce(ps.source, 'manual'), ps.project_id,
           coalesce(ps.updated_at, now()), coalesce(ps.updated_at, now())
      from public.project_scripts ps
      left join public.projects p on p.id = ps.project_id
     where coalesce(btrim(ps.content), '') <> ''
    on conflict (id) do nothing;
  end if;

  -- Fikirler: jsonb dizisindeki her eleman bir satir. Kimlik dizideki
  -- kimlikten geliyor, yoksa sirasindan turetiliyor. Kimlik tarayicida
  -- uretiliyor ve benzersiz; yine de ayni kimlik iki projede gorunurse
  -- "on conflict do nothing" birini SESSIZCE dusururdu. Once bakiyoruz.
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='project_scripts' and column_name='ideas') then
    if exists (
      select 1 from (
        select coalesce(nullif(f.deger->>'id',''), 'fk_' || ps.project_id || '_' || f.sira) as kimlik,
               count(distinct ps.project_id) as kac_proje
          from public.project_scripts ps
          cross join lateral jsonb_array_elements(coalesce(ps.ideas, '[]'::jsonb))
                      with ordinality as f(deger, sira)
         where coalesce(btrim(f.deger->>'text'), '') <> ''
         group by 1
      ) x where x.kac_proje > 1
    ) then
      raise exception 'Ayni fikir kimligi birden fazla projede gorunuyor. Sessizce veri dusurmemek icin duruyorum; once bunu konusalim.';
    end if;

    insert into public.ideas (id, user_id, text, project_id, created_at, updated_at)
    select coalesce(nullif(f.deger->>'id', ''), 'fk_' || ps.project_id || '_' || f.sira),
           ps.user_id,
           coalesce(f.deger->>'text', ''),
           ps.project_id,
           coalesce(ps.ideas_updated_at, now()),
           coalesce(ps.ideas_updated_at, now())
      from public.project_scripts ps
      cross join lateral jsonb_array_elements(coalesce(ps.ideas, '[]'::jsonb))
                  with ordinality as f(deger, sira)
     where coalesce(btrim(f.deger->>'text'), '') <> ''
    on conflict (id) do nothing;
  end if;
end $$;

commit;

-- Kontrol
select (select count(*) from public.ideas   where deleted_at is null) as fikir_sayisi,
       (select count(*) from public.scripts where deleted_at is null) as script_sayisi;
