@echo off
rem =====================================================================
rem  Shootboard -- R2'de kalmis dosyalari LISTELE.
rem
rem  Cift tiklayinca HICBIR SEY SILMEZ: yalnizca uc grup listeler
rem  (SILINEBILIR / INCELE / DURUYOR) ve ekranda bekler. Silmek icin
rem  listeyi okuduktan sonra PowerShell'de:
rem
rem      cd E:\SHOOTBOARD
rem      python r2-supurge.py --sil
rem
rem  Gorev Zamanlayiciya BAGLANMIYOR ve baglanmamali: silen bir isin
rem  gozetimsiz calismasi, yanlis silmeyi fark etmeden birakir.
rem
rem  BU DOSYADA GIZLI ANAHTAR YOK. Ayarlar Windows kullanici ortam
rem  degiskenlerinden geliyor (bak: story-yukle.py / KURULUM).
rem =====================================================================
setlocal

cd /d "%~dp0"

set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"

set "PY=%SHOOTBOARD_PYTHON%"
if not defined PY where /q py.exe && set "PY=py -3"
if not defined PY set "PY=python"

%PY% r2-supurge.py %*
echo.
pause
