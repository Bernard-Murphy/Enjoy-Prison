export type PlanResponse =
  | { type: "plan"; content: string }
  | { type: "clarification"; content: string };

const TITLE_MAX_LENGTH = 30;

/**
 * Parses plan text for **Name:** and **Description:** (or "Name:" and "Description:") at the top.
 * Returns title (truncated to 30 chars) and description for the Game.
 */
export function parsePlanNameAndDescription(planText: string): {
  title: string;
  description: string;
} {
  const lines = planText.trim().split(/\r?\n/);
  let title = "Untitled Game";
  let description = "";
  for (const line of lines) {
    const trimmed = line.trim();
    const nameMatch =
      trimmed.match(/^\*\*Name:\*\*\s*(.+)$/i) ??
      trimmed.match(/^Name:\s*(.+)$/i);
    if (nameMatch) {
      title = nameMatch[1].trim().slice(0, TITLE_MAX_LENGTH) || title;
      continue;
    }
    const descMatch =
      trimmed.match(/^\*\*Description:\*\*\s*(.+)$/i) ??
      trimmed.match(/^Description:\s*(.+)$/i);
    if (descMatch) {
      description = descMatch[1].trim();
      break;
    }
  }
  return { title, description };
}

/**
 * Parses the plan API response. Expects first line "TYPE: plan" or "TYPE: clarification", then content.
 * Defaults to type "plan" if the prefix is missing or unrecognized.
 */
export function parsePlanResponse(raw: string): PlanResponse {
  const trimmed = raw.trim();
  const firstLine = trimmed.split("\n")[0]?.trim().toLowerCase() ?? "";
  if (firstLine === "type: clarification") {
    const rest = trimmed.slice(trimmed.indexOf("\n")).trim();
    return { type: "clarification", content: rest };
  }
  if (firstLine === "type: plan") {
    const rest = trimmed.slice(trimmed.indexOf("\n")).trim();
    return { type: "plan", content: rest };
  }
  return { type: "plan", content: trimmed };
}

/**
 * Calls the game-service plan API with optional current plan context.
 * If gameId and planLogCallbackUrl are provided, the game-service will POST each streamed chunk to the callback.
 * Returns parsed type (plan | clarification) and content.
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
  };
  if (gameId != null && Number.isInteger(gameId) && planLogCallbackUrl) {
    body.gameId = gameId;
    body.planLogCallbackUrl = planLogCallbackUrl;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Plan API returned ${res.status}`);
  }
  const raw = await res.text();
  return parsePlanResponse(raw);
}
