import { Router, Request, Response } from "express";
import { generatePlan } from "../lib/ai/generatePlan";
import { refinePlan } from "../lib/ai/refinePlan";
import { formatGameDescription } from "../lib/formatGameDescription";
import { GameConfigSchema } from "../lib/dsl/schema";
import type { GameConfig } from "../lib/dsl/schema";

const router = Router();

/**
 * POST /api/plan
 * Body: { message: string, planText?: string, gameId?: number, planLogCallbackUrl?: string }
 * - If planText is provided and valid GameConfig JSON, refines the plan (refinePlan).
 * - Otherwise generates a new plan (generatePlan).
 * - When gameId and planLogCallbackUrl are present, streams plan chunks to the callback URL.
 * Returns JSON: { type: "clarification", content: string } | { type: "plan", content: string, description?: string }
 */
export async function handlePlan(req: Request, res: Response): Promise<void> {
  const { message, planText, gameId, planLogCallbackUrl } = req.body as {
    message?: string;
    planText?: string;
    gameId?: number;
    planLogCallbackUrl?: string;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message required" });
    return;
  }

  const THROTTLE_MS = 80;
  let lastSentLength = 0;
  let lastSendTime = 0;
  const url =
    gameId != null &&
    Number.isInteger(gameId) &&
    typeof planLogCallbackUrl === "string" &&
    planLogCallbackUrl.trim().length > 0
      ? planLogCallbackUrl.trim()
      : null;

  const sendDelta = (delta: string) => {
    if (delta.length === 0) return;
    fetch(url!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, planText: delta }),
    }).catch((err) => {
      console.error("[plan] plan-log callback error:", err);
    });
  };

  const streamOpts =
    url !== null
      ? {
          onChunk: (accumulatedText: string) => {
            const now = Date.now();
            if (now - lastSendTime >= THROTTLE_MS) {
              const delta = accumulatedText.slice(lastSentLength);
              lastSentLength = accumulatedText.length;
              lastSendTime = now;
              sendDelta(delta);
            }
          },
          onEnd: (accumulatedText: string) => {
            const delta = accumulatedText.slice(lastSentLength);
            lastSentLength = accumulatedText.length;
            sendDelta(delta);
          },
        }
      : undefined;

  try {
    let config: GameConfig | null = null;
    if (typeof planText === "string" && planText.trim().length > 0) {
      try {
        const parsed = JSON.parse(planText) as unknown;
        const result = GameConfigSchema.safeParse(parsed);
        if (result.success) {
          config = result.data;
        }
      } catch {
        // planText is not valid JSON; treat as new generation
      }
    }

    if (config) {
      const updated = await refinePlan(config, message, streamOpts);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.json({
        type: "plan",
        content: JSON.stringify(updated),
        description: formatGameDescription(updated),
      });
      return;
    }

    const result = await generatePlan(message, streamOpts);

    if (result.type === "clarification") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.json({
        type: "clarification",
        content: result.content,
      });
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json({
      type: "plan",
      content: JSON.stringify(result.config),
      description: formatGameDescription(result.config),
    });
  } catch (err) {
    console.error("[plan] Plan error:", err);
    const message =
      err instanceof Error ? err.message : "Plan generation failed";
    res.status(500).json({
      error: message,
    });
  }
}

/**
 * POST /api/plan/from-description
 * Body: { description: string }
 * Converts human-readable game description to GameConfig JSON.
 * Returns { type: "plan", content: string, description: string } or 400 with clarification.
 */
export async function handlePlanFromDescription(
  req: Request,
  res: Response,
): Promise<void> {
  const { description } = req.body as { description?: string };
  if (!description || typeof description !== "string") {
    res.status(400).json({ error: "description required" });
    return;
  }

  try {
    const result = await generatePlan(description.trim());
    if (result.type === "clarification") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(400).json({
        type: "clarification",
        content: result.content,
      });
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json({
      type: "plan",
      content: JSON.stringify(result.config),
      description: formatGameDescription(result.config),
    });
  } catch (err) {
    console.error("Plan from description error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Plan generation failed",
    });
  }
}

router.post("/", handlePlan);
router.post("/from-description", handlePlanFromDescription);
export default router;
