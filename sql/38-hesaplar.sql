-- 38 — Sosyal medya hesap etiketleri
--
-- Neden: bugüne kadar bir paylaşımın "nereye" gideceği yalnızca PLATFORM
-- olarak tutuluyordu. İki YouTube kanalı olan (ya da bir kişisel + bir
-- marka Instagram hesabı olan) üretici için bu yetmiyor: aynı platforma
-- çıkan iki ayrı paylaşımı takvimde birbirinden ayıramıyor.
--
-- ÖNEMLİ — BU BİR BAĞLANTI DEĞİL, BİR ETİKET.
-- Burada saklanan şey kullanıcının kendi yazdığı bir addır. OAuth yok,
-- API yok, jeton yok, otomatik paylaşım yok. Shootboard hiçbir hesaba
-- bağlanmıyor; MARKA.md'deki "hesaplarına bağlanmaz" ilkesi duruyor.
-- Bu yüzden tabloda parola, jeton ya da erişim bilgisi tutan hiçbir
-- sütun YOK ve olmamalı. Biri ileride eklemek isterse önce o ilkenin
-- değişmesi gerekir.
--
-- Kalıp bilerek Mekanlar'ın (sql/24) aynısı: bir kez tanımlanan, kayıtların
-- atıfta bulunduğu, kendi penceresi olan bir varlık. Aynı kalıbı izleyince
-- günlük yedek, bulut senkronu ve dışa/içe aktarma kendiliğinden geliyor --
-- user_prefs.prefs içine konsaydı üçü de ayrı ayrı yazılmak zorunda
-- kalırdı (ve ihtiyaç kütüphanesinde tam olarak bu unutulmuştu).

begin;

create table if not exists public.accounts (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Kullanıcının gördüğü ad: "Gerçeğin İzleri", "Kişisel", "Marka".
  name        text not null default '',
  -- Hangi platformun hesabı. Uygulamadaki CAL_SM_PLATFORMS ile aynı küme;
  -- kısıt konmuyor çünkü yeni bir platform eklendiğinde migration
  -- beklemek istemiyoruz. Geçersiz değeri uygulama süzüyor.
  platform    text not null default '',
  -- @kullaniciadi. Yalnızca gösterim için: hiçbir yere sorulmuyor.
  handle      text not null default '',
  -- Kanalın/profilin adresi. Kullanıcı elle yapıştırıyor; tıklayınca
  -- yeni sekmede açılıyor, başka hiçbir şey yapmıyor.
  url         text not null default '',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Silinen satır tabloda kalıyor: Mekanlar'da elle silinen kayıtlar her
  -- açılışta geri geliyordu, aynı tuzağa düşülmesin.
  deleted_at  timestamptz
);

create index if not exists accounts_user_idx on public.accounts (user_id);

alter table public.accounts enable row level security;
drop policy if exists accounts_own on public.accounts;
create policy accounts_own on public.accounts
  for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.accounts to authenticated;

commit;

-- Kontrol
select count(*) as hesap_sayisi from public.accounts;

-- NOT: kaydın hangi hesaba ait olduğu calendar_events'te AYRI BİR SÜTUN
-- DEĞİL, content jsonb'sinin içinde (content.hesapId). Sebep: content
-- zaten jsonb ve yeni alan migration gerektirmiyor; ayrıca kaydın
-- platformu da orada değil kendi sütununda -- ikisini farklı yerlere
-- koymak tutarsız olurdu ama platform sütunu sorgulanıyor, hesap
-- sorgulanmıyor. Sorgulama ihtiyacı doğarsa sütuna taşınır.
--
-- Hesap silinince kayıt SİLİNMİYOR. Proje silmedeki davranış izleniyor:
-- bağ kopuyor, kayıt "silinmiş hesap" olarak görünüyor. Sessizce
-- boşaltmak geçmişi yalanlamak olurdu.
