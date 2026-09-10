-- 21 — Gelen kutusunu yalnızca KENDİ hesabında aç
--
-- Sorun: gelen/kayitlar.json tek ve ortak bir dosya. Uygulama onu giriş
-- yapmış HER kullanıcı için okuyup kayıtları o kişinin takvimine yazıyordu;
-- yani bir deneme kullanıcısı hesabını açtığında bizim içerik planımız onun
-- takvimine düşüyordu.
--
-- Çözüm: kutu artık yalnızca hesabın tercihlerinde gelen_kutusu bayrağı
-- olanlarda çalışıyor. Bayrak veritabanında duruyor; app.html'e hiçbir
-- e-posta ya da kullanıcı kimliği gömülmüyor.
--
-- Nasıl kullanılır: aşağıdaki "posta" satırındaki adresi kendi adresinle
-- değiştir (zaten doğruysa dokunma), SQL Editor'de çalıştır. Tekrar
-- çalıştırılabilir.
--
-- Kapatmak için, en alttaki yorumlu satıra bak.

begin;

do $$
declare
  kim uuid;
  posta text := 'bostancioglum@gmail.com';
begin
  select id into kim from auth.users where lower(email) = lower(posta);
  if kim is null then
    raise exception 'Bu e-postayla kayitli kullanici yok: %. Once uygulamadan giris yap.', posta;
  end if;

  -- prefs'in tamami degil, yalnizca bu anahtar yaziliyor: dil, hatirlatma
  -- ayarlari ve alinanlar defteri yerinde kalsin.
  insert into public.user_prefs (user_id, prefs)
  values (kim, '{"gelen_kutusu": true}'::jsonb)
  on conflict (user_id) do update
    set prefs = coalesce(public.user_prefs.prefs, '{}'::jsonb)
                || '{"gelen_kutusu": true}'::jsonb;

  raise notice 'Gelen kutusu acildi: %', posta;
end $$;

commit;

-- Kontrol: yalnizca senin satirinda true gorunmeli.
select u.email, coalesce(p.prefs -> 'gelen_kutusu', 'false'::jsonb) as gelen_kutusu
  from public.user_prefs p
  join auth.users u on u.id = p.user_id
 order by 2 desc, 1;

-- Kapatmak icin (adresi degistirerek calistir):
--   update public.user_prefs p
--      set prefs = p.prefs - 'gelen_kutusu'
--     from auth.users u
--    where u.id = p.user_id and lower(u.email) = lower('bostancioglum@gmail.com');
