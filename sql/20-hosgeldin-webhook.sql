-- 20 — Hoşgeldin e-postası tetikleyicisi
--
-- Ne yapar: auth.users tablosuna yeni hesap girince "hosgeldin" Edge
-- Function'ını çağırır; o da Resend üzerinden hoşgeldin e-postasını gönderir.
--
-- Önce:
--   1. Supabase panel → Database → Webhooks → "Enable Database Webhooks"
--      (supabase_functions şeması ve pg_net bununla açılır).
--   2. supabase secrets set RESEND_API_KEY=re_... HOSGELDIN_WEBHOOK_SECRET=<uzun rastgele>
--   3. supabase functions deploy hosgeldin --no-verify-jwt
--   4. Aşağıdaki DEGISTIR_GIZLI_ANAHTAR yerine HOSGELDIN_WEBHOOK_SECRET'in
--      birebir aynısını yaz, sonra SQL Editor'de çalıştır. Tekrar çalıştırılabilir.
--
-- Geri almak için yalnızca: drop trigger if exists hosgeldin_epostasi on auth.users;

create extension if not exists pg_net;

drop trigger if exists hosgeldin_epostasi on auth.users;

create trigger hosgeldin_epostasi
  after insert on auth.users
  for each row
  execute function supabase_functions.http_request(
    'https://dyemvzmpnlpnzwebuciu.supabase.co/functions/v1/hosgeldin',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"DEGISTIR_GIZLI_ANAHTAR"}',
    '{}',
    '5000'
  );
