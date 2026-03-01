/**
 * Triggers the game-service build. The game-service will POST log lines to
 * logCallbackUrl and call onCompleteUrl when done.
 */
export async function triggerBuild(params: {
  gameId: number;
  planText: string;
  onCompleteUrl: string;
  logCallbackUrl: string;
}): Promise<void> {
  const base = process.env.GAME_SERVICE_URL;
  if (!base) {
    throw new Error("GAME_SERVICE_URL is not set");
  }
  const url = `${base.replace(/\/$/, "")}/api/build`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gameId: params.gameId,
      planText: params.planText,
      onCompleteUrl: params.onCompleteUrl,
      logCallbackUrl: params.logCallbackUrl,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Build API returned ${res.status}`);
  }
}
