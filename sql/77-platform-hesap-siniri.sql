alter table public.plan_limits drop constraint if exists plan_limits_limit_key_check;
alter table public.plan_limits add constraint plan_limits_limit_key_check
  check (limit_key in ('projects','sets','scripts','ideas','kit_items','team_users',
                       'entries','places','accounts','accounts_per_platform'));
insert into public.plan_limits (plan_key, limit_key, limit_value) values
  ('starter',     'accounts_per_platform', 1),
  ('creator_pro', 'accounts_per_platform', 2),
  ('studio',      'accounts_per_platform', 2),
  ('founding',    'accounts_per_platform', 2)
on conflict (plan_key, limit_key) do nothing;
select plan_key, limit_value from public.plan_limits
  where limit_key = 'accounts_per_platform' order by plan_key;

-- ═══════════════════════════════════════════════════════════════════
-- YUKARIDAKİ BLOK ÇALIŞTIRILACAK OLAN. Aşağısı yalnızca açıklama.
-- ═══════════════════════════════════════════════════════════════════
--
-- 77 — PLATFORM BAŞINA HESAP SINIRI (YAPILACAKLAR 53)
--
-- NEDEN
--   Kullanıcının kararı (16 Kasım 2026): aynı platformda en fazla
--   iki hesap. Starter 1, Creator Pro 2.
--   20 Kasım 2026'da kullanıcı sayının **yönetim panelinden**
--   değiştirilebilmesini seçti, bu yüzden kodda sabit değil burada.
--
-- ⛔ SQL/69'U VE SQL/76'YI YENİDEN KOŞTURMA — BU DOSYANIN İŞİNİ
--   GERİ ALIRLAR. İkisi de `plan_limits`'in `limit_key` kısıtını
--   kuruyor ve ikisinde de `accounts_per_platform` YOK.
--   ⚠ Onlardan birini yeniden koşturman gerekirse ARDINDAN bu
--     dosyayı da koş. (CLAUDE.md Bölüm 6.)
--
-- NE YAPIYOR
--   1. `limit_key` kısıtına `accounts_per_platform` ekliyor.
--   2. Dört planın satırını açıyor: Starter 1, ötekiler 2.
--   3. Son satır KONTROL: dört satırı gösteriyor.
--
-- ⚠ `accounts` SATIRI DURUYOR VE AYRI BİR ŞEY.
--     accounts              = toplam hesap sayısı (bugün 60)
--     accounts_per_platform = AYNI platformdaki hesap sayısı
--   İkisi karıştırılmasın: panelde ayrı adlarla görünüyorlar.
--   ⛔ Kullanıcının asıl kuralı platform başına olan; toplam sayı
--     yalnızca bir emniyet tavanı (7 platform × 2 = 14, yani
--     pratikte hiç dolmuyor).
--
-- ⛔ MEVCUT VERİYE DOKUNMUYOR. Bugün aynı platformda ikiden fazla
--   hesabı olan varsa hesapları SİLİNMİYOR, kayıt bağları
--   kopmuyor; yalnızca YENİSİ eklenemiyor. Kullanıcının kararı
--   (16 Kasım 2026).
--
-- ⚠ PLANI DÜŞENİN HESAPLARI DA DURUYOR. Creator Pro'da iki
--   Instagram hesabı olan biri Starter'a düşerse ikisi de yerinde
--   kalıyor ve kayıtlardaki etiketleri çalışmaya devam ediyor;
--   yalnızca üçüncüyü ekleyemiyor. 67'deki "veri durur, yalnızca
--   görünmez" kararıyla aynı aile — ama burada görünmez bile
--   olmuyor, çünkü bir hesabı gizlemek kayıtların etiketini
--   anlamsızlaştırırdı.
--
-- BEKLENEN SONUÇ
--   Dört satırlık bir tablo:
--     creator_pro 2 · founding 2 · starter 1 · studio 2
