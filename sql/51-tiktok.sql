-- 51 — TikTok bağlantısı: jetonlar sunucuda kalır
--
-- ══════════════════════════════════════════════════════════════════
-- NE YAPIYORUZ, NE YAPMIYORUZ
-- ══════════════════════════════════════════════════════════════════
-- Kullanıcı TikTok hesabını bağlıyor; Shootboard yayın saatinde videoyu
-- o kişinin TikTok GELEN KUTUSUNA TASLAK olarak bırakıyor. Yayınlayan
-- yine kullanıcı: TikTok uygulamasında taslağı açıp paylaşıyor.
--
-- Doğrudan yayın (`video.publish`) BİLEREK istenmedi: TikTok o izni
-- denetimden geçmiş uygulamalara veriyor, denetimsiz istemcinin
-- gönderileri "yalnız ben" görünürlüğüne kilitleniyor. Taslak yolu
-- (`video.upload`) bu kısıttan muaf.
--
-- ══════════════════════════════════════════════════════════════════
-- ⛔ JETONLAR TARAYICIYA HİÇ GİTMİYOR
-- ══════════════════════════════════════════════════════════════════
-- Bu tabloda erişim ve yenileme jetonu duruyor. Bir kullanıcı kendi
-- satırını bile OKUYAMIYOR: RLS açık ve `authenticated` rolü için
-- HİÇBİR select ilkesi yok. Tabloyu yalnızca `service_role` görüyor --
-- yani Edge Function'lar.
--
-- Uygulamanın bilmesi gereken tek şey "bağlı mı, hangi hesap": onu
-- aşağıdaki `tiktok_durum()` veriyor ve jetonları döndürmüyor.
--
-- Alternatif Supabase Vault'tu. Vault bir SIR deposu; burada saklanan
-- şey kullanıcı başına değişen ve 24 saatte bir yenilenen bir jeton.
-- Vault'ta kullanıcı başına satır açmak, süre dolumunu ve yenilemeyi
-- Vault içinde yönetmek demekti. Tablo + sıkı RLS daha az hareketli
-- parça bırakıyor. KARAR BİLİNÇLİ: jetonun düz metin durduğu yer
-- veritabanı, ve oraya yalnızca service_role erişiyor.

begin;

create table if not exists public.tiktok_hesaplari (
  -- Kişi başına TEK hesap. Birden çok TikTok hesabı bağlamak ileride
  -- gerekirse birincil anahtar (user_id, open_id) olur; bugün ihtiyaç
  -- yok ve tek satır, "hangisine yükleyecektik" sorusunu doğurmuyor.
  user_id          uuid primary key references auth.users(id) on delete cascade,

  -- TikTok'un kişi için verdiği kimlik. Jeton yenilenince değişmiyor.
  open_id          text not null,
  -- Ekranda "@filanca olarak bağlı" diyebilmek için. Boş kalabilir.
  kullanici_adi    text not null default '',

  erisim_jetonu    text not null,
  erisim_bitis     timestamptz not null,
  yenileme_jetonu  text not null,
  yenileme_bitis   timestamptz,

  -- Hangi izinlerle bağlandı. İleride `video.publish` eklenirse
  -- worker'ın yeniden yetkilendirme istemesi buradan anlaşılıyor.
  kapsamlar        text[] not null default '{}',

  baglanma_zamani  timestamptz not null default now(),
  guncelleme       timestamptz not null default now(),

  -- Son yükleme denemesinin izi. Sessiz başarısızlık yasak (Bölüm 9):
  -- taslak düşmediyse bunun bir yerde yazması lazım.
  son_hata         text,
  son_hata_zamani  timestamptz
);

alter table public.tiktok_hesaplari enable row level security;

-- ⚠ BİLEREK İLKE YOK.
-- RLS açık ve hiçbir ilke tanımlı değil: `anon` ve `authenticated`
-- rolleri bu tabloda hiçbir satır göremiyor, yazamıyor. service_role
-- RLS'i atladığı için Edge Function'lar çalışmaya devam ediyor.
-- Bir ilke eklemek isteyen önce şunu okusun: burada erişim jetonu var,
-- ve "kendi satırını okuyabilsin" demek "tarayıcıya jeton verelim"
-- demek.
revoke all on public.tiktok_hesaplari from anon, authenticated;
grant all  on public.tiktok_hesaplari to service_role;


-- ══════════════════════════════════════════════════════════════════
-- Uygulamanın gördüğü tek şey
-- ══════════════════════════════════════════════════════════════════
create or replace function public.tiktok_durum()
returns table(bagli boolean, kullanici_adi text, baglanma_zamani timestamptz,
              son_hata text, son_hata_zamani timestamptz)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select true, t.kullanici_adi, t.baglanma_zamani, t.son_hata, t.son_hata_zamani
    from public.tiktok_hesaplari t
   where t.user_id = auth.uid()
  union all
  -- Satır yoksa "bagli = false" dönüyor: uygulama boş sonuç ile
  -- "bagli degil" arasında ayrım yapmak zorunda kalmıyor.
  select false, '', null::timestamptz, null::text, null::timestamptz
   where not exists (select 1 from public.tiktok_hesaplari t2
                      where t2.user_id = auth.uid());
$$;

revoke all   on function public.tiktok_durum() from public, anon;
grant execute on function public.tiktok_durum() to authenticated;


-- ══════════════════════════════════════════════════════════════════
-- Bağlantıyı kesmek
-- ══════════════════════════════════════════════════════════════════
-- Satırı silmek TikTok tarafındaki yetkiyi geri almıyor; kullanıcı onu
-- TikTok uygulamasından da kaldırabilir. Ama bizim elimizdeki jeton
-- gidiyor ve worker o kişi için bir daha yükleme yapmıyor.
create or replace function public.tiktok_kes()
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
  delete from public.tiktok_hesaplari where user_id = kim;
end $$;

revoke all   on function public.tiktok_kes() from public, anon;
grant execute on function public.tiktok_kes() to authenticated;

commit;


-- ══════════════════════════════════════════════════════════════════
-- HESAP SİLME
-- ══════════════════════════════════════════════════════════════════
-- sql/32'deki `hesabimi_sil` tablo adı yazmıyor: `user_id` sütunu olan
-- her tabloyu geziyor. Bu tablonun birincil anahtarı `user_id` olduğu
-- için kapsama kendiliğinden giriyor, o işlevi güncellemek gerekmiyor.
--
-- Ama app.html'deki YEDEK yol (HESAP_TABLOLARI) elle yazılmış bir
-- liste ve oraya eklenmesi gerekiyor. Dün tam bu yüzden api_keys ve
-- accounts atlanmıştı. testler/hesap-sil.test.js bu iki yeri
-- karşılaştırıyor; liste eksikse test düşer.


-- ══════════════════════════════════════════════════════════════════
-- KONTROL (çalıştırdıktan sonra)
-- ══════════════════════════════════════════════════════════════════
-- 1) Tablo var mı ve RLS açık mı:
--      select relname, relrowsecurity from pg_class
--       where relname = 'tiktok_hesaplari';
--    beklenen: t
--
-- 2) İlke YOK olmalı (jeton tarayıcıya gitmesin):
--      select count(*) from pg_policies
--       where tablename = 'tiktok_hesaplari';
--    beklenen: 0
--
-- 3) Durum işlevi oturumsuz da patlamamalı, "false" demeli:
--      select * from public.tiktok_durum();
--    beklenen: bagli = f
