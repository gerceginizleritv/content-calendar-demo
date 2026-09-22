-- 45 — publish_at, tarih/saat değişince kendiliğinden güncelleniyor
--
-- ══════════════════════════════════════════════════════════════════
-- HANGİ HATA
-- ══════════════════════════════════════════════════════════════════
-- publish_at gerçek bir sütun ve bugüne kadar onu YALNIZCA PC
-- yükleyicisinin PATCH'i yazıyordu. Uygulamada bir story'nin saatini
-- değiştirmek publish_at'e dokunmuyordu, çünkü app.html'deki toRow()
-- o sütunu bilerek göndermiyor -- worker'ın durumunu tarayıcının bayat
-- kopyası ezmesin diye.
--
-- Doğru bir karardı ama yarısı eksikti:
--
--   Kullanıcı 12:00'deki story'yi 18:00'e alıyor.
--   Takvimde 18:00 yazıyor.
--   Sistem 12:00'de yayınlıyor.
--
-- Hiçbir yerde hata yok, hiçbir uyarı yok. Kullanıcı yanlış saatte
-- çıkan story'yi ancak görürse anlıyor -- ve story 24 saatlik,
-- düzeltmenin yolu yok.
--
-- Bu bir kez yaşandı: test kaydının saati uygulamadan 11:53'e çekildi,
-- publish_at 09:00 UTC'de kaldı ve kayıt yanlış saati bekliyordu.
--
-- ══════════════════════════════════════════════════════════════════
-- NEDEN TETİKLEYİCİ, NEDEN UYGULAMADA DEĞİL
-- ══════════════════════════════════════════════════════════════════
-- Kaydın saatini değiştirebilen üç yol var: uygulama, MCP
-- (shootboard_update_entry ve içe aktarma), PC yükleyicisi. Üçüne de
-- aynı hesabı ayrı ayrı yazmak, birini unutmanın sessizce yanlış
-- saatte yayın demek olduğu bir yer. Tetikleyici KİMİN yazdığını
-- umursamıyor: satır değişiyorsa publish_at doğru.
--
-- Dönüşüm de burada tek yerde kalıyor -- şartname Bölüm 4'ün istediği
-- şey ("dönüşüm TEK BİR YERDE yapılır") aslında tam olarak bu.

begin;

-- ── Yerel tarih+saatten UTC ───────────────────────────────────────
-- Saat dilimi kaydın kendi content.timezone'undan. Boşsa hesabın
-- varsayılanı bilinmediği için Europe/Istanbul -- uygulamanın kendi
-- varsayılanı da bu.
--
-- SAAT YOKSA publish_at DA YOK. Saatsiz bir story'yi gece yarısına
-- yerleştirmek, kullanıcının hiç istemediği bir saatte yayın demek;
-- publish_at null olunca kuyruk o kaydı hiç almıyor ve kullanıcı
-- saati girene kadar bekliyor.
create or replace function public.story_yayin_ani(
  p_date date, p_time time, p_content jsonb)
returns timestamptz
language plpgsql
immutable
as $$
declare v_tz text;
begin
  if p_date is null or p_time is null then return null; end if;
  v_tz := nullif(coalesce(p_content->>'timezone', ''), '');
  if v_tz is null then v_tz := 'Europe/Istanbul'; end if;
  begin
    return (p_date + p_time) at time zone v_tz;
  exception when others then
    -- Tanınmayan saat dilimi satırı yazılamaz yapmasın.
    return (p_date + p_time) at time zone 'Europe/Istanbul';
  end;
end $$;

-- ── Tetikleyici ───────────────────────────────────────────────────
create or replace function public.story_yayin_ani_tazele()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'story' then
    new.publish_at := public.story_yayin_ani(new.post_date, new.post_time, new.content);
  else
    -- Tür story'den çıkarıldıysa yayın anı da anlamını yitiriyor.
    new.publish_at := null;
  end if;
  return new;
end $$;

drop trigger if exists calendar_events_yayin_ani on public.calendar_events;
create trigger calendar_events_yayin_ani
  before insert or update of type, post_date, post_time, content
  on public.calendar_events
  for each row
  execute function public.story_yayin_ani_tazele();

commit;

-- ═══ GERİYE DÖNÜK DÜZELTME ════════════════════════════════════════
-- Mevcut story kayıtlarının publish_at'i tarih/saatleriyle uyumlu
-- hâle geliyor. Zaten doğru olanlar için sonuç aynı; PC yükleyicisi
-- de aynı hesabı yapıyordu.
--
-- Yayınlanmış kayıtlara DOKUNULMUYOR: onların publish_at'i artık bir
-- plan değil, bir kayıt.
begin;

update public.calendar_events
   set publish_at = public.story_yayin_ani(post_date, post_time, content)
 where type = 'story'
   and deleted_at is null
   and publish_state <> 'published'
   and publish_at is distinct from public.story_yayin_ani(post_date, post_time, content);

commit;

-- ═══ KONTROL ══════════════════════════════════════════════════════
-- Tetikleyici duruyor mu?
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'public.calendar_events'::regclass
   and tgname = 'calendar_events_yayin_ani';
-- 1 satır, tgenabled = 'O' (etkin) olmalı.

-- Uyumsuz kalan var mı? BOŞ dönmeli.
select id, post_date, post_time, publish_at,
       public.story_yayin_ani(post_date, post_time, content) as olmasi_gereken
  from public.calendar_events
 where type = 'story' and deleted_at is null and publish_state <> 'published'
   and publish_at is distinct from public.story_yayin_ani(post_date, post_time, content);

-- Elle deneme: bir story'nin saatini değiştir, publish_at kendiliğinden
-- kaymalı. (Kendi kayıt kimliğinle.)
--   update public.calendar_events set post_time = '18:00' where id = '...';
--   select post_time, publish_at from public.calendar_events where id = '...';
