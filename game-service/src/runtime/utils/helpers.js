var GameUtils = {
  hexToInt: function (hex) {
    return parseInt(hex.replace("#", ""), 16);
  },

  clamp: function (val, min, max) {
    return Math.min(Math.max(val, min), max);
  },

  randomBetween: function (min, max) {
    return Math.random() * (max - min) + min;
  },

  distance: function (x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  },

  getConfig: function () {
    return window.GAME_CONFIG;
  },
};
