import { Router, Request, Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GameConfigSchema } from "../lib/dsl/schema";
import { generateGameHTML } from "../lib/runtime/gameTemplate";
import { generateLogo } from "../lib/ai/generateLogo";

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
  } catch (err) {
    console.error("[game-service build] sendLog ERROR", logCallbackUrl, err);
  }
}

function buildPublicUrl(key: string): string {
  if (GAME_BASE_URL) {
    const base = GAME_BASE_URL.replace(/\/$/, "");
    return `${base}/${key}`;
  }
  return `/${key}`;
}

export async function handleBuild(req: Request, res: Response): Promise<void> {
  const {
    gameId,
    planText,
    onCompleteUrl,
    logCallbackUrl,
    logoUrl: requestLogoUrl,
  } = req.body as {
    gameId?: number;
    planText?: string;
    onCompleteUrl?: string;
    logCallbackUrl?: string;
    logoUrl?: string;
  };

  if (!gameId || !planText) {
    res.status(400).json({ error: "gameId and planText required" });
    return;
  }

  if (!s3 || !BUCKET) {
    res.status(503).json({ error: "S3 not configured" });
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.json({ started: true, gameId });

  try {
    await sendLog(logCallbackUrl, gameId, "Validating game config...");

    let config: unknown;
    try {
      config = JSON.parse(planText) as unknown;
    } catch {
      await sendLog(
        logCallbackUrl,
        gameId,
        "Build failed: planText is not valid JSON.",
      );
      return;
    }

    const parsed = GameConfigSchema.safeParse(config);
    if (!parsed.success) {
      await sendLog(
        logCallbackUrl,
        gameId,
        "Build failed: config validation errors: " +
          JSON.stringify(parsed.error.errors),
      );
      return;
    }

    const cfg = parsed.data;
    const title =
      cfg.gameType === "turn-based" && cfg.turnBased?.common?.title
        ? cfg.turnBased.common.title
        : (cfg.meta?.title ?? "Game");
    const description =
      cfg.gameType === "turn-based" && cfg.turnBased?.common?.description
        ? cfg.turnBased.common.description
        : (cfg.meta?.description ?? "");
    let effectiveLogoUrl: string | undefined =
      requestLogoUrl &&
      typeof requestLogoUrl === "string" &&
      requestLogoUrl.length > 0 &&
      !requestLogoUrl.startsWith("blob:")
        ? requestLogoUrl
        : undefined;

    if (!effectiveLogoUrl) {
      await sendLog(logCallbackUrl, gameId, "Generating logo...");
      const logoBuffer = await generateLogo(title, description);
      if (logoBuffer && s3 && BUCKET) {
        const prefix = `games/${gameId}`;
        const logoKey = `${prefix}/logo.png`;
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: logoKey,
            Body: logoBuffer,
            ContentType: "image/png",
          }),
        );
        effectiveLogoUrl = buildPublicUrl(logoKey);
        await sendLog(logCallbackUrl, gameId, "Using generated logo.");
      }
    } else {
      await sendLog(logCallbackUrl, gameId, "Using supplied logo.");
    }

    if (effectiveLogoUrl) {
      if (cfg.scenes?.menu && typeof cfg.scenes.menu === "object") {
        cfg.scenes.menu.logoUrl = effectiveLogoUrl;
      }
      if (
        cfg.turnBased?.common?.menu &&
        typeof cfg.turnBased.common.menu === "object"
      ) {
        cfg.turnBased.common.menu.logoUrl = effectiveLogoUrl;
      }
    }

    await sendLog(logCallbackUrl, gameId, "Generating game HTML...");

    const indexHtml = generateGameHTML(cfg);

    await sendLog(logCallbackUrl, gameId, "Uploading to S3...");

    const prefix = `games/${gameId}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${prefix}/index.html`,
        Body: indexHtml,
        ContentType: "text/html",
      }),
    );

    const hostedUrl = GAME_BASE_URL
      ? `${GAME_BASE_URL.replace(/\/$/, "")}/${prefix}/index.html`
      : `/${prefix}/index.html`;

    if (onCompleteUrl) {
      try {
        const completeBody: {
          gameId: number;
          status: string;
          hostedAt: string;
          logoUrl?: string;
        } = {
          gameId,
          status: "live",
          hostedAt: hostedUrl,
        };
        if (effectiveLogoUrl) completeBody.logoUrl = effectiveLogoUrl;
        await fetch(onCompleteUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(completeBody),
        });
      } catch (err) {
        console.error("onCompleteUrl error", onCompleteUrl, err);
      }
    }

    await sendLog(logCallbackUrl, gameId, "Build complete.");
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
