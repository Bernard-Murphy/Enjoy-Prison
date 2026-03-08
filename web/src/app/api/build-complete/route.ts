import { NextRequest } from "next/server";
import { handleBuildComplete } from "@/lib/handle-build-complete";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const gameId = Number(body?.gameId);
    const status = typeof body?.status === "string" ? body.status : "live";
    const hostedAt = typeof body?.hostedAt === "string" ? body.hostedAt : "";
    const logoUrl =
      typeof body?.logoUrl === "string" ? body.logoUrl : undefined;
    if (!gameId || !Number.isInteger(gameId)) {
      return new Response(JSON.stringify({ error: "gameId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    await handleBuildComplete(gameId, status, hostedAt, logoUrl);
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
