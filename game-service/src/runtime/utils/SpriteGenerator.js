var SpriteGenerator = {
  generate: function (scene, key, appearance, width, height) {
    var graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    var fillColor = GameUtils.hexToInt(appearance.color || "#ffffff");
    var borderColor = GameUtils.hexToInt(appearance.borderColor || "#ffffff");
    var borderWidth = appearance.borderWidth || 0;

    graphics.fillStyle(fillColor, 1);

    if (borderWidth > 0) {
      graphics.lineStyle(borderWidth, borderColor, 1);
    }

    var type = appearance.type || "rectangle";

    if (type === "rectangle") {
      graphics.fillRect(0, 0, width, height);
      if (borderWidth > 0) graphics.strokeRect(0, 0, width, height);
    } else if (type === "circle") {
      var radius = Math.min(width, height) / 2;
      graphics.fillCircle(width / 2, height / 2, radius);
      if (borderWidth > 0) graphics.strokeCircle(width / 2, height / 2, radius);
    } else if (type === "triangle") {
      graphics.fillTriangle(width / 2, 0, 0, height, width, height);
      if (borderWidth > 0) {
        graphics.strokeTriangle(width / 2, 0, 0, height, width, height);
      }
    }

    graphics.generateTexture(key, width, height);
    graphics.destroy();
  },

  generateAll: function (scene) {
    var config = GameUtils.getConfig();

    this.generate(
      scene,
      "player",
      config.player.appearance,
      config.player.width,
      config.player.height,
    );

    for (var i = 0; i < config.enemies.length; i++) {
      var enemy = config.enemies[i];
      this.generate(
        scene,
        "enemy_" + i,
        enemy.appearance,
        enemy.width,
        enemy.height,
      );
    }

    for (var i = 0; i < config.collectibles.length; i++) {
      var coll = config.collectibles[i];
      this.generate(
        scene,
        "collectible_" + i,
        coll.appearance,
        coll.width,
        coll.height,
      );
    }

    for (var i = 0; i < config.platforms.length; i++) {
      var plat = config.platforms[i];
      this.generate(
        scene,
        "platform_" + i,
        plat.appearance,
        plat.width,
        plat.height,
      );
    }

    for (var i = 0; i < config.projectileTypes.length; i++) {
      var proj = config.projectileTypes[i];
      this.generate(
        scene,
        "projectile_" + i,
        proj.appearance,
        proj.width,
        proj.height,
      );
    }

    for (var i = 0; i < config.decorations.length; i++) {
      var dec = config.decorations[i];
      this.generate(
        scene,
        "decoration_" + i,
        dec.appearance,
        dec.width,
        dec.height,
      );
    }

    if (config.rules.winCondition.type === "reach-point") {
      var gfx = scene.make.graphics({ x: 0, y: 0, add: false });
      gfx.fillStyle(0x00ff00, 0.3);
      gfx.fillRect(
        0,
        0,
        config.rules.winCondition.targetWidth || 64,
        config.rules.winCondition.targetHeight || 64,
      );
      gfx.lineStyle(2, 0x00ff00, 1);
      gfx.strokeRect(
        0,
        0,
        config.rules.winCondition.targetWidth || 64,
        config.rules.winCondition.targetHeight || 64,
      );
      gfx.generateTexture(
        "win_zone",
        config.rules.winCondition.targetWidth || 64,
        config.rules.winCondition.targetHeight || 64,
      );
      gfx.destroy();
    }
  },
};
