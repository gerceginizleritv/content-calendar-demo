-- 52 — YouTube bağlantısı: jetonlar sunucuda kalır
--
-- ══════════════════════════════════════════════════════════════════
-- sql/51 (TikTok) İLE AYNI DESEN, İKİ FARKLA
-- ══════════════════════════════════════════════════════════════════
-- Tablo yapısı ve RLS kararı birebir aynı: jeton tarayıcıya hiç
-- gitmiyor, tabloyu yalnızca service_role görüyor. Ayrıntılı gerekçe
-- sql/51'in başında; burada tekrar edilmiyor ki ikisi ayrışmasın.
--
-- İki fark var:
--
--  1. GOOGLE ERİŞİM JETONU BİR SAAT YAŞIYOR (TikTok'ta 24 saat).
--     Yani yenileme TikTok'takinden çok daha sık çalışacak; worker her
--     yüklemede süreyi kontrol ediyor.
--
--  2. YENİLEME JETONUNUN SÜRESİ YOK -- AMA BİR ŞARTLA.
--     OAuth izin ekranı "Testing" durumundayken Google yenileme
--     jetonlarını YEDİ GÜNDE iptal ediyor. 29 Eylül 2026'da izin ekranı
--     "In production" durumuna alındı ve kısıt kalktı. Bir gün biri
--     projeyi Testing'e geri alırsa bu hat sessizce ölür: yükleme
--     yedinci günden sonra `invalid_grant` ile döner. Bu yüzden
--     `son_hata` sütunu var ve worker oraya yazıyor.

begin;

create table if not exists public.youtube_hesaplari (
  user_id          uuid primary key references auth.users(id) on delete cascade,

  -- Kanal kimliği ve adı. Ekranda "şu kanala bağlı" diyebilmek için.
  kanal_id         text not null default '',
  kanal_adi        text not null default '',

  erisim_jetonu    text not null,
  erisim_bitis     timestamptz not null,
  -- ⚠ Google yenileme jetonunu YALNIZCA İLK yetkilendirmede veriyor
  -- (`access_type=offline&prompt=consent` ile her seferinde verdiriyoruz,
  -- ama yine de: bu alan boşalırsa kullanıcı yeniden bağlanmak zorunda).
  yenileme_jetonu  text not null,

  kapsamlar        text[] not null default '{}',

  baglanma_zamani  timestamptz not null default now(),
  guncelleme       timestamptz not null default now(),

  son_hata         text,
  son_hata_zamani  timestamptz
);

alter table public.youtube_hesaplari enable row level security;

-- ⚠ BİLEREK İLKE YOK. sql/51'deki gerekçenin aynısı: burada erişim
-- jetonu duruyor, "kendi satırını okusun" demek "tarayıcıya jeton
-- verelim" demek.
revoke all on public.youtube_hesaplari from anon, authenticated;
grant all  on public.youtube_hesaplari to service_role;


create or replace function public.youtube_durum()
returns table(bagli boolean, kanal_adi text, baglanma_zamani timestamptz,
              son_hata text, son_hata_zamani timestamptz)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select true, y.kanal_adi, y.baglanma_zamani, y.son_hata, y.son_hata_zamani
    from public.youtube_hesaplari y
   where y.user_id = auth.uid()
  union all
  select false, '', null::timestamptz, null::text, null::timestamptz
   where not exists (select 1 from public.youtube_hesaplari y2
                      where y2.user_id = auth.uid());
$$;

revoke all   on function public.youtube_durum() from public, anon;
grant execute on function public.youtube_durum() to authenticated;


create or replace function public.youtube_kes()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  kim uuid := auth.uid();
begin
  if kim is null then
    raise exception 'Oturum yok.';
  end if;
  delete from public.youtube_hesaplari where user_id = kim;
end $$;

revoke all   on function public.youtube_kes() from public, anon;
grant execute on function public.youtube_kes() to authenticated;

commit;


-- ══════════════════════════════════════════════════════════════════
-- HESAP SİLME
-- ══════════════════════════════════════════════════════════════════
-- sql/32'deki `hesabimi_sil` tablo adı yazmıyor, `user_id` sütunu olan
-- her tabloyu geziyor -- bu tablo kendiliğinden kapsamda.
-- app.html'deki YEDEK liste (HESAP_TABLOLARI) elle yazılmış; oraya
-- eklenmesi gerekiyor ve testler/hesap-sil.test.js eksikse düşüyor.


-- ══════════════════════════════════════════════════════════════════
-- KONTROL (çalıştırdıktan sonra)
-- ══════════════════════════════════════════════════════════════════
-- 1) Tablo ve RLS:
--      select relname, relrowsecurity from pg_class
--       where relname = 'youtube_hesaplari';        -- beklenen: t
--
-- 2) İlke YOK olmalı:
--      select count(*) from pg_policies
--       where tablename = 'youtube_hesaplari';      -- beklenen: 0
--
-- 3) Durum işlevi oturumsuz da "false" demeli:
--      select * from public.youtube_durum();        -- beklenen: bagli = f
