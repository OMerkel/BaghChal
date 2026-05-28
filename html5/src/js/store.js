// Copyright (c) 2026 Oliver Merkel. All rights reserved.
// SPDX-License-Identifier: MIT
//
// Minimal reactive store inspired by the Redux pattern.
// State transitions are pure (reducer function); side-effects happen in
// subscribers.  The store is the single source of truth for the UI layer.

/**
 * Create a reactive store.
 *
 * @template S
 * @param {(state: S, action: Object) => S} reducer  - Pure state-transition function.
 * @param {S} initialState                           - Starting state.
 * @returns {{ getState, dispatch, subscribe }}
 */
export const createStore = (reducer, initialState) => {
  let state = initialState;
  const listeners = new Set();

  const getState = () => state;

  const dispatch = action => {
    state = reducer(state, action);
    listeners.forEach(fn => {
      fn(state, action);
    });
  };

  /** Subscribe to every state change.  Returns an unsubscribe function. */
  const subscribe = fn => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  return { getState, dispatch, subscribe };
};

// ---------------------------------------------------------------------------
// Action type constants
// ---------------------------------------------------------------------------

export const Actions = Object.freeze({
  NAVIGATE: 'NAVIGATE',
  ENGINE_BOARD_UPDATE: 'ENGINE_BOARD_UPDATE',
  HUMAN_TURN_READY: 'HUMAN_TURN_READY',
  SELECT_SOURCE: 'SELECT_SOURCE',
  AI_THINKING: 'AI_THINKING',
  SETTINGS_CHANGE: 'SETTINGS_CHANGE',
  NEW_GAME: 'NEW_GAME',
});

// ---------------------------------------------------------------------------
// Application reducer
// ---------------------------------------------------------------------------

/**
 * Initial application state.
 * `board` is the raw board-state plain-object received from the worker.
 */
export const initialAppState = {
  view: 'game', // 'game' | 'rules' | 'options' | 'about'
  board: null, // plain board state object (from worker messages)
  selectableActions: [], // legal actions received from engine
  selectedSource: null, // selected source cell while choosing move
  phase: 'idle', // 'idle' | 'human_turn' | 'ai_thinking'
  settings: {
    gameVariant: 'Bagh Chal',
    playerSouth: 'Human',
    playerNorth: 'Human',
    difficultySouth: 'Medium',
    difficultyNorth: 'Medium',
    deviceProfile: 'Auto',
    selectionMode: 'MustMove',
    resolvedDeviceProfile: 'Desktop',
    showBoardAnnotations: false,
  },
};

/**
 * Pure state-transition reducer for the application.
 * Processes actions and returns a new application state.
 * Called by the store's dispatch method.
 * @param {Object} state - Current application state.
 * @param {Object} action - Action object with a `type` property and optional payload.
 * @param {string} action.type - Action type (one of Actions enum values).
 * @returns {Object} New application state after the action is applied.
 */
export const appReducer = (state, action) => {
  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'production' &&
    !(action.type in Actions)
  ) {
    console.warn(`Unknown action type: ${action.type}. Valid types are:`, Object.keys(Actions));
  }
  switch (action.type) {
    case Actions.NAVIGATE:
      return { ...state, view: action.view };

    case Actions.ENGINE_BOARD_UPDATE:
      return {
        ...state,
        board: action.board,
        selectableActions: [],
        selectedSource: null,
        phase: 'idle',
      };

    case Actions.HUMAN_TURN_READY:
      return {
        ...state,
        board: action.board,
        selectableActions: action.selectableActions,
        selectedSource: null,
        phase: 'human_turn',
      };

    case Actions.SELECT_SOURCE:
      return { ...state, selectedSource: action.source };

    case Actions.AI_THINKING:
      return { ...state, selectedSource: null, phase: 'ai_thinking' };

    case Actions.SETTINGS_CHANGE:
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case Actions.NEW_GAME:
      return { ...state, phase: 'idle', selectableActions: [], selectedSource: null };

    default:
      return state;
  }
};
