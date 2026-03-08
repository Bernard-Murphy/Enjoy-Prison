var MenuScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "MenuScene" });
  },
  create: function () {
    var config = GameUtils.getConfig();
    var menu = config.scenes.menu || {};
    var w = config.meta.viewport.width;
    var h = config.meta.viewport.height;

    this.cameras.main.setBackgroundColor(menu.backgroundColor || "#1a1a2e");

    var logoY = h / 2 - 140;
    var titleY = h / 2 - 60;
    if (this.textures.exists("menuLogo")) {
      var logo = this.add.image(w / 2, logoY, "menuLogo");
      var maxW = 200;
      if (logo.width > maxW) {
        logo.setDisplaySize(maxW, (logo.height * maxW) / logo.width);
      }
      titleY = h / 2 - 20;
    }

    var title = this.add.text(w / 2, titleY, menu.title || "My Game", {
      fontSize: "48px",
      fill: "#ffffff",
    });
    title.setOrigin(0.5);

    var subtitle = this.add.text(
      w / 2,
      titleY + 36,
      menu.subtitle || "Press Start",
      {
        fontSize: "24px",
        fill: "#aaaaaa",
      },
    );
    subtitle.setOrigin(0.5);

    var buttons = menu.buttons || [{ label: "Start Game", action: "start" }];
    var y = titleY + 86;
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var label = this.add.text(w / 2, y + i * 50, btn.label, {
        fontSize: "28px",
        fill: "#ffffff",
      });
      label.setOrigin(0.5);
      label.setInteractive({ useHandCursor: true });
      label.on("pointerover", function (l) {
        l.setFill("#88ccff");
      });
      label.on("pointerout", function (l) {
        l.setFill("#ffffff");
      });
      label.on(
        "pointerdown",
        function (scene, action) {
          if (action === "start") {
            scene.scene.start("GameScene");
          }
        }.bind(null, this, btn.action),
      );
    }
  },
});
