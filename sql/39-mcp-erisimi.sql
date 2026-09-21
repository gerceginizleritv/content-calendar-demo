-- 39 — MCP erişimi: anahtar tablosu geri geliyor, tekrar koruması ekleniyor
--
-- NEDEN ŞİMDİ. sql/35 bu tabloyu kurmuştu, sql/36 düşürmüştü. Düşürme
-- gerekçesi teknik değildi:
--
--   "Anahtarı bir yere BAĞLAMAK gerekiyordu — Custom GPT Actions, bir
--    otomasyon aracı ya da kendi betiğin. Sohbet pencereleri (Gemini,
--    ChatGPT) dışarıya istek atamıyor, yani kullanıcı anahtarı sohbete
--    verip hiçbir şey olmadığını görüyordu."
--
-- Eksik olan "bağlama" parçası MCP'nin kendisi. Claude artık bir uzak MCP
-- sunucusuna bağlanabiliyor; kullanıcının yapacağı tek kurulum, adresi bir
-- kez Ayarlar → Connectors'a yapıştırmak. Yani geri adım atılan yol
-- yeniden açılıyor, ama bu kez bağlanacak bir ucu var.
--
-- FARKLAR — bu sql/35'in aynısı değil:
--
--   1. Anahtar ADRESİN İÇİNDE taşınıyor, Authorization başlığında değil.
--      claude.ai'ın özel connector penceresinde API anahtarı yapıştırılacak
--      bir kutu yok; yalnızca URL ve (gelişmiş ayarlarda) OAuth var. Tam
--      OAuth sunucusu yazmak bu işin geri kalanından büyük olduğu için
--      anahtar yolun bir parçası: .../mcp/<anahtar>. Sonucu şudur: adres
--      bir SIRDIR, paylaşılmaz. İptal etmek uygulamadan tek tık.
--
--   2. Tekrar koruması var. Şemanın kendisi (ai/sema.json, x-idempotency)
--      "kayıtların doğal anahtarı yok, iki kez gönderirsen iki kez oluşur"
--      diyor. Bir asistanın aynı paketi iki kez göndermesi ise sıradan bir
--      olay: bağlantı koptu sanır, tekrarlar. Aşağıdaki paket_ozeti sütunu
--      ve kısmi tekil dizin bunu yakalıyor.
--
--   3. Silme YOK. Fonksiyon silme ucu sunmuyor; kullanıcı kararı.
--      "Claude'un takvimden kayıt silmesini istemiyorum." Geri alma
--      uygulamanın kendi ekranından yapılıyor, defter zaten onu besliyor.
--
-- ÖNCE sql/35 ve sql/36 çalıştırılmış olmalı (ai_aktarimlar buradan
-- geliyor). Tekrar çalıştırılabilir.
--
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.

begin;

-- 1) Anahtarlar. Düz metin HİÇ saklanmıyor: yalnızca SHA-256 özeti.
--    Kullanıcıya bir kez gösteriliyor, kaybederse yenisi üretiliyor.
create table if not exists public.api_keys (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text not null default '',
  -- Anahtarın SHA-256 özeti, küçük harf onaltılık (64 karakter).
  key_hash     text not null unique,
  -- Listede tanımak için: "shb_ab12cd34…". Özetten geri türetilemez.
  key_prefix   text not null default '',
  -- read / write. Salt okunur anahtar ileride buradan çıkar.
  scopes       text[] not null default '{read,write}',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists api_keys_user_idx on public.api_keys (user_id);

alter table public.api_keys enable row level security;
drop policy if exists api_keys_own on public.api_keys;
create policy api_keys_own on public.api_keys
  for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.api_keys to authenticated;

-- 2) Defterdeki key_id sütunu geri geliyor. sql/36 bunu düşürmüştü çünkü
--    yapıştırma yolunda anahtar yok ve uygulama oraya hep null yazıyordu.
--    Artık iki yol var: yapıştırma (null) ve MCP (anahtarın kimliği).
--    "Bu kayıtları hangi yoldan geldi" sorusunun cevabı burada.
alter table public.ai_aktarimlar
  add column if not exists key_id text references public.api_keys(id) on delete set null;

-- 3) TEKRAR KORUMASI. Paketin içeriğinden üretilen özet (ya da çağıranın
--    verdiği idempotency anahtarı). Aynı özet aynı hesapta ikinci kez
--    gelirse fonksiyon hiçbir şey yazmıyor, ilk aktarımın kimliklerini
--    geri döndürüyor.
alter table public.ai_aktarimlar
  add column if not exists paket_ozeti text;

-- Kısmi tekil dizin: yalnızca özeti OLAN satırlar için. Eski satırlarda ve
-- yapıştırma yolunda özet null; null'lar birbiriyle çakışmaz, o yüzden
-- geçmiş veri bu dizini bozmuyor.
--
-- Pencere YOK, kalıcı: "aynı paketi gelecek ay bilerek tekrar göndereyim"
-- diyen kullanıcı için kaçış yolu var -- araca kendi idempotencyKey'ini
-- veriyor. Zaman penceresi koysaydık tekrar koruması "bazen çalışan" bir
-- şey olurdu; öyle bir koruma korumadan kötüdür, çünkü güvenilir sanılır.
create unique index if not exists ai_aktarimlar_ozet_tekil
  on public.ai_aktarimlar (user_id, paket_ozeti)
  where paket_ozeti is not null;

commit;

-- Kontrol
select (select count(*) from public.api_keys where revoked_at is null) as etkin_anahtar,
       (select count(*) from public.ai_aktarimlar)                     as aktarim_sayisi,
       (select count(*) from public.ai_aktarimlar
          where paket_ozeti is not null)                               as ozetli_aktarim;

-- NOT — anahtar neden bu tabloda ve neden düz metin yok:
-- Sızan bir veritabanı yedeği anahtarları vermesin diye yalnızca SHA-256
-- özeti duruyor. Fonksiyon gelen anahtarın özetini alıp burada arıyor.
-- Bunun bedeli, kullanıcı anahtarını kaybederse geri gösterilememesi --
-- kabul edildi, yenisini üretmek bir tık.
--
-- NOT — adres bir sırdır:
-- Anahtar URL'nin içinde taşındığı için MCP adresi paylaşılmamalı. Aynı
-- şey takvim abonelik adresleri için de geçerliydi; oradaki kural burada
-- da geçerli. Fark: takvim adresi yalnızca OKUMA veriyor, bu adres YAZMA
-- da veriyor. Bu yüzden uygulamadaki ekran bunu açıkça yazıyor ve iptal
-- düğmesi anahtarın yanında duruyor.
