alter table public.ideas add column if not exists oncelik text;
alter table public.ideas drop constraint if exists ideas_oncelik_check;
alter table public.ideas add constraint ideas_oncelik_check check (oncelik is null or oncelik in ('1','2','3'));
select column_name, data_type from information_schema.columns where table_schema='public' and table_name='ideas' and column_name='oncelik';

-- ═══════════════════════════════════════════════════════════════════
-- YUKARIDAKİ DÖRT SATIR ÇALIŞTIRILACAK OLAN. Aşağısı yalnızca açıklama.
-- ═══════════════════════════════════════════════════════════════════
--
-- ⚠ Bu düzen sql/74'ten geliyor: orada dosya açıklamayla başlıyordu,
--   kopyalarken baştaki `-- ` düştü ve Postgres ilk satırı komut sandı
--   ("syntax error at or near 74"). Çalıştırılacak parça artık her
--   dosyada en üstte ve yorumsuz duruyor.
--
-- 75 — FİKİR ÖNCELİĞİ (YAPILACAKLAR 52)
--
-- NEDEN
--   Kullanıcının kararı (16 Kasım 2026): fikirlere üç düzeyli öncelik.
--     '1' Çok Öncelikli · '2' Orta Öncelik · '3' Düşük Öncelik
--
-- ⚠ İSTEĞE BAĞLI, VARSAYILAN YOK. Seçmeden kaydetmek engellenmiyor ve
--   hiçbir fikre kendiliğinden düzey atanmıyor. "Önceliksiz" AYRI bir
--   durum, "düşük" değil — bu yüzden sütunun varsayılan değeri yok ve
--   boş (null) kalması anlamlı.
--
-- ⚠ MEVCUT FİKİRLERE DOKUNULMUYOR. Betik yalnızca sütun ekliyor;
--   bugünkü bütün fikirler önceliksiz kalıyor (kullanıcının kararı).
--
-- ⚠ BETİK ÇALIŞMADAN ÖNCE DE UYGULAMA ÇALIŞIR. Sütun yoksa kaydetme
--   isteği `oncelik` alanını düşürüyor (`fikirOncelikSutunu` bayrağı,
--   sql/30 ve sql/31'deki kalıbın aynısı) — öncelik yalnızca tarayıcıda
--   kalır ve betik çalıştığı an ilk kayıtta sunucuya gider.
--
-- ⚠ Kısıt CHECK ile konuyor, enum ile değil: dördüncü bir düzey
--   gerekirse enum'da ayrı bir geçiş betiği gerekir, CHECK'te tek satır.
--
-- BEKLENEN SONUÇ
--   Son satır tek satırlık bir tablo döndürür: column_name = oncelik,
--   data_type = text.
