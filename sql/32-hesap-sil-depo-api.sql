-- 32 — Hesap silme: depodaki dosyalar artık SQL'den silinmiyor
--
-- SORUN. sql/22 (ve onu yenileyen sql/29) depodaki dosyaları doğrudan
-- storage.objects tablosundan siliyordu. Supabase buna artık izin
-- vermiyor; işlev şu hatayla düşüyor:
--
--   Direct deletion from storage tables is not allowed.
--   Use the Storage API instead.
--
-- İşlev tek parça olduğu için hata her şeyi geri alıyordu: kullanıcı
-- "Hesabımı sil" diyor, hiçbir şey silinmiyor. Şartlar sayfasında verilen
-- söz de tutulmuyordu.
--
-- ÇÖZÜM. İş ikiye bölündü:
--   1. Dosyaları uygulama siliyor — kullanıcının kendi oturumuyla,
--      Storage API üzerinden, bu işlev çağrılmadan ÖNCE.
--   2. Tabloları ve hesabın kendisini bu işlev siliyor.
--
-- Depo satırı geride kalırsa ne olur: dosyanın kendisi zaten uygulama
-- tarafından silinmiş oluyor. Sahipsiz bir kayıt satırı kalması veri
-- sızıntısı değil; hesabı silmeyi tamamen engellemekten iyidir.
--
-- sql/22 ya da sql/29'u çalıştırdıysan BUNU DA çalıştır — sonuncusu
-- geçerli. Tekrar çalıştırılabilir.
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

  -- DEPODAKI DOSYALAR BURADA SILINMIYOR. Supabase storage.objects
  -- uzerinde dogrudan silmeyi engelliyor ve tek bir hata butun islemi
  -- geri aliyordu. Dosyalari uygulama, Storage API ile, bu cagridan
  -- once siliyor.

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
