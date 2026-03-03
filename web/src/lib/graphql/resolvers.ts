import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  pubsub,
  BUILD_LOGS,
  PLAN_CHUNKS,
  CHAT_MESSAGE_ADDED,
  planChunkBuffer,
  buildLogBuffer,
} from "../pubsub";
import bcrypt from "bcryptjs";
import { signJWT } from "../session";
import { verifyRecaptcha, isRecaptchaRequired } from "../recaptcha";
import {
  fetchPlanFromGameService,
  fetchPlanFromDescription,
  parsePlanNameAndDescription,
} from "../game-service-plan";
import { triggerBuild } from "../game-service-build";

export { BUILD_LOGS, CHAT_MESSAGE_ADDED };

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
    versions: (
      parent: { id: number; userId: number | null },
      _args: unknown,
      ctx: Context,
    ) => {
      const includeArchived = ctx.user?.userId === parent.userId;
      return prisma.gameVersion.findMany({
        where: {
          gameId: parent.id,
          ...(includeArchived ? {} : { archived: false }),
        },
        orderBy: { createdAt: "desc" },
      });
    },
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

    gameBuildLogs: (_: unknown, { gameId }: { gameId: number }) =>
      prisma.gameBuildLog.findMany({
        where: { gameId },
        orderBy: { createdAt: "asc" },
      }),

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
      {
        gameId,
        planText,
        description: descriptionArg,
      }: { gameId: number; planText: string; description?: string | null },
    ) => {
      const plan = await prisma.gamePlan.upsert({
        where: { gameId },
        create: {
          gameId,
          planText,
          ...(descriptionArg != null && { description: descriptionArg }),
        },
        update: {
          planText,
          ...(descriptionArg !== undefined && { description: descriptionArg }),
        },
      });
      const { title } = parsePlanNameAndDescription(planText);
      const gameDescription =
        descriptionArg ?? parsePlanNameAndDescription(planText).description;
      await prisma.game.update({
        where: { id: gameId },
        data: { title, description: gameDescription },
      });
      return plan;
    },
    updateGamePlanFromDescription: async (
      _root: unknown,
      { gameId, description }: { gameId: number; description: string },
    ) => {
      const { content, description: formattedDescription } =
        await fetchPlanFromDescription(description);
      const plan = await prisma.gamePlan.upsert({
        where: { gameId },
        create: {
          gameId,
          planText: content,
          description: formattedDescription || description,
        },
        update: {
          planText: content,
          description: formattedDescription || description,
        },
      });
      const { title } = parsePlanNameAndDescription(content);
      await prisma.game.update({
        where: { id: gameId },
        data: {
          title,
          description: formattedDescription || description,
        },
      });
      return plan;
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
      // Background: generate plan (DSL JSON) or clarification
      (async () => {
        try {
          const webBase = process.env.WEB_APP_URL || "http://localhost:3000";
          const base = webBase.replace(/\/$/, "");
          const result = await fetchPlanFromGameService(
            message,
            undefined,
            game.id,
            `${base}/api/plan-log`,
          );
          if (result.type === "plan") {
            await prisma.gamePlan.upsert({
              where: { gameId: game.id },
              create: {
                gameId: game.id,
                planText: result.content,
                ...(result.description != null && {
                  description: result.description,
                }),
              },
              update: {
                planText: result.content,
                ...(result.description != null && {
                  description: result.description,
                }),
              },
            });
            const { title } = parsePlanNameAndDescription(result.content);
            const description =
              result.description ??
              parsePlanNameAndDescription(result.content).description;
            await prisma.game.update({
              where: { id: game.id },
              data: { title, description },
            });
            planChunkBuffer.set(game.id, [result.content]);
          }
          const displayMessage =
            result.type === "plan"
              ? "I've created your game design. You can edit it in the Plan tab and build when ready."
              : result.content;
          const assistantMsg = await prisma.chatMessage.create({
            data: {
              gameId: game.id,
              role: "assistant",
              messageKind: result.type,
              message: displayMessage,
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
            const webBase = process.env.WEB_APP_URL || "http://localhost:3000";
            const base = webBase.replace(/\/$/, "");
            const result = await fetchPlanFromGameService(
              message,
              existing?.planText ?? undefined,
              gameId,
              `${base}/api/plan-log`,
            );
            if (result.type === "plan") {
              await prisma.gamePlan.upsert({
                where: { gameId },
                create: {
                  gameId,
                  planText: result.content,
                  ...(result.description != null && {
                    description: result.description,
                  }),
                },
                update: {
                  planText: result.content,
                  ...(result.description != null && {
                    description: result.description,
                  }),
                },
              });
              const { title } = parsePlanNameAndDescription(result.content);
              const description =
                result.description ??
                parsePlanNameAndDescription(result.content).description;
              await prisma.game.update({
                where: { id: gameId },
                data: { title, description },
              });
              planChunkBuffer.set(gameId, [result.content]);
            }
            const displayMessage =
              result.type === "plan"
                ? "I've updated your game design. Check the Plan tab and build when ready."
                : result.content;
            const assistantMsg = await prisma.chatMessage.create({
              data: {
                gameId,
                role: "assistant",
                messageKind: result.type,
                message: displayMessage,
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
      const buildLogsChannel = `${BUILD_LOGS}:${gameId}`;
      console.log(
        "[resolvers] buildGame publishing Build started. channel:",
        buildLogsChannel,
      );
      pubsub.publish(buildLogsChannel, { buildLogs: startLog });
      console.log("[resolvers] buildGame publish done");

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

    archiveGameVersion: async (
      _: unknown,
      { versionId }: { versionId: number },
      ctx: Context,
    ) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const version = await prisma.gameVersion.findUnique({
        where: { id: versionId },
        include: { game: { select: { userId: true } } },
      });
      if (!version) throw new Error("Version not found");
      if (version.game.userId !== ctx.user.userId) {
        throw new Error("Only the game owner can archive versions");
      }
      return prisma.gameVersion.update({
        where: { id: versionId },
        data: { archived: true },
      });
    },

    unarchiveGameVersion: async (
      _: unknown,
      { versionId }: { versionId: number },
      ctx: Context,
    ) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const version = await prisma.gameVersion.findUnique({
        where: { id: versionId },
        include: { game: { select: { userId: true } } },
      });
      if (!version) throw new Error("Version not found");
      if (version.game.userId !== ctx.user.userId) {
        throw new Error("Only the game owner can unarchive versions");
      }
      return prisma.gameVersion.update({
        where: { id: versionId },
        data: { archived: false },
      });
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
      subscribe: async (_: unknown, { gameId }: { gameId: number }) => {
        const channel = `${BUILD_LOGS}:${gameId}`;
        const pubsubIterator = pubsub.asyncIterator(channel);
        const buffer = buildLogBuffer.get(gameId) ?? [];
        const existing = await prisma.gameBuildLog.findMany({
          where: { gameId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            gameId: true,
            buildText: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const syntheticLog = (buildText: string) => ({
          id: 0,
          gameId,
          buildText,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        async function* withReplay(): AsyncGenerator<{
          buildLogs: {
            id: number;
            gameId: number;
            buildText: string;
            createdAt: Date;
            updatedAt: Date;
          };
        }> {
          for (const buildText of buffer) {
            yield { buildLogs: syntheticLog(buildText) };
          }
          if (buffer.length === 0 && existing.length > 0) {
            for (const log of existing) {
              yield { buildLogs: log };
            }
          }
          while (true) {
            const next = await pubsubIterator.next();
            if (next.done) return;
            yield next.value as {
              buildLogs: {
                id: number;
                gameId: number;
                buildText: string;
                createdAt: Date;
                updatedAt: Date;
              };
            };
          }
        }

        return withReplay();
      },
    },
    planChunks: {
      subscribe: async (_: unknown, { gameId }: { gameId: number }) => {
        const POLL_MS = 50;
        const IDLE_TIMEOUT_MS = 5000;
        const existing = await prisma.gamePlan.findUnique({
          where: { gameId },
          select: { planText: true },
        });

        async function* drainBuffer(): AsyncGenerator<{
          planChunks: { planText: string };
        }> {
          let lastIndex = 0;
          let lastActivityAt = 0;
          const startedAt = Date.now();
          const maxWaitMs = 60000;
          const bufferAtStart = planChunkBuffer.get(gameId) ?? [];

          // If buffer is empty and plan is in DB, send it once but keep subscription open
          // so we can deliver new chunks when user refines (don't return here).
          if (bufferAtStart.length === 0 && existing?.planText) {
            yield { planChunks: { planText: existing.planText } };
            lastActivityAt = Date.now();
          }

          // eslint-disable-next-line no-constant-condition
          while (true) {
            const buffer = planChunkBuffer.get(gameId) ?? [];
            while (lastIndex < buffer.length) {
              yield { planChunks: { planText: buffer[lastIndex] } };
              lastIndex += 1;
              lastActivityAt = Date.now();
            }
            if (buffer.length > 0 && lastIndex >= buffer.length) {
              const idle = Date.now() - lastActivityAt;
              if (idle >= IDLE_TIMEOUT_MS) return;
            }
            if (Date.now() - startedAt > maxWaitMs) return;
            await new Promise((r) => setTimeout(r, POLL_MS));
          }
        }

        return drainBuffer();
      },
    },
    chatMessageAdded: {
      subscribe: (_: unknown, { gameId }: { gameId: number }) => {
        return pubsub.asyncIterator(`${CHAT_MESSAGE_ADDED}:${gameId}`);
      },
    },
  },
};
