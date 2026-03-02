import { prisma } from "./prisma";
import { pubsub, BUILD_LOGS } from "./pubsub";

export async function appendBuildLogAndPublish(
  gameId: number,
  buildText: string,
): Promise<void> {
  const channel = `${BUILD_LOGS}:${gameId}`;
  console.log(
    "[build-log] appendBuildLogAndPublish gameId:",
    gameId,
    "len:",
    buildText.length,
    "channel:",
    channel,
  );
  const log = await prisma.gameBuildLog.create({
    data: { gameId, buildText },
  });
  console.log("[build-log] prisma create done, publishing to", channel);
  pubsub.publish(channel, { buildLogs: log });
  console.log("[build-log] publish done");
}
