import { PubSub } from "graphql-subscriptions";

const GLOBAL_KEY = "__EP_GAMES_PUBSUB__";
const g = (
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof global !== "undefined"
      ? global
      : {}
) as Record<string, unknown>;

export const pubsub: PubSub =
  (g[GLOBAL_KEY] as PubSub | undefined) ||
  (() => {
    const p = new PubSub();
    g[GLOBAL_KEY] = p;
    return p;
  })();

export const BUILD_LOGS = "BUILD_LOGS";
export const PLAN_CHUNKS = "PLAN_CHUNKS";
export const CHAT_MESSAGE_ADDED = "CHAT_MESSAGE_ADDED";

/** Buffered plan chunks per gameId so late subscribers get full replay. */
export const planChunkBuffer = new Map<number, string[]>();

/** Buffered build log lines per gameId so late subscribers get full replay. */
export const buildLogBuffer = new Map<number, string[]>();
