/**
 * Triggers the game-service build. The game-service will POST log lines to
 * logCallbackUrl and call onCompleteUrl when done.
 */
export async function triggerBuild(params: {
  gameId: number;
  planText: string;
  onCompleteUrl: string;
  logCallbackUrl: string;
  logoUrl?: string;
}): Promise<void> {
  const base = process.env.GAME_SERVICE_URL;
  if (!base) {
    throw new Error("GAME_SERVICE_URL is not set");
  }
  const url = `${base.replace(/\/$/, "")}/api/build`;
  console.log(
    "[web] triggerBuild →",
    url,
    "logCallbackUrl:",
    params.logCallbackUrl,
  );
  const body: Record<string, unknown> = {
    gameId: params.gameId,
    planText: params.planText,
    onCompleteUrl: params.onCompleteUrl,
    logCallbackUrl: params.logCallbackUrl,
  };
  if (params.logoUrl) body.logoUrl = params.logoUrl;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Build API returned ${res.status}`);
  }
}
