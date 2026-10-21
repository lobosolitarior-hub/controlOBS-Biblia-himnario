@echo off
chcp 65001 >nul
title Herramienta de Actualizacion y Desinstalacion - Control OBS Remoto
echo ====================================================================
echo   HERRAMIENTA DE ACTUALIZACION, REINSTALACION Y DESINSTALACION
echo   Control OBS Remoto + Biblia e Himnario (Windows)
echo   Autor: Ing. Ruben Humberto Armendariz Tamayo
echo ====================================================================
echo.
echo [1/3] Cerrando el servidor en segundo plano (Bandeja del sistema)...
taskkill /F /IM "Control OBS Remoto.exe" /T >nul 2>&1
timeout /t 1 /nobreak >nul
echo       Listo: Ningun archivo esta bloqueado.
echo.
echo [2/3] Limpiando registro de auto-inicio temporal...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "electron.app.Control OBS Remoto" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Control OBS Remoto" /f >nul 2>&1
echo.
if exist "%LOCALAPPDATA%\Programs\control-obs-remoto\Uninstall Control OBS Remoto.exe" (
    echo [3/3] Si deseas DESINSTALAR, se abrira el desinstalador oficial.
    echo       Si solo vas a INSTALAR UNA NUEVA VERSION encima, ya puedes
    echo       ejecutar el instalador Setup.exe sin ningun problema.
    echo.
    choice /C SN /M "¿Deseas abrir el Desinstalador ahora? (S=Si / N=No, solo actualizar)"
    if errorlevel 2 goto fin
    start "" "%LOCALAPPDATA%\Programs\control-obs-remoto\Uninstall Control OBS Remoto.exe"
) else (
    echo [3/3] El sistema ya quedo libre para instalar o reinstalar Control OBS Remoto.
)
:fin
echo.
pause
