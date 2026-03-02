import { Router, Request, Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { openai } from "../lib/openai";

const router = Router();

const s3 =
  process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID
    ? new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: !!process.env.S3_ENDPOINT,
      })
    : null;

const BUCKET = process.env.S3_BUCKET || "";
const GAME_BASE_URL = process.env.GAME_BASE_URL || "";

async function sendLog(
  logCallbackUrl: string | undefined,
  gameId: number,
  buildText: string,
): Promise<void> {
  if (!logCallbackUrl) {
    console.log("[game-service build] sendLog SKIP: no logCallbackUrl");
    return;
  }
  try {
    const res = await fetch(logCallbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, buildText }),
    });
    if (!res.ok) {
      console.error(
        "[game-service build] sendLog FAIL",
        res.status,
        await res.text(),
      );
    }
  } catch (err) {
    console.error("[game-service build] sendLog ERROR", logCallbackUrl, err);
  }
}

export async function handleBuild(req: Request, res: Response): Promise<void> {
  const { gameId, planText, onCompleteUrl, logCallbackUrl } = req.body as {
    gameId?: number;
    planText?: string;
    onCompleteUrl?: string;
    logCallbackUrl?: string;
  };
  console.log(
    "[game-service build] building gameId:",
    gameId,
    "logCallbackUrl:",
    logCallbackUrl,
  );
  if (!gameId || !planText) {
    res.status(400).json({ error: "gameId and planText required" });
    return;
  }

  if (!openai) {
    res.status(503).json({ error: "OpenAI not configured" });
    return;
  }

  if (!s3 || !BUCKET) {
    res.status(503).json({ error: "S3 not configured" });
    return;
  }
  console.log("start");
  res.setHeader("Content-Type", "application/json");
  res.json({ started: true, gameId });

  try {
    await sendLog(logCallbackUrl, gameId, "Generating game code...");

    const codePrompt = `Generate a complete Phaser 3 browser game based on this plan. Output only valid JavaScript for a single game file (game.js) that works with Phaser 3. The game must be desktop and mobile compatible. Use CDN: https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js

Plan:
${planText.slice(0, 8000)}`;

    // Venice / Claude Opus 4.6: reasoning.effort "max" = highest (supported: low, medium, high, max)
    const stream = (await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: codePrompt }],
      stream: true,
      max_tokens: 128_000,
      temperature: 0,
      reasoning: { effort: "medium" }, // low, medium, high, and max
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)) as unknown as AsyncIterable<{
      choices: Array<{
        delta?: { reasoning_content?: string; content?: string };
      }>;
    }>;

    let gameJs = "";
    for await (const chunk of stream) {
      const text = (chunk.choices[0]?.delta as any)?.reasoning_content;
      const js = (chunk.choices[0]?.delta as any)?.content;
      if (text) {
        await sendLog(logCallbackUrl, gameId, text);
      }
      if (js) {
        gameJs += js;
      }
    }
    console.log("gameJs", gameJs);
    if (!gameJs.trim()) gameJs = "// No code generated";
    const prefix = `games/${gameId}`;

    await sendLog(logCallbackUrl, gameId, "Uploading to S3...");

    const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
</head>
<body>
  <script>${gameJs}</script>
</body> 
</html>`;
    console.log("s3");
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${prefix}/index.html`,
        Body: indexHtml,
        ContentType: "text/html",
      }),
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${prefix}/game.js`,
        Body: gameJs,
        ContentType: "application/javascript",
      }),
    );

    const hostedUrl = GAME_BASE_URL
      ? `${GAME_BASE_URL.replace(/\/$/, "")}/${prefix}/index.html`
      : `/${prefix}/index.html`;
    console.log("done", hostedUrl);
    if (onCompleteUrl) {
      try {
        await fetch(onCompleteUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId,
            status: "live",
            hostedAt: hostedUrl,
          }),
        });
      } catch (err) {
        console.error("onCompleteUrl error", onCompleteUrl, err);
        // ignore callback errors
      }
    }
  } catch (err) {
    console.error("Build error:", err);
    await sendLog(
      logCallbackUrl,
      gameId,
      `Build error: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}

router.post("/", handleBuild);
export default router;
