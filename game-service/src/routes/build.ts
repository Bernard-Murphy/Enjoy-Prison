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
  if (!logCallbackUrl) return;
  try {
    await fetch(logCallbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, buildText }),
    });
  } catch {
    // ignore log callback errors
  }
}

export async function handleBuild(req: Request, res: Response): Promise<void> {
  const { gameId, planText, onCompleteUrl, logCallbackUrl } = req.body as {
    gameId?: number;
    planText?: string;
    onCompleteUrl?: string;
    logCallbackUrl?: string;
  };
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

  res.setHeader("Content-Type", "application/json");
  res.json({ started: true, gameId });

  try {
    await sendLog(logCallbackUrl, gameId, "Generating game code...");

    const codePrompt = `Generate a complete Phaser 3 browser game based on this plan. Output only valid JavaScript for a single game file (game.js) that works with Phaser 3. The game must be desktop and mobile compatible. Use CDN: https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js

Plan:
${planText.slice(0, 8000)}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: codePrompt }],
    });

    const gameJs =
      completion.choices[0]?.message?.content ?? "// No code generated";
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
      } catch {
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
