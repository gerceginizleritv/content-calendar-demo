@echo off
rem =====================================================================
rem  Shootboard -- takvimi diske yedekle. SALT OKUR.
rem
rem  Supabase UCRETSIZ planda ve ucretsiz planin otomatik yedegi YOK.
rem  Gorev Zamanlayici bunu haftada bir calistiriyor.
rem
rem  Silen bir is DEGIL: yalnizca listeleme araclarini cagiriyor ve
rem  diske yaziyor. Gozetimsiz kosmasi guvenli, r2-supurge'nin aksine.
rem
rem  BU DOSYADA GIZLI ANAHTAR YOK. SHOOTBOARD_KEY ve SHOOTBOARD_MCP_URL
rem  Windows kullanici ortam degiskenlerinden geliyor (setx).
rem =====================================================================
setlocal

cd /d "%~dp0"

set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"

set "PY=%SHOOTBOARD_PYTHON%"
if not defined PY where /q py.exe && set "PY=py -3"
if not defined PY set "PY=python"

set "GUNLUK=%~dp0yedek-al.log"

rem Gunluk buyudukce sismesin: 1 MB'i gecince bir onceki kopyayi at.
if exist "%GUNLUK%" for %%A in ("%GUNLUK%") do if %%~zA GTR 1000000 move /y "%GUNLUK%" "%GUNLUK%.eski" >nul

>>"%GUNLUK%" echo.
>>"%GUNLUK%" echo ==== %date% %time% ====

%PY% yedek-al.py >>"%GUNLUK%" 2>&1
set "KOD=%ERRORLEVEL%"

>>"%GUNLUK%" echo ---- cikis kodu: %KOD%

rem Gorev Zamanlayici "Last Run Result" sutununda bunu gosterir:
rem 0x0 basarili, digerleri gunluge bak.
exit /b %KOD%
