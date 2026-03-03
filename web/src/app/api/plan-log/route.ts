import { NextRequest } from "next/server";
import { planChunkBuffer, pubsub, PLAN_CHUNKS } from "@/lib/pubsub";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const gameId = Number(body?.gameId);
    const planText = typeof body?.planText === "string" ? body.planText : "";
    if (!gameId || !Number.isInteger(gameId)) {
      return new Response(JSON.stringify({ error: "gameId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!planChunkBuffer.has(gameId)) planChunkBuffer.set(gameId, []);
    planChunkBuffer.get(gameId)!.push(planText);
    pubsub.publish(`${PLAN_CHUNKS}:${gameId}`, {
      planChunks: { planText },
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("plan-log error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
