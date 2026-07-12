# remarque

remarque is a terminal UI for reviewing uncommitted changes, built for working with
AI coding agents. You get a pull-request-style review over your working diff: a
side-by-side view where you can leave comments on specific lines, and the agent that
wrote the code reads them, makes fixes, and replies inline. You can also run it in
the other direction and have an agent review your diff before you push.

It works with any agent that can run shell commands (Claude Code, for example),
and it's a plain npm package with no native binaries.

## What makes it different

There are plenty of tools that show you a nice diff of what your agent just did,
and some let you jot down notes for the agent to pick up when you close the
viewer. remarque treats the review as a conversation instead. A comment is a
thread with a state (open, resolved, or dismissed), you and the agent both write
into the same review, the panel updates live while the agent works, and the whole
exchange is saved as a session you can reopen later.

Two design choices follow from that:

- Comments are anchored to the content they describe (a blob sha plus the
  surrounding lines), not to line numbers. The agent will keep editing the files
  your comments sit on, so comments have to move with the code. When the code a
  comment refers to is gone entirely, it's marked outdated rather than left
  pointing at the wrong line.
- The review itself lives in a small CLI with a documented JSON contract, and the
  TUI is just one front end for it. Any agent that can run shell commands can
  drive a review, and you can build your own front end (web, Neovim) over the
  same data.

## Install

```sh
npm install -g remarque
```

## Agent setup

remarque talks to your agent through three skills. Install them once:

```sh
remarque skills add
```

You'll be asked which agent to install into. The three skills are
`remarque-review` (the agent reviews your diff and leaves comments),
`remarque-address` (the agent fixes and replies to comments you left), and
`remarque-rereview` (the agent checks whether earlier comments have been handled).

## Usage

The basic loop is the same in both directions: someone leaves comments on the
diff, the other side answers them, and you go back and forth in the same review
until every thread is resolved. Then you commit or push.

### Reviewing your agent's changes

Say your agent just edited some files and you want to look before committing.

Open a review over the uncommitted diff:

```sh
remarque start
```

Scroll with the arrow keys and press `c` on any line to leave a comment or a
question. You can mark comments resolved (`r`) or dismissed (`x`) as you go, and
`q` quits with everything saved.

Then hand it back to the agent by telling it:

> address the remarque comments

It reads each comment, makes the fix, replies inline, and resolves the thread. If
you keep the panel open (or reopen it with `remarque continue`) you'll see the
replies land live. Once everything is resolved, commit.

### Getting a review from the agent

The reverse flow. Tell your agent:

> review my changes with remarque

It reads your diff and leaves line-anchored comments where it has concerns. Open
the panel to read them:

```sh
remarque continue
```

Reply with `c` and resolve with `r`. After you've made fixes, ask the agent to

> re-review

and it will confirm which comments are handled, resolve those, and reopen anything
that's still broken. Push when you're happy with the result.

## Panel keys

```
↑ ↓      move between comments and lines
Tab      switch pane (files · removed · added)
c        comment on a line, or reply to the selected comment
r  x     resolve / dismiss the selected comment
o        reopen a resolved or dismissed comment
d        delete a comment (asks y/N)
]c  [c   jump to next / previous changed block
]t  [t   jump to next / previous comment thread
^R       reload      q  quit
```

The panel live-updates, so your agent's replies and resolves appear while you
watch. A comment taller than the screen scrolls into view as you move onto it.

## Sessions

Each review is a session. `remarque start` begins a new one and `remarque continue`
reopens the last. Older sessions stick around:

```sh
remarque sessions            # list them
remarque continue <id>       # jump back into a specific one
```

Sessions are independent of git branches, so this works even if you do everything
on one branch.

## Where reviews are stored

Reviews are saved as JSON outside your repo by default, so nothing touches your
working tree. `remarque config` prints the exact path. To change it, run
`remarque init` (choose a repo folder or the global store) or set
`REMARQUE_STORE_DIR`.

## Command reference

Most of the time you only need `remarque start` / `continue` and the panel keys
above. The rest exists for scripting and for agents.

Review commands: `comment`, `general-comment`, `reply`, `resolve`, `dismiss`,
`reopen`, `delete`, `list`, `show`, `diff`.

Panel and sessions: `start`, `continue [id]`, `sessions`, plus headless
`session start` / `session switch <id>` / `session current`.

Setup: `skills add`, `init`, `config`.

For front ends and agents: `state`, `resolve-anchors`, `watch`.

Every verb takes `--json`. Agent-authored actions go through the
`remarque agent …` variant, which the skills handle for you.

## For tool builders

remarque is a small engine behind a documented CLI/JSON contract, so you can drive
it from any agent or build your own front end on the same data.

Anchoring works by pinning each comment to content (blob sha plus surrounding
lines) and re-resolving it to its current line on every read. When the code a
comment referred to is gone, the comment is marked `outdated` rather than moved
somewhere misleading.

The `--json` output and the on-disk store share one versioned schema
(`schemaVersion`). Writes are atomic and lock-guarded, so an agent and a front end
can write at the same time without corrupting anything.

You can also embed it instead of shelling out:

```ts
import { Review } from "remarque";

const review = await Review.open({ cwd });
const state = await review.state();
```

## License

MIT.
