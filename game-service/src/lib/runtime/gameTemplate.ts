import fs from "fs";
import path from "path";
import type { GameConfig } from "../dsl/schema";

const RUNTIME_FILES = [
  "utils/helpers.js",
  "utils/SpriteGenerator.js",
  "utils/AnimationBuilder.js",
  "utils/SoundGenerator.js",
  "entities/Player.js",
  "entities/Enemy.js",
  "entities/Collectible.js",
  "entities/Platform.js",
  "entities/Projectile.js",
  "scenes/BootScene.js",
  "scenes/MenuScene.js",
  "scenes/GameScene.js",
  "scenes/HUDScene.js",
  "scenes/PauseScene.js",
  "scenes/GameOverScene.js",
  "turn-based/TurnManager.js",
  "turn-based/AIOpponent.js",
  "turn-based/StateManager.js",
  "turn-based/WordList.js",
  "turn-based/DeckBuilder.js",
  "turn-based/BoardRenderer.js",
  "turn-based/scenes/TBBootScene.js",
  "turn-based/scenes/TBMenuScene.js",
  "turn-based/scenes/GridGameScene.js",
  "turn-based/scenes/WordGameScene.js",
  "turn-based/scenes/BoardGameScene.js",
  "turn-based/scenes/MemoryGameScene.js",
  "turn-based/scenes/TriviaGameScene.js",
  "turn-based/scenes/CardGameScene.js",
  "turn-based/scenes/TBGameOverScene.js",
  "engine.js",
];

function getRuntimeDir(): string {
  const fromCwd = path.join(process.cwd(), "src", "runtime");
  if (fs.existsSync(fromCwd)) return fromCwd;
  const fromDirname = path.join(__dirname, "..", "..", "runtime");
  return fromDirname;
}

export function generateGameHTML(config: GameConfig): string {
  const runtimeDir = getRuntimeDir();

  const runtimeCode = RUNTIME_FILES.map((file) => {
    const filePath = path.join(runtimeDir, file);
    return "// === " + file + " ===\n" + fs.readFileSync(filePath, "utf-8");
  }).join("\n\n");

  let configJson = JSON.stringify(config);
  configJson = configJson.replace(/<\/script/gi, "\\u003c/script");

  const title =
    config.gameType === "turn-based" && config.turnBased?.common?.title
      ? config.turnBased.common.title
      : config.meta?.title || "Game";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${String(title).replace(/</g, "&lt;")}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"><\/script>
  <script>
    window.GAME_CONFIG = ${configJson};
  <\/script>
  <script>
    ${runtimeCode}
  <\/script>
</body>
</html>`;
}
