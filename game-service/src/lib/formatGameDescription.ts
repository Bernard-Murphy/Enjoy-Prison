import type { GameConfig } from "./dsl/schema";

/**
 * Builds a human-readable markdown description (title, summary, rules, controls)
 * from a GameConfig for display on the game page and in the Plan description view.
 */
export function formatGameDescription(config: GameConfig): string {
  const sections: string[] = [];

  const title =
    config.gameType === "turn-based" && config.turnBased?.common?.title
      ? config.turnBased.common.title
      : (config.meta?.title ?? "Untitled Game");
  const summary =
    config.gameType === "turn-based" && config.turnBased?.common?.description
      ? config.turnBased.common.description
      : (config.meta?.description ?? "");

  sections.push(`## ${title}`);
  if (summary) sections.push(summary);

  // Controls
  if (config.gameType === "turn-based") {
    sections.push("### How to play");
    const common = config.turnBased?.common;
    if (common?.winMessage) sections.push(`- **Win:** ${common.winMessage}`);
    if (common?.drawMessage) sections.push(`- **Draw:** ${common.drawMessage}`);
    if (common?.turnTimeLimit && common.turnTimeLimit > 0) {
      sections.push(`- **Turn time limit:** ${common.turnTimeLimit} seconds`);
    }
    sections.push("\n### Controls");
    sections.push(
      "- Use the on-screen controls or click/tap to make your move.",
    );
  } else {
    const c = config.controls;
    if (c) {
      sections.push("### Controls");
      if (c.up) sections.push(`- **Up:** ${c.up}`);
      if (c.down) sections.push(`- **Down:** ${c.down}`);
      if (c.left) sections.push(`- **Left:** ${c.left}`);
      if (c.right) sections.push(`- **Right:** ${c.right}`);
      if (c.action1) sections.push(`- **Action / Jump:** ${c.action1}`);
      if (c.action2) sections.push(`- **Secondary:** ${c.action2}`);
      if (c.pause) sections.push(`- **Pause:** ${c.pause}`);
    }

    const rules = config.rules;
    if (rules) {
      sections.push("### Rules");
      const win = rules.winCondition?.type;
      if (win) sections.push(`- **Win condition:** ${formatWinCondition(win)}`);
      const lose = rules.loseCondition?.type;
      if (lose)
        sections.push(`- **Lose condition:** ${formatLoseCondition(lose)}`);
      if (rules.scoring?.length) {
        sections.push("- **Scoring:** Points are earned for various actions.");
      }
    }
  }

  return sections.join("\n\n");
}

function formatWinCondition(type: string): string {
  const map: Record<string, string> = {
    "collect-all-keys": "Collect all keys and reach the goal",
    "reach-point": "Reach the goal point",
    "kill-all": "Defeat all enemies",
    "collect-all": "Collect all items",
    "survive-time": "Survive for the required time",
    "n-in-a-row": "Get pieces in a row",
    "most-pieces": "Have the most pieces",
    "empty-hand": "Empty your hand",
    "most-sets": "Collect the most sets",
    "most-cards": "Collect the most cards",
    "closest-target": "Reach the target score",
  };
  return map[type] ?? type;
}

function formatLoseCondition(type: string): string {
  const map: Record<string, string> = {
    "health-zero": "Lose when health reaches zero",
    "lives-zero": "Lose when all lives are lost",
    "timer-expired": "Lose when time runs out",
    "fall-off-screen": "Lose when falling off the screen",
  };
  return map[type] ?? type;
}
