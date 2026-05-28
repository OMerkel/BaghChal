//
// Copyright (c) 2016,2026 Oliver Merkel. All rights reserved.
// @author Oliver Merkel, <Merkel(dot)Oliver(at)web(dot)de>
// SPDX-License-Identifier: MIT
//
// Human-Machine Interface – main application entry point.
// Wires the reactive store, the SVG renderer, and the AI Web Worker together.
//

import { getActions } from './board.js';
import { AI_MOVE_PAUSE_MS, MOBILE_VIEWPORT_WIDTH_THRESHOLD } from './config.js';
import { createRenderer } from './renderer.js';
import { Actions, appReducer, createStore, initialAppState } from './store.js';

// ---------------------------------------------------------------------------
// Reactive store
// ---------------------------------------------------------------------------

const store = createStore(appReducer, initialAppState);

// ---------------------------------------------------------------------------
// Navigation helpers – show/hide named <section> elements
// ---------------------------------------------------------------------------

const sections = ['game', 'rules', 'options', 'about'];

const getGameTitle = settings => settings?.gameVariant ?? 'Bagh Chal';

const setHeaderTitle = (text, withSpinner = false) => {
  const titleEl = document.getElementById('app-header-title');
  if (!titleEl) return;
  if (!withSpinner) {
    titleEl.textContent = text;
    return;
  }

  titleEl.textContent = '';
  const wrapper = document.createElement('span');
  wrapper.className = 'header-title-content';
  const spinner = document.createElement('span');
  spinner.className = 'header-title-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = text;
  wrapper.append(label, spinner);
  titleEl.appendChild(wrapper);
};

const showView = (view, settings) => {
  sections.forEach(id => {
    const el = document.getElementById(`view-${id}`);
    if (el) el.hidden = id !== view;
  });
  setHeaderTitle(
    view === 'game' ? getGameTitle(settings) : view.charAt(0).toUpperCase() + view.slice(1)
  );
};

const updateDifficultyBadge = (
  playerSouth,
  playerNorth,
  difficultySouth,
  difficultyNorth,
  resolvedDeviceProfile
) => {
  const badge = document.getElementById('app-header-badge');
  if (!badge) return;
  const goats = (playerSouth ?? 'Human') === 'Human' ? 'human' : (difficultySouth ?? 'Medium');
  const tigers = (playerNorth ?? 'Human') === 'Human' ? 'human' : (difficultyNorth ?? 'Medium');
  const profile = resolvedDeviceProfile ?? 'Desktop';
  const variant = getGameTitle(store.getState().settings);
  badge.textContent = `${variant} | Goats ${goats} | Tigers ${tigers} | ${profile}`;
  badge.setAttribute(
    'aria-label',
    `${variant}, Goats ${goats}, Tigers ${tigers}, profile ${profile}`
  );
};

const detectAutoDeviceProfile = () => {
  const smallViewport = (window.innerWidth || 1200) <= MOBILE_VIEWPORT_WIDTH_THRESHOLD;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  return smallViewport || coarsePointer ? 'Mobile' : 'Desktop';
};

const updateAutoProfileHint = () => {
  const hint = document.getElementById('device-profile-hint');
  if (!hint) return;
  const resolved = detectAutoDeviceProfile();
  hint.textContent = `Auto currently resolves to ${resolved}.`;
};

// ---------------------------------------------------------------------------
// Settings read from the options form
// ---------------------------------------------------------------------------

const readSettings = () => ({
  gamevariant: 'Bagh Chal',
  playersouth: document.querySelector('input[name="firstplayer"]:checked')?.value ?? 'Human',
  playernorth: document.querySelector('input[name="secondplayer"]:checked')?.value ?? 'Human',
  difficultysouth:
    document.querySelector('input[name="difficultysouth"]:checked')?.value ?? 'Medium',
  difficultynorth:
    document.querySelector('input[name="difficultynorth"]:checked')?.value ?? 'Medium',
  deviceprofile: document.querySelector('input[name="deviceprofile"]:checked')?.value ?? 'Auto',
  selectionmode: document.querySelector('input[name="selectionmode"]:checked')?.value ?? 'MustMove',
  showboardannotations:
    document.querySelector('input[name="showboardannotations"]')?.checked ?? false,
  resolveddeviceprofile: (() => {
    const selected = document.querySelector('input[name="deviceprofile"]:checked')?.value ?? 'Auto';
    return selected === 'Auto' ? detectAutoDeviceProfile() : selected;
  })(),
});

// ---------------------------------------------------------------------------
// Worker bootstrap
// ---------------------------------------------------------------------------

const engine = new Worker('js/controller.js', { type: 'module' });

const sendToEngine = (request, extra = {}) => {
  try {
    engine.postMessage({ class: 'request', request, settings: readSettings(), ...extra });
  } catch (error) {
    console.error(`Worker message failed (${request}):`, error);
  }
};

engine.addEventListener('error', event => {
  console.error('Worker crashed:', event.message, event.filename, event.lineno);
});

let pendingAiTimerId = null;
let pendingHumanTurnTimerId = null;
let humanTurnGeneration = 0;

const cancelPendingAiTimer = () => {
  if (pendingAiTimerId !== null) {
    clearTimeout(pendingAiTimerId);
    pendingAiTimerId = null;
  }
};

const cancelPendingHumanTurnTimer = () => {
  if (pendingHumanTurnTimerId !== null) {
    clearTimeout(pendingHumanTurnTimerId);
    pendingHumanTurnTimerId = null;
  }
  humanTurnGeneration++;
};

const cancelPendingTurnTimers = () => {
  cancelPendingAiTimer();
  cancelPendingHumanTurnTimer();
};

const scheduleAiAction = delayMs => {
  cancelPendingAiTimer();
  pendingAiTimerId = setTimeout(() => {
    pendingAiTimerId = null;
    sendToEngine('action_by_ai');
  }, delayMs);
};

const wasAiMove = (board, settingsSnapshot) => {
  if (!board?.latestMove) return false;
  const { playerSouth, playerNorth } = settingsSnapshot;
  return board.latestMove.player === 0 ? playerSouth === 'AI' : playerNorth === 'AI';
};

// ---------------------------------------------------------------------------
// SVG renderer bootstrap
// ---------------------------------------------------------------------------

let renderer = null;
let pendingCaptureChoice = null;

const sameCell = (a, b) => Boolean(a && b && a.row === b.row && a.column === b.column);

const clearPendingCaptureChoice = () => {
  pendingCaptureChoice = null;
};

const handleCellClick = (row, column) => {
  if (store.getState().phase !== 'human_turn') return;

  const state = store.getState();
  const strictSelection = (state.settings.selectionMode ?? 'MustMove') === 'MustMove';

  if (pendingCaptureChoice) {
    const clickedMatches = pendingCaptureChoice.actions.filter(
      action =>
        Array.isArray(action.captures) &&
        action.captures.some(c => c.row === row && c.column === column)
    );

    if (clickedMatches.length === 1) {
      clearPendingCaptureChoice();
      sendToEngine('move', { action: clickedMatches[0] });
      return;
    }

    if (clickedMatches.length > 1) {
      const preferred = clickedMatches.find(a => a.captureMode === 'approach') ?? clickedMatches[0];
      clearPendingCaptureChoice();
      sendToEngine('move', { action: preferred });
      return;
    }

    if (
      state.selectedSource &&
      state.selectedSource.row === row &&
      state.selectedSource.column === column
    ) {
      clearPendingCaptureChoice();
      store.dispatch({ type: Actions.SELECT_SOURCE, source: state.selectedSource });
      return;
    }
  }

  const sourceActions = state.selectableActions.filter(
    action => action.from.row === row && action.from.column === column
  );

  if (!state.selectedSource) {
    if (sourceActions.length > 0) {
      clearPendingCaptureChoice();
      store.dispatch({ type: Actions.SELECT_SOURCE, source: { row, column } });
    }
    return;
  }

  const candidates = state.selectableActions.filter(
    action =>
      action.from.row === state.selectedSource.row &&
      action.from.column === state.selectedSource.column &&
      action.to.row === row &&
      action.to.column === column
  );

  if (candidates.length > 0) {
    if (candidates.length === 1) {
      sendToEngine('move', { action: candidates[0] });
      return;
    }

    const approach = candidates.find(
      action => action.type === 'capture' && action.captureMode === 'approach'
    );
    const withdrawal = candidates.find(
      action => action.type === 'capture' && action.captureMode === 'withdrawal'
    );

    if (approach && withdrawal) {
      pendingCaptureChoice = {
        source: { ...state.selectedSource },
        destination: { row, column },
        actions: [approach, withdrawal],
      };
      store.dispatch({ type: Actions.SELECT_SOURCE, source: state.selectedSource });
      return;
    }

    sendToEngine('move', { action: candidates[0] });
    return;
  }

  if (strictSelection) return;

  // Flexible mode: allow deselect and switching selected source.
  if (state.selectedSource.row === row && state.selectedSource.column === column) {
    clearPendingCaptureChoice();
    store.dispatch({ type: Actions.SELECT_SOURCE, source: null });
    return;
  }

  if (sourceActions.length > 0) {
    clearPendingCaptureChoice();
    store.dispatch({ type: Actions.SELECT_SOURCE, source: { row, column } });
  }
};

// ---------------------------------------------------------------------------
// Worker → store: translate engine messages to store actions
// ---------------------------------------------------------------------------

engine.addEventListener('message', ({ data }) => {
  const settingsSnapshot = store.getState().settings;
  switch (data.request) {
    case 'redraw': {
      // Always apply board updates immediately to preserve message order.
      store.dispatch({ type: Actions.ENGINE_BOARD_UPDATE, board: data.board });
      break;
    }

    case 'human_to_move': {
      cancelPendingAiTimer();
      cancelPendingHumanTurnTimer();
      const generation = humanTurnGeneration;
      const dispatchHumanTurn = () => {
        if (generation !== humanTurnGeneration) return;
        pendingHumanTurnTimerId = null;
        const selectableActions = data.board ? getActions(data.board) : [];
        store.dispatch({ type: Actions.HUMAN_TURN_READY, board: data.board, selectableActions });
      };

      if (wasAiMove(data.board, settingsSnapshot)) {
        pendingHumanTurnTimerId = setTimeout(dispatchHumanTurn, AI_MOVE_PAUSE_MS);
      } else {
        dispatchHumanTurn();
      }
      break;
    }

    case 'ai_to_move': {
      cancelPendingHumanTurnTimer();
      store.dispatch({ type: Actions.AI_THINKING });
      const delay = wasAiMove(data.board, settingsSnapshot) ? AI_MOVE_PAUSE_MS : 0;
      scheduleAiAction(delay);
      break;
    }

    default:
      break;
  }
});

// ---------------------------------------------------------------------------
// Store → renderer: re-render on every state change
// ---------------------------------------------------------------------------

store.subscribe(state => {
  if (
    pendingCaptureChoice &&
    (state.phase !== 'human_turn' ||
      !state.selectedSource ||
      !sameCell(state.selectedSource, pendingCaptureChoice.source))
  ) {
    clearPendingCaptureChoice();
  }

  showView(state.view, state.settings);
  updateDifficultyBadge(
    state.settings.playerSouth,
    state.settings.playerNorth,
    state.settings.difficultySouth,
    state.settings.difficultyNorth,
    state.settings.resolvedDeviceProfile
  );

  if (renderer && state.board) {
    const allowReselect = (state.settings.selectionMode ?? 'MustMove') === 'Flexible';
    const showAnnotations = state.settings.showBoardAnnotations ?? false;
    renderer.render(
      state.board,
      state.selectableActions,
      state.selectedSource,
      allowReselect,
      showAnnotations,
      pendingCaptureChoice?.actions ?? null
    );
  }

  // Reflect AI-thinking in the title bar.
  if (state.view === 'game' && state.phase === 'ai_thinking') {
    setHeaderTitle('AI thinking...', true);
  }
});

// ---------------------------------------------------------------------------
// Settings persistence with localStorage
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'baghchal_user_settings';

/**
 * Save current form state to localStorage.
 */
const saveSettingsToStorage = () => {
  try {
    const settings = {
      firstplayer: document.querySelector('input[name="firstplayer"]:checked')?.value ?? 'Human',
      secondplayer: document.querySelector('input[name="secondplayer"]:checked')?.value ?? 'Human',
      difficultysouth:
        document.querySelector('input[name="difficultysouth"]:checked')?.value ?? 'Medium',
      difficultynorth:
        document.querySelector('input[name="difficultynorth"]:checked')?.value ?? 'Medium',
      deviceprofile: document.querySelector('input[name="deviceprofile"]:checked')?.value ?? 'Auto',
      selectionmode:
        document.querySelector('input[name="selectionmode"]:checked')?.value ?? 'MustMove',
      showboardannotations:
        document.querySelector('input[name="showboardannotations"]')?.checked ?? false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
  }
};

/**
 * Restore form state from localStorage if available.
 */
const restoreSettingsFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const settings = JSON.parse(stored);
    if (settings.firstplayer) {
      const el = document.querySelector(
        `input[name="firstplayer"][value="${settings.firstplayer}"]`
      );
      if (el) el.checked = true;
    }
    if (settings.secondplayer) {
      const el = document.querySelector(
        `input[name="secondplayer"][value="${settings.secondplayer}"]`
      );
      if (el) el.checked = true;
    }
    if (settings.difficultysouth) {
      const el = document.querySelector(
        `input[name="difficultysouth"][value="${settings.difficultysouth}"]`
      );
      if (el) el.checked = true;
    }
    if (settings.difficultynorth) {
      const el = document.querySelector(
        `input[name="difficultynorth"][value="${settings.difficultynorth}"]`
      );
      if (el) el.checked = true;
    }
    if (settings.deviceprofile) {
      const el = document.querySelector(
        `input[name="deviceprofile"][value="${settings.deviceprofile}"]`
      );
      if (el) el.checked = true;
    }
    if (settings.selectionmode) {
      const el = document.querySelector(
        `input[name="selectionmode"][value="${settings.selectionmode}"]`
      );
      if (el) el.checked = true;
    }
    if (settings.showboardannotations) {
      const el = document.querySelector('input[name="showboardannotations"]');
      if (el) el.checked = true;
    }
    // Dispatch settings to store so annotation visibility is correct on load
    store.dispatch({
      type: Actions.SETTINGS_CHANGE,
      settings: {
        gameVariant: 'Bagh Chal',
        playerSouth: settings.firstplayer,
        playerNorth: settings.secondplayer,
        difficultySouth: settings.difficultysouth,
        difficultyNorth: settings.difficultynorth,
        deviceProfile: settings.deviceprofile,
        selectionMode: settings.selectionmode,
        resolvedDeviceProfile: settings.resolveddeviceprofile ?? 'Desktop',
        showBoardAnnotations: settings.showboardannotations ?? false,
      },
    });
  } catch (error) {
    console.warn('Failed to restore settings from localStorage:', error);
  }
};

// ---------------------------------------------------------------------------
// DOM event wiring (called once after DOMContentLoaded)
// ---------------------------------------------------------------------------

const wireUI = () => {
  // Restore persisted user settings from localStorage
  restoreSettingsFromStorage();

  // Renderer
  const boardContainer = document.getElementById('board');
  renderer = createRenderer(boardContainer, handleCellClick);

  // Menu panel toggle
  const panel = document.getElementById('side-panel');
  const menuBtn = document.getElementById('btn-menu');
  const closeBtn = document.getElementById('btn-panel-close');
  const overlay = document.getElementById('panel-overlay');

  const openPanel = () => {
    panel.classList.add('open');
    overlay.hidden = false;
  };
  const closePanel = () => {
    panel.classList.remove('open');
    overlay.hidden = true;
  };
  const applySettingsFromOptions = () => {
    cancelPendingTurnTimers();
    const s = readSettings();
    store.dispatch({
      type: Actions.SETTINGS_CHANGE,
      settings: {
        gameVariant: s.gamevariant,
        playerSouth: s.playersouth,
        playerNorth: s.playernorth,
        difficultySouth: s.difficultysouth,
        difficultyNorth: s.difficultynorth,
        deviceProfile: s.deviceprofile,
        selectionMode: s.selectionmode,
        resolvedDeviceProfile: s.resolveddeviceprofile,
        showBoardAnnotations: s.showboardannotations,
      },
    });
    sendToEngine('sync');
  };
  const closePanelAndReturnToGame = () => {
    closePanel();
    const currentView = store.getState().view;
    if (currentView === 'options') {
      applySettingsFromOptions();
      store.dispatch({ type: Actions.NAVIGATE, view: 'game' });
      return;
    }
    if (currentView === 'rules' || currentView === 'about') {
      store.dispatch({ type: Actions.NAVIGATE, view: 'game' });
    }
  };

  menuBtn?.addEventListener('click', openPanel);
  closeBtn?.addEventListener('click', closePanelAndReturnToGame);
  overlay?.addEventListener('click', closePanelAndReturnToGame);

  // Navigation links
  document.getElementById('nav-new')?.addEventListener('click', () => {
    cancelPendingTurnTimers();
    if (store.getState().view === 'options') {
      saveSettingsToStorage();
      applySettingsFromOptions();
    }
    closePanel();
    store.dispatch({ type: Actions.NAVIGATE, view: 'game' });
    store.dispatch({ type: Actions.NEW_GAME });
    sendToEngine('restart');
  });

  const navTo = view => () => {
    closePanel();
    store.dispatch({ type: Actions.NAVIGATE, view });
  };
  document.getElementById('nav-rules')?.addEventListener('click', navTo('rules'));
  document.getElementById('nav-options')?.addEventListener('click', () => {
    navTo('options')();
    updateAutoProfileHint();
  });
  document.getElementById('nav-about')?.addEventListener('click', navTo('about'));

  // Back buttons inside sub-views
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => store.dispatch({ type: Actions.NAVIGATE, view: 'game' }));
  });

  // Options "OK" – sync settings then dismiss
  document.getElementById('btn-options-ok')?.addEventListener('click', () => {
    saveSettingsToStorage();
    applySettingsFromOptions();
    store.dispatch({ type: Actions.NAVIGATE, view: 'game' });
  });

  // Save settings when any option changes
  document
    .querySelectorAll(
      'input[name="firstplayer"], input[name="secondplayer"], input[name="difficultysouth"], input[name="difficultynorth"], input[name="deviceprofile"], input[name="selectionmode"]'
    )
    .forEach(input => {
      input.addEventListener('change', () => {
        saveSettingsToStorage();
        if (input.name === 'deviceprofile') {
          updateAutoProfileHint();
        }
      });
    });

  // Board annotations checkbox – apply immediately and save
  document.querySelector('input[name="showboardannotations"]')?.addEventListener('change', e => {
    saveSettingsToStorage();
    store.dispatch({
      type: Actions.SETTINGS_CHANGE,
      settings: {
        showBoardAnnotations: e.target.checked,
      },
    });
  });

  let resizeHintTimer = null;
  window.addEventListener('resize', () => {
    if (resizeHintTimer !== null) {
      clearTimeout(resizeHintTimer);
    }
    updateAutoProfileHint();
    resizeHintTimer = setTimeout(() => {
      const currentSettings = readSettings();
      if (currentSettings.deviceprofile !== 'Auto') return;
      store.dispatch({
        type: Actions.SETTINGS_CHANGE,
        settings: {
          resolvedDeviceProfile: currentSettings.resolveddeviceprofile,
        },
      });
      sendToEngine('sync');
    }, 180);
  });

  const initialSettings = readSettings();
  store.dispatch({
    type: Actions.SETTINGS_CHANGE,
    settings: {
      gameVariant: initialSettings.gamevariant,
      playerSouth: initialSettings.playersouth,
      playerNorth: initialSettings.playernorth,
      difficultySouth: initialSettings.difficultysouth,
      difficultyNorth: initialSettings.difficultynorth,
      deviceProfile: initialSettings.deviceprofile,
      selectionMode: initialSettings.selectionmode,
      resolvedDeviceProfile: initialSettings.resolveddeviceprofile,
    },
  });

  updateAutoProfileHint();

  // Kick off a new game
  cancelPendingTurnTimers();
  sendToEngine('start');
};

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export { restoreSettingsFromStorage, saveSettingsToStorage };

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireUI);
} else {
  wireUI();
}
