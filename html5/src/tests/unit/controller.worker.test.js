import { afterEach, describe, expect, it, vi } from 'vitest';

const defaultSettings = {
  gamevariant: 'Bagh Chal',
  playersouth: 'Human',
  playernorth: 'Human',
  difficultysouth: 'Medium',
  difficultynorth: 'Medium',
  deviceprofile: 'Desktop',
  resolveddeviceprofile: 'Desktop',
  selectionmode: 'MustMove',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock('../../js/board.js');
  vi.doUnmock('../../js/uct/uct.js');
  delete globalThis.self;
});

describe('controller worker message handling', () => {
  it('ignores action_by_ai when current side is human', async () => {
    const posted = [];
    const listeners = new Map();

    globalThis.self = {
      postMessage: vi.fn(msg => posted.push(msg)),
      addEventListener: vi.fn((type, handler) => {
        listeners.set(type, handler);
      }),
    };

    const modulePath = `../../js/controller.js?test=${Date.now()}-${Math.random()}`;
    await import(modulePath);

    const onMessage = listeners.get('message');
    expect(onMessage).toBeTypeOf('function');

    onMessage({ data: { request: 'start', settings: defaultSettings } });
    posted.length = 0;

    onMessage({ data: { request: 'action_by_ai', settings: defaultSettings } });

    const requests = posted.map(m => m.request);
    expect(requests).toEqual(['redraw', 'human_to_move']);
    expect(posted[0].board.active).toBe(0);
    expect(posted[0].board.winner).toBeNull();
  });

  it('emits turn state after invalid move attempt', async () => {
    const posted = [];
    const listeners = new Map();

    globalThis.self = {
      postMessage: vi.fn(msg => posted.push(msg)),
      addEventListener: vi.fn((type, handler) => {
        listeners.set(type, handler);
      }),
    };

    const modulePath = `../../js/controller.js?test=${Date.now()}-${Math.random()}`;
    await import(modulePath);

    const onMessage = listeners.get('message');
    expect(onMessage).toBeTypeOf('function');

    onMessage({ data: { request: 'start', settings: defaultSettings } });
    posted.length = 0;

    onMessage({
      data: {
        request: 'move',
        settings: defaultSettings,
        action: {
          from: { row: 0, column: 0 },
          to: { row: 0, column: 1 },
          type: 'move',
        },
      },
    });

    const requests = posted.map(m => m.request);
    expect(requests).toEqual(['redraw', 'human_to_move']);
  });

  it('still allows action_by_ai when side is AI', async () => {
    const posted = [];
    const listeners = new Map();

    globalThis.self = {
      postMessage: vi.fn(msg => posted.push(msg)),
      addEventListener: vi.fn((type, handler) => {
        listeners.set(type, handler);
      }),
    };

    const modulePath = `../../js/controller.js?test=${Date.now()}-${Math.random()}`;
    await import(modulePath);

    const onMessage = listeners.get('message');
    expect(onMessage).toBeTypeOf('function');

    onMessage({
      data: {
        request: 'start',
        settings: {
          ...defaultSettings,
          playersouth: 'AI',
        },
      },
    });

    const requests = posted.map(m => m.request);
    expect(requests).toContain('redraw');
  });

  it('uses deterministic fallback action when AI returns null but legal actions exist', async () => {
    const posted = [];
    const listeners = new Map();

    globalThis.self = {
      postMessage: vi.fn(msg => posted.push(msg)),
      addEventListener: vi.fn((type, handler) => {
        listeners.set(type, handler);
      }),
    };

    const { Uct } = await import('../../js/uct/uct.js');
    vi.spyOn(Uct.prototype, 'getActionInfo').mockReturnValue({ action: null });

    const modulePath = `../../js/controller.js?test=${Date.now()}-${Math.random()}`;
    await import(modulePath);

    const onMessage = listeners.get('message');
    onMessage({
      data: {
        request: 'start',
        settings: {
          ...defaultSettings,
          playersouth: 'AI',
        },
      },
    });

    const redraws = posted.filter(m => m.request === 'redraw');
    const latestRedraw = redraws.at(-1);
    expect(redraws.length).toBeGreaterThan(1);
    expect(latestRedraw.board.latestMove).not.toBeNull();
  });

  it('resolves no-legal-move as immediate loss when AI returns null', async () => {
    const posted = [];
    const listeners = new Map();

    vi.doMock('../../js/board.js', () => {
      class MockBoard {
        constructor() {
          this._state = {
            active: 0,
            grid: [],
            winner: null,
            isDraw: false,
            latestMove: null,
            winningLine: null,
          };
        }

        get active() {
          return this._state.active;
        }

        getState() {
          return this._state;
        }

        setState(next) {
          this._state = next;
        }
      }

      return {
        Board: MockBoard,
        createBoard: () => ({
          active: 0,
          grid: [],
          winner: null,
          isDraw: false,
          latestMove: null,
          winningLine: null,
          variant: 'Bagh Chal',
          turnContext: null,
        }),
        doAction: state => state,
        getActions: () => [],
      };
    });

    vi.doMock('../../js/uct/uct.js', () => ({
      Uct: class {
        getActionInfo() {
          return { action: null };
        }
      },
    }));

    globalThis.self = {
      postMessage: vi.fn(msg => posted.push(msg)),
      addEventListener: vi.fn((type, handler) => {
        listeners.set(type, handler);
      }),
    };

    const modulePath = `../../js/controller.js?test=${Date.now()}-${Math.random()}`;
    await import(modulePath);

    const onMessage = listeners.get('message');
    onMessage({
      data: {
        request: 'start',
        settings: {
          ...defaultSettings,
          playersouth: 'AI',
        },
      },
    });

    const requests = posted.map(m => m.request);
    expect(requests.filter(r => r === 'redraw').length).toBeGreaterThanOrEqual(2);
    expect(requests).not.toContain('human_to_move');

    const finalRedraw = posted.filter(m => m.request === 'redraw').at(-1);
    expect(finalRedraw.board.winner).toBe(1);
  });

  it('rejects invalid settings (adversarial player value)', async () => {
    const posted = [];
    const listeners = new Map();

    globalThis.self = {
      postMessage: vi.fn(msg => posted.push(msg)),
      addEventListener: vi.fn((type, handler) => {
        listeners.set(type, handler);
      }),
    };

    const modulePath = `../../js/controller.js?test=${Date.now()}-${Math.random()}`;
    await import(modulePath);

    const onMessage = listeners.get('message');
    expect(onMessage).toBeTypeOf('function');

    onMessage({
      data: {
        request: 'start',
        settings: {
          ...defaultSettings,
          playersouth: 'Adversary',
        },
      },
    });

    const requests = posted.map(m => m.request);
    expect(requests).toContain('redraw');
    expect(requests).toContain('human_to_move');
  });

  it('accepts valid settings with all enum values', async () => {
    const posted = [];
    const listeners = new Map();

    globalThis.self = {
      postMessage: vi.fn(msg => posted.push(msg)),
      addEventListener: vi.fn((type, handler) => {
        listeners.set(type, handler);
      }),
    };

    const modulePath = `../../js/controller.js?test=${Date.now()}-${Math.random()}`;
    await import(modulePath);

    const onMessage = listeners.get('message');

    onMessage({
      data: {
        request: 'start',
        settings: {
          playersouth: 'AI',
          playernorth: 'Human',
          difficultysouth: 'Hard',
          difficultynorth: 'Easy',
          gamevariant: 'Bagh Chal',
          deviceprofile: 'Mobile',
          resolveddeviceprofile: 'Mobile',
          selectionmode: 'Flexible',
        },
      },
    });

    expect(posted.length).toBeGreaterThan(0);
    expect(posted[0].request).toBe('redraw');
  });
});
