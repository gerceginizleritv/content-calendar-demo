-- =====================================================================
-- KAYIT SINIRINI HESABA BAGLAMA
-- =====================================================================
-- Slate'teki 100 kayit / 100 proje siniri DEMO icin var: ziyaretciye
-- "bu bir demo, bir aylik plana yeter" demek icin. Kendi hesabinda bir
-- anlami yok, sadece engel.
--
-- Sinir artik kullanici satirindan okunuyor. Bos ise varsayilan (100)
-- gecerli; dolu ise o gecerli.
--
-- NOT: Bu bir GUVENLIK siniri degil, bir kolaylik. Kullanici kendi
-- satirini duzenleyebilir (RLS kendi satirina izin veriyor). Para isin
-- icine girdiginde sinirin veritabani tarafindan DAYATILMASI gerekir;
-- o zaman buraya bir trigger eklenecek.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- Tekrar calistirilabilir.
-- =====================================================================

begin;

-- user_prefs yoksa once 06-tercihler.sql calistirilmali.
do $$
begin
  if to_regclass('public.user_prefs') is null then
    raise exception 'Once sql/06-tercihler.sql calistirilmali: user_prefs tablosu yok.';
  end if;
end $$;

alter table public.user_prefs
  add column if not exists entry_limit   integer,
  add column if not exists project_limit integer;

-- Hesaba sinirsiz yetki. E-posta bulunamazsa is duruyor: sessizce
-- "yaptim" demek, sonra sinira carpinca nedenini aramaktan kotudur.
do $$
declare
  kim uuid;
  posta text := 'bostancioglum@gmail.com';
begin
  select id into kim from auth.users where lower(email) = lower(posta);
  if kim is null then
    raise exception 'Bu e-postayla kayitli kullanici yok: %. Once uygulamadan giris yap.', posta;
  end if;

  insert into public.user_prefs (user_id, entry_limit, project_limit)
  values (kim, 100000, 100000)
  on conflict (user_id) do update
    set entry_limit = excluded.entry_limit,
        project_limit = excluded.project_limit;

  raise notice 'Sinir kaldirildi: %', posta;
end $$;

commit;

-- Kontrol
select u.email, p.entry_limit as kayit_siniri, p.project_limit as proje_siniri
  from public.user_prefs p
  join auth.users u on u.id = p.user_id;
