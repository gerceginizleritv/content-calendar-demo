-- 29 — Hesap silme: yeni kovalardaki dosyalar da silinsin
--
-- sql/22 yazıldığında tek depolama kovası "takvim" vardı; işlev yalnızca
-- ondan siliyordu. O gün bugündür iki kova eklendi: "paylasim" (sql/25)
-- ve "yedek" (sql/28). Hesabını silen kişinin bütün işi otomatik
-- yedeklerin içinde duruyordu — sildiğini sanıp durmuyordu.
--
-- Bu betik işlevi yeniliyor: artık kova adına değil klasör adına bakıyor.
-- Bütün kovalarda klasör aynı: <kullanıcı kimliği>/... Yarın yeni bir
-- kova eklendiğinde bu işlev güncellenmeyi unutulsa bile dosyalar
-- geride kalmıyor.
--
-- sql/22'yi çalıştırdıysan bunu da çalıştır. Tekrar çalıştırılabilir.
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.

begin;

create or replace function public.hesabi_sil()
returns void
language plpgsql
security definer
-- search_path sabitleniyor: security definer bir islevde bu yazilmazsa
-- cagiran kisi kendi semasini one alip baska bir tabloyu sildirebilir.
set search_path = pg_catalog, public
as $$
declare
  kim uuid := auth.uid();
  t   text;
begin
  if kim is null then
    raise exception 'Oturum yok.';
  end if;

  -- Tablo tablo yazmak yerine user_id sutunu OLAN her tablo geziliyor:
  -- yarin yeni bir tablo eklendiginde bu islev guncellenmeyi unutulursa
  -- kullanicinin verisi geride kalmaz.
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tt
        on tt.table_schema = c.table_schema and tt.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name  = 'user_id'
       and tt.table_type  = 'BASE TABLE'
  loop
    execute format('delete from public.%I where user_id = $1', t) using kim;
  end loop;

  -- Depodaki dosyalar. Butun kovalarda kullanicinin klasoru ayni:
  -- <kullanici kimligi>/... — takvim aboneligi (sql/19), paylasim
  -- dosyasi (sql/25) ve otomatik yedekler (sql/28). Kova kova saymak
  -- yerine onek eslesmesi: yarin yeni bir kova eklendiginde bu islev
  -- guncellenmeyi unutulursa kullanicinin dosyalari geride kalmaz.
  if to_regclass('storage.objects') is not null then
    delete from storage.objects
     where name like kim::text || '/%';
  end if;

  -- En son hesabin kendisi.
  delete from auth.users where id = kim;
end $$;

-- Yalnizca giris yapmis kullanici cagirabiliyor.
revoke all on function public.hesabi_sil() from public;
revoke all on function public.hesabi_sil() from anon;
grant execute on function public.hesabi_sil() to authenticated;

commit;

-- Kontrol: islev yerinde mi?
select p.proname as islev,
       case when p.prosecdef then 'security definer' else 'security invoker' end as yetki
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'hesabi_sil';
