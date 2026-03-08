var BootScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "BootScene" });
  },
  preload: function () {
    var config = GameUtils.getConfig();
    var menu = (config && config.scenes && config.scenes.menu) || {};
    if (menu.logoUrl && typeof menu.logoUrl === "string") {
      this.load.image("menuLogo", menu.logoUrl);
    }
  },
  create: function () {
    var config = GameUtils.getConfig();

    var text = this.add.text(
      config.meta.viewport.width / 2,
      config.meta.viewport.height / 2,
      "Loading...",
      { fontSize: "24px", fill: "#ffffff" },
    );
    text.setOrigin(0.5);

    SpriteGenerator.generateAll(this);
    SoundGenerator.init(this);

    this.time.delayedCall(
      500,
      function () {
        this.scene.start("MenuScene");
      },
      [],
      this,
    );
  },
});
