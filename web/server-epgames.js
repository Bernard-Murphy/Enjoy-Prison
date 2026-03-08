const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");

// Ensure a single pubsub instance for both WebSocket (useServer) and build-log/plan-log callbacks.
// Load pubsub first so it registers on global; then schema/resolvers will use the same instance.
const {
  pubsub,
  PLAN_CHUNKS,
  planChunkBuffer,
  buildLogBuffer,
} = require("./src/lib/pubsub");
const { schema } = require("./src/lib/graphql/apollo-server");
const { appendBuildLogAndPublish } = require("./src/lib/build-log");
const { handleBuildComplete } = require("./src/lib/handle-build-complete");
const { prisma } = require("./src/lib/prisma");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

const { parse: parseGraphQL, execute } = require("graphql");
const {
  buildContextFromNodeRequest,
} = require("./src/lib/graphql/context-node");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      const parsedUrl = parse(req.url, true);
      const pathname = parsedUrl.pathname || "";
      const isPost = req.method === "POST";

      // Run GraphQL in this process so mutations (e.g. buildGame) use the same pubsub as WebSocket subscriptions.
      if (isPost && pathname === "/api/graphql") {
        let responseSent = false;
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw || "{}");
          const query = body.query;
          if (!query) {
            sendJson(res, 400, { errors: [{ message: "Missing query" }] });
            responseSent = true;
            return;
          }
          const operationName = body.operationName || null;
          const { context, newSessionId } =
            await buildContextFromNodeRequest(req);
          const document = parseGraphQL(query);
          const result = await execute({
            schema,
            document,
            variableValues: body.variables || null,
            operationName,
            contextValue: context,
          });
          if (result.errors && result.errors.length > 0) {
            console.log(
              "[server.js] graphql result errors:",
              result.errors.map((e) => e.message),
            );
          }

          res.setHeader("Content-Type", "application/json; charset=utf-8");
          if (newSessionId) {
            res.setHeader(
              "Set-Cookie",
              `session-id=${encodeURIComponent(newSessionId)}; path=/; max-age=2592000; samesite=lax`,
            );
          }
          res.statusCode = 200;
          const payload = JSON.stringify(result);
          res.setHeader("Content-Length", Buffer.byteLength(payload, "utf8"));
          res.end(payload);
          responseSent = true;
        } catch (err) {
          console.error("[server.js] graphql error:", err);
          if (!responseSent) {
            sendJson(res, 500, {
              errors: [
                {
                  message: err instanceof Error ? err.message : String(err),
                },
              ],
            });
          }
        }
        return;
      }

      // Plan stream polling: return current plan from buffer or DB so client can show plan when subscription doesn't deliver.
      if (pathname === "/api/plan-stream" && req.method === "GET") {
        const gameId = Number(parsedUrl.query?.gameId);
        if (!gameId || !Number.isInteger(gameId)) {
          sendJson(res, 400, { error: "gameId required" });
          return;
        }
        (async () => {
          try {
            const buffer = planChunkBuffer.get(gameId);
            const fromBuffer =
              Array.isArray(buffer) && buffer.length > 0
                ? buffer.join("")
                : null;
            if (fromBuffer !== null && fromBuffer.length > 0) {
              sendJson(res, 200, { planText: fromBuffer });
              return;
            }
            const row = await prisma.gamePlan.findUnique({
              where: { gameId },
              select: { planText: true },
            });
            sendJson(res, 200, {
              planText: typeof row?.planText === "string" ? row.planText : "",
            });
          } catch (e) {
            console.error("[server.js] plan-stream error:", e);
            sendJson(res, 500, { error: "Internal server error" });
          }
        })();
        return;
      }

      // Handle plan-log callback: game-service streams plan chunks here; we publish to planChunks subscription.
      if (isPost && pathname === "/api/plan-log") {
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw || "{}");
          const gameId = Number(body?.gameId);
          const planText =
            typeof body?.planText === "string" ? body.planText : "";
          if (!gameId || !Number.isInteger(gameId)) {
            sendJson(res, 400, { error: "gameId required" });
            return;
          }
          if (!planChunkBuffer.has(gameId)) planChunkBuffer.set(gameId, []);
          planChunkBuffer.get(gameId).push(planText);
          pubsub.publish(`${PLAN_CHUNKS}:${gameId}`, {
            planChunks: { planText },
          });
          sendJson(res, 200, { ok: true });
        } catch (err) {
          console.error("[server.js] plan-log error:", err);
          sendJson(res, 500, { error: "Internal server error" });
        }
        return;
      }

      // Build log stream polling: return current build logs from buffer or DB so client can show logs when subscription doesn't deliver.
      if (pathname === "/api/build-log-stream" && req.method === "GET") {
        const gameId = Number(parsedUrl.query?.gameId);
        if (!gameId || !Number.isInteger(gameId)) {
          sendJson(res, 400, { error: "gameId required" });
          return;
        }
        (async () => {
          try {
            const fromBuffer = buildLogBuffer.get(gameId) ?? [];
            const rows = await prisma.gameBuildLog.findMany({
              where: { gameId },
              orderBy: { createdAt: "asc" },
              select: { buildText: true },
            });
            const fromDb = rows.map((r) => r.buildText);
            const logs =
              fromBuffer.length >= fromDb.length ? fromBuffer : fromDb;
            sendJson(res, 200, { logs });
          } catch (e) {
            console.error("[server.js] build-log-stream error:", e);
            sendJson(res, 500, { error: "Internal server error" });
          }
        })();
        return;
      }

      // Handle build-log callback in this process so pubsub is the same as WebSocket subscriptions.
      if (isPost && pathname === "/api/build-log") {
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw || "{}");
          const gameId = Number(body?.gameId);
          const buildText =
            typeof body?.buildText === "string" ? body.buildText : "";
          if (!gameId || !Number.isInteger(gameId)) {
            console.log(
              "[server.js] build-log reject: missing gameId or invalid",
            );
            sendJson(res, 400, { error: "gameId and buildText required" });
            return;
          }
          if (!buildLogBuffer.has(gameId)) buildLogBuffer.set(gameId, []);
          buildLogBuffer.get(gameId).push(buildText);
          await appendBuildLogAndPublish(gameId, buildText);
          console.log("[server.js] build-log done");
          sendJson(res, 200, { ok: true });
        } catch (err) {
          console.error("[server.js] build-log error:", err);
          sendJson(res, 500, { error: "Internal server error" });
        }
        return;
      }

      // Handle build-complete callback in this process for the same reason.
      if (isPost && pathname === "/api/build-complete") {
        console.log("[server.js] POST /api/build-complete received");
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw || "{}");
          const gameId = Number(body?.gameId);
          const status =
            typeof body?.status === "string" ? body.status : "live";
          const hostedAt =
            typeof body?.hostedAt === "string" ? body.hostedAt : "";
          const logoUrl =
            typeof body?.logoUrl === "string" ? body.logoUrl : undefined;
          if (!gameId || !Number.isInteger(gameId)) {
            sendJson(res, 400, { error: "gameId required" });
            return;
          }
          await handleBuildComplete(gameId, status, hostedAt, logoUrl);
          sendJson(res, 200, { ok: true });
        } catch (err) {
          console.error("[build-complete] error:", err);
          sendJson(res, 500, { error: "Internal server error" });
        }
        return;
      }

      await handle(req, res, parsedUrl);
    });

    const wss = new WebSocketServer({
      server,
      path: "/api/graphql",
    });

    // Swallow write-after-end when sending subscription payloads to closed connections
    wss.on("connection", (socket) => {
      const originalSend = socket.send.bind(socket);
      socket.send = function (data, errCallback) {
        originalSend(data, (err) => {
          const isWriteAfterEnd =
            err &&
            (err.code === "ERR_STREAM_WRITE_AFTER_END" ||
              String(err.message || "").includes("write after end"));
          if (isWriteAfterEnd) {
            if (typeof errCallback === "function") errCallback();
            return;
          }
          if (typeof errCallback === "function") errCallback(err);
        });
      };
    });

    useServer(
      {
        schema,
        context: () => ({
          user: null,
          sessionId: null,
        }),
      },
      wss,
    );

    const port = process.env.PORT || 3000;
    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
    });
  })
  .catch((ex) => {
    console.error(ex.stack);
    process.exit(1);
  });
