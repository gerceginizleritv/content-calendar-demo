-- 24 — Mekanlar (çekim yerleri)
--
-- Neden: eski lokasyon takibinde projeler MEKANLARIN altında duruyordu.
-- Shootboard'a taşınırken mekan diye bir kayıt kalmadı; adres, ilçe, şehir
-- gibi alanlar tek tek her projenin içine yazıldı. Aynı yerde ikinci bir
-- çekim yapan kişi hepsini baştan giriyor, izin durumu ve "burada dikkat
-- edilecekler" gibi bilgiler de her projede ayrı ayrı duruyor.
--
-- Bu tablo mekanı kendi kaydına alıyor; proje ona bağlanıyor.
--
-- Not: eski uygulamanın (lokasyon.html) kendi "locations" tablosu ayrı
-- duruyor ve buna DOKUNULMUYOR. Adı bilerek farklı: iki sistem bir süre
-- yan yana yaşayacak.

begin;

create table if not exists public.places (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default '',
  city        text not null default '',
  district    text not null default '',
  address     text not null default '',
  -- Bir mekanda tekrar tekrar isine yarayan bilgiler: izin kimden
  -- alindi, nerede park edilir, elektrik var mi.
  permission  text not null default '',
  cautions    text not null default '',
  notes       text not null default '',
  maps_url    text not null default '',
  drive_url   text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Silinen satir tabloda kaliyor: gecmiste elle silinen kayitlar her
  -- acilista geri geliyordu.
  deleted_at  timestamptz
);

create index if not exists places_user_idx on public.places (user_id);

alter table public.places enable row level security;
drop policy if exists places_own on public.places;
create policy places_own on public.places
  for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.places to authenticated;

-- Projenin mekan bagi. Adres alanlari projede DURMAYA devam ediyor:
-- mekan secilmemis projeler ve eski kayitlar bozulmasin.
alter table public.projects
  add column if not exists place_id text references public.places(id) on delete set null;

commit;

-- Kontrol
select count(*) as mekan_sayisi from public.places;
