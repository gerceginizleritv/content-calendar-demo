-- ══════════════════════════════════════════════════════════════════
-- 63 — THREADS JETONU VERİTABANINDA (16 Ekim 2026)
-- ══════════════════════════════════════════════════════════════════
-- NEDEN
-- Threads jetonu ~60 günde ölüyor ve yenilenmesi gerekiyor. Yenilenen
-- jeton BİR YERE YAZILMALI; Edge Function kendi ortam değişkenine
-- yazamaz. O yüzden jeton `THREADS_TOKEN` gizli ayarından tabloya
-- taşınıyor -- TikTok ve YouTube'da zaten böyle (sql/51, sql/52).
--
-- ⚠ ORTAM DEĞİŞKENİ SİLİNMİYOR, ÇIKIŞ NOKTASI OLUYOR.
-- Tabloda satır yoksa worker `THREADS_TOKEN`'ı okuyup tabloya
-- TOHUMLUYOR. Böylece bugünkü kurulum bozulmadan tabloya geçiliyor.
-- Tohumlamadan sonra GERÇEK jeton tabloda; ortamdaki eskir ve artık
-- yalnızca "hiç bağlanmamışsa" dalında kullanılır.
--
-- ⛔ YENİLEME PENCERESİ KAÇIRILIRSA GERİ DÖNÜŞ YOK.
-- Jeton en erken 24 saatlik olunca yenilenebiliyor, en geç süresi
-- dolmadan. 60 gün yenilenmeden geçerse jeton KALICI olarak ölüyor ve
-- tek çare paneldeki üreticiden yenisini almak. Worker bu yüzden
-- süreye 10 gün kala yeniliyor, son güne bırakmıyor.
--
-- ⚠ GİZLİ PROFİLİN AYRI SAATİ VAR: Threads profili gizliyse izinler
-- 90 günde düşüyor, jetonun durumundan bağımsız. Hesap herkese açık
-- kalmalı (jeton üreticisi zaten gizli hesaba jeton vermiyor).
--
-- GERİ ALMAK: tabloyu silmek yeter; worker ortam değişkenine geri
-- düşer ve yenileme yapmaz (süresi dolana kadar çalışır).
-- ══════════════════════════════════════════════════════════════════

begin;

create table if not exists public.threads_hesaplari (
  -- Kişi başına TEK hesap. tiktok_hesaplari ile aynı gerekçe: birden
  -- çok hesap gerekirse birincil anahtar genişler, bugün ihtiyaç yok.
  user_id          uuid primary key references auth.users(id) on delete cascade,

  -- Ekranda "@filanca olarak bağlı" diyebilmek için. Boş kalabilir.
  kullanici_adi    text not null default '',

  erisim_jetonu    text not null,
  -- Threads'in kendi verdiği süre (~60 gün). Worker buna 10 gün kala
  -- yeniliyor.
  erisim_bitis     timestamptz not null,

  -- ⚠ AYRI YENİLEME JETONU YOK. Threads, erişim jetonunun KENDİSİYLE
  -- yeniliyor (grant_type=th_refresh_token). TikTok ve Google'da ayrı
  -- bir yenileme jetonu var; burada yok ve bu tabloda o sütunun
  -- olmaması KASITLI -- boş duran bir sütun "doldurmayı unuttuk"
  -- sanılırdı.

  baglanma_zamani  timestamptz not null default now(),
  guncelleme       timestamptz not null default now(),
  -- En son ne zaman yenilendi. Günde birden fazla denememek için.
  son_yenileme     timestamptz,

  -- Sessiz başarısızlık yasak (Bölüm 9): yenileme başarısız olursa
  -- sebebi burada yazıyor, yoksa yayın durduğunda kimse neden
  -- durduğunu bilemezdi.
  son_hata         text,
  son_hata_zamani  timestamptz
);

alter table public.threads_hesaplari enable row level security;

-- ⚠ BİLEREK İLKE YOK -- sql/51'deki gerekçenin aynısı.
-- RLS açık, hiçbir ilke tanımlı değil: `anon` ve `authenticated` bu
-- tabloda hiçbir satır göremiyor. service_role RLS'i atladığı için
-- Edge Function çalışmaya devam ediyor. Burada DÜZ METİN JETON var;
-- "kendi satırını okuyabilsin" demek "tarayıcıya jeton verelim"
-- demektir.
revoke all on public.threads_hesaplari from anon, authenticated;
grant all  on public.threads_hesaplari to service_role;

commit;


-- ══ DOĞRULAMA — ayrı çalıştır ══════════════════════════════════════
-- Beklenen: 0 satır (worker ilk yayında ortam değişkeninden
-- tohumlayacak). Jeton sütunu GÖSTERİLMİYOR, bilerek.
select user_id, kullanici_adi, erisim_bitis, son_yenileme, son_hata
from public.threads_hesaplari;
