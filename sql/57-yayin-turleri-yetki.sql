-- 57 — TAKVİM KAYDEDİLEMİYORDU: tetikleyicinin çağırdığı işleve yetki yok
--
-- ══════════════════════════════════════════════════════════════════
-- BELİRTİ
-- ══════════════════════════════════════════════════════════════════
-- 6 Ekim 2026. Uygulamada herhangi bir kayıt kaydedilince buluta
-- yazma patlıyordu:
--
--   [bulut] yazma hatasi
--   code: "42501"
--   message: "permission denied for function story_yayin_turleri"
--
-- Yerel kopya yazıldığı için veri kaybolmuyordu ama HİÇBİR değişiklik
-- buluta çıkmıyordu.
--
-- ══════════════════════════════════════════════════════════════════
-- SEBEP — sql/54 kendi kendini kesiyor
-- ══════════════════════════════════════════════════════════════════
-- sql/54 iki şeyi AYNI DOSYADA yaptı:
--
--   1. satır 59: `revoke all on function public.story_yayin_turleri()
--      from public, anon, authenticated;`
--   2. satır 153: `story_yayin_ani_tazele()` tetikleyicisini, gövdesinde
--      `public.story_yayin_turleri()` ÇAĞIRACAK şekilde yeniden yazdı.
--
-- O tetikleyici `calendar_events` üzerinde BEFORE INSERT/UPDATE olarak
-- duruyor ve `security definer` DEĞİL -- yani çağıran rolle, yani
-- tarayıcının `authenticated` rolüyle çalışıyor. Dolayısıyla uygulamanın
-- her yazma denemesi, yetkisi az önce alınmış bir işlevi çağırıyordu.
--
-- sql/53'teki önceki sürüm tür listesini gövdesinde DÜZ YAZI tutuyordu;
-- çağrı yoktu, o yüzden sorun da yoktu. Listeyi "tek yere" taşıyan
-- değişiklik, listeyi okuma hakkı olmayan bir yerden okunur hale getirdi.
--
-- ⚠ Neden hemen değil de sonradan patladığı: plpgsql çağrı planlarını
-- bağlantı başına önbellekliyor ve SQL dilinde yazılmış IMMUTABLE bir
-- işlev plana gömülebiliyor (gömüldüğünde yetki denetimi de planda
-- kalmıyor). Başka bir DDL planları geçersiz kılınca plan yeniden
-- kuruluyor ve denetim bu kez çalışıyor. Yani kusur sql/54'ten beri
-- oradaydı, görünmesi için bir yeniden planlama gerekti.
--
-- ══════════════════════════════════════════════════════════════════
-- ÇÖZÜM — yetkiyi geri vermek, çünkü korunacak bir şey yok
-- ══════════════════════════════════════════════════════════════════
-- `story_yayin_turleri()` şunu döndürüyor:
--
--   select array['story', 'reels', 'shorts']::text[];
--
-- Sabit. Veri okumuyor, yan etkisi yok, kullanıcıya ait hiçbir şeye
-- dokunmuyor. Oradaki `revoke`, gerçekten korunması gereken işlevlerden
-- (`story_kuyruk_al` satır yazıyor, `story_asili_topla` durum
-- değiştiriyor) kopyalanmış bir alışkanlıktı.
--
-- Diğer yol -- tetikleyiciyi `security definer` yapmak -- aynı sonucu
-- veriyor ama bir BEFORE tetikleyicisini sahip yetkisiyle çalıştırmak,
-- sabit bir diziyi okutmaktan çok daha geniş bir kapı. Küçük olanı
-- seçildi.
--
-- ⚠ BU DOSYA sql/54'ÜN TAMAMININ YERİNE GEÇMİYOR. sql/54 aynı zamanda
-- `story_kuyruk_al`'ın ESKİ sürümünü tanımlıyor (satır 97-98); onu
-- yeniden koşturmak sql/55 ve sql/56'daki kuyruk değişikliklerini --
-- Facebook reels'in kuyruktan çıkarılması dahil -- geri alır. Yetki
-- sorununu düzeltmek için YALNIZCA bu dosya koşturulmalı.

begin;

grant execute on function public.story_yayin_turleri() to authenticated;

commit;

-- ═══ KONTROL ══════════════════════════════════════════════════════
-- true dönmeli.
select has_function_privilege('authenticated', 'public.story_yayin_turleri()', 'execute')
       as uygulama_kaydedebilir;
