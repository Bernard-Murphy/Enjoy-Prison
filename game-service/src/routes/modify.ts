import { Router, Request, Response } from "express";
import { refinePlan } from "../lib/ai/refinePlan";
import { GameConfigSchema } from "../lib/dsl/schema";
import type { GameConfig } from "../lib/dsl/schema";

const router = Router();

/**
 * POST /api/modify
 * Body: { gameId: number, config: GameConfig, message: string }
 * Returns refined GameConfig based on user request.
 * The web app saves the returned config to planText and can trigger a new build.
 */
export async function handleModify(req: Request, res: Response): Promise<void> {
  const { gameId, config, message } = req.body as {
    gameId?: number;
    config?: unknown;
    message?: string;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message required" });
    return;
  }

  if (!config || typeof config !== "object") {
    res
      .status(400)
      .json({ error: "config required (current game config JSON)" });
    return;
  }

  try {
    const parsed = GameConfigSchema.safeParse(config);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid config",
        details: parsed.error.errors,
      });
      return;
    }

    const updated = await refinePlan(parsed.data, message);
    res.json({ success: true, config: updated });
  } catch (err) {
    console.error("Modify error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Modify failed",
    });
  }
}

router.post("/", handleModify);
export default router;
