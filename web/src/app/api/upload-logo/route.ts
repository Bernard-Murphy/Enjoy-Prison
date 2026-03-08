import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const gameId = formData.get("gameId");

    if (!file || !(file instanceof Blob)) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const base = process.env.GAME_SERVICE_URL;
    if (!base) {
      return new Response(
        JSON.stringify({ error: "Upload service not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const forwardForm = new FormData();
    forwardForm.append("file", file);
    if (gameId != null && String(gameId).trim() !== "") {
      forwardForm.append("gameId", String(gameId).trim());
    }

    const url = new URL("/api/upload-logo", base.replace(/\/$/, ""));
    if (gameId != null && String(gameId).trim() !== "") {
      url.searchParams.set("gameId", String(gameId).trim());
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      body: forwardForm,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(JSON.stringify(data || { error: "Upload failed" }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("upload-logo error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Upload failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
