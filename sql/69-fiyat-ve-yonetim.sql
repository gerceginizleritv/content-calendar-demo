-- ══════════════════════════════════════════════════════════════════
-- 69 — FİYAT, PLAN, LİMİT VE YÖNETİM TABLOLARI
--      (12 Kasım 2026)
-- ══════════════════════════════════════════════════════════════════
-- HANGİ DOSYA NEYİ GERİ ALIR (CLAUDE.md Bölüm 6)
--
--   · Bu dosya YENİ tablolar kuruyor; var olan hiçbir tabloyu
--     değiştirmiyor, hiçbir dosyanın işini geri almıyor.
--   · Tekrar çalıştırılabilir: her şey `if not exists` ve
--     `create or replace`. Veri silmiyor, veri değiştirmiyor.
--   · ⚠ BU DOSYA sql/07'nin İŞİNİ GERİ ALMIYOR ama onun EKSİĞİNİ
--     kapatıyor. sql/07 kotayı `user_prefs`'e yazdı ve kendi başında
--     şunu yazdı:
--         "Bu bir GÜVENLİK sınırı değil, bir kolaylık. Kullanıcı
--          kendi satırını düzenleyebilir (RLS kendi satırına izin
--          veriyor). Para işin içine girdiğinde sınırın veritabanı
--          tarafından DAYATILMASI gerekir."
--     Para işin içine giriyor. Bu yüzden plan ve limit bilgisi
--     `user_prefs`'e DEĞİL, kullanıcının yazma yetkisi OLMAYAN ayrı
--     tablolara yazılıyor. `user_prefs.entry_limit` olduğu gibi
--     duruyor ve çalışmaya devam ediyor; onu kaldırmak ayrı bir iş.
--
-- NEDEN
-- Fiyatlandırma, ödeme duvarı ve yönetim alanı için zemin. Tasarım
-- belgesi: tasarim/fiyatlandirma-ve-yonetim.md
--
-- ⛔ BU DOSYADA ÖDEME SAĞLAYICISINA ÖZEL HİÇBİR ŞEY YOK. Sağlayıcı
--    henüz seçilmedi (prompt sorusu 8). `payments` ve `subscriptions`
--    sağlayıcıyı `provider` + `provider_ref` diye genel tutuyor;
--    hangi sağlayıcı seçilirse seçilsin bu şema değişmiyor.
--
-- ⛔ GERÇEK ANAHTAR, TOKEN YA DA ŞİFRE BU DOSYADA YOK ve olmayacak.
--
-- ⛔ PARA `amount_minor` TAM SAYI olarak tutuluyor (kuruş/cent).
--    Ondalık sayıyla para tutmak klasik bir hata: 0,1 + 0,2 ≠ 0,3.
--    9 USD → 900. 320 TRY → 32000.
--
-- ⛔ VERGİ ORANI `rate_bp` BAZ PUAN olarak tam sayı. %20 → 2000.
--    Aynı sebep.
--
-- NASIL ÇALIŞTIRILIR
-- Supabase panelinde: SQL Editor → New query → bu dosyanın TAMAMINI
-- yapıştır → Run. Tekrar çalıştırılabilir.
--
-- NE GÖRMELİSİN
-- En altta iki tablo çıkacak: kurulan tabloların listesi ve başlangıç
-- fiyatları. Hata görürsen DUR ve yaz.
-- ══════════════════════════════════════════════════════════════════

begin;

-- ──────────────────────────────────────────────────────────────────
-- 0 · YÖNETİCİ KİMLİĞİ
-- ──────────────────────────────────────────────────────────────────
-- ⛔ TEK HESAP. CLAUDE.md'de MCP erişimi için adı geçen hesap.
-- Başka hesaba tanımlanmaz. ⛔ Bu liste TARAYICIDAN DEĞİŞMEZ:
-- tabloya hiç kimsenin yazma yetkisi yok (aşağıda politika da yok,
-- yani varsayılan RED geçerli); değişiklik yalnızca buradan, elle.
create table if not exists public.yonetici (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  eklendi    timestamptz not null default now()
);

alter table public.yonetici enable row level security;

-- Yöneticiyi e-postadan bul ve yaz. Bulunamazsa İŞ DURUYOR:
-- sessizce "yaptım" demek, sonra yetki çalışmayınca sebebini
-- aramaktan kötüdür. (sql/07'deki kalıbın aynısı.)
do $$
declare
  kim uuid;
  posta text := 'bostancioglum@gmail.com';
begin
  select id into kim from auth.users where lower(email) = lower(posta);
  if kim is null then
    raise exception 'Bu e-postayla kayitli kullanici yok: %. Once uygulamadan giris yap.', posta;
  end if;
  insert into public.yonetici (user_id) values (kim)
    on conflict (user_id) do nothing;
  raise notice 'Yonetici tanimlandi: %', posta;
end $$;

-- Yönetici mi? Her politikada kullanılıyor.
-- `security definer`: fonksiyon tabloyu okuyabilsin ama kullanıcı
-- tabloyu doğrudan okuyamasın.
create or replace function public.yonetici_mi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.yonetici where user_id = auth.uid());
$$;

-- ──────────────────────────────────────────────────────────────────
-- 1 · PLANLAR
-- ──────────────────────────────────────────────────────────────────
create table if not exists public.plans (
  key        text primary key,
  visible    boolean not null default true,
  -- ⛔ "En Populer" DEGIL. Henuz ucretli kullanici yok; MARKA.md
  -- dogrulanmamis iddiayi yasakliyor. Izin verilen tek deger
  -- 'recommended' (ekranda "Onerilen" / "Recommended").
  badge      text check (badge is null or badge in ('recommended')),
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.plans (key, visible, badge, sort) values
  ('starter',     true, null,          10),
  ('creator_pro', true, 'recommended', 20),
  -- ⚠ STUDIO VARSAYILAN OLARAK GIZLI. Ozellik denetiminde olculdu:
  -- bes maddesinin DORDU yok (ekip erisimi, ortak calisma alani,
  -- ortak havuz, proje bazli yetkilendirme). "Olmayan ozellik
  -- satilmaz" -- gorunur yapmak kullanicinin karari (soru 1).
  ('studio',      false, null,         30),
  -- ⚠ KURUCU UYE de GIZLI: odeme altyapisi kurulmadan satilamaz.
  ('founding',    false, null,         40)
on conflict (key) do nothing;

-- ──────────────────────────────────────────────────────────────────
-- 2 · FİYATLAR
-- ──────────────────────────────────────────────────────────────────
-- ⛔ TRY, USD'DEN KURLA HESAPLANMAZ. Her plan × para birimi × dönem
-- için AYRI satır, ayrı kutu. Promptun şartı.
create table if not exists public.plan_prices (
  plan_key     text not null references public.plans(key) on delete cascade,
  currency     text not null check (currency in ('USD','TRY')),
  period       text not null check (period in ('monthly','yearly','once')),
  -- Kuruş/cent. Eksi olamaz.
  amount_minor bigint not null check (amount_minor >= 0),
  active       boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (plan_key, currency, period)
);

-- BAŞLANGIÇ DEĞERLERİ (kullanıcıdan, 11 Kasım 2026).
-- ⚠ TRY fiyatları köşeli parantezle verildi: KESİNLEŞMEMİŞ sayılır,
-- canlıya geçmeden önce kullanıcıya teyit ettirilecek.
-- ⛔ Bunlar yalnızca BAŞLANGIÇ; değişiklik yönetim ekranından yapılır,
-- kod dağıtımı gerekmez.
insert into public.plan_prices (plan_key, currency, period, amount_minor) values
  ('starter',     'USD', 'monthly',      0),
  ('starter',     'TRY', 'monthly',      0),
  ('creator_pro', 'USD', 'monthly',    900),   -- 9 USD
  ('creator_pro', 'USD', 'yearly',    8400),   -- 84 USD/yil (aylik 7)
  ('creator_pro', 'TRY', 'monthly',  32000),   -- 320 TRY
  ('creator_pro', 'TRY', 'yearly',  300000),   -- 3.000 TRY/yil (aylik 250)
  ('studio',      'USD', 'monthly',   2900),   -- 29 USD
  ('studio',      'USD', 'yearly',   28800),   -- 288 USD/yil (aylik 24)
  ('studio',      'TRY', 'monthly', 105000),   -- 1.050 TRY
  ('studio',      'TRY', 'yearly', 1020000),   -- 10.200 TRY/yil (aylik 850)
  ('founding',    'USD', 'once',      6900),   -- 69 USD tek seferlik
  ('founding',    'TRY', 'once',     245000)   -- 2.450 TRY tek seferlik
on conflict (plan_key, currency, period) do nothing;

-- ──────────────────────────────────────────────────────────────────
-- 3 · LİMİTLER
-- ──────────────────────────────────────────────────────────────────
-- ⛔ KODA GÖMÜLÜ LİMİT KALMIYOR. Bugün app.html'de gömülü duranlar
-- (SET_MAX=20, SCRIPT_ADET=300, FIKIR_ADET=500, IHTIYAC_MAX=300)
-- buradan okunacak.
create table if not exists public.plan_limits (
  plan_key    text not null references public.plans(key) on delete cascade,
  limit_key   text not null check (limit_key in
                 ('projects','sets','scripts','ideas','kit_items','team_users')),
  -- null = SINIRSIZ. Sıfır "hiç" demek, null "sınır yok" demek;
  -- ikisi ayrı şey ve karıştırılırsa ücretli kullanıcı hiçbir şey
  -- yapamaz hale gelir.
  limit_value integer check (limit_value is null or limit_value >= 0),
  primary key (plan_key, limit_key)
);

insert into public.plan_limits (plan_key, limit_key, limit_value) values
  -- Starter: kullanıcının 11 Kasım'da verdiği sınırlar.
  ('starter',     'projects',   2),
  ('starter',     'sets',       1),
  ('starter',     'scripts',    null),
  ('starter',     'ideas',      null),
  ('starter',     'kit_items',  null),
  -- Creator Pro: sınırsız.
  ('creator_pro', 'projects',   null),
  ('creator_pro', 'sets',       null),
  ('creator_pro', 'scripts',    null),
  ('creator_pro', 'ideas',      null),
  ('creator_pro', 'kit_items',  null),
  -- Studio: Pro'daki her şey + ekip.
  ('studio',      'projects',   null),
  ('studio',      'sets',       null),
  ('studio',      'scripts',    null),
  ('studio',      'ideas',      null),
  ('studio',      'kit_items',  null),
  ('studio',      'team_users', 5),
  ('founding',    'projects',   null),
  ('founding',    'sets',       null),
  ('founding',    'scripts',    null),
  ('founding',    'ideas',      null),
  ('founding',    'kit_items',  null)
on conflict (plan_key, limit_key) do nothing;

-- ──────────────────────────────────────────────────────────────────
-- 4 · VERGİ AYARLARI
-- ──────────────────────────────────────────────────────────────────
-- Kullanıcının kararı (12 Kasım 2026): "bu alanlarda benim içeriden
-- veri girişi yapabileceğim şekilde gerekli hazırlıkları yaparsın."
-- ⚠ Hangi oranın gireceği MALİ MÜŞAVİRİN işi. Burada yalnızca kutu var.
-- ⛔ Başlangıç satırı YOK: uydurma bir oran yazmaktansa boş bırakmak
-- doğru. Kullanıcı yönetim ekranından girer.
create table if not exists public.tax_settings (
  region              text not null,
  -- Baz puan: %20 → 2000.
  rate_bp             integer not null check (rate_bp >= 0 and rate_bp <= 10000),
  price_includes_tax  boolean not null default true,
  tax_id_required     boolean not null default false,
  -- Oran değişirse eskisi SİLİNMEZ; yeni satır yeni tarihle gelir.
  valid_from          date not null default current_date,
  created_at          timestamptz not null default now(),
  primary key (region, valid_from)
);

-- ──────────────────────────────────────────────────────────────────
-- 5 · FİYAT GEÇMİŞİ
-- ──────────────────────────────────────────────────────────────────
-- ⛔ ESKİ FİYAT SİLİNMEZ. Her değişiklik tarihiyle, eski ve yeni
-- değeriyle buraya yazılır.
create table if not exists public.price_history (
  id           bigserial primary key,
  plan_key     text not null,
  currency     text not null,
  period       text not null,
  old_minor    bigint,
  new_minor    bigint not null,
  changed_by   uuid references auth.users(id),
  changed_at   timestamptz not null default now()
);

-- Fiyat her değiştiğinde geçmişe kendiliğinden yazılıyor. Elle
-- yazılsaydı bir yol unutulurdu.
create or replace function public.plan_prices_gecmis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.price_history (plan_key, currency, period, old_minor, new_minor, changed_by)
  values (new.plan_key, new.currency, new.period,
          case when tg_op = 'UPDATE' then old.amount_minor else null end,
          new.amount_minor, auth.uid());
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists plan_prices_gecmis_trg on public.plan_prices;
create trigger plan_prices_gecmis_trg
  before insert or update of amount_minor on public.plan_prices
  for each row execute function public.plan_prices_gecmis();

-- ──────────────────────────────────────────────────────────────────
-- 6 · ABONELİKLER
-- ──────────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  plan_key           text not null references public.plans(key),
  status             text not null check (status in ('active','past_due','canceled','lifetime')),
  period             text check (period in ('monthly','yearly','once')),
  current_period_end timestamptz,
  -- Sağlayıcı GENEL tutuluyor: hangisi seçilirse seçilsin şema aynı.
  provider           text,
  provider_ref       text,
  -- ⛔ ALINDIĞI ANDAKİ plan, fiyat, para birimi ve vergi oranının
  -- KOPYASI. Sonradan fiyat değişse de bu abonelik değişmez.
  price_snapshot     jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────
-- 7 · ÖDEMELER
-- ──────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id              bigserial primary key,
  user_id         uuid references auth.users(id) on delete set null,
  plan_key        text references public.plans(key),
  amount_minor    bigint not null check (amount_minor >= 0),
  currency        text not null check (currency in ('USD','TRY')),
  -- ⚠ Yurt içi / yurt dışı SAĞLAYICININ VERDİĞİ FATURA ÜLKESİNDEN
  -- gelir. Tarayıcı dilinden ya da IP'den TAHMİN EDİLMEZ: ikisi de
  -- yanıltıcı (VPN, yurt dışında yaşayan, İngilizce kullanan yerli).
  billing_country text,
  yurt_ici        boolean,
  status          text not null check (status in ('paid','refunded','failed')),
  provider        text,
  provider_ref    text,
  -- ⛔ AYNI BİLDİRİM İKİ KEZ İŞLENMEZ. Sağlayıcı bağlantı koptu
  -- sanıp tekrar gönderebilir; tekil dizin bunu yakalar.
  idempotency_key text,
  -- Alındığı andaki vergi oranının kopyası.
  tax_snapshot    jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create unique index if not exists payments_idempotency_uq
  on public.payments (idempotency_key)
  where idempotency_key is not null;

-- ──────────────────────────────────────────────────────────────────
-- 8 · KURUCU ÜYE KONTENJANI
-- ──────────────────────────────────────────────────────────────────
-- ⛔ SAYAÇ GERÇEK. Promptun şartı: "sunucuda sayılır, aynı anda gelen
-- iki alımda 201. satılmaz, dolunca kart kendiliğinden kapanır."
create table if not exists public.founding_seats (
  id    boolean primary key default true check (id),
  quota integer not null default 200 check (quota >= 0),
  sold  integer not null default 0   check (sold  >= 0),
  open  boolean not null default false,
  constraint founding_sold_quota check (sold <= quota)
);

insert into public.founding_seats (id) values (true) on conflict (id) do nothing;

-- Kontenjandan BİR tane düşer. Yarış durumu veritabanı kilidiyle
-- çözülüyor: `where sold < quota` koşullu update ATOMİK. Uygulama
-- katmanında "önce oku, sonra yaz" yapılsaydı aynı anda gelen iki
-- alımda 201. satılabilirdi.
-- Dönen değer: true = yer ayrıldı, false = dolu ya da kapalı.
create or replace function public.founding_al()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  kactane integer;
begin
  update public.founding_seats
     set sold = sold + 1
   where id = true and open = true and sold < quota;
  get diagnostics kactane = row_count;
  return kactane = 1;
end $$;

-- ⛔ Bu fonksiyonu kimse doğrudan çağıramaz: yalnızca sunucu
-- (Edge Function, servis anahtarıyla). Tarayıcıdan çağrılabilseydi
-- herkes kendine kontenjan ayırabilirdi.
revoke all on function public.founding_al() from anon, authenticated;

-- ──────────────────────────────────────────────────────────────────
-- 9 · DENETİM KAYDI
-- ──────────────────────────────────────────────────────────────────
-- ⛔ SİLİNEMEZ. Yönetimde yapılan her iş buraya yazılır; silme ve
-- değiştirme yetkisi HİÇ KİMSEDE yok (aşağıda politika yok = RED).
create table if not exists public.admin_audit (
  id         bigserial primary key,
  actor      uuid references auth.users(id),
  action     text not null,
  target     text,
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════════
-- YETKİ KURALLARI
-- ══════════════════════════════════════════════════════════════════
-- ⛔ Ölçü "çalışıyor" değil, "BAŞKASI GÖREMİYOR / DEĞİŞTİREMİYOR".
-- Her tablo üç kimlikle denenecek: başka hesap, hesapsız, yönetici.
--
-- ⛔ HİÇBİR TABLOYA TARAYICIDAN YAZMA YETKİSİ YOK. Yazan tek şey
-- sunucu (Edge Function, servis anahtarı). Politika yazılmayan her
-- işlem RLS'te varsayılan olarak REDDEDİLİR.

alter table public.plans          enable row level security;
alter table public.plan_prices    enable row level security;
alter table public.plan_limits    enable row level security;
alter table public.tax_settings   enable row level security;
alter table public.price_history  enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.payments       enable row level security;
alter table public.founding_seats enable row level security;
alter table public.admin_audit    enable row level security;

-- Planlar, fiyatlar, limitler, vergi: HERKES OKUR (fiyat sayfası
-- hesapsız ziyaretçiye de görünmeli), KİMSE YAZAMAZ.
drop policy if exists plans_oku on public.plans;
create policy plans_oku on public.plans for select using (true);

drop policy if exists plan_prices_oku on public.plan_prices;
create policy plan_prices_oku on public.plan_prices for select using (true);

drop policy if exists plan_limits_oku on public.plan_limits;
create policy plan_limits_oku on public.plan_limits for select using (true);

drop policy if exists tax_oku on public.tax_settings;
create policy tax_oku on public.tax_settings for select using (true);

-- Kontenjan: herkes okur (sayfada KALAN ADET gösterilecek, ve o sayı
-- GERÇEK olacak), kimse yazamaz.
drop policy if exists founding_oku on public.founding_seats;
create policy founding_oku on public.founding_seats for select using (true);

-- Abonelik ve ödeme: kullanıcı YALNIZCA KENDİ satırını okur.
-- Yönetici hepsini okur. Kimse yazamaz.
drop policy if exists subs_kendi on public.subscriptions;
create policy subs_kendi on public.subscriptions for select
  using (user_id = auth.uid() or public.yonetici_mi());

drop policy if exists pay_kendi on public.payments;
create policy pay_kendi on public.payments for select
  using (user_id = auth.uid() or public.yonetici_mi());

-- Fiyat geçmişi ve denetim kaydı: YALNIZCA yönetici okur.
drop policy if exists ph_yonetici on public.price_history;
create policy ph_yonetici on public.price_history for select
  using (public.yonetici_mi());

drop policy if exists audit_yonetici on public.admin_audit;
create policy audit_yonetici on public.admin_audit for select
  using (public.yonetici_mi());

commit;

-- ══════════════════════════════════════════════════════════════════
-- KONTROL — bunları görmelisin
-- ══════════════════════════════════════════════════════════════════

-- 1) Kurulan tablolar: dokuz satır gelmeli.
select table_name as tablo
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('yonetici','plans','plan_prices','plan_limits',
                      'tax_settings','price_history','subscriptions',
                      'payments','founding_seats','admin_audit')
 order by table_name;

-- 2) Başlangıç fiyatları: on iki satır gelmeli.
--    amount_minor kuruş/cent; 900 = 9 USD, 32000 = 320 TRY.
select plan_key as plan, currency as para, period as donem,
       amount_minor as tutar_kurus
  from public.plan_prices
 order by plan_key, currency, period;

-- 3) Yönetici: TEK satır gelmeli, senin e-postan.
select u.email as yonetici_eposta
  from public.yonetici y
  join auth.users u on u.id = y.user_id;
