-- =====================================================================
-- ACIKLAMA SABLONLARI TABLOSU
-- =====================================================================
-- Sablonlar (hesap listesi + genel metin + platform istisnalari) bugun
-- yalnizca tarayicinin deposunda duruyor. Bu yuzden baska cihazda
-- gorunmuyorlar. Bu tablo onlari kayitlar ve projelerle ayni yere tasiyor.
--
-- Supabase panelinde: SQL Editor -> New query -> hepsini yapistir -> Run.
-- Tekrar calistirilabilir: her adim "varsa dokunma" bicimde yazildi.
-- =====================================================================

begin;

-- Eski bir denemeden kalma, yapisi tutmayan bir tablo varsa
-- "create table if not exists" sessizce atlar ve sonraki adimlar
-- anlasilmaz hatalar verir. O yuzden once bakiliyor: yapisi tutmayan
-- tablo BOSSA dusuruluyor, DOLUYSA is durduruluyor.
do $$
declare
  n bigint;
begin
  if to_regclass('public.caption_templates') is not null then
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'caption_templates'
         and column_name = 'overrides'
    ) then
      execute 'select count(*) from public.caption_templates' into n;
      if n = 0 then
        drop table public.caption_templates;
        raise notice 'Eski bos caption_templates tablosu dusuruldu, yenisi kuruluyor.';
      else
        raise exception 'caption_templates tablosu var ama yapisi tutmuyor ve icinde % satir var. Once icerigi kontrol et.', n;
      end if;
    end if;
  end if;
end $$;

create table if not exists public.caption_templates (
  -- Kullanici basina TEK satir: sablonlarin tamami tek bir kayit.
  -- Liste degil tek kayit oldugu icin kimlik ayri bir sutuna gerek yok.
  user_id       uuid primary key references auth.users(id) on delete cascade,

  -- Ekip calismasi acildiginda dolacak; bugun bos.
  workspace_id  uuid references public.workspaces(id) on delete cascade,

  -- Hesap listesi: [{id, platform, handle}, ...]
  -- Platform listesi buyuyecegi icin jsonb; her platform ayri sutun
  -- olsaydi yeni bir platform eklemek her seferinde goc demekti.
  accounts      jsonb not null default '[]'::jsonb,

  -- Butun aciklamalara giden genel metin.
  general       text  not null default '',

  -- Platform bazinda istisnalar: {"youtube": "...", "instagram": "..."}
  overrides     jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  -- Cihazlar arasi cakismada hangi tarafin daha yeni oldugunu bu sutun
  -- soyluyor. Istemci kendi damgasini yaziyor: iki cihaz cevrimdisi
  -- calisip sonra baglandiginda son YAZAN degil son DEGISTIREN kazansin.
  updated_at    timestamptz not null default now()
);

create index if not exists caption_templates_ws_idx
  on public.caption_templates (workspace_id);

-- Giris yapmis kullaniciya tablo erisimi. Supabase yeni tablolara bunu
-- kendiliginden veriyor; yine de aciktan yaziliyor ki varsayilan ayarlar
-- degismisse de calissin. Asil koruma asagidaki RLS kurallarinda.
grant select, insert, update, delete on public.caption_templates to authenticated;

-- RLS: tablo acilir acilmaz kilitleniyor.
alter table public.caption_templates enable row level security;

drop policy if exists caption_templates_own on public.caption_templates;
create policy caption_templates_own on public.caption_templates
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Calisma alani uzerinden erisim: ekip acildiginda devreye girecek.
drop policy if exists caption_templates_ws on public.caption_templates;
create policy caption_templates_ws on public.caption_templates
  for all
  using (workspace_id is not null and public.is_workspace_member(workspace_id))
  with check (workspace_id is not null and public.is_workspace_member(workspace_id));

commit;

-- Kontrol: sutunlar bekledigim gibi mi?
select column_name as sutun, data_type as tip
  from information_schema.columns
 where table_schema = 'public' and table_name = 'caption_templates'
 order by ordinal_position;
