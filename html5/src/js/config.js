// Copyright (c) 2016,2026 Oliver Merkel. All rights reserved.
// SPDX-License-Identifier: MIT
//
// Application-wide configuration constants with semantic names.
// Centralized configuration for timing, rendering, caching, and UI parameters.

// =========================================================================
// Timing & Performance
// =========================================================================

/** Pause (ms) after AI move before showing next turn, for UX clarity */
export const AI_MOVE_PAUSE_MS = 900;

/** Viewport width threshold (px) for mobile device profile detection */
export const MOBILE_VIEWPORT_WIDTH_THRESHOLD = 900;

// =========================================================================
// AI Search Budget Parameters
// =========================================================================
// Budget format: [maxIterations, maxTime (ms), maxDepthSimulation, maxLookAhead]
// - maxIterations: Maximum UCT tree exploration iterations
// - maxTime: Maximum search time in milliseconds
// - maxDepthSimulation: Maximum depth for random simulations
// - maxLookAhead: Maximum branching depth for lookahead calculations

export const AI_BUDGETS = {
  desktop: {
    easy: {
      start: [8000, 650, 24, 36],
      turn: [30000, 1000, 34, 50],
    },
    medium: {
      start: [40000, 1800, 44, 66],
      turn: [150000, 3000, 56, 80],
    },
    hard: {
      start: [120000, 3200, 66, 96],
      turn: [420000, 6500, 78, 112],
    },
  },
  mobile: {
    easy: {
      start: [4000, 350, 18, 28],
      turn: [12000, 550, 24, 36],
    },
    medium: {
      start: [18000, 900, 32, 48],
      turn: [70000, 1700, 42, 62],
    },
    hard: {
      start: [50000, 1800, 48, 72],
      turn: [180000, 3200, 58, 84],
    },
  },
};

// =========================================================================
// SVG Board Rendering
// =========================================================================

/** SVG namespace for DOM element creation */
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** ViewBox width for SVG board (units) */
export const BOARD_VIEWBOX_WIDTH = 1800;

/** ViewBox height for SVG board (units), increased to prevent clipping */
export const BOARD_VIEWBOX_HEIGHT = 1200;

/** Horizontal spacing between board cells (units) */
export const BOARD_CELL_WIDTH = 180;

/** Vertical spacing between board cells (units) */
export const BOARD_CELL_HEIGHT = 180;

/** Radius of game pieces on board (units) */
export const BOARD_PIECE_RADIUS = 46;

/** Radius of interaction rings around cells (units) */
export const BOARD_INTERACTION_RING_RADIUS = BOARD_PIECE_RADIUS + 16;

/** Margin outside the board border (units) */
export const BOARD_BORDER_MARGIN = 140;

/** Total margin (2x for both sides) for board rectangle (units) */
export const BOARD_BORDER_MARGIN_TOTAL = BOARD_BORDER_MARGIN * 2;

/** Border radius for rounded corners of board rectangle (units) */
export const BOARD_BORDER_RADIUS = 54;

/** Stroke width of board border (units) */
export const BOARD_BORDER_WIDTH = 12;

/** Radius of node indicator circles on board (units) */
export const BOARD_NODE_RADIUS = 8;

/** Stroke width for board grid lines (units) */
export const BOARD_LINE_STROKE_WIDTH = 6;

/** Stroke width for diagonal board lines (units) */
export const BOARD_DIAGONAL_STROKE_WIDTH = 4;

// =========================================================================
// Board Annotation (Algebraic Notation)
// =========================================================================

/** Distance from board edge to annotation labels (units) */
export const ANNOTATION_OFFSET_X = 88;
export const ANNOTATION_OFFSET_Y = 88;

/** Font size for annotation labels (pixels) */
export const ANNOTATION_FONT_SIZE = 54;

// =========================================================================
// Status & Legend Display
// =========================================================================

/** Y-coordinate of status text at top of board (units) */
export const STATUS_TEXT_Y = 56;

/** Font size for status text (pixels) */
export const STATUS_TEXT_FONT_SIZE = 54;

/** Y-coordinate of capture mode legend (units) */
export const CAPTURE_LEGEND_Y = 92;

/** Font size for legend labels (pixels) */
export const CAPTURE_LEGEND_FONT_SIZE = 24;

/** Radius of legend indicator dots (units) */
export const CAPTURE_LEGEND_DOT_RADIUS = 10;

// =========================================================================
// PWA & Caching
// =========================================================================

/** Service Worker cache version number (increment to force cache refresh) */
export const CACHE_VERSION = 3;

/**
 * Service Worker cache name with version suffix.
 * Note: Service workers cannot import ES modules, so the cache name is defined
 * in service-worker.js as 'bagh chal-pwa-v${CACHE_VERSION}'. Keep them in sync.
 */

// =========================================================================
// Game Result Scoring (UCT Simulation)
// =========================================================================

/** Score for terminal game states in simulations (low non-terminal value) */
export const TERMINAL_STATE_SCORE = 0.01;
