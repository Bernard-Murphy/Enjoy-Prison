var PlayerEntity = {
  create: function (scene, playerIndex, isLocal) {
    var config = GameUtils.getConfig();
    var pc = config.player;
    var genre = config.meta.genre;
    if (playerIndex == null) playerIndex = 0;
    if (isLocal == null) isLocal = true;

    var offsetX = playerIndex * 80;
    var player = scene.physics.add.sprite(pc.x + offsetX, pc.y, "player");
    player.setDisplaySize(pc.width, pc.height);
    player.body.setSize(pc.width, pc.height);
    player.setCollideWorldBounds(true);

    player.hp = pc.health;
    player.maxHp = pc.maxHealth;
    player.livesLeft = pc.lives;
    player.isInvincible = false;
    player.jumpsRemaining = pc.maxJumps;
    player.score = 0;
    player.isDead = false;
    player.abilities = {};
    player.facingRight = true;
    player.isLocal = isLocal;
    player.playerIndex = playerIndex;
    player.targetX = player.x;
    player.targetY = player.y;
    player.targetVX = 0;
    player.targetVY = 0;

    for (var i = 0; i < pc.abilities.length; i++) {
      var ab = pc.abilities[i];
      player.abilities[ab.type] = {
        config: ab,
        cooldownTimer: 0,
        ready: true,
      };
    }

    player.handleUpdate = function (cursors, time, delta) {
      if (!player.isLocal || player.isDead) return;

      var speed = pc.speed;
      if (player.speedBoostUntil && time < player.speedBoostUntil) {
        speed *= 1.5;
      }

      if (genre === "platformer" || genre === "fighting") {
        if (cursors.left.isDown) {
          player.setVelocityX(-speed);
          player.facingRight = false;
        } else if (cursors.right.isDown) {
          player.setVelocityX(speed);
          player.facingRight = true;
        } else {
          player.setVelocityX(0);
        }
        if (player.body.blocked.down || player.body.touching.down) {
          player.jumpsRemaining = pc.maxJumps;
        }
      } else if (genre === "top-down" || genre === "shooter") {
        player.setVelocity(0, 0);
        if (cursors.left.isDown) player.setVelocityX(-speed);
        else if (cursors.right.isDown) player.setVelocityX(speed);
        if (cursors.up.isDown) player.setVelocityY(-speed);
        else if (cursors.down.isDown) player.setVelocityY(speed);
        if (player.body.velocity.x !== 0 && player.body.velocity.y !== 0) {
          player.body.velocity.normalize().scale(speed);
        }
        if (player.body.velocity.x > 0) player.facingRight = true;
        else if (player.body.velocity.x < 0) player.facingRight = false;
      } else if (genre === "endless-runner") {
        player.setVelocityX(speed);
        if (player.body.blocked.down || player.body.touching.down) {
          player.jumpsRemaining = pc.maxJumps;
        }
      }

      for (var key in player.abilities) {
        var ab = player.abilities[key];
        if (!ab.ready) {
          ab.cooldownTimer -= delta;
          if (ab.cooldownTimer <= 0) ab.ready = true;
        }
      }
    };

    player.executeAbility = function (abilityType, scene) {
      var ab = player.abilities[abilityType];
      if (!ab || !ab.ready || player.isDead) return;

      ab.ready = false;
      ab.cooldownTimer = ab.config.cooldownMs;

      if (abilityType === "jump" || abilityType === "double-jump") {
        if (player.jumpsRemaining > 0) {
          player.setVelocityY(pc.jumpForce);
          player.jumpsRemaining--;
          SoundGenerator.play("jump");
        } else {
          ab.ready = true;
        }
      } else if (abilityType === "shoot") {
        scene.events.emit("playerShoot", {
          x: player.x + (player.facingRight ? pc.width : -pc.width),
          y: player.y,
          direction: player.facingRight ? 1 : -1,
          projectileType: ab.config.projectileType,
        });
        SoundGenerator.play("shoot");
      } else if (abilityType === "melee-attack") {
        scene.events.emit("playerMelee", {
          x:
            player.x +
            (player.facingRight
              ? ab.config.attackRange / 2
              : -ab.config.attackRange / 2),
          y: player.y,
          range: ab.config.attackRange,
          damage: ab.config.attackDamage,
          duration: ab.config.attackDuration,
        });
      } else if (abilityType === "dash") {
        var dashDir = player.facingRight ? 1 : -1;
        player.setVelocityX(dashDir * (ab.config.dashSpeed || 600));
        player.isInvincible = true;
        scene.time.delayedCall(ab.config.dashDuration || 200, function () {
          player.isInvincible = false;
        });
      } else if (abilityType === "shield") {
        player.isInvincible = true;
        player.setTint(0x00ffff);
        scene.time.delayedCall(ab.config.shieldDuration || 2000, function () {
          player.isInvincible = false;
          player.clearTint();
        });
      } else if (abilityType === "wall-jump") {
        if (
          (player.body.blocked.left || player.body.blocked.right) &&
          !player.body.blocked.down
        ) {
          var wallDir = player.body.blocked.left ? 1 : -1;
          player.setVelocity(wallDir * pc.speed * 0.75, pc.jumpForce);
          SoundGenerator.play("jump");
        }
      }
    };

    player.takeDamage = function (amount, scene) {
      if (player.isInvincible || player.isDead) return;

      player.hp -= amount;
      player.isInvincible = true;
      SoundGenerator.play("damage");
      AnimationBuilder.playDamageFlash(scene, player);

      scene.events.emit("playerDamaged", {
        hp: player.hp,
        maxHp: player.maxHp,
      });

      scene.time.delayedCall(pc.invincibilityDuration, function () {
        if (!player.isDead) {
          player.isInvincible = false;
          player.setAlpha(1);
        }
      });

      scene.tweens.add({
        targets: player,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: Math.floor(pc.invincibilityDuration / 200),
      });

      if (player.hp <= 0) {
        player.die(scene);
      }
    };

    player.die = function (scene) {
      player.isDead = true;
      player.setVelocity(0, 0);
      player.body.enable = false;

      if (pc.lives > 0) {
        player.livesLeft--;
        scene.events.emit("playerLivesChanged", { lives: player.livesLeft });

        if (player.livesLeft > 0) {
          AnimationBuilder.playDeathAnimation(scene, player, function () {
            player.setPosition(pc.x, pc.y);
            player.hp = pc.maxHealth;
            player.isDead = false;
            player.isInvincible = true;
            player.body.enable = true;
            player.setAlpha(1);
            scene.events.emit("playerDamaged", {
              hp: player.hp,
              maxHp: player.maxHp,
            });
            scene.time.delayedCall(pc.invincibilityDuration, function () {
              player.isInvincible = false;
            });
          });
          return;
        }
      }

      AnimationBuilder.playDeathAnimation(scene, player, function () {
        SoundGenerator.play("gameOver");
        scene.events.emit("gameOver", { won: false, score: player.score });
      });
    };

    player.applyNetworkState = function (state) {
      if (state.x != null) player.targetX = state.x;
      if (state.y != null) player.targetY = state.y;
      if (state.vx != null) player.targetVX = state.vx;
      if (state.vy != null) player.targetVY = state.vy;
      if (state.facing != null) player.facingRight = !!state.facing;
      if (state.hp != null) player.hp = state.hp;
      if (state.isDead != null) player.isDead = state.isDead;
    };

    player.interpolate = function (delta) {
      var t = Math.min(1, delta * 0.012);
      player.x += (player.targetX - player.x) * t;
      player.y += (player.targetY - player.y) * t;
      player.body.setVelocity(player.targetVX, player.targetVY);
      player.flipX = !player.facingRight;
    };

    return player;
  },
};
