import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendBuildLogAndPublish } from "@/lib/build-log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const gameId = Number(body?.gameId);
    const status = typeof body?.status === "string" ? body.status : "live";
    const hostedAt = typeof body?.hostedAt === "string" ? body.hostedAt : "";
    if (!gameId || !Number.isInteger(gameId)) {
      return new Response(JSON.stringify({ error: "gameId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    await prisma.game.update({
      where: { id: gameId },
      data: { status, hostedAt: hostedAt || "" },
    });
    await appendBuildLogAndPublish(gameId, "Build complete.");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("build-complete error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
