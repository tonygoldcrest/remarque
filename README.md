# remarque

An agent- and front-end-agnostic code-review engine. It stores line-anchored
comment threads and lets an AI agent answer inline and resolve them — the core of
a "the agent that made the change also addresses the review" loop — behind a plain
CLI/JSON contract that any agent and any front-end can drive.

- **Agent-agnostic** — any agent that can run a shell command drives the loop.
- **Front-end-agnostic** — the store is the contract; build a Neovim, web, or TUI
  front-end on the same JSON.
- **Stable anchoring** — comments are pinned to content (blob sha + surrounding
  lines), so they follow edits instead of drifting, and are marked `outdated` when
  their content is gone.
- **Pure JS** — no native binaries; shells out to the system `git`.

## Install

```sh
npm install -g remarque   # or: npx remarque <command>
```

## The loop

```sh
remarque init                               # choose where reviews are stored (optional)
remarque session start --base HEAD          # what the review is over
remarque comment --file src/app.ts --line 42 --body "why the null check?"
remarque list                               # human reviews / triages
remarque agent list --json                  # agent reads open threads
remarque agent reply <id> --body "fixed"    # agent answers inline
remarque agent resolve <id> --summary "added guard"
remarque resolve-anchors                    # where each comment lands now
```

## Sessions

A **session** is one review pass over a `base..compare` range. `remarque start`
(or `remarque session start`) begins a new one and makes it current; every comment
belongs to the current session. Starting another session gives a clean slate
without losing the old one — `remarque sessions` lists them all, and
`remarque continue <id>` / `remarque session switch <id>` move between them. This
is branch-independent, so it works even when you do everything on one branch.

## Interactive panel

`remarque start` begins a **new** review session and opens the panel;
`remarque continue` reopens your most recent session (or `remarque continue <id>`
a specific one). Changed files sit on the left, the selected file's side-by-side
diff on the right, comment threads inline at their (re-anchored) lines. It
live-updates as the store changes, so an agent's reply or resolve appears while
you watch.

```
Tab      switch focus between the Files, removed, and added panes
↑ ↓      move — by file in Files; by comment/line in the diff. A comment clipped
         by the window edge pages fully into view before the cursor advances, and
         a comment taller than the window scrolls through in window-sized chunks.
]c / [c  jump to the next / previous change block
]t / [t  jump to the next / previous comment thread
c        comment on the focused diff line — or, on a thread, add a reply (appended
         to the end of the thread)
r / x    resolve / dismiss the selected thread
o        reopen a resolved or dismissed thread
d        delete the selected thread (asks y/N)
^R       reload the diff
q        quit
```

Each thread is framed by separator rules and its header line carries a status icon
— `●` open, a green `✓` resolved, `✕` dismissed — then the author (bold) and the
comment. Replies are indented continuation lines under the same frame; two separate
comments on the same line render as two distinctly framed blocks. The cursor
highlights one comment at a time.

## Command surface

Human verbs live at the top level (`--author` defaults to `human`); the same verbs
under `remarque agent …` default `--author agent`.

| Verb                                                        | Purpose                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `comment` / `general-comment`                               | create a line / diff-level thread                                 |
| `reply` / `resolve` / `dismiss` / `reopen`                  | append, close, drop, or reopen a thread                           |
| `delete <id>`                                               | permanently remove a thread                                       |
| `list` / `show` / `diff`                                    | read threads and the diff                                         |
| `start`                                                     | start a **new** session and open the panel                        |
| `continue [id]`                                             | resume the latest (or a specific) session in the panel            |
| `sessions`                                                  | list all sessions (range, open/total, created, which is current)  |
| `session start` / `session switch <id>` / `session current` | manage sessions headlessly                                        |
| `state`                                                     | full snapshot with anchors resolved to current lines (front-ends) |
| `resolve-anchors`                                           | current line of each thread, or `outdated`                        |
| `watch`                                                     | NDJSON stream of state on every store change (front-ends)         |
| `skills add`                                                | install remarque's review skills into your agents                 |
| `init`                                                      | choose where this repo's reviews are stored (repo or global)      |
| `config`                                                    | show the resolved store scope and config/file locations           |

Every verb accepts `--json`; those shapes and the store schema are the versioned
protocol (`schemaVersion`).

## Storage & configuration

Reviews are JSON, one file per repo + branch. Where that file lives is decided by
config, resolved in order:

1. `REMARQUE_STORE_DIR` environment variable (overrides everything).
2. A **local `remarque.config.json`** at the repo root, written by `remarque init`:
   - `{ "store": { "scope": "repo", "dir": ".remarque" } }` — a folder you choose,
     inside or outside the repo. `init` offers to add it to `.gitignore` when it
     lives inside the repo.
   - `{ "store": { "scope": "global" } }` — defer to the global store below.
3. The **global `remarque.config.json`** in the platform config dir
   (`remarque config` prints its path), auto-created on first use as
   `{ "store": { "dir": "<platform data dir>" } }`. Change the global location by
   editing this file. The global store keys each repo into its own subfolder.

Writes are atomic and lock-guarded, so an agent and a front-end can write
concurrently. A git-objects backend (reviews that travel with the repo) can be
added behind the same `StorageBackend` interface without changing the CLI or
protocol.

## Library

Front-ends can embed the engine instead of shelling out:

```ts
import { Review } from "remarque";

const review = await Review.open({ cwd });
const state = await review.state();
```

## License

MIT.
