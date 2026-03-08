import { openai } from "../openai";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "dall-e-2";

/**
 * Generate a game logo image using the same AI service (OpenAI Images API).
 * Returns a PNG buffer or null if the service is unavailable or image generation fails.
 */
export async function generateLogo(
  gameTitle: string,
  gameDescription: string,
): Promise<Buffer | null> {
  if (!openai) {
    return null;
  }

  const prompt = `Logo icon for: ${gameTitle}. ${gameDescription}. Detailed and lively design, eye-catching and fun, square 256x256, suitable for a game thumbnail.`;

  try {
    const response = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: "256x256",
      response_format: "b64_json",
    });

    const b64 = response.data?.[0];
    if (!b64 || !("b64_json" in b64) || typeof b64.b64_json !== "string") {
      return null;
    }

    return Buffer.from(b64.b64_json, "base64");
  } catch (err) {
    console.error("[generateLogo] Error:", err);
    return null;
  }
}
