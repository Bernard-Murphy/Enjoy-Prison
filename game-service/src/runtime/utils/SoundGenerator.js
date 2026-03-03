var SoundGenerator = {
  _ctx: null,
  _enabled: {},

  init: function (scene) {
    try {
      this._ctx =
        typeof AudioContext !== "undefined"
          ? new AudioContext()
          : typeof webkitAudioContext !== "undefined"
            ? new webkitAudioContext()
            : null;
    } catch (e) {
      this._ctx = null;
    }
    var config = GameUtils.getConfig();
    var sfx = config.audio && config.audio.sfx ? config.audio.sfx : {};
    this._enabled = {
      jump: sfx.jump !== false,
      collect: sfx.collect !== false,
      damage: sfx.damage !== false,
      shoot: sfx.shoot !== false,
      enemyDeath: sfx.enemyDeath !== false,
      gameOver: sfx.gameOver !== false,
      win: sfx.win !== false,
    };
  },

  _beep: function (frequency, duration, type) {
    if (!this._ctx) return;
    var osc = this._ctx.createOscillator();
    var gain = this._ctx.createGain();
    osc.connect(gain);
    gain.connect(this._ctx.destination);
    osc.frequency.value = frequency;
    osc.type = type || "square";
    gain.gain.setValueAtTime(0.1, this._ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      this._ctx.currentTime + duration / 1000,
    );
    osc.start(this._ctx.currentTime);
    osc.stop(this._ctx.currentTime + duration / 1000);
  },

  play: function (name) {
    if (!this._enabled[name]) return;
    if (name === "jump") {
      this._beep(400, 80, "square");
    } else if (name === "collect") {
      this._beep(880, 60, "square");
      setTimeout(
        function (self) {
          self._beep(1200, 60, "square");
        },
        80,
        this,
      );
    } else if (name === "damage") {
      this._beep(150, 150, "sawtooth");
    } else if (name === "shoot") {
      this._beep(600, 50, "square");
    } else if (name === "enemyDeath") {
      this._beep(300, 100, "square");
      setTimeout(
        function (self) {
          self._beep(200, 120, "square");
        },
        100,
        this,
      );
    } else if (name === "gameOver") {
      this._beep(200, 300, "sine");
      setTimeout(
        function (self) {
          self._beep(150, 400, "sine");
        },
        350,
        this,
      );
    } else if (name === "win") {
      this._beep(523, 120, "square");
      setTimeout(
        function (self) {
          self._beep(659, 120, "square");
        },
        130,
        this,
      );
      setTimeout(
        function (self) {
          self._beep(784, 200, "square");
        },
        260,
        this,
      );
    }
  },
};
