-- ══════════════════════════════════════════════════════════════════
-- 64 — THREADS ANKETİ KUYRUĞA GİRİYOR (16 Ekim 2026)
-- ══════════════════════════════════════════════════════════════════
-- NE YAPIYOR
-- `story_yayin_turleri()`'ne 'poll' türünü ekliyor. Kuyruk
-- (`story_kuyruk_al`) türe göre süzüyor; bu dosya çalıştırılmadan
-- anket kayıtları kuyruğa HİÇ girmez ve worker'daki anket yolu
-- çalışmaz. İki kapıdan biri burası.
--
-- ⚠ İKİNCİ KAPI: kaydın `auto_publish` sütunu. Politika tablosu
-- `pc/story-yukle.py` → OTOMATIK_YAYIN, oraya ('threads','poll')
-- yazıldı. 12 Ekim 2026'da tam bu atlandı: kaydın tiki açıldı,
-- kuyruk şartı görülmedi, yayın gitmeyecekti.
--
-- ⛔ ANKETTE GÖRSEL YOK, YANİ YÜKLEYİCİ HİÇ ÇALIŞMIYOR.
-- Threads anketi yalnızca metin gönderisine takılabiliyor (Meta
-- belgesi). Görsel olmadığı için `pc/threads-izle.py` bu kayda hiç
-- dokunmuyor -- ve tiki açan mekanizma odur. Dolayısıyla anket
-- kayıtlarında `auto_publish`'i AÇAN BİR ŞEY YOK: ya planlama
-- sohbeti MCP'den açacak (shootboard_update_entry → autoPublish),
-- ya kullanıcı uygulamada tikleyecek. Bu bir eksiklik değil, anketin
-- doğası; ama bilinmezse "neden çıkmadı" diye aranır.
--
-- ⚠ DOSYASIZ KAYIT KUYRUĞA YAYIN SAATİNDE GİRİYOR (sql/56).
-- `media_url` boş olan kayıtlar `publish_at <= now()` olana kadar
-- kuyruğa alınmıyor. Anket için bu doğru davranış: beklenecek bir
-- yükleme yok, gönderi saatinde çıkıyor.
--
-- ⛔ YENİDEN KOŞTURMA — TUZAK KAPATILDI
-- `story_yayin_turleri()` sql/54 ve sql/62'de de tanımlı. Bu dosya
-- yazılırken sql/54'teki diziye de 'poll' eklendi; sql/62'ye
-- DOKUNULMADI, çünkü o dosya 'poll' olmadan yazılmıştı ve yeniden
-- koşturulursa bu dosyanın işini GERİ ALIR.
--
--     sql/54 yeniden koşturulabilir  (aynı kümeyi söylüyor)
--     sql/62 yeniden koşturulursa    (ANKET KAYBOLUR -> bu dosyayı
--                                     yeniden koştur)
--
-- Canlı veritabanına uygulayan dosya BURASI: sql/54 ve sql/62
-- çalıştırıldığında 'poll' henüz yoktu.
--
-- ⚠ sql/56 ve sql/58 yalnızca `story_kuyruk_al`'ı yeniden yaratıyor,
-- bu işleve dokunmuyorlar -- onlar güvenli.
--
-- ⛔ `video` (uzun form) HÂLÂ YOK ve bu kasıtlı — sql/54'teki gerekçe
-- aynen geçerli: eklenirse Facebook'un `video` kayıtları da kuyruğa
-- girer ve worker onları `reels` saymadığı için STORY olarak yayınlar.
--
-- ⛔ ANKET YALNIZCA THREADS. Tür veri modelinde 2 Eylül'den beri var
-- (eski Facebook anketlerinden kaldı) ama worker'da Facebook anket ucu
-- YOK: TURLER.poll.platformlar = ['threads']. Başka bir platforma
-- düşen bir `poll` kaydı orada erteleniyor, yayınlanmıyor.
--
-- GERİ ALMAK: aşağıdaki diziden 'poll' kelimesini silip dosyayı
-- yeniden koştur. Kayıtların `auto_publish`'ine dokunmaya gerek yok;
-- kuyruk almayınca yayın durur.
-- ══════════════════════════════════════════════════════════════════


-- ═══ KONTROL — ÖNCE BUNU KOŞTUR ═══════════════════════════════════
-- 'poll' kuyruğa girmeye başladığında aday olacak kayıtlar.
-- BEKLENEN: 0 satır, ya da yalnızca bilerek açtığın anket kayıtları.
-- Beklemediğin bir satır görüyorsan AŞAĞIYI KOŞTURMA, önce o kaydın
-- tikini kapat.
select post_date, post_time, platform, title,
       coalesce(media_name, '(dosyasız)') as dosya,
       publish_state
  from public.calendar_events
 where type = 'poll'
   and auto_publish = true
   and deleted_at is null
   and publish_state <> 'published'
 order by post_date, post_time;


-- ═══ DEĞİŞİKLİK ═══════════════════════════════════════════════════
begin;

create or replace function public.story_yayin_turleri()
returns text[]
language sql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
  -- 'text_post' = Threads gönderisi (metin + isteğe bağlı görsel).
  -- 'poll'      = Threads anketi (YALNIZCA metin + 2-4 seçenek).
  -- Worker'da ikisinin de platformlar = ['threads']; başka bir
  -- platforma düşen kayıt orada ERTELENİYOR.
  select array['story', 'reels', 'shorts', 'text_post', 'poll']::text[];
$$;

-- sql/57'deki yetki, işlev yeniden yaratılınca KAYBOLUYOR.
-- Kaldırılırsa uygulama kaydedemez: 42501 permission denied.
revoke all   on function public.story_yayin_turleri() from public, anon;
grant execute on function public.story_yayin_turleri() to service_role, authenticated;

commit;


-- ══ DOĞRULAMA — ayrı çalıştır ══════════════════════════════════════
-- Beklenen: beş satır — story, reels, shorts, text_post, poll
select unnest(public.story_yayin_turleri()) as tur;
