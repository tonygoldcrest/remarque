import type { Command } from "commander";

import type { GeneralComment, Thread } from "../../protocol.js";
import { fmtGeneral, fmtThread } from "../format.js";
import { out, withReview } from "../helpers.js";
import { authorFilterOption, statusFilterOption } from "../options.js";

function byStatus<T extends { status: string }>(items: T[], status?: string): T[] {
  return status ? items.filter((item) => item.status === status) : items;
}

function byAuthor<T extends { messages: { author: string }[] }>(items: T[], author?: string): T[] {
  return author ? items.filter((item) => item.messages[0]?.author === author) : items;
}

function registerList(cmd: Command): void {
  cmd
    .command("list")
    .description("list comment threads")
    .addOption(statusFilterOption())
    .addOption(authorFilterOption())
    .option("--json", "output JSON")
    .action((o) =>
      withReview(async (r) => {
        const state = await r.state();
        const threads = byAuthor(byStatus(state.threads, o.status), o.author);
        const general = byAuthor(byStatus(state.generalComments, o.status), o.author);
        const human =
          [...threads.map(fmtThread), ...general.map(fmtGeneral)].join("\n") || "(no comments)";

        out({ threads, generalComments: general }, human, !!o.json);
      }),
    );
}

function fmtConversation(item: Thread | GeneralComment): string {
  const header = "file" in item ? fmtThread(item as Thread) : fmtGeneral(item as GeneralComment);
  const body = item.messages
    .map((m) => `  ${m.author} (${m.at}):\n    ${m.body.replace(/\n/g, "\n    ")}`)
    .join("\n");

  return `${header}\n${body}`;
}

function registerShow(cmd: Command): void {
  cmd
    .command("show <id>")
    .description("show a thread with its full conversation")
    .option("--json", "output JSON")
    .action((id, o) =>
      withReview(async (r) => {
        const item = await r.getItem(id);

        if (!item) {
          process.stderr.write(`remarque: no thread with id ${id}\n`);
          process.exitCode = 1;

          return;
        }

        out(item, fmtConversation(item), !!o.json);
      }),
    );
}

function registerDiff(cmd: Command): void {
  cmd
    .command("diff")
    .description("print the diff the review is over (plain text, or --json per file)")
    .option("--json", "output structured JSON ({ base, compare, files })")
    .option("--whole", "include full-file context instead of just the changed hunks")
    .argument("[paths...]", "restrict to paths")
    .action((paths, o) =>
      withReview(async (r) => {
        const filter: string[] = paths ?? [];

        if (!o.json) {
          console.log((await r.diff(filter)).trimEnd());

          return;
        }

        const structured = await r.diffFiles({ whole: !!o.whole });
        const files = filter.length
          ? structured.files.filter((f) => filter.includes(f.file))
          : structured.files;

        out({ ...structured, files }, "", true);
      }),
    );
}

export function registerReadVerbs(cmd: Command): void {
  registerList(cmd);
  registerShow(cmd);
  registerDiff(cmd);
}
