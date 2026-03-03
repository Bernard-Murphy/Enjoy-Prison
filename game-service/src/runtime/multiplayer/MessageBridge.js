/**
 * MessageBridge — postMessage communication between game iframe and parent page.
 * Message envelope: { type: "move"|"state"|"signal"|"ready"|"sync"|"start", payload: ... }
 */
var MessageBridge = {
  callbacks: {},

  init: function () {
    var self = this;
    window.addEventListener("message", function (e) {
      var msg = e.data;
      if (msg && msg.type && MessageBridge.callbacks[msg.type]) {
        for (var i = 0; i < MessageBridge.callbacks[msg.type].length; i++) {
          MessageBridge.callbacks[msg.type][i](msg.payload);
        }
      }
    });
  },

  send: function (type, payload) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: type, payload: payload }, "*");
    }
  },

  on: function (type, callback) {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push(callback);
  },
};
