# 📱🎥 Control OBS Remoto (Celular / Tablet) + Biblia e Himnario Adventista

Sistema de **control remoto inalámbrico desde celular o tablet** y proyección en directo para **OBS Studio**, diseñado especialmente para iglesias. Permite controlar toda la transmisión desde la banca sin necesidad de estar en la cabina de control:

- **📺 Monitor en Vivo en tu Celular o Tablet:** Visualiza en tiempo real lo que está saliendo al aire en OBS Studio, qué escena está activa y el estado de **Transmisión (`🔴 EN VIVO`)** y **Grabación (`⏺️ REC`)**.
- **🎬 Control de Escenas y Fuentes de OBS:** Cambia entre cualquier escena de OBS con un toque y **muestra u oculta fuentes individuales** (`👁️ Visible / 🚫 Oculto` para cámaras, imágenes, diapositivas, videos o plecas) dentro de la escena actual, además de soporte para **Modo Estudio**.
- **⌨️ Teclado Remoto y Atajos 100% Personalizables:**
  - Botones grandes en pantalla para **`Re Pág` (Anterior)**, **`Av Pág` (Siguiente diapositiva)**, **Flechas (`⬅️`, `➡️`, `⬆️`, `⬇️`)**, **`Espacio`**, **`Enter`**, **`F5` (Iniciar PowerPoint)**, **`Shift+F5`**, **`B` (Pantalla negra)** y **`Esc`**.
  - **Editor de Atajos integrado:** Agrega, edita, cambia el tamaño o elimina las teclas que tú quieras tener en pantalla (incluyendo combinaciones con `Ctrl`, `Alt/Option`, `Shift`, `Cmd/Win`) y dirígelas a PowerPoint, Keynote, Canva u OBS.
- **🎞️ Control de Fuentes Multimedia y Mezclador de Audio de OBS:** Botones de **Play**, **Pausa**, **Reiniciar**, **Stop** y barra de progreso interactiva para cualquier video en OBS, más control para silenciar (`🔇`) o ajustar el volumen de micrófonos y pistas.
- **🎵 Nuevo Himnario Adventista completo (614 himnos):** Letra sincronizada con avance automático o manual, soporte para pistas locales (**Cantado**, **Instrumental** o **Solo letra**), salto inmediato a cualquier estrofa y cambio automático a la escena `Himnario` en OBS.
- **📖 Santa Biblia integrada (100% sin internet):** Versiones **Reina Valera 1960 (RVR1960)** y **Dios Habla Hoy (DHH)** completas (66 libros), buscador inteligente de citas (`Génesis 3:20`, `Éxodo 20:8`, `Juan 3:16`), selector rápido de Libro y Capítulo y cambio entre **2 escenas de OBS** (`🖼️ Fondo` y `🎥 Cámara`).

---

## 📥 1. Instalación fácil para usuarios no técnicos (Windows y Mac)

1. Ve a la sección **[Releases](../../releases)** de este repositorio en GitHub.
2. Descarga el instalador para tu computadora de cabina:
   - **Windows:** `Control OBS Remoto Setup 1.0.3.exe` (o la versión portable `Control OBS Remoto 1.0.3.exe`).
   - **Mac (macOS):** `Control OBS Remoto-1.0.3-arm64.dmg` (Apple Silicon M1/M2/M3/M4) o `Control OBS Remoto-1.0.3.dmg` (Intel).
3. **¿Cómo se abre y cómo se conecta el celular?**
   - En **Windows**, el instalador crea automáticamente un acceso directo en tu **Escritorio** llamado **`Control OBS Remoto`** y abre el programa al finalizar la instalación.
   - Al abrir **`Control OBS Remoto`** desde el Escritorio (en Windows o en Mac), verás de inmediato en pantalla el **Panel de Cabina** con:
     1. **El Código QR grande** listo para escanear con la cámara de tu celular o tablet (conectado al mismo Wi-Fi de la iglesia).
     2. El botón **`⚙️ Configurar OBS y Escenas`** para poner la contraseña de OBS o revisar los nombres de tus escenas.
     3. El botón **`📂 Abrir Carpeta para pegar MP3`** y botones de un solo clic para copiar las direcciones de OBS.
   - Si cierras la ventana con la `X`, el sistema **sigue funcionando en segundo plano** (junto al reloj en Windows o en la barra superior en Mac) para que tu celular no pierda conexión. Cada vez que quieras volver a ver el **Código QR** o entrar a **Configuraciones**, simplemente vuelve a hacer doble clic en el icono **`Control OBS Remoto`** del Escritorio.

---

## 📱 2. Cómo conectar tu Celular o Tablet (en 10 segundos)

1. Conecta tu celular o tablet a la **misma red Wi-Fi** donde está conectada la computadora con OBS Studio.
2. Abre **`Control OBS Remoto`** en la computadora y apunta la cámara de tu celular al **Código QR** que aparece en pantalla (o toca el botón **`📱 QR`** arriba a la derecha).
3. Se abrirá el control remoto en el navegador de tu celular/tablet (`http://192.168.X.X:3000/remoto`).
   > 💡 **Tip:** En tu celular puedes elegir **"Agregar a la pantalla de inicio"** en el menú del navegador para que quede como una aplicación de pantalla completa.

---

## 🎥 3. Configuración en OBS Studio (en 3 minutos)

### Paso A: Habilitar OBS WebSocket
1. En OBS Studio ve al menú superior: **Herramientas → Ajustes del servidor WebSocket**.
2. Marca la casilla **"Habilitar servidor WebSocket"** (puerto `4455`).
3. Si usas contraseña en OBS, abre **`Control OBS Remoto`**, haz clic en **`⚙️ Configurar OBS y Escenas`**, pega la contraseña y presiona **Guardar y Conectar** (el indicador se pondrá en **verde 🟢**).

### Paso B: Agregar las Fuentes de Navegador para Himnario y Biblia (Opcional)
Si deseas proyectar también los himnos y la Biblia desde tu celular/tablet:
1. **Escena `Himnario`:**
   - Crea una escena en OBS llamada **`Himnario`**.
   - Agrega una fuente de **Navegador (Browser Source)** con URL: `http://localhost:3000/proyeccion` (Tamaño: `1920` × `1080`).
2. **Escenas de Biblia (`Biblia` y `Biblia Camara`):**
   - Crea tus escenas **`Biblia`** (con tu imagen o video de fondo) y **`Biblia Camara`** (con la cámara del predicador).
   - En ambas escenas agrega una fuente de **Navegador (Browser Source)** con URL: `http://localhost:3000/biblia` (`1920` × `1080`).
3. **Panel acoplable dentro de OBS (Opcional):**
   - En **Paneles (Docks) → Paneles de navegador personalizados...**, puedes agregar:
     - **Control Completo:** `http://localhost:3000/remoto`
     - **Panel Compacto Himnario/Biblia:** `http://localhost:3000/panel`

> 🔗 **Compatibilidad automática:** Si ya tenías instalado el proyecto hermano `Biblia e Himnario OBS` corriendo en el puerto `3000`, este sistema lo detecta automáticamente, se abre en el puerto `3100` y se enlaza en tiempo real con él sin que tengas que cambiar ninguna URL en OBS.

---

## ⌨️ 4. Cómo configurar tus propios Atajos de Teclado en el Celular

1. En tu celular o tablet, entra a la pestaña **`⌨️ Teclas/PPT`** en la barra inferior.
2. Toca el botón **`✏️ Configurar Teclas`**.
3. Puedes tocar **`➕ Nuevo Atajo`** o **`✏️ Editar`** sobre cualquier botón para elegir:
   - **Nombre e Icono** del botón (ej. `⏭️ Siguiente Diapo`, `🎬 Iniciar PPT`, `⬛ Pantalla Negra`).
   - **Tamaño** (`Grande` para botones principales como `Re Pág` y `Av Pág`, o `Normal`) y **Color**.
   - **Tecla a enviar** (o usar el botón **`🎹 Detectar`** presionando directamente la tecla en tu teclado) y combinaciones con `Ctrl`, `Alt/Option`, `Shift`, `Cmd/Win`.
4. **Nota para usuarios de Mac (macOS):** La primera vez que envíes teclas hacia PowerPoint o Keynote en Mac, el sistema te pedirá autorizar el permiso en **Ajustes del Sistema → Privacidad y Seguridad → Accesibilidad**.

---

## 🎵 5. Cómo agregar los archivos MP3 del Himnario

Al abrir el programa por primera vez, se crea automáticamente en tus **Documentos** la carpeta:
- `Documentos/Biblia e Himnario OBS/Cantado` → Copia aquí los MP3 cantados (`001.mp3`, `001 - Titulo.mp3`, etc.).
- `Documentos/Biblia e Himnario OBS/Instrumental` → Copia aquí los MP3 instrumentales.

Puedes abrir esta carpeta directamente con el botón **`📂 Abrir Carpeta para pegar MP3`** en la pantalla principal del programa.

---

## 🛠️ 6. Cómo Actualizar, Reinstalar o Desinstalar sin bloqueos

Como el programa mantiene su servidor activo en segundo plano para el celular y para OBS Studio, incluimos herramientas automáticas para que **actualizar, reinstalar o desinstalar sea 100% transparente y nunca marque error de "Aplicación en uso"**:

1. **En Windows (Automático en el Instalador):**
   - Al ejecutar una nueva versión de **`Control OBS Remoto Setup.exe`** (o al ejecutar el Desinstalador de Windows), el propio instalador **cierra automáticamente en segundo plano** la versión anterior antes de copiar o borrar archivos (`build/installer.nsh`), sin que tengas que buscar el icono junto al reloj.
2. **Desde dentro de la propia pantalla del programa (Windows y Mac):**
   - En el **Panel de Cabina** o dentro de **`⚙️ Configurar OBS y Escenas`**, tienes dos botones directos para usuarios no técnicos:
     - **`🛑 Cerrar por completo (Actualizar/Desinstalar)`:** Detiene el servidor en segundo plano y cierra el icono de la barra de tareas para que puedas arrastrar una nueva versión en Mac o desinstalar al instante.
     - **`🧹 Restaurar Ajustes`:** Regresa la configuración a sus valores originales de fábrica si alguien movió algún ajuste por error (conservando intactos todos tus archivos MP3).
3. **Scripts de apoyo de 1 clic (en la carpeta `herramientas/`):**
   - **Mac:** Doble clic en `herramientas/Desinstalar-o-Actualizar-Mac.command`.
   - **Windows:** Doble clic en `herramientas/Desinstalar-o-Actualizar-Windows.bat`.

---

## 💻 7. Desarrollo desde el código fuente (Node.js)

```bash
# Instalar dependencias
npm install

# Ejecutar solo el servidor web (http://localhost:3000/remoto)
npm start

# Ejecutar la aplicación de escritorio y bandeja con Electron
npm run app

# Generar instaladores en la carpeta dist/
npm run dist:mac   # Instalador .dmg y .zip para macOS
npm run dist:win   # Instalador Setup .exe (con icono en Escritorio) y Portable para Windows
npm run dist:all   # Generar ambos instaladores (Mac y Windows)
```

---

## 👨‍💻 Autor y Agradecimientos

Este sistema fue diseñado y desarrollado por:

- **Ing. Rubén Humberto Armendáriz Tamayo**
- *Ingeniero en Sistemas Computacionales*

> 🙏 **¿Ha sido de bendición este proyecto para tu iglesia?**
> Este software se comparte de manera totalmente gratuita para apoyar el ministerio de comunicación, audio y transmisión de las congregaciones. Si deseas agradecer o compartir desde qué iglesia lo están utilizando, puedes:
> - ⭐ Dejar una **estrella (Star)** arriba a la derecha en este repositorio de GitHub.
> - ✉️ Enviar un mensaje de saludo a: **[lobosolitarior@gmail.com](mailto:lobosolitarior@gmail.com)**
