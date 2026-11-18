-- ══════════════════════════════════════════════════════════════════
-- 73 — EURO (EUR) PARA BİRİMİ
--      (18 Kasım 2026)
-- ══════════════════════════════════════════════════════════════════
-- HANGİ DOSYA NEYİ GERİ ALIR (CLAUDE.md Bölüm 6)
--
--   ⛔ sql/69 YENİDEN KOŞTURULURSA BU DOSYANIN İŞİ GERİ ALINIR.
--      sql/69:129 tabloyu şu kısıtla kuruyor:
--          check (currency in ('USD','TRY'))
--      `create table if not exists` olduğu için tablo zaten varsa
--      kısıt DEĞİŞMEZ — yani sql/69'u tekrar çalıştırmak bugünkü
--      hâli bozmaz. ⚠ AMA tablo bir gün sıfırdan kurulursa (yeni
--      veritabanı, geri yükleme) kısıt EUR'suz doğar ve BU DOSYA
--      tekrar çalıştırılmalıdır.
--
--   · Bu dosya tekrar çalıştırılabilir: kısıt `drop ... if exists`
--     ile yenileniyor, satırlar `on conflict do nothing` ile
--     giriyor. VERİ SİLMİYOR, var olan fiyatı DEĞİŞTİRMİYOR.
--
-- NEDEN VAR
--   Kullanıcı 16 Kasım 2026'da fiyat sayfasına EUR istedi. Kısıt
--   yüzünden EUR satırı veritabanına hiç girmiyordu; yönetim paneli
--   de yazamıyordu.
--
-- RAKAM KARARI (kullanıcı, 18 Kasım 2026)
--   "USD ne kadar ise EURO o kadar olsun."
--   ⛔ KUR HESABI YOK. EUR satırları USD satırlarının amount_minor
--   değerini BİREBİR kopyalıyor. TRY ayrı kalıyor — o kullanıcının
--   kendi belirlediği, daha ucuz rakam.
--   ⚠ Bu bir BAŞLANGIÇ değeri. Değiştirmek için kod dağıtmaya gerek
--   yok: yönetim panelinden girilir.
-- ══════════════════════════════════════════════════════════════════

begin;

-- ── 1 · KISIT: EUR de kabul edilsin ───────────────────────────────
-- Kısıdın adı PostgreSQL tarafından üretildi; `if exists` ile
-- düşürülüyor ki bu dosya iki kez çalıştırılabilsin.
alter table public.plan_prices
  drop constraint if exists plan_prices_currency_check;

alter table public.plan_prices
  add constraint plan_prices_currency_check
  check (currency in ('USD', 'TRY', 'EUR'));

-- ── 2 · EUR SATIRLARI: USD'den BİREBİR kopya ──────────────────────
-- ⛔ `on conflict do nothing`: EUR satırı zaten varsa DOKUNULMUYOR.
--    Yani bu dosya ikinci kez çalıştırıldığında panelden girilmiş
--    rakamları EZMEZ.
insert into public.plan_prices (plan_key, currency, period, amount_minor, active)
select plan_key, 'EUR', period, amount_minor, active
  from public.plan_prices
 where currency = 'USD'
on conflict (plan_key, currency, period) do nothing;

commit;

-- ── KONTROL ───────────────────────────────────────────────────────
-- Çalıştırdıktan sonra bu sorgu her planın üç para biriminde de
-- satırı olduğunu gösterir:
--
--   select plan_key, period,
--          max(amount_minor) filter (where currency='TRY') as try_minor,
--          max(amount_minor) filter (where currency='USD') as usd_minor,
--          max(amount_minor) filter (where currency='EUR') as eur_minor
--     from public.plan_prices
--    group by plan_key, period
--    order by plan_key, period;
