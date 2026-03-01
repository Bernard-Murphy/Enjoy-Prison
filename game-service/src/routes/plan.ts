import { Router, Request, Response } from "express";
import { openai } from "../lib/openai";

const router = Router();

const SYSTEM_PROMPT = `You are an expert game designer and developer. You help users create a detailed build plan for a browser game using Phaser (https://docs.phaser.io/). The game MUST be desktop and mobile compatible.

Before generating a plan, decide whether you need to ask clarifying questions (similar to Cursor's Plan mode). Ask for clarification when:
- The request is too vague (e.g. "make a game" with no genre or concept)
- Key details are missing (e.g. core mechanic, theme, scope, or target style)
- The request could reasonably be interpreted in multiple ways and you need to pick one
- You need one or two specific answers to produce a concrete plan

When you need clarification: ask one or two short, focused questions. Do not output a plan yet.
When you have enough information: output a full structured plan.

You MUST start your response with exactly one of these lines, then a blank line, then your content:
- TYPE: clarification
- TYPE: plan

Format for clarification: TYPE: clarification (then a blank line, then your one or two questions).
Format for plan: TYPE: plan (then a blank line, then a structured plan with:
1. Game name and short description (first line: "Name: ...", second line: "Description: ...")
2. Core mechanics and rules
3. Scenes/screens (e.g. menu, play, game over)
4. Assets needed (sprites, backgrounds, sounds - list what to generate)
5. Step-by-step implementation notes for Phaser
Use clear sections and bullet points.)`;

export async function handlePlan(req: Request, res: Response): Promise<void> {
  const { message, planText } = req.body as {
    message?: string;
    planText?: string;
  };
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message required" });
    return;
  }

  if (!openai) {
    res.status(503).json({ error: "OpenAI not configured" });
    return;
  }

  const userContent =
    typeof planText === "string" && planText.trim().length > 0
      ? `Current plan:\n${planText.trim()}\n\nUser requested changes:\n${message}`
      : message;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders();

  try {
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        res.write(text);
        if (
          typeof (res as unknown as { flush?: () => void }).flush === "function"
        ) {
          (res as unknown as { flush: () => void }).flush();
        }
      }
    }
  } catch (err) {
    console.error("Plan error:", err);
    res.write(
      `\n\nError: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  } finally {
    res.end();
  }
}

router.post("/", handlePlan);
export default router;
