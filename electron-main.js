/**
 * ============================================================================
 *  SISTEMA: Control OBS Remoto (Celular / Tablet) + Biblia e Himnario
 *  AUTOR:   Ing. Rubén Humberto Armendáriz Tamayo
 *  TÍTULO:  Ingeniero en Sistemas Computacionales
 *  GITHUB:  https://github.com/lobosolitarior-hub/controlOBS-Biblia-himnario
 * ============================================================================
 */

const { app, BrowserWindow, Tray, Menu, shell, clipboard, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let mainWindow = null;
let isQuitting = false;
let serverModule = null;

function performCleanExit(options = {}) {
  isQuitting = true;
  if (options.disableAutoStart) {
    try {
      app.setLoginItemSettings({ openAtLogin: false });
    } catch {}
  }
  if (tray) {
    try {
      tray.destroy();
      tray = null;
    } catch {}
  }
  if (serverModule && typeof serverModule.gracefulShutdown === 'function') {
    serverModule.gracefulShutdown().finally(() => {
      app.quit();
      setTimeout(() => process.exit(0), 400);
    });
  } else {
    app.quit();
    setTimeout(() => process.exit(0), 400);
  }
}

// Evitar que se abran dos instancias al mismo tiempo; si otra instancia o instalador
// pide cerrar (--quit / --uninstall), cerramos limpiamente la instancia activa.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Icono PNG 16x16 en base64 para la bandeja del sistema (Windows Tray / Mac Menu Bar)
const TRAY_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVQ4T2NkoBAwUqifYdQABgZGBgY2BgaG/0g8XAw2AJsB2AwgZiA2AzA14PIwNoMJsRkYGJ7jciM2A4g1gBjD8LkBn4H43IDNDcRmALGG4fIwIbaMAgB5hBMR73qN5AAAAABJRU5ErkJggg==';

function createTrayIcon() {
  const iconTrayPath = path.join(__dirname, 'public', 'icon-tray.png');
  const iconPngPath = path.join(__dirname, 'public', 'icon.png');
  const iconIcoPath = path.join(__dirname, 'public', 'icon.ico');
  try {
    if (process.platform === 'win32' && fs.existsSync(iconIcoPath)) {
      const icoImg = nativeImage.createFromPath(iconIcoPath);
      if (!icoImg.isEmpty()) return icoImg.resize({ width: 16, height: 16 });
    }
    const candidate = fs.existsSync(iconTrayPath) ? iconTrayPath : iconPngPath;
    const img = nativeImage.createFromPath(candidate);
    if (!img.isEmpty()) {
      return img.resize({ width: 18, height: 18 });
    }
  } catch {}
  return nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON_BASE64}`);
}

function getWindowIcon() {
  const icoPath = path.join(__dirname, 'public', 'icon.ico');
  const pngPath = path.join(__dirname, 'public', 'icon.png');
  if (process.platform === 'win32' && fs.existsSync(icoPath)) {
    return icoPath;
  }
  if (fs.existsSync(pngPath)) {
    return pngPath;
  }
  return undefined;
}

function getActivePort() {
  return (serverModule && typeof serverModule.getPort === 'function' && serverModule.getPort()) || 3000;
}

function getMobileUrl() {
  const port = getActivePort();
  const ips =
    (serverModule &&
      typeof serverModule.getLocalNetworkIPs === 'function' &&
      serverModule.getLocalNetworkIPs()) ||
    [];
  const ip = ips.length > 0 ? ips[0].address : 'localhost';
  return `http://${ip}:${port}/remoto`;
}

function openRemoteControlWindow(options = {}) {
  const port = getActivePort();
  const query = options.query || 'desktop=1';
  const targetUrl = `http://localhost:${port}/remoto?${query}`;

  if (mainWindow) {
    if (options.query) {
      mainWindow.loadURL(targetUrl);
    }
    mainWindow.show();
    mainWindow.focus();
    if (process.platform === 'darwin' && app.dock) {
      app.dock.show();
    }
    return;
  }

  mainWindow = new BrowserWindow({
    width: 780,
    height: 840,
    minWidth: 380,
    minHeight: 560,
    title: 'Control OBS Remoto — Código QR y Configuraciones',
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    icon: getWindowIcon(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(targetUrl);

  // Al cerrar la ventana con la X, mantener el servidor activo en la bandeja del sistema
  // para que el celular/tablet y OBS Studio sigan funcionando sin interrupción
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (process.platform === 'darwin' && app.dock) {
        app.dock.hide();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
  }
}

async function pickCustomAudioFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Selecciona la carpeta que contiene las subcarpetas Cantado e Instrumental',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (!result.canceled && result.filePaths && result.filePaths[0]) {
    const chosen = result.filePaths[0];
    if (serverModule && typeof serverModule.setAudioRootDir === 'function') {
      serverModule.setAudioRootDir(chosen);
      rebuildTrayMenu();
    }
  }
}

function rebuildTrayMenu() {
  if (!tray) return;
  const port = getActivePort();
  const mobileUrl = getMobileUrl();
  const loginSettings = app.getLoginItemSettings();
  const autoStartEnabled = Boolean(loginSettings.openAtLogin);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `🟢 Control OBS Remoto (Puerto ${port})`,
      enabled: false,
    },
    {
      label: `📱 Wi-Fi Celular/Tablet: ${mobileUrl}`,
      click: () => {
        clipboard.writeText(mobileUrl);
        openRemoteControlWindow({ query: 'desktop=1&qr=1' });
      },
    },
    { type: 'separator' },
    {
      label: '📱 Ver Código QR para conectar Celular / Tablet',
      click: () => openRemoteControlWindow({ query: 'desktop=1&qr=1' }),
    },
    {
      label: '⚙️ Abrir Configuraciones de OBS y Escenas',
      click: () => openRemoteControlWindow({ query: 'desktop=1&config=1' }),
    },
    {
      label: '🖥️ Abrir ventana del Centro de Control',
      click: () => openRemoteControlWindow({ query: 'desktop=1' }),
    },
    { type: 'separator' },
    {
      label: '📂 Abrir carpeta para copiar MP3 (Cantado / Instrumental)',
      click: () => {
        if (serverModule && typeof serverModule.openAudioFolderInOS === 'function') {
          serverModule.openAudioFolderInOS();
        }
      },
    },
    {
      label: '📁 Elegir otra carpeta donde tengas tus MP3...',
      click: () => pickCustomAudioFolder(),
    },
    { type: 'separator' },
    {
      label: '📋 Copiar enlaces (URLs) para OBS Studio',
      submenu: [
        {
          label: `Control Móvil / Tablet: ${mobileUrl}`,
          click: () => clipboard.writeText(mobileUrl),
        },
        {
          label: `Panel de Control (Dock): http://localhost:${port}/panel`,
          click: () => clipboard.writeText(`http://localhost:${port}/panel`),
        },
        {
          label: `Escena Himnario: http://localhost:${port}/proyeccion`,
          click: () => clipboard.writeText(`http://localhost:${port}/proyeccion`),
        },
        {
          label: `Escena Biblia: http://localhost:${port}/biblia`,
          click: () => clipboard.writeText(`http://localhost:${port}/biblia`),
        },
      ],
    },
    {
      label: '🚀 Iniciar automáticamente al encender Windows / Mac',
      type: 'checkbox',
      checked: autoStartEnabled,
      click: (menuItem) => {
        app.setLoginItemSettings({
          openAtLogin: menuItem.checked,
          openAsHidden: true,
          args: ['--hidden'],
        });
        rebuildTrayMenu();
      },
    },
    {
      label: '🛠️ Mantenimiento (Actualizar / Reinstalar / Desinstalar)',
      submenu: [
        {
          label: '🛑 Cerrar programa por completo (Listo para Actualizar)',
          click: () => performCleanExit({ disableAutoStart: false }),
        },
        {
          label: '🗑️ Desactivar auto-inicio y cerrar (Listo para Desinstalar)',
          click: () => performCleanExit({ disableAutoStart: true }),
        },
      ],
    },
    { type: 'separator' },
    {
      label: '👨‍💻 Autor: Ing. Rubén H. Armendáriz Tamayo (Agradecimientos)',
      click: () => shell.openExternal(`http://localhost:${port}/autor`),
    },
    { type: 'separator' },
    {
      label: '❌ Detener servidor y salir por completo',
      click: () => performCleanExit({ disableAutoStart: false }),
    },
  ]);

  tray.setToolTip(`Control OBS Remoto (${mobileUrl})`);
  tray.setContextMenu(contextMenu);
}

app.on('second-instance', (_event, commandLine = []) => {
  if (
    commandLine.includes('--quit') ||
    commandLine.includes('--uninstall') ||
    commandLine.includes('--updated')
  ) {
    performCleanExit({
      disableAutoStart: commandLine.includes('--uninstall'),
    });
    return;
  }
  openRemoteControlWindow({ query: 'desktop=1&qr=1' });
});

app.whenReady().then(() => {
  if (process.argv.includes('--quit') || process.argv.includes('--uninstall')) {
    performCleanExit({
      disableAutoStart: process.argv.includes('--uninstall'),
    });
    return;
  }

  process.env.APP_USER_DATA_DIR = app.getPath('userData');
  process.env.APP_DOCUMENTS_DIR = app.getPath('documents');

  serverModule = require('./server.js');
  if (serverModule && typeof serverModule.setQuitHandler === 'function') {
    serverModule.setQuitHandler((opts) => performCleanExit(opts));
  }

  if (app.isPackaged) {
    const currentLogin = app.getLoginItemSettings();
    if (currentLogin.openAtLogin === false && !process.env.SKIP_DEFAULT_AUTOSTART) {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        args: ['--hidden'],
      });
    }
  }

  tray = new Tray(createTrayIcon());
  tray.on('double-click', () => openRemoteControlWindow({ query: 'desktop=1' }));

  const launchedHidden =
    process.argv.includes('--hidden') ||
    Boolean(app.getLoginItemSettings().wasOpenedAsHidden);

  setTimeout(() => {
    rebuildTrayMenu();
    if (!launchedHidden) {
      openRemoteControlWindow({ query: 'desktop=1' });
    } else if (process.platform === 'darwin' && app.dock) {
      app.dock.hide();
    }
  }, 700);
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  isQuitting = true;
});
