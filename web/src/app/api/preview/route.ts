import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/preview
 * Body: { planText: string } (GameConfig JSON string)
 * Proxies to game-service /api/preview and returns HTML for iframe srcdoc.
 */
export async function POST(req: NextRequest) {
  const base = process.env.GAME_SERVICE_URL;
  if (!base) {
    return NextResponse.json(
      { error: "GAME_SERVICE_URL is not set" },
      { status: 503 },
    );
  }
  try {
    const body = await req.json();
    const planText = body?.planText;
    if (typeof planText !== "string") {
      return NextResponse.json({ error: "planText required" }, { status: 400 });
    }
    let config: unknown;
    try {
      config = JSON.parse(planText);
    } catch {
      return NextResponse.json(
        { error: "planText is not valid JSON" },
        { status: 400 },
      );
    }
    const res = await fetch(`${base.replace(/\/$/, "")}/api/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: err || `Preview failed: ${res.status}` },
        { status: res.status },
      );
    }
    const html = await res.text();
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview failed" },
      { status: 500 },
    );
  }
}
