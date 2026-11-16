-- ═══════════════════════════════════════════════════════════════════
-- 72 — PUSH BİLDİRİMİ ZAMANLAYICISI (16 Kasım 2026)
-- ═══════════════════════════════════════════════════════════════════
--
-- NE EKLİYOR
--   Saatte bir `push-gonder` Edge Function'ını çağıran bir cron işi.
--   Fonksiyon kimin saatinin geldiğine KENDİ karar veriyor; bu dosya
--   yalnızca kapıyı düzenli olarak çalıyor.
--
-- NEYİ GERİ ALMIYOR
--   Hiçbir şeyi. Yalnızca 'push-gonder' adlı cron işini kuruyor.
--   sql/43'teki 'story-yayin' işine DOKUNMUYOR — ayrı ad, ayrı iş.
--   Tekrar çalıştırılması güvenli: önce varsa eskisini kaldırıyor.
--
-- ÖN KOŞUL
--   sql/71 çalıştırılmış olmalı (push_abonelikleri tablosu).
--   push-gonder fonksiyonu dağıtılmış olmalı.
--   Adımların tamamı: supabase/functions/push-gonder/README.md
--
-- ⛔ NEDEN SAATTE BİR, DAKİKADA BİR DEĞİL
--   Kullanıcılar farklı saat dilimlerinde ve herkesin kendi hatırlatma
--   saati var. Fonksiyon "bu kullanıcının saati geldi mi" diye bakıyor
--   ve bir güne bir bildirim gönderiyor (son_gonderim_gunu). Saatte bir
--   koşmak yeterli; dakikada bir koşmak aynı işi 60 kat tekrarlardı.
--   Bedeli: bildirim, ayarlanan saatten en geç 59 dakika sonra gider.
--
-- ⛔ SQL EDITOR BETİĞİN TAMAMINI TEK İŞLEMDE ÇALIŞTIRIYOR.
--   sql/43'te tam bu yüzden bir kaza oldu: sondaki bir kontrol sorgusu
--   patladı ve BAŞTAKİ kurulum da geri alındı. O yüzden bu dosyadaki
--   kontrol sorguları YORUM İÇİNDE. Kurulum bittikten SONRA ayrı bir
--   sorgu olarak çalıştır.
--
-- ═══════════════════════════════════════════════════════════════════

-- ═══ 1/3 ═══ EKLENTİLER ═══════════════════════════════════════════
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ═══ 2/3 ═══ TETİK SIRRI VAULT'A ══════════════════════════════════
-- Fonksiyon bu sırrı x-push-secret başlığında bekliyor; uyuşmazsa
-- isteği reddediyor. Aşağıdaki <BURAYA-TETIK-SIRRI> yerine, Supabase
-- gizli ayarlarına PUSH_TETIK_SIRRI olarak yazdığın metnin AYNISINI
-- koy. İkisi aynı olmazsa fonksiyon 401 döner ve bildirim gitmez.
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'push_tetik_sirri';
  if v_id is null then
    perform vault.create_secret('<BURAYA-TETIK-SIRRI>', 'push_tetik_sirri');
  else
    perform vault.update_secret(v_id, '<BURAYA-TETIK-SIRRI>');
  end if;
end $$;

-- ═══ 3/3 ═══ İŞ ═══════════════════════════════════════════════════
-- Önce varsa eskisini kaldır: bu betik tekrar çalıştırılabilir olsun
-- ve iki kopya aynı anda koşmasın.
select cron.unschedule('push-gonder')
 where exists (select 1 from cron.job where jobname = 'push-gonder');

-- ⚠ İKİ YERİ DEĞİŞTİRECEKSİN:
--   <PROJE-REF>  Supabase → Settings → General → Reference ID
--                (app.html'deki SUPABASE_URL'in içinde de var)
--   <KISA-AD>    Fonksiyonu PANELDEN kurduysan adresteki kısa ad
--                KLASÖR ADI DEĞİL, rastgele üretilmiş bir şeydir.
--                Edge Functions listesinde fonksiyona tıklayıp
--                gerçek adresi oradan oku. Bu tuzak bu depoda iki kez
--                404'e yol açtı (sql/20'nin başı, hosgeldin README).
--                Komut satırından kurduysan kısa ad = push-gonder.
--
-- Dakika 7: herkesin işi :00'da koşarsa sıra beklenir.
select cron.schedule(
  'push-gonder',
  '7 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJE-REF>.supabase.co/functions/v1/<KISA-AD>',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-push-secret',
                 (select decrypted_secret from vault.decrypted_secrets
                   where name = 'push_tetik_sirri')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- ═══════════════════════════════════════════════════════════════════
-- KONTROL — YUKARIDAKİ ÇALIŞTIKTAN SONRA, AYRI BİR SORGU OLARAK
-- ═══════════════════════════════════════════════════════════════════
-- ⛔ Bunları yukarıdaki betikle BİRLİKTE çalıştırma. Biri patlarsa
--    kurulum da geri alınır — sql/43'te tam bu oldu.
--
-- İş kuruldu mu?  1 satır gelmeli, active = true olmalı.
--
--   select jobid, jobname, schedule, active
--     from cron.job
--    where jobname = 'push-gonder';
--
-- Son koşular — cron isteği ATABİLDİ Mİ (fonksiyonun cevabı DEĞİL).
-- ⚠ cron.job_run_details'te jobname SÜTUNU YOK, yalnızca jobid var.
--   sql/43'te 'where jobname' yazıldı ve betik patladı.
--
--   select d.status, d.start_time, left(d.return_message, 200) as mesaj
--     from cron.job_run_details d
--     join cron.job j on j.jobid = d.jobid
--    where j.jobname = 'push-gonder'
--    order by d.start_time desc
--    limit 5;
--
-- Fonksiyonun KENDİ cevabı için: Supabase → Edge Functions →
-- push-gonder → Logs. Orada {"surum":1,"abonelik":N,"gonderildi":N,...}
-- biçiminde bir JSON görmelisin.
