-- 42 — Çöküş sonrası kurtarma izi + sistem durumu
--
-- Şartname Bölüm 8, üçüncü katman ve Bölüm 11'in 10. maddesi:
-- "Worker'ı yayın çağrısının ortasında öldür → çift yayın var mı"
--
-- sql/41 iki katmanı kurmuştu: durum geçişi atomik (iki worker aynı
-- kaydı alamıyor) ve external_id dolu olan kayda dokunulmuyor. Üçüncü
-- katman eksikti ve eksik olan tam da en tehlikeli hâl:
--
--   media_publish çağrısı Meta'ya ULAŞTI, story ÇIKTI, ama yanıt
--   Shootboard'a dönmeden worker öldü.
--
-- O kayıt hâlâ 'in_progress'. Bir sonraki tur onu tekrar alır ve --
-- bu betik olmadan -- aynı story'yi İKİNCİ KEZ yayınlar. Kullanıcı
-- bunu ancak Instagram'da iki aynı story görünce anlar.
--
-- ══════════════════════════════════════════════════════════════════
-- NEDEN İKİ AYRI SÜTUN
-- ══════════════════════════════════════════════════════════════════
--
-- Tek bir "denedim" bayrağı yetmiyor, çünkü çöküş iki farklı yerde
-- olabiliyor ve ikisinin doğru cevabı ZIT:
--
--   publish_ref DOLU, publish_called_at BOŞ
--     Konteyner yaratıldı ama yayın çağrısı HİÇ YAPILMADI.
--     Hiçbir şey çıkmış olamaz. Doğru davranış: aynı konteyneri
--     kaldığı yerden yoklamaya devam et. (Yeni konteyner yaratmak
--     da çalışırdı ama kotadan yiyor ve gereksiz.)
--
--   publish_ref DOLU, publish_called_at DOLU
--     Yayın çağrısı yapıldı, sonucu bilinmiyor. Çıkmış OLABİLİR.
--     Doğru davranış: önce Instagram'a SOR (GET /{ig}/stories),
--     o pencerede bir story varsa yayınlanmış say. Yoksa çıkmamış
--     demektir (story 24 saat duruyor, biz dakikalar içindeyiz) ve
--     aynı konteynerle yayın güvenle tekrarlanabilir.
--
-- Tek bayrakla bu ikisi ayrılamazdı: ya her çöküşte Instagram'a
-- sorulurdu (yavaş, ve hiç yayın yapılmamışken yanlış eşleşme riski)
-- ya da her çöküşte tekrar yayınlanırdı (çift story).

-- ═══ 1/3 ═══ ALANLAR ══════════════════════════════════════════════
begin;

alter table public.calendar_events
  -- Meta'nın konteyner kimliği (creation_id). Konteyner 24 saat
  -- geçerli; o süre içinde aynı kimlikle yayın tekrarlanabiliyor.
  add column if not exists publish_ref       text,
  -- Konteynerin yaratıldığı an. Şartname Bölüm 5 "120 saniye sonra
  -- başarısız say, sonsuz döngü yazma" diyor. O 120 saniye TEK BİR
  -- çağrının içinde ölçülemez: Edge Function'ın kendi süre sınırı
  -- var, worker yoklamanın ortasında kesilip bir sonraki turda devam
  -- ediyor. Süre bellekte tutulsaydı her turda sıfırlanır ve tavan
  -- hiç dolmazdı -- yani "sonsuz döngü yazma" kuralı sessizce
  -- çiğnenirdi. Damga satırda duruyor, turlar arasında yaşıyor.
  add column if not exists publish_ref_at    timestamptz,
  -- media_publish çağrısından HEMEN ÖNCE damgalanıyor. Bu damga
  -- "sonucu bilinmiyor" demek -- "başarılı" demek değil.
  add column if not exists publish_called_at timestamptz;

commit;

-- ═══ 2/3 ═══ SİSTEM DURUMU ════════════════════════════════════════
-- Token sağlık kontrolü günde bir çalışacak (Bölüm 3) ve uyarı
-- e-postası günde birden fazla gitmeyecek. Worker dakikada bir
-- koşuyor; "en son ne zaman baktım, en son ne zaman uyardım" bilgisi
-- bir yerde durmak zorunda. Kod içinde değişken tutmak işe yaramaz:
-- her çağrı yeni bir izolat.
begin;

create table if not exists public.sistem_durumu (
  anahtar    text primary key,
  veri       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Tarayıcıya hiç açılmıyor: yalnızca servis rolü okuyup yazıyor.
-- RLS açık ve TEK BİR POLİTİKA YOK -- yani authenticated hiçbir şey
-- göremiyor. Servis rolü RLS'i atladığı için worker etkilenmiyor.
alter table public.sistem_durumu enable row level security;
revoke all on table public.sistem_durumu from anon, authenticated;

commit;

-- ═══ 3/3 ═══ İZ FONKSİYONLARI ═════════════════════════════════════
begin;

-- Konteyner yaratıldı. publish_called_at BİLEREK sıfırlanıyor: yeni
-- konteyner, henüz hiçbir yayın çağrısı yok.
create or replace function public.story_iz_konteyner(p_id text, p_ref text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.calendar_events
     set publish_ref       = p_ref,
         publish_ref_at    = now(),
         publish_called_at = null,
         updated_at        = now()
   where id = p_id
     and publish_state = 'in_progress';
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Yayın çağrısından HEMEN ÖNCE. Bu satır yazılmadan media_publish
-- çağrılmaz; sıra bozulursa üçüncü katman hiç çalışmaz.
create or replace function public.story_iz_yayin_cagrisi(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.calendar_events
     set publish_called_at = now(),
         updated_at        = now()
   where id = p_id
     and publish_state = 'in_progress';
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- story_kuyruk_al YENİDEN kuruluyor: iki sütun daha döndürmesi
-- gerekiyor. Dönüş tipi değiştiği için "create or replace" yetmiyor,
-- önce düşürmek şart.
drop function if exists public.story_kuyruk_al(integer);
create function public.story_kuyruk_al(p_limit integer default 10)
returns table (
  id text, user_id uuid, media_url text, media_bytes bigint,
  media_mime text, publish_at timestamptz, attempt_count integer,
  idem_key uuid, external_id text, title text, content jsonb,
  publish_ref text, publish_ref_at timestamptz, publish_called_at timestamptz
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
     where e.type = 'story'
       and e.auto_publish = true
       and e.publish_state = 'pending'
       and e.deleted_at is null
       and e.publish_at is not null
       and e.publish_at <= now()
       and (e.retry_after is null or e.retry_after <= now())
       and e.attempt_count < 3
     order by e.publish_at
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
            e.publish_called_at;
end $$;

-- Başarı: iz TEMİZLENİYOR. Kayıt bir daha kuyruğa girmeyecek ama
-- eski bir creation_id orada kalırsa, kullanıcı kaydı yeniden
-- açtığında yanlış konteynere bakılır.
create or replace function public.story_yayinlandi(
  p_id text, p_external_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.calendar_events
     set publish_state     = 'published',
         published_at      = now(),
         external_id       = coalesce(external_id, p_external_id),
         last_error        = null,
         retry_after       = null,
         publish_ref       = null,
         publish_ref_at    = null,
         publish_called_at = null,
         updated_at        = now()
   where id = p_id
     and publish_state = 'in_progress';
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Kalıcı başarısızlıkta iz temizleniyor: o konteyner bir daha
-- kullanılmayacak. Geçici başarısızlıkta DURUYOR, çünkü bir sonraki
-- deneme kaldığı yerden devam etsin -- üçüncü katmanın bütün anlamı
-- bu izin hayatta kalması.
create or replace function public.story_basarisiz(
  p_id text, p_hata text, p_kalici boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer; v_deneme integer; v_son boolean;
begin
  select attempt_count into v_deneme
    from public.calendar_events where id = p_id;
  v_son := p_kalici or coalesce(v_deneme, 3) >= 3;

  update public.calendar_events
     set publish_state = case when v_son then 'failed' else 'pending' end,
         last_error  = left(coalesce(p_hata, ''), 2000),
         retry_after = case
           when p_kalici then null
           when coalesce(v_deneme, 0) = 1 then now() + interval '1 minute'
           when coalesce(v_deneme, 0) = 2 then now() + interval '5 minutes'
           else now() + interval '15 minutes' end,
         publish_ref       = case when v_son then null else publish_ref end,
         publish_ref_at    = case when v_son then null else publish_ref_at end,
         publish_called_at = case when v_son then null else publish_called_at end,
         updated_at  = now()
   where id = p_id
     and publish_state = 'in_progress';
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ══════════════════════════════════════════════════════════════════
-- ASILI KALAN KAYITLARI GERİ AL
-- ══════════════════════════════════════════════════════════════════
-- Bu fonksiyon olmadan üçüncü katman HİÇ ÇALIŞMIYOR ve bu, testi
-- yazarken ortaya çıktı.
--
-- Worker bir kaydı alırken 'in_progress' yapıyor. Çökerse kayıt orada
-- kalıyor. Bölüm 4'teki kuyruk sorgusu ise yalnızca 'pending' arıyor --
-- yani çöken kayıt bir daha ASLA alınmıyor. Kurtarma kodu kusursuz
-- olsa bile çalışacağı an hiç gelmiyor: story sessizce yayınlanmamış
-- oluyor ve kimse fark etmiyor. Tam olarak Bölüm 9'un yasakladığı şey.
--
-- Eşik cömert (varsayılan 10 dakika): tur bütçesi 110 saniye, en uzun
-- konteyner bekleyişi 120 saniye. 10 dakikadır kıpırdamayan bir kayıt
-- çalışan bir worker'ın elinde değildir.
--
-- attempt_count'a DOKUNULMUYOR: o deneme gerçekten yapıldı. İz
-- (publish_ref / publish_called_at) da DURUYOR -- zaten kurtarmanın
-- okuyacağı tek şey o.
create or replace function public.story_asili_topla(p_dakika integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.calendar_events
     set publish_state = 'pending',
         updated_at    = now()
   where type = 'story'
     and publish_state = 'in_progress'
     and deleted_at is null
     and updated_at < now() - make_interval(mins => greatest(p_dakika, 1));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.story_asili_topla(integer)         from public, anon, authenticated;
revoke all on function public.story_iz_konteyner(text, text)     from public, anon, authenticated;
revoke all on function public.story_iz_yayin_cagrisi(text)        from public, anon, authenticated;
revoke all on function public.story_kuyruk_al(integer)            from public, anon, authenticated;
revoke all on function public.story_yayinlandi(text, text)        from public, anon, authenticated;
revoke all on function public.story_basarisiz(text, text, boolean) from public, anon, authenticated;

-- ⚠ REVOKE'DAN SONRA GRANT ŞART.
-- Yukarıdaki "revoke ... from public" varsayılan çalıştırma iznini
-- HERKESTEN alıyor -- servis rolü dahil. Servis rolü RLS'i atlıyor ama
-- fonksiyon izni ayrı bir şey; bu satırlar olmadan worker'ın her çağrısı
-- "permission denied for function story_kuyruk_al" ile döner ve kuyruk
-- sessizce hiç işlenmez. sql/41 bu grant'ları yazmamıştı.
grant execute on function public.story_asili_topla(integer)          to service_role;
grant execute on function public.story_iz_konteyner(text, text)      to service_role;
grant execute on function public.story_iz_yayin_cagrisi(text)        to service_role;
grant execute on function public.story_kuyruk_al(integer)            to service_role;
grant execute on function public.story_yayinlandi(text, text)        to service_role;
grant execute on function public.story_basarisiz(text, text, boolean) to service_role;
grant execute on function public.story_ertele(text, integer, text)   to service_role;
grant all    on table    public.sistem_durumu                        to service_role;

commit;

-- PostgREST şema önbelleğini tazele: yeni fonksiyonlar /rest/v1/rpc
-- altında görünsün. Bu satır olmadan worker bir süre 404 alabilir.
notify pgrst, 'reload schema';

-- ═══ KONTROL ══════════════════════════════════════════════════════
-- İki sütun eklendi mi? Boş dönerse 1/3 patlamıştır.
select column_name
  from information_schema.columns
 where table_schema = 'public' and table_name = 'calendar_events'
   and column_name in ('publish_ref','publish_ref_at','publish_called_at')
 order by column_name;
-- 3 satır dönmeli.

-- Yedi fonksiyon duruyor mu?
select routine_name
  from information_schema.routines
 where routine_schema = 'public' and routine_name like 'story\_%'
 order by routine_name;
-- 7 satır: story_asili_topla, story_basarisiz, story_ertele,
-- story_iz_konteyner, story_iz_yayin_cagrisi, story_kuyruk_al,
-- story_yayinlandi

-- Sistem durumu tablosu kuruldu mu?
select count(*) as sistem_durumu_var
  from information_schema.tables
 where table_schema = 'public' and table_name = 'sistem_durumu';
-- 1 dönmeli.
