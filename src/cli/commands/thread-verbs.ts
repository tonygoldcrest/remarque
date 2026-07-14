import type { Command } from "commander";

import type { Author } from "../../protocol.js";
import { fmtGeneral, fmtThread } from "../format.js";
import { int, out, short, withReview } from "../helpers.js";
import { authorOption, sideOption } from "../options.js";

function registerComment(cmd: Command, defaultAuthor: Author): void {
  cmd
    .command("comment")
    .description("create a line-anchored comment thread")
    .requiredOption("--file <path>", "repo-relative file path")
    .requiredOption("--line <n>", "1-based line number", int)
    .option("--end-line <n>", "1-based inclusive end line", int)
    .addOption(sideOption())
    .requiredOption("--body <text>", "comment text")
    .option("--json", "output JSON")
    .addOption(authorOption(defaultAuthor))
    .action((o) =>
      withReview(async (r) => {
        const thread = await r.addComment({
          file: o.file,
          line: o.line,
          endLine: o.endLine,
          side: o.side,
          body: o.body,
          author: o.author,
        });

        out(thread, fmtThread(thread), !!o.json);
      }),
    );
}

function registerGeneralComment(cmd: Command, defaultAuthor: Author): void {
  cmd
    .command("general-comment")
    .description("create a diff-level comment (not tied to a line)")
    .requiredOption("--body <text>", "comment text")
    .option("--json", "output JSON")
    .addOption(authorOption(defaultAuthor))
    .action((o) =>
      withReview(async (r) => {
        const comment = await r.addGeneralComment({ body: o.body, author: o.author });

        out(comment, fmtGeneral(comment), !!o.json);
      }),
    );
}

function registerReply(cmd: Command, defaultAuthor: Author): void {
  cmd
    .command("reply <id>")
    .description("append a message to a thread")
    .requiredOption("--body <text>", "reply text")
    .option("--json", "output JSON")
    .addOption(authorOption(defaultAuthor))
    .action((id, o) =>
      withReview(async (r) => {
        const item = await r.reply(id, { body: o.body, author: o.author });

        out(item, `#${short(item.id)} replied (${item.messages.length} messages)`, !!o.json);
      }),
    );
}

function registerResolve(cmd: Command, defaultAuthor: Author): void {
  cmd
    .command("resolve <id>")
    .description("mark a thread resolved")
    .option("--summary <text>", "what was done")
    .option("--json", "output JSON")
    .addOption(authorOption(defaultAuthor))
    .action((id, o) =>
      withReview(async (r) => {
        const item = await r.resolve(id, { note: o.summary, author: o.author });

        out(item, `#${short(item.id)} resolved`, !!o.json);
      }),
    );
}

function registerDismiss(cmd: Command, defaultAuthor: Author): void {
  cmd
    .command("dismiss <id>")
    .description("mark a thread dismissed (won't fix)")
    .option("--reason <text>", "why")
    .option("--json", "output JSON")
    .addOption(authorOption(defaultAuthor))
    .action((id, o) =>
      withReview(async (r) => {
        const item = await r.dismiss(id, { reason: o.reason, author: o.author });

        out(item, `#${short(item.id)} dismissed`, !!o.json);
      }),
    );
}

function registerReopen(cmd: Command): void {
  cmd
    .command("reopen <id>")
    .description("reopen a resolved or dismissed thread")
    .option("--json", "output JSON")
    .action((id, o) =>
      withReview(async (r) => {
        const item = await r.reopen(id);

        out(item, `#${short(item.id)} reopened`, !!o.json);
      }),
    );
}

export function registerThreadVerbs(cmd: Command, defaultAuthor: Author): void {
  registerComment(cmd, defaultAuthor);
  registerGeneralComment(cmd, defaultAuthor);
  registerReply(cmd, defaultAuthor);
  registerResolve(cmd, defaultAuthor);
  registerDismiss(cmd, defaultAuthor);
  registerReopen(cmd);
}

export function registerDelete(program: Command): void {
  program
    .command("delete <id>")
    .description("permanently delete a comment thread")
    .option("--json", "output JSON")
    .action((id, o) =>
      withReview(async (r) => {
        const removed = await r.deleteThread(id);

        if (!removed) {
          process.stderr.write(`remarque: no thread with id ${id}\n`);
          process.exitCode = 1;

          return;
        }

        out({ id, deleted: true }, `#${short(id)} deleted`, !!o.json);
      }),
    );
}
