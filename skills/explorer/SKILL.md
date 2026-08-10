---
name: explorer
description: Use when a reader needs to understand a changeset, a stack of pull requests, or an unfamiliar subsystem — pre-PR review, onboarding a feature that spans repositories, or answering "how does this actually work" where the answer is spread across files.
---

# Explorer

## Overview

You write a document for one senior developer reading it cold. The tool guarantees
the code in it is real; you supply the judgement about what matters.

`explorer render` reads every code block out of git at a pinned SHA. You cannot type code
into the document — you emit a path and a line range, and the tool fetches it. That removes
fabrication from the problem, and leaves you the only job that was ever hard: deciding what
to say and in what order.

## When to use

- A stack of pull requests where something changes mid-stack and is invisible in review.
- A feature that spans repositories, so no single diff shows it.
- An unfamiliar subsystem, with no diff at all — "what persists, where, and what breaks".
- Any time the honest summary is longer than the reader's attention.

Not for: a single small diff a reader can just look at, or anything where you would end up
quoting the whole file.

## The procedure

Order matters. Steps 2 and 4 are deliberately not adjacent.

1. **Pin the sources, then run `explorer pin`.** For each repo, find the ref that holds the
   work: `git log --oneline master..<branch>` maps branches to tickets, and
   `git worktree list` finds a stacked branch checked out elsewhere. Write the front matter,
   then pin it **before** you read anything. A branch name is not a pin — see Drift.
2. **Read the code, not the diffs.** Diffs show what moved; they hide what the moved code
   now does. Open the files.
3. **Read the test names, not the test bodies.**
   `git show <sha>:<file> | grep -nE "^[[:space:]]*(it|test|def test)"`. The names are a
   written record of what the author believed mattered, and the gaps between them are usually
   the better finding. (`git grep -E` does not understand `\s`; use `[[:space:]]`.)
4. **Read the PR prose last.** It is claimed intent, not evidence. Reading it first tells you
   what to see. Reading it last lets you notice where it and the code disagree — which is
   often the most valuable sentence in the document.
5. **Hunt absences on purpose.** The strongest findings are things that are *not* there: no
   analytics call, no test for a path, no reader of a flag. Absence cannot be cited, so it
   must be searched for — and the search stated. See Claiming an absence.
6. **Draft against the budget**, in the shape below.
7. **`explorer check <doc.md>`** until it exits 0, then **read the whole thing cold.** If you
   would not send it to a colleague, it is not done.

## What the document is

A recipe, not a template. Produce these parts, in this order, and omit any that has nothing
in it.

1. **A lead that carries the findings.** First paragraph, before any structure. It names the
   two or three things a reader must know, in plain sentences. If your opening paragraph only
   says what the subject *is*, you have buried the lead.
2. **The shape.** Where the pieces live and how they relate. A list, if it is a list.
3. **What to read.** For a changeset: `core` files with a one-line reason each, and the rest
   named as a group. For a subsystem: the files *and the symbols inside them* that carry the
   behaviour. Write each path as `` `<source-id> <path>` `` — the tool resolves and links it.
4. **The findings**, most important first, each one earning its place with a citation.
5. **What the tests cover, and what they do not.** Name the specific untested scenarios.
6. **What follows the existing pattern.** One sentence and one citation for the whole
   category. Anything conventional gets named and dismissed, not toured.
7. **What you could not determine.** Brief, specific, and honest about what would settle it.

**Order the whole document by importance, and let it taper** — journalism's inverted pyramid.
When you need to cut, cut from the bottom.

## Doctrine

- **Length is a budget.** Around 1,500 words, whether the subject is three files or sixty-five.
  A fixed budget is what forces ranking; you cannot pay per-file attention out of it.
- **Cite the code instead of describing it.** "This calculates the order count" tells a reader
  who can already read code nothing. Show the four lines and spend your words on what is
  surprising about them.
- **Rank by surprise, not by size.** Two lines that change a shared contract outrank eight
  hundred lines of scaffolding.
- **Write dry.** Short sentences, active voice, simple tenses, one idea per sentence. Connective
  flourishes — "together they are a trap", "everything below is about the seams" — carry no
  information and read as filler. State the finding and stop.
- **Test code is support; test coverage is core.** What the suites assert is a finding. What
  they omit is usually a better one.
- **State the answer, not the choice.** If one of two systems is deprecated, the section says
  which to use and what the split costs. Do not stage a decision the reader does not have.
- **Captions carry the contrast.** A citation shows what the code is; the caption says what it
  was, or what it is not. "Previously `borderWidth: 1`, for every variant at every size."

## Drift

`head: dev-219` names a branch, and a stacked branch gets rebased. Resolve it at render time
and the same line range shows different code beside unchanged prose — silently, because the
range still resolves. This is the guarantee failing in the one way that does not look like a
failure.

So a document records `sha:` per source, and a branch that has moved off it is a build
failure. `explorer pin` writes those SHAs. Pin first, before reading, so the tree cannot
change underneath the analysis.

When `check` reports `moved-head`, **re-read the citations before repinning.** Pinning is
mechanical; it records where the branch is, and does nothing to the sentences. Repinning a
drifted document just makes it wrong quietly instead of loudly. For a document that reports
on a tree that is no longer any branch's tip — most finished documents — set `head:` to the
SHA itself and leave a comment naming the branch it was.

This was found by accident: three of nine citations in the first document had drifted within a
day, two of them onto completely unrelated code, and `check` exited 0.

## Claiming an absence

`:::cite` makes fabricated code inexpressible. It does nothing for "there is no X" — the
sentence most likely to be wrong, because nothing checks it.

Before writing one: run the search, over the whole relevant surface, and say so in the
document. "The feature contains no `analytics.track` call. I checked every non-test file the
three PRs add." A reader can audit that sentence. "The feature has no analytics" is a rumour.

Two absence claims in the first two documents were wrong on the first attempt, and both were
caught by searching rather than re-reading.

## Red flags

| You are about to… | Instead |
|---|---|
| Open with what the subject is | Open with what the reader must know |
| Describe a function in prose | Cite it and say what is surprising |
| Give every file a paragraph | Rank: core, then the rest as a group |
| Write "there is no…" | Run the search, then state the search |
| Quote the PR to explain intent | Reconstruct intent from code; note where they differ |
| Tour a conventional pattern | One sentence, one citation, move on |
| Add a section because it feels missing | Cut from the bottom; the budget is fixed |
| Repin a drifted document to make `check` pass | Re-read the citations first; `check` was right |

## Format and tooling

`explorer pin <doc.md>` records each source's current SHA in the front matter.
`explorer check <doc.md>` resolves citations and file references; exit 0 means every claim
about a path is true. `explorer render <doc.md> -o <out.html>` writes the artifact and refuses
if anything fails. `--style panel` (default) or `terminal`.

Syntax, front matter, and the failure messages are in
[references/format.md](references/format.md).
