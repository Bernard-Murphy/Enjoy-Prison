import { Router, Request, Response } from "express";
import { GameConfigSchema } from "../lib/dsl/schema";
import { generateGameHTML } from "../lib/runtime/gameTemplate";

const router = Router();

/**
 * POST /api/preview
 * Body: { config: GameConfig }
 * Returns full game HTML for iframe srcdoc preview.
 */
export async function handlePreview(
  req: Request,
  res: Response,
): Promise<void> {
  const { config: rawConfig } = req.body as { config?: unknown };

  if (!rawConfig || typeof rawConfig !== "object") {
    res.status(400).json({ error: "config required" });
    return;
  }

  const parsed = GameConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid config",
      details: parsed.error.errors,
    });
    return;
  }

  const html = generateGameHTML(parsed.data);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
}

router.post("/", handlePreview);
export default router;
