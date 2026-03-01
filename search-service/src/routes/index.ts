import { Router, Request, Response } from "express";
import { es, INDEX_NAME, ensureIndex } from "../elastic";

const router = Router();

export async function handleIndex(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    gameId: number;
    title: string;
    description: string;
    views?: number;
    createdAt?: string;
    status?: string;
    userId?: number;
  };
  if (!body.gameId || !body.title) {
    res.status(400).json({ error: "gameId and title required" });
    return;
  }

  try {
    await ensureIndex();
    await es.index({
      index: INDEX_NAME,
      id: String(body.gameId),
      document: {
        gameId: body.gameId,
        title: body.title,
        description: body.description ?? "",
        views: body.views ?? 0,
        createdAt: body.createdAt ?? new Date().toISOString(),
        status: body.status ?? "live",
        userId: body.userId ?? null,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Index error:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Index failed" });
  }
}

export async function handleUpdate(req: Request, res: Response): Promise<void> {
  const gameId = parseInt(req.params.gameId, 10);
  if (isNaN(gameId)) {
    res.status(400).json({ error: "Invalid gameId" });
    return;
  }
  const body = req.body as Record<string, unknown>;

  try {
    await ensureIndex();
    await es.update({
      index: INDEX_NAME,
      id: String(gameId),
      doc: body,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Update error:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Update failed" });
  }
}

export async function handleDelete(req: Request, res: Response): Promise<void> {
  const gameId = req.params.gameId;
  if (!gameId) {
    res.status(400).json({ error: "gameId required" });
    return;
  }

  try {
    await es
      .delete({ index: INDEX_NAME, id: gameId })
      .catch((e: { meta: { statusCode: number } }) => {
        if (e.meta?.statusCode === 404) return;
        throw e;
      });
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete error:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Delete failed" });
  }
}

router.post("/", handleIndex);
router.put("/:gameId", handleUpdate);
router.delete("/:gameId", handleDelete);
export default router;
