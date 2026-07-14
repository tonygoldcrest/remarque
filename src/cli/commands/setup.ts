import type { Command } from "commander";
import { Option } from "commander";
import { confirm, input, select } from "@inquirer/prompts";

import * as git from "../../git/index.js";
import { Review } from "../../review/index.js";
import { handleSkills } from "../../skills.js";
import {
  addToGitignore,
  globalConfigPath,
  isInsideRepo,
  loadGlobalConfig,
  loadLocalConfig,
  localConfigPath,
  resolveStore,
  saveLocalConfig,
  type StoreScope,
} from "../../config/index.js";
import { guarded } from "../helpers.js";

interface InitOptions {
  scope?: StoreScope;
  dir?: string;
  gitignore?: boolean;
  json?: boolean;
}

async function repoContext(): Promise<{ root: string; branch: string }> {
  const info = await git.repoInfo(process.cwd());

  if (!info) {
    throw new Error("not inside a git repository");
  }

  return { root: info.root, branch: info.branch };
}

async function promptScope(): Promise<StoreScope> {
  const global = loadGlobalConfig();

  return select({
    message: "Where should this repo's reviews be stored?",
    choices: [
      {
        name: "This repo (a folder you choose, default .remarque/)",
        value: "repo" as const,
      },
      {
        name: `Global shared store — ${global.store.dir} (edit ${globalConfigPath()} to change)`,
        value: "global" as const,
      },
    ],
  });
}

async function configureRepoStore(
  root: string,
  opts: InitOptions,
  interactive: boolean,
): Promise<void> {
  let dir = opts.dir;

  if (!dir && interactive) {
    dir = await input({
      message: "Store directory (relative to repo root):",
      default: ".remarque",
    });
  }

  dir = dir || ".remarque";

  saveLocalConfig(root, { store: { scope: "repo", dir } });

  if (opts.gitignore === false || !isInsideRepo(root, dir)) {
    return;
  }

  const add = interactive
    ? await confirm({ message: `Add ${dir}/ to .gitignore?`, default: true })
    : true;

  if (add && addToGitignore(root, dir) && !opts.json) {
    console.log(`added ${dir}/ to .gitignore`);
  }
}

function registerInit(program: Command): void {
  program
    .command("init")
    .description("configure where this repo's reviews are stored")
    .addOption(new Option("--scope <scope>", "storage scope").choices(["repo", "global"]))
    .option("--dir <path>", "store directory for repo scope")
    .option("--no-gitignore", "do not add the store dir to .gitignore")
    .option("--json", "output JSON")
    .action(
      guarded(async (o: InitOptions) => {
        const { root, branch } = await repoContext();
        const interactive = !o.scope && !!process.stdin.isTTY && !!process.stdout.isTTY;
        const scope = o.scope ?? (interactive ? await promptScope() : undefined);

        if (!scope) {
          throw new Error("--scope <repo|global> is required in non-interactive mode");
        }

        if (scope === "repo") {
          await configureRepoStore(root, o, interactive);
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
          console.log(`  store:  ${resolved.dir}`);
        }
      }),
    );
}

function registerConfig(program: Command): void {
  program
    .command("config")
    .description("show resolved store config and file locations")
    .option("--json", "output JSON")
    .action(
      guarded(async (o: { json?: boolean }) => {
        const { root, branch } = await repoContext();
        const resolved = resolveStore(root, branch);
        const local = loadLocalConfig(root);
        const payload = {
          scope: resolved.scope,
          source: resolved.source,
          storeDir: resolved.dir,
          localConfig: local ? localConfigPath(root) : null,
          globalConfig: globalConfigPath(),
        };

        if (o.json) {
          console.log(JSON.stringify(payload));
        } else {
          console.log(`scope:         ${payload.scope} (from ${payload.source})`);
          console.log(`store dir:     ${payload.storeDir}`);
          console.log(`local config:  ${payload.localConfig ?? "(none — run 'review init')"}`);
          console.log(`global config: ${payload.globalConfig}`);
        }
      }),
    );
}

function registerSkills(program: Command): void {
  program
    .command("skills [args...]")
    .description("install remarque's review skills into your agents (wraps npx skills)")
    .passThroughOptions()
    .allowUnknownOption(true)
    .helpOption(false)
    .action((args: string[]) => {
      process.exitCode = handleSkills(args ?? []);
    });
}

export function registerSetupCommands(program: Command): void {
  registerInit(program);
  registerConfig(program);
  registerSkills(program);
}
