import { prisma } from "./prisma";
import { appendBuildLogAndPublish } from "./build-log";

/**
 * Called when the game-service build finishes. Creates a new GameVersion,
 * sets it as default, and updates the Game row. Optionally updates logoUrl
 * when the build generated or used a logo.
 */
export async function handleBuildComplete(
  gameId: number,
  status: string,
  hostedAt: string,
  logoUrl?: string | null,
): Promise<void> {
  const plan = await prisma.gamePlan.findUnique({
    where: { gameId },
    select: { planText: true },
  });
  const planSnapshot = plan?.planText ?? "{}";

  const gameUpdateData: { status: string; hostedAt: string; logoUrl?: string } =
    {
      status,
      hostedAt: hostedAt || "",
    };
  if (logoUrl != null && logoUrl !== "") {
    gameUpdateData.logoUrl = logoUrl;
  }

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
      data: gameUpdateData,
    }),
  ]);

  // await appendBuildLogAndPublish(gameId, "Build complete.");
}
