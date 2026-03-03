var TBGameOverScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "TBGameOverScene" });
  },
  create: function (data) {
    var config = GameUtils.getConfig();
    var tb = (config && config.turnBased) || {};
    var common = tb.common || {};
    var viewport = common.viewport || { width: 800, height: 600 };
    var w = viewport.width || 800;
    var h = viewport.height || 600;

    this.cameras.main.setBackgroundColor(common.backgroundColor || "#1a1a2e");

    var winner = (data && data.winner) || null;
    var isDraw = (data && data.isDraw) || false;
    var scores = (data && data.scores) || [];
    var message = (data && data.message) || "";

    if (!message) {
      if (isDraw) message = common.drawMessage || "It's a draw!";
      else if (winner)
        message = (common.winMessage || "{player} wins!").replace(
          "{player}",
          winner.name || "Winner",
        );
      else message = common.loseMessage || "Game Over!";
    }

    var titleText = this.add.text(w / 2, h / 2 - 80, message, {
      fontSize: "36px",
      fill: isDraw
        ? common.secondaryTextColor || "#aaaaaa"
        : common.accentColor || "#ffcc00",
    });
    titleText.setOrigin(0.5);

    if (scores && scores.length > 0 && common.showScore !== false) {
      var y = h / 2 - 30;
      for (var i = 0; i < scores.length; i++) {
        var s = scores[i];
        var line = (s.name || "Player " + (i + 1)) + ": " + (s.score || 0);
        var scoreText = this.add.text(w / 2, y + i * 28, line, {
          fontSize: "22px",
          fill: common.primaryTextColor || "#ffffff",
        });
        scoreText.setOrigin(0.5);
      }
    }

    var gameSceneKey = "GridGameScene";
    if (tb.subGenre === "word-game") gameSceneKey = "WordGameScene";
    else if (tb.subGenre === "board-game") gameSceneKey = "BoardGameScene";
    else if (tb.subGenre === "memory-game") gameSceneKey = "MemoryGameScene";
    else if (tb.subGenre === "trivia-game") gameSceneKey = "TriviaGameScene";
    else if (tb.subGenre === "card-game") gameSceneKey = "CardGameScene";

    var again = this.add.text(w / 2, h / 2 + 80, "Play Again", {
      fontSize: "28px",
      fill: common.accentColor || "#ffcc00",
    });
    again.setOrigin(0.5);
    again.setInteractive({ useHandCursor: true });
    again.on("pointerover", function (t) {
      t.setFill("#ffdd44");
    });
    again.on("pointerout", function (t) {
      t.setFill(common.accentColor || "#ffcc00");
    });
    var sceneKey = gameSceneKey;
    again.on(
      "pointerdown",
      function () {
        TurnManager.reset();
        this.scene.start(sceneKey);
      },
      this,
    );

    var menuBtn = this.add.text(w / 2, h / 2 + 120, "Main Menu", {
      fontSize: "24px",
      fill: common.secondaryTextColor || "#aaaaaa",
    });
    menuBtn.setOrigin(0.5);
    menuBtn.setInteractive({ useHandCursor: true });
    menuBtn.on(
      "pointerdown",
      function () {
        this.scene.start("TBMenuScene");
      },
      this,
    );
  },
});
