var ProjectileEntity = {
  create: function (scene, x, y, direction, typeConfig, typeIndex, fromPlayer) {
    var key = "projectile_" + typeIndex;
    var proj = scene.physics.add.sprite(x, y, key);
    proj.setDisplaySize(typeConfig.width, typeConfig.height);
    proj.body.setSize(typeConfig.width, typeConfig.height);
    proj.body.allowGravity = typeConfig.gravity || false;
    proj.setVelocityX(direction * (typeConfig.speed || 400));
    proj.setVelocityY(0);
    proj.fromPlayer = fromPlayer;
    proj.damage = typeConfig.damage || 1;
    proj.piercing = typeConfig.piercing || false;
    proj.lifetime = typeConfig.lifetime || 3000;
    proj.spawnTime = scene.game.getTime();

    return proj;
  },
};
