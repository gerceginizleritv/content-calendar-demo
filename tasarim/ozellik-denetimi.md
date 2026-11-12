# Özellik denetimi — "olmayan özellik satılmaz"

**12 Kasım 2026 · fiyatlandırma promptunun ilk şartı**

Promptun kendi kuralı: *"⛔ OLMAYAN ÖZELLİK SATILMAZ. Yukarıdaki her
madde için koda bak ve kullanıcıya bir tablo ver: özellik · VAR / YOK
/ KISMEN · kanıt (dosya ve satır)."*

Bu tablo o şart. **Hiçbir satır tahmin değil**; her birinin yanında
dosya ve satır var.

---

## PLAN A — Starter (ücretsiz)

| Özellik | Durum | Kanıt |
|---|---|---|
| Hesapsız, tarayıcıda çalışır | **VAR** | `app.html:9060` — `storageKey()` oturum yoksa `STORAGE_KEY` döndürüyor |
| En fazla **2 aktif proje** | **KISMEN** | Sınır hesaba bağlı ve veritabanından okunuyor (`sql/07:31` `project_limit`, `app.html:15359`), yaratmada denetleniyor (`app.html:12982`). ⛔ **Ama dayatılmıyor** — aşağıya bak |
| En fazla **1 set** | **YOK** | `app.html:9694` — `SET_MAX = 20` **koda gömülü**, hesaba bağlı değil, veritabanından okunmuyor |
| Temel takvim, "tek çekim çok paylaşım" | **VAR** | Uygulamanın tamamı; `paylasim-takvimi.test.js` yeşil |

### ⛔ Proje sınırı bugün DAYATILMIYOR

`sql/07-sinir-kaldir.sql` kendi başında bunu yazıyor:

> *"Bu bir GÜVENLİK sınırı değil, bir kolaylık. Kullanıcı kendi
> satırını düzenleyebilir (RLS kendi satırına izin veriyor). **Para
> işin içine girdiğinde sınırın veritabanı tarafından DAYATILMASI
> gerekir; o zaman buraya bir trigger eklenecek.**"*

Yani depo bu anı önceden görmüş ve ne gerektiğini yazmış. Ücretli
katman açılmadan önce bu **şart** — promptun güvenlik maddesi 7 ile
aynı şeyi söylüyor.

---

## PLAN B — Creator Pro

| Özellik | Durum | Kanıt |
|---|---|---|
| Bulut: masaüstünde planla, sahada telefondan aç | **VAR** | Supabase + RLS; `app.html:8761` ve sonrası |
| Sınırsız **proje** | **KISMEN** | Hesaba bağlı (`project_limit`), dayatılmıyor |
| Sınırsız **script** | **YOK** | `app.html:13177` — `SCRIPT_ADET = 300` **koda gömülü** |
| Sınırsız **fikir** | **YOK** | `app.html:13174` — `FIKIR_ADET = 500` **koda gömülü** |
| Sınırsız **ihtiyaç kütüphanesi** | **YOK** | `app.html:9643` — `IHTIYAC_MAX = 300` **koda gömülü** |
| Mekana bağlı uyarılar | **VAR** | Mekanın "İzin" ve "Çekimde dikkat" notları çekim listesine kendiliğinden düşüyor; `app.html:9458` `mekanMaddeleri`, `cekim-listesi.test.js` 42/42 |
| **PDF** dışa aktarma | **YOK** | Depoda PDF üreten hiçbir şey yok |
| **CSV** dışa aktarma | **YOK** | CSV yalnızca **içe** aktarma (`app.html:21897`). Dışa aktarılan: JSON yedek (`19153`) ve takvim `.ics` (`22365`) |

⚠ **Dört "sınırsız" vaadinin üçü bugün koda gömülü bir tavana
çarpıyor.** Bunlar hesaba bağlanmadan "sınırsız" yazılamaz.

---

## PLAN C — Studio / Agency

| Özellik | Durum | Kanıt |
|---|---|---|
| **5 kullanıcıya kadar ekip erişimi** | **YOK** | Arandı: ekip, takım, davet, üye diye bir şey yok. Her tablo `user_id`'ye bağlı tek kullanıcılık |
| **Ortak çalışma alanı** | **YOK** | `workspace_id` alanı var ama **başka bir uygulamanın** (lokasyon uygulaması) satırlarını bulması için aynen geri yazılıyor; Shootboard onu kullanmıyor — `app.html:8794` kendi yorumunda yazıyor |
| Müşteri/sponsor için **salt-okunur takvim bağlantısı** | **VAR** | `app.html:3954` `paylasBtn`; `paylas.test.js` 27/27 yeşil — "salt okunur yazıyor", "düzenleme alanı YOK" ölçüleri dahil |
| **Ortak malzeme ve mekan havuzu** | **YOK** | Kütüphane `user_prefs.prefs.ihtiyaclar`, mekanlar `places` — ikisi de tek kullanıcıya bağlı |
| **Proje bazlı yetkilendirme** | **YOK** | Yetki diye bir kavram yok; RLS "kendi satırın" diyor, o kadar |

⚠ **Studio planının beş maddesinden dördü yok.** Bu plan bugün
satılamaz.

---

## PLAN D — Kurucu Üye

| Özellik | Durum | Kanıt |
|---|---|---|
| Tek seferlik ödeme, ömür boyu erişim | **YOK** | Ödeme altyapısı hiç yok |
| **200 kontenjan sayacı** | **YOK** | — |

Promptun kendi şartı: *"'İlk 200' SAYACI GERÇEK olmalı: sunucuda
sayılır, aynı anda gelen iki alımda 201. satılmaz."* Bu, veritabanı
tarafında kilitli bir sayaç demek ve sıfırdan yazılacak.

---

## Ödeme duvarı kuralları

| Kural | Durum | Kanıt |
|---|---|---|
| 1 · Sürtünmesiz başlangıç (hesapsız kullanım) | **VAR** | `app.html:9060` |
| 2 · Proje/set sınırında duvar | **YOK** | Duvar penceresi yok; sınıra çarpınca yalnızca uyarı çıkıyor (`app.html:12982`) |
| 3 · Senkron tetikleyici | **KISMEN** | "Giriş yap" var, ödeme ekranı yok |
| 4 · **Veri taşıma, hiçbir kayıp olmadan** | ⛔ **KISMEN — ve tutarsız** | Aşağıya bak |
| 5 · Para birimi + dönem seçicili fiyat sayfası | **YOK** | Fiyat sayfası hiç yok |

### ⛔ Veri taşımada gerçek bir boşluk var

Giriş anında hesapsız verinin ne olduğu **her veri türü için farklı**:

| Veri | Taşınıyor mu | Kanıt |
|---|---|---|
| **Kayıtlar** (takvim) | ✅ Evet — ve **onay soruluyor** | `afterSignIn`, `app.html:23244` civarı: `anonim.length && await onayla(...)` |
| **Projeler** | ⚠ Evet ama **sessizce**, onay sorulmadan | `app.html:9452` — `readLocalProjects(projStorageKey()) \|\| readLocalProjects(PROJ_KEY)` |
| **Mekanlar** | ❌ **Hayır** | `app.html:13194` — `mekanKey()` oturum varsa farklı anahtar, hesapsız anahtara **düşmüyor** |
| **Fikirler** | ❌ **Hayır** | `app.html:13445` — aynı kalıp, geri düşme yok |
| **Scriptler** | ❌ **Hayır** | `app.html:13446` — aynı kalıp, geri düşme yok |
| **İhtiyaç kütüphanesi / setler** | ❓ Doğrulanmadı | `user_prefs.prefs` üzerinden; ayrı bir ölçüm gerekiyor |

Yani bugün hesapsız çalışan biri hesap açtığında **mekanları,
fikirleri ve scriptleri görünmez oluyor** — silinmiyor, tarayıcıda
duruyor ama uygulama artık o anahtarı okumuyor.

Promptun 4. kuralı *"HİÇBİR KAYIP OLMADAN"* diyor. Bugünkü hâl bunu
karşılamıyor ve bu, **para alınmadan önce düzeltilmesi gereken bir
şey** — çünkü ödeme duvarının teklifi tam olarak "hesap aç, verin
gelsin".

---

## Fiyat ve limitlerin veritabanından okunması

Promptun şartı: *"Hiçbiri koda ya da app.html'e GÖMÜLMEZ; hepsi
veritabanından okunur."*

| | Durum | Kanıt |
|---|---|---|
| Hesap başına **kota okuma** altyapısı | **VAR** | `user_prefs.entry_limit`, `project_limit` (`sql/07:31`), `app.html:15358-15359` |
| Hesap başına **özellik anahtarı** kalıbı | **VAR** | `user_prefs.prefs.story_yayin` → `storyYayinAcik` (`app.html:15426`) |
| **Fiyat tablosu** | **YOK** | — |
| **Dayatma** (sunucu tarafı) | **YOK** | `sql/07`'nin kendi notu |

✅ **İyi haber:** okuma tarafının kalıbı zaten kurulu ve çalışıyor.
Yeni kota ve anahtarlar aynı yoldan eklenebilir; sıfırdan bir
mekanizma gerekmiyor.

---

## Özet: bugün ne satılabilir

| Plan | Satılabilir mi | Neden |
|---|---|---|
| **Starter** | ⚠ Sınır dayatılmadan anlamsız | 2 proje / 1 set sınırı bugün kandırılabilir |
| **Creator Pro** | ⚠ Dört vaadin üçü eksik | "Sınırsız" script/fikir/kütüphane koda gömülü tavana çarpıyor; PDF/CSV dışa aktarma yok |
| **Studio / Agency** | ❌ **Hayır** | Beş maddenin dördü yok |
| **Kurucu Üye** | ❌ **Hayır** | Ödeme altyapısı ve kontenjan sayacı yok |

---

## Kararın senin: YOK çıkanlar ne olacak

Promptun kuralı: *"YOK çıkanlar fiyatlandırma sayfasına YAZILMAZ; ne
yapılacağı kullanıcının kararı."*

Üç yol var ve her birinin bedeli farklı:

**(a) Önce eksikleri yap, sonra sat.** Dürüst ama uzun: ekip erişimi
ve proje bazlı yetkilendirme tek başına büyük işler.

**(b) Planları bugün olana göre küçült.** Studio planı rafa kalkar,
Creator Pro'dan PDF/CSV çıkar, "sınırsız" vaatleri hesaba bağlanınca
yazılır. Bugün satılabilir bir şey çıkar.

**(c) "Yakında" diye yaz.** ⚠ **Önermiyorum.** MARKA.md doğrulanmamış
iddiayı yasaklıyor ve para alınan bir sayfada "yakında" satılan bir
söz olur.

---

## Sırada ne var

Bu tablo onaylanınca tasarım belgesi yazılacak. Belgenin kapsamı
senin (a)/(b)/(c) kararına göre şekillenir.

⚠ **Promptun sonu kesilmiş geldi** — son satır *"Tasarim belgesinde
her madde icin: nasil saglanacak, nasil d"* diye yarıda bitiyor.
Eksik kısmı gönderirsen belgeye eklerim.
