-- ══════════════════════════════════════════════════════════════════
-- 65 — ANKETİN CEVABI 24 SAAT SONRA YANIT OLARAK GİDİYOR (16 Ekim 2026)
-- ══════════════════════════════════════════════════════════════════
-- NEDEN
-- Kullanıcının kanalının iddiası "rivayet değil, kayıt". Soruyu sorup
-- cevabı vermemek o iddianın tersi. Anket çıktıktan 24 saat sonra
-- cevap, anketin ALTINA yanıt olarak düşüyor -- hiç oy gelmese de.
-- Kullanıcının kendi sözleri: "o cevap 24 saat sonra threads altına
-- hiç bir cevap gelmediyse bile gitmeli".
--
-- NE YAPIYOR
--   · `threads_yanitlari` tablosu: hangi kaydın cevabı, hangi
--     gönderinin altına, hangi metin, hangi saatte.
--   · `threads_yanit_kuyruga_al()`: yayınlanmış ve cevabı yazılı olan
--     anketler için EKSİK satırları yaratıyor.
--   · `threads_yanit_al(n)`: vakti gelenleri ATOMİK olarak alıyor.
--   · `threads_yanit_iz`, `threads_yanit_bitti`, `threads_yanit_hata`:
--     çöküş izi ve sonuç.
--
-- ⚠ KUYRUĞA YAZAN YER WORKER DEĞİL, BU İŞLEV. Worker yayın anında
-- satır yazsaydı, (a) bu dosyadan ÖNCE yayınlanmış anketlerin cevabı
-- hiç gitmezdi, (b) cevabı sonradan yazılan bir ankette de gitmezdi.
-- İşlev her turda eksikleri tamamlıyor; `unique (kayit_id)` ikinci
-- satırı engelliyor.
--
-- ⛔ CEVAP AYRI BİR TAKVİM KAYDI DEĞİL. Kaydın kendi içinde duruyor
-- (`content.anketCevap`) ve anketin tiki açıksa cevap da gidiyor: TEK
-- TİK, İKİ GÖNDERİ. Ayrı kayıt olsaydı kullanıcı her anket için ikinci
-- bir kaydın tikini de açmak zorunda kalırdı ve biri açılmazsa cevap
-- sessizce düşerdi.
--
-- ⛔ ANKET YAYINLANMADIYSA CEVAP GİTMEZ. Koşul `publish_state =
-- 'published'` ve `external_id` dolu: yanıt yazılacak bir gönderi
-- olmadan yanıt yazılamaz.
--
-- GECİKME — 24 SAAT, VE BU SAYI ÖLÇÜLDÜ
-- Varsayılan 24 saat, `content.anketCevapGecikme` ile kayıt başına
-- değiştirilebiliyor (1-168 saat). Kullanıcı 16 Ekim 2026'da "anket
-- Shootboard'dan gideceği için 24 saat sonra olması ok" dedi: anket
-- makul bir saatte çıkıyor, cevap da makul bir saate düşüyor.
--
-- ⚠ ANKETİN SÜRESİ META'NIN BELGESİNDE YAZMIYOR. Belgede yalnızca
-- `expiration_timestamp` diye bir alan var; "24 saat" diyen bir satır
-- aranıp BULUNAMADI. Sayı uydurulmadı, ÖLÇÜLDÜ: 16 Ekim 2026'da ilk
-- anket çıktıktan sonra kullanıcı canlı gönderide anketin altında
-- geri sayan bir sayaç gördü ve yayın anından itibaren 24 saat
-- sayıyordu. Yani varsayılan gecikme, anketin KAPANDIĞI ana denk
-- geliyor: cevap, oylama biterken geliyor.
--
-- Bu, Bölüm 4'ün (doğrula, varsayma) olumlu hali: powerline fiyatları
-- uydurulduğu için yanlış çıkmıştı, "hikâyeler etkilenmiyor" sayısı
-- doğrulanmadığı için sekiz gün arızayı görünmez yapmıştı. Buradaki
-- 24 bir ölçüm.
--
-- ⚠ ÇİFT YANIT, ÇİFT GÖNDERİDEN FARKSIZ -- profilde kalıcı durur.
-- Üç katman: (1) `unique (kayit_id)`, (2) durum alanı + atomik alma
-- (for update skip locked), (3) `cagri_ani` çöküş izi: worker çağrıyı
-- yapmadan önce damgayı basıyor, sonraki tur "bu yanıt çıkmış mı" diye
-- gönderinin yanıtlarına bakıyor. 16 Ekim 2026'da ana yayın yolunda
-- bu izin KESİN CEVAP VERMEMESİ yüzünden bir kayıt sonsuza kadar
-- kilitlenmişti; burada kesin cevap var, çünkü kendi gönderimizin
-- yanıtlarını listeleyebiliyoruz.
-- ══════════════════════════════════════════════════════════════════

begin;

create table if not exists public.threads_yanitlari (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,

  -- Cevabı hangi kayıt doğurdu. ⚠ TEK SATIR: aynı kayıt için ikinci
  -- bir yanıt satırı açılamıyor.
  kayit_id         text not null,
  unique (kayit_id),

  -- Altına yazılacak gönderi (anketin kendisi) = calendar_events.external_id
  ana_gonderi_id   text not null,
  metin            text not null,

  gonderilecek_an  timestamptz not null,

  durum            text not null default 'pending'
                   check (durum in ('pending', 'in_progress', 'published', 'failed')),
  deneme           integer not null default 0,
  -- Geçici hatada bir sonraki denemeyi geciktirmek için.
  tekrar_sonra     timestamptz,

  -- ÇÖKÜŞ İZİ. Yayın çağrısı yapıldı mı? Doluysa sonucu bilinmiyor
  -- ve worker gönderinin yanıtlarına bakıp karar veriyor.
  cagri_ani        timestamptz,
  -- Çıkan yanıtın kendi kimliği.
  gonderi_id       text,

  son_hata         text,
  son_hata_zamani  timestamptz,
  olusma           timestamptz not null default now(),
  guncelleme       timestamptz not null default now()
);

create index if not exists threads_yanitlari_sira
  on public.threads_yanitlari (gonderilecek_an)
  where durum = 'pending';

alter table public.threads_yanitlari enable row level security;

-- ⚠ BİLEREK İLKE YOK -- sql/63'teki gerekçenin aynısı. RLS açık,
-- hiçbir ilke tanımlı değil: anon ve authenticated hiçbir satır
-- göremiyor. service_role RLS'i atlıyor, Edge Function çalışıyor.
-- Burada jeton yok ama gönderi kimlikleri var ve bu tablo yalnızca
-- sistemin iç kuyruğu; tarayıcıya açmanın hiçbir faydası yok.
revoke all on public.threads_yanitlari from anon, authenticated;
grant all  on public.threads_yanitlari to service_role;

commit;


-- ═══ KUYRUĞA ALMA ═════════════════════════════════════════════════
begin;

create or replace function public.threads_yanit_kuyruga_al()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into public.threads_yanitlari
    (user_id, kayit_id, ana_gonderi_id, metin, gonderilecek_an)
  select e.user_id,
         e.id,
         e.external_id,
         btrim(e.content->>'anketCevap'),
         coalesce(e.published_at, now())
           + make_interval(hours => least(greatest(
               coalesce((e.content->>'anketCevapGecikme')::numeric, 24)::integer, 1), 168))
    from public.calendar_events e
   where e.type = 'poll'
     and e.platform = 'threads'
     and e.deleted_at is null
     and e.publish_state = 'published'
     and e.external_id is not null
     and btrim(coalesce(e.content->>'anketCevap', '')) <> ''
     -- ⚠ ESKİ ANKETLERİ DİRİLTMEME. Bu dosya çalıştığında geçmişte
     -- kalmış bir anketin cevabı artık anlamsız; 7 günden eski
     -- yayınlar kuyruğa alınmıyor. Aksi halde bu dosyanın
     -- çalıştırıldığı an haftalar öncesinin cevapları bir arada
     -- giderdi.
     and coalesce(e.published_at, now()) > now() - interval '7 days'
  on conflict (kayit_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ⚠ GECİKME SAYISI OLMAYAN BİR METİN OLABİLİR ('yarın' gibi).
-- `::numeric` böyle bir değerde hata verir ve BÜTÜN turu düşürürdü.
-- Bu yüzden alan sayıya çevrilemiyorsa 24 varsayılıyor: aşağıdaki
-- işlev kuyruğa almayı tek tek, hatayı yutarak yapmıyor -- girdiyi
-- MCP ve arayüz sayı olarak süzüyor. Yine de veritabanı tarafında
-- güvenli olmak için tip dönüşümü korumalı yazıldı.
create or replace function public.threads_yanit_al(p_limit integer default 3)
returns table(
  id uuid, user_id uuid, kayit_id text, ana_gonderi_id text,
  metin text, cagri_ani timestamptz, deneme integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with sira as (
    select y.id
      from public.threads_yanitlari y
     where y.durum = 'pending'
       and y.gonderilecek_an <= now()
       and (y.tekrar_sonra is null or y.tekrar_sonra <= now())
       and y.deneme < 3
     order by y.gonderilecek_an
     limit greatest(coalesce(p_limit, 3), 1)
     -- ⚠ ATOMİK ALMA. Zamanlayıcı dakikada bir koşuyor ve bir tur 60
     -- saniyeyi aşabiliyor: iki tur üst üste binerse aynı yanıtı iki
     -- kez göndermemenin yolu bu satır.
     for update skip locked
  )
  update public.threads_yanitlari y
     set durum = 'in_progress',
         deneme = y.deneme + 1,
         guncelleme = now()
   where y.id in (select sira.id from sira)
  returning y.id, y.user_id, y.kayit_id, y.ana_gonderi_id,
            y.metin, y.cagri_ani, y.deneme;
end $$;

-- Yayın çağrısından HEMEN ÖNCE damga. Kapsayıcı yaratmak yayınlamıyor,
-- o yüzden oradaki bir çöküş çift yanıt üretemez.
create or replace function public.threads_yanit_iz(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.threads_yanitlari
     set cagri_ani = now(), guncelleme = now()
   where id = p_id
  returning true;
$$;

create or replace function public.threads_yanit_bitti(p_id uuid, p_gonderi_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.threads_yanitlari
     set durum = 'published',
         gonderi_id = coalesce(gonderi_id, p_gonderi_id),
         son_hata = null, son_hata_zamani = null,
         guncelleme = now()
   where id = p_id
  returning true;
$$;

-- p_kalici: kendiliğinden düzelmeyecek hata (metin boş, gönderi
-- silinmiş). Geçici hatada satır 'pending'e dönüyor ve üçüncü denemede
-- 'failed' oluyor -- ana kuyruktaki davranışın aynısı.
create or replace function public.threads_yanit_hata(
  p_id uuid, p_hata text, p_kalici boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare d integer;
begin
  select deneme into d from public.threads_yanitlari where id = p_id;
  update public.threads_yanitlari
     set durum = case when p_kalici or coalesce(d, 0) >= 3 then 'failed' else 'pending' end,
         -- Geçici hatada yarım saat bekle: Meta'yı dövmek yok.
         tekrar_sonra = case when p_kalici then null else now() + interval '30 minutes' end,
         -- ⚠ ÇÖKÜŞ İZİ SİLİNİYOR. Hata SINIFLANDIRILMIŞ demektir: ya
         -- çağrı hiç yapılmadı ya da cevabı biliniyor. İz kalsaydı
         -- sonraki tur "sonucu bilinmiyor" dalına girip beklerdi.
         cagri_ani = null,
         son_hata = left(coalesce(p_hata, ''), 2000),
         son_hata_zamani = now(),
         guncelleme = now()
   where id = p_id;
  return true;
end $$;

-- ERTELEME: deneme hakkını GERİ VERİYOR. Tur bütçesi dolduğu ya da
-- jeton bulunamadığı için bekleyen bir yanıt, denemesini harcamamalı --
-- yoksa üç tur bütçe sıkıntısı yanıtı 'failed' yapardı. story_ertele
-- ile birebir aynı gerekçe (sql/47).
--
-- ⚠ ÇÖKÜŞ İZİNE (cagri_ani) DOKUNMUYOR: erteleme "sonucu bilmiyorum"
-- demek olabilir ve o izi silmek, çıkmış bir yanıtı ikinci kez
-- göndermek demektir.
create or replace function public.threads_yanit_ertele(
  p_id uuid, p_dakika integer default 5, p_sebep text default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.threads_yanitlari
     set durum = 'pending',
         deneme = greatest(deneme - 1, 0),
         tekrar_sonra = now() + make_interval(mins => greatest(coalesce(p_dakika, 5), 0)),
         son_hata = left(coalesce(p_sebep, ''), 2000),
         son_hata_zamani = now(),
         guncelleme = now()
   where id = p_id
  returning true;
$$;

-- Çöküş sonrası: 'in_progress'te asılı kalmış satırları geri al.
-- story_asili_topla'nın eşi; worker öldürülürse satır kilitli kalırdı.
create or replace function public.threads_yanit_asili_topla(p_dakika integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.threads_yanitlari
     set durum = 'pending', guncelleme = now()
   where durum = 'in_progress'
     and guncelleme < now() - make_interval(mins => greatest(coalesce(p_dakika, 10), 1));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.threads_yanit_kuyruga_al()                from public, anon, authenticated;
revoke all on function public.threads_yanit_al(integer)                 from public, anon, authenticated;
revoke all on function public.threads_yanit_iz(uuid)                    from public, anon, authenticated;
revoke all on function public.threads_yanit_bitti(uuid, text)           from public, anon, authenticated;
revoke all on function public.threads_yanit_hata(uuid, text, boolean)   from public, anon, authenticated;
revoke all on function public.threads_yanit_ertele(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.threads_yanit_asili_topla(integer)        from public, anon, authenticated;

grant execute on function public.threads_yanit_kuyruga_al()              to service_role;
grant execute on function public.threads_yanit_al(integer)               to service_role;
grant execute on function public.threads_yanit_iz(uuid)                  to service_role;
grant execute on function public.threads_yanit_bitti(uuid, text)         to service_role;
grant execute on function public.threads_yanit_hata(uuid, text, boolean) to service_role;
grant execute on function public.threads_yanit_ertele(uuid, integer, text) to service_role;
grant execute on function public.threads_yanit_asili_topla(integer)      to service_role;

commit;


-- ══ DOĞRULAMA — ayrı çalıştır ══════════════════════════════════════
-- Beklenen: üçü de OK.
select 'tablo'    as ne, case when exists (select 1 from information_schema.tables
         where table_schema = 'public' and table_name = 'threads_yanitlari')
       then 'OK' else 'YOK' end as durum
union all
select 'islevler', case when (select count(*) from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'threads_yanit%') = 7
       then 'OK' else 'YOK' end
union all
select 'ilke yok (jeton/kuyruk tarayıcıya kapalı)',
       case when not exists (select 1 from pg_policies
         where schemaname = 'public' and tablename = 'threads_yanitlari')
       then 'OK' else 'YOK' end;
