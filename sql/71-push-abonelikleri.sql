-- ═══════════════════════════════════════════════════════════════════
-- 71 — PUSH ABONELİKLERİ (15 Kasım 2026)
-- ═══════════════════════════════════════════════════════════════════
--
-- NE EKLİYOR
--   Tek yeni tablo: public.push_abonelikleri.
--   Tarayıcının ürettiği push aboneliğini (endpoint + iki anahtar)
--   kullanıcı başına saklıyor. Gönderen Edge Function bu satırları
--   okuyup bildirimi oraya yolluyor.
--
-- NEYİ GERİ ALMIYOR
--   Hiçbir şeyi. Yalnızca EKLİYOR: var olan tablolara, görünümlere ya
--   da fonksiyonlara dokunmuyor. Tekrar çalıştırılması güvenli
--   ("if not exists" ve "drop policy if exists" ile yazıldı).
--
-- NEDEN AYRI TABLO, NEDEN user_prefs'in içinde değil
--   Bir kullanıcının BİRDEN ÇOK tarayıcısı olur: iş bilgisayarı, ev
--   bilgisayarı, telefon. Her biri ayrı bir abonelik. user_prefs'te
--   kullanıcı başına tek satır var; abonelikleri oraya koymak onları
--   bir diziye tıkardı ve bir cihazın aboneliği bozulduğunda hepsini
--   birden yazmak gerekirdi.
--
-- ⚠ SİLME NEDEN "AKTIF=false" DEĞİL, GERÇEK SİLME
--   Push abonelikleri kendiliğinden ölür: kullanıcı izni geri alır,
--   tarayıcı verisini temizler, cihaz değişir. Gönderimde 404 ya da
--   410 dönen abonelik ÖLMÜŞTÜR ve bir daha dirilmez. Mezar taşı
--   tutmanın bir faydası yok; satır siliniyor. (Projelerdeki
--   deleted_at mantığı burada geçerli değil: orada kullanıcının
--   verisi var, burada yalnızca bir teslimat adresi.)
--
-- ⚠ ENDPOINT TEKİL, kullanıcı başına değil GENEL
--   Aynı tarayıcı farklı bir hesapla giriş yaparsa aynı endpoint'i
--   üretir. Tekillik endpoint üzerinde: ikinci hesap satırı devralır,
--   böylece bildirim YANLIŞ hesaba gitmez.
--
-- SONRA NE GEREKİYOR (bu dosya tek başına yetmez)
--   1. VAPID anahtar çifti üretilip Supabase sırlarına yazılacak
--   2. supabase/functions/push-gonder dağıtılacak
--   3. Zamanlanmış görev (cron) kurulacak
--   Adımları: supabase/functions/push-gonder/README.md
--
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.push_abonelikleri (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Tarayıcının verdiği teslimat adresi. Tekil: aynı tarayıcı iki
  -- hesapta iki satır üretmesin, sonuncusu devralsın.
  endpoint    text not null unique,
  -- Şifreleme anahtarları. Gönderen bunlarla gövdeyi şifreliyor;
  -- onlarsız bildirim gönderilemez.
  p256dh      text not null,
  auth        text not null,
  -- Hangi cihaz olduğunu kullanıcıya gösterebilmek için. Kimlik değil,
  -- yalnızca "Chrome — Windows" gibi bir etiket.
  cihaz       text,
  -- Kullanıcının IANA saat dilimi (örn. Europe/Istanbul). Hatırlatma
  -- saati YEREL saat; sunucu bunu bilmeden ne zaman göndereceğini
  -- hesaplayamaz.
  saat_dilimi text,
  olusturuldu timestamptz not null default now(),
  son_gorulme timestamptz not null default now(),
  -- Aynı gün aynı bildirimi iki kez göndermemek için. Gönderen
  -- buraya "2026-11-16" yazıyor ve o gün bir daha göndermiyor.
  son_gonderim_gunu text
);

create index if not exists push_abonelikleri_user_idx
  on public.push_abonelikleri (user_id);

alter table public.push_abonelikleri enable row level security;

-- ─────────────────────────────────────────────────────────────────
-- POLİTİKALAR — kullanıcı YALNIZCA kendi aboneliklerini görür/yazar.
-- Gönderen Edge Function service_role ile çalışıyor; service_role
-- RLS'i atlar, o yüzden ona ayrı politika YAZILMIYOR.
-- ⚠ with_check olmadan insert açık kalır: USING sorgu tarafı,
--   WITH CHECK yazma tarafıdır. İkisi de gerekli.
-- ─────────────────────────────────────────────────────────────────

drop policy if exists push_abonelikleri_sec on public.push_abonelikleri;
create policy push_abonelikleri_sec
  on public.push_abonelikleri for select
  using (user_id = auth.uid());

drop policy if exists push_abonelikleri_ekle on public.push_abonelikleri;
create policy push_abonelikleri_ekle
  on public.push_abonelikleri for insert
  with check (user_id = auth.uid());

drop policy if exists push_abonelikleri_guncelle on public.push_abonelikleri;
create policy push_abonelikleri_guncelle
  on public.push_abonelikleri for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_abonelikleri_sil on public.push_abonelikleri;
create policy push_abonelikleri_sil
  on public.push_abonelikleri for delete
  using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- GENEL AYARLAR — VAPID AÇIK ANAHTARI BURADA DURUYOR
-- ═══════════════════════════════════════════════════════════════════
--
-- NEDEN BİR TABLO, NEDEN app.html'e GÖMÜLMÜYOR
--   Tarayıcının push aboneliği açması için VAPID **açık** anahtarına
--   ihtiyacı var. Üç yol vardı:
--     1. app.html'e gömmek    -> kullanıcı dosyayı elle düzenlemeli
--     2. Edge Function'dan okumak -> ⛔ OLMUYOR: panelden kurulan
--        fonksiyonun adresindeki kısa ad RASTGELE üretiliyor, yani
--        app.html o adresi önceden bilemez. Bu tuzak bu depoda iki
--        kez 404'e yol açtı (sql/20'nin başı, hosgeldin README).
--     3. Veritabanından okumak -> seçilen yol. İstemci fonksiyonun
--        adresinden tamamen bağımsız kalıyor.
--
-- ⛔ BURAYA GİZLİ BİR ŞEY YAZILMAZ. Tablo HERKESE AÇIK okunuyor.
--   VAPID **özel** anahtarı buraya değil, Supabase gizli ayarlarına
--   (Edge Functions -> Secrets) yazılır. Açık anahtar gizli değildir:
--   zaten her tarayıcıya gidiyor.

create table if not exists public.genel_ayarlar (
  anahtar text primary key,
  deger   text not null,
  not_    text,
  guncellendi timestamptz not null default now()
);

alter table public.genel_ayarlar enable row level security;

-- Okuma herkese açık (giriş yapmamış ziyaretçi dahil): abonelik
-- açabilmek için anahtara ihtiyaç var.
drop policy if exists genel_ayarlar_oku on public.genel_ayarlar;
create policy genel_ayarlar_oku
  on public.genel_ayarlar for select
  using (true);

-- ⛔ YAZMA POLİTİKASI YOK. Yani hiçbir kullanıcı yazamaz; satır
--   yalnızca panelden (service_role) konulur. Politika yokken RLS
--   açık bir tabloya yazılamaz -- kapıyı kapalı tutan şey bu.

-- ─────────────────────────────────────────────────────────────────
-- VAPID AÇIK ANAHTARINI BURAYA YAZ
-- ─────────────────────────────────────────────────────────────────
-- Aşağıdaki satırı AYRI bir sorgu olarak çalıştır. <ACIK-ANAHTAR>
-- yerine araclar/vapid-uret.html sayfasının verdiği **açık** anahtarı
-- koy (yaklaşık 87 karakter, 'B' ile başlar).
--
-- ⚠ ÖZEL anahtarı buraya YAZMA. O yalnızca Supabase gizli ayarlarına
--   girer. Bu tablo herkese açık okunuyor.
--
--   insert into public.genel_ayarlar (anahtar, deger, not_)
--   values ('vapid_acik', '<ACIK-ANAHTAR>',
--           'Push aboneligi icin. Gizli DEGIL, tarayiciya gidiyor.')
--   on conflict (anahtar) do update
--     set deger = excluded.deger, guncellendi = now();

-- ─────────────────────────────────────────────────────────────────
-- DOĞRULAMA — bu dosyayı çalıştırdıktan sonra şunu çalıştır.
-- ─────────────────────────────────────────────────────────────────
-- Dört satır dönmeli:
--   tablo: push_abonelikleri   -> 1
--   RLS acik                   -> true
--   politika sayisi            -> 4
--   tablo: genel_ayarlar       -> 1
--
-- select 'tablo: push_abonelikleri' as kontrol,
--        count(*)::text as sonuc
--   from information_schema.tables
--  where table_schema = 'public' and table_name = 'push_abonelikleri'
-- union all
-- select 'RLS acik',
--        (select relrowsecurity::text from pg_class
--          where relname = 'push_abonelikleri')
-- union all
-- select 'politika sayisi',
--        (select count(*)::text from pg_policies
--          where tablename = 'push_abonelikleri')
-- union all
-- select 'tablo: genel_ayarlar',
--        count(*)::text
--   from information_schema.tables
--  where table_schema = 'public' and table_name = 'genel_ayarlar';
