import { Router, Request, Response } from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/webp" ||
      file.mimetype === "image/gif";
    if (ok) cb(null, true);
    else cb(new Error("Only image files (png, jpeg, webp, gif) are allowed"));
  },
});

function buildPublicUrl(key: string): string {
  if (GAME_BASE_URL) {
    const base = GAME_BASE_URL.replace(/\/$/, "");
    return `${base}/${key}`;
  }
  return `/${key}`;
}

export async function handleUploadLogo(
  req: Request,
  res: Response,
): Promise<void> {
  if (!s3 || !BUCKET) {
    res.status(503).json({ error: "S3 not configured" });
    return;
  }

  const file = req.file;
  if (!file || !file.buffer) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const gameIdParam = req.query.gameId ?? req.body?.gameId;
  const gameId =
    gameIdParam != null ? parseInt(String(gameIdParam), 10) : undefined;
  const isValidGameId = Number.isInteger(gameId) && (gameId as number) > 0;

  const ext =
    file.mimetype === "image/png"
      ? "png"
      : file.mimetype === "image/webp"
        ? "webp"
        : file.mimetype === "image/gif"
          ? "gif"
          : "jpg";
  const key = isValidGameId
    ? `games/${gameId}/logo.${ext}`
    : `temp-logos/${randomUUID()}.${ext}`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    const url = buildPublicUrl(key);
    res.json({ url });
  } catch (err) {
    console.error("[upload-logo] S3 error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Upload failed",
    });
  }
}

router.post(
  "/",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (
          err instanceof multer.MulterError &&
          err.code === "LIMIT_FILE_SIZE"
        ) {
          return res.status(400).json({ error: "File too large (max 5MB)" });
        }
        return res.status(400).json({ error: err?.message ?? "Upload error" });
      }
      next();
    });
  },
  handleUploadLogo,
);

export default router;
