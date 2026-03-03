var PlatformEntity = {
  create: function (scene, platConfig, index) {
    var pc = platConfig;
    var key = "platform_" + index;

    var isStatic =
      pc.type === "static" || pc.type === "one-way" || pc.type === "moving";
    var platform;
    if (isStatic) {
      platform = scene.physics.add.staticSprite(pc.x, pc.y, key);
    } else {
      platform = scene.physics.add.sprite(pc.x, pc.y, key);
      platform.body.setImmovable(true);
      platform.body.allowGravity = false;
      platform.setVelocity(0, 0);
    }
    platform.setDisplaySize(pc.width, pc.height);
    platform.body.setSize(pc.width, pc.height);
    platform.configIndex = index;
    platform.platType = pc.type || "static";
    platform.spawnX = pc.x;
    platform.spawnY = pc.y;
    platform.moveDistance = pc.moveDistance || 200;
    platform.moveSpeed = pc.moveSpeed || 100;
    platform.moveAxis = pc.moveAxis || "horizontal";
    platform.fallDelay = pc.fallDelay || 500;
    platform.respawn = pc.respawn !== false;
    platform.respawnTime = pc.respawnTime || 3000;
    platform.falling = false;
    platform.fallTimer = null;

    if (platform.platType === "one-way") {
      platform.body.checkCollision.down = false;
      platform.body.checkCollision.left = false;
      platform.body.checkCollision.right = false;
    }

    if (platform.platType === "moving") {
      platform.moveTween = scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: (platform.moveDistance / platform.moveSpeed) * 1000,
        repeat: -1,
        yoyo: true,
      });
    }

    return platform;
  },

  updateMoving: function (platform, scene) {
    if (platform.platType !== "moving" || !platform.moveTween) return;
    var t = platform.moveTween.getValue();
    var dist = platform.moveDistance;
    if (platform.moveAxis === "horizontal") {
      platform.x = platform.spawnX + (t - 0.5) * dist;
      platform.body.updateFromGameObject();
    } else {
      platform.y = platform.spawnY + (t - 0.5) * dist;
      platform.body.updateFromGameObject();
    }
  },
};
