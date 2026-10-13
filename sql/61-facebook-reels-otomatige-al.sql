-- ══════════════════════════════════════════════════════════════════
-- 61 — FACEBOOK REELS KAYITLARINI OTOMATİĞE AL  ⚠ VERİ DEĞİŞTİRİR
-- ══════════════════════════════════════════════════════════════════
-- ⛔ BU DOSYANIN TAMAMINI BİR KEREDE ÇALIŞTIRMA.
-- Aşağıda iki ayrı blok var ve Supabase SQL Editor yalnızca SON
-- ifadenin sonucunu gösteriyor. Hepsini birden yapıştırırsan
-- "UPDATE 34" satırını GÖREMEZSİN -- yani değişikliğin kaç kaydı
-- etkilediğini doğrulayamazsın. Blokları tek tek çalıştır.
--
-- ÖNCESİ: sql/60 (salt okunur) aynı şartlarla listeledi, kullanıcı
-- 34 kaydı görüp onayladı (13 Ekim 2026). Kural gereği veri değiştiren
-- SQL iki adım: önce select, onaylanınca update.
--
-- NEDEN
-- Meta uygulaması Live yapıldıktan sonra Facebook reels görüntülenme
-- aldı; politika tablosunda facebook/reels açıldı (PR #20). Ama o
-- değişiklik BUNDAN SONRA girilecek kayıtlar için. Takvimde DURAN
-- kayıtların auto_publish sütunu hâlâ kapalı ve kendiliğinden
-- açılmıyor. Bu dosya onları açıyor.
--
-- ŞARTLAR -- beşini birden geçmeyen kayda DOKUNULMUYOR
--   1. uploaded işaretli DEĞİL   -> kullanıcı elle yükledi, çift
--                                   gönderi olurdu. ⛔ Şartname
--                                   Bölüm 1: koda bu sütuna YAZMAK
--                                   yasak; OKUMAK serbest ve ayrımı
--                                   tam olarak bu veriyor.
--   2. publish_state = 'pending' -> yayınlanmışı tekrar yayınlama
--   3. publish_at GELECEKTE      -> ⛔ geçmiş tarihli yayın yok
--   4. media_url dolu            -> dosyasız kayıt yayınlanamaz
--   5. deleted_at boş            -> silinmiş kayda dokunulmaz
-- Ayrıca auto_publish zaten açık olana dokunulmuyor (sayı şişmesin).
--
-- ⚠ İKİNCİ KAPIYI UNUTMA. Bu dosya yalnızca KAYDIN sütununu açıyor.
-- Kuyruğun kendi şartı ayrı bir kapı (story_kuyruk_al) ve onu sql/58
-- açtı. sql/56 yeniden koşturulursa o kapı kapanır ve buradaki
-- auto_publish = true HİÇBİR İŞE YARAMAZ. 12 Ekim 2026'da tam olarak
-- bu atlandı.
--
-- GERİ ALMAK: aynı where ile `set auto_publish = false`. Kayıtların
-- başka hiçbir sütununa dokunulmuyor, geri alınabilir.
-- ══════════════════════════════════════════════════════════════════


-- ══ BLOK 1 ══ DEĞİŞTİREN ADIM — tek başına çalıştır ═══════════════
-- Beklenen çıktı: UPDATE 34
-- Başka bir sayı gelirse DUR, yazma.

update public.calendar_events
   set auto_publish = true
 where platform = 'facebook'
   and type     = 'reels'
   and deleted_at is null
   and uploaded is not true
   and publish_state = 'pending'
   and publish_at is not null
   and publish_at > now()
   and media_url is not null
   and media_url <> ''
   and auto_publish is not true;


-- ══ BLOK 2 ══ DOĞRULAMA — ayrı çalıştır ═══════════════════════════
-- Beklenen: 34 satır, hepsinde otomatik = true, ilk gün 2026-10-20,
-- son gün 2026-11-23, hepsi 10:00.
--
-- ⚠ Supabase bir UPDATE için "Success. No rows returned" yazar; bu
-- bir BAŞARI mesajıdır, sıfır satır demek DEĞİLDİR. Etkilenen sayıyı
-- Blok 1'in kendi çıktısı söyler, bu blok da sonucu teyit eder.

select post_date as gun, post_time as saat, title as baslik,
       auto_publish as otomatik
from public.calendar_events
where platform = 'facebook'
  and type     = 'reels'
  and deleted_at is null
  and auto_publish = true
  and publish_state = 'pending'
  and publish_at > now()
order by post_date, post_time;
