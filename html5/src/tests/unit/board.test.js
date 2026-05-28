import { describe, expect, it } from 'vitest';
import { Board, createBoard, doAction, getActions, getResult } from '../../js/board.js';
import { COLUMNS, EMPTY, NORTH, ROWS, SOUTH, VARIANTS } from '../../js/common.js';

const makeEmptyGrid = () => Array.from({ length: ROWS }, () => Array(COLUMNS).fill(EMPTY));

const stateWith = patch => ({
  ...createBoard(),
  ...patch,
});

describe('createBoard', () => {
  it('creates a 5x5 board with four corner tigers and empty goat stock on board', () => {
    const board = createBoard();

    expect(board.grid).toHaveLength(5);
    board.grid.forEach(row => {
      expect(row).toHaveLength(5);
    });
    expect(board.variant).toBe(VARIANTS.BAGHCHAL);
    expect(board.active).toBe(0);
    expect(board.goatsToPlace).toBe(20);
    expect(board.goatsCaptured).toBe(0);

    expect(board.grid[0][0]).toBe(NORTH);
    expect(board.grid[0][4]).toBe(NORTH);
    expect(board.grid[4][0]).toBe(NORTH);
    expect(board.grid[4][4]).toBe(NORTH);
    expect(board.grid.flat().filter(v => v === SOUTH)).toHaveLength(0);
  });
});

describe('Bagh Chal actions', () => {
  it('returns only placement actions for goats while goatsToPlace > 0', () => {
    const board = createBoard();
    const actions = getActions(board);

    expect(actions).toHaveLength(21);
    expect(actions.every(a => a.type === 'place')).toBe(true);
  });

  it('applies a goat placement and hands turn to tiger', () => {
    const board = createBoard();
    const place = getActions(board).find(a => a.to.row === 2 && a.to.column === 2);
    const next = doAction(board, place);

    expect(next.grid[2][2]).toBe(SOUTH);
    expect(next.goatsToPlace).toBe(19);
    expect(next.active).toBe(1);
    expect(next.latestMove.type).toBe('place');
  });

  it('rejects illegal action payloads by returning the same object', () => {
    const board = createBoard();
    const illegal = {
      from: { row: 0, column: 0 },
      to: { row: 0, column: 1 },
      type: 'move',
    };
    const next = doAction(board, illegal);

    expect(next).toBe(board);
  });

  it('goats can move only after all goats are placed', () => {
    const grid = makeEmptyGrid();
    grid[0][0] = NORTH;
    grid[4][4] = NORTH;
    grid[0][4] = NORTH;
    grid[4][0] = NORTH;
    grid[2][2] = SOUTH;

    const board = stateWith({ grid, active: 0, goatsToPlace: 0 });
    const actions = getActions(board);

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every(a => a.type === 'move')).toBe(true);
    expect(actions.some(a => a.to.row === 1 && a.to.column === 1)).toBe(true);
  });

  it('enforces mandatory tiger capture when a jump exists', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = NORTH;
    grid[2][3] = SOUTH;

    const board = stateWith({ grid, active: 1, goatsToPlace: 0 });
    const actions = getActions(board);

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every(a => a.type === 'capture')).toBe(true);
    expect(actions[0].captures).toEqual([{ row: 2, column: 3 }]);
  });

  it('tiger capture removes jumped goat and increments goatsCaptured', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = NORTH;
    grid[2][3] = SOUTH;
    grid[0][0] = NORTH;

    const board = stateWith({ grid, active: 1, goatsToPlace: 0, goatsCaptured: 0 });
    const jump = getActions(board).find(a => a.to.row === 2 && a.to.column === 4);
    const next = doAction(board, jump);

    expect(next.grid[2][2]).toBe(EMPTY);
    expect(next.grid[2][3]).toBe(EMPTY);
    expect(next.grid[2][4]).toBe(NORTH);
    expect(next.goatsCaptured).toBe(1);
  });

  it('tiger wins immediately on fifth captured goat', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = NORTH;
    grid[2][3] = SOUTH;

    const board = stateWith({ grid, active: 1, goatsToPlace: 0, goatsCaptured: 4 });
    const jump = getActions(board).find(a => a.type === 'capture');
    const next = doAction(board, jump);

    expect(next.winner).toBe(1);
    expect(next.active).toBe(1);
  });

  it('goats win when all tigers are immobilized', () => {
    const grid = makeEmptyGrid();
    // Deterministic branch coverage: tiger side has no legal actions at all.
    grid[2][2] = SOUTH;

    const board = stateWith({
      grid,
      active: 0,
      goatsToPlace: 0,
      goatsCaptured: 0,
    });

    const move = getActions(board).find(a => a.type === 'move');
    const next = doAction(board, move);

    expect(next.winner).toBe(0);
  });

  it('tigers win when goats have no legal actions', () => {
    const grid = makeEmptyGrid();
    grid[0][0] = NORTH;
    grid[2][2] = NORTH;
    grid[0][4] = NORTH;
    grid[4][0] = NORTH;
    grid[4][4] = NORTH;

    // Single goat fully surrounded by tigers and no placements left.
    grid[1][1] = SOUTH;
    grid[0][1] = NORTH;
    grid[1][0] = NORTH;
    grid[1][2] = NORTH;
    grid[2][1] = NORTH;
    grid[2][0] = NORTH;

    const board = stateWith({ grid, active: 1, goatsToPlace: 0 });
    const tigerMove = getActions(board).find(a => a.type === 'move') ?? getActions(board)[0];
    const next = doAction(board, tigerMove);

    expect(next.winner).toBe(1);
  });

  it('returns no actions for terminal states', () => {
    expect(getActions({ ...createBoard(), winner: 0 })).toEqual([]);
    expect(getActions({ ...createBoard(), isDraw: true })).toEqual([]);
  });
});

describe('getResult and Board adapter', () => {
  it('returns winner vectors and non-terminal score', () => {
    expect(getResult({ ...createBoard(), winner: 0 })).toEqual([1, 0]);
    expect(getResult({ ...createBoard(), winner: 1 })).toEqual([0, 1]);
    expect(getResult({ ...createBoard(), isDraw: true })).toEqual([0.5, 0.5]);
    const nonTerminal = getResult(createBoard());
    expect(nonTerminal[0]).toBeGreaterThan(0);
    expect(nonTerminal[1]).toBeGreaterThan(0);
    expect(nonTerminal[0]).toBeLessThan(1);
    expect(nonTerminal[1]).toBeLessThan(1);
  });

  it('supports copy and simulation without mutating original', () => {
    const board = new Board();
    const copy = board.copy();
    const first = copy.getActions()[0];
    copy.doAction(first);

    expect(copy.getState()).not.toEqual(board.getState());
  });

  it('setState replaces internal state and active getter reflects it', () => {
    const board = new Board();
    board.setState({ ...createBoard(), winner: 1, active: 1 });

    expect(board.getState().winner).toBe(1);
    expect(board.active).toBe(1);
  });

  it('copy keeps nullable fields stable', () => {
    const board = new Board(createBoard());
    const copy = board.copy();

    expect(copy.getState().turnContext).toBeNull();
    expect(copy.getState().winningLine).toBeNull();
  });

  it('copy clones winningLine when present', () => {
    const board = new Board({
      ...createBoard(),
      winningLine: [
        { row: 0, column: 0 },
        { row: 1, column: 1 },
      ],
    });

    const copied = board.copy().getState();
    expect(copied.winningLine).toEqual([
      { row: 0, column: 0 },
      { row: 1, column: 1 },
    ]);
    expect(copied.winningLine).not.toBe(board.getState().winningLine);
  });
});
