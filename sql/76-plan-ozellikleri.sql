create table if not exists public.plan_features (
  plan_key    text not null references public.plans(key) on delete cascade,
  feature_key text not null,
  enabled     boolean not null default false,
  primary key (plan_key, feature_key)
);
alter table public.plan_features drop constraint if exists plan_features_feature_key_check;
alter table public.plan_features add constraint plan_features_feature_key_check
  check (feature_key in ('drive_script','cekim_setleri','fikir_onceligi'));
insert into public.plan_features (plan_key, feature_key, enabled) values
  ('starter',     'drive_script',    true),
  ('creator_pro', 'drive_script',    true),
  ('studio',      'drive_script',    true),
  ('founding',    'drive_script',    true),
  ('starter',     'cekim_setleri',   true),
  ('creator_pro', 'cekim_setleri',   true),
  ('studio',      'cekim_setleri',   true),
  ('founding',    'cekim_setleri',   true),
  ('starter',     'fikir_onceligi',  false),
  ('creator_pro', 'fikir_onceligi',  true),
  ('studio',      'fikir_onceligi',  true),
  ('founding',    'fikir_onceligi',  true)
on conflict (plan_key, feature_key) do nothing;
alter table public.plan_limits drop constraint if exists plan_limits_limit_key_check;
alter table public.plan_limits add constraint plan_limits_limit_key_check
  check (limit_key in ('projects','sets','scripts','ideas','kit_items','team_users',
                       'entries','places','accounts'));
insert into public.plan_limits (plan_key, limit_key, limit_value) values
  ('starter',     'entries',  100),
  ('creator_pro', 'entries',  100),
  ('studio',      'entries',  100),
  ('founding',    'entries',  100),
  ('starter',     'places',   400),
  ('creator_pro', 'places',   400),
  ('studio',      'places',   400),
  ('founding',    'places',   400),
  ('starter',     'accounts',  60),
  ('creator_pro', 'accounts',  60),
  ('studio',      'accounts',  60),
  ('founding',    'accounts',  60)
on conflict (plan_key, limit_key) do nothing;
select 'plan_features' as tablo, count(*) as satir from public.plan_features
union all
select 'plan_limits', count(*) from public.plan_limits;

-- ═══════════════════════════════════════════════════════════════════
-- YUKARIDAKİ BLOK ÇALIŞTIRILACAK OLAN. Aşağısı yalnızca açıklama.
-- ═══════════════════════════════════════════════════════════════════
--
-- ⚠ Bu düzen sql/74'ten geliyor: orada dosya açıklamayla başlıyordu,
--   kopyalarken baştaki `-- ` düştü ve Postgres ilk satırı komut sandı
--   ("syntax error at or near 74"). Çalıştırılacak parça artık her
--   dosyada en üstte ve yorumsuz duruyor.
--
-- 76 — PLAN × ÖZELLİK MATRİSİ (YAPILACAKLAR 67)
--
-- NEDEN
--   Kullanıcı 20 Kasım 2026'da istedi:
--     "Yönetim panelinde Creator Pro - Starter gibi hangi uygulamanın
--      hangi plana açık ya da kapalı olacağını her zaman
--      değiştirebileceğim bir panel de hazırlamanı istiyorum.
--      Mümkünse özellikler satırda, plan tipleri sütunda olsun."
--
-- ⛔ SQL/69'U YENİDEN KOŞTURMA — BU DOSYANIN İŞİNİ GERİ ALIR.
--   `sql/69` `plan_limits` tablosunu `limit_key` kısıtıyla birlikte
--   kuruyor ve o kısıtta ÜÇ YENİ ANAHTAR YOK (entries, places,
--   accounts). Tablo zaten varken `create table if not exists`
--   kısıtı değiştirmez, ama tablo silinip 69 baştan koşarsa eski
--   kısıt geri gelir ve buradaki üç satır bir daha yazılamaz.
--   ⚠ 69'u yeniden koşturman gerekirse ARDINDAN bu dosyayı da koş.
--
-- NE YAPIYOR
--   1. `plan_features` tablosu: plan × özellik → açık/kapalı.
--   2. Üç özelliği tohumluyor — kullanıcının 20 Kasım kararı:
--      yalnızca bu üçü plana bağlanabilir.
--        drive_script    Google Drive'a script gönderme
--        cekim_setleri   Çekim setleri sayfası
--        fikir_onceligi  Fikirlere öncelik (52. madde)
--   3. `plan_limits`'in kısıtına üç eksik anahtar ekliyor ve
--      satırlarını açıyor: entries, places, accounts.
--
-- ⚠ TOHUM DEĞERLERİ UYDURULMADI — BUGÜNKÜ DAVRANIŞIN AYNISI.
--   Sayılar `app.html`'de bugün gömülü duran değerlerden alındı:
--     entries  = 100  (VARSAYILAN_KAYIT_SINIRI)
--     places   = 400  (MEKAN_ADET)
--     accounts =  60  (HESAP_ADET)
--   ⛔ Bunlar bir fiyatlandırma kararı DEĞİL; bugünkü hâli korumak
--     için konuldu. Gerçek sayıları kullanıcı yönetim panelinden
--     verecek (67'nin 4. aşaması).
--
-- ⚠ `drive_script` ve `cekim_setleri` HER PLANDA AÇIK tohumlandı.
--   İkisi de bugün herkeste çalışıyor; kapalı tohumlamak onları
--   mevcut kullanıcılardan GERİ ALIRDI. Kapatmak kullanıcının
--   panelden vereceği bir karar (YAPILACAKLAR 28'in uyarısı).
--
-- ⚠ `fikir_onceligi` Starter'da KAPALI tohumlandı. Bugün de kapalı:
--   52. maddede kullanıcının kararıyla `prefs.pro` bayrağının
--   arkasında duruyor. Yani bu satır bir şeyi geri almıyor,
--   bugünkü hâli tabloya yazıyor.
--
-- ⚠ VARSAYILAN `false`. Kullanıcının 20 Kasım kararı: kodda yeni bir
--   özellik açıldığında matriste KAPALI başlasın.
--   ⛔ Bilinen riski: panelden açmak unutulursa özellik hiç kimsede
--     görünmez. Bekçi test bunu yakalayacak — kodda tanımlı olup
--     matriste satırı olmayan özelliği bildirecek (6. aşama).
--
-- ⚠ STUDIO VE FOUNDING SATIRLARI DA YAZILIYOR, ama panelde sütunları
--   görünmeyecek: kullanıcının kararı "yalnızca satıştaki planlar".
--   Sütunlar `plans.visible = true` olanlardan ÜRETİLECEK, elle
--   yazılmayacak; Studio satışa açıldığı gün sütun kendiliğinden
--   gelsin ve satırları hazır olsun diye burada tohumlanıyorlar.
--
-- ⚠ HİÇBİR ŞEYİ SİLMİYOR. `if not exists` ve `on conflict do nothing`
--   var; tekrar çalıştırılabilir, var olan satırları ezmez.
--   ⛔ Bu yüzden bir değeri DEĞİŞTİRMEK için bu dosyayı yeniden
--     koşturmak işe yaramaz — değişiklik panelden yapılacak.
--
-- BEKLENEN SONUÇ
--   Son satır iki satırlık bir tablo döndürür:
--     plan_features ile 12
--     plan_limits ile 33
--   ⚠ plan_limits sayısı daha büyük olabilir: 69'dan gelen 21 satır
--     artı buradaki 12 = 33. Daha önce elle satır eklendiyse artar.
