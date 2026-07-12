---
name: remarque-address
description: Address open code-review comments left with remarque. Use when the user asks to "address the review", "resolve the review comments", "handle the remarque comments", or points you at review threads on the current diff. Reads each open thread anchored to the current code, makes the fix, replies inline, and resolves it.
---

# Address remarque review comments

`remarque` is a CLI that stores line-anchored review comments over the current
diff. In this skill you act as the developer responding to a review: take the open
comment threads, fix the code they ask about, answer inline, and resolve them.

## 1. Read the open threads (full detail, machine-readable)

```sh
remarque list --status open --json
```

This is the one command you need: it returns **only the open threads**, each in
full — no resolved-thread noise, no truncated bodies. For each thread:

- `id` — the thread id (use it in the reply/resolve commands below).
- `file`, `side` (`new` = working tree, `old` = base), and `currentLine` /
  `currentEndLine` — where the comment is anchored **in the current file**.
  remarque re-anchors comments as code moves, so trust `currentLine`, not the
  original line number.
- `status` — `open` here; `outdated` (code gone) is filtered out, see below.
- `messages` — the full conversation, untruncated; the first message is the
  reviewer's comment, and later ones are the back-and-forth.

Note: plain `remarque list` (no `--json`) prints one-line summaries with truncated
bodies — fine for a human glance, but use `--json` whenever you need to actually
read and act on the comments. There is no need to fall back to `state --json` and
filter it yourself.

## 2. Fix each thread

For every open thread:

1. Open `file` at `currentLine` and read enough surrounding context to understand
   the comment.
2. Make the change it asks for. If you disagree or it is out of scope, that is
   fine — you will say so when you reply instead of forcing a change.

## 3. Reply and resolve

Reply as the agent, then resolve with a short summary of what you did:

```sh
remarque agent reply <id> --body "Guarded the null case and added a test."
remarque agent resolve <id> --summary "added guard + test"
```

Use the `remarque agent` verbs (not the plain ones) so the message is attributed
to the agent.

If you decide **not** to make the change, explain why in a reply and dismiss the
thread instead of resolving it:

```sh
remarque agent reply <id> --body "Leaving as-is: this path is unreachable because …"
remarque agent dismiss <id> --reason "not applicable"
```

## Outdated threads

`--status open` excludes threads whose anchored code no longer exists — those show
as `outdated`. Check for them separately:

```sh
remarque list --status outdated --json
```

For each, read the thread's original snippet to see what it was about, address the
underlying concern if it still applies, and reply explaining that the code has
since changed. Resolve or dismiss as appropriate.

## Finish

```sh
remarque list --status open
```

An empty result means the review is fully addressed.
