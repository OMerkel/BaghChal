// Copyright (c) 2016,2026 Oliver Merkel. All rights reserved.
// @author Oliver Merkel, <Merkel(dot)Oliver(at)web(dot)de>
// SPDX-License-Identifier: MIT
//
// UCT (Upper Confidence Bound applied to Trees) – MCTS engine.
//

import { UctNode } from './uctnode.js';

const ROLLOUT_EPSILON = 0.10;

const randomAction = actions => actions[Math.floor(Math.random() * actions.length)];

const tigerPositions = board => {
  const state = board.getState?.();
  if (!state?.grid) return [];
  const positions = [];
  for (let row = 0; row < state.grid.length; row++) {
    for (let col = 0; col < state.grid[row].length; col++) {
      if (state.grid[row][col] === 2) {
        positions.push({ row, column: col });
      }
    }
  }
  return positions;
};

const distance = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.column - b.column);

const scoreGoatPlacement = (board, action) => {
  const tigers = tigerPositions(board);
  if (tigers.length === 0) return 0;

  const minTigerDistance = Math.min(...tigers.map(tiger => distance(action.to, tiger)));
  const centerDistance = Math.abs(action.to.row - 2) + Math.abs(action.to.column - 2);
  return minTigerDistance - 0.35 * centerDistance;
};

const scoreGoatMove = (board, action) => {
  const simulated = board.copy();
  simulated.doAction(action);
  const tigerReplies = simulated.getActions();
  const immediateCaptures = tigerReplies.filter(reply => reply.type === 'capture').length;
  return -8 * immediateCaptures - 0.25 * tigerReplies.length;
};

const pickPolicyAction = (board, actions) => {
  if (actions.length === 1) return actions[0];
  if (Math.random() < ROLLOUT_EPSILON) return randomAction(actions);

  const active = board.active;

  // Tiger policy: always prioritize captures in rollouts.
  if (active === 1) {
    const captures = actions.filter(action => action.type === 'capture');
    if (captures.length > 0) return randomAction(captures);
    return randomAction(actions);
  }

  // Goat policy: avoid immediate tiger captures where possible.
  let bestAction = actions[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of actions) {
    const score =
      action.type === 'place' ? scoreGoatPlacement(board, action) : scoreGoatMove(board, action);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  return bestAction;
};

export class Uct {
  /**
   * Run MCTS and return the best action together with diagnostic info.
   *
   * @param {Board}  board                - current board (Board adapter instance)
   * @param {number} maxIterations        - hard cap on simulation iterations
   * @param {number} maxTime             - wall-clock budget in milliseconds
   * @param {number} maxDepthSimulation  - max random-playout depth per iteration
   * @param {number} maxLookAhead        - max total depth (selection + simulation)
   * @returns {{ action: number|null, info: string }}
   */
  getActionInfo(board, maxIterations, maxTime, maxDepthSimulation, maxLookAhead) {
    const root = new UctNode(null, board, null);

    if (root.unexamined.length === 0) {
      return { action: null, info: 'No action available.' };
    }
    if (root.unexamined.length === 1) {
      return { action: root.unexamined[0], info: 'Just 1 action available.' };
    }

    const startTime = Date.now();
    const timeLimit = startTime + maxTime;
    const blockSize = 50;
    let nodesVisited = 0;
    let blocksSkipped = 0;

    for (
      let iterations = 0;
      iterations < maxIterations && Date.now() < timeLimit;
      iterations += blockSize
    ) {
      // Defensive check: on fast hardware, Date.now() may not advance between loop iterations.
      // This early exit prevents wasting remaining iterations if time budget is exhausted.
      if (Date.now() >= timeLimit) {
        blocksSkipped++;
        break;
      }
      const remainingIterations = maxIterations - iterations;
      const batchIterations = Math.min(blockSize, remainingIterations);
      for (let i = 0; i < batchIterations; i++) {
        let node = root;
        const variantBoard = board.copy();
        let lookAhead = maxLookAhead;

        /* Selection */
        while (node.unexamined.length === 0 && node.children.length > 0 && lookAhead > 0) {
          node = node.selectChild();
          variantBoard.doAction(node.action);
          lookAhead--;
        }

        /* Expansion */
        if (node.unexamined.length > 0) {
          const j = Math.floor(Math.random() * node.unexamined.length);
          variantBoard.doAction(node.unexamined[j]);
          node = node.addChild(variantBoard, j);
        }

        /* Simulation (random playout) */
        let actions = variantBoard.getActions();
        let depth = maxDepthSimulation;
        while (actions.length > 0 && depth > 0 && lookAhead > 0) {
          variantBoard.doAction(pickPolicyAction(variantBoard, actions));
          nodesVisited++;
          actions = variantBoard.getActions();
          depth--;
          lookAhead--;
        }

        /* Backpropagation */
        const result = variantBoard.getResult();
        let backNode = node;
        while (backNode) {
          backNode.update(result);
          backNode = backNode.parentNode;
        }
      }
    }

    const duration = Math.max(Date.now() - startTime, 1);
    const mostVisited = root.mostVisitedChild();
    if (!mostVisited) {
      return {
        action: root.unexamined[0],
        info: 'Search budget exhausted before expansion; fallback action selected.',
      };
    }

    const info =
      blocksSkipped > 0
        ? `${Math.floor((nodesVisited * 1000) / duration)} nodes/sec (${blocksSkipped} blocks timed out).`
        : `${Math.floor((nodesVisited * 1000) / duration)} nodes/sec examined.`;

    return {
      action: mostVisited.action,
      info,
    };
  }
}
