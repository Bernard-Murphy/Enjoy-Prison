/**
 * reCAPTCHA v3 client-side: load script and get token.
 * When NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set, getToken resolves to null (verification skipped).
 */

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (
        siteKey: string,
        options: { action: string },
      ) => Promise<string>;
    };
  }
}

const SITE_KEY =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim()
    : "";

let scriptLoaded = false;
let loadPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (!SITE_KEY) return Promise.resolve();
  if (scriptLoaded && window.grecaptcha) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="recaptcha"]')) {
      scriptLoaded = true;
      if (window.grecaptcha) window.grecaptcha.ready(() => resolve());
      else resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      if (window.grecaptcha) window.grecaptcha.ready(() => resolve());
      else resolve();
    };
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
    document.body.appendChild(script);
  });

  return loadPromise;
}

/**
 * Get a reCAPTCHA v3 token for the given action.
 * Returns null if site key is not configured (verification will be skipped server-side).
 */
export async function getRecaptchaToken(
  action: string,
): Promise<string | null> {
  if (!SITE_KEY) return null;
  await loadRecaptchaScript();
  if (!window.grecaptcha) return null;
  try {
    const token = await window.grecaptcha.execute(SITE_KEY, { action });
    return token ?? null;
  } catch {
    return null;
  }
}

export function isRecaptchaEnabled(): boolean {
  return !!SITE_KEY;
}
