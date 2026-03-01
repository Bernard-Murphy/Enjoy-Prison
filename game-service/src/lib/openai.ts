import OpenAI from "openai";

/**
 * Create an OpenAI-compatible client. Supports custom base URLs for providers
 * like Venice, OpenRouter, or other OpenAI-compatible APIs.
 *
 * Set OPENAI_BASE_URL to use a different endpoint (e.g. https://api.venice.ai/v1).
 * If unset, uses the default OpenAI API.
 */
export function createOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  const options: { apiKey: string; baseURL?: string } = { apiKey };
  if (baseURL) {
    options.baseURL = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  }

  return new OpenAI(options);
}

export const openai = createOpenAIClient();
