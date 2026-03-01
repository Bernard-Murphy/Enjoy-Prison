import { PubSub } from "graphql-subscriptions";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import bcrypt from "bcryptjs";
import { signJWT } from "../session";
import { verifyRecaptcha, isRecaptchaRequired } from "../recaptcha";
import { fetchPlanFromGameService } from "../game-service-plan";
import { triggerBuild } from "../game-service-build";

const pubsub = new PubSub();

export const BUILD_LOGS = "BUILD_LOGS";
export const CHAT_MESSAGE_ADDED = "CHAT_MESSAGE_ADDED";

export interface Context {
  user: { userId: number } | null;
  sessionId: string | null;
  req?: Request;
}

export const resolvers = {
  DateTime: {
    __parseValue(value: unknown) {
      return new Date(value as string);
    },
    __serialize(value: unknown) {
      return (value as Date).toISOString();
    },
    __parseLiteral(ast: { value: string }) {
      return new Date(ast.value);
    },
  },

  User: {
    games: (parent: { id: number }) =>
      prisma.game.findMany({
        where: { userId: parent.id },
        orderBy: { createdAt: "desc" },
      }),
  },

  Game: {
    user: (parent: { userId: number | null }) =>
      parent.userId
        ? prisma.user.findUnique({ where: { id: parent.userId } })
        : null,
  },

  Comment: {
    user: (parent: { userId: number | null }) =>
      parent.userId
        ? prisma.user.findUnique({ where: { id: parent.userId } })
        : null,
  },

  Query: {
    me: async (_: unknown, __: unknown, ctx: Context) => {
      if (!ctx.user) return null;
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          email: true,
          bio: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return user;
    },

    user: (_: unknown, { id }: { id: number }) =>
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          email: true,
          bio: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

    game: (_: unknown, { id }: { id: number }) =>
      prisma.game.findUnique({ where: { id } }),

    games: async (
      _: unknown,
      {
        offset = 0,
        limit = 20,
        sort,
      }: { offset?: number; limit?: number; sort?: string },
    ) => {
      const orderBy =
        sort === "popular"
          ? { views: "desc" as const }
          : { createdAt: "desc" as const };
      return prisma.game.findMany({
        where: { status: "live" },
        orderBy,
        skip: offset,
        take: limit,
      });
    },

    popularGames: (_: unknown, { limit = 10 }: { limit?: number }) =>
      prisma.game.findMany({
        where: { status: "live" },
        orderBy: { views: "desc" },
        take: limit,
      }),

    recentGames: (_: unknown, { limit = 10 }: { limit?: number }) =>
      prisma.game.findMany({
        where: { status: "live" },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),

    gamePlan: (_: unknown, { gameId }: { gameId: number }) =>
      prisma.gamePlan.findUnique({ where: { gameId } }),

    chatMessages: (_: unknown, { gameId }: { gameId: number }) =>
      prisma.chatMessage.findMany({
        where: { gameId },
        orderBy: { createdAt: "asc" },
      }),

    comments: (
      _: unknown,
      { flavor, contentId }: { flavor: string; contentId: number },
    ) =>
      prisma.comment.findMany({
        where: { flavor, contentId },
        orderBy: { createdAt: "asc" },
      }),

    searchGames: async (
      _: unknown,
      { query, filters }: { query: string; filters?: { sort?: string } },
    ) => {
      const orderBy =
        filters?.sort === "popular"
          ? { views: "desc" as const }
          : { createdAt: "desc" as const };
      const [games, total] = await Promise.all([
        prisma.game.findMany({
          where: {
            status: "live",
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          },
          orderBy,
          take: 50,
        }),
        prisma.game.count({
          where: {
            status: "live",
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          },
        }),
      ]);
      return { games, total };
    },
  },

  Mutation: {
    updateGamePlan: async (
      _root: unknown,
      { gameId, planText }: { gameId: number; planText: string },
    ) => {
      return prisma.gamePlan.upsert({
        where: { gameId },
        create: { gameId, planText },
        update: { planText },
      });
    },
    login: async (
      _root: unknown,
      { username, password }: { username: string; password: string },
    ) => {
      const user = await prisma.user.findUnique({ where: { username } });
      if (!user || user.role === "banned") {
        return {
          success: false,
          message: "Invalid credentials",
          user: null,
          token: null,
        };
      }
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return {
          success: false,
          message: "Invalid credentials",
          user: null,
          token: null,
        };
      }
      const token = signJWT({ userId: user.id });
      const { passwordHash: _pw, ...safe } = user;
      return { success: true, message: null, user: safe, token };
    },

    register: async (
      _: unknown,
      {
        input,
        recaptchaToken,
      }: {
        input: {
          username: string;
          displayName: string;
          email: string;
          password: string;
          bio?: string;
          avatar?: string;
        };
        recaptchaToken?: string | null;
      },
    ) => {
      if (isRecaptchaRequired()) {
        if (!recaptchaToken) {
          throw new Error("Human verification failed. Please try again.");
        }
        const isValid = await verifyRecaptcha(recaptchaToken, "register");
        if (!isValid) {
          throw new Error("Human verification failed. Please try again.");
        }
      }
      const existing = await prisma.user.findUnique({
        where: { username: input.username },
      });
      if (existing) {
        return {
          success: false,
          message: "Username already taken",
          user: null,
          token: null,
        };
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await prisma.user.create({
        data: {
          username: input.username,
          displayName: input.displayName,
          email: input.email,
          passwordHash,
          bio: input.bio ?? "",
          avatar: input.avatar ?? null,
        },
      });
      const token = signJWT({ userId: user.id });
      const { passwordHash: __, ...safe } = user;
      return { success: true, message: null, user: safe, token };
    },

    logout: () => true,

    requestPasswordReset: () => true,
    resetPassword: async () => {
      throw new Error("Not implemented");
    },

    updateUser: async (
      _root: unknown,
      {
        input,
      }: {
        input: {
          displayName?: string;
          email?: string;
          bio?: string;
          avatar?: string;
        };
      },
      ctx: Context,
    ) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const user = await prisma.user.update({
        where: { id: ctx.user.userId },
        data: input,
      });
      const { passwordHash: _pw, ...safe } = user;
      return safe;
    },

    createGame: async (
      _: unknown,
      {
        message,
        logoUrl,
        recaptchaToken,
      }: { message: string; logoUrl?: string; recaptchaToken?: string | null },
      ctx: Context,
    ) => {
      if (isRecaptchaRequired()) {
        if (!recaptchaToken) {
          throw new Error("Human verification failed. Please try again.");
        }
        const isValid = await verifyRecaptcha(recaptchaToken, "create_game");
        if (!isValid) {
          throw new Error("Human verification failed. Please try again.");
        }
      }
      const game = await prisma.game.create({
        data: {
          title: "Untitled Game",
          status: "planning",
          description: "",
          hostedAt: "",
          userId: ctx.user?.userId ?? null,
        },
      });
      await prisma.chatMessage.create({
        data: {
          gameId: game.id,
          role: "user",
          message,
        } as Prisma.ChatMessageUncheckedCreateInput,
      });
      // Background: generate initial plan or clarification; only update plan when type is plan
      (async () => {
        try {
          const result = await fetchPlanFromGameService(message);
          if (result.type === "plan") {
            await prisma.gamePlan.upsert({
              where: { gameId: game.id },
              create: { gameId: game.id, planText: result.content },
              update: { planText: result.content },
            });
          }
          const assistantMsg = await prisma.chatMessage.create({
            data: {
              gameId: game.id,
              role: "assistant",
              messageKind: result.type,
              message: result.content,
            } as Prisma.ChatMessageUncheckedCreateInput,
          });
          pubsub.publish(`${CHAT_MESSAGE_ADDED}:${game.id}`, {
            chatMessageAdded: assistantMsg,
          });
        } catch (err) {
          console.error("Background plan generation failed:", err);
        }
      })();
      return game;
    },

    sendChatMessage: async (
      _: unknown,
      { gameId, message }: { gameId: number; message: string },
      ctx: Context,
    ) => {
      const msg = await prisma.chatMessage.create({
        data: {
          gameId,
          role: "user",
          message,
        } as Prisma.ChatMessageUncheckedCreateInput,
      });
      pubsub.publish(`${CHAT_MESSAGE_ADDED}:${gameId}`, {
        chatMessageAdded: msg,
      });
      // When game is in planning, generate updated plan and push assistant message via subscription
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { status: true },
      });
      if (game?.status === "planning") {
        (async () => {
          try {
            const existing = await prisma.gamePlan.findUnique({
              where: { gameId },
              select: { planText: true },
            });
            const result = await fetchPlanFromGameService(
              message,
              existing?.planText ?? undefined,
            );
            if (result.type === "plan") {
              await prisma.gamePlan.upsert({
                where: { gameId },
                create: { gameId, planText: result.content },
                update: { planText: result.content },
              });
            }
            const assistantMsg = await prisma.chatMessage.create({
              data: {
                gameId,
                role: "assistant",
                messageKind: result.type,
                message: result.content,
              } as Prisma.ChatMessageUncheckedCreateInput,
            });
            pubsub.publish(`${CHAT_MESSAGE_ADDED}:${gameId}`, {
              chatMessageAdded: assistantMsg,
            });
          } catch (err) {
            console.error("Background plan update failed:", err);
          }
        })();
      }
      return msg;
    },

    buildGame: async (
      _: unknown,
      { gameId }: { gameId: number },
      _ctx: Context,
    ) => {
      const plan = await prisma.gamePlan.findUnique({
        where: { gameId },
        select: { planText: true },
      });
      if (!plan?.planText?.trim()) {
        throw new Error("No plan found. Add a plan before building.");
      }
      await prisma.game.update({
        where: { id: gameId },
        data: { status: "building" },
      });
      const startLog = await prisma.gameBuildLog.create({
        data: { gameId, buildText: "Build started." },
      });
      pubsub.publish(`${BUILD_LOGS}:${gameId}`, { buildLogs: startLog });

      const webBase = process.env.WEB_APP_URL || "http://localhost:3000";
      const base = webBase.replace(/\/$/, "");
      (async () => {
        try {
          await triggerBuild({
            gameId,
            planText: plan.planText,
            onCompleteUrl: `${base}/api/build-complete`,
            logCallbackUrl: `${base}/api/build-log`,
          });
        } catch (err) {
          console.error("Build trigger failed:", err);
          const failLog = await prisma.gameBuildLog.create({
            data: {
              gameId,
              buildText: `Build failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          });
          pubsub.publish(`${BUILD_LOGS}:${gameId}`, { buildLogs: failLog });
          await prisma.game.update({
            where: { id: gameId },
            data: { status: "planning" },
          });
        }
      })();

      return prisma.game.findUnique({ where: { id: gameId } });
    },

    forkGame: async (
      _: unknown,
      { gameId }: { gameId: number },
      ctx: Context,
    ) => {
      const source = await prisma.game.findFirst({
        where: { id: gameId, status: "live" },
      });
      if (!source) throw new Error("Game not found");
      return prisma.game.create({
        data: {
          title: source.title,
          status: "live",
          description: source.description,
          hostedAt: source.hostedAt,
          userId: ctx.user?.userId ?? null,
          forkedFrom: gameId,
        },
      });
    },

    removeGame: async () => {
      throw new Error("Not implemented");
    },
    restoreGame: async () => {
      throw new Error("Not implemented");
    },

    createComment: async (
      _root: unknown,
      {
        flavor,
        contentId,
        text,
        repliesTo,
      }: {
        flavor: string;
        contentId: number;
        text: string;
        repliesTo?: number;
      },
      ctx: Context,
    ) => {
      return prisma.comment.create({
        data: {
          flavor,
          contentId,
          text,
          replyingTo: repliesTo ?? null,
          userId: ctx.user?.userId ?? null,
        },
      });
    },

    removeComment: async () => {
      throw new Error("Not implemented");
    },

    createReport: async (
      _: unknown,
      {
        flavor,
        contentId,
        reason,
        details,
      }: {
        flavor: string;
        contentId: number;
        reason: string;
        details?: string;
      },
      ctx: Context,
    ) => {
      return prisma.report.create({
        data: {
          flavor,
          contentId,
          reason,
          details: details ?? null,
          userId: ctx.user?.userId ?? null,
        },
      });
    },

    dismissReport: async () => {
      throw new Error("Not implemented");
    },
  },

  Subscription: {
    buildLogs: {
      subscribe: (_: unknown, { gameId }: { gameId: number }) => {
        return pubsub.asyncIterator(`${BUILD_LOGS}:${gameId}`);
      },
    },
    chatMessageAdded: {
      subscribe: (_: unknown, { gameId }: { gameId: number }) => {
        return pubsub.asyncIterator(`${CHAT_MESSAGE_ADDED}:${gameId}`);
      },
    },
  },
};

export { pubsub };
