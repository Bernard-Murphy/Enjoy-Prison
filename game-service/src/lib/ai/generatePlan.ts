import { openai } from "../openai";
import { GameConfigSchema } from "../dsl/schema";
import type { GameConfig } from "../dsl/schema";
import { validateGameLogic } from "../dsl/validate";
import { PLAN_SYSTEM_PROMPT } from "./planPrompt";

export type PlanResult =
  | { type: "clarification"; content: string }
  | { type: "plan"; config: GameConfig };

export async function generatePlan(
  userDescription: string,
  options?: {
    onChunk?: (accumulatedText: string) => void | Promise<void>;
    onEnd?: (accumulatedText: string) => void | Promise<void>;
  },
): Promise<PlanResult> {
  if (!openai) {
    throw new Error("OpenAI not configured");
  }

  console.log("[generatePlan] Starting", {
    userMessageLength: userDescription.length,
    streaming: !!options?.onChunk,
  });

  let content: string;

  if (options?.onChunk) {
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        { role: "user", content: userDescription },
      ],
      temperature: 0.7,
      max_tokens: 8000,
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
        { role: "user", content: userDescription },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    });
    const msg = response.choices[0]?.message?.content;
    if (!msg || typeof msg !== "string") {
      throw new Error("No content in plan response");
    }
    content = msg;
  }

  const contentLength = content.length;
  const snippet = (s: string, head = 400, tail = 200) =>
    s.length <= head + tail
      ? s
      : `${s.slice(0, head)}\n... [${s.length - head - tail} chars omitted] ...\n${s.slice(-tail)}`;

  let wrapper: { type?: string; content?: unknown };
  try {
    wrapper = JSON.parse(content) as { type?: string; content?: unknown };
  } catch (parseErr) {
    console.error("[generatePlan] Plan response was not valid JSON", {
      contentLength,
      parseError:
        parseErr instanceof Error ? parseErr.message : String(parseErr),
      contentSnippet: snippet(content),
    });
    throw new Error("Plan response was not valid JSON");
  }

  console.log("[generatePlan] Parsed wrapper", {
    type: wrapper.type,
    hasContent: wrapper.content != null,
    contentKeys:
      wrapper.content &&
      typeof wrapper.content === "object" &&
      !Array.isArray(wrapper.content)
        ? Object.keys(wrapper.content as object)
        : undefined,
  });

  if (wrapper.type === "clarification" && typeof wrapper.content === "string") {
    return { type: "clarification", content: wrapper.content };
  }

  if (
    wrapper.type === "plan" &&
    wrapper.content !== null &&
    typeof wrapper.content === "object"
  ) {
    const raw = wrapper.content;
    const parsed = GameConfigSchema.safeParse(raw);

    if (!parsed.success) {
      // Retry: send validation errors back to the AI
      const fixResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PLAN_SYSTEM_PROMPT },
          { role: "user", content: userDescription },
          { role: "assistant", content },
          {
            role: "user",
            content: `Your game config had validation errors. Return the same wrapper format: { "type": "plan", "content": <corrected full game config object> }\nErrors:\n${JSON.stringify(parsed.error.errors, null, 2)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      });

      const fixContent = fixResponse.choices[0]?.message?.content;
      if (!fixContent || typeof fixContent !== "string") {
        throw new Error("No content in fix response");
      }
      const fixWrapper = JSON.parse(fixContent) as {
        type?: string;
        content?: unknown;
      };
      if (
        fixWrapper.type === "plan" &&
        fixWrapper.content != null &&
        typeof fixWrapper.content === "object"
      ) {
        return {
          type: "plan",
          config: GameConfigSchema.parse(fixWrapper.content),
        };
      }
      throw new Error("Fix response did not return valid plan config");
    }

    // Run game logic validation
    const logicErrors = validateGameLogic(parsed.data);
    const criticalErrors = logicErrors.filter((e) => e.severity !== "warning");

    if (criticalErrors.length > 0) {
      const fixResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PLAN_SYSTEM_PROMPT },
          { role: "user", content: userDescription },
          { role: "assistant", content },
          {
            role: "user",
            content: `Your game config has logic errors. Return the same wrapper format: { "type": "plan", "content": <corrected full game config object> }\nErrors:\n${JSON.stringify(criticalErrors, null, 2)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      });

      const fixContent = fixResponse.choices[0]?.message?.content;
      if (!fixContent || typeof fixContent !== "string") {
        throw new Error("No content in logic fix response");
      }
      const fixWrapper = JSON.parse(fixContent) as {
        type?: string;
        content?: unknown;
      };
      if (
        fixWrapper.type === "plan" &&
        fixWrapper.content != null &&
        typeof fixWrapper.content === "object"
      ) {
        return {
          type: "plan",
          config: GameConfigSchema.parse(fixWrapper.content),
        };
      }
      throw new Error("Logic fix response did not return valid plan config");
    }

    return { type: "plan", config: parsed.data };
  }

  // AI returned something else; treat as plan attempt and try parsing root as config
  const parsed = GameConfigSchema.safeParse(wrapper);
  if (parsed.success) {
    const logicErrors = validateGameLogic(parsed.data);
    const criticalErrors = logicErrors.filter((e) => e.severity !== "warning");
    if (criticalErrors.length === 0) {
      return { type: "plan", config: parsed.data };
    }
  }
  throw new Error(
    "Plan response had invalid format: expected { type: 'clarification'|'plan', content: ... }",
  );
}
