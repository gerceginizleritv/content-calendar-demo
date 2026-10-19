-- ══════════════════════════════════════════════════════════════════
-- 67 — GÖRÜNTÜLENME SONDASI: HANGİ METRİK GERÇEKTEN GELİYOR
--      (19 Ekim 2026)
-- ══════════════════════════════════════════════════════════════════
-- NEDEN
-- Kullanıcı "görüntülenmeleri Shootboard toplasın" dedi. Toplamadan
-- önce ÖLÇMEK gerekiyor: hangi izinler jetonda var, hangi metrik
-- adları gerçekten dönüyor. Bunlar hafızadan yazılamaz -- Meta
-- sürümden sürüme metrik adı değiştiriyor (plays -> views), Threads
-- insights ayrı bir izin (`threads_manage_insights`) istiyor ve o izin
-- mevcut jetonda olmayabilir.
--
-- ⚠ BÖLÜM 4'ÜN TEKRARI. Bir kez powerline fiyatları uyduruldu ve
-- yanlış çıktı. Bir kez "hikâyeler 109-422 görüntülenme alıyor" diye
-- doğrulanmamış bir sayı yazıldı; o sayı aynı arızayı SEKİZ GÜN
-- görünmez yaptı. Metrik adlarını tahmin edip kod yazmak, aynı hatayı
-- üçüncü kez yapmak olurdu. Bu dosya önce soruyor.
--
-- NE YAPIYOR
--   · `olcum_denemesi` tablosu: her denemenin sonucu -- hangi adres,
--     hangi HTTP kodu, hangi alanlar döndü, hata ne.
--   · `olcum-dene` Edge Function'ı bu tabloyu dolduruyor.
--   · Sonuç SQL Editor'den okunuyor (en alttaki sorgu).
--
-- ⛔ BU TABLOYA JETON YAZILMIYOR. `adres` sütunu access_token
-- parametresi AYIKLANMIŞ halde tutuluyor. Jeton bir kez bir günlüğe
-- düşerse o günlüğü okuyan herkese açılır; tablo da bir günlüktür.
-- testler/olcum-dene.test.js bunu ölçüyor.
--
-- ⛔ SONDA HİÇBİR ŞEY YAYINLAMIYOR. Yalnızca GET. Yayın yolundaki
-- hiçbir işlevi çağırmıyor, hiçbir kaydın durumunu değiştirmiyor.
--
-- GERİ ALMA: bu dosya hiçbir mevcut işlevi değiştirmiyor, yalnızca
-- yeni bir tablo ekliyor. Hiçbir dosyanın işini geri almıyor ve
-- hiçbir dosya bunun işini geri almıyor.
-- ══════════════════════════════════════════════════════════════════

-- ═══ 1/3 ═══ TABLO ════════════════════════════════════════════════
create table if not exists public.olcum_denemesi (
  id           uuid primary key default gen_random_uuid(),
  an           timestamptz not null default now(),

  -- Hangi takvim kaydı denendi.
  kayit_id     text,
  platform     text,
  tur          text,
  -- Platformdaki gönderi kimliği (calendar_events.external_id).
  external_id  text,

  -- Denenen adres. ⛔ access_token AYIKLANMIŞ olarak yazılıyor.
  adres        text not null,
  http_kodu    integer,

  -- ⚠ BAŞARILI, "SIFIR GELDİ" DEMEK DEĞİL. Ayrımı burada koruyoruz:
  -- basarili=false ise sayı YOK (bilinmiyor); basarili=true ve değer 0
  -- ise gerçekten sıfır. Asıl toplayıcı da bu ayrımı taşıyacak.
  basarili     boolean not null default false,

  -- Dönen metrik adları, virgülle. Asıl aranan şey bu.
  alanlar      text,
  -- Ham cevap, kırpılmış. Alan adlarını gözle görmek için.
  ham          text,
  hata         text
);

create index if not exists olcum_denemesi_an_idx
  on public.olcum_denemesi (an desc);

-- Yalnızca servis rolü. Politika YOK = kimse göremiyor; servis rolü
-- RLS'i atladığı için fonksiyon yazabiliyor.
alter table public.olcum_denemesi enable row level security;
revoke all on public.olcum_denemesi from anon, authenticated;

-- ═══ 2/3 ═══ SONDAYI ÇALIŞTIR ═════════════════════════════════════
-- <PROJE-REF> yerine kendi proje kimliğin (Supabase → Settings →
-- General → Reference ID).
--
-- Gizli anahtar sql/43'te Vault'a yazılan `story_worker_secret`;
-- yenisini tanımlamaya gerek yok, sonda da onu bekliyor.
select net.http_post(
  url     := 'https://<PROJE-REF>.supabase.co/functions/v1/olcum-dene',
  headers := jsonb_build_object(
               'Content-Type', 'application/json',
               'x-webhook-secret',
               (select decrypted_secret from vault.decrypted_secrets
                 where name = 'story_worker_secret')),
  body    := '{}'::jsonb,
  timeout_milliseconds := 60000
);

-- ═══ 3/3 ═══ SONUCU OKU ═══════════════════════════════════════════
-- Yukarıdaki çağrı ASENKRON: bir istek kimliği döndürüyor, cevabı
-- değil. Sonda birkaç saniye sürüyor; bu sorguyu 15-20 saniye sonra
-- çalıştır.
select an, platform, tur, basarili, http_kodu, alanlar, hata, adres
  from public.olcum_denemesi
 order by an desc
 limit 40;
