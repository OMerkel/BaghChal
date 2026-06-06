// Copyright (c) 2016,2026 Oliver Merkel. All rights reserved.
// SPDX-License-Identifier: MIT

import { actionToKey, COLUMNS, EMPTY, NORTH, ROWS, SOUTH } from './common.js';
import {
  ANNOTATION_FONT_SIZE,
  ANNOTATION_OFFSET_X,
  ANNOTATION_OFFSET_Y,
  BOARD_BORDER_MARGIN,
  BOARD_BORDER_MARGIN_TOTAL,
  BOARD_CELL_HEIGHT,
  BOARD_CELL_WIDTH,
  BOARD_INTERACTION_RING_RADIUS,
  BOARD_NODE_RADIUS,
  BOARD_PIECE_RADIUS,
  BOARD_VIEWBOX_HEIGHT,
  BOARD_VIEWBOX_WIDTH,
  CAPTURE_LEGEND_DOT_RADIUS,
  CAPTURE_LEGEND_FONT_SIZE,
  CAPTURE_LEGEND_Y,
  STATUS_TEXT_FONT_SIZE,
  STATUS_TEXT_Y,
  SVG_NAMESPACE,
} from './config.js';

const SVG_NS = SVG_NAMESPACE;
const VB_W = BOARD_VIEWBOX_WIDTH;
const VB_H = BOARD_VIEWBOX_HEIGHT;
const CELL_X = BOARD_CELL_WIDTH;
const CELL_Y = BOARD_CELL_HEIGHT;
const GRID_X = Math.floor((VB_W - (COLUMNS - 1) * CELL_X) / 2);
const GRID_Y = Math.floor((VB_H - (ROWS - 1) * CELL_Y) / 2);
const PIECE_R = BOARD_PIECE_RADIUS;
const PIECE_SCALE_FACTOR = 2.5;

const colors = {
  background: '#1d3557',
  board: '#d9b382',
  line: '#4a2f1b',
  strike: '#6b3a12', // darker brown for strike color
  south: '#b91c1c',
  north: '#f4d03f',
  selected: '#22c55e',
  latest: '#f8fafc',
  selectable: '#0ea5e9',
  idleStroke: '#111827',
  destinationStroke: '#14532d',
  destination: 'rgba(34, 197, 94, 0.45)',
  captureApproach: '#2563eb',
  captureWithdrawal: '#ea580c',
  captureBoth: '#7c3aed',
  annotation: '#e0e0e0',
  visitedCell: '#94a3b8',
};

const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => {
    el.setAttribute(k, String(v));
  });
  return el;
};

const cellCenter = (row, col) => ({
  x: GRID_X + col * CELL_X,
  y: GRID_Y + row * CELL_Y,
});

const createBoardPattern = () => {
  const layer = svgEl('g', { 'stroke-linecap': 'round' });

  // Use board image as background
  layer.appendChild(
    svgEl('image', {
      x: GRID_X - BOARD_BORDER_MARGIN,
      y: GRID_Y - BOARD_BORDER_MARGIN,
      width: (COLUMNS - 1) * CELL_X + BOARD_BORDER_MARGIN_TOTAL,
      height: (ROWS - 1) * CELL_Y + BOARD_BORDER_MARGIN_TOTAL,
      href: 'img/board.jpg',
      preserveAspectRatio: 'xMidYMid slice',
    })
  );

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const p = cellCenter(row, col);
      layer.appendChild(
        svgEl('circle', {
          cx: p.x,
          cy: p.y,
          r: BOARD_NODE_RADIUS,
          fill: colors.line,
        })
      );
    }
  }

  return layer;
};

/**
 * Create and return a renderer for the Bagh Chal game board.
 * Sets up SVG DOM elements, event handlers, and rendering functions.
 * @param {HTMLElement} container - DOM container where the SVG board will be mounted.
 * @param {Function} onCellClick - Callback function called when a board cell is clicked: (row, col) => void.
 * @returns {{render: Function, resize: Function, actionKey: Function}} Renderer object with render and utility methods.
 */
export const createRenderer = (container, onCellClick) => {
  const svg = svgEl('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    preserveAspectRatio: 'xMidYMin meet', // move board higher
    role: 'img',
    'aria-label': 'Bagh Chal game board',
  });
  svg.style.cssText = 'display:block;width:100%;height:100%;background:#0f172a;';

  svg.appendChild(createBoardPattern());

  const statusText = svgEl('text', {
    x: VB_W / 2,
    y: STATUS_TEXT_Y,
    'text-anchor': 'middle',
    style: `font:700 ${STATUS_TEXT_FONT_SIZE}px/1 system-ui,sans-serif;fill:#f8fafc;stroke:#1f2937;stroke-width:2;`,
  });
  svg.appendChild(statusText);

  const captureLegend = svgEl('g', { display: 'none', 'pointer-events': 'none' });
  const legendY = CAPTURE_LEGEND_Y;
  const approachDot = svgEl('circle', {
    cx: VB_W / 2 - 240,
    cy: legendY,
    r: CAPTURE_LEGEND_DOT_RADIUS,
    fill: colors.captureApproach,
    stroke: '#f8fafc',
    'stroke-width': 2,
  });
  const approachLabel = svgEl('text', {
    x: VB_W / 2 - 220,
    y: legendY,
    'dominant-baseline': 'middle',
    style: `font:700 ${CAPTURE_LEGEND_FONT_SIZE}px/1 system-ui,sans-serif;fill:#f8fafc;`,
  });
  approachLabel.textContent = 'approach';

  const withdrawalDot = svgEl('circle', {
    cx: VB_W / 2 + 20,
    cy: legendY,
    r: CAPTURE_LEGEND_DOT_RADIUS,
    fill: colors.captureWithdrawal,
    stroke: '#f8fafc',
    'stroke-width': 2,
  });
  const withdrawalLabel = svgEl('text', {
    x: VB_W / 2 + 40,
    y: legendY,
    'dominant-baseline': 'middle',
    style: `font:700 ${CAPTURE_LEGEND_FONT_SIZE}px/1 system-ui,sans-serif;fill:#f8fafc;`,
  });
  withdrawalLabel.textContent = 'withdrawal';

  captureLegend.appendChild(approachDot);
  captureLegend.appendChild(approachLabel);
  captureLegend.appendChild(withdrawalDot);
  captureLegend.appendChild(withdrawalLabel);
  svg.appendChild(captureLegend);

  const pieceLayer = svgEl('g');
  const overlayLayer = svgEl('g');
  const annotationLayer = svgEl('g');
  svg.appendChild(pieceLayer);
  svg.appendChild(overlayLayer);
  svg.appendChild(annotationLayer);

  const pieces = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLUMNS }, (_, col) => {
      const pos = cellCenter(row, col);
      const group = svgEl('g');
      const disc = svgEl('image', {
        x: pos.x - PIECE_R * PIECE_SCALE_FACTOR,
        y: pos.y - PIECE_R * PIECE_SCALE_FACTOR,
        width: PIECE_R * 2 * PIECE_SCALE_FACTOR,
        height: PIECE_R * 2 * PIECE_SCALE_FACTOR,
        href: '',
        display: 'none',
      });
      const sourceIndicator = svgEl('circle', {
        cx: pos.x,
        cy: pos.y,
        r: 11,
        fill: '#ffffff',
        opacity: 0.7,
        display: 'none',
      });
      group.appendChild(disc);
      group.appendChild(sourceIndicator);
      pieceLayer.appendChild(group);
      return { group, disc, sourceIndicator };
    })
  );

  const cells = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLUMNS }, (_, col) => {
      const pos = cellCenter(row, col);
      const ring = svgEl('circle', {
        cx: pos.x,
        cy: pos.y,
        r: BOARD_INTERACTION_RING_RADIUS,
        fill: 'transparent',
        stroke: 'transparent',
        'stroke-width': 0,
      });
      ring.style.cursor = 'default';
      overlayLayer.appendChild(ring);
      return ring;
    })
  );

  // Info panel (right of board): goats to place + goats captured
  const INFO_PANEL_X = 1430;
  const INFO_PANEL_Y = 340;
  const INFO_PANEL_W = 330;
  const INFO_PANEL_H = 230;
  const INFO_ICON_SIZE = 60;
  const INFO_ICON_X = INFO_PANEL_X + 22;

  const infoPanel = svgEl('g', { 'pointer-events': 'none' });
  infoPanel.appendChild(
    svgEl('rect', {
      x: INFO_PANEL_X,
      y: INFO_PANEL_Y,
      width: INFO_PANEL_W,
      height: INFO_PANEL_H,
      rx: 18,
      fill: 'rgba(15,23,42,0.82)',
      stroke: '#334155',
      'stroke-width': 2,
    })
  );

  // Row 1: goats to place
  infoPanel.appendChild(
    svgEl('image', {
      x: INFO_ICON_X,
      y: INFO_PANEL_Y + 22,
      width: INFO_ICON_SIZE,
      height: INFO_ICON_SIZE,
      href: 'img/256goat.png',
    })
  );
  const toPlaceLabel = svgEl('text', {
    x: INFO_ICON_X + INFO_ICON_SIZE + 14,
    y: INFO_PANEL_Y + 46,
    style: 'font:600 26px/1 system-ui,sans-serif;fill:#94a3b8;',
  });
  toPlaceLabel.textContent = 'To place';
  infoPanel.appendChild(toPlaceLabel);
  const goatsToPlaceText = svgEl('text', {
    x: INFO_ICON_X + INFO_ICON_SIZE + 14,
    y: INFO_PANEL_Y + 92,
    style: 'font:700 46px/1 system-ui,sans-serif;fill:#f8fafc;',
  });
  goatsToPlaceText.textContent = '20';
  infoPanel.appendChild(goatsToPlaceText);

  // Divider
  infoPanel.appendChild(
    svgEl('line', {
      x1: INFO_PANEL_X + 16,
      y1: INFO_PANEL_Y + 112,
      x2: INFO_PANEL_X + INFO_PANEL_W - 16,
      y2: INFO_PANEL_Y + 112,
      stroke: '#334155',
      'stroke-width': 1,
    })
  );

  // Row 2: goats captured
  infoPanel.appendChild(
    svgEl('image', {
      x: INFO_ICON_X,
      y: INFO_PANEL_Y + 124,
      width: INFO_ICON_SIZE,
      height: INFO_ICON_SIZE,
      href: 'img/256goat-captured.png',
    })
  );
  const capturedLabel = svgEl('text', {
    x: INFO_ICON_X + INFO_ICON_SIZE + 14,
    y: INFO_PANEL_Y + 148,
    style: 'font:600 26px/1 system-ui,sans-serif;fill:#94a3b8;',
  });
  capturedLabel.textContent = 'Captured';
  infoPanel.appendChild(capturedLabel);
  const goatsCapturedText = svgEl('text', {
    x: INFO_ICON_X + INFO_ICON_SIZE + 14,
    y: INFO_PANEL_Y + 196,
    style: 'font:700 46px/1 system-ui,sans-serif;fill:#f8fafc;',
  });
  goatsCapturedText.textContent = '0';
  infoPanel.appendChild(goatsCapturedText);

  svg.appendChild(infoPanel);

  container.appendChild(svg);

  const handlers = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
  let directionLines = [];

  const clearHandlers = () => {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        const handler = handlers[row][col];
        handlers[row][col] = null;
        if (handler) {
          cells[row][col].removeEventListener('click', handler);
        }
        cells[row][col].style.cursor = 'default';
      }
    }
  };

  const clearDirectionLines = () => {
    directionLines.forEach(line => {
      line.remove();
    });
    directionLines = [];
  };

  const clearAnnotations = () => {
    while (annotationLayer.firstChild) {
      annotationLayer.removeChild(annotationLayer.firstChild);
    }
  };

  const drawAnnotations = () => {
    clearAnnotations();
    const COL_LABELS = ['a', 'b', 'c', 'd', 'e'];
    // Move as close as possible to the board edge (align with board border)
    const offsetX = ANNOTATION_OFFSET_X;
    const offsetY = ANNOTATION_OFFSET_Y;
    const fontSize = ANNOTATION_FONT_SIZE;

    // Column labels (a-e) - top and bottom
    for (let col = 0; col < COLUMNS; col++) {
      const pos = cellCenter(0, col);
      // Top label (upside down)
      const topLabel = svgEl('text', {
        x: pos.x,
        y: GRID_Y - offsetY + 2, // +2 for visual balance
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': fontSize,
        'font-weight': 'bold',
        fill: colors.annotation,
        stroke: '#000000',
        'stroke-width': 3,
        'pointer-events': 'none',
        style: 'font-family: system-ui, sans-serif;',
        transform: `rotate(180 ${pos.x} ${GRID_Y - offsetY + 2})`,
      });
      topLabel.textContent = COL_LABELS[col];
      annotationLayer.appendChild(topLabel);

      // Bottom label
      const bottomPos = cellCenter(ROWS - 1, col);
      const bottomLabel = svgEl('text', {
        x: bottomPos.x,
        y: GRID_Y + (ROWS - 1) * CELL_Y + offsetY - 2, // -2 for visual balance
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': fontSize,
        'font-weight': 'bold',
        fill: colors.annotation,
        stroke: '#000000',
        'stroke-width': 3,
        'pointer-events': 'none',
        style: 'font-family: system-ui, sans-serif;',
      });
      bottomLabel.textContent = COL_LABELS[col];
      annotationLayer.appendChild(bottomLabel);
    }

    // Row labels (5,4,3,2,1) - left and right (1 at bottom, 5 at top)
    for (let row = 0; row < ROWS; row++) {
      const pos = cellCenter(row, 0);
      const rowNum = ROWS - row; // 5 at top, 1 at bottom
      // Left label
      const leftLabel = svgEl('text', {
        x: GRID_X - offsetX + 2,
        y: pos.y,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': fontSize,
        'font-weight': 'bold',
        fill: colors.annotation,
        stroke: '#000000',
        'stroke-width': 3,
        'pointer-events': 'none',
        style: 'font-family: system-ui, sans-serif;',
      });
      leftLabel.textContent = String(rowNum);
      annotationLayer.appendChild(leftLabel);

      // Right label (upside down)
      const rightPos = cellCenter(row, COLUMNS - 1);
      const rightLabel = svgEl('text', {
        x: GRID_X + (COLUMNS - 1) * CELL_X + offsetX - 2,
        y: rightPos.y,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': fontSize,
        'font-weight': 'bold',
        fill: colors.annotation,
        stroke: '#000000',
        'stroke-width': 3,
        'pointer-events': 'none',
        style: 'font-family: system-ui, sans-serif;',
        transform: `rotate(180 ${GRID_X + (COLUMNS - 1) * CELL_X + offsetX - 2} ${rightPos.y})`,
      });
      rightLabel.textContent = String(rowNum);
      annotationLayer.appendChild(rightLabel);
    }
  };

  /**
   * Render the board state to SVG, updating pieces, highlights, and status text.
   * @param {BoardState} boardState - Current board state to render.
   * @param {Action[]} [selectableActions=[]] - Array of legal moves available to current player.
   * @param {CellRef} [selectedFrom=null] - Currently selected source cell, if any.
   * @param {boolean} [allowReselect=false] - If true, allow reselecting and deselecting pieces (Flexible mode).
   * @param {boolean} [showAnnotations=false] - If true, display board annotations (algebraic notation).
   * @param {Action[]} [captureChoiceActions=null] - Actions for ambiguous capture selection, if any.
   * @returns {void}
   */
  const render = (
    boardState,
    selectableActions = [],
    selectedFrom = null,
    allowReselect = false,
    showAnnotations = false,
    captureChoiceActions = null
  ) => {
    const latest = boardState.latestMove;
    const choiceActions = Array.isArray(captureChoiceActions) ? captureChoiceActions : [];
    const captureChoiceCells = new Map();

    for (const action of choiceActions) {
      const mode = action.captureMode ?? 'capture';
      for (const captured of action.captures ?? []) {
        const key = `${captured.row}:${captured.column}`;
        const existing = captureChoiceCells.get(key);
        if (!existing || existing === mode) {
          captureChoiceCells.set(key, mode);
        } else {
          captureChoiceCells.set(key, 'both');
        }
      }
    }

    const visitedSet = new Set(
      (boardState.turnContext?.visited ?? []).map(v =>
        typeof v === 'string' ? v : `${v.row}:${v.column}`
      )
    );

    const sourceSet = new Set(
      selectableActions
        .filter(() => !selectedFrom || allowReselect)
        .map(a => `${a.from.row}:${a.from.column}`)
    );
    const destinationSet = new Set(
      selectableActions
        .filter(
          a =>
            selectedFrom && a.from.row === selectedFrom.row && a.from.column === selectedFrom.column
        )
        .map(a => `${a.to.row}:${a.to.column}`)
    );

    const latestKey = latest ? `${latest.to.row}:${latest.to.column}` : null;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        const piece = boardState.grid[row][col];
        const key = `${row}:${col}`;

        const cell = pieces[row][col];
        const isLastMoveSource = latest && latest.from.row === row && latest.from.column === col;
        cell.sourceIndicator.setAttribute('display', isLastMoveSource ? 'block' : 'none');

        if (piece === EMPTY) {
          cell.disc.setAttribute('display', 'none');
        } else {
          const imageUrl = piece === SOUTH ? 'img/256goat.png' : 'img/256tiger.png';
          cell.disc.setAttribute('href', imageUrl);
          cell.disc.setAttribute('display', 'block');
          const isSelected =
            selectedFrom && selectedFrom.row === row && selectedFrom.column === col;
          const isLatest = latestKey === key;
          const isSelectable = sourceSet.has(key);
          const isVisited = visitedSet.has(key);

          if (isSelected) {
            cell.disc.setAttribute('stroke', colors.selected);
            cell.disc.setAttribute('stroke-width', '12');
            cell.disc.style.filter = 'drop-shadow(0 0 12px rgba(34,197,94,0.95))';
          } else if (isVisited && !isSelectable) {
            cell.disc.setAttribute('stroke', colors.visitedCell);
            cell.disc.setAttribute('stroke-width', '6');
            cell.disc.style.filter = 'opacity(0.7)';
          } else if (isSelectable) {
            cell.disc.setAttribute('stroke', colors.selectable);
            cell.disc.setAttribute('stroke-width', '9');
            cell.disc.style.filter = 'none';
          } else if (isLatest) {
            cell.disc.setAttribute('stroke', colors.latest);
            cell.disc.setAttribute('stroke-width', '6');
            cell.disc.style.filter = 'drop-shadow(0 0 10px rgba(248,250,252,0.9))';
          } else {
            cell.disc.setAttribute('stroke', colors.idleStroke);
            cell.disc.setAttribute('stroke-width', '4');
            cell.disc.style.filter = 'none';
          }
        }

        const ring = cells[row][col];
        const choiceMode = captureChoiceCells.get(key);
        const isVisited = visitedSet.has(key);
        if (choiceMode) {
          const stroke =
            choiceMode === 'approach'
              ? colors.captureApproach
              : choiceMode === 'withdrawal'
                ? colors.captureWithdrawal
                : colors.captureBoth;
          ring.setAttribute('fill', 'transparent');
          ring.setAttribute('stroke', stroke);
          ring.setAttribute('stroke-width', '10');
          ring.setAttribute('stroke-dasharray', '18,10');
          ring.setAttribute('opacity', '0.95');
          if (piece !== EMPTY) {
            cell.disc.setAttribute('stroke', stroke);
            cell.disc.setAttribute('stroke-width', '12');
            cell.disc.style.filter = 'drop-shadow(0 0 14px rgba(255,255,255,0.65))';
          }
        } else if (isVisited) {
          ring.setAttribute('fill', 'transparent');
          ring.setAttribute('stroke', colors.visitedCell);
          ring.setAttribute('stroke-width', '6');
          ring.setAttribute('stroke-dasharray', '6,6');
          ring.setAttribute('opacity', '0.6');
        } else if (destinationSet.has(key)) {
          ring.setAttribute('fill', colors.destination);
          ring.setAttribute('stroke', colors.destinationStroke);
          ring.setAttribute('stroke-width', '4');
          ring.removeAttribute('stroke-dasharray');
          ring.setAttribute('opacity', '1');
        } else {
          ring.setAttribute('fill', 'transparent');
          ring.setAttribute('stroke', 'transparent');
          ring.setAttribute('stroke-width', '0');
          ring.removeAttribute('stroke-dasharray');
          ring.setAttribute('opacity', '1');
        }
      }
    }

    // Draw direction lines from selected source to destinations
    clearDirectionLines();
    if (selectedFrom) {
      const sourcePos = cellCenter(selectedFrom.row, selectedFrom.column);
      for (const action of selectableActions) {
        if (action.from.row === selectedFrom.row && action.from.column === selectedFrom.column) {
          const destPos = cellCenter(action.to.row, action.to.column);
          const directionLine = svgEl('line', {
            x1: sourcePos.x,
            y1: sourcePos.y,
            x2: destPos.x,
            y2: destPos.y,
            stroke: colors.selectable,
            'stroke-width': 2,
            'stroke-dasharray': '8,4',
            opacity: 0.6,
            'pointer-events': 'none',
          });
          overlayLayer.insertBefore(directionLine, overlayLayer.firstChild);
          directionLines.push(directionLine);
        }
      }
    }

    const sideName = boardState.active === 0 ? 'Goats' : 'Tigers';
    const sideStatus = `${sideName} to move`;

    if (boardState.winner === 0) {
      statusText.textContent = 'Goats win';
      captureLegend.setAttribute('display', 'none');
    } else if (boardState.winner === 1) {
      statusText.textContent = 'Tigers win';
      captureLegend.setAttribute('display', 'none');
    } else if (captureChoiceCells.size > 0) {
      statusText.textContent = 'Choose capture target';
      captureLegend.setAttribute('display', 'block');
    } else {
      statusText.textContent = sideStatus;
      captureLegend.setAttribute('display', 'none');
    }

    // Update info panel counts
    goatsToPlaceText.textContent = String(boardState.goatsToPlace);
    goatsCapturedText.setAttribute(
      'style',
      `font:700 46px/1 system-ui,sans-serif;fill:${boardState.goatsCaptured > 0 ? colors.south : '#f8fafc'};`
    );
    goatsCapturedText.textContent = String(boardState.goatsCaptured);

    // Draw or clear board annotations
    if (showAnnotations) {
      drawAnnotations();
    } else {
      clearAnnotations();
    }

    clearHandlers();

    const clickable =
      captureChoiceCells.size > 0
        ? new Set(captureChoiceCells.keys())
        : selectedFrom && allowReselect
          ? new Set([...sourceSet, ...destinationSet])
          : selectedFrom
            ? destinationSet
            : sourceSet;
    for (const key of clickable) {
      const [rowText, colText] = key.split(':');
      const row = Number(rowText);
      const col = Number(colText);
      const handler = () => onCellClick(row, col);
      handlers[row][col] = handler;
      cells[row][col].addEventListener('click', handler);
      cells[row][col].style.cursor = 'pointer';
    }
  };

  return {
    render,
    resize: () => {},
    actionKey: actionToKey,
  };
};
