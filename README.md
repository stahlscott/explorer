# explorer

A tool for explaining code to a person who has to understand it — a changeset, a
stack of pull requests, an unfamiliar subsystem.

The repository ships two sibling skills: [explorer](skills/explorer/SKILL.md) for
changeset and subsystem explanation, and [navigator](skills/navigator/SKILL.md) for
architecture-led orientation before a change. Both produce the shared offline
document contract described in [the format reference](skills/explorer/references/format.md).

The guarantee, in one sentence:

> No sentence asserts anything about the code without showing that code, and
> every line of code shown is read from the repository at the pinned SHA, not
> written by the model.

The tool does not structure the explanation. A writer — usually an agent
following [the skill](skills/explorer/SKILL.md) — decides what matters, in what
order, and what to leave out. The tool does the two things a writer cannot be
trusted with: pull real code out of git at a pinned commit, and render it well.

Fabricated code is not caught, it is **inexpressible**: you may only emit a path
and a line range, and the renderer fetches the bytes.

## Install

Node 22 or newer.

```sh
git clone <this repo> && cd explorer
npm install
./scripts/install.sh
```

That puts `explorer` in `~/.local/bin` and installs the skill once into
`~/.agents/skills`, symlinked from every agent harness it finds. Everything
points back at the checkout, so `git pull` updates all of them.

The wrapper runs the TypeScript source rather than a build. A built bundle goes
stale the moment `src/` changes and keeps working, which is the exact failure
this tool exists to catch; source costs about six milliseconds more per run and
cannot be wrong. `npm run build` still produces a standalone `dist/explorer.js`
if you want one.

For the browser tests: `npx playwright install chromium`.

## Use

A document is markdown with front matter and one directive.

````markdown
---
title: Statements — how one period becomes one row
sources:
  - id: api
    repo: acme/platform          # optional; enables GitHub links
    path: ~/src/platform         # a local clone
    head: feature/statements
    sha: ae3edda18d...           # written by `explorer pin`
---

A statement is one row per account per period, and the period is half-open.

:::cite api services/billing/statements.py:20-25
A negative net returns a statement rather than starting a refund.
:::
````

```sh
explorer pin    doc.md    # record each source's current SHA
explorer check  doc.md    # resolve every citation; exit 0 means every path claim is true
explorer render doc.md    # write doc.html beside it, and print its file:// URL
```

`render --open` opens the artifact. `--editor 'zed://file{path}:{line}'` (or
`EXPLORER_EDITOR_URL`) points the per-citation editor link at your editor; the
default is VS Code.

Full syntax, front matter keys, and every failure message:
[skills/explorer/references/format.md](skills/explorer/references/format.md).

## What you get

One self-contained HTML file. No network at render time and none at view time —
highlighting is pre-rendered, styles and script are inline. It opens from
`file://`, prints, survives being emailed, and loses nothing offline.

Six reading surfaces ship in every artifact and the button cycles them: `auto`
(follows the reader's system), `light`, `dark`, `newsprint` (a broadsheet, since
the document's shape is borrowed from journalism anyway), `terminal` (green on
black, one colour, because syntax highlighting on a 5250 would be a lie), and
`geocities` (under construction since 1997). Whoever renders the file does not
choose for whoever reads it.

Each citation shows the cited lines, expandable in place to twelve lines of
context either side, and carries three links: a GitHub permalink at the pinned
SHA, an editor link (only when some checkout actually holds that commit, so it
opens the bytes the document shows), and `ask`, which copies a prompt naming the
repo, SHA, path and lines for pasting back into an agent.

## Pinning, and why drift is a failure

`head:` may name a branch, but a branch is not a commit. A stacked branch gets
rebased, the same line range still resolves, and unchanged prose ends up beside
different code — the guarantee failing in the one way that does not look like a
failure. Three of nine citations in the first real document drifted within a day,
two onto unrelated code, and `check` exited 0.

So every blob is read at `sha:`, and a branch that has moved off it fails with
`moved-head`. `explorer pin` writes those SHAs, and it is deliberately a separate
command: it records where the branch is and does nothing to the sentences.
Repinning a drifted document without re-reading its citations turns a loud
failure into a quiet lie.

## Languages

Twelve languages ship with the bundle, because the renderer cannot reach a CDN
and neither can the artifact. Anything else renders as plain text rather than
failing. Adding one is a line in `src/highlight.ts`.

## Status

The tool is tested: 116 unit tests and 22 browser tests, all of which run from a
fresh clone. The skill is tested in part — six of its rules rest on reasoning
rather than measurement. Which ones, and what would settle each, is in
[docs/verification-status.md](docs/verification-status.md). Read that before
trusting the skill's advice more than your own.

## Layout

```
src/            parse, resolve against git, render
skills/explorer the procedure and doctrine a writer follows
skills/navigator architecture-led orientation before implementation
docs/           the stack decision, and what has been verified
test/           unit tests, plus a browser suite over generated fixtures
.output/        rendered artifacts (gitignored)
```
