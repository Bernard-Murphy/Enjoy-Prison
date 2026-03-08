var TBBootScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "TBBootScene" });
  },
  preload: function () {
    var config = GameUtils.getConfig();
    var menu =
      (config &&
        config.turnBased &&
        config.turnBased.common &&
        config.turnBased.common.menu) ||
      {};
    if (menu.logoUrl && typeof menu.logoUrl === "string") {
      this.load.image("menuLogo", menu.logoUrl);
    }
  },
  create: function () {
    var config = GameUtils.getConfig();
    var tb = (config && config.turnBased) || {};
    var common = tb.common || {};
    var viewport = common.viewport || { width: 800, height: 600 };

    WordList.init();
    TurnManager.init(common.players || [], common.turnTimeLimit || 0);
    StateManager.init({});

    var text = this.add.text(
      viewport.width / 2,
      viewport.height / 2,
      "Loading...",
      { fontSize: "24px", fill: "#ffffff" },
    );
    text.setOrigin(0.5);

    this.time.delayedCall(
      300,
      function () {
        this.scene.start("TBMenuScene");
      },
      [],
      this,
    );
  },
});
