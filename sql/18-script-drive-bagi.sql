-- =====================================================================
-- SCRIPTIN GELDIGI DRIVE BELGESI
-- =====================================================================
-- Metin bir Google Docs belgesinden getirildiyse hangisinden geldigi
-- kaydediliyor. Iki ise yariyor:
--
--   1) "Drive'a yaz" penceresi belgenin uzerine yazmayi teklif
--      edebiliyor. Kimlik olmadan yalnizca yeni belge olusturulabilirdi.
--   2) drive_modified, belgeyi getirdigimiz andaki son degistirilme
--      zamani. Uzerine yazmadan once tekrar bakiliyor: degismisse
--      kullaniciya soruluyor. Bu olmadan, Docs'ta baskasinin (ya da
--      telefondan kendinin) yazdigi sessizce silinirdi.
--
-- ONCE sql/16-fikir-script-tablolari.sql calistirilmali.
--
-- ONEMLI SIRA: yeni surum tarayicida acilmadan ONCE calistirilmali.
-- Sutunlar yokken uygulama scriptleri buluta yazamaz — veri kaybolmaz
-- (yerelde durur, kuyrukta bekler) ama senkron durur.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- Tekrar calistirilabilir.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.scripts') is null then
    raise exception 'Once sql/16-fikir-script-tablolari.sql calistirilmali.';
  end if;
end $$;

alter table public.scripts
  add column if not exists drive_file_id   text,
  add column if not exists drive_file_name text,
  -- Metin olarak tutuluyor: Google'in verdigi damga aynen geri
  -- karsilastiriliyor. timestamptz'e cevirmek mikrosaniye yuvarlamasiyla
  -- "degismis" gibi gorunmesine yol acabilirdi.
  add column if not exists drive_modified  text;

commit;

-- Kontrol
select count(*) as script_sayisi,
       count(*) filter (where drive_file_id is not null) as drive_bagli
  from public.scripts where deleted_at is null;
