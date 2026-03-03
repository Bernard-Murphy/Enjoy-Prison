var TurnManager = {
  currentPlayerIndex: 0,
  turnNumber: 1,
  players: [],
  turnTimer: null,
  turnTimeRemaining: 0,
  onTurnStart: null,
  onTurnEnd: null,
  onTurnTimeout: null,
  onAITurn: null,
  onRemoteTurn: null,
  onApplyRemoteMove: null,
  isGameOver: false,

  init: function (players, timeLimit) {
    this.players = players.map(function (p, i) {
      return {
        index: i,
        name: p.name,
        type: p.type,
        aiDifficulty: p.aiDifficulty || "medium",
        color: p.color,
        symbol: p.symbol || "",
        score: 0,
        isEliminated: false,
        data: {},
      };
    });
    this.currentPlayerIndex = 0;
    this.turnNumber = 1;
    this.timeLimit = timeLimit || 0;
    this.isGameOver = false;
  },

  getCurrentPlayer: function () {
    return this.players[this.currentPlayerIndex];
  },

  isCurrentPlayerAI: function () {
    var cur = this.getCurrentPlayer();
    return cur && cur.type === "ai";
  },

  isCurrentPlayerRemote: function () {
    var cur = this.getCurrentPlayer();
    return cur && cur.type === "remote";
  },

  nextTurn: function (scene) {
    if (this.isGameOver) return;

    var turnMgr = this;

    if (this.onTurnEnd) {
      this.onTurnEnd(this.getCurrentPlayer());
    }

    var startIndex = this.currentPlayerIndex;
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
      if (this.currentPlayerIndex === 0) {
        this.turnNumber++;
      }
    } while (
      this.players[this.currentPlayerIndex].isEliminated &&
      this.currentPlayerIndex !== startIndex
    );

    var activePlayers = this.players.filter(function (p) {
      return !p.isEliminated;
    });
    if (activePlayers.length <= 1) {
      this.isGameOver = true;
      return;
    }

    if (this.onTurnStart) {
      this.onTurnStart(this.getCurrentPlayer(), scene);
    }

    if (this.timeLimit > 0) {
      this.turnTimeRemaining = this.timeLimit;
      if (this.turnTimer) {
        this.turnTimer.remove();
      }
      this.turnTimer = scene.time.addEvent({
        delay: 1000,
        repeat: this.timeLimit - 1,
        callback: function () {
          turnMgr.turnTimeRemaining--;
          if (turnMgr.turnTimeRemaining <= 0 && turnMgr.onTurnTimeout) {
            turnMgr.onTurnTimeout(turnMgr.getCurrentPlayer(), scene);
          }
        },
      });
    }

    if (this.isCurrentPlayerAI() && this.onAITurn) {
      scene.time.delayedCall(
        500,
        function () {
          if (turnMgr.onAITurn) {
            turnMgr.onAITurn(turnMgr.getCurrentPlayer(), scene);
          }
        },
        [],
        this,
      );
    }

    if (this.isCurrentPlayerRemote() && this.onRemoteTurn) {
      this.onRemoteTurn(this.getCurrentPlayer(), scene);
    }
  },

  /**
   * Called when a move arrives from the network. Invokes the scene's handler
   * (e.g. _applyMove). The scene is responsible for applying the move and
   * then calling nextTurn.
   */
  applyRemoteMove: function (scene, moveData) {
    if (this.onApplyRemoteMove) {
      this.onApplyRemoteMove(scene, moveData);
    }
  },

  setCurrentPlayer: function (playerIndex) {
    this.currentPlayerIndex = playerIndex;
  },

  eliminatePlayer: function (playerIndex) {
    this.players[playerIndex].isEliminated = true;
  },

  getActivePlayers: function () {
    return this.players.filter(function (p) {
      return !p.isEliminated;
    });
  },

  getPlayerByIndex: function (index) {
    return this.players[index];
  },

  addScore: function (playerIndex, points) {
    this.players[playerIndex].score += points;
  },

  reset: function () {
    this.currentPlayerIndex = 0;
    this.turnNumber = 1;
    this.isGameOver = false;
    for (var i = 0; i < this.players.length; i++) {
      this.players[i].score = 0;
      this.players[i].isEliminated = false;
      this.players[i].data = {};
    }
  },

  destroy: function () {
    if (this.turnTimer) {
      this.turnTimer.remove();
      this.turnTimer = null;
    }
  },
};
