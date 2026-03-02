import { Client } from "@elastic/elasticsearch";

const node = process.env.ELASTICSEARCH_URL || "http://localhost:9200";
export const es = new Client({ node });

export const INDEX_NAME = "games";

// Use const assertion so Elasticsearch mapping property types are literal types
const properties = {
  gameId: { type: "integer" as const },
  title: { type: "text" as const, analyzer: "standard" },
  description: { type: "text" as const, analyzer: "standard" },
  views: { type: "integer" as const },
  createdAt: { type: "date" as const },
  status: { type: "keyword" as const },
  userId: { type: "integer" as const },
};

export const indexMapping = { properties };

export async function ensureIndex(): Promise<void> {
  const exists = await es.indices.exists({ index: INDEX_NAME });
  if (!exists) {
    await es.indices.create({
      index: INDEX_NAME,
      body: { mappings: indexMapping },
    });
  }
}
