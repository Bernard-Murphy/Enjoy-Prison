var GameOverScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "GameOverScene" });
  },
  create: function (data) {
    var config = GameUtils.getConfig();
    var go = config.scenes.gameOver || {};
    var w = config.meta.viewport.width;
    var h = config.meta.viewport.height;

    var won = data && data.won;
    var score = (data && data.score) || 0;
    var title = won ? go.winTitle || "You Win!" : go.loseTitle || "Game Over";
    if (won) SoundGenerator.play("win");

    var titleText = this.add.text(w / 2, h / 2 - 60, title, {
      fontSize: "42px",
      fill: won ? "#00ff88" : "#ff6666",
    });
    titleText.setOrigin(0.5);

    if (go.showScore !== false) {
      var scoreText = this.add.text(w / 2, h / 2 - 10, "Score: " + score, {
        fontSize: "24px",
        fill: "#ffffff",
      });
      scoreText.setOrigin(0.5);
    }

    if (go.showRetryButton !== false) {
      var again = this.add.text(w / 2, h / 2 + 40, "Play Again", {
        fontSize: "28px",
        fill: "#88ccff",
      });
      again.setOrigin(0.5);
      again.setInteractive({ useHandCursor: true });
      again.on(
        "pointerdown",
        function () {
          this.scene.start("GameScene");
        },
        this,
      );

      var menu = this.add.text(w / 2, h / 2 + 90, "Main Menu", {
        fontSize: "24px",
        fill: "#aaaaaa",
      });
      menu.setOrigin(0.5);
      menu.setInteractive({ useHandCursor: true });
      menu.on(
        "pointerdown",
        function () {
          this.scene.start("MenuScene");
        },
        this,
      );
    }
  },
});
