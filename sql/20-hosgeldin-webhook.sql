-- 20 — Hoşgeldin e-postası tetikleyicileri
--
-- Ne yapar: yeni hesabın DİLİ belli olduğu anda "hosgeldin" Edge Function'ını
-- çağırır; o da Resend üzerinden, o dilde, hoşgeldin e-postasını gönderir.
--
-- Neden iki tetikleyici: e-posta bağlantısıyla açılan hesapta dil (lang)
-- daha ilk satırda var → INSERT anında gider. Google ile açılan hesapta
-- yoktur; uygulama ilk açılışta yazar → o UPDATE anında gider. Böylece hiçbir
-- kullanıcıya iki dilli e-posta gitmez.
--
-- Önce:
--   1. Supabase panel → Database → Webhooks → "Enable Database Webhooks".
--   2. supabase secrets set RESEND_API_KEY=re_... HOSGELDIN_WEBHOOK_SECRET=<uzun rastgele>
--   3. supabase functions deploy hosgeldin --no-verify-jwt
--   4. Aşağıdaki DEGISTIR_GIZLI_ANAHTAR (iki yerde) yerine HOSGELDIN_WEBHOOK_SECRET'in
--      birebir aynısını yaz, SQL Editor'de çalıştır. Tekrar çalıştırılabilir.
--
-- Geri almak için:
--   drop trigger if exists hosgeldin_epostasi_yeni on auth.users;
--   drop trigger if exists hosgeldin_epostasi_dil  on auth.users;

create extension if not exists pg_net;

drop trigger if exists hosgeldin_epostasi     on auth.users;  -- eski ad
drop trigger if exists hosgeldin_epostasi_yeni on auth.users;
drop trigger if exists hosgeldin_epostasi_dil  on auth.users;

-- E-posta bağlantısıyla açılan hesap: dil satırla birlikte gelir.
create trigger hosgeldin_epostasi_yeni
  after insert on auth.users
  for each row
  when (new.raw_user_meta_data ? 'lang')
  execute function supabase_functions.http_request(
    'https://dyemvzmpnlpnzwebuciu.supabase.co/functions/v1/hosgeldin',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"DEGISTIR_GIZLI_ANAHTAR"}',
    '{}',
    '5000'
  );

-- Google ile açılan hesap: dil ilk açılışta yazılır; yalnızca o ilk seferde.
create trigger hosgeldin_epostasi_dil
  after update of raw_user_meta_data on auth.users
  for each row
  when (old.raw_user_meta_data ->> 'lang' is null and new.raw_user_meta_data ->> 'lang' is not null)
  execute function supabase_functions.http_request(
    'https://dyemvzmpnlpnzwebuciu.supabase.co/functions/v1/hosgeldin',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"DEGISTIR_GIZLI_ANAHTAR"}',
    '{}',
    '5000'
  );
