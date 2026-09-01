-- =====================================================================
-- PROJESI OLMAYAN KAYITLAR KIM?
-- =====================================================================
-- Sadece OKUR, hicbir sey degistirmez. Guvenle calistirabilirsin.
--
-- 11 kaydin projesi yok. Bu tek basina hata degil: bir kaydin projesi
-- olmak zorunda degil. Bu betik o 11'i dort gruba ayirip hangisinin ne
-- oldugunu soyluyor.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- =====================================================================

-- Projesi olmayan kayitlar kim? Dort ihtimal var, hangisi oldugunu soyler.
select
  case
    when e.deleted_at is not null then '0) Silinmis kayit (mezar tasi) — zaten gorunmuyor'
    when e.location_id is null    then '1) Dogrudan Slate kaydi — lokasyon bagi hic yoktu'
    when l.id is null             then '2) Bagli oldugu lokasyon veritabaninda YOK'
    when l.deleted_at is not null then '3) Bagli oldugu lokasyon SILINMIS'
    else                               '4) Beklenmedik — bana soyle'
  end as durum,
  count(*) as adet
from public.calendar_events e
left join public.locations l on l.id = e.location_id
where e.project_id is null
group by 1
order by 2 desc;

-- Bunlarin ne oldugunu gormek icin (silinmisler haric)
select e.post_date, e.platform, left(coalesce(e.title,''), 60) as baslik, e.location_id
from public.calendar_events e
where e.project_id is null and e.deleted_at is null
order by e.post_date
limit 20;
