-- 74 — MEKÂN TÜRÜ (YAPILACAKLAR 51)
--
-- NEDEN
--   Kullanıcı 16 Kasım 2026'da ekran görüntüsüyle sordu:
--     "Masabaşı çekimde neden altta mekanlar çıkıyor? Çekim türüne göre
--      gelmesi gerekmiyor mu bu mekanların?"
--   Mekân kaydında tür alanı yoktu, bu yüzden "sadece stüdyo adresleri
--   gelsin" demek mümkün değildi. Bu betik o alanı açıyor.
--
-- ⚠ BU DOSYA HİÇBİR ŞEYİ GERİ ALMIYOR. Yalnızca bir sütun ekliyor;
--   var olan satırlara dokunmuyor, veri silmiyor.
--   Tekrar çalıştırılabilir: `if not exists` var.
--
-- ⚠ BETİK ÇALIŞMADAN ÖNCE DE UYGULAMA ÇALIŞIR. Sütun yoksa kaydetme
--   isteği `tur` alanını düşürüyor (`mekanTurSutunu` bayrağı,
--   sql/27 ve sql/33'teki kalıbın aynısı) — tür yalnızca tarayıcıda
--   kalır ve betik çalıştığı an ilk kayıtta sunucuya gider.
--
-- ⚠ TÜRÜ BOŞ OLAN MEKÂNLAR HER PROJEDE GÖRÜNÜR. Kullanıcının kararı
--   (19 Kasım 2026): bugünkü mekânların hiçbiri kaybolmasın.
--   Bu yüzden sütuna varsayılan değer YAZILMIYOR; boş kalması anlamlı.

alter table public.places
  add column if not exists tur text;

-- Geçerli değerler: dis · mekan · studyo · diger  (ve boş)
-- ⚠ Kısıt CHECK ile konuyor, enum ile değil: yeni bir tür eklemek
--   enum'da ayrı bir geçiş betiği gerektirir, CHECK'te tek satır.
alter table public.places
  drop constraint if exists places_tur_check;

alter table public.places
  add constraint places_tur_check
  check (tur is null or tur in ('dis', 'mekan', 'studyo', 'diger'));

-- Kontrol: sütun geldi mi?
--   Aşağıdaki satır 1 satır döndürmeli, `tur` ve `text` yazmalı.
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'places'
   and column_name  = 'tur';
