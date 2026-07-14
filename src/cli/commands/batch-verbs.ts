import type { Command } from "commander";

import type { Author } from "../../protocol.js";
import { fmtGeneral, fmtThread } from "../format.js";
import { out, readPayload, withReview } from "../helpers.js";
import { authorOption } from "../options.js";
import { parseApplyPayload, parseReviewPayload } from "../payload.js";

function registerReview(cmd: Command, defaultAuthor: Author): void {
  cmd
    .command("review")
    .description("submit a whole review at once — many comments in one command (JSON via stdin)")
    .summary("submit many comments in one call (JSON via stdin or --input)")
    .option("--input <path>", "read the JSON payload from a file instead of stdin")
    .option("--json", "output JSON")
    .addOption(authorOption(defaultAuthor))
    .action((o) =>
      withReview(async (r) => {
        const raw = await readPayload(o.input, "remarque agent review < review.json");
        const { comments, general } = parseReviewPayload(raw);
        const res = await r.addBatch({ comments, general, author: o.author });
        const lines = [...res.threads.map(fmtThread), ...res.generalComments.map(fmtGeneral)];
        const n = res.threads.length + res.generalComments.length;
        const human = [`submitted ${n} comment${n === 1 ? "" : "s"}`, ...lines].join("\n");

        out(res, human, !!o.json);
      }),
    );
}

function registerApply(cmd: Command, defaultAuthor: Author): void {
  cmd
    .command("apply")
    .description("reply to and/or resolve many threads at once (JSON via stdin or --input)")
    .summary("batch replies/resolutions across threads (JSON via stdin or --input)")
    .option("--input <path>", "read the JSON payload from a file instead of stdin")
    .option("--json", "output JSON")
    .addOption(authorOption(defaultAuthor))
    .action((o) =>
      withReview(async (r) => {
        const raw = await readPayload(o.input, "remarque agent apply < actions.json");
        const actions = parseApplyPayload(raw);
        const res = await r.applyBatch({ actions, author: o.author });
        const human =
          `applied ${res.applied.length} action${res.applied.length === 1 ? "" : "s"}` +
          (res.notFound.length
            ? `; ${res.notFound.length} id(s) not found: ${res.notFound.join(", ")}`
            : "");

        out(res, human, !!o.json);
      }),
    );
}

export function registerBatchVerbs(cmd: Command, defaultAuthor: Author): void {
  registerReview(cmd, defaultAuthor);
  registerApply(cmd, defaultAuthor);
}
