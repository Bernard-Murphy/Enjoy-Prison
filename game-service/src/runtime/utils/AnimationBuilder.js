var AnimationBuilder = {
  applyIdleAnimation: function (scene, sprite, animConfig) {
    if (!animConfig || animConfig.type === "none") return;
    if (animConfig.type === "scale-bounce") {
      scene.tweens.add({
        targets: sprite,
        scaleX: animConfig.scaleMax || 1.1,
        scaleY: animConfig.scaleMax || 1.1,
        duration: 500 / (animConfig.speed || 1),
        yoyo: true,
        repeat: -1,
      });
    } else if (animConfig.type === "rotation") {
      scene.tweens.add({
        targets: sprite,
        angle: 360,
        duration: 3600 / (animConfig.rotationSpeed || 90),
        repeat: -1,
      });
    }
  },

  applyMoveAnimation: function (scene, sprite, animConfig) {
    if (!animConfig || animConfig.type === "none") return;
    if (animConfig.type === "scale-bounce") {
      scene.tweens.add({
        targets: sprite,
        scaleX: animConfig.scaleMax || 1.05,
        scaleY: animConfig.scaleMax || 1.05,
        duration: 150,
        yoyo: true,
        repeat: -1,
      });
    }
  },

  stopAnimations: function (sprite) {
    if (sprite.scene && sprite.scene.tweens) {
      sprite.scene.tweens.killTweensOf(sprite);
    }
    if (sprite.setScale) sprite.setScale(1);
    if (sprite.setAngle) sprite.setAngle(0);
  },

  playDamageFlash: function (scene, sprite) {
    sprite.setTint(0xff0000);
    scene.time.delayedCall(100, function () {
      sprite.clearTint();
    });
  },

  playDeathAnimation: function (scene, sprite, callback) {
    sprite.scene.tweens.killTweensOf(sprite);
    scene.tweens.add({
      targets: sprite,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 300,
      onComplete: function () {
        if (typeof callback === "function") callback();
      },
    });
  },
};
