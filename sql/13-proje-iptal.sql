-- =====================================================================
-- PROJELERDE IPTAL BAYRAGI
-- =====================================================================
-- Iptal, silmenin yumusak hali: proje listede kaliyor ama en altta ve
-- soluk. Cekim iptal olunca haftalarca girilmis plani da silmek dogru
-- degil — "neden yapmadik" bilgisi degerli.
--
-- Ayrica lokasyon gocunun (sql/11) biraktigi izi temizliyor: o zaman
-- iptal bilgisinin gidecek bir yeri yoktu, notun basina "[İPTAL]" diye
-- yazilmisti. Artik bayrak var; on ek okunup siliniyor.
--
-- ONEMLI SIRA: bu betik, yeni surum tarayicida acilmadan ONCE
-- calistirilmali. Sutun yokken uygulama projeleri buluta yazamaz —
-- veri kaybolmaz (yerelde durur, kuyrukta bekler) ama senkron durur.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- Tekrar calistirilabilir.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.projects') is null then
    raise exception 'projects tablosu yok.';
  end if;
end $$;

alter table public.projects
  add column if not exists cancelled boolean not null default false;

-- Gocten kalan on eki bayraga cevir. Tekrar calistirmak zararsiz:
-- ikinci seferde eslesen satir kalmiyor.
update public.projects
   set cancelled = true,
       notes = regexp_replace(notes, '^\[İPTAL\]\s*', '')
 where notes ~ '^\[İPTAL\]';

commit;

-- Kontrol
select count(*) as iptal_edilen from public.projects where cancelled;
select count(*) as kalan_on_ek  from public.projects where notes ~ '^\[İPTAL\]';
