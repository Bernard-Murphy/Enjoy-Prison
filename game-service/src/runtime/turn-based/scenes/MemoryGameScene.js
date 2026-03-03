var MemoryGameScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "MemoryGameScene" });
  },

  create: function () {
    var config = GameUtils.getConfig();
    var tb = (config && config.turnBased) || {};
    var common = tb.common || {};
    var mem = tb.memoryGame || {};
    var viewport = common.viewport || { width: 800, height: 600 };
    var w = viewport.width;
    var h = viewport.height;

    this.cameras.main.setBackgroundColor(common.backgroundColor || "#1a1a2e");
    this._common = common;
    this._mem = mem;
    this._rows = mem.rows || 4;
    this._cols = mem.cols || 4;
    this._cardsPerTurn = mem.cardsFlippedPerTurn || 2;
    this._flipDuration = mem.flipDuration || 400;
    this._mismatchTime = mem.mismatchShowTime || 1000;
    this._theme = mem.theme || "shapes";
    this._customLabels = mem.customLabels || [];
    this._moveCount = 0;
    this._pairsFound = 0;
    this._flipped = {};
    this._knownCards = {};
    this._totalPairs = (this._rows * this._cols) / 2;

    TurnManager.init(common.players || [], 0);
    var self = this;
    TurnManager.onApplyRemoteMove = function (scene, moveData) {
      scene._applyMove(moveData);
    };
    if (typeof MessageBridge !== "undefined") {
      MessageBridge.init();
      MessageBridge.on("move", function (payload) {
        TurnManager.applyRemoteMove(self, payload);
      });
    }
    this._currentPlayerIndex = 0;
    this._flippedThisTurn = [];
    this._blockInput = false;

    var pairs = this._createPairs();
    this._cards = [];
    var cardW = mem.cardWidth || 80;
    var cardH = mem.cardHeight || 80;
    var spacing = mem.cardSpacing || 8;
    var backColor = mem.cardBackColor
      ? parseInt(String(mem.cardBackColor).replace("#", ""), 16)
      : 0x4455aa;
    var totalW = this._cols * cardW + (this._cols - 1) * spacing;
    var totalH = this._rows * cardH + (this._rows - 1) * spacing;
    var startX = (w - totalW) / 2 + cardW / 2 + spacing / 2;
    var startY = (h - totalH) / 2 + cardH / 2 + spacing / 2;

    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      var row = Math.floor(i / this._cols);
      var col = i % this._cols;
      var x = startX + col * (cardW + spacing);
      var y = startY + row * (cardH + spacing);
      var key = row + "," + col;
      this._cards[key] = {
        row: row,
        col: col,
        value: pair.value,
        display: pair.display,
        x: x,
        y: y,
        graphics: null,
        text: null,
        zone: null,
      };
    }

    for (var key in this._cards) {
      if (!this._cards.hasOwnProperty(key)) continue;
      var card = this._cards[key];
      var g = this.add.graphics();
      g.fillStyle(backColor, 1);
      g.fillRoundedRect(
        card.x - cardW / 2,
        card.y - cardH / 2,
        cardW,
        cardH,
        mem.cardCornerRadius || 8,
      );
      g.lineStyle(mem.cardBorderWidth || 2, 0xaaaaaa, 1);
      g.strokeRoundedRect(
        card.x - cardW / 2,
        card.y - cardH / 2,
        cardW,
        cardH,
        mem.cardCornerRadius || 8,
      );
      card.graphics = g;
      card.text = this.add.text(card.x, card.y, "?", {
        fontSize: "24px",
        color: "#ffffff",
      });
      card.text.setOrigin(0.5);
      card.text.setVisible(false);
      card.zone = this.add.zone(card.x, card.y, cardW, cardH);
      card.zone.setInteractive();
      var self = this;
      (function (k) {
        card.zone.on("pointerdown", function () {
          self._onCardClick(k);
        });
      })(key);
    }

    if (mem.showMoveCounter) {
      this._moveText = this.add.text(w / 2, 30, "Moves: 0", {
        fontSize: "20px",
        fill: common.primaryTextColor || "#ffffff",
      });
      this._moveText.setOrigin(0.5);
    }
    this._turnText = this.add.text(w / 2, 55, "", {
      fontSize: "18px",
      fill: common.secondaryTextColor || "#aaaaaa",
    });
    this._turnText.setOrigin(0.5);
    this._updateTurnIndicator();
  },

  _createPairs: function () {
    var n = this._totalPairs;
    var pairs = [];
    if (this._theme === "custom" && this._customLabels.length >= n) {
      for (var i = 0; i < n; i++) {
        var label = this._customLabels[i];
        pairs.push({ value: "c" + i, display: label.front || "" });
      }
    } else if (this._theme === "letters") {
      var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (var i = 0; i < n; i++) {
        pairs.push({ value: "l" + i, display: letters[i % 26] });
      }
    } else if (this._theme === "numbers") {
      for (var i = 0; i < n; i++) {
        pairs.push({ value: "n" + i, display: "" + (i + 1) });
      }
    } else if (this._theme === "emoji") {
      var emojis = [
        "\u2665",
        "\u2660",
        "\u2663",
        "\u2666",
        "\u2600",
        "\u2601",
        "\u2B50",
        "\u2728",
        "\u26A1",
        "\u2702",
      ];
      for (var i = 0; i < n; i++) {
        pairs.push({ value: "e" + i, display: emojis[i % emojis.length] });
      }
    } else {
      var shapes = ["\u25CF", "\u25A0", "\u25B2", "\u25C6", "\u2729", "\u2B21"];
      for (var i = 0; i < n; i++) {
        pairs.push({ value: "s" + i, display: shapes[i % shapes.length] });
      }
    }
    for (var i = pairs.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pairs[i];
      pairs[i] = pairs[j];
      pairs[j] = t;
    }
    var doubled = [];
    for (var i = 0; i < pairs.length; i++) {
      doubled.push(pairs[i]);
      doubled.push({ value: pairs[i].value, display: pairs[i].display });
    }
    for (var i = doubled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = doubled[i];
      doubled[i] = doubled[j];
      doubled[j] = t;
    }
    return doubled;
  },

  _updateTurnIndicator: function () {
    if (!this._turnText) return;
    if (TurnManager.isCurrentPlayerRemote()) {
      this._turnText.setText("Waiting for opponent...");
      this._turnText.setFill(this._common.secondaryTextColor || "#aaaaaa");
      return;
    }
    var cur = TurnManager.getCurrentPlayer();
    if (cur) {
      this._turnText.setText(cur.name + "'s turn");
      this._turnText.setFill(cur.color || "#ffffff");
    }
  },

  _applyMove: function (moveData) {
    var key = moveData.cardIndex;
    if (!key || this._blockInput || this._flipped[key]) return;
    var card = this._cards[key];
    if (!card) return;

    this._flipped[key] = true;
    this._flippedThisTurn.push(key);
    card.text.setText(card.display);
    card.text.setVisible(true);

    if (this._flippedThisTurn.length >= this._cardsPerTurn) {
      this._moveCount++;
      if (this._mem.showMoveCounter && this._moveText) {
        this._moveText.setText("Moves: " + this._moveCount);
      }
      var first = this._cards[this._flippedThisTurn[0]];
      var second = this._cards[this._flippedThisTurn[1]];
      var match = first && second && first.value === second.value;
      var self = this;
      if (match) {
        this._pairsFound++;
        TurnManager.addScore(this._currentPlayerIndex, 1);
        this.time.delayedCall(this._flipDuration, function () {
          self._flippedThisTurn = [];
          if (self._pairsFound >= self._totalPairs) {
            self._endGame();
          } else {
            self._blockInput = false;
          }
        });
      } else {
        this._blockInput = true;
        this.time.delayedCall(this._mismatchTime, function () {
          self._flipped[self._flippedThisTurn[0]] = false;
          self._flipped[self._flippedThisTurn[1]] = false;
          self._cards[self._flippedThisTurn[0]].text.setVisible(false);
          self._cards[self._flippedThisTurn[1]].text.setVisible(false);
          self._flippedThisTurn = [];
          TurnManager.nextTurn(self);
          self._currentPlayerIndex = TurnManager.currentPlayerIndex;
          self._updateTurnIndicator();
          self._blockInput = false;
        });
      }
    }
  },

  _onCardClick: function (key) {
    if (TurnManager.isCurrentPlayerRemote()) return;
    this._applyMove({ cardIndex: key });
    if (typeof MessageBridge !== "undefined") {
      MessageBridge.send("move", { cardIndex: key });
    }
  },

  _endGame: function () {
    var scores = TurnManager.players.map(function (p) {
      return { name: p.name, score: p.score };
    });
    var winner = null;
    var maxScore = 0;
    for (var i = 0; i < scores.length; i++) {
      if (scores[i].score > maxScore) {
        maxScore = scores[i].score;
        winner = TurnManager.players[i];
      }
    }
    this.scene.start("TBGameOverScene", {
      winner: winner,
      isDraw: false,
      scores: scores,
    });
  },
});
