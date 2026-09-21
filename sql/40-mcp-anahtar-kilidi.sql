-- 40 — MCP anahtarı yalnızca bayrağı olan hesapta üretilebilir
--
-- DURUM: bu betik ZATEN UYGULANDI (kullanıcı elle çalıştırdı). Burada
-- durmasının sebebi deponun gerçeği yansıtması: veritabanında olup
-- depoda olmayan bir kural, bir sonraki kurulumda sessizce eksik kalır.
-- Tekrar çalıştırılabilir.
--
-- NEDEN. sql/39 anahtar tablosunu geri getirdi ve kuralı "herkes kendi
-- satırını yazabilir" olarak bıraktı. Uygulamada anahtar üretme ekranı
-- bir bayrakla (user_prefs.prefs.mcp) gizleniyordu -- ama EKRANI GİZLEMEK
-- KAPIYI KİLİTLEMEZ. Giriş yapmış herhangi bir kullanıcı tarayıcı
-- konsolundan Supabase'e doğrudan istek atıp kendine anahtar üretebilir
-- ve MCP sunucusunu kullanabilirdi.
--
-- Kullanıcının koşulu açıktı: "bu sadece benim hesabıma tanımlanacak,
-- başka hiçbir user'a tanımlanmayacak." Perde ile kilit farklı şeyler;
-- bu betik kilidi koyuyor.
--
-- NE DEĞİŞİYOR. with check'e bayrak koşulu ekleniyor: bayrağı olmayan
-- hesap api_keys'e satır EKLEYEMİYOR. using değişmiyor, yani herkes
-- (varsa) kendi satırını görmeye ve iptal etmeye devam ediyor -- bayrak
-- sonradan kapatılsa bile kullanıcı kendi anahtarını iptal edebilmeli.
--
-- MCP sunucusu BU KURALDAN ETKİLENMİYOR: servis rolüyle okuyor, RLS onu
-- atlıyor. Yani mevcut anahtarlar çalışmaya devam ediyor.

begin;

drop policy if exists api_keys_own on public.api_keys;
create policy api_keys_own on public.api_keys
  for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid()
              and exists (select 1 from public.user_prefs p
                           where p.user_id = auth.uid()
                             and p.prefs->>'mcp' = 'true'));

commit;

-- Kontrol: bayrağı olan hesaplar. Yalnızca olması gerekenler dönmeli.
select u.email, p.prefs->>'mcp' as mcp
  from public.user_prefs p
  join auth.users u on u.id = p.user_id
 where p.prefs->>'mcp' = 'true';

-- UYARI — BAYRAK UYGULAMA TARAFINDAN SİLİNEBİLİR.
-- app.html'deki tercihPrefsYap() prefs satırının TAMAMINI yeniden yazıyor.
-- Bayrak orada açıkça korunmazsa, kullanıcı uygulamayı açtığı anda
-- silinir. Bu bir kez yaşandı: bayrak elle açıldı, ekran açıldı, uygulama
-- ilk kaydetmede bayrağı sildi ve "anahtar üret" tam da yukarıdaki kurala
-- takıldı -- hata mesajı anahtarı işaret ettiği için sebep uzun süre
-- yanlış yerde arandı.
--
-- Koruma app.html'de (`if(mcpAcik) prefs.mcp = true;`) ve ölçümü
-- testler/mcp-bayrak.test.js'te. Bayrak bir daha elle açılacaksa önce o
-- testin geçtiğinden emin ol.
