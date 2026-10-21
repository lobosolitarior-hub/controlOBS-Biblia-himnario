; ============================================================================
;  SCRIPT NSIS PERSONALIZADO PARA INSTALACIÓN, ACTUALIZACIÓN Y DESINSTALACIÓN
;  SISTEMA: Control OBS Remoto + Biblia e Himnario
;  AUTOR:   Ing. Rubén Humberto Armendáriz Tamayo (ISC)
; ============================================================================
;  Cierra automáticamente cualquier instancia en segundo plano (Bandeja del
;  sistema) antes de instalar, reinstalar, actualizar o desinstalar en Windows,
;  evitando bloqueos de archivos o errores de "Aplicación en uso".
; ============================================================================

!macro customInit
  nsExec::ExecToStack 'taskkill /F /IM "Control OBS Remoto.exe" /T'
  Sleep 800
!macroend

!macro customUnInit
  nsExec::ExecToStack 'taskkill /F /IM "Control OBS Remoto.exe" /T'
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Control OBS Remoto"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Control OBS Remoto"
  Sleep 800
!macroend
