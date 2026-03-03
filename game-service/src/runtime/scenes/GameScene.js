var GameScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "GameScene" });
  },

  create: function () {
    var config = GameUtils.getConfig();
    this.player = PlayerEntity.create(this);
    this.enemies = this.add.group();
    this.collectibles = this.add.group();
    this.platforms = this.add.group();
    this.projectiles = this.add.group();
    this.movingPlatforms = [];
    this.fallingPlatforms = this.add.group();

    var i;
    for (i = 0; i < config.platforms.length; i++) {
      var plat = PlatformEntity.create(this, config.platforms[i], i);
      this.platforms.add(plat);
      if (plat.platType === "moving") {
        this.movingPlatforms.push(plat);
      } else if (plat.platType === "falling") {
        this.fallingPlatforms.add(plat);
      }
    }

    this.physics.add.overlap(
      this.player,
      this.fallingPlatforms,
      this._playerOnFallingPlatform,
      null,
      this,
    );

    for (i = 0; i < config.enemies.length; i++) {
      var enemy = EnemyEntity.create(this, config.enemies[i], i);
      this.enemies.add(enemy);
    }

    for (i = 0; i < config.collectibles.length; i++) {
      var coll = CollectibleEntity.create(this, config.collectibles[i], i);
      this.collectibles.add(coll);
    }

    for (i = 0; i < config.decorations.length; i++) {
      var dec = config.decorations[i];
      var decKey = "decoration_" + i;
      var img = this.add.image(dec.x, dec.y, decKey);
      img.setScrollFactor(dec.parallaxFactor || 1);
    }

    var winCond = config.rules.winCondition;
    if (
      winCond.type === "reach-point" &&
      winCond.targetX != null &&
      winCond.targetY != null
    ) {
      this.winZone = this.physics.add.staticSprite(
        winCond.targetX + (winCond.targetWidth || 64) / 2,
        winCond.targetY + (winCond.targetHeight || 64) / 2,
        "win_zone",
      );
      this.winZone.setDisplaySize(
        winCond.targetWidth || 64,
        winCond.targetHeight || 64,
      );
      this.winZone.body.setSize(
        winCond.targetWidth || 64,
        winCond.targetHeight || 64,
      );
    } else {
      this.winZone = null;
    }

    var controls = config.controls || {};
    this.cursors = this.input.keyboard.addKeys({
      up: controls.up || "ArrowUp",
      down: controls.down || "ArrowDown",
      left: controls.left || "ArrowLeft",
      right: controls.right || "ArrowRight",
    });
    this.action1 = this.input.keyboard.addKey(controls.action1 || "Space");
    this.action2 = this.input.keyboard.addKey(controls.action2 || "KeyZ");
    this.pauseKey = this.input.keyboard.addKey(controls.pause || "Escape");

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this._playerHitEnemy,
      null,
      this,
    );
    this.physics.add.overlap(
      this.player,
      this.collectibles,
      this._playerHitCollectible,
      null,
      this,
    );
    this.physics.add.collider(this.enemies, this.platforms);

    this.physics.add.overlap(
      this.projectiles,
      this.enemies,
      this._projectileHitEnemy,
      null,
      this,
    );
    this.physics.add.overlap(
      this.projectiles,
      this.player,
      this._projectileHitPlayer,
      null,
      this,
    );

    if (this.winZone) {
      this.physics.add.overlap(
        this.player,
        this.winZone,
        this._playerReachWin,
        null,
        this,
      );
    }

    this.events.on("playerShoot", this._spawnPlayerProjectile, this);
    this.events.on("enemyShoot", this._spawnEnemyProjectile, this);
    this.events.on("enemyKilled", this._onEnemyKilled, this);
    this.events.on("gameOver", this._onGameOver, this);

    if (config.meta.cameraFollow) {
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    }
    this.physics.world.setBounds(
      0,
      0,
      config.meta.worldBounds.width,
      config.meta.worldBounds.height,
    );
    this.cameras.main.setBounds(
      0,
      0,
      config.meta.worldBounds.width,
      config.meta.worldBounds.height,
    );

    this.scene.launch("HUDScene", { player: this.player });

    this.spawners = config.spawners || [];
    this.spawnerTimers = [];
    for (i = 0; i < this.spawners.length; i++) {
      var s = this.spawners[i];
      this.time.delayedCall(s.startDelay || 0, function () {});
      this.spawnerTimers[i] = {
        nextSpawn: this.game.getTime() + (s.startDelay || 0),
        count: 0,
      };
    }

    this.startTime = this.game.getTime();
    this.winCondition = config.rules.winCondition;
    this.loseCondition = config.rules.loseCondition || { type: "health-zero" };
  },

  _playerOnFallingPlatform: function (player, platform) {
    if (platform.falling || platform.fallTimer) return;
    platform.falling = true;
    platform.fallTimer = this.time.delayedCall(platform.fallDelay, function () {
      platform.body.setAllowGravity(true);
      platform.body.immovable = false;
      platform.setVelocityY(200);
    });
  },

  _playerHitEnemy: function (player, enemy) {
    if (player.isInvincible || player.isDead) return;
    player.takeDamage(enemy.damage, this);
  },

  _playerHitCollectible: function (player, coll) {
    if (coll.onCollect) coll.onCollect(player, this);
  },

  _projectileHitEnemy: function (proj, enemy) {
    if (!proj.fromPlayer) return;
    enemy.takeDamage(proj.damage, this);
    if (!proj.piercing) proj.destroy();
  },

  _projectileHitPlayer: function (proj, player) {
    if (proj.fromPlayer) return;
    if (player.isInvincible || player.isDead) return;
    player.takeDamage(proj.damage, this);
    if (!proj.piercing) proj.destroy();
  },

  _playerReachWin: function () {
    this.events.emit("gameOver", { won: true, score: this.player.score });
  },

  _spawnPlayerProjectile: function (data) {
    var config = GameUtils.getConfig();
    var idx = config.projectileTypes.findIndex(function (p) {
      return p.name === data.projectileType;
    });
    if (idx < 0) return;
    var typeConfig = config.projectileTypes[idx];
    var proj = ProjectileEntity.create(
      this,
      data.x,
      data.y,
      data.direction,
      typeConfig,
      idx,
      true,
    );
    this.projectiles.add(proj);
  },

  _spawnEnemyProjectile: function (data) {
    var config = GameUtils.getConfig();
    var idx = data.projectileType
      ? config.projectileTypes.findIndex(function (p) {
          return p.name === data.projectileType;
        })
      : 0;
    if (idx < 0) idx = 0;
    var typeConfig = config.projectileTypes[idx] || config.projectileTypes[0];
    if (!typeConfig) return;
    var proj = ProjectileEntity.create(
      this,
      data.x,
      data.y,
      data.direction,
      typeConfig,
      idx,
      false,
    );
    this.projectiles.add(proj);
  },

  _onEnemyKilled: function (data) {
    this.player.score += data.scoreValue || 0;
    this.events.emit("scoreChanged", { score: this.player.score });
  },

  _onGameOver: function (data) {
    this.scene.start("GameOverScene", data);
    this.scene.stop("HUDScene");
  },

  update: function (time, delta) {
    var config = GameUtils.getConfig();
    this.player.handleUpdate(this.cursors, time, delta);

    if (this.action1 && Phaser.Input.Keyboard.JustDown(this.action1)) {
      var ab = config.player.abilities;
      for (var i = 0; i < ab.length; i++) {
        if (ab[i].trigger === "action1")
          this.player.executeAbility(ab[i].type, this);
      }
    }
    if (this.action2 && Phaser.Input.Keyboard.JustDown(this.action2)) {
      var ab2 = config.player.abilities;
      for (var j = 0; j < ab2.length; j++) {
        if (ab2[j].trigger === "action2")
          this.player.executeAbility(ab2[j].type, this);
      }
    }
    if (this.pauseKey && Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.scene.launch("PauseScene");
      this.scene.pause();
    }

    this.enemies.getChildren().forEach(function (enemy) {
      if (enemy.update) enemy.update(time, delta, this.player);
    }, this);

    for (var m = 0; m < this.movingPlatforms.length; m++) {
      PlatformEntity.updateMoving(this.movingPlatforms[m], this);
    }

    this.projectiles.getChildren().forEach(function (proj) {
      if (this.game.getTime() - proj.spawnTime > proj.lifetime) {
        proj.destroy();
      }
    }, this);

    if (
      this.winCondition.type === "score" &&
      this.player.score >= this.winCondition.value
    ) {
      this.events.emit("gameOver", { won: true, score: this.player.score });
    }
    if (this.winCondition.type === "survive-time") {
      if ((time - this.startTime) / 1000 >= this.winCondition.value) {
        this.events.emit("gameOver", { won: true, score: this.player.score });
      }
    }
    if (this.loseCondition.type === "fall-off-screen") {
      var wb = config.meta.worldBounds;
      if (this.player.y > wb.height + 100) {
        this.player.die(this);
      }
    }

    for (var s = 0; s < this.spawners.length; s++) {
      var sp = this.spawners[s];
      var st = this.spawnerTimers[s];
      if (!st) continue;
      if (time < st.nextSpawn) continue;
      var template = config.enemies.find(function (e) {
        return e.name === sp.enemyName;
      });
      if (!template) continue;
      var active = this.enemies.getChildren().length;
      if (sp.maxActive && active >= sp.maxActive) continue;
      if (sp.totalSpawns && st.count >= sp.totalSpawns) continue;
      var sx = sp.x + (Math.random() * 2 - 1) * (sp.spawnRadius || 50);
      var sy = sp.y;
      var idx = config.enemies.indexOf(template);
      var newEnemy = EnemyEntity.create(this, template, idx);
      newEnemy.setPosition(sx, sy);
      this.enemies.add(newEnemy);
      st.count++;
      st.nextSpawn = time + (sp.interval || 3000);
    }
  },
});
