-- ══════════════════════════════════════════════════════════════════
-- 68 — BAŞARISIZ KAYDI YENİDEN KUYRUĞA SOKMA
--      (3 Kasım 2026)
-- ══════════════════════════════════════════════════════════════════
-- NEDEN
-- 27 Ekim 2026'da bir Threads anketi `#100/4279063 Invalid parameter`
-- ile reddedildi. Kayıt `failed` oldu, kullanıcıya "yayınlanamadı"
-- e-postası gitti, kullanıcı içeriği düzeltti — ve orada TIKANDI.
--
-- Çünkü `failed` bir kaydı geri döndürmenin HİÇBİR yolu yoktu:
--   · kuyruk yalnızca `publish_state = 'pending'` alıyor
--   · uygulama `publish_state`'e bilerek hiç dokunmuyor (app.html'deki
--     toRow yorumu: "bu depoda aynı sınıf hata üç kez yaşandı")
--   · `story_ertele` yalnızca `in_progress` kayıtlara çalışıyor
--
-- Kullanıcı o gün Supabase panelinden ELLE `update` çalıştırmak
-- zorunda kaldı. Bir kullanıcının yapmak zorunda kalmaması gereken
-- şey; üstelik elle yazılan bir `update`'te `where` satırını unutmak
-- bütün takvimi bozabilirdi.
--
-- NE YAPIYOR
-- `story_tekrar_dene(p_id)` — TEK bir başarısız kaydı `pending`
-- durumuna döndürüyor ve deneme hakkını geri veriyor.
--
-- ⛔ İZİ TEMİZLEMİYOR — BİLEREK.
-- `publish_ref`, `publish_ref_at` ve `publish_called_at` OLDUĞU GİBİ
-- bırakılıyor. Çöküş kurtarması (worker Bölüm 8) tam o üç alanı
-- okuyor: "yayın çağrısı yapıldı mı, yapıldıysa sonucu ne oldu".
-- Temizleseydik o koruma devre dışı kalırdı ve çağrı gerçekten
-- gitmişse kayıt İKİNCİ KEZ yayınlanırdı. 26 Ekim 2026'daki çift
-- Facebook reel'i tam olarak o kapıdan çıkmıştı.
--
-- ⛔ YALNIZCA KENDİ KAYDI. `auth.uid()` şartı olmadan bu fonksiyon,
-- kimliğini bilen herkese başkasının kaydını kuyruğa sokma yetkisi
-- verirdi. `security definer` olduğu için RLS burada devreye girmiyor;
-- şart elle yazılmak zorunda.
--
-- ⛔ YALNIZCA `failed`. `published` bir kaydı kuyruğa geri sokmak onu
-- ikinci kez yayınlamak demek. `in_progress` olanı sokmak ise worker
-- tam o kaydı işlerken altından çekmek olur.
--
-- YENİDEN ÇALIŞTIRILABİLİR: yalnızca `create or replace` ve `grant`
-- içeriyor, hiçbir dosyanın işini geri almıyor.
-- ══════════════════════════════════════════════════════════════════

create or replace function public.story_tekrar_dene(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.calendar_events
     set publish_state = 'pending',
         -- Deneme hakkı geri veriliyor: üç hak tükendiği için `failed`
         -- olmuş bir kayıt, sebebi düzeltildikten sonra sıfırdan
         -- başlamalı. Sayaç durmaya devam etseydi tek denemede yine
         -- `failed` olurdu.
         attempt_count = 0,
         -- Eski hata metni siliniyor: ekranda duran kırmızı satır artık
         -- geçerli değil ve orada kalması "hâlâ hatalı" der.
         last_error    = null,
         -- Bekleme kalkıyor: kullanıcı DÜĞMEYE BASTI, beklemesin.
         retry_after   = null,
         updated_at    = now()
   where id = p_id
     and user_id = auth.uid()
     and publish_state = 'failed'
     and deleted_at is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ⚠ Bu fonksiyon öteki story_* fonksiyonlarının AKSİNE tarayıcıya
-- açılıyor. Sebep: düğmeye kullanıcı basıyor. Güvenliği yukarıdaki üç
-- şart taşıyor (kendi kaydı · yalnızca failed · silinmemiş).
--
-- Öteki geçişler (yayinlandi/basarisiz/ertele/kuyruk_al) tarayıcıya
-- KAPALI kalıyor: onlar sistemin kendi kararları. Kullanıcı kendi
-- kaydını 'published' işaretleyebilseydi durum artık sistemin durumu
-- olmazdı.
revoke all on function public.story_tekrar_dene(text) from public, anon;
grant execute on function public.story_tekrar_dene(text) to authenticated;
grant execute on function public.story_tekrar_dene(text) to service_role;

-- ── KONTROL ───────────────────────────────────────────────────────
-- 1 satır dönmeli: story_tekrar_dene
select p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'story_tekrar_dene';
