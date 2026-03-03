import { gql } from "graphql-tag";

export const typeDefs = gql`
  scalar DateTime

  type User {
    id: Int!
    username: String!
    displayName: String
    avatar: String
    email: String!
    bio: String
    role: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    games: [Game!]!
  }

  type GameVersion {
    id: Int!
    gameId: Int!
    hostedAt: String!
    planSnapshot: String!
    isDefault: Boolean!
    archived: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Game {
    id: Int!
    title: String!
    status: String!
    userId: Int
    user: User
    description: String!
    views: Int!
    forkedFrom: Int
    hostedAt: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    versions: [GameVersion!]!
  }

  type Comment {
    id: Int!
    text: String!
    flavor: String!
    replyingTo: Int
    contentId: Int!
    userId: Int
    user: User
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type GamePlan {
    id: Int!
    gameId: Int!
    planText: String!
    description: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type GameBuildLog {
    id: Int!
    gameId: Int!
    buildText: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type PlanChunk {
    planText: String!
  }

  type ChatMessage {
    id: Int!
    gameId: Int!
    role: String!
    messageKind: String
    message: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthPayload {
    success: Boolean!
    message: String
    user: User
    token: String
  }

  input RegisterInput {
    username: String!
    displayName: String!
    email: String!
    password: String!
    bio: String
    avatar: String
  }

  input UpdateUserInput {
    displayName: String
    email: String
    bio: String
    avatar: String
  }

  input SearchFilters {
    dateFrom: DateTime
    dateTo: DateTime
    sort: String
  }

  type SearchResult {
    games: [Game!]!
    total: Int!
  }

  type Query {
    me: User
    user(id: Int!): User
    game(id: Int!): Game
    session(id: Int!): GameSession
    sessionByCode(code: String!): GameSession
    games(offset: Int, limit: Int, sort: String, search: String): [Game!]!
    popularGames(limit: Int): [Game!]!
    recentGames(limit: Int): [Game!]!
    gamePlan(gameId: Int!): GamePlan
    gameBuildLogs(gameId: Int!): [GameBuildLog!]!
    chatMessages(gameId: Int!): [ChatMessage!]!
    searchGames(query: String!, filters: SearchFilters): SearchResult!
    comments(flavor: String!, contentId: Int!): [Comment!]!
  }

  type Mutation {
    updateGamePlan(
      gameId: Int!
      planText: String!
      description: String
    ): GamePlan!
    updateGamePlanFromDescription(gameId: Int!, description: String!): GamePlan!
    login(username: String!, password: String!): AuthPayload!
    register(input: RegisterInput!, recaptchaToken: String): AuthPayload!
    logout: Boolean!
    requestPasswordReset(email: String!, username: String!): Boolean!
    resetPassword(uuid: String!, password: String!): Boolean!
    updateUser(input: UpdateUserInput!): User!
    createGame(message: String!, logoUrl: String, recaptchaToken: String): Game!
    sendChatMessage(gameId: Int!, message: String!): ChatMessage!
    buildGame(gameId: Int!): Game!
    forkGame(gameId: Int!): Game!
    removeGame(gameId: Int!, reason: String!, details: String): Game!
    restoreGame(gameId: Int!): Game!
    archiveGameVersion(versionId: Int!): GameVersion!
    unarchiveGameVersion(versionId: Int!): GameVersion!
    createComment(
      flavor: String!
      contentId: Int!
      text: String!
      repliesTo: Int
    ): Comment!
    removeComment(id: Int!, reason: String!, details: String): Comment!
    createReport(
      flavor: String!
      contentId: Int!
      reason: String!
      details: String
    ): Report!
    dismissReport(id: Int!): Report!
    createSession(gameId: Int!, mode: String): GameSession!
    joinSession(code: String!): GameSession!
    leaveSession(sessionId: Int!, playerIndex: Int!): Boolean!
    sessionReady(sessionId: Int!): GameSession!
    sendGameMove(
      sessionId: Int!
      playerIndex: Int!
      move: String!
      diceRoll: Int
    ): GameMove!
    sendSignalMessage(
      sessionId: Int!
      fromPlayerIndex: Int!
      message: String!
    ): Boolean!
  }

  type Report {
    id: Int!
    flavor: String!
    contentId: Int!
    dismissed: Boolean!
    reason: String!
    details: String
    createdAt: DateTime!
  }

  type GameSessionPlayer {
    id: Int!
    sessionId: Int!
    userId: Int
    user: User
    playerIndex: Int!
    role: String!
    ready: Boolean!
    joinedAt: DateTime!
  }

  type GameSession {
    id: Int!
    code: String!
    gameId: Int!
    game: Game
    hostId: Int
    host: User
    status: String!
    maxPlayers: Int!
    mode: String!
    config: String
    createdAt: DateTime!
    updatedAt: DateTime!
    players: [GameSessionPlayer!]!
  }

  type GameMove {
    sessionId: Int!
    playerIndex: Int!
    move: String!
  }

  type SignalMessage {
    sessionId: Int!
    fromPlayerIndex: Int!
    message: String!
  }

  type Subscription {
    buildLogs(gameId: Int!): GameBuildLog!
    planChunks(gameId: Int!): PlanChunk!
    chatMessageAdded(gameId: Int!): ChatMessage!
    sessionUpdated(sessionId: Int!): GameSession!
    gameMove(sessionId: Int!): GameMove!
    signalMessage(sessionId: Int!): SignalMessage!
  }
`;
