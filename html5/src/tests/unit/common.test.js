import { describe, expect, it } from 'vitest';
import { actionToKey, COLUMNS, EMPTY, NORTH, ROWS, SOUTH, VARIANTS } from '../../js/common.js';

describe('common constants', () => {
  it('exposes board dimensions and piece IDs', () => {
    expect(COLUMNS).toBe(5);
    expect(ROWS).toBe(5);
    expect(EMPTY).toBe(0);
    expect(SOUTH).toBe(1);
    expect(NORTH).toBe(2);
    expect(VARIANTS.BAGHCHAL).toBe('Bagh Chal');
  });
});

describe('actionToKey', () => {
  it('builds a stable action signature', () => {
    const action = {
      from: { row: 3, column: 4 },
      to: { row: 1, column: 4 },
      type: 'capture',
      captureMode: 'approach',
    };

    expect(actionToKey(action)).toBe('3:4:1:4:capture:approach');
  });
});
