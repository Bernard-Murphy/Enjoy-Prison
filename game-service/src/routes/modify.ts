import { Router, Request, Response } from "express";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
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

export async function handleModify(req: Request, res: Response): Promise<void> {
  const { gameId, message } = req.body as { gameId?: number; message?: string };
  if (!gameId || !message) {
    res.status(400).json({ error: "gameId and message required" });
    return;
  }

  if (!openai || !s3 || !BUCKET) {
    res.status(503).json({ error: "Service not configured" });
    return;
  }

  const prefix = `games/${gameId}`;

  try {
    const getRes = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: `${prefix}/game.js` }),
    );
    const currentCode = (await getRes.Body?.transformToString()) ?? "";

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a Phaser 3 game developer. Apply the user's requested changes to the game code. Return only the complete modified JavaScript code, no explanations.",
        },
        {
          role: "user",
          content: `Current game code:\n\n${currentCode}\n\nRequested change: ${message}`,
        },
      ],
    });

    const newCode = completion.choices[0]?.message?.content ?? currentCode;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${prefix}/game.js`,
        Body: newCode,
        ContentType: "application/javascript",
      }),
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Modify error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Modify failed",
    });
  }
}

router.post("/", handleModify);
export default router;
