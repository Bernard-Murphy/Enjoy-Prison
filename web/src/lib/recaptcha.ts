/**
 * Google reCAPTCHA Enterprise (v3) server-side verification.
 * When RECAPTCHA_API_KEY and RECAPTCHA_PROJECT_ID are set, tokens are verified;
 * otherwise verification is skipped.
 *
 * Matches Feednana pattern: requires RECAPTCHA_PROJECT_ID for the Enterprise API.
 */

export interface RecaptchaEnterpriseResponse {
  riskAnalysis?: { score?: number };
  tokenProperties?: { valid?: boolean; invalidReason?: string };
}

/**
 * Verify a reCAPTCHA v3 token using the reCAPTCHA Enterprise API.
 * Returns true if verification is disabled (no API key), or if the assessment passes (score >= 0.15).
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction?: string,
): Promise<boolean> {
  const apiKey = process.env.RECAPTCHA_API_KEY?.trim();
  const projectId = process.env.RECAPTCHA_PROJECT_ID?.trim();
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();

  if (!apiKey) {
    return true;
  }

  if (!projectId) {
    console.error(
      "reCAPTCHA: RECAPTCHA_PROJECT_ID is required when RECAPTCHA_API_KEY is set",
    );
    return false;
  }

  if (!token || typeof token !== "string") {
    return false;
  }

  try {
    const body = {
      event: {
        token,
        siteKey: siteKey || undefined,
        expectedAction: expectedAction || "submit",
      },
    };

    const response = await fetch(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const data = (await response.json()) as RecaptchaEnterpriseResponse;

    if (!response.ok) {
      console.error("reCAPTCHA verification error:", data);
      return false;
    }

    const score = data?.riskAnalysis?.score ?? 0;
    return score >= 0.15;
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return false;
  }
}

/** Returns true if reCAPTCHA is configured (enforcement enabled). */
export function isRecaptchaRequired(): boolean {
  return !!process.env.RECAPTCHA_API_KEY?.trim();
}
