---
name: remarque-rereview
description: Re-review whether earlier remarque comments have now been addressed, in the SAME session. Use after you left review comments and the author has since made changes and asks to "re-review", "check if the comments are addressed", "follow up on the review", or "did that get fixed". Reads ALL the comments you raised — including ones already marked resolved, to re-verify them — inspects the current code, resolves newly-addressed threads, reopens any whose fix is missing or got undone, and replies on the ones still outstanding — without starting a new session.
---

# Re-review: has the feedback been addressed?

Use this after you (or another agent) left review comments with remarque and the
author has since changed the code. Your job: check each still-open comment against
the current code and close out the ones that are now handled — all within the
existing session.

**Do not start a new session.** `remarque session start` would abandon the very
comments you are following up on. This skill works entirely off the current
session.

## 1. Load every comment you raised (current session)

```sh
remarque list --author agent --json
```

This returns **all** the threads you opened as the reviewer — open, resolved, and
outdated — each with its current status and `currentLine` re-anchored to the
current file (remarque follows the author's edits). You need the resolved ones too:
`resolved` is only a _claim_ that the concern was handled, and part of re-reviewing
is confirming that claim still holds — and reopening it if it does not.

If it returns nothing, there is no prior review to follow up on — say so and stop.

## 2. Look at the current code

```sh
remarque diff --json
```

This is the whole changed file(s) as they stand now, including the author's latest
edits. Read the code at each comment's `currentLine` before judging it.

## 3. Judge each thread by its status and the current code

Read the code at each thread's `currentLine` and compare it to what you asked for.
Handle the thread according to its current status:

- **open, now addressed** — resolve it, noting what fixed it:

  ```sh
  remarque agent resolve <id> --summary "Done — guard added at line 44."
  ```

- **open, still not addressed / partial** — reply with exactly what is missing and
  leave it open:

  ```sh
  remarque agent reply <id> --body "Still unguarded when items is empty — needs the early return."
  ```

- **resolved, and the fix genuinely holds** — leave it resolved. Optionally add a
  short confirming reply.

- **resolved, but the fix is missing, wrong, or was undone by a later edit** —
  reopen it and say why. This is the whole reason you re-check resolved threads:

  ```sh
  remarque agent reopen <id>
  remarque agent reply <id> --body "Reopening — the guard was removed again in the latest change."
  ```

- **outdated** (the code your comment pointed at is gone) — if the author removed
  the problematic code, that usually resolves the concern; confirm and resolve. If
  it only moved and the issue remains, reply (and reopen if it was resolved).

Verify before you act — never resolve, leave-resolved, or reopen a thread you have
not actually confirmed against the current code.

## 4. Report

Summarize the pass — how many were addressed and resolved, how many are still open,
and what the author still needs to do. Then confirm what remains:

```sh
remarque list --status open --json
```
