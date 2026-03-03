var HUDScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "HUDScene" });
  },
  create: function (data) {
    var config = GameUtils.getConfig();
    var ui = config.ui || {};
    var w = config.meta.viewport.width;
    var h = config.meta.viewport.height;

    this.player = data.player;
    this.players = data.players || (this.player ? [this.player] : []);

    if (ui.showHealthBar && this.player) {
      this.healthBarBg = this.add
        .rectangle(20, 20, 200, 20, 0x333333)
        .setOrigin(0, 0);
      this.healthBar = this.add
        .rectangle(20, 20, 200, 20, 0x00ff00)
        .setOrigin(0, 0);
      this.healthBar.setScrollFactor(0);
      this.healthBarBg.setScrollFactor(0);
    }
    if (this.players.length > 1 && ui.showHealthBar) {
      var other =
        this.players[0] === this.player ? this.players[1] : this.players[0];
      if (other) {
        this.healthBar2Bg = this.add
          .rectangle(w - 20, 20, 120, 14, 0x333333)
          .setOrigin(1, 0);
        this.healthBar2 = this.add
          .rectangle(w - 20, 20, 120, 14, 0xff8800)
          .setOrigin(1, 0);
        this.healthBar2.setScrollFactor(0);
        this.healthBar2Bg.setScrollFactor(0);
        this._otherPlayer = other;
      }
    }
    if (ui.showScore) {
      this.scoreText = this.add.text(20, 50, "Score: 0", {
        fontSize: "18px",
        fill: "#ffffff",
      });
      this.scoreText.setScrollFactor(0);
    }
    if (ui.showLives) {
      this.livesText = this.add.text(
        20,
        75,
        "Lives: " + (this.player ? this.player.livesLeft : 0),
        {
          fontSize: "18px",
          fill: "#ffffff",
        },
      );
      this.livesText.setScrollFactor(0);
    }
    if (ui.showTimer) {
      this.timerText = this.add.text(w - 20, 20, "0", {
        fontSize: "18px",
        fill: "#ffffff",
      });
      this.timerText.setOrigin(1, 0);
      this.timerText.setScrollFactor(0);
      this.timerStart = this.game.getTime();
      this.timerDirection = ui.timerDirection || "up";
      this.timerSeconds = ui.timerSeconds || 60;
    }

    var gameScene = this.scene.get("GameScene");
    if (gameScene) {
      gameScene.events.on("playerDamaged", this._onPlayerDamaged, this);
      gameScene.events.on("scoreChanged", this._onScoreChanged, this);
      gameScene.events.on("playerLivesChanged", this._onLivesChanged, this);
    }
  },

  _onPlayerDamaged: function (data) {
    if (this.healthBar && this.player) {
      var pct = data.hp / data.maxHp;
      this.healthBar.width = 200 * pct;
      this.healthBar.setFill(
        pct > 0.5 ? 0x00ff00 : pct > 0.25 ? 0xffff00 : 0xff0000,
      );
    }
  },

  _onScoreChanged: function (data) {
    if (this.scoreText) this.scoreText.setText("Score: " + data.score);
  },

  _onLivesChanged: function (data) {
    if (this.livesText) this.livesText.setText("Lives: " + data.lives);
  },

  update: function (time) {
    if (this.timerText) {
      var elapsed = (time - this.timerStart) / 1000;
      var val =
        this.timerDirection === "down"
          ? Math.max(0, this.timerSeconds - elapsed)
          : Math.floor(elapsed);
      this.timerText.setText(
        this.timerDirection === "down" ? val.toFixed(1) : "" + val,
      );
    }
    if (this.healthBar2 && this._otherPlayer) {
      var pct = this._otherPlayer.maxHp
        ? this._otherPlayer.hp / this._otherPlayer.maxHp
        : 1;
      this.healthBar2.width = 120 * Math.max(0, Math.min(1, pct));
    }
  },
});
