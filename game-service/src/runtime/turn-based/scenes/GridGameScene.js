var GridGameScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "GridGameScene" });
  },

  create: function () {
    var config = GameUtils.getConfig();
    var tb = (config && config.turnBased) || {};
    var common = tb.common || {};
    var grid = tb.gridGame || {};
    var viewport = common.viewport || { width: 800, height: 600 };
    var w = viewport.width;
    var h = viewport.height;

    this.cameras.main.setBackgroundColor(common.backgroundColor || "#1a1a2e");

    var rows = grid.rows || 3;
    var cols = grid.cols || 3;
    var cellSize = grid.cellSize || 100;
    var spacing = grid.gridSpacing || 4;
    var placement = grid.placement || "any-empty";
    var winCond = grid.winCondition || {};
    var winCount = winCond.count || 3;
    var pieceStyle = grid.pieceStyle || "symbol";

    this._gridConfig = grid;
    this._common = common;
    this._rows = rows;
    this._cols = cols;
    this._cellSize = cellSize;
    this._spacing = spacing;
    this._placement = placement;
    this._winCount = winCount;
    this._pieceStyle = pieceStyle;
    this._winCond = winCond;

    this._board = [];
    for (var r = 0; r < rows; r++) {
      this._board[r] = [];
      for (var c = 0; c < cols; c++) {
        this._board[r][c] = null;
      }
    }

    var totalW = cols * cellSize + (cols - 1) * spacing;
    var totalH = rows * cellSize + (rows - 1) * spacing;
    this._gridOriginX = (w - totalW) / 2 + cellSize / 2 + spacing / 2;
    this._gridOriginY = (h - totalH) / 2 + cellSize / 2 + spacing / 2;

    this._cells = [];
    var graphics = this.add.graphics();
    var cellColor = grid.cellColor
      ? parseInt(String(grid.cellColor).replace("#", ""), 16)
      : 0x2a2a4a;
    var borderColor = grid.cellBorderColor
      ? parseInt(String(grid.cellBorderColor).replace("#", ""), 16)
      : 0xffffff;
    var borderWidth = grid.cellBorderWidth != null ? grid.cellBorderWidth : 2;
    var radius = grid.cellCornerRadius != null ? grid.cellCornerRadius : 4;

    for (var r = 0; r < rows; r++) {
      this._cells[r] = [];
      for (var c = 0; c < cols; c++) {
        var x = this._gridOriginX + c * (cellSize + spacing);
        var y = this._gridOriginY + r * (cellSize + spacing);
        graphics.fillStyle(cellColor, 1);
        graphics.fillRoundedRect(
          x - cellSize / 2,
          y - cellSize / 2,
          cellSize,
          cellSize,
          radius,
        );
        graphics.lineStyle(borderWidth, borderColor, 1);
        graphics.strokeRoundedRect(
          x - cellSize / 2,
          y - cellSize / 2,
          cellSize,
          cellSize,
          radius,
        );
        var zone = this.add.zone(x, y, cellSize, cellSize);
        zone.setInteractive();
        zone.setData("row", r);
        zone.setData("col", c);
        this._cells[r][c] = { x: x, y: y, zone: zone };
      }
    }
    this._graphics = graphics;

    var self = this;
    TurnManager.init(common.players || [], common.turnTimeLimit || 0);
    TurnManager.onTurnStart = function (player, scene) {
      self._updateTurnIndicator();
    };
    TurnManager.onAITurn = function (player, scene) {
      self._doAIMove();
    };
    TurnManager.onApplyRemoteMove = function (scene, moveData) {
      scene._applyMove(moveData);
    };
    if (typeof MessageBridge !== "undefined") {
      MessageBridge.init();
      MessageBridge.on("move", function (payload) {
        TurnManager.applyRemoteMove(self, payload);
      });
    }

    this._updateTurnIndicator();
    if (common.showTurnIndicator) {
      this._turnText = this.add.text(w / 2, 40, "", {
        fontSize: "24px",
        fill: common.primaryTextColor || "#ffffff",
      });
      this._turnText.setOrigin(0.5);
    }

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        (function (row, col) {
          self._cells[row][col].zone.on("pointerdown", function () {
            self._onCellClick(row, col);
          });
        })(r, c);
      }
    }
  },

  _updateTurnIndicator: function () {
    var common = this._common;
    if (!this._turnText) return;
    if (TurnManager.isCurrentPlayerRemote()) {
      this._turnText.setText("Waiting for opponent...");
      this._turnText.setFill(common.secondaryTextColor || "#aaaaaa");
      return;
    }
    if (TurnManager.getCurrentPlayer()) {
      var msg = (common.turnStartMessage || "{player}'s turn").replace(
        "{player}",
        TurnManager.getCurrentPlayer().name,
      );
      this._turnText.setText(msg);
      this._turnText.setFill(TurnManager.getCurrentPlayer().color || "#ffffff");
    }
  },

  _getLowestEmptyRow: function (col) {
    for (var r = this._rows - 1; r >= 0; r--) {
      if (this._board[r][col] === null) return r;
    }
    return -1;
  },

  _isValidMove: function (row, col) {
    if (this._board[row][col] !== null) return false;
    if (this._placement === "gravity-bottom") {
      return row === this._getLowestEmptyRow(col);
    }
    return true;
  },

  _applyMove: function (moveData) {
    var row = moveData.row;
    var col = moveData.col;
    if (row == null || col == null) return;
    if (!this._isValidMove(row, col)) return;
    var self = this;
    this._placePiece(row, col, TurnManager.getCurrentPlayer(), function () {
      var result = self._checkGameOver();
      if (result) {
        self._endGame(result);
      } else {
        TurnManager.nextTurn(self);
      }
    });
  },

  _onCellClick: function (row, col) {
    if (TurnManager.isGameOver) return;
    if (TurnManager.isCurrentPlayerAI()) return;
    if (TurnManager.isCurrentPlayerRemote()) return;
    if (!this._isValidMove(row, col)) return;

    this._applyMove({ row: row, col: col });
    if (typeof MessageBridge !== "undefined") {
      MessageBridge.send("move", { row: row, col: col });
    }
  },

  _placePiece: function (row, col, player, onComplete) {
    this._board[row][col] = player.symbol;
    var cell = this._cells[row][col];
    var x = cell.x;
    var y = cell.y;

    if (this._placement === "gravity-bottom" && row < this._rows - 1) {
      var dropY = y;
      var startY = this._gridOriginY - this._cellSize / 2 - this._spacing;
      var piece = this._drawPieceAt(x, startY, player);
      piece.setAlpha(1);
      this.tweens.add({
        targets: piece,
        y: dropY,
        duration: 200,
        ease: "Bounce.easeOut",
        onComplete: function () {
          if (onComplete) onComplete();
        },
      });
    } else {
      var p = this._drawPieceAt(x, y, player);
      p.setScale(0);
      this.tweens.add({
        targets: p,
        scale: 1,
        duration: 150,
        ease: "Back.easeOut",
        onComplete: function () {
          if (onComplete) onComplete();
        },
      });
    }
  },

  _drawPieceAt: function (x, y, player) {
    var style = this._pieceStyle;
    var color = player.color
      ? parseInt(String(player.color).replace("#", ""), 16)
      : 0x4488ff;
    var symbol = player.symbol || "?";

    if (style === "symbol") {
      var text = this.add.text(x, y, symbol, {
        fontSize: String(Math.floor(this._cellSize * 0.5)) + "px",
        color: "#ffffff",
      });
      text.setOrigin(0.5);
      return text;
    }
    if (style === "fill-cell") {
      var g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRoundedRect(
        x - this._cellSize / 2 + 4,
        y - this._cellSize / 2 + 4,
        this._cellSize - 8,
        this._cellSize - 8,
        4,
      );
      return g;
    }
    if (style === "circle" || style === "custom") {
      var circle = this.add.circle(x, y, this._cellSize / 3, color);
      return circle;
    }
    var fallback = this.add.text(x, y, symbol, {
      fontSize: String(Math.floor(this._cellSize * 0.5)) + "px",
      color: "#ffffff",
    });
    fallback.setOrigin(0.5);
    return fallback;
  },

  _checkGameOver: function () {
    var winCond = this._winCond;
    var type = winCond.type || "n-in-a-row";
    var directions = winCond.directions || [
      "horizontal",
      "vertical",
      "diagonal-down",
      "diagonal-up",
    ];
    var deltas = {
      horizontal: { dr: 0, dc: 1 },
      vertical: { dr: 1, dc: 0 },
      "diagonal-down": { dr: 1, dc: 1 },
      "diagonal-up": { dr: -1, dc: 1 },
    };

    for (var r = 0; r < this._rows; r++) {
      for (var c = 0; c < this._cols; c++) {
        var sym = this._board[r][c];
        if (!sym) continue;
        for (var d = 0; d < directions.length; d++) {
          var delta = deltas[directions[d]];
          if (!delta) continue;
          var count = 1;
          var r2 = r + delta.dr;
          var c2 = c + delta.dc;
          while (
            r2 >= 0 &&
            r2 < this._rows &&
            c2 >= 0 &&
            c2 < this._cols &&
            this._board[r2][c2] === sym
          ) {
            count++;
            r2 += delta.dr;
            c2 += delta.dc;
          }
          r2 = r - delta.dr;
          c2 = c - delta.dc;
          while (
            r2 >= 0 &&
            r2 < this._rows &&
            c2 >= 0 &&
            c2 < this._cols &&
            this._board[r2][c2] === sym
          ) {
            count++;
            r2 -= delta.dr;
            c2 -= delta.dc;
          }
          if (count >= this._winCount) {
            var winner = null;
            for (var i = 0; i < TurnManager.players.length; i++) {
              if (TurnManager.players[i].symbol === sym) {
                winner = TurnManager.players[i];
                break;
              }
            }
            return { winner: winner, isDraw: false };
          }
        }
      }
    }

    var drawCondition = this._gridConfig.drawCondition || "board-full";
    if (drawCondition === "board-full") {
      var full = true;
      for (var r = 0; r < this._rows; r++) {
        for (var c = 0; c < this._cols; c++) {
          if (this._board[r][c] === null) {
            full = false;
            break;
          }
        }
      }
      if (full) return { winner: null, isDraw: true };
    }
    return null;
  },

  _doAIMove: function () {
    var player = TurnManager.getCurrentPlayer();
    var opponent = null;
    for (var i = 0; i < TurnManager.players.length; i++) {
      if (TurnManager.players[i].index !== player.index) {
        opponent = TurnManager.players[i];
        break;
      }
    }
    if (!opponent) opponent = TurnManager.players[0];

    var move = AIOpponent.getGridMove(
      this._board,
      this._rows,
      this._cols,
      player,
      opponent,
      player.aiDifficulty || "medium",
      this._gridConfig,
    );
    if (!move) {
      TurnManager.nextTurn(this);
      return;
    }
    this._applyMove({ row: move.row, col: move.col });
  },

  _endGame: function (result) {
    TurnManager.isGameOver = true;
    var scores = TurnManager.players.map(function (p) {
      return { name: p.name, score: p.score };
    });
    if (result.winner) {
      result.winner.score += 1;
      scores = TurnManager.players.map(function (p) {
        return { name: p.name, score: p.score };
      });
    }
    this.scene.start("TBGameOverScene", {
      winner: result.winner,
      isDraw: result.isDraw,
      scores: scores,
    });
  },
});
