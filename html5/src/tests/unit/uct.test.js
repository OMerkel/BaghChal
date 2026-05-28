import { describe, expect, it, vi } from 'vitest';
import { Board, createBoard } from '../../js/board.js';
import { Uct } from '../../js/uct/uct.js';
import { UctNode } from '../../js/uct/uctnode.js';

const makeAction = id => ({
  from: { row: id, column: 0 },
  to: { row: id, column: 1 },
  type: 'jump',
});

const boardStub = (actions, active = 0) => ({
  getActions: () => actions.map(a => ({ ...a, from: { ...a.from }, to: { ...a.to } })),
  active,
  copy: () => boardStub(actions, active),
  doAction: () => {},
  getResult: () => [0.01, 0.01],
});

describe('UctNode', () => {
  it('stores action and unexamined moves from board', () => {
    const actions = [makeAction(0), makeAction(1), makeAction(2)];
    const node = new UctNode(null, boardStub(actions), null);
    expect(node.unexamined).toHaveLength(3);
    expect(node.activePlayer).toBe(0);
  });

  it('mostVisitedChild returns null when there are no children', () => {
    const node = new UctNode(null, boardStub([makeAction(0)]), null);
    expect(node.mostVisitedChild()).toBeNull();
  });

  it('adds child and removes action from unexamined list', () => {
    const actions = [makeAction(2), makeAction(4), makeAction(6)];
    const node = new UctNode(null, boardStub(actions), null);
    const child = node.addChild(boardStub([], 1), 1);
    expect(child.action.from.row).toBe(4);
    expect(node.unexamined).toHaveLength(2);
  });

  it('selects child with highest UCB1 value', () => {
    const parent = new UctNode(null, boardStub([makeAction(0), makeAction(1)]), null);
    parent.visits = 10;

    const c0 = parent.addChild(boardStub([]), 0);
    c0.wins = 8;
    c0.visits = 10;

    const c1 = parent.addChild(boardStub([]), 0);
    c1.wins = 1;
    c1.visits = 1;

    expect(parent.selectChild()).toBe(c1);
  });
});

describe('Uct.getActionInfo', () => {
  const uct = new Uct();

  it('returns a legal action on an initial Bagh Chal board', () => {
    const board = new Board();
    const result = uct.getActionInfo(board, 1500, 200, 10, 20);
    expect(result.action).toBeTruthy();
    expect(board.getActions().length).toBeGreaterThan(0);
  });

  it('returns the only legal action when one is available', () => {
    const only = makeAction(9);
    const board = boardStub([only]);
    const result = uct.getActionInfo(board, 1000, 200, 10, 20);
    expect(result.action).toEqual(only);
    expect(result.info).toMatch(/1 action/i);
  });

  it('returns null when no legal actions remain', () => {
    const board = boardStub([]);
    const result = uct.getActionInfo(board, 1000, 200, 10, 20);
    expect(result.action).toBeNull();
    expect(result.info).toMatch(/no action/i);
  });

  it('falls back to first unexamined action when search budget is zero', () => {
    // maxIterations=0 means the outer loop never runs; root has no children.
    // getActionInfo should return root.unexamined[0] via the fallback path.
    const board = new Board();
    const result = uct.getActionInfo(board, 0, 200, 10, 20);
    expect(result.action).toBeTruthy();
    expect(result.info).toMatch(/fallback/i);
  });

  it('does not exceed maxIterations inside block loop', () => {
    const actions = [makeAction(1), makeAction(2), makeAction(3)];
    let copyCalls = 0;
    const board = {
      active: 0,
      getActions: () => actions,
      copy: () => {
        copyCalls++;
        return {
          active: 0,
          getActions: () => [],
          doAction: () => {},
          getResult: () => [0.5, 0.5],
        };
      },
      doAction: () => {},
      getResult: () => [0.5, 0.5],
    };

    uct.getActionInfo(board, 1, 10_000, 0, 0);
    expect(copyCalls).toBe(1);
  });

  it('handles immediate time-limit overrun branch safely', () => {
    const board = new Board();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(1);

    const result = uct.getActionInfo(board, 200, 1, 1, 1);
    expect(result.action).toBeTruthy();

    nowSpy.mockRestore();
  });

  it('reports search completion without timeout blocks', () => {
    const board = new Board();
    // Initial board has many legal actions
    const actions = board.getActions();
    expect(actions.length).toBeGreaterThanOrEqual(2);

    const result = uct.getActionInfo(board, 500, 5000, 10, 20);
    expect(result.action).toBeTruthy();
    // When no blocks timeout, info should report nodes/sec examined (not mentioning blocks)
    expect(result.info).toMatch(/nodes\/sec examined/);
    expect(result.info).not.toMatch(/blocks timed out/);
    expect(result.info).toMatch(/\d+/); // Contains numbers
  });

  it('reports timing information with nodes per second metric', () => {
    const uct = new Uct();
    const board = new Board();

    // Run search with sufficient budget to complete iterations
    const result = uct.getActionInfo(board, 100, 3000, 10, 20);
    expect(result.action).toBeTruthy();
    expect(result.info).toMatch(/nodes\/sec/); // Should have timing info
    expect(result.info).toMatch(/\d+/); // Should contain numeric data
  });
});

describe('Board adapter x Uct integration', () => {
  it('plays multiple AI moves and keeps cell values valid', () => {
    const uct = new Uct();
    const board = new Board(createBoard());

    for (let i = 0; i < 16; i++) {
      const { action } = uct.getActionInfo(board, 900, 140, 10, 20);
      if (!action) break;
      board.doAction(action);
      if (board.getState().winner !== null || board.getState().isDraw) break;
    }

    const values = board.getState().grid.flat();
    expect(values.every(v => v >= 0 && v <= 4)).toBe(true);
  }, 12000);
});
