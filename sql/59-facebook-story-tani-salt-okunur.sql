-- ══════════════════════════════════════════════════════════════════
-- 59 — FACEBOOK HİKÂYESİ TEŞHİSİ  ⚠ SALT OKUNUR
-- ══════════════════════════════════════════════════════════════════
-- Sütun adları post_date / post_time (date / time DEĞİL -- 13 Ekim
-- 2026: ilk sürümde yanlış yazıldı, 42703 verdi).
--
-- Bu dosya HİÇBİR ŞEYİ DEĞİŞTİRMEZ. Yalnızca select var; update,
-- insert, delete, create, grant YOK. Hiçbir dosyanın işini geri
-- almaz, hiçbir dosya da bunun işini geri alamaz.
--
-- NEDEN VAR
-- 13 Ekim 2026: Meta uygulaması Live olduktan sonra Facebook reels
-- görüntülenme almaya başladı, ama Facebook HİKÂYELERİ hâlâ hiç
-- görüntülenme almıyor. Takvim her hikâye için 'published' diyor.
--
-- Yani iki ayrı ihtimali ayırmamız gerekiyor:
--   (A) Hikâye Facebook'a hiç ÇIKMADI, biz çıktı sanıyoruz.
--   (B) Hikâye çıktı ama kimse GÖRMEDİ (hikâyeler yalnızca takipçiye
--       gider; reels yabancılara da gider -- dağıtımı aynı değil).
--
-- (A)'nın izi burada: Facebook'un `video_stories` bitiş çağrısı
-- yalnızca `success: true` döndürebiliyor, post_id döndürmeden.
-- Kodumuz o durumda external_id'ye video_id'yi yazıyor
-- (story-yayin/index.ts: bit?.post_id ?? bit?.id ?? videoId).
-- Dolayısıyla external_id = publish_ref ise, Facebook bize bir
-- gönderi kimliği HİÇ vermemiş demektir -- ve yayın asenkron
-- olduğu için "success" hikâyenin yayına girdiğini kanıtlamıyor.
-- ══════════════════════════════════════════════════════════════════

-- ---- SORGU 1: Facebook hikâyeleri, son 10 gün ---------------------
-- Beklenen: her satırda publish_state = published.
-- BAKILACAK SÜTUN: gonderi_kimligi_var_mi
--   'yok (sadece video_id)' çıkıyorsa -> ihtimal (A) güçleniyor.
--   'var' çıkıyorsa        -> hikâye gerçekten yayınlandı, (B).
select
  post_date                           as gun,
  post_time                           as saat,
  title                               as baslik,
  publish_state                       as durum,
  case
    when external_id is null or external_id = '' then 'external_id BOŞ'
    when external_id = publish_ref then 'yok (sadece video_id)'
    else 'var'
  end                                 as gonderi_kimligi_var_mi,
  publish_called_at is not null        as yayin_cagrildi,
  last_error                          as hata
from public.calendar_events
where platform = 'facebook'
  and type = 'story'
    and post_date >= current_date - 10
order by post_date desc, post_time desc;

-- ---- SORGU 2: Aynı soru reels için (karşılaştırma) ----------------
-- Facebook reels görüntülenme ALDI. Onun external_id'si nasıl
-- duruyor? İkisi farklıysa fark kodda değil Facebook'un cevabında.
select
  post_date                           as gun,
  type                                as tur,
  publish_state                       as durum,
  case
    when external_id is null or external_id = '' then 'external_id BOŞ'
    when external_id = publish_ref then 'yok (sadece video_id)'
    else 'var'
  end                                 as gonderi_kimligi_var_mi
from public.calendar_events
where platform = 'facebook'
  and type in ('reels', 'story')
  and publish_state = 'published'
    and post_date >= current_date - 10
order by post_date desc, type;

-- ---- SORGU 3: Tek satırlık özet -----------------------------------
-- Hikâyelerin kaçında gerçek bir gönderi kimliği var?
select
  count(*)                                                as yayinlanan_hikaye,
  count(*) filter (where external_id = publish_ref)       as gonderi_kimligi_yok,
  count(*) filter (where external_id is distinct from publish_ref
                     and external_id <> '')               as gonderi_kimligi_var
from public.calendar_events
where platform = 'facebook'
  and type = 'story'
  and publish_state = 'published'
    and post_date >= current_date - 30;

-- ══════════════════════════════════════════════════════════════════
-- SONUÇ — 13 Ekim 2026 (sorgu canlıda çalıştırıldı)
-- ══════════════════════════════════════════════════════════════════
-- 3-13 Ekim arasındaki 29 kaydın HEPSİNDE gonderi_kimligi = 'var'.
-- Yani Facebook bitiş çağrısında gerçek bir gönderi kimliği döndürdü
-- ve hikâyeler gerçekten yayınlandı. İhtimal (A) ELENDİ: story yayın
-- yolunda reels'teki video_state hatasının bir benzeri YOK.
--
-- ⚠ AMA BU SORGU DAĞITIMI ÖLÇMÜYOR. Aynı tabloda 3 Ekim'in reels'i
-- de 'var' diyor -- o reel'in Erişim 1 aldığını ölçmüştük. Gönderi
-- kimliği olmak, içeriğin kimseye gösterildiği anlamına gelmiyor.
-- Dağıtım sorusu bu dosyadan cevaplanamaz, ölçümle cevaplanır.
--
-- Business Suite "Hikayeler" sekmesi 12 Ekim'de bitiyor (hem 28
-- günlük hem 7 günlük pencerede) -- yani Meta uygulamasının Live
-- olduğu günden sonrasını HENÜZ göstermiyor. Elde 0 olarak görünen
-- bütün veri, uygulamanın "In development" olduğu döneme ait.
-- ══════════════════════════════════════════════════════════════════
