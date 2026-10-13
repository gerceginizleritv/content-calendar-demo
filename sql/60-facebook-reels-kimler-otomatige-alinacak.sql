-- ══════════════════════════════════════════════════════════════════
-- 60 — FACEBOOK REELS: KİMLER OTOMATİĞE ALINACAK  ⚠ SALT OKUNUR
-- ══════════════════════════════════════════════════════════════════
-- Bu dosya HİÇBİR ŞEYİ DEĞİŞTİRMEZ. Yalnızca select var.
-- Değiştiren dosya sql/61; o, bu sorgu onaylanmadan yazılmayacak.
-- Sütun adları post_date / post_time (date / time DEĞİL).
--
-- NEDEN VAR
-- 13 Ekim 2026: Meta uygulaması Live olduktan sonra Facebook reels
-- de hikâyeler de görüntülenme almaya başladı (reels çalıştı,
-- hikâyeler 39 ve 14). Deney bitti, Facebook reels otomatiğe geri
-- alınıyor. Ama kullanıcı belirli bir tarihe kadar reels'leri ELLE
-- yükledi; onları tekrar yayınlamak çift gönderi demek olurdu.
--
-- AYIRIMI `uploaded` YAPIYOR. O kullanıcının kendi işareti
-- ("portala yükledim"); ⛔ Şartname Bölüm 1 gereği hiçbir kod oraya
-- YAZMAZ -- ama okumak serbest ve ayrımı tam olarak o veriyor.
-- Sistemin kendi durumu publish_state, ikisi karıştırılmasın.
--
-- BEŞ ŞART (hepsini geçmeyen kayda dokunulmuyor)
--   1. uploaded işaretli DEĞİL   -> elle yüklenmiş olanı atlıyoruz
--   2. publish_state = pending   -> yayınlanmışı tekrar yayınlamıyoruz
--   3. publish_at GELECEKTE      -> ⛔ geçmiş tarihli yayın yok
--   4. media_url dolu            -> dosyasız kayıt yayınlanamaz
--   5. deleted_at boş            -> silinmiş kayda dokunulmaz
-- ══════════════════════════════════════════════════════════════════

select
  post_date                                as gun,
  post_time                                as saat,
  title                                    as baslik,
  uploaded                                 as elle_yukledim,
  auto_publish                             as otomatik_simdi,
  publish_state                            as durum,
  case
    when uploaded is true                    then 'DOKUNMA - elle yukledin'
    when publish_state = 'published'         then 'DOKUNMA - zaten yayinlandi'
    when publish_state <> 'pending'          then 'DOKUNMA - durumu pending degil'
    when publish_at is null                  then 'DOKUNMA - saati yok'
    when publish_at <= now()                 then 'DOKUNMA - vakti gecmis'
    when media_url is null or media_url = '' then 'DOKUNMA - dosyasi yok'
    when auto_publish is true                then 'zaten acik'
    else                                          'ACILACAK'
  end                                      as karar
from public.calendar_events
where platform = 'facebook'
  and type = 'reels'
  and deleted_at is null
  and post_date >= current_date - 30
order by post_date, post_time;
