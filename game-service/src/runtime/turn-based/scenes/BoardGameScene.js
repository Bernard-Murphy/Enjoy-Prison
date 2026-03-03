var BoardGameScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "BoardGameScene" });
  },

  create: function () {
    var config = GameUtils.getConfig();
    var tb = (config && config.turnBased) || {};
    var common = tb.common || {};
    var boardConfig = tb.boardGame || {};
    var viewport = common.viewport || { width: 800, height: 600 };
    var w = viewport.width;
    var h = viewport.height;

    this.cameras.main.setBackgroundColor(common.backgroundColor || "#1a1a2e");
    this._common = common;
    this._boardConfig = boardConfig;
    this._subType = boardConfig.subType || "snakes-ladders";
    this._layout = boardConfig.layout || "linear";
    this._spaces = boardConfig.spaces || [];
    this._spaceWidth = boardConfig.spaceWidth || 70;
    this._spaceHeight = boardConfig.spaceHeight || 90;

    if (this._spaces.length === 0 && this._subType === "snakes-ladders") {
      var boardSize = boardConfig.boardSize || 100;
      for (var i = 0; i < boardSize; i++) {
        this._spaces.push({
          id: i,
          name: "" + (i + 1),
          type: i === 0 ? "start" : i === boardSize - 1 ? "finish" : "blank",
        });
      }
    }
    if (this._spaces.length === 0) {
      for (var i = 0; i < 20; i++) {
        this._spaces.push({
          id: i,
          name: "Space " + (i + 1),
          type: i === 0 ? "start" : i === 19 ? "finish" : "blank",
        });
      }
    }

    TurnManager.init(common.players || [], 0);
    this._positions = BoardRenderer.calculatePositions(
      this._layout,
      this._spaces,
      this._spaceWidth,
      this._spaceHeight,
      w,
      h,
    );
    this._playerPositions = [];
    for (var p = 0; p < TurnManager.players.length; p++) {
      this._playerPositions[p] = 0;
    }
    if (common.players && common.players.length > 0) {
      for (var i = 0; i < common.players.length; i++) {
        TurnManager.players[i].data = TurnManager.players[i].data || {};
        TurnManager.players[i].data.money = boardConfig.startingMoney || 1500;
        TurnManager.players[i].data.spaceIndex = 0;
      }
    }

    BoardRenderer.renderBoard(
      this,
      this._spaces,
      this._positions,
      this._spaceWidth,
      this._spaceHeight,
    );
    this._tokens = [];
    for (var p = 0; p < TurnManager.players.length; p++) {
      var pos = this._positions[0];
      var color = TurnManager.players[p].color || "#4488ff";
      var token = BoardRenderer.renderPlayerToken(
        this,
        p,
        0,
        this._positions,
        color,
      );
      if (token) this._tokens.push(token);
    }

    this._currentPlayerIndex = 0;
    this._rollButton = this.add.text(w / 2, h - 60, "Roll Dice", {
      fontSize: "28px",
      fill: common.accentColor || "#ffcc00",
    });
    this._rollButton.setOrigin(0.5);
    this._rollButton.setInteractive({ useHandCursor: true });
    var self = this;
    this._rollButton.on("pointerdown", function () {
      self._rollAndMove();
    });
    this._turnLabel = this.add.text(w / 2, 40, "", {
      fontSize: "22px",
      fill: common.primaryTextColor || "#ffffff",
    });
    this._turnLabel.setOrigin(0.5);
    this._updateTurnLabel();
  },

  _updateTurnLabel: function () {
    var cur = TurnManager.getCurrentPlayer();
    if (cur) {
      this._turnLabel.setText(cur.name + "'s turn");
      this._turnLabel.setFill(cur.color || "#ffffff");
    }
  },

  _rollAndMove: function () {
    if (TurnManager.isCurrentPlayerAI()) return;
    var diceCount = this._boardConfig.diceCount || 2;
    var diceSides = this._boardConfig.diceSides || 6;
    var total = 0;
    for (var i = 0; i < diceCount; i++) {
      total += Math.floor(Math.random() * diceSides) + 1;
    }
    var playerIdx = TurnManager.currentPlayerIndex;
    var fromPos = this._playerPositions[playerIdx];
    var toPos = Math.min(fromPos + total, this._positions.length - 1);
    this._playerPositions[playerIdx] = toPos;
    var token = this._tokens[playerIdx];
    if (token) {
      var self = this;
      BoardRenderer.animateMovement(
        this,
        token,
        fromPos,
        toPos,
        this._positions,
        function () {
          var space = self._spaces[toPos];
          if (space && space.type === "finish") {
            self._endBoardGame(TurnManager.players[playerIdx]);
            return;
          }
          if (space && space.linkedSpaceId != null) {
            var linkedIdx = -1;
            for (var si = 0; si < self._spaces.length; si++) {
              if (self._spaces[si].id === space.linkedSpaceId) {
                linkedIdx = si;
                break;
              }
            }
            if (linkedIdx >= 0) {
              self._playerPositions[playerIdx] = linkedIdx;
              BoardRenderer.animateMovement(
                self,
                token,
                toPos,
                linkedIdx,
                self._positions,
                function () {
                  TurnManager.nextTurn(self);
                  self._updateTurnLabel();
                },
              );
              return;
            }
          }
          TurnManager.nextTurn(self);
          self._updateTurnLabel();
        },
      );
    } else {
      TurnManager.nextTurn(this);
      this._updateTurnLabel();
    }
  },

  _endBoardGame: function (winner) {
    var scores = TurnManager.players.map(function (p) {
      return { name: p.name, score: p.score };
    });
    this.scene.start("TBGameOverScene", {
      winner: winner,
      isDraw: false,
      scores: scores,
    });
  },
});
