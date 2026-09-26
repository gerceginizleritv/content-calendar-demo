@echo off
rem =====================================================================
rem  Shootboard -- REELS teslim klasorunu BIR TUR tara, yeni reel'leri yukle.
rem  Windows Gorev Zamanlayici bunu bes dakikada bir calistirir.
rem
rem  BU DOSYADA GIZLI ANAHTAR YOK ve olmayacak. SHOOTBOARD_KEY, R2_*
rem  ve SHOOTBOARD_MCP_URL bir kere Windows kullanici ortam degiskeni
rem  olarak tanimlanir (setx); Gorev Zamanlayici onlari kendiliginden
rem  buraya tasir. Boylece bu dosya depoya girebilir.
rem
rem  Izlenen klasor REELS_KLASOR ortam degiskeninden geliyor; yoksa
rem  E:\CLAUDE VIDEOS\TESLIM\REELS_V2 kullaniliyor.
rem
rem  UYARI: story-izle.bat ile AYRI bir gorev olmali. Ayni gorevde
rem  kosarlarsa biri patladiginda oteki de kosmaz -- ve hangisinin
rem  patladigi "Last Run Result" sutununda gorunmez.
rem =====================================================================
setlocal

cd /d "%~dp0"

rem Turkce karakterler gunluge duzgun dussun diye.
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"

rem Python nasil cagrilacak: istersen SHOOTBOARD_PYTHON ile sabitle.
set "PY=%SHOOTBOARD_PYTHON%"
if not defined PY where /q py.exe && set "PY=py -3"
if not defined PY set "PY=python"

set "GUNLUK=%~dp0reels-izle.log"

rem Gunluk buyudukce sisirmesin: 1 MB'i gecince bir onceki kopyayi at.
if exist "%GUNLUK%" for %%A in ("%GUNLUK%") do if %%~zA GTR 1000000 move /y "%GUNLUK%" "%GUNLUK%.eski" >nul

>>"%GUNLUK%" echo.
>>"%GUNLUK%" echo ==== %date% %time% ====

%PY% reels-izle.py --bir-kez >>"%GUNLUK%" 2>&1
set "KOD=%ERRORLEVEL%"

>>"%GUNLUK%" echo ---- cikis kodu: %KOD%

rem Gorev Zamanlayici "Last Run Result" sutununda bunu gosterir:
rem 0x0 basarili, digerleri gunluge bak.
exit /b %KOD%
