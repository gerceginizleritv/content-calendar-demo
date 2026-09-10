-- 25 — Paylaşılabilir salt-okunur takvim
--
-- Ne işe yarar: ekibe ya da müşteriye "şu hafta neler çıkıyor" diye
-- gösterirken ekran görüntüsü göndermek yerine bir bağlantı verilebilsin.
-- Bağlantıyı açan kişi yalnızca OKUR: hesabı yok, hiçbir şey değiştiremez.
--
-- Nasıl çalışıyor: uygulama takvimin bir kopyasını JSON olarak bu kovaya
-- yazıyor; paylas.html o dosyayı okuyup çiziyor. Dosyanın adı tahmin
-- edilemeyecek uzunlukta rastgele bir jeton — bağlantıyı bilmeyen bulamaz.
-- Bağlantı kapatıldığında dosya siliniyor ve adres ölüyor.
--
-- Not: bu sql/19'daki "takvim" kovasının aynısı DEĞİL. O kova takvim
-- aboneliği (.ics) için ve yalnızca text/calendar kabul ediyor.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('paylasim', 'paylasim', true, 5242880,
        array['application/json', 'application/json; charset=utf-8'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/json', 'application/json; charset=utf-8'];

-- Tek politika, dort islem icin. Kullanici YALNIZCA kendi klasorunde
-- calisabiliyor; okuma zaten herkese acik (kova public).
drop policy if exists "paylasim: kendi klasoru" on storage.objects;
create policy "paylasim: kendi klasoru"
  on storage.objects for all to authenticated
  using      (bucket_id = 'paylasim' and name like auth.uid()::text || '/%')
  with check (bucket_id = 'paylasim' and name like auth.uid()::text || '/%');

commit;

-- Kontrol
select id, public, allowed_mime_types from storage.buckets where id = 'paylasim';
