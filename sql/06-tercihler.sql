-- =====================================================================
-- KULLANICI TERCIHLERI TABLOSU
-- =====================================================================
-- Bugun dil tercihi yalnizca tarayicinin deposunda. Bilgisayarda Turkce
-- secen biri telefonunu actiginda Ingilizce karsilaniyor. Bu tablo dili
-- kisiye baglıyor.
--
-- Tema ve gorunum (Ay/Hafta/Gun/Tablo) BILEREK buraya girmiyor: onlar
-- cihaza ait tercihler. Bilgisayarda acik tema, telefonda koyu tema
-- istemek makul; senkronlanirsa biri digerini bozar.
--
-- Supabase panelinde: SQL Editor -> New query -> hepsini yapistir -> Run.
-- Tekrar calistirilabilir.
-- =====================================================================

begin;

-- Eski bir denemeden kalma, yapisi tutmayan tablo varsa "create table if
-- not exists" sessizce atlar ve sonraki adimlar anlasilmaz hata verir.
-- Yapisi tutmayan tablo BOSSA dusuruluyor, DOLUYSA is durduruluyor.
do $$
declare
  n bigint;
begin
  if to_regclass('public.user_prefs') is not null then
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'user_prefs'
         and column_name = 'prefs'
    ) then
      execute 'select count(*) from public.user_prefs' into n;
      if n = 0 then
        drop table public.user_prefs;
        raise notice 'Eski bos user_prefs tablosu dusuruldu, yenisi kuruluyor.';
      else
        raise exception 'user_prefs tablosu var ama yapisi tutmuyor ve icinde % satir var. Once icerigi kontrol et.', n;
      end if;
    end if;
  end if;
end $$;

create table if not exists public.user_prefs (
  -- Kullanici basina TEK satir.
  user_id     uuid primary key references auth.users(id) on delete cascade,

  -- Tercihler jsonb: bugun yalnizca {"lang":"tr"}. Ileride baska bir
  -- tercih senkronlanmak istenirse veritabani degisikligi gerekmesin.
  prefs       jsonb not null default '{}'::jsonb,

  created_at  timestamptz not null default now(),
  -- Cihazlar arasi cakismada hangi tarafin daha yeni oldugunu bu soyluyor.
  -- Istemci kendi damgasini yaziyor: cevrimdisi yapilan bir degisiklik
  -- sonradan baglanan eski bir cihaz tarafindan ezilmesin.
  updated_at  timestamptz not null default now()
);

-- Giris yapmis kullaniciya tablo erisimi. Supabase yeni tablolara bunu
-- kendiliginden veriyor; yine de aciktan yaziliyor. Asil koruma RLS'te.
grant select, insert, update, delete on public.user_prefs to authenticated;

alter table public.user_prefs enable row level security;

drop policy if exists user_prefs_own on public.user_prefs;
create policy user_prefs_own on public.user_prefs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;

-- Kontrol: sutunlar bekledigim gibi mi?
select column_name as sutun, data_type as tip
  from information_schema.columns
 where table_schema = 'public' and table_name = 'user_prefs'
 order by ordinal_position;
