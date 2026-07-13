import type { Command } from "commander";

import type { WatchEvent } from "../../protocol";
import type { Review } from "../../review";
import { watchStore } from "../../store/watch";
import { fmtGeneral, fmtThread } from "../format";
import { out, short, withReview } from "../helpers";

function registerState(program: Command): void {
  program
    .command("state")
    .description("full snapshot: session + threads with anchors resolved to current lines")
    .option("--file <path>", "restrict to one file")
    .option("--json", "output JSON")
    .action((o) =>
      withReview(async (r) => {
        const state = await r.state(o.file);
        const human =
          [...state.threads.map(fmtThread), ...state.generalComments.map(fmtGeneral)].join("\n") ||
          "(no comments)";

        out(state, human, !!o.json);
      }),
    );
}

function registerResolveAnchors(program: Command): void {
  program
    .command("resolve-anchors")
    .description("where each thread's anchor lands in the current content")
    .option("--file <path>", "restrict to one file")
    .option("--json", "output JSON")
    .action((o) =>
      withReview(async (r) => {
        const state = await r.state(o.file);
        const rows = state.threads.map((t) => ({
          id: t.id,
          file: t.file,
          side: t.side,
          status: t.status,
          currentLine: t.currentLine,
          currentEndLine: t.currentEndLine,
        }));
        const human =
          rows
            .map(
              (row) =>
                `#${short(row.id)} ${row.file} (${row.side}) -> ${row.currentLine ?? "outdated"} [${row.status}]`,
            )
            .join("\n") || "(no comments)";

        out(rows, human, !!o.json);
      }),
    );
}

async function emitState(review: Review, file?: string): Promise<void> {
  try {
    const event: WatchEvent = {
      type: "change",
      at: new Date().toISOString(),
      state: await review.state(file),
    };

    process.stdout.write(JSON.stringify(event) + "\n");
  } catch {}
}

function registerWatch(program: Command): void {
  program
    .command("watch")
    .description("stream NDJSON state events when the store changes")
    .option("--file <path>", "restrict emitted state to one file")
    .action((o) =>
      withReview(async (r) => {
        await emitState(r, o.file);

        const watcher = watchStore(r.location(), 40, () => void emitState(r, o.file));

        await new Promise<void>((resolve) => {
          process.on("SIGINT", () => {
            watcher.close();
            resolve();
          });
        });
      }),
    );
}

export function registerStateCommands(program: Command): void {
  registerState(program);
  registerResolveAnchors(program);
  registerWatch(program);
}
