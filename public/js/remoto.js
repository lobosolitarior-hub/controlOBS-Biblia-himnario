/**
 * ============================================================================
 *  CONTROL REMOTO MÓVIL / TABLET: OBS Studio + Teclado + Biblia e Himnario
 *  AUTOR: Ing. Rubén Humberto Armendáriz Tamayo (ISC)
 * ============================================================================
 */
(() => {
  const socket = io();

  // =========================================================
  // 1. NAVEGACIÓN POR PESTAÑAS Y MONITOR EN VIVO
  // =========================================================
  const tabButtons = document.querySelectorAll('.bottom-tabbar .tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  const btnToggleMonitor = document.getElementById('btnToggleMonitor');
  const liveMonitorSection = document.getElementById('liveMonitorSection');
  const obsPreviewImg = document.getElementById('obsPreviewImg');
  const monitorPlaceholder = document.getElementById('monitorPlaceholder');
  const monitorPlaceholderText = document.getElementById('monitorPlaceholderText');
  const btnPauseMonitor = document.getElementById('btnPauseMonitor');

  const badgeProgramScene = document.getElementById('badgeProgramScene');
  const badgeStreamStatus = document.getElementById('badgeStreamStatus');
  const badgeRecordStatus = document.getElementById('badgeRecordStatus');
  const badgeActiveProjection = document.getElementById('badgeActiveProjection');

  const obsStatusDot = document.getElementById('obsStatusDot');
  const obsStatusText = document.getElementById('obsStatusText');

  let monitorVisible = true;
  let monitorPaused = false;
  let obsOverview = {
    connected: false,
    currentProgramSceneName: '',
    currentPreviewSceneName: '',
    studioModeEnabled: false,
    scenes: [],
    sceneItems: [],
    mediaInputs: [],
    audioInputs: [],
    streamStatus: { active: false, timecode: '00:00:00' },
    recordStatus: { active: false, paused: false, timecode: '00:00:00' },
  };

  function vibrateTap(ms = 20) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      vibrateTap(15);
      const targetId = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
      tabPanels.forEach((p) => p.classList.toggle('active', p.id === targetId));
    });
  });

  function updatePreviewSubscription() {
    const shouldStream = monitorVisible && !monitorPaused && !document.hidden;
    socket.emit('obs:subscribe-preview', { enabled: shouldStream });
  }

  btnToggleMonitor.addEventListener('click', () => {
    monitorVisible = !monitorVisible;
    liveMonitorSection.hidden = !monitorVisible;
    btnToggleMonitor.classList.toggle('active', monitorVisible);
    updatePreviewSubscription();
  });

  btnPauseMonitor.addEventListener('click', () => {
    monitorPaused = !monitorPaused;
    btnPauseMonitor.textContent = monitorPaused ? '▶ Reanudar video' : '⏸ Pausar video';
    updatePreviewSubscription();
  });

  document.addEventListener('visibilitychange', () => {
    updatePreviewSubscription();
  });

  socket.on('connect', () => {
    updatePreviewSubscription();
    socket.emit('obs:request-overview');
  });

  socket.on('obs:screenshot', (payload = {}) => {
    if (!payload.imageData || monitorPaused) return;
    obsPreviewImg.src = payload.imageData;
    obsPreviewImg.hidden = false;
    monitorPlaceholder.style.display = 'none';
  });

  // =========================================================
  // 2. ESCENAS, FUENTES, MODO ESTUDIO Y STREAM / GRABACIÓN
  // =========================================================
  const scenesGrid = document.getElementById('scenesGrid');
  const sceneItemsList = document.getElementById('sceneItemsList');
  const currentSceneSourcesLabel = document.getElementById('currentSceneSourcesLabel');
  const btnStudioModeToggle = document.getElementById('btnStudioModeToggle');
  const btnStudioTransition = document.getElementById('btnStudioTransition');
  const btnToggleStream = document.getElementById('btnToggleStream');
  const lblStreamBtn = document.getElementById('lblStreamBtn');
  const subStreamBtn = document.getElementById('subStreamBtn');
  const btnToggleRecord = document.getElementById('btnToggleRecord');
  const lblRecordBtn = document.getElementById('lblRecordBtn');
  const subRecordBtn = document.getElementById('subRecordBtn');

  function formatMs(ms) {
    const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function renderObsOverview() {
    const isConn = Boolean(obsOverview.connected);
    obsStatusDot.className = `status-dot ${isConn ? 'connected' : 'disconnected'}`;
    obsStatusText.textContent = isConn
      ? `OBS Conectado • ${obsOverview.currentProgramSceneName || 'Listo'}`
      : 'OBS Desconectado (toca ⚙️ para conectar)';

    if (!isConn) {
      obsPreviewImg.hidden = true;
      monitorPlaceholder.style.display = 'flex';
      monitorPlaceholderText.textContent =
        'OBS Studio no está conectado. Abre OBS y verifica el servidor WebSocket (Puerto 4455).';
    }

    badgeProgramScene.textContent = `🎬 ${obsOverview.currentProgramSceneName || 'Sin escena'}`;

    // Stream y grabación
    const st = obsOverview.streamStatus || {};
    badgeStreamStatus.hidden = !st.active;
    if (st.active) {
      badgeStreamStatus.textContent = `🔴 EN VIVO ${st.timecode || ''}`;
    }
    btnToggleStream.classList.toggle('active-live', Boolean(st.active));
    lblStreamBtn.textContent = st.active ? 'Detener Transmisión' : 'Iniciar Transmisión';
    subStreamBtn.textContent = st.active
      ? `En vivo (${st.timecode || '00:00:00'})`
      : 'Estado: Detenido';

    const rc = obsOverview.recordStatus || {};
    badgeRecordStatus.hidden = !rc.active;
    if (rc.active) {
      badgeRecordStatus.textContent = `⏺️ REC ${rc.timecode || ''}`;
    }
    btnToggleRecord.classList.toggle('active-live', Boolean(rc.active));
    lblRecordBtn.textContent = rc.active ? 'Detener Grabación' : 'Iniciar Grabación';
    subRecordBtn.textContent = rc.active
      ? `Grabando (${rc.timecode || '00:00:00'})`
      : 'Estado: Detenido';

    // Modo estudio
    btnStudioModeToggle.textContent = `Modo Estudio: ${obsOverview.studioModeEnabled ? 'ON' : 'OFF'}`;
    btnStudioTransition.hidden = !obsOverview.studioModeEnabled;

    // Renderizar cuadrícula de Escenas
    scenesGrid.innerHTML = '';
    if (!obsOverview.scenes || obsOverview.scenes.length === 0) {
      scenesGrid.innerHTML =
        '<div class="empty-hint">No hay escenas disponibles o OBS está desconectado.</div>';
    } else {
      obsOverview.scenes.forEach((sc) => {
        const isProg = sc.sceneName === obsOverview.currentProgramSceneName;
        const isPrev =
          obsOverview.studioModeEnabled &&
          sc.sceneName === obsOverview.currentPreviewSceneName;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `scene-tile${isProg ? ' program-active' : ''}${isPrev ? ' preview-active' : ''}`;

        const tag = document.createElement('span');
        tag.className = 'scene-tile-tag';
        tag.textContent = isProg ? '🔴 EN AIRE' : isPrev ? '🟢 PREVIA' : 'ESCENA';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = sc.sceneName;

        btn.appendChild(tag);
        btn.appendChild(nameSpan);

        btn.addEventListener('click', () => {
          vibrateTap(30);
          socket.emit('obs:set-scene', {
            sceneName: sc.sceneName,
            previewOnly: false,
          });
        });

        scenesGrid.appendChild(btn);
      });
    }

    // Renderizar fuentes/elementos dentro de la escena activa
    currentSceneSourcesLabel.textContent = obsOverview.currentProgramSceneName
      ? `Escena: ${obsOverview.currentProgramSceneName}`
      : 'Mostrar u ocultar fuentes';

    sceneItemsList.innerHTML = '';
    if (!obsOverview.sceneItems || obsOverview.sceneItems.length === 0) {
      sceneItemsList.innerHTML =
        '<div class="empty-hint">Esta escena no tiene fuentes adicionales.</div>';
    } else {
      obsOverview.sceneItems.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'scene-item-row';

        const nameEl = document.createElement('span');
        nameEl.className = 'scene-item-name';
        nameEl.textContent = item.sourceName;

        const visBtn = document.createElement('button');
        visBtn.type = 'button';
        visBtn.className = `scene-vis-btn ${item.sceneItemEnabled ? 'visible' : 'hidden-item'}`;
        visBtn.textContent = item.sceneItemEnabled ? '👁️ Visible' : '🚫 Oculto';

        visBtn.addEventListener('click', () => {
          vibrateTap(25);
          socket.emit('obs:toggle-scene-item', {
            sceneName: obsOverview.currentProgramSceneName,
            sceneItemId: item.sceneItemId,
            enabled: !item.sceneItemEnabled,
          });
        });

        row.appendChild(nameEl);
        row.appendChild(visBtn);
        sceneItemsList.appendChild(row);
      });
    }

    renderMultimediaAndAudio();
  }

  btnStudioModeToggle.addEventListener('click', () => {
    vibrateTap(20);
    socket.emit('obs:toggle-studio-mode', {
      enabled: !obsOverview.studioModeEnabled,
    });
  });

  btnStudioTransition.addEventListener('click', () => {
    vibrateTap(35);
    socket.emit('obs:studio-transition');
  });

  btnToggleStream.addEventListener('click', () => {
    const active = obsOverview.streamStatus && obsOverview.streamStatus.active;
    const msg = active
      ? '¿Seguro que deseas DETENER la transmisión en vivo en OBS?'
      : '¿Seguro que deseas INICIAR la transmisión en vivo en OBS?';
    if (window.confirm(msg)) {
      socket.emit('obs:stream-toggle');
    }
  });

  btnToggleRecord.addEventListener('click', () => {
    const active = obsOverview.recordStatus && obsOverview.recordStatus.active;
    const msg = active
      ? '¿Deseas DETENER la grabación en OBS?'
      : '¿Deseas INICIAR la grabación en OBS?';
    if (window.confirm(msg)) {
      socket.emit('obs:record-toggle');
    }
  });

  socket.on('obs:overview', (data) => {
    if (data) {
      obsOverview = data;
      renderObsOverview();
    }
  });

  // =========================================================
  // 3. MULTIMEDIA (VIDEOS/IMÁGENES) Y MEZCLADOR DE AUDIO OBS
  // =========================================================
  const mediaInputsList = document.getElementById('mediaInputsList');
  const audioMixerList = document.getElementById('audioMixerList');
  const btnRefreshMedia = document.getElementById('btnRefreshMedia');

  btnRefreshMedia.addEventListener('click', () => {
    vibrateTap(20);
    socket.emit('obs:request-overview');
  });

  function renderMultimediaAndAudio() {
    // 1. Fuentes Multimedia
    mediaInputsList.innerHTML = '';
    const medias = obsOverview.mediaInputs || [];
    if (medias.length === 0) {
      mediaInputsList.innerHTML =
        '<div class="empty-hint">No se encontraron fuentes de video o multimedia en OBS.</div>';
    } else {
      medias.forEach((m) => {
        const card = document.createElement('div');
        card.className = 'media-card-item';

        const stateClean = String(m.mediaState || '')
          .replace('OBS_MEDIA_STATE_', '')
          .toLowerCase();

        const top = document.createElement('div');
        top.className = 'media-card-top';
        top.innerHTML = `
          <span class="media-title">${m.inCurrentScene ? '🟢 ' : ''}${m.inputName}</span>
          <span class="media-state-pill">${stateClean || m.inputKind}</span>
        `;
        card.appendChild(top);

        if (m.isControllableMedia) {
          const timeRow = document.createElement('div');
          timeRow.className = 'progress-labels';
          timeRow.innerHTML = `
            <span>${formatMs(m.mediaCursor)}</span>
            <span>${formatMs(m.mediaDuration)}</span>
          `;
          card.appendChild(timeRow);

          if (m.mediaDuration > 0) {
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'seek-slider';
            slider.min = '0';
            slider.max = String(m.mediaDuration);
            slider.value = String(m.mediaCursor || 0);
            slider.addEventListener('change', () => {
              socket.emit('obs:media-seek', {
                inputName: m.inputName,
                cursorMs: Number(slider.value),
              });
            });
            card.appendChild(slider);
          }

          const btns = document.createElement('div');
          btns.className = 'media-btns-row';
          [
            { act: 'play', label: '▶ Play' },
            { act: 'pause', label: '⏸ Pausa' },
            { act: 'restart', label: '⏮ Reiniciar' },
            { act: 'stop', label: '⏹ Stop' },
          ].forEach((b) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'media-ctrl-btn';
            btn.textContent = b.label;
            btn.addEventListener('click', () => {
              vibrateTap(25);
              socket.emit('obs:media-action', {
                inputName: m.inputName,
                action: b.act,
              });
            });
            btns.appendChild(btn);
          });
          card.appendChild(btns);
        }

        mediaInputsList.appendChild(card);
      });
    }

    // 2. Mezclador de Audio
    audioMixerList.innerHTML = '';
    const audios = obsOverview.audioInputs || [];
    if (audios.length === 0) {
      audioMixerList.innerHTML =
        '<div class="empty-hint">No hay entradas de audio activas.</div>';
    } else {
      audios.forEach((a) => {
        const row = document.createElement('div');
        row.className = 'audio-row';

        const head = document.createElement('div');
        head.className = 'audio-row-head';

        const title = document.createElement('span');
        title.className = 'scene-item-name';
        title.textContent = a.inputName;

        const muteBtn = document.createElement('button');
        muteBtn.type = 'button';
        muteBtn.className = `scene-vis-btn ${a.inputMuted ? 'hidden-item' : 'visible'}`;
        muteBtn.textContent = a.inputMuted ? '🔇 Silenciado' : '🔊 Activo';
        muteBtn.addEventListener('click', () => {
          vibrateTap(25);
          socket.emit('obs:audio-mute', {
            inputName: a.inputName,
            muted: !a.inputMuted,
          });
        });

        head.appendChild(title);
        head.appendChild(muteBtn);

        const volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.className = 'seek-slider';
        volSlider.min = '0';
        volSlider.max = '100';
        volSlider.value = String(Math.round(Math.min(1, a.inputVolumeMul || 0) * 100));
        volSlider.addEventListener('input', () => {
          socket.emit('obs:audio-volume', {
            inputName: a.inputName,
            volumeMul: Number(volSlider.value) / 100,
          });
        });

        row.appendChild(head);
        row.appendChild(volSlider);
        audioMixerList.appendChild(row);
      });
    }
  }

  // =========================================================
  // 4. TECLADO REMOTO Y ATAJOS PERSONALIZABLES
  // =========================================================
  const shortcutsGrid = document.getElementById('shortcutsGrid');
  const quickTargetAppSelect = document.getElementById('quickTargetAppSelect');
  const lastKeyFeedback = document.getElementById('lastKeyFeedback');
  const lastKeyText = document.getElementById('lastKeyText');
  const customRawKeyInput = document.getElementById('customRawKeyInput');
  const btnSendRawKey = document.getElementById('btnSendRawKey');

  const btnManageShortcuts = document.getElementById('btnManageShortcuts');
  const shortcutsEditorCard = document.getElementById('shortcutsEditorCard');
  const shortcutsEditorList = document.getElementById('shortcutsEditorList');
  const btnNewShortcut = document.getElementById('btnNewShortcut');
  const btnResetShortcuts = document.getElementById('btnResetShortcuts');

  // Modal de creación/edición de atajos
  const shortcutModal = document.getElementById('shortcutModal');
  const shortcutForm = document.getElementById('shortcutForm');
  const shortcutModalTitle = document.getElementById('shortcutModalTitle');
  const btnCloseShortcutModal = document.getElementById('btnCloseShortcutModal');
  const btnCancelShortcut = document.getElementById('btnCancelShortcut');
  const scIdInput = document.getElementById('scIdInput');
  const scLabelInput = document.getElementById('scLabelInput');
  const scIconInput = document.getElementById('scIconInput');
  const scSizeInput = document.getElementById('scSizeInput');
  const scKeySelect = document.getElementById('scKeySelect');
  const btnCaptureKey = document.getElementById('btnCaptureKey');
  const modCtrl = document.getElementById('modCtrl');
  const modAlt = document.getElementById('modAlt');
  const modShift = document.getElementById('modShift');
  const modCmd = document.getElementById('modCmd');
  const scColorInput = document.getElementById('scColorInput');
  const scTargetInput = document.getElementById('scTargetInput');

  let shortcuts = [];
  let feedbackTimeout = null;

  function showKeySentFeedback(label, res) {
    clearTimeout(feedbackTimeout);
    lastKeyFeedback.hidden = false;
    if (res && res.results && res.results.os && !res.results.os.ok && res.results.os.error) {
      lastKeyText.textContent = `⚠️ ${res.results.os.error}`;
    } else {
      lastKeyText.textContent = `✅ Enviado: ${label}`;
    }
    feedbackTimeout = setTimeout(() => {
      lastKeyFeedback.hidden = true;
    }, 2800);
  }

  function formatComboLabel(sc) {
    const mods = Array.isArray(sc.modifiers) && sc.modifiers.length > 0
      ? sc.modifiers.map((m) => m.toUpperCase()).join('+') + '+'
      : '';
    return `${mods}${sc.key}`;
  }

  function renderShortcuts() {
    shortcutsGrid.innerHTML = '';
    shortcuts.forEach((sc) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `shortcut-pad-btn color-${sc.color || 'slate'} size-${sc.size || 'normal'}`;
      btn.innerHTML = `
        <span class="pad-icon">${sc.icon || '⌨️'}</span>
        <span class="pad-label">${sc.label}</span>
        <span class="pad-Combo">${formatComboLabel(sc)}</span>
      `;
      btn.addEventListener('click', () => {
        vibrateTap(30);
        const chosenApp = quickTargetAppSelect.value || sc.targetApp || '';
        socket.emit(
          'keyboard:send',
          {
            key: sc.key,
            modifiers: sc.modifiers || [],
            target: sc.target || 'both',
            targetApp: chosenApp,
          },
          (res) => {
            showKeySentFeedback(`${sc.label} (${formatComboLabel(sc)})`, res);
          }
        );
      });
      shortcutsGrid.appendChild(btn);
    });

    // Renderizar lista en el editor de atajos
    shortcutsEditorList.innerHTML = '';
    shortcuts.forEach((sc, idx) => {
      const row = document.createElement('div');
      row.className = 'shortcut-edit-row';
      row.innerHTML = `
        <div class="sc-edit-meta">
          <span style="font-size:1.3rem">${sc.icon || '⌨️'}</span>
          <div>
            <strong style="display:block;font-size:0.88rem">${sc.label}</strong>
            <small style="color:#94a3b8">${formatComboLabel(sc)} • ${sc.size === 'large' ? 'Grande' : 'Normal'}</small>
          </div>
        </div>
        <div class="sc-edit-actions">
          <button type="button" class="pill-action-btn" data-act="up" title="Subir">⬆️</button>
          <button type="button" class="pill-action-btn" data-act="down" title="Bajar">⬇️</button>
          <button type="button" class="pill-action-btn accent" data-act="edit">✏️ Editar</button>
          <button type="button" class="pill-action-btn danger" data-act="del">🗑️</button>
        </div>
      `;

      row.querySelector('[data-act="up"]').addEventListener('click', () => {
        if (idx === 0) return;
        const copy = [...shortcuts];
        [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
        saveShortcutsToServer(copy);
      });

      row.querySelector('[data-act="down"]').addEventListener('click', () => {
        if (idx === shortcuts.length - 1) return;
        const copy = [...shortcuts];
        [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
        saveShortcutsToServer(copy);
      });

      row.querySelector('[data-act="edit"]').addEventListener('click', () => {
        openShortcutEditorModal(sc);
      });

      row.querySelector('[data-act="del"]').addEventListener('click', () => {
        if (window.confirm(`¿Eliminar el atajo "${sc.label}"?`)) {
          const copy = shortcuts.filter((item) => item.id !== sc.id);
          saveShortcutsToServer(copy);
        }
      });

      shortcutsEditorList.appendChild(row);
    });
  }

  async function saveShortcutsToServer(newList, resetDefaults = false) {
    try {
      const res = await fetch('/api/shortcuts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcuts: newList, resetDefaults }),
      });
      const data = await res.json();
      if (data && Array.isArray(data.shortcuts)) {
        shortcuts = data.shortcuts;
        renderShortcuts();
      }
    } catch (err) {
      console.error('Error guardando atajos:', err);
    }
  }

  socket.on('shortcuts:update', (list) => {
    if (Array.isArray(list)) {
      shortcuts = list;
      renderShortcuts();
    }
  });

  btnManageShortcuts.addEventListener('click', () => {
    shortcutsEditorCard.hidden = !shortcutsEditorCard.hidden;
    if (!shortcutsEditorCard.hidden) {
      shortcutsEditorCard.scrollIntoView({ behavior: 'smooth' });
    }
  });

  function openShortcutEditorModal(sc = null) {
    if (sc) {
      shortcutModalTitle.textContent = '✏️ Editar Atajo de Tecla';
      scIdInput.value = sc.id;
      scLabelInput.value = sc.label;
      scIconInput.value = sc.icon || '⌨️';
      scSizeInput.value = sc.size || 'normal';
      ensureKeyOptionExists(sc.key);
      scKeySelect.value = sc.key;
      const mods = sc.modifiers || [];
      modCtrl.checked = mods.includes('ctrl');
      modAlt.checked = mods.includes('alt');
      modShift.checked = mods.includes('shift');
      modCmd.checked = mods.includes('cmd');
      scColorInput.value = sc.color || 'primary';
      scTargetInput.value = sc.target || 'both';
    } else {
      shortcutModalTitle.textContent = '➕ Nuevo Atajo en Pantalla';
      scIdInput.value = '';
      scLabelInput.value = '';
      scIconInput.value = '⌨️';
      scSizeInput.value = 'normal';
      scKeySelect.value = 'PageUp';
      modCtrl.checked = false;
      modAlt.checked = false;
      modShift.checked = false;
      modCmd.checked = false;
      scColorInput.value = 'primary';
      scTargetInput.value = 'both';
    }
    shortcutModal.hidden = false;
  }

  function ensureKeyOptionExists(keyVal) {
    if (!keyVal) return;
    const exists = Array.from(scKeySelect.options).some((o) => o.value === keyVal);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = keyVal;
      opt.textContent = `Tecla: ${keyVal}`;
      scKeySelect.appendChild(opt);
    }
  }

  btnNewShortcut.addEventListener('click', () => openShortcutEditorModal(null));
  btnCloseShortcutModal.addEventListener('click', () => {
    shortcutModal.hidden = true;
  });
  btnCancelShortcut.addEventListener('click', () => {
    shortcutModal.hidden = true;
  });

  btnResetShortcuts.addEventListener('click', () => {
    if (window.confirm('¿Restaurar los atajos de teclado predeterminados?')) {
      saveShortcutsToServer([], true);
    }
  });

  // Botón para detectar cualquier tecla presionada
  let capturingKey = false;
  btnCaptureKey.addEventListener('click', () => {
    capturingKey = true;
    btnCaptureKey.textContent = '⌨️ Presiona una tecla...';
    const handler = (e) => {
      e.preventDefault();
      capturingKey = false;
      btnCaptureKey.textContent = '🎹 Detectar';
      window.removeEventListener('keydown', handler, true);

      let mapped = e.key;
      if (mapped === ' ') mapped = 'Space';
      else if (mapped === 'ArrowRight') mapped = 'Right';
      else if (mapped === 'ArrowLeft') mapped = 'Left';
      else if (mapped === 'ArrowUp') mapped = 'Up';
      else if (mapped === 'ArrowDown') mapped = 'Down';
      else if (mapped.length === 1) mapped = mapped.toUpperCase();

      ensureKeyOptionExists(mapped);
      scKeySelect.value = mapped;
      modCtrl.checked = e.ctrlKey;
      modAlt.checked = e.altKey;
      modShift.checked = e.shiftKey;
      modCmd.checked = e.metaKey;
    };
    window.addEventListener('keydown', handler, true);
  });

  shortcutForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const modifiers = [];
    if (modCtrl.checked) modifiers.push('ctrl');
    if (modAlt.checked) modifiers.push('alt');
    if (modShift.checked) modifiers.push('shift');
    if (modCmd.checked) modifiers.push('cmd');

    const newItem = {
      id: scIdInput.value || `sc-${Date.now()}`,
      label: scLabelInput.value.trim() || scKeySelect.value,
      icon: scIconInput.value.trim() || '⌨️',
      size: scSizeInput.value,
      key: scKeySelect.value,
      modifiers,
      color: scColorInput.value,
      target: scTargetInput.value,
      targetApp: '',
    };

    const copy = [...shortcuts];
    const existingIdx = copy.findIndex((s) => s.id === newItem.id);
    if (existingIdx >= 0) {
      copy[existingIdx] = newItem;
    } else {
      copy.push(newItem);
    }

    shortcutModal.hidden = true;
    saveShortcutsToServer(copy);
  });

  // Enviar tecla rápida desde el input libre
  function sendCustomRawKey() {
    const val = customRawKeyInput.value.trim();
    if (!val) return;
    vibrateTap(25);
    socket.emit(
      'keyboard:send',
      {
        key: val,
        modifiers: [],
        target: 'both',
        targetApp: quickTargetAppSelect.value || '',
      },
      (res) => {
        showKeySentFeedback(val, res);
      }
    );
  }

  btnSendRawKey.addEventListener('click', sendCustomRawKey);
  customRawKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendCustomRawKey();
    }
  });

  // =========================================================
  // 5. HIMNARIO ADVENTISTA (614 HIMNOS)
  // =========================================================
  const remHymnNum = document.getElementById('remHymnNum');
  const remHymnSearch = document.getElementById('remHymnSearch');
  const btnRemClearHymn = document.getElementById('btnRemClearHymn');
  const remHymnAutocomplete = document.getElementById('remHymnAutocomplete');
  const hymnBadgeCantado = document.getElementById('hymnBadgeCantado');
  const hymnBadgeInstr = document.getElementById('hymnBadgeInstr');
  const remAudioModeBtns = document.querySelectorAll('#remAudioModeGroup .seg-btn');
  const remAdvanceModeBtns = document.querySelectorAll('#remAdvanceModeGroup .seg-btn');
  const btnRemHymnProject = document.getElementById('btnRemHymnProject');
  const btnRemHymnPause = document.getElementById('btnRemHymnPause');
  const btnRemHymnStop = document.getElementById('btnRemHymnStop');
  const remHymnProgressBox = document.getElementById('remHymnProgressBox');
  const remHymnTimeCurrent = document.getElementById('remHymnTimeCurrent');
  const remHymnTimeTotal = document.getElementById('remHymnTimeTotal');
  const remHymnActiveTitle = document.getElementById('remHymnActiveTitle');
  const remHymnSeekRange = document.getElementById('remHymnSeekRange');
  const btnRemPrevSlide = document.getElementById('btnRemPrevSlide');
  const btnRemNextSlide = document.getElementById('btnRemNextSlide');
  const remHymnSlidesList = document.getElementById('remHymnSlidesList');
  const remHymnPreviewHeader = document.getElementById('remHymnPreviewHeader');

  let allHymns = [];
  let selectedHymn = null;
  let hymnAudioMode = 'cantado';
  let hymnAdvanceMode = 'auto';
  let liveHymnState = null;

  function normalizeText(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[¡!¿?,.;:()"']/g, '')
      .toLowerCase()
      .trim();
  }

  function formatSec(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  async function loadHymnsIndex() {
    try {
      const res = await fetch('/api/himnos');
      allHymns = await res.json();
      await selectHymn(1, true);
    } catch (err) {
      console.error('Error cargando himnos:', err);
    }
  }

  async function selectHymn(num, updateFields = true) {
    const n = Number(num);
    if (!n || n < 1 || n > 614) return;
    try {
      const res = await fetch(`/api/himnos/${n}`);
      if (!res.ok) return;
      selectedHymn = await res.json();
      if (updateFields) {
        remHymnNum.value = selectedHymn.number;
        remHymnSearch.value = `${selectedHymn.number}. ${selectedHymn.title}`;
        btnRemClearHymn.hidden = false;
      }
      const info = selectedHymn.audioInfo || {};
      hymnBadgeCantado.classList.toggle('ready', Boolean(info.hasLocalCantado || info.onlineCantadoUrl));
      hymnBadgeInstr.classList.toggle('ready', Boolean(info.hasLocalInstrumental || info.onlineInstrumentalUrl));
      renderHymnSlides();
    } catch {}
  }

  function renderHymnSlides() {
    remHymnSlidesList.innerHTML = '';
    const h =
      liveHymnState && liveHymnState.active && liveHymnState.hymn
        ? liveHymnState.hymn
        : selectedHymn;
    if (!h || !Array.isArray(h.slides)) return;

    remHymnPreviewHeader.textContent = `📜 #${h.number} — ${h.title}`;
    h.slides.forEach((sl, idx) => {
      const card = document.createElement('div');
      const isCurrent =
        liveHymnState &&
        liveHymnState.active &&
        liveHymnState.hymn &&
        liveHymnState.hymn.number === h.number &&
        liveHymnState.currentSlideIndex === idx;
      card.className = `hymn-slide-card${isCurrent ? ' active' : ''}`;
      card.innerHTML = `
        <span class="slide-card-tag">${sl.label || (idx === 0 ? 'Título' : `Diapositiva ${idx}`)}</span>
        <div class="slide-card-text">${sl.text || ''}</div>
      `;
      card.addEventListener('click', () => {
        vibrateTap(25);
        if (
          liveHymnState &&
          liveHymnState.active &&
          liveHymnState.hymn &&
          liveHymnState.hymn.number === h.number
        ) {
          socket.emit('project:slide', { index: idx });
        } else {
          socket.emit('project:start', {
            number: h.number,
            audioMode: hymnAudioMode,
            advanceMode: hymnAdvanceMode,
            startSlideIndex: idx,
          });
        }
      });
      remHymnSlidesList.appendChild(card);
    });
  }

  remHymnNum.addEventListener('change', () => {
    selectHymn(remHymnNum.value, true);
  });

  remHymnSearch.addEventListener('input', () => {
    const q = normalizeText(remHymnSearch.value);
    btnRemClearHymn.hidden = !q;
    if (!q) {
      remHymnAutocomplete.hidden = true;
      return;
    }
    const matches = allHymns
      .filter(
        (h) =>
          String(h.number).startsWith(q) ||
          normalizeText(h.title).includes(q)
      )
      .slice(0, 12);

    remHymnAutocomplete.innerHTML = '';
    if (matches.length === 0) {
      remHymnAutocomplete.hidden = true;
      return;
    }
    matches.forEach((m) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>#${m.number}</strong> <span>${m.title}</span>`;
      li.addEventListener('click', () => {
        remHymnAutocomplete.hidden = true;
        selectHymn(m.number, true);
      });
      remHymnAutocomplete.appendChild(li);
    });
    remHymnAutocomplete.hidden = false;
  });

  btnRemClearHymn.addEventListener('click', () => {
    remHymnSearch.value = '';
    btnRemClearHymn.hidden = true;
    remHymnAutocomplete.hidden = true;
    remHymnSearch.focus();
  });

  remAudioModeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      hymnAudioMode = btn.dataset.mode;
      remAudioModeBtns.forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  remAdvanceModeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      hymnAdvanceMode = btn.dataset.advance;
      remAdvanceModeBtns.forEach((b) => b.classList.toggle('active', b === btn));
      socket.emit('project:advance-mode', { advanceMode: hymnAdvanceMode });
    });
  });

  btnRemHymnProject.addEventListener('click', () => {
    if (!selectedHymn) return;
    vibrateTap(35);
    socket.emit('project:start', {
      number: selectedHymn.number,
      audioMode: hymnAudioMode,
      advanceMode: hymnAdvanceMode,
      startSlideIndex: 0,
    });
  });

  btnRemHymnPause.addEventListener('click', () => {
    vibrateTap(25);
    socket.emit('project:toggle-play');
  });

  btnRemHymnStop.addEventListener('click', () => {
    vibrateTap(35);
    socket.emit('project:stop');
  });

  btnRemPrevSlide.addEventListener('click', () => {
    vibrateTap(20);
    socket.emit('project:slide', { direction: 'prev' });
  });

  btnRemNextSlide.addEventListener('click', () => {
    vibrateTap(20);
    socket.emit('project:slide', { direction: 'next' });
  });

  remHymnSeekRange.addEventListener('change', () => {
    socket.emit('audio:seek', { time: Number(remHymnSeekRange.value) });
  });

  socket.on('state:update', (st) => {
    liveHymnState = st;
    const isAct = Boolean(st && st.active && st.hymn);
    btnRemHymnPause.disabled = !isAct;
    btnRemHymnStop.disabled = !isAct;
    btnRemPrevSlide.disabled = !isAct;
    btnRemNextSlide.disabled = !isAct;
    remHymnProgressBox.hidden = !isAct;

    if (isAct) {
      btnRemHymnPause.textContent = st.isPlaying ? '⏸ Pausa' : '▶ Reanudar';
      remHymnActiveTitle.textContent = `#${st.hymn.number} ${st.hymn.title}`;
    }
    updateActiveProjectionBadge();
    renderHymnSlides();
  });

  socket.on('audio:progress', (prog = {}) => {
    if (!liveHymnState || !liveHymnState.active) return;
    remHymnTimeCurrent.textContent = formatSec(prog.currentTime);
    remHymnTimeTotal.textContent = formatSec(prog.duration);
    if (prog.duration > 0) {
      remHymnSeekRange.max = String(prog.duration);
      remHymnSeekRange.value = String(prog.currentTime || 0);
    }
  });

  // =========================================================
  // 6. SANTA BIBLIA (RVR1960 / DHH)
  // =========================================================
  const remBibleTag = document.getElementById('remBibleTag');
  const remBibleVersionBtns = document.querySelectorAll('#remBibleVersionGroup .seg-btn');
  const remBibleSceneBtns = document.querySelectorAll('#remBibleSceneGroup .seg-btn');
  const remBibleSearch = document.getElementById('remBibleSearch');
  const btnRemClearBible = document.getElementById('btnRemClearBible');
  const remBibleAutocomplete = document.getElementById('remBibleAutocomplete');
  const remBibleBookSelect = document.getElementById('remBibleBookSelect');
  const remBibleChapterSelect = document.getElementById('remBibleChapterSelect');
  const btnRemBibleProject = document.getElementById('btnRemBibleProject');
  const btnRemBibleStop = document.getElementById('btnRemBibleStop');
  const btnRemPrevVerse = document.getElementById('btnRemPrevVerse');
  const btnRemNextVerse = document.getElementById('btnRemNextVerse');
  const remBibleVersesList = document.getElementById('remBibleVersesList');

  let bibleBooks = [];
  let bibleVersion = 'RVR1960';
  let bibleSceneMode = 'fondo';
  let currentChapterData = null;
  let selectedVerse = 1;
  let liveBibleState = null;

  async function loadBibleBooks() {
    try {
      const res = await fetch('/api/biblia/libros');
      bibleBooks = await res.json();
      remBibleBookSelect.innerHTML = '';
      bibleBooks.forEach((b) => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        remBibleBookSelect.appendChild(opt);
      });
      await loadBibleChapter('GEN', 1, 1, false);
    } catch (err) {
      console.error('Error cargando libros de la Biblia:', err);
    }
  }

  function populateChapterSelect(totalChapters, activeChapter) {
    remBibleChapterSelect.innerHTML = '';
    for (let c = 1; c <= totalChapters; c++) {
      const opt = document.createElement('option');
      opt.value = String(c);
      opt.textContent = `Cap. ${c}`;
      if (c === Number(activeChapter)) opt.selected = true;
      remBibleChapterSelect.appendChild(opt);
    }
  }

  async function loadBibleChapter(bookId, chapter, verse = 1, autoProject = false) {
    try {
      const res = await fetch(`/api/biblia/${bibleVersion}/${bookId}/${chapter}`);
      if (!res.ok) return;
      currentChapterData = await res.json();
      selectedVerse = Number(verse) || 1;
      remBibleBookSelect.value = currentChapterData.bookId;
      populateChapterSelect(currentChapterData.totalChapters, currentChapterData.chapter);
      remBibleTag.textContent = `${currentChapterData.bookName} ${currentChapterData.chapter}:${selectedVerse} (${currentChapterData.version})`;
      renderBibleVerses();
      if (autoProject) {
        projectCurrentBibleVerse();
      }
    } catch {}
  }

  function projectCurrentBibleVerse() {
    if (!currentChapterData) return;
    vibrateTap(30);
    socket.emit('bible:project', {
      version: bibleVersion,
      bookId: currentChapterData.bookId,
      chapter: currentChapterData.chapter,
      verse: selectedVerse,
      sceneMode: bibleSceneMode,
    });
  }

  function renderBibleVerses() {
    remBibleVersesList.innerHTML = '';
    if (!currentChapterData || !Array.isArray(currentChapterData.verses)) return;

    currentChapterData.verses.forEach((vObj) => {
      const li = document.createElement('li');
      const isSelected = Number(vObj.v) === Number(selectedVerse);
      li.className = `bible-verse-card${isSelected ? ' active' : ''}`;
      li.innerHTML = `
        <span class="slide-card-tag">${currentChapterData.bookName} ${currentChapterData.chapter}:${vObj.label || vObj.v}</span>
        <div class="slide-card-text">${vObj.text}</div>
      `;
      li.addEventListener('click', () => {
        selectedVerse = vObj.v;
        remBibleTag.textContent = `${currentChapterData.bookName} ${currentChapterData.chapter}:${selectedVerse} (${currentChapterData.version})`;
        renderBibleVerses();
        projectCurrentBibleVerse();
      });
      remBibleVersesList.appendChild(li);
    });
  }

  remBibleBookSelect.addEventListener('change', () => {
    loadBibleChapter(remBibleBookSelect.value, 1, 1, false);
  });

  remBibleChapterSelect.addEventListener('change', () => {
    loadBibleChapter(remBibleBookSelect.value, Number(remBibleChapterSelect.value) || 1, 1, false);
  });

  remBibleVersionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      bibleVersion = btn.dataset.version;
      remBibleVersionBtns.forEach((b) => b.classList.toggle('active', b === btn));
      if (currentChapterData) {
        loadBibleChapter(
          currentChapterData.bookId,
          currentChapterData.chapter,
          selectedVerse,
          Boolean(liveBibleState && liveBibleState.active)
        );
      }
    });
  });

  remBibleSceneBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      bibleSceneMode = btn.dataset.scene;
      remBibleSceneBtns.forEach((b) => b.classList.toggle('active', b === btn));
      socket.emit('bible:scene-mode', { sceneMode: bibleSceneMode });
    });
  });

  // Buscador inteligente de citas bíblicas (ej. "Juan 3:16", "Exodo 20 8")
  remBibleSearch.addEventListener('input', () => {
    const raw = remBibleSearch.value.trim();
    btnRemClearBible.hidden = !raw;
    if (!raw) {
      remBibleAutocomplete.hidden = true;
      return;
    }

    const clean = normalizeText(raw);
    const refRegex = /^([1-3]?\s*[a-z\s]+?)\s*(\d+)?(?:[:.\s]+(\d+))?$/i;
    const match = clean.match(refRegex);
    if (!match) {
      remBibleAutocomplete.hidden = true;
      return;
    }

    const bookQuery = (match[1] || '').trim();
    const chapNum = Number(match[2]) || 1;
    const verseNum = Number(match[3]) || 1;

    const matchedBooks = bibleBooks
      .filter((b) => {
        const bName = normalizeText(b.name);
        return (
          bName.startsWith(bookQuery) ||
          bName.includes(bookQuery) ||
          (b.aliases || []).some((al) => normalizeText(al).startsWith(bookQuery))
        );
      })
      .slice(0, 8);

    remBibleAutocomplete.innerHTML = '';
    if (matchedBooks.length === 0) {
      remBibleAutocomplete.hidden = true;
      return;
    }

    matchedBooks.forEach((b) => {
      const safeChap = Math.min(b.chaptersCount, Math.max(1, chapNum));
      const li = document.createElement('li');
      li.innerHTML = `<strong>${b.name} ${safeChap}:${verseNum}</strong> <span>Ir y proyectar</span>`;
      li.addEventListener('click', () => {
        remBibleAutocomplete.hidden = true;
        remBibleSearch.value = `${b.name} ${safeChap}:${verseNum}`;
        loadBibleChapter(b.id, safeChap, verseNum, true);
      });
      remBibleAutocomplete.appendChild(li);
    });
    remBibleAutocomplete.hidden = false;
  });

  btnRemClearBible.addEventListener('click', () => {
    remBibleSearch.value = '';
    btnRemClearBible.hidden = true;
    remBibleAutocomplete.hidden = true;
    remBibleSearch.focus();
  });

  btnRemBibleProject.addEventListener('click', () => {
    projectCurrentBibleVerse();
  });

  btnRemBibleStop.addEventListener('click', () => {
    vibrateTap(30);
    socket.emit('bible:stop');
  });

  btnRemPrevVerse.addEventListener('click', () => {
    if (!currentChapterData) return;
    if (selectedVerse > 1) {
      selectedVerse -= 1;
      renderBibleVerses();
      projectCurrentBibleVerse();
    }
  });

  btnRemNextVerse.addEventListener('click', () => {
    if (!currentChapterData) return;
    const maxV = currentChapterData.verses.length;
    if (selectedVerse < maxV) {
      selectedVerse += 1;
      renderBibleVerses();
      projectCurrentBibleVerse();
    }
  });

  socket.on('bible:update', (bState) => {
    liveBibleState = bState;
    btnRemBibleStop.disabled = !Boolean(bState && bState.active);
    updateActiveProjectionBadge();
  });

  function updateActiveProjectionBadge() {
    if (liveHymnState && liveHymnState.active && liveHymnState.hymn) {
      badgeActiveProjection.hidden = false;
      badgeActiveProjection.textContent = `🎵 Himno #${liveHymnState.hymn.number}`;
    } else if (liveBibleState && liveBibleState.active) {
      badgeActiveProjection.hidden = false;
      badgeActiveProjection.textContent = `📖 ${liveBibleState.bookName} ${liveBibleState.chapter}:${liveBibleState.verseLabel}`;
    } else {
      badgeActiveProjection.hidden = true;
    }
  }

  // =========================================================
  // 7. MODALES DE CÓDIGO QR, ASISTENTE DE ESCRITORIO Y CONFIGURACIÓN OBS
  // =========================================================
  const desktopHubBanner = document.getElementById('desktopHubBanner');
  const btnHideDesktopHub = document.getElementById('btnHideDesktopHub');
  const hubQrImg = document.getElementById('hubQrImg');
  const hubMobileUrlText = document.getElementById('hubMobileUrlText');
  const btnHubCopyMobileUrl = document.getElementById('btnHubCopyMobileUrl');
  const btnHubOpenSettings = document.getElementById('btnHubOpenSettings');
  const btnHubOpenMp3 = document.getElementById('btnHubOpenMp3');
  const hubObsLinkButtons = document.querySelectorAll('[data-copy-path]');

  const qrModal = document.getElementById('qrModal');
  const btnOpenQrModal = document.getElementById('btnOpenQrModal');
  const btnCloseQrModal = document.getElementById('btnCloseQrModal');
  const qrImage = document.getElementById('qrImage');
  const qrUrlText = document.getElementById('qrUrlText');
  const btnCopyQrUrl = document.getElementById('btnCopyQrUrl');
  const btnQrToSettings = document.getElementById('btnQrToSettings');
  const btnQrDone = document.getElementById('btnQrDone');

  const configModal = document.getElementById('configModal');
  const btnOpenConfigModal = document.getElementById('btnOpenConfigModal');
  const btnObsConfig = document.getElementById('btnObsConfig');
  const btnCloseConfigModal = document.getElementById('btnCloseConfigModal');
  const obsConfigForm = document.getElementById('obsConfigForm');
  const obsUrlInput = document.getElementById('obsUrlInput');
  const obsPassInput = document.getElementById('obsPassInput');
  const obsSceneInput = document.getElementById('obsSceneInput');
  const obsBibleBgInput = document.getElementById('obsBibleBgInput');
  const obsBibleCamInput = document.getElementById('obsBibleCamInput');
  const obsSoloLetraSecInput = document.getElementById('obsSoloLetraSecInput');
  const obsAudioRootInput = document.getElementById('obsAudioRootInput');
  const btnOpenAudioFolder = document.getElementById('btnOpenAudioFolder');

  let cachedNetworkInfo = null;

  async function fetchNetworkInfo() {
    try {
      const res = await fetch('/api/network-info');
      cachedNetworkInfo = await res.json();
      if (cachedNetworkInfo.qrDataUrl) {
        qrImage.src = cachedNetworkInfo.qrDataUrl;
        if (hubQrImg) hubQrImg.src = cachedNetworkInfo.qrDataUrl;
      }
      if (cachedNetworkInfo.mobileUrl) {
        qrUrlText.textContent = cachedNetworkInfo.mobileUrl;
        if (hubMobileUrlText) hubMobileUrlText.textContent = cachedNetworkInfo.mobileUrl;
      }
      return cachedNetworkInfo;
    } catch {
      return null;
    }
  }

  async function openQrDialog() {
    qrModal.hidden = false;
    await fetchNetworkInfo();
  }

  btnOpenQrModal.addEventListener('click', openQrDialog);
  btnCloseQrModal.addEventListener('click', () => {
    qrModal.hidden = true;
  });
  if (btnQrDone) {
    btnQrDone.addEventListener('click', () => {
      qrModal.hidden = true;
    });
  }
  if (btnQrToSettings) {
    btnQrToSettings.addEventListener('click', () => {
      qrModal.hidden = true;
      configModal.hidden = false;
    });
  }

  btnCopyQrUrl.addEventListener('click', () => {
    navigator.clipboard?.writeText(qrUrlText.textContent || '');
    btnCopyQrUrl.textContent = '✅ Copiado';
    setTimeout(() => {
      btnCopyQrUrl.textContent = '📋 Copiar';
    }, 1800);
  });

  function openConfigDialog() {
    configModal.hidden = false;
  }

  btnOpenConfigModal.addEventListener('click', openConfigDialog);
  btnObsConfig.addEventListener('click', openConfigDialog);
  btnCloseConfigModal.addEventListener('click', () => {
    configModal.hidden = true;
  });

  // Configurar Asistente de Cabina en PC/Mac (cuando se abre desde el Acceso Directo del Escritorio o localhost)
  const urlParams = new URLSearchParams(window.location.search);
  const isLocalPC =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    urlParams.get('desktop') === '1';

  if (isLocalPC && desktopHubBanner) {
    desktopHubBanner.hidden = false;
    fetchNetworkInfo();
  }
  if (urlParams.get('qr') === '1') {
    openQrDialog();
  }
  if (urlParams.get('config') === '1') {
    openConfigDialog();
  }

  if (btnHideDesktopHub) {
    btnHideDesktopHub.addEventListener('click', () => {
      desktopHubBanner.hidden = true;
    });
  }

  if (btnHubCopyMobileUrl) {
    btnHubCopyMobileUrl.addEventListener('click', () => {
      navigator.clipboard?.writeText(hubMobileUrlText.textContent || '');
      btnHubCopyMobileUrl.textContent = '✅ Copiado';
      setTimeout(() => {
        btnHubCopyMobileUrl.textContent = '📋 Copiar';
      }, 1800);
    });
  }

  if (btnHubOpenSettings) {
    btnHubOpenSettings.addEventListener('click', openConfigDialog);
  }

  if (btnHubOpenMp3) {
    btnHubOpenMp3.addEventListener('click', async () => {
      await fetch('/api/audio/open-folder', { method: 'POST' });
    });
  }

  hubObsLinkButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const port = (cachedNetworkInfo && cachedNetworkInfo.port) || window.location.port || 3000;
      const fullUrl = `http://localhost:${port}${btn.dataset.copyPath}`;
      navigator.clipboard?.writeText(fullUrl);
      const originalText = btn.textContent;
      btn.textContent = '✅ URL Copiada';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 1800);
    });
  });

  btnOpenAudioFolder.addEventListener('click', async () => {
    await fetch('/api/audio/open-folder', { method: 'POST' });
  });

  const btnHubQuitApp = document.getElementById('btnHubQuitApp');
  const btnQuitAppFromModal = document.getElementById('btnQuitAppFromModal');
  const btnResetFactoryConfig = document.getElementById('btnResetFactoryConfig');

  async function requestFullShutdown() {
    const confirmClose = window.confirm(
      '¿Deseas cerrar el programa y detener el servidor en segundo plano por completo?\n\nHaz esto antes de actualizar, reinstalar o desinstalar la aplicación para evitar archivos en uso.'
    );
    if (!confirmClose) return;
    try {
      await fetch('/api/app/quit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disableAutoStart: false }),
      });
      document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;background:#090d16;color:#f1f5f9;font-family:sans-serif">
          <div style="font-size:3rem;margin-bottom:12px">✅</div>
          <h2 style="margin:0 0 8px">Programa cerrado por completo</h2>
          <p style="color:#94a3b8;max-width:460px;line-height:1.5">
            El servidor en segundo plano se ha detenido limpiamente. Ahora puedes instalar una actualización, reinstalar o desinstalar el programa sin ningún bloqueo.
          </p>
        </div>
      `;
    } catch {}
  }

  if (btnHubQuitApp) {
    btnHubQuitApp.addEventListener('click', requestFullShutdown);
  }
  if (btnQuitAppFromModal) {
    btnQuitAppFromModal.addEventListener('click', requestFullShutdown);
  }

  if (btnResetFactoryConfig) {
    btnResetFactoryConfig.addEventListener('click', async () => {
      if (
        !window.confirm(
          '¿Restaurar todos los ajustes de conexión, nombres de escenas y atajos a los valores originales de fábrica? (Tus archivos MP3 no se borrarán).'
        )
      ) {
        return;
      }
      try {
        const res = await fetch('/api/app/reset-config', { method: 'POST' });
        const data = await res.json();
        if (data && data.config) {
          obsUrlInput.value = data.config.url || 'ws://127.0.0.1:4455';
          obsPassInput.value = '';
          obsSceneInput.value = data.config.sceneName || 'Himnario';
          obsBibleBgInput.value = data.config.bibleBgSceneName || 'Biblia';
          obsBibleCamInput.value = data.config.bibleCamSceneName || 'Biblia Camara';
          obsSoloLetraSecInput.value = data.config.soloLetraIntervalSec || 12;
          obsAudioRootInput.value = data.config.audioRootDir || '';
        }
        window.alert('✅ Ajustes restaurados de fábrica correctamente.');
      } catch {}
    });
  }

  obsConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/obs/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: obsUrlInput.value,
          password: obsPassInput.value,
          sceneName: obsSceneInput.value,
          bibleBgSceneName: obsBibleBgInput.value,
          bibleCamSceneName: obsBibleCamInput.value,
          soloLetraIntervalSec: Number(obsSoloLetraSecInput.value) || 12,
          audioRootDir: obsAudioRootInput.value,
        }),
      });
      configModal.hidden = true;
    } catch {}
  });

  // Inicializar datos al cargar la página
  loadHymnsIndex();
  loadBibleBooks();
})();
