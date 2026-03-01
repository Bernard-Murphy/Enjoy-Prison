# EP Games

AI-powered game generation platform. Monorepo containing:

- **web** – Next.js frontend + GraphQL API (Apollo, Prisma, PostgreSQL)
- **game-service** – Game generation microservice (OpenAI, S3)
- **search-service** – Elasticsearch indexing and search

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` in `web/`, `game-service/`, and `search-service/`; fill in values
3. Start infrastructure: `docker-compose up -d` (Postgres, Elasticsearch, MinIO)
4. Run migrations: `cd web && npx prisma migrate dev`
5. Start the web app: `npm run dev` (from repo root)

## Scripts

- `npm run dev` – Start Next.js dev server (web)
- `npm run dev:server` – Start web with custom server (enables GraphQL subscriptions over WebSocket)
- `npm run dev:game` – Start game-service
- `npm run dev:search` – Start search-service
- `npm run build` – Build web app
