-- =====================================================================
-- FIKIR PARCALARI VE SIRA
-- =====================================================================
-- Iki fikir ust uste birakilinca BIRLESIYOR. Metinleri birlestirip
-- parcalari atsaydik, "ayir" islemi nereden bolecegini bilemez, tahmin
-- yurutmek zorunda kalirdi. Bu yuzden parcalar ayri ayri duruyor;
-- ayirma, birlesmeden ONCEKI hale donuyor — benzerine degil.
--
-- sort_index: kullanicinin surukleyerek verdigi duzen. Kesirli sayi,
-- cunku iki kartin arasina birakinca yalnizca TEK satirin degismesi
-- gerekiyor; tamsayi olsaydi her surukleme butun listeyi yeniden
-- numaralandirirdi.
--
-- ONCE sql/16-fikir-script-tablolari.sql calistirilmali.
--
-- ONEMLI SIRA: yeni surum tarayicida acilmadan ONCE calistirilmali.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- Tekrar calistirilabilir.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.ideas') is null then
    raise exception 'Once sql/16-fikir-script-tablolari.sql calistirilmali.';
  end if;
end $$;

alter table public.ideas
  add column if not exists parts      jsonb            not null default '[]'::jsonb,
  -- double precision: kesirli sira degerleri icin.
  add column if not exists sort_index double precision not null default 0;

-- Var olan fikirlerin tek parcasi kendi metni. Bos parca listesi olan
-- satirlar dolduruluyor; dolu olanlara dokunulmuyor.
update public.ideas
   set parts = jsonb_build_array(jsonb_build_object('id', id, 'text', text))
 where jsonb_array_length(coalesce(parts, '[]'::jsonb)) = 0
   and coalesce(btrim(text), '') <> '';

commit;

-- Kontrol
select count(*) as fikir_sayisi,
       count(*) filter (where jsonb_array_length(parts) > 1) as birlesik_olan,
       count(*) filter (where jsonb_array_length(parts) = 0) as parcasiz_kalan
  from public.ideas where deleted_at is null;
