export type PlanResponse =
  | { type: "plan"; content: string }
  | { type: "clarification"; content: string };

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
 * Returns parsed type (plan | clarification) and content.
 */
export async function fetchPlanFromGameService(
  message: string,
  planText?: string | null,
): Promise<PlanResponse> {
  const base = process.env.GAME_SERVICE_URL;
  if (!base) {
    throw new Error("GAME_SERVICE_URL is not set");
  }
  const url = `${base.replace(/\/$/, "")}/api/plan`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, planText: planText ?? undefined }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Plan API returned ${res.status}`);
  }
  const raw = await res.text();
  return parsePlanResponse(raw);
}
