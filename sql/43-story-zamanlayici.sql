-- 43 — Dakikada bir çalışan zamanlayıcı (pg_cron + pg_net)
--
-- Şartname Bölüm 4: "Dakikada bir çalışan worker."
--
-- Worker bir Edge Function (supabase/functions/story-yayin). Onu
-- dakikada bir çağıracak birinin olması gerekiyor ve Supabase'de o
-- birisi veritabanının kendisi: pg_cron zamanı tutuyor, pg_net HTTP
-- isteğini atıyor.
--
-- ══════════════════════════════════════════════════════════════════
-- ⚠ ÖNCE OKU — BU BETİK GİZLİ ANAHTAR İÇERMİYOR
-- ══════════════════════════════════════════════════════════════════
-- Anahtar bu dosyaya YAZILMAZ: depo herkese açık. Supabase Vault'ta
-- duruyor ve cron işi oradan okuyor. Aşağıda iki yerde <...> var,
-- ikisini de SQL Editor'da kendi değerinle değiştirip çalıştırıyorsun.
-- Değiştirdiğin hâlini hiçbir yere yapıştırma -- bu sohbete de.
--
-- ══════════════════════════════════════════════════════════════════
-- ⚠ ÜCRETSİZ KATMAN BU İŞİ TAŞIMIYOR
-- ══════════════════════════════════════════════════════════════════
-- Ücretsiz Supabase projesi bir haftalık hareketsizlikten sonra
-- duraklatılıyor. Dakikada bir koşan bu cron işi projeyi büyük
-- olasılıkla ayakta tutar -- ama "büyük olasılıkla" bir güvence değil
-- ve yedek yok. Story 24 saatlik; kaçan gün geri gelmez. Sistem
-- çalışır, vaadi ücretli katmana geçmeden tutmaz.

-- ═══ 1/4 ═══ EKLENTİLER ═══════════════════════════════════════════
-- Supabase panelinde Database → Extensions altından da açılabilir.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;

-- ═══ 2/4 ═══ GİZLİ ANAHTAR ════════════════════════════════════════
-- Edge Function'ın STORY_WORKER_SECRET gizli ayarıyla AYNI değer.
-- Uzun ve rastgele olsun; bu uç JWT doğrulamıyor, tek kapı bu.
--
-- Üretmek için (tarayıcı konsolu):
--   crypto.randomUUID() + crypto.randomUUID()
--
-- <BURAYA-GIZLI-ANAHTAR> yerine o değeri koy. İKİ YERDE geçiyor;
-- ikisini de değiştir.
--
-- Düz bir create_secret çağrısı, betik ikinci kez çalıştırıldığında
-- "duplicate key" ile patlar -- ve bu betikte bir hatanın bedeli ağır:
-- SQL Editor hepsini tek işlemde koşuyor, sondaki bir hata baştaki
-- kurulumu da geri alıyor. Onun için varsa günceller, yoksa yaratır.
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'story_worker_secret';
  if v_id is null then
    perform vault.create_secret(
      '<BURAYA-GIZLI-ANAHTAR>',
      'story_worker_secret',
      'story-yayin Edge Function çağrısının x-webhook-secret başlığı');
  else
    perform vault.update_secret(v_id, '<BURAYA-GIZLI-ANAHTAR>');
  end if;
end $$;

-- ═══ 3/4 ═══ İŞ ═══════════════════════════════════════════════════
-- Önce varsa eskisini kaldır: bu betik tekrar çalıştırılabilir olsun
-- ve iki kopya aynı anda koşmasın.
select cron.unschedule('story-yayin')
 where exists (select 1 from cron.job where jobname = 'story-yayin');

-- <PROJE-REF> yerine kendi proje kimliğin (Supabase → Settings →
-- General → Reference ID; app.html'deki SUPABASE_URL'in içinde de var).
select cron.schedule(
  'story-yayin',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJE-REF>.supabase.co/functions/v1/story-yayin',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret',
                 (select decrypted_secret from vault.decrypted_secrets
                   where name = 'story_worker_secret')),
    body    := '{}'::jsonb,
    -- Worker'ın kendi süre bütçesi 110 saniye; buranın ondan uzun
    -- olması gerekiyor, yoksa iş biterken bağlantı kesilir.
    timeout_milliseconds := 150000
  );
  $$
);

-- ═══ 4/4 ═══ KONTROL ══════════════════════════════════════════════
-- İş kuruldu mu?
select jobid, jobname, schedule, active
  from cron.job
 where jobname = 'story-yayin';
-- 1 satır, active = true olmalı.

-- Son koşular (cron'un kendi kaydı: isteği ATABİLDİ Mİ, cevabı değil).
--
-- DİKKAT: cron.job_run_details'te jobname SÜTUNU YOK -- yalnızca jobid var.
-- Burada bir kez 'where jobname = ...' yazıldı ve betik "column jobname
-- does not exist" ile patladı. SQL Editor betiğin tamamını tek işlemde
-- çalıştırdığı için Vault kaydı ve cron işi de birlikte geri alındı:
-- sondaki bir kontrol sorgusu, baştaki kurulumu iptal etti.
select d.status, d.start_time, d.return_message
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
 where j.jobname = 'story-yayin'
 order by d.start_time desc
 limit 5;

-- Worker NE CEVAP VERDİ. Asıl bakılacak yer burası: pg_net isteği
-- atıp bırakıyor, yanıt bu tabloya düşüyor. 401 görürsen anahtar
-- uyuşmuyordur, 404 görürsen fonksiyon adresi yanlıştır.
select id, status_code,
       left(content, 300) as cevap,
       created
  from net._http_response
 order by created desc
 limit 5;

-- Kuyruğun hâli.
select publish_state, count(*), min(publish_at) as en_yakin
  from public.calendar_events
 where type = 'story' and auto_publish = true and deleted_at is null
 group by publish_state
 order by publish_state;

-- İşi DURDURMAK için:
--   select cron.unschedule('story-yayin');
