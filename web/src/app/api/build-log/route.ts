import { NextRequest } from "next/server";
import { appendBuildLogAndPublish } from "@/lib/build-log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const gameId = Number(body?.gameId);
    const buildText = typeof body?.buildText === "string" ? body.buildText : "";
    if (!gameId || !Number.isInteger(gameId) || !buildText) {
      return new Response(
        JSON.stringify({ error: "gameId and buildText required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    await appendBuildLogAndPublish(gameId, buildText);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("build-log error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
