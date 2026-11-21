alter table public.plan_features drop constraint if exists plan_features_feature_key_check;
alter table public.plan_features add constraint plan_features_feature_key_check
  check (feature_key in ('drive_script','cekim_setleri','fikir_onceligi',
                         'set_kisisellestirme'));
insert into public.plan_features (plan_key, feature_key, enabled) values
  ('starter',     'set_kisisellestirme', false),
  ('creator_pro', 'set_kisisellestirme', true),
  ('studio',      'set_kisisellestirme', true),
  ('founding',    'set_kisisellestirme', true)
on conflict (plan_key, feature_key) do nothing;
select plan_key, enabled from public.plan_features
  where feature_key = 'set_kisisellestirme' order by plan_key;

-- ═══════════════════════════════════════════════════════════════════
-- YUKARIDAKİ BLOK ÇALIŞTIRILACAK OLAN. Aşağısı yalnızca açıklama.
-- ═══════════════════════════════════════════════════════════════════
--
-- 78 — SET KİŞİSELLEŞTİRME KAPISI (YAPILACAKLAR 54)
--
-- NEDEN
--   Kullanıcının isteği (17 Kasım 2026): hazır setleri kendine göre
--   düzenleyebilme, bir seti çekim türüne atayabilme ve KENDİ çekim
--   türünü ekleyebilme. "Bu Creator Pro planda yer alacak bir özellik
--   olacak."
--
-- ⛔ TEK ANAHTAR, ÜÇ İŞ. 54a (kendi setini düzenle), 54b (sete tür
--   ata) ve 54c (kendi türünü ekle) tek bir yetenek sayılıyor:
--   kullanıcı 21 Kasım 2026'da "üçü de Creator Pro olsun" dedi.
--   Ayrı anahtarlar açmak matrisi üç satır şişirir ve üçü birbirinden
--   ayrı açılıp kapanacak şeyler değil.
--
-- ⛔ BU KAPI BUGÜN ÇALIŞAN BİR ŞEYİ GERİ ALIYOR — BİLEREK.
--   54a bugün HERKESTE açık. Kullanıcıya bunun bedeli söylendi
--   (YAPILACAKLAR 28'in uyarısı: "bugün herkese açık olan bir
--   özelliği kapatmak MEVCUT kullanıcıları etkiler") ve kararını
--   böyle verdi. Bu satır bir gözden kaçma değil.
--   ⚠ SETLER KULLANILMAYA DEVAM EDER, yalnızca DÜZENLENEMEZ.
--     Hiçbir set silinmiyor; kapı yalnızca düzenleme denetimlerini
--     gizliyor (67'deki "veri durur, yalnızca görünmez" kuralı).
--
-- ⛔ SQL/76'YI YENİDEN KOŞTURMA — BU DOSYANIN İŞİNİ GERİ ALIR.
--   `sql/76` `plan_features`'ın `feature_key` kısıtını kuruyor ve
--   orada `set_kisisellestirme` YOK. 76'yı yeniden koşturman
--   gerekirse ARDINDAN bu dosyayı da koş. (CLAUDE.md Bölüm 6.)
--
-- ⚠ KODDAKİ LİSTEYLE BİRLİKTE DEĞİŞİR. `app.html` içindeki
--   `OZELLIK_VARSAYILAN` tablosuna da aynı anahtar yazılıyor;
--   `testler/plan-kapisi.test.js` ikisinin ayrışmadığını ölçüyor.
--
-- BEKLENEN SONUÇ
--   Dört satırlık bir tablo:
--     creator_pro true · founding true · starter false · studio true
