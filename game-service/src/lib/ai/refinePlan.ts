import { openai } from "../openai";
import { GameConfigSchema } from "../dsl/schema";
import type { GameConfig } from "../dsl/schema";
import { validateGameLogic } from "../dsl/validate";
import { PLAN_SYSTEM_PROMPT } from "./planPrompt";

export async function refinePlan(
  currentConfig: GameConfig,
  userRequest: string,
  options?: {
    onChunk?: (accumulatedText: string) => void | Promise<void>;
    onEnd?: (accumulatedText: string) => void | Promise<void>;
  },
): Promise<GameConfig> {
  if (!openai) {
    throw new Error("OpenAI not configured");
  }

  const userMessage = `Here is the current game config:\n${JSON.stringify(currentConfig, null, 2)}\n\nThe user wants this change: "${userRequest}"\n\nApply the requested changes and return the COMPLETE updated JSON config. Do not remove existing content unless the user explicitly asks for removal.`;

  let content: string;

  if (options?.onChunk) {
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 16000,
      stream: true,
    });

    let accumulated = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (typeof delta === "string") accumulated += delta;
      options.onChunk(accumulated);
    }
    options.onEnd?.(accumulated);
    content = accumulated;
  } else {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 16000,
    });
    const msg = response.choices[0]?.message?.content;
    if (!msg || typeof msg !== "string") {
      throw new Error("No content in refine response");
    }
    content = msg;
  }

  const raw = JSON.parse(content) as unknown;
  const parsed = GameConfigSchema.safeParse(raw);

  if (!parsed.success) {
    const fixResponse = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Here is the current game config:\n${JSON.stringify(currentConfig, null, 2)}\n\nThe user wants this change: "${userRequest}"`,
        },
        { role: "assistant", content },
        {
          role: "user",
          content: `Your JSON had validation errors. Fix them and return the corrected FULL JSON:\n${JSON.stringify(parsed.error.errors, null, 2)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 16000,
    });

    const fixContent = fixResponse.choices[0]?.message?.content;
    if (!fixContent || typeof fixContent !== "string") {
      throw new Error("No content in fix response");
    }
    const fixedRaw = JSON.parse(fixContent) as unknown;
    return GameConfigSchema.parse(fixedRaw);
  }

  const logicErrors = validateGameLogic(parsed.data);
  const criticalErrors = logicErrors.filter((e) => e.severity !== "warning");

  if (criticalErrors.length > 0) {
    const fixResponse = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Here is the current game config:\n${JSON.stringify(currentConfig, null, 2)}\n\nThe user wants this change: "${userRequest}"`,
        },
        { role: "assistant", content: JSON.stringify(parsed.data) },
        {
          role: "user",
          content: `Your game config has logic errors. Fix them:\n${JSON.stringify(criticalErrors, null, 2)}\nReturn the corrected FULL JSON.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 16000,
    });

    const fixContent = fixResponse.choices[0]?.message?.content;
    if (!fixContent || typeof fixContent !== "string") {
      throw new Error("No content in logic fix response");
    }
    const fixedRaw = JSON.parse(fixContent) as unknown;
    return GameConfigSchema.parse(fixedRaw);
  }

  return parsed.data;
}
