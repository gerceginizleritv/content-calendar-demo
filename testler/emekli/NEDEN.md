# Emekliye ayrılan testler

## win.test.js (3 Eylül 2026)
Takvimin **eski** davranışını doğruluyordu: sabit 42 günlük kayan pencere,
28 günlük adım. Uygulama sonradan gerçek **ay penceresine** geçti
(`ayPenceresi()`: ayın 1'inden son gününe, tam haftalara yuvarlanmış).
Testin iddiaları bu yüzden 1234 yerde düşüyordu — kod değil test eskimişti.
Yeni davranışı `ay.test.js` sınıyor.

## donusum.test.js — koşulamıyor (silinmedi)
Lokasyon uygulamasından alınmış özgün yedek dosyasını (`locations` +
`calendarEvents` alanlı JSON) argüman olarak bekliyor; o dosya artık yok.
Göç bir kez yapıldı ve doğrulandı.

## push.onceki.test.js — geçmesi BEKLENMİYOR
`onceki.html` (eski yapı) üzerinde koşuyor ve oradaki veri kaybı hatasını
KANITLIYOR. Düşmesi doğru sonuçtur; teşhisin kaydı olarak duruyor.

## fikir.test.js (3 Eylül 2026)
Fikirlerin ESKİ mimarisini sınıyordu: fikirler projeler tablosundaki bir
düğmeden (`data-fk-open`) açılan bir pencerede (`ideaOverlay`, `closeIdeas`,
`fk_close`) yaşıyordu. Fikirler sonradan **kendi sayfasına** taşındı; o
kancaların hiçbiri uygulamada yok. Yerini alan ve geçen testler:
`akis.test.js`, `kart.test.js`, `parca.test.js`, `parca-surukle.test.js`,
`fikir-secim.test.js`, `sc-fikir-ekle.test.js`.
