import { prisma } from "./prisma";
import { appendBuildLogAndPublish } from "./build-log";

/**
 * Called when the game-service build finishes. Creates a new GameVersion,
 * sets it as default, and updates the Game row.
 */
export async function handleBuildComplete(
  gameId: number,
  status: string,
  hostedAt: string,
): Promise<void> {
  const plan = await prisma.gamePlan.findUnique({
    where: { gameId },
    select: { planText: true },
  });
  const planSnapshot = plan?.planText ?? "{}";

  await prisma.$transaction([
    prisma.gameVersion.updateMany({
      where: { gameId },
      data: { isDefault: false },
    }),
    prisma.gameVersion.create({
      data: {
        gameId,
        hostedAt: hostedAt || "",
        planSnapshot,
        isDefault: true,
        archived: false,
      },
    }),
    prisma.game.update({
      where: { id: gameId },
      data: { status, hostedAt: hostedAt || "" },
    }),
  ]);

  await appendBuildLogAndPublish(gameId, "Build complete.");
}
