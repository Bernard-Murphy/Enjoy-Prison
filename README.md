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

---

## Build

From the repo root:

- **Web only:** `npm run build` (runs Prisma generate + Next.js build in `web/`)
- **All workspaces:** `npm run build:all` (builds web, game-service, and search-service)

Per-workspace (from root with workspaces or from the package directory):

- **web:** `npm run build --workspace=web` or `cd web && npm run build` — Prisma generate + `next build`
- **game-service:** `npm run build --workspace=game-service` or `cd game-service && npm run build` — TypeScript compile to `dist/`
- **search-service:** `npm run build --workspace=search-service` or `cd search-service && npm run build` — TypeScript compile to `dist/`

---

## Deployment

### Infrastructure

Start Postgres, Elasticsearch, and MinIO (for S3-compatible storage):

```bash
docker-compose up -d
```

With the default `docker-compose.yml`, Postgres is on port 6433 (host) → 5432 (container), Elasticsearch on 9200, MinIO on 9000 (API) and 9001 (console). Adjust `.env` in each app to match (e.g. `DATABASE_URL` with port 6433 if connecting from host).

### Environment

- **web:** Copy `web/.env.example` to `web/.env`. Set `DATABASE_URL`, `JWT_SECRET`, and optionally `WEB_APP_URL`, `GAME_SERVICE_URL`, reCAPTCHA, and OpenAI keys as needed.
- **game-service:** Copy `game-service/.env.example` to `game-service/.env`. Set `OPENAI_API_KEY`, S3/MinIO credentials (`AWS_*`, `S3_BUCKET`, `S3_ENDPOINT`), and optionally `OPENAI_BASE_URL`, `OPENAI_MODEL`, `GAME_BASE_URL`.
- **search-service:** Configure per its `.env.example` if you use search.

For **plan** and **build** to work, the web app must reach the game-service: set `GAME_SERVICE_URL` in web (e.g. `http://localhost:4001`) and `WEB_APP_URL` in game-service so callbacks (plan-log, build-log, build-complete) hit the correct web URL.

### Running in production

1. **Migrations:** From `web/`, run `npx prisma migrate deploy` (or apply your migration strategy).
2. **Web (with GraphQL subscriptions):** Use the custom server so WebSocket subscriptions work:
   ```bash
   cd web && npm run build && npm run dev:server
   ```
   Or with Node: `node server.js` (after `npm run build`). For a plain Next.js server without subscriptions: `npm run start` from `web/`.
3. **Game-service:** `cd game-service && npm run build && npm run start` (serves on `PORT`, default 4001).
4. **Search-service (optional):** `cd search-service && npm run build && npm run start`.

Set `NODE_ENV=production` and use a process manager (e.g. systemd, PM2) or a platform (e.g. Railway, Render, Fly.io) to run the Node processes. Expose the web app and game-service on the same host or configure CORS and callback URLs accordingly.
