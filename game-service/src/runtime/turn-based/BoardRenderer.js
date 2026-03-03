var BoardRenderer = {
  calculatePositions: function (
    layout,
    spaces,
    spaceWidth,
    spaceHeight,
    viewportWidth,
    viewportHeight,
  ) {
    var positions = [];
    var count = spaces && spaces.length > 0 ? spaces.length : 40;
    var w = spaceWidth || 70;
    var h = spaceHeight || 90;
    var cx = viewportWidth / 2;
    var cy = viewportHeight / 2;

    if (layout === "square-loop") {
      var perSide = Math.ceil(count / 4);
      var totalW = perSide * w;
      var totalH = perSide * h;
      var left = cx - totalW / 2;
      var top = cy - totalH / 2;
      var idx = 0;
      for (var i = 0; i < perSide && idx < count; i++, idx++) {
        positions.push({
          x: left + i * w + w / 2,
          y: top,
          rotation: 0,
        });
      }
      for (var i = 0; i < perSide && idx < count; i++, idx++) {
        positions.push({
          x: left + totalW,
          y: top + i * h + h / 2,
          rotation: 0,
        });
      }
      for (var i = perSide - 1; i >= 0 && idx < count; i--, idx++) {
        positions.push({
          x: left + i * w + w / 2,
          y: top + totalH,
          rotation: 0,
        });
      }
      for (var i = perSide - 1; i >= 0 && idx < count; i--, idx++) {
        positions.push({
          x: left,
          y: top + i * h + h / 2,
          rotation: 0,
        });
      }
      return positions;
    }

    if (layout === "linear") {
      var cols = Math.ceil(Math.sqrt(count));
      var rows = Math.ceil(count / cols);
      var startX = cx - ((cols - 1) * w) / 2;
      var startY = cy - ((rows - 1) * h) / 2;
      for (var r = 0; r < rows && positions.length < count; r++) {
        var rowDir = r % 2 === 0 ? 1 : -1;
        var colStart = rowDir === 1 ? 0 : cols - 1;
        for (var c = 0; c < cols && positions.length < count; c++) {
          var col = rowDir === 1 ? c : cols - 1 - c;
          positions.push({
            x: startX + col * w,
            y: startY + r * h,
            rotation: 0,
          });
        }
      }
      return positions;
    }

    if (layout === "spiral") {
      var radius = Math.min(viewportWidth, viewportHeight) / 2 - w;
      for (var i = 0; i < count; i++) {
        var t = i / Math.max(count - 1, 1);
        var angle = 2 * Math.PI * 3 * t - Math.PI / 2;
        var r = radius * (1 - t * 0.6);
        positions.push({
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
          rotation: 0,
        });
      }
      return positions;
    }

    return positions;
  },

  renderBoard: function (scene, spaces, positions, spaceWidth, spaceHeight) {
    var w = spaceWidth || 70;
    var h = spaceHeight || 90;
    var graphics = scene.add.graphics();
    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var space = spaces[i] || {};
      var color = space.color
        ? parseInt(space.color.replace("#", ""), 16)
        : 0x333333;
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(pos.x - w / 2, pos.y - h / 2, w, h, 4);
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.strokeRoundedRect(pos.x - w / 2, pos.y - h / 2, w, h, 4);
      if (space.name) {
        var label = scene.add.text(pos.x, pos.y, space.name, {
          fontSize: "12px",
          color: "#ffffff",
        });
        label.setOrigin(0.5);
        label.setWordWrapWidth(w - 4);
        label.setAlign("center");
      }
    }
    return graphics;
  },

  renderPlayerToken: function (
    scene,
    playerIndex,
    spaceIndex,
    positions,
    color,
  ) {
    if (spaceIndex < 0 || spaceIndex >= positions.length) return null;
    var pos = positions[spaceIndex];
    var hex = color ? parseInt(String(color).replace("#", ""), 16) : 0x4488ff;
    var circle = scene.add.circle(pos.x, pos.y, 12, hex);
    return circle;
  },

  animateMovement: function (
    scene,
    token,
    fromIndex,
    toIndex,
    positions,
    callback,
  ) {
    if (!token || fromIndex === toIndex) {
      if (callback) callback();
      return;
    }
    var fromPos = positions[fromIndex];
    var toPos = positions[toIndex];
    if (!fromPos || !toPos) {
      if (callback) callback();
      return;
    }
    token.x = fromPos.x;
    token.y = fromPos.y;
    scene.tweens.add({
      targets: token,
      x: toPos.x,
      y: toPos.y,
      duration: 300,
      ease: "Power2",
      onComplete: function () {
        if (callback) callback();
      },
    });
  },
};
