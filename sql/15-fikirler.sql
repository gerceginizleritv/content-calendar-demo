-- =====================================================================
-- FIKIRLER — SCRIPT'IN ONCESI
-- =====================================================================
-- Zincirin basi: once dagilmis fikirler, sonra script. Ikisi ayni satirda
-- duruyor (project_scripts), cunku ikisi de "bu projenin metni".
--
-- Ama zaman damgalari AYRI. Sebep: telefondan bir fikir eklerken,
-- masaustunde yazilan scriptin geri alinmamasi gerekiyor. Tek damga
-- olsaydi son yazan otekini siler, kullanici da bunu ancak scripti
-- aradiginda fark ederdi.
--
-- ONCE sql/14-scriptler.sql calistirilmali.
--
-- ONEMLI SIRA: bu betik, yeni surum tarayicida acilmadan ONCE
-- calistirilmali. Sutunlar yokken uygulama fikirleri buluta yazamaz —
-- veri kaybolmaz (yerelde durur, kuyrukta bekler) ama senkron durur.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- Tekrar calistirilabilir.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.project_scripts') is null then
    raise exception 'Once sql/14-scriptler.sql calistirilmali.';
  end if;
end $$;

alter table public.project_scripts
  -- Fikir listesi jsonb: her fikir {id, text, ts}. Ayri tablo olsaydi
  -- bir fikri silmek/siralamak icin satir yonetimi gerekirdi; liste
  -- bir butun olarak anlamli, parcali sorgulanmiyor.
  add column if not exists ideas            jsonb       not null default '[]'::jsonb,
  add column if not exists ideas_updated_at timestamptz not null default to_timestamp(0);

commit;

-- Kontrol
select count(*) as icerik_satiri,
       count(*) filter (where jsonb_array_length(ideas) > 0) as fikri_olan,
       count(*) filter (where content <> '') as scripti_olan
  from public.project_scripts;
