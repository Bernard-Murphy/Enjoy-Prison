import { Client } from "@elastic/elasticsearch";

const node = process.env.ELASTICSEARCH_URL || "http://localhost:9200";
export const es = new Client({ node });

export const INDEX_NAME = "games";

export const indexMapping = {
  properties: {
    gameId: { type: "integer" },
    title: { type: "text", analyzer: "standard" },
    description: { type: "text", analyzer: "standard" },
    views: { type: "integer" },
    createdAt: { type: "date" },
    status: { type: "keyword" },
    userId: { type: "integer" },
  },
};

export async function ensureIndex(): Promise<void> {
  const exists = await es.indices.exists({ index: INDEX_NAME });
  if (!exists) {
    await es.indices.create({
      index: INDEX_NAME,
      body: { mappings: indexMapping },
    });
  }
}
