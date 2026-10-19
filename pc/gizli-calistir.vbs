' =====================================================================
'  Shootboard -- bir .bat dosyasini PENCERE ACMADAN calistirir.
'
'  NEDEN VAR
'  Uc izleyici gorevi (story / reels / threads) bes dakikada bir
'  kosuyor. Gorev Zamanlayici bir .bat dosyasini dogrudan cagirdiginda
'  Windows her kosuda bir cmd.exe penceresi aciyor ve o pencere one
'  firliyor. 17 Ekim 2026'da kullanici bunu bildirdi: cekim sirasinda
'  pencere surekli elinin altinda ekrana cikiyordu.
'
'  Bu sarmalayici .bat'i GIZLI pencerede baslatiyor, bitmesini
'  BEKLIYOR ve cikis kodunu oldugu gibi geri veriyor -- boylece
'  Gorev Zamanlayici'nin "Last Run Result" sutunu dogru kalmaya
'  devam ediyor.
'
'  UYARI -- CIKIS KODU KAYBOLURSA ARIZA GORUNMEZ OLUR.
'  Run(..., 0, False) yazilsaydi is arka planda baslar, bu betik
'  hemen biterdi ve Zamanlayici HER KOSUYU basarili gosterirdi:
'  izleyici aylarca patlasa da sutunda 0x0 yazardi. Beklemek (True)
'  ve WScript.Quit ile kodu geri vermek bu yuzden sart.
'
'  UYARI -- GIZLEMEK, GORMEMEK DEMEK DEGIL. Pencere kapandi diye
'  izleyici gozden kaybolmasin: her .bat kendi gunlugunu yazmaya
'  devam ediyor (story-izle.log / reels-izle.log / threads-izle.log).
'  Tek bakma yeri artik o gunlukler.
'
'  KULLANIM (Gorev Zamanlayici > gorevi ac > Eylemler > Duzenle):
'    Program/script    : wscript.exe
'    Add arguments     : "E:\SHOOTBOARD\gizli-calistir.vbs" "E:\SHOOTBOARD\threads-izle.bat"
'    Start in          : E:\SHOOTBOARD
'
'  BU DOSYADA GIZLI ANAHTAR YOK ve olmayacak. SHOOTBOARD_KEY, R2_* ve
'  SHOOTBOARD_MCP_URL Windows kullanici ortam degiskenlerinden gelmeye
'  devam ediyor; bu betik onlara hic dokunmuyor.
'
'  BU DOSYADA TURKCE KARAKTER YOK ve olmamali: wscript dosyayi sistem
'  kod sayfasiyla okuyor, UTF-8 Turkce karakter sozdizimi hatasi
'  verdirebiliyor. Yorumlar sade ASCII.
' =====================================================================
Option Explicit

Dim kabuk, komut, i, kod

If WScript.Arguments.Count = 0 Then
  ' Calistirilacak dosya verilmedi. Sessizce 0 donmek ariza gizler:
  ' gorev hicbir sey yapmadan "basarili" gorunur. 2 ile cik.
  WScript.Quit 2
End If

' Yollar bosluk icerebilir: her parca tirnak icinde gidiyor.
komut = """" & WScript.Arguments(0) & """"
For i = 1 To WScript.Arguments.Count - 1
  komut = komut & " """ & WScript.Arguments(i) & """"
Next

Set kabuk = CreateObject("WScript.Shell")

' 0 = pencere hic gorunmesin.  True = bitmesini bekle.
kod = kabuk.Run(komut, 0, True)

' Cikis kodu .bat'ten geldigi gibi Gorev Zamanlayici'ya gidiyor.
WScript.Quit kod
