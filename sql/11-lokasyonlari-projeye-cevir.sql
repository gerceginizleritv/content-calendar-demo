-- =====================================================================
-- LOKASYONLARI SLATE PROJELERINE CEVIR
-- =====================================================================
-- Lokasyon uygulamasindaki her lokasyon, Slate'te bir proje. Ikisi ayni
-- sey: cekimin konusu, uretim adimlari ve adresi olan kayit.
--
-- Kimlik AYNEN korunuyor (loc_...): hem betik tekrar calistirilabilir
-- oluyor, hem de yayin kayitlarinin lokasyon bagi dogrudan proje bagina
-- donusuyor.
--
-- ONCE sql/10-proje-saha-alanlari.sql calistirilmali.
-- Tekrar calistirilabilir: var olan proje GUNCELLENMIYOR, atlaniyor —
-- boylece Slate'te sonradan yaptigin duzenlemeler ezilmiyor.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.locations') is null then
    raise exception 'locations tablosu yok.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='projects' and column_name='shot_list') then
    raise exception 'Once sql/10-proje-saha-alanlari.sql calistirilmali.';
  end if;
end $$;

-- Projenin sahibi kim?
-- Lokasyon tablosunda kullanici sutunu YOK: kayitlar calisma alanina
-- bagli. Sahibi calisma alanindan okuyoruz. Cozulemeyen tek bir lokasyon
-- olsa bile is duruyor — sahipsiz proje yazmaktansa durup haber vermek.
do $$
declare
  sahipsiz bigint;
begin
  select count(*) into sahipsiz
    from public.locations l
    left join public.workspaces w on w.id = l.workspace_id
   where l.deleted_at is null
     and w.owner_id is null;
  if sahipsiz > 0 then
    raise exception '% lokasyonun calisma alani/sahibi cozulemedi. Once bunu konusalim.', sahipsiz;
  end if;
end $$;

-- 1) Lokasyonlar -> projeler
insert into public.projects
  (id, user_id, workspace_id, name, keywords, notes, address, type, start_date,
   steps, deadlines,
   topic, district, city, format, permission,
   script_url, drive_url, maps_url, field_notes, cautions, shot_list)
select
  l.id,
  w.owner_id,
  l.workspace_id,
  coalesce(l.name, ''),
  '',
  -- Iptal bilgisi Slate'te karsiligi olmayan tek alan; notun basina
  -- yaziliyor ki kaybolmasin.
  trim(both E'\n' from
    case when l.cancelled::text in ('true','t','E','1') then '[İPTAL]' || E'\n' else '' end
    || coalesce(l.notes, '')),
  coalesce(l.address, ''),
  -- Format -> Slate proje turu. Bilinmeyen format 'other'a dusuyor.
  case
    when l.format = 'Saha'      then 'outdoor'
    when l.format = 'Masabaşı'  then 'desk'
    when l.format = 'Hibrit'    then 'other'
    else 'other'
  end,
  l.planned_date,
  -- Adimlar: lokasyon uygulamasinda bes adim var, Slate'te yedi.
  -- Karsiligi olmayan ikisi (onay, paket) bos basliyor.
  -- Adim degerleri metne cevrilip karsilastiriliyor: sutun boolean da
  -- olsa ('true'), eski bicimde metin de olsa ('E') dogru okunuyor.
  -- Sema farkliliklari bu gecis boyunca birkac kez surpriz oldu.
  jsonb_build_object(
    'script',   (l.script::text    in ('true','t','E','1')),
    'filmed',   (l.filmed::text    in ('true','t','E','1')),
    'audio',    (l.audio::text     in ('true','t','E','1')),
    'edited',   (l.edited::text    in ('true','t','E','1')),
    'approved', false,
    'package',  false,
    'published',(l.published::text in ('true','t','E','1'))
  ),
  '{}'::jsonb,
  coalesce(l.topic, ''), coalesce(l.district, ''), coalesce(l.city, ''),
  coalesce(l.format, ''),
  -- "Izin gerekiyor mu?" bir evet/hayir. Hayir ise alan BOS kaliyor;
  -- bos alan arayuzde gorunmuyor, yani 43 lokasyonun 40'inda bu satir
  -- hic cikmiyor.
  case when l.permission::text in ('true','t','E','1') then 'İzin gerekiyor' else '' end,
  coalesce(l.script_url, ''), coalesce(l.drive_url, ''), coalesce(l.maps_url, ''),
  coalesce(l.field_notes, ''), coalesce(l.cautions, ''), coalesce(l.shot_list, '')
from public.locations l
join public.workspaces w on w.id = l.workspace_id
where l.deleted_at is null
on conflict (id) do nothing;   -- var olani EZME

-- 2) Yayin kayitlarini yeni projelere bagla.
-- Slate proje bagini content.projectId icinden okuyor; sutun ayrica
-- sorgu icin duruyor. Ikisi de yaziliyor.
update public.calendar_events e
   set project_id = e.location_id,
       content = coalesce(e.content, '{}'::jsonb)
                 || jsonb_build_object('projectId', p.id, 'concept', p.name)
  from public.projects p
 where p.id = e.location_id
   and e.location_id is not null
   and (e.project_id is distinct from e.location_id
        or coalesce(e.content->>'projectId','') is distinct from p.id
        or coalesce(e.content->>'concept','')   is distinct from p.name);

commit;

-- Kontrol
select count(*) as proje_sayisi from public.projects;
select count(*) as projeye_bagli_kayit from public.calendar_events where project_id is not null;
select count(*) as bagsiz_kayit from public.calendar_events where project_id is null;
