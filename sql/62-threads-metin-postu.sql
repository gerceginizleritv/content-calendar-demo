-- ══════════════════════════════════════════════════════════════════
-- 62 — THREADS GÖNDERİSİ KUYRUĞA GİRİYOR (16 Ekim 2026)
-- ══════════════════════════════════════════════════════════════════
-- NE YAPIYOR
-- `story_yayin_turleri()`'ne 'text_post' türünü ekliyor. Kuyruk
-- (`story_kuyruk_al`) türe göre süzüyor; bu dosya çalıştırılmadan
-- Threads kayıtları kuyruğa HİÇ girmez ve worker'daki Threads yolu
-- çalışmaz. İki kapıdan biri burası.
--
-- ⚠ İKİNCİ KAPIYI UNUTMA: kaydın `auto_publish` sütunu. Politika
-- tablosu `pc/story-yukle.py` → OTOMATIK_YAYIN. 12 Ekim 2026'da tam
-- bu atlandı: kaydın tiki açıldı, kuyruk şartı görülmedi, yayın
-- gitmeyecekti.
--
-- ⛔ YENİDEN KOŞTURMA — TUZAK KAPATILDI
-- `story_yayin_turleri()` sql/54'te de tanımlı. Bu dosya yazılırken
-- sql/54'teki diziye de 'text_post' eklendi; yani sql/54'ü yeniden
-- koşturmak artık bu dosyanın işini GERİ ALMIYOR. İki dosya aynı
-- kümeyi söylüyor.
--
-- Canlı veritabanına uygulayan dosya BURASI: sql/54 çalıştırıldığında
-- 'text_post' henüz yoktu.
--
-- ⚠ sql/56 ve sql/58 yalnızca `story_kuyruk_al`'ı yeniden yaratıyor,
-- bu işleve dokunmuyorlar -- onlar güvenli.
--
-- ⛔ `video` (uzun form) HÂLÂ YOK ve bu kasıtlı — sql/54'teki
-- gerekçe aynen geçerli: eklenirse Facebook'un `video` kayıtları da
-- kuyruğa girer ve worker onları `reels` saymadığı için STORY olarak
-- yayınlar.
--
-- GERİ ALMAK: aşağıdaki diziden 'text_post' kelimesini silip dosyayı
-- yeniden koştur. Kayıtların `auto_publish`'ine dokunmaya gerek yok;
-- kuyruk almayınca yayın durur.
-- ══════════════════════════════════════════════════════════════════

begin;

create or replace function public.story_yayin_turleri()
returns text[]
language sql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
  -- 'text_post' = Threads gönderisi (metin + istege bagli gorsel).
  -- Worker'da TURLER.text_post.platformlar = ['threads']; baska bir
  -- platforma dusen bir text_post kaydi orada ERTELENIYOR.
  select array['story', 'reels', 'shorts', 'text_post']::text[];
$$;

-- sql/57'deki yetki, işlev yeniden yaratılınca KAYBOLUYOR.
-- Kaldırılırsa uygulama kaydedemez: 42501 permission denied.
revoke all   on function public.story_yayin_turleri() from public, anon;
grant execute on function public.story_yayin_turleri() to service_role, authenticated;

commit;


-- ══ DOĞRULAMA — ayrı çalıştır ══════════════════════════════════════
-- Beklenen: tek satır, dört tür: story, reels, shorts, text_post
select unnest(public.story_yayin_turleri()) as tur;
