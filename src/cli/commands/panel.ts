import type { Command } from "commander";

import { Review } from "../../review/index.js";
import { guarded } from "../helpers.js";

async function openPanel(review: Review): Promise<void> {
  const { runApp } = await import("../../tui/app/index.js");

  await runApp(review);
}

function ensureInteractive(command: string): void {
  if (!process.stdout.isTTY) {
    throw new Error(`remarque ${command} needs an interactive terminal (TTY)`);
  }
}

function registerStart(program: Command): void {
  program
    .command("start")
    .alias("s")
    .description("start a NEW review session and open the interactive panel")
    .option(
      "--base <ref>",
      "base to diff from — a commit SHA, tag, or branch (changes after it)",
      "HEAD",
    )
    .option("--compare <ref>", 'ref to compare, or "WORKING"', "WORKING")
    .action(
      guarded(async (o: { base: string; compare: string }) => {
        ensureInteractive("start");

        const review = await Review.open();

        await review.startSession({ base: o.base, compare: o.compare });
        await openPanel(review);
      }),
    );
}

function registerContinue(program: Command): void {
  program
    .command("continue [sessionId]")
    .alias("c")
    .description("resume the latest session (or a specific one) and open the panel")
    .action(
      guarded(async (sessionId?: string) => {
        ensureInteractive("continue");

        const review = await Review.open();

        if (sessionId) {
          await review.switchSession(sessionId);
        } else {
          await review.resumeLast();
        }

        await openPanel(review);
      }),
    );
}

export function registerPanelCommands(program: Command): void {
  registerStart(program);
  registerContinue(program);
}
