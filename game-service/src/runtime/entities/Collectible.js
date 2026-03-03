var CollectibleEntity = {
  create: function (scene, collConfig, index) {
    var config = GameUtils.getConfig();
    var cc = collConfig;
    var key = "collectible_" + index;

    var coll = scene.physics.add.sprite(cc.x, cc.y, key);
    coll.setDisplaySize(cc.width, cc.height);
    coll.body.setSize(cc.width, cc.height);
    coll.body.allowGravity = false;
    coll.configIndex = index;
    coll.effect = cc.effect || "score";
    coll.value = cc.value || 10;
    coll.duration = cc.duration || 0;
    coll.respawn = cc.respawn || false;
    coll.respawnTime = cc.respawnTime || 5000;
    coll.spawnX = cc.x;
    coll.spawnY = cc.y;
    coll.collected = false;

    coll.onCollect = function (player, scene) {
      if (coll.collected) return;
      coll.collected = true;
      SoundGenerator.play("collect");

      if (coll.effect === "score") {
        player.score += coll.value;
        scene.events.emit("scoreChanged", { score: player.score });
      } else if (coll.effect === "health") {
        player.hp = Math.min(player.maxHp, player.hp + coll.value);
        scene.events.emit("playerDamaged", {
          hp: player.hp,
          maxHp: player.maxHp,
        });
      } else if (coll.effect === "extra-life") {
        player.livesLeft++;
        scene.events.emit("playerLivesChanged", { lives: player.livesLeft });
      } else if (coll.effect === "speed-boost") {
        player.speedBoostUntil = scene.game.getTime() + coll.duration;
      } else if (coll.effect === "invincibility") {
        player.isInvincible = true;
        scene.time.delayedCall(coll.duration, function () {
          if (!player.isDead) player.isInvincible = false;
        });
      } else if (coll.effect === "key") {
        if (!player.keysCollected) player.keysCollected = 0;
        player.keysCollected++;
        scene.events.emit("keyCollected", {
          keys: player.keysCollected,
        });
      }

      coll.setVisible(false);
      coll.body.enable = false;

      if (coll.respawn) {
        scene.time.delayedCall(coll.respawnTime, function () {
          coll.setPosition(coll.spawnX, coll.spawnY);
          coll.setVisible(true);
          coll.body.enable = true;
          coll.collected = false;
        });
      } else {
        coll.destroy();
      }
    };

    return coll;
  },
};
