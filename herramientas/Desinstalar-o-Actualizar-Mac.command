#!/bin/bash
# ============================================================================
#  ASISTENTE DE ACTUALIZACIÓN, REINSTALACIÓN Y DESINSTALACIÓN (macOS)
#  SISTEMA: Control OBS Remoto + Biblia e Himnario
#  AUTOR:   Ing. Rubén Humberto Armendáriz Tamayo (ISC)
# ============================================================================

clear
echo "=================================================================="
echo " 🛠️  HERRAMIENTA DE ACTUALIZACIÓN Y DESINSTALACIÓN (macOS)"
echo "     Control OBS Remoto + Biblia e Himnario"
echo "=================================================================="
echo ""
echo "Cerrando procesos activos en segundo plano para liberar archivos..."

# Pedir cierre limpio por API local si el servidor está escuchando
curl -s -X POST http://127.0.0.1:3000/api/app/quit >/dev/null 2>&1
curl -s -X POST http://127.0.0.1:3100/api/app/quit >/dev/null 2>&1
sleep 1

# Asegurar que ningún proceso Electron de la app siga abierto
pkill -f "Control OBS Remoto" >/dev/null 2>&1
osascript -e 'tell application "Control OBS Remoto" to quit' >/dev/null 2>&1

echo "✅ El programa en segundo plano se ha detenido correctamente."
echo ""
echo "¿Qué deseas hacer ahora?"
echo "  1) Solo prepararme para ACTUALIZAR o REINSTALAR (Conserva tus MP3 y ajustes)"
echo "  2) DESINSTALAR por completo la aplicación de /Applications"
echo "  3) Salir"
echo ""
read -p "Selecciona una opción (1/2/3): " OPCION

if [ "$OPCION" = "2" ]; then
  rm -rf "/Applications/Control OBS Remoto.app"
  rm -rf "$HOME/Library/Application Support/control-obs-remoto"
  echo ""
  echo "✅ 'Control OBS Remoto' fue desinstalado por completo."
  echo "   (Tus carpetas de MP3 en Documentos se conservaron intactas)."
else
  echo ""
  echo "✅ Listo. Ya puedes arrastrar la nueva versión a Aplicaciones sin ningún bloqueo."
fi

echo ""
read -p "Presiona ENTER para cerrar esta ventana..."
