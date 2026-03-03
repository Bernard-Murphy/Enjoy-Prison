var EnemyEntity = {
  create: function (scene, enemyConfig, index) {
    var config = GameUtils.getConfig();
    var ec = enemyConfig;
    var key = "enemy_" + index;

    var enemy = scene.physics.add.sprite(ec.x, ec.y, key);
    enemy.setDisplaySize(ec.width, ec.height);
    enemy.body.setSize(ec.width, ec.height);
    enemy.body.setCollideWorldBounds(true);

    enemy.hp = ec.health;
    enemy.maxHp = ec.health;
    enemy.damage = ec.damage;
    enemy.speed = ec.speed;
    enemy.scoreValue = ec.scoreValue;
    enemy.configIndex = index;
    enemy.spawnX = ec.x;
    enemy.spawnY = ec.y;
    enemy.patrolOffset = 0;
    enemy.bounceTime = 0;
    enemy.shootTimer = 0;
    enemy.isDead = false;

    var behavior = ec.behavior || {};
    var bhType = behavior.type || "patrol";
    if (
      bhType === "flying-patrol" ||
      bhType === "flying-chase" ||
      bhType === "bounce"
    ) {
      enemy.body.allowGravity = false;
    }

    enemy.update = function (time, delta, player) {
      if (enemy.isDead) return;
      if (!player || player.isDead) return;

      var dt = delta / 1000;
      enemy.bounceTime += dt;
      if (behavior.shoots) {
        enemy.shootTimer += delta;
        if (enemy.shootTimer >= (behavior.shootInterval || 2000)) {
          enemy.shootTimer = 0;
          scene.events.emit("enemyShoot", {
            x: enemy.x,
            y: enemy.y,
            enemy: enemy,
            projectileType: behavior.projectileType,
            direction: player.x > enemy.x ? 1 : -1,
          });
        }
      }

      if (bhType === "patrol") {
        var dist = behavior.patrolDistance || 200;
        var axis = behavior.patrolAxis || "horizontal";
        if (axis === "horizontal") {
          enemy.patrolOffset +=
            enemy.speed * dt * (enemy.body.velocity.x >= 0 ? 1 : -1);
          if (enemy.patrolOffset >= dist / 2) {
            enemy.patrolOffset = dist / 2;
            enemy.setVelocityX(-enemy.speed);
          } else if (enemy.patrolOffset <= -dist / 2) {
            enemy.patrolOffset = -dist / 2;
            enemy.setVelocityX(enemy.speed);
          }
        } else {
          enemy.patrolOffset +=
            enemy.speed * dt * (enemy.body.velocity.y >= 0 ? 1 : -1);
          if (enemy.patrolOffset >= dist / 2) {
            enemy.patrolOffset = dist / 2;
            enemy.setVelocityY(-enemy.speed);
          } else if (enemy.patrolOffset <= -dist / 2) {
            enemy.patrolOffset = -dist / 2;
            enemy.setVelocityY(enemy.speed);
          }
        }
      } else if (bhType === "chase" || bhType === "flying-chase") {
        var range = behavior.chaseRange || 200;
        var chaseSpeed = behavior.chaseSpeed || enemy.speed;
        var dx = player.x - enemy.x;
        var dy = player.y - enemy.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d <= range && d > 0) {
          enemy.setVelocity((dx / d) * chaseSpeed, (dy / d) * chaseSpeed);
        } else {
          enemy.setVelocity(0, 0);
        }
      } else if (bhType === "stationary") {
        enemy.setVelocity(0, 0);
      } else if (bhType === "flying-patrol") {
        var fdist = behavior.patrolDistance || 200;
        var faxis = behavior.patrolAxis || "horizontal";
        var floatAmp = behavior.floatAmplitude || 30;
        var floatSpd = behavior.floatSpeed || 2;
        if (faxis === "horizontal") {
          enemy.patrolOffset +=
            enemy.speed * dt * (enemy.body.velocity.x >= 0 ? 1 : -1);
          if (enemy.patrolOffset >= fdist / 2) {
            enemy.patrolOffset = fdist / 2;
            enemy.setVelocityX(-enemy.speed);
          } else if (enemy.patrolOffset <= -fdist / 2) {
            enemy.patrolOffset = -fdist / 2;
            enemy.setVelocityX(enemy.speed);
          }
          enemy.setVelocityY(Math.sin(enemy.bounceTime * floatSpd) * floatAmp);
        } else {
          enemy.patrolOffset +=
            enemy.speed * dt * (enemy.body.velocity.y >= 0 ? 1 : -1);
          if (enemy.patrolOffset >= fdist / 2) {
            enemy.patrolOffset = fdist / 2;
            enemy.setVelocityY(-enemy.speed);
          } else if (enemy.patrolOffset <= -fdist / 2) {
            enemy.patrolOffset = -fdist / 2;
            enemy.setVelocityY(enemy.speed);
          }
          enemy.setVelocityX(Math.sin(enemy.bounceTime * floatSpd) * floatAmp);
        }
      } else if (bhType === "bounce") {
        var bounceH = behavior.bounceHeight || 100;
        enemy.setVelocityX(0);
        enemy.setVelocityY(Math.sin(enemy.bounceTime * 4) * bounceH);
      }
    };

    enemy.takeDamage = function (amount, scene) {
      if (enemy.isDead) return;
      enemy.hp -= amount;
      AnimationBuilder.playDamageFlash(scene, enemy);
      if (enemy.hp <= 0) {
        enemy.isDead = true;
        enemy.body.enable = false;
        SoundGenerator.play("enemyDeath");
        scene.events.emit("enemyKilled", {
          enemy: enemy,
          configIndex: index,
          scoreValue: ec.scoreValue,
          drops: ec.drops || [],
        });
        AnimationBuilder.playDeathAnimation(scene, enemy, function () {
          enemy.destroy();
        });
      }
    };

    if (bhType === "patrol") {
      enemy.setVelocityX(enemy.speed);
    } else if (bhType === "flying-patrol") {
      enemy.setVelocityX(enemy.speed);
    }

    return enemy;
  },
};
