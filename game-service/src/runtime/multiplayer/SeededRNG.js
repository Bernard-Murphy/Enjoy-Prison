/**
 * SeededRNG — deterministic PRNG for multiplayer (same seed = same sequence on all clients).
 * Uses a simple Linear Congruential Generator (LCG).
 */
var SeededRNG = {
  seed: 1,

  init: function (s) {
    this.seed = typeof s === "number" && s > 0 ? Math.floor(s) : 1;
  },

  next: function () {
    this.seed = (this.seed * 16807) % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
    return (this.seed - 1) / 2147483646;
  },

  between: function (min, max) {
    return min + this.next() * (max - min);
  },

  /** Returns an integer in [min, max) (max exclusive). */
  int: function (min, max) {
    return Math.floor(min + this.next() * (max - min));
  },
};
