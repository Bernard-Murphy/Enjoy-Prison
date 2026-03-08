#!/usr/bin/env node
/**
 * Seed game generator: pulls existing prompts from "seeded" table, asks an LLM
 * for a new compatible prompt, creates a game via plan + build (same as web flow),
 * then inserts the prompt into seeded. Run from repo root: node scripts/gen.js
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

// Load web/.env into process.env (simple parser, no dotenv dependency)
function loadEnv() {
  const envPath = path.join(__dirname, "..", "web", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      )
        val = val.slice(1, -1).replace(/\\n/g, "\n");
      process.env[key] = val;
    }
  }
}
loadEnv();

// Prisma client is generated to repo root node_modules when running from web
const { PrismaClient } = require(
  path.join(__dirname, "..", "node_modules", "@prisma", "client"),
);
const prisma = new PrismaClient();

const TITLE_MAX_LENGTH = 30;

function parsePlanNameAndDescription(planText) {
  const trimmed = (planText || "").trim();
  if (trimmed.startsWith("{")) {
    try {
      const config = JSON.parse(trimmed);
      const titleSource =
        config.gameType === "turn-based" && config.turnBased?.common?.title
          ? config.turnBased.common.title
          : config.meta?.title;
      const title = (titleSource || "Untitled Game").slice(0, TITLE_MAX_LENGTH);
      const description =
        config.gameType === "turn-based" &&
        config.turnBased?.common?.description
          ? config.turnBased.common.description
          : config.meta?.description || "";
      return { title, description };
    } catch (_) {}
  }
  return { title: "Untitled Game", description: "" };
}

// --- 1. Seeded table ---
async function ensureSeededTable() {
  await prisma.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS seeded (id SERIAL PRIMARY KEY, prompt TEXT);",
  );
}

async function getSeededPrompts() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT prompt FROM seeded ORDER BY id",
  );
  return rows.map((r) => (r.prompt != null ? String(r.prompt) : ""));
}

async function insertSeededPrompt(prompt) {
  await prisma.$executeRaw`INSERT INTO seeded (prompt) VALUES (${prompt})`;
}

// --- 2. LLM: suggest new prompt (fetch to OpenAI-compatible API) ---
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

async function suggestNewPrompt(existingPrompts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");
  const baseUrl = (
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;

  const systemPrompt = `You suggest exactly one short game description prompt for a game generator.
The generator supports: action games (platformer, top-down, shooter, puzzle, endless-runner, fighting) and turn-based games (grid e.g. tic-tac-toe/Connect 4, word e.g. hangman/wordle, board e.g. Monopoly, memory, trivia, card games).
Output ONLY one sentence that describes a specific game. No quotes, no explanation, no list. The prompt must be concrete enough that the generator will produce a full game plan (not ask for clarification).
Do NOT suggest a prompt that is already in this list or very similar (e.g. same game with minor wording changes):
${existingPrompts.length ? existingPrompts.map((p) => `- ${p}`).join("\n") : "(none yet)"}`;

  const body = {
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Suggest one new game prompt." },
    ],
    max_tokens: 120,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string")
    throw new Error("Invalid LLM response");
  const prompt = content.trim().replace(/^["']|["']$/g, "");
  if (!prompt) throw new Error("Empty prompt from LLM");
  return prompt;
}

// --- 3. Plan API ---
async function fetchPlan(message, gameId) {
  const base = process.env.GAME_SERVICE_URL;
  if (!base) throw new Error("GAME_SERVICE_URL is not set");
  const url = `${base.replace(/\/$/, "")}/api/plan`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, gameId }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Plan API returned ${res.status}`);
  }
  return res.json();
}

// --- 4. Build API + callback server ---
async function triggerBuild(gameId, planText, onCompleteUrl, logCallbackUrl) {
  const base = process.env.GAME_SERVICE_URL;
  if (!base) throw new Error("GAME_SERVICE_URL is not set");
  const url = `${base.replace(/\/$/, "")}/api/build`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gameId,
      planText,
      onCompleteUrl,
      logCallbackUrl,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Build API returned ${res.status}`);
  }
}

async function handleBuildComplete(gameId, status, hostedAt, logoUrl) {
  const plan = await prisma.gamePlan.findUnique({
    where: { gameId },
    select: { planText: true },
  });
  const planSnapshot = plan?.planText ?? "{}";
  const gameUpdateData = { status, hostedAt: hostedAt || "" };
  if (logoUrl != null && logoUrl !== "") gameUpdateData.logoUrl = logoUrl;

  await prisma.$transaction([
    prisma.gameVersion.updateMany({
      where: { gameId },
      data: { isDefault: false },
    }),
    prisma.gameVersion.create({
      data: {
        gameId,
        hostedAt: hostedAt || "",
        planSnapshot,
        isDefault: true,
        archived: false,
      },
    }),
    prisma.game.update({
      where: { id: gameId },
      data: gameUpdateData,
    }),
  ]);
}

function createCallbackServer() {
  let resolveBuildComplete;
  const buildCompletePromise = new Promise((resolve) => {
    resolveBuildComplete = resolve;
  });

  const port = parseInt(process.env.SCRIPT_CALLBACK_PORT || "31337", 10);
  const server = http.createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(404);
      res.end();
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        if (
          req.url === "/api/build-complete" ||
          req.url === "/api/build-complete/"
        ) {
          const gameId = Number(data.gameId);
          const status = typeof data.status === "string" ? data.status : "live";
          const hostedAt =
            typeof data.hostedAt === "string" ? data.hostedAt : "";
          const logoUrl =
            typeof data.logoUrl === "string" ? data.logoUrl : undefined;
          if (!gameId || !Number.isInteger(gameId)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "gameId required" }));
            return;
          }
          handleBuildComplete(gameId, status, hostedAt, logoUrl)
            .then(() => {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true }));
              if (resolveBuildComplete)
                resolveBuildComplete({ gameId, status, hostedAt, logoUrl });
            })
            .catch((err) => {
              console.error("[gen] build-complete handler error:", err);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Internal server error" }));
              if (resolveBuildComplete) resolveBuildComplete({ error: err });
            });
          return;
        }
        if (req.url === "/api/build-log" || req.url === "/api/build-log/") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        res.writeHead(404);
        res.end();
      } catch (err) {
        console.error("[gen] callback parse error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, "0.0.0.0", () => {
      const baseUrl =
        process.env.BUILD_CALLBACK_BASE_URL || `http://localhost:${port}`;
      resolve({
        server,
        baseUrl: baseUrl.replace(/\/$/, ""),
        buildCompletePromise,
      });
    });
    server.on("error", reject);
  });
}

async function main() {
  console.log("[gen] Ensuring seeded table...");
  await ensureSeededTable();
  const existingPrompts = await getSeededPrompts();
  console.log("[gen] Existing seeded prompts:", existingPrompts.length);

  console.log("[gen] Asking LLM for a new prompt...");
  const newPrompt = await suggestNewPrompt(existingPrompts);
  console.log("[gen] New prompt:", newPrompt);

  // Similarity safeguard: skip if already present (normalize for comparison)
  const normalizedNew = newPrompt.toLowerCase().trim().replace(/\s+/g, " ");
  const isDuplicate = existingPrompts.some((p) => {
    const n = p.toLowerCase().trim().replace(/\s+/g, " ");
    return (
      n === normalizedNew ||
      n.includes(normalizedNew) ||
      normalizedNew.includes(n)
    );
  });
  if (isDuplicate) {
    console.warn(
      "[gen] LLM returned a prompt too similar to existing; exiting without inserting.",
    );
    process.exit(1);
  }

  console.log("[gen] Creating game and chat message...");
  const game = await prisma.game.create({
    data: {
      title: "Untitled Game",
      status: "planning",
      description: "",
      hostedAt: "",
      userId: null,
    },
  });
  await prisma.chatMessage.create({
    data: {
      gameId: game.id,
      role: "user",
      message: newPrompt,
    },
  });

  console.log("[gen] Calling plan API...");
  const planResponse = await fetchPlan(newPrompt, game.id);
  if (planResponse.type === "clarification") {
    console.error(
      "[gen] Plan API returned clarification:",
      planResponse.content,
    );
    console.error(
      "[gen] Game left in planning state; not inserting into seeded.",
    );
    process.exit(1);
  }

  const planContent =
    typeof planResponse.content === "string"
      ? planResponse.content
      : JSON.stringify(planResponse.content);
  const planDescription =
    typeof planResponse.description === "string"
      ? planResponse.description
      : undefined;

  await prisma.gamePlan.upsert({
    where: { gameId: game.id },
    create: {
      gameId: game.id,
      planText: planContent,
      ...(planDescription != null && { description: planDescription }),
    },
    update: {
      planText: planContent,
      ...(planDescription != null && { description: planDescription }),
    },
  });
  const { title, description } = parsePlanNameAndDescription(planContent);
  await prisma.game.update({
    where: { id: game.id },
    data: { title, description },
  });
  console.log("[gen] Plan saved; title:", title);

  const { server, baseUrl, buildCompletePromise } =
    await createCallbackServer();
  const onCompleteUrl = `${baseUrl}/api/build-complete`;
  const logCallbackUrl = `${baseUrl}/api/build-log`;
  console.log("[gen] Callback server listening; triggering build...");

  await triggerBuild(game.id, planContent, onCompleteUrl, logCallbackUrl);

  const result = await buildCompletePromise;
  server.close();
  if (result.error) {
    console.error("[gen] Build complete callback failed:", result.error);
    process.exit(1);
  }
  console.log("[gen] Build complete; game is live.");

  const randomViews = Math.floor(Math.random() * 1000) + 1;
  await prisma.game.update({
    where: { id: game.id },
    data: { views: { increment: randomViews } },
  });
  console.log("[gen] Incremented game views by", randomViews);

  await insertSeededPrompt(newPrompt);
  console.log("[gen] Inserted prompt into seeded. Done.");
}

main()
  .catch((err) => {
    console.error("[gen] Fatal:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
