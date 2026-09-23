-- ═══════════════════════════════════════════════════════════════════
-- sql/48 · SERI: ONCEKI PARCA CIKMADAN SONRAKI CIKMAZ
-- ═══════════════════════════════════════════════════════════════════
-- Cok parcali story'ler birbirini takip ediyor. sql/46 SIRAYI cozdu
-- (hangisi once), sql/47 ARAYI kapatti (kac saniye sonra). Geriye
-- ucuncu soru kaldi: 1/2 hic cikmazsa 2/2 ne olacak?
--
-- Su ana kadarki cevap: cikiyordu. Izleyici "2/2"yi goruyor, "1/2"
-- hic olmamis gibi. sql/46'nin sonundaki "bilinen bosluk" notu buydu.
--
-- SERIYI NEREDEN ANLIYORUZ
--   2026-09-23_story_yedikule_davutpasa_k1.mp4
--   └──────────── kok ────────────────┘ └┘ sira
--
-- Ayni KOK + ayni PLATFORM = ayni seri. Adinda `_k<N>` olmayan dosya
-- tek basina bir story; ona hic dokunulmuyor.
--
-- ⚠ NEDEN publish_at DEGIL. Ilk tasarim "ayni platform + ayni
-- publish_at" idi. Dosya adi daha saglam: niyeti ACIKCA tasiyor.
-- publish_at'in ayni olmasi tesadüf olabilir, `_k1`/`_k2` olamaz.
--
-- ⚠ PLATFORM SERIYE DAHIL. k1'in Instagram kaydi patlayip Facebook
-- kaydi cikmissa, Facebook'un serisi SAGLAM -- FB'de 2/2 cikmali.
-- Platformu seri anahtarina katmasaydik saglam seriyi de keserdik.
--
-- ⚠ auto_publish = false OLAN ONCEKI PARCA BEKLETMIYOR. Onu elle
-- yayinlayacaksin demektir ve sistem ne zaman yaptigini bilemez;
-- bekletseydik sonraki parca sonsuza kadar kuyrukta donerdi.
-- Bilincli bir bosluk, gizli degil.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- Dosya adindan kok ve sira cikaran iki yardimci. Kalip TEK BIR YERDE
-- dursun diye ayri yazildilar: uc ayri regexp'i elle senkron tutmak
-- er gec ayrisir.
create or replace function public.story_seri_kok(p_ad text)
returns text
language sql immutable
set search_path = public
as $$ select case when p_ad ~ '_k[0-9]+\.[A-Za-z0-9]+$'
                 then regexp_replace(p_ad, '_k[0-9]+\.[A-Za-z0-9]+$', '')
                 else null end $$;

create or replace function public.story_seri_sira(p_ad text)
returns integer
language sql immutable
set search_path = public
as $$ select case when p_ad ~ '_k[0-9]+\.[A-Za-z0-9]+$'
                 then ((regexp_match(p_ad, '_k([0-9]+)\.[A-Za-z0-9]+$'))[1])::integer
                 else null end $$;

-- Bu kaydin ONUNDE duran, henuz yayinlanmamis en kucuk sirali parca.
-- Hicbir sey donmezse yol acik demektir.
--   durum = 'basarisiz'  -> onceki parca kalici olarak patladi
--   durum = 'bekliyor'   -> onceki parca henuz cikmadi
create or replace function public.story_seri_onceki(p_id text)
returns table(durum text, parca text)
language plpgsql
security definer
set search_path = public
as $$
declare k record; kok text; sira integer;
begin
  select e.user_id, e.platform, e.media_name
    into k
    from public.calendar_events e
   where e.id = p_id;
  if not found then return; end if;

  kok  := public.story_seri_kok(k.media_name);
  sira := public.story_seri_sira(k.media_name);
  -- Seri degil: tek basina bir story.
  if kok is null or sira is null then return; end if;

  return query
  select case when e.publish_state = 'failed' then 'basarisiz' else 'bekliyor' end,
         e.media_name
    from public.calendar_events e
   where e.type = 'story'
     and e.deleted_at is null
     and e.id <> p_id
     and e.user_id = k.user_id
     and e.platform is not distinct from k.platform
     -- Sistemin yayinlamadigi parca bekletmez (yukaridaki not).
     and e.auto_publish = true
     and public.story_seri_kok(e.media_name)  = kok
     and public.story_seri_sira(e.media_name) < sira
     and e.publish_state <> 'published'
   order by public.story_seri_sira(e.media_name)
   limit 1;
end $$;

-- Worker disindan cagrilmiyor.
revoke all    on function public.story_seri_onceki(text) from public, anon, authenticated;
grant execute on function public.story_seri_onceki(text) to service_role;

commit;

notify pgrst, 'reload schema';

-- ═══ KONTROL ═══════════════════════════════════════════════════════
-- 1) Kalip dogru okunuyor mu?
--    kok = '2026-09-23_story_yedikule_davutpasa', sira = 2,
--    tek_kok ve tek_sira BOS (seri degil)
select public.story_seri_kok('2026-09-23_story_yedikule_davutpasa_k2.mp4')  as kok,
       public.story_seri_sira('2026-09-23_story_yedikule_davutpasa_k2.mp4') as sira,
       public.story_seri_kok('2026-09-22_story_test.jpg')                   as tek_kok,
       public.story_seri_sira('2026-09-22_story_test.jpg')                  as tek_sira;

-- 2) Fonksiyon duruyor mu? 3 satir donmeli.
select routine_name
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('story_seri_kok','story_seri_sira','story_seri_onceki')
 order by routine_name;
