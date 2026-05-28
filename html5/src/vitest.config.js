// Vitest configuration
// Tests pure ES-module functions under Node – no browser environment needed.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['js/board.js', 'js/common.js', 'js/store.js', 'js/uct/**/*.js'],
      reporter: ['text', 'html'],
      thresholds: {
        statements: 98,
        branches: 94,
        functions: 98,
        lines: 98,
      },
    },
  },
});
