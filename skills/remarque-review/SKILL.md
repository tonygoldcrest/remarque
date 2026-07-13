---
name: remarque-review
description: Perform a code review of the current diff with remarque and leave line-anchored comments. Use when the user asks you to "review the diff/changes/PR", "leave review comments", or "critique these changes" using remarque. Reads the diff, reasons about correctness and quality, and records specific, line-anchored comments the author (or an agent) can then address.
---

# Review a diff with remarque

`remarque` stores line-anchored review comments over the current diff. In this
skill you act as the reviewer: read the changes, reason about them like a careful
engineer, and leave specific, actionable comments anchored to exact lines.

## 1. Start a fresh review session

Each review you run is its own session, so **always start a new one** before
commenting — this keeps this review's comments separate from any earlier round:

```sh
remarque session start --base HEAD
```

The default range is `HEAD..WORKING` (the current uncommitted changes). `--base`
takes any ref, so you can review:

- an entire feature branch — `--base main` (or `--base origin/main`)
- everything since a specific commit — `--base <commit-sha>` reviews the changes
  made _after_ that commit; use `--base <commit-sha>~1` to include the commit
  itself. This is what "review changes from this commit onwards" means.

## 2. Read the diff

```sh
remarque diff --json
```

Each file entry gives the changed hunks with line numbers on each side (`old` =
base, `new` = working tree), plus any brand-new untracked files. Read the whole
diff before commenting so your comments account for context and you don't repeat
yourself across files.

`diff --json` returns just the changed hunks, which is compact. If the diff is
still large, read it a file at a time instead of loading everything at once —
`remarque diff --json <path>` restricts output to one file. Do **not** shell out
to another language to slice the JSON; fetch per file.

## 3. Review for real

Go beyond style. For each change, ask:

- **Correctness** — does it do what it intends? Off-by-one, null/undefined,
  empty-collection, and boundary cases. Error paths and early returns.
- **Behavior under load/edge input** — concurrency, ordering, large or malformed
  input, resource cleanup.
- **Regressions** — does this break an existing caller or contract? Check the
  `old` side to see what was removed.
- **Simplicity** — duplicated logic, dead code, something the codebase already
  provides.
- **Tests** — is the new behavior covered? Call out gaps.

Prefer a few high-value comments over many trivial ones.

## 4. Comment on specific lines

Anchor each comment to the exact line it is about — the `new` side for
added/changed code, the `old` side for something being removed. Use the
`remarque agent` verbs so your comments are attributed to the agent, not a human:

```sh
remarque agent comment --file src/app.ts --line 42 --side new --body "This throws when items is empty — guard it?"
remarque agent comment --file src/app.ts --line 60 --end-line 68 --body "Extract this into a helper; it is duplicated below."
```

- Always use `remarque agent comment` (not plain `remarque comment`) — the plain
  verb records the comment as `human`.
- `--line` (and optional `--end-line`) are line numbers on that side.
- Keep each comment to one concern, phrased as an actionable question or
  suggestion, so it can be addressed one thread at a time.
- For feedback not tied to a line, use a diff-level comment:

  ```sh
  remarque agent general-comment --body "Needs tests for the retry path before this can merge."
  ```

## 5. Confirm

```sh
remarque list
```

Lists every thread you left. The author can now address them — and an agent can
use the companion `remarque-address` skill to reply and resolve them inline.

## Following up

When the author has made changes and asks you to re-review whether your comments
are addressed, **do not run this skill again** (it starts a fresh session). Use the
`remarque-rereview` skill instead — it checks your existing open comments against
the updated code in the same session and resolves the ones now handled.
