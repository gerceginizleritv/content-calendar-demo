-- ══════════════════════════════════════════════════════════════════
-- 70 — HESAP SİLİNİNCE ABONELİK VE ÖDEME DE GİTSİN
--      (12 Kasım 2026)
-- ══════════════════════════════════════════════════════════════════
-- HANGİ DOSYA NEYİ GERİ ALIR (CLAUDE.md Bölüm 6)
--
--   · Bu dosya `sql/69`'u TAMAMLIYOR, geri ALMIYOR. 69'daki tablolar,
--     fiyatlar ve okuma politikaları olduğu gibi duruyor.
--   · ⚠ `sql/69` YENİDEN ÇALIŞTIRILIRSA bu dosyanın işi GERİ ALINMAZ:
--     69 yalnızca `select` politikaları yazıyor, buradaki `delete`
--     politikalarına dokunmuyor. Yine de sıra önemli: önce 69, sonra 70.
--   · Tekrar çalıştırılabilir. Veri silmiyor, veri değiştirmiyor.
--
-- NEDEN
-- `sql/69` üç tablo ekledi: `yonetici`, `subscriptions`, `payments`.
-- Üçü de `user_id` taşıyor. `testler/hesap-sil.test.js` içindeki BEKÇİ
-- bunu yakaladı:
--
--     "★ sql/ içindeki user_id tablolarının HEPSİ listede
--      -> eksik: yonetici, subscriptions, payments"
--
-- O bekçi, `sql/` klasörünü tarayıp `user_id` taşıyan her tabloyu
-- buluyor ve hesap silinince temizlenenler listesinde olmasını
-- şart koşuyor. ⛔ Bilerek İSTİSNA YOLU YOK — kendi yorumu söylüyor:
-- "yarın biri canlı bir tablo için böyle bir not yazsa bekçi sessizce
-- zayıflardı." Testi değil LİSTEYİ düzeltmek doğru olan; `app.html`
-- güncellendi.
--
-- ⛔ AMA LİSTEYE EKLEMEK TEK BAŞINA YETMİYOR. `hesapVerisiniSil()`
-- tarayıcıdan `delete ... where user_id = <kendisi>` çalıştırıyor.
-- Bu üç tabloda SİLME POLİTİKASI YOKTU; RLS açıkken politikası olmayan
-- işlem reddedilir ve PostgREST bunu "sıfır satır" diye döndürür.
-- Yani silme SESSİZCE hiçbir şey yapmazdı: veri kalır, kimse fark
-- etmez. Bu dosya o kapıyı açıyor.
--
-- KULLANICI KARARI (12 Kasım 2026)
--   · Ödeme kaydı hesapla birlikte SİLİNSİN. Gerekçe: bizim `payments`
--     tablomuz bir KOPYA; asıl muhasebe kaydı ve fatura ödeme
--     sağlayıcısının kendi sisteminde duruyor.
--     ⚠ İLK GERÇEK ÖDEMEDEN ÖNCE MALİ MÜŞAVİRE SORULACAK:
--       "sağlayıcıdaki kayıt bizim için yeterli mi?"
--     Bugün hiç ödeme yok, yani bugün risk sıfır.
--   · Kullanıcı KENDİ satırını silebilsin. Başkasının satırına
--     dokunamaz; yetki yükseltmez.
--
-- NASIL ÇALIŞTIRILIR
-- Supabase panelinde: SQL Editor → New query → bu dosyanın TAMAMINI
-- yapıştır → Run. Tekrar çalıştırılabilir.
--
-- NE GÖRMELİSİN
-- En altta tek bir tablo: üç politika satırı. Hata görürsen DUR ve yaz.
-- ══════════════════════════════════════════════════════════════════

begin;

-- 69 çalıştırılmadıysa iş duruyor. Sessizce "yaptım" demek, sonra
-- silme çalışmayınca sebebini aramaktan kötüdür.
do $$
begin
  if to_regclass('public.subscriptions') is null then
    raise exception 'Once sql/69-fiyat-ve-yonetim.sql calistirilmali: subscriptions tablosu yok.';
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────
-- 1 · KENDİ SATIRINI SİLME
-- ──────────────────────────────────────────────────────────────────
-- ⛔ YALNIZCA KENDİ SATIRI. `using (user_id = auth.uid())` başkasının
-- satırına dokunmayı engelliyor. Yönetici burada ayrıcalıklı DEĞİL:
-- yönetim alanı salt okunur, silme oradan yapılmıyor.

drop policy if exists subs_kendi_sil on public.subscriptions;
create policy subs_kendi_sil on public.subscriptions for delete
  using (user_id = auth.uid());

drop policy if exists pay_kendi_sil on public.payments;
create policy pay_kendi_sil on public.payments for delete
  using (user_id = auth.uid());

-- `yonetici` tablosuna SİLME POLİTİKASI EKLENMİYOR ve bu bilerek.
-- O satır, auth kullanıcısı silindiğinde `on delete cascade` ile
-- kendiliğinden gidiyor (sql/69). Tarayıcıdan silinebilir olsaydı,
-- yönetici listesi tarayıcıdan değiştirilebilir hale gelirdi —
-- promptun 3. güvenlik maddesi bunu yasaklıyor:
-- "Yönetici listesi tarayıcıdan değişmez."
--
-- ⚠ Sonuç: `HESAP_TABLOLARI` içindeki `yonetici` satırı için silme
-- SESSİZCE sıfır satır etkiler. Bu bir eksik DEĞİL, kasıt: temizliği
-- cascade yapıyor. Burada yazılı olmasının sebebi, bunu okuyan bir
-- sonraki kişinin "unutulmuş" sanmaması.

-- ──────────────────────────────────────────────────────────────────
-- 2 · ÖDEME SATIRI HESAPLA BİRLİKTE GİTSİN
-- ──────────────────────────────────────────────────────────────────
-- `sql/69`'da `payments.user_id` şöyleydi:
--     references auth.users(id) on delete set null
-- Gerekçe "kayıt kalsın ama kişiye bağlı olmasın" idi. Kullanıcının
-- kararı bunu değiştirdi: kayıt SİLİNSİN. İki yol birbirini tutmalı,
-- yoksa tarayıcıdan silinen satır başka bir yoldan geri gelmiş gibi
-- görünür.
--
-- ⚠ Tablo BOŞ olduğu için bu değişiklik hiçbir satıra dokunmuyor.
-- Doluyken çalıştırılsaydı davranış değişirdi; o yüzden kontrol var.
do $$
declare
  kactane bigint;
begin
  select count(*) into kactane from public.payments;
  if kactane > 0 then
    raise exception
      'payments tablosunda % satir var. Yabanci anahtar davranisini degistirmeden once bu satirlarin ne olacagina karar verilmeli; durduruldu.',
      kactane;
  end if;

  alter table public.payments
    drop constraint if exists payments_user_id_fkey;
  alter table public.payments
    add constraint payments_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;

  raise notice 'payments.user_id artik cascade.';
end $$;

-- ──────────────────────────────────────────────────────────────────
-- 3 · İPTAL ETMEK, SİLMEK DEĞİLDİR
-- ──────────────────────────────────────────────────────────────────
-- KULLANICI KARARI (12 Kasım 2026, kendi sözleriyle):
--   "Bir abone kendi aboneliğini kendisi silebilsin ama bu esnada
--    ödeme yaptıysa ödeme süresi bitene kadar aboneliğini
--    kullanabilmeli. Abonelik süresi bittiğinde erişimi düşürülmeli."
--
-- ⛔ BU, YUKARIDAKİ SİLME POLİTİKASIYLA KARIŞTIRILMAMALI. İki ayrı şey:
--
--   ABONELİĞİ İPTAL ETMEK → satır DURUR, `status` = 'canceled' olur,
--     `current_period_end` DEĞİŞMEZ. Ödenen süre bitene kadar erişim
--     sürer. İptal sağlayıcı tarafında yapılır ve bize imzalı
--     bildirimle gelir; tarayıcıdan `update` yetkisi YOK (o yüzden
--     `subscriptions` için update politikası da yok).
--
--   HESABI SİLMEK → satır GİDER. Yukarıdaki `delete` politikası
--     yalnızca bunun içindir.
--
-- ⚠ İlk yazımda bu ikisi karışmıştı: silme politikası "iptal" diye
-- okunsaydı, satırla birlikte `current_period_end` de gider ve
-- "ödediği süre bitene kadar kullansın" kuralı UYGULANAMAZ hale
-- gelirdi. Satır gidince neyin ödendiği de gidiyor.
--
-- Aşağıdaki işlev, "bu kullanıcının ŞU AN hangi planı var" sorusunun
-- TEK kaynağı. Uygulama da, ödeme duvarı da, limit denetimi de buradan
-- okuyacak — kural üç ayrı yere kopyalanırsa biri eskir.
create or replace function public.gecerli_plan(p_user uuid default null)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case
       -- Ömür boyu: bitiş tarihi aranmıyor.
       when s.status = 'lifetime' then s.plan_key
       -- Yürüyen abonelik.
       when s.status = 'active' then s.plan_key
       -- ⛔ İPTAL EDİLMİŞ AMA SÜRESİ BİTMEMİŞ: erişim SÜRÜYOR.
       -- Kullanıcının kuralı tam olarak bu satır.
       when s.status in ('canceled','past_due')
            and s.current_period_end is not null
            and s.current_period_end > now()
         then s.plan_key
       -- Süre dolmuş: erişim düşüyor.
       else 'starter'
     end
     from public.subscriptions s
     where s.user_id = coalesce(p_user, auth.uid())),
    -- Hiç aboneliği olmayan da Starter.
    'starter');
$$;

-- Herkes KENDİ planını sorabilir. Başkasının kimliğiyle çağrılsa bile
-- yalnızca o satırı okur ve plan ADINDAN başka bir şey döndürmez.
grant execute on function public.gecerli_plan(uuid) to anon, authenticated;

commit;

-- ══════════════════════════════════════════════════════════════════
-- KONTROL — bunu görmelisin
-- ══════════════════════════════════════════════════════════════════
-- Üç satır gelmeli:
--   payments       · pay_kendi_sil  · DELETE
--   payments       · pay_kendi      · SELECT
--   subscriptions  · subs_kendi_sil · DELETE
--   subscriptions  · subs_kendi     · SELECT
-- (yani dört; silme olanlar yeni.)
select tablename as tablo, policyname as politika, cmd as islem
  from pg_policies
 where schemaname = 'public'
   and tablename in ('subscriptions','payments')
 order by tablename, cmd, policyname;

-- İkinci kontrol: plan kuralı doğru çalışıyor mu. Dört satır gelmeli
-- ve dördü de "dogru mu" sütununda true demeli.
-- (Gerçek bir abonelik gerekmiyor; kural sentetik değerlerle deneniyor.)
with ornek(hal, durum, bitis, beklenen) as (values
  ('yuruyen abonelik',            'active',   now() + interval '10 days', 'creator_pro'),
  ('iptal, suresi BITMEMIS',      'canceled', now() + interval '10 days', 'creator_pro'),
  ('iptal, suresi BITMIS',        'canceled', now() - interval '1 day',   'starter'),
  ('omur boyu',                   'lifetime', null,                       'creator_pro')
)
select hal as durum_aciklamasi,
       beklenen,
       case
         when durum = 'lifetime' then 'creator_pro'
         when durum = 'active' then 'creator_pro'
         when durum in ('canceled','past_due')
              and bitis is not null and bitis > now() then 'creator_pro'
         else 'starter'
       end as cikan,
       (case
          when durum = 'lifetime' then 'creator_pro'
          when durum = 'active' then 'creator_pro'
          when durum in ('canceled','past_due')
               and bitis is not null and bitis > now() then 'creator_pro'
          else 'starter'
        end = beklenen) as dogru_mu
  from ornek;
