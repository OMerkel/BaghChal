// Copyright (c) 2016,2026 Oliver Merkel. All rights reserved.
// @author Oliver Merkel, <Merkel(dot)Oliver(at)web(dot)de>
// SPDX-License-Identifier: MIT
//
// UCT tree node – part of the Monte-Carlo Tree Search (MCTS/UCB1) engine.
//

export class UctNode {
  constructor(parentNode, board, action) {
    this.action = action;
    this.parentNode = parentNode;
    this.children = [];
    this.wins = 0;
    this.visits = 0;
    this.unexamined = board.getActions();
    this.activePlayer = board.active;
  }

  addChild(board, index) {
    const node = new UctNode(this, board, this.unexamined[index]);
    this.unexamined.splice(index, 1);
    this.children.push(node);
    return node;
  }

  selectChild() {
    return this.children.reduce(
      (best, child) => {
        const uctValue =
          child.wins / child.visits + Math.sqrt((2 * Math.log(this.visits)) / child.visits);
        return uctValue > best.value ? { node: child, value: uctValue } : best;
      },
      { node: null, value: Number.NEGATIVE_INFINITY }
    ).node;
  }

  update(result) {
    // Each node stores value from the perspective of the player choosing
    // this node from its parent. This keeps UCB selection aligned with the
    // current chooser at every tree depth.
    const perspectivePlayer = this.parentNode ? this.parentNode.activePlayer : this.activePlayer;
    this.visits++;
    this.wins += result[perspectivePlayer];
  }

  mostVisitedChild() {
    if (this.children.length === 0) return null;
    return this.children.reduce(
      (most, child) => (child.visits > most.visits ? child : most),
      this.children[0]
    );
  }
}
