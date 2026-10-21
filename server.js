/**
 * ============================================================================
 *  SISTEMA: Control OBS Remoto (Móvil / Tablet) + Biblia e Himnario Adventista
 *  AUTOR:   Ing. Rubén Humberto Armendáriz Tamayo
 *  TÍTULO:  Ingeniero en Sistemas Computacionales
 *  GITHUB:  https://github.com/lobosolitarior-hub/controlOBS-Biblia-himnario
 * ============================================================================
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { Server } = require('socket.io');
const { io: ClientIO } = require('socket.io-client');
const { OBSWebSocket } = require('obs-websocket-js');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});
const obs = new OBSWebSocket();

const PRIMARY_PORT = Number(process.env.PORT) || 3000;
const FALLBACK_PORT = Number(process.env.FALLBACK_PORT) || 3100;
let activePort = PRIMARY_PORT;

// Directorio de datos empaquetados (JSON de himnos y biblias)
const DATA_DIR = path.join(__dirname, 'data');

// Directorio escribible del usuario para guardar config.json
const USER_DATA_DIR = process.env.APP_USER_DATA_DIR || DATA_DIR;
if (!fs.existsSync(USER_DATA_DIR)) {
  try {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  } catch {}
}

// Carpeta en Documentos donde las iglesias pueden copiar sus MP3 fácilmente
const DOCUMENTS_BASE =
  process.env.APP_DOCUMENTS_DIR || path.join(os.homedir(), 'Documents');
const DEFAULT_USER_AUDIO_ROOT = path.join(DOCUMENTS_BASE, 'Biblia e Himnario OBS');
const USER_CANTADO_DIR = path.join(DEFAULT_USER_AUDIO_ROOT, 'Cantado');
const USER_INSTRUMENTAL_DIR = path.join(DEFAULT_USER_AUDIO_ROOT, 'Instrumental');

// Carpetas locales del proyecto y carpeta hermana clyTST (para compartir los MP3 sin duplicar)
const CLYTST_DIR = path.resolve(__dirname, '..', 'clyTST');
const CANTADO_DIR = path.join(__dirname, 'Cantado');
const CANTADO_LOWER_DIR = path.join(__dirname, 'cantado');
const INSTRUMENTAL_DIR = path.join(__dirname, 'Instrumental');
const INSTRUMENTAL_LOWER_DIR = path.join(__dirname, 'instrumental');
const INSTRUMNTAL_ALT_DIR = path.join(__dirname, 'instrumntal');

function ensureUserAudioFolders(rootDir) {
  const base = rootDir || DEFAULT_USER_AUDIO_ROOT;
  const cantado = path.join(base, 'Cantado');
  const instrumental = path.join(base, 'Instrumental');
  [base, cantado, instrumental].forEach((dir) => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {}
  });
}
ensureUserAudioFolders(DEFAULT_USER_AUDIO_ROOT);

// Atajos de teclado predeterminados (100% personalizables desde el celular/tablet)
const DEFAULT_SHORTCUTS = [
  {
    id: 'pgdn',
    label: 'Av Pág (Siguiente)',
    icon: '⏭️',
    key: 'PageDown',
    modifiers: [],
    target: 'both',
    targetApp: '',
    color: 'primary',
    size: 'large',
  },
  {
    id: 'pgup',
    label: 'Re Pág (Anterior)',
    icon: '⏮️',
    key: 'PageUp',
    modifiers: [],
    target: 'both',
    targetApp: '',
    color: 'secondary',
    size: 'large',
  },
  {
    id: 'arrow-left',
    label: 'Flecha Izq',
    icon: '⬅️',
    key: 'Left',
    modifiers: [],
    target: 'both',
    targetApp: '',
    color: 'slate',
    size: 'normal',
  },
  {
    id: 'arrow-right',
    label: 'Flecha Der',
    icon: '➡️',
    key: 'Right',
    modifiers: [],
    target: 'both',
    targetApp: '',
    color: 'slate',
    size: 'normal',
  },
  {
    id: 'arrow-up',
    label: 'Flecha Arriba',
    icon: '⬆️',
    key: 'Up',
    modifiers: [],
    target: 'both',
    targetApp: '',
    color: 'slate',
    size: 'normal',
  },
  {
    id: 'arrow-down',
    label: 'Flecha Abajo',
    icon: '⬇️',
    key: 'Down',
    modifiers: [],
    target: 'both',
    targetApp: '',
    color: 'slate',
    size: 'normal',
  },
  {
    id: 'space',
    label: 'Espacio (Play/Pausa)',
    icon: '⏯️',
    key: 'Space',
    modifiers: [],
    target: 'both',
    targetApp: '',
    color: 'emerald',
    size: 'normal',
  },
  {
    id: 'enter',
    label: 'Enter',
    icon: '⏎',
    key: 'Enter',
    modifiers: [],
    target: 'both',
    targetApp: '',
    color: 'emerald',
    size: 'normal',
  },
  {
    id: 'f5-start',
    label: 'Iniciar PPT (F5)',
    icon: '🎬',
    key: 'F5',
    modifiers: [],
    target: 'os',
    targetApp: '',
    color: 'amber',
    size: 'normal',
  },
  {
    id: 'shift-f5',
    label: 'PPT Actual (Shift+F5)',
    icon: '▶️',
    key: 'F5',
    modifiers: ['shift'],
    target: 'os',
    targetApp: '',
    color: 'amber',
    size: 'normal',
  },
  {
    id: 'black-screen',
    label: 'Pantalla Negra (B)',
    icon: '⬛',
    key: 'B',
    modifiers: [],
    target: 'os',
    targetApp: '',
    color: 'slate',
    size: 'normal',
  },
  {
    id: 'esc-key',
    label: 'Salir / Esc',
    icon: '⏹️',
    key: 'Escape',
    modifiers: [],
    target: 'both',
    targetApp: '',
    color: 'danger',
    size: 'normal',
  },
];

// Configuración persistente de OBS, rutas y atajos personalizados
const CONFIG_PATH = path.join(USER_DATA_DIR, 'config.json');
const BUNDLED_CONFIG_PATH = path.join(DATA_DIR, 'config.json');

let obsConfig = {
  url: process.env.OBS_WS_URL || 'ws://127.0.0.1:4455',
  password: process.env.OBS_WS_PASSWORD || '',
  sceneName: process.env.OBS_SCENE_NAME || 'Himnario',
  bibleBgSceneName: process.env.OBS_BIBLE_BG_SCENE || 'Biblia',
  bibleCamSceneName: process.env.OBS_BIBLE_CAM_SCENE || 'Biblia Camara',
  audioRootDir: DEFAULT_USER_AUDIO_ROOT,
  autoSwitchScene: true,
  soloLetraIntervalSec: 12,
  useOnlineFallback: true,
  customShortcuts: DEFAULT_SHORTCUTS,
};

function normalizeObsUrl(input) {
  let u = String(input || '').trim();
  if (!u) return 'ws://127.0.0.1:4455';
  if (/^\d+$/.test(u)) return `ws://127.0.0.1:${u}`;
  if (u.startsWith('://')) return `ws${u}`;
  if (!u.startsWith('ws://') && !u.startsWith('wss://')) {
    u = u.replace(/^[a-zA-Z]*:\/\//, '');
    return `ws://${u}`;
  }
  return u;
}

if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(BUNDLED_CONFIG_PATH)) {
  try {
    fs.copyFileSync(BUNDLED_CONFIG_PATH, CONFIG_PATH);
  } catch {}
}

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    obsConfig = { ...obsConfig, ...loaded };
    obsConfig.url = normalizeObsUrl(obsConfig.url);
    if (!Array.isArray(obsConfig.customShortcuts) || obsConfig.customShortcuts.length === 0) {
      obsConfig.customShortcuts = DEFAULT_SHORTCUTS;
    }
    if (obsConfig.audioRootDir) {
      ensureUserAudioFolders(obsConfig.audioRootDir);
    }
  } catch (err) {
    console.error('Error leyendo config.json:', err.message);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(obsConfig, null, 2), 'utf8');
  } catch (err) {
    console.error('Error guardando config.json:', err.message);
  }
}

// ============================================================================
// CARGA DE HIMNARIO (614 HIMNOS) Y SANTA BIBLIA (RVR1960 / DHH)
// ============================================================================
const HIMNOS_PATH = path.join(DATA_DIR, 'himnos.json');
let himnos = [];
const himnosByNumber = new Map();

function loadHimnos() {
  if (!fs.existsSync(HIMNOS_PATH)) {
    console.warn('Advertencia: No se encontró data/himnos.json');
    return;
  }
  himnos = JSON.parse(fs.readFileSync(HIMNOS_PATH, 'utf8'));
  himnosByNumber.clear();
  for (const h of himnos) {
    himnosByNumber.set(Number(h.number), h);
  }
  console.log(`✅ Cargados ${himnos.length} himnos del Himnario Adventista.`);
}
loadHimnos();

const bibles = {
  RVR1960: null,
  DHH: null,
};
const bibleBooksIndex = [];

function loadBibles() {
  const rvrPath = path.join(DATA_DIR, 'biblia_rvr1960.json');
  const dhhPath = path.join(DATA_DIR, 'biblia_dhh.json');

  if (fs.existsSync(rvrPath)) {
    bibles.RVR1960 = JSON.parse(fs.readFileSync(rvrPath, 'utf8'));
    console.log(`✅ Cargada Biblia RVR1960 (${bibles.RVR1960.books.length} libros).`);
  }
  if (fs.existsSync(dhhPath)) {
    bibles.DHH = JSON.parse(fs.readFileSync(dhhPath, 'utf8'));
    console.log(`✅ Cargada Biblia DHH (${bibles.DHH.books.length} libros).`);
  }

  const baseBible = bibles.RVR1960 || bibles.DHH;
  if (baseBible) {
    bibleBooksIndex.length = 0;
    for (const b of baseBible.books) {
      bibleBooksIndex.push({
        id: b.id,
        number: b.number,
        name: b.name,
        aliases: b.aliases || [],
        chaptersCount: b.chapters.length,
      });
    }
  }
}
loadBibles();

// Configurar motor de plantillas Pug y archivos estáticos
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Directorios dinámicos para buscar pistas MP3 (incluye clyTST automáticamente)
function getCantadoFolders() {
  const customRoot = obsConfig.audioRootDir || DEFAULT_USER_AUDIO_ROOT;
  return [
    path.join(customRoot, 'Cantado'),
    path.join(customRoot, 'cantado'),
    USER_CANTADO_DIR,
    CANTADO_DIR,
    CANTADO_LOWER_DIR,
    path.join(CLYTST_DIR, 'Cantado'),
    path.join(CLYTST_DIR, 'cantado'),
  ];
}

function getInstrumentalFolders() {
  const customRoot = obsConfig.audioRootDir || DEFAULT_USER_AUDIO_ROOT;
  return [
    path.join(customRoot, 'Instrumental'),
    path.join(customRoot, 'instrumental'),
    USER_INSTRUMENTAL_DIR,
    INSTRUMENTAL_DIR,
    INSTRUMENTAL_LOWER_DIR,
    INSTRUMNTAL_ALT_DIR,
    path.join(CLYTST_DIR, 'Instrumental'),
    path.join(CLYTST_DIR, 'instrumental'),
  ];
}

function resolveAudioFileFromFolders(folderList, filename) {
  const safeName = path.basename(filename);
  for (const dir of folderList) {
    const candidate = path.join(dir, safeName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

app.get('/audio/cantado/:filename', (req, res) => {
  const fullPath = resolveAudioFileFromFolders(getCantadoFolders(), req.params.filename);
  if (!fullPath) return res.status(404).end();
  res.sendFile(fullPath);
});

app.get('/audio/instrumental/:filename', (req, res) => {
  const fullPath = resolveAudioFileFromFolders(
    getInstrumentalFolders(),
    req.params.filename
  );
  if (!fullPath) return res.status(404).end();
  res.sendFile(fullPath);
});

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);

function findLocalAudioFile(folderPaths, hymnNumber) {
  const num = Number(hymnNumber);
  const pad3 = String(num).padStart(3, '0');
  const pad2 = String(num).padStart(2, '0');
  const raw = String(num);

  for (const dirPath of folderPaths) {
    if (!fs.existsSync(dirPath)) continue;
    let files = [];
    try {
      files = fs.readdirSync(dirPath);
    } catch {
      continue;
    }

    const audioFiles = files.filter((f) =>
      AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase())
    );

    const match = audioFiles.find((f) => {
      const base = path.basename(f, path.extname(f));
      return (
        base === pad3 ||
        base === raw ||
        base === pad2 ||
        new RegExp(`^0*${num}(?:\\D|$)`).test(base) ||
        new RegExp(`(?:^|\\D)0*${num}(?:\\D|$)`).test(base)
      );
    });

    if (match) {
      return match;
    }
  }
  return null;
}

function getHymnAudioInfo(hymn) {
  if (!hymn) return {};
  const cantadoFile = findLocalAudioFile(getCantadoFolders(), hymn.number);
  const instrumentalFile = findLocalAudioFile(getInstrumentalFolders(), hymn.number);

  return {
    hasLocalCantado: Boolean(cantadoFile),
    hasLocalInstrumental: Boolean(instrumentalFile),
    localCantadoUrl: cantadoFile
      ? `/audio/cantado/${encodeURIComponent(cantadoFile)}`
      : null,
    localInstrumentalUrl: instrumentalFile
      ? `/audio/instrumental/${encodeURIComponent(instrumentalFile)}`
      : null,
    onlineCantadoUrl: hymn.mp3Url || null,
    onlineInstrumentalUrl: hymn.mp3UrlInstr || null,
  };
}

// ============================================================================
// PUENTE AUTOMÁTICO CON clyTST (SI ESTÁ CORRIENDO EN PUERTO 3000)
// ============================================================================
let clyBridgeSocket = null;
let clyBridgeConnected = false;

function setupClyBridgeIfNeeded() {
  if (activePort === 3000) {
    // Nosotros mismos estamos en el puerto 3000 sirviendo /proyeccion y /biblia
    return;
  }
  clyBridgeSocket = ClientIO('http://127.0.0.1:3000', {
    reconnection: true,
    reconnectionDelay: 2000,
  });

  clyBridgeSocket.on('connect', () => {
    clyBridgeConnected = true;
    console.log('🔗 Puente activo con servidor Biblia e Himnario (puerto 3000)');
    io.emit('bridge:status', { connected: true, target: 'http://127.0.0.1:3000' });
  });

  clyBridgeSocket.on('disconnect', () => {
    clyBridgeConnected = false;
    io.emit('bridge:status', { connected: false, target: 'http://127.0.0.1:3000' });
  });

  clyBridgeSocket.on('state:update', (remoteState) => {
    if (remoteState) {
      projectionState = remoteState;
      io.emit('state:update', projectionState);
    }
  });

  clyBridgeSocket.on('bible:update', (remoteBible) => {
    if (remoteBible) {
      bibleState = remoteBible;
      io.emit('bible:update', bibleState);
    }
  });

  clyBridgeSocket.on('audio:progress', (progress) => {
    io.emit('audio:progress', progress);
  });
}

// ============================================================================
// CONEXIÓN Y CONTROL PROFUNDO DE OBS STUDIO (ESCENAS, MULTIMEDIA, AUDIO, STREAM)
// ============================================================================
let obsConnected = false;
let obsLastError = '';
let previousSceneName = null;

let obsLiveOverview = {
  connected: false,
  currentProgramSceneName: '',
  currentPreviewSceneName: '',
  studioModeEnabled: false,
  scenes: [], // [{ sceneName, sceneIndex }]
  sceneItems: [], // Fuentes dentro de la escena activa
  mediaInputs: [], // Fuentes multimedia con estado Play/Pause/Tiempo
  audioInputs: [], // Mezclador de audio
  streamStatus: {
    active: false,
    timecode: '00:00:00',
    reconnecting: false,
  },
  recordStatus: {
    active: false,
    paused: false,
    timecode: '00:00:00',
  },
};

function getSafeObsConfig() {
  return {
    url: obsConfig.url,
    password: obsConfig.password || '',
    hasPassword: Boolean(obsConfig.password),
    sceneName: obsConfig.sceneName,
    bibleBgSceneName: obsConfig.bibleBgSceneName || 'Biblia',
    bibleCamSceneName: obsConfig.bibleCamSceneName || 'Biblia Camara',
    audioRootDir: obsConfig.audioRootDir || DEFAULT_USER_AUDIO_ROOT,
    autoSwitchScene: obsConfig.autoSwitchScene,
    soloLetraIntervalSec: obsConfig.soloLetraIntervalSec,
    useOnlineFallback: obsConfig.useOnlineFallback,
    customShortcuts: obsConfig.customShortcuts || DEFAULT_SHORTCUTS,
  };
}

async function connectOBS() {
  try {
    await obs.disconnect().catch(() => {});
    if (obsConfig.password) {
      await obs.connect(obsConfig.url, obsConfig.password);
    } else {
      await obs.connect(obsConfig.url);
    }
    obsConnected = true;
    obsLastError = '';
    console.log(`🎥 Conectado a OBS WebSocket en ${obsConfig.url}`);
    io.emit('obs:status', { connected: true, config: getSafeObsConfig() });
    await refreshObsOverview();
  } catch (err) {
    obsConnected = false;
    obsLiveOverview.connected = false;
    obsLastError = err.message || 'No se pudo conectar a OBS WebSocket';
    io.emit('obs:status', {
      connected: false,
      error: obsLastError,
      config: getSafeObsConfig(),
    });
    io.emit('obs:overview', obsLiveOverview);
  }
}

obs.on('ConnectionClosed', () => {
  obsConnected = false;
  obsLiveOverview.connected = false;
  io.emit('obs:status', { connected: false, config: getSafeObsConfig() });
  io.emit('obs:overview', obsLiveOverview);
});

// Recopilar estado completo de OBS (Escenas, Items de la escena actual, Fuentes Multimedia, Audio, Stream/Rec)
async function refreshObsOverview() {
  if (!obsConnected) {
    obsLiveOverview.connected = false;
    return obsLiveOverview;
  }

  try {
    const [sceneListRes, studioModeRes, streamRes, recordRes, inputsRes] =
      await Promise.all([
        obs.call('GetSceneList').catch(() => ({ scenes: [], currentProgramSceneName: '' })),
        obs.call('GetStudioModeEnabled').catch(() => ({ studioModeEnabled: false })),
        obs.call('GetStreamStatus').catch(() => ({ outputActive: false, outputTimecode: '00:00:00' })),
        obs.call('GetRecordStatus').catch(() => ({ outputActive: false, outputPaused: false, outputTimecode: '00:00:00' })),
        obs.call('GetInputList').catch(() => ({ inputs: [] })),
      ]);

    const currentProgramSceneName = sceneListRes.currentProgramSceneName || '';
    const currentPreviewSceneName = sceneListRes.currentPreviewSceneName || '';
    const scenes = Array.isArray(sceneListRes.scenes)
      ? [...sceneListRes.scenes].reverse()
      : [];

    // Obtener elementos (fuentes) dentro de la escena en Programa
    let sceneItems = [];
    if (currentProgramSceneName) {
      const itemsRes = await obs
        .call('GetSceneItemList', { sceneName: currentProgramSceneName })
        .catch(() => ({ sceneItems: [] }));
      if (Array.isArray(itemsRes.sceneItems)) {
        sceneItems = [...itemsRes.sceneItems]
          .reverse()
          .map((item) => ({
            sceneItemId: item.sceneItemId,
            sourceName: item.sourceName,
            inputKind: item.inputKind || item.sourceType || '',
            sceneItemEnabled: Boolean(item.sceneItemEnabled),
            sceneItemLocked: Boolean(item.sceneItemLocked),
          }));
      }
    }

    // Identificar fuentes multimedia (videos, audios, VLC, galerias) y consultar su progreso
    const allInputs = Array.isArray(inputsRes.inputs) ? inputsRes.inputs : [];
    const mediaKinds = new Set([
      'ffmpeg_source',
      'vlc_source',
      'slideshow',
      'image_source',
      'browser_source',
    ]);
    const sceneSourceNames = new Set(sceneItems.map((i) => i.sourceName));

    const mediaInputs = [];
    for (const inp of allInputs) {
      const isMedia =
        inp.inputKind === 'ffmpeg_source' ||
        inp.inputKind === 'vlc_source' ||
        (inp.inputKind && inp.inputKind.includes('media'));
      const inCurrentScene = sceneSourceNames.has(inp.inputName);

      if (isMedia || (inCurrentScene && mediaKinds.has(inp.inputKind))) {
        let mediaStatus = {
          mediaState: 'OBS_MEDIA_STATE_NONE',
          mediaCursor: 0,
          mediaDuration: 0,
        };
        if (isMedia) {
          mediaStatus = await obs
            .call('GetMediaInputStatus', { inputName: inp.inputName })
            .catch(() => mediaStatus);
        }
        mediaInputs.push({
          inputName: inp.inputName,
          inputKind: inp.inputKind,
          inCurrentScene,
          isControllableMedia: isMedia,
          mediaState: mediaStatus.mediaState || 'OBS_MEDIA_STATE_NONE',
          mediaCursor: Number(mediaStatus.mediaCursor) || 0,
          mediaDuration: Number(mediaStatus.mediaDuration) || 0,
        });
      }
    }

    // Ordenar para que las fuentes de la escena actual aparezcan primero
    mediaInputs.sort((a, b) => Number(b.inCurrentScene) - Number(a.inCurrentScene));

    // Identificar entradas de audio (micrófonos, escritorio, videos)
    const audioInputs = [];
    for (const inp of allInputs) {
      const kind = String(inp.inputKind || '').toLowerCase();
      if (
        kind.includes('audio') ||
        kind.includes('coreaudio') ||
        kind.includes('wasapi') ||
        kind.includes('pulse') ||
        kind === 'ffmpeg_source' ||
        kind === 'vlc_source'
      ) {
        const [volRes, muteRes] = await Promise.all([
          obs.call('GetInputVolume', { inputName: inp.inputName }).catch(() => null),
          obs.call('GetInputMute', { inputName: inp.inputName }).catch(() => null),
        ]);
        if (volRes && muteRes) {
          audioInputs.push({
            inputName: inp.inputName,
            inputKind: inp.inputKind,
            inputMuted: Boolean(muteRes.inputMuted),
            inputVolumeMul: Number(volRes.inputVolumeMul) || 0,
            inputVolumeDb: Number(volRes.inputVolumeDb) || 0,
          });
        }
      }
    }

    obsLiveOverview = {
      connected: true,
      currentProgramSceneName,
      currentPreviewSceneName,
      studioModeEnabled: Boolean(studioModeRes.studioModeEnabled),
      scenes,
      sceneItems,
      mediaInputs,
      audioInputs,
      streamStatus: {
        active: Boolean(streamRes.outputActive),
        timecode: String(streamRes.outputTimecode || '00:00:00').split('.')[0],
        reconnecting: Boolean(streamRes.outputReconnecting),
      },
      recordStatus: {
        active: Boolean(recordRes.outputActive),
        paused: Boolean(recordRes.outputPaused),
        timecode: String(recordRes.outputTimecode || '00:00:00').split('.')[0],
      },
    };

    io.emit('obs:overview', obsLiveOverview);
    return obsLiveOverview;
  } catch (err) {
    return obsLiveOverview;
  }
}

// Eventos en vivo de OBS para reflejar cambios al instante en el celular/tablet
obs.on('SceneListChanged', () => refreshObsOverview());
obs.on('SceneItemEnableStateChanged', () => refreshObsOverview());
obs.on('SceneItemCreated', () => refreshObsOverview());
obs.on('SceneItemRemoved', () => refreshObsOverview());
obs.on('StudioModeStateChanged', () => refreshObsOverview());
obs.on('CurrentPreviewSceneChanged', () => refreshObsOverview());
obs.on('StreamStateChanged', () => refreshObsOverview());
obs.on('RecordStateChanged', () => refreshObsOverview());
obs.on('InputMuteStateChanged', () => refreshObsOverview());
obs.on('InputVolumeChanged', () => refreshObsOverview());
obs.on('MediaInputPlaybackStarted', () => refreshObsOverview());
obs.on('MediaInputPlaybackEnded', () => refreshObsOverview());
obs.on('MediaInputActionTriggered', () => refreshObsOverview());

function isHymnSceneName(sceneName) {
  if (!sceneName) return false;
  return (
    String(sceneName).trim().toLowerCase() ===
    String(obsConfig.sceneName || 'Himnario').trim().toLowerCase()
  );
}

function isBibleSceneName(sceneName) {
  if (!sceneName) return false;
  const s = String(sceneName).trim().toLowerCase();
  const bg = String(obsConfig.bibleBgSceneName || 'Biblia').trim().toLowerCase();
  const cam = String(obsConfig.bibleCamSceneName || 'Biblia Camara').trim().toLowerCase();
  return s === bg || s === cam;
}

function isManagedProjectionScene(sceneName) {
  if (!sceneName) return false;
  const s = String(sceneName).trim().toLowerCase();
  const managed = [
    obsConfig.sceneName || 'Himnario',
    obsConfig.bibleBgSceneName || 'Biblia',
    obsConfig.bibleCamSceneName || 'Biblia Camara',
  ].map((n) => String(n).trim().toLowerCase());
  return managed.includes(s);
}

obs.on('CurrentProgramSceneChanged', ({ sceneName }) => {
  refreshObsOverview();
  if (!sceneName) return;

  if (!isHymnSceneName(sceneName) && (projectionState.active || projectionState.isPlaying)) {
    stopHymnProjection();
  }

  if (!isBibleSceneName(sceneName) && bibleState.active) {
    bibleState = { ...bibleState, active: false };
    io.emit('bible:update', bibleState);
  }

  if (!isManagedProjectionScene(sceneName)) {
    previousSceneName = sceneName;
  }
});

// Actualizar tiempos de reproducción de videos y stream cada 1.5s cuando hay clientes conectados
setInterval(() => {
  if (!obsConnected) {
    connectOBS();
  } else if (io.engine.clientsCount > 0) {
    refreshObsOverview();
  }
}, 2500);

// Captura de vista previa en vivo (Screenshots JPEG ligeros) para clientes móviles suscritos
const previewSubscribers = new Set();
let previewLoopBusy = false;

setInterval(async () => {
  if (!obsConnected || previewSubscribers.size === 0 || previewLoopBusy) return;
  const targetScene = obsLiveOverview.currentProgramSceneName;
  if (!targetScene) return;

  previewLoopBusy = true;
  try {
    const res = await obs.call('GetSourceScreenshot', {
      sourceName: targetScene,
      imageFormat: 'jpeg',
      imageWidth: 640,
      imageCompressionQuality: 60,
    });
    if (res && res.imageData) {
      for (const socketId of previewSubscribers) {
        io.to(socketId).emit('obs:screenshot', {
          sceneName: targetScene,
          imageData: res.imageData,
          timestamp: Date.now(),
        });
      }
    }
  } catch {
    // Ignorar errores transitorios de captura
  } finally {
    previewLoopBusy = false;
  }
}, 450);

// ============================================================================
// MOTOR DE TECLADO REMOTO Y ATAJOS (MAC / WINDOWS / LINUX + OBS HOTKEYS)
// ============================================================================
const MAC_KEYCODES = {
  pagedown: 121,
  pageup: 116,
  right: 124,
  left: 123,
  down: 125,
  up: 126,
  space: 49,
  enter: 36,
  return: 36,
  escape: 53,
  esc: 53,
  tab: 48,
  backspace: 51,
  delete: 117,
  home: 115,
  end: 119,
  f1: 122,
  f2: 120,
  f3: 99,
  f4: 118,
  f5: 96,
  f6: 97,
  f7: 98,
  f8: 100,
  f9: 101,
  f10: 109,
  f11: 103,
  f12: 111,
};

const WIN_SENDKEYS = {
  pagedown: '{PGDN}',
  pageup: '{PGUP}',
  right: '{RIGHT}',
  left: '{LEFT}',
  down: '{DOWN}',
  up: '{UP}',
  space: ' ',
  enter: '{ENTER}',
  return: '{ENTER}',
  escape: '{ESC}',
  esc: '{ESC}',
  tab: '{TAB}',
  backspace: '{BS}',
  delete: '{DEL}',
  home: '{HOME}',
  end: '{END}',
  f1: '{F1}',
  f2: '{F2}',
  f3: '{F3}',
  f4: '{F4}',
  f5: '{F5}',
  f6: '{F6}',
  f7: '{F7}',
  f8: '{F8}',
  f9: '{F9}',
  f10: '{F10}',
  f11: '{F11}',
  f12: '{F12}',
};

const OBS_KEY_MAP = {
  pagedown: 'OBS_KEY_PAGEDOWN',
  pageup: 'OBS_KEY_PAGEUP',
  right: 'OBS_KEY_RIGHT',
  left: 'OBS_KEY_LEFT',
  down: 'OBS_KEY_DOWN',
  up: 'OBS_KEY_UP',
  space: 'OBS_KEY_SPACE',
  enter: 'OBS_KEY_RETURN',
  return: 'OBS_KEY_RETURN',
  escape: 'OBS_KEY_ESCAPE',
  esc: 'OBS_KEY_ESCAPE',
  tab: 'OBS_KEY_TAB',
  backspace: 'OBS_KEY_BACKSPACE',
  delete: 'OBS_KEY_DELETE',
  home: 'OBS_KEY_HOME',
  end: 'OBS_KEY_END',
  f1: 'OBS_KEY_F1',
  f2: '{F2}' && 'OBS_KEY_F2',
  f3: 'OBS_KEY_F3',
  f4: 'OBS_KEY_F4',
  f5: 'OBS_KEY_F5',
  f6: 'OBS_KEY_F6',
  f7: 'OBS_KEY_F7',
  f8: 'OBS_KEY_F8',
  f9: 'OBS_KEY_F9',
  f10: 'OBS_KEY_F10',
  f11: 'OBS_KEY_F11',
  f12: 'OBS_KEY_F12',
};

function sendOsKeystroke(keyName, modifiers = [], targetApp = '') {
  return new Promise((resolve) => {
    const cleanKey = String(keyName || '').trim();
    const lowerKey = cleanKey.toLowerCase();
    const mods = Array.isArray(modifiers)
      ? modifiers.map((m) => String(m).toLowerCase())
      : [];

    if (process.platform === 'darwin') {
      const appleMods = [];
      if (mods.includes('ctrl') || mods.includes('control')) appleMods.push('control down');
      if (mods.includes('alt') || mods.includes('option')) appleMods.push('option down');
      if (mods.includes('shift')) appleMods.push('shift down');
      if (mods.includes('cmd') || mods.includes('command') || mods.includes('meta')) {
        appleMods.push('command down');
      }

      const usingClause =
        appleMods.length > 0 ? ` using {${appleMods.join(', ')}}` : '';

      let actionLine = '';
      if (Object.prototype.hasOwnProperty.call(MAC_KEYCODES, lowerKey)) {
        actionLine = `key code ${MAC_KEYCODES[lowerKey]}${usingClause}`;
      } else {
        const escapedChar = cleanKey
          .slice(0, 1)
          .toLowerCase()
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"');
        actionLine = `keystroke "${escapedChar}"${usingClause}`;
      }

      const scriptLines = [];
      if (targetApp && String(targetApp).trim()) {
        const safeApp = String(targetApp).trim().replace(/"/g, '\\"');
        scriptLines.push(`tell application "${safeApp}" to activate`);
        scriptLines.push('delay 0.08');
      }
      scriptLines.push(`tell application "System Events" to ${actionLine}`);

      const args = [];
      scriptLines.forEach((line) => {
        args.push('-e', line);
      });

      execFile('osascript', args, { timeout: 3000 }, (err) => {
        if (err) {
          resolve({
            ok: false,
            error:
              'Para enviar teclas a otras apps en Mac, permite Accesibilidad a Terminal/Control OBS en Ajustes del Sistema > Privacidad y Seguridad > Accesibilidad.',
            details: err.message,
          });
        } else {
          resolve({ ok: true, platform: 'darwin' });
        }
      });
    } else if (process.platform === 'win32') {
      let prefix = '';
      if (mods.includes('ctrl') || mods.includes('control')) prefix += '^';
      if (mods.includes('alt') || mods.includes('option')) prefix += '%';
      if (mods.includes('shift')) prefix += '+';

      const winKey = WIN_SENDKEYS[lowerKey] || cleanKey.slice(0, 1).toLowerCase();
      const sendStr = `${prefix}${winKey}`.replace(/'/g, "''");
      const appActivateLine =
        targetApp && String(targetApp).trim()
          ? `$wshell.AppActivate('${String(targetApp).trim().replace(/'/g, "''")}'); Start-Sleep -Milliseconds 60; `
          : '';
      const psCmd = `$wshell = New-Object -ComObject wscript.shell; ${appActivateLine}$wshell.SendKeys('${sendStr}')`;

      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { timeout: 3000 },
        (err) => {
          resolve({ ok: !err, error: err ? err.message : undefined, platform: 'win32' });
        }
      );
    } else {
      // Linux con xdotool si está disponible
      execFile('xdotool', ['key', cleanKey], { timeout: 2000 }, (err) => {
        resolve({ ok: !err, error: err ? err.message : undefined, platform: 'linux' });
      });
    }
  });
}

async function sendObsHotkey(keyName, modifiers = []) {
  if (!obsConnected) return { ok: false, error: 'OBS no conectado' };
  const cleanKey = String(keyName || '').trim();
  const lowerKey = cleanKey.toLowerCase();
  const mods = Array.isArray(modifiers)
    ? modifiers.map((m) => String(m).toLowerCase())
    : [];

  let keyId = OBS_KEY_MAP[lowerKey];
  if (!keyId && cleanKey.length === 1) {
    keyId = `OBS_KEY_${cleanKey.toUpperCase()}`;
  }
  if (!keyId) {
    keyId = `OBS_KEY_${cleanKey.toUpperCase()}`;
  }

  try {
    await obs.call('TriggerHotkeyByKeySequence', {
      keyId,
      keyModifiers: {
        shift: mods.includes('shift'),
        control: mods.includes('ctrl') || mods.includes('control'),
        alt: mods.includes('alt') || mods.includes('option'),
        command: mods.includes('cmd') || mods.includes('command') || mods.includes('meta'),
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function executeKeyAction({ key, modifiers = [], target = 'both', targetApp = '' }) {
  const results = { os: null, obs: null };
  if (target === 'os' || target === 'both') {
    results.os = await sendOsKeystroke(key, modifiers, targetApp);
  }
  if (target === 'obs' || target === 'both') {
    results.obs = await sendObsHotkey(key, modifiers);
  }
  const ok =
    Boolean(results.os && results.os.ok) || Boolean(results.obs && results.obs.ok);
  return {
    ok,
    key,
    modifiers,
    target,
    results,
  };
}

// ============================================================================
// FUNCIONES DE CAMBIO DE ESCENA PARA HIMNARIO Y BIBLIA
// ============================================================================
async function resolveObsScene(targetName) {
  const { currentProgramSceneName, scenes = [] } = await obs.call('GetSceneList');
  const cleanTarget = String(targetName || 'Himnario').trim().toLowerCase();
  const found = scenes.find(
    (s) => String(s.sceneName || '').trim().toLowerCase() === cleanTarget
  );
  return {
    currentProgramSceneName,
    resolvedSceneName: found ? found.sceneName : targetName || 'Himnario',
  };
}

async function switchToTargetScene(desiredSceneName) {
  if (!obsConfig.autoSwitchScene) return { switched: false };
  if (!obsConnected) {
    await connectOBS();
  }
  if (!obsConnected) {
    return { switched: false, error: obsLastError };
  }
  try {
    const desiredScene = desiredSceneName || 'Himnario';
    const { currentProgramSceneName, resolvedSceneName } =
      await resolveObsScene(desiredScene);

    if (
      currentProgramSceneName &&
      !isManagedProjectionScene(currentProgramSceneName)
    ) {
      previousSceneName = currentProgramSceneName;
    }

    await obs.call('SetCurrentProgramScene', {
      sceneName: resolvedSceneName,
    });
    return { switched: true, sceneName: resolvedSceneName };
  } catch (err) {
    return {
      switched: false,
      error: `No se pudo cambiar a la escena "${desiredSceneName}": ${err.message}`,
    };
  }
}

async function switchToHymnScene() {
  return switchToTargetScene(obsConfig.sceneName || 'Himnario');
}

async function switchToBibleScene(sceneMode) {
  const target =
    sceneMode === 'camara'
      ? obsConfig.bibleCamSceneName || 'Biblia Camara'
      : obsConfig.bibleBgSceneName || 'Biblia';
  return switchToTargetScene(target);
}

async function restorePreviousScene() {
  if (!obsConfig.autoSwitchScene || !previousSceneName) {
    return { restored: false };
  }
  if (!obsConnected) {
    await connectOBS();
  }
  if (!obsConnected) {
    return { restored: false, error: obsLastError };
  }
  try {
    const targetToRestore = previousSceneName;
    previousSceneName = null;
    await obs.call('SetCurrentProgramScene', {
      sceneName: targetToRestore,
    });
    return { restored: true, sceneName: targetToRestore };
  } catch (err) {
    return {
      restored: false,
      error: `No se pudo regresar a la escena "${previousSceneName}": ${err.message}`,
    };
  }
}

connectOBS();

// ============================================================================
// ESTADO EN VIVO DE HIMNARIO Y BIBLIA
// ============================================================================
let projectionState = {
  active: false,
  hymn: null,
  audioMode: 'cantado',
  advanceMode: 'auto',
  audioUrl: null,
  isLocalAudio: false,
  currentSlideIndex: 0,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  computedSchedule: [],
};

let bibleState = {
  active: false,
  version: 'RVR1960',
  versionName: 'Reina Valera 1960',
  bookId: 'GEN',
  bookName: 'Génesis',
  chapter: 1,
  verse: 1,
  verseLabel: '1',
  text: '',
  sceneMode: 'fondo',
};

function stopHymnProjection() {
  stopSoloLetraTimer();
  projectionState = {
    ...projectionState,
    active: false,
    isPlaying: false,
    currentTime: 0,
    currentSlideIndex: 0,
  };
  io.emit('audio:control', { action: 'stop' });
  io.emit('state:update', projectionState);
}

function getBibleVerseData(versionCode, bookId, chapterNum, verseNum) {
  const verKey = versionCode === 'DHH' ? 'DHH' : 'RVR1960';
  const bible = bibles[verKey] || bibles.RVR1960 || bibles.DHH;
  if (!bible) return null;

  const book =
    bible.books.find(
      (b) =>
        b.id.toLowerCase() === String(bookId).toLowerCase() ||
        Number(b.number) === Number(bookId)
    ) || bible.books[0];
  if (!book) return null;

  const chIdx = Math.max(
    0,
    Math.min(book.chapters.length - 1, (Number(chapterNum) || 1) - 1)
  );
  const chObj = book.chapters[chIdx];
  if (!chObj || !Array.isArray(chObj.verses) || chObj.verses.length === 0) {
    return null;
  }

  const targetV = Number(verseNum) || 1;
  const verseObj =
    chObj.verses.find((v) => v.v === targetV) ||
    chObj.verses.find((v) => v.v >= targetV) ||
    chObj.verses[0];

  return {
    version: bible.version,
    versionName: bible.name,
    bookId: book.id,
    bookName: book.name,
    chapter: chObj.c,
    totalChapters: book.chapters.length,
    verse: verseObj.v,
    verseLabel: verseObj.label || String(verseObj.v),
    text: verseObj.text,
    verses: chObj.verses,
  };
}

let soloLetraTimer = null;

function stopSoloLetraTimer() {
  if (soloLetraTimer) {
    clearInterval(soloLetraTimer);
    soloLetraTimer = null;
  }
}

function startSoloLetraTimer() {
  stopSoloLetraTimer();
  if (
    projectionState.active &&
    projectionState.audioMode === 'letra' &&
    projectionState.advanceMode === 'auto' &&
    projectionState.isPlaying &&
    projectionState.hymn
  ) {
    const intervalMs = Math.max(3, Number(obsConfig.soloLetraIntervalSec) || 12) * 1000;
    soloLetraTimer = setInterval(() => {
      if (
        !projectionState.active ||
        projectionState.advanceMode !== 'auto' ||
        !projectionState.isPlaying
      ) {
        return;
      }
      const totalSlides = projectionState.hymn.slides.length;
      if (projectionState.currentSlideIndex < totalSlides - 1) {
        projectionState.currentSlideIndex += 1;
        io.emit('state:update', projectionState);
      } else {
        projectionState.isPlaying = false;
        stopSoloLetraTimer();
        io.emit('state:update', projectionState);
      }
    }, intervalMs);
  }
}

function buildSlideSchedule(hymn, audioDurationSec) {
  if (!hymn || !Array.isArray(hymn.slides) || hymn.slides.length === 0) {
    return [];
  }
  const slides = hymn.slides;
  const hasDbTimestamps = slides
    .slice(1)
    .every((s) => typeof s.timestamp === 'number' && s.timestamp > 0);

  if (hasDbTimestamps) {
    const lastDbTime = slides[slides.length - 1].timestamp;
    if (!audioDurationSec || audioDurationSec >= lastDbTime + 3) {
      return slides.map((s, idx) => (idx === 0 ? 0 : s.timestamp));
    }
    const scale = (audioDurationSec * 0.88) / lastDbTime;
    return slides.map((s, idx) =>
      idx === 0 ? 0 : Math.round(s.timestamp * scale * 10) / 10
    );
  }

  const totalDuration = audioDurationSec && audioDurationSec > 15 ? audioDurationSec : 150;
  const introSec = Math.min(18, Math.max(8, totalDuration * 0.1));
  const outroSec = Math.min(8, totalDuration * 0.04);
  const singingWindow = Math.max(20, totalDuration - introSec - outroSec);

  const lyricSlides = slides.slice(1);
  if (lyricSlides.length === 0) return [0];

  const weights = lyricSlides.map((s) => Math.max(20, (s.text || '').length));
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  const schedule = [0];
  let elapsed = introSec;
  for (let i = 0; i < lyricSlides.length; i++) {
    schedule.push(Math.round(elapsed * 10) / 10);
    elapsed += (weights[i] / totalWeight) * singingWindow;
  }
  return schedule;
}

// ============================================================================
// DETECCIÓN DE IP LOCAL Y GENERACIÓN DE CÓDIGO QR PARA CELULAR / TABLET
// ============================================================================
function getLocalNetworkIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ interface: name, address: net.address });
      }
    }
  }
  return ips;
}

// ============================================================================
// RUTAS DE VISTAS Y API REST
// ============================================================================

// Vista principal para Celular / Tablet (y Centro de Control unificado)
app.get(['/', '/remoto', '/mobile', '/control'], (req, res) => {
  res.render('remoto', {
    title: 'Control OBS Remoto + Biblia e Himnario',
    obsConfig: getSafeObsConfig(),
    obsConnected,
  });
});

// Panel compacto para Dock de OBS Studio (compatible 100% con clyTST)
app.get('/panel', (req, res) => {
  res.render('panel', {
    title: 'Biblia e Himnario - Panel OBS',
    obsConfig: getSafeObsConfig(),
    obsConnected,
  });
});

app.get(['/proyeccion', '/himnario'], (req, res) => {
  res.render('proyeccion', {
    title: 'Himnario Adventista - Proyección OBS',
  });
});

app.get(['/biblia', '/proyeccion-biblia'], (req, res) => {
  res.render('biblia', {
    title: 'Biblia - Proyección OBS',
  });
});

app.get(['/autor', '/creditos'], (req, res) => {
  res.render('autor', {
    title: 'Acerca del Autor — Ing. Rubén Humberto Armendáriz Tamayo',
  });
});

// Información de red + Código QR para conectar el celular o tablet al instante
app.get('/api/network-info', async (req, res) => {
  const ips = getLocalNetworkIPs();
  const primaryIp = ips.length > 0 ? ips[0].address : 'localhost';
  const mobileUrl = `http://${primaryIp}:${activePort}/remoto`;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(mobileUrl, {
      margin: 1,
      width: 240,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch {}
  res.json({
    port: activePort,
    ips,
    primaryIp,
    mobileUrl,
    qrDataUrl,
    clyBridgeConnected,
  });
});

// Guardar atajos personalizados desde el celular o tablet
app.get('/api/shortcuts', (req, res) => {
  res.json(obsConfig.customShortcuts || DEFAULT_SHORTCUTS);
});

app.post('/api/shortcuts', (req, res) => {
  const { shortcuts, resetDefaults } = req.body || {};
  if (resetDefaults) {
    obsConfig.customShortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
  } else if (Array.isArray(shortcuts)) {
    obsConfig.customShortcuts = shortcuts.map((s, idx) => ({
      id: String(s.id || `custom-${Date.now()}-${idx}`),
      label: String(s.label || s.key || 'Atajo').trim(),
      icon: String(s.icon || '⌨️').trim(),
      key: String(s.key || 'Space').trim(),
      modifiers: Array.isArray(s.modifiers) ? s.modifiers : [],
      target: ['os', 'obs', 'both'].includes(s.target) ? s.target : 'both',
      targetApp: String(s.targetApp || '').trim(),
      color: String(s.color || 'slate'),
      size: s.size === 'large' ? 'large' : 'normal',
    }));
  }
  saveConfig();
  io.emit('shortcuts:update', obsConfig.customShortcuts);
  res.json({ ok: true, shortcuts: obsConfig.customShortcuts });
});

// API REST para Biblia (RVR1960 y DHH)
app.get('/api/biblia/libros', (req, res) => {
  res.json(bibleBooksIndex);
});

app.get('/api/biblia/:version/:bookId/:chapter', (req, res) => {
  const { version, bookId, chapter } = req.params;
  const data = getBibleVerseData(version, bookId, Number(chapter) || 1, 1);
  if (!data) {
    return res.status(404).json({ error: 'Capítulo no encontrado' });
  }
  res.json({
    version: data.version,
    versionName: data.versionName,
    bookId: data.bookId,
    bookName: data.bookName,
    chapter: data.chapter,
    totalChapters: data.totalChapters,
    verses: data.verses,
  });
});

// API REST para Himnario
app.get('/api/himnos', (req, res) => {
  const list = himnos.map((h) => {
    const audioInfo = getHymnAudioInfo(h);
    return {
      number: h.number,
      title: h.title,
      bibleReference: h.bibleReference,
      slidesCount: h.slides.length,
      hasLocalCantado: audioInfo.hasLocalCantado,
      hasLocalInstrumental: audioInfo.hasLocalInstrumental,
    };
  });
  res.json(list);
});

app.get('/api/himnos/:number', (req, res) => {
  const num = Number(req.params.number);
  const hymn = himnosByNumber.get(num);
  if (!hymn) {
    return res.status(404).json({ error: 'Himno no encontrado' });
  }
  const audioInfo = getHymnAudioInfo(hymn);
  res.json({
    ...hymn,
    audioInfo,
    computedSchedule: buildSlideSchedule(hymn, 0),
  });
});

function openAudioFolderInOS() {
  const folder = obsConfig.audioRootDir || DEFAULT_USER_AUDIO_ROOT;
  ensureUserAudioFolders(folder);
  const cmd =
    process.platform === 'win32'
      ? 'explorer'
      : process.platform === 'darwin'
      ? 'open'
      : 'xdg-open';
  execFile(cmd, [folder], () => {});
  return folder;
}

function setAudioRootDir(newFolder) {
  if (!newFolder) return;
  obsConfig.audioRootDir = newFolder;
  ensureUserAudioFolders(newFolder);
  saveConfig();
  io.emit('obs:status', {
    connected: obsConnected,
    error: obsLastError,
    config: getSafeObsConfig(),
  });
}

app.post('/api/audio/open-folder', (req, res) => {
  const folder = openAudioFolderInOS();
  res.json({ ok: true, folder });
});

app.post('/api/obs/config', async (req, res) => {
  const {
    url,
    password,
    sceneName,
    bibleBgSceneName,
    bibleCamSceneName,
    audioRootDir,
    autoSwitchScene,
    soloLetraIntervalSec,
    useOnlineFallback,
  } = req.body || {};
  if (typeof url === 'string') obsConfig.url = normalizeObsUrl(url);
  if (typeof password === 'string') obsConfig.password = password.trim();
  if (typeof sceneName === 'string' && sceneName.trim()) {
    obsConfig.sceneName = sceneName.trim();
  }
  if (typeof bibleBgSceneName === 'string' && bibleBgSceneName.trim()) {
    obsConfig.bibleBgSceneName = bibleBgSceneName.trim();
  }
  if (typeof bibleCamSceneName === 'string' && bibleCamSceneName.trim()) {
    obsConfig.bibleCamSceneName = bibleCamSceneName.trim();
  }
  if (typeof audioRootDir === 'string' && audioRootDir.trim()) {
    obsConfig.audioRootDir = audioRootDir.trim();
    ensureUserAudioFolders(obsConfig.audioRootDir);
  }
  if (typeof autoSwitchScene === 'boolean') obsConfig.autoSwitchScene = autoSwitchScene;
  if (soloLetraIntervalSec !== undefined) {
    obsConfig.soloLetraIntervalSec = Math.max(3, Number(soloLetraIntervalSec) || 12);
  }
  if (typeof useOnlineFallback === 'boolean') {
    obsConfig.useOnlineFallback = useOnlineFallback;
  }

  saveConfig();
  await connectOBS();
  res.json({
    connected: obsConnected,
    error: obsLastError,
    config: getSafeObsConfig(),
  });
});

// ============================================================================
// HERRAMIENTAS DE MANTENIMIENTO, REINICIO Y DESINSTALACIÓN / ACTUALIZACIÓN LIMPIA
// ============================================================================
let externalQuitHandler = null;

function setQuitHandler(fn) {
  externalQuitHandler = fn;
}

async function gracefulShutdown() {
  try {
    stopSoloLetraTimer();
    if (clyBridgeSocket) {
      clyBridgeSocket.disconnect();
    }
    await obs.disconnect().catch(() => {});
    io.close();
    server.close();
  } catch {}
}

// Restaurar configuración de fábrica (por si algo quedó mal configurado)
app.post('/api/app/reset-config', async (req, res) => {
  obsConfig = {
    url: 'ws://127.0.0.1:4455',
    password: '',
    sceneName: 'Himnario',
    bibleBgSceneName: 'Biblia',
    bibleCamSceneName: 'Biblia Camara',
    audioRootDir: DEFAULT_USER_AUDIO_ROOT,
    autoSwitchScene: true,
    soloLetraIntervalSec: 12,
    useOnlineFallback: true,
    customShortcuts: JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS)),
  };
  saveConfig();
  await connectOBS();
  io.emit('shortcuts:update', obsConfig.customShortcuts);
  res.json({
    ok: true,
    connected: obsConnected,
    config: getSafeObsConfig(),
  });
});

// Cerrar el servidor en segundo plano por completo (para poder actualizar o desinstalar sin bloqueos)
app.post('/api/app/quit', async (req, res) => {
  const { disableAutoStart } = req.body || {};
  res.json({
    ok: true,
    message:
      'El programa y el servidor en segundo plano se han cerrado por completo. Ahora puedes actualizar, reinstalar o desinstalar sin bloqueos.',
  });

  setTimeout(async () => {
    await gracefulShutdown();
    if (typeof externalQuitHandler === 'function') {
      externalQuitHandler({ disableAutoStart: Boolean(disableAutoStart) });
    } else {
      process.exit(0);
    }
  }, 250);
});

// ============================================================================
// SOCKET.IO: EVENTOS EN TIEMPO REAL PARA CELULAR / TABLET / OBS
// ============================================================================
io.on('connection', (socket) => {
  socket.emit('state:update', projectionState);
  socket.emit('bible:update', bibleState);
  socket.emit('shortcuts:update', obsConfig.customShortcuts || DEFAULT_SHORTCUTS);
  socket.emit('obs:status', {
    connected: obsConnected,
    error: obsLastError,
    config: getSafeObsConfig(),
  });
  socket.emit('obs:overview', obsLiveOverview);

  socket.on('disconnect', () => {
    previewSubscribers.delete(socket.id);
  });

  // ---------------------------------------------------------
  // 1. SUSCRIPCIÓN A VISTA PREVIA EN VIVO DE OBS
  // ---------------------------------------------------------
  socket.on('obs:subscribe-preview', (payload = {}) => {
    if (payload.enabled) {
      previewSubscribers.add(socket.id);
    } else {
      previewSubscribers.delete(socket.id);
    }
  });

  socket.on('obs:request-overview', async () => {
    await refreshObsOverview();
  });

  // ---------------------------------------------------------
  // 2. CONTROL DE ESCENAS, ELEMENTOS Y MODO ESTUDIO DE OBS
  // ---------------------------------------------------------
  socket.on('obs:set-scene', async (payload = {}, ack) => {
    const { sceneName, previewOnly } = payload;
    if (!sceneName) return;
    if (!obsConnected) await connectOBS();
    try {
      if (previewOnly && obsLiveOverview.studioModeEnabled) {
        await obs.call('SetCurrentPreviewScene', { sceneName });
      } else {
        await obs.call('SetCurrentProgramScene', { sceneName });
      }
      await refreshObsOverview();
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  socket.on('obs:toggle-scene-item', async (payload = {}, ack) => {
    const { sceneName, sceneItemId, enabled } = payload;
    const targetScene = sceneName || obsLiveOverview.currentProgramSceneName;
    if (!targetScene || typeof sceneItemId !== 'number') return;
    try {
      await obs.call('SetSceneItemEnabled', {
        sceneName: targetScene,
        sceneItemId,
        sceneItemEnabled: Boolean(enabled),
      });
      await refreshObsOverview();
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  socket.on('obs:studio-transition', async (payload = {}, ack) => {
    try {
      await obs.call('TriggerStudioModeTransition');
      await refreshObsOverview();
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  socket.on('obs:toggle-studio-mode', async (payload = {}, ack) => {
    try {
      const nextState =
        typeof payload.enabled === 'boolean'
          ? payload.enabled
          : !obsLiveOverview.studioModeEnabled;
      await obs.call('SetStudioModeEnabled', { studioModeEnabled: nextState });
      await refreshObsOverview();
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  // ---------------------------------------------------------
  // 3. CONTROL DE FUENTES MULTIMEDIA DE OBS (VIDEOS / AUDIOS)
  // ---------------------------------------------------------
  socket.on('obs:media-action', async (payload = {}, ack) => {
    const { inputName, action } = payload;
    if (!inputName || !action) return;
    const actionMap = {
      play: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY',
      pause: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE',
      stop: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
      restart: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
      next: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT',
      previous: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS',
    };
    const obsAction = actionMap[action] || action;
    try {
      await obs.call('TriggerMediaInputAction', {
        inputName,
        mediaAction: obsAction,
      });
      setTimeout(() => refreshObsOverview(), 150);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  socket.on('obs:media-seek', async (payload = {}, ack) => {
    const { inputName, cursorMs } = payload;
    if (!inputName || typeof cursorMs !== 'number') return;
    try {
      await obs.call('SetMediaInputCursor', {
        inputName,
        mediaCursor: Math.max(0, Math.round(cursorMs)),
      });
      setTimeout(() => refreshObsOverview(), 120);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  // ---------------------------------------------------------
  // 4. CONTROL DE MEZCLADOR DE AUDIO Y STREAM / GRABACIÓN
  // ---------------------------------------------------------
  socket.on('obs:audio-mute', async (payload = {}, ack) => {
    const { inputName, muted } = payload;
    if (!inputName) return;
    try {
      await obs.call('SetInputMute', {
        inputName,
        inputMuted: Boolean(muted),
      });
      await refreshObsOverview();
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  socket.on('obs:audio-volume', async (payload = {}, ack) => {
    const { inputName, volumeMul } = payload;
    if (!inputName || typeof volumeMul !== 'number') return;
    try {
      await obs.call('SetInputVolume', {
        inputName,
        inputVolumeMul: Math.max(0, Math.min(1, volumeMul)),
      });
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  socket.on('obs:stream-toggle', async (payload = {}, ack) => {
    try {
      await obs.call('ToggleStream');
      setTimeout(() => refreshObsOverview(), 400);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  socket.on('obs:record-toggle', async (payload = {}, ack) => {
    try {
      await obs.call('ToggleRecord');
      setTimeout(() => refreshObsOverview(), 400);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  // ---------------------------------------------------------
  // 5. TECLADO REMOTO Y ATAJOS PERSONALIZABLES (Av Pág, Re Pág, etc.)
  // ---------------------------------------------------------
  socket.on('keyboard:send', async (payload = {}, ack) => {
    const res = await executeKeyAction({
      key: payload.key || 'PageDown',
      modifiers: payload.modifiers || [],
      target: payload.target || 'both',
      targetApp: payload.targetApp || '',
    });
    if (typeof ack === 'function') ack(res);
  });

  // ---------------------------------------------------------
  // 6. EVENTOS DE HIMNARIO ADVENTISTA (SINCRONIZADO CON clyTST)
  // ---------------------------------------------------------
  socket.on('project:start', async (payload = {}) => {
    if (clyBridgeConnected && clyBridgeSocket) {
      clyBridgeSocket.emit('project:start', payload);
      return;
    }

    const num = Number(payload.number);
    const hymn = himnosByNumber.get(num);
    if (!hymn) return;

    const audioMode = ['cantado', 'instrumental', 'letra'].includes(payload.audioMode)
      ? payload.audioMode
      : 'cantado';
    const advanceMode = ['auto', 'manual'].includes(payload.advanceMode)
      ? payload.advanceMode
      : 'auto';

    const audioInfo = getHymnAudioInfo(hymn);
    let audioUrl = null;
    let isLocalAudio = false;

    if (audioMode === 'cantado') {
      if (audioInfo.localCantadoUrl) {
        audioUrl = audioInfo.localCantadoUrl;
        isLocalAudio = true;
      } else if (obsConfig.useOnlineFallback && audioInfo.onlineCantadoUrl) {
        audioUrl = audioInfo.onlineCantadoUrl;
      }
    } else if (audioMode === 'instrumental') {
      if (audioInfo.localInstrumentalUrl) {
        audioUrl = audioInfo.localInstrumentalUrl;
        isLocalAudio = true;
      } else if (obsConfig.useOnlineFallback && audioInfo.onlineInstrumentalUrl) {
        audioUrl = audioInfo.onlineInstrumentalUrl;
      }
    }

    const schedule = buildSlideSchedule(hymn, 0);

    projectionState = {
      active: true,
      hymn: {
        number: hymn.number,
        title: hymn.title,
        bibleReference: hymn.bibleReference,
        slides: hymn.slides,
        audioInfo,
      },
      audioMode,
      advanceMode,
      audioUrl,
      isLocalAudio,
      currentSlideIndex:
        typeof payload.startSlideIndex === 'number' ? payload.startSlideIndex : 0,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
      computedSchedule: schedule,
    };

    const obsResult = await switchToHymnScene();

    io.emit('project:load', {
      state: projectionState,
      obsResult,
    });
    io.emit('state:update', projectionState);

    if (audioMode === 'letra') {
      startSoloLetraTimer();
    } else {
      stopSoloLetraTimer();
    }
  });

  socket.on('project:slide', (payload = {}) => {
    if (clyBridgeConnected && clyBridgeSocket) {
      clyBridgeSocket.emit('project:slide', payload);
      return;
    }
    if (!projectionState.hymn) return;
    const total = projectionState.hymn.slides.length;
    let nextIndex = projectionState.currentSlideIndex;

    if (typeof payload.index === 'number') {
      nextIndex = payload.index;
    } else if (payload.direction === 'next') {
      nextIndex += 1;
    } else if (payload.direction === 'prev') {
      nextIndex -= 1;
    }

    nextIndex = Math.max(0, Math.min(total - 1, nextIndex));
    projectionState.currentSlideIndex = nextIndex;
    projectionState.active = true;

    if (projectionState.audioMode === 'letra' && projectionState.advanceMode === 'auto') {
      startSoloLetraTimer();
    }

    io.emit('state:update', projectionState);
  });

  socket.on('project:advance-mode', (payload = {}) => {
    if (clyBridgeConnected && clyBridgeSocket) {
      clyBridgeSocket.emit('project:advance-mode', payload);
      return;
    }
    const mode = payload.advanceMode === 'manual' ? 'manual' : 'auto';
    projectionState.advanceMode = mode;
    if (projectionState.audioMode === 'letra') {
      if (mode === 'auto') startSoloLetraTimer();
      else stopSoloLetraTimer();
    }
    io.emit('state:update', projectionState);
  });

  socket.on('project:toggle-play', async () => {
    if (clyBridgeConnected && clyBridgeSocket) {
      clyBridgeSocket.emit('project:toggle-play');
      return;
    }
    if (!projectionState.active) return;
    projectionState.isPlaying = !projectionState.isPlaying;
    if (projectionState.isPlaying) {
      await switchToHymnScene();
    }
    io.emit('audio:control', {
      action: projectionState.isPlaying ? 'play' : 'pause',
    });
    if (projectionState.audioMode === 'letra') {
      if (projectionState.isPlaying) startSoloLetraTimer();
      else stopSoloLetraTimer();
    }
    io.emit('state:update', projectionState);
  });

  socket.on('audio:seek', (payload = {}) => {
    if (clyBridgeConnected && clyBridgeSocket) {
      clyBridgeSocket.emit('audio:seek', payload);
      return;
    }
    if (typeof payload.time === 'number') {
      projectionState.currentTime = payload.time;
      io.emit('audio:control', { action: 'seek', time: payload.time });
    }
  });

  socket.on('project:stop', async () => {
    if (clyBridgeConnected && clyBridgeSocket) {
      clyBridgeSocket.emit('project:stop');
      return;
    }
    stopHymnProjection();
    await restorePreviousScene();
  });

  socket.on('audio:timeupdate', (payload = {}) => {
    if (!projectionState.active || !projectionState.hymn) return;
    const currentTime = Number(payload.currentTime) || 0;
    const duration = Number(payload.duration) || 0;

    projectionState.currentTime = currentTime;
    if (duration > 0 && Math.abs(duration - projectionState.duration) > 0.5) {
      projectionState.duration = duration;
      projectionState.computedSchedule = buildSlideSchedule(
        projectionState.hymn,
        duration
      );
    }

    if (
      projectionState.advanceMode === 'auto' &&
      projectionState.isPlaying &&
      projectionState.computedSchedule.length > 0
    ) {
      let targetIdx = 0;
      for (let i = 0; i < projectionState.computedSchedule.length; i++) {
        if (currentTime >= projectionState.computedSchedule[i]) {
          targetIdx = i;
        } else {
          break;
        }
      }
      if (targetIdx !== projectionState.currentSlideIndex) {
        projectionState.currentSlideIndex = targetIdx;
        io.emit('state:update', projectionState);
        return;
      }
    }

    socket.broadcast.emit('audio:progress', {
      currentTime: projectionState.currentTime,
      duration: projectionState.duration,
      currentSlideIndex: projectionState.currentSlideIndex,
      computedSchedule: projectionState.computedSchedule,
    });
  });

  socket.on('audio:ended', () => {
    stopSoloLetraTimer();
    projectionState.isPlaying = false;
    io.emit('state:update', projectionState);
  });

  // ---------------------------------------------------------
  // 7. EVENTOS DE PROYECCIÓN DE BIBLIA (SINCRONIZADO CON clyTST)
  // ---------------------------------------------------------
  socket.on('bible:project', async (payload = {}) => {
    if (clyBridgeConnected && clyBridgeSocket) {
      clyBridgeSocket.emit('bible:project', payload);
      return;
    }
    const version = payload.version === 'DHH' ? 'DHH' : 'RVR1960';
    const sceneMode = payload.sceneMode === 'camara' ? 'camara' : 'fondo';
    const data = getBibleVerseData(
      version,
      payload.bookId || 'GEN',
      Number(payload.chapter) || 1,
      Number(payload.verse) || 1
    );
    if (!data) return;

    bibleState = {
      active: true,
      version: data.version,
      versionName: data.versionName,
      bookId: data.bookId,
      bookName: data.bookName,
      chapter: data.chapter,
      verse: data.verse,
      verseLabel: data.verseLabel,
      text: data.text,
      sceneMode,
    };

    if (projectionState.active || projectionState.isPlaying) {
      stopHymnProjection();
    }
    await switchToBibleScene(sceneMode);
    io.emit('bible:update', bibleState);
  });

  socket.on('bible:scene-mode', async (payload = {}) => {
    if (clyBridgeConnected && clyBridgeSocket) {
      clyBridgeSocket.emit('bible:scene-mode', payload);
      return;
    }
    const sceneMode = payload.sceneMode === 'camara' ? 'camara' : 'fondo';
    bibleState.sceneMode = sceneMode;
    if (bibleState.active) {
      await switchToBibleScene(sceneMode);
    }
    io.emit('bible:update', bibleState);
  });

  socket.on('bible:stop', async () => {
    if (clyBridgeConnected && clyBridgeSocket) {
      clyBridgeSocket.emit('bible:stop');
      return;
    }
    bibleState = {
      ...bibleState,
      active: false,
    };
    await restorePreviousScene();
    io.emit('bible:update', bibleState);
  });
});

// Iniciar servidor escuchando en 0.0.0.0 para aceptar conexiones desde celulares y tablets en la red Wi-Fi
const net = require('net');

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, '0.0.0.0');
  });
}

async function startServer() {
  const isPrimaryFree = await checkPortAvailable(PRIMARY_PORT);
  const portToUse = isPrimaryFree ? PRIMARY_PORT : FALLBACK_PORT;
  activePort = portToUse;

  if (!isPrimaryFree) {
    console.log(
      `ℹ️ El puerto ${PRIMARY_PORT} ya está en uso (probablemente por Biblia e Himnario OBS). Iniciando en puerto ${FALLBACK_PORT} y enlazando automáticamente...`
    );
  }

  server.on('error', (err) => {
    console.error('Error en el servidor HTTP:', err);
  });

  server.listen(portToUse, '0.0.0.0', () => {
    const ips = getLocalNetworkIPs();
    const lanIp = ips.length > 0 ? ips[0].address : 'localhost';
    setupClyBridgeIfNeeded();

    console.log(`\n====================================================================`);
    console.log(`📱🎥 CONTROL OBS REMOTO + BIBLIA E HIMNARIO LISTO`);
    console.log(`   • Autor: Ing. Rubén Humberto Armendáriz Tamayo (ISC)`);
    console.log(`   • Control Móvil / Tablet (Wi-Fi): http://${lanIp}:${activePort}/remoto`);
    console.log(`   • Control Local (PC / Mac):       http://localhost:${activePort}/remoto`);
    console.log(`   • Panel Compacto (Dock OBS):      http://localhost:${activePort}/panel`);
    console.log(`   • Fuente Navegador Himnario:      http://localhost:${activePort}/proyeccion`);
    console.log(`   • Fuente Navegador Biblia:        http://localhost:${activePort}/biblia`);
    console.log(`====================================================================\n`);
  });
}

startServer();

process.on('SIGTERM', async () => {
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await gracefulShutdown();
  process.exit(0);
});

module.exports = {
  app,
  server,
  getPort: () => activePort,
  getLocalNetworkIPs,
  obsConfig,
  openAudioFolderInOS,
  setAudioRootDir,
  setQuitHandler,
  gracefulShutdown,
};
