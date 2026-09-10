-- 35 — AI erişimi: API anahtarları ve aktarım defteri
--
-- Neden: kullanıcı planını, scriptini, fikirlerini herhangi bir yapay
-- zekâ sohbetinde hazırlıyor (ChatGPT, Claude...) ve "bunları Shootboard'a
-- ekle" diyebilmek istiyor. Uygulamaya girip elle yazmak yerine AI
-- doğrudan yazsın; hesaptaki planı okuyup asistan gibi çalışabilsin.
--
-- İki tablo:
--   api_keys       kullanıcının ürettiği anahtarlar. Düz metin HİÇ
--                  saklanmıyor; SHA-256 özeti duruyor. Edge Function
--                  (supabase/functions/ai) gelen anahtarın özetini bulup
--                  user_id'yi öğreniyor.
--   ai_aktarimlar  her POST /import bir satır: hangi kimlikler eklendi,
--                  hangileri güncellendi (önceki halleriyle). Uygulamadaki
--                  "AI ekledi" rozeti ve "geri al" bu satırdan çalışıyor.
--
-- RLS: kullanıcı kendi satırlarını görür, anahtar üretir ve iptal eder;
-- aktarım defterine uygulama da yazar (yapıştırma yolu, anahtarsız).
-- Edge Function servis rolüyle çalışır; RLS'i o geçer ama her sorguda
-- user_id süzgeci vardır.
--
-- Her iki tabloda user_id var: sql/22'deki hesabi_sil() bunları da siler.
--
-- Uygulama bu betik çalıştırılmadan da çalışır: Hesabım penceresindeki
-- "AI erişimi" bölümü "kurulmadı" der, yapıştırma yolu deftere yazamaz
-- ama içe aktarma yine olur. Tekrar çalıştırılabilir.
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.

begin;

create table if not exists public.api_keys (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text not null default '',
  -- Anahtarın SHA-256 özeti, küçük harf onaltılık (64 karakter).
  key_hash     text not null unique,
  -- Listede tanımak için: "shb_ab12cd34…". Özetten geri türetilemez.
  key_prefix   text not null default '',
  -- read / write. İkisi de varsayılan; ileride salt okunur anahtar için.
  scopes       text[] not null default '{read,write}',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists api_keys_user_idx on public.api_keys (user_id);

alter table public.api_keys enable row level security;
drop policy if exists api_keys_own on public.api_keys;
create policy api_keys_own on public.api_keys
  for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.api_keys to authenticated;

create table if not exists public.ai_aktarimlar (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- Hangi anahtarla geldi; yapıştırma yolunda boş. Anahtar silinirse
  -- defter kalır.
  key_id         text references public.api_keys(id) on delete set null,
  created_at     timestamptz not null default now(),
  -- Paketteki "source": ChatGPT, Claude, Zapier... Rozette bu yazıyor.
  kaynak         text not null default '',
  -- Paketteki "note" ve sayılar: {"note": "...", "created": {...}, "updated": {...}}
  ozet           jsonb not null default '{}'::jsonb,
  -- Bu aktarımın EKLEDİĞİ kimlikler, tablo tablo. Geri alma bunları siler.
  kayitlar       text[] not null default '{}',
  projeler       text[] not null default '{}',
  mekanlar       text[] not null default '{}',
  scriptler      text[] not null default '{}',
  fikirler       text[] not null default '{}',
  -- Bu aktarımın GÜNCELLEDİĞİ satırların önceki halleri:
  -- {"projects": [ {...satır...} ], "places": [...], ...}. Geri alma
  -- bunları geri yazar.
  onceki         jsonb not null default '{}'::jsonb,
  geri_alindi_at timestamptz
);

create index if not exists ai_aktarimlar_user_idx on public.ai_aktarimlar (user_id, created_at desc);

alter table public.ai_aktarimlar enable row level security;
drop policy if exists ai_aktarimlar_own on public.ai_aktarimlar;
create policy ai_aktarimlar_own on public.ai_aktarimlar
  for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.ai_aktarimlar to authenticated;

commit;

-- Kontrol
select (select count(*) from public.api_keys where revoked_at is null) as etkin_anahtar,
       (select count(*) from public.ai_aktarimlar)                      as aktarim_sayisi;
