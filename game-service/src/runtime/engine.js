(function () {
  var config = GameUtils.getConfig();
  var scenes;
  var viewportConfig;
  var bgColor;

  if (config.gameType === "turn-based" && config.turnBased) {
    var gameScene;
    switch (config.turnBased.subGenre) {
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
    viewportConfig = config.turnBased.common.viewport || {
      width: 800,
      height: 600,
    };
    bgColor = config.turnBased.common.backgroundColor || "#1a1a2e";
  } else {
    scenes = [
      BootScene,
      MenuScene,
      GameScene,
      HUDScene,
      PauseScene,
      GameOverScene,
    ];
    viewportConfig = config.meta.viewport || { width: 800, height: 600 };
    bgColor = config.meta.backgroundColor || "#1a1a2e";
  }

  var gravity =
    config.gameType === "turn-based"
      ? { x: 0, y: 0 }
      : config.meta && config.meta.gravity
        ? config.meta.gravity
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
})();
