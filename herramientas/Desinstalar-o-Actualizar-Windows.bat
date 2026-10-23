@echo off
chcp 65001 >nul
title Herramienta de Actualizacion y Desinstalacion - Control OBS Remoto
color 0B

echo ============================================================================
echo   HERRAMIENTA DE CIERRE, ACTUALIZACION Y LIMPIEZA - CONTROL OBS REMOTO
echo   Autor: Ing. Ruben Humberto Armendariz Tamayo
echo ============================================================================
echo.
echo   NOTA: Tus pistas MP3 y configuraciones NO se borraran.
echo.

echo [1/5] Cerrando procesos en segundo plano (sin bloqueo WMI)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process | Where-Object { $_.ProcessName -like '*Control OBS*' -or $_.ProcessName -like '*old-uninstaller*' } | Stop-Process -Force -ErrorAction SilentlyContinue"

echo [2/5] Quitando inicio automatico de Windows...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "electron.app.Control OBS Remoto" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Control OBS Remoto" /f >nul 2>&1

echo [3/5] Eliminando archivos de la version anterior...
if exist "%LOCALAPPDATA%\Programs\control-obs-remoto" (
    rmdir /S /Q "%LOCALAPPDATA%\Programs\control-obs-remoto" >nul 2>&1
)
if exist "%LOCALAPPDATA%\Programs\Control OBS Remoto" (
    rmdir /S /Q "%LOCALAPPDATA%\Programs\Control OBS Remoto" >nul 2>&1
)
if exist "%PROGRAMFILES%\Control OBS Remoto" (
    rmdir /S /Q "%PROGRAMFILES%\Control OBS Remoto" >nul 2>&1
)
if exist "%LOCALAPPDATA%\control-obs-remoto-updater" (
    rmdir /S /Q "%LOCALAPPDATA%\control-obs-remoto-updater" >nul 2>&1
)

echo [4/5] Limpiando registro de desinstalacion anterior para evitar bloqueos...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$paths = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*');" ^
  "Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Control OBS Remoto*' -or $_.UninstallString -like '*Control OBS Remoto*' } | ForEach-Object { Remove-Item -Path $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue }"

echo [5/5] Eliminando accesos directos antiguos...
del /F /Q "%USERPROFILE%\Desktop\Control OBS Remoto.lnk" >nul 2>&1
del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Control OBS Remoto.lnk" >nul 2>&1

echo.
echo ============================================================================
echo   LISTO: La version anterior ha sido cerrada y desinstalada por completo.
echo   Ahora ya puedes ejecutar el nuevo instalador Setup.exe sin ningun bloqueo.
echo ============================================================================
echo.
pause
