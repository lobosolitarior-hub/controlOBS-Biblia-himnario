; ============================================================================
;  SCRIPT NSIS PERSONALIZADO PARA INSTALACIÓN, ACTUALIZACIÓN Y DESINSTALACIÓN
;  SISTEMA: Control OBS Remoto + Biblia e Himnario
;  AUTOR:   Ing. Rubén Humberto Armendáriz Tamayo (ISC)
; ============================================================================
;  Evita bloqueos de "Aplicación en uso" y soluciona el problema de actualización
;  entre versiones (ej. 1.0.0 a 1.0.1) cerrando procesos activos con nsProcess
;  nativo y limpiando el registro de desinstalación anterior antes de instalar.
; ============================================================================

!ifndef nsProcess::FindProcess
  !include "nsProcess.nsh"
!endif

!macro customInit
  ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${nsProcess::KillProcess} "old-uninstaller.exe" $R0
  ${nsProcess::KillProcess} "Uninstall ${PRODUCT_FILENAME}.exe" $R0
  ${nsProcess::Unload}
  !ifndef BUILD_UNINSTALLER
    DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
    !ifdef UNINSTALL_REGISTRY_KEY_2
      DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY_2}"
      DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
    !endif
  !endif
!macroend

!macro customCheckAppRunning
  ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${nsProcess::KillProcess} "old-uninstaller.exe" $R0
  ${nsProcess::KillProcess} "Uninstall ${PRODUCT_FILENAME}.exe" $R0
  ${nsProcess::Unload}
  Sleep 500
  !ifndef BUILD_UNINSTALLER
    DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
    !ifdef UNINSTALL_REGISTRY_KEY_2
      DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY_2}"
      DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
    !endif
    ${if} $INSTDIR != ""
      RMDir /r "$INSTDIR"
    ${endif}
  !endif
!macroend

!macro customRemoveFiles
  ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${nsProcess::Unload}
  Sleep 400
  RMDir /r $INSTDIR
!macroend

!macro customUnInit
  ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${nsProcess::Unload}
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.${PRODUCT_FILENAME}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_FILENAME}"
  Sleep 500
!macroend
