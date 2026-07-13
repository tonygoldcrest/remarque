import type { Command } from "commander";

import { fmtSession } from "../format";
import { out, short, withReview } from "../helpers";

function registerStart(session: Command): void {
  session
    .command("start")
    .description("start a new review session and make it current")
    .option(
      "--base <ref>",
      "base to diff from — a commit SHA, tag, or branch (changes after it)",
      "HEAD",
    )
    .option("--compare <ref>", 'ref to compare, or "WORKING"', "WORKING")
    .option("--json", "output JSON")
    .action((o) =>
      withReview(async (r) => {
        const s = await r.startSession({ base: o.base, compare: o.compare });

        out(s, fmtSession(s), !!o.json);
      }),
    );
}

function registerSwitch(session: Command): void {
  session
    .command("switch <sessionId>")
    .description("make an existing session current (headless; no panel)")
    .option("--json", "output JSON")
    .action((sessionId, o) =>
      withReview(async (r) => {
        const s = await r.switchSession(sessionId);

        out(s, `switched to session ${short(s.id)}: ${s.base}..${s.compare}`, !!o.json);
      }),
    );
}

function registerCurrent(session: Command): void {
  session
    .command("current")
    .description("show the current session")
    .option("--json", "output JSON")
    .action((o) =>
      withReview(async (r) => {
        const s = await r.currentSession();

        out(s, s ? fmtSession(s) : "(no session)", !!o.json);
      }),
    );
}

export function registerSessionCommands(program: Command): void {
  const session = program.command("session").description("manage the review session");

  registerStart(session);
  registerSwitch(session);
  registerCurrent(session);
}

export function registerSessionsList(program: Command): void {
  program
    .command("sessions")
    .description("list all review sessions (id, range, open/total, created)")
    .option("--json", "output JSON")
    .action((o) =>
      withReview(async (r) => {
        const sessions = await r.listSessions();
        const human =
          sessions
            .map(
              (s) =>
                `${s.current ? "*" : " "} ${short(s.session.id)}  ${s.session.base}..${s.session.compare}  ${s.open}/${s.total} open  ${s.session.createdAt}`,
            )
            .join("\n") || "(no sessions — run 'remarque start')";

        out(sessions, human, !!o.json);
      }),
    );
}
