var CardGameScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "CardGameScene" });
  },

  create: function () {
    var config = GameUtils.getConfig();
    var tb = (config && config.turnBased) || {};
    var common = tb.common || {};
    var cardConfig = tb.cardGame || {};
    var viewport = common.viewport || { width: 800, height: 600 };
    var w = viewport.width;
    var h = viewport.height;

    this.cameras.main.setBackgroundColor(common.backgroundColor || "#1a1a2e");
    this._common = common;
    this._cardConfig = cardConfig;
    this._subType = cardConfig.subType || "war";

    var deck;
    if (cardConfig.useStandardDeck !== false) {
      deck = DeckBuilder.buildStandardDeck(
        cardConfig.standardDeckCount || 1,
        cardConfig.includeJokers || false,
      );
    } else {
      deck = DeckBuilder.buildCustomDeck(cardConfig.customCards || []);
    }
    deck = DeckBuilder.shuffle(deck);

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
    var playerCount = Math.max(1, (common.players || []).length);
    var cardsPerPlayer = cardConfig.cardsPerPlayer || 7;
    if (this._subType === "war") {
      cardsPerPlayer = Math.floor(deck.length / playerCount);
    }
    if (this._subType === "blackjack") {
      cardsPerPlayer = 2;
    }

    var dealt = DeckBuilder.deal(deck, playerCount, cardsPerPlayer);
    this._hands = dealt.hands;
    this._drawPile = dealt.remaining;
    this._discardPile = [];
    this._topDiscard = null;
    this._currentPlayerIndex = 0;
    this._cardW = cardConfig.cardWidth || 70;
    this._cardH = cardConfig.cardHeight || 100;

    if (this._subType === "war") {
      this._initWar();
    } else if (this._subType === "shedding") {
      this._initShedding();
    } else if (this._subType === "blackjack") {
      this._initBlackjack();
    } else {
      this._initMatching();
    }
  },

  _initWar: function () {
    var w = this._common.viewport.width || 800;
    var h = this._common.viewport.height || 600;
    this._warPlayerCards = [];
    this._warOpponentCards = [];
    this._renderHand(0, this._hands[0], h - 100);
    this._opponentCount = this.add.text(
      w / 2,
      80,
      "Opponent: " + (this._hands[1] ? this._hands[1].length : 0) + " cards",
      {
        fontSize: "20px",
        fill: "#ffffff",
      },
    );
    this._opponentCount.setOrigin(0.5);
    this._playerCount = this.add.text(
      w / 2,
      h - 140,
      "You: " + this._hands[0].length + " cards",
      {
        fontSize: "20px",
        fill: "#ffffff",
      },
    );
    this._playerCount.setOrigin(0.5);
    var self = this;
    this._warButton = this.add.text(w / 2, h / 2, "Play Card", {
      fontSize: "24px",
      fill: "#ffcc00",
    });
    this._warButton.setOrigin(0.5);
    this._warButton.setInteractive({ useHandCursor: true });
    this._warButton.on("pointerdown", function () {
      if (TurnManager.isCurrentPlayerRemote()) return;
      self._applyMove({ action: "warPlay" });
      if (typeof MessageBridge !== "undefined") {
        MessageBridge.send("move", { action: "warPlay" });
      }
    });
  },

  _applyMove: function (moveData) {
    var action = moveData && moveData.action;
    if (action === "warPlay" && this._subType === "war") {
      this._warPlay();
    } else if (action === "draw" && this._subType === "shedding") {
      if (this._drawPile.length > 0) {
        var card = this._drawPile.pop();
        this._hands[0].push(card);
        TurnManager.nextTurn(this);
      }
    }
  },

  _renderHand: function (playerIndex, hand, y) {
    var w = this._common.viewport.width || 800;
    var isHuman = playerIndex === 0;
    var cardW = this._cardW;
    var cardH = this._cardH;
    var count = hand.length;
    var totalW = Math.min(count * (cardW * 0.35 + 4), w - 40);
    var startX = (w - totalW) / 2 + (cardW * 0.35) / 2 + 2;
    var cards = [];
    for (var i = 0; i < hand.length; i++) {
      var x = startX + i * (cardW * 0.35 + 4);
      var card = hand[i];
      var g = this.add.graphics();
      g.fillStyle(0x1a3a6a, 1);
      g.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 6);
      g.lineStyle(2, 0xffffff, 1);
      g.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 6);
      var label = isHuman ? card.displayName || card.value : "?";
      var t = this.add.text(x, y, label, {
        fontSize: "14px",
        color: "#ffffff",
      });
      t.setOrigin(0.5);
      cards.push({ graphics: g, text: t, x: x, y: y, card: card, index: i });
    }
    return cards;
  },

  _warPlay: function () {
    if (TurnManager.isCurrentPlayerRemote()) return;
    if (
      this._hands[0].length === 0 ||
      (this._hands[1] && this._hands[1].length === 0)
    ) {
      this._endCardGame();
      return;
    }
    var c1 = this._hands[0].pop();
    var c2 = this._hands[1].pop();
    var v1 = c1.points || parseInt(c1.value, 10) || 10;
    if (c1.value === "J") v1 = 11;
    if (c1.value === "Q") v1 = 12;
    if (c1.value === "K") v1 = 13;
    if (c1.value === "A") v1 = 14;
    var v2 = c2.points || parseInt(c2.value, 10) || 10;
    if (c2.value === "J") v2 = 11;
    if (c2.value === "Q") v2 = 12;
    if (c2.value === "K") v2 = 13;
    if (c2.value === "A") v2 = 14;
    if (v1 > v2) {
      this._hands[0].push(c1);
      this._hands[0].push(c2);
    } else if (v2 > v1) {
      this._hands[1].push(c1);
      this._hands[1].push(c2);
    } else {
      this._hands[0].push(c1);
      this._hands[1].push(c2);
    }
    this._opponentCount.setText(
      "Opponent: " + this._hands[1].length + " cards",
    );
    this._playerCount.setText("You: " + this._hands[0].length + " cards");
    if (this._hands[0].length === 0) this._endCardGame();
    if (this._hands[1].length === 0) this._endCardGame();
  },

  _initShedding: function () {
    if (this._discardPile.length === 0 && this._drawPile.length > 0) {
      this._topDiscard = this._drawPile.pop();
      this._discardPile.push(this._topDiscard);
    }
    this._renderSheddingUI();
  },

  _renderSheddingUI: function () {
    var w = this._common.viewport.width || 800;
    var h = this._common.viewport.height || 600;
    this._playerCount = this.add.text(
      w / 2,
      h - 20,
      "Cards: " + this._hands[0].length,
      {
        fontSize: "20px",
        fill: "#ffffff",
      },
    );
    this._playerCount.setOrigin(0.5);
    if (this._topDiscard) {
      var g = this.add.graphics();
      g.fillStyle(0x2a4a8a, 1);
      g.fillRoundedRect(
        w / 2 - this._cardW / 2,
        h / 2 - this._cardH / 2,
        this._cardW,
        this._cardH,
        6,
      );
      this.add
        .text(
          w / 2,
          h / 2,
          this._topDiscard.displayName || this._topDiscard.value,
          {
            fontSize: "18px",
            color: "#ffffff",
          },
        )
        .setOrigin(0.5);
    }
    var self = this;
    var drawBtn = this.add.text(w / 2 + 100, h / 2, "Draw", {
      fontSize: "22px",
      fill: "#88ccff",
    });
    drawBtn.setOrigin(0.5);
    drawBtn.setInteractive({ useHandCursor: true });
    drawBtn.on("pointerdown", function () {
      if (TurnManager.isCurrentPlayerRemote()) return;
      if (self._drawPile.length > 0) {
        self._applyMove({ action: "draw" });
        if (typeof MessageBridge !== "undefined") {
          MessageBridge.send("move", { action: "draw" });
        }
      }
    });
  },

  _initBlackjack: function () {
    var target = this._cardConfig.targetScore || 21;
    this._handTotals = [0, 0];
    this._endBlackjack();
  },

  _initMatching: function () {
    this._endCardGame();
  },

  _endCardGame: function () {
    var winner = null;
    if (this._subType === "war") {
      if (
        this._hands[0].length > (this._hands[1] ? this._hands[1].length : 0)
      ) {
        winner = TurnManager.players[0];
      } else if (
        this._hands[1] &&
        this._hands[1].length > this._hands[0].length
      ) {
        winner = TurnManager.players[1];
      }
    }
    var scores = TurnManager.players.map(function (p) {
      return { name: p.name, score: p.score };
    });
    this.scene.start("TBGameOverScene", {
      winner: winner,
      isDraw: !winner && this._subType === "war",
      scores: scores,
    });
  },

  _endBlackjack: function () {
    this.scene.start("TBGameOverScene", {
      winner: null,
      isDraw: false,
      scores: TurnManager.players.map(function (p) {
        return { name: p.name, score: p.score };
      }),
    });
  },
});
