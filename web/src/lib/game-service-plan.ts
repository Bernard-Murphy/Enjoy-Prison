export type PlanResponse =
  | { type: "plan"; content: string; description?: string }
  | { type: "clarification"; content: string };

const TITLE_MAX_LENGTH = 30;

/**
 * Builds a minimal human-readable description from planText (JSON) when GamePlan.description is empty.
 * Used for the Description view in the Plan tab.
 */
export function formatPlanToDescription(planText: string): string {
  const trimmed = planText.trim();
  if (!trimmed.startsWith("{")) return trimmed || "No plan yet.";
  try {
    const config = JSON.parse(trimmed) as {
      gameType?: string;
      meta?: { title?: string; description?: string };
      turnBased?: { common?: { title?: string; description?: string } };
      controls?: Record<string, string>;
    };
    const title =
      config.gameType === "turn-based" && config.turnBased?.common?.title
        ? config.turnBased.common.title
        : (config.meta?.title ?? "Untitled Game");
    const summary =
      config.gameType === "turn-based" && config.turnBased?.common?.description
        ? config.turnBased.common.description
        : (config.meta?.description ?? "");
    const lines: string[] = [`## ${title}`, summary].filter(Boolean);
    if (config.controls && Object.keys(config.controls).length > 0) {
      lines.push("### Controls");
      for (const [key, value] of Object.entries(config.controls)) {
        if (value) lines.push(`- **${key}:** ${value}`);
      }
    }
    lines.push("\n_Edit in JSON view for full rules and configuration._");
    return lines.join("\n\n");
  } catch {
    return trimmed || "No plan yet.";
  }
}

/**
 * Gets title and description from planText. If planText is valid GameConfig JSON,
 * uses meta.title and meta.description. Otherwise parses legacy "Name:" / "Description:" lines.
 */
export function parsePlanNameAndDescription(planText: string): {
  title: string;
  description: string;
} {
  const trimmed = planText.trim();
  if (trimmed.startsWith("{")) {
    try {
      const config = JSON.parse(trimmed) as {
        gameType?: string;
        meta?: { title?: string; description?: string };
        turnBased?: { common?: { title?: string; description?: string } };
      };
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
    } catch {
      // fall through to legacy parsing
    }
  }
  const lines = trimmed.split(/\r?\n/);
  let title = "Untitled Game";
  let description = "";
  for (const line of lines) {
    const lineTrimmed = line.trim();
    const nameMatch =
      lineTrimmed.match(/^\*\*Name:\*\*\s*(.+)$/i) ??
      lineTrimmed.match(/^Name:\s*(.+)$/i);
    if (nameMatch) {
      title = nameMatch[1].trim().slice(0, TITLE_MAX_LENGTH) || title;
      continue;
    }
    const descMatch =
      lineTrimmed.match(/^\*\*Description:\*\*\s*(.+)$/i) ??
      lineTrimmed.match(/^Description:\s*(.+)$/i);
    if (descMatch) {
      description = descMatch[1].trim();
      break;
    }
  }
  return { title, description };
}

/**
 * Calls the game-service plan API. Returns JSON response: { type: "plan"|"clarification", content: string }.
 * For plan, content is the stringified GameConfig (store in planText).
 * When gameId and planLogCallbackUrl are provided, the game-service will stream plan chunks to that URL.
 */
export async function fetchPlanFromGameService(
  message: string,
  planText?: string | null,
  gameId?: number | null,
  planLogCallbackUrl?: string | null,
): Promise<PlanResponse> {
  const base = process.env.GAME_SERVICE_URL;
  if (!base) {
    throw new Error("GAME_SERVICE_URL is not set");
  }
  const url = `${base.replace(/\/$/, "")}/api/plan`;
  const body: Record<string, unknown> = {
    message,
    planText: planText ?? undefined,
    ...(gameId != null &&
      planLogCallbackUrl != null && {
        gameId,
        planLogCallbackUrl,
      }),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Plan API returned ${res.status}`);
  }
  const json = (await res.json()) as {
    type?: string;
    content?: string;
    description?: string;
  };
  const type = json.type === "clarification" ? "clarification" : "plan";
  const content =
    typeof json.content === "string" ? json.content : JSON.stringify(json);
  const description =
    type === "plan" && typeof json.description === "string"
      ? json.description
      : undefined;
  return type === "plan" ? { type, content, description } : { type, content };
}

/**
 * Calls the game-service plan-from-description API. Converts human-readable description to GameConfig JSON.
 * Returns { type: "plan", content, description } or throws with clarification message.
 */
export async function fetchPlanFromDescription(description: string): Promise<{
  content: string;
  description: string;
}> {
  const base = process.env.GAME_SERVICE_URL;
  if (!base) {
    throw new Error("GAME_SERVICE_URL is not set");
  }
  const url = `${base.replace(/\/$/, "")}/api/plan/from-description`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  const json = (await res.json()) as {
    type?: string;
    content?: string;
    description?: string;
    error?: string;
  };
  if (!res.ok) {
    if (json.type === "clarification" && typeof json.content === "string") {
      throw new Error(json.content);
    }
    throw new Error(
      json.error || `Plan from description failed: ${res.status}`,
    );
  }
  if (json.type !== "plan" || typeof json.content !== "string") {
    throw new Error("Invalid response from plan-from-description");
  }
  return {
    content: json.content,
    description: typeof json.description === "string" ? json.description : "",
  };
}
