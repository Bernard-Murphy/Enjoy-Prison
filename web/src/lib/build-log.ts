import { prisma } from "./prisma";
import { pubsub, BUILD_LOGS } from "./graphql/resolvers";

export async function appendBuildLogAndPublish(
  gameId: number,
  buildText: string,
): Promise<void> {
  const log = await prisma.gameBuildLog.create({
    data: { gameId, buildText },
  });
  pubsub.publish(`${BUILD_LOGS}:${gameId}`, { buildLogs: log });
}
