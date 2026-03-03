/**
 * NetworkBridge — multiplayer protocol over MessageBridge (parent relays via WebRTC or WebSocket).
 * Used by action games for playerState / worldState sync.
 */
var NetworkBridge = {
  role: null,
  localPlayerIndex: 0,
  connected: false,

  init: function (config) {
    this.role = config.role || "host";
    this.localPlayerIndex = config.localPlayerIndex ?? 0;
    if (typeof MessageBridge !== "undefined") {
      MessageBridge.init();
    }
    this.connected = true;
  },

  sendPlayerState: function (state) {
    if (typeof MessageBridge !== "undefined") {
      MessageBridge.send("playerState", state);
    }
  },

  sendWorldState: function (state) {
    if (typeof MessageBridge !== "undefined") {
      MessageBridge.send("worldState", state);
    }
  },

  onPlayerState: function (cb) {
    if (typeof MessageBridge !== "undefined") {
      MessageBridge.on("playerState", cb);
    }
  },

  onWorldState: function (cb) {
    if (typeof MessageBridge !== "undefined") {
      MessageBridge.on("worldState", cb);
    }
  },
};
