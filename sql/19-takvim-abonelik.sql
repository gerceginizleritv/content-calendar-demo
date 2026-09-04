-- =====================================================================
-- TAKVIM ABONELIGI ICIN DEPOLAMA KOVASI
-- =====================================================================
-- Termin hatirlatmalarinin takvim bacagi bir ".ics" ABONELIGI olarak
-- calisiyor: kullanici adresi telefonunun/Google'in takvimine BIR KEZ
-- ekliyor, sonrasinda hatirlatmayi takvim uygulamasinin kendisi yapiyor.
--
-- NEDEN DOSYA INDIRME DEGIL:
-- Indirilen bir .ics dosyasi Google Takvim'e ayri ayri OLAY olarak girer;
-- kaldirmak icin kullanicinin o olaylari TEK TEK silmesi gerekir. Abonelik
-- ise tek kalemde iptal edilir. Kullanici bu farki bizzat yasadigi icin
-- (3 Eylul 2026) abonelik ANA YOL, dosya indirme yalnizca uyarili yedek.
--
-- NEDEN EDGE FUNCTION DEGIL:
-- Google Takvim, "text/calendar" donduren ve baslik (header) istemeyen bir
-- adres istiyor. Supabase'in hazir REST arayuzu JSON donduruyor ve apikey
-- basligi istiyor; GitHub Pages ise statik. Ucuncu yol Storage: dosyayi
-- dogru Content-Type ile herkese acik bir adresten suniyor. Uygulama .ics
-- metnini uretip buraya yaziyor, adres sabit kaliyor, terminler degisince
-- dosya guncelleniyor. Sunucu tarafi kod GEREKMIYOR.
--
-- GUVENLIK — burada dusunulmesi gereken tek sey:
-- Kova HERKESE ACIK okumaya. Yani adresi bilen dosyayi okur. Adres
-- tahmin edilemez olsun diye dosya adi rastgele bir jeton (UUID):
--   takvim/<kullanici-id>/<jeton>.ics
-- Kullanici adresi paylastiysa ya da sizdiysa tek care jetonu yenilemek;
-- arayuzde "Baglantiyi yenile / iptal et" dugmesi bunu yapiyor (eski
-- dosyayi siler, yenisini yazar, eski adres olur).
--
-- Ayrica: dosyanin ICINE yalnizca proje adi, adim adi ve tarih giriyor.
-- Script metni, aciklama, hesap adlari GIRMIYOR. Adres sizsa bile
-- kullanicinin icerigi disariya cikmiyor.
--
-- Supabase panelinde: SQL Editor -> New query -> yapistir -> Run.
-- =====================================================================

-- 1) Kova. Herkese acik okuma; yazma asagidaki politikalarla sinirli.
--    5 MB dosya siniri: bir .ics bunun binde biri kadar, kotu niyetli
--    yuklemeye karsi ust sinir.
--    Izinli tur listesinde IKI yazilis da var: tarayici dosyayi
--    "text/calendar; charset=utf-8" olarak gonderiyor, listede yalnizca
--    "text/calendar" olsaydi yukleme reddedilebilirdi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('takvim', 'takvim', true, 5242880,
        array['text/calendar', 'text/calendar; charset=utf-8'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['text/calendar', 'text/calendar; charset=utf-8'];

-- 2) Politikalar. Her kullanici YALNIZCA kendi kullanici-id'si adindaki
--    klasore yazabiliyor. storage.foldername(name) yol parcalarini dizi
--    olarak veriyor; ilk parca klasor adi.
--
--    Tekrar calistirilabilir olsun diye once dusuruluyor.

drop policy if exists "takvim: kendi klasorune yazar"     on storage.objects;
drop policy if exists "takvim: kendi dosyasini gunceller" on storage.objects;
drop policy if exists "takvim: kendi dosyasini siler"     on storage.objects;

create policy "takvim: kendi klasorune yazar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'takvim'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "takvim: kendi dosyasini gunceller"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'takvim'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "takvim: kendi dosyasini siler"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'takvim'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Okuma politikasi YAZILMIYOR: kova public olduğu icin okuma zaten
-- anonim olarak calisiyor. Abonelik adresinin basliksiz istekle
-- okunabilmesi tam olarak buna dayaniyor.

-- =====================================================================
-- GERI ALMA
-- =====================================================================
-- Aboneligi tumden kapatmak isterseniz:
--
--   delete from storage.objects where bucket_id = 'takvim';
--   delete from storage.buckets where id = 'takvim';
--   drop policy if exists "takvim: kendi klasorune yazar"     on storage.objects;
--   drop policy if exists "takvim: kendi dosyasini gunceller" on storage.objects;
--   drop policy if exists "takvim: kendi dosyasini siler"     on storage.objects;
--
-- Kullanicilarin takvimlerindeki abonelik o anda "bulunamadi" durumuna
-- duser; olaylar kendiliginden kaybolur, veri kaybi olmaz.
