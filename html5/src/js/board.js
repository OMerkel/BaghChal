// Copyright (c) 2016,2026 Oliver Merkel. All rights reserved.
// @author Oliver Merkel, <Merkel(dot)Oliver(at)web(dot)de>
// SPDX-License-Identifier: MIT

import { actionToKey, COLUMNS, EMPTY, NORTH, ROWS, SOUTH, VARIANTS } from './common.js';
import { TERMINAL_STATE_SCORE } from './config.js';

const DIRS_4 = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const DIRS_8 = [...DIRS_4, [-1, -1], [-1, 1], [1, -1], [1, 1]];

const inBounds = (row, col) => row >= 0 && row < ROWS && col >= 0 && col < COLUMNS;
const cloneGrid = grid => grid.map(line => [...line]);
const createGrid = () => Array.from({ length: ROWS }, () => Array(COLUMNS).fill(EMPTY));

const neighborsFor = (row, col) => {
  const dirs = (row + col) % 2 === 0 ? DIRS_8 : DIRS_4;
  return dirs
    .map(([dr, dc]) => ({ row: row + dr, column: col + dc, dr, dc }))
    .filter(next => inBounds(next.row, next.column));
};

const initialGrid = () => {
  const grid = createGrid();
  grid[0][0] = NORTH;
  grid[0][COLUMNS - 1] = NORTH;
  grid[ROWS - 1][0] = NORTH;
  grid[ROWS - 1][COLUMNS - 1] = NORTH;
  return grid;
};

const actionFromPlacement = (row, col) => ({
  from: { row, column: col },
  to: { row, column: col },
  type: 'place',
});

const movementAction = (from, to, dr, dc) => ({
  from: { ...from },
  to: { ...to },
  type: 'move',
  direction: { dr, dc },
});

const captureAction = (from, over, to, dr, dc) => ({
  from: { ...from },
  to: { ...to },
  type: 'capture',
  captures: [{ ...over }],
  direction: { dr, dc },
});

const uniqueActions = actions => {
  const map = new Map();
  actions.forEach(action => {
    map.set(actionToKey(action), action);
  });
  return [...map.values()];
};

const placementActions = grid => {
  const actions = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      if (grid[row][col] !== EMPTY) continue;
      actions.push(actionFromPlacement(row, col));
    }
  }
  return actions;
};

const goatMoveActions = (grid, row, col) => {
  const actions = [];
  for (const n of neighborsFor(row, col)) {
    if (grid[n.row][n.column] !== EMPTY) continue;
    actions.push(
      movementAction({ row, column: col }, { row: n.row, column: n.column }, n.dr, n.dc)
    );
  }
  return actions;
};

const tigerActionsForPiece = (grid, row, col) => {
  const captures = [];
  const moves = [];

  for (const n of neighborsFor(row, col)) {
    if (grid[n.row][n.column] === EMPTY) {
      moves.push(
        movementAction({ row, column: col }, { row: n.row, column: n.column }, n.dr, n.dc)
      );
      continue;
    }

    // Tiger captures by jumping over an adjacent goat into an empty landing point.
    if (grid[n.row][n.column] !== SOUTH) continue;
    const jumpRow = n.row + n.dr;
    const jumpCol = n.column + n.dc;
    if (!inBounds(jumpRow, jumpCol)) continue;
    if (grid[jumpRow][jumpCol] !== EMPTY) continue;

    captures.push(
      captureAction(
        { row, column: col },
        { row: n.row, column: n.column },
        { row: jumpRow, column: jumpCol },
        n.dr,
        n.dc
      )
    );
  }

  return { captures, moves };
};

const legalActionsForPlayer = (state, player) => {
  const { grid } = state;

  // Goat placement phase.
  if (player === 0 && state.goatsToPlace > 0) {
    return placementActions(grid);
  }

  if (player === 0) {
    const goatMoves = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        if (grid[row][col] !== SOUTH) continue;
        goatMoves.push(...goatMoveActions(grid, row, col));
      }
    }
    return uniqueActions(goatMoves);
  }

  const tigerCaptures = [];
  const tigerMoves = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      if (grid[row][col] !== NORTH) continue;
      const { captures, moves } = tigerActionsForPiece(grid, row, col);
      tigerCaptures.push(...captures);
      tigerMoves.push(...moves);
    }
  }

  // Tiger captures are mandatory.
  if (tigerCaptures.length > 0) return uniqueActions(tigerCaptures);
  return uniqueActions(tigerMoves);
};

const findAction = (actions, action) => {
  const wanted = actionToKey(action);
  return actions.find(candidate => actionToKey(candidate) === wanted) ?? null;
};

const applyActionToGrid = (grid, action, activePlayer) => {
  const next = cloneGrid(grid);

  if (action.type === 'place') {
    next[action.to.row][action.to.column] = activePlayer === 0 ? SOUTH : NORTH;
    return next;
  }

  const piece = next[action.from.row][action.from.column];
  next[action.from.row][action.from.column] = EMPTY;
  next[action.to.row][action.to.column] = piece;

  if (action.type === 'capture' && Array.isArray(action.captures)) {
    for (const captured of action.captures) {
      next[captured.row][captured.column] = EMPTY;
    }
  }

  return next;
};

const tigerNoMoves = state => legalActionsForPlayer(state, 1).length === 0;
const goatNoMoves = state => legalActionsForPlayer(state, 0).length === 0;

const finalizeTurn = (state, nextActive) => ({ ...state, active: nextActive });

const clamp01 = value => Math.max(0.001, Math.min(0.999, value));

const countGoatsOnBoard = grid => {
  let goats = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      if (grid[row][col] === SOUTH) goats++;
    }
  }
  return goats;
};

const nonTerminalResult = board => {
  const tigerActions = legalActionsForPlayer(board, 1);
  const tigerCaptures = tigerActions.filter(action => action.type === 'capture').length;
  const tigerMobility = tigerActions.length;

  const goatActions = legalActionsForPlayer(board, 0);
  const goatMobility = board.goatsToPlace > 0 ? 0 : goatActions.length;
  const goatsOnBoard = countGoatsOnBoard(board.grid);

  // Positive score favors goats; negative score favors tigers.
  const rawScore =
    -2.5 * board.goatsCaptured -
    2.2 * tigerCaptures -
    0.08 * tigerMobility +
    0.14 * goatMobility +
    0.10 * goatsOnBoard +
    0.08 * board.goatsToPlace;

  // Logistic squashing keeps values stable for MCTS backpropagation.
  const goatScore = clamp01(1 / (1 + Math.exp(-rawScore)));
  const tigerScore = clamp01(1 - goatScore);
  return [goatScore, tigerScore];
};

/**
 * Create a new board state initialized with Bagh Chal starting position.
 * @returns {BoardState} A new board state ready for play.
 */
export const createBoard = () => ({
  active: 0,
  grid: initialGrid(),
  winner: null,
  isDraw: false,
  latestMove: null,
  winningLine: null,
  variant: VARIANTS.BAGHCHAL,
  turnContext: null,
  goatsToPlace: 20,
  goatsCaptured: 0,
});

export const getActions = board => {
  if (board.winner !== null || board.isDraw) return [];
  return legalActionsForPlayer(board, board.active);
};

/**
 * Apply a move (action) to the board state.
 * Returns a new state with the move applied, or the original state if the action is illegal.
 * @param {BoardState} board - Current board state.
 * @param {Action} action - The move to apply.
 * @returns {BoardState} Updated board state after the move, or original if action is illegal.
 */
export const doAction = (board, action) => {
  const legal = findAction(getActions(board), action);
  if (!legal) return board;

  const mover = board.active;
  const nextGrid = applyActionToGrid(board.grid, legal, mover);
  const capturedByMove = legal.type === 'capture' ? legal.captures.length : 0;

  const nextState = {
    ...board,
    grid: nextGrid,
    latestMove: {
      from: { ...legal.from },
      to: { ...legal.to },
      player: mover,
      type: legal.type,
      capturedCount: capturedByMove,
    },
    goatsToPlace:
      mover === 0 && legal.type === 'place' ? board.goatsToPlace - 1 : board.goatsToPlace,
    goatsCaptured: board.goatsCaptured + capturedByMove,
    winningLine: null,
    turnContext: null,
    isDraw: false,
  };

  // Tiger wins by capturing at least five goats.
  if (nextState.goatsCaptured >= 5) {
    return { ...nextState, winner: 1, active: mover };
  }

  if (tigerNoMoves(nextState)) {
    return { ...nextState, winner: 0, active: mover, winningLine: null };
  }

  if (goatNoMoves(nextState)) {
    return { ...nextState, winner: 1, active: mover, winningLine: null };
  }

  return finalizeTurn(nextState, 1 - mover);
};

export const getResult = board => {
  if (board.winner === 0) return [1, 0];
  if (board.winner === 1) return [0, 1];
  if (board.isDraw) return [0.5, 0.5];
  const heuristic = nonTerminalResult(board);
  if (Number.isFinite(heuristic[0]) && Number.isFinite(heuristic[1])) return heuristic;
  return [TERMINAL_STATE_SCORE, TERMINAL_STATE_SCORE];
};

export class Board {
  constructor(state) {
    this._state = state ?? createBoard();
  }

  get active() {
    return this._state.active;
  }

  getActions() {
    return getActions(this._state);
  }
  getResult() {
    return getResult(this._state);
  }

  doAction(action) {
    this._state = doAction(this._state, action);
  }

  copy() {
    return new Board({
      ...this._state,
      grid: cloneGrid(this._state.grid),
      latestMove: this._state.latestMove
        ? {
            ...this._state.latestMove,
            from: { ...this._state.latestMove.from },
            to: { ...this._state.latestMove.to },
          }
        : null,
      winningLine: this._state.winningLine
        ? this._state.winningLine.map(cell => ({ ...cell }))
        : null,
      turnContext: null,
    });
  }

  getState() {
    return this._state;
  }
  setState(state) {
    this._state = state;
  }
}
