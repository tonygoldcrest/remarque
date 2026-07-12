#!/usr/bin/env node
import { watch as fsWatch, readFileSync } from "node:fs";
import path from "node:path";
import { Command, Option } from "commander";
import { select, input, confirm } from "@inquirer/prompts";

import * as git from "./git";
import { Review } from "./review";
import { handleSkills } from "./skills";
import { SCHEMA_VERSION } from "./protocol";
import type { Author, GeneralComment, ResolvedThread, Thread } from "./protocol";
import {
  resolveStore,
  loadLocalConfig,
  saveLocalConfig,
  loadGlobalConfig,
  globalConfigPath,
  localConfigPath,
  isInsideRepo,
  addToGitignore,
} from "./config";

function readVersion(): string {
  try {
    const pkg = readFileSync(path.join(__dirname, "..", "package.json"), "utf8");
    return (JSON.parse(pkg) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = readVersion();

const int = (v: string) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`expected an integer, got "${v}"`);
  return n;
};

function out(json: unknown, human: string, asJson: boolean): void {
  if (asJson) console.log(JSON.stringify(json));
  else console.log(human);
}

function short(id: string): string {
  return id.slice(0, 8);
}

function fmtThread(t: Thread | ResolvedThread): string {
  const at =
    "currentLine" in t && t.currentLine != null ? `:${t.currentLine}` : `:${t.anchor.line}?`;
  const last = t.messages[t.messages.length - 1];
  return `#${short(t.id)} [${t.status}] ${t.file}${at} (${t.side}) — ${last.author}: ${firstLine(last.body)}`;
}

function fmtGeneral(g: GeneralComment): string {
  const last = g.messages[g.messages.length - 1];
  return `#${short(g.id)} [${g.status}] (general) — ${last.author}: ${firstLine(last.body)}`;
}

function firstLine(s: string): string {
  const nl = s.indexOf("\n");
  return nl === -1 ? s : s.slice(0, nl) + "…";
}

async function withReview(fn: (r: Review) => Promise<void>): Promise<void> {
  try {
    const review = await Review.open();
    await fn(review);
  } catch (e) {
    process.stderr.write(`remarque: ${(e as Error).message}\n`);
    process.exitCode = 1;
  }
}

function addActionVerbs(cmd: Command, defaultAuthor: Author): void {
  const authorOpt = () =>
    new Option("--author <who>", "who is speaking")
      .choices(["human", "agent"])
      .default(defaultAuthor);

  cmd
    .command("comment")
    .description("create a line-anchored comment thread")
    .requiredOption("--file <path>", "repo-relative file path")
    .requiredOption("--line <n>", "1-based line number", int)
    .option("--end-line <n>", "1-based inclusive end line", int)
    .addOption(new Option("--side <side>", "diff side").choices(["new", "old"]).default("new"))
    .requiredOption("--body <text>", "comment text")
    .option("--json", "output JSON")
    .addOption(authorOpt())
    .action((o) =>
      withReview(async (r) => {
        const t = await r.addComment({
          file: o.file,
          line: o.line,
          endLine: o.endLine,
          side: o.side,
          body: o.body,
          author: o.author,
        });
        out(t, fmtThread(t), !!o.json);
      }),
    );

  cmd
    .command("general-comment")
    .description("create a diff-level comment (not tied to a line)")
    .requiredOption("--body <text>", "comment text")
    .option("--json", "output JSON")
    .addOption(authorOpt())
    .action((o) =>
      withReview(async (r) => {
        const g = await r.addGeneralComment({ body: o.body, author: o.author });
        out(g, fmtGeneral(g), !!o.json);
      }),
    );

  cmd
    .command("reply <id>")
    .description("append a message to a thread")
    .requiredOption("--body <text>", "reply text")
    .option("--json", "output JSON")
    .addOption(authorOpt())
    .action((id, o) =>
      withReview(async (r) => {
        const item = await r.reply(id, { body: o.body, author: o.author });
        out(item, `#${short(item.id)} replied (${item.messages.length} messages)`, !!o.json);
      }),
    );

  cmd
    .command("resolve <id>")
    .description("mark a thread resolved")
    .option("--summary <text>", "what was done")
    .option("--json", "output JSON")
    .addOption(authorOpt())
    .action((id, o) =>
      withReview(async (r) => {
        const item = await r.resolve(id, { note: o.summary, author: o.author });
        out(item, `#${short(item.id)} resolved`, !!o.json);
      }),
    );

  cmd
    .command("dismiss <id>")
    .description("mark a thread dismissed (won't fix)")
    .option("--reason <text>", "why")
    .option("--json", "output JSON")
    .addOption(authorOpt())
    .action((id, o) =>
      withReview(async (r) => {
        const item = await r.dismiss(id, { reason: o.reason, author: o.author });
        out(item, `#${short(item.id)} dismissed`, !!o.json);
      }),
    );

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

function addReadVerbs(cmd: Command): void {
  cmd
    .command("list")
    .description("list comment threads")
    .addOption(
      new Option("--status <status>", "filter by status").choices([
        "open",
        "resolved",
        "dismissed",
        "outdated",
      ]),
    )
    .addOption(
      new Option("--author <who>", "filter by who opened the thread").choices(["human", "agent"]),
    )
    .option("--json", "output JSON")
    .action((o) =>
      withReview(async (r) => {
        const state = await r.state();
        const byStatus = <T extends { status: string }>(items: T[]) =>
          o.status ? items.filter((i) => i.status === o.status) : items;
        const byAuthor = <T extends { messages: { author: string }[] }>(items: T[]) =>
          o.author ? items.filter((i) => i.messages[0]?.author === o.author) : items;
        const threads = byAuthor(byStatus(state.threads));
        const general = byAuthor(byStatus(state.generalComments));
        const human =
          [...threads.map(fmtThread), ...general.map(fmtGeneral)].join("\n") || "(no comments)";
        out({ threads, generalComments: general }, human, !!o.json);
      }),
    );

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
        const header =
          "file" in item ? fmtThread(item as Thread) : fmtGeneral(item as GeneralComment);
        const body = item.messages
          .map((m) => `  ${m.author} (${m.at}):\n    ${m.body.replace(/\n/g, "\n    ")}`)
          .join("\n");
        out(item, `${header}\n${body}`, !!o.json);
      }),
    );

  cmd
    .command("diff")
    .description("print the diff the review is over (plain text, or --json per file)")
    .option("--json", "output structured JSON ({ base, compare, files })")
    .argument("[paths...]", "restrict to paths")
    .action((paths, o) =>
      withReview(async (r) => {
        const filter: string[] = paths ?? [];
        if (o.json) {
          const structured = await r.diffFiles();
          const files = filter.length
            ? structured.files.filter((f) => filter.includes(f.file))
            : structured.files;
          out({ ...structured, files }, "", true);
          return;
        }
        console.log(await r.diff(filter));
      }),
    );
}

function buildProgram(): Command {
  const program = new Command();
  program
    .name("remarque")
    .description("Agent- and front-end-agnostic code-review engine")
    .enablePositionalOptions()
    .version(`${VERSION} (schema ${SCHEMA_VERSION})`, "-V, --version");

  addActionVerbs(program, "human");
  addReadVerbs(program);

  const agent = program
    .command("agent")
    .description("agent-facing verbs (author defaults to agent)");
  addActionVerbs(agent, "agent");
  addReadVerbs(agent);

  program
    .command("init")
    .description("configure where this repo's reviews are stored")
    .addOption(new Option("--scope <scope>", "storage scope").choices(["repo", "global"]))
    .option("--dir <path>", "store directory for repo scope")
    .option("--no-gitignore", "do not add the store dir to .gitignore")
    .option("--json", "output JSON")
    .action(async (o) => {
      try {
        const cwd = process.cwd();
        if (!(await git.isRepo(cwd))) throw new Error("not inside a git repository");
        const root = await git.repoRoot(cwd);
        const branch = await git.currentBranch(root);

        let scope: "repo" | "global" | undefined = o.scope;
        let dir: string | undefined = o.dir;
        const interactive = !o.scope && !!process.stdin.isTTY && !!process.stdout.isTTY;

        if (!scope && interactive) {
          const g = loadGlobalConfig();
          scope = await select({
            message: "Where should this repo's reviews be stored?",
            choices: [
              {
                name: "This repo (a folder you choose, default .remarque/)",
                value: "repo" as const,
              },
              {
                name: `Global shared store — ${g.store.dir} (edit ${globalConfigPath()} to change)`,
                value: "global" as const,
              },
            ],
          });
        }
        if (!scope) throw new Error("--scope <repo|global> is required in non-interactive mode");

        if (scope === "repo") {
          if (!dir && interactive) {
            dir = await input({
              message: "Store directory (relative to repo root):",
              default: ".remarque",
            });
          }
          dir = dir || ".remarque";
          saveLocalConfig(root, { store: { scope: "repo", dir } });

          if (o.gitignore !== false && isInsideRepo(root, dir)) {
            const add = interactive
              ? await confirm({ message: `Add ${dir}/ to .gitignore?`, default: true })
              : true;
            if (add && addToGitignore(root, dir) && !o.json) {
              console.log(`added ${dir}/ to .gitignore`);
            }
          }
        } else {
          saveLocalConfig(root, { store: { scope: "global" } });
        }

        const resolved = resolveStore(root, branch);
        const review = await Review.open({ cwd: root });
        const session =
          (await review.currentSession()) ?? (await review.startSession({ base: "HEAD" }));

        if (o.json) {
          console.log(JSON.stringify({ config: localConfigPath(root), store: resolved, session }));
        } else {
          console.log(`initialized ${scope} store`);
          console.log(`  config: ${localConfigPath(root)}`);
          console.log(`  store:  ${resolved.file}`);
        }
      } catch (e) {
        process.stderr.write(`remarque: ${(e as Error).message}\n`);
        process.exitCode = 1;
      }
    });

  program
    .command("config")
    .description("show resolved store config and file locations")
    .option("--json", "output JSON")
    .action(async (o) => {
      try {
        const cwd = process.cwd();
        if (!(await git.isRepo(cwd))) throw new Error("not inside a git repository");
        const root = await git.repoRoot(cwd);
        const branch = await git.currentBranch(root);
        const resolved = resolveStore(root, branch);
        const local = loadLocalConfig(root);
        const payload = {
          scope: resolved.scope,
          source: resolved.source,
          storeDir: resolved.dir,
          storeFile: resolved.file,
          localConfig: local ? localConfigPath(root) : null,
          globalConfig: globalConfigPath(),
        };
        if (o.json) {
          console.log(JSON.stringify(payload));
        } else {
          console.log(`scope:         ${payload.scope} (from ${payload.source})`);
          console.log(`store file:    ${payload.storeFile}`);
          console.log(`local config:  ${payload.localConfig ?? "(none — run 'review init')"}`);
          console.log(`global config: ${payload.globalConfig}`);
        }
      } catch (e) {
        process.stderr.write(`remarque: ${(e as Error).message}\n`);
        process.exitCode = 1;
      }
    });

  const session = program.command("session").description("manage the review session");
  session
    .command("start")
    .description("start a new review session and make it current")
    .option("--base <ref>", "base ref to diff from", "HEAD")
    .option("--compare <ref>", 'ref to compare, or "WORKING"', "WORKING")
    .option("--json", "output JSON")
    .action((o) =>
      withReview(async (r) => {
        const s = await r.startSession({ base: o.base, compare: o.compare });
        out(s, `session ${short(s.id)} on ${s.branch}: ${s.base}..${s.compare}`, !!o.json);
      }),
    );
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
  session
    .command("current")
    .description("show the current session")
    .option("--json", "output JSON")
    .action((o) =>
      withReview(async (r) => {
        const s = await r.currentSession();
        out(
          s,
          s ? `session ${short(s.id)} on ${s.branch}: ${s.base}..${s.compare}` : "(no session)",
          !!o.json,
        );
      }),
    );

  const openPanel = async (review: Review) => {
    const { runApp } = await import("./tui/app");
    await runApp(review);
  };

  program
    .command("start")
    .alias("s")
    .description("start a NEW review session and open the interactive panel")
    .option("--base <ref>", "base ref to diff from", "HEAD")
    .option("--compare <ref>", 'ref to compare, or "WORKING"', "WORKING")
    .action(async (o) => {
      try {
        if (!process.stdout.isTTY)
          throw new Error("remarque start needs an interactive terminal (TTY)");
        const review = await Review.open();
        await review.startSession({ base: o.base, compare: o.compare });
        await openPanel(review);
      } catch (e) {
        process.stderr.write(`remarque: ${(e as Error).message}\n`);
        process.exitCode = 1;
      }
    });

  program
    .command("continue [sessionId]")
    .alias("c")
    .description("resume the latest session (or a specific one) and open the panel")
    .action(async (sessionId?: string) => {
      try {
        if (!process.stdout.isTTY)
          throw new Error("remarque continue needs an interactive terminal (TTY)");
        const review = await Review.open();
        if (sessionId) await review.switchSession(sessionId);
        else await review.resumeLast();
        await openPanel(review);
      } catch (e) {
        process.stderr.write(`remarque: ${(e as Error).message}\n`);
        process.exitCode = 1;
      }
    });

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

  program
    .command("skills [args...]")
    .description("install remarque's review skills into your agents (wraps npx skills)")
    .passThroughOptions()
    .allowUnknownOption(true)
    .helpOption(false)
    .action((args: string[]) => {
      process.exitCode = handleSkills(args ?? []);
    });

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

  program
    .command("watch")
    .description("stream NDJSON state events when the store changes")
    .option("--file <path>", "restrict emitted state to one file")
    .action((o) =>
      withReview(async (r) => {
        const file = r.location();
        const dir = path.dirname(file);
        const base = path.basename(file);

        const emit = async () => {
          try {
            const state = await r.state(o.file);
            process.stdout.write(
              JSON.stringify({ type: "change", at: new Date().toISOString(), state }) + "\n",
            );
          } catch {}
        };

        await emit();
        let timer: NodeJS.Timeout | null = null;
        const watcher = fsWatch(dir, (_event, filename) => {
          if (filename && filename.toString() !== base) return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(emit, 40);
        });
        await new Promise<void>((resolve) => {
          process.on("SIGINT", () => {
            watcher.close();
            resolve();
          });
        });
      }),
    );

  return program;
}

buildProgram().parseAsync(process.argv);
