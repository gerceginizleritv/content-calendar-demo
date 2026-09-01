-- =====================================================================
-- TASIMAYI GERI AL
-- =====================================================================
-- sql/08 calistirildiktan sonra bir sey ters giderse bu betik kayitlari
-- yedek tablosundan geri yaziyor.
--
-- Yalnizca 08'in dokundugu sutunlar geri aliniyor: tur, hesap ve
-- ustdegerler. Sonradan yapilan duzenlemeler (baslik, tarih, saat,
-- icerik) korunuyor — aksi halde geri alma, aradaki calismayi da
-- silerdi.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.calendar_events_yedek') is null then
    raise exception 'Yedek tablosu yok: sql/08 hic calistirilmamis, geri alinacak bir sey de yok.';
  end if;
end $$;

update public.calendar_events e
   set type              = y.type,
       platform          = y.platform,
       type_override     = y.type_override,
       platform_override = y.platform_override
  from public.calendar_events_yedek y
 where y.id = e.id;

commit;

-- Kontrol: eski dagilim geri geldi mi?
select platform as hesap, coalesce(nullif(type,''),'(bos)') as tur, count(*)
  from public.calendar_events
 group by 1,2 order by 3 desc;

-- Yedek tablosu BILEREK silinmiyor. Silmek istersen, geri donus
-- ihtimalinin kalmadigina emin olduktan sonra:
--   drop table public.calendar_events_yedek;
