-- 27 — Mekanlara fotoğraf; eski lokasyonlardaki fotoğrafları geri getir
--
-- Neden: eski lokasyon uygulamasında her yerin bir fotoğrafı vardı ve
-- liste ondan tanınıyordu. sql/11 lokasyonları projelere çevirirken
-- fotoğrafı taşımadı — projede öyle bir alan yok. Fotoğraflar hâlâ eski
-- locations tablosunda duruyor.
--
-- Bu betik mekanlara image_url sütunu ekliyor ve eski fotoğrafları
-- yerlerine koyuyor. Bağ şu zincirden kuruluyor:
--   locations.id = projects.id  (sql/11 kimliği aynen korumuştu)
--   projects.place_id = places.id  (sql/26 bağlamıştı)
--
-- Fotoğrafı olmayan mekan boş görünmüyor: uygulama harita bağlantısından
-- bir harita karesi çiziyor, o da yoksa adın baş harflerini koyuyor.
--
-- ÖNCE sql/24 ve sql/26 çalıştırılmış olmalı.
-- Tekrar çalıştırılabilir: dolu bir fotoğrafın üstüne yazmıyor.
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.

alter table public.places
  add column if not exists image_url text not null default '';

-- Eski tablo duruyorsa fotoğrafları geri koy. Tablo ya da sütun yoksa
-- betik hata vermeden geçiyor: yeni kurulumlarda locations diye bir şey
-- olmayabilir.
do $$
begin
  if to_regclass('public.locations') is null then
    raise notice 'locations tablosu yok, fotograf aktarimi atlandi.';
    return;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'locations'
                    and column_name = 'image_url') then
    raise notice 'locations.image_url sutunu yok, aktarim atlandi.';
    return;
  end if;

  update public.places m
     set image_url = left(k.image_url, 600),
         updated_at = now()
    from (
      -- Bir mekana birden çok proje bağlı olabilir; fotoğrafı olan ilk
      -- lokasyon yeter.
      select distinct on (p.place_id) p.place_id, l.image_url
        from public.projects p
        join public.locations l on l.id = p.id
       where p.place_id is not null
         and coalesce(l.image_url, '') <> ''
       order by p.place_id, p.created_at
    ) k
   where m.id = k.place_id
     and coalesce(m.image_url, '') = '';

  raise notice 'Fotograf aktarimi bitti.';
end $$;

-- Kontrol: kaç mekanın fotoğrafı var?
select count(*) filter (where coalesce(image_url, '') <> '') as fotografli,
       count(*)                                             as toplam
  from public.places;
