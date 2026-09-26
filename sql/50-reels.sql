-- 50 — Reels de otomatik yayınlanıyor
--
-- ══════════════════════════════════════════════════════════════════
-- ⛔ ÖNCE WORKER, SONRA BU DOSYA
-- ══════════════════════════════════════════════════════════════════
-- Bu dosyayı çalıştırmadan ÖNCE story-yayin worker'ının 1.5.0 (ya da
-- üstü) sürümü yayında olmalı. Sıra ters olursa:
--
--   · kuyruk reels kayıtlarını vermeye başlar,
--   · 1.4.0 worker `type` alanını OKUMAZ ve hepsini story sanır,
--   · her reel Instagram'a STORY olarak çıkar ve 24 saatte kaybolur.
--
-- Hiçbir hata görünmez. Kullanıcı reel'i bekler, story çıkmıştır.
--
-- Doğru sıra ZARARSIZ: 1.5.0 worker bu dosya çalışmadan önce de
-- çalışır, çünkü kuyruk `type` döndürmediğinde alan `undefined` kalır
-- ve worker story davranışına düşer -- ki gelen kayıtların hepsi zaten
-- story'dir. Yani "worker önce" yanlış giderse de kimse zarar görmez.
--
-- KONTROL (çalıştırmadan önce, tarayıcıda):
--   Edge Function'ın adresine GET at, dönen JSON'da `"surum"` ne
--   diyor? "1.5.0" değilse BU DOSYAYI ÇALIŞTIRMA.
--
-- ══════════════════════════════════════════════════════════════════
-- ⚠ ÖNCE İSİMLER HAKKINDA
-- ══════════════════════════════════════════════════════════════════
-- Bu dosyadan sonra `story_*` adlı fonksiyonlar ARTIK YALNIZCA STORY
-- DEMEK DEĞİL: story ve reels kayıtlarının ikisini birden yönetiyorlar.
--
-- Adları değiştirmedim ve bu bilinçli bir karar. Worker (Edge Function)
-- bu fonksiyonları adlarıyla çağırıyor; adı değiştirmek dağıtım sırasına
-- bağımlılık yaratır -- SQL önce çalışırsa worker "fonksiyon yok" der,
-- worker önce giderse "eski fonksiyon yok" der. İkisi de üretimde
-- sessizce duran bir yayın kuyruğu demek. Yanlış bir isim, kırık bir
-- dağıtımdan ucuzdur; yeter ki YALAN SÖYLEMESİN. Bu not o yüzden burada.
--
-- ══════════════════════════════════════════════════════════════════
-- REELS STORY'DEN NEREDE AYRILIYOR
-- ══════════════════════════════════════════════════════════════════
-- Veritabanı tarafında tek bir gerçek fark var: KAPAK.
--
-- Story'nin kapağı yok, reels'in var ve kapak AYRI BİR DOSYA. Instagram
-- konteyneri `cover_url` diye ayrı bir adres istiyor. Bu yüzden
-- media_url'in yanına ikinci bir sütun giriyor.
--
-- Gerisi (kuyruk, çöküş izi, çift yayın koruması, kota, erteleme,
-- bildirim) tür bağımsız çalışıyordu ve öyle kalıyor. Burada yapılan
-- şey yeni bir sistem kurmak değil, var olanın kapısını bir tür daha
-- açmak.
--
-- ══════════════════════════════════════════════════════════════════
-- EN SESSİZ HATA: publish_at
-- ══════════════════════════════════════════════════════════════════
-- sql/45'teki tetikleyici publish_at'i YALNIZCA type='story' iken
-- dolduruyor, aksi halde null yazıyor. Kuyruk ise `publish_at is not
-- null` arıyor.
--
-- Yani tetikleyici genişletilmezse: kullanıcı reels kaydına otomatik
-- yayını açar, kutucuk açık görünür, kayıt kuyruğa HİÇ DÜŞMEZ ve
-- hiçbir yerde hata çıkmaz. Kuyruk sorgusunu düzeltip tetikleyiciyi
-- unutmak, bu dosyanın en kolay yapılacak hatasıydı.

-- ═══ 1/5 ═══ KAPAK SÜTUNU ═════════════════════════════════════════
begin;

alter table public.calendar_events
  -- Reels kapağı. Public HTTPS, yönlendirmesiz -- media_url ile aynı
  -- kurallar, çünkü Instagram bunu da KENDİSİ çekiyor.
  --
  -- Boş kalabilir: kapak yoksa worker thumb_offset ile videodan kare
  -- aldırıyor. Kapağın yokluğu yayını DURDURMUYOR; duran bir yayın,
  -- kapaksız çıkan bir reel'den kötü.
  add column if not exists cover_url text;

commit;

-- ═══ 2/5 ═══ KUYRUK ═══════════════════════════════════════════════
-- İki değişiklik: reels de alınıyor, ve dönen satıra `type` ile
-- `cover_url` ekleniyor.
--
-- ⚠ `type` NEDEN GEREKLİ: worker şimdiye kadar her kaydın story
-- olduğunu VARSAYIYORDU. Artık varsayamaz -- Instagram konteynerine
-- STORIES mi REELS mi yazacağını bu alandan okuyor. Kuyruk bunu
-- döndürmezse worker her reel'i story olarak yayınlar ve hata
-- vermez: reel 24 saatte kaybolur, kimse de sebebini anlamaz.
--
-- ⚠ DROP GEREKLİ: create or replace dönüş tipini değiştiremiyor.
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
     where e.type in ('story', 'reels')
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

-- ═══ 3/5 ═══ YAYIN ANI TETİKLEYİCİSİ ══════════════════════════════
-- Dosyanın başındaki "en sessiz hata" burada kapanıyor.
begin;

create or replace function public.story_yayin_ani_tazele()
returns trigger
language plpgsql
as $$
begin
  if new.type in ('story', 'reels') then
    new.publish_at := public.story_yayin_ani(new.post_date, new.post_time, new.content);
  else
    -- Tür yayınlanabilir kümeden çıkarıldıysa yayın anı da anlamını
    -- yitiriyor. (Örnek: kullanıcı reels kaydını video'ya çeviriyor.)
    new.publish_at := null;
  end if;
  return new;
end $$;

commit;

-- ═══ 4/5 ═══ SERİ KONTROLÜ TÜRE BAĞLANIYOR ════════════════════════
-- sql/48 seriyi dosya adından tanıyor (<kök>_k<N>) ve aynı platformdaki
-- önceki parçaya bakıyor. Türe bakmıyordu -- story'ler tek başınayken
-- sorun değildi.
--
-- Artık sorun: aynı çekimden hem story hem reel çıkarsa dosya adları
-- aynı kökü paylaşabilir. O zaman yayınlanmamış bir story parçası, hiç
-- ilgisi olmayan bir reel'i bekletir. Kontrol AYNI TÜR içinde kalıyor.
begin;

create or replace function public.story_seri_onceki(p_id text)
returns table(durum text, parca text)
language plpgsql
security definer
set search_path = public
as $$
declare k record; kok text; sira integer;
begin
  select e.user_id, e.platform, e.media_name, e.type
    into k
    from public.calendar_events e
   where e.id = p_id;
  if not found then return; end if;

  kok  := public.story_seri_kok(k.media_name);
  sira := public.story_seri_sira(k.media_name);
  -- Seri değil: tek başına bir kayıt.
  if kok is null or sira is null then return; end if;

  return query
  select case when e.publish_state = 'failed' then 'basarisiz' else 'bekliyor' end,
         e.media_name
    from public.calendar_events e
   where e.type = k.type          -- ⚠ story story'yi, reels reels'i bekletir
     and e.deleted_at is null
     and e.id <> p_id
     and e.user_id = k.user_id
     and e.platform is not distinct from k.platform
     -- Sistemin yayınlamadığı parça bekletmez.
     and e.auto_publish = true
     and public.story_seri_kok(e.media_name)  = kok
     and public.story_seri_sira(e.media_name) < sira
     and e.publish_state <> 'published'
   order by public.story_seri_sira(e.media_name)
   limit 1;
end $$;

revoke all    on function public.story_seri_onceki(text) from public, anon, authenticated;
grant execute on function public.story_seri_onceki(text) to service_role;

commit;

-- ═══ 5/5 ═══ GERİYE DÖNÜK DÜZELTME ════════════════════════════════
-- Zaten duran reels kayıtlarının publish_at'i null. Tetikleyici yalnızca
-- YAZILDIĞINDA çalışıyor, yani bu satırlar bir daha kaydedilmedikçe
-- kuyruğa düşmezdi.
--
-- Yayınlanmışlara DOKUNULMUYOR: onların publish_at'i artık bir plan
-- değil, bir kayıt.
begin;

update public.calendar_events
   set publish_at = public.story_yayin_ani(post_date, post_time, content)
 where type = 'reels'
   and deleted_at is null
   and publish_state <> 'published'
   and publish_at is distinct from public.story_yayin_ani(post_date, post_time, content);

commit;

notify pgrst, 'reload schema';

-- ═══ KONTROL ══════════════════════════════════════════════════════
-- 1) Kuyruk yeni alanları döndürüyor mu? İkisi de true olmalı.
select pg_get_function_result(p.oid) like '%type text%'      as tur_var,
       pg_get_function_result(p.oid) like '%cover_url text%' as kapak_var
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'story_kuyruk_al';

-- 2) Kapak sütunu yerinde mi? 1 satır dönmeli.
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'calendar_events'
   and column_name = 'cover_url';

-- 3) SAATSİZ KALAN VAR MI? Otomatik yayını açık ama publish_at'i boş
--    kayıt -- yani "açık görünüyor ama kuyruğa hiç düşmeyecek" olan.
--    Saati girilmemiş kayıtlar burada çıkar ve bu DOĞRUDUR (sql/45:
--    saatsiz kayıt yayınlanmıyor). 0 değilse önce post_time'a bak.
select type, count(*) as saatsiz
  from public.calendar_events
 where type in ('story', 'reels')
   and auto_publish = true
   and deleted_at is null
   and publish_state <> 'published'
   and publish_at is null
 group by type;

-- 4) Kuyrukta şu an ne bekliyor? (Yayınlamıyor, yalnızca gösteriyor.)
select type, platform, post_date, post_time,
       coalesce(media_name, '(dosyasız)') as dosya,
       case when cover_url is null then '—' else 'var' end as kapak,
       publish_state, attempt_count
  from public.calendar_events
 where type in ('story', 'reels')
   and auto_publish = true
   and deleted_at is null
   and publish_state <> 'published'
 order by publish_at nulls first
 limit 50;
