// Copyright (c) 2016,2026 Oliver Merkel. All rights reserved.
// @author Oliver Merkel, <Merkel(dot)Oliver(at)web(dot)de>
// SPDX-License-Identifier: MIT

import { Board, createBoard, doAction, getActions } from './board.js';
import { AI_BUDGETS } from './config.js';
import { Uct } from './uct/uct.js';

// ---------------------------------------------------------------------------
// Mutable controller state (single worker, no shared state)
// ---------------------------------------------------------------------------

const uct = new Uct();
let board = new Board();
let settings = {
  gameVariant: 'Bagh Chal',
  playerSouth: 'Human',
  playerNorth: 'Human',
  difficultySouth: 'Medium',
  difficultyNorth: 'Medium',
  deviceProfile: 'Auto',
  resolvedDeviceProfile: 'Desktop',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PLAYERS = Object.freeze({ Human: true, AI: true });
const VALID_DIFFICULTIES = Object.freeze({ Easy: true, Medium: true, Hard: true });
const VALID_PROFILES = Object.freeze({ Auto: true, Desktop: true, Mobile: true });
const VALID_VARIANTS = Object.freeze({ baghchal: true });

const isValidPlayer = p => p in VALID_PLAYERS;
const isValidDifficulty = d => d in VALID_DIFFICULTIES;
const isValidProfile = p => p in VALID_PROFILES;
const normalizeVariantKey = v =>
  typeof v === 'string' ? v.replace(/\s+/g, '').toLowerCase() : '';
const isValidVariant = v => normalizeVariantKey(v) in VALID_VARIANTS;

const applySettings = s => {
  const gv = s?.gamevariant ?? settings.gameVariant;
  const ps = s?.playersouth ?? settings.playerSouth;
  const pn = s?.playernorth ?? settings.playerNorth;
  const ds = s?.difficultysouth ?? settings.difficultySouth;
  const dn = s?.difficultynorth ?? settings.difficultyNorth;
  const dp = s?.deviceprofile ?? settings.deviceProfile;
  const rp = s?.resolveddeviceprofile ?? settings.resolvedDeviceProfile;

  if (
    !isValidVariant(gv) ||
    !isValidPlayer(ps) ||
    !isValidPlayer(pn) ||
    !isValidDifficulty(ds) ||
    !isValidDifficulty(dn) ||
    !isValidProfile(dp) ||
    !isValidProfile(rp)
  ) {
    console.warn('Invalid settings payload; ignoring:', s);
    return;
  }

  settings = {
    gameVariant: gv,
    playerSouth: ps,
    playerNorth: pn,
    difficultySouth: ds,
    difficultyNorth: dn,
    deviceProfile: dp,
    resolvedDeviceProfile: rp,
  };
};

const getBudget = (difficultySouth, difficultyNorth, activePlayer, deviceProfile, phase) => {
  const sideDifficulty = activePlayer === 0 ? difficultySouth : difficultyNorth;
  const normalizedDifficulty = (sideDifficulty || 'Medium').toLowerCase();
  const normalizedProfile = (deviceProfile || 'Desktop').toLowerCase();

  const profileTable = AI_BUDGETS[normalizedProfile] ?? AI_BUDGETS.desktop;
  const selected = profileTable[normalizedDifficulty] ?? profileTable.medium;
  return selected[phase];
};

const post = (request, extra = {}) =>
  self.postMessage({ eventClass: 'request', request, board: board.getState(), ...extra });

const isAiTurn = () =>
  (board.active === 0 && settings.playerSouth === 'AI') ||
  (board.active === 1 && settings.playerNorth === 'AI');

const postCurrentTurnIfNeeded = () => {
  const state = board.getState();
  if (state.winner !== null || state.isDraw) return;
  post(isAiTurn() ? 'ai_to_move' : 'human_to_move');
};

/**
 * Checks if current player has no legal moves and resolves as immediate loss.
 * Mutates board state if no legal moves exist.
 * @returns {boolean} true if no-move loss was resolved, false if moves remain
 */
const resolveNoMoveLossIfNeeded = () => {
  const state = board.getState();
  const legalActions = getActions(state);
  if (legalActions.length > 0) return false;

  board.setState({
    ...state,
    winner: 1 - state.active,
    isDraw: false,
    winningLine: null,
    active: state.active,
  });
  post('redraw');
  return true;
};

/**
 * Run UCT search and execute the selected AI move with deterministic fallback.
 * Mutates board state and posts redraw + turn events.
 * @param {string} phase - 'start' or 'turn' to select AI budget
 */
const runAiMoveWithFallback = phase => {
  const [maxIterations, maxTime, maxDepthSimulation, maxLookAhead] = getBudget(
    settings.difficultySouth,
    settings.difficultyNorth,
    board.active,
    settings.resolvedDeviceProfile,
    phase
  );

  const { action } = uct.getActionInfo(
    board,
    maxIterations,
    maxTime,
    maxDepthSimulation,
    maxLookAhead
  );
  if (action !== null) {
    move(action);
    return;
  }

  if (resolveNoMoveLossIfNeeded()) return;

  // Deterministic fallback in rare search-failure cases: play first legal action.
  const legalActions = getActions(board.getState());
  move(legalActions[0]);
};

// ---------------------------------------------------------------------------
// Execute a player move (human or AI)
// ---------------------------------------------------------------------------

/**
 * Execute move action: validate, mutate board state, and emit turn events.
 * Posts 'redraw' immediately; posts 'human_to_move' or 'ai_to_move' if game continues.
 * @param {Object} action - move action with from, to, type
 */
const move = action => {
  const current = board.getState();
  const next = doAction(current, action);
  const valid = next !== current;
  if (!valid) {
    post('redraw');
    postCurrentTurnIfNeeded();
    return;
  }

  board.setState(next);
  post('redraw');
  if (board.getState().winner !== null || board.getState().isDraw) return;
  if (isAiTurn()) {
    post('ai_to_move');
  } else {
    post('human_to_move');
  }
};

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.addEventListener('message', ({ data }) => {
  switch (data.request) {
    case 'start':
    case 'restart': {
      applySettings(data.settings);
      board = new Board(createBoard());
      post('redraw');
      if (isAiTurn()) {
        runAiMoveWithFallback('start');
      } else {
        post('human_to_move');
      }
      break;
    }

    case 'action_by_ai': {
      applySettings(data.settings);
      if (!isAiTurn()) {
        post('redraw');
        postCurrentTurnIfNeeded();
        break;
      }
      runAiMoveWithFallback('turn');
      break;
    }

    case 'move': {
      applySettings(data.settings);
      move(data.action);
      break;
    }

    case 'sync': {
      applySettings(data.settings);
      post('redraw');
      if (board.getState().winner !== null || board.getState().isDraw) break;
      if (isAiTurn()) {
        post('ai_to_move');
      } else {
        post('human_to_move');
      }
      break;
    }

    default:
      break;
  }
});
