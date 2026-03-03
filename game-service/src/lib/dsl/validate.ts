import type { GameConfig } from "./schema";

export interface ValidationError {
  path: string;
  message: string;
  severity?: "error" | "warning";
}

export function validateGameLogic(config: GameConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check that referenced projectileTypes exist
  for (let i = 0; i < config.enemies.length; i++) {
    const enemy = config.enemies[i];
    if (enemy.behavior.shoots && enemy.behavior.projectileType) {
      const found = config.projectileTypes.find(
        (p) => p.name === enemy.behavior.projectileType,
      );
      if (!found) {
        errors.push({
          path: `enemies.${i}.behavior.projectileType`,
          message: `References projectile type "${enemy.behavior.projectileType}" which does not exist`,
        });
      }
    }
  }

  for (const ability of config.player.abilities) {
    if (ability.type === "shoot" && ability.projectileType) {
      const found = config.projectileTypes.find(
        (p) => p.name === ability.projectileType,
      );
      if (!found) {
        errors.push({
          path: "player.abilities.shoot.projectileType",
          message: `References projectile type "${ability.projectileType}" which does not exist`,
        });
      }
    }
  }

  // Check spawners reference existing enemies
  for (let i = 0; i < config.spawners.length; i++) {
    const spawner = config.spawners[i];
    const found = config.enemies.find((e) => e.name === spawner.enemyName);
    if (!found) {
      errors.push({
        path: `spawners.${i}`,
        message: `Spawner references enemy "${spawner.enemyName}" which does not exist`,
      });
    }
  }

  // Check win condition feasibility
  if (config.rules.winCondition.type === "collect-all-keys") {
    const keyCount = config.collectibles.filter(
      (c) => c.effect === "key",
    ).length;
    if (keyCount === 0) {
      errors.push({
        path: "rules.winCondition",
        message:
          'Win condition is collect-all-keys but no collectibles have effect "key"',
      });
    }
  }

  if (
    config.rules.winCondition.type === "kill-all" &&
    config.enemies.length === 0 &&
    config.spawners.length === 0
  ) {
    errors.push({
      path: "rules.winCondition",
      message: "Win condition is kill-all but there are no enemies or spawners",
    });
  }

  // Check player is within world bounds
  const wb = config.meta.worldBounds;
  if (
    config.player.x > wb.width ||
    config.player.y > wb.height ||
    config.player.x < 0 ||
    config.player.y < 0
  ) {
    errors.push({
      path: "player",
      message: "Player spawn position is outside world bounds",
    });
  }

  // Check that there's at least one platform below the player in platformer genre
  if (config.meta.genre === "platformer") {
    const hasFloor = config.platforms.some((p) => p.y > config.player.y);
    if (!hasFloor) {
      errors.push({
        path: "platforms",
        message:
          "Platformer has no platforms below the player spawn — player will fall to death immediately",
      });
    }
  }

  // Genre-specific gravity sanity check
  if (config.meta.genre === "top-down" && config.meta.gravity.y !== 0) {
    errors.push({
      path: "meta.gravity",
      message: "Top-down genre should have y gravity = 0",
      severity: "warning",
    });
  }

  // Turn-based game validation
  if (config.gameType === "turn-based" && config.turnBased) {
    const tb = config.turnBased;
    const subGenreFieldMap: Record<string, keyof typeof tb> = {
      "grid-game": "gridGame",
      "word-game": "wordGame",
      "board-game": "boardGame",
      "memory-game": "memoryGame",
      "trivia-game": "triviaGame",
      "card-game": "cardGame",
    };
    const field = subGenreFieldMap[tb.subGenre];
    if (field && !tb[field]) {
      errors.push({
        path: `turnBased.${field}`,
        message: `subGenre is "${tb.subGenre}" but ${field} config is missing`,
      });
    }

    // Grid game validations
    if (tb.subGenre === "grid-game" && tb.gridGame) {
      const grid = tb.gridGame;
      const winCond = grid.winCondition ?? {
        type: "n-in-a-row" as const,
        count: 3,
      };
      if (
        winCond.type === "n-in-a-row" &&
        "count" in winCond &&
        winCond.count > Math.max(grid.rows, grid.cols)
      ) {
        errors.push({
          path: "turnBased.gridGame.winCondition.count",
          message: `Win count (${winCond.count}) exceeds board dimensions (${grid.rows}x${grid.cols})`,
        });
      }
      if (
        grid.placement === "gravity-bottom" &&
        winCond.type === "n-in-a-row" &&
        "count" in winCond &&
        winCond.count > grid.rows
      ) {
        const dirs = winCond.directions ?? [];
        if (!dirs.includes("horizontal")) {
          errors.push({
            path: "turnBased.gridGame.winCondition",
            message:
              "Gravity-bottom game with win count > rows needs horizontal win direction",
            severity: "warning",
          });
        }
      }
    }

    // Memory game validations
    if (tb.subGenre === "memory-game" && tb.memoryGame) {
      const totalCells = tb.memoryGame.rows * tb.memoryGame.cols;
      if (totalCells % 2 !== 0) {
        errors.push({
          path: "turnBased.memoryGame",
          message: `Grid has ${totalCells} cells — must be even for pairs`,
        });
      }
      if (
        tb.memoryGame.theme === "custom" &&
        tb.memoryGame.customLabels.length < totalCells / 2
      ) {
        errors.push({
          path: "turnBased.memoryGame.customLabels",
          message: `Need at least ${totalCells / 2} custom labels for a ${tb.memoryGame.rows}x${tb.memoryGame.cols} grid`,
        });
      }
    }

    // Word game validations
    if (tb.subGenre === "word-game" && tb.wordGame) {
      if (
        tb.wordGame.wordSource === "custom-list" &&
        tb.wordGame.customWords.length === 0
      ) {
        errors.push({
          path: "turnBased.wordGame.customWords",
          message: "Word source is custom-list but no custom words provided",
        });
      }
      if (
        tb.wordGame.subType === "wordle" &&
        tb.wordGame.customWords.length > 0
      ) {
        const wordLength = tb.wordGame.wordle?.wordLength ?? 5;
        const invalidWords = tb.wordGame.customWords.filter(
          (w) => w.length !== wordLength,
        );
        if (invalidWords.length > 0) {
          errors.push({
            path: "turnBased.wordGame.customWords",
            message: `These words don't match wordle wordLength (${wordLength}): ${invalidWords.slice(0, 5).join(", ")}${invalidWords.length > 5 ? "..." : ""}`,
          });
        }
      }
    }

    // Trivia validations
    if (tb.subGenre === "trivia-game" && tb.triviaGame) {
      if (tb.triviaGame.questions.length === 0) {
        errors.push({
          path: "turnBased.triviaGame.questions",
          message: "Trivia game has no questions",
        });
      }
      for (let i = 0; i < tb.triviaGame.questions.length; i++) {
        const q = tb.triviaGame.questions[i];
        if (q.correctIndex >= q.answers.length) {
          errors.push({
            path: `turnBased.triviaGame.questions[${i}].correctIndex`,
            message: `correctIndex (${q.correctIndex}) exceeds answers length (${q.answers.length})`,
          });
        }
      }
    }

    // Board game validations
    if (tb.subGenre === "board-game" && tb.boardGame) {
      if (tb.boardGame.spaces.length === 0) {
        errors.push({
          path: "turnBased.boardGame.spaces",
          message: "Board game has no spaces defined",
        });
      }
      const startSpaces = tb.boardGame.spaces.filter((s) => s.type === "start");
      if (startSpaces.length === 0 && tb.boardGame.spaces.length > 0) {
        errors.push({
          path: "turnBased.boardGame.spaces",
          message: "Board game has no start space",
        });
      }
      for (const space of tb.boardGame.spaces) {
        if (space.linkedSpaceId !== undefined) {
          const linked = tb.boardGame!.spaces.find(
            (s) => s.id === space.linkedSpaceId,
          );
          if (!linked) {
            errors.push({
              path: `turnBased.boardGame.spaces`,
              message: `Space ${space.id} links to space ${space.linkedSpaceId} which doesn't exist`,
            });
          }
        }
      }
    }

    // Player count validations
    const common = tb.common ?? {};
    const players = common.players ?? [];
    if (players.length < 1) {
      errors.push({
        path: "turnBased.common.players",
        message: "Need at least 1 player",
      });
    }
    if (tb.subGenre === "grid-game" && players.length < 2) {
      errors.push({
        path: "turnBased.common.players",
        message: "Grid games need at least 2 players",
      });
    }
    if (tb.subGenre === "word-game" && players.length > 1) {
      errors.push({
        path: "turnBased.common.players",
        message: "Word games are typically single player",
        severity: "warning",
      });
    }
  }

  return errors;
}
