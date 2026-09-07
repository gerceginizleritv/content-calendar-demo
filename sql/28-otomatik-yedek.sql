-- 28 — Otomatik günlük yedek için depolama kovası
--
-- Neden: Supabase'in ÜCRETSİZ katmanında otomatik yedek YOK (Pro'da
-- günlük yedek var, yedi gün saklanıyor). Elle alınan yedek yalnızca
-- alan kişiyi korur; deneme kullanıcılarının çoğu hiç almaz ve ilk veri
-- kaybını onlar yaşar.
--
-- Uygulama artık günde bir kez, açılışta, hesabın bütün verisini JSON
-- olarak buraya yazıyor. Son yedi gün duruyor, eskisi siliniyor.
-- Kullanıcının hiçbir şey yapması gerekmiyor.
--
-- Sınırı açıkça yazıyorum: bu yedek AYNI Supabase projesinde duruyor.
-- Yanlışlıkla silmeye, bozuk bir eşitlemeye, "dün neredeydi" sorusuna
-- karşı koruyor; projenin kendisi giderse yedek de gider. Projeden
-- bağımsız kopya için uygulamadaki "Yedek Dışa Aktar" duruyor.
--
-- Kova ÖZEL (public değil): yedekte kullanıcının bütün işi var, kimse
-- adres tahmin ederek okuyamamalı.
--
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.
-- Tekrar çalıştırılabilir.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('yedek', 'yedek', false, 26214400,
        array['application/json', 'application/json; charset=utf-8'])
on conflict (id) do update
  set public = false,
      file_size_limit = 26214400,
      allowed_mime_types = array['application/json', 'application/json; charset=utf-8'];

-- Tek politika, dört işlem için. Herkes YALNIZCA kendi klasöründe:
-- okuma da yazma da silme de. Kova özel olduğu için giriş yapmamış
-- kimse hiçbir şey göremiyor.
drop policy if exists "yedek: kendi klasoru" on storage.objects;
create policy "yedek: kendi klasoru"
  on storage.objects for all to authenticated
  using      (bucket_id = 'yedek' and name like auth.uid()::text || '/%')
  with check (bucket_id = 'yedek' and name like auth.uid()::text || '/%');

-- Kontrol
select id, public, file_size_limit from storage.buckets where id = 'yedek';
