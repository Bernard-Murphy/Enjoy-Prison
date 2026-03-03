import {
  GameConfigSchema,
  EnemyConfig,
  CollectibleConfig,
  PlatformConfig,
  ProjectileTypeConfig,
  SpawnerConfig,
  DecorationConfig,
  TurnBasedPlayerConfig,
  TurnBasedConfig,
  GridGameConfig,
  WordGameConfig,
  BoardGameConfig,
  MemoryGameConfig,
  TriviaGameConfig,
  TriviaQuestionConfig,
  CardGameConfig,
} from "./schema";
import type {
  GameConfig,
  EnemyConfigType,
  CollectibleConfigType,
  PlatformConfigType,
  ProjectileTypeConfigType,
  SpawnerConfigType,
  DecorationConfigType,
  TurnBasedPlayerConfigType,
} from "./schema";

export function createDefaultGameConfig(
  overrides?: Partial<GameConfig>,
): GameConfig {
  return GameConfigSchema.parse(overrides ?? {});
}

export function createDefaultEnemy(
  overrides?: Partial<EnemyConfigType>,
): EnemyConfigType {
  return EnemyConfig.parse({
    name: "Enemy",
    x: 200,
    y: 300,
    ...overrides,
  });
}

export function createDefaultCollectible(
  overrides?: Partial<CollectibleConfigType>,
): CollectibleConfigType {
  return CollectibleConfig.parse({
    name: "Collectible",
    x: 150,
    y: 250,
    ...overrides,
  });
}

export function createDefaultPlatform(
  overrides?: Partial<PlatformConfigType>,
): PlatformConfigType {
  return PlatformConfig.parse({
    x: 0,
    y: 400,
    width: 200,
    height: 32,
    ...overrides,
  });
}

export function createDefaultProjectileType(
  overrides?: Partial<ProjectileTypeConfigType>,
): ProjectileTypeConfigType {
  return ProjectileTypeConfig.parse({
    name: "bullet",
    ...overrides,
  });
}

export function createDefaultSpawner(
  overrides?: Partial<SpawnerConfigType>,
): SpawnerConfigType {
  return SpawnerConfig.parse({
    enemyName: "Enemy",
    x: 400,
    y: 300,
    ...overrides,
  });
}

export function createDefaultDecoration(
  overrides?: Partial<DecorationConfigType>,
): DecorationConfigType {
  return DecorationConfig.parse({
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    ...overrides,
  });
}

// Turn-based defaults

export function createDefaultTurnBasedPlayer(
  overrides?: Partial<TurnBasedPlayerConfigType>,
): TurnBasedPlayerConfigType {
  return TurnBasedPlayerConfig.parse({
    name: "Player 1",
    type: "human",
    color: "#4488ff",
    symbol: "X",
    ...overrides,
  });
}

const defaultTurnBasedPlayers = [
  { name: "Player 1", type: "human" as const, color: "#4488ff", symbol: "X" },
  {
    name: "Player 2",
    type: "ai" as const,
    aiDifficulty: "medium" as const,
    color: "#ff4444",
    symbol: "O",
  },
];

export function createDefaultGridGame(): Partial<GameConfig> {
  return {
    gameType: "turn-based",
    turnBased: TurnBasedConfig.parse({
      subGenre: "grid-game",
      common: { title: "Grid Game", players: defaultTurnBasedPlayers },
      gridGame: GridGameConfig.parse({ rows: 3, cols: 3 }),
    }),
  };
}

export function createDefaultWordGame(): Partial<GameConfig> {
  return {
    gameType: "turn-based",
    turnBased: TurnBasedConfig.parse({
      subGenre: "word-game",
      common: {
        title: "Word Game",
        players: [
          { name: "Player 1", type: "human", color: "#4488ff", symbol: "" },
        ],
      },
      wordGame: WordGameConfig.parse({ subType: "hangman" }),
    }),
  };
}

export function createDefaultMemoryGame(): Partial<GameConfig> {
  return {
    gameType: "turn-based",
    turnBased: TurnBasedConfig.parse({
      subGenre: "memory-game",
      common: { title: "Memory Game", players: defaultTurnBasedPlayers },
      memoryGame: MemoryGameConfig.parse({ rows: 4, cols: 4, theme: "shapes" }),
    }),
  };
}

export function createDefaultBoardGame(): Partial<GameConfig> {
  return {
    gameType: "turn-based",
    turnBased: TurnBasedConfig.parse({
      subGenre: "board-game",
      common: { title: "Board Game", players: defaultTurnBasedPlayers },
      boardGame: BoardGameConfig.parse({
        subType: "snakes-ladders",
        layout: "linear",
        spaces: [],
        boardSize: 100,
      }),
    }),
  };
}

export function createDefaultTriviaGame(): Partial<GameConfig> {
  const sampleQuestions = [
    {
      question: "What is 2 + 2?",
      answers: ["3", "4", "5", "6"],
      correctIndex: 1,
      category: "Math",
      difficulty: "easy" as const,
      points: 100,
    },
  ];
  return {
    gameType: "turn-based",
    turnBased: TurnBasedConfig.parse({
      subGenre: "trivia-game",
      common: { title: "Trivia Game", players: defaultTurnBasedPlayers },
      triviaGame: TriviaGameConfig.parse({
        questions: sampleQuestions,
        questionCount: 10,
      }),
    }),
  };
}

export function createDefaultCardGame(): Partial<GameConfig> {
  return {
    gameType: "turn-based",
    turnBased: TurnBasedConfig.parse({
      subGenre: "card-game",
      common: { title: "Card Game", players: defaultTurnBasedPlayers },
      cardGame: CardGameConfig.parse({ subType: "war" }),
    }),
  };
}
