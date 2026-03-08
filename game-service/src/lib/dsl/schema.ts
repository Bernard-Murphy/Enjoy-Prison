import { z } from "zod";

// -- Reusable sub-schemas (exported for plan editor) --

export const HexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .default("#ffffff");

export const EntityAppearance = z
  .object({
    type: z
      .enum(["rectangle", "circle", "triangle", "sprite"])
      .default("rectangle"),
    color: HexColor.default("#4488ff"),
    borderColor: HexColor.default("#ffffff"),
    borderWidth: z.number().min(0).max(8).default(0),
    spriteKey: z.string().optional(),
    spriteDescription: z.string().optional(),
  })
  .default({});

export const FrameAnimation = z
  .object({
    type: z
      .enum(["color-pulse", "scale-bounce", "rotation", "flash", "none"])
      .default("none"),
    speed: z.number().min(0.1).max(10).default(1),
    colors: z.array(HexColor).optional(),
    scaleMin: z.number().min(0.1).max(2).default(0.9),
    scaleMax: z.number().min(0.5).max(3).default(1.1),
    rotationSpeed: z.number().min(-720).max(720).default(90),
  })
  .default({});

export const AnimationSet = z
  .object({
    idle: FrameAnimation.optional(),
    move: FrameAnimation.optional(),
    jump: FrameAnimation.optional(),
    fall: FrameAnimation.optional(),
    attack: FrameAnimation.optional(),
    damage: FrameAnimation.optional(),
    death: FrameAnimation.optional(),
  })
  .default({});

export const PlayerAbility = z.object({
  type: z.enum([
    "jump",
    "double-jump",
    "wall-jump",
    "dash",
    "shoot",
    "melee-attack",
    "shield",
  ]),
  trigger: z.enum(["action1", "action2"]).default("action1"),
  cooldownMs: z.number().min(0).max(10000).default(0),
  projectileType: z.string().optional(),
  attackRange: z.number().min(1).max(500).default(40),
  attackDamage: z.number().min(0).max(1000).default(1),
  attackDuration: z.number().min(50).max(2000).default(200),
  dashSpeed: z.number().min(100).max(2000).default(600),
  dashDuration: z.number().min(50).max(1000).default(200),
  shieldDuration: z.number().min(100).max(10000).default(2000),
});

export const EnemyBehavior = z
  .object({
    type: z
      .enum([
        "patrol",
        "chase",
        "stationary",
        "flying-patrol",
        "flying-chase",
        "bounce",
      ])
      .default("patrol"),
    patrolDistance: z.number().min(0).max(2000).default(200),
    patrolAxis: z.enum(["horizontal", "vertical"]).default("horizontal"),
    chaseRange: z.number().min(0).max(1000).default(200),
    chaseSpeed: z.number().min(0).max(1000).default(150),
    bounceHeight: z.number().min(0).max(500).default(100),
    floatAmplitude: z.number().min(0).max(200).default(30),
    floatSpeed: z.number().min(0).max(10).default(2),
    shoots: z.boolean().default(false),
    shootInterval: z.number().min(200).max(10000).default(2000),
    projectileType: z.string().optional(),
  })
  .default({});

export const EnemyConfig = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().min(4).max(256).default(32),
  height: z.number().min(4).max(256).default(32),
  health: z.number().min(1).max(1000).default(1),
  damage: z.number().min(0).max(100).default(1),
  speed: z.number().min(0).max(1000).default(100),
  scoreValue: z.number().min(0).max(10000).default(100),
  appearance: EntityAppearance.default({}),
  behavior: EnemyBehavior.default({}),
  animations: AnimationSet.default({}),
  drops: z
    .array(
      z.object({
        collectibleName: z.string(),
        chance: z.number().min(0).max(1).default(0.5),
      }),
    )
    .default([]),
});

export const CollectibleConfig = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().min(4).max(128).default(16),
  height: z.number().min(4).max(128).default(16),
  appearance: EntityAppearance.default({
    type: "circle",
    color: "#ffdd00",
  }),
  effect: z
    .enum([
      "score",
      "health",
      "extra-life",
      "speed-boost",
      "invincibility",
      "key",
    ])
    .default("score"),
  value: z.number().min(0).max(10000).default(10),
  duration: z.number().min(0).max(60000).default(0),
  respawn: z.boolean().default(false),
  respawnTime: z.number().min(0).max(60000).default(5000),
  animations: AnimationSet.default({}),
});

export const PlatformConfig = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().min(4).max(4000).default(200),
  height: z.number().min(4).max(1000).default(32),
  appearance: EntityAppearance.default({
    type: "rectangle",
    color: "#555555",
  }),
  type: z.enum(["static", "moving", "falling", "one-way"]).default("static"),
  moveAxis: z.enum(["horizontal", "vertical"]).default("horizontal"),
  moveDistance: z.number().min(0).max(2000).default(200),
  moveSpeed: z.number().min(0).max(1000).default(100),
  fallDelay: z.number().min(0).max(5000).default(500),
  respawn: z.boolean().default(true),
  respawnTime: z.number().min(0).max(10000).default(3000),
});

export const ProjectileTypeConfig = z.object({
  name: z.string(),
  width: z.number().min(2).max(64).default(8),
  height: z.number().min(2).max(64).default(8),
  speed: z.number().min(50).max(2000).default(400),
  damage: z.number().min(0).max(100).default(1),
  lifetime: z.number().min(100).max(30000).default(3000),
  appearance: EntityAppearance.default({
    type: "circle",
    color: "#ff4444",
  }),
  piercing: z.boolean().default(false),
  gravity: z.boolean().default(false),
});

export const SpawnerConfig = z.object({
  enemyName: z.string(),
  x: z.number(),
  y: z.number(),
  spawnRadius: z.number().min(0).max(500).default(50),
  interval: z.number().min(500).max(60000).default(3000),
  maxActive: z.number().min(1).max(50).default(5),
  totalSpawns: z.number().min(0).max(1000).default(0),
  startDelay: z.number().min(0).max(30000).default(0),
});

export const DecorationConfig = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().min(1).max(4000).default(64),
  height: z.number().min(1).max(4000).default(64),
  appearance: EntityAppearance.default({}),
  parallaxFactor: z.number().min(0).max(2).default(1),
  layer: z.enum(["background", "foreground"]).default("background"),
});

export const WinCondition = z
  .object({
    type: z
      .enum([
        "score",
        "survive-time",
        "kill-all",
        "reach-point",
        "collect-all-keys",
        "none",
      ])
      .default("score"),
    value: z.number().min(0).default(1000),
    targetX: z.number().optional(),
    targetY: z.number().optional(),
    targetWidth: z.number().min(1).default(64),
    targetHeight: z.number().min(1).default(64),
  })
  .default({});

// ============================================================
// TURN-BASED SUB-SCHEMAS
// ============================================================

export const TurnBasedPlayerConfig = z.object({
  name: z.string().default("Player 1"),
  type: z.enum(["human", "ai", "remote"]).default("human"),
  aiDifficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  color: HexColor.default("#4488ff"),
  symbol: z.string().max(2).default("X"),
  avatarShape: z.enum(["circle", "rectangle", "triangle"]).default("circle"),
});

const GridWinCondition = z
  .object({
    type: z.enum([
      "n-in-a-row",
      "most-pieces",
      "eliminate-all",
      "reach-opposite",
      "custom-pattern",
    ]),
    count: z.number().min(2).max(20).default(3),
    directions: z
      .array(z.enum(["horizontal", "vertical", "diagonal-down", "diagonal-up"]))
      .default(["horizontal", "vertical", "diagonal-down", "diagonal-up"]),
  })
  .default({
    type: "n-in-a-row",
    count: 3,
    directions: ["horizontal", "vertical", "diagonal-down", "diagonal-up"],
  });

const GridMoveRules = z
  .object({
    directions: z
      .array(z.enum(["forward-diagonal", "any-diagonal", "orthogonal", "any"]))
      .default(["forward-diagonal"]),
    maxDistance: z.number().min(1).max(20).default(1),
    canJump: z.boolean().default(false),
    jumpCaptures: z.boolean().default(false),
    mustJumpIfAble: z.boolean().default(false),
    kingRow: z.boolean().default(false),
    kingDirections: z
      .array(z.enum(["forward-diagonal", "any-diagonal", "orthogonal", "any"]))
      .default(["any-diagonal"]),
  })
  .default({});

export const GridGameConfig = z.object({
  rows: z.number().min(2).max(20).default(3),
  cols: z.number().min(2).max(20).default(3),
  cellSize: z.number().min(30).max(200).default(100),
  cellColor: HexColor.default("#2a2a4a"),
  cellBorderColor: HexColor.default("#ffffff"),
  cellBorderWidth: z.number().min(0).max(6).default(2),
  cellCornerRadius: z.number().min(0).max(30).default(4),
  gridSpacing: z.number().min(0).max(20).default(4),
  placement: z
    .enum(["any-empty", "gravity-bottom", "adjacent-flip", "move-existing"])
    .default("any-empty"),
  winCondition: GridWinCondition,
  drawCondition: z
    .enum(["board-full", "no-moves", "none"])
    .default("board-full"),
  moveRules: GridMoveRules,
  pieceStyle: z
    .enum(["symbol", "fill-cell", "circle", "custom"])
    .default("symbol"),
});

const HangmanSubConfig = z
  .object({
    maxWrongGuesses: z.number().min(4).max(12).default(6),
    showCategory: z.boolean().default(true),
    drawStyle: z.enum(["classic", "simple", "countdown"]).default("classic"),
    bodyColor: HexColor.default("#ffffff"),
    gallowsColor: HexColor.default("#888888"),
  })
  .default({});

const WordleSubConfig = z
  .object({
    wordLength: z.number().min(4).max(8).default(5),
    maxAttempts: z.number().min(4).max(10).default(6),
    correctColor: HexColor.default("#538d4e"),
    misplacedColor: HexColor.default("#b59f3b"),
    wrongColor: HexColor.default("#3a3a3c"),
    tileSize: z.number().min(40).max(100).default(62),
    hardMode: z.boolean().default(false),
  })
  .default({});

export const WordGameConfig = z.object({
  subType: z.enum(["hangman", "wordle"]).default("hangman"),
  wordSource: z.enum(["built-in", "custom-list"]).default("built-in"),
  customWords: z.array(z.string()).default([]),
  wordCategory: z
    .enum([
      "common",
      "animals",
      "countries",
      "food",
      "science",
      "movies",
      "sports",
      "mixed",
    ])
    .default("mixed"),
  minWordLength: z.number().min(3).max(15).default(4),
  maxWordLength: z.number().min(3).max(15).default(8),
  hangman: HangmanSubConfig,
  wordle: WordleSubConfig,
  showHint: z.boolean().default(false),
  hintText: z.string().default(""),
  letterDisplayStyle: z
    .enum(["boxes", "underscores", "tiles"])
    .default("boxes"),
  letterColor: HexColor.default("#ffffff"),
  letterSize: z.number().min(16).max(72).default(32),
});

export const BoardSpaceConfig = z.object({
  id: z.number(),
  name: z.string(),
  type: z
    .enum([
      "start",
      "property",
      "tax",
      "chance",
      "community-chest",
      "jail",
      "go-to-jail",
      "free-parking",
      "railroad",
      "utility",
      "blank",
      "ladder-bottom",
      "ladder-top",
      "snake-head",
      "snake-tail",
      "bonus",
      "penalty",
      "shop",
      "event",
      "finish",
    ])
    .default("blank"),
  color: HexColor.default("#333333"),
  propertyCost: z.number().min(0).default(0),
  propertyRent: z.number().min(0).default(0),
  propertyGroup: z.string().default(""),
  amount: z.number().default(0),
  eventText: z.string().default(""),
  linkedSpaceId: z.number().optional(),
});

export const ChanceCardConfig = z.object({
  text: z.string(),
  effect: z.enum([
    "gain-money",
    "lose-money",
    "move-to-space",
    "move-forward",
    "move-backward",
    "collect-from-all",
    "pay-to-all",
    "go-to-jail",
    "get-out-of-jail",
    "skip-turn",
    "extra-turn",
  ]),
  value: z.number().default(0),
  targetSpaceId: z.number().optional(),
});

export const BoardGameConfig = z.object({
  subType: z
    .enum(["property-trading", "snakes-ladders", "race"])
    .default("property-trading"),
  layout: z.enum(["square-loop", "linear", "spiral"]).default("square-loop"),
  spaces: z.array(BoardSpaceConfig).default([]),
  spacesPerSide: z.number().min(5).max(15).default(10),
  spaceWidth: z.number().min(40).max(120).default(70),
  spaceHeight: z.number().min(40).max(120).default(90),
  diceCount: z.number().min(1).max(3).default(2),
  diceSides: z.number().min(4).max(20).default(6),
  doublesExtraTurn: z.boolean().default(true),
  doublesThreeGoToJail: z.boolean().default(true),
  startingMoney: z.number().min(0).max(100000).default(1500),
  passGoAmount: z.number().min(0).max(10000).default(200),
  currencySymbol: z.string().max(3).default("$"),
  showMoney: z.boolean().default(true),
  canBuyProperties: z.boolean().default(true),
  auctionOnDecline: z.boolean().default(false),
  buildHouses: z.boolean().default(false),
  houseCost: z.number().min(0).default(100),
  maxHousesPerProperty: z.number().min(0).max(5).default(4),
  chanceCards: z.array(ChanceCardConfig).default([]),
  communityChestCards: z.array(ChanceCardConfig).default([]),
  winCondition: z
    .enum(["last-standing", "reach-finish", "most-money", "most-property"])
    .default("last-standing"),
  maxRounds: z.number().min(0).max(200).default(0),
  boardSize: z.number().min(20).max(100).default(100),
});

const MemoryCardLabel = z.object({
  front: z.string(),
  match: z.string().optional(),
});

export const MemoryGameConfig = z.object({
  rows: z.number().min(2).max(8).default(4),
  cols: z.number().min(2).max(8).default(4),
  cardWidth: z.number().min(40).max(150).default(80),
  cardHeight: z.number().min(40).max(150).default(80),
  cardSpacing: z.number().min(2).max(20).default(8),
  cardBackColor: HexColor.default("#4455aa"),
  cardFrontColor: HexColor.default("#ffffff"),
  cardBorderColor: HexColor.default("#aaaaaa"),
  cardBorderWidth: z.number().min(0).max(4).default(2),
  cardCornerRadius: z.number().min(0).max(20).default(8),
  matchType: z
    .enum(["identical-pairs", "related-pairs"])
    .default("identical-pairs"),
  theme: z
    .enum(["shapes", "letters", "numbers", "emoji", "colors", "custom"])
    .default("shapes"),
  customLabels: z.array(MemoryCardLabel).default([]),
  cardsFlippedPerTurn: z.number().min(2).max(3).default(2),
  flipDuration: z.number().min(200).max(2000).default(400),
  mismatchShowTime: z.number().min(500).max(3000).default(1000),
  scoringMethod: z
    .enum(["pairs-found", "fewer-moves", "timed"])
    .default("pairs-found"),
  showMoveCounter: z.boolean().default(true),
  showTimer: z.boolean().default(false),
  timeLimit: z.number().min(0).max(600).default(0),
});

export const TriviaQuestionConfig = z.object({
  question: z.string(),
  answers: z.array(z.string()).min(2).max(6),
  correctIndex: z.number().min(0).max(5),
  category: z.string().default("General"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  timeLimit: z.number().min(0).max(120).default(0),
  explanation: z.string().default(""),
  points: z.number().min(0).max(10000).default(100),
});

export const TriviaGameConfig = z.object({
  questions: z.array(TriviaQuestionConfig).default([]),
  questionCount: z.number().min(1).max(100).default(10),
  shuffleQuestions: z.boolean().default(true),
  shuffleAnswers: z.boolean().default(true),
  timeLimitPerQuestion: z.number().min(0).max(120).default(15),
  showExplanation: z.boolean().default(true),
  showCorrectAnswer: z.boolean().default(true),
  pointsPerCorrect: z.number().min(0).max(10000).default(100),
  pointsPerWrong: z.number().min(-1000).max(0).default(0),
  bonusForSpeed: z.boolean().default(false),
  streakBonus: z.boolean().default(false),
  questionFontSize: z.number().min(16).max(48).default(24),
  answerFontSize: z.number().min(14).max(36).default(18),
  questionColor: HexColor.default("#ffffff"),
  answerBoxColor: HexColor.default("#333366"),
  correctColor: HexColor.default("#44aa44"),
  wrongColor: HexColor.default("#aa4444"),
  answerBoxCornerRadius: z.number().min(0).max(20).default(8),
  categories: z.array(z.string()).default([]),
  showCategoryBadge: z.boolean().default(true),
  buzzInMode: z.boolean().default(false),
});

export const CardConfig = z.object({
  suit: z
    .enum(["hearts", "diamonds", "clubs", "spades", "wild", "custom"])
    .default("custom"),
  value: z.string(),
  displayName: z.string().default(""),
  color: HexColor.default("#ffffff"),
  points: z.number().default(0),
  special: z
    .enum([
      "none",
      "skip",
      "reverse",
      "draw-two",
      "draw-four",
      "wild",
      "wild-draw-four",
    ])
    .default("none"),
});

export const CardGameConfig = z.object({
  subType: z
    .enum(["matching", "shedding", "war", "solitaire", "blackjack"])
    .default("matching"),
  useStandardDeck: z.boolean().default(true),
  standardDeckCount: z.number().min(1).max(4).default(1),
  customCards: z.array(CardConfig).default([]),
  includeJokers: z.boolean().default(false),
  cardWidth: z.number().min(40).max(120).default(70),
  cardHeight: z.number().min(60).max(180).default(100),
  cardBackColor: HexColor.default("#1a3a6a"),
  cardBackPattern: z
    .enum(["solid", "crosshatch", "diamond", "stripe"])
    .default("diamond"),
  cardCornerRadius: z.number().min(0).max(15).default(6),
  cardsPerPlayer: z.number().min(1).max(52).default(7),
  drawPileVisible: z.boolean().default(true),
  discardPileVisible: z.boolean().default(true),
  setSize: z.number().min(2).max(4).default(4),
  matchBy: z
    .enum(["suit", "value", "color", "suit-or-value"])
    .default("suit-or-value"),
  canDrawFromPile: z.boolean().default(true),
  mustPlayIfAble: z.boolean().default(true),
  warCardCount: z.number().min(1).max(5).default(3),
  targetScore: z.number().min(10).max(100).default(21),
  dealerStandsOn: z.number().min(10).max(25).default(17),
  winCondition: z
    .enum([
      "empty-hand",
      "most-sets",
      "most-cards",
      "closest-target",
      "last-standing",
    ])
    .default("empty-hand"),
});

// ============================================================
// TURN-BASED COMMON CONFIG
// ============================================================

const TurnBasedCommonConfig = z.object({
  title: z.string().default("Untitled Game"),
  description: z.string().default(""),
  viewport: z
    .object({
      width: z.number().min(320).max(1920).default(800),
      height: z.number().min(240).max(1080).default(600),
    })
    .default({}),
  backgroundColor: HexColor.default("#1a1a2e"),
  players: z
    .array(TurnBasedPlayerConfig)
    .min(1)
    .max(6)
    .default([
      {
        name: "Player 1",
        type: "human",
        color: "#4488ff",
        symbol: "X",
      },
      {
        name: "Player 2",
        type: "ai",
        aiDifficulty: "medium",
        color: "#ff4444",
        symbol: "O",
      },
    ]),
  turnTimeLimit: z.number().min(0).max(300).default(0),
  showTurnIndicator: z.boolean().default(true),
  showTurnNumber: z.boolean().default(false),
  turnStartMessage: z.string().default("{player}'s turn"),
  winMessage: z.string().default("{player} wins!"),
  drawMessage: z.string().default("It's a draw!"),
  loseMessage: z.string().default("Game Over!"),
  fontFamily: z
    .enum(["monospace", "sans-serif", "serif"])
    .default("sans-serif"),
  primaryTextColor: HexColor.default("#ffffff"),
  secondaryTextColor: HexColor.default("#aaaaaa"),
  accentColor: HexColor.default("#ffcc00"),
  showScore: z.boolean().default(true),
  scoreLabel: z.string().default("Score"),
  menu: z
    .object({
      title: z.string().default("My Game"),
      subtitle: z.string().default(""),
      showPlayerSetup: z.boolean().default(true),
      backgroundColor: HexColor.default("#1a1a2e"),
      logoUrl: z.string().optional(),
    })
    .default({}),
});

export const TurnBasedConfig = z.object({
  subGenre: z.enum([
    "grid-game",
    "word-game",
    "board-game",
    "memory-game",
    "trivia-game",
    "card-game",
  ]),
  common: TurnBasedCommonConfig.default({}),
  gridGame: GridGameConfig.optional(),
  wordGame: WordGameConfig.optional(),
  boardGame: BoardGameConfig.optional(),
  memoryGame: MemoryGameConfig.optional(),
  triviaGame: TriviaGameConfig.optional(),
  cardGame: CardGameConfig.optional(),
});

export const LoseCondition = z
  .object({
    type: z
      .enum(["health-zero", "lives-zero", "timer-expired", "fall-off-screen"])
      .default("health-zero"),
  })
  .default({});

export const ScoringRule = z.object({
  event: z.enum(["collect", "kill", "survive-second", "reach-checkpoint"]),
  points: z.number().min(0).max(100000).default(10),
});

// -- Multiplayer (optional) --

export const MultiplayerConfig = z
  .object({
    enabled: z.boolean().default(false),
    maxPlayers: z.number().int().min(2).max(6).default(2),
    mode: z.enum(["cooperative", "competitive"]).default("competitive"),
  })
  .optional();

// -- Top-level Game Config --

export const GameConfigSchema = z.object({
  gameType: z.enum(["action", "turn-based"]).default("action"),
  turnBased: TurnBasedConfig.optional(),
  multiplayer: MultiplayerConfig,

  meta: z
    .object({
      title: z.string().default("Untitled Game"),
      description: z.string().default(""),
      genre: z
        .enum([
          "platformer",
          "top-down",
          "shooter",
          "puzzle",
          "endless-runner",
          "fighting",
        ])
        .default("platformer"),
      viewport: z
        .object({
          width: z.number().min(320).max(1920).default(800),
          height: z.number().min(240).max(1080).default(600),
        })
        .default({}),
      backgroundColor: HexColor.default("#1a1a2e"),
      gravity: z
        .object({
          x: z.number().min(-2000).max(2000).default(0),
          y: z.number().min(-2000).max(2000).default(800),
        })
        .default({}),
      cameraFollow: z.boolean().default(true),
      worldBounds: z
        .object({
          width: z.number().min(320).max(50000).default(3200),
          height: z.number().min(240).max(10000).default(600),
        })
        .default({}),
    })
    .default({}),

  controls: z
    .object({
      up: z.string().default("ArrowUp"),
      down: z.string().default("ArrowDown"),
      left: z.string().default("ArrowLeft"),
      right: z.string().default("ArrowRight"),
      action1: z.string().default("Space"),
      action2: z.string().default("KeyZ"),
      pause: z.string().default("Escape"),
    })
    .default({}),

  player: z
    .object({
      name: z.string().default("Player"),
      x: z.number().default(100),
      y: z.number().default(300),
      width: z.number().min(4).max(256).default(32),
      height: z.number().min(4).max(256).default(48),
      speed: z.number().min(0).max(2000).default(200),
      jumpForce: z.number().min(-2000).max(0).default(-400),
      maxJumps: z.number().min(1).max(5).default(1),
      health: z.number().min(1).max(1000).default(3),
      maxHealth: z.number().min(1).max(1000).default(3),
      lives: z.number().min(0).max(99).default(3),
      invincibilityDuration: z.number().min(0).max(10000).default(1000),
      appearance: EntityAppearance.default({
        type: "rectangle",
        color: "#4488ff",
      }),
      abilities: z
        .array(PlayerAbility)
        .default([{ type: "jump", trigger: "action1" }]),
      animations: AnimationSet.default({}),
    })
    .default({}),

  enemies: z.array(EnemyConfig).default([]),
  collectibles: z.array(CollectibleConfig).default([]),
  platforms: z.array(PlatformConfig).default([]),
  projectileTypes: z.array(ProjectileTypeConfig).default([]),
  spawners: z.array(SpawnerConfig).default([]),
  decorations: z.array(DecorationConfig).default([]),

  ui: z
    .object({
      showHealthBar: z.boolean().default(true),
      showScore: z.boolean().default(true),
      showLives: z.boolean().default(true),
      showTimer: z.boolean().default(false),
      timerDirection: z.enum(["up", "down"]).default("up"),
      timerSeconds: z.number().min(0).max(3600).default(60),
      customText: z
        .array(
          z.object({
            x: z.number(),
            y: z.number(),
            text: z.string(),
            fontSize: z.number().min(8).max(72).default(16),
            color: HexColor.default("#ffffff"),
          }),
        )
        .default([]),
    })
    .default({}),

  scenes: z
    .object({
      menu: z
        .object({
          title: z.string().default("My Game"),
          subtitle: z.string().default("Press Start"),
          backgroundColor: HexColor.default("#1a1a2e"),
          logoUrl: z.string().optional(),
          buttons: z
            .array(
              z.object({
                label: z.string(),
                action: z.enum(["start", "instructions", "settings"]),
              }),
            )
            .default([{ label: "Start Game", action: "start" }]),
        })
        .default({}),
      gameOver: z
        .object({
          winTitle: z.string().default("You Win!"),
          loseTitle: z.string().default("Game Over"),
          showScore: z.boolean().default(true),
          showRetryButton: z.boolean().default(true),
        })
        .default({}),
    })
    .default({}),

  rules: z
    .object({
      winCondition: WinCondition.default({}),
      loseCondition: LoseCondition.default({}),
      scoring: z.array(ScoringRule).default([]),
    })
    .default({}),

  audio: z
    .object({
      backgroundMusic: z
        .enum([
          "none",
          "chiptune-upbeat",
          "chiptune-chill",
          "chiptune-intense",
          "ambient-dark",
        ])
        .default("none"),
      sfx: z
        .object({
          jump: z.boolean().default(true),
          collect: z.boolean().default(true),
          damage: z.boolean().default(true),
          shoot: z.boolean().default(true),
          enemyDeath: z.boolean().default(true),
          gameOver: z.boolean().default(true),
          win: z.boolean().default(true),
        })
        .default({}),
    })
    .default({}),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;
export type EnemyConfigType = z.infer<typeof EnemyConfig>;
export type CollectibleConfigType = z.infer<typeof CollectibleConfig>;
export type PlatformConfigType = z.infer<typeof PlatformConfig>;
export type ProjectileTypeConfigType = z.infer<typeof ProjectileTypeConfig>;
export type SpawnerConfigType = z.infer<typeof SpawnerConfig>;
export type DecorationConfigType = z.infer<typeof DecorationConfig>;
export type TurnBasedPlayerConfigType = z.infer<typeof TurnBasedPlayerConfig>;
export type TurnBasedConfigType = z.infer<typeof TurnBasedConfig>;
