var StateManager = {
  state: {},
  listeners: {},

  init: function (initialState) {
    this.state = JSON.parse(JSON.stringify(initialState || {}));
    this.listeners = {};
  },

  get: function (key) {
    return this.state[key];
  },

  set: function (key, value) {
    var oldValue = this.state[key];
    this.state[key] = value;
    if (this.listeners[key]) {
      for (var i = 0; i < this.listeners[key].length; i++) {
        this.listeners[key][i](value, oldValue);
      }
    }
  },

  onChange: function (key, callback) {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback);
  },

  getAll: function () {
    return JSON.parse(JSON.stringify(this.state));
  },

  reset: function (initialState) {
    this.state = JSON.parse(JSON.stringify(initialState || {}));
  },

  destroy: function () {
    this.state = {};
    this.listeners = {};
  },
};
