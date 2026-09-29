-- 53 — YouTube Shorts de otomatik yayınlanıyor
--
-- ══════════════════════════════════════════════════════════════════
-- ⛔ ÖNCE WORKER, SONRA BU DOSYA
-- ══════════════════════════════════════════════════════════════════
-- Bu dosyayı çalıştırmadan ÖNCE story-yayin worker'ının 1.9.0 (ya da
-- üstü) sürümü yayında olmalı. sql/50'nin başındaki gerekçenin
-- aynısı, bir farkla -- ve bu fark sql/50'dekinden AĞIR:
--
--   · kuyruk shorts kayıtlarını vermeye başlar,
--   · 1.8.1 worker `shorts`ı tanımaz: `reelMi` false döner,
--   · platform 'youtube' olduğu için kayıt "youtube yayını henüz
--     kurulmadı" diye ERTELENİR.
--
-- Yani ters sıra bu kez sessiz bir yanlış yayın DEĞİL, üç saatlik bir
-- erteleme döngüsü üretiyor: zararsız ama kimse yayının neden
-- çıkmadığını anlamıyor. Buna karşın platformu yanlış girilmiş bir
-- shorts kaydı (platform 'instagram') 1.8.1 worker'da Instagram
-- STORY'si olarak çıkardı -- worker 1.9.0'daki tür/platform kontrolü
-- tam bunu kapatıyor. Sıra bu yüzden önemli.
--
-- KONTROL (çalıştırmadan önce, tarayıcıda):
--   Edge Function'ın adresine GET at, dönen JSON'da `"surum"` ne
--   diyor? 1.9.0'dan küçükse BU DOSYAYI ÇALIŞTIRMA.
--
-- ══════════════════════════════════════════════════════════════════
-- ⛔ İKİNCİ ŞART: YOUTUBE DENETİMİ
-- ══════════════════════════════════════════════════════════════════
-- Bu dosya kuyruğun kapısını açıyor, yayını AÇMIYOR. YouTube,
-- denetimden geçmemiş bir API projesinden yüklenen her videoyu
-- KALICI OLARAK "özel"e kilitliyor -- Studio'dan bile herkese açık
-- yapılamıyor. O yüzden worker 1.9.0, `YOUTUBE_DENETIM_GECTI`
-- tanımlı olmadıkça gerçek kayıtları YÜKLEMİYOR, erteliyor.
--
-- Yani doğru sıra: bu dosya → hesap bağlama → tek bir DENEME kaydı
-- (kalıcı özel kalacak, gözden çıkarılmış) → denetim başvurusu →
-- onay → `YOUTUBE_DENETIM_GECTI=1`. Ayrıntısı worker'ın YOUTUBE
-- bölümünün başında.
--
-- ══════════════════════════════════════════════════════════════════
-- SHORTS STORY VE REELS'TEN NEREDE AYRILIYOR
-- ══════════════════════════════════════════════════════════════════
-- Veritabanı tarafında HİÇBİR YERDE. Yeni sütun yok, yeni işlev yok:
-- shorts kaydı da media_url + media_bytes taşıyor, kapağı (cover_url)
-- YouTube'a ayrıca yükleniyor ve o worker'ın işi.
--
-- Bu dosyada olan tek şey, üç yerdeki `type in (...)` kümesine bir
-- eleman eklemek. Dosyanın uzunluğu değişikliğin büyüklüğünü değil,
-- yanlış yapıldığında görünmez olmasını anlatıyor.
--
-- ══════════════════════════════════════════════════════════════════
-- ⚠ AYNI KÜME DÖRT YERDE YAZIYOR
-- ══════════════════════════════════════════════════════════════════
-- Otomatik yayınlanabilen türler şu dört yerde ayrı ayrı yazılı:
--
--   1. public.story_kuyruk_al        (aşağıda, 1/3)
--   2. public.story_yayin_ani_tazele (aşağıda, 2/3)
--   3. app.html -> YAYIN_TURLERI     (kutucuğun görünmesi)
--   4. mcp/index.ts -> YAYIN_TURLERI (kaydın boyut tavanı)
--
-- Biri eksik kalırsa hiçbir yerde hata çıkmıyor, davranış sessizce
-- yarım oluyor: 1 eksikse kayıt kuyruğa düşmez; 2 eksikse publish_at
-- null kalır ve kayıt yine düşmez; 3 eksikse kullanıcı kutucuğu hiç
-- göremez; 4 eksikse yükleyici shorts kaydına dosya yazmaz.
-- testler/shorts-kuyruk.test.js bu dördünü birbirine bağlıyor.

-- ═══ 1/3 ═══ KUYRUK ═══════════════════════════════════════════════
-- ⚠ DROP GEREKLİ DEĞİL: dönüş tipi sql/50'dekiyle birebir aynı, tek
-- değişen gövdedeki süzgeç. Yine de `drop` bırakıldı ki bu dosya
-- sql/50 çalıştırılmamış bir veritabanında da aynı sonucu versin.
begin;

drop function if exists public.story_kuyruk_al(integer);
create function public.story_kuyruk_al(p_limit integer default 5)
returns table(
  id text, user_id uuid, media_url text, media_bytes bigint,
  media_mime text, publish_at timestamptz, attempt_count integer,
  idem_key uuid, external_id text, title text, content jsonb,
  publish_ref text, publish_ref_at timestamptz, publish_called_at timestamptz,
  platform text, type text, cover_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with sira as (
    select e.id
      from public.calendar_events e
     where e.type in ('story', 'reels', 'shorts')
       and e.auto_publish = true
       and e.publish_state = 'pending'
       and e.deleted_at is null
       and e.publish_at is not null
       and e.publish_at <= now()
       and (e.retry_after is null or e.retry_after <= now())
       and e.attempt_count < 3
       -- ⚠ SAHİP KONTROLÜ (sql/49). Bu satır olmadan kuyruk HERKESİN
       -- kaydını alıyordu ve worker hepsini aynı hesaba yayınlardı.
       and exists (select 1 from public.user_prefs p
                    where p.user_id = e.user_id
                      and p.prefs->>'story_yayin' = 'true')
     -- Beraberlik bozucu iki ölçüt: önce dosya adı (parça sırası),
     -- sonra id (her turda aynı sonuç).
     order by e.publish_at, e.media_name nulls first, e.id
     for update skip locked
     limit p_limit
  )
  update public.calendar_events e
     set publish_state = 'in_progress',
         attempt_count = e.attempt_count + 1,
         updated_at    = now()
    from sira
   where e.id = sira.id
     and e.publish_state = 'pending'
  returning e.id, e.user_id, e.media_url, e.media_bytes, e.media_mime,
            e.publish_at, e.attempt_count, e.idem_key, e.external_id,
            e.title, e.content, e.publish_ref, e.publish_ref_at,
            e.publish_called_at, e.platform, e.type, e.cover_url;
end $$;

revoke all   on function public.story_kuyruk_al(integer) from public, anon, authenticated;
grant execute on function public.story_kuyruk_al(integer) to service_role;

commit;

-- ═══ 2/3 ═══ YAYIN ANI TETİKLEYİCİSİ ══════════════════════════════
-- sql/50'nin başındaki "en sessiz hata" buraya da geçerli: kuyruk
-- `publish_at is not null` arıyor, tetikleyici publish_at'i yalnızca
-- yayınlanabilir türlerde dolduruyor. Kümeyi 1/3'te genişletip
-- burayı unutmak, "kutucuk açık görünüyor ama kayıt kuyruğa hiç
-- düşmüyor" demekti.
begin;

create or replace function public.story_yayin_ani_tazele()
returns trigger
language plpgsql
as $$
begin
  if new.type in ('story', 'reels', 'shorts') then
    new.publish_at := public.story_yayin_ani(new.post_date, new.post_time, new.content);
  else
    -- Tür yayınlanabilir kümeden çıkarıldıysa yayın anı da anlamını
    -- yitiriyor. (Örnek: kullanıcı shorts kaydını video'ya çeviriyor.)
    new.publish_at := null;
  end if;
  return new;
end $$;

commit;

-- ═══ 3/3 ═══ GERİYE DÖNÜK DÜZELTME ════════════════════════════════
-- Zaten duran shorts kayıtlarının publish_at'i null: tetikleyici
-- yalnızca YAZILDIĞINDA çalışıyor, yani bu satırlar bir daha
-- kaydedilmedikçe kuyruğa düşmezdi. sql/50'nin 5/5'inin aynısı.
--
-- ⚠ YAYINLANMIŞLARA DOKUNULMUYOR: onların publish_at'i artık bir plan
-- değil, bir kayıt.
--
-- ⚠ BU SATIRLAR KUYRUĞA HEMEN DÜŞMEZ: auto_publish hâlâ false
-- (kullanıcı kutucuğu hiç göremiyordu). publish_at'i doldurmak
-- kutucuğu açtığı an kaydın çalışması demek, kendi başına yayın değil.
begin;

update public.calendar_events
   set publish_at = public.story_yayin_ani(post_date, post_time, content)
 where type = 'shorts'
   and deleted_at is null
   and publish_state <> 'published'
   and publish_at is distinct from public.story_yayin_ani(post_date, post_time, content);

commit;

notify pgrst, 'reload schema';

-- ═══ KONTROL ══════════════════════════════════════════════════════
-- 1) Kuyruk shorts'u süzüyor mu? `shorts_var` true olmalı.
--    (Kaynağı okuyoruz: davranışı sınamak için kayıt yayınlamak
--    gerekirdi ve bu kontrol sorgusu hiçbir şey yayınlamıyor.)
select pg_get_functiondef(p.oid) like '%''shorts''%' as shorts_var
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'story_kuyruk_al';

-- 2) Tetikleyici de süzüyor mu? `shorts_var` true olmalı.
select pg_get_functiondef(p.oid) like '%''shorts''%' as shorts_var
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'story_yayin_ani_tazele';

-- 3) SAATSİZ KALAN VAR MI? Otomatik yayını açık ama publish_at'i boş
--    kayıt -- yani "açık görünüyor ama kuyruğa hiç düşmeyecek" olan.
--    Saati girilmemiş kayıtlar burada çıkar ve bu DOĞRUDUR (sql/45:
--    saatsiz kayıt yayınlanmıyor). 0 değilse önce post_time'a bak.
select type, count(*) as saatsiz
  from public.calendar_events
 where type in ('story', 'reels', 'shorts')
   and auto_publish = true
   and deleted_at is null
   and publish_state <> 'published'
   and publish_at is null
 group by type;

-- 4) PLATFORMU YANLIŞ SHORTS KAYDI VAR MI?
--    shorts YouTube'a gider; başka platformdaki bir shorts kaydı
--    worker 1.9.0'da yayınlanmıyor, ERTELENİYOR (sebep satırda
--    yazıyor). Burada çıkan kayıtların platformu düzeltilmeli.
--    Beklenen: 0 satır.
select id, platform, post_date, coalesce(media_name, '(dosyasız)') as dosya
  from public.calendar_events
 where type = 'shorts'
   and auto_publish = true
   and deleted_at is null
   and publish_state <> 'published'
   and coalesce(platform, '') <> 'youtube'
 order by post_date
 limit 50;

-- 5) Kuyrukta şu an ne bekliyor? (Yayınlamıyor, yalnızca gösteriyor.)
select type, platform, post_date, post_time,
       coalesce(media_name, '(dosyasız)') as dosya,
       publish_state, attempt_count, coalesce(last_error, '—') as hata
  from public.calendar_events
 where type in ('story', 'reels', 'shorts')
   and auto_publish = true
   and deleted_at is null
   and publish_state <> 'published'
 order by publish_at nulls first
 limit 50;
