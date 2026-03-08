var TBMenuScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "TBMenuScene" });
  },
  create: function () {
    var config = GameUtils.getConfig();
    var tb = (config && config.turnBased) || {};
    var common = tb.common || {};
    var menu = common.menu || {};
    var viewport = common.viewport || { width: 800, height: 600 };
    var w = viewport.width || 800;
    var h = viewport.height || 600;

    this.cameras.main.setBackgroundColor(
      menu.backgroundColor || common.backgroundColor || "#1a1a2e",
    );

    var logoY = h / 2 - 160;
    var titleY = h / 2 - 80;
    if (this.textures.exists("menuLogo")) {
      var logo = this.add.image(w / 2, logoY, "menuLogo");
      var maxW = 200;
      if (logo.width > maxW) {
        logo.setDisplaySize(maxW, (logo.height * maxW) / logo.width);
      }
      titleY = h / 2 - 40;
    }

    var title = this.add.text(
      w / 2,
      titleY,
      menu.title || common.title || "My Game",
      { fontSize: "48px", fill: common.primaryTextColor || "#ffffff" },
    );
    title.setOrigin(0.5);

    var subtitle = this.add.text(w / 2, titleY + 36, menu.subtitle || "", {
      fontSize: "24px",
      fill: common.secondaryTextColor || "#aaaaaa",
    });
    subtitle.setOrigin(0.5);

    var gameSceneKey = "GridGameScene";
    if (tb.subGenre === "word-game") gameSceneKey = "WordGameScene";
    else if (tb.subGenre === "board-game") gameSceneKey = "BoardGameScene";
    else if (tb.subGenre === "memory-game") gameSceneKey = "MemoryGameScene";
    else if (tb.subGenre === "trivia-game") gameSceneKey = "TriviaGameScene";
    else if (tb.subGenre === "card-game") gameSceneKey = "CardGameScene";
    else gameSceneKey = "GridGameScene";

    var startBtn = this.add.text(w / 2, titleY + 86, "Start Game", {
      fontSize: "28px",
      fill: common.accentColor || "#ffcc00",
    });
    startBtn.setOrigin(0.5);
    startBtn.setInteractive({ useHandCursor: true });
    startBtn.on("pointerover", function (l) {
      l.setFill("#ffdd44");
    });
    startBtn.on("pointerout", function (l) {
      l.setFill(common.accentColor || "#ffcc00");
    });
    var sceneKey = gameSceneKey;
    startBtn.on(
      "pointerdown",
      function () {
        TurnManager.reset();
        this.scene.start(sceneKey);
      },
      this,
    );

    if (menu.showPlayerSetup && common.players && common.players.length > 0) {
      var y = titleY + 146;
      for (var i = 0; i < Math.min(common.players.length, 4); i++) {
        var p = common.players[i];
        var label = this.add.text(
          w / 2 - 150,
          y + i * 32,
          (p.name || "Player " + (i + 1)) + " (" + (p.type || "human") + ")",
          { fontSize: "18px", fill: common.secondaryTextColor || "#aaaaaa" },
        );
      }
    }
  },
});
