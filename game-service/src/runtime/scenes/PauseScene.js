var PauseScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "PauseScene" });
  },
  create: function () {
    var config = GameUtils.getConfig();
    var w = config.meta.viewport.width;
    var h = config.meta.viewport.height;

    var bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6);
    bg.setInteractive();
    var text = this.add.text(w / 2, h / 2 - 30, "PAUSED", {
      fontSize: "48px",
      fill: "#ffffff",
    });
    text.setOrigin(0.5);
    var resume = this.add.text(w / 2, h / 2 + 30, "Resume", {
      fontSize: "24px",
      fill: "#88ccff",
    });
    resume.setOrigin(0.5);
    resume.setInteractive({ useHandCursor: true });
    resume.on(
      "pointerdown",
      function () {
        this.scene.stop("PauseScene");
        this.scene.resume("GameScene");
      },
      this,
    );
  },
});
