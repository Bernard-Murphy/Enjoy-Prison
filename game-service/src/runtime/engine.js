(function () {
  var config = GameUtils.getConfig();

  function bootGame() {
    var cfg = window.GAME_CONFIG;
    var scenes;
    var viewportConfig;
    var bgColor;

    if (cfg.gameType === "turn-based" && cfg.turnBased) {
      var gameScene;
      switch (cfg.turnBased.subGenre) {
        case "grid-game":
          gameScene = GridGameScene;
          break;
        case "word-game":
          gameScene = WordGameScene;
          break;
        case "board-game":
          gameScene = BoardGameScene;
          break;
        case "memory-game":
          gameScene = MemoryGameScene;
          break;
        case "trivia-game":
          gameScene = TriviaGameScene;
          break;
        case "card-game":
          gameScene = CardGameScene;
          break;
        default:
          gameScene = GridGameScene;
      }
      scenes = [TBBootScene, TBMenuScene, gameScene, TBGameOverScene];
      viewportConfig = cfg.turnBased.common.viewport || {
        width: 800,
        height: 600,
      };
      bgColor = cfg.turnBased.common.backgroundColor || "#1a1a2e";
    } else {
      scenes = [
        BootScene,
        MenuScene,
        GameScene,
        HUDScene,
        PauseScene,
        GameOverScene,
      ];
      viewportConfig = cfg.meta.viewport || { width: 800, height: 600 };
      bgColor = cfg.meta.backgroundColor || "#1a1a2e";
    }

    var gravity =
      cfg.gameType === "turn-based"
        ? { x: 0, y: 0 }
        : cfg.meta && cfg.meta.gravity
          ? cfg.meta.gravity
          : { x: 0, y: 800 };

    window.game = new Phaser.Game({
      type: Phaser.AUTO,
      width: viewportConfig.width || 800,
      height: viewportConfig.height || 600,
      backgroundColor: bgColor,
      physics: {
        default: "arcade",
        arcade: {
          gravity: gravity,
          debug: false,
        },
      },
      scene: scenes,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      parent: document.body,
    });
  }

  if (
    config.multiplayer &&
    config.multiplayer.enabled &&
    typeof MessageBridge !== "undefined"
  ) {
    MessageBridge.init();
    MessageBridge.on("start", function (payload) {
      window.MULTIPLAYER_CONFIG = payload;
      if (payload.seed != null && typeof SeededRNG !== "undefined") {
        SeededRNG.init(payload.seed);
      }
      if (payload.players && config.turnBased && config.turnBased.common) {
        config.turnBased.common.players = payload.players.map(function (p, i) {
          return {
            name: p.name || "Player " + (i + 1),
            type:
              p.type || (i === payload.localPlayerIndex ? "human" : "remote"),
            color: p.color || "#4488ff",
            symbol: p.symbol || (i === 0 ? "X" : "O"),
          };
        });
      }
      bootGame();
    });
  } else {
    bootGame();
  }
})();
