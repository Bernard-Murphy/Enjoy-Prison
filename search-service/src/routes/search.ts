import { Router, Request, Response } from "express";
import { es, INDEX_NAME, ensureIndex } from "../elastic";

const router = Router();

export async function handleSearch(req: Request, res: Response): Promise<void> {
  const q = (req.query.q as string) || "";
  const sort = (req.query.sort as string) || "createdAt";
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;
  const limit = Math.min(
    parseInt(String(req.query.limit || "20"), 10) || 20,
    100,
  );
  const offset = parseInt(String(req.query.offset || "0"), 10) || 0;

  try {
    await ensureIndex();

    const must: Record<string, unknown>[] = [];
    if (q.trim()) {
      must.push({
        multi_match: {
          query: q.trim(),
          fields: ["title^2", "description"],
        },
      });
    }
    must.push({ term: { status: "live" } });

    if (dateFrom || dateTo) {
      const range: { gte?: string; lte?: string } = {};
      if (dateFrom) range.gte = dateFrom;
      if (dateTo) range.lte = dateTo;
      must.push({ range: { createdAt: range } });
    }

    const sortField = sort === "popular" ? "views" : "createdAt";
    const order = sort === "popular" ? "desc" : "desc";

    const result = await es.search({
      index: INDEX_NAME,
      body: {
        query: { bool: { must } },
        sort: [{ [sortField]: order }],
        from: offset,
        size: limit,
      },
    });

    const hits = (result.hits.hits || []) as {
      _source: Record<string, unknown>;
    }[];
    const games = hits.map((h) => h._source);

    res.json({
      games,
      total:
        typeof result.hits.total === "number"
          ? result.hits.total
          : ((result.hits.total as { value: number })?.value ?? 0),
    });
  } catch (err) {
    console.error("Search error:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Search failed" });
  }
}

router.get("/", handleSearch);
export default router;
