-- 36 — API anahtarı yolu kaldırıldı
--
-- NEDEN. sql/35 iki yol getirmişti: (1) AI'ın verdiği JSON paketini
-- kullanıcının İçe Aktar'a yapıştırması, (2) `shb_` API anahtarıyla bir
-- Edge Function üzerinden doğrudan yazma.
--
-- İkincisi denemede çöktü. Sebep teknik değil: anahtarı bir yere BAĞLAMAK
-- gerekiyordu — Custom GPT Actions, bir otomasyon aracı ya da kendi
-- betiğin. Sohbet pencereleri (Gemini, ChatGPT) dışarıya istek atamıyor,
-- yani kullanıcı anahtarı sohbete verip hiçbir şey olmadığını görüyordu.
-- Shootboard'un kullanıcısı yazılımcı değil; ona kurulum işi yaptıran bir
-- yol, yol değildir.
--
-- Yapıştırma yolu DURUYOR: kurulum istemiyor, İçe Aktar penceresinin
-- içinde, önizlemeli ve geri alınabilir. `ai_aktarimlar` defteri onun;
-- AI rozeti ve "Geri al" oradan besleniyor, bu yüzden KALIYOR.
--
-- Bu betik önce defterdeki `key_id` sütununu, sonra anahtar tablosunu
-- düşürüyor. `drop table` tek başına hata veriyor: defterin o sütunu
-- api_keys'e bakan bir yabancı anahtar taşıyor. CASCADE yerine sütunu
-- açıkça kaldırıyoruz — neyin gittiği görünsün.
--
-- ÖNCE: Supabase panelinde Edge Functions → `ai` fonksiyonunu sil.
-- Fonksiyon silinmeden tablo düşerse fonksiyon 500 döndürmeye başlar
-- (kimse çağırmıyor olsa da, geride çalışmayan bir uç bırakmayalım).
--
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.
-- Tekrar çalıştırılabilir.

begin;

-- 1) Defterdeki `key_id` sütunu. "Bu aktarımı hangi anahtar yaptı" demek
--    içindi; yapıştırma yolunda anahtar yok, uygulama oraya hep null
--    yazıyordu. Sütun gidince ona bağlı yabancı anahtar kısıtı da gider —
--    api_keys'in düşmesini engelleyen buydu.
alter table public.ai_aktarimlar drop column if exists key_id;

-- 2) Anahtarlar yalnızca burada duruyordu; düz metin hiç saklanmamıştı
--    (yalnızca SHA-256 özeti). Tabloyla birlikte özetler de gidiyor.
drop table if exists public.api_keys;

commit;

-- Kontrol: tablo gitti mi, defter durdu mu?
select 'api_keys'      as tablo, to_regclass('public.api_keys')      as var_mi
union all
select 'ai_aktarimlar' as tablo, to_regclass('public.ai_aktarimlar') as var_mi;
