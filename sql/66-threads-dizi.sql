-- ══════════════════════════════════════════════════════════════════
-- 66 — ÇOK PARÇALI THREADS DİZİSİ (16 Ekim 2026)
-- ══════════════════════════════════════════════════════════════════
-- NE YAPIYOR
-- Bir Threads gönderisinin altına, sırayla, birden çok parça
-- ekliyor: 1. parça kaydın kendisi (caption), 2. parça onun altına
-- yanıt, 3. parça 2.'nin altına... Zincir böyle kuruluyor çünkü
-- Threads'te "dizi" diye bir şey yok; yalnızca YANIT var
-- (`reply_to_id`).
--
-- Parçalar `content.dizi` dizisinde duruyor (2. parçadan itibaren).
--
-- ⛔ BU DOSYA sql/65'İN TABLOSUNU VE İKİ İŞLEVİNİ DEĞİŞTİRİYOR.
-- sql/65 bir kayıt için TEK satır varsayıyordu (`unique (kayit_id)`);
-- dizide bir kayıt için N satır gerekiyor. Eklenen iki sütun:
--   `tur`  = 'cevap' | 'dizi'   (anketin cevabı mı, dizinin parçası mı)
--   `sira` = parça numarası     (cevapta 0, dizide 1..N)
-- ve kısıt `unique (kayit_id, tur, sira)` oldu.
--
-- ⚠ YENİDEN KOŞTURMA TUZAĞI — OKU:
--   sql/65'i yeniden koşturursan `threads_yanit_kuyruga_al` ve
--   `threads_yanit_al` ESKİ hallerine döner. Eski kuyruğa alma
--   `on conflict (kayit_id)` diyor ve o kısıt artık YOK: işlev
--   HATA VERİR, yani anket cevapları ve diziler durur.
--   ÇÖZÜM: sql/65'ten sonra BU DOSYAYI da yeniden koştur.
--   (Tablo `create table if not exists` olduğu için sütunlar
--   kaybolmuyor; kaybolan şey iki işlev.)
--
-- ⚠ SIRA ŞARTI: PARÇA N, N-1 ÇIKMADAN GİTMEZ.
-- Gerekçe sql/48'deki story serisinin aynısı: eksik bir zincir,
-- hiç olmayan zincirden kötü -- okuyan kişi 3. parçayı 1.'nin
-- cevabı sanıyor. Ayrıca teknik zorunluluk: N'nin yanıt yazacağı
-- gönderi kimliği, N-1 yayınlanmadan YOK.
--
-- ⚠ ÜÇÜNCÜ PARÇA PATLARSA İLK İKİSİ YENİDEN GİTMİYOR. Her parça
-- KENDİ satırı ve kendi durumu; 'published' olan satır bir daha
-- alınmıyor. Kullanıcının sorduğu tam buydu.
--
-- GECİKME YOK. Dizi parçaları yayından hemen sonra, sırayla gidiyor
-- (anketin cevabı gibi 24 saat beklemiyor): zincirin arası açılırsa
-- okuyan kişi devamını hiç görmüyor.
-- ══════════════════════════════════════════════════════════════════


-- ═══ KONTROL — ÖNCE BUNU KOŞTUR ═══════════════════════════════════
-- Dizisi yazılı kayıtlar. BEKLENEN: 0 satır, ya da yalnızca bilerek
-- hazırladıkların. Beklemediğin bir satır varsa aşağıyı koşturmadan
-- önce ona bak: bu dosya koşunca onun parçaları da kuyruğa girer.
select post_date, post_time, platform, type, title,
       jsonb_array_length(coalesce(content->'dizi', '[]'::jsonb)) as parca,
       publish_state
  from public.calendar_events
 where platform = 'threads'
   and deleted_at is null
   and coalesce(jsonb_array_length(coalesce(content->'dizi', '[]'::jsonb)), 0) > 0
 order by post_date, post_time;


-- ═══ DEĞİŞİKLİK ═══════════════════════════════════════════════════
begin;

alter table public.threads_yanitlari
  add column if not exists tur  text    not null default 'cevap',
  add column if not exists sira integer not null default 0;

-- ⛔ HEDEF ARTIK BOŞ BAŞLAYABİLİYOR, VE BUNU GERÇEK BİR KOŞUM BULDU.
-- sql/65'te `ana_gonderi_id` NOT NULL'du: bir cevap satırı yazılırken
-- altına yanıt yazılacak gönderi hep biliniyordu (anketin kendisi).
-- Dizide 2. parçanın hedefi KUYRUĞA GİRERKEN YOK -- o kimlik 1. parça
-- yayınlandığında doğuyor. NOT NULL kalsaydı kuyruğa alma işlevi
-- hata verir ve HEM diziler HEM anket cevapları durur, çünkü ikisi
-- aynı işlevde.
--
-- ⚠ GÜVENLİK AĞI NEREYE GİTTİ: NOT NULL yerine iki koruma var.
-- (1) `threads_yanit_al` bir satırı yalnızca hedefi belli ise alıyor
--     (ya kendi ana_gonderi_id'si dolu, ya önceki parça yayınlanmış ve
--     gönderi kimliği var) ve aldığı an hedefi satıra YAZIYOR.
-- (2) worker, hedefi boş bir satırı YAYINLAMIYOR: kalıcı hata yazıyor.
--     Gerekçe ciddi -- `reply_to_id` olmadan atılan bir dizi parçası
--     profilde BAĞIMSIZ BİR GÖNDERİ olarak çıkar ve geri alınamaz.
alter table public.threads_yanitlari alter column ana_gonderi_id drop not null;

-- Eski kayıtlar 'cevap'/0 olarak kalıyor; varsayılanlar o yüzden böyle.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'threads_yanitlari_tur_gecerli') then
    alter table public.threads_yanitlari
      add constraint threads_yanitlari_tur_gecerli check (tur in ('cevap', 'dizi'));
  end if;
end $$;

-- ⚠ ESKİ KISIT GİDİYOR: bir kayıt için artık N satır olabiliyor.
-- Adı Postgres'in ürettiği addır (tablo_sutun_key); ikisini de
-- deniyoruz ki elle yaratılmış bir ada da takılmasın.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'threads_yanitlari_kayit_id_key') then
    alter table public.threads_yanitlari drop constraint threads_yanitlari_kayit_id_key;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'threads_yanitlari_kayit_tur_sira_key') then
    alter table public.threads_yanitlari
      add constraint threads_yanitlari_kayit_tur_sira_key unique (kayit_id, tur, sira);
  end if;
end $$;

-- ---- KUYRUĞA ALMA: cevap + dizi -----------------------------------------
-- ⚠ İKİ İŞ BİR İŞLEVDE ve bu kasıtlı: ikisi de "yayınlanmış bir
-- Threads kaydının altına ne eklenecek" sorusunu cevaplıyor ve ikisi
-- de aynı kuyruğa yazıyor. Ayrı işlevler olsaydı biri güncellenip
-- öteki kalırdı -- bu depoda en pahalı hata sınıfı tam bu.
create or replace function public.threads_yanit_kuyruga_al()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer; m integer;
begin
  -- ---- 1) ANKETİN CEVABI (tur='cevap', sira=0) ----
  insert into public.threads_yanitlari
    (user_id, kayit_id, tur, sira, ana_gonderi_id, metin, gonderilecek_an)
  select e.user_id, e.id, 'cevap', 0, e.external_id,
         btrim(e.content->>'anketCevap'),
         coalesce(e.published_at, now())
           + make_interval(hours => least(greatest(
               coalesce((e.content->>'anketCevapGecikme')::numeric, 24)::integer, 1), 168))
    from public.calendar_events e
   where e.type = 'poll'
     and e.platform = 'threads'
     and e.deleted_at is null
     and e.publish_state = 'published'
     and e.external_id is not null
     and btrim(coalesce(e.content->>'anketCevap', '')) <> ''
     and coalesce(e.published_at, now()) > now() - interval '7 days'
  on conflict (kayit_id, tur, sira) do nothing;
  get diagnostics n = row_count;

  -- ---- 2) DİZİ PARÇALARI (tur='dizi', sira=1..N) ----
  -- ⚠ ANA GÖNDERİ KİMLİĞİ YALNIZCA 1. PARÇADA DOLU. Sonraki
  -- parçaların yanıt yazacağı gönderi henüz YOK; onu
  -- `threads_yanit_al` bir önceki parça yayınlandığında dolduruyor.
  insert into public.threads_yanitlari
    (user_id, kayit_id, tur, sira, ana_gonderi_id, metin, gonderilecek_an)
  select e.user_id, e.id, 'dizi', p.sira::integer,
         case when p.sira = 1 then e.external_id else null end,
         btrim(p.metin),
         coalesce(e.published_at, now())
    from public.calendar_events e
    -- ⛔ NUMARALANDIRMA BOŞLUKLARI ATTIKTAN SONRA, VE BUNU GERÇEK BİR
    -- KOŞUM BULDU. İlk sürüm dizideki sırayı (ordinality) olduğu gibi
    -- kullanıp boş parçaları süzüyordu: 2. parça boşsa satırlar 1,3,4
    -- oluyordu. Sıra şartı "önceki parça yayınlanmış olsun" diyor ve
    -- 3. parçanın öncesi (2) HİÇ YOKTU -- zincir sonsuza kadar
    -- kilitlenirdi, hem de sessizce. row_number boşlukları kapatıyor.
    cross join lateral (
      select btrim(t.metin) as metin,
             row_number() over (order by t.sira) as sira
        from jsonb_array_elements_text(
               case when jsonb_typeof(e.content->'dizi') = 'array'
                    then e.content->'dizi' else '[]'::jsonb end)
             with ordinality as t(metin, sira)
       where btrim(coalesce(t.metin, '')) <> ''
    ) p
   where e.platform = 'threads'
     and e.type in ('text_post', 'poll')
     and e.deleted_at is null
     and e.publish_state = 'published'
     and e.external_id is not null
     and coalesce(e.published_at, now()) > now() - interval '7 days'
     -- ⛔ ON PARÇA TAVANI. Kaza eseri dev bir dizi (ya da yanlış alana
     -- yazılmış bir metin) onlarca yanıt üretmesin. Tavan, boşlar
     -- atıldıktan SONRAKİ sayıya göre: 1..10 arası, boşluksuz.
     and p.sira <= 10
  on conflict (kayit_id, tur, sira) do nothing;
  get diagnostics m = row_count;

  return coalesce(n, 0) + coalesce(m, 0);
end $$;

-- ---- ALMA: sıra şartı ve zincirin bağlanması -----------------------------
-- ⚠ `tur` ve `sira` DA DÖNÜYOR: worker'ın logunda "dizi 2/5" yazması
-- için. Sayı olmadan log "bir yanıt gitti" diyor ve hangi parçanın
-- gittiği teşhis anında bilinmiyordu.
--
-- ⛔ DROP ŞART, VE BUNU GERÇEK BİR KOŞUM BULDU: `create or replace`
-- bir işlevin DÖNÜŞ TİPİNİ değiştiremiyor ("cannot change return type
-- of existing function"). sql/65 yedi sütun döndürüyordu, bu dosya
-- dokuz döndürüyor. Drop olmadan bu dosya HİÇ uygulanmıyor -- dosya
-- bir işlem (begin/commit) içinde olduğu için her şey geri alınıyor,
-- yani yarım bir kurulum kalmıyor ama dizi de hiç çalışmıyordu.
-- Aynı desen sql/56 ve sql/58'de de var (story_kuyruk_al).
drop function if exists public.threads_yanit_al(integer);
create function public.threads_yanit_al(p_limit integer default 3)
returns table(
  id uuid, user_id uuid, kayit_id text, tur text, sira integer,
  ana_gonderi_id text, metin text, cagri_ani timestamptz, deneme integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with sira as (
    select y.id,
           -- Zincirin halkası: 1. parçada kaydın kendi gönderisi
           -- (kuyruğa alırken yazıldı), sonraki parçalarda BİR
           -- ÖNCEKİ PARÇANIN çıkan gönderisi.
           coalesce(y.ana_gonderi_id, o.gonderi_id) as hedef
      from public.threads_yanitlari y
      left join public.threads_yanitlari o
             on o.kayit_id = y.kayit_id
            and o.tur = y.tur
            and o.sira = y.sira - 1
     where y.durum = 'pending'
       and y.gonderilecek_an <= now()
       and (y.tekrar_sonra is null or y.tekrar_sonra <= now())
       and y.deneme < 3
       -- ⛔ SIRA ŞARTI: önceki parça YAYINLANMADAN bu parça gitmiyor.
       -- Eksik zincir, hiç olmayan zincirden kötü (sql/48 dersi); ve
       -- yanıt yazılacak gönderi kimliği de ondan geliyor.
       and (y.ana_gonderi_id is not null
            or (o.id is not null and o.durum = 'published'
                and coalesce(o.gonderi_id, '') <> ''))
     order by y.gonderilecek_an, y.tur, y.sira
     limit greatest(coalesce(p_limit, 3), 1)
     for update of y skip locked
  )
  update public.threads_yanitlari y
     set durum = 'in_progress',
         deneme = y.deneme + 1,
         -- Hedef satıra YAZILIYOR: bir sonraki tur (çöküş sonrası)
         -- aynı hedefi görsün, zinciri yeniden hesaplamak zorunda
         -- kalmasın.
         ana_gonderi_id = s.hedef,
         guncelleme = now()
    from sira s
   where y.id = s.id
  returning y.id, y.user_id, y.kayit_id, y.tur, y.sira, y.ana_gonderi_id,
            y.metin, y.cagri_ani, y.deneme;
end $$;

revoke all   on function public.threads_yanit_kuyruga_al() from public, anon, authenticated;
revoke all   on function public.threads_yanit_al(integer)  from public, anon, authenticated;
grant execute on function public.threads_yanit_kuyruga_al() to service_role;
grant execute on function public.threads_yanit_al(integer)  to service_role;

commit;


-- ══ DOĞRULAMA — ayrı çalıştır ══════════════════════════════════════
-- Beklenen: üçü de OK.
select 'sutunlar' as ne,
       case when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = 'threads_yanitlari'
                     and column_name in ('tur', 'sira')) = 2
       then 'OK' else 'YOK' end as durum
union all
select 'yeni kisit',
       case when exists (select 1 from pg_constraint
         where conname = 'threads_yanitlari_kayit_tur_sira_key')
       then 'OK' else 'YOK' end
union all
select 'eski kisit kaldirildi',
       case when not exists (select 1 from pg_constraint
         where conname = 'threads_yanitlari_kayit_id_key')
       then 'OK' else 'YOK' end
union all
select 'hedef bos olabiliyor (dizi icin sart)',
       case when (select is_nullable from information_schema.columns
                   where table_schema = 'public' and table_name = 'threads_yanitlari'
                     and column_name = 'ana_gonderi_id') = 'YES'
       then 'OK' else 'YOK' end;
